import { safeServedFilename } from '../utils/safeFile.js';
import express, { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { NewsService } from '../services/NewsService.js';
import multer from 'multer';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const newsMediaDir = join(__dirname, '../../data/News_Media');

// Configure multer for file uploads (videos and images)
const tempDir = join(newsMediaDir, '.temp');
if (!existsSync(tempDir)) {
  mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${sanitized}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit (for videos)
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi|webm|mkv/;
    const allowedMimeTypes = /image\/(jpeg|jpg|png|gif|webp)|video\/(mp4|quicktime|x-msvideo|webm|x-matroska)/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedMimeTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, gif, webp) and video files (mp4, mov, avi, webm, mkv) are allowed'));
    }
  },
});

export class NewsController {
  private newsService: NewsService;

  constructor() {
    this.newsService = new NewsService();
  }

  // Get all published news (public endpoint)
  async getPublishedNews(req: express.Request, res: Response): Promise<void> {
    try {
      const news = await this.newsService.getPublishedNews();
      res.json(news);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch news' });
    }
  }

  // Get all news (admin only)
  async getAllNews(req: AuthRequest, res: Response): Promise<void> {
    try {
      const news = await this.newsService.getAllNews();
      res.json(news);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch news' });
    }
  }

  // Get news by ID
  async getNewsById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const news = await this.newsService.getNewsById(id);
      if (!news) {
        res.status(404).json({ error: 'News not found' });
        return;
      }
      res.json(news);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch news' });
    }
  }

  // Create news
  uploadMedia() {
    return upload.single('media');
  }

  async createNews(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { title, content, media_type, media_url, is_active, is_published } = req.body;

      if (!title || !content || !media_type) {
        res.status(400).json({ error: 'Missing required fields: title, content, and media_type are required' });
        return;
      }

      // Validate media_type
      const validMediaTypes = ['video', 'link', 'article', 'image'];
      if (!validMediaTypes.includes(media_type)) {
        res.status(400).json({ error: `Invalid media_type. Must be one of: ${validMediaTypes.join(', ')}` });
        return;
      }

      let media_file_path: string | undefined = undefined;

      // Handle file upload for video/image types
      if ((media_type === 'video' || media_type === 'image') && req.file) {
        const file = req.file;
        const newsMediaDir = this.newsService.getNewsMediaDir();
        const sanitizedTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
        const timestamp = Date.now();
        const fileName = `${timestamp}-${sanitizedTitle}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const destPath = join(newsMediaDir, fileName);
        
        renameSync(file.path, destPath);
        media_file_path = fileName;
      } else if (media_type === 'video' || media_type === 'image') {
        // If media_type is video/image but no file uploaded, require media_url
        if (!media_url) {
          res.status(400).json({ error: `media_url is required for ${media_type} type when no file is uploaded` });
          return;
        }
      } else if (media_type === 'link') {
        // For link type, media_url is required
        if (!media_url) {
          res.status(400).json({ error: 'media_url is required for link type' });
          return;
        }
      }
      // For article type, no media is required

      const news = await this.newsService.createNews({
        title,
        content,
        media_type: media_type as 'video' | 'link' | 'article' | 'image',
        media_url: media_url || undefined,
        media_file_path,
        is_active: is_active !== undefined ? is_active : true,
        is_published: is_published !== undefined ? is_published : false,
        created_by: req.user.userId,
      });

      res.status(201).json(news);
    } catch (error: any) {
      console.error('Error creating news:', error);
      res.status(500).json({ error: error.message || 'Failed to create news' });
    }
  }

  // Update news
  async updateNews(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      const { title, content, media_type, media_url, is_active, is_published } = req.body;

      const existingNews = await this.newsService.getNewsById(id);
      if (!existingNews) {
        res.status(404).json({ error: 'News not found' });
        return;
      }

      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (media_type !== undefined) {
        const validMediaTypes = ['video', 'link', 'article', 'image'];
        if (!validMediaTypes.includes(media_type)) {
          res.status(400).json({ error: `Invalid media_type. Must be one of: ${validMediaTypes.join(', ')}` });
          return;
        }
        updates.media_type = media_type;
      }
      if (media_url !== undefined) updates.media_url = media_url;
      if (is_active !== undefined) {
        updates.is_active = is_active;
        // If deactivating, also unpublish
        if (is_active === false) {
          updates.is_published = false;
        }
      }
      if (is_published !== undefined) {
        // Cannot publish inactive news
        if (is_published === true && existingNews.is_active === false) {
          res.status(400).json({ error: 'Cannot publish inactive news. Please activate the news first.' });
          return;
        }
        updates.is_published = is_published;
      }

      const updatedNews = await this.newsService.updateNews(id, updates);
      if (!updatedNews) {
        res.status(404).json({ error: 'News not found' });
        return;
      }

      res.json(updatedNews);
    } catch (error: any) {
      console.error('Error updating news:', error);
      res.status(500).json({ error: error.message || 'Failed to update news' });
    }
  }

  // Delete news
  async deleteNews(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      const news = await this.newsService.getNewsById(id);
      
      if (!news) {
        res.status(404).json({ error: 'News not found' });
        return;
      }

      // Delete associated media file if exists
      if (news.media_file_path) {
        const filePath = join(newsMediaDir, news.media_file_path);
        if (existsSync(filePath)) {
          try {
            unlinkSync(filePath);
          } catch (error) {
            console.error(`Error deleting media file ${filePath}:`, error);
            // Continue with news deletion even if file deletion fails
          }
        }
      }

      const success = await this.newsService.deleteNews(id);
      if (!success) {
        res.status(404).json({ error: 'News not found' });
        return;
      }

      res.json({ message: 'News deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting news:', error);
      res.status(500).json({ error: error.message || 'Failed to delete news' });
    }
  }

  // Get archived news (public endpoint)
  async getArchivedNews(req: express.Request, res: Response): Promise<void> {
    try {
      const news = await this.newsService.getArchivedNews();
      res.json(news);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch archived news' });
    }
  }

  // Archive news (admin only)
  async archiveNews(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      const news = await this.newsService.archiveNews(id);
      
      if (!news) {
        res.status(404).json({ error: 'News not found' });
        return;
      }

      res.json(news);
    } catch (error: any) {
      console.error('Error archiving news:', error);
      res.status(500).json({ error: error.message || 'Failed to archive news' });
    }
  }

  // Unarchive news (admin only)
  async unarchiveNews(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      const news = await this.newsService.unarchiveNews(id);
      
      if (!news) {
        res.status(404).json({ error: 'News not found' });
        return;
      }

      res.json(news);
    } catch (error: any) {
      console.error('Error unarchiving news:', error);
      res.status(500).json({ error: error.message || 'Failed to unarchive news' });
    }
  }

  // Serve media files (public access)
  async serveMedia(req: express.Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      const decodedFilename = safeServedFilename(decodeURIComponent(filename));
      const filePath = join(newsMediaDir, decodedFilename);

      if (!existsSync(filePath)) {
        res.status(404).json({ error: 'Media file not found' });
        return;
      }

      // Set appropriate content type
      const ext = decodedFilename.split('.').pop()?.toLowerCase();
      const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                         ext === 'png' ? 'image/png' :
                         ext === 'gif' ? 'image/gif' :
                         ext === 'webp' ? 'image/webp' :
                         ext === 'mp4' ? 'video/mp4' :
                         ext === 'mov' ? 'video/quicktime' :
                         ext === 'avi' ? 'video/x-msvideo' :
                         ext === 'webm' ? 'video/webm' :
                         ext === 'mkv' ? 'video/x-matroska' :
                         'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.sendFile(resolve(filePath));
    } catch (error: any) {
      console.error('Error serving media:', error);
      res.status(500).json({ error: 'Failed to serve media file' });
    }
  }
}

