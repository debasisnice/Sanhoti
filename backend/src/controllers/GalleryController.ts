import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { GalleryService } from '../services/GalleryService.js';
import multer from 'multer';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { EventDataHelper } from '../data/EventDataHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const galleriesDir = join(__dirname, '../../data/Galleries');

// Configure multer for file uploads - use temp directory, then move to event folder
const tempDir = join(galleriesDir, '.temp');
// Ensure temp directory exists
if (!existsSync(tempDir)) {
  mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save to temp directory first, then move to event-specific folder
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename but sanitize it
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

export class GalleryController {
  private galleryService: GalleryService;

  constructor() {
    this.galleryService = new GalleryService();
  }

  async getPublicGalleries(req: AuthRequest, res: Response): Promise<void> {
    try {
      const galleries = await this.galleryService.getPublicGalleries();
      res.json(galleries);
    } catch (error: any) {
      console.error('Error in getPublicGalleries:', error);
      res.status(500).json({ error: 'Failed to fetch galleries', details: error.message });
    }
  }

  async getPublicGalleryById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const gallery = await this.galleryService.getGalleryById(id);
      if (!gallery) {
        res.status(404).json({ error: 'Gallery not found' });
        return;
      }
      // Only return if it's public
      if (!gallery.isPublic) {
        res.status(403).json({ error: 'Gallery is not public' });
        return;
      }
      res.json(gallery);
    } catch (error: any) {
      console.error('Error in getPublicGalleryById:', error);
      res.status(500).json({ error: 'Failed to fetch gallery', details: error.message });
    }
  }

  async getAllGalleries(req: AuthRequest, res: Response): Promise<void> {
    try {
      const galleries = await this.galleryService.getAllGalleries();
      res.json(galleries);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch galleries' });
    }
  }

  async getGalleryById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const gallery = await this.galleryService.getGalleryById(id);
      if (!gallery) {
        res.status(404).json({ error: 'Gallery not found' });
        return;
      }
      res.json(gallery);
    } catch (error: any) {
      console.error('Error in getGalleryById:', error);
      res.status(500).json({ error: 'Failed to fetch gallery', details: error.message });
    }
  }

  async getGalleriesByEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      const galleries = await this.galleryService.getGalleriesByEvent(eventId);
      res.json(galleries);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch galleries' });
    }
  }

  async getGalleryByAccessCode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      const gallery = await this.galleryService.getGalleryByAccessCode(code);
      if (!gallery) {
        res.status(404).json({ error: 'Gallery not found or invalid access code' });
        return;
      }
      res.json(gallery);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch gallery' });
    }
  }

  async createGallery(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { eventId, title, description, isPublic, specialAccessCode } = req.body;

      if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
      }

      const gallery = await this.galleryService.createGallery({
        eventId,
        title,
        description,
        isPublic: isPublic !== undefined ? isPublic : false,
        specialAccessCode,
        createdBy: req.user.userId,
      });

      res.status(201).json(gallery);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create gallery' });
    }
  }

  async updateGallery(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const gallery = await this.galleryService.updateGallery(id, updates);
      if (!gallery) {
        res.status(404).json({ error: 'Gallery not found' });
        return;
      }

      res.json(gallery);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update gallery' });
    }
  }

  async addPhoto(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { url, thumbnailUrl, caption } = req.body;

      if (!url) {
        res.status(400).json({ error: 'Photo URL is required' });
        return;
      }

      const gallery = await this.galleryService.addPhotoToGallery(id, {
        url,
        thumbnailUrl,
        caption,
      });

      if (!gallery) {
        res.status(404).json({ error: 'Gallery not found' });
        return;
      }

      res.json(gallery);
    } catch (error) {
      res.status(500).json({ error: 'Failed to add photo' });
    }
  }

  async removePhoto(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id, photoId } = req.params;
      const gallery = await this.galleryService.removePhotoFromGallery(id, photoId);
      if (!gallery) {
        res.status(404).json({ error: 'Gallery or photo not found' });
        return;
      }

      res.json(gallery);
    } catch (error) {
      res.status(500).json({ error: 'Failed to remove photo' });
    }
  }

  async deleteGallery(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.galleryService.deleteGallery(id);
      if (!success) {
        res.status(404).json({ error: 'Gallery not found' });
        return;
      }

      res.json({ message: 'Gallery deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete gallery' });
    }
  }

  // Get photos in a gallery folder (by event_id)
  async getGalleryPhotos(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      const photos = await this.galleryService.getPhotosInFolder(eventId);
      // Always return array, even if empty (no error for empty folders)
      res.json(Array.isArray(photos) ? photos : []);
    } catch (error: any) {
      // Log but don't treat as error - return empty array instead
      const eventId = req.params.eventId || 'unknown';
      console.log(`No photos found for event ${eventId} (this is normal for empty galleries):`, error.message);
      res.json([]); // Return empty array instead of error
    }
  }

  // Upload photos to a gallery folder (by event_id)
  uploadPhotos() {
    return upload.array('photos', 20); // Allow up to 20 files
  }

  async handlePhotoUpload(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      console.log(`Upload request for eventId: ${eventId}`);
      console.log(`Files received:`, req.files);
      
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        console.log('No files in request');
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

      console.log(`Processing ${files.length} file(s)`);

      // Get event to find the folder name
      const eventDataHelper = new EventDataHelper();
      const event = await eventDataHelper.findById(eventId);
      if (!event || !event.photo_gallery_link) {
        console.error(`Event not found: ${eventId}`);
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      const folderName = event.photo_gallery_link;
      const folderPath = join(galleriesDir, folderName);
      console.log(`Target folder: ${folderPath}`);

      // Ensure folder exists
      if (!existsSync(folderPath)) {
        console.log(`Creating folder: ${folderPath}`);
        mkdirSync(folderPath, { recursive: true });
      }

      // Move files to the correct folder
      const uploadedFiles: string[] = [];
      const fs = await import('fs/promises');
      
      for (const file of files) {
        try {
          const destPath = join(folderPath, file.filename);
          console.log(`Moving file from ${file.path} to ${destPath}`);
          
          // Check if source file exists
          if (!existsSync(file.path)) {
            console.error(`Source file not found: ${file.path}`);
            continue;
          }
          
          await fs.rename(file.path, destPath);
          uploadedFiles.push(file.filename);
          console.log(`Successfully moved: ${file.filename}`);
        } catch (fileError: any) {
          console.error(`Error moving file ${file.filename}:`, fileError);
          // Continue with other files
        }
      }

      if (uploadedFiles.length === 0) {
        res.status(500).json({ error: 'Failed to upload any photos. Please check file permissions and try again.' });
        return;
      }

      res.json({ 
        message: `${uploadedFiles.length} photo(s) uploaded successfully`,
        files: uploadedFiles 
      });
    } catch (error: any) {
      console.error('Error in handlePhotoUpload:', error);
      res.status(500).json({ error: 'Failed to upload photos', details: error.message });
    }
  }

  // Delete a photo from a gallery folder
  async deleteGalleryPhoto(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId, filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);
      
      const success = await this.galleryService.deletePhotoFromFolder(eventId, decodedFilename);
      if (!success) {
        res.status(404).json({ error: 'Photo not found' });
        return;
      }

      res.json({ message: 'Photo deleted successfully' });
    } catch (error: any) {
      console.error('Error in deleteGalleryPhoto:', error);
      res.status(500).json({ error: 'Failed to delete photo', details: error.message });
    }
  }

  // Serve photo files - optional authentication for admin pages
  async servePhoto(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId, filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);
      console.log(`Serving photo: eventId=${eventId}, filename=${decodedFilename}`);
      
      // Try to authenticate if token is provided, but don't require it
      // This allows images to load with auth when available
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const { verifyToken } = await import('../utils/auth.js');
          const token = authHeader.substring(7);
          const decoded = verifyToken(token);
          if (decoded) {
            req.user = decoded;
          }
        } catch (error) {
          // Ignore auth errors for image serving
        }
      }
      
      // Get event to find the folder name
      const eventDataHelper = new EventDataHelper();
      const event = await eventDataHelper.findById(eventId);
      if (!event || !event.photo_gallery_link) {
        console.error(`Event not found: ${eventId}`);
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      const folderName = event.photo_gallery_link;
      const filePath = join(galleriesDir, folderName, decodedFilename);
      console.log(`Looking for photo at: ${filePath}`);

      if (!existsSync(filePath)) {
        console.error(`Photo file not found: ${filePath}`);
        res.status(404).json({ error: 'Photo not found' });
        return;
      }

      // Set appropriate content type based on file extension
      const ext = decodedFilename.split('.').pop()?.toLowerCase();
      const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                         ext === 'png' ? 'image/png' :
                         ext === 'gif' ? 'image/gif' :
                         ext === 'webp' ? 'image/webp' :
                         'application/octet-stream';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      // sendFile requires an absolute path
      const absolutePath = resolve(filePath);
      res.sendFile(absolutePath);
    } catch (error: any) {
      console.error('Error in servePhoto:', error);
      res.status(500).json({ error: 'Failed to serve photo', details: error.message });
    }
  }
}

