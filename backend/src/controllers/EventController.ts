import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { EventService } from '../services/EventService.js';
import multer from 'multer';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync, renameSync, unlinkSync, readdirSync, readFileSync, statSync } from 'fs';
import { EventDataHelper } from '../data/EventDataHelper.js';
import { SubEventDataHelper } from '../data/SubEventDataHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const eventsFlyersDir = join(__dirname, '../../data/Events_Flyers');

/** Escape for use inside double-quoted HTML attribute values. */
function escapeHtmlAttr(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, ' ');
}

/**
 * True for bots that fetch the page to read Open Graph tags only.
 * Must NOT match WhatsApp/Facebook in-app WebViews — those need meta refresh + redirect to the SPA.
 */
function isLinkPreviewCrawler(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();

  // "whatsapp" appears in both the link-preview fetcher and the in-app browser. In-app UAs include
  // a real engine (WebKit / Chrome); server-side fetchers usually do not.
  if (ua.includes('whatsapp')) {
    if (ua.includes('applewebkit') || ua.includes('chrome/') || ua.includes('firefox/')) {
      return false;
    }
    return true;
  }

  return (
    ua.includes('facebookexternalhit') ||
    ua.includes('facebot') ||
    ua.includes('meta-externalagent') ||
    ua.includes('twitterbot') ||
    ua.includes('linkedinbot') ||
    ua.includes('slackbot') ||
    ua.includes('telegrambot') ||
    ua.includes('discordbot') ||
    ua.includes('pinterestbot') ||
    ua.includes('vkshare') ||
    ua.includes('redditbot')
  );
}

function jpegDimensions(buf: Buffer): { width: number; height: number } | null {
  let i = 0;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8) {
      i += 2;
      continue;
    }
    if (marker === 0xd9) break;
    if (i + 3 >= buf.length) break;
    const segLen = buf.readUInt16BE(i + 2);
    if (segLen < 2 || i + 2 + segLen > buf.length) break;
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: buf.readUInt16BE(i + 5),
        width: buf.readUInt16BE(i + 7),
      };
    }
    i += 2 + segLen;
  }
  return null;
}

function pngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function readLocalImageMeta(filePath: string): { width: number; height: number; mime: string } | null {
  try {
    const buf = readFileSync(filePath);
    const lower = filePath.toLowerCase();
    if (/\.jpe?g$/i.test(lower)) {
      const d = jpegDimensions(buf);
      return d ? { ...d, mime: 'image/jpeg' } : null;
    }
    if (/\.png$/i.test(lower)) {
      const d = pngDimensions(buf);
      return d ? { ...d, mime: 'image/png' } : null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

// Configure multer for file uploads
const tempDir = join(eventsFlyersDir, '.temp');
if (!existsSync(tempDir)) {
  mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${sanitized}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  },
});

export class EventController {
  private eventService: EventService;
  private eventDataHelper: EventDataHelper;
  private subEventDataHelper: SubEventDataHelper;

  constructor() {
    this.eventService = new EventService();
    this.eventDataHelper = new EventDataHelper();
    this.subEventDataHelper = new SubEventDataHelper();
  }

  async getAllEvents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const events = await this.eventService.getAllEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  }

  async getActiveEvents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const events = await this.eventService.getActiveEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch active events' });
    }
  }

  async getUpcomingEvents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const events = await this.eventService.getUpcomingEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch upcoming events' });
    }
  }

  async getPastEvents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const events = await this.eventService.getPastEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch past events' });
    }
  }

  async getEventById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const event = await this.eventService.getEventById(id);
      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch event' });
    }
  }

  async createEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { event_name, event_start_dt, event_end_dt, year, event_description, event_type, rsvp_enabled, location, photo_gallery_link, is_priority, rsvp_link } = req.body;

      if (!event_name || !event_start_dt || !event_end_dt || !year || !event_description) {
        res.status(400).json({ error: 'Missing required fields: event_name, event_start_dt, event_end_dt, year, and event_description are required' });
        return;
      }

      const event = await this.eventService.createEvent({
        event_name,
        event_start_dt,
        event_end_dt,
        year,
        event_description,
        event_type,
        rsvp_enabled,
        location,
        photo_gallery_link,
        is_priority,
        rsvp_link,
      });

      res.status(201).json(event);
    } catch (error: any) {
      if (error.message && error.message.includes('cannot be prior')) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Failed to create event' });
    }
  }

  async updateEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const event = await this.eventService.updateEvent(id, updates);
      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      res.json(event);
    } catch (error: any) {
      if (error.message && error.message.includes('cannot be prior')) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Failed to update event' });
    }
  }

  async deleteEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.eventService.deleteEvent(id);
      if (!success) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete event' });
    }
  }

  async deactivateEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const event = await this.eventService.deactivateEvent(id);
      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      res.json(event);
    } catch (error) {
      res.status(500).json({ error: 'Failed to deactivate event' });
    }
  }

  async activateEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const event = await this.eventService.activateEvent(id);
      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      res.json(event);
    } catch (error) {
      res.status(500).json({ error: 'Failed to activate event' });
    }
  }

  async getGalleryFolders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const folders = await this.eventService.getGalleryFolders();
      res.json(folders);
    } catch (error: any) {
      console.error('Error in getGalleryFolders:', error);
      res.status(500).json({ error: 'Failed to fetch gallery folders', details: error.message });
    }
  }

  async toggleGalleryPublish(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      const { isPublic } = req.body;

      const event = await this.eventService.getEventById(eventId);
      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      // Gallery can only be published if the event is active
      if (isPublic === true && !event.is_active) {
        res.status(400).json({ 
          error: 'Cannot publish gallery for an inactive event. Please activate the event first.' 
        });
        return;
      }

      const updatedEvent = await this.eventService.updateEvent(eventId, {
        gallery_is_public: isPublic,
      });

      res.json(updatedEvent);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update gallery publish status' });
    }
  }

  // Upload event image (single file)
  uploadEventImage() {
    return upload.single('image');
  }

  async handleEventImageUpload(req: AuthRequest, res: Response): Promise<void> {
    try {
      const eventId = req.params.id || req.params.eventId;
      const file = req.file as Express.Multer.File;
      
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const event = await this.eventService.getEventById(eventId);
      if (!event) {
        // Clean up temp file if event not found
        if (existsSync(file.path)) {
          try {
            unlinkSync(file.path);
          } catch (cleanupError) {
            console.error('Error cleaning up temp file:', cleanupError);
          }
        }
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      // Get or create the event image folder path
      let folderPath = await this.eventDataHelper.getEventImageFolderPath(eventId);
      
      // If folder doesn't exist, create it and update event with event_image_path
      if (!folderPath) {
        const folderName = event.event_name
          .replace(/[^a-zA-Z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .toLowerCase()
          .trim();
        const finalFolderName = `${folderName}-${event.event_id}`;
        
        folderPath = join(eventsFlyersDir, finalFolderName);
        
        // Create folder
        if (!existsSync(folderPath)) {
          mkdirSync(folderPath, { recursive: true });
        }
        
        // Update event with event_image_path
        await this.eventService.updateEvent(eventId, { event_image_path: finalFolderName });
      }

      // Ensure folder exists (safety check)
      if (!existsSync(folderPath!)) {
        mkdirSync(folderPath!, { recursive: true });
      }

      // Delete all existing images in the folder (replace old image)
      try {
        const existingFiles = readdirSync(folderPath);
        existingFiles.forEach((existingFile) => {
          const filePath = join(folderPath, existingFile);
          const stats = statSync(filePath);
          if (stats.isFile() && /\.(jpg|jpeg|png|gif|webp)$/i.test(existingFile)) {
            unlinkSync(filePath);
          }
        });
      } catch (error) {
        console.error('Error deleting old images:', error);
        // Continue with upload even if deletion fails
      }

      // Move the new file to the event folder
      try {
        const targetPath = join(folderPath, file.filename);
        renameSync(file.path, targetPath);
        
        res.json({
          message: 'Event image uploaded successfully',
          filename: file.filename,
          imagePath: `${event.event_image_path}/${file.filename}`,
        });
      } catch (error: any) {
        // Clean up temp file on error
        if (existsSync(file.path)) {
          try {
            unlinkSync(file.path);
          } catch (cleanupError) {
            console.error('Error cleaning up temp file:', cleanupError);
          }
        }
        res.status(500).json({ error: 'Failed to save image', details: error.message });
      }
    } catch (error: any) {
      console.error('Error in handleEventImageUpload:', error);
      res.status(500).json({ error: 'Failed to upload event image', details: error.message });
    }
  }

  async getEventImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId, filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);
      
      const folderPath = await this.eventDataHelper.getEventImageFolderPath(eventId);
      if (!folderPath) {
        res.status(404).json({ error: 'Event image folder not found' });
        return;
      }

      const imagePath = join(folderPath, decodedFilename);
      
      if (!existsSync(imagePath)) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      // Determine content type based on file extension
      const ext = decodedFilename.toLowerCase().split('.').pop();
      const contentTypeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
      };
      const contentType = contentTypeMap[ext || ''] || 'image/jpeg';

      // sendFile requires an absolute path. Set type via res.type — Express may ignore nested `headers` in options,
      // which breaks social crawlers that require a correct image/* Content-Type for og:image.
      const absolutePath = resolve(imagePath);
      res.type(contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.sendFile(absolutePath);
    } catch (error: any) {
      console.error('Error in getEventImage:', error);
      res.status(500).json({ error: 'Failed to serve event image' });
    }
  }

  async getEventImages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      
      const folderPath = await this.eventDataHelper.getEventImageFolderPath(eventId);
      if (!folderPath || !existsSync(folderPath)) {
        res.json([]);
        return;
      }

      const files = readdirSync(folderPath);
      const imageFiles = files
        .filter(file => {
          const filePath = join(folderPath, file);
          try {
            const stats = statSync(filePath);
            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
            return stats.isFile() && isImage;
          } catch (error) {
            return false;
          }
        })
        .map(file => ({
          filename: file,
          url: `/api/events/${eventId}/image/${encodeURIComponent(file)}`,
        }));

      res.json(imageFiles);
    } catch (error: any) {
      console.error('Error in getEventImages:', error);
      res.status(500).json({ error: 'Failed to fetch event images' });
    }
  }

  async getEventImagePublic(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      
      const folderPath = await this.eventDataHelper.getEventImageFolderPath(eventId);
      if (!folderPath || !existsSync(folderPath)) {
        res.json(null);
        return;
      }

      const files = readdirSync(folderPath);
      const imageFiles = files
        .filter(file => {
          const filePath = join(folderPath, file);
          try {
            const stats = statSync(filePath);
            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
            return stats.isFile() && isImage;
          } catch (error) {
            return false;
          }
        })
        .sort(); // Sort to get consistent first image

      if (imageFiles.length === 0) {
        res.json(null);
        return;
      }

      // Return the first image
      res.json({
        filename: imageFiles[0],
        url: `/api/events/${eventId}/image/${encodeURIComponent(imageFiles[0])}`,
      });
    } catch (error: any) {
      console.error('Error in getEventImagePublic:', error);
      res.json(null);
    }
  }

  /**
   * Minimal HTML with Open Graph / Twitter tags for link previews (WhatsApp, Facebook).
   * Crawlers do not run the SPA; og:image must point at the public flyer URL.
   */
  async getEventSharePage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      const origin = (process.env.PUBLIC_SITE_URL || 'https://www.sanhoti.org').replace(/\/$/, '');
      const canonicalPath = `/events/${encodeURIComponent(eventId)}`;
      const canonicalUrl = `${origin}${canonicalPath}`;
      const sharePagePath = `/og/events/${encodeURIComponent(eventId)}`;
      const sharePageUrl = `${origin}${sharePagePath}`;
      const crawler = isLinkPreviewCrawler(req.get('user-agent'));

      const event = await this.eventService.getEventById(eventId);
      if (!event || !event.is_active) {
        res
          .status(404)
          .type('html')
          .send('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Event not found</title></head><body>Event not found</body></html>');
        return;
      }

      const title = event.event_name || event.title || 'Sanhoti Event';
      const descSource = (event.event_description || event.description || '').replace(/\s+/g, ' ').trim();
      const description = descSource.slice(0, 280) || 'Join us for a Sanhoti community event.';

      const logoFallback = `${origin}/images/logo.png`;
      let ogImageAbs = logoFallback;
      let localImagePath: string | null = null;

      const externalImage = (event.imageUrl || '').trim();
      const externalOk = /^https?:\/\//i.test(externalImage);

      // Always prefer on-disk flyer or gallery for og:image. Legacy `imageUrl` often points at CDNs
      // that block or throttle Meta/WhatsApp fetchers, which yields title/text but no thumbnail.
      const folderPath = await this.eventDataHelper.getEventImageFolderPath(eventId);
      if (folderPath && existsSync(folderPath)) {
        const files = readdirSync(folderPath);
        const imageFiles = files
          .filter((file) => {
            const filePath = join(folderPath, file);
            try {
              const stats = statSync(filePath);
              const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
              return stats.isFile() && isImage;
            } catch {
              return false;
            }
          })
          .sort();
        if (imageFiles.length > 0) {
          const fn = imageFiles[0];
          localImagePath = join(folderPath, fn);
          ogImageAbs = `${origin}/og/events/${encodeURIComponent(eventId)}/image/${encodeURIComponent(fn)}`;
        }
      }

      // Festival/fundraising flyers often live only under sub-event subfolders, not the parent root.
      if (localImagePath === null) {
        const subFlyer = await this.subEventDataHelper.getFirstSubEventFlyerForSharePreview(eventId);
        if (subFlyer) {
          localImagePath = subFlyer.absPath;
          ogImageAbs = `${origin}/og/sub-events/${encodeURIComponent(subFlyer.subEventId)}/image/${encodeURIComponent(subFlyer.filename)}`;
        }
      }

      if (localImagePath === null) {
        const gal = this.eventDataHelper.getFirstGalleryImageForPreview(event);
        if (gal) {
          localImagePath = gal.absPath;
          const gid = event.event_id || event.id || eventId;
          ogImageAbs = `${origin}/og/galleries/${encodeURIComponent(gid)}/photos/${encodeURIComponent(gal.filename)}`;
        }
      }

      if (localImagePath === null && externalOk) {
        ogImageAbs = externalImage;
      }

      // Bust WhatsApp/Meta thumbnail cache when the flyer file changes (same HTML path, new image URL).
      if (
        localImagePath &&
        (ogImageAbs.includes('/og/events/') ||
          ogImageAbs.includes('/og/galleries/') ||
          ogImageAbs.includes('/og/sub-events/'))
      ) {
        try {
          const v = Math.floor(statSync(localImagePath).mtimeMs);
          const sep = ogImageAbs.includes('?') ? '&' : '?';
          ogImageAbs = `${ogImageAbs}${sep}v=${v}`;
        } catch {
          // keep URL without query
        }
      }

      const imgMeta = localImagePath ? readLocalImageMeta(localImagePath) : null;
      const ogImageSizeMeta = imgMeta
        ? `
  <meta property="og:image:width" content="${imgMeta.width}" />
  <meta property="og:image:height" content="${imgMeta.height}" />
  <meta property="og:image:type" content="${escapeHtmlAttr(imgMeta.mime)}" />`
        : '';

      const safeTitle = escapeHtmlAttr(title);
      const safeDesc = escapeHtmlAttr(description);
      const safeOgImage = escapeHtmlAttr(ogImageAbs);
      const ogSecureMeta =
        ogImageAbs.startsWith('https://')
          ? `\n  <meta property="og:image:secure_url" content="${safeOgImage}" />`
          : '';
      const safeCanonical = escapeHtmlAttr(canonicalUrl);
      const safeSharePage = escapeHtmlAttr(sharePageUrl);

      // og:url must be this share URL: the SPA route has no per-event OG tags; scrapers that re-fetch og:url would lose the image.
      const headRedirect = crawler
        ? ''
        : `  <meta http-equiv="refresh" content="0;url=${safeCanonical}" />
`;
      const bodyScript = crawler
        ? ''
        : `  <script>window.location.replace(${JSON.stringify(canonicalUrl)});</script>
`;

      const html = `<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <link rel="image_src" href="${safeOgImage}" />
  <link rel="canonical" href="${safeCanonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${safeSharePage}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:image" content="${safeOgImage}" />${ogSecureMeta}
  <meta property="og:image:alt" content="${safeTitle}" />${ogImageSizeMeta}
  <meta property="og:site_name" content="Sanhoti Bengali Association of Orange County" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image" content="${safeOgImage}" />
${headRedirect}</head>
<body>
  <p><a href="${safeCanonical}">Continue to event details</a></p>
${bodyScript}</body>
</html>`;

      res.status(200).type('html').send(html);
    } catch (error: any) {
      console.error('Error in getEventSharePage:', error);
      res.status(500).type('html').send('<!DOCTYPE html><html><body>Error</body></html>');
    }
  }
}

