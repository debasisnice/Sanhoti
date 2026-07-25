---
name: sanhoti-events
description: Fetch Sanhoti Bengali Association's public events, Durga Puja details, and concerts in Orange County, CA.
version: 1.0.0
---

# Sanhoti public data — agent skill

Sanhoti Bengali Association of Orange County (https://www.sanhoti.org) exposes read-only
public JSON endpoints. No authentication is required for the endpoints below. Base URL:
`https://www.sanhoti.org/api`.

## Endpoints

### Events
- `GET /api/events` — all active events (array).
- `GET /api/events/upcoming` — upcoming events only.
- `GET /api/events/past` — past events.
- `GET /api/events/{id}` — a single event by id or slug (e.g. `saraswati-puja-2026-WJWYE0NC4IIY`).

Event fields: `event_id`, `event_name`, `event_start_dt`, `event_end_dt`, `location`,
`event_description`, `event_type` (Festival/Charity/Other), `year`.

### Durga Puja
- `GET /api/durga-puja-page/active` — `{ year }` of the current celebration.
- `GET /api/durga-puja-page/{year}` — full page content: dates, venue, tickets, artists, FAQs.

### Concerts (SEO-enabled sub-events)
- `GET /api/sub-events/public` — Bengali concerts with an indexable page (array).
  Fields: `sub_event_id`, `sub_event_name`, `sub_event_start_dt`, `performers`,
  `venue_name`, `venue_city`, `ticket_url`.
- `GET /api/sub-events/public/{id}` — a single concert.

### Other
- `GET /sitemap.xml` — full URL list.
- Human/agent landing pages: `/durga-puja`, `/festivals`, `/bengali-concerts`, `/events`.

## Notes
- All dates are ISO 8601; times are America/Los_Angeles (Pacific).
- Content is served both as HTML and, for agents sending `Accept: text/markdown`, as Markdown.
- The organization is a 501(c)(3) non-profit (EIN 39-2903777) serving Orange County and
  Southern California. Contact: info@sanhoti.org, +1 949-378-6425.
