#!/bin/bash
# One-time SEO Nginx setup for www.sanhoti.org (see docs/SEO_DEPLOYMENT.md).
# Idempotent: safe to re-run. Backs up config, applies changes, tests, reloads,
# and verifies. If nginx -t fails, the original config is restored automatically.
#
# Run on the EC2 instance:
#   sudo bash deploy/apply-seo-nginx.sh
#
# It will:
#   1. Add a bot-detection map (conf.d/seo-bot-map.conf)
#   2. In the sanhoti server block:
#      - 301  /index.html  ->  /
#      - proxy /sitemap.xml -> backend :5001
#      - rewrite extension-less SPA routes to /seo$uri for search bots
#      - proxy /seo/ -> backend :5001
set -euo pipefail

BACKEND="http://localhost:5001"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [ "$(id -u)" -ne 0 ]; then
  echo "❌ Run with sudo: sudo bash $0"
  exit 1
fi

# ---------- locate the site config ----------
SITE_CONF=""
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
  [ -f "$f" ] || continue
  if grep -qE "server_name[^;]*sanhoti\.org" "$f"; then
    SITE_CONF="$(readlink -f "$f")"
    break
  fi
done
if [ -z "$SITE_CONF" ]; then
  echo "❌ Could not find an nginx config with server_name sanhoti.org."
  echo "   Check /etc/nginx/sites-enabled/ and re-run, or apply docs/SEO_DEPLOYMENT.md manually."
  exit 1
fi
echo "📄 Site config: $SITE_CONF"

BACKUP="${SITE_CONF}.bak-${STAMP}"
cp "$SITE_CONF" "$BACKUP"
echo "💾 Backup: $BACKUP"

restore() {
  echo "↩️  Restoring original config..."
  cp "$BACKUP" "$SITE_CONF"
  rm -f /etc/nginx/conf.d/seo-bot-map.conf
  nginx -t && systemctl reload nginx || true
}

# ---------- 1. bot map (http context via conf.d) ----------
MAP_CONF="/etc/nginx/conf.d/seo-bot-map.conf"
if [ ! -f "$MAP_CONF" ]; then
  cat > "$MAP_CONF" <<'EOF'
# Search/AI crawlers that should receive server-rendered HTML (/seo/*).
# Social preview bots (facebookexternalhit, whatsapp, twitterbot) are NOT here —
# they are handled by the app's /og/ routes.
map $http_user_agent $is_seo_bot {
    default 0;
    ~*(googlebot|google-inspectiontool|googleother|storebot-google|mediapartners-google|google-safety|bingbot|slurp|duckduckbot|baiduspider|yandex(bot)?|applebot|petalbot|gptbot|oai-searchbot|perplexitybot|claudebot|amazonbot|ecosia|qwantbot|seznambot|ia_archiver) 1;
}
EOF
  echo "✅ Created $MAP_CONF"
else
  echo "⏭  $MAP_CONF already exists"
fi

# ---------- 2. server-block snippets ----------
python3 - "$SITE_CONF" "$BACKEND" <<'PYEOF'
import re, sys

path, backend = sys.argv[1], sys.argv[2]
src = open(path).read()
orig = src

SNIPPET = f"""
    # --- BEGIN SEO (managed by deploy/apply-seo-nginx.sh) ---
    location = /index.html {{
        # Only redirect explicit /index.html requests; internal try_files
        # fallbacks (SPA routes) must still serve the file or every page loops.
        if ($request_uri = "/index.html") {{
            return 301 https://www.sanhoti.org/;
        }}
    }}
    location = /sitemap.xml {{
        proxy_pass {backend}/sitemap.xml;
        proxy_set_header Host $host;
    }}
    location /seo/ {{
        proxy_pass {backend};
        proxy_set_header Host $host;
        proxy_set_header User-Agent $http_user_agent;
    }}
    location = /seo {{
        proxy_pass {backend};
        proxy_set_header Host $host;
    }}
    # --- END SEO ---
"""

REWRITE = """        # --- SEO bot rewrite (managed by deploy/apply-seo-nginx.sh) ---
        if ($is_seo_bot) {
            rewrite ^([^.]*)$ /seo$1 last;
        }
"""

if 'BEGIN SEO' in src:
    print('⏭  SEO location blocks already present')
