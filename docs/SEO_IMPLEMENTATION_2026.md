# SEO overhaul — implementation notes & handoff

What changed in the codebase, what you need to do outside it, and how to verify.

---

## 1. Indexing correctness (highest priority — this was actively costing you)

**Soft-404s.** `SeoPageController.staticPage()` previously returned a generic HTTP **200** page for *any* unrecognised path. Every typo'd URL, stale link, and crawler-invented URL was an indexable page declaring itself canonical — the classic cause of "Duplicate without user-selected canonical" and "Soft 404" in Search Console. Unknown paths now return a real **404**. The SPA catch-all (`DurgaPujaYearRoute`) previously redirected unknown slugs to `/` client-side, also with a 200; it now renders a `NotFound` page with `noindex`.

**Pages that exist but shouldn't be indexed** (`/login`, `/register`, `/dashboard`, `/admin/*`, `/events/:id/rsvp`, `/sub-events/:id/rsvp`) return **200 + `noindex`** via `isNoindexRoute`. A 404 would have been wrong — those pages serve real content to users, and telling a crawler they don't exist is a content mismatch.

**Nothing is blocked that should be indexed.** `robots.txt` disallows only `/admin/`, `/dashboard/`, `/login`, `/register`, `/api/`, and none of those appear in the sitemap — listing a robots-disallowed URL is exactly what produces "Indexed, though blocked by robots.txt".

**Sitemap duplicate fixed.** Durga Puja events resolve to `/durga-puja-<year>` through `getEventDetailPath`, so they collided with entries generated from the Durga year list and the same URL was emitted twice. Entries are now deduplicated by path, merging images and keeping the newest `lastmod`.

## 2. Artist pages — the "search the artist's name, find Sanhoti" goal

Previously performers were a comma-separated string on an event. There was no URL, no entity, and nothing for Google to rank against an artist's name.

Now: **`/artists`** (index) and **`/artists/<slug>`** (one page per artist), backed by a full `Artist` model with its own admin manager at **Admin → Artists**.

Each artist page emits `Person` or `MusicGroup` schema carrying:

- `alternateName` — spelling variants (people misspell artist names constantly)
- `sameAs` — Wikipedia/Wikidata plus social and streaming profiles. **This is the single strongest signal** for letting Google reconcile your page with the real-world person. Fill it in whenever one exists.
- `performerIn` plus each Sanhoti appearance as an `Event` node whose `performer` references the artist by `@id`, explicitly linking the two entities
- `VideoObject` for performance videos (can earn a video thumbnail in results)

Events and sub-events link artists via `artist_ids`. Appearances also fall back to matching the legacy `performers` text, so your existing concerts show up without manual re-linking.

**Slugs are stable.** Renaming an artist keeps the old slug working as an alias rather than 404-ing a URL Google has already indexed.

## 3. Prerendered pages are no longer thinner than the real ones

`/galleries`, `/notices`, `/news`, `/magazines`, and `/documents` served Googlebot two hard-coded paragraphs while real users saw the full list — Google was indexing strictly *less* content than the site has. All five now render the real records. `/about`, `/contact`, `/donate`, `/committee`, `/sponsors`, and `/become-our-sponsor` were expanded from stubs into substantial pages.

## 4. New landing pages

| URL | Targets |
|---|---|
| `/charity` | "charitable organization in Orange County" — 501(c)(3) status, EIN, causes, tax-deductibility |
| `/saraswati-puja` | "Saraswati Puja Orange County" |
| `/poila-boishakh` | "Poila Boishakh / Bengali New Year Orange County" |
| `/kali-puja` | "Kali Puja / Diwali Orange County" |
| `/bengali-food` | "Bengali food Orange County", "bhog" — with `Menu` schema |
| `/artists`, `/artists/<slug>` | artist-name searches |

The three festival pages previously shared `/festivals`, so no URL could rank for an individual festival plus a location. Each pulls in its matching live events automatically and carries its own `FAQPage` schema. All are linked from the footer sitewide — the sitemap alone is a weak discovery signal.

## 5. Admin forms now drive SEO

A shared **SEO panel** on the event and sub-event forms collects:

- **Page title** and **meta description** — with live character counters warning at Google's truncation points, and a preview of the auto-generated fallback when left blank
- **Image alt text** — feeds accessibility and Google Images
- **FAQs** — published as `FAQPage` structured data, eligible to appear directly in results
- **Performing artists** — links the event to artist pages

Every field carries inline guidance explaining what it does and why it matters.

## 6. Images

Gallery photos used `alt="Photo 1"` — useless to screen readers and invisible to Google Images. They now use caption → gallery title → organisation + location. Gallery pages emit `ImageGallery`/`ImageObject` schema, and the sitemap includes **image entries** (154 on current data) with titles and captions.

---

## What you need to do (outside the code)

1. **Deploy**, then in Search Console **submit the sitemap** and use URL Inspection → *Request indexing* for: `/artists`, `/charity`, `/bengali-food`, `/saraswati-puja`, `/poila-boishakh`, `/kali-puja`, and each `/artists/<slug>`.
2. **Add your artists** under Admin → Artists — including past performers; past performances still attract searches for that name. Prioritise: correct name spelling, alternate spellings, Wikipedia URL, social links, and a substantial bio. A thin artist page will not outrank the competition for a well-known singer's name.
3. **Link artists to their events** in the event/sub-event forms so the appearance lists populate.
4. **Fill the SEO panel** on your main events, especially Durga Puja and the concerts.
5. In Search Console, watch **Pages → Why pages aren't indexed** over the next few weeks. Soft-404 and duplicate-canonical counts should fall to zero.

## Verification status

| Check | Result |
|---|---|
| Backend TypeScript compile | ✅ clean |
| Frontend TypeScript compile | ✅ clean |
| All 24 public routes return 200 | ✅ |
| Junk URLs return 404 | ✅ |
| Login/admin/RSVP return 200 + `noindex` | ✅ |
| Canonicals correct, no `/seo` leakage | ✅ |
| Exactly one `<h1>` per page | ✅ |
| All JSON-LD parses, every node typed | ✅ |
| Artist entity wiring (`sameAs`, `alternateName`, `@id`, VideoObject, breadcrumb) | ✅ |
| Sitemap: no duplicates, no robots-blocked URLs, valid lastmod, escaped | ✅ |

**Not run in this environment:** the `vitest` suites and the production Vite bundle. `node_modules` in the working copy were installed for macOS, and the verification sandbox is Linux, so the native `rollup`/`esbuild` binaries are missing (`Cannot find module @rollup/rollup-linux-arm64-gnu`). This is unrelated to the code changes — the TypeScript half of `npm run build` passes cleanly for both packages. **Please run `npm test` and `npm run build` locally before deploying.**
