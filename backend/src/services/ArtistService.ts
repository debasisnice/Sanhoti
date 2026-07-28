import { ArtistDataHelper } from '../data/ArtistDataHelper.js';
import { EventService } from './EventService.js';
import { SubEventService } from './SubEventService.js';
import { Artist, Event, SubEvent } from '../models/types.js';

/** URL-safe slug from a display name: "Akriti Kakar" -> "akriti-kakar". */
export function slugifyArtistName(name: string | undefined | null): string {
  if (!name) return '';
  return String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .trim()
    .replace(/[\s-]+/g, '-')
    .toLowerCase()
    .slice(0, 70)
    .replace(/^-+|-+$/g, '');
}

/** Every event and sub-event an artist has appeared in, split by time. */
export interface ArtistAppearances {
  upcoming: Array<{ kind: 'event' | 'sub-event'; event: Event | SubEvent }>;
  past: Array<{ kind: 'event' | 'sub-event'; event: Event | SubEvent }>;
}

/** A performer name found on an event that has no Artist record yet. */
export interface ArtistSuggestion {
  /** The performer name as typed by the admin, cleaned of separators. */
  name: string;
  /** Slug this would get — shown so a typo is caught before the URL is minted. */
  proposedSlug: string;
  /** Where the name was found, so the admin can sanity-check before creating. */
  sources: Array<{ kind: 'event' | 'sub-event'; id: string; title: string }>;
  /**
   * True when the source record types this performer as a MusicGroup. Solo
   * artists are frequently mis-typed this way, and publishing a singer as a
   * band undermines the artist-name searches these pages exist to win.
   */
  flaggedAsMusicGroup: boolean;
}

/**
 * Separators used when an admin lists several performers in one free-text
 * field ("Rathijit Bhattacharjee and Shreya M Bhattacharjee", "A, B & C").
 * Splitting on these keeps one Artist record per actual person.
 */
const PERFORMER_SEPARATORS = /\s*(?:,|&|\+|\/|\band\b|\bwith\b|\bfeaturing\b|\bfeat\.?\b|\bft\.?\b)\s*/gi;

