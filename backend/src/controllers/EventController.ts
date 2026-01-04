import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { EventService } from '../services/EventService.js';
import multer from 'multer';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync, renameSync, unlinkSync, readdirSync, statSync } from 'fs';
import { EventDataHelper } from '../data/EventDataHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const eventsFlyersDir = join(__dirname, '../../data/Events_Flyers');

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

  constructor() {
    this.eventService = new EventService();
    this.eventDataHelper = new EventDataHelper();
  }

  async getAllEvents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const events = await this.eventService.getAllEvents();
      console.log(`Returning ${events.length} events (${events.filter(e => e.is_active === false).length} inactive)`);
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

      const { event_name, event_start_dt, event_end_dt, year, event_description, location, photo_gallery_link, is_priority } = req.body;

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
        location,
        photo_gallery_link,
        is_priority,
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
      console.log(`Returning ${folders.length} gallery folders`);
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
            console.log(`Deleted old image: ${existingFile}`);
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

      // sendFile requires an absolute path
      const absolutePath = resolve(imagePath);
      res.sendFile(absolutePath, {
        headers: {
          'Content-Type': contentType,
        },
      });
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
}

