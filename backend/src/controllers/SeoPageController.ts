import { Request, Response } from 'express';
import { EventService } from '../services/EventService.js';
import { DurgaPujaPageService } from '../services/DurgaPujaPageService.js';
import { SubEventService } from '../services/SubEventService.js';
import { GalleryService } from '../services/GalleryService.js';
import { SettingsService } from '../services/SettingsService.js';
import { AuthService } from '../services/AuthService.js';
import type { CorporatePartnershipsContent, DurgaPujaSponsorEntry } from '../models/types.js';
import { getEventPath, getEventDetailPath } from '../utils/slug.js';
import { formatEventDate, schemaDate } from '../utils/eventDate.js';
import { durgaPujaPagePath, parseDurgaPujaPageYear, isDurgaPujaEventName, durgaPujaEventYear } from '../utils/durgaPuja.js';
import { durgaPujaPageImageExists } from '../data/DurgaPujaPageDataHelper.js';
import { ArtistService } from '../services/ArtistService.js';
import { BlogService, PublicBlog } from '../services/BlogService.js';
import { MenuService } from '../services/MenuService.js';
import { NoticeService } from '../services/NoticeService.js';
import { NewsService } from '../services/NewsService.js';
import { MagazineService } from '../services/MagazineService.js';
import { DocumentService } from '../services/DocumentService.js';
import { Artist, Event, SubEvent, EventMenu } from '../models/types.js';
import { basename } from 'path';

const ORIGIN = process.env.BASE_URL || 'https://www.sanhoti.org';
const ORG_NAME = 'Sanhoti Bengali Association of Orange County';
const LEGAL_NAME = 'Sanhoti Inc';
const ORG_ADDRESS = '23 Calle Alamitos, Rancho Santa Margarita, CA 92688';
const ORG_PHONE = '+1-949-378-6425';
const ORG_EMAIL = 'info@sanhoti.org';
// Stable node identifiers so every page's JSON-LD @graph references one Organization
// and one WebSite entity instead of repeating disconnected copies.
/**
 * An admin description at or above this length is considered enough to carry the
 * page on its own, so the generic fallback paragraph is suppressed. Roughly two
 * solid paragraphs.
 */
const RICH_DESCRIPTION_CHARS = 300;

const ORG_ID = `${ORIGIN}/#organization`;
const WEBSITE_ID = `${ORIGIN}/#website`;

/** Default Corporate Partnerships content (admin overrides via /admin/settings). */
const DEFAULT_CORP: Required<CorporatePartnershipsContent> = {
  heroTitle: 'Corporate Partnerships & CSR',
  heroSubtitle: 'Invest in Bengali culture, diversity, and community across Orange County & SoCal',
  whyPartnerTitle: 'Why Partner With Sanhoti',
  whyPartner: [
    { title: 'Advance Diversity & Inclusion', text: 'Sanhoti builds bridges across Bengali, broader Indian, and non-Indian communities, creating shared cultural experiences open to all backgrounds, races, and religions.' },
    { title: 'Invest in the Next Generation', text: 'Our year-round programming gives children and young adults hands-on exposure to Bengali language, literature, and music — supporting cultural literacy and identity.' },
    { title: 'Support Arts & Heritage', text: 'From Durga Puja and Saraswati Puja to Poila Boishakh, Sanhoti sustains centuries-old traditions and makes them accessible to wider Southern California.' },
    { title: 'Strengthen Local Community Ties', text: 'Sanhoti brings together families across Rancho Santa Margarita, Irvine, Tustin, Mission Viejo, and greater Orange County/SoCal, fostering regional civic connection.' },
  ],
  impactTitle: 'Community & Charitable Impact',
  impactIntro: 'Beyond cultural programming, Sanhoti members show up for causes across Orange County — giving companies a concrete way to co-sponsor volunteer days or fundraising drives alongside us, not just cultural festivals.',
  impact: [
    { tag: 'Hunger Relief', name: 'Walk with Second Harvest 2026', meta: 'Second Harvest Food Bank of Orange County · Tanaka Farms, Irvine', text: "Sanhoti fields a team for Second Harvest's annual community fundraising walk, supporting food-insecurity relief for Orange County families." },
    { tag: 'Domestic Violence Support', name: "Sanhoti Charity Event at Laura's House (2025)", meta: "Laura's House · Orange County", text: "A Sanhoti-organized charity event supporting Laura's House, an Orange County nonprofit providing shelter, therapy, legal advocacy, and prevention education for survivors of domestic violence." },
    { tag: 'Domestic Violence Support', name: "Sanhoti Charity Event at Laura's House (2026)", meta: "Laura's House · Orange County", text: "A continuation of Sanhoti's partnership with Laura's House, extending support to survivors of domestic violence in the local community." },
  ],
  waysTitle: 'Ways to Give or Partner',
  waysToGive: [
    'Corporate sponsorship of flagship events (Durga Puja, Saraswati Puja, Poila Boishakh, cultural concerts)',
    'Matching gift programs for employee donations',
    'In-kind support (venue space, catering, printing, A/V equipment, volunteer time)',
    'Employee volunteer days at Sanhoti events and community programs',
    'Multi-year partnership commitments for long-term cultural and educational programming',
  ],
  csrNote: 'Sanhoti is a registered 501(c)(3) nonprofit (EIN 39-2903777). Every corporate contribution is tax-deductible, and many employers match employee gifts dollar-for-dollar — check with your HR or CSR team.',
  leadershipTitle: 'Leadership',
  ctaTitle: 'Get Involved',
  ctaText: "To discuss a sponsorship, matching gift, or corporate partnership, reach out — we're happy to provide our EIN, tax-exemption letter, and program details for your company's CSR review process.",
  contactEmail: 'sanhoti.ec@gmail.com',
  contactPhone: '+1 949-378-6425',
};

/**
 * Routes that genuinely exist but must never be indexed: account pages, the
 * admin area, and per-event RSVP forms (which are duplicate, thin, and
 * parameterised).
 *
 * These need `noindex` rather than a 404. Returning 404 to a crawler for a page
 * that serves HTTP 200 to a real visitor is a content mismatch, and these URLs
 * are also disallowed in robots.txt — so the correct signal is "this exists,
 * don't index it", not "this doesn't exist".
 */
function isNoindexRoute(path: string): boolean {
  return (
    /^\/(login|register|dashboard)$/.test(path) ||
    path === '/admin' ||
    path.startsWith('/admin/') ||
    /^\/events\/[^/]+\/rsvp$/.test(path) ||
    /^\/sub-events\/[^/]+\/rsvp$/.test(path)
  );
}

/**
 * Render an event/sub-event menu as crawlable HTML. The dish names are the
 * point: specific text like "Goat Biriyani" is what wins long-tail food
 * searches, and it must be in the prerender or bots never see it.
 */
