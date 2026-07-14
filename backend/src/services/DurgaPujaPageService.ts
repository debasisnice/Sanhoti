import { DurgaPujaPageDataHelper } from '../data/DurgaPujaPageDataHelper.js';
import { EventDataHelper } from '../data/EventDataHelper.js';
import { DurgaPujaFaq, DurgaPujaPageContent, Event, TicketLink } from '../models/types.js';

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

  async getContent(): Promise<DurgaPujaPageContent> {
    let content = await this.dataHelper.get();
    // One-time migration/backfill: ensure some Durga event carries the
    // "Active Durga Puja Event" flag (events created before the flag existed
    // won't have it). Prefer the already-linked event, then the next upcoming
    // Durga event. The flagged event is what feeds this page from then on.
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

  async updateContent(patch: Partial<DurgaPujaPageContent>): Promise<DurgaPujaPageContent> {
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
    const start = clean.startDate ?? (await this.dataHelper.get()).startDate;
    const end = clean.endDate ?? (await this.dataHelper.get()).endDate;
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
        if (!label && !url) continue; // skip empty rows from the admin form
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

    return this.dataHelper.update(clean);
  }

  /**
   * Auto-sync the landing page's dates/venue from the Active Durga Puja Event.
   * Called by EventService on event create/update. Guards:
   * - event must carry the is_active_durga_puja_event flag (the admin's
   *   explicit choice of which event feeds this page)
   * - event name must contain "durga" or "durgotsav" (safety net)
   * Only dates, venue name, and the linked event id are touched — intro,
   * FAQs, venue city, and ticket links stay as the admin wrote them.
   */
  async syncFromEvent(event: Event): Promise<void> {
    try {
      if (event.is_active_durga_puja_event !== true) return;
      const name = (event.event_name || '').toLowerCase();
      if (!/durga|durgotsav/.test(name)) return;

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
        patch.venueNote = 'See the event page for the full schedule and RSVP.';
      }
      await this.dataHelper.update(patch);
    } catch (error) {
      // Never let page sync break event creation
      console.error('Durga Puja page sync failed:', error);
    }
  }
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
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); // yyyy-mm-dd
}

/** "October 16–21, 2026" or "September 26 – October 1, 2026". */
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
