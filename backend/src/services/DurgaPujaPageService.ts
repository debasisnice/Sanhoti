import { DurgaPujaPageDataHelper } from '../data/DurgaPujaPageDataHelper.js';
import { EventDataHelper } from '../data/EventDataHelper.js';
import { DurgaPujaFaq, DurgaPujaPageContent, Event, TicketLink } from '../models/types.js';
import { durgaPujaEventYear } from '../utils/durgaPuja.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 2000;
const MAX_FAQS = 12;
const MAX_TICKET_LINKS = 6;
const MAX_TICKET_LABEL = 100;
const MAX_TICKET_URL = 2000;

export class DurgaPujaPageService {
  private dataHelper: DurgaPujaPageDataHelper;
  private eventDataHelper: EventDataHelper;

  constructor() {
    this.dataHelper = new DurgaPujaPageDataHelper();
    this.eventDataHelper = new EventDataHelper();
  }

  async listYears(): Promise<number[]> {
    return this.dataHelper.listYears();
  }

  async getActiveYear(): Promise<number> {
    const flagged = await this.findActiveDurgaEvent();
    if (flagged) return durgaPujaEventYear(flagged);
    const years = await this.listYears();
    return years[0] ?? new Date().getFullYear();
  }

  async getContentByYear(year: number): Promise<DurgaPujaPageContent | null> {
    return this.dataHelper.getByYear(year);
  }

  async getContent(): Promise<DurgaPujaPageContent> {
    let content = await this.dataHelper.get();
    try {
      const flagged = await this.findActiveDurgaEvent();
      if (!flagged) {
        const candidate =
          (await this.findLinkedDurgaEvent(content.linkedEventId)) ??
          (await this.findUpcomingDurgaEvent());
        if (candidate) {
          const updated = await this.eventDataHelper.update(candidate.event_id, {
            is_active_durga_puja_event: true,
          });
          if (updated) await this.syncFromEvent(updated);
          content = await this.dataHelper.get();
        }
      }
    } catch {
      // Backfill must never break the public page
    }
    return content;
  }

  private async findActiveDurgaEvent(): Promise<Event | null> {
    const events = await this.eventDataHelper.findAll();
    return events.find(e => e.is_active_durga_puja_event === true) ?? null;
  }

  private async findLinkedDurgaEvent(linkedEventId?: string): Promise<Event | null> {
    if (!linkedEventId) return null;
    const event = await this.eventDataHelper.findById(linkedEventId);
    if (!event || !/durga|durgotsav/i.test(event.event_name || '')) return null;
    return event;
  }

  private async findUpcomingDurgaEvent(): Promise<Event | null> {
    try {
      const events = await this.eventDataHelper.findAll();
      const now = Date.now();
      const upcoming = events.filter(e => {
        if (!/durga|durgotsav/.test((e.event_name || '').toLowerCase())) return false;
        const end = new Date(e.event_end_dt || e.event_start_dt);
        return !isNaN(end.getTime()) && end.getTime() >= now;
      });
      upcoming.sort(
        (a, b) => new Date(a.event_start_dt).getTime() - new Date(b.event_start_dt).getTime()
      );
      return upcoming[0] ?? null;
    } catch {
      return null;
    }
  }

