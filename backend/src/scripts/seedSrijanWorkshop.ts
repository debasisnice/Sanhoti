/**
 * Seed the Srijan workshop event (Indian arts — painting).
 * Idempotent: skips if an active event named "Srijan" already exists.
 *
 * Run: npm run seed-srijan
 */
import { EventService } from '../services/EventService.js';

const SRIJAN_DESCRIPTION = `Srijan is Sanhoti Bengali Association's year-long workshop initiative inviting people across Orange County and Southern California to explore Indian arts — with a special focus on painting.

The program began on January 1, 2026, welcoming participants of every skill level — from first-time painters to experienced artists — to learn techniques rooted in India's visual traditions while finding their own creative voice.

Throughout the year, Sanhoti hosts guided sessions, studio meetups, and community critique circles where participants share progress, exchange ideas, and build friendships around art. Whether you grew up with rangoli and alpana at home or are discovering Indian art for the first time, Srijan is a welcoming space to create together.

The journey culminates in October 2026 with a public exhibition showcasing works from every participant — a celebration of creativity, culture, and the spirit of srijana (creation) that gives the program its name.

Srijan reflects Sanhoti's broader mission: celebrating Bengali and Indian heritage while opening our doors to everyone in the Orange County community who wants to learn, create, and connect.`;

async function main(): Promise<void> {
  const service = new EventService();
  const all = await service.getAllEvents();
  const existing = all.find(
    (e) => e.event_name.trim().toLowerCase() === 'srijan' && e.is_active !== false
  );

  if (existing) {
    console.log(`  skipped  Srijan — event ${existing.event_id} already exists`);
    console.log('\nDone. 0 created, 1 skipped.');
    return;
  }

  const saved = await service.createEvent({
    event_name: 'Srijan',
    event_start_dt: '2026-01-01',
    event_end_dt: '2026-10-18',
    year: 2026,
    event_description: SRIJAN_DESCRIPTION,
    event_type: 'Workshop',
    workshop_theme: 'Indian arts — painting',
    workshop_program_start_dt: '2026-01-01',
    workshop_exhibition_dt: '2026-10-18',
    location: 'Orange County, CA (Rancho Santa Margarita area)',
    venue_city: 'Rancho Santa Margarita',
    venue_region: 'CA',
    is_priority: true,
    rsvp_enabled: false,
    event_status: 'Scheduled',
    meta_title: 'Srijan — Indian Art & Painting Workshop | Sanhoti, Orange County',
    meta_description:
      'Join Srijan, Sanhoti\'s year-long Indian arts workshop in Orange County. Painting sessions from January 2026, culminating in a public exhibition in October 2026.',
    image_alt:
      'Srijan Indian art and painting workshop by Sanhoti Bengali Association in Orange County, California',
    faqs: [
      {
        question: 'What is Srijan?',
        answer:
          'Srijan is Sanhoti Bengali Association\'s year-long workshop program focused on Indian arts, especially painting. Participants create throughout the year and showcase their work at a public exhibition in October 2026.',
      },
      {
        question: 'Do I need painting experience to join Srijan?',
        answer:
          'No. Srijan welcomes beginners and experienced artists alike. Sessions are designed for every skill level across Orange County and Southern California.',
      },
      {
        question: 'When is the Srijan exhibition?',
        answer:
          'The culminating exhibition of participant artwork is planned for October 2026. Program sessions run from January 1, 2026 through the exhibition date.',
      },
      {
        question: 'How do I get involved with Srijan?',
        answer:
          'Contact Sanhoti at info@sanhoti.org or watch this event page for registration details and upcoming session dates.',
      },
    ],
  });

  console.log(`  created  Srijan — event ${saved.event_id}`);
  console.log('\nDone. 1 created, 0 skipped.');
  console.log('Next: upload a flyer in Admin → Events, then link a gallery when photos are available.');
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
