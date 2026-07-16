# Sanhoti SEO Action Checklist

_Goal: outrank Aikotaan for "Durga Puja in Orange County" and "Bengali Association in Orange County." Your on-page SEO is already strong and you rank #2 — these are the remaining, higher-leverage fixes._

---

## 🔴 Priority 0b — Fix "Soft 404" on Durga Puja year pages

**The problem:** Search Console live-tested `/durga-puja-2026` and returned **"Page cannot be indexed: Soft 404."** It fetched successfully but was **"Crawled as: Google Inspection Tool smartphone"** — whose user-agent is *not* `Googlebot`. Nginx only routes `googlebot` to the clean server-rendered `/seo/` page, so Google's other crawlers get the raw React SPA, which client-side fetches `/api/durga-puja-page/2026`; if that render shows the "not found" fallback (stale cache, transient error), Google records a soft 404.

**Fixed in code** (already done):
1. `frontend/src/pages/DurgaPuja.tsx` — the page now only renders "not found" on an explicit **404** from the API. Transient/network/5xx/stale-cache errors keep the valid default content, so crawlers never see a soft-404.
2. `deploy/apply-seo-nginx.sh` — added `google-inspectiontool`, `googleother`, `storebot-google`, `mediapartners-google`, `google-safety` to the crawler list so Google's inspection/rendering tools also receive the prerendered `/seo/` HTML.

**To go live:** push (auto-deploys the frontend fix), **and run `sudo bash deploy/apply-seo-nginx.sh` on the server** to apply the widened bot list (this is the same script that adds the `/index.html` redirect — see Priority 1). Then purge Cloudflare, and in Search Console re-run **Test Live URL** on `/durga-puja-2026`.

**Immediate check:** the earlier soft-404 test ran at 10:03 PM, before the cache purge. Re-run **Test Live URL** now — it may already pass.

---

## 🔴 Priority 0 — Fix the hardcoded canonical (biggest indexing bug — deploy ASAP)

**The problem:** `frontend/index.html` had a hardcoded `<link rel="canonical" href="https://www.sanhoti.org/">`. Because that one static file is served for *every* SPA route, every page (e.g. `/durga-puja-2026`) told Google "my canonical is the homepage." React fixes it client-side, but Google reads the raw HTML first. This is what produces the **"Duplicate without user-selected canonical," "Alternate page with proper canonical tag,"** and **"indexing issues detected"** warnings in Search Console, and why `/durga-puja-2026` shows "Discovered – currently not indexed."

**Fixed in code** (already done): removed the hardcoded canonical from `index.html`. Per-page canonicals are set at runtime by `src/components/Seo.tsx`, and bots get correct canonicals via the `/seo/*` prerender.

**To go live:** commit + push (auto-deploys), or on the server `git pull && cd frontend && npm run build`, then **purge Cloudflare cache**. Afterward, in Search Console use **Test Live URL** on `/durga-puja-2026` → confirm the canonical now reads `https://www.sanhoti.org/durga-puja-2026` → **Request Indexing**.

---

## 🔴 Priority 1 — Fix the duplicate `/index.html` page

**The problem:** `https://www.sanhoti.org/index.html` is live, returns HTTP 200 (no redirect), and serves a **stale, older set of meta tags** — an old `<title>` without "Durga Puja," a shorter description, and fewer keywords. Meanwhile your clean root `https://www.sanhoti.org/` serves the current, fully-optimized version.

Google has indexed the weaker `/index.html` copy. This splits your ranking signals across two URLs and shows searchers the worse page. Consolidating everything onto `/` is the single biggest technical win available.

The redirect is **already written** in `deploy/apply-seo-nginx.sh` — it just isn't applied on the server yet.

### Steps

1. **SSH into the EC2 instance**, then run the existing script:
   ```bash
   cd /var/www/sanhoti        # or wherever the repo lives on the server
   git pull                   # get the latest H1 fix + any changes
   sudo bash deploy/apply-seo-nginx.sh
   ```
   It backs up the config, adds the `301 /index.html -> /` redirect, canonicalizes to `https://www.sanhoti.org`, tests, and reloads Nginx. Safe to re-run.

