# SEO Deployment Runbook (Nginx + Search Console)

Companion to `docs/SEO_PLAN.md`. The app-side changes (bot-rendered pages at `/seo/*`, dynamic
sitemap, slugged event URLs, `/durga-puja` page) ship with the normal deploy. The steps below are
**one-time server changes on the EC2 instance** — without them, `/sitemap.xml` will serve the SPA
shell (the static file was removed) and bots won't get pre-rendered HTML.

## 1. Nginx changes

Edit the site config (e.g. `/etc/nginx/sites-available/sanhoti`), then `sudo nginx -t && sudo systemctl reload nginx`.

### a. Bot detection map (goes in the `http` context, or top of the conf file outside `server`)

```nginx
# Search engine & AI crawlers get server-rendered HTML from the backend (/seo/*)
map $http_user_agent $is_seo_bot {
    default 0;
    ~*(googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex(bot)?|applebot|petalbot|gptbot|oai-searchbot|perplexitybot|claudebot|amazonbot|ecosia|qwantbot|seznambot|ia_archiver) 1;
}
```

Note: social preview bots (facebookexternalhit, WhatsApp, Twitterbot) are already handled by the
existing `/og/...` routes — do not add them here, or event share previews will change behavior.

### b. Inside the `server` block for www.sanhoti.org

```nginx
# --- SEO: kill duplicate homepage URL (Google indexed /index.html separately) ---
location = /index.html {
    return 301 https://www.sanhoti.org/;
}

# --- SEO: dynamic sitemap from the backend (static file was removed from the build) ---
location = /sitemap.xml {
    proxy_pass http://localhost:5001/sitemap.xml;
    proxy_set_header Host $host;
}

# --- SEO: dynamic rendering — bots get crawlable HTML for SPA routes ---
# Add the rewrite INSIDE the existing SPA location block, before try_files:
location / {
    if ($is_seo_bot) {
        rewrite ^(.*)$ /seo$1 last;
    }
    try_files $uri $uri/ /index.html;
}

location /seo/ {
    proxy_pass http://localhost:5001;
    proxy_set_header Host $host;
    proxy_set_header User-Agent $http_user_agent;
}
location = /seo {
    proxy_pass http://localhost:5001;
    proxy_set_header Host $host;
}
```

Caveat: `if ($is_seo_bot)` with `rewrite ... last` is one of the safe uses of `if` in Nginx.
Static assets (`/assets/...`, images) are matched by `$uri` before the rewrite matters only for
bots; bots requesting real files still get them because the rewrite sends them to `/seo/assets/...`
— to avoid that, keep asset locations (e.g. `location /assets/`) defined **above** `location /`,
or guard the rewrite: only rewrite when the request has no file extension:

```nginx
location / {
    if ($is_seo_bot) {
        rewrite ^([^.]*)$ /seo$1 last;   # only extension-less paths (SPA routes)
    }
    try_files $uri $uri/ /index.html;
}
```

Use this second form — it's the safer one.

### c. Host canonicalization (non-www → www, http → https)

Verify a `server` block exists that 301s `sanhoti.org` (and `http://`) to `https://www.sanhoti.org`.
If Cloudflare fronts the site, a Cloudflare Redirect Rule works too. Test:

```bash
curl -sI https://sanhoti.org/ | grep -i location        # expect https://www.sanhoti.org/
curl -sI https://www.sanhoti.org/index.html | grep -i location  # expect 301 → /
```

## 2. Verify after reload

```bash
# Sitemap now dynamic (contains /durga-puja and slugged event URLs):
curl -s https://www.sanhoti.org/sitemap.xml | head -40

# Bot gets pre-rendered HTML (real <h1>, canonical, JSON-LD):
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  https://www.sanhoti.org/durga-puja | head -40

# Human/regular UA still gets the SPA:
curl -s https://www.sanhoti.org/durga-puja | grep -c 'id="root"'
```

## 3. Google Search Console (manual, one-time)

1. Verify property for `https://www.sanhoti.org` (domain property preferred) — see
   `docs/GOOGLE_SEARCH_CONSOLE_SETUP.md`.
2. Sitemaps → submit `https://www.sanhoti.org/sitemap.xml`.
3. URL Inspection → `https://www.sanhoti.org/index.html` → after the 301 is live, request indexing
   of `https://www.sanhoti.org/` so Google consolidates the duplicate.
4. URL Inspection → `https://www.sanhoti.org/durga-puja` → Request indexing.
5. Repeat verification + sitemap in Bing Webmaster Tools (imports from GSC in one click).

## 4. Off-page checklist (not code — biggest ranking lever)

- [ ] Create Google Business Profile ("Cultural association", RSM address, link sanhoti.org); post events to it.
- [ ] List Durga Puja 2026 on AllEvents.in, Eventbrite, and local OC calendars once dates/venue are set.
- [ ] Ask venue + sponsors to link to https://www.sanhoti.org.
- [ ] Email Indian Eagle / TravelBeats to include Sanhoti in their SoCal Durga Puja roundup.
- [ ] Create public Facebook Page + Instagram; add URLs to `sameAs` in `frontend/index.html` JSON-LD.

## 5. Annual maintenance (each June/July — before Aikotaan publishes)

- Update `frontend/src/pages/DurgaPuja.tsx` constants (dates, venue) and the matching copy in
  `backend/src/controllers/SeoPageController.ts` (`durgaPujaPage`).
- Publish the year's Durga Puja event in the admin so it appears in the sitemap and event pages.
- Refresh event listings/citations with the new dates.