function menuHtml(menu: EventMenu | undefined, heading = 'Food &amp; menu'): string {
  const meals = (menu?.meals ?? []).filter(m => m?.name?.trim());
  if (meals.length === 0) return '';
  const mealsHtml = meals
    .map(meal => {
      const cats = (meal.categories ?? []).filter(c => c?.label && (c.items ?? []).length > 0);
      const catsHtml = cats
        .map(c => `<li><strong>${esc(c.label)}:</strong> ${esc(c.items.join(', '))}</li>`)
        .join('\n');
      return `<li><h3>${esc(meal.name)}${meal.hours ? ` — ${esc(meal.hours)}` : ''}</h3>
${meal.description ? `<p>${esc(meal.description)}</p>` : ''}
${catsHtml ? `<ul>${catsHtml}</ul>` : ''}</li>`;
    })
    .join('\n');
  const notes = [
    menu?.vegetarian ? `<li><strong>Vegetarian:</strong> ${esc(menu.vegetarian)}</li>` : '',
    menu?.kidsMenu ? `<li><strong>Kids:</strong> ${esc(menu.kidsMenu)}</li>` : '',
    menu?.allergyNotice ? `<li><strong>Allergies:</strong> ${esc(menu.allergyNotice)}</li>` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `
<h2>${heading}</h2>
${menu?.intro ? `<p>${esc(stripHtml(menu.intro, 600))}</p>` : ''}
<ul>${mealsHtml}</ul>
${notes ? `<ul>${notes}</ul>` : ''}`;
}

/**
 * schema.org Menu node for an event's food. Emitted alongside the Event rather
 * than nested inside it — schema.org Event has no `hasMenu` property.
 */
function menuJsonLd(
  menu: EventMenu | undefined,
  opts: { name: string; url: string }
): Record<string, unknown> | null {
  const meals = (menu?.meals ?? []).filter(m => m?.name?.trim());
  if (meals.length === 0) return null;
  return {
    '@type': 'Menu',
    '@id': `${opts.url}#menu`,
    name: `${opts.name} — menu`,
    url: opts.url,
    inLanguage: 'en-US',
    ...(menu?.intro ? { description: stripHtml(menu.intro, 300) } : {}),
    hasMenuSection: meals.map(meal => ({
      '@type': 'MenuSection',
      name: [meal.name, meal.hours].filter(Boolean).join(' · '),
      ...(meal.description ? { description: meal.description } : {}),
      hasMenuSection: (meal.categories ?? [])
        .filter(c => c?.label && (c.items ?? []).length > 0)
        .map(c => ({
          '@type': 'MenuSection',
          name: c.label,
          hasMenuItem: c.items.map(item => ({ '@type': 'MenuItem', name: item })),
        })),
    })),
  };
}

/** One appearance returned by ArtistService.getAppearances. */
type ArtistAppearanceEntry = { kind: 'event' | 'sub-event'; event: Event | SubEvent };

/**
 * Dedicated per-festival landing pages. Each Bengali festival previously shared
 * the single /festivals page, which left no URL able to rank for an individual
 * festival plus a location ("Saraswati Puja Orange County"). `match` picks the
 * live events that belong on each page.
 */
const FESTIVAL_LANDING: Record<
  string,
  {
    shortName: string;
    title: string;
    description: string;
    h1: string;
    intro: string;
    extra: string;
    match: RegExp;
    faqs: { q: string; a: string }[];
  }
> = {
  '/saraswati-puja': {
    shortName: 'Saraswati Puja',
    title: 'Saraswati Puja in Orange County, CA 2026 | Sanhoti Bengali Association',
    description:
      'Saraswati Puja in Orange County, California with Sanhoti — pushpanjali, hatekhori for children, Bengali bhog, and cultural programs open to all families across Southern California.',
    h1: 'Saraswati Puja in Orange County, California — Sanhoti',
    intro: `<p>Saraswati Puja — Basant Panchami — honours the goddess of knowledge, music, and the
arts. Sanhoti celebrates Saraswati Puja every spring in Orange County, California, with
traditional pushpanjali, <em>hatekhori</em> (a child's first writing ceremony), Bengali bhog,
and a cultural programme of song, recitation, and dance by our community's children and adults.</p>`,
    extra: `<h2>What happens at Sanhoti's Saraswati Puja</h2>
<ul>
<li><strong>Pushpanjali</strong> — the flower offering, performed together by all attendees.</li>
<li><strong>Hatekhori</strong> — young children write their first letters, a cherished Bengali rite of passage.</li>
<li><strong>Bhog</strong> — traditional vegetarian khichuri prasad served to everyone.</li>
<li><strong>Cultural programme</strong> — Rabindra Sangeet, recitation, dance, and performances by community members.</li>
<li><strong>Anjali attire</strong> — yellow is traditionally worn for Basant Panchami.</li>
</ul>`,
    match: /saraswat(i|ee)|basant\s*panchami|vasant\s*panchami/i,
    faqs: [
      {
        q: 'Where is Saraswati Puja celebrated in Orange County?',
        a: 'Sanhoti Bengali Association hosts Saraswati Puja in Orange County, California each spring. The venue is announced on our events page ahead of each celebration, and the event is open to all families across Orange County and Southern California.',
      },
      {
        q: 'What is hatekhori?',
        a: 'Hatekhori is the traditional Bengali ceremony marking a child’s first writing lesson, performed on Saraswati Puja day. A priest guides the child to write their first letters, symbolising the start of their education under the blessing of the goddess of learning.',
      },
      {
        q: 'Do I need a ticket to attend Saraswati Puja?',
        a: 'Sanhoti’s Saraswati Puja is generally open to the community. Where a ticket or RSVP is required to help us plan food, it is listed on the event page. Check our events page for the current year’s details.',
      },
      {
        q: 'What should I wear to Saraswati Puja?',
        a: 'Yellow is traditionally worn on Basant Panchami — saris, panjabis, or any yellow outfit. There is no dress requirement, and guests are welcome in whatever they are comfortable in.',
      },
    ],
  },
  '/poila-boishakh': {
    shortName: 'Poila Boishakh',
    title: 'Poila Boishakh (Bengali New Year) in Orange County, CA | Sanhoti',
    description:
      'Celebrate Poila Boishakh — Bengali New Year — in Orange County, California with Sanhoti. Bengali food, live music, cultural programs, and community for families across Southern California.',
    h1: 'Poila Boishakh — Bengali New Year in Orange County, California',
    intro: `<p>Poila Boishakh (পয়লা বৈশাখ) marks the first day of the Bengali calendar and is the
biggest secular celebration in the Bengali year. Sanhoti celebrates Poila Boishakh each
April in Orange County, California with a full Bengali feast, live music, and a cultural
programme — a warm, family-friendly welcome to the new year for the Bengali and Indian
community across Southern California.</p>`,
    extra: `<h2>What happens at Sanhoti's Poila Boishakh</h2>
<ul>
<li><strong>Bengali New Year feast</strong> — a full traditional menu, from fish and rice to sweets and mishti doi.</li>
<li><strong>Live music and cultural programme</strong> — Rabindra Sangeet, adhunik, band performances, dance, and recitation.</li>
<li><strong>Children's performances</strong> — our youngest community members take the stage.</li>
<li><strong>Traditional attire</strong> — red-and-white saris and panjabis are customary but entirely optional.</li>
</ul>`,
    match: /poila|pohela|pahela|boishakh|baishakh|baisakhi|bengali\s*new\s*year|nobo\s*borsho|noboborsho/i,
    faqs: [
      {
        q: 'When is Poila Boishakh celebrated?',
        a: 'Poila Boishakh, the Bengali New Year, falls in mid-April each year (usually 14 or 15 April). Sanhoti schedules its Orange County celebration on the nearest weekend so families can attend — exact dates are posted on our events page.',
      },
      {
        q: 'Where can I celebrate Bengali New Year in Orange County?',
        a: 'Sanhoti Bengali Association hosts a Poila Boishakh celebration in Orange County, California each spring, with Bengali food, live music, and cultural programs. It is open to everyone across Orange County and Southern California.',
      },
      {
        q: 'Is Poila Boishakh a religious festival?',
        a: 'No. Poila Boishakh is a secular cultural celebration of the Bengali New Year, welcoming people of every background, faith, and nationality.',
      },
      {
        q: 'What food is served at Poila Boishakh?',
        a: 'A traditional Bengali New Year menu — typically rice and fish dishes, vegetable preparations, and Bengali sweets such as rosogolla and mishti doi. Vegetarian options are always available.',
      },
    ],
  },
  '/kali-puja': {
    shortName: 'Kali Puja',
    title: 'Kali Puja & Diwali in Orange County, CA | Sanhoti Bengali Association',
    description:
      'Kali Puja and Diwali in Orange County, California with Sanhoti Bengali Association — evening puja, anjali, Bengali prasad, and cultural programs for families across Southern California.',
    h1: 'Kali Puja & Diwali in Orange County, California — Sanhoti',
    intro: `<p>Kali Puja is celebrated on the new-moon night of Kartik, coinciding with Diwali, and
is one of the most important observances in the Bengali calendar. Sanhoti marks Kali Puja in
Orange County, California with an evening puja and anjali, traditional prasad, and a cultural
gathering for Bengali and Indian families across Southern California.</p>`,
    extra: `<h2>What happens at Sanhoti's Kali Puja</h2>
<ul>
<li><strong>Evening puja and anjali</strong> — the traditional night-time worship of Goddess Kali.</li>
<li><strong>Prasad and Bengali food</strong> — served to all attendees after the puja.</li>
<li><strong>Diwali celebration</strong> — lights, community gathering, and cultural performances.</li>
<li><strong>Family friendly</strong> — children and guests of all backgrounds are welcome.</li>
</ul>`,
    match: /kali\s*p[ou]{1,2}j[ao]|shyama\s*p[ou]{1,2}j[ao]|diwali|deepavali|dipavali/i,
    faqs: [
      {
        q: 'When is Kali Puja celebrated?',
        a: 'Kali Puja falls on the new-moon night of the Bengali month of Kartik, the same night as Diwali — usually in late October or November. Sanhoti announces its Orange County celebration date on the events page each year.',
      },
      {
        q: 'How is Kali Puja different from Diwali?',
        a: 'They fall on the same night. Diwali is the pan-Indian festival of lights; Kali Puja is the Bengali observance in which Goddess Kali is worshipped at night. Bengali communities typically celebrate both together.',
      },
      {
        q: 'Can non-Bengalis attend Sanhoti’s Kali Puja?',
        a: 'Yes. Sanhoti events are open to everyone regardless of background, faith, or nationality. Guests from across Orange County and Southern California are warmly welcome.',
      },
    ],
  },
};

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

/**
 * Lowest numeric price from a free-text ticket-price field. Handles single values
 * ("60"), currency-prefixed ("$50"), and multi-tier strings ("80,60,40" -> "40")
 * so schema.org Offer.price is always a valid single number.
 */
function firstNumericPrice(raw: string | undefined | null): string | undefined {
  const nums = (String(raw ?? '').match(/\d+(\.\d+)?/g) || [])
    .map(Number)
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

/**
 * Display an event date. Delegates to the shared helper so a date-only value
 * ("2025-12-06") renders as the calendar date it is, rather than being pushed
 * back a day by a UTC-midnight parse.
 */
function fmtDate(iso: string | undefined): string {
  return formatEventDate(iso, { year: 'numeric', month: 'long', day: 'numeric' });
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
  private settingsService: SettingsService;
  private authService: AuthService;
  private artistService: ArtistService;
  private blogService: BlogService;
  private menuService: MenuService;
  private noticeService: NoticeService;
  private newsService: NewsService;
  private magazineService: MagazineService;
  private documentService: DocumentService;

  constructor() {
    this.artistService = new ArtistService();
    this.blogService = new BlogService();
    this.menuService = new MenuService();
    this.noticeService = new NoticeService();
    this.newsService = new NewsService();
    this.magazineService = new MagazineService();
    this.documentService = new DocumentService();
    this.eventService = new EventService();
    this.durgaPujaPageService = new DurgaPujaPageService();
    this.subEventService = new SubEventService();
    this.galleryService = new GalleryService();
    this.settingsService = new SettingsService();
    this.authService = new AuthService();
  }

  async renderPage(req: Request, res: Response): Promise<void> {
    try {
      // Path after /seo (e.g. /seo/events/abc -> /events/abc)
      const path = (req.path.replace(/^\/seo/, '') || '/').replace(/\/+$/, '') || '/';

      const eventMatch = path.match(/^\/events\/([^/]+)$/);
      const subEventMatch = path.match(/^\/sub-events\/([^/]+)$/);
      const galleryMatch = path.match(/^\/galleries\/([^/]+)$/);
      const artistMatch = path.match(/^\/artists\/([^/]+)$/);
      const blogMatch = path.match(/^\/blogs\/([^/]+)$/);
      const durgaYear = parseDurgaPujaPageYear(path);
      let html: string;
      if (path === '/') html = await this.homePage();
      else if (path === '/durga-puja') html = await this.durgaPujaRedirectPage();
      else if (durgaYear) html = await this.durgaPujaPage(durgaYear);
      else if (path === '/bollywood-concerts') html = await this.bollywoodConcertsPage();
      else if (path === '/festivals') html = await this.festivalsPage();
      else if (path === '/corporate-partnerships') html = await this.corporatePartnershipsPage();
      else if (path === '/events') html = await this.eventsPage(typeof req.query.type === 'string' ? req.query.type : undefined);
      else if (path === '/artists') html = await this.artistsIndexPage();
      else if (path === '/blogs') html = await this.blogsIndexPage();
      else if (path === '/charity') html = await this.charityPage();
      else if (path === '/bengali-food') html = await this.bengaliFoodPage();
      else if (FESTIVAL_LANDING[path]) html = await this.festivalLandingPage(path);
      // Data-backed list pages — render the real records, not a stub.
      else if (path === '/galleries') html = await this.galleriesIndexPage();
      else if (path === '/notices') html = await this.noticesPage();
      else if (path === '/news') html = await this.newsPage();
      else if (path === '/magazines') html = await this.magazinesPage();
      else if (path === '/documents') html = await this.documentsPage();
      else if (path === '/sponsors') html = await this.sponsorsPage();
      else if (eventMatch) html = (await this.eventPage(decodeURIComponent(eventMatch[1]))) ?? this.notFound(res, path);
      else if (subEventMatch) html = (await this.subEventPage(decodeURIComponent(subEventMatch[1]))) ?? this.notFound(res, path);
      else if (galleryMatch) html = (await this.galleryPage(decodeURIComponent(galleryMatch[1]))) ?? this.notFound(res, path);
      else if (artistMatch) html = (await this.artistPage(decodeURIComponent(artistMatch[1]))) ?? this.notFound(res, path);
      else if (blogMatch) html = (await this.blogPage(decodeURIComponent(blogMatch[1]))) ?? this.notFound(res, path);
      else if (isNoindexRoute(path)) html = this.noindexPage(path);
      else html = this.staticPage(path) ?? this.notFound(res, path);

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
    noindex?: boolean;
    /** Optional richer breadcrumb trail; otherwise a Home → page trail is auto-built. */
    breadcrumb?: { name: string; path: string }[];
  }): string {
    const canonical = `${ORIGIN}${opts.path === '/' ? '/' : opts.path}`;
    const primaryImage = opts.ogImage || `${ORIGIN}/images/logo.png`;

    // Breadcrumb — use the page's own trail, else auto Home → <page>.
    const crumbs =
      opts.breadcrumb ??
      (opts.path === '/'
        ? []
        : [
            { name: 'Home', path: '/' },
            { name: opts.title.split('|')[0].split('—')[0].trim() || opts.title, path: opts.path },
          ]);
    const breadcrumbNode =
      crumbs.length > 0
        ? {
            '@type': 'BreadcrumbList',
            '@id': `${canonical}#breadcrumb`,
            itemListElement: crumbs.map((c, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: c.name,
              item: `${ORIGIN}${c.path === '/' ? '/' : c.path}`,
            })),
          }
        : null;

    const webPageNode: Record<string, unknown> = {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: opts.title,
      description: opts.description,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': ORG_ID },
      inLanguage: 'en-US',
      primaryImageOfPage: { '@type': 'ImageObject', url: primaryImage },
      dateModified: new Date().toISOString(),
      ...(breadcrumbNode ? { breadcrumb: { '@id': `${canonical}#breadcrumb` } } : {}),
    };

    // Single connected @graph: Organization + WebSite + WebPage + Breadcrumb + page nodes.
    // Callers may still pass the Organization node — dedupe it by @id — and every member
    // node drops its own @context (the graph provides it once).
    const stripCtx = (o: Record<string, unknown>): Record<string, unknown> => {
      const clone = { ...o };
      delete clone['@context'];
      return clone;
    };
    const pageNodes = (opts.jsonLd ?? []).filter(n => n['@id'] !== ORG_ID).map(stripCtx);
    const graph = [
      stripCtx(this.orgJsonLd()),
      this.websiteNode(),
      webPageNode,
      ...(breadcrumbNode ? [breadcrumbNode] : []),
      ...pageNodes,
    ];
    const jsonLdBlocks = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    })}</script>`;
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
<meta name="robots" content="${opts.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1'}">
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
<a href="/bollywood-concerts">Concerts</a> · <a href="/events">Events</a> · <a href="/about">About</a> ·
<a href="/galleries">Galleries</a> · <a href="/magazines">Magazines</a> · <a href="/donate">Donate</a> ·
<a href="/corporate-partnerships">Corporate Partnerships</a> · <a href="/contact">Contact</a>
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

  private websiteNode(): Record<string, unknown> {
    return {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      url: ORIGIN,
      name: ORG_NAME,
      alternateName: 'Sanhoti',
      publisher: { '@id': ORG_ID },
      inLanguage: ['en-US', 'bn'],
    };
  }

  private orgJsonLd(): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'NonprofitOrganization',
      '@id': ORG_ID,
      name: ORG_NAME,
      alternateName: ['Sanhoti', 'Sanhoti Bengali Association of Southern California'],
      url: ORIGIN,
      logo: {
        '@type': 'ImageObject',
        url: `${ORIGIN}/favicon-512x512.png`,
        width: 512,
        height: 512,
      },
      image: `${ORIGIN}/images/logo.png`,
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
      geo: { '@type': 'GeoCoordinates', latitude: '33.6411', longitude: '-117.6000' },
      hasMap: 'https://www.google.com/maps/search/?api=1&query=23+Calle+Alamitos,+Rancho+Santa+Margarita,+CA+92688',
      areaServed: ['Orange County, California', 'Southern California'],
    };
  }

  private eventJsonLd(event: Event, pageUrl: string, imageUrl?: string): Record<string, unknown> {
    const loc = (event.location || '').trim();
    const name = event.event_name || event.title || 'Event';
    const start = event.event_start_dt || event.date || undefined;

    // Prefer the admin's structured venue fields; fall back to the free-text location.
    const venueName = (event.venue_name || '').trim();
    const venueCity = (event.venue_city || '').trim();
    const hasStructuredVenue = !!(venueName || venueCity || event.venue_street || event.venue_postal);
    const place = hasStructuredVenue
      ? {
          '@type': 'Place',
          name: venueName || loc || `${venueCity || 'Orange County'}, California`,
          address: {
            '@type': 'PostalAddress',
            ...(event.venue_street ? { streetAddress: event.venue_street } : {}),
            ...(venueCity ? { addressLocality: venueCity } : {}),
            addressRegion: (event.venue_region || 'CA').trim() || 'CA',
            ...(event.venue_postal ? { postalCode: event.venue_postal } : {}),
            addressCountry: 'US',
          },
        }
      : {
          '@type': 'Place',
          name: loc || 'Orange County, California',
          address: loc
            ? { '@type': 'PostalAddress', streetAddress: loc, addressRegion: 'CA', addressCountry: 'US' }
            : { '@type': 'PostalAddress', addressRegion: 'CA', addressCountry: 'US' },
        };

    // Offer from the admin's ticket fields; otherwise mark the event free.
    const price = firstNumericPrice(event.ticket_price);
    const offerFragment =
      event.ticket_url && price
        ? {
            offers: {
              '@type': 'Offer',
              url: event.ticket_url,
              price,
              priceCurrency: (event.ticket_currency || 'USD').trim() || 'USD',
              availability: 'https://schema.org/InStock',
              ...(start ? { validFrom: start } : {}),
            },
          }
        : event.ticket_url
          ? {} // ticket link with no price entered — shown on page; omit price-less Offer
          : { isAccessibleForFree: true };

    const statusMap: Record<string, string> = {
      Scheduled: 'https://schema.org/EventScheduled',
      Cancelled: 'https://schema.org/EventCancelled',
      Postponed: 'https://schema.org/EventPostponed',
      Rescheduled: 'https://schema.org/EventRescheduled',
    };
    const eventStatus = statusMap[event.event_status || 'Scheduled'] || 'https://schema.org/EventScheduled';
    const performerNames = (event.performers || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const performerType = event.performer_type === 'MusicGroup' ? 'MusicGroup' : 'Person';

    // Google Event guidelines want image, description, and endDate — always provide
    // them (fall back to the org logo, a generated description, and the start time).
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name,
      url: pageUrl,
      startDate: start,
      endDate: event.event_end_dt || start,
      description:
        stripHtml(event.event_description || event.description, 500) ||
        `${name} — a Bengali community event hosted by Sanhoti Bengali Association${venueName || loc ? ` at ${venueName || loc}` : ''} in Orange County, California.`,
      image: [imageUrl || `${ORIGIN}/images/logo.png`],
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus,
      organizer: { '@id': ORG_ID },
      ...(performerNames.length
        ? { performer: performerNames.map(n => ({ '@type': performerType, name: n })) }
        : {}),
      ...offerFragment,
      location: place,
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
    // One slice used by both the visible list and the ItemList, so the markup
    // can never describe events the page does not show.
    const homeEvents = events.slice(0, 10);
    const body = `