2. **Purge the Cloudflare cache** (Cloudflare fronts your site and is likely still serving the old `/index.html`):
   - Cloudflare dashboard → your domain → **Caching → Configuration → Purge Everything**
   - (Or purge just the URL: `https://www.sanhoti.org/index.html`)

3. **Verify** from your laptop (not the server):
   ```bash
   curl -sI https://www.sanhoti.org/index.html | grep -i location
   # expect: location: https://www.sanhoti.org/
   ```

### Faster alternative (no SSH needed)
Since Cloudflare is already in front of the site, add a **Redirect Rule** in the Cloudflare dashboard:
- Rules → Redirect Rules → Create rule
- If URI path equals `/index.html` → **Static** redirect to `https://www.sanhoti.org/` , type **301 (Permanent)**
- Deploy, then purge cache.

---

## 🟡 Priority 2 — Google Search Console (confirm & accelerate indexing)

1. Go to https://search.google.com/search-console and select/verify the `sanhoti.org` property (verify via Cloudflare DNS TXT record — easiest since Cloudflare hosts your DNS).
2. **Sitemaps →** submit `https://www.sanhoti.org/sitemap.xml`. Confirm it's read with no errors.
3. **URL Inspection →** for each of these, paste the URL, then click **Request Indexing**:
   - `https://www.sanhoti.org/`
   - `https://www.sanhoti.org/durga-puja`
   - `https://www.sanhoti.org/events`
4. **Removals →** (optional, after the 301 is live) submit a temporary removal for `https://www.sanhoti.org/index.html` to push Google to drop the stale URL faster.
5. Check **Pages** report in ~1 week: confirm `/index.html` moves to "Page with redirect" and `/` is "Indexed."
6. Set up **Bing Webmaster Tools** too (https://www.bing.com/webmasters) — same sitemap. Bing also feeds DuckDuckasho and some AI answers.

---

## 🟢 Priority 3 — Off-page authority (this is what actually beats Aikotaan)

Aikotaan outranks you mainly because it's an **older domain with more inbound links**, not because of on-page SEO. Close that gap:

- **Google Business Profile** (you're handling this) — verify it. This drives the local map pack and is the #1 off-page lever for "near me" searches.
- **Backlinks & citations** — get sanhoti.org linked from:
  - Venue partners (e.g. the school/hall you rent, Chinmaya Mission, local temples)
  - Event listings: Eventbrite, Meetup, Allevents.in, local Patch.com, DesiEvents / IndiaCurrents community calendars
  - Local Indian/Bengali org directories and the county's cultural-org listings
  - Any sponsor or vendor site ("proud sponsor of Sanhoti" + link)
  - Local press / community newsletters covering your Durga Puja
- **Social profiles** — make sure Facebook, WhatsApp, Instagram, YouTube all link back to sanhoti.org and are listed in your Organization schema (`sameAs`). You currently list only Facebook + WhatsApp.

---

## 🔵 Priority 4 — Content & freshness (compounding, over months)

- Keep a **dated Durga Puja page per year** (`/durga-puja-2026`, etc.) with the venue, schedule, and photos — you already support this. Fresh, event-specific pages win seasonal searches.
- Publish **event recaps with photos** after each festival (Poila Boishakh, Saraswati Puja) — builds topical depth.
- Ask attendees to **leave Google reviews** on your Business Profile — reviews strongly influence local ranking.

---

## ✅ Already done (no action needed)
- Homepage `<h1>` now contains "Bengali Association of Orange County, CA" (was buried in a `<p>`).
- Keyword-rich titles, meta descriptions, Open Graph & Twitter cards.
- Structured data: Organization, WebSite, FAQPage, and Event schema (with Offers).
- Dynamic `sitemap.xml`, clean `robots.txt`, crawlable SPA fallback HTML, bot pre-rendering via `/seo/*`.
