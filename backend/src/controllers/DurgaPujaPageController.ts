import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { DurgaPujaPageService } from '../services/DurgaPujaPageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const imageDir = join(__dirname, '../../data/DurgaPuja_Page');

if (!existsSync(imageDir)) {
  mkdirSync(imageDir, { recursive: true });
}

const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp)$/i;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imageDir);
  },
  filename: (req, file, cb) => {
    // Fixed basename — only one page image at a time
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    cb(null, `durga-puja-page.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
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

/** Whether a Durga Puja page image has been uploaded (used by SeoPageController). */
export function durgaPujaPageImageExists(): boolean {
  return findImageFile() !== null;
}

function findImageFile(): string | null {
  if (!existsSync(imageDir)) return null;
  const files = readdirSync(imageDir);
  return (
    files.find(file => {
      try {
        return statSync(join(imageDir, file)).isFile() && IMAGE_RE.test(file);
      } catch {
        return false;
      }
    }) ?? null
  );
}

export class DurgaPujaPageController {
  private service: DurgaPujaPageService;

  constructor() {
    this.service = new DurgaPujaPageService();
  }

  async getContent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const content = await this.service.getContent();
      res.json(content);
    } catch (error: any) {
      console.error('Error fetching Durga Puja page content:', error);
      res.status(500).json({ error: 'Failed to fetch Durga Puja page content' });
    }
  }

  async updateContent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const content = await this.service.updateContent(req.body ?? {});
      res.json(content);
    } catch (error: any) {
      console.error('Error updating Durga Puja page content:', error);
      res.status(400).json({ error: error.message || 'Failed to update Durga Puja page content' });
    }
  }

  // Serve the page image (public)
  async getImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const imageFile = findImageFile();
      if (!imageFile) {
        res.status(404).json({ error: 'Durga Puja page image not found' });
        return;
      }
      const ext = imageFile.toLowerCase().split('.').pop();
      const contentTypeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
      };
      res.sendFile(resolve(join(imageDir, imageFile)), {
        headers: { 'Content-Type': contentTypeMap[ext || ''] || 'image/jpeg' },
      });
    } catch (error: any) {
      console.error('Error serving Durga Puja page image:', error);
      res.status(500).json({ error: 'Failed to serve image' });
    }
  }

  // Check if an image exists (public)
  async hasImage(req: AuthRequest, res: Response): Promise<void> {
    res.json({ hasImage: findImageFile() !== null });
  }

  // Multer middleware for upload route (admin)
  uploadImage() {
    return upload.single('image');
  }

  // Handle upload — replaces any previous image (admin)
  async handleImageUpload(req: AuthRequest, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      // Remove older images with a different extension
      for (const existing of readdirSync(imageDir)) {
        try {
          if (
            existing !== file.filename &&
            IMAGE_RE.test(existing) &&
            statSync(join(imageDir, existing)).isFile()
          ) {
            unlinkSync(join(imageDir, existing));
          }
        } catch {
          // ignore cleanup errors
        }
      }
      res.json({
        message: 'Image uploaded successfully',
        uploaded: { filename: file.filename, url: '/api/durga-puja-page/image' },
      });
    } catch (error: any) {
      console.error('Error uploading Durga Puja page image:', error);
      res.status(500).json({ error: 'Failed to upload image', details: error.message });
    }
  }

  // Delete the page image (admin)
  async deleteImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      let deleted = 0;
      for (const file of readdirSync(imageDir)) {
        try {
          if (IMAGE_RE.test(file) && statSync(join(imageDir, file)).isFile()) {
            unlinkSync(join(imageDir, file));
            deleted++;
          }
        } catch (error) {
          console.error(`Error deleting ${file}:`, error);
        }
      }
      res.json({ message: 'Image deleted', deleted });
    } catch (error: any) {
      console.error('Error deleting Durga Puja page image:', error);
      res.status(500).json({ error: 'Failed to delete image' });
    }
  }
}
