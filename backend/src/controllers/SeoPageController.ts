import { Request, Response } from 'express';
import { EventService } from '../services/EventService.js';
import { DurgaPujaPageService } from '../services/DurgaPujaPageService.js';
import { SubEventService } from '../services/SubEventService.js';
import { GalleryService } from '../services/GalleryService.js';
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

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Convert inline HTML (links, emphasis) to Markdown inline text. */
function inlineToMarkdown(html: string): string {
  const withLinks = html.replace(
    /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href, txt) => `[${decodeEntities(String(txt).replace(/<[^>]+>/g, '').trim())}](${href})`
  );
  return decodeEntities(withLinks.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')).trim();
}

/**
 * "Markdown for Agents": convert a prerendered `/seo` HTML document into Markdown.
 * The prerender uses a small, known tag set (h1–h3, p, ul/li, a, img, strong),
 * so a lightweight, dependency-free converter is sufficient and predictable.
 */
function htmlDocToMarkdown(fullHtml: string): string {
  const titleMatch = fullHtml.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : '';
  const mainMatch = fullHtml.match(/<main>([\s\S]*?)<\/main>/i);
  let body = mainMatch ? mainMatch[1] : fullHtml;

  body = body
    .replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/gi, (_m, alt, src) => `\n![${decodeEntities(alt)}](${src})\n`)
    .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, (_m, src) => `\n![](${src})\n`)
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_m, t) => `\n# ${inlineToMarkdown(t)}\n\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_m, t) => `\n## ${inlineToMarkdown(t)}\n\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_m, t) => `\n### ${inlineToMarkdown(t)}\n\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, t) => `- ${inlineToMarkdown(t)}\n`)
    .replace(/<\/?ul[^>]*>/gi, '\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, t) => `${inlineToMarkdown(t)}\n\n`)
    .replace(/<[^>]+>/g, '');

  body = decodeEntities(body).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return `${title ? `# ${title}\n\n` : ''}${body}\n`;
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

/**
 * Lowest positive numeric ticket price across the admin's free-text ticketing
 * fields (e.g. "$50", "40"), used as a "from" price on the Event offer so the
 * optional price/priceCurrency schema fields are populated.
 */
function lowestTicketPrice(t?: {
  adultPrice?: string;
  childPrice?: string;
  concertOnly?: string;
  weekendPackage?: string;
  familyPackage?: string;
}): string | undefined {
  if (!t) return undefined;
  const nums = [t.adultPrice, t.childPrice, t.concertOnly, t.weekendPackage, t.familyPackage]
    .map(f => {
      const m = String(f ?? '')
        .replace(/,/g, '')
        .match(/\d+(\.\d+)?/);
      return m ? parseFloat(m[0]) : NaN;
    })
    .filter(n => Number.isFinite(n) && n > 0);
  return nums.length ? String(Math.min(...nums)) : undefined;
}

/** Add whole hours to an ISO datetime, preserving its numeric timezone offset. */
function addHoursToIso(iso: string | undefined, hours: number): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  const offMatch = iso.match(/([+-]\d{2}:\d{2})$/);
  const offset = offMatch ? offMatch[1] : '+00:00';
  const sign = offset[0] === '-' ? -1 : 1;
  const [oh, om] = offset.slice(1).split(':').map(Number);
  const offsetMs = sign * (oh * 60 + om) * 60000;
  const local = new Date(d.getTime() + hours * 3600000 + offsetMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:00${offset}`
  );
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
  private galleryService: GalleryService;

  constructor() {
    this.eventService = new EventService();
    this.durgaPujaPageService = new DurgaPujaPageService();
    this.subEventService = new SubEventService();
    this.galleryService = new GalleryService();
  }

  async renderPage(req: Request, res: Response): Promise<void> {
    try {
      // Path after /seo (e.g. /seo/events/abc -> /events/abc)
      const path = (req.path.replace(/^\/seo/, '') || '/').replace(/\/+$/, '') || '/';

      const eventMatch = path.match(/^\/events\/([^/]+)$/);
      const subEventMatch = path.match(/^\/sub-events\/([^/]+)$/);
      const galleryMatch = path.match(/^\/galleries\/([^/]+)$/);
      const durgaYear = parseDurgaPujaPageYear(path);
      let html: string;
      if (path === '/') html = await this.homePage();
      else if (path === '/durga-puja') html = await this.durgaPujaRedirectPage();
      else if (durgaYear) html = await this.durgaPujaPage(durgaYear);
      else if (path === '/bengali-concerts') html = await this.bengaliConcertsPage();
      else if (path === '/festivals') html = await this.festivalsPage();
      else if (path === '/events') html = await this.eventsPage();
      else if (eventMatch) html = (await this.eventPage(decodeURIComponent(eventMatch[1]))) ?? this.notFound(res);
      else if (subEventMatch) html = (await this.subEventPage(decodeURIComponent(subEventMatch[1]))) ?? this.notFound(res);
      else if (galleryMatch) html = (await this.galleryPage(decodeURIComponent(galleryMatch[1]))) ?? this.notFound(res);
      else html = this.staticPage(path);

      if (!res.headersSent) {
        // Markdown for Agents: serve Markdown when the agent asks for it via the
        // Accept header (or ?format=md), while HTML stays the default for browsers.
        const accept = String(req.headers.accept || '');
        const wantsMarkdown = /text\/markdown/i.test(accept) || req.query.format === 'md';
        res.setHeader('Vary', 'Accept');
        if (wantsMarkdown) {
          const md = htmlDocToMarkdown(html);
          res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
          res.setHeader('x-markdown-tokens', String(Math.ceil(md.length / 4)));
          res.setHeader('Cache-Control', 'public, max-age=600');
          res.send(md);
          return;
        }
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
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
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
<a href="/">Home</a> · <a href="/durga-puja">Durga Puja</a> · <a href="/festivals">Festivals</a> ·
<a href="/bengali-concerts">Concerts</a> · <a href="/events">Events</a> · <a href="/about">About</a> ·
<a href="/galleries">Galleries</a> · <a href="/magazines">Magazines</a> · <a href="/donate">Donate</a> ·
<a href="/contact">Contact</a>
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
      foundingDate: '2025',
      foundingLocation: { '@type': 'Place', name: 'Orange County, California, USA' },
      slogan: 'Bengali Association of Orange County',
      knowsLanguage: ['Bengali', 'English'],
      knowsAbout: [
        'Durga Puja',
        'Saraswati Puja',
        'Poila Boishakh (Bengali New Year)',
        'Kali Puja',
        'Bengali culture',
        'Bengali cuisine',
        'Rabindra Sangeet',
        'Indian classical and contemporary music',
      ],
      keywords:
        'Bengali Association Orange County, Durga Puja Orange County, Bengali festival Orange County, Bengali concert Southern California, Bengali community Orange County',
      sameAs: [
        'https://www.facebook.com/SanhotiOC',
        'https://www.instagram.com/sanhotioc',
        'https://m.facebook.com/groups/1379146276699787',
        'https://chat.whatsapp.com/HzI914nVyvGIZwarXzWzlH',
      ],
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

  private eventJsonLd(event: Event, pageUrl: string, imageUrl?: string): Record<string, unknown> {
    const loc = (event.location || '').trim();
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: event.event_name || event.title || 'Event',
      url: pageUrl,
      startDate: event.event_start_dt || event.date || undefined,
      endDate: event.event_end_dt || undefined,
      description: stripHtml(event.event_description || event.description, 500) || undefined,
      ...(imageUrl ? { image: [imageUrl] } : {}),
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

  /**
   * Evergreen `/durga-puja` landing page for the year-less query
   * "Durga Puja in Orange County". This page is intentionally SELF-canonical
   * (canonical → /durga-puja) so Google has a stable, always-valid URL to rank
   * for that query — independent of the dated /durga-puja-YYYY pages (which are
   * date-specific and have had transient soft-404 indexing issues). The current
   * celebration's dated page is linked prominently for freshness/crawl paths.
   * Human visitors still get client-side redirected to the year page by
   * frontend/src/pages/DurgaPujaRedirect.tsx.
   */
  private async durgaPujaRedirectPage(): Promise<string> {
    const year = await this.durgaPujaPageService.getActiveYear();
    const target = durgaPujaPagePath(year);
    const body = `
<h1>Durga Puja in Orange County — Sanhoti Bengali Association</h1>
<p>Sanhoti hosts one of Orange County's biggest Bengali Durga Puja celebrations —
a multi-day festival of devotion, culture, and community in Southern California.
Expect traditional puja and pushpanjali (anjali), sindoor khela, dhunuchi naach,
kids' performances, live Bengali concerts with visiting artists, and home-style
Bengali bhog and food stalls. Everyone is welcome, whatever your background.</p>
<p><strong>This year:</strong> <a href="${esc(target)}">Durga Puja ${year} in Orange County →</a>
See dates, venue, tickets, and the full schedule on our ${year} page.</p>
<h2>Durga Puja with Sanhoti — what to expect</h2>
<ul>
<li>Traditional Durga Puja rituals: pushpanjali (anjali), aarti, and dhunuchi dance</li>
<li>Sindoor khela and Bijoya celebrations</li>
<li>Live Bengali music and concerts with visiting artists</li>
<li>Authentic Bengali bhog, food stalls, and cultural programs</li>
<li>Kids' performances and family-friendly community activities</li>
</ul>
<h2>Where is Durga Puja in Orange County?</h2>
<p>Sanhoti Bengali Association is based in Rancho Santa Margarita and hosts Durga
Puja at venues across Orange County (recent celebrations have been in Costa Mesa,
near Irvine), welcoming Bengali and Indian families from throughout Orange County
and Southern California. See the <a href="${esc(target)}">current year's page</a>
for the exact venue and dates.</p>
<h2>Past &amp; upcoming celebrations</h2>
<p><a href="${esc(target)}">Durga Puja ${year}</a> ·
<a href="/events">All Sanhoti events</a> ·
<a href="/galleries">Photos from past Durga Pujas</a> ·
<a href="/contact">Contact us</a></p>`;
    return this.layout({
      title: `Durga Puja in Orange County | Sanhoti Bengali Association — ${year} Dates & Tickets`,
      description: `Celebrate Durga Puja in Orange County with Sanhoti — puja, pushpanjali, dhunuchi naach, Bengali food, and live concerts. See ${year} dates, venue, and tickets. Serving Orange County & Southern California.`,
      path: '/durga-puja',
      body,
      jsonLd: [
        this.orgJsonLd(),
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'Where is Durga Puja in Orange County?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: `Sanhoti Bengali Association hosts Durga Puja in Orange County, California. Sanhoti is based in Rancho Santa Margarita and holds Durga Puja at venues across Orange County (recent celebrations near Costa Mesa and Irvine), welcoming families from throughout Orange County and Southern California. See our ${year} page for the exact venue and dates.`,
              },
            },
            {
              '@type': 'Question',
              name: 'When is Sanhoti Durga Puja this year?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: `Sanhoti's Durga Puja ${year} dates, venue, schedule, and tickets are listed on our Durga Puja ${year} page at ${ORIGIN}${target}.`,
              },
            },
            {
              '@type': 'Question',
              name: 'Is Sanhoti Durga Puja open to everyone?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. While rooted in Bengali traditions, Sanhoti Durga Puja welcomes people of all backgrounds, races, religions, and ethnicities across Orange County and Southern California.',
              },
            },
          ],
        },
      ],
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
    const ticketPrice = lowestTicketPrice(c.ticketing);
    const artists = (c.artists ?? []).filter(a => (a?.name ?? '').trim());
    // Social/streaming URLs become schema.org `sameAs` on the artist's Person node,
    // helping Google associate the performer with their official profiles.
    const artistSameAs = (a: (typeof artists)[number]): string[] =>
      (Array.isArray(a.socialLinks) ? a.socialLinks : [])
        .map(s => (s?.url ?? '').trim())
        .filter(Boolean);
    const performer =
      artists.length > 0
        ? artists.map(a => {
            const sameAs = artistSameAs(a);
            return { '@type': 'Person', name: a.name.trim(), ...(sameAs.length ? { sameAs } : {}) };
          })
        : { '@type': 'PerformingGroup', name: 'Visiting Bengali artists and Sanhoti community performers' };

    // Each featured artist becomes a nested dated concert (subEvent) so the schema
    // carries who performs and when.
    const subEventNodes: Record<string, unknown>[] = artists.map(a => {
      const name = a.name.trim();
      const start = parseArtistDateTime(a.dateTime, c.year);
      const end = addHoursToIso(start, 3);
      const imageUrl = (a.imageUrl ?? '').trim();
      const node: Record<string, unknown> = {
        '@type': 'MusicEvent',
        name: a.performanceType?.trim()
          ? `${name} — ${a.performanceType.trim()}`
          : `${name} — Live at Sanhoti Durga Puja ${year}`,
        ...(start ? { startDate: start } : {}),
        ...(end ? { endDate: end } : {}),
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        organizer: { '@type': 'Organization', name: ORG_NAME, url: ORIGIN },
        performer: {
          '@type': 'Person',
          name,
          ...(artistSameAs(a).length ? { sameAs: artistSameAs(a) } : {}),
        },
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
                ...(ticketPrice ? { price: ticketPrice, priceCurrency: 'USD' } : {}),
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
                  ...(ticketPrice ? { price: ticketPrice, priceCurrency: 'USD' } : {}),
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

  /**
   * Evergreen `/bengali-concerts` hub for the query "Bengali concert Southern
   * California" (and artist-name queries, which are high-volume in themselves).
   * Self-canonical, always valid — lists the opted-in concert sub-events and
   * links to each one's dedicated `/sub-events/:id` page. Even when there are no
   * upcoming concerts the page stays useful (evergreen intro + past line-ups).
   */
  private async bengaliConcertsPage(): Promise<string> {
    let concerts: SubEvent[] = [];
    try {
      concerts = await this.subEventService.getPublicSeoSubEvents();
    } catch {
      /* render evergreen shell without the list */
    }

    const now = Date.now();
    const upcoming = concerts.filter(
      se => se.sub_event_start_dt && new Date(se.sub_event_start_dt).getTime() >= now
    );
    const past = concerts.filter(
      se => !se.sub_event_start_dt || new Date(se.sub_event_start_dt).getTime() < now
    );

    const items = await Promise.all(
      concerts.map(async se => {
        let banner = '';
        try {
          const paths = await this.subEventService.getSubEventImages(se.sub_event_id);
          if (paths.length > 0) {
            const url = `${ORIGIN}/api/sub-events/${se.sub_event_id}/image/${encodeURIComponent(basename(paths[0]))}`;
            banner = `<img src="${esc(url)}" alt="${esc(se.sub_event_name)} — Bengali concert in Orange County">`;
          }
        } catch {
          /* banner optional */
        }
        const perf = (se.performers || '').trim();
        const where = [se.venue_name, se.venue_city && `${se.venue_city}, ${se.venue_region || 'CA'}`]
          .filter(Boolean)
          .join(', ');
        return `<li>${banner}
<h3><a href="/sub-events/${esc(se.sub_event_id)}">${esc(se.sub_event_name)}</a></h3>
${perf ? `<p>Performing live: ${esc(perf)}</p>` : ''}
<p>${esc(fmtDate(se.sub_event_start_dt))}${where ? ` — ${esc(where)}` : se.location ? ` — ${esc(se.location)}` : ''}</p>
${se.ticket_url ? `<p><a href="${esc(se.ticket_url)}" rel="noopener noreferrer">Tickets</a></p>` : ''}</li>`;
      })
    );
    const upcomingIds = new Set(upcoming.map(s => s.sub_event_id));
    const upcomingHtml = items
      .filter((_, i) => upcomingIds.has(concerts[i].sub_event_id))
      .join('\n');
    const pastHtml = items
      .filter((_, i) => !upcomingIds.has(concerts[i].sub_event_id))
      .join('\n');

    const body = `
<h1>Bengali Concerts in Orange County &amp; Southern California — Sanhoti</h1>
<p>Sanhoti brings live Bengali music to Orange County — Bollywood and contemporary
Indian artists, Rabindra Sangeet, adhunik, and band nights, most often as part of our
Durga Puja Durgotsav in Costa Mesa (minutes from Irvine). Concerts are open to Bengali
and Indian families and music lovers from across Southern California.</p>
${upcomingHtml ? `<h2>Upcoming Bengali concerts</h2>\n<ul>${upcomingHtml}</ul>` : `<p>Our next concert line-up will be announced soon — check our <a href="/durga-puja">Durga Puja page</a> and <a href="/events">Events</a> for dates and tickets.</p>`}
${pastHtml ? `<h2>Recent concerts</h2>\n<ul>${pastHtml}</ul>` : ''}
<h2>About Sanhoti's concerts</h2>
<p>Each concert has its own page with the artist, date, venue, and tickets. Sanhoti is a
501(c)(3) Bengali cultural association based in Rancho Santa Margarita, hosting concerts
and cultural evenings across Orange County and SoCal.</p>
<p><a href="/durga-puja">Durga Puja in Orange County</a> · <a href="/festivals">Bengali festivals</a> ·
<a href="/events">All events</a> · <a href="/contact">Contact us</a></p>`;

    const listNodes = concerts.map((se, i) => {
      const perfNames = (se.performers || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const type = se.seo_event_type === 'MusicEvent' ? 'MusicEvent' : 'Event';
      const node: Record<string, unknown> = {
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': type,
          name: se.sub_event_name,
          url: `${ORIGIN}/sub-events/${se.sub_event_id}`,
          ...(se.sub_event_start_dt ? { startDate: se.sub_event_start_dt } : {}),
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          eventStatus: 'https://schema.org/EventScheduled',
          organizer: { '@type': 'Organization', name: ORG_NAME, url: ORIGIN },
          location: {
            '@type': 'Place',
            name: se.venue_name || se.venue_city || 'Orange County, California',
            address: {
              '@type': 'PostalAddress',
              ...(se.venue_city ? { addressLocality: se.venue_city } : {}),
              addressRegion: se.venue_region || 'CA',
              addressCountry: 'US',
            },
          },
          ...(perfNames.length
            ? {
                performer: perfNames.map(n => ({
                  '@type': se.performer_type === 'MusicGroup' ? 'MusicGroup' : 'Person',
                  name: n,
                })),
              }
            : {}),
          ...(se.ticket_url
            ? {
                offers: {
                  '@type': 'Offer',
                  url: se.ticket_url,
                  availability: 'https://schema.org/InStock',
                  ...(se.ticket_price
                    ? { price: se.ticket_price, priceCurrency: se.ticket_currency || 'USD' }
                    : {}),
                },
              }
            : {}),
        },
      };
      return node;
    });

    return this.layout({
      title: 'Bengali Concerts in Orange County & Southern California | Sanhoti — Live Indian Music',
      description:
        'Live Bengali concerts in Orange County & Southern California with Sanhoti — Bollywood, contemporary Indian, and Rabindra Sangeet artists at Durga Puja and cultural nights near Irvine and Costa Mesa.',
      path: '/bengali-concerts',
      body,
      jsonLd: [
        this.orgJsonLd(),
        ...(listNodes.length > 0
          ? [
              {
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: 'Bengali concerts by Sanhoti in Orange County',
                itemListElement: listNodes,
              },
            ]
          : []),
      ],
    });
  }

  /**
   * Evergreen `/festivals` hub for "Bengali festivals in Orange County". A stable
   * internal-linking + topical page pointing at every festival Sanhoti runs, so
   * Google associates the domain with the full slate (Durga Puja, Saraswati Puja,
   * Poila Boishakh, Kali Puja, Mahalaya) — not just Durga Puja.
   */
  private async festivalsPage(): Promise<string> {
    const durgaYear = await this.durgaPujaPageService.getActiveYear().catch(() => new Date().getFullYear());
    let allEvents: Event[] = [];
    try {
      allEvents = await this.eventService.getActiveEvents();
    } catch {
      /* render evergreen shell without live events */
    }

    const festivals: { name: string; blurb: string; href: string; match: RegExp }[] = [
      {
        name: 'Durga Puja (Durgotsav)',
        blurb:
          "Sanhoti's flagship celebration — a multi-day festival of puja, pushpanjali, dhunuchi naach, sindoor khela, Bengali food, and live concerts in Orange County.",
        href: '/durga-puja',
        match: /durga|durgotsav/i,
      },
      {
        name: 'Saraswati Puja',
        blurb:
          'The worship of the goddess of learning and the arts, with anjali, cultural performances, and Bengali food — welcoming students and families across Orange County.',
        href: '/events',
        match: /saraswati/i,
      },
      {
        name: 'Poila Boishakh (Bengali New Year)',
        blurb:
          'Noboborsho / Baisakhi celebrations ringing in the Bengali New Year with music, food, and community in Southern California.',
        href: '/events',
        match: /poila|boishakh|noboborsho|baisakhi|bengali new year/i,
      },
      {
        name: 'Kali Puja',
        blurb:
          'Devotional evening puja honouring goddess Kali, part of Sanhoti’s annual festival calendar in Orange County.',
        href: '/events',
        match: /kali/i,
      },
      {
        name: 'Mahalaya &amp; seasonal programs',
        blurb:
          'Mahalaya recitations that open the Durga Puja season, plus Pithe Puli Utsab and other seasonal cultural programs.',
        href: '/events',
        match: /mahalaya|pithe|puli/i,
      },
    ];

    const sortByDate = (a: Event, b: Event) =>
      new Date(a.event_start_dt || a.date || 0).getTime() -
      new Date(b.event_start_dt || b.date || 0).getTime();

    const nowMs = Date.now();
    const cards = festivals
      .map(f => {
        const matches = allEvents.filter(e => f.match.test(e.event_name || e.title || '')).sort(sortByDate);
        const featured =
          matches.find(e => {
            const t = new Date(e.event_start_dt || e.date || 0).getTime();
            return t && t >= nowMs;
          }) || matches[0];
        // Card heading links to the specific event; Durga Puja keeps its landing page.
        const primaryHref =
          f.href === '/durga-puja'
            ? f.href
            : featured
              ? getEventDetailPath(featured, featured.event_id || featured.id || '')
              : f.href;
        const list = matches
          .slice(0, 3)
          .map(e => {
            const href = getEventDetailPath(e, e.event_id || e.id || '');
            const date = fmtDate(e.event_start_dt || e.date);
            return `<li><a href="${esc(href)}">${esc(e.event_name || e.title || 'Event')}</a>${
              date ? ` — ${esc(date)}` : ''
            }${e.location ? ` — ${esc(e.location)}` : ''}</li>`;
          })
          .join('\n');
        return `<li><h2><a href="${esc(primaryHref)}">${f.name}</a></h2><p>${esc(f.blurb)}</p>${
          list ? `<ul>${list}</ul>` : ''
        }</li>`;
      })
      .join('\n');

    const concertsCard = `<li><h2><a href="/bengali-concerts">Bengali concerts</a></h2><p>Live Bengali and Indian music nights with visiting artists — see the full concert line-up and tickets.</p></li>`;

    const body = `
<h1>Bengali Festivals in Orange County — Sanhoti</h1>
<p>Sanhoti (সংহতি) celebrates the full Bengali festival calendar in Orange County and
Southern California. From the grandeur of <a href="/durga-puja">Durga Puja ${durgaYear}</a>
to Saraswati Puja, Poila Boishakh (Bengali New Year), Kali Puja, and live
<a href="/bengali-concerts">Bengali concerts</a>, our festivals are open to Bengali and
Indian families — and everyone — across Costa Mesa, Irvine, Tustin, Rancho Santa Margarita,
Mission Viejo, and the wider SoCal region.</p>
<ul>${cards}
${concertsCard}</ul>
<p><a href="/events">See all upcoming events &amp; dates</a> · <a href="/galleries">Photos from past festivals</a> ·
<a href="/about">About Sanhoti</a> · <a href="/contact">Contact us</a></p>`;

    return this.layout({
      title: 'Bengali Festivals in Orange County, CA | Sanhoti — Durga Puja, Saraswati Puja, Poila Boishakh',
      description:
        'Bengali festivals in Orange County with Sanhoti: Durga Puja, Saraswati Puja, Poila Boishakh (Bengali New Year), Kali Puja, and concerts — for families across Southern California.',
      path: '/festivals',
      body,
      jsonLd: [
        this.orgJsonLd(),
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Bengali festivals celebrated by Sanhoti in Orange County',
          itemListElement: festivals.map((f, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: f.name,
            url: `${ORIGIN}${f.href}`,
          })),
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'What Bengali festivals are celebrated in Orange County?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Sanhoti Bengali Association celebrates Durga Puja, Saraswati Puja, Poila Boishakh (Bengali New Year), Kali Puja, and Mahalaya, along with cultural programs and live Bengali concerts, across Orange County and Southern California.',
              },
            },
            {
              '@type': 'Question',
              name: 'Are Sanhoti festivals open to everyone?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. While rooted in Bengali traditions, Sanhoti festivals welcome people of all backgrounds, races, religions, and ethnicities from across Orange County and Southern California.',
              },
            },
          ],
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

    // Flyer image → og:image + Event schema `image` (Google Event rich results want an image).
    let imageUrl: string | undefined;
    try {
      const filename = await this.eventService.getEventFlyerFilename(id);
      if (filename) imageUrl = `${ORIGIN}/api/events/${id}/image/${encodeURIComponent(filename)}`;
    } catch {
      /* image optional */
    }

    const body = `
<h1>${esc(name)}</h1>
<p>${esc(fmtDate(event.event_start_dt || event.date))}${event.location ? ` — ${esc(event.location)}` : ''}</p>
${imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(name)} — Sanhoti event in Orange County">` : ''}
<p>${esc(stripHtml(event.event_description || event.description, 2000))}</p>
<p><a href="/events">All Sanhoti events</a> · <a href="/durga-puja">Durga Puja in Orange County</a></p>`;
    return this.layout({
      title: `${name} | Sanhoti — Bengali Event in Orange County, CA`,
      description: desc,
      path,
      body,
      ogType: 'article',
      ogImage: imageUrl,
      jsonLd: [
        this.eventJsonLd(event, pageUrl, imageUrl),
        this.breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Events', path: '/events' },
          { name, path },
        ]),
      ],
    });
  }

  private breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        item: `${ORIGIN}${it.path === '/' ? '/' : it.path}`,
      })),
    };
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

  /** Crawlable page for a public photo gallery (/galleries/:id). */
  private async galleryPage(id: string): Promise<string | null> {
    let gallery;
    try {
      gallery = await this.galleryService.getGalleryById(id);
    } catch {
      return null;
    }
    if (!gallery || gallery.isPublic === false) return null;

    const path = `/galleries/${gallery.id}`;
    const photos = Array.isArray(gallery.photos) ? gallery.photos : [];
    const firstImg = photos.find(p => p.url)?.url;
    const ogImage = firstImg
      ? firstImg.startsWith('http')
        ? firstImg
        : `${ORIGIN}${firstImg.startsWith('/') ? '' : '/'}${firstImg}`
      : undefined;
    const date = fmtDate(gallery.event_start_dt);
    const desc =
      stripHtml(gallery.description, 300) ||
      `Photos from ${gallery.title} — Sanhoti Bengali Association of Orange County, CA${date ? ` (${date})` : ''}.`;

    const body = `
<h1>${esc(gallery.title)} — Photos</h1>
<p>${esc(desc)}</p>
${date ? `<p>${esc(date)}</p>` : ''}
${photos.length ? `<p>${photos.length} photo${photos.length === 1 ? '' : 's'} from this Sanhoti event in Orange County, California.</p>` : ''}
<p><a href="/galleries">All Sanhoti photo galleries</a> · <a href="/events">Events</a> ·
<a href="/durga-puja">Durga Puja in Orange County</a></p>`;

    return this.layout({
      title: `${gallery.title} — Photos | Sanhoti, Orange County, CA`,
      description: desc,
      path,
      body,
      ogType: 'article',
      ogImage,
      jsonLd: [
        this.orgJsonLd(),
        {
          '@context': 'https://schema.org',
          '@type': 'ImageGallery',
          name: gallery.title,
          url: `${ORIGIN}${path}`,
          ...(desc ? { description: desc } : {}),
          ...(ogImage ? { image: [ogImage] } : {}),
          isPartOf: { '@type': 'WebSite', name: ORG_NAME, url: ORIGIN },
        },
      ],
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
      '/galleries': {
        title: 'Photo Galleries | Sanhoti Bengali Association of Orange County, CA',
        description:
          'Photos from Sanhoti events in Orange County — Durga Puja, Saraswati Puja, Poila Boishakh, concerts, and community gatherings across Southern California.',
        body: `<h1>Sanhoti Photo Galleries</h1>
<p>Browse photos from past Sanhoti celebrations in Orange County: Durga Puja Durgotsav, Saraswati Puja,
Poila Boishakh, Bengali concerts, picnics, and community events across Southern California.</p>
<p><a href="/durga-puja">Durga Puja in Orange County</a> · <a href="/events">All events</a></p>`,
      },
      '/committee': {
        title: 'Committee & Board | Sanhoti Bengali Association of Orange County, CA',
        description:
          'Meet the volunteer committee and board of Sanhoti, the Bengali cultural association serving Orange County and Southern California.',
        body: `<h1>Sanhoti Committee &amp; Board</h1>
<p>Sanhoti is run by a team of volunteers dedicated to Bengali culture in Orange County, California.
Our committee organizes Durga Puja, Saraswati Puja, Poila Boishakh, concerts, and charity programs
for families across Southern California.</p>`,
      },
      '/sponsors': {
        title: 'Sponsors & Partners | Sanhoti Bengali Association of Orange County, CA',
        description:
          'Sanhoti thanks the sponsors and partners who support Bengali cultural events — Durga Puja, concerts, and community programs — in Orange County and Southern California.',
        body: `<h1>Sanhoti Sponsors &amp; Partners</h1>
<p>Our sponsors make Durga Puja and Sanhoti's cultural events in Orange County possible. Interested in
sponsoring? See our <a href="/become-our-sponsor">sponsorship opportunities</a> or
<a href="/contact">contact us</a>.</p>`,
      },
      '/become-our-sponsor': {
        title: 'Become a Sponsor | Sanhoti Durga Puja & Bengali Events, Orange County, CA',
        description:
          'Sponsor Sanhoti Durga Puja and Bengali cultural events in Orange County. Reach Bengali and Indian families across Southern California — download the sponsorship prospectus.',
        body: `<h1>Become a Sanhoti Sponsor</h1>
<p>Sponsoring Sanhoti puts your brand in front of Bengali and Indian families across Orange County and
Southern California at Durga Puja, concerts, and cultural events. <a href="/contact">Contact us</a> for
the sponsorship prospectus and packages.</p>`,
      },
      '/magazines': {
        title: 'Magazines & Souvenirs | Sanhoti Bengali Association of Orange County, CA',
        description:
          "Read Sanhoti's Bengali magazines and Durga Puja souvenir publications — stories, poems, and art from the Bengali community of Orange County and Southern California.",
        body: `<h1>Sanhoti Magazines &amp; Souvenirs</h1>
<p>Our Durga Puja souvenir magazines feature Bengali writing, poetry, and art from the community in
Orange County and Southern California. <a href="/durga-puja">See Durga Puja in Orange County</a>.</p>`,
      },
      '/notices': {
        title: 'Notices & Announcements | Sanhoti Bengali Association of Orange County, CA',
        description:
          'Latest notices and announcements from Sanhoti Bengali Association — event dates, tickets, and community updates for Orange County and Southern California.',
        body: `<h1>Sanhoti Notices &amp; Announcements</h1>
<p>Community notices and announcements from Sanhoti — Durga Puja dates and tickets, event updates, and
news for Bengali families in Orange County, California. <a href="/events">See all events</a>.</p>`,
      },
      '/news': {
        title: 'News & Media | Sanhoti Bengali Association of Orange County, CA',
        description:
          'News and media coverage of Sanhoti Bengali Association — Durga Puja, concerts, and cultural events in Orange County and Southern California.',
        body: `<h1>Sanhoti News &amp; Media</h1>
<p>News and media about Sanhoti's Bengali cultural events in Orange County, California — including Durga
Puja, concerts, and community programs across Southern California.</p>`,
      },
      '/documents': {
        title: 'Documents | Sanhoti Bengali Association of Orange County, CA',
        description:
          'Public documents from Sanhoti Bengali Association, a 501(c)(3) non-profit (EIN 39-2903777) in Orange County, California.',
        body: `<h1>Sanhoti Documents</h1>
<p>Public documents and resources from Sanhoti, a 501(c)(3) non-profit Bengali cultural association in
Orange County, California (EIN 39-2903777).</p>`,
      },
      '/book-your-seat': {
        title: 'Book Your Seat | Sanhoti Durga Puja, Orange County, CA',
        description:
          'Reserve your seat for Sanhoti Durga Puja and cultural events in Orange County, California. Select seats and complete your booking online.',
        body: `<h1>Book Your Seat — Sanhoti Durga Puja</h1>
<p>Reserve seats for Sanhoti's Durga Puja and cultural events in Orange County, California.
See the <a href="/durga-puja">Durga Puja page</a> for dates, venue, and tickets.</p>`,
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
