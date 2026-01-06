import { Response } from 'express';
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
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subEventId = req.params.id;
    const subEventService = new SubEventService();
    
    subEventService.getSubEventById(subEventId).then(subEvent => {
      if (!subEvent || !subEvent.event_image_path) {
        cb(new Error('Sub-event not found or folder not created'), '');
        return;
      }
      
      const parentEventFolder = join(eventsFlyersDir, `event-${subEvent.event_id}`);
      const subEventFolderPath = join(parentEventFolder, subEvent.event_image_path);
      
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
      
      cb(null, subEventFolderPath);
    }).catch(err => {
      cb(err, '');
    });
  },
  filename: (req, file, cb) => {
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, originalName);
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

  async getSubEventsByEventId(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      const subEvents = await this.subEventService.getSubEventsByEventId(eventId);
      res.json(subEvents);
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
        res.status(404).json({ error: 'Sub-event not found' });
        return;
      }

      res.json({
        message: 'Image uploaded successfully',
        filename: req.file.filename,
        url: `/api/sub-events/${id}/image/${req.file.filename}`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to upload image' });
    }
  }

  async getSubEventImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id, filename } = req.params;
      const subEvent = await this.subEventService.getSubEventById(id);
      
      if (!subEvent || !subEvent.event_image_path) {
        res.status(404).json({ error: 'Sub-event or image not found' });
        return;
      }

      const parentEventFolder = join(eventsFlyersDir, `event-${subEvent.event_id}`);
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

  async getSubEventImages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const images = await this.subEventService.getSubEventImages(id);
      res.json(images);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch images' });
    }
  }

  // Export multer middleware
  uploadImage() {
    return upload.single('image');
  }
}

