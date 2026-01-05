import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, renameSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const boardMembersDir = join(__dirname, '../../data/BoardMembers');

// Valid post names
const VALID_POST_NAMES = ['President', 'Secretary', 'Treasurer', 'Cultural Director', 'Executive Member'];

// Ensure BoardMembers directory exists
if (!existsSync(boardMembersDir)) {
  mkdirSync(boardMembersDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, boardMembersDir);
  },
  filename: (req, file, cb) => {
    // Use temporary filename - will be renamed in handleImageUpload after postName validation
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const tempFilename = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    cb(null, tempFilename);
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

export class BoardMembersController {
  // Get list of all board member images (public)
  async getImages(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!existsSync(boardMembersDir)) {
        res.json([]);
        return;
      }

      const files = readdirSync(boardMembersDir);
      const imageFiles = files
        .filter(file => {
          const filePath = join(boardMembersDir, file);
          try {
            const stats = statSync(filePath);
            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
            return stats.isFile() && isImage;
          } catch (error) {
            return false;
          }
        })
        .map(file => {
          // Extract post name from filename (remove extension and replace underscores with spaces)
          const postName = file.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
          
          return {
            postName: postName,
            filename: file,
            url: `/api/boardmembers/images/${encodeURIComponent(file)}`,
          };
        })
        .sort((a, b) => {
          // Sort by post name order in VALID_POST_NAMES
          const indexA = VALID_POST_NAMES.indexOf(a.postName);
          const indexB = VALID_POST_NAMES.indexOf(b.postName);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.postName.localeCompare(b.postName);
        });

      res.json(imageFiles);
    } catch (error: any) {
      console.error('Error in getImages:', error);
      res.status(500).json({ error: 'Failed to fetch board member images' });
    }
  }

  // Get image by post name (public)
  async getImageByPostName(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postName } = req.params;
      const decodedPostName = decodeURIComponent(postName);
      
      if (!existsSync(boardMembersDir)) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      const files = readdirSync(boardMembersDir);
      // Find file that matches the post name (with or without spaces/underscores)
      const matchingFile = files.find(file => {
        const filePostName = file.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        return filePostName === decodedPostName;
      });

      if (!matchingFile) {
        res.status(404).json({ error: 'Image not found for post: ' + decodedPostName });
        return;
      }

      const imagePath = join(boardMembersDir, matchingFile);
      
      // Determine content type based on file extension
      const ext = matchingFile.toLowerCase().split('.').pop();
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
      console.error('Error in getImageByPostName:', error);
      res.status(500).json({ error: 'Failed to serve board member image' });
    }
  }

  // Serve individual board member image by filename (public)
  async getImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);
      
      const imagePath = join(boardMembersDir, decodedFilename);
      
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
      res.status(500).json({ error: 'Failed to serve board member image' });
    }
  }

  // Upload image (admin only) - expects single file with postName in body
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

      const postName = (req.body.postName || '').trim();
      if (!postName || !VALID_POST_NAMES.includes(postName)) {
        // Delete uploaded file if post name is invalid
        if (file.path) {
          try {
            unlinkSync(file.path);
          } catch (e) {
            // Ignore deletion errors
          }
        }
        res.status(400).json({ 
          error: 'Invalid post name. Must be one of: ' + VALID_POST_NAMES.join(', ') 
        });
        return;
      }

      // Get file extension from temp file
      const ext = file.filename.split('.').pop()?.toLowerCase() || 'jpg';
      
      // Generate final filename based on post name
      const finalFilename = `${postName.replace(/\s+/g, '_')}.${ext}`;
      const finalPath = join(boardMembersDir, finalFilename);
      
      // Delete existing file with same post name if it exists
      if (existsSync(finalPath)) {
        try {
          unlinkSync(finalPath);
        } catch (e) {
          console.error('Error deleting existing file:', e);
        }
      }
      
      // Rename temp file to final filename
      try {
        renameSync(file.path, finalPath);
      } catch (error: any) {
        // If rename fails, try to delete temp file
        try {
          unlinkSync(file.path);
        } catch (e) {
          // Ignore deletion errors
        }
        throw new Error('Failed to save file: ' + error.message);
      }

      res.json({
        message: 'Image uploaded successfully',
        uploaded: {
          postName: postName,
          filename: finalFilename,
          url: `/api/boardmembers/images/${encodeURIComponent(finalFilename)}`,
        },
      });
    } catch (error: any) {
      console.error('Error in handleImageUpload:', error);
      res.status(500).json({ error: 'Failed to upload image', details: error.message });
    }
  }

  // Delete board member image by post name (admin only)
  async deleteImageByPostName(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postName } = req.params;
      const decodedPostName = decodeURIComponent(postName);
      
      if (!existsSync(boardMembersDir)) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      const files = readdirSync(boardMembersDir);
      // Find file that matches the post name
      const matchingFile = files.find(file => {
        const filePostName = file.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        return filePostName === decodedPostName;
      });

      if (!matchingFile) {
        res.status(404).json({ error: 'Image not found for post: ' + decodedPostName });
        return;
      }

      const imagePath = join(boardMembersDir, matchingFile);
      unlinkSync(imagePath);
      res.json({ message: 'Image deleted successfully' });
    } catch (error: any) {
      console.error('Error in deleteImageByPostName:', error);
      res.status(500).json({ error: 'Failed to delete image', details: error.message });
    }
  }

  // Delete board member image by filename (admin only)
  async deleteImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);
      
      const imagePath = join(boardMembersDir, decodedFilename);
      
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

  // Get valid post names (public)
  async getPostNames(req: AuthRequest, res: Response): Promise<void> {
    res.json({ postNames: VALID_POST_NAMES });
  }
}

