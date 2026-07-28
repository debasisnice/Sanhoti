# Sanhoti — Entity Authority & AI Overview Pack

_Goal: get Sanhoti **named in Google's AI Overview** and knowledge panels for "Bengali association in Orange County" / "Durga Puja in Orange County," alongside Aikotaan, BASC, Dakshini, and Sanatan Bengali Society._

**Why this pack exists:** On-page SEO wins the *blue links* — and Sanhoti already ranks organic #1 for "bengali association in orange county." But the **AI Overview** and knowledge panels assemble *entities*, not pages. Google only names an org it can corroborate across **multiple independent sources**: directories, event aggregators, a Google Business Profile, and third-party mentions. Competitors clear that bar; Sanhoti (founded 2025, off-site footprint = Facebook + WhatsApp + Instagram) does not — yet. Everything below builds that corroboration. This is off-page work only you can do; none of it is code.

---

## 0. FIRST — fix the `/index.html` duplicate (still broken as of this writing)

Verified live: `https://www.sanhoti.org/index.html` returns **HTTP 200 with stale meta tags** (no redirect), while `https://www.sanhoti.org/` serves the current build. Google indexes both and shows the stale one as a second result — splitting authority and confusing the entity. The `301 /index.html → /` in `deploy/apply-seo-nginx.sh` is **not in effect on production.**

Do this before anything else:

```bash
# verify it's actually broken
curl -sI https://www.sanhoti.org/index.html | grep -i location   # returns nothing today = broken
```

- Re-run `sudo bash deploy/apply-seo-nginx.sh` on the EC2 box **and confirm `nginx -t` + reload succeeded.**
- **Cloudflare → Caching → Purge Everything** (the stale copy is almost certainly a Cloudflare cache). Then purge the single URL `https://www.sanhoti.org/index.html` too.
- Re-check: `curl -sI https://www.sanhoti.org/index.html | grep -i location` must return `location: https://www.sanhoti.org/`.
- Search Console → **Removals** → temporary removal of `https://www.sanhoti.org/index.html` to speed Google dropping it.

---

## 1. Canonical NAP — use these EXACT values everywhere (never vary)

Consistency (Name/Address/Phone) across every listing is what lets Google merge them into one entity. Copy-paste; do not reword.

| Field | Value |
|---|---|
| **Name** | Sanhoti Bengali Association of Orange County |
| **Short name** | Sanhoti |
| **Address** | 23 Calle Alamitos, Rancho Santa Margarita, CA 92688 |
| **Phone** | +1 949-378-6425 |
| **Email** | info@sanhoti.org |
| **Website** | https://www.sanhoti.org |
| **EIN** | 39-2903777 (501(c)(3)) |
| **Founded** | 2025 |
| **Facebook** | https://www.facebook.com/SanhotiOC |
| **Instagram** | https://www.instagram.com/sanhotioc |
| **Service area** | Orange County, CA — Irvine, Costa Mesa, Tustin, Rancho Santa Margarita, Mission Viejo, Lake Forest, Aliso Viejo, Santa Ana, Anaheim; greater Southern California |
| **Categories** | Cultural association · Non-profit organization · Community center · Event organizer |

---

## 2. Ready-to-paste descriptions

**Short (≈160 chars):**
> Sanhoti is a 501(c)(3) Bengali cultural association in Orange County, CA, hosting Durga Puja, Saraswati Puja, Poila Boishakh, and concerts for families across SoCal.

**Medium (≈300 chars):**
> Sanhoti (সংহতি) is a 501(c)(3) non-profit Bengali cultural association serving Orange County and Southern California. We host Durga Puja, Saraswati Puja, Poila Boishakh (Bengali New Year), Kali Puja, live Bengali concerts, and community programs. Based in Rancho Santa Margarita; open to everyone.

**Long (≈750 chars — for GBP, GuideStar, directories):**
> Sanhoti (সংহতি, "solidarity") is a 501(c)(3) non-profit Bengali cultural association serving Orange County and Southern California. We host Durga Puja — three days of puja, pushpanjali, dhunuchi naach, sindoor khela, Bengali food, and evening concerts with visiting artists — plus Saraswati Puja, Poila Boishakh (Bengali New Year), Kali Puja, Mahalaya, picnics, and charity programs. Recent Durgotsav celebrations have been held in Costa Mesa, minutes from Irvine. While rooted in Bengali tradition, Sanhoti welcomes Bengali and Indian families, students, and visitors of all backgrounds from across SoCal. Based in Rancho Santa Margarita, CA. EIN 39-2903777. Learn more at sanhoti.org.

---

## 3. Priority listings — get on the sources the AI Overview already cites (biggest lever)