  async updateContent(
    year: number,
    patch: Partial<DurgaPujaPageContent>
  ): Promise<DurgaPujaPageContent> {
    const clean: Partial<DurgaPujaPageContent> = {};

    const textFields = ['intro', 'datesText', 'venueName', 'venueCity', 'venueNote'] as const;
    for (const field of textFields) {
      const value = patch[field];
      if (value !== undefined) {
        if (typeof value !== 'string' || value.length > MAX_TEXT) {
          throw new Error(`Invalid value for ${field}`);
        }
        clean[field] = value.trim();
      }
    }

    for (const field of ['startDate', 'endDate'] as const) {
      const value = patch[field];
      if (value !== undefined) {
        if (typeof value !== 'string' || !ISO_DATE.test(value)) {
          throw new Error(`${field} must be in YYYY-MM-DD format`);
        }
        clean[field] = value;
      }
    }
    const existing = (await this.dataHelper.getByYear(year)) ?? (await this.dataHelper.getOrCreate(year));
    const start = clean.startDate ?? existing.startDate;
    const end = clean.endDate ?? existing.endDate;
    if (start && end && end < start) {
      throw new Error('endDate cannot be before startDate');
    }

    if (patch.faqs !== undefined) {
      if (!Array.isArray(patch.faqs) || patch.faqs.length > MAX_FAQS) {
        throw new Error(`faqs must be an array of at most ${MAX_FAQS} items`);
      }
      const faqs: DurgaPujaFaq[] = [];
      for (const faq of patch.faqs) {
        if (
          !faq ||
          typeof faq.question !== 'string' ||
          typeof faq.answer !== 'string' ||
          faq.question.length > MAX_TEXT ||
          faq.answer.length > MAX_TEXT
        ) {
          throw new Error('Each FAQ needs a question and an answer (strings)');
        }
        const question = faq.question.trim();
        const answer = faq.answer.trim();
        if (question && answer) faqs.push({ question, answer });
      }
      clean.faqs = faqs;
    }

    if (patch.ticketsNote !== undefined) {
      if (typeof patch.ticketsNote !== 'string' || patch.ticketsNote.length > MAX_TEXT) {
        throw new Error('Invalid value for ticketsNote');
      }
      clean.ticketsNote = patch.ticketsNote.trim();
    }

    for (const field of [
      'showInternalBooking',
      'showExternalTickets',
      'ticketsOff',
      'showSavedTickets',
      'showVenueDefaults',
      'showYapsodyWidget',
      'showDonateButtonInTickets',
    ] as const) {
      const value = patch[field];
      if (value !== undefined) {
        if (typeof value !== 'boolean') {
          throw new Error(`${field} must be a boolean`);
        }
        clean[field] = value;
      }
    }

    if (patch.ticketLinks !== undefined) {
      if (!Array.isArray(patch.ticketLinks) || patch.ticketLinks.length > MAX_TICKET_LINKS) {
        throw new Error(`ticketLinks must be an array of at most ${MAX_TICKET_LINKS} items`);
      }
      const ticketLinks: TicketLink[] = [];
      for (const link of patch.ticketLinks) {
        if (
          !link ||
          typeof link.label !== 'string' ||
          typeof link.url !== 'string' ||
          link.label.length > MAX_TICKET_LABEL ||
          link.url.length > MAX_TICKET_URL
        ) {
          throw new Error('Each ticket link needs a label and a URL (strings)');
        }
        const label = link.label.trim();
        const url = link.url.trim();
        if (!label && !url) continue;
        if (!label || !url) {
          throw new Error('Each ticket link needs both a label and a URL');
        }
        if (!isHttpUrl(url)) {
          throw new Error(`Ticket link URL must start with http:// or https:// — got "${url}"`);
        }
        ticketLinks.push({ label, url });
      }
      clean.ticketLinks = ticketLinks;
    }

    if (patch.yapsodyEventId !== undefined) {
      if (typeof patch.yapsodyEventId !== 'string' || patch.yapsodyEventId.length > 32) {
        throw new Error('yapsodyEventId must be a string of at most 32 characters');
      }
      const id = patch.yapsodyEventId.trim();
      clean.yapsodyEventId = id || undefined;
    }

    if (patch.yapsodyVenueCode !== undefined) {
      if (typeof patch.yapsodyVenueCode !== 'string' || patch.yapsodyVenueCode.length > 64) {
        throw new Error('yapsodyVenueCode must be a string of at most 64 characters');
      }
      const code = patch.yapsodyVenueCode.trim();
      clean.yapsodyVenueCode = code || undefined;
    }

    // Extended 16-section content.
    // edited by admins only; sanitize recursively (trim + length/array caps) and
    // pass through rather than hand-validating every nested key.
    const passthroughKeys: (keyof DurgaPujaPageContent)[] = [
      'heroTagline',
      'heroSubheadline',
      'showCountdown',
      'ctaButtons',
      'highlights',
      'expectedAttendance',
      'scheduleNote',
      'scheduleDays',
      'artists',
      'ticketing',
      'venue',
      'venues',
      'food',
      'puja',
      'kids',
      'sponsorship',
      'vendors',
      'volunteer',
      'about',
      'gallery',
      'contacts',
      'social',
      'sections',
    ];
    for (const key of passthroughKeys) {
      if (patch[key] !== undefined) {
        (clean as Record<string, unknown>)[key] = sanitizeDeep(patch[key]);
      }
    }

    return this.dataHelper.update(year, clean);
  }

  async syncFromEvent(event: Event): Promise<void> {
    try {
      if (event.is_active_durga_puja_event !== true) return;
      const name = (event.event_name || '').toLowerCase();
      if (!/durga|durgotsav/.test(name)) return;

      const year = durgaPujaEventYear(event);
      await this.dataHelper.getOrCreate(year);

      const start = new Date(event.event_start_dt);
      const end = new Date(event.event_end_dt || event.event_start_dt);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

      const patch: Partial<DurgaPujaPageContent> = {
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
        datesText: formatDateRange(start, end),
        linkedEventId: event.event_id,
      };
      const location = (event.location || '').trim();
      if (location) {
        patch.venueName = location;
        patch.venueNote = 'See this page for the full schedule and ticket information.';
      }
      await this.dataHelper.update(year, patch);
    } catch (error) {
      console.error('Durga Puja page sync failed:', error);
    }
  }
}

const MAX_RICH_TEXT = 5000;
const MAX_ARRAY_LEN = 60;
const MAX_OBJECT_KEYS = 60;

/**
 * Recursively sanitize admin-supplied structured content: trim strings and cap
 * their length, cap array/object sizes, and drop values of unexpected types.
 * Keeps nesting shallow (depth-limited) to avoid pathological payloads.
 */
function sanitizeDeep(value: unknown, depth = 0): unknown {
  if (depth > 6) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > MAX_RICH_TEXT ? trimmed.slice(0, MAX_RICH_TEXT) : trimmed;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LEN)
      .map(v => sanitizeDeep(v, depth + 1))
      .filter(v => v !== undefined);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [k, v] of Object.entries(value)) {
      if (count >= MAX_OBJECT_KEYS) break;
      if (typeof k !== 'string' || k.length > 100) continue;
      const sanitized = sanitizeDeep(v, depth + 1);
      if (sanitized !== undefined) {
        out[k] = sanitized;
        count++;
      }
    }
    return out;
  }
  return undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
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
