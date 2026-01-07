import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, renameSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sponsorsDir = join(__dirname, '../../data/Sponsors');

// Ensure sponsors directory exists
if (!existsSync(sponsorsDir)) {
  mkdirSync(sponsorsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, sponsorsDir);
  },
  filename: (req, file, cb) => {
    // Get sponsorship type from request body (sent as form field)
    const sponsorshipType = (req.body?.sponsorshipType || 'Silver') as string;
    const validTypes = ['Grand', 'Platinum', 'Gold', 'Silver'];
    const type = validTypes.includes(sponsorshipType) ? sponsorshipType : 'Silver';
    
    // Sanitize filename and add timestamp with sponsorship type prefix
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${type}-${Date.now()}-${sanitized}`);
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

export class SponsorController {
  // Get list of all sponsor images (public)
  async getImages(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!existsSync(sponsorsDir)) {
        res.json([]);
        return;
      }

      const files = readdirSync(sponsorsDir);
      const imageFiles = files
        .filter(file => {
          const filePath = join(sponsorsDir, file);
          try {
            const stats = statSync(filePath);
            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
            return stats.isFile() && isImage;
          } catch (error) {
            return false;
          }
        })
        .map(file => {
          // Extract sponsorship type from filename (format: "Type-timestamp-filename.ext")
          const validTypes = ['Grand', 'Platinum', 'Gold', 'Silver'];
          let sponsorshipType = 'Silver'; // default
          
          for (const type of validTypes) {
            if (file.startsWith(`${type}-`)) {
              sponsorshipType = type;
              break;
            }
          }
          
          return {
            filename: file,
            url: `/api/sponsors/images/${encodeURIComponent(file)}`,
            sponsorshipType: sponsorshipType,
          };
        })
        .sort((a, b) => {
          // Sort by sponsorship type priority: Grand > Platinum > Gold > Silver
          const typeOrder: Record<string, number> = { 'Grand': 0, 'Platinum': 1, 'Gold': 2, 'Silver': 3 };
          const orderA = typeOrder[a.sponsorshipType] ?? 3;
          const orderB = typeOrder[b.sponsorshipType] ?? 3;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return a.filename.localeCompare(b.filename);
        });

      res.json(imageFiles);
    } catch (error: any) {
      console.error('Error in getImages:', error);
      res.status(500).json({ error: 'Failed to fetch sponsor images' });
    }
  }

  // Serve individual sponsor image (public)
  async getImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);
      
      const imagePath = join(sponsorsDir, decodedFilename);
      
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
      res.status(500).json({ error: 'Failed to serve sponsor image' });
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

      const uploadedFiles = files.map(file => {
        // Extract sponsorship type from filename
        const validTypes = ['Grand', 'Platinum', 'Gold', 'Silver'];
        let sponsorshipType = 'Silver';
        
        for (const type of validTypes) {
          if (file.filename.startsWith(`${type}-`)) {
            sponsorshipType = type;
            break;
          }
        }
        
        return {
          filename: file.filename,
          url: `/api/sponsors/images/${encodeURIComponent(file.filename)}`,
          sponsorshipType: sponsorshipType,
        };
      });

      res.json({
        message: 'Images uploaded successfully',
        uploaded: uploadedFiles,
      });
    } catch (error: any) {
      console.error('Error in handleImageUpload:', error);
      res.status(500).json({ error: 'Failed to upload images', details: error.message });
    }
  }

  // Delete sponsor image (admin only)
  async deleteImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);
      
      const imagePath = join(sponsorsDir, decodedFilename);
      
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

  // Update sponsorship type (admin only) - renames the file
  async updateSponsorshipType(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      const { sponsorshipType } = req.body;
      const decodedFilename = decodeURIComponent(filename);
      
      const validTypes = ['Grand', 'Platinum', 'Gold', 'Silver'];
      if (!sponsorshipType || !validTypes.includes(sponsorshipType)) {
        res.status(400).json({ error: 'Invalid sponsorship type. Must be one of: Grand, Platinum, Gold, Silver' });
        return;
      }
      
      const oldPath = join(sponsorsDir, decodedFilename);
      
      if (!existsSync(oldPath)) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      // Extract the original filename without the current type prefix
      let newFilename = decodedFilename;
      for (const type of validTypes) {
        if (newFilename.startsWith(`${type}-`)) {
          newFilename = newFilename.substring(type.length + 1); // Remove "Type-"
          break;
        }
      }
      
      // Add new type prefix
      newFilename = `${sponsorshipType}-${newFilename}`;
      const newPath = join(sponsorsDir, newFilename);
      
      // Rename file
      renameSync(oldPath, newPath);
      
      res.json({ 
        message: 'Sponsorship type updated successfully',
        filename: newFilename,
        url: `/api/sponsors/images/${encodeURIComponent(newFilename)}`,
        sponsorshipType: sponsorshipType,
      });
    } catch (error: any) {
      console.error('Error in updateSponsorshipType:', error);
      res.status(500).json({ error: 'Failed to update sponsorship type', details: error.message });
    }
  }

  // Delete all sponsor images (admin only)
  async deleteAllImages(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!existsSync(sponsorsDir)) {
        res.json({ message: 'No images to delete', deleted: 0 });
        return;
      }

      const files = readdirSync(sponsorsDir);
      let deletedCount = 0;

      files.forEach(file => {
        const filePath = join(sponsorsDir, file);
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

