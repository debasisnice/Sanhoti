import { Response, Request } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { SubEventService } from '../services/SubEventService.js';
import multer from 'multer';
import { existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const eventsFlyersDir = join(__dirname, '../../data/Events_Flyers');

// Ensure directory exists
if (!existsSync(eventsFlyersDir)) {
  mkdirSync(eventsFlyersDir, { recursive: true });
}

// Configure multer for sub-event image uploads
// Note: We'll handle folder setup in the upload handler since multer doesn't support async destination
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use temp directory, we'll move the file in the upload handler
    const tempDir = join(eventsFlyersDir, '.temp');
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${originalName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter: (req, file, cb) => {
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export class SubEventController {
  private subEventService: SubEventService;

  constructor() {
    this.subEventService = new SubEventService();
  }

  async getAllSubEvents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const subEvents = await this.subEventService.getAllSubEvents();
      res.json(subEvents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch sub-events' });
    }
  }

  async getSubEventById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const subEvent = await this.subEventService.getSubEventById(id);
      if (!subEvent) {
        res.status(404).json({ error: 'Sub-event not found' });
        return;
      }
      res.json(subEvent);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch sub-event' });
    }
  }

  async getSubEventsByEventId(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      const subEvents = await this.subEventService.getSubEventsByEventId(eventId);
      // Only return active sub-events for public access
      const activeSubEvents = subEvents.filter(se => se.is_active);
      res.json(activeSubEvents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch sub-events' });
    }
  }

  async createSubEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        sub_event_name,
        sub_event_start_dt,
        sub_event_end_dt,
        year,
        event_description,
        location,
        is_active,
        event_id,
        rsvp_link,
      } = req.body;

      if (!sub_event_name || !sub_event_start_dt || !sub_event_end_dt || !event_id) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const subEvent = await this.subEventService.createSubEvent({
        sub_event_name,
        sub_event_start_dt,
        sub_event_end_dt,
        year,
        event_description: event_description || '',
        location: location || '',
        is_active: is_active !== undefined ? is_active : true,
        event_id,
        rsvp_link,
      });

      res.status(201).json(subEvent);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create sub-event' });
    }
  }

  async updateSubEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const subEvent = await this.subEventService.updateSubEvent(id, updates);
      if (!subEvent) {
        res.status(404).json({ error: 'Sub-event not found' });
        return;
      }

      res.json(subEvent);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update sub-event' });
    }
  }

  async deleteSubEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await this.subEventService.deleteSubEvent(id);
      if (!deleted) {
        res.status(404).json({ error: 'Sub-event not found' });
        return;
      }

      res.json({ message: 'Sub-event deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete sub-event' });
    }
  }

  async uploadSubEventImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!req.file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }

      const subEvent = await this.subEventService.getSubEventById(id);
      if (!subEvent) {
        // Clean up temp file
        if (req.file.path && existsSync(req.file.path)) {
          unlinkSync(req.file.path);
        }
        res.status(404).json({ error: 'Sub-event not found' });
        return;
      }

      // Get parent event to find its folder name
      const { EventDataHelper } = await import('../data/EventDataHelper.js');
      const eventDataHelper = new EventDataHelper();
      const parentEvent = await eventDataHelper.findById(subEvent.event_id);
      
      if (!parentEvent) {
        // Clean up temp file
        if (req.file.path && existsSync(req.file.path)) {
          unlinkSync(req.file.path);
        }
        res.status(404).json({ error: 'Parent event not found' });
        return;
      }

      // Use parent event's event_image_path as folder name
      const parentEventFolderName = parentEvent.event_image_path || `${parentEvent.event_name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-')}-${parentEvent.event_id}`;
      const parentEventFolder = join(eventsFlyersDir, parentEventFolderName);
      if (!existsSync(parentEventFolder)) {
        mkdirSync(parentEventFolder, { recursive: true });
      }

      // If event_image_path is not set, create it now
      let subEventFolderPath: string;
      if (!subEvent.event_image_path) {
        // Generate folder name from sub-event name and ID
        const sanitizeFolderName = (name: string): string => {
          return name
            .replace(/[<>:"/\\|?*]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .trim();
        };
        const subEventFolderName = `${sanitizeFolderName(subEvent.sub_event_name)}-${subEvent.sub_event_id}`;
        subEventFolderPath = join(parentEventFolder, subEventFolderName);
        
        // Update sub-event with folder path
        await this.subEventService.updateSubEvent(id, { event_image_path: subEventFolderName } as any);
      } else {
        subEventFolderPath = join(parentEventFolder, subEvent.event_image_path);
      }
      
      // Ensure sub-event folder exists
      if (!existsSync(subEventFolderPath)) {
        mkdirSync(subEventFolderPath, { recursive: true });
      }

      // Delete existing images in the folder (only one image allowed)
      try {
        const files = readdirSync(subEventFolderPath);
        files.forEach(file => {
          if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file)) {
            unlinkSync(join(subEventFolderPath, file));
          }
        });
      } catch (error) {
        // Continue even if deletion fails
      }

      // Move temp file to final location
      const finalPath = join(subEventFolderPath, req.file.filename);
      const { renameSync } = await import('fs');
      renameSync(req.file.path, finalPath);

      res.json({
        message: 'Image uploaded successfully',
        filename: req.file.filename,
        url: `/api/sub-events/${id}/image/${req.file.filename}`,
      });
    } catch (error: any) {
      // Clean up temp file on error
      if (req.file?.path && existsSync(req.file.path)) {
        try {
          unlinkSync(req.file.path);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
      res.status(500).json({ error: error.message || 'Failed to upload image' });
    }
  }

  async getSubEventImage(req: Request, res: Response): Promise<void> {
    try {
      const { id, filename } = req.params;
      const subEvent = await this.subEventService.getSubEventById(id);
      
      if (!subEvent || !subEvent.event_image_path) {
        res.status(404).json({ error: 'Sub-event or image not found' });
        return;
      }

      // Get parent event to find its folder name
      const { EventDataHelper } = await import('../data/EventDataHelper.js');
      const eventDataHelper = new EventDataHelper();
      const parentEvent = await eventDataHelper.findById(subEvent.event_id);
      
      if (!parentEvent) {
        res.status(404).json({ error: 'Parent event not found' });
        return;
      }

      const parentEventFolderName = parentEvent.event_image_path || `${parentEvent.event_name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-')}-${parentEvent.event_id}`;
      const parentEventFolder = join(eventsFlyersDir, parentEventFolderName);
      const subEventFolderPath = join(parentEventFolder, subEvent.event_image_path);
      const imagePath = join(subEventFolderPath, filename);

      if (!existsSync(imagePath)) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      res.sendFile(imagePath);
    } catch (error) {
      res.status(500).json({ error: 'Failed to serve image' });
    }
  }

  async getSubEventImages(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const images = await this.subEventService.getSubEventImages(id);
      // Return just the filenames, not full paths
      const filenames = images.map(path => {
        const parts = path.split(/[/\\]/);
        return parts[parts.length - 1];
      }).filter(Boolean);
      res.json(filenames);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch images' });
    }
  }

  // Export multer middleware
  uploadImage() {
    return upload.single('image');
  }
}

