# Sanhoti SEO Deploy & Indexing Runbook

Execute in order. Goal: get the clean pages (`/`, `/durga-puja`, `/durga-puja-2026`) indexed and ranking for **"Durga Puja in Orange County"** and **"Durga Puja 2026 in Orange County"**. Total hands-on time ~30 min; indexing then takes days to a couple weeks.

Server facts: EC2 `44.220.179.207` · user `ubuntu` · app dir `/var/www/sanhoti` · SSH key `sanhoti-keypair.pem` · domain `sanhoti.org` (behind Cloudflare).

---

## Step 1 — Ship the code (auto-deploy)

The evergreen `/durga-puja` page and the year-page `<h1>` fix are code changes. Push `main`/`master` and the GitHub Action rebuilds + restarts on the server.

```bash
git add -A
git commit -m "SEO: evergreen /durga-puja landing page + year-page H1 targets Orange County"
git push origin main
```

Watch the run in GitHub → **Actions**. Wait for it to go green before Step 2.

---

## Step 2 — Apply the Nginx SEO config on the server (the real unblock)

This is the step that has never been run — it's why Google only has the stale `/index.html`. It adds the `/index.html → /` 301 and routes Google's crawlers to the server-rendered `/seo/*` HTML.

```bash
# from your laptop
ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207

# on the server
cd /var/www/sanhoti
git pull
sudo bash deploy/apply-seo-nginx.sh
```

The script is idempotent and self-restoring: it backs up the config, applies the changes, runs `nginx -t`, and rolls back automatically if the test fails. Expect it to end with a success message and reload Nginx.

---

## Step 3 — Purge Cloudflare

Cloudflare fronts the site and is still serving the old cached `/index.html`. Nothing above takes effect for visitors/Google until you purge.

- Cloudflare dashboard → `sanhoti.org` → **Caching → Configuration → Purge Everything**.

---

## Step 4 — Verify from your laptop (not the server)

```bash
# /index.html now 301-redirects to /
curl -sI https://www.sanhoti.org/index.html | grep -i location
# expect: location: https://www.sanhoti.org/

# Evergreen page returns 200 and self-canonicals to /durga-puja
curl -s https://www.sanhoti.org/durga-puja -A "Googlebot" | grep -i 'canonical\|<title>'
# expect a <title> "Durga Puja in Orange County | Sanhoti…" and canonical …/durga-puja

# Year page prerender is served to Googlebot (no soft-404)
curl -s https://www.sanhoti.org/durga-puja-2026 -A "Googlebot" | grep -i '<h1>\|canonical'
# expect <h1>Durga Puja in Orange County 2026 …</h1> and canonical …/durga-puja-2026
```

If any check fails, stop and re-check Steps 2–3 before touching Search Console.

---

## Step 5 — Google Search Console

1. Go to https://search.google.com/search-console and confirm the `sanhoti.org` property is verified (verify via a Cloudflare DNS TXT record if not).
2. **Sitemaps** → submit `https://www.sanhoti.org/sitemap.xml`; confirm "Success," no errors.
3. **URL Inspection** → for each URL below: paste it → **Test Live URL** → confirm "URL is available to Google" and the canonical matches the URL itself → **Request Indexing**:
   - `https://www.sanhoti.org/`
   - `https://www.sanhoti.org/durga-puja`
   - `https://www.sanhoti.org/durga-puja-2026`
4. **Removals** (optional) → temporary removal for `https://www.sanhoti.org/index.html` to push Google to drop the stale copy faster.
5. In ~1 week, check **Pages**: `/index.html` should become "Page with redirect," and the three URLs above "Indexed."

---

## Step 6 — Bing (fast, feeds other engines + AI answers)

1. https://www.bing.com/webmasters → add/verify `sanhoti.org` (you can import from Search Console).
2. Submit the same sitemap and use **URL Inspection → Request Indexing** on the three URLs.

---

## Step 7 — Off-page (what actually wins "Durga Puja in Orange County")

On-page is done; ranking now depends on authority and local signals. In priority order:

1. **Google Business Profile** — verify it. This is the #1 lever for local and "near me" searches and puts you in the map pack. Add category "Cultural Association," service area = Orange County, link to `sanhoti.org/durga-puja`, and photos.
2. **Event citations & backlinks** — list the Durga Puja on AllEvents, Eventbrite, Meetup, Allevents.in, IndiaCurrents / DesiEvents / local Patch community calendars, and get a link from the venue and each sponsor's site. (An AllEvents "Durga Puja in Orange County" listing already ranks — claim/link yours.)
3. **Reviews** — ask attendees to leave Google reviews on the Business Profile after the event.
4. **Social `sameAs`** — ensure Facebook, WhatsApp, Instagram, and YouTube all link back to `sanhoti.org` and are listed in the Organization schema.

---

## Ongoing (each year)

- Publish the dated `/durga-puja-YYYY` page early with venue, dates, schedule, and tickets; keep the evergreen `/durga-puja` pointing to it.
- After each festival, post a recap with photos (builds topical depth and freshness).
- Re-run **Request Indexing** on the new year page as soon as it's live.

---

## Quick reference — what each fix targets

| Query | Page | Status after this runbook |
|-------|------|---------------------------|
| Bengali Association in Orange County | `/` (homepage) | Already #1 — deploy protects it by killing the stale `/index.html` |
| Durga Puja in Orange County | `/durga-puja` (evergreen) | Newly self-canonical + content-rich; request indexing |
| Durga Puja 2026 in Orange County | `/durga-puja-2026` (dated) | H1 + prerender aligned; unblocked from soft-404; request indexing |
