#!/bin/bash
# One-time Agent-Readiness Nginx setup for www.sanhoti.org (see docs/AGENT_READINESS.md).
# Idempotent: safe to re-run. Backs up config, applies changes, tests, reloads, verifies.
# If nginx -t fails, the original config is restored automatically.
#
# Run on the EC2 instance (after apply-seo-nginx.sh):
#   sudo bash deploy/apply-agent-ready-nginx.sh
#
# It adds, inside the sanhoti :443 server block:
#   - add_header Link (RFC 8288): advertises /.well-known/api-catalog, /sitemap.xml, /llms.txt
#   - location = /.well-known/api-catalog  -> Content-Type application/linkset+json
#   - location ~ \.md$                     -> Content-Type text/markdown
#   - location = /health                   -> proxy to backend (status endpoint)
#   - inside "location /": route Accept: text/markdown requests to /seo (Markdown for Agents)
set -euo pipefail

BACKEND="http://localhost:5001"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [ "$(id -u)" -ne 0 ]; then
  echo "❌ Run with sudo: sudo bash $0"
  exit 1
fi

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
  exit 1
fi
echo "📄 Site config: $SITE_CONF"

BACKUP="${SITE_CONF}.bak-agent-${STAMP}"
cp "$SITE_CONF" "$BACKUP"
echo "💾 Backup: $BACKUP"

restore() {
  echo "↩️  Restoring original config..."
  cp "$BACKUP" "$SITE_CONF"
  nginx -t && systemctl reload nginx || true
}

python3 - "$SITE_CONF" "$BACKEND" <<'PYEOF'
import re, sys
path, backend = sys.argv[1], sys.argv[2]
src = open(path).read()
orig = src

LINK = ('</.well-known/api-catalog>; rel="api-catalog", '
        '</sitemap.xml>; rel="sitemap", '
        '</llms.txt>; rel="service-doc"; type="text/markdown", '
        '</.well-known/agent-skills/index.json>; rel="service-meta"; type="application/json"')

SNIPPET = f"""
    # --- BEGIN AGENT-READY (managed by deploy/apply-agent-ready-nginx.sh) ---
    add_header Link '{LINK}' always;
    location = /.well-known/api-catalog {{
        default_type application/linkset+json;
        add_header Link '{LINK}' always;
        try_files $uri =404;
    }}
    location ~ \\.md$ {{
        default_type "text/markdown; charset=utf-8";
        try_files $uri =404;
    }}
    location = /health {{
        proxy_pass {backend}/health;
        proxy_set_header Host $host;
    }}
    # --- END AGENT-READY ---
"""

MD_REWRITE = """        # --- Agent markdown negotiation (managed by deploy/apply-agent-ready-nginx.sh) ---
        if ($http_accept ~* "text/markdown") {
            rewrite ^([^.]*)$ /seo$1 last;
        }
"""

# 1. server-level snippet (Link header + well-known locations + health)
if 'BEGIN AGENT-READY' in src:
    print('⏭  Agent-ready block already present')
else:
    servers = [m.start() for m in re.finditer(r'server\s*\{', src)]

    def block_of(s):
        nxt = min([x for x in servers if x > s], default=len(src))
        return src[s:nxt]

    target = None
    # Prefer the block that actually SERVES the SPA (try_files/index.html/location /)
    # on 443/ssl — not the bare-domain redirect block. Don't use "no return 301"
    # as a discriminator: the SEO script injects an /index.html 301 into this block.
    for s in servers:
        b = block_of(s)
        if 'sanhoti.org' in b and ('443' in b or 'ssl' in b) and ('try_files' in b or 'index.html' in b or 'location /' in b):
            target = s
            break
    if target is None:
        for s in servers:
            b = block_of(s)
            if 'sanhoti.org' in b and ('try_files' in b or 'index.html' in b):
                target = s
                break
    if target is None:
        print('❌ Could not find the sanhoti serving server block'); sys.exit(2)
    insert_at = src.index('{', target) + 1
    src = src[:insert_at] + SNIPPET + src[insert_at:]
    print('✅ Inserted agent-ready server snippet')

# 2. markdown rewrite inside the SPA "location / { ... try_files ... index.html }"
# Insert right after the opening brace of the location / block that serves the SPA.
# (A simple lookahead fails because the SEO script already nested an `if { }` block
# before try_files, so we scan a window instead of forbidding `}`.)
if 'Agent markdown negotiation' in src:
    print('⏭  Markdown negotiation already present')
else:
    inserted = False
    for m in re.finditer(r'location\s+/\s*\{', src):
        start = m.end()
        window = src[start:start + 600]
        if 'try_files' in window and 'index.html' in window:
            src = src[:start] + '\n' + MD_REWRITE + src[start:]
            inserted = True
            print('✅ Inserted markdown negotiation into the SPA location / block')
            break
    if not inserted:
        print('⚠️  Could not find SPA location / block for markdown rewrite (skipped)')

if src != orig:
    open(path, 'w').write(src)
PYEOF
PYRC=$?
if [ $PYRC -ne 0 ]; then
  restore
  echo "❌ Could not patch the config automatically. See docs/AGENT_READINESS.md for manual steps."
  exit 1
fi

if ! nginx -t; then
  restore
  echo "❌ nginx -t failed — original config restored."
  exit 1
fi
systemctl reload nginx
echo "✅ Nginx reloaded"

echo ""
echo "🔎 Verifying..."
echo -n "  Link header:            "
curl -skI https://www.sanhoti.org/ | grep -qi '^link:.*api-catalog' && echo "OK" || echo "CHECK MANUALLY"
echo -n "  api-catalog JSON type:  "
curl -sk -o /dev/null -w "%{content_type}\n" https://www.sanhoti.org/.well-known/api-catalog || true
echo -n "  agent-skills index:     "
curl -sk https://www.sanhoti.org/.well-known/agent-skills/index.json | grep -q '"skills"' && echo "OK" || echo "CHECK MANUALLY"
echo -n "  markdown negotiation:   "
curl -sk -H "Accept: text/markdown" -o /dev/null -w "%{content_type}\n" https://www.sanhoti.org/durga-puja || true
echo -n "  content-signal:         "
curl -sk https://www.sanhoti.org/robots.txt | grep -qi 'Content-Signal' && echo "OK" || echo "CHECK MANUALLY"
echo ""
echo "✅ Done. If a check says CHECK MANUALLY, ensure the latest frontend build + backend are deployed, then re-run (safe to re-run)."
