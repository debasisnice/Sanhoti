import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { MagazineService } from '../services/MagazineService.js';
import multer from 'multer';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const magazinesDir = join(__dirname, '../../data/Magazines');

// Ensure magazines directory exists
if (!existsSync(magazinesDir)) {
  mkdirSync(magazinesDir, { recursive: true });
}

// Configure multer for PDF file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, magazinesDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename and add timestamp
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${sanitized}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for PDFs
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf/;
    const extname = allowedTypes.test(file.originalname.toLowerCase().split('.').pop() || '');
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/pdf';
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

export class MagazineController {
  private magazineService: MagazineService;

  constructor() {
    this.magazineService = new MagazineService();
  }

  async getPublicMagazines(req: AuthRequest, res: Response): Promise<void> {
    try {
      const magazines = await this.magazineService.getPublicMagazines();
      res.json(magazines);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch magazines' });
    }
  }

  async getAllMagazines(req: AuthRequest, res: Response): Promise<void> {
    try {
      const magazines = await this.magazineService.getAllMagazines();
      res.json(magazines);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch magazines' });
    }
  }

  async getMagazineById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const magazine = await this.magazineService.getMagazineById(id);
      if (!magazine) {
        res.status(404).json({ error: 'Magazine not found' });
        return;
      }
      res.json(magazine);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch magazine' });
    }
  }

  async getMagazineByAccessCode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      const magazine = await this.magazineService.getMagazineByAccessCode(code);
      if (!magazine) {
        res.status(404).json({ error: 'Magazine not found or invalid access code' });
        return;
      }
      res.json(magazine);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch magazine' });
    }
  }

  async createMagazine(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { title, description, fileUrl, coverImageUrl, isPublic, specialAccessCode, publishDate } = req.body;

      if (!title || !fileUrl || !publishDate) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const magazine = await this.magazineService.createMagazine({
        title,
        description,
        fileUrl,
        coverImageUrl,
        isPublic: isPublic !== undefined ? isPublic : false,
        specialAccessCode,
        publishDate,
        createdBy: req.user.userId,
      });

      res.status(201).json(magazine);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create magazine' });
    }
  }

  async updateMagazine(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const magazine = await this.magazineService.updateMagazine(id, updates);
      if (!magazine) {
        res.status(404).json({ error: 'Magazine not found' });
        return;
      }

      res.json(magazine);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update magazine' });
    }
  }

  async deleteMagazine(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.magazineService.deleteMagazine(id);
      if (!success) {
        res.status(404).json({ error: 'Magazine not found' });
        return;
      }

      res.json({ message: 'Magazine deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete magazine' });
    }
  }

  // Upload PDF file (admin only)
  uploadMagazine() {
    return upload.single('magazine');
  }

  async handleMagazineUpload(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const { title, description, isPublic } = req.body;

      if (!title) {
        // Delete uploaded file if title is missing
        if (existsSync(file.path)) {
          unlinkSync(file.path);
        }
        res.status(400).json({ error: 'Magazine title is required' });
        return;
      }

      // Create file URL
      const fileUrl = `/api/magazines/files/${encodeURIComponent(file.filename)}`;

      // Create magazine record
      const magazine = await this.magazineService.createMagazine({
        title,
        description: description || '',
        fileUrl,
        isPublic: isPublic === 'true' || isPublic === true,
        publishDate: new Date().toISOString(),
        createdBy: req.user.userId,
      });

      res.status(201).json(magazine);
    } catch (error: any) {
      // Clean up uploaded file on error
      if (req.file && existsSync(req.file.path)) {
        try {
          unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }
      console.error('Error in handleMagazineUpload:', error);
      res.status(500).json({ error: 'Failed to upload magazine', details: error.message });
    }
  }

  // Serve PDF file (public)
  async serveMagazineFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);
      
      const filePath = join(magazinesDir, decodedFilename);
      
      if (!existsSync(filePath)) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // sendFile requires an absolute path
      const absolutePath = resolve(filePath);
      res.sendFile(absolutePath, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${decodedFilename}"`,
        },
      });
    } catch (error: any) {
      console.error('Error in serveMagazineFile:', error);
      res.status(500).json({ error: 'Failed to serve magazine file' });
    }
  }

  // Delete magazine file and record (admin only)
  async deleteMagazineWithFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Get magazine to find file path
      const magazine = await this.magazineService.getMagazineById(id);
      if (!magazine) {
        res.status(404).json({ error: 'Magazine not found' });
        return;
      }

      // Extract filename from fileUrl
      const fileUrl = magazine.fileUrl;
      const filenameMatch = fileUrl.match(/\/files\/(.+)$/);
      if (filenameMatch) {
        const filename = decodeURIComponent(filenameMatch[1]);
        const filePath = join(magazinesDir, filename);
        
        // Delete file if it exists
        if (existsSync(filePath)) {
          try {
            unlinkSync(filePath);
          } catch (error) {
            console.error('Error deleting file:', error);
          }
        }
      }

      // Delete magazine record
      const success = await this.magazineService.deleteMagazine(id);
      if (!success) {
        res.status(404).json({ error: 'Magazine not found' });
        return;
      }

      res.json({ message: 'Magazine deleted successfully' });
    } catch (error: any) {
      console.error('Error in deleteMagazineWithFile:', error);
      res.status(500).json({ error: 'Failed to delete magazine', details: error.message });
    }
  }

  // Get list of PDF files in directory (admin only)
  async getMagazineFiles(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!existsSync(magazinesDir)) {
        res.json([]);
        return;
      }

      const files = readdirSync(magazinesDir);
      const pdfFiles = files
        .filter(file => {
          const filePath = join(magazinesDir, file);
          try {
            const stats = statSync(filePath);
            const isPdf = /\.pdf$/i.test(file);
            return stats.isFile() && isPdf;
          } catch (error) {
            return false;
          }
        })
        .map(file => ({
          filename: file,
          url: `/api/magazines/files/${encodeURIComponent(file)}`,
        }))
        .sort((a, b) => a.filename.localeCompare(b.filename));

      res.json(pdfFiles);
    } catch (error: any) {
      console.error('Error in getMagazineFiles:', error);
      res.status(500).json({ error: 'Failed to fetch magazine files' });
    }
  }
}


