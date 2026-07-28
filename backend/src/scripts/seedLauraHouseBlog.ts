/**
 * Seed the Laura's House April 2026 charity blog post.
 *
 *   npm run seed-lauras-house-blog
 *   npm run seed-lauras-house-blog -- --cover /path/to/photo.png
 *
 * Idempotent: skips if slug `sanhoti-lauras-house-charity-2026` already exists.
 * Pass --force to replace the existing post (keeps the same blog_id).
 */

import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BlogService } from '../services/BlogService.js';
import { BlogDataHelper } from '../data/BlogDataHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const blogsDir = join(__dirname, '../../data/Blogs');

const SLUG = 'sanhoti-lauras-house-charity-2026';
const COVER_FILENAME = 'sanhoti-lauras-house-charity-2026-cover.png';

const BODY = `On a bright April morning in Aliso Viejo, a familiar purple sign welcomed us back: **Laura's House**.

Sanhoti Bengali Association returned to Laura's House on **April 4, 2026** — our second year partnering with one of Orange County's most vital domestic violence organizations. Volunteers from across Southern California gathered outside the Laura's House campus at **33 Journey, Suite 150** to give time, supplies, and solidarity to survivors and the staff who support them every day.

## Why Laura's House

Laura's House provides emergency shelter, counselling, legal advocacy, and prevention education to survivors of domestic abuse and their children across Orange County. The need is real, and the work is year-round.

For Sanhoti, showing up here is part of a wider promise: we are a Bengali cultural association, but we are also neighbours in Orange County. Festivals bring our community together; charity days remind us why that community exists in the first place.

## What our volunteers did

Members spent the morning **assembling care packages and donating supplies** — practical help that goes directly to families navigating crisis. Between sorting, packing, and loading, there was the easy conversation of people who have chosen to be present for someone else's hardest day.

The group photo in front of the building captures that spirit: adults and children, longtime members and first-time volunteers, all standing together under the Laura's House sign.

## A partnership, not a one-off

We first visited Laura's House in **July 2025**. Coming back in 2026 was deliberate. One afternoon of help matters; **sustained support** matters more. Returning lets our members build a relationship with the organisation and with the cause — and signals to survivors that they are not forgotten after the headlines move on.

This visit also opened Sanhoti's **2026 programme of community service**, alongside our ongoing hunger-relief work with Second Harvest Food Bank of Orange County.

## How you can help

Sanhoti is a registered **501(c)(3) non-profit** (EIN 39-2903777). A portion of every year's fundraising supports local causes — domestic violence survivor services, hunger relief, and community welfare.

- **Volunteer with Sanhoti** on future charity days — email [info@sanhoti.org](mailto:info@sanhoti.org)
- **Learn about Laura's House** at [laurashouse.org](https://laurashouse.org)
- **Support Sanhoti's work** through our [Donate](/donate) page
- **Read about the event** on our [Charity Event at Laura's House](/events/sanhoti-charity-event-at-laura-s-house-2026-ICA7X3EAN3W2) page

## Gratitude

Thank you to every Sanhoti member who gave a Saturday morning, to the families who brought children along to learn what service looks like, and to the team at Laura's House for trusting us with their mission.

*Together we are making a difference — one care package, one conversation, one community at a time.*
`;

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const coverArgIdx = process.argv.indexOf('--cover');
  const coverSrc =
    coverArgIdx >= 0 && process.argv[coverArgIdx + 1]
      ? process.argv[coverArgIdx + 1]
      : undefined;

  if (!existsSync(blogsDir)) mkdirSync(blogsDir, { recursive: true });

  const helper = new BlogDataHelper();
  const service = new BlogService();
  const existing = (await helper.findAll()).find(b => b.slug === SLUG);

  if (existing && !force) {
    console.log(`Blog already exists: /blogs/${SLUG} (${existing.blog_id})`);
    console.log('Use --force to replace content and cover.');
    return;
  }

  let coverPath: string | undefined;
  if (coverSrc) {
    if (!existsSync(coverSrc)) {
      console.error(`Cover image not found: ${coverSrc}`);
      process.exit(1);
    }
    const dest = join(blogsDir, COVER_FILENAME);
    copyFileSync(coverSrc, dest);
    coverPath = COVER_FILENAME;
    console.log(`Cover copied → data/Blogs/${COVER_FILENAME}`);
  } else if (existsSync(join(blogsDir, COVER_FILENAME))) {
    coverPath = COVER_FILENAME;
    console.log(`Using existing cover data/Blogs/${COVER_FILENAME}`);
  }

  const payload = {
    slug: SLUG,
    title: "Returning to Laura's House: Sanhoti's 2026 Charity Day in Aliso Viejo",
    body: BODY,
    excerpt:
      "Sanhoti volunteers gathered at Laura's House in Aliso Viejo in April 2026 — assembling care packages and standing with one of Orange County's leading domestic violence support organizations.",
    author_name: 'Sanhoti Bengali Association',
    cover_image_path: coverPath,
    cover_image_alt:
      "Sanhoti volunteers posing together in front of Laura's House in Aliso Viejo, Orange County, California, April 2026",
    tags: 'charity, community service, Laura\'s House, Orange County, domestic violence support',
    published_at: '2026-04-04T18:00:00.000Z',
    meta_title: "Laura's House Charity 2026 | Sanhoti Blog, Orange County",
    meta_description:
      "Sanhoti returned to Laura's House in Aliso Viejo in April 2026 — care packages, supplies, and community support for domestic violence survivors in Orange County.",
    is_published: true,
    is_active: true,
    is_featured: true,
  };

  if (existing && force) {
    await helper.update(existing.blog_id, payload);
    console.log(`Updated blog /blogs/${SLUG}`);
  } else {
    const blog = await service.createBlog(payload);
    console.log(`Created blog /blogs/${blog.slug} (${blog.blog_id})`);
  }
}

main().catch(err => {
  console.error('Failed to seed Laura\'s House blog:', err);
  process.exit(1);
});