<h1>Sanhoti — Bengali Association of Orange County, California</h1>
<p>Sanhoti (সংহতি) is a non-profit 501(c)(3) Bengali cultural association serving Orange County and
Southern California. We celebrate <a href="/durga-puja">Durga Puja</a>, Saraswati Puja, Poila Boishakh
(Bengali New Year), and host Bengali concerts, cultural programs, and charity events for families in
Costa Mesa, Irvine, Tustin, Rancho Santa Margarita, Mission Viejo, and across SoCal.</p>
<h2>Upcoming Bengali events in Orange County</h2>
<ul>${this.eventListItems(homeEvents)}</ul>
<p><a href="/events">See all events</a> · <a href="/durga-puja">Durga Puja in Orange County</a></p>`;
    return this.layout({
      title: 'Sanhoti — Bengali Association of Orange County, CA | Durga Puja & Cultural Events',
      description:
        'Sanhoti Bengali Association of Orange County, CA — Durga Puja, Poila Boishakh, Bengali festivals, concerts, and community events serving Orange County and Southern California.',
      path: '/',
      body,
      jsonLd: [
        this.orgJsonLd(),
        // A WebSite node with SearchAction, plus the same upcoming events the
        // page lists. The homepage previously carried the Organization alone,
        // so the events it displays were invisible as entities.
        {
          '@type': 'WebSite',
          '@id': `${ORIGIN}#website`,
          url: ORIGIN,
          name: ORG_NAME,
          publisher: { '@id': ORG_ID },
          inLanguage: 'en-US',
        },
        ...(homeEvents.length
          ? [
              {
                '@type': 'ItemList',
                '@id': `${ORIGIN}#upcoming-events`,
                name: 'Upcoming Sanhoti events in Orange County',
                numberOfItems: homeEvents.length,
                itemListElement: homeEvents.map((e, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  url: `${ORIGIN}${getEventDetailPath(e, e.event_id || e.id || '')}`,
                  name: e.event_name,
                })),
              },
            ]
          : []),
      ],
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
            banner = `<img src="${esc(url)}" alt="${esc(se.image_alt || `${se.sub_event_name} — Sanhoti Durga Puja, ${se.venue_city || 'Orange County'}, California`)}" loading="lazy">`;
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
${imageUrl ? `<img src="${esc(imageUrl)}" alt="Sanhoti Durga Puja ${year} celebration flyer — Bengali Durgotsav in Orange County, California">` : ''}
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
      const artistImg = imageUrl
        ? [imageUrl.startsWith('http') ? imageUrl : `${ORIGIN}${imageUrl}`]
        : [`${ORIGIN}/images/logo.png`];
      const node: Record<string, unknown> = {
        '@type': 'MusicEvent',
        name: a.performanceType?.trim()
          ? `${name} — ${a.performanceType.trim()}`
          : `${name} — Live at Sanhoti Durga Puja ${year}`,
        ...(start ? { startDate: start } : {}),
        ...(end || start ? { endDate: end || start } : {}),
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        organizer: { '@id': ORG_ID },
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
        description: a.bio?.trim()
          ? stripHtml(a.bio, 300)
          : `${name} performs live at Sanhoti Durga Puja ${year} in Orange County, California.`,
        image: artistImg,
        // Only emit an Offer when we have a real price; otherwise the ticket link
        // stays in the page body (a price-less Offer just triggers a schema warning).
        ...(ticketLinks.length > 0 && ticketPrice
          ? {
              offers: {
                '@type': 'Offer',
                url: ticketLinks[0].url,
                price: ticketPrice,
                priceCurrency: 'USD',
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
          // Ticketed with known price -> priced Offers. Ticketed but no price entered
          // -> omit Offers (the Yapsody link is in the page body; a price-less Offer
          // only trips a schema warning). No tickets -> free event.
          ...(ticketLinks.length > 0
            ? ticketPrice
              ? {
                  offers: ticketLinks.map(t => ({
                    '@type': 'Offer',
                    name: t.label,
                    url: t.url,
                    availability: 'https://schema.org/InStock',
                    price: ticketPrice,
                    priceCurrency: 'USD',
                    ...(c.startDate ? { validFrom: c.startDate } : {}),
                  })),
                }
              : {}
            : {
                isAccessibleForFree: true,
                offers: {
                  '@type': 'Offer',
                  url: `${ORIGIN}${pagePath}`,
                  price: '0',
                  priceCurrency: 'USD',
                  availability: 'https://schema.org/InStock',
                  ...(c.startDate ? { validFrom: c.startDate } : {}),
                },
              }),
          location: {
            '@type': 'Place',
            name: c.venueName,
            address: { '@type': 'PostalAddress', addressLocality: c.venueCity, addressRegion: 'CA', addressCountry: 'US' },
          },
          description: `Three-day Durga Puja celebration in Orange County, California: puja and pushpanjali, dhunuchi naach, sindoor khela, Bengali food, and evening cultural concerts.`,
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
   * Evergreen `/bollywood-concerts` hub.
   *
   * Leads on Bollywood in the URL and title — the higher-volume term — while the
   * h1 and body keep "Bengali concert" too, so one page serves both queries plus
   * artist-name searches. Renamed from `/bengali-concerts`, which nginx 301s here
   * so the old URL's ranking carries over instead of 404ing.
   *
   * Self-canonical, always valid — lists the opted-in concert sub-events and
   * links to each one's dedicated `/sub-events/:id` page. Even when there are no
   * upcoming concerts the page stays useful (evergreen intro + past line-ups).
   */
  private async bollywoodConcertsPage(): Promise<string> {
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
            banner = `<img src="${esc(url)}" alt="${esc(se.image_alt || `${se.sub_event_name}${se.performers ? ` featuring ${se.performers}` : ''} — Bengali concert in ${se.venue_city || 'Orange County'}, California`)}" loading="lazy">`;
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
<h1>Bollywood &amp; Bengali Concerts in Orange County &amp; Southern California — Sanhoti</h1>
<p>Sanhoti brings live Bengali music to Orange County — Bollywood and contemporary
Indian artists, Rabindra Sangeet, adhunik, and band nights, most often as part of our
Durga Puja Durgotsav in Costa Mesa (minutes from Irvine). Concerts are open to Bengali
and Indian families and music lovers from across Southern California.</p>
${upcomingHtml ? `<h2>Upcoming Bollywood and Bengali concerts</h2>\n<ul>${upcomingHtml}</ul>` : `<p>Our next concert line-up will be announced soon — check our <a href="/durga-puja">Durga Puja page</a> and <a href="/events">Events</a> for dates and tickets.</p>`}
${pastHtml ? `<h2>Recent concerts</h2>\n<ul>${pastHtml}</ul>` : ''}
<h2>About Sanhoti's concerts</h2>
<p>Each concert has its own page with the artist, date, venue, and tickets. Sanhoti is a
501(c)(3) Bengali cultural association based in Rancho Santa Margarita, hosting concerts
and cultural evenings across Orange County and SoCal.</p>
<p><a href="/durga-puja">Durga Puja in Orange County</a> · <a href="/festivals">Bengali festivals</a> ·
<a href="/events">All events</a> · <a href="/contact">Contact us</a></p>`;

    const listNodes = await Promise.all(
      concerts.map(async (se, i) => {
        const perfNames = (se.performers || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
        const type = se.seo_event_type === 'MusicEvent' ? 'MusicEvent' : 'Event';
        // Resolve a real image (fall back to logo) so every list item has one.
        let img = `${ORIGIN}/images/logo.png`;
        try {
          const paths = await this.subEventService.getSubEventImages(se.sub_event_id);
          if (paths.length > 0) {
            img = `${ORIGIN}/api/sub-events/${se.sub_event_id}/image/${encodeURIComponent(basename(paths[0]))}`;
          }
        } catch {
          /* image optional */
        }
        const price = firstNumericPrice(se.ticket_price);
        const desc =
          stripHtml(se.event_description, 300) ||
          `${se.sub_event_name}${perfNames.length ? ` featuring ${perfNames.join(', ')}` : ''} — a live Bengali concert by Sanhoti in ${se.venue_city || 'Orange County'}, CA.`;
        const node: Record<string, unknown> = {
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': type,
            name: se.sub_event_name,
            url: `${ORIGIN}/sub-events/${se.sub_event_id}`,
            ...(se.sub_event_start_dt ? { startDate: se.sub_event_start_dt } : {}),
            endDate: se.sub_event_end_dt || se.sub_event_start_dt || undefined,
            description: desc,
            image: [img],
            eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
            eventStatus: 'https://schema.org/EventScheduled',
            organizer: { '@id': ORG_ID },
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
            ...(se.ticket_url && price
              ? {
                  offers: {
                    '@type': 'Offer',
                    url: se.ticket_url,
                    availability: 'https://schema.org/InStock',
                    price,
                    priceCurrency: se.ticket_currency || 'USD',
                  },
                }
              : {}),
          },
        };
        return node;
      })
    );

    return this.layout({
      title: 'Bollywood & Bengali Concerts in Orange County, CA | Sanhoti',
      description:
        'Live Bollywood and Bengali concerts in Orange County, CA with Sanhoti — playback singers, Rabindra Sangeet and contemporary Indian artists near Irvine and Costa Mesa.',
      path: '/bollywood-concerts',
      body,
      jsonLd: [
        this.orgJsonLd(),
        ...(listNodes.length > 0
          ? [
              {
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: 'Bollywood and Bengali concerts by Sanhoti in Orange County',
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

    const concertsCard = `<li><h2><a href="/bollywood-concerts">Bengali concerts</a></h2><p>Live Bengali and Indian music nights with visiting artists — see the full concert line-up and tickets.</p></li>`;

    const body = `
<h1>Bengali Festivals in Orange County — Sanhoti</h1>
<p>Sanhoti (সংহতি) celebrates the full Bengali festival calendar in Orange County and
Southern California. From the grandeur of <a href="/durga-puja">Durga Puja ${durgaYear}</a>
to Saraswati Puja, Poila Boishakh (Bengali New Year), Kali Puja, and live
<a href="/bollywood-concerts">Bengali concerts</a>, our festivals are open to Bengali and
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

  /** Evergreen /corporate-partnerships page (admin-editable via settings). */
  private async corporatePartnershipsPage(): Promise<string> {
    let saved: CorporatePartnershipsContent | undefined;
    try {
      saved = (await this.settingsService.getSettings())?.corporatePartnerships;
    } catch {
      /* fall back to defaults */
    }
    const c = { ...DEFAULT_CORP, ...(saved || {}) };
    const arr = <T,>(v: T[] | undefined, fb: T[]) => (Array.isArray(v) && v.length ? v : fb);
    const whyPartner = arr(c.whyPartner, DEFAULT_CORP.whyPartner);
    const impact = arr(c.impact, DEFAULT_CORP.impact);
    const waysToGive = arr(c.waysToGive, DEFAULT_CORP.waysToGive);

    let leadershipHtml = '';
    try {
      const committeeMembers = await this.authService.getCommitteeMembers();
      if (committeeMembers.length > 0) {
        leadershipHtml =
          `<h2>${esc(c.leadershipTitle)}</h2>\n<ul>` +
          committeeMembers
            .map(m => {
              const name = [m.firstName, m.lastName].filter(Boolean).join(' ').trim();
              return `<li><strong>${esc(name || m.role)}</strong>${name ? ` — ${esc(m.role)}` : ''}</li>`;
            })
            .join('\n') +
          `</ul>\n<p><a href="/committee">Full committee page</a></p>`;
      }
    } catch {
      /* optional */
    }

    const body = `
<h1>${esc(c.heroTitle)} — Sanhoti Bengali Association of Orange County</h1>
<p>${esc(c.heroSubtitle)}</p>

<h2>${esc(c.whyPartnerTitle)}</h2>
<ul>${whyPartner.map(w => `<li><strong>${esc(w.title)}</strong> — ${esc(w.text)}</li>`).join('\n')}</ul>

<h2>${esc(c.impactTitle)}</h2>
<p>${esc(c.impactIntro)}</p>
<ul>${impact
      .map(i => `<li><strong>${esc(i.name)}</strong>${i.meta ? ` — ${esc(i.meta)}` : ''}${i.tag ? ` (${esc(i.tag)})` : ''}: ${esc(i.text)}</li>`)
      .join('\n')}</ul>

<h2>${esc(c.waysTitle)}</h2>
<ul>${waysToGive.map(w => `<li>${esc(w)}</li>`).join('\n')}</ul>
<p>${esc(c.csrNote)}</p>

${leadershipHtml}

<h2>${esc(c.ctaTitle)}</h2>
<p>${esc(c.ctaText)}</p>
<p>Contact: <a href="mailto:${esc(c.contactEmail)}">${esc(c.contactEmail)}</a> · ${esc(c.contactPhone)}</p>
<p><a href="/donate">Donate</a> · <a href="/contact">Contact us</a></p>`;

    return this.layout({
      title: `Corporate Partnerships & CSR | Sanhoti Bengali Association, Orange County, CA`,
      description:
        'Partner with Sanhoti, a 501(c)(3) Bengali cultural association serving Orange County and Southern California, through corporate sponsorship, matching gifts, and CSR giving.',
      path: '/corporate-partnerships',
      body,
      breadcrumb: [
        { name: 'Home', path: '/' },
        { name: 'Corporate Partnerships', path: '/corporate-partnerships' },
      ],
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: c.waysTitle,
          itemListElement: waysToGive.map((w, i) => ({ '@type': 'ListItem', position: i + 1, name: w })),
        },
      ],
    });
  }

  private async eventsPage(typeRaw?: string): Promise<string> {
    const type =
      typeRaw === 'Festival' ||
      typeRaw === 'Charity' ||
      typeRaw === 'Workshop' ||
      typeRaw === 'Other'
        ? typeRaw
        : undefined;
    let events: Event[] = [];
    try { events = await this.eventService.getActiveEvents(); } catch { /* render without events */ }
    if (type) events = events.filter(e => (e.event_type || 'Festival') === type);

    const heading =
      type === 'Festival'
        ? 'Bengali Festivals in Orange County'
        : type === 'Charity'
          ? 'Charity & Community Events in Orange County'
          : type === 'Workshop'
            ? 'Art & Cultural Workshops in Orange County'
            : type === 'Other'
              ? 'Community Events & Gatherings in Orange County'
              : 'Bengali Events in Orange County';
    const intro =
      type === 'Charity'
        ? 'Charity drives and community-service events from Sanhoti Bengali Association in Orange County, CA — coming together to give back across Southern California.'
        : type === 'Workshop'
          ? 'Hands-on workshops from Sanhoti Bengali Association in Orange County, CA — exploring Indian arts, painting, and cultural creativity with the community.'
          : type === 'Other'
            ? 'Picnics, socials, and community programs from Sanhoti Bengali Association in Orange County, CA.'
            : type === 'Festival'
              ? 'Bengali festivals with Sanhoti in Orange County, CA — Durga Puja, Saraswati Puja, Poila Boishakh, Kali Puja, and more.'
              : 'Upcoming and recent events from Sanhoti Bengali Association: Durga Puja, Saraswati Puja, Poila Boishakh, Bengali concerts, picnics, workshops, and charity programs in Orange County, CA.';
    const path = type ? `/events?type=${type}` : '/events';
    // Festival filter consolidates onto the dedicated /festivals hub; others self-canonical.
    const canonicalPath = type === 'Festival' ? '/festivals' : path;

    const body = `
<h1>${esc(heading)} — Sanhoti</h1>
<p>${esc(intro)}</p>
<ul>${this.eventListItems(events)}</ul>
<p><a href="/durga-puja">Durga Puja in Orange County</a> · <a href="/festivals">Bengali festivals</a> ·
<a href="/bollywood-concerts">Bengali concerts</a></p>`;

    // ItemList of full Event nodes (built from admin fields) so the list page carries
    // valid structured data, plus a breadcrumb.
    const listItems = await Promise.all(
      events.map(async (e, i) => {
        const id = e.event_id || e.id || '';
        let imageUrl: string | undefined;
        try {
          const filename = await this.eventService.getEventFlyerFilename(id);
          if (filename) imageUrl = `${ORIGIN}/api/events/${id}/image/${encodeURIComponent(filename)}`;
        } catch {
          /* image optional */
        }
        const { ['@context']: _omit, ...eventNode } = this.eventJsonLd(
          e,
          `${ORIGIN}${getEventDetailPath(e, id)}`,
          imageUrl
        );
        return {
          '@type': 'ListItem',
          position: i + 1,
          name: e.event_name || e.title || 'Event',
          item: eventNode,
        };
      })
    );

    const breadcrumb: { name: string; path: string }[] = [
      { name: 'Home', path: '/' },
      { name: 'Events', path: '/events' },
    ];
    if (type) breadcrumb.push({ name: heading.replace(' in Orange County', ''), path: canonicalPath });

    return this.layout({
      title: `${heading}, CA | Sanhoti Bengali Association`,
      description: intro,
      path: canonicalPath,
      body,
      breadcrumb,
      jsonLd: listItems.length
        ? [{ '@context': 'https://schema.org', '@type': 'ItemList', name: heading, itemListElement: listItems }]
        : [],
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
    const when = fmtDate(event.event_start_dt || event.date);
    const loc = (event.location || '').trim();
    const startIso = event.event_start_dt || event.date;
    const endIso = event.event_end_dt || startIso;
    const isPast = endIso ? new Date(endIso).getTime() < Date.now() : false;
    const tense = isPast ? 'was' : 'is';
    const typeWord =
      event.event_type === 'Charity'
        ? 'charity'
        : event.event_type === 'Workshop'
          ? 'workshop'
          : event.event_type === 'Festival'
            ? 'cultural'
            : 'community';
    const rawDesc = stripHtml(event.event_description || event.description, 300);

    // Fallback framing for thin descriptions only.
    //
    // Every event page used to render this paragraph regardless of how much the
    // admin had written, so 17 event pages shared four near-identical sentences —
    // duplicate boilerplate that dilutes each page rather than helping it. It now
    // appears only when the admin's own description is too short to carry the page
    // (see RICH_DESCRIPTION_CHARS), and disappears the moment real copy is written.
    const needsFraming = stripHtml(event.event_description || event.description, 5000).length < RICH_DESCRIPTION_CHARS;
    const framing =
      `${name} ${tense} a Bengali ${typeWord} event organized by Sanhoti Bengali Association of Orange County` +
      `${when ? `, held on ${when}` : ''}${loc ? ` at ${loc}` : ''} in Orange County, California. ` +
      `Sanhoti is a 501(c)(3) non-profit that celebrates Bengali culture across Orange County and Southern ` +
      `California through Durga Puja, Saraswati Puja, Poila Boishakh (Bengali New Year), Kali Puja, concerts, ` +
      `picnics, and community programs — open to Bengali and Indian families and everyone in the community.`;

    // Fuller meta description when the admin's text is short.
    const desc =
      rawDesc && rawDesc.length >= 60
        ? rawDesc
        : `${rawDesc ? `${rawDesc} — ` : ''}${name}${when ? `, ${when},` : ''} a Bengali ${typeWord} event by Sanhoti in Orange County, CA${loc ? ` at ${loc}` : ''}.`;

    // Flyer image → og:image + Event schema `image` (Google Event rich results want an image).
    let imageUrl: string | undefined;
    try {
      const filename = await this.eventService.getEventFlyerFilename(id);
      if (filename) imageUrl = `${ORIGIN}/api/events/${id}/image/${encodeURIComponent(filename)}`;
    } catch {
      /* image optional */
    }

    // Photo galleries tied to this event — real, unique content (esp. for past events).
    let galleriesHtml = '';
    try {
      const galleries = await this.galleryService.getPublicGalleries();
      const matched = galleries.filter(g => g.eventId && String(g.eventId) === String(id));
      if (matched.length > 0) {
        galleriesHtml =
          `<h2>Photos from ${esc(name)}</h2>\n<ul>` +
          matched
            .map(g => {
              const count = Array.isArray(g.photos) ? g.photos.length : 0;
              return `<li><a href="/galleries/${esc(g.id)}">${esc(g.title || 'Photo gallery')}</a>${
                count ? ` — ${count} photo${count === 1 ? '' : 's'}` : ''
              }</li>`;
            })
            .join('\n') +
          `</ul>`;
      }
    } catch {
      /* galleries optional */
    }

    const body = `
<h1>${esc(name)}</h1>
<p>${esc(when)}${loc ? ` — ${esc(loc)}` : ''}</p>
${imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(event.image_alt || `${name} — Sanhoti event in Orange County, California`)}">` : ''}
${rawDesc ? `<p>${esc(stripHtml(event.event_description || event.description, 2000))}</p>` : ''}
${needsFraming ? `<h2>About ${esc(name)}</h2>\n<p>${esc(framing)}</p>` : ''}
${galleriesHtml}
<h2>More Sanhoti events in Orange County</h2>
<p><a href="/events">All Sanhoti events</a> · <a href="/durga-puja">Durga Puja in Orange County</a> ·
<a href="/festivals">Bengali festivals</a> · <a href="/bollywood-concerts">Bengali concerts</a> ·
<a href="/galleries">Photo galleries</a> · <a href="/contact">Contact us</a></p>`;
    // Admin-authored overrides win over the generated title/description; the
    // admin knows which query this page should answer.
    const adminFaqs = (event.faqs ?? []).filter(f => f.question?.trim() && f.answer?.trim());
    return this.layout({
      title: event.meta_title?.trim() || `${name} | Sanhoti — Bengali Event in Orange County, CA`,
      description: event.meta_description?.trim() || desc,
      path,
      body: `${body}${menuHtml(event.menu)}${
        adminFaqs.length
          ? `\n<h2>Frequently asked questions</h2>\n<ul>${adminFaqs
              .map(f => `<li><h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p></li>`)
              .join('\n')}</ul>`
          : ''
      }`,
      ogType: 'article',
      ogImage: imageUrl,
      breadcrumb: [
        { name: 'Home', path: '/' },
        { name: 'Events', path: '/events' },
        { name, path },
      ],
      jsonLd: [
        this.eventJsonLd(event, pageUrl, imageUrl),
        ...(() => {
          const m = menuJsonLd(event.menu, { name, url: pageUrl });
          return m ? [m] : [];
        })(),
        ...(adminFaqs.length
          ? [this.faqNode(pageUrl, adminFaqs.map(f => ({ q: f.question, a: f.answer })))]
          : []),
      ],
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
${imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(se.image_alt || `${name}${performerNames.length ? ` featuring ${performerNames.join(', ')}` : ''} — Sanhoti${area ? `, ${area}` : ''}, California`)}">` : ''}
<p>${esc(stripHtml(se.event_description, 2000) || description)}</p>
${ticketHtml}
<p><a href="/durga-puja">Sanhoti Durga Puja in Orange County</a> · <a href="/events">All Sanhoti events</a> ·
<a href="/contact">Contact us</a></p>`;

    const sePrice = firstNumericPrice(se.ticket_price);
    const eventJsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': type,
      name,
      url: pageUrl,
      startDate: se.sub_event_start_dt || undefined,
      endDate: se.sub_event_end_dt || se.sub_event_start_dt || undefined,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      organizer: { '@id': ORG_ID },
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
      image: [imageUrl || `${ORIGIN}/images/logo.png`],
      ...(performerNames.length
        ? { performer: performerNames.map(n => ({ '@type': performerType, name: n })) }
        : {}),
      ...(se.ticket_url && sePrice
        ? {
            offers: {
              '@type': 'Offer',
              url: se.ticket_url,
              price: sePrice,
              priceCurrency: se.ticket_currency || 'USD',
              availability: 'https://schema.org/InStock',
              ...(se.sub_event_start_dt ? { validFrom: se.sub_event_start_dt } : {}),
            },
          }
        : se.ticket_url
          ? {} // ticket link shown in the page body; omit a price-less Offer node
          : { isAccessibleForFree: true }),
    };

    // Link the sub-event to real Artist records where the admin set them, so the
    // performer node carries sameAs profiles and points at the artist's own page
    // instead of being a bare name string.
    let linkedArtists: Artist[] = [];
    try {
      linkedArtists = await this.artistService.getArtistsByIds(se.artist_ids);
    } catch {
      /* fall back to the free-text performer names already in eventJsonLd */
    }
    if (linkedArtists.length > 0) {
      eventJsonLd.performer = linkedArtists.map(a => ({
        '@type': a.artist_type === 'MusicGroup' ? 'MusicGroup' : 'Person',
        '@id': `${ORIGIN}/artists/${a.slug}#artist`,
        name: a.name,
        url: `${ORIGIN}/artists/${a.slug}`,
        ...(a.image_path ? { image: `${ORIGIN}/api/artists/${a.artist_id}/image` } : {}),
        ...(() => {
          const sameAs = [a.wikipedia_url, ...(a.social_links ?? []).map(l => l.url)].filter(
            (u): u is string => !!u && /^https?:\/\//i.test(u)
          );
          return sameAs.length ? { sameAs } : {};
        })(),
      }));
    }

    const artistLinksHtml = linkedArtists.length
      ? `<h2>Performing artists</h2>\n<ul>${linkedArtists
          .map(a => `<li><a href="/artists/${esc(a.slug)}">${esc(a.name)}</a>${
            a.short_bio ? ` — ${esc(stripHtml(a.short_bio, 160))}` : ''
          }</li>`)
          .join('\n')}</ul>`
      : '';

    const seFaqs = (se.faqs ?? []).filter(f => f.question?.trim() && f.answer?.trim());
    const faqHtml = seFaqs.length
      ? `\n<h2>Frequently asked questions</h2>\n<ul>${seFaqs
          .map(f => `<li><h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p></li>`)
          .join('\n')}</ul>`
      : '';

    return this.layout({
      title:
        se.meta_title?.trim() ||
        `${name}${area ? ` in ${area}` : ''} | Sanhoti${city ? ` — ${city}, ${region}` : ''}`,
      description: se.meta_description?.trim() || description,
      path,
      body: `${body}${menuHtml(se.menu)}${artistLinksHtml}${faqHtml}`,
      ogType: 'article',
      ogImage: imageUrl,
      jsonLd: [
        this.orgJsonLd(),
        eventJsonLd,
        ...(() => {
          const m = menuJsonLd(se.menu, { name, url: pageUrl });
          return m ? [m] : [];
        })(),
        ...(seFaqs.length
          ? [this.faqNode(pageUrl, seFaqs.map(f => ({ q: f.question, a: f.answer })))]
          : []),
      ],
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

  // ---------------------------------------------------------------- artists

  /**
   * /artists — the index that gives Google a crawl path to every artist page.
   * Emitted as an ItemList of Person/MusicGroup so the set is machine-readable.
   */
  private async artistsIndexPage(): Promise<string> {
    let artists: Artist[] = [];
    try {
      artists = await this.artistService.getActiveArtists();
    } catch {
      /* render the evergreen shell without the list */
    }

    const cards = artists
      .map(a => {
        const img = a.image_path
          ? `<img src="${esc(`${ORIGIN}/api/artists/${a.artist_id}/image`)}" alt="${esc(
              a.image_alt || `${a.name} — artist with Sanhoti in Orange County, CA`
            )}" width="320" height="320" loading="lazy">`
          : '';
        const meta = [a.roles, a.genres, a.origin].map(s => (s || '').trim()).filter(Boolean).join(' · ');
        return `<li>${img}
<h3><a href="/artists/${esc(a.slug)}">${esc(a.name)}</a></h3>
${meta ? `<p>${esc(meta)}</p>` : ''}
${a.short_bio ? `<p>${esc(stripHtml(a.short_bio, 220))}</p>` : ''}</li>`;
      })
      .join('\n');

    const body = `
<h1>Artists &amp; Performers at Sanhoti — Orange County, California</h1>
<p>Sanhoti brings singers, musicians, and performers from India and the Bengali diaspora
to Orange County and Southern California — Bollywood and playback singers, Rabindra
Sangeet and adhunik artists, classical musicians, and live bands. Our line-up includes
past headliners and artists scheduled for upcoming Durga Puja Durgotsav and cultural
evenings in Costa Mesa, minutes from Irvine.</p>
${
  cards
    ? `<h2>Featured artists</h2>\n<ul>${cards}</ul>`
    : `<p>Our artist line-up for the coming season will be announced soon. See
<a href="/bollywood-concerts">Bengali concerts</a> and <a href="/durga-puja">Durga Puja</a> for the latest.</p>`
}
<h2>Booking and press</h2>
<p>Each artist has a dedicated page listing upcoming and past Sanhoti performances, dates, and venues.
For press, artist management, or performance enquiries, <a href="/contact">contact Sanhoti</a>.</p>
<p><a href="/bollywood-concerts">Bengali concerts in Orange County</a> ·
<a href="/durga-puja">Durga Puja</a> · <a href="/events">All events</a></p>`;

    const itemList = {
      '@type': 'ItemList',
      '@id': `${ORIGIN}/artists#list`,
      name: 'Artists & performers at Sanhoti events in Orange County, California',
      numberOfItems: artists.length,
      itemListElement: artists.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${ORIGIN}/artists/${a.slug}`,
        item: {
          '@type': a.artist_type === 'MusicGroup' ? 'MusicGroup' : 'Person',
          '@id': `${ORIGIN}/artists/${a.slug}#artist`,
          name: a.name,
          url: `${ORIGIN}/artists/${a.slug}`,
        },
      })),
    };

    return this.layout({
      title: 'Artists & Performers | Sanhoti Bengali Association of Orange County, CA',
      description:
        'Singers, musicians, and performers featured at Sanhoti events in Orange County, California — past and upcoming Bollywood, Rabindra Sangeet, and live Bengali concerts across Southern California.',
      path: '/artists',
      body,
      jsonLd: [itemList],
      breadcrumb: [
        { name: 'Home', path: '/' },
        { name: 'Artists', path: '/artists' },
      ],
    });
  }

  /**
   * /artists/<slug> — the page that makes an artist-name search able to reach
   * Sanhoti. Carries a full Person/MusicGroup node (alternate spellings,
   * sameAs profiles, image), the artist's Sanhoti performances as Event nodes
   * that reference the artist by @id, and VideoObject nodes for any clips.
   */
  private async artistPage(slug: string): Promise<string | null> {
    let artist: Artist | null = null;
    try {
      artist = await this.artistService.getArtistBySlug(slug);
    } catch {
      return null;
    }
    if (!artist || artist.is_active === false) return null;

    const path = `/artists/${artist.slug}`;
    const canonical = `${ORIGIN}${path}`;
    const artistId = `${canonical}#artist`;
    const schemaType = artist.artist_type === 'MusicGroup' ? 'MusicGroup' : 'Person';
    const imageUrl = artist.image_path ? `${ORIGIN}/api/artists/${artist.artist_id}/image` : undefined;

    const alternates = String(artist.alternate_names ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const genres = String(artist.genres ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const roles = String(artist.roles ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const sameAs = [
      artist.wikipedia_url,
      ...(artist.social_links ?? []).map(l => l.url),
    ].filter((u): u is string => !!u && /^https?:\/\//i.test(u));

    let appearances: { upcoming: ArtistAppearanceEntry[]; past: ArtistAppearanceEntry[] } = {
      upcoming: [],
      past: [],
    };
    try {
      appearances = await this.artistService.getAppearances(artist);
    } catch {
      /* the artist page is still worth serving without the appearance list */
    }

    const describe = (entry: ArtistAppearanceEntry) => {
      if (entry.kind === 'sub-event') {
        const se = entry.event as SubEvent;
        const where = [se.venue_name, se.venue_city && `${se.venue_city}, ${se.venue_region || 'CA'}`]
          .filter(Boolean)
          .join(', ');
        return {
          name: se.sub_event_name,
          url: `${ORIGIN}/sub-events/${se.sub_event_id}`,
          href: `/sub-events/${se.sub_event_id}`,
          start: se.sub_event_start_dt,
          end: se.sub_event_end_dt,
          where: where || se.location || '',
          venueName: se.venue_name,
          city: se.venue_city,
          region: se.venue_region,
          type: se.seo_event_type === 'MusicEvent' ? 'MusicEvent' : 'Event',
        };
      }
      const e = entry.event as Event;
      const where = [e.venue_name, e.venue_city && `${e.venue_city}, ${e.venue_region || 'CA'}`]
        .filter(Boolean)
        .join(', ');
      return {
        name: e.event_name,
        url: `${ORIGIN}${getEventDetailPath(e, e.event_id)}`,
        href: getEventDetailPath(e, e.event_id),
        start: e.event_start_dt,
        end: e.event_end_dt,
        where: where || e.location || '',
        venueName: e.venue_name,
        city: e.venue_city,
        region: e.venue_region,
        type: 'Event',
      };
    };

    const listHtml = (entries: ArtistAppearanceEntry[]) =>
      entries
        .map(entry => {
          const d = describe(entry);
          return `<li><h3><a href="${esc(d.href)}">${esc(d.name)}</a></h3>
<p>${esc(fmtDate(d.start))}${d.where ? ` — ${esc(d.where)}` : ''}</p></li>`;
        })
        .join('\n');

    const upcomingHtml = listHtml(appearances.upcoming);
    const pastHtml = listHtml(appearances.past);

    const videos = (artist.video_urls ?? []).filter(u => /^https?:\/\//i.test(u));
    const videosHtml = videos.length
      ? `<h2>Watch ${esc(artist.name)}</h2>\n<ul>${videos
          .map(u => `<li><a href="${esc(u)}" rel="noopener noreferrer">${esc(u)}</a></li>`)
          .join('\n')}</ul>`
      : '';

    const profilesHtml = sameAs.length
      ? `<h2>Official profiles</h2>\n<ul>${[
          ...(artist.wikipedia_url ? [{ label: 'Wikipedia', url: artist.wikipedia_url }] : []),
          ...(artist.social_links ?? []),
        ]
          .filter(l => /^https?:\/\//i.test(l.url))
          .map(l => `<li><a href="${esc(l.url)}" rel="noopener noreferrer nofollow">${esc(l.label)}</a></li>`)
          .join('\n')}</ul>`
      : '';

    const factsHtml = [
      roles.length ? `<li>Role: ${esc(roles.join(', '))}</li>` : '',
      genres.length ? `<li>Genres: ${esc(genres.join(', '))}</li>` : '',
      artist.origin ? `<li>From: ${esc(artist.origin)}</li>` : '',
      alternates.length ? `<li>Also spelled: ${esc(alternates.join(', '))}</li>` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const introFallback =
      appearances.upcoming.length && !appearances.past.length
        ? `${artist.name} is scheduled to perform for Sanhoti Bengali Association of Orange County, California${
            artist.origin ? `. ${artist.name} is from ${artist.origin}` : ''
          }.`
        : appearances.past.length
          ? `${artist.name} has performed for Sanhoti Bengali Association of Orange County, California${
              artist.origin ? `. ${artist.name} is from ${artist.origin}` : ''
            }.`
          : `${artist.name} is featured on Sanhoti Bengali Association's artist roster in Orange County, California${
              artist.origin ? `. ${artist.name} is from ${artist.origin}` : ''
            }.`;

    const body = `
<h1>${esc(artist.name)} — Live with Sanhoti in Orange County, California</h1>
${
  imageUrl
    ? `<img src="${esc(imageUrl)}" alt="${esc(
        artist.image_alt || `${artist.name} performing at a Sanhoti event in Orange County, CA`
      )}" width="640" height="640">`
    : ''
}
<p>${esc(stripHtml(artist.short_bio || artist.bio, 400) || introFallback)}</p>
${factsHtml ? `<h2>About ${esc(artist.name)}</h2>\n<ul>${factsHtml}</ul>` : ''}
${artist.bio && artist.bio !== artist.short_bio ? `<p>${esc(stripHtml(artist.bio, 1500))}</p>` : ''}
${
  upcomingHtml
    ? `<h2>Upcoming ${esc(artist.name)} performances with Sanhoti</h2>\n<ul>${upcomingHtml}</ul>`
    : `<p>No upcoming ${esc(artist.name)} dates are announced right now. See
<a href="/bollywood-concerts">upcoming Bengali concerts in Orange County</a> for the current line-up.</p>`
}
${pastHtml ? `<h2>Past performances with Sanhoti</h2>\n<ul>${pastHtml}</ul>` : ''}
${videosHtml}
${profilesHtml}
<h2>About Sanhoti</h2>
<p>Sanhoti is a 501(c)(3) non-profit Bengali cultural association serving Orange County and
Southern California. We present Bengali and Indian artists at Durga Puja, Saraswati Puja,
Poila Boishakh, and standalone concerts in Costa Mesa, Irvine, and across SoCal.</p>
<p><a href="/artists">All artists</a> · <a href="/bollywood-concerts">Bengali concerts</a> ·
<a href="/durga-puja">Durga Puja in Orange County</a> · <a href="/contact">Contact us</a></p>`;

    const artistNode: Record<string, unknown> = {
      '@type': schemaType,
      '@id': artistId,
      name: artist.name,
      ...(alternates.length ? { alternateName: alternates } : {}),
      ...(artist.website_url ? { url: artist.website_url } : { url: canonical }),
      mainEntityOfPage: canonical,
      description:
        stripHtml(artist.short_bio || artist.bio, 400) || introFallback,
      ...(imageUrl ? { image: imageUrl } : {}),
      ...(genres.length ? { genre: genres } : {}),
      ...(sameAs.length ? { sameAs } : {}),
      ...(schemaType === 'Person'
        ? {
            ...(roles.length ? { jobTitle: roles.join(', ') } : {}),
            ...(artist.origin ? { homeLocation: { '@type': 'Place', name: artist.origin } } : {}),
          }
        : {
            ...(artist.origin ? { foundingLocation: { '@type': 'Place', name: artist.origin } } : {}),
          }),
      performerIn: [...appearances.upcoming, ...appearances.past].slice(0, 25).map(entry => {
        const d = describe(entry);
        return { '@type': d.type, name: d.name, url: d.url, ...(d.start ? { startDate: d.start } : {}) };
      }),
    };

    // Each appearance is also a standalone Event node whose performer points at
    // the artist node by @id, so the two entities are explicitly linked.
    const eventNodes = [...appearances.upcoming, ...appearances.past].slice(0, 25).map(entry => {
      const d = describe(entry);
      return {
        '@type': d.type,
        name: d.name,
        url: d.url,
        ...(d.start ? { startDate: d.start } : {}),
        ...(d.end || d.start ? { endDate: d.end || d.start } : {}),
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        organizer: { '@id': ORG_ID },
        performer: { '@id': artistId },
        location: {
          '@type': 'Place',
          name: d.venueName || d.where || 'Orange County, California',
          address: {
            '@type': 'PostalAddress',
            ...(d.city ? { addressLocality: d.city } : {}),
            addressRegion: d.region || 'CA',
            addressCountry: 'US',
          },
        },
      };
    });

    const videoNodes = videos.map(url => ({
      '@type': 'VideoObject',
      name: `${artist.name} — performance video`,
      description: `Performance video featuring ${artist.name}, presented by ${ORG_NAME}.`,
      contentUrl: url,
      embedUrl: url,
      ...(imageUrl ? { thumbnailUrl: imageUrl } : {}),
      uploadDate: artist.created_at,
    }));

    const title =
      artist.meta_title?.trim() ||
      `${artist.name} Live in Orange County, CA | Sanhoti Bengali Association`;
    const description =
      artist.meta_description?.trim() ||
      stripHtml(artist.short_bio, 165) ||
      `${artist.name} performing with Sanhoti Bengali Association in Orange County, California. Concert dates, venue, tickets, and past performances.`;

    return this.layout({
      title,
      description,
      path,
      body,
      ogType: 'profile',
      ...(imageUrl ? { ogImage: imageUrl } : {}),
      jsonLd: [artistNode, ...eventNodes, ...videoNodes],
      breadcrumb: [
        { name: 'Home', path: '/' },
        { name: 'Artists', path: '/artists' },
        { name: artist.name, path },
      ],
    });
  }

  // ------------------------------------------------------------------- blogs

  private async blogsIndexPage(): Promise<string> {
    let posts: PublicBlog[] = [];
    try {
      posts = await this.blogService.getPublicBlogs();
    } catch {
      /* render shell without list */
    }

    const cards = posts
      .map(p => {
        const img = p.cover_image_url
          ? `<img src="${esc(`${ORIGIN}${p.cover_image_url}`)}" alt="${esc(p.cover_image_alt)}" width="640" height="400" loading="lazy">`
          : '';
        return `<li>${img}
<h3><a href="${esc(p.path)}">${esc(p.title)}</a></h3>
<p>${esc(p.excerpt)}</p>
<p><time datetime="${esc(p.published_at)}">${esc(new Date(p.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' }))}</time>
 · ${p.reading_minutes} min read</p></li>`;
      })
      .join('\n');

    const body = `
<h1>Sanhoti Blog — Stories from Our Bengali Community in Orange County</h1>
<p>Event recaps, cultural reflections, charity highlights, and news from Sanhoti Bengali
Association of Orange County across Southern California.</p>
${cards ? `<h2>Recent posts</h2>\n<ul>${cards}</ul>` : '<p>New articles will be published here soon.</p>'}
<p><a href="/galleries">Photo galleries</a> · <a href="/magazines">Magazines</a> ·
<a href="/events">Events</a></p>`;

    const itemList = {
      '@type': 'ItemList',
      '@id': `${ORIGIN}/blogs#list`,
      name: 'Sanhoti community blog',
      numberOfItems: posts.length,
      itemListElement: posts.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${ORIGIN}${p.path}`,
        item: {
          '@type': 'BlogPosting',
          headline: p.title,
          url: `${ORIGIN}${p.path}`,
          datePublished: p.published_at,
        },
      })),
    };

    return this.layout({
      title: 'Blog | Sanhoti Bengali Association of Orange County, CA',
      description:
        'Stories, event recaps, and cultural articles from Sanhoti — the Bengali community association serving Orange County and Southern California.',
      path: '/blogs',
      body,
      jsonLd: posts.length ? [itemList] : undefined,
      breadcrumb: [
        { name: 'Home', path: '/' },
        { name: 'Blog', path: '/blogs' },
      ],
    });
  }

  private async blogPage(slug: string): Promise<string | null> {
    let blog: PublicBlog | null = null;
    try {
      blog = await this.blogService.getPublicBlogBySlug(slug);
    } catch {
      return null;
    }
    if (!blog) return null;

    const path = blog.path;
    const canonical = `${ORIGIN}${path}`;
    const imageUrl = blog.cover_image_url ? `${ORIGIN}${blog.cover_image_url}` : undefined;
    const authorLine = blog.author_name
      ? `<p>By ${esc(blog.author_name)}${blog.author_contact ? ` · ${esc(blog.author_contact)}` : ''}</p>`
      : '';

    const body = `
${imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(blog.cover_image_alt)}" width="960" height="540">` : ''}
<h1>${esc(blog.title)}</h1>
<p><time datetime="${esc(blog.published_at)}">${esc(new Date(blog.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' }))}</time>
 · ${blog.reading_minutes} min read</p>
${authorLine}
${blog.body_html ?? ''}
<p><a href="/blogs">All blog posts</a> · <a href="/events">Events</a> · <a href="/contact">Contact Sanhoti</a></p>`;

    const blogNode: Record<string, unknown> = {
      '@type': 'BlogPosting',
      headline: blog.title,
      description: blog.meta_description || blog.excerpt,
      datePublished: blog.published_at,
      dateModified: blog.updated_at,
      url: canonical,
      mainEntityOfPage: canonical,
      ...(imageUrl ? { image: imageUrl } : {}),
      author: blog.author_name
        ? { '@type': 'Person', name: blog.author_name }
        : { '@type': 'Organization', name: ORG_NAME },
      publisher: {
        '@type': 'Organization',
        name: ORG_NAME,
        logo: { '@type': 'ImageObject', url: `${ORIGIN}/images/logo.png` },
      },
    };

    return this.layout({
      title: blog.meta_title || `${blog.title} | Sanhoti Blog — Orange County Bengali Community`,
      description: blog.meta_description || blog.excerpt,
      path,
      body,
      ...(imageUrl ? { ogImage: imageUrl } : {}),
      jsonLd: [blogNode],
      breadcrumb: [
        { name: 'Home', path: '/' },
        { name: 'Blog', path: '/blogs' },
        { name: blog.title, path },
      ],
    });
  }

  // ------------------------------------------------- charity / food / festival

  /** /charity — targets "charitable organization in Orange County". */
  private async charityPage(): Promise<string> {
    let corp: CorporatePartnershipsContent | undefined;
    try {
      corp = (await this.settingsService.getSettings())?.corporatePartnerships;
    } catch {
      /* fall back to the built-in copy */
    }
    const impact = (corp?.impact?.length ? corp.impact : DEFAULT_CORP.impact) ?? [];

    const impactHtml = impact
      .map(
        i => `<li><h3>${esc(i.name)}</h3>
${i.meta ? `<p>${esc(i.meta)}</p>` : ''}
<p>${esc(i.text)}</p></li>`
      )
      .join('\n');

    const body = `
<h1>Sanhoti — A Charitable Non-Profit Organization in Orange County, California</h1>
<p>Sanhoti is a registered 501(c)(3) charitable organization (EIN 39-2903777) based in
Rancho Santa Margarita, Orange County, California. Alongside our Bengali cultural
programming, we raise funds and volunteer for causes that serve Orange County families —
hunger relief, domestic violence support, and community welfare — and every donation is
tax-deductible.</p>

<h2>Our charitable work in Orange County</h2>
${impactHtml ? `<ul>${impactHtml}</ul>` : ''}

<h2>How your donation is used</h2>
<p>Contributions to Sanhoti fund charity drives and partner non-profits in Orange County,
free and low-cost community cultural programming, youth and language education for
Bengali-American children, and scholarships and relief efforts. Sanhoti is volunteer-run,
so administrative overhead stays low.</p>

<h2>Ways to support</h2>
<ul>
<li><a href="/donate">Make a tax-deductible donation</a> — one-time or recurring.</li>
<li><a href="/become-our-sponsor">Sponsor an event</a> and reach Bengali and Indian families across Southern California.</li>
<li><a href="/corporate-partnerships">Corporate partnership or CSR programs</a>, including employer matching gifts.</li>
<li>Volunteer at a Sanhoti event or charity drive — <a href="/contact">get in touch</a>.</li>
</ul>

<h2>Charity registration details</h2>
<p>Legal name: ${esc(LEGAL_NAME)}. Status: 501(c)(3) non-profit. EIN: 39-2903777.
Address: ${esc(ORG_ADDRESS)}. Contact: ${esc(ORG_EMAIL)} · ${esc(ORG_PHONE)}.
We are happy to provide our tax-exemption letter for corporate CSR review.</p>
<p><a href="/about">About Sanhoti</a> · <a href="/donate">Donate</a> ·
<a href="/events">Our events</a> · <a href="/contact">Contact us</a></p>`;

    const faqs = [
      {
        q: 'Is Sanhoti a registered charitable organization in Orange County?',
        a: 'Yes. Sanhoti Bengali Association of Orange County is a registered 501(c)(3) non-profit charitable organization, EIN 39-2903777, based in Rancho Santa Margarita, California. Donations are tax-deductible to the extent allowed by law.',
      },
      {
        q: 'What causes does Sanhoti support?',
        a: 'Sanhoti supports hunger relief through Second Harvest Food Bank of Orange County, domestic violence survivor services through Laura’s House, and community welfare and cultural education programs for families across Orange County and Southern California.',
      },
      {
        q: 'Are donations to Sanhoti tax-deductible?',
        a: 'Yes. Sanhoti is a 501(c)(3) non-profit (EIN 39-2903777), so donations are tax-deductible to the extent allowed by law. Many employers also match employee donations — check with your HR or CSR team.',
      },
      {
        q: 'How can my company partner with Sanhoti on charitable work?',
        a: 'Companies can co-sponsor charity drives and volunteer days, run matching gift programs, or become an event sponsor. See our corporate partnerships page or contact us at info@sanhoti.org for our EIN and tax-exemption letter.',
      },
    ];

    return this.layout({
      title: 'Charity & Community Service | Sanhoti — 501(c)(3) Non-Profit in Orange County, CA',
      description:
        'Sanhoti is a 501(c)(3) charitable organization in Orange County, CA (EIN 39-2903777) supporting hunger relief, domestic violence services, and community programs. Donations are tax-deductible.',
      path: '/charity',
      body,
      jsonLd: [this.faqNode(`${ORIGIN}/charity`, faqs)],
      breadcrumb: [
        { name: 'Home', path: '/' },
        { name: 'Charity', path: '/charity' },
      ],
    });
  }

  /** /bengali-food — food is a genuine differentiator and its own search demand. */
  private async bengaliFoodPage(): Promise<string> {
    // Every public menu comes from MenuService — the same source the React page
    // reads through /api/menus/public. Aggregating separately here is what made
    // the two surfaces disagree before.
    let menus: Awaited<ReturnType<MenuService['getPublicMenus']>> = [];
    let totalMenus = 0;
    try {
      // Same cap the React page uses, so the two stay identical as events pile up.
      menus = await this.menuService.getPublicMenus(MenuService.FOOD_PAGE_LIMIT);
      totalMenus = await this.menuService.countPublicMenus();
    } catch {
      /* the evergreen page below stands on its own */
    }

    const liveMenuHtml = menus
      .map(m => {
        const heading =
          m.source === 'durga-puja'
            ? `This year's menu — ${esc(m.title)}`
            : `${esc(m.title)} — menu`;
        return `<div>${menuHtml(m.menu, heading)}
<p><a href="${esc(m.href)}">See ${esc(m.title)}</a></p></div>`;
      })
      .join('\n') +
      (totalMenus > menus.length
        ? `\n<p>Menus from ${totalMenus - menus.length} more past event${
            totalMenus - menus.length === 1 ? '' : 's'
          } are on their own pages — <a href="/events">browse all Sanhoti events</a>.</p>`
        : '');

    const menuNodes = menus
      .map(m => menuJsonLd(m.menu, { name: m.title, url: `${ORIGIN}${m.href}` }))
      .filter((n): n is Record<string, unknown> => !!n);

    const body = `
<h1>Bengali Food in Orange County — Authentic Home-Style Cooking at Sanhoti Events</h1>
<p>Food is at the heart of every Bengali celebration, and Sanhoti serves authentic,
home-style Bengali cooking at our events across Orange County, California. From Durga Puja
bhog to Poila Boishakh feasts, our meals are prepared for the community by the community —
a rare chance to eat real Bengali food in Southern California.</p>
${liveMenuHtml ? `\n<h2>Menus from our events</h2>${liveMenuHtml}` : ''}
<h2>What we serve year-round</h2>
<ul>
<li><strong>Bhog</strong> — the traditional vegetarian offering served after puja: khichuri,
labra, beguni, chatni, and payesh.</li>
<li><strong>Fish and meat dishes</strong> — Bengali classics such as maacher jhol, kosha
mangsho, and fish fry on non-bhog days.</li>
<li><strong>Street-food favourites</strong> — egg roll, ghugni, phuchka, and chops.</li>
<li><strong>Sweets</strong> — rosogolla, mishti doi, sandesh, and payesh.</li>
<li><strong>Vegetarian and kid-friendly options</strong> at every meal service.</li>
</ul>

<h2>Bhog at Durga Puja</h2>
<p>During our three-day Durgotsav in Costa Mesa, bhog is served after the morning puja and
pushpanjali on each day of the celebration. Bhog is included with most Durga Puja passes —
see the <a href="/durga-puja">Durga Puja page</a> for this year's schedule, menu, and
ticket options.</p>

<h2>Dietary information</h2>
<p>Bhog is fully vegetarian and prepared without onion or garlic in keeping with tradition.
Non-vegetarian dishes are served separately and clearly labelled. If you have an allergy or
a specific dietary requirement, please <a href="/contact">contact us</a> ahead of the event
and we will do our best to accommodate you.</p>

<h2>Where to find us</h2>
<p>Sanhoti food service happens at our events in Orange County — most often in Costa Mesa,
minutes from Irvine, Tustin, Santa Ana, and Newport Beach. We are not a restaurant; meals
are served at our festivals and cultural programs, which are open to everyone.</p>
<p><a href="/durga-puja">Durga Puja in Orange County</a> · <a href="/festivals">Bengali festivals</a> ·
<a href="/events">Upcoming events</a> · <a href="/contact">Contact us</a></p>`;

    const faqs = [
      {
        q: 'Where can I find Bengali food in Orange County?',
        a: 'Sanhoti serves authentic home-style Bengali food at its cultural events across Orange County, California — including bhog at Durga Puja in Costa Mesa, and full Bengali menus at Poila Boishakh and Saraswati Puja. Events are open to everyone.',
      },
      {
        q: 'What is bhog?',
        a: 'Bhog is the traditional vegetarian meal offered to the deity during puja and then served to attendees. A Bengali bhog typically includes khichuri, labra, beguni, chatni, and payesh, cooked without onion or garlic.',
      },
      {
        q: 'Is the food at Sanhoti events vegetarian?',
        a: 'Bhog is fully vegetarian and prepared without onion or garlic. Non-vegetarian Bengali dishes such as fish curry and kosha mangsho are served separately at some events and are clearly labelled.',
      },
      {
        q: 'Is food included with a Durga Puja ticket?',
        a: 'Bhog is included with most Sanhoti Durga Puja passes. Check the Durga Puja page for the current year’s ticket tiers and exactly which meals each pass includes.',
      },
    ];

    return this.layout({
      title: 'Bengali Food in Orange County, CA | Bhog & Festival Meals — Sanhoti',
      description:
        'Authentic Bengali food in Orange County, California — Durga Puja bhog (khichuri, labra, payesh), fish and meat classics, street food, and sweets served at Sanhoti cultural events.',
      path: '/bengali-food',
      body,
      jsonLd: [this.faqNode(`${ORIGIN}/bengali-food`, faqs), ...menuNodes],
      breadcrumb: [
        { name: 'Home', path: '/' },
        { name: 'Bengali Food', path: '/bengali-food' },
      ],
    });
  }

  /**
   * Dedicated festival landing pages (/saraswati-puja, /poila-boishakh,
   * /kali-puja). Previously these shared the single /festivals page, so the
   * site had no URL that could rank for an individual festival plus a location.
   * Each page links to the matching live event when one exists.
   */
  private async festivalLandingPage(path: string): Promise<string> {
    const cfg = FESTIVAL_LANDING[path];
    let events: Event[] = [];
    try {
      events = await this.eventService.getActiveEvents();
    } catch {
      /* the evergreen page stands on its own */
    }

    const matches = events
      .filter(e => cfg.match.test(`${e.event_name ?? ''} ${e.event_description ?? ''}`))
      .sort(
        (a, b) => new Date(a.event_start_dt || 0).getTime() - new Date(b.event_start_dt || 0).getTime()
      );
    const now = Date.now();
    const upcoming = matches.filter(e => new Date(e.event_start_dt || 0).getTime() >= now);
    const past = matches.filter(e => new Date(e.event_start_dt || 0).getTime() < now);

    const renderList = (list: Event[]) =>
      list
        .map(e => {
          const where = [e.venue_name, e.venue_city && `${e.venue_city}, ${e.venue_region || 'CA'}`]
            .filter(Boolean)
            .join(', ');
          return `<li><h3><a href="${esc(getEventDetailPath(e, e.event_id))}">${esc(e.event_name)}</a></h3>
<p>${esc(fmtDate(e.event_start_dt))}${where ? ` — ${esc(where)}` : e.location ? ` — ${esc(e.location)}` : ''}</p>
${e.event_description ? `<p>${esc(stripHtml(e.event_description, 240))}</p>` : ''}</li>`;
        })
        .join('\n');

    const upcomingHtml = renderList(upcoming);
    const pastHtml = renderList(past);

    const body = `
<h1>${esc(cfg.h1)}</h1>
${cfg.intro}
${
  upcomingHtml
    ? `<h2>Upcoming ${esc(cfg.shortName)} celebrations</h2>\n<ul>${upcomingHtml}</ul>`
    : `<p>Dates for our next ${esc(cfg.shortName)} celebration will be announced soon. See
<a href="/events">all upcoming Sanhoti events</a> or <a href="/contact">contact us</a> to be notified.</p>`
}
${pastHtml ? `<h2>Past ${esc(cfg.shortName)} celebrations</h2>\n<ul>${pastHtml}</ul>` : ''}
${cfg.extra}
<h2>Who can attend</h2>
<p>Everyone is welcome. Sanhoti's ${esc(cfg.shortName)} celebration is open to Bengali,
Indian, and non-Indian families from across Orange County and Southern California —
Rancho Santa Margarita, Irvine, Tustin, Costa Mesa, Mission Viejo, Lake Forest,
Aliso Viejo, and beyond.</p>
<p><a href="/festivals">All Bengali festivals</a> · <a href="/durga-puja">Durga Puja in Orange County</a> ·
<a href="/bengali-food">Bengali food</a> · <a href="/events">Upcoming events</a> ·
<a href="/contact">Contact us</a></p>`;

    return this.layout({
      title: cfg.title,
      description: cfg.description,
      path,
      body,
      jsonLd: [this.faqNode(`${ORIGIN}${path}`, cfg.faqs)],
      breadcrumb: [
        { name: 'Home', path: '/' },
        { name: 'Festivals', path: '/festivals' },
        { name: cfg.shortName, path },
      ],
    });
  }

  // -------------------------------------------------- data-backed list pages
  //
  // These previously rendered two hard-coded paragraphs to crawlers while real
  // users saw the full list, so Googlebot indexed strictly less content than
  // the site actually has. Each now renders the real records.

  /** /galleries — every public gallery, as a crawlable ItemList with images. */
  private async galleriesIndexPage(): Promise<string> {
    let galleries: Awaited<ReturnType<GalleryService['getPublicGalleries']>> = [];
    try {
      galleries = await this.galleryService.getPublicGalleries();
    } catch {
      /* evergreen copy still renders */
    }

    const items = galleries
      .map(g => {
        const first = g.photos?.[0];
        const img =
          first && g.eventId
            ? `<img src="${esc(
                `${ORIGIN}/api/galleries/${g.eventId}/photos/${encodeURIComponent(
                  basename((first as { filename?: string; url?: string }).filename || (first as { url?: string }).url || '')
                )}`
              )}" alt="${esc(
                `${g.title} — Sanhoti Bengali Association event photos, Orange County, CA`
              )}" width="480" height="320" loading="lazy">`
            : '';
        return `<li>${img}
<h3><a href="/galleries/${esc(g.id)}">${esc(g.title)}</a></h3>
${g.description ? `<p>${esc(stripHtml(g.description, 200))}</p>` : ''}
<p>${g.photos?.length ?? 0} photo${(g.photos?.length ?? 0) === 1 ? '' : 's'}${
          g.event_start_dt ? ` · ${esc(fmtDate(g.event_start_dt))}` : ''
        }</p></li>`;
      })
      .join('\n');

    const body = `
<h1>Sanhoti Photo Galleries — Bengali Events in Orange County, California</h1>
<p>Photos from Sanhoti celebrations across Orange County and Southern California — Durga Puja
Durgotsav, Saraswati Puja, Poila Boishakh, Bengali concerts, picnics, and community
gatherings. Browse each gallery for images from the day.</p>
${items ? `<h2>All galleries</h2>\n<ul>${items}</ul>` : `<p>Galleries from our most recent events are being uploaded — check back soon.</p>`}
<p><a href="/durga-puja">Durga Puja in Orange County</a> · <a href="/festivals">Bengali festivals</a> ·
<a href="/events">All events</a></p>`;

    const itemList = {
      '@type': 'ItemList',
      '@id': `${ORIGIN}/galleries#list`,
      name: 'Sanhoti photo galleries',
      numberOfItems: galleries.length,
      itemListElement: galleries.map((g, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${ORIGIN}/galleries/${g.id}`,
        name: g.title,
      })),
    };

    return this.layout({
      title: 'Photo Galleries | Sanhoti Bengali Association of Orange County, CA',
      description:
        'Photos from Sanhoti events in Orange County — Durga Puja, Saraswati Puja, Poila Boishakh, Bengali concerts, and community gatherings across Southern California.',
      path: '/galleries',
      body,
      jsonLd: [itemList],
    });
  }

  /** /notices — real published notices instead of a placeholder paragraph. */
  private async noticesPage(): Promise<string> {
    let notices: Awaited<ReturnType<NoticeService['getPublishedNotices']>> = [];
    try {
      notices = await this.noticeService.getPublishedNotices();
    } catch {
      /* evergreen copy still renders */
    }

    const items = notices
      .map(
        n => `<li><h3>${esc(n.notice_name)}</h3>
<p>${esc(stripHtml(n.notice_body, 600))}</p>
<p>Posted ${esc(fmtDate(n.created_at))}</p></li>`
      )
      .join('\n');

    const body = `
<h1>Sanhoti Notices &amp; Announcements — Orange County, California</h1>
<p>Community notices from Sanhoti Bengali Association — event dates and ticket releases,
Durga Puja announcements, volunteer calls, and updates for Bengali families across Orange
County and Southern California.</p>
${items ? `<h2>Current notices</h2>\n<ul>${items}</ul>` : `<p>There are no active notices right now. See <a href="/events">upcoming events</a> for what's next.</p>`}
<p><a href="/events">All events</a> · <a href="/durga-puja">Durga Puja</a> · <a href="/contact">Contact us</a></p>`;

    // Each notice as a ListItem so the announcements are addressable entities
    // rather than anonymous <li> text.
    const itemList = {
      '@type': 'ItemList',
      '@id': `${ORIGIN}/notices#list`,
      name: 'Sanhoti notices and announcements',
      numberOfItems: notices.length,
      itemListElement: notices.map((n, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'SpecialAnnouncement',
          name: n.notice_name,
          text: stripHtml(n.notice_body, 600),
          datePosted: n.created_at,
          url: `${ORIGIN}/notices`,
          announcementLocation: { '@id': ORG_ID },
        },
      })),
    };

    return this.layout({
      title: 'Notices & Announcements | Sanhoti Bengali Association of Orange County, CA',
      description:
        'Latest notices and announcements from Sanhoti Bengali Association — event dates, tickets, and community updates for Orange County and Southern California.',
      path: '/notices',
      body,
      jsonLd: notices.length ? [this.orgJsonLd(), itemList] : [this.orgJsonLd()],
    });
  }

  /** /news — real published items, each as a schema.org Article. */
  private async newsPage(): Promise<string> {
    let news: Awaited<ReturnType<NewsService['getPublishedNews']>> = [];
    try {
      news = await this.newsService.getPublishedNews();
    } catch {
      /* evergreen copy still renders */
    }

    const items = news
      .map(
        n => `<li><h3>${esc(n.title)}</h3>
<p>${esc(stripHtml(n.content, 500))}</p>
<p>${esc(fmtDate(n.created_at))}${
          n.media_url ? ` · <a href="${esc(n.media_url)}" rel="noopener noreferrer">Read more</a>` : ''
        }</p></li>`
      )
      .join('\n');

    const body = `
<h1>Sanhoti News &amp; Media — Bengali Community in Orange County, California</h1>
<p>News, coverage, and updates from Sanhoti Bengali Association — Durga Puja, concerts with
visiting artists, charity work, and cultural programs across Orange County and Southern
California.</p>
${items ? `<h2>Latest news</h2>\n<ul>${items}</ul>` : `<p>No news items are published right now. See our <a href="/events">events</a> and <a href="/galleries">photo galleries</a>.</p>`}
<p><a href="/events">All events</a> · <a href="/artists">Artists</a> · <a href="/galleries">Galleries</a></p>`;

    const articleNodes = news.slice(0, 20).map(n => ({
      '@type': 'Article',
      headline: n.title.slice(0, 110),
      description: stripHtml(n.content, 250),
      datePublished: n.created_at,
      dateModified: n.updated_at || n.created_at,
      author: { '@id': ORG_ID },
      publisher: { '@id': ORG_ID },
      ...(n.media_url ? { url: n.media_url } : {}),
      isPartOf: { '@id': `${ORIGIN}/news#webpage` },
    }));

    return this.layout({
      title: 'News & Media | Sanhoti Bengali Association of Orange County, CA',
      description:
        'News and media coverage of Sanhoti Bengali Association — Durga Puja, concerts, charity work, and cultural events in Orange County and Southern California.',
      path: '/news',
      body,
      jsonLd: articleNodes,
    });
  }

  /** /magazines — the real souvenir publication list. */
  private async magazinesPage(): Promise<string> {
    let magazines: Awaited<ReturnType<MagazineService['getPublicMagazines']>> = [];
    try {
      magazines = await this.magazineService.getPublicMagazines();
    } catch {
      /* evergreen copy still renders */
    }

    const items = magazines
      .map(
        m => `<li><h3>${esc(m.title)}</h3>
${m.description ? `<p>${esc(stripHtml(m.description, 300))}</p>` : ''}
<p>Published ${esc(fmtDate(m.publishDate || m.createdAt))}</p></li>`
      )
      .join('\n');

    const body = `
<h1>Sanhoti Magazines &amp; Durga Puja Souvenirs — Orange County, California</h1>
<p>Sanhoti's souvenir magazines collect Bengali writing, poetry, artwork, and children's
contributions from our community in Orange County and Southern California. Each Durga Puja
edition captures the year's celebrations alongside original literary work in Bengali and
English.</p>
${items ? `<h2>Published editions</h2>\n<ul>${items}</ul>` : `<p>Our next souvenir edition is in preparation. <a href="/contact">Contact us</a> to contribute writing or artwork.</p>`}
<h2>Contribute to the next edition</h2>
<p>We welcome poems, essays, short stories, artwork, and photography from community members
of every age. <a href="/contact">Get in touch</a> to submit for the upcoming Durga Puja
souvenir.</p>
<p><a href="/durga-puja">Durga Puja in Orange County</a> · <a href="/galleries">Photo galleries</a></p>`;

    // Periodical + issues. The PDFs themselves are not machine-readable, so this
    // markup is the only structured description of the souvenir editions Google gets.
    const itemList = {
      '@type': 'ItemList',
      '@id': `${ORIGIN}/magazines#list`,
      name: 'Sanhoti souvenir magazines',
      numberOfItems: magazines.length,
      itemListElement: magazines.map((m, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'PublicationIssue',
          name: m.title,
          ...(m.description ? { description: stripHtml(m.description, 300) } : {}),
          ...(m.publishDate || m.createdAt
            ? { datePublished: schemaDate(m.publishDate || m.createdAt) }
            : {}),
          inLanguage: ['bn', 'en'],
          publisher: { '@id': ORG_ID },
          url: `${ORIGIN}/magazines`,
        },
      })),
    };

    return this.layout({
      title: 'Magazines & Souvenirs | Sanhoti Bengali Association of Orange County, CA',
      description:
        "Sanhoti's Bengali magazines and Durga Puja souvenir publications — stories, poems, and art from the Bengali community of Orange County and Southern California.",
      path: '/magazines',
      body,
      jsonLd: magazines.length ? [this.orgJsonLd(), itemList] : [this.orgJsonLd()],
    });
  }

  /** /documents — the real public document list. */
  private async documentsPage(): Promise<string> {
    let documents: Awaited<ReturnType<DocumentService['getPublicDocuments']>> = [];
    try {
      documents = await this.documentService.getPublicDocuments();
    } catch {
      /* evergreen copy still renders */
    }

    const items = documents
      .map(
        d => `<li><h3>${esc(d.title)}</h3>
${d.description ? `<p>${esc(stripHtml(d.description, 300))}</p>` : ''}
<p>Published ${esc(fmtDate(d.publishDate || d.createdAt))}</p></li>`
      )
      .join('\n');

    const body = `
<h1>Sanhoti Public Documents — 501(c)(3) Non-Profit, Orange County, California</h1>
<p>Public documents and resources from Sanhoti Bengali Association, a registered 501(c)(3)
non-profit organization (EIN 39-2903777) based in Rancho Santa Margarita, Orange County,
California — including bylaws, policies, and community resources.</p>
${items ? `<h2>Available documents</h2>\n<ul>${items}</ul>` : `<p>No public documents are posted right now. <a href="/contact">Contact us</a> if you need our tax-exemption letter or organizational documents.</p>`}
<p><a href="/about">About Sanhoti</a> · <a href="/charity">Charitable work</a> ·
<a href="/committee">Committee &amp; board</a> · <a href="/contact">Contact us</a></p>`;

    const itemList = {
      '@type': 'ItemList',
      '@id': `${ORIGIN}/documents#list`,
      name: 'Sanhoti public documents',
      numberOfItems: documents.length,
      itemListElement: documents.map((d, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'DigitalDocument',
          name: d.title,
          ...(d.description ? { description: stripHtml(d.description, 300) } : {}),
          ...(d.publishDate || d.createdAt
            ? { datePublished: schemaDate(d.publishDate || d.createdAt) }
            : {}),
          publisher: { '@id': ORG_ID },
          url: `${ORIGIN}/documents`,
        },
      })),
    };

    return this.layout({
      title: 'Documents | Sanhoti Bengali Association of Orange County, CA',
      description:
        'Public documents from Sanhoti Bengali Association, a 501(c)(3) non-profit (EIN 39-2903777) in Orange County, California — bylaws, policies, and community resources.',
      path: '/documents',
      body,
      jsonLd: documents.length ? [this.orgJsonLd(), itemList] : [this.orgJsonLd()],
    });
  }

  /** schema.org FAQPage node bound to a specific page URL. */
  private faqNode(pageUrl: string, faqs: { q: string; a: string }[]): Record<string, unknown> {
    return {
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    };
  }

  /**
   * /sponsors — the real sponsor roll, not a static stub.
   *
   * Sponsor names live in the Durga Puja page content (`sponsorShowcase`), and
   * naming them is the point: a local business searching for itself should be
   * able to find the Sanhoti page that credits it.
   */
  private async sponsorsPage(): Promise<string> {
    let sponsors: DurgaPujaSponsorEntry[] = [];
    try {
      const year = await this.durgaPujaPageService.getActiveYear();
      const content =
        (await this.durgaPujaPageService.getContentByYear(year)) ??
        (await this.durgaPujaPageService.getContent());
      sponsors = (content?.sponsorShowcase ?? []).filter(sp => sp?.title?.trim());
    } catch {
      /* evergreen copy still renders */
    }

    // Group by tier so the page reads as a sponsor roll rather than a flat list.
    const byTier = new Map<string, DurgaPujaSponsorEntry[]>();
    for (const sp of sponsors) {
      const tier = String(sp.tier || 'Sponsor');
      byTier.set(tier, [...(byTier.get(tier) ?? []), sp]);
    }
    const rollHtml = byTier.size
      ? [...byTier.entries()]
          .map(
            ([tier, list]) =>
              `<h3>${esc(tier)} sponsors</h3>\n<ul>` +
              list.map(sp => `<li>${esc(sp.title)}</li>`).join('\n') +
              '</ul>'
          )
          .join('\n')
      : '';

    const body = `<h1>Sanhoti Sponsors &amp; Partners — Orange County, California</h1>
<p>Our sponsors make Durga Puja, Bengali concerts, and Sanhoti's cultural programming in
Orange County possible. We are grateful to the local businesses, professionals, and
corporate partners who invest in Bengali and Indian community life across Southern
California.</p>
${rollHtml ? `<h2>Our sponsors</h2>\n${rollHtml}` : ''}
<h2>Why businesses sponsor Sanhoti</h2>
<ul>
<li>Direct visibility with Bengali and Indian families across Orange County and SoCal.</li>
<li>Presence at multi-day events with sustained foot traffic, including
<a href="/durga-puja">Durga Puja Durgotsav</a>.</li>
<li>Association with arts, heritage, and community service.</li>
<li>Tax-deductible contribution to a registered 501(c)(3) (EIN 39-2903777).</li>
</ul>

<h2>Become a sponsor</h2>
<p>Sponsorship tiers range from event-level partnerships to programme listings and banner
placement. See <a href="/become-our-sponsor">sponsorship opportunities</a>, explore
<a href="/corporate-partnerships">corporate partnership and CSR options</a>, or
<a href="/contact">contact us</a> for the current prospectus.</p>`;

    const itemList = {
      '@type': 'ItemList',
      '@id': `${ORIGIN}/sponsors#list`,
      name: 'Sanhoti sponsors and partners',
      numberOfItems: sponsors.length,
      itemListElement: sponsors.map((sp, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Organization',
          name: sp.title,
          ...(sp.tier ? { award: `${sp.tier} sponsor` } : {}),
          // Names and sponsorship tier only. These are businesses crediting
          // themselves publicly; no contact details are invented here.
          funder: { '@id': ORG_ID },
        },
      })),
    };

    const collection = {
      '@type': 'CollectionPage',
      '@id': `${ORIGIN}/sponsors#page`,
      name: 'Sanhoti sponsors and partners',
      url: `${ORIGIN}/sponsors`,
      about: { '@id': ORG_ID },
    };

    return this.layout({
      title: 'Sponsors & Partners | Sanhoti Bengali Association of Orange County, CA',
      description:
        'Sanhoti thanks the sponsors and partners who support Bengali cultural events — Durga Puja, concerts, and community programs — in Orange County and Southern California.',
      path: '/sponsors',
      body,
      jsonLd: sponsors.length
        ? [this.orgJsonLd(), collection, itemList]
        : [this.orgJsonLd(), collection],
    });
  }

  private staticPage(path: string): string | null {
    const pages: Record<
      string,
      { title: string; description: string; body: string; jsonLd?: Record<string, unknown>[] }
    > = {
      '/about': {
        title: 'About Sanhoti | Bengali Association of Orange County, CA',
        description:
          'Sanhoti is a 501(c)(3) non-profit Bengali cultural association in Orange County, CA, celebrating Durga Puja, Poila Boishakh, and Bengali heritage across Southern California.',
        body: `<h1>About Sanhoti — Bengali Association of Orange County, California</h1>
<p>Sanhoti (সংহতি — "solidarity") is a non-profit 501(c)(3) cultural and charitable
organization dedicated to preserving and celebrating Bengali culture in Orange County,
California. Established in 2025 and based in Rancho Santa Margarita, we bring together
Bengali and Indian families from across Southern California — and welcome guests of every
background.</p>

<h2>What we do</h2>
<ul>
<li><strong>Religious and cultural festivals</strong> — <a href="/durga-puja">Durga Puja</a>,
<a href="/saraswati-puja">Saraswati Puja</a>, <a href="/poila-boishakh">Poila Boishakh</a>,
and <a href="/kali-puja">Kali Puja</a>, celebrated with full traditional ritual.</li>
<li><strong>Live concerts</strong> — we bring <a href="/artists">visiting artists</a> from
India and the diaspora to perform in Orange County.</li>
<li><strong>Authentic Bengali food</strong> — <a href="/bengali-food">bhog and festival
meals</a> cooked by the community for the community.</li>
<li><strong>Charitable work</strong> — <a href="/charity">fundraising and volunteering</a>
for Orange County causes including hunger relief and domestic violence support.</li>
<li><strong>Youth and language programs</strong> — helping Bengali-American children stay
connected to their language, music, and heritage.</li>
</ul>

<h2>Where we serve</h2>
<p>Sanhoti is based in Rancho Santa Margarita and holds events across Orange County —
Costa Mesa, Irvine, Tustin, Mission Viejo, Lake Forest, Aliso Viejo, Santa Ana, and Newport
Beach — with members joining from throughout Southern California including Los Angeles,
Riverside, and San Diego counties.</p>

<h2>Organization details</h2>
<p>Legal name: ${esc(LEGAL_NAME)}. Status: registered 501(c)(3) non-profit. EIN: 39-2903777.
Founded: 2025. Address: ${esc(ORG_ADDRESS)}. Email: ${esc(ORG_EMAIL)}. Phone: ${esc(ORG_PHONE)}.</p>

<h2>Get involved</h2>
<p>Everyone is welcome at Sanhoti events, whether or not you are Bengali. Come to an
<a href="/events">upcoming event</a>, <a href="/donate">support our work</a>,
<a href="/become-our-sponsor">sponsor a festival</a>, or <a href="/contact">contact us</a>
to volunteer.</p>`,
        jsonLd: [
          {
            '@type': 'AboutPage',
            '@id': `${ORIGIN}/about#page`,
            name: 'About Sanhoti',
            url: `${ORIGIN}/about`,
            mainEntity: { '@id': ORG_ID },
            about: { '@id': ORG_ID },
          },
        ],
      },
      '/contact': {
        title: 'Contact Sanhoti | Bengali Association of Orange County, CA',
        description: `Contact Sanhoti Bengali Association of Orange County: ${ORG_EMAIL}, ${ORG_PHONE}, ${ORG_ADDRESS}. Questions about events, tickets, sponsorship, or membership.`,
        body: `<h1>Contact Sanhoti — Bengali Association of Orange County, California</h1>
<p>Questions about an event, tickets, sponsorship, volunteering, or joining Sanhoti? We are
happy to hear from you.</p>
<h2>Contact details</h2>
<ul>
<li>Email: ${esc(ORG_EMAIL)}</li>
<li>Phone: ${esc(ORG_PHONE)}</li>
<li>Address: ${esc(ORG_ADDRESS)}</li>
</ul>
<h2>What to contact us about</h2>
<ul>
<li><strong>Events and tickets</strong> — dates, pricing, seating, and accessibility.</li>
<li><strong>Sponsorship and corporate partnership</strong> — see
<a href="/become-our-sponsor">sponsorship packages</a> and
<a href="/corporate-partnerships">corporate partnerships</a>.</li>
<li><strong>Artists and press</strong> — performance and media enquiries; see
<a href="/artists">our artists</a>.</li>
<li><strong>Volunteering and membership</strong> — join the team behind our festivals.</li>
<li><strong>Charitable giving</strong> — our EIN and tax-exemption letter for
<a href="/charity">CSR review</a>.</li>
</ul>
<p>Sanhoti is a volunteer-run 501(c)(3) non-profit serving Orange County and Southern
California. We aim to reply within a few days.</p>`,
        jsonLd: [
          {
            '@type': 'ContactPage',
            '@id': `${ORIGIN}/contact#page`,
            name: 'Contact Sanhoti',
            url: `${ORIGIN}/contact`,
            mainEntity: { '@id': ORG_ID },
          },
          {
            '@type': 'ContactPoint',
            '@id': `${ORIGIN}/contact#contactpoint`,
            contactType: 'General enquiries',
            email: ORG_EMAIL,
            telephone: ORG_PHONE,
            areaServed: 'Orange County, California',
            availableLanguage: ['English', 'Bengali'],
          },
        ],
      },
      '/donate': {
        title: 'Donate to Sanhoti | 501(c)(3) Bengali Non-Profit in Orange County, CA',
        description:
          'Support Bengali culture in Orange County. Donations to Sanhoti, a 501(c)(3) non-profit (EIN 39-2903777), fund Durga Puja, cultural programs, and charity work. Tax-deductible.',
        body: `<h1>Donate to Sanhoti — 501(c)(3) Non-Profit in Orange County, California</h1>
<p>Sanhoti is a registered 501(c)(3) non-profit organization (EIN 39-2903777). Your donation
is tax-deductible to the extent allowed by law and goes directly into cultural and
charitable programming in Orange County, California.</p>

<h2>What your donation funds</h2>
<ul>
<li><strong>Durga Puja and festivals</strong> — venue, priest, idol, decorations, and bhog
for <a href="/durga-puja">Durgotsav</a> and our other celebrations.</li>
<li><strong>Artists and cultural programs</strong> — bringing
<a href="/artists">performers from India and the diaspora</a> to Orange County.</li>
<li><strong>Charitable giving</strong> — <a href="/charity">hunger relief and domestic
violence support</a> for Orange County families.</li>
<li><strong>Youth programs</strong> — Bengali language, music, and heritage education for
children.</li>
<li><strong>Keeping events affordable</strong> — subsidised and free entry so cost is never
a barrier.</li>
</ul>

<h2>Ways to give</h2>
<ul>
<li>One-time or recurring online donation.</li>
<li><strong>Employer matching gifts</strong> — many companies match employee donations
dollar-for-dollar. Ask your HR or CSR team and use EIN 39-2903777.</li>
<li><a href="/become-our-sponsor">Event sponsorship</a> for individuals and businesses.</li>
<li><a href="/corporate-partnerships">Corporate partnership and CSR programs</a>.</li>
</ul>

<h2>Tax information</h2>
<p>Sanhoti is a 501(c)(3) tax-exempt organization. EIN: 39-2903777. Registered address:
${esc(ORG_ADDRESS)}. We can provide a donation receipt and our IRS determination letter on
request — email ${esc(ORG_EMAIL)}.</p>
<p><a href="/charity">Our charitable work</a> · <a href="/about">About Sanhoti</a> ·
<a href="/contact">Contact us</a></p>`,
        jsonLd: [
          {
            '@type': 'WebPage',
            '@id': `${ORIGIN}/donate#page`,
            name: 'Donate to Sanhoti',
            url: `${ORIGIN}/donate`,
            mainEntity: { '@id': ORG_ID },
            // The tax status is the fact a prospective donor is checking for.
            significantLink: `${ORIGIN}/charity`,
          },
          {
            '@type': 'DonateAction',
            '@id': `${ORIGIN}/donate#action`,
            name: 'Donate to Sanhoti Bengali Association',
            recipient: { '@id': ORG_ID },
            target: `${ORIGIN}/donate`,
          },
        ],
      },
      '/committee': {
        title: 'Committee & Board | Sanhoti Bengali Association of Orange County, CA',
        description:
          'Meet the volunteer committee and executive board of Sanhoti, the 501(c)(3) Bengali cultural association serving Orange County and Southern California.',
        body: `<h1>Sanhoti Committee &amp; Executive Board — Orange County, California</h1>
<p>Sanhoti is entirely volunteer-run. Our executive committee and board members organise
every festival, concert, and charity drive we hold in Orange County, California — from
<a href="/durga-puja">Durga Puja</a> and <a href="/saraswati-puja">Saraswati Puja</a> to
<a href="/bollywood-concerts">live concerts</a> and community service.</p>

<h2>How Sanhoti is governed</h2>
<p>As a registered 501(c)(3) non-profit (EIN 39-2903777), Sanhoti is governed by an elected
executive committee responsible for programming, finance, and community outreach.
Sub-committees handle cultural programming, food service, logistics, sponsorship, and
volunteer coordination for each event.</p>

<h2>Join the team</h2>
<p>Sanhoti is always looking for volunteers — no committee experience needed. Whether you can
help with cooking, stage management, decoration, registration, photography, or fundraising,
<a href="/contact">get in touch</a>.</p>
<p><a href="/about">About Sanhoti</a> · <a href="/charity">Our charitable work</a> ·
<a href="/documents">Public documents</a> · <a href="/contact">Contact us</a></p>`,
      },
      '/become-our-sponsor': {
        title: 'Become a Sponsor | Sanhoti Durga Puja & Bengali Events, Orange County, CA',
        description:
          'Sponsor Sanhoti Durga Puja and Bengali cultural events in Orange County, CA. Reach Bengali and Indian families across Southern California. Tax-deductible 501(c)(3) sponsorship.',
        body: `<h1>Become a Sanhoti Sponsor — Durga Puja &amp; Bengali Events in Orange County, CA</h1>
<p>Sponsoring Sanhoti puts your brand in front of Bengali and Indian families across Orange
County and Southern California at Durga Puja, live concerts, and cultural festivals — an
engaged, family-oriented, high-intent local audience that is difficult to reach through
conventional advertising.</p>

<h2>What sponsorship includes</h2>
<ul>
<li><strong>On-site branding</strong> — banners and signage at the venue across all event days.</li>
<li><strong>Souvenir magazine advertising</strong> — full-page and partial-page placements in
our <a href="/magazines">Durga Puja souvenir</a>.</li>
<li><strong>Stage and announcement recognition</strong> during the cultural programme.</li>
<li><strong>Digital visibility</strong> — listing on our <a href="/sponsors">sponsors page</a>
and recognition across our social channels.</li>
<li><strong>Booth or table space</strong> at multi-day events, subject to tier.</li>
</ul>

<h2>Who sponsors us</h2>
<p>Local restaurants and grocers, realtors and mortgage brokers, physicians and dentists,
insurance and financial advisors, law firms, tutoring and enrichment programs, travel
agencies, and regional corporate partners running CSR and diversity programs.</p>

<h2>Tax-deductible</h2>
<p>Sanhoti is a registered 501(c)(3) non-profit, EIN 39-2903777, so sponsorship
contributions are tax-deductible to the extent allowed by law. We provide a receipt and can
supply our IRS determination letter for your finance team.</p>

<h2>Next steps</h2>
<p><a href="/contact">Contact us</a> for the current sponsorship prospectus with tier pricing
and deadlines, or see <a href="/corporate-partnerships">corporate partnerships and CSR</a>
for larger multi-year and matching-gift arrangements.</p>`,
        jsonLd: [
          {
            '@type': 'WebPage',
            '@id': `${ORIGIN}/become-our-sponsor#page`,
            name: 'Sponsor Sanhoti',
            url: `${ORIGIN}/become-our-sponsor`,
            mainEntity: { '@id': ORG_ID },
          },
          {
            '@type': 'Service',
            '@id': `${ORIGIN}/become-our-sponsor#sponsorship`,
            name: 'Event sponsorship for Orange County businesses',
            serviceType: 'Cultural event sponsorship',
            provider: { '@id': ORG_ID },
            areaServed: {
              '@type': 'AdministrativeArea',
              name: 'Orange County, California',
            },
            audience: { '@type': 'BusinessAudience', name: 'Local and regional businesses' },
          },
        ],
      },
      '/book-your-seat': {
        title: 'Book Your Seat | Sanhoti Durga Puja, Orange County, CA',
        description:
          'Reserve your seat for Sanhoti Durga Puja and cultural events in Orange County, California. Select seats and complete your booking online.',
        body: `<h1>Book Your Seat — Sanhoti Durga Puja, Orange County, California</h1>
<p>Reserve seats for Sanhoti's Durga Puja and cultural events in Orange County, California.
Choose your seats from the venue map and complete the booking online.</p>
<h2>Before you book</h2>
<ul>
<li>Check dates, venue, and ticket tiers on the <a href="/durga-puja">Durga Puja page</a>.</li>
<li>Confirm which meals and <a href="/bengali-food">bhog services</a> your pass includes.</li>
<li>See the concert line-up and <a href="/artists">performing artists</a>.</li>
</ul>
<p>Seats for popular concert evenings sell out — book early. Questions about seating or
accessibility? <a href="/contact">Contact us</a>.</p>`,
        jsonLd: [
          {
            '@type': 'WebPage',
            '@id': `${ORIGIN}/book-your-seat#page`,
            name: 'Book your seat',
            url: `${ORIGIN}/book-your-seat`,
            mainEntity: { '@id': ORG_ID },
            significantLink: `${ORIGIN}/events`,
          },
        ],
      },
    };

    const page = pages[path];
    if (!page) return null;
    // The Organization node is on every static page; `page.jsonLd` adds the
    // node that says what *this particular page* is.
    const { jsonLd: pageNodes, ...rest } = page;
    return this.layout({ ...rest, path, jsonLd: [this.orgJsonLd(), ...(pageNodes ?? [])] });
  }

  /**
   * HTTP 200 + `noindex` for pages that exist but should stay out of the index
   * (login, register, dashboard, admin, RSVP forms). See `isNoindexRoute`.
   */
  private noindexPage(path: string): string {
    return this.layout({
      title: 'Sanhoti Bengali Association of Orange County, CA',
      description:
        'Sanhoti Bengali Association of Orange County, CA — Durga Puja, Bengali festivals, concerts, and community events across Southern California.',
      path,
      noindex: true,
      body: `<h1>${esc(ORG_NAME)}</h1>
<p>This page is not part of the public site. Browse
<a href="/events">Sanhoti events</a>, <a href="/durga-puja">Durga Puja in Orange County</a>, or
<a href="/">the Sanhoti home page</a>.</p>`,
    });
  }

  /**
   * Real HTTP 404 + noindex. Used for unknown paths and for detail routes whose
   * record does not exist, so crawlers drop the URL instead of indexing a stub.
   */
  private notFound(res: Response, path: string): string {
    res.status(404);
    return this.layout({
      title: 'Page not found | Sanhoti Bengali Association of Orange County',
      description:
        'This page could not be found. Browse current Sanhoti events, festivals, and galleries in Orange County, CA.',
      path,
      noindex: true,
      body: `<h1>Page not found</h1>
<p>The page you requested does not exist or has been removed.</p>
<p>Try one of these instead:</p>
<ul>
<li><a href="/">Sanhoti home</a></li>
<li><a href="/events">All events</a></li>
<li><a href="/durga-puja">Durga Puja in Orange County</a></li>
<li><a href="/festivals">Bengali festivals</a></li>
<li><a href="/bollywood-concerts">Bengali concerts</a></li>
<li><a href="/artists">Artists &amp; performers at Sanhoti</a></li>
<li><a href="/galleries">Photo galleries</a></li>
<li><a href="/contact">Contact us</a></li>
</ul>`,
    });
  }
}