else:
    # Find the server block that serves www.sanhoti.org over 443 (or the first
    # sanhoti server block) and insert the snippet right after its opening line.
    servers = [m.start() for m in re.finditer(r'server\s*\{', src)]
    target = None
    for s in servers:
        # crude block slice: from this "server {" to the next "server {" or EOF
        nxt = min([x for x in servers if x > s], default=len(src))
        block = src[s:nxt]
        if 'sanhoti.org' in block and ('443' in block or 'ssl' in block):
            target = s
            break
    if target is None:
        for s in servers:
            nxt = min([x for x in servers if x > s], default=len(src))
            if 'sanhoti.org' in src[s:nxt] and 'return 301' not in src[s:nxt][:400]:
                target = s
                break
    if target is None:
        print('❌ Could not find the sanhoti server block'); sys.exit(2)
    insert_at = src.index('{', target) + 1
    src = src[:insert_at] + SNIPPET + src[insert_at:]
    print('✅ Inserted SEO location blocks')

if 'SEO bot rewrite' in src:
    print('⏭  Bot rewrite already present')
else:
    # Insert the rewrite at the top of the SPA "location / {" block(s) that
    # contain try_files ... /index.html
    def add_rewrite(m):
        return m.group(0) + '\n' + REWRITE
    new, n = re.subn(r'location\s+/\s*\{(?=[^}]*try_files[^}]*index\.html)', add_rewrite, src)
    if n == 0:
        print('❌ Could not find "location / { ... try_files ... /index.html }"'); sys.exit(2)
    src = new
    print(f'✅ Inserted bot rewrite into {n} location block(s)')

# ---- host canonicalization: everything 301s to https://www.sanhoti.org ----

# 3a. http->https redirect must target www explicitly, not $server_name
fixed = src.replace(
    'return 301 https://$server_name$request_uri;',
    'return 301 https://www.sanhoti.org$request_uri;  # SEO: canonical www host',
)
if fixed != src:
    src = fixed
    print('✅ HTTP redirect now targets https://www.sanhoti.org')

# 3b. dedicated redirect server for the bare domain (http + https), if the
#     existing blocks currently serve both hosts
if 'SEO non-www redirect' in src:
    print('⏭  non-www redirect already present')
else:
    both = re.compile(
        r'(server_name\s+)(?:sanhoti\.org\s+www\.sanhoti\.org|www\.sanhoti\.org\s+sanhoti\.org)(\s*;)'
    )
    cert = re.search(r'ssl_certificate\s+[^;]+;', src)
    key = re.search(r'ssl_certificate_key\s+[^;]+;', src)
    if both.search(src) and cert and key and '443' in src:
        # every existing sanhoti block now serves www only; the bare domain gets
        # its own dedicated redirect block on both ports
        src = both.sub(r'\g<1>www.sanhoti.org\g<2>', src)
        src += f"""

# SEO non-www redirect (managed by deploy/apply-seo-nginx.sh)
server {{
    listen 80;
    listen 443 ssl http2;
    server_name sanhoti.org;
    {cert.group(0)}
    {key.group(0)}
    return 301 https://www.sanhoti.org$request_uri;
}}
"""
        print('✅ Added sanhoti.org -> https://www.sanhoti.org redirect (ports 80+443)')
    else:
        print('⏭  Skipped non-www redirect (config shape not recognized — verify manually with curl)')

if src != orig:
    open(path, 'w').write(src)
PYEOF
PYRC=$?
if [ $PYRC -ne 0 ]; then
  restore
  echo "❌ Could not patch the config automatically. Apply docs/SEO_DEPLOYMENT.md manually."
  exit 1
fi

# ---------- 3. test & reload ----------
if ! nginx -t; then
  restore
  echo "❌ nginx -t failed — original config restored. Apply docs/SEO_DEPLOYMENT.md manually."
  exit 1
fi
systemctl reload nginx
echo "✅ Nginx reloaded"

# ---------- 4. verify ----------
echo ""
echo "🔎 Verifying..."
echo -n "  /index.html 301:        "
curl -sk -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://www.sanhoti.org/index.html || true
echo -n "  /sitemap.xml dynamic:   "
curl -sk https://www.sanhoti.org/sitemap.xml | grep -q "durga-puja" && echo "OK (contains /durga-puja)" || echo "CHECK MANUALLY"
echo -n "  bot gets rendered HTML: "
curl -sk -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  https://www.sanhoti.org/durga-puja | grep -q "<h1>Durga Puja" && echo "OK" || echo "CHECK MANUALLY (is the new backend deployed?)"
echo -n "  humans get the SPA:     "
curl -sk https://www.sanhoti.org/durga-puja | grep -q 'id="root"' && echo "OK" || echo "CHECK MANUALLY"
echo ""
echo "✅ Done. If any check says CHECK MANUALLY, make sure the latest code is deployed (pm2 restart sanhoti-backend) and re-run this script — it is safe to re-run."