/** Normalise a name for comparison: casefold, strip punctuation, collapse spaces. */
function normalizeName(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a free-text performer field into individual performer names. */
export function splitPerformerNames(raw: string | undefined | null): string[] {
  return String(raw ?? '')
    .split(PERFORMER_SEPARATORS)
    .map(s => s.trim().replace(/^[-–—]+|[-–—]+$/g, '').trim())
    // Two characters is below the length of any real stage name and filters
    // out fragments left behind by unusual punctuation.
    .filter(s => s.length > 2);
}

export class ArtistService {
  private artistDataHelper: ArtistDataHelper;
  private eventService: EventService;
  private subEventService: SubEventService;

  constructor() {
    this.artistDataHelper = new ArtistDataHelper();
    this.eventService = new EventService();
    this.subEventService = new SubEventService();
  }

  async getAllArtists(): Promise<Artist[]> {
    return this.artistDataHelper.findAll();
  }

  async getActiveArtists(): Promise<Artist[]> {
    return this.artistDataHelper.findActive();
  }

  async getArtistById(id: string): Promise<Artist | null> {
    return this.artistDataHelper.findById(id);
  }

  async getArtistBySlug(slug: string): Promise<Artist | null> {
    return this.artistDataHelper.findBySlug(slug);
  }

  /** Resolve several artist ids at once, preserving the caller's order. */
  async getArtistsByIds(ids: string[] | undefined): Promise<Artist[]> {
    if (!ids?.length) return [];
    const all = await this.artistDataHelper.findAll();
    return ids
      .map(id => all.find(a => a.artist_id === id))
      .filter((a): a is Artist => !!a && a.is_active !== false);
  }

  getArtistsDir(): string {
    return this.artistDataHelper.getArtistsDir();
  }

  /**
   * Pick a unique slug: prefer the requested one, else derive from the name,
   * then suffix -2, -3 … on collision. Slugs must be unique because they are
   * the public URL.
   */
  private async resolveUniqueSlug(
    requested: string | undefined,
    name: string,
    exceptArtistId?: string
  ): Promise<string> {
    const base = slugifyArtistName(requested || name) || 'artist';
    let candidate = base;
    let n = 2;
    while (await this.artistDataHelper.slugTaken(candidate, exceptArtistId)) {
      candidate = `${base}-${n++}`;
      if (n > 200) {
        candidate = `${base}-${Date.now().toString(36)}`;
        break;
      }
    }
    return candidate;
  }

  async createArtist(
    data: Partial<Omit<Artist, 'artist_id' | 'created_at' | 'updated_at'>> & { name: string }
  ): Promise<Artist> {
    const name = String(data.name ?? '').trim();
    if (!name) throw new Error('Artist name is required');

    const slug = await this.resolveUniqueSlug(data.slug, name);
    return this.artistDataHelper.create({
      ...data,
      name,
      slug,
      artist_type: data.artist_type === 'MusicGroup' ? 'MusicGroup' : 'Person',
      is_active: data.is_active !== undefined ? data.is_active : true,
    });
  }

  async updateArtist(
    id: string,
    updates: Partial<Omit<Artist, 'artist_id' | 'created_at'>>
  ): Promise<Artist | null> {
    const existing = await this.artistDataHelper.findById(id);
    if (!existing) return null;

    const next: Partial<Omit<Artist, 'artist_id' | 'created_at'>> = { ...updates };
    if (updates.name !== undefined) {
      const name = String(updates.name).trim();
      if (!name) throw new Error('Artist name cannot be empty');
      next.name = name;
    }
    // Only recompute the slug when the admin explicitly supplies one. Renaming
    // an artist must not silently change an already-indexed URL.
    if (updates.slug !== undefined) {
      next.slug = await this.resolveUniqueSlug(updates.slug, next.name ?? existing.name, id);
    }
    return this.artistDataHelper.update(id, next);
  }

  async deleteArtist(id: string): Promise<boolean> {
    return this.artistDataHelper.delete(id);
  }

  /**
   * Performer names present on events/sub-events that have no Artist record yet.
   *
   * This exists because entering a performer name on a sub-event previously did
   * nothing visible. Records are deliberately NOT created automatically: a slug
   * is a permanent public URL, the source field is free text, and an
   * auto-generated page carrying only a name is thin content. Surfacing the
   * names for one-click creation gives the convenience without those costs.
   */
  async getSuggestions(): Promise<ArtistSuggestion[]> {
    const [artists, events, subEvents] = await Promise.all([
      this.artistDataHelper.findAll().catch(() => [] as Artist[]),
      this.eventService.getAllEvents().catch(() => [] as Event[]),
      this.subEventService.getAllSubEvents().catch(() => [] as SubEvent[]),
    ]);

    // Every name an existing Artist already answers to, including variants.
    const known = new Set<string>();
    for (const a of artists) {
      known.add(normalizeName(a.name));
      for (const alt of String(a.alternate_names ?? '').split(',')) {
        const n = normalizeName(alt);
        if (n) known.add(n);
      }
    }

    const found = new Map<string, ArtistSuggestion>();

    const collect = (
      raw: string | undefined,
      performerType: string | undefined,
      kind: 'event' | 'sub-event',
      id: string,
      title: string
    ) => {
      for (const name of splitPerformerNames(raw)) {
        const key = normalizeName(name);
        if (!key || known.has(key)) continue;

        const existing = found.get(key);
        if (existing) {
          if (!existing.sources.some(s => s.id === id)) {
            existing.sources.push({ kind, id, title });
          }
          existing.flaggedAsMusicGroup ||= performerType === 'MusicGroup';
          continue;
        }
        found.set(key, {
          name,
          proposedSlug: slugifyArtistName(name),
          sources: [{ kind, id, title }],
          flaggedAsMusicGroup: performerType === 'MusicGroup',
        });
      }
    };

    for (const e of events) {
      collect(e.performers, e.performer_type, 'event', e.event_id, e.event_name);
    }
    for (const se of subEvents) {
      collect(
        se.performers,
        se.performer_type,
        'sub-event',
        se.sub_event_id,
        se.sub_event_name
      );
    }

    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Every Sanhoti event and sub-event featuring this artist, split into
   * upcoming and past. Matches on the structured `artist_ids` link and falls
   * back to a case-insensitive match against the legacy free-text
   * `performers` field (including the artist's alternate spellings), so
   * existing records surface without a manual re-link.
   */
  async getAppearances(artist: Artist): Promise<ArtistAppearances> {
    const names = [artist.name, ...String(artist.alternate_names ?? '').split(',')]
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    const mentionsArtist = (rec: { artist_ids?: string[]; performers?: string }): boolean => {
      if (rec.artist_ids?.includes(artist.artist_id)) return true;
      const performers = String(rec.performers ?? '').toLowerCase();
      return !!performers && names.some(n => performers.includes(n));
    };

    const [events, subEvents] = await Promise.all([
      this.eventService.getActiveEvents().catch(() => [] as Event[]),
      this.subEventService.getAllSubEvents().catch(() => [] as SubEvent[]),
    ]);

    const matched: Array<{ kind: 'event' | 'sub-event'; event: Event | SubEvent; when: number }> = [];

    for (const e of events) {
      if (!mentionsArtist(e)) continue;
      matched.push({ kind: 'event', event: e, when: new Date(e.event_start_dt || 0).getTime() });
    }
    for (const se of subEvents) {
      if (se.is_active === false) continue;
      if (!mentionsArtist(se)) continue;
      const start = (se as unknown as { sub_event_start_dt?: string; start_dt?: string });
      matched.push({
        kind: 'sub-event',
        event: se,
        when: new Date(start.sub_event_start_dt || start.start_dt || 0).getTime(),
      });
    }

    const now = Date.now();
    const upcoming = matched
      .filter(m => Number.isFinite(m.when) && m.when >= now)
      .sort((a, b) => a.when - b.when);
    const past = matched
      .filter(m => !(Number.isFinite(m.when) && m.when >= now))
      .sort((a, b) => b.when - a.when);

    return {
      upcoming: upcoming.map(({ kind, event }) => ({ kind, event })),
      past: past.map(({ kind, event }) => ({ kind, event })),
    };
  }
}
