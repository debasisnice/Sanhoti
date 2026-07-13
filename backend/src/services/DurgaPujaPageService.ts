import { DurgaPujaPageDataHelper } from '../data/DurgaPujaPageDataHelper.js';
import { DurgaPujaFaq, DurgaPujaPageContent } from '../models/types.js';

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
}
