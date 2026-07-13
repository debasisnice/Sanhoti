# SEO Go-Live Checklist (do these in order)

## Step 1 — Deploy the code ✅ (done when this commit is pushed)

Push to `main` triggers the GitHub Actions deploy automatically. Confirm it finished:
GitHub → Actions → "Deploy to AWS EC2" → latest run is green.

## Step 2 — Apply the Nginx changes (one command, ~2 minutes)

From your Mac (replace the key path/host with what you use for this server; values are in
GitHub → repo Settings → Secrets if you forget):

```bash
ssh -i ~/.ssh/YOUR_KEY.pem ubuntu@YOUR_EC2_HOST "sudo bash /var/www/sanhoti/deploy/apply-seo-nginx.sh"
```

The script is idempotent (safe to re-run), backs up your config, runs `nginx -t`, auto-restores on
any failure, and prints verification results at the end. All four checks should say OK / 301:

- `/index.html` → 301 to `/`
- `/sitemap.xml` → dynamic (contains `/durga-puja`)
- Googlebot UA → pre-rendered HTML
- Normal UA → the SPA

If a check says CHECK MANUALLY, make sure Step 1's deploy finished, run
`pm2 restart sanhoti-backend` on the server, and re-run the script.

## Step 3 — Google Search Console (~10 minutes, needs your Google login)

Open https://search.google.com/search-console

1. **If sanhoti.org isn't verified yet:** Add property → "Domain" → `sanhoti.org` → verify via the
   DNS TXT record (add it in Cloudflare DNS → it verifies in minutes). See
   `docs/GOOGLE_SEARCH_CONSOLE_SETUP.md` for screenshots.
2. **Sitemaps** (left menu) → enter `https://www.sanhoti.org/sitemap.xml` → Submit.
3. **URL Inspection** (top bar) → paste `https://www.sanhoti.org/durga-puja` → "Request indexing".
4. URL Inspection → paste `https://www.sanhoti.org/` → "Request indexing".
5. URL Inspection → paste `https://www.sanhoti.org/index.html` → it should show the 301; nothing
   more to do — Google consolidates it over the next crawls.
6. Repeat in **Bing Webmaster Tools** (https://www.bing.com/webmasters): "Import from Google
   Search Console" does everything in one click.

Check back in ~1 week: Search Console → Performance → see impressions for "durga puja orange
county" begin to appear.

## Step 4 — Google Business Profile (~15 minutes + postcard wait)

This is what puts Sanhoti in the map pack for "bengali association near me" / "durga puja near
Irvine". Aikotaan has a Maps listing; Sanhoti doesn't.

Open https://business.google.com → Add business. Paste-ready values:

| Field | Value |
|---|---|
| Business name | Sanhoti Bengali Association of Orange County |
| Category (primary) | Non-profit organization |
| Category (secondary) | Cultural association, Community center |
| Address | 23 Calle Alamitos, Rancho Santa Margarita, CA 92688 |
| Service area | Orange County, CA; Irvine; Costa Mesa; Tustin; Mission Viejo; Santa Ana; Anaheim |
| Phone | +1 949-378-6425 |
| Website | https://www.sanhoti.org |
| Description (750 chars max) | Sanhoti (সংহতি) is a 501(c)(3) non-profit Bengali cultural association serving Orange County and Southern California. We host Durga Puja — three days of puja, pushpanjali, dhunuchi naach, Bengali food, and evening concerts — plus Saraswati Puja, Poila Boishakh (Bengali New Year), picnics, and charity programs. Our 2025 Durgotsav was celebrated in Costa Mesa, minutes from Irvine. Families, students, and visitors from across SoCal are welcome. EIN 39-2903777. |

After verification (postcard/phone/video): add the logo, 10–15 photos from Durgotsav 2025, and
create a **Post → Event** for Durga Puja 2026 as soon as dates/venue are set. Post monthly.

## Step 5 — Event listings (biggest off-page lever; ~30 minutes once venue is set)

Aikotaan's events rank on Google *via AllEvents pages*. List Sanhoti's Durga Puja 2026 on each of
these as soon as the venue is confirmed. Ready-to-paste listing:

**Title:** `Durga Puja 2026 in Orange County — Sanhoti Durgotsav (Costa Mesa / near Irvine)`

**Dates:** October 16–21, 2026 (post the exact celebration days when confirmed)

**Description:**
> Celebrate Durga Puja 2026 in Orange County with Sanhoti Bengali Association! Three days of
> traditional puja, pushpanjali (anjali), dhunuchi naach, sindoor khela, kids' performances,
> Bengali concerts with visiting artists, and home-style Bengali bhog and food stalls. Open to
> everyone — families, students, and visitors from across Southern California. Minutes from
> Irvine, Newport Beach, and Huntington Beach. Hosted by Sanhoti, a 501(c)(3) non-profit.
> Details & RSVP: https://www.sanhoti.org/durga-puja

**Where to post:**
- [ ] AllEvents.in (create organizer profile "Sanhoti" first) — this alone is how Aikotaan gets a
      second ranking slot
- [ ] Eventbrite (free listing; also feeds Google Events)
- [ ] Facebook Event on a public Sanhoti **Page** (create a Page — the private group doesn't rank)
- [ ] Nextdoor (Costa Mesa / Irvine / RSM neighborhoods)
- [ ] Patch.com Orange County calendar
- [ ] OC Register community calendar (ocregister.com → Things to do → submit event)
- [ ] Email travelbeats@indianeagle.com asking to be added to their annual "California Durga Puja"
      roundup (they already list SoCal pujas — free high-relevance backlink)
- [ ] Ask the venue and each sponsor to add a link to https://www.sanhoti.org

## Step 6 — Measure (monthly, 5 minutes)

- Search Console → Performance → filter queries containing "durga" and "bengali" — watch position
  trend for the target keywords.
- Google (incognito): `durga puja orange county`, `bengali association orange county`,
  `durga puja costa mesa`, `durga puja near irvine` — note who's #1.
- Expect: `/durga-puja` entering top 10 in 4–8 weeks; map-pack appearance after GBP verification.
