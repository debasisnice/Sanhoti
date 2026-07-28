import express, { Response } from 'express';
import multer from 'multer';
import { existsSync, mkdirSync, renameSync, unlinkSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AuthRequest } from '../middleware/auth.js';
import { ArtistService } from '../services/ArtistService.js';
import { safeServedFilename } from '../utils/safeFile.js';
import type { Artist, ArtistLink } from '../models/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const artistsDir = join(__dirname, '../../data/Artists');
const tempDir = join(artistsDir, '.temp');

if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tempDir),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okExt = /\.(jpe?g|png|gif|webp)$/i.test(file.originalname);
    const okMime = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype);
    if (okExt && okMime) cb(null, true);
    else cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
  },
});

/** Accept a JSON array, or a JSON-encoded string from multipart/form-data. */
function parseArray<T>(raw: unknown): T[] | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function parseBool(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'boolean') return raw;
  return String(raw).toLowerCase() === 'true';
}

/** Keep only well-formed http(s) links — they are emitted publicly as sameAs. */
function cleanLinks(links: ArtistLink[] | undefined): ArtistLink[] | undefined {
  if (!links) return undefined;
  return links
    .filter(l => l && typeof l.url === 'string' && /^https?:\/\//i.test(l.url.trim()))
    .map(l => ({ label: String(l.label ?? '').trim() || 'Profile', url: l.url.trim() }));
}

function cleanUrls(urls: string[] | undefined): string[] | undefined {
  if (!urls) return undefined;
  return urls.map(u => String(u ?? '').trim()).filter(u => /^https?:\/\//i.test(u));
}

export class ArtistController {
  private artistService: ArtistService;

  constructor() {
    this.artistService = new ArtistService();
  }

  uploadImage() {
    return upload.single('image');
  }

  // ---------------------------------------------------------------- public

  /** Active artists for the public /artists index. */
  async getPublicArtists(_req: express.Request, res: Response): Promise<void> {
    try {
      res.json(await this.artistService.getActiveArtists());
    } catch (error) {
      console.error('Error fetching artists:', error);
      res.status(500).json({ error: 'Failed to fetch artists' });
    }
  }

  /**
   * One artist plus their Sanhoti appearances, addressed by slug (or id).
   * Returns 404 for inactive artists so the public page and the crawler agree.
   */
  async getPublicArtistBySlug(req: express.Request, res: Response): Promise<void> {
    try {
      const artist = await this.artistService.getArtistBySlug(req.params.slug);
      if (!artist || artist.is_active === false) {
        res.status(404).json({ error: 'Artist not found' });
        return;
      }
      const appearances = await this.artistService.getAppearances(artist);
      res.json({ artist, appearances });
    } catch (error) {
      console.error('Error fetching artist:', error);
      res.status(500).json({ error: 'Failed to fetch artist' });
    }
  }

  /** Stream an artist photo. Public: it is referenced from indexable pages. */
  async serveImage(req: express.Request, res: Response): Promise<void> {
    try {
      const artist = await this.artistService.getArtistById(req.params.id);
      if (!artist?.image_path) {
        res.status(404).json({ error: 'Artist image not found' });
        return;
      }
      const filePath = join(artistsDir, safeServedFilename(artist.image_path));
      if (!existsSync(filePath)) {
        res.status(404).json({ error: 'Artist image not found' });
        return;
      }
      const ext = filePath.split('.').pop()?.toLowerCase();
      const contentType =
        ext === 'png' ? 'image/png'
        : ext === 'gif' ? 'image/gif'
        : ext === 'webp' ? 'image/webp'
        : 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      // Filename changes on every upload but the URL stays /artists/:id/image — use
      // a short TTL plus ETag so replacements show up without disabling cache entirely.
      const stat = statSync(filePath);
      res.setHeader('ETag', `"${artist.image_path}-${stat.mtimeMs}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
      res.sendFile(resolve(filePath));
    } catch (error) {
      console.error('Error serving artist image:', error);
      res.status(500).json({ error: 'Failed to serve artist image' });
    }
  }

  // ----------------------------------------------------------------- admin

  async getAllArtists(_req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await this.artistService.getAllArtists());
    } catch (error) {
      console.error('Error fetching artists:', error);
      res.status(500).json({ error: 'Failed to fetch artists' });
    }
  }

  /**
   * Performer names typed onto events/sub-events that have no Artist record.
   * Powers the "Found in your events" panel in Admin → Artists.
   */
  async getSuggestions(_req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await this.artistService.getSuggestions());
    } catch (error) {
      console.error('Error building artist suggestions:', error);
      res.status(500).json({ error: 'Failed to build artist suggestions' });
    }
  }

  async getArtistById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const artist = await this.artistService.getArtistById(req.params.id);
      if (!artist) {
        res.status(404).json({ error: 'Artist not found' });
        return;
      }
      res.json(artist);
    } catch (error) {
      console.error('Error fetching artist:', error);
      res.status(500).json({ error: 'Failed to fetch artist' });
    }
  }

  /** Map request body -> Artist fields, omitting anything the admin left out. */
  private buildPayload(body: Record<string, unknown>): Partial<Artist> {
    const str = (k: string): string | undefined =>
      body[k] === undefined ? undefined : String(body[k] ?? '').trim();

    const payload: Partial<Artist> = {};
    const text: Array<keyof Artist> = [
      'name', 'slug', 'alternate_names', 'short_bio', 'bio', 'genres', 'roles',
      'origin', 'image_alt', 'website_url', 'wikipedia_url', 'meta_title', 'meta_description',
    ];
    for (const key of text) {
      const v = str(key as string);
      if (v !== undefined) (payload as Record<string, unknown>)[key] = v;
    }
    if (body.artist_type !== undefined) {
      payload.artist_type = body.artist_type === 'MusicGroup' ? 'MusicGroup' : 'Person';
    }
    const isActive = parseBool(body.is_active);
    if (isActive !== undefined) payload.is_active = isActive;
    const isFeatured = parseBool(body.is_featured);
    if (isFeatured !== undefined) payload.is_featured = isFeatured;

    const social = cleanLinks(parseArray<ArtistLink>(body.social_links));
    if (social !== undefined) payload.social_links = social;
    const videos = cleanUrls(parseArray<string>(body.video_urls));
    if (videos !== undefined) payload.video_urls = videos;

    return payload;
  }

  /** Move an uploaded temp file into data/Artists under a slug-based name. */
  private storeImage(file: Express.Multer.File | undefined, slug: string): string | undefined {
    if (!file) return undefined;
    const ext = (file.originalname.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `${slug || 'artist'}-${Date.now()}.${ext.toLowerCase()}`;
    renameSync(file.path, join(artistsDir, fileName));
    return fileName;
  }

  async createArtist(req: AuthRequest, res: Response): Promise<void> {
    try {
      const payload = this.buildPayload(req.body ?? {});
      if (!payload.name) {
        res.status(400).json({ error: 'Artist name is required' });
        return;
      }
      const artist = await this.artistService.createArtist({
        ...payload,
        name: payload.name,
      });

      // The image name uses the final slug, so store it after the record exists.
      const image_path = this.storeImage(req.file, artist.slug);
      const finished = image_path
        ? await this.artistService.updateArtist(artist.artist_id, { image_path })
        : artist;

      res.status(201).json(finished);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create artist';
      console.error('Error creating artist:', error);
      res.status(500).json({ error: message });
    }
  }

  async updateArtist(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const existing = await this.artistService.getArtistById(id);
      if (!existing) {
        res.status(404).json({ error: 'Artist not found' });
        return;
      }

      const payload = this.buildPayload(req.body ?? {});
      const image_path = this.storeImage(req.file, payload.slug || existing.slug);
      if (image_path) {
        payload.image_path = image_path;
        if (existing.image_path) {
          const old = join(artistsDir, safeServedFilename(existing.image_path));
          if (existsSync(old)) {
            try {
              unlinkSync(old);
            } catch {
              /* replacing the record matters more than reclaiming the file */
            }
          }
        }
      }

      const updated = await this.artistService.updateArtist(id, payload);
      if (!updated) {
        res.status(404).json({ error: 'Artist not found' });
        return;
      }
      res.json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update artist';
      console.error('Error updating artist:', error);
      res.status(500).json({ error: message });
    }
  }

  async deleteArtist(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const artist = await this.artistService.getArtistById(id);
      if (!artist) {
        res.status(404).json({ error: 'Artist not found' });
        return;
      }
      if (artist.image_path) {
        const filePath = join(artistsDir, safeServedFilename(artist.image_path));
        if (existsSync(filePath)) {
          try {
            unlinkSync(filePath);
          } catch {
            /* ignore */
          }
        }
      }
      await this.artistService.deleteArtist(id);
      res.json({ message: 'Artist deleted successfully' });
    } catch (error) {
      console.error('Error deleting artist:', error);
      res.status(500).json({ error: 'Failed to delete artist' });
    }
  }
}
