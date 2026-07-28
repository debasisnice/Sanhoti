/**
 * Apply the Part 2 values from docs/Sanhoti_Event_Content_Workbook.docx to the
 * event, sub-event and artist data.
 *
 *   npm run apply-workbook -- --dry-run    (show what would change, write nothing)
 *   npm run apply-workbook                 (apply)
 *
 * The values live in workbookData.json, generated from the same source as the
 * document, so the two cannot drift.
 *
 * Safe by design:
 *   · a timestamped backup of every file it touches is written first
 *   · placeholder venue values (containing "[") are never written to a public field
 *   · records the workbook does not mention are left completely untouched
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Artist, Event, SeoFaq, SubEvent } from '../models/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA = join(__dirname, '../../data');

interface RecordPatch {
  delete?: boolean;
  event_description?: string;
  image_alt?: string;
  venue_name?: string;
  venue_street?: string;
  venue_city?: string;
  venue_region?: string;
  venue_postal?: string;
  meta_title?: string;
  meta_description?: string;
  faqs?: SeoFaq[];
  /** Artist slugs to link; resolved to artist_ids at apply time. */
  artistSlugs?: string[];
  /** Field-level corrections beyond the standard set (renames, bad locations). */
  fixes?: Record<string, unknown>;
}

interface Payload {
  records: Record<string, RecordPatch>;
  artists: Array<{
    name: string; type: string; slug: string; alt: string; roles: string;
    genres: string; origin: string; wiki: string; social: string;
    shortBio: string; bio: string; imageAlt: string; featured: string;
  }>;
}

const payload: Payload = JSON.parse(
  readFileSync(join(__dirname, 'workbookData.json'), 'utf-8')
);

const dryRun = process.argv.includes('--dry-run');
const changes: string[] = [];
const warnings: string[] = [];

function loadJson<T>(file: string): T[] {
  const p = join(DATA, file);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf-8')) as T[]) : [];
}