The AI Overview's carousel pulls from Facebook, AllEvents, and community directories. Do these in order; check each off.

**Tier 1 — do this week (highest impact):**
- [ ] **Google Business Profile** — https://business.google.com. Category "Cultural association" (+ Non-profit organization, Community center, Event organizer). Full NAP, long description, service area, website, logo, 10–15 Durgotsav photos. Verify (postcard/phone/video). *This is the single biggest AI/knowledge-panel signal you're missing — competitors have Maps listings, you don't.*
- [ ] **AllEvents.in** — create an **organizer profile** for Sanhoti (not just an event) and list Durga Puja 2026 + concerts. Competitors rank in the AI Overview via AllEvents.
- [ ] **Sulekha (Events, SoCal)** — list the org + Durga Puja.
- [ ] **Wikidata** — https://www.wikidata.org → create item "Sanhoti Bengali Association of Orange County": instance of = nonprofit organization; country = USA; location = Orange County, California; inception = 2025; official website = sanhoti.org; official Facebook/Instagram. Free, ~15 min, gives the knowledge graph a canonical anchor.

**Tier 2 — this month:**
- [ ] **Bing Places** + **Apple Business Connect** (feeds Siri/Maps and Copilot).
- [ ] **Yelp** — Community Service/Non-Profit.
- [ ] **GuideStar / Candid** (nonprofit profile; uses your EIN — strong trust signal).
- [ ] **IndiaCurrents**, **Little India**, and **local OC event calendars** (OC Register community calendar, Eventbrite if selling tickets).
- [ ] **Nextdoor** business/organization page for RSM/Irvine.

**Tier 3 — nice to have:**
- [ ] **DesiEvents / DesiClub / IndianEagle community listings.**
- [ ] Local temple / Indian grocery community boards that list events.

> Rule: enter the **exact** Name/Address/Phone from §1 every time. One inconsistent phone or "Assn." vs "Association" fragments the entity.

---

## 4. Event listing template (paste into AllEvents, Sulekha, Eventbrite, calendars)

**Title:** Durga Puja 2026 in Orange County — Sanhoti Durgotsav (Costa Mesa / near Irvine)

**When:** [confirm exact celebration dates] · **Where:** [venue, Costa Mesa, CA]

**Body:**
> Celebrate Durga Puja 2026 in Orange County with Sanhoti Bengali Association! Three days of traditional puja, pushpanjali (anjali), dhunuchi naach, sindoor khela, kids' performances, live Bengali concerts with visiting artists, and home-style Bengali bhog and food stalls. Open to everyone — families, students, and visitors from across Southern California. Minutes from Irvine. Tickets & details: https://www.sanhoti.org/durga-puja

Always add a photo. Link back to `sanhoti.org/durga-puja` (or the concert's `/sub-events/<id>` page).

---

## 5. Backlinks / mentions — 5 corroborating pages change what the AI will assert

You don't need many — you need *independent* ones.
- [ ] Ask **each sponsor/partner** to add "Proud sponsor of Sanhoti Bengali Association of Orange County" + link on their site.
- [ ] Ask a **partner temple / Indian grocery / restaurant** to list your Durga Puja on their events page.
- [ ] Pitch a short **local blurb** to India-community outlets (IndiaCurrents, Little India, a local OC blog): "New Bengali association brings Durga Puja to Orange County."
- [ ] **Cross-link** with any allied SoCal Bengali org you collaborate with.
- [ ] Post your dedicated pages (`/durga-puja`, `/bollywood-concerts`) in the **Facebook group + page + Instagram bio** — social citations count toward entity corroboration.

---

## 6. Content that makes you AI-quotable

AI Overviews lift clean, factual sentences. Your site already has them (homepage, `/festivals`, `/bollywood-concerts`, FAQ schema). Keep every listing's first sentence in the pattern the model wants to repeat:
> "Sanhoti Bengali Association of Orange County is a 501(c)(3) non-profit that hosts Durga Puja and Bengali cultural events across Orange County and Southern California."

---

## 7. Track it (monthly, 10 min)

- [ ] Search "bengali association in orange county" and "durga puja in orange county" — is Sanhoti in the **AI Overview** yet? In the **map pack**?
- [ ] Search Console → Performance: impressions/clicks for those queries trending up?
- [ ] GBP Insights: views, direction requests, calls.
- [ ] Any new competitor entering the AI Overview? Match wherever they're listed.

**Realistic timeline:** GBP verification + Wikidata + 3–4 directory listings typically show up in the AI Overview's source set within **4–8 weeks**, faster once the `/index.html` duplicate is finally consolidated.
