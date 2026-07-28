/**
 * Seed event menus transcribed from the published Sanhoti event flyers.
 *
 *   npm run seed-event-menus            (from backend/)
 *   npm run seed-event-menus -- --force (overwrite menus already saved)
 *
 * Every dish below is copied verbatim from the flyer image in
 * backend/data/Events_Flyers — nothing is invented. Events whose flyer carries
 * no menu (Holiday Party, Phalaharini Kali Pujo, Pithe Puli Utsab) are
 * deliberately left alone rather than filled with plausible guesses.
 *
 * Durga Puja is not included: its menu lives on the Durga Puja page so there is
 * only one place to edit it.
 *
 * Idempotent — an event that already has a menu is skipped unless --force.
 */

import { EventDataHelper } from '../data/EventDataHelper.js';
import type { EventMenu } from '../models/types.js';

const VEG = '#1E6B34';
const NONVEG = '#DC2626';

interface Seed {
  eventId: string;
  label: string;
  /** Which flyer this was transcribed from, for future reference. */
  source: string;
  menu: EventMenu;
}

const SEEDS: Seed[] = [
  {
    eventId: 'AMSNCDMJ3QRW',
    label: 'Annual Picnic 2025',
    source: 'annual-picnic-AMSNCDMJ3QRW flyer — "Sanhoti Summer Picnic & Menu"',
    menu: {
      intro:
        'A full day of Bengali cooking at O’Neill Regional Park — breakfast on arrival, a proper rice-and-fish lunch through the afternoon, and ice cream to finish.',
      meals: [
        {
          name: 'Breakfast',
          hours: 'From 9:00 AM',
          categories: [{ label: 'Served', items: ['Luchi', 'Cholar Dal', 'Rabdi', 'Jalebi'] }],
        },
        {
          name: 'Lunch',
          description: 'Veg and non-veg options served side by side.',
          categories: [
            {
              label: 'Rice & sides',
              items: ['Rice', 'Ghee', 'Alu Bhaja', 'Chatni', 'Papad'],
            },
            {
              label: 'Non-Veg',
              items: [
                'Macher Matha Diye Dal',
                'Mach Bhaja',
                'Sorse Ilish',
                'Mutton Curry',
                'Chicken Curry',
              ],
              color: NONVEG,
            },
            {
              label: 'Veg',
              items: ['Veg Dal', 'Begun Bhaja', 'Paneer Masala', 'Dhokar Dalna'],
              color: VEG,
            },
            { label: 'Sweet', items: ['Sandesh'] },
          ],
        },
        {
          name: 'Drinks',
          categories: [{ label: 'Served all day', items: ['Tea', 'Soft Drinks', 'Mocktail'] }],
        },
        {
          name: 'Afternoon treat',
          categories: [{ label: 'Served', items: ['Ice Cream'] }],
        },
      ],
      vegetarian: 'Vegetarian alternatives are served alongside every non-veg dish.',
      allergyNotice: 'Tell us about any allergies in advance and we will do our best to accommodate.',
    },
  },
  {
    eventId: '39OAUSGN8P9M',
    label: 'Annual Picnic 2026',
    source: 'Sanhoti-Picnic-2026-39OAUSGN8P9M flyer — "Special Lunch Menu"',
    menu: {
      intro:
        'Live kitchen cooking through the afternoon at O’Neill Regional Park, Trabuco Canyon — welcome drinks on arrival and a full Bengali lunch.',
      meals: [
        {
          name: 'Welcome drinks',
          hours: 'On arrival',
          categories: [{ label: 'Served', items: ['Lassi', 'Mocktails'] }],
        },
        {
          name: 'Special Lunch Menu',
          hours: '12:00 PM – 4:00 PM',
          description: 'Cooked to order at the live kitchen.',
          categories: [
            { label: 'Rice & dal', items: ['Sada Bhaat', 'Ghee', 'Daal'] },
            {
              label: 'Non-Veg',
              items: ['Maach Bhaja', 'Alu Potol Chingri', 'Shorshe Ilish', 'Methi Chicken'],
              color: NONVEG,
            },
            {
              label: 'Veg',
              items: ['Begun Bhaja', 'Alu Potol Veg', 'Echor’er Torkari', 'Matar Paneer'],
              color: VEG,
            },
            {
              label: 'Sides & sweets',
              items: ['Aam’er Chutney', 'Papad Bhaja', 'Mishti Doi', 'Ice Cream'],
            },
          ],
        },
      ],
      vegetarian: 'A full vegetarian line-up runs alongside the non-veg dishes.',
      kidsMenu: 'Kids $15 · free for children under 5.',
      allergyNotice: 'Tell us about any allergies in advance and we will do our best to accommodate.',
    },
  },
  {
    eventId: 'UTO23AFRMNCV',
    label: 'Baisakhi 2026 (Poila Boishakh)',
    source: 'Sanhoti-Baisakhi-2026-UTO23AFRMNCV flyer — Veg / Non-Veg menu panel',
    menu: {
      intro:
        'A Bengali New Year dinner at the Norman P. Murray Community & Senior Center, Mission Viejo — served alongside the cultural programme.',
      meals: [
        {
          name: 'Nobo Borsho Dinner',
          hours: '5:00 PM – 10:00 PM',
          description: 'Choose the veg or non-veg thali. A special mocktail is served to everyone.',
          categories: [
            {
              label: 'Veg',
              items: [
                'Veg Momo',
                'Kaju Kishmish Pulao',
                'Naan',
                'Daal Makhani',
                'Paneer Lababdar',
                'Malpoa',
              ],
              color: VEG,
            },
            {
              label: 'Non-Veg',
              items: [
                'Chicken Momo',
                'Kaju Kishmish Pulao',
                'Naan',
                'Chicken Rezala',
                'Chingri Malaikari',
                'Malpoa',
              ],
              color: NONVEG,
            },
            { label: 'Drinks', items: ['Special Mocktail'] },
          ],
        },
      ],
      vegetarian: 'A complete vegetarian thali is available — no substitutions needed.',
      kidsMenu: 'Kids aged 5–12 $15.',
      allergyNotice: 'Tell us about any allergies in advance and we will do our best to accommodate.',
    },
  },
  {
    eventId: 'WJWYE0NC4IIY',
    label: 'Saraswati Puja 2026',
    source: 'saraswati-puja-WJWYE0NC4IIY flyer — LUNCH and DINNER badges',
    // The flyer promises "a very Special Food Menu" and shows LUNCH and DINNER
    // badges, but lists no dishes. The two services are recorded here; the
    // dishes are left blank rather than guessed.
    menu: {
      intro:
        'Both lunch and dinner are served on Saraswati Puja day at Davis Magnet School, Costa Mesa, around pushpanjali and the cultural programme.',
      meals: [
        {
          name: 'Lunch',
          description: 'Served after pushpanjali. [Add the dishes when the menu is confirmed.]',
        },
        {
          name: 'Dinner',
          description: 'Served after the cultural programme. [Add the dishes when the menu is confirmed.]',
        },
      ],
      kidsMenu: 'Free for children under 12.',
    },
  },
];

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const helper = new EventDataHelper();
  let applied = 0;
  let skipped = 0;
  let missing = 0;

  for (const seed of SEEDS) {
    const event = await helper.findById(seed.eventId);
    if (!event) {
      console.log(`  ✗ ${seed.label} — no event with id ${seed.eventId}`);
      missing++;
      continue;
    }

    const hasMenu = (event.menu?.meals ?? []).some(m => m?.name?.trim());
    if (hasMenu && !force) {
      console.log(`  skipped  ${seed.label} — already has a menu (use --force to overwrite)`);
      skipped++;
      continue;
    }

    await helper.update(seed.eventId, { menu: seed.menu });
    const dishes = (seed.menu.meals ?? []).reduce(
      (n, m) => n + (m.categories ?? []).reduce((c, cat) => c + (cat.items?.length ?? 0), 0),
      0
    );
    console.log(
      `  seeded   ${seed.label} — ${seed.menu.meals?.length ?? 0} meal(s), ${dishes} dish(es)`
    );
    console.log(`             from ${seed.source}`);
    applied++;
  }

  console.log(`\nDone. ${applied} seeded, ${skipped} skipped, ${missing} not found.`);
  console.log('\nNot seeded — their flyers carry no menu, so nothing was invented:');
  console.log('  · Holiday Party 2025 (flyer says only "dinner, drinks, dance and DJ")');
  console.log('  · Pithe Puli Utsab 2026 (flyer says "More details soon…")');
  console.log('  · Phalaharini Kali Pujo 2026 (no food on the flyer)');
  console.log('  · Durga Puja — its menu lives on Admin → Durga Puja Page → Food');
}

main().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