function backupAndWrite<T>(file: string, data: T[], stamp: string): void {
  const p = join(DATA, file);
  if (dryRun) return;
  const backupDir = join(DATA, '_workbook-backup');
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  if (existsSync(p)) copyFileSync(p, join(backupDir, `${file}.${stamp}`));
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

/** A value containing "[" is an unresolved placeholder and must not go public. */
const isPlaceholder = (v: unknown): boolean => typeof v === 'string' && v.includes('[');

function applyPatch(
  target: Record<string, unknown>,
  patch: RecordPatch,
  label: string,
  descField: 'event_description'
): void {
  const set = (key: string, value: unknown) => {
    if (value === undefined || value === '') return;
    if (isPlaceholder(value) && key.startsWith('venue_')) {
      warnings.push(`${label}: skipped ${key} — still a placeholder`);
      return;
    }
    if (target[key] !== value) {
      target[key] = value;
      changes.push(`  ${label} · ${key}`);
    }
  };

  set(descField, patch.event_description);
  set('image_alt', patch.image_alt);
  set('venue_name', patch.venue_name);
  set('venue_street', patch.venue_street);
  set('venue_city', patch.venue_city);
  set('venue_region', patch.venue_region);
  set('venue_postal', patch.venue_postal);
  set('meta_title', patch.meta_title);
  set('meta_description', patch.meta_description);

  if (patch.faqs?.length) {
    // FAQs are rendered on the page *and* emitted as FAQPage structured data,
    // so an unresolved placeholder here reaches Google. Only event_description
    // used to be checked, which meant a bracketed FAQ answer was published with
    // no warning at all.
    const unresolved = patch.faqs.filter(
      f => isPlaceholder(f.question) || isPlaceholder(f.answer)
    );
    if (unresolved.length) {
      warnings.push(
        `${label}: ${unresolved.length} FAQ(s) still contain [placeholders] — SKIPPED, fix before publishing`
      );
    } else {
      target.faqs = patch.faqs;
      changes.push(`  ${label} · faqs (${patch.faqs.length})`);
    }
  }

  // Corrections: renames, malformed locations, wrong performer types. An empty
  // string here is meaningful (it clears a field), so it bypasses the set() guard.
  for (const [k, v] of Object.entries(patch.fixes ?? {})) {
    if (target[k] !== v) {
      target[k] = v;
      changes.push(`  ${label} · ${k} → ${JSON.stringify(v)}`);
    }
  }

  if (isPlaceholder(patch.event_description)) {
    warnings.push(`${label}: description still contains [placeholders] — edit before publishing`);
  }
}

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  console.log(dryRun ? 'DRY RUN — nothing will be written\n' : 'Applying workbook values\n');

  // ---- artists first: events link to them by id ----
  const artists = loadJson<Artist>('artists.json');
  const bySlug = new Map(artists.map(a => [a.slug, a]));
  for (const a of payload.artists) {
    const existing = bySlug.get(a.slug);
    if (!existing) {
      warnings.push(`artist "${a.name}" not found — run "npm run seed-artists" first`);
      continue;
    }
    const before = JSON.stringify(existing);
    existing.alternate_names = a.alt;
    existing.roles = a.roles;
    existing.genres = a.genres;
    if (!isPlaceholder(a.origin)) existing.origin = a.origin;
    // A bio is published as the biography of a real, named person. An unresolved
    // placeholder here would put an internal note on their public page, so these
    // are skipped rather than written — same rule as origin.
    if (!isPlaceholder(a.shortBio)) existing.short_bio = a.shortBio;
    else warnings.push(`artist "${a.name}": short bio still contains [placeholders] — skipped`);
    if (!isPlaceholder(a.bio)) existing.bio = a.bio;
    else warnings.push(`artist "${a.name}": bio still contains [placeholders] — skipped`);
    existing.image_alt = a.imageAlt;
    existing.is_featured = a.featured.toLowerCase() === 'yes';
    // Only store a real URL — the workbook uses prose where none exists.
    if (/^https?:\/\//i.test(a.wiki)) existing.wikipedia_url = a.wiki;
    existing.updated_at = new Date().toISOString();
    if (JSON.stringify(existing) !== before) changes.push(`  artist · ${a.name}`);
  }
  backupAndWrite('artists.json', artists, stamp);

  const slugToId = new Map(artists.map(a => [a.slug, a.artist_id]));

  // ---- events ----
  const events = loadJson<Event>('events.json');
  const kept: Event[] = [];
  for (const e of events) {
    const patch = payload.records[e.event_id];
    if (patch?.delete) {
      changes.push(`  DELETED event · ${e.event_name} (${e.event_id})`);
      continue;
    }
    if (patch) {
      applyPatch(e as unknown as Record<string, unknown>, patch, e.event_name, 'event_description');
      if (patch.artistSlugs?.length) {
        const ids = patch.artistSlugs.map(s => slugToId.get(s)).filter((x): x is string => !!x);
        if (ids.length) { e.artist_ids = ids; changes.push(`  ${e.event_name} · artist_ids (${ids.length})`); }
      }
      e.updated_at = new Date().toISOString();
    }
    kept.push(e);
  }
  backupAndWrite('events.json', kept, stamp);

  // ---- sub-events ----
  const subs = loadJson<SubEvent>('subEvents.json');
  for (const s of subs) {
    const patch = payload.records[s.sub_event_id];
    if (!patch || patch.delete) continue;
    applyPatch(s as unknown as Record<string, unknown>, patch, s.sub_event_name, 'event_description');
    if (patch.artistSlugs?.length) {
      const ids = patch.artistSlugs.map(x => slugToId.get(x)).filter((x): x is string => !!x);
      if (ids.length) { s.artist_ids = ids; changes.push(`  ${s.sub_event_name} · artist_ids (${ids.length})`); }
    }
    s.updated_at = new Date().toISOString();
  }
  backupAndWrite('subEvents.json', subs, stamp);

  // ---- report ----
  console.log(`${changes.length} field change${changes.length === 1 ? '' : 's'}:`);
  for (const c of changes) console.log(c);

  if (warnings.length) {
    console.log(`\n${warnings.length} thing${warnings.length === 1 ? '' : 's'} needing your attention:`);
    for (const w of warnings) console.log(`  ! ${w}`);
  }

  console.log(
    dryRun
      ? '\nDry run complete — nothing written. Re-run without --dry-run to apply.'
      : `\nApplied. Backups in backend/data/_workbook-backup/ (stamp ${stamp}).`
  );
}

main().catch(err => {
  console.error('Failed to apply workbook:', err);
  process.exit(1);
});
