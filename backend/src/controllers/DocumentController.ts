import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { DocumentService } from '../services/DocumentService.js';
import multer from 'multer';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const documentsDir = join(__dirname, '../../data/Documents');

// Ensure documents directory exists
if (!existsSync(documentsDir)) {
  mkdirSync(documentsDir, { recursive: true });
}

// Configure multer for PDF file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentsDir);
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

export class DocumentController {
  private documentService: DocumentService;

  constructor() {
    this.documentService = new DocumentService();
  }

  async getPublicDocuments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const documents = await this.documentService.getPublicDocuments();
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  }

  async getAllDocuments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const documents = await this.documentService.getAllDocuments();
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  }

  async getDocumentById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const document = await this.documentService.getDocumentById(id);
      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      res.json(document);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch document' });
    }
  }

  async getDocumentByAccessCode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      const document = await this.documentService.getDocumentByAccessCode(code);
      if (!document) {
        res.status(404).json({ error: 'Document not found or invalid access code' });
        return;
      }
      res.json(document);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch document' });
    }
  }

  async createDocument(req: AuthRequest, res: Response): Promise<void> {
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

      const document = await this.documentService.createDocument({
        title,
        description,
        fileUrl,
        coverImageUrl,
        isPublic: isPublic !== undefined ? isPublic : false,
        specialAccessCode,
        publishDate,
        createdBy: req.user.userId,
      });

      res.status(201).json(document);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create document' });
    }
  }

  async updateDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const document = await this.documentService.updateDocument(id, updates);
      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      res.json(document);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update document' });
    }
  }

  async deleteDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.documentService.deleteDocument(id);
      if (!success) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      res.json({ message: 'Document deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete document' });
    }
  }

  // Upload PDF file (admin only)
  uploadDocument() {
    return upload.single('document');
  }

  async handleDocumentUpload(req: AuthRequest, res: Response): Promise<void> {
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
        res.status(400).json({ error: 'Document title is required' });
        return;
      }

      // Create file URL
      const fileUrl = `/api/documents/files/${encodeURIComponent(file.filename)}`;

      // Create document record
      const document = await this.documentService.createDocument({
        title,
        description: description || '',
        fileUrl,
        isPublic: isPublic === 'true' || isPublic === true,
        publishDate: new Date().toISOString(),
        createdBy: req.user.userId,
      });

      res.status(201).json(document);
    } catch (error: any) {
      // Clean up uploaded file on error
      if (req.file && existsSync(req.file.path)) {
        try {
          unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }
      console.error('Error in handleDocumentUpload:', error);
      res.status(500).json({ error: 'Failed to upload document', details: error.message });
    }
  }

  // Serve PDF file (public)
  async serveDocumentFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);
      
      const filePath = join(documentsDir, decodedFilename);
      
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
      console.error('Error in serveDocumentFile:', error);
      res.status(500).json({ error: 'Failed to serve document file' });
    }
  }

  // Delete document file and record (admin only)
  async deleteDocumentWithFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Get document to find file path
      const document = await this.documentService.getDocumentById(id);
      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      // Extract filename from fileUrl
      const fileUrl = document.fileUrl;
      const filenameMatch = fileUrl.match(/\/files\/(.+)$/);
      if (filenameMatch) {
        const filename = decodeURIComponent(filenameMatch[1]);
        const filePath = join(documentsDir, filename);
        
        // Delete file if it exists
        if (existsSync(filePath)) {
          try {
            unlinkSync(filePath);
          } catch (error) {
            console.error('Error deleting file:', error);
          }
        }
      }

      // Delete document record
      const success = await this.documentService.deleteDocument(id);
      if (!success) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      res.json({ message: 'Document deleted successfully' });
    } catch (error: any) {
      console.error('Error in deleteDocumentWithFile:', error);
      res.status(500).json({ error: 'Failed to delete document', details: error.message });
    }
  }

  // Get list of PDF files in directory (admin only)
  async getDocumentFiles(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!existsSync(documentsDir)) {
        res.json([]);
        return;
      }

      const files = readdirSync(documentsDir);
      const pdfFiles = files
        .filter(file => {
          const filePath = join(documentsDir, file);
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
          url: `/api/documents/files/${encodeURIComponent(file)}`,
        }))
        .sort((a, b) => a.filename.localeCompare(b.filename));

      res.json(pdfFiles);
    } catch (error: any) {
      console.error('Error in getDocumentFiles:', error);
      res.status(500).json({ error: 'Failed to fetch document files' });
    }
  }
}

