import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const paymentQRDir = join(__dirname, '../../data/PaymentQR');

// Ensure PaymentQR directory exists
if (!existsSync(paymentQRDir)) {
  mkdirSync(paymentQRDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, paymentQRDir);
  },
  filename: (req, file, cb) => {
    // Use a fixed filename since we only allow one image
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    cb(null, `payment-qr.${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
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

export class PaymentQRController {
  // Get payment QR image (public)
  async getImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!existsSync(paymentQRDir)) {
        res.status(404).json({ error: 'Payment QR image not found' });
        return;
      }

      const files = readdirSync(paymentQRDir);
      const imageFile = files.find(file => {
        const filePath = join(paymentQRDir, file);
        try {
          const stats = statSync(filePath);
          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
          return stats.isFile() && isImage;
        } catch (error) {
          return false;
        }
      });

      if (!imageFile) {
        res.status(404).json({ error: 'Payment QR image not found' });
        return;
      }

      const imagePath = join(paymentQRDir, imageFile);
      
      // Determine content type based on file extension
      const ext = imageFile.toLowerCase().split('.').pop();
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
      res.status(500).json({ error: 'Failed to serve payment QR image' });
    }
  }

  // Check if image exists (public)
  async hasImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!existsSync(paymentQRDir)) {
        res.json({ hasImage: false });
        return;
      }

      const files = readdirSync(paymentQRDir);
      const hasImage = files.some(file => {
        const filePath = join(paymentQRDir, file);
        try {
          const stats = statSync(filePath);
          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
          return stats.isFile() && isImage;
        } catch (error) {
          return false;
        }
      });

      res.json({ hasImage });
    } catch (error: any) {
      console.error('Error in hasImage:', error);
      res.status(500).json({ error: 'Failed to check payment QR image' });
    }
  }

  // Upload image (admin only) - replaces existing image
  uploadImage() {
    return upload.single('image');
  }

  async handleImageUpload(req: AuthRequest, res: Response): Promise<void> {
    try {
      const file = req.file;
      
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Delete any existing images in the directory
      if (existsSync(paymentQRDir)) {
        const files = readdirSync(paymentQRDir);
        files.forEach(existingFile => {
          const filePath = join(paymentQRDir, existingFile);
          try {
            const stats = statSync(filePath);
            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(existingFile);
            if (stats.isFile() && isImage && existingFile !== file.filename) {
              unlinkSync(filePath);
            }
          } catch (error) {
            // Ignore errors when deleting old files
          }
        });
      }

      res.json({
        message: 'Image uploaded successfully',
        uploaded: {
          filename: file.filename,
          url: `/api/paymentqr/image`,
        },
      });
    } catch (error: any) {
      console.error('Error in handleImageUpload:', error);
      res.status(500).json({ error: 'Failed to upload image', details: error.message });
    }
  }

  // Delete payment QR image (admin only)
  async deleteImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!existsSync(paymentQRDir)) {
        res.json({ message: 'No image to delete' });
        return;
      }

      const files = readdirSync(paymentQRDir);
      let deletedCount = 0;

      files.forEach(file => {
        const filePath = join(paymentQRDir, file);
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
        message: 'Image deleted successfully', 
        deleted: deletedCount 
      });
    } catch (error: any) {
      console.error('Error in deleteImage:', error);
      res.status(500).json({ error: 'Failed to delete image', details: error.message });
    }
  }
}

