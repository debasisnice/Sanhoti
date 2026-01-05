import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const homePageDir = join(__dirname, '../../data/HomePage_Images');

// Ensure HomePage_Images directory exists
if (!existsSync(homePageDir)) {
  mkdirSync(homePageDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, homePageDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename and add timestamp
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

export class HomePageController {
  // Get list of all homepage images (public)
  async getImages(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!existsSync(homePageDir)) {
        res.json([]);
        return;
      }

      const files = readdirSync(homePageDir);
      const imageFiles = files
        .filter(file => {
          const filePath = join(homePageDir, file);
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
          url: `/api/homepage/images/${encodeURIComponent(file)}`,
        }))
        .sort((a, b) => a.filename.localeCompare(b.filename));

      res.json(imageFiles);
    } catch (error: any) {
      console.error('Error in getImages:', error);
      res.status(500).json({ error: 'Failed to fetch homepage images' });
    }
  }

  // Serve individual homepage image (public)
  async getImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);
      
      const imagePath = join(homePageDir, decodedFilename);
      
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
      console.error('Error in getImage:', error);
      res.status(500).json({ error: 'Failed to serve homepage image' });
    }
  }

  // Upload images (admin only)
  uploadImages() {
    return upload.array('images', 20); // Allow up to 20 images
  }

  async handleImageUpload(req: AuthRequest, res: Response): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

      const uploadedFiles = files.map(file => ({
        filename: file.filename,
        url: `/api/homepage/images/${encodeURIComponent(file.filename)}`,
      }));

      res.json({
        message: 'Images uploaded successfully',
        uploaded: uploadedFiles,
      });
    } catch (error: any) {
      console.error('Error in handleImageUpload:', error);
      res.status(500).json({ error: 'Failed to upload images', details: error.message });
    }
  }

  // Delete homepage image (admin only)
  async deleteImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);
      
      const imagePath = join(homePageDir, decodedFilename);
      
      if (!existsSync(imagePath)) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      unlinkSync(imagePath);
      res.json({ message: 'Image deleted successfully' });
    } catch (error: any) {
      console.error('Error in deleteImage:', error);
      res.status(500).json({ error: 'Failed to delete image', details: error.message });
    }
  }

  // Delete all homepage images (admin only)
  async deleteAllImages(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!existsSync(homePageDir)) {
        res.json({ message: 'No images to delete', deleted: 0 });
        return;
      }

      const files = readdirSync(homePageDir);
      let deletedCount = 0;

      files.forEach(file => {
        const filePath = join(homePageDir, file);
        try {
          const stats = statSync(filePath);
          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
          if (stats.isFile() && isImage) {
            unlinkSync(filePath);
            deletedCount++;
          }
        } catch (error) {
          console.error(`Error deleting file ${file}:`, error);
        }
      });

      res.json({ 
        message: 'All images deleted successfully', 
        deleted: deletedCount 
      });
    } catch (error: any) {
      console.error('Error in deleteAllImages:', error);
      res.status(500).json({ error: 'Failed to delete images', details: error.message });
    }
  }
}

