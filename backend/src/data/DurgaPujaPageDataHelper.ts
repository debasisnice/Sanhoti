import { DatabaseHelper } from './DatabaseHelper.js';
import { DurgaPujaPageContent } from '../models/types.js';

const FILENAME = 'durgaPujaPage.json';

export function getDefaultDurgaPujaPageContent(): DurgaPujaPageContent {
  const year = new Date().getFullYear();
  return {
    intro:
      "Sanhoti Bengali Association hosts one of Orange County's most vibrant Durga Puja (Durgotsav) celebrations — three days of puja, pushpanjali, dhunuchi naach, Bengali food, and evening cultural concerts. Our Durgotsav 2025 was celebrated in Costa Mesa, CA, minutes from Irvine, Newport Beach, and Huntington Beach, welcoming Bengali and Indian families from across Southern California.",
    datesText: `October 16–21, ${year} (Shashthi through Vijayadashami)`,
    startDate: `${year}-10-16`,
    endDate: `${year}-10-21`,
    venueName: 'Venue to be announced — Orange County, CA',
    venueCity: 'Costa Mesa',
    venueNote: 'Schedule and venue will be announced on our Events page.',
    faqs: [
      {
        question: 'Where is Durga Puja celebrated in Orange County?',
        answer:
          "Sanhoti Bengali Association hosts Durga Puja in central Orange County (2025: Costa Mesa, CA), an easy drive from Irvine, Tustin, Santa Ana, Anaheim, and Mission Viejo.",
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
        question: `When is Durga Puja in ${year}?`,
        answer: `Durga Puja ${year} runs October 16–21. Sanhoti's celebration schedule will be announced on our Events page.`,
      },
    ],
    updated_at: new Date().toISOString(),
  };
}

export class DurgaPujaPageDataHelper extends DatabaseHelper {
  async get(): Promise<DurgaPujaPageContent> {
    const rows = await this.readFile<DurgaPujaPageContent>(FILENAME);
    if (!rows || rows.length === 0) {
      return getDefaultDurgaPujaPageContent();
    }
    // Merge over defaults so newly added fields always have values
    return { ...getDefaultDurgaPujaPageContent(), ...rows[0] };
  }

  async update(patch: Partial<DurgaPujaPageContent>): Promise<DurgaPujaPageContent> {
    const current = await this.get();
    const updated: DurgaPujaPageContent = {
      ...current,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    await this.writeFile<DurgaPujaPageContent>(FILENAME, [updated]);
    return updated;
  }
}
