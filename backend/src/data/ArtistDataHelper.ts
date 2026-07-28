import { DatabaseHelper } from './DatabaseHelper.js';
import { Artist } from '../models/types.js';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { assetDir } from '../utils/dataPaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Storage for Artist records (data/artists.json) and their photos
 * (data/Artists/). Artists back the crawlable /artists/<slug> pages, so lookup
 * by slug — including previously used slugs — is a first-class operation.
 */
export class ArtistDataHelper extends DatabaseHelper {
  private readonly filename = 'artists.json';
  private readonly artistsDir = assetDir('Artists');

  constructor() {
    super();
    if (!existsSync(this.artistsDir)) {
      mkdirSync(this.artistsDir, { recursive: true });
    }
  }

  getArtistsDir(): string {
    return this.artistsDir;
  }

  async findAll(): Promise<Artist[]> {
    return this.readFile<Artist>(this.filename);
  }

  async findById(artistId: string): Promise<Artist | null> {
    const artists = await this.findAll();
    return artists.find(a => a.artist_id === artistId) ?? null;
  }

  /** Active artists only, featured first then alphabetical — the public index order. */
  async findActive(): Promise<Artist[]> {
    const artists = await this.findAll();
    return artists
      .filter(a => a.is_active !== false)
      .sort((a, b) => {
        if (!!b.is_featured !== !!a.is_featured) return b.is_featured ? 1 : -1;
        return (a.name || '').localeCompare(b.name || '');
      });
  }

  /**
   * Resolve a public URL segment to an artist. Matches the current slug first,
   * then any previous slug (so a renamed artist keeps its indexed URL working
   * instead of 404-ing), then the raw id as a last resort.
   */
  async findBySlug(slug: string): Promise<Artist | null> {
    const wanted = String(slug ?? '').trim().toLowerCase();
    if (!wanted) return null;
    const artists = await this.findAll();
    return (
      artists.find(a => (a.slug || '').toLowerCase() === wanted) ??
      artists.find(a => (a.previous_slugs ?? []).some(s => s.toLowerCase() === wanted)) ??
      artists.find(a => a.artist_id === slug) ??
      null
    );
  }

  async create(data: Omit<Artist, 'artist_id' | 'created_at' | 'updated_at'>): Promise<Artist> {
    const artists = await this.findAll();
    const now = new Date().toISOString();

    let artist_id = '';
    let exists = true;
    while (exists) {
      artist_id = this.generate12DigitAlphanumericId();
      exists = artists.some(a => a.artist_id === artist_id);
    }

    const artist: Artist = { ...data, artist_id, created_at: now, updated_at: now };
    artists.push(artist);
    await this.writeFile(this.filename, artists);
    return artist;
  }

  async update(
    artistId: string,
    updates: Partial<Omit<Artist, 'artist_id' | 'created_at'>>
  ): Promise<Artist | null> {
    const artists = await this.findAll();
    const index = artists.findIndex(a => a.artist_id === artistId);
    if (index === -1) return null;

    const previous = artists[index];
    // A slug change would orphan the already-indexed URL, so retain the old one
    // as an alias that still resolves.
    const previous_slugs =
      updates.slug && updates.slug !== previous.slug
        ? Array.from(new Set([...(previous.previous_slugs ?? []), previous.slug].filter(Boolean)))
        : previous.previous_slugs;

    artists[index] = {
      ...previous,
      ...updates,
      ...(previous_slugs ? { previous_slugs } : {}),
      updated_at: new Date().toISOString(),
    };
    await this.writeFile(this.filename, artists);
    return artists[index];
  }

  async delete(artistId: string): Promise<boolean> {
    const artists = await this.findAll();
    const index = artists.findIndex(a => a.artist_id === artistId);
    if (index === -1) return false;
    artists.splice(index, 1);
    await this.writeFile(this.filename, artists);
    return true;
  }

  /** True when any other artist already owns this slug (uniqueness check). */
  async slugTaken(slug: string, exceptArtistId?: string): Promise<boolean> {
    const wanted = String(slug ?? '').trim().toLowerCase();
    if (!wanted) return false;
    const artists = await this.findAll();
    return artists.some(
      a =>
        a.artist_id !== exceptArtistId &&
        ((a.slug || '').toLowerCase() === wanted ||
          (a.previous_slugs ?? []).some(s => s.toLowerCase() === wanted))
    );
  }
}
