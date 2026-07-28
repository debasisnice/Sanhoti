/**
 * Seed the five artists who have performed at Sanhoti events.
 *
 *   npm run seed-artists            (from backend/)
 *
 * Idempotent: an artist whose slug already exists is skipped, so it is safe to
 * re-run. Content matches docs/Sanhoti_Events_Content_Workbook.docx.
 *
 * Photos are NOT seeded — upload those in Admin → Artists afterwards.
 */

import { ArtistService } from '../services/ArtistService.js';
import type { Artist } from '../models/types.js';

type SeedArtist = Omit<Artist, 'artist_id' | 'created_at' | 'updated_at'>;

const ARTISTS: SeedArtist[] = [
  {
    slug: 'akriti-kakar',
    name: 'Akriti Kakar',
    alternate_names: 'Akriti Kakkar, Aakriti Kakar, Akruti Kakar',
    artist_type: 'Person',
    roles: 'Playback Singer, Composer',
    genres: 'Bollywood, Playback, Pop',
    origin: 'Delhi, India',
    short_bio:
      'Indian playback singer and composer known for Bollywood hits including "Saturday Saturday" and "Iski Uski".',
    bio: [
      'Akriti Kakar is an Indian playback singer and composer who has been recording professionally since 2000. She is best known for the chart-topping Bollywood tracks "Saturday Saturday" from Humpty Sharma Ki Dulhania and "Iski Uski" from 2 States.',
      'She released her solo album, Akriti, with Sony Music India in April 2010, with compositions by Shankar Mahadevan and by Akriti herself. She has also worked extensively in television, serving as a judge on Zee Bangla\'s Sa Re Ga Ma Pa Li\'l Champs and appearing on Colors TV\'s Jhalak Dikhhla Jaa.',
      'Akriti comes from a family of playback singers — her twin sisters Sukriti and Prakriti Kakar are also established artists in the Indian music industry.',
      'She performs at Sanhoti Durga Puja 2026 in Costa Mesa, Orange County, on Saturday 10 October 2026.',
    ].join('\n\n'),
    wikipedia_url: 'https://en.wikipedia.org/wiki/Akriti_Kakar',
    social_links: [{ label: 'IMDb', url: 'https://www.imdb.com/name/nm2277816/' }],
    image_alt:
      'Bollywood playback singer Akriti Kakar performing live at Sanhoti Durga Puja, Costa Mesa, Orange County, California',
    is_active: true,
    is_featured: true,
  },
  {
    slug: 'subhadeep-das-chowdhury',
    name: 'Subhadeep Das Chowdhury',
    alternate_names: 'Subhadeep Das Chowdhary, Subhodeep Das Chowdhury, Subhadeep Das',
    artist_type: 'Person',
    roles: 'Singer, Composer, Music Teacher',
    genres: 'Bengali, Bollywood, Indian Classical, Rock',
    origin: 'Kolkata, West Bengal, India',
    short_bio:
      'Bengali singer from Kolkata, runner-up of Indian Idol season 14 and winner of Super Singer season 4.',
    bio: [
      'Subhadeep Das Chowdhury is an Indian singer, composer and performer from Kolkata, West Bengal. He was the runner-up of Indian Idol season 14, and earlier won Super Singer season 4, the Bengali singing reality show. He was also among the fifteen contestants selected for Indian Idol season 11 in 2019.',
      'Classically trained, Subhadeep taught classical music in Kolkata as a music trainer before national television brought him wider recognition. That grounding shapes his performances: a genuine classical foundation combined with rock versatility and the soulful delivery he became known for on Indian Idol.',
      'His repertoire spans Bengali and Hindi music, from Bollywood classics and high-energy anthems to quieter melodic material.',
      'He performs at Sanhoti Durga Puja 2026 in Costa Mesa, Orange County, on Friday 9 October 2026.',
    ].join('\n\n'),
    social_links: [
      { label: 'Instagram', url: 'https://www.instagram.com/subhadeepdas_official/' },
      { label: 'Facebook', url: 'https://www.facebook.com/subhadeepdaschowdhury/' },
    ],
    image_alt:
      'Singer Subhadeep Das Chowdhury performing live at Sanhoti Durga Puja, Costa Mesa, Orange County, California',
    is_active: true,
    is_featured: true,
  },
  {
    slug: 'mahalakshmi-iyer',
    name: 'Mahalakshmi Iyer',
    alternate_names: 'Mahalaxmi Iyer, Maha Lakshmi Iyer',
    artist_type: 'Person',
    roles: 'Playback Singer',
    genres: 'Bollywood, Playback, Indian Classical',
    origin: 'Mumbai, India',
    short_bio:
      'Indian playback singer known for "Ae Ajnabee" from Dil Se and work with A. R. Rahman and Shankar–Ehsaan–Loy.',
    bio: [
      'Mahalakshmi Iyer is an Indian playback singer, born 11 July 1976, best known for her Hindi, Assamese and Tamil recordings. She has also sung in Telugu, Marathi, Bengali, Odia, Gujarati and Kannada.',
      'Her first released work as a playback singer was "Ae Ajnabee", sung with Udit Narayan for A. R. Rahman in Mani Ratnam\'s Dil Se. She went on to record extensively for Rahman and for Shankar–Ehsaan–Loy, appearing on many of the biggest Yash Raj productions of the period — Bunty Aur Babli, Salaam Namaste, Fanaa, Dhoom 2, Ta Ra Rum Pum and Jhoom Barabar Jhoom among them.',
      'She performed at Sanhoti Durga Puja 2025 in Costa Mesa, Orange County.',
    ].join('\n\n'),
    wikipedia_url: 'https://en.wikipedia.org/wiki/Mahalakshmi_Iyer',
    social_links: [],
    image_alt:
      'Playback singer Mahalakshmi Iyer performing live at Sanhoti Durga Puja 2025, Costa Mesa, Orange County, California',
    is_active: true,
    is_featured: false,
  },
  {
    slug: 'rathijit-bhattacharjee',
    name: 'Rathijit Bhattacharjee',
    alternate_names: 'Rathijit Bhattacharya, Ratijit Bhattacharjee',
    artist_type: 'Person',
    roles: 'Singer, Composer, Music Director, Lyricist',
    genres: 'Bengali, Adhunik, Film Music',
    origin: 'Badarpur, Assam, India',
    short_bio:
      'Bengali singer, composer and music director known for "Kishori", "Radharani" and the Raghu Dakat soundtrack.',
    bio: [
      'Rathijit Bhattacharjee is a singer, lyricist, composer, music director and sound designer working in the Bengali film industry. Born on 22 May in Badarpur, Assam, he gave his first stage performance at the age of four.',
      'His well-known songs include "Kishori", "Radharani", "Royal Fighter", "Baba" and "Mayabi". He co-composed the soundtrack for the 2025 Bengali-language period action-adventure film Raghu Dakat alongside Nilayan Chatterjee.',
      'He performed at Sanhoti Durga Puja 2025 in Costa Mesa, Orange County, alongside Shreya M Bhattacharjee.',
    ].join('\n\n'),
    social_links: [
      { label: 'Instagram', url: 'https://www.instagram.com/rathijit.bhattacharjee/' },
      { label: 'Facebook', url: 'https://www.facebook.com/Rathijitbhattacharjee/' },
    ],
    image_alt:
      'Bengali singer and composer Rathijit Bhattacharjee performing live at Sanhoti Durga Puja 2025, Costa Mesa, California',
    is_active: true,
    is_featured: false,
  },
  {
    slug: 'shreya-m-bhattacharjee',
    name: 'Shreya M Bhattacharjee',
    alternate_names: 'Shreya Bhattacharjee, Shreya Bhattacharya',
    artist_type: 'Person',
    roles: 'Singer',
    genres: 'Bengali, Adhunik',
    short_bio: 'Bengali singer who performs alongside Rathijit Bhattacharjee.',
    // Deliberately short: no reliable published biography was found for Shreya.
    // Fill this in from a source you trust rather than leaving invented detail.
    bio: [
      'Shreya M Bhattacharjee is a Bengali singer who performs alongside composer and music director Rathijit Bhattacharjee as a musical duo.',
      'She performed at Sanhoti Durga Puja 2025 in Costa Mesa, Orange County.',
    ].join('\n\n'),
    social_links: [],
    image_alt:
      'Bengali singer Shreya M Bhattacharjee performing live at Sanhoti Durga Puja 2025, Costa Mesa, California',
    is_active: true,
    is_featured: false,
  },
];

async function main(): Promise<void> {
  const service = new ArtistService();
  let created = 0;
  let skipped = 0;

  for (const artist of ARTISTS) {
    const existing = await service.getArtistBySlug(artist.slug);
    if (existing) {
      console.log(`  skipped  ${artist.name} — /artists/${existing.slug} already exists`);
      skipped++;
      continue;
    }
    const saved = await service.createArtist(artist);
    console.log(`  created  ${saved.name} — /artists/${saved.slug}`);
    created++;
  }

  console.log(`\nDone. ${created} created, ${skipped} skipped.`);
  if (created > 0) {
    console.log('Next: upload a photo for each in Admin → Artists, then link them to');
    console.log('their concerts via the "Performing artists" picker on the sub-event form.');
  }
}

main().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
