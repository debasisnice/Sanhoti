import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { DatabaseHelper } from './DatabaseHelper.js';
import { DurgaPujaPageContent, Event } from '../models/types.js';
import { EventDataHelper } from './EventDataHelper.js';
import { durgaPujaEventYear, findDurgaPujaEventForYear } from '../utils/durgaPuja.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FILENAME = 'durgaPujaPage.json';
const IMAGE_ROOT = join(__dirname, '../../data/DurgaPuja_Page');
const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp)$/i;

export function getDefaultDurgaPujaPageContent(year?: number): DurgaPujaPageContent {
  const y = year && year >= 2000 ? year : new Date().getFullYear();
  return {
    year: y,
    intro:
      "Sanhoti Bengali Association hosts one of Orange County's most vibrant Durga Puja (Durgotsav) celebrations — three days of puja, pushpanjali, dhunuchi naach, Bengali food, and evening cultural concerts. Our celebration welcomes Bengali and Indian families from across Southern California.",
    datesText: `October 16–21, ${y} (Shashthi through Vijayadashami)`,
    startDate: `${y}-10-16`,
    endDate: `${y}-10-21`,
    venueName: 'Venue to be announced — Orange County, CA',
    venueCity: 'Costa Mesa',
    venueNote: 'Schedule and venue will be announced on our Events page.',
    faqs: [
      {
        question: 'Where is Durga Puja celebrated in Orange County?',
        answer:
          "Sanhoti Bengali Association hosts Durga Puja in central Orange County, an easy drive from Irvine, Tustin, Santa Ana, Anaheim, and Mission Viejo.",
      },
      {
        question: 'Is there a Durga Puja near Irvine?',
        answer:
          "Yes — Sanhoti's Durga Puja is held minutes from Irvine, CA. The celebration includes puja, pushpanjali, dhunuchi naach, Bengali food, and cultural concerts.",
      },
      {
        question: 'Is Durga Puja open to non-members?',
        answer:
          'Yes. Sanhoti Durga Puja is open to the entire community — families, students, and visitors from across Southern California are welcome.',
      },
      {
        question: `When is Durga Puja in ${y}?`,
        answer: `Durga Puja ${y} dates and schedule are listed on this page. See our Events page for the latest updates.`,
      },
    ],
    ticketLinks: [],
    ticketsNote: '',
    updated_at: new Date().toISOString(),
  };
}

function toIsoDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

