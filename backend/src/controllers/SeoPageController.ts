import { Request, Response } from 'express';
import { EventService } from '../services/EventService.js';
import { DurgaPujaPageService } from '../services/DurgaPujaPageService.js';
import { SubEventService } from '../services/SubEventService.js';
import { getEventPath, getEventDetailPath } from '../utils/slug.js';
import { durgaPujaPagePath, parseDurgaPujaPageYear, isDurgaPujaEventName, durgaPujaEventYear } from '../utils/durgaPuja.js';
import { durgaPujaPageImageExists } from '../data/DurgaPujaPageDataHelper.js';
import { Event, SubEvent } from '../models/types.js';
import { basename } from 'path';

const ORIGIN = process.env.BASE_URL || 'https://www.sanhoti.org';
const ORG_NAME = 'Sanhoti Bengali Association of Orange County';
const ORG_ADDRESS = '23 Calle Alamitos, Rancho Santa Margarita, CA 92688';
const ORG_PHONE = '+1-949-378-6425';
const ORG_EMAIL = 'info@sanhoti.org';

function esc(s: string | undefined | null): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(s: string | undefined | null, maxLen = 300): string {
  const t = String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length <= maxLen ? t : `${t.slice(0, maxLen - 1).trimEnd()}…`;
}

/**
 * Best-effort parse of a free-text artist slot like "Friday, Oct-09 8:00 PM" or
 * "Sat, Oct 10 · 8:00 PM" into an ISO 8601 datetime, using the celebration year.
 * Returns undefined if it can't confidently parse (so we simply omit startDate).
 */
function parseArtistDateTime(raw: string | undefined, year: number | undefined): string | undefined {
  const s = String(raw ?? '').trim();
  if (!s) return undefined;
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  };
  const mMatch = s.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*/i);
  if (!mMatch) return undefined;
  const month = months[mMatch[1].toLowerCase()];
  const dMatch = s.slice((mMatch.index ?? 0) + mMatch[0].length).match(/(\d{1,2})/);
  if (!dMatch) return undefined;
  const day = parseInt(dMatch[1], 10);
  if (!day || day > 31) return undefined;

  let hh = 0;
  let mm = 0;
  const tMatch = s.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (tMatch) {
    hh = parseInt(tMatch[1], 10);
    mm = parseInt(tMatch[2], 10);
    const ap = (tMatch[3] ?? '').toLowerCase();
    if (ap === 'pm' && hh < 12) hh += 12;
    if (ap === 'am' && hh === 12) hh = 0;
  }
  const yr = year && year >= 2000 ? year : new Date().getFullYear();
  const pad = (n: number) => String(n).padStart(2, '0');
  // Pacific time: PDT (-07:00) roughly Mar–early Nov, PST (-08:00) otherwise.
  const offset = month >= 4 && month <= 10 ? '-07:00' : '-08:00';
  return `${yr}-${pad(month)}-${pad(day)}T${pad(hh)}:${pad(mm)}:00${offset}`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles',
  });
}

/**
 * Server-rendered HTML pages for search-engine crawlers (dynamic rendering).
 * Nginx rewrites bot requests for SPA routes to /seo/<path>; the URL the bot
 * sees never changes. Every page declares a canonical to the public URL, so
 * accidental direct indexing of /seo/* cannot occur.
 *
 * Keep titles/descriptions/content aligned with the React pages
 * (frontend/src/pages/*) and frontend/index.html.
 */
export class SeoPageController {
  private eventService: EventService;
  private durgaPujaPageService: DurgaPujaPageService;
  private subEventService: SubEventService;

  constructor() {
    this.eventService = new EventService();
    this.durgaPujaPageService = new DurgaPujaPageService();
    this.subEventService = new SubEventService();
  }

