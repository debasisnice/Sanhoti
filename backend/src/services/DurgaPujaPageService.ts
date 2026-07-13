import { DurgaPujaPageDataHelper } from '../data/DurgaPujaPageDataHelper.js';
import { DurgaPujaFaq, DurgaPujaPageContent, Event } from '../models/types.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 2000;
const MAX_FAQS = 12;

export class DurgaPujaPageService {
  private dataHelper: DurgaPujaPageDataHelper;

  constructor() {
    this.dataHelper = new DurgaPujaPageDataHelper();
  }

  async getContent(): Promise<DurgaPujaPageContent> {
    return this.dataHelper.get();
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

    return this.dataHelper.update(clean);
  }

  /**
   * Auto-sync the landing page's dates/venue from a Durga Puja event.
   * Called by EventService on event create/update. Guards:
   * - event name must contain "durga" or "durgotsav"
   * - event must not already be over (editing past years never regresses the page)
   * Only dates, venue name, and the linked event id are touched — intro,
   * FAQs, and venue city stay as the admin wrote them.
   */
  async syncFromEvent(event: Event): Promise<void> {
    try {
      const name = (event.event_name || '').toLowerCase();
      if (!/durga|durgotsav/.test(name)) return;

      const start = new Date(event.event_start_dt);
      const end = new Date(event.event_end_dt || event.event_start_dt);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
      if (end.getTime() < Date.now()) return; // past event — leave the page alone

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