function formatDateRange(start: Date, end: Date): string {
  const opts = { timeZone: 'America/Los_Angeles' } as const;
  const startMonth = start.toLocaleDateString('en-US', { ...opts, month: 'long' });
  const endMonth = end.toLocaleDateString('en-US', { ...opts, month: 'long' });
  const startDay = start.toLocaleDateString('en-US', { ...opts, day: 'numeric' });
  const endDay = end.toLocaleDateString('en-US', { ...opts, day: 'numeric' });
  const year = end.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  if (start.getTime() === end.getTime()) return `${startMonth} ${startDay}, ${year}`;
  if (startMonth === endMonth) return `${startMonth} ${startDay}–${endDay}, ${year}`;
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

function pageFromEvent(event: Event, year: number, pastTense = false): DurgaPujaPageContent {
  const defaults = getDefaultDurgaPujaPageContent(year);
  const start = new Date(event.event_start_dt);
  const end = new Date(event.event_end_dt || event.event_start_dt);
  const location = (event.location || '').trim();
  const intro = pastTense
    ? `Sanhoti Bengali Association celebrated Durgotsav ${year} in Orange County — puja, pushpanjali, dhunuchi naach, Bengali food, and evening cultural concerts at ${location || 'Costa Mesa, CA'}, welcoming Bengali and Indian families from across Southern California.`
    : defaults.intro;
  return {
    ...defaults,
    year,
    intro,
    startDate: !isNaN(start.getTime()) ? toIsoDate(start) : defaults.startDate,
    endDate: !isNaN(end.getTime()) ? toIsoDate(end) : defaults.endDate,
    datesText:
      !isNaN(start.getTime()) && !isNaN(end.getTime())
        ? formatDateRange(start, end)
        : defaults.datesText,
    venueName: location || defaults.venueName,
    venueCity: defaults.venueCity,
    venueNote: pastTense
      ? 'Browse our photo galleries for highlights from the celebration.'
      : 'See the event page for the full schedule and RSVP.',
    linkedEventId: event.event_id,
    faqs: defaults.faqs.map(f =>
      f.question.includes('When is Durga Puja')
        ? {
            question: f.question,
            answer: pastTense
              ? `Durga Puja ${year} was celebrated ${!isNaN(start.getTime()) && !isNaN(end.getTime()) ? formatDateRange(start, end) : `in ${year}`}. See photos in our Galleries.`
              : `Durga Puja ${year} runs ${!isNaN(start.getTime()) && !isNaN(end.getTime()) ? formatDateRange(start, end) : 'dates TBA'}. Sanhoti's schedule is on this page and our Events listing.`,
          }
        : f
    ),
    updated_at: new Date().toISOString(),
  };
}

function inferYearFromContent(row: Partial<DurgaPujaPageContent>): number {
  if (row.year && row.year >= 2000) return row.year;
  const fromStart = parseInt((row.startDate || '').slice(0, 4), 10);
  if (Number.isFinite(fromStart) && fromStart > 2000) return fromStart;
  return new Date().getFullYear();
}

function migrateLegacyImageToYear(year: number): void {
  if (!existsSync(IMAGE_ROOT)) return;
  const yearDir = join(IMAGE_ROOT, String(year));
  if (!existsSync(yearDir)) mkdirSync(yearDir, { recursive: true });
  const legacy = readdirSync(IMAGE_ROOT).find(
    f => IMAGE_RE.test(f) && statSync(join(IMAGE_ROOT, f)).isFile()
  );
  if (!legacy) return;
  const dest = join(yearDir, 'durga-puja-page.' + (legacy.split('.').pop()?.toLowerCase() || 'jpg'));
  if (!existsSync(dest)) {
    try {
      copyFileSync(join(IMAGE_ROOT, legacy), dest);
    } catch {
      /* ignore */
    }
  }
}

export class DurgaPujaPageDataHelper extends DatabaseHelper {
  private eventHelper = new EventDataHelper();
  private migrated = false;

  private async readPages(): Promise<DurgaPujaPageContent[]> {
    const raw = await this.readFile<DurgaPujaPageContent>(FILENAME);
    if (!raw || raw.length === 0) return [];
    return raw.map(row => ({
      ...getDefaultDurgaPujaPageContent(inferYearFromContent(row)),
      ...row,
      year: inferYearFromContent(row),
    }));
  }

  private async writePages(pages: DurgaPujaPageContent[]): Promise<void> {
    await this.writeFile<DurgaPujaPageContent>(FILENAME, pages);
  }

  /** One-time migration: legacy single page → per-year pages including 2025 backfill. */
  async ensureMigrated(): Promise<void> {
    if (this.migrated) return;
    this.migrated = true;

    let pages = await this.readPages();
    let changed = false;

    for (const page of pages) {
      const y = inferYearFromContent(page);
      if (page.year !== y) {
        page.year = y;
        changed = true;
      }
    }

    const events = await this.eventHelper.findAll();
    const active = events.find(e => e.is_active_durga_puja_event === true) ?? null;
    const activeYear = active ? durgaPujaEventYear(active) : null;

    if (pages.length === 1 && !pages[0].year && activeYear) {
      pages[0].year = activeYear;
      changed = true;
      migrateLegacyImageToYear(activeYear);
    } else if (pages.length === 1 && pages[0].year) {
      migrateLegacyImageToYear(pages[0].year);
    }

    if (!pages.some(p => p.year === 2025)) {
      const event2025 = findDurgaPujaEventForYear(events, 2025);
      if (event2025) {
        pages.push(pageFromEvent(event2025, 2025, true));
        changed = true;
      }
    }

    if (!pages.some(p => p.year === 2026)) {
      const event2026 = findDurgaPujaEventForYear(events, 2026);
      const legacy = pages.find(p => p.year === activeYear) ?? pages[0];
      if (legacy && legacy.year !== 2026) {
        pages.push({ ...legacy, year: 2026, linkedEventId: event2026?.event_id ?? legacy.linkedEventId });
        changed = true;
        migrateLegacyImageToYear(2026);
      } else if (event2026) {
        pages.push(pageFromEvent(event2026, 2026, false));
        changed = true;
      }
    }

    // Dedupe by year (keep latest updated_at)
    const byYear = new Map<number, DurgaPujaPageContent>();
    for (const p of pages) {
      const existing = byYear.get(p.year);
      if (!existing || (p.updated_at || '') > (existing.updated_at || '')) {
        byYear.set(p.year, p);
      }
    }
    const deduped = [...byYear.values()].sort((a, b) => b.year - a.year);
    if (deduped.length !== pages.length || changed) {
      pages = deduped;
      changed = true;
    }

    if (changed) {
      await this.writePages(pages.sort((a, b) => b.year - a.year));
    }
  }

  async listYears(): Promise<number[]> {
    await this.ensureMigrated();
    const pages = await this.readPages();
    return pages.map(p => p.year).sort((a, b) => b - a);
  }

  async getByYear(year: number): Promise<DurgaPujaPageContent | null> {
    await this.ensureMigrated();
    const pages = await this.readPages();
    const page = pages.find(p => p.year === year);
    if (!page) return null;
    return { ...getDefaultDurgaPujaPageContent(year), ...page, year };
  }

  async getOrCreate(year: number): Promise<DurgaPujaPageContent> {
    await this.ensureMigrated();
    const existing = await this.getByYear(year);
    if (existing) return existing;
    const events = await this.eventHelper.findAll();
    const event = findDurgaPujaEventForYear(events, year);
    const created = event
      ? pageFromEvent(event, year, year < new Date().getFullYear())
      : getDefaultDurgaPujaPageContent(year);
    const pages = await this.readPages();
    pages.push(created);
    await this.writePages(pages.sort((a, b) => b.year - a.year));
    return created;
  }

  /** @deprecated use getByYear(activeYear) — kept for callers during transition */
  async get(): Promise<DurgaPujaPageContent> {
    await this.ensureMigrated();
    const events = await this.eventHelper.findAll();
    const active = events.find(e => e.is_active_durga_puja_event === true);
    const year = active ? durgaPujaEventYear(active) : (await this.listYears())[0] ?? new Date().getFullYear();
    return (await this.getByYear(year)) ?? (await this.getOrCreate(year));
  }

  async update(year: number, patch: Partial<DurgaPujaPageContent>): Promise<DurgaPujaPageContent> {
    await this.ensureMigrated();
    const pages = await this.readPages();
    const index = pages.findIndex(p => p.year === year);
    const current =
      index >= 0
        ? { ...getDefaultDurgaPujaPageContent(year), ...pages[index], year }
        : getDefaultDurgaPujaPageContent(year);
    const updated: DurgaPujaPageContent = {
      ...current,
      ...patch,
      year,
      updated_at: new Date().toISOString(),
    };
    if (index >= 0) pages[index] = updated;
    else pages.push(updated);
    await this.writePages(pages.sort((a, b) => b.year - a.year));
    return updated;
  }
}

export function durgaPujaImageDir(year: number): string {
  const dir = join(IMAGE_ROOT, String(year));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function findDurgaPujaImageFile(year: number): string | null {
  const yearDir = join(IMAGE_ROOT, String(year));
  if (existsSync(yearDir)) {
    const found = readdirSync(yearDir).find(
      f => statSync(join(yearDir, f)).isFile() && IMAGE_RE.test(f)
    );
    if (found) return join(yearDir, found);
  }
  // Legacy single image at root (pre-migration)
  if (existsSync(IMAGE_ROOT)) {
    const legacy = readdirSync(IMAGE_ROOT).find(
      f => IMAGE_RE.test(f) && statSync(join(IMAGE_ROOT, f)).isFile()
    );
    if (legacy) return join(IMAGE_ROOT, legacy);
  }
  return null;
}

export function durgaPujaPageImageExists(year: number): boolean {
  return findDurgaPujaImageFile(year) !== null;
}

/**
 * Generic per-year, per-category asset storage for the extended Durga Puja page
 * (artist photos, food photos, venue map, gallery images, QR codes, etc.).
 * Files live under DurgaPuja_Page/<year>/assets/<category>/.
 */
export const DURGA_PUJA_ASSET_CATEGORIES = [
  'artists',
  'food',
  'venue',
  'gallery',
  'highlights',
  'sponsors',
  'qr',
  'misc',
] as const;
export type DurgaPujaAssetCategory = (typeof DURGA_PUJA_ASSET_CATEGORIES)[number];

export function isDurgaPujaAssetCategory(value: string): value is DurgaPujaAssetCategory {
  return (DURGA_PUJA_ASSET_CATEGORIES as readonly string[]).includes(value);
}

/** Absolute directory for a category's assets (created if missing). */
export function durgaPujaAssetDir(year: number, category: DurgaPujaAssetCategory): string {
  const dir = join(IMAGE_ROOT, String(year), 'assets', category);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** List asset filenames (images only) for a category, sorted newest-first. */
export function listDurgaPujaAssets(year: number, category: DurgaPujaAssetCategory): string[] {
  const dir = join(IMAGE_ROOT, String(year), 'assets', category);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => IMAGE_RE.test(f) && statSync(join(dir, f)).isFile())
    .sort((a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs);
}

/** Resolve a single asset file path, or null if it does not exist / is unsafe. */
export function findDurgaPujaAssetFile(
  year: number,
  category: DurgaPujaAssetCategory,
  filename: string
): string | null {
  // Guard against path traversal — only a bare filename is allowed.
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return null;
  }
  const file = join(IMAGE_ROOT, String(year), 'assets', category, filename);
  if (existsSync(file) && statSync(file).isFile() && IMAGE_RE.test(file)) return file;
  return null;
}