  async renderPage(req: Request, res: Response): Promise<void> {
    try {
      // Path after /seo (e.g. /seo/events/abc -> /events/abc)
      const path = (req.path.replace(/^\/seo/, '') || '/').replace(/\/+$/, '') || '/';

      const eventMatch = path.match(/^\/events\/([^/]+)$/);
      const subEventMatch = path.match(/^\/sub-events\/([^/]+)$/);
      const durgaYear = parseDurgaPujaPageYear(path);
      let html: string;
      if (path === '/') html = await this.homePage();
      else if (path === '/durga-puja') html = await this.durgaPujaRedirectPage();
      else if (durgaYear) html = await this.durgaPujaPage(durgaYear);
      else if (path === '/events') html = await this.eventsPage();
      else if (eventMatch) html = (await this.eventPage(decodeURIComponent(eventMatch[1]))) ?? this.notFound(res);
      else if (subEventMatch) html = (await this.subEventPage(decodeURIComponent(subEventMatch[1]))) ?? this.notFound(res);
      else html = this.staticPage(path);

      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=600');
        res.send(html);
      }
    } catch (err) {
      console.error('SEO page render error:', err);
      if (!res.headersSent) res.status(500).send('Internal server error');
    }
  }

  private layout(opts: {
    title: string;
    description: string;
    path: string;
    body: string;
    jsonLd?: Record<string, unknown>[];
    ogType?: string;
    ogImage?: string;
  }): string {
    const canonical = `${ORIGIN}${opts.path === '/' ? '/' : opts.path}`;
    const jsonLdBlocks = (opts.jsonLd ?? [])
      .map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`)
      .join('\n');
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta property="og:type" content="${esc(opts.ogType || 'website')}">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(opts.ogImage || `${ORIGIN}/images/logo.png`)}">
<meta property="og:site_name" content="${esc(ORG_NAME)}">
${jsonLdBlocks}
</head>
<body>
<header>
<a href="/">${esc(ORG_NAME)}</a>
<nav>
<a href="/">Home</a> · <a href="/durga-puja">Durga Puja</a> · <a href="/events">Events</a> ·
<a href="/about">About</a> · <a href="/galleries">Galleries</a> · <a href="/magazines">Magazines</a> ·
<a href="/donate">Donate</a> · <a href="/contact">Contact</a>
</nav>
</header>
<main>
${opts.body}
</main>
<footer>
<p>${esc(ORG_NAME)} — a 501(c)(3) non-profit. EIN 39-2903777.</p>
<p>${esc(ORG_ADDRESS)} · ${esc(ORG_EMAIL)} · ${esc(ORG_PHONE)}</p>
</footer>
</body>
</html>`;
  }

  private orgJsonLd(): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'NonprofitOrganization',
      '@id': `${ORIGIN}/#organization`,
      name: ORG_NAME,
      alternateName: ['Sanhoti', 'Sanhoti Bengali Association of Southern California'],
      url: ORIGIN,
      logo: `${ORIGIN}/images/logo.png`,
      email: ORG_EMAIL,
      telephone: ORG_PHONE,
      taxID: '39-2903777',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '23 Calle Alamitos',
        addressLocality: 'Rancho Santa Margarita',
        addressRegion: 'CA',
        postalCode: '92688',
        addressCountry: 'US',
      },
      areaServed: ['Orange County, California', 'Southern California'],
    };
  }

  private eventJsonLd(event: Event, pageUrl: string): Record<string, unknown> {
    const loc = (event.location || '').trim();
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: event.event_name || event.title || 'Event',
      url: pageUrl,
      startDate: event.event_start_dt || event.date || undefined,
      endDate: event.event_end_dt || undefined,
      description: stripHtml(event.event_description || event.description, 500) || undefined,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      organizer: { '@type': 'Organization', name: ORG_NAME, url: ORIGIN },
      location: {
        '@type': 'Place',
        name: loc || 'Orange County, California',
        address: loc
          ? { '@type': 'PostalAddress', streetAddress: loc, addressRegion: 'CA', addressCountry: 'US' }
          : { '@type': 'PostalAddress', addressRegion: 'CA', addressCountry: 'US' },
      },
    };
  }

  private eventListItems(events: Event[]): string {
    return events
      .map(e => {
        const id = e.event_id || e.id || '';
        const href = getEventDetailPath(e, id);
        const date = fmtDate(e.event_start_dt || e.date);
        return `<li><a href="${esc(href)}">${esc(e.event_name || e.title || 'Event')}</a>${
          date ? ` — ${esc(date)}` : ''
        }${e.location ? ` — ${esc(e.location)}` : ''}</li>`;
      })
      .join('\n');
  }

  private async homePage(): Promise<string> {
    let events: Event[] = [];
    try { events = await this.eventService.getUpcomingEvents(); } catch { /* render without events */ }
    const body = `
<h1>Sanhoti — Bengali Association of Orange County, California</h1>
<p>Sanhoti (সংহতি) is a non-profit 501(c)(3) Bengali cultural association serving Orange County and
Southern California. We celebrate <a href="/durga-puja">Durga Puja</a>, Saraswati Puja, Poila Boishakh
(Bengali New Year), and host Bengali concerts, cultural programs, and charity events for families in
Costa Mesa, Irvine, Tustin, Rancho Santa Margarita, Mission Viejo, and across SoCal.</p>
<h2>Upcoming Bengali events in Orange County</h2>
<ul>${this.eventListItems(events.slice(0, 10))}</ul>
<p><a href="/events">See all events</a> · <a href="/durga-puja">Durga Puja in Orange County</a></p>`;
    return this.layout({
      title: 'Sanhoti — Bengali Association of Orange County, CA | Durga Puja & Cultural Events',
      description:
        'Sanhoti Bengali Association of Orange County, CA — Durga Puja, Poila Boishakh, Bengali festivals, concerts, and community events serving Orange County and Southern California.',
      path: '/',
      body,
      jsonLd: [this.orgJsonLd()],
    });
  }

  /** "Programs & Events" section for the Durga Puja page: sub-events the admin toggled on, with banners. */
  private async durgaPujaSubEventsHtml(linkedEventId: string | undefined, year: number): Promise<string> {
    if (!linkedEventId) return '';
    let subEvents: SubEvent[] = [];
    try {
      subEvents = await this.subEventService.getSubEventsByEventId(linkedEventId);
    } catch {
      return '';
    }
    const visible = subEvents
      .filter(se => se.show_in_durga_puja_page === true && se.is_active !== false)
      .sort((a, b) => {
        const ta = a.sub_event_start_dt ? new Date(a.sub_event_start_dt).getTime() : 0;
        const tb = b.sub_event_start_dt ? new Date(b.sub_event_start_dt).getTime() : 0;
        return ta - tb;
      });
    if (visible.length === 0) return '';

    const items = await Promise.all(
      visible.map(async se => {
        let banner = '';
        try {
          const paths = await this.subEventService.getSubEventImages(se.sub_event_id);
          if (paths.length > 0) {
            const filename = basename(paths[0]);
            const url = `${ORIGIN}/api/sub-events/${se.sub_event_id}/image/${encodeURIComponent(filename)}`;
            banner = `<img src="${esc(url)}" alt="${esc(se.sub_event_name)}">`;
          }
        } catch {
          // banner optional
        }
        const date = fmtDate(se.sub_event_start_dt);
        return `<li>${banner}<h3>${esc(se.sub_event_name)}</h3>${
          date ? `<p>${esc(date)}${se.location ? ` — ${esc(se.location)}` : ''}</p>` : ''
        }${se.event_description ? `<p>${esc(stripHtml(se.event_description, 300))}</p>` : ''}</li>`;
      })
    );
    return `<h2>Durga Puja ${year} — Programs &amp; Events</h2>\n<ul>${items.join('\n')}</ul>`;
  }

  private async durgaPujaRedirectPage(): Promise<string> {
    const year = await this.durgaPujaPageService.getActiveYear();
    const target = durgaPujaPagePath(year);
    const body = `<p>Redirecting to <a href="${esc(target)}">Durga Puja ${year}</a>…</p>`;
    return this.layout({
      title: `Durga Puja in Orange County ${year} | Sanhoti`,
      description: `Durga Puja ${year} in Orange County with Sanhoti Bengali Association.`,
      path: target,
      body,
      jsonLd: [this.orgJsonLd()],
    });
  }

  private async durgaPujaPage(year: number): Promise<string> {
    const c =
      (await this.durgaPujaPageService.getContentByYear(year)) ??
      (await this.durgaPujaPageService.getContent());
    const pagePath = durgaPujaPagePath(year);
    const imageUrl = durgaPujaPageImageExists(year)
      ? `${ORIGIN}/api/durga-puja-page/${year}/image`
      : undefined;
    const years = await this.durgaPujaPageService.listYears();
    const previousYear = years.find(y => y < year);
    const faqsHtml = c.faqs
      .map(f => `<h3>${esc(f.question)}</h3>\n<p>${esc(f.answer)}</p>`)
      .join('\n');
    const subEventsHtml = await this.durgaPujaSubEventsHtml(c.linkedEventId, year);
    const ticketLinks = (c.ticketLinks ?? []).filter(t => t.label && t.url);
    const ticketsHtml =
      ticketLinks.length > 0
        ? `<h2>Tickets</h2>
${c.ticketsNote ? `<p>${esc(c.ticketsNote)}</p>` : ''}
<ul>${ticketLinks
            .map(t => `<li><a href="${esc(t.url)}" rel="noopener noreferrer">${esc(t.label)}</a></li>`)
            .join('\n')}</ul>`
        : `<h2>Tickets</h2>
<p>${c.ticketsNote ? esc(c.ticketsNote) : 'Ticket booking opens soon — check back here or see our <a href="/events">Events page</a> for updates.'}</p>`;
    const body = `
<h1>Durga Puja in Orange County ${year} — Sanhoti</h1>
<p>${esc(c.intro)}</p>
<h2>Durga Puja ${year} — dates and venue</h2>
<p>Dates: ${esc(c.datesText)}</p>
<p>Venue: ${esc(c.venueName)}${c.venueNote ? ` — ${esc(c.venueNote)}` : ''}
Check our <a href="/events">Events page</a> or join our community for updates.</p>
${imageUrl ? `<img src="${esc(imageUrl)}" alt="Sanhoti Durga Puja ${year} in Orange County — flyer">` : ''}
${ticketsHtml}
${subEventsHtml}
<h2>What to expect</h2>
<p>Traditional puja and pushpanjali (anjali), sindoor khela, dhunuchi dance, kids' performances,
Bengali concerts with visiting artists, and home-style Bengali bhog and food stalls.</p>
<h2>Frequently asked questions</h2>
${faqsHtml}
<p>${c.linkedEventId ? `<a href="/events/${esc(c.linkedEventId)}">View the event &amp; RSVP</a> · ` : ''}<a href="/events">All Sanhoti events</a> · <a href="/galleries">Photos from past celebrations</a> ·
<a href="/contact">Contact us</a>${previousYear ? ` · <a href="${esc(durgaPujaPagePath(previousYear))}">Durga Puja ${previousYear}</a>` : ''}</p>`;

    // Real featured-artist names (from the admin Artists section) power the Event
    // "performer" schema; fall back to a generic performer only when none are set.
    const artists = (c.artists ?? []).filter(a => (a?.name ?? '').trim());
    const artistNames = artists.map(a => a.name.trim());
    const performer =
      artistNames.length > 0
        ? artistNames.map(name => ({ '@type': 'Person', name }))
        : { '@type': 'PerformingGroup', name: 'Visiting Bengali artists and Sanhoti community performers' };

    // Each featured artist becomes a nested dated concert (subEvent) so the schema
    // carries who performs and when.
    const subEventNodes: Record<string, unknown>[] = artists.map(a => {
      const name = a.name.trim();
      const start = parseArtistDateTime(a.dateTime, c.year);
      const imageUrl = (a.imageUrl ?? '').trim();
      const node: Record<string, unknown> = {
        '@type': 'MusicEvent',
        name: a.performanceType?.trim()
          ? `${name} — ${a.performanceType.trim()}`
          : `${name} — Live at Sanhoti Durga Puja ${year}`,
        ...(start ? { startDate: start } : {}),
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        organizer: { '@type': 'Organization', name: ORG_NAME, url: ORIGIN },
        performer: { '@type': 'Person', name },
        location: {
          '@type': 'Place',
          name: c.venueName,
          address: {
            '@type': 'PostalAddress',
            addressLocality: c.venueCity,
            addressRegion: 'CA',
            addressCountry: 'US',
          },
        },
        ...(a.bio?.trim() ? { description: stripHtml(a.bio, 300) } : {}),
        ...(imageUrl ? { image: [imageUrl.startsWith('http') ? imageUrl : `${ORIGIN}${imageUrl}`] } : {}),
        ...(ticketLinks.length > 0
          ? {
              offers: {
                '@type': 'Offer',
                url: ticketLinks[0].url,
                availability: 'https://schema.org/InStock',
                ...(start ? { validFrom: start } : c.startDate ? { validFrom: c.startDate } : {}),
              },
            }
          : {}),
      };
      return node;
    });

    return this.layout({
      title: `Durga Puja in Orange County ${year} | Sanhoti — ${c.venueCity}, CA`,
      description: `Celebrate Durga Puja ${year} in Orange County with Sanhoti — puja, pushpanjali, dhunuchi naach, Bengali food, and concerts. Near Irvine and ${c.venueCity}, open to all of Southern California.`,
      path: pagePath,
      body,
      ogImage: imageUrl,
      jsonLd: [
        this.orgJsonLd(),
        {
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: `Sanhoti Durga Puja ${year} (Durgotsav)`,
          url: `${ORIGIN}${pagePath}`,
          image: [imageUrl || `${ORIGIN}/images/logo.png`],
          startDate: c.startDate,
          endDate: c.endDate,
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          eventStatus: 'https://schema.org/EventScheduled',
          organizer: { '@type': 'Organization', name: ORG_NAME, url: ORIGIN },
          performer,
          ...(subEventNodes.length > 0 ? { subEvent: subEventNodes } : {}),
          offers:
            ticketLinks.length > 0
              ? ticketLinks.map(t => ({
                  '@type': 'Offer',
                  name: t.label,
                  url: t.url,
                  availability: 'https://schema.org/InStock',
                  ...(c.startDate ? { validFrom: c.startDate } : {}),
                }))
              : {
                  '@type': 'Offer',
                  url: `${ORIGIN}${pagePath}`,
                  price: '0',
                  priceCurrency: 'USD',
                  availability: 'https://schema.org/InStock',
                  ...(c.startDate ? { validFrom: c.startDate } : {}),
                },
          location: {
            '@type': 'Place',
            name: c.venueName,
            address: { '@type': 'PostalAddress', addressLocality: c.venueCity, addressRegion: 'CA', addressCountry: 'US' },
          },
          description: `Three-day Durga Puja celebration in Orange County, California: puja and pushpanjali, dhunuchi naach, sindoor khela, Bengali food, and evening cultural concerts.`,
          ...(ticketLinks.length > 0 ? {} : { isAccessibleForFree: true }),
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: c.faqs.map(f => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        },
      ],
    });
  }

  private async eventsPage(): Promise<string> {
    let events: Event[] = [];
    try { events = await this.eventService.getActiveEvents(); } catch { /* render without events */ }
    const body = `
<h1>Bengali Events in Orange County — Sanhoti</h1>
<p>Upcoming and recent events from Sanhoti Bengali Association: Durga Puja, Saraswati Puja,
Poila Boishakh, Bengali concerts, picnics, and charity programs in Orange County, CA.</p>
<ul>${this.eventListItems(events)}</ul>
<p><a href="/durga-puja">Durga Puja in Orange County</a></p>`;
    return this.layout({
      title: 'Bengali Events in Orange County, CA | Sanhoti — Festivals, Concerts & Community',
      description:
        'Upcoming Bengali events in Orange County: Durga Puja, Saraswati Puja, Poila Boishakh, concerts, and community gatherings hosted by Sanhoti Bengali Association.',
      path: '/events',
      body,
      jsonLd: [this.orgJsonLd()],
    });
  }

  private async eventPage(idParam: string): Promise<string | null> {
    const event = await this.eventService.getEventById(idParam);
    if (!event) return null;
    if (isDurgaPujaEventName(event.event_name)) {
      return this.durgaPujaPage(durgaPujaEventYear(event));
    }
    const id = event.event_id || event.id || idParam;
    const path = getEventPath(event, id);
    const pageUrl = `${ORIGIN}${path}`;
    const name = event.event_name || event.title || 'Event';
    const desc =
      stripHtml(event.event_description || event.description, 300) ||
      `${name} — Bengali community event with Sanhoti in Orange County, CA.`;
    const body = `
<h1>${esc(name)}</h1>
<p>${esc(fmtDate(event.event_start_dt || event.date))}${event.location ? ` — ${esc(event.location)}` : ''}</p>
<p>${esc(stripHtml(event.event_description || event.description, 2000))}</p>
<p><a href="/events">All Sanhoti events</a> · <a href="/durga-puja">Durga Puja in Orange County</a></p>`;
    return this.layout({
      title: `${name} | Sanhoti — Bengali Event in Orange County, CA`,
      description: desc,
      path,
      body,
      ogType: 'article',
      jsonLd: [this.eventJsonLd(event, pageUrl)],
    });
  }

  /** Dedicated crawlable page for an opted-in sub-event (e.g. a concert). */
  private async subEventPage(id: string): Promise<string | null> {
    const se = await this.subEventService.getSubEventById(id);
    // Only opted-in, active sub-events get an indexable page.
    if (!se || se.seo_page_enabled !== true || se.is_active === false) return null;

    const name = se.sub_event_name || 'Event';
    const type = se.seo_event_type || 'Event';
    const area = (se.venue_area || '').trim();
    const city = (se.venue_city || '').trim();
    const region = (se.venue_region || 'CA').trim();
    const performerNames = (se.performers || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const performerType = se.performer_type === 'MusicGroup' ? 'MusicGroup' : 'Person';
    const date = fmtDate(se.sub_event_start_dt);
    const path = `/sub-events/${se.sub_event_id}`;
    const pageUrl = `${ORIGIN}${path}`;

    let imageUrl: string | undefined;
    try {
      const paths = await this.subEventService.getSubEventImages(se.sub_event_id);
      if (paths.length > 0) {
        imageUrl = `${ORIGIN}/api/sub-events/${se.sub_event_id}/image/${encodeURIComponent(basename(paths[0]))}`;
      }
    } catch {
      // image optional
    }

    const venueLine = [se.venue_name, se.venue_street, city && `${city}, ${region}`, se.venue_postal]
      .filter(Boolean)
      .join(', ');
    const areaPhrase = area || 'Orange County';
    const performerPhrase = performerNames.length ? performerNames.join(', ') : '';
    const description =
      stripHtml(se.event_description, 300) ||
      `${performerPhrase ? `${performerPhrase} — ` : ''}${name} with Sanhoti Bengali Association in ${areaPhrase}${
        city ? `, ${city}` : ''
      }, ${region}${date ? ` on ${date}` : ''}.`;

    const ticketHtml = se.ticket_url
      ? `<p><a href="${esc(se.ticket_url)}" rel="noopener noreferrer">Buy tickets</a>${
          se.ticket_price ? ` — ${esc(se.ticket_currency || 'USD')} ${esc(se.ticket_price)}` : ''
        }</p>`
      : '';

    const body = `
<h1>${esc(name)}${area ? ` in ${esc(area)}` : ''}</h1>
<p>${esc(date)}${venueLine ? ` — ${esc(venueLine)}` : se.location ? ` — ${esc(se.location)}` : ''}</p>
${performerNames.length ? `<p>Performing live: ${esc(performerNames.join(', '))}</p>` : ''}
${imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(name)}${area ? ` — ${esc(area)}` : ''}">` : ''}
<p>${esc(stripHtml(se.event_description, 2000) || description)}</p>
${ticketHtml}
<p><a href="/durga-puja">Sanhoti Durga Puja in Orange County</a> · <a href="/events">All Sanhoti events</a> ·
<a href="/contact">Contact us</a></p>`;

    const eventJsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': type,
      name,
      url: pageUrl,
      startDate: se.sub_event_start_dt || undefined,
      endDate: se.sub_event_end_dt || undefined,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      organizer: { '@type': 'Organization', name: ORG_NAME, url: ORIGIN },
      location: {
        '@type': 'Place',
        name: se.venue_name || se.location || `${areaPhrase}, California`,
        address: {
          '@type': 'PostalAddress',
          ...(se.venue_street ? { streetAddress: se.venue_street } : {}),
          ...(city ? { addressLocality: city } : {}),
          addressRegion: region,
          ...(se.venue_postal ? { postalCode: se.venue_postal } : {}),
          addressCountry: 'US',
        },
      },
      description,
      ...(imageUrl ? { image: [imageUrl] } : {}),
      ...(performerNames.length
        ? { performer: performerNames.map(n => ({ '@type': performerType, name: n })) }
        : {}),
      ...(se.ticket_url
        ? {
            offers: {
              '@type': 'Offer',
              url: se.ticket_url,
              ...(se.ticket_price
                ? { price: se.ticket_price, priceCurrency: se.ticket_currency || 'USD' }
                : {}),
              availability: 'https://schema.org/InStock',
              ...(se.sub_event_start_dt ? { validFrom: se.sub_event_start_dt } : {}),
            },
          }
        : { isAccessibleForFree: true }),
    };

    return this.layout({
      title: `${name}${area ? ` in ${area}` : ''} | Sanhoti${city ? ` — ${city}, ${region}` : ''}`,
      description,
      path,
      body,
      ogType: 'article',
      ogImage: imageUrl,
      jsonLd: [this.orgJsonLd(), eventJsonLd],
    });
  }

  private staticPage(path: string): string {
    const pages: Record<string, { title: string; description: string; body: string }> = {
      '/about': {
        title: 'About Sanhoti | Bengali Association of Orange County, CA',
        description:
          'Sanhoti is a 501(c)(3) non-profit Bengali cultural association in Orange County, CA, celebrating Durga Puja, Poila Boishakh, and Bengali heritage across Southern California.',
        body: `<h1>About Sanhoti</h1>
<p>Sanhoti (সংহতি — "solidarity") is a non-profit 501(c)(3) cultural and charitable organization
dedicated to preserving and celebrating Bengali culture in Orange County, California. Established in
2025 and based in Rancho Santa Margarita, we organize Durga Puja, Saraswati Puja, Poila Boishakh,
concerts, and charity programs open to families across Southern California.</p>`,
      },
      '/contact': {
        title: 'Contact Sanhoti | Bengali Association of Orange County, CA',
        description: `Contact Sanhoti Bengali Association of Orange County: ${ORG_EMAIL}, ${ORG_PHONE}, ${ORG_ADDRESS}.`,
        body: `<h1>Contact Sanhoti</h1>
<p>Email: ${esc(ORG_EMAIL)}<br>Phone: ${esc(ORG_PHONE)}<br>Address: ${esc(ORG_ADDRESS)}</p>`,
      },
      '/donate': {
        title: 'Donate to Sanhoti | 501(c)(3) Bengali Non-Profit in Orange County, CA',
        description:
          'Support Bengali culture in Orange County. Donations to Sanhoti, a 501(c)(3) non-profit (EIN 39-2903777), fund Durga Puja, cultural programs, and charity work.',
        body: `<h1>Donate to Sanhoti</h1>
<p>Sanhoti is a 501(c)(3) non-profit (EIN 39-2903777). Your donation funds Durga Puja and cultural
celebrations, youth programs, and charitable initiatives in Orange County, California.</p>`,
      },
    };
    const page = pages[path] ?? {
      title: 'Sanhoti — Bengali Association of Orange County, CA',
      description:
        'Sanhoti Bengali Association of Orange County, CA — Durga Puja, Bengali festivals, concerts, and community events across Southern California.',
      body: `<h1>${esc(ORG_NAME)}</h1>
<p>Bengali cultural events, Durga Puja, and community programs in Orange County, California.</p>`,
    };
    return this.layout({ ...page, path, jsonLd: [this.orgJsonLd()] });
  }

  private notFound(res: Response): string {
    res.status(404);
    return this.layout({
      title: 'Event not found | Sanhoti',
      description: 'This event could not be found. Browse current Sanhoti events in Orange County, CA.',
      path: '/events',
      body: `<h1>Event not found</h1><p><a href="/events">Browse all Sanhoti events</a></p>`,
    });
  }
}
