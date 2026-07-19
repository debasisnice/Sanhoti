import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { DurgaPujaPageService } from '../services/DurgaPujaPageService.js';
import { randomBytes } from 'crypto';
import {
  durgaPujaImageDir,
  findDurgaPujaImageFile,
  durgaPujaPageImageExists,
  durgaPujaAssetDir,
  findDurgaPujaAssetFile,
  listDurgaPujaAssets,
  isDurgaPujaAssetCategory,
  durgaPujaSponsorshipPdfDir,
  durgaPujaSponsorshipPdfPath,
  durgaPujaSponsorshipPdfExists,
  type DurgaPujaAssetCategory,
} from '../data/DurgaPujaPageDataHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp)$/i;

function parseYearParam(raw: string | undefined): number | null {
  const year = parseInt(String(raw ?? ''), 10);
  return year >= 2000 && year <= 2100 ? year : null;
}

function imageStorageForYear(year: number) {
  const dir = durgaPujaImageDir(year);
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
      cb(null, `durga-puja-page.${ext}`);
    },
  });
}

function imageUpload(year: number) {
  return multer({
    storage: imageStorageForYear(year),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(file.originalname.toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      if (extname && mimetype) cb(null, true);
      else cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    },
  });
}

/** Whether a Durga Puja page image exists for a year (used by SeoPageController). */
export { durgaPujaPageImageExists };

export class DurgaPujaPageController {
  private service: DurgaPujaPageService;

  constructor() {
    this.service = new DurgaPujaPageService();
  }

  async listYears(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const years = await this.service.listYears();
      const activeYear = await this.service.getActiveYear();
      res.json({ years, activeYear });
    } catch (error: any) {
      console.error('Error listing Durga Puja years:', error);
      res.status(500).json({ error: 'Failed to list Durga Puja page years' });
    }
  }

  async getActive(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const activeYear = await this.service.getActiveYear();
      const content = await this.service.getContentByYear(activeYear);
      if (!content) {
        res.status(404).json({ error: 'Active Durga Puja page not found' });
        return;
      }
      res.json({ year: activeYear, content });
    } catch (error: any) {
      console.error('Error fetching active Durga Puja page:', error);
      res.status(500).json({ error: 'Failed to fetch active Durga Puja page' });
    }
  }

  async getContent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const year = parseYearParam(req.params.year);
      const content = year
        ? await this.service.getContentByYear(year)
        : await this.service.getContent();
      if (!content) {
        res.status(404).json({ error: 'Durga Puja page not found' });
        return;
      }
      res.json(content);
    } catch (error: any) {
      console.error('Error fetching Durga Puja page content:', error);
      res.status(500).json({ error: 'Failed to fetch Durga Puja page content' });
    }
  }

  async updateContent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const year = parseYearParam(req.params.year) ?? (await this.service.getActiveYear());
      const content = await this.service.updateContent(year, req.body ?? {});
      res.json(content);
    } catch (error: any) {
      console.error('Error updating Durga Puja page content:', error);
      res.status(400).json({ error: error.message || 'Failed to update Durga Puja page content' });
    }
  }

  async getImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const year = parseYearParam(req.params.year) ?? (await this.service.getActiveYear());
      const imageFile = findDurgaPujaImageFile(year);
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
      res.sendFile(resolve(imageFile), {
        headers: { 'Content-Type': contentTypeMap[ext || ''] || 'image/jpeg' },
      });
    } catch (error: any) {
      console.error('Error serving Durga Puja page image:', error);
      res.status(500).json({ error: 'Failed to serve image' });
    }
  }

  async hasImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const year = parseYearParam(req.params.year) ?? (await this.service.getActiveYear());
      res.json({ hasImage: durgaPujaPageImageExists(year) });
    } catch {
      res.json({ hasImage: false });
    }
  }

  uploadImage() {
    return (req: AuthRequest, res: Response, next: () => void) => {
      const year = parseYearParam(req.params.year);
      if (!year) {
        res.status(400).json({ error: 'Invalid year' });
        return;
      }
      imageUpload(year).single('image')(req, res, next);
    };
  }

  async handleImageUpload(req: AuthRequest, res: Response): Promise<void> {
    try {
      const year = parseYearParam(req.params.year);
      if (!year) {
        res.status(400).json({ error: 'Invalid year' });
        return;
      }
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      const dir = durgaPujaImageDir(year);
      for (const existing of readdirSync(dir)) {
        try {
          if (
            existing !== file.filename &&
            IMAGE_RE.test(existing) &&
            statSync(join(dir, existing)).isFile()
          ) {
            unlinkSync(join(dir, existing));
          }
        } catch {
          /* ignore */
        }
      }
      res.json({
        message: 'Image uploaded successfully',
        uploaded: { filename: file.filename, url: `/api/durga-puja-page/${year}/image` },
      });
    } catch (error: any) {
      console.error('Error uploading Durga Puja page image:', error);
      res.status(500).json({ error: 'Failed to upload image', details: error.message });
    }
  }

  // ---- Sponsorship prospectus PDF (one per year) ----

  uploadSponsorshipPdf() {
    return (req: AuthRequest, res: Response, next: () => void) => {
      const year = parseYearParam(req.params.year);
      if (!year) {
        res.status(400).json({ error: 'Invalid year' });
        return;
      }
      const dir = durgaPujaSponsorshipPdfDir(year);
      const storage = multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, dir),
        filename: (_req, _file, cb) => cb(null, 'sponsorship-prospectus.pdf'),
      });
      multer({
        storage,
        limits: { fileSize: 25 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
          // Accept by extension OR pdf mimetype — some browsers/OSes send
          // application/octet-stream for .pdf files, which shouldn't be rejected.
          const okExt = /\.pdf$/i.test(file.originalname);
          const okMime = /pdf/i.test(file.mimetype);
          if (okExt || okMime) cb(null, true);
          else cb(new Error('Only PDF files are allowed'));
        },
      }).single('pdf')(req, res, next);
    };
  }

  async handleSponsorshipPdfUpload(req: AuthRequest, res: Response): Promise<void> {
    try {
      const year = parseYearParam(req.params.year);
      if (!year) {
        res.status(400).json({ error: 'Invalid year' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      res.json({
        message: 'Sponsorship prospectus uploaded',
        url: `/api/durga-puja-page/${year}/sponsorship-pdf`,
      });
    } catch (error: any) {
      console.error('Error uploading sponsorship PDF:', error);
      res.status(500).json({ error: 'Failed to upload PDF', details: error.message });
    }
  }

  async getSponsorshipPdf(req: AuthRequest, res: Response): Promise<void> {
    try {
      const year = parseYearParam(req.params.year);
      if (!year || !durgaPujaSponsorshipPdfExists(year)) {
        res.status(404).json({ error: 'Sponsorship prospectus not found' });
        return;
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="sponsorship-prospectus.pdf"');
      res.sendFile(resolve(durgaPujaSponsorshipPdfPath(year)));
    } catch (error: any) {
      console.error('Error serving sponsorship PDF:', error);
      res.status(500).json({ error: 'Failed to serve PDF' });
    }
  }

  async hasSponsorshipPdf(req: AuthRequest, res: Response): Promise<void> {
    try {
      const year = parseYearParam(req.params.year);
      res.json({ hasPdf: year ? durgaPujaSponsorshipPdfExists(year) : false });
    } catch {
      res.json({ hasPdf: false });
    }
  }

  async deleteSponsorshipPdf(req: AuthRequest, res: Response): Promise<void> {
    try {
      const year = parseYearParam(req.params.year);
      if (!year) {
        res.status(400).json({ error: 'Invalid year' });
        return;
      }
      const file = durgaPujaSponsorshipPdfPath(year);
      if (existsSync(file)) unlinkSync(file);
      res.json({ message: 'Sponsorship prospectus removed' });
    } catch (error: any) {
      console.error('Error deleting sponsorship PDF:', error);
      res.status(500).json({ error: 'Failed to delete PDF' });
    }
  }

  // ---- Generic per-category assets (artist/food/venue/gallery/qr images) ----

  private parseAssetCategory(raw: string | undefined): DurgaPujaAssetCategory | null {
    const value = String(raw ?? '');
    return isDurgaPujaAssetCategory(value) ? value : null;
  }

  uploadAsset() {
    return (req: AuthRequest, res: Response, next: () => void) => {
      const year = parseYearParam(req.params.year);
      const category = this.parseAssetCategory(req.params.category);
      if (!year) {
        res.status(400).json({ error: 'Invalid year' });
        return;
      }
      if (!category) {
        res.status(400).json({ error: 'Invalid asset category' });
        return;
      }
      const dir = durgaPujaAssetDir(year, category);
      const storage = multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, dir),
        filename: (_req, file, cb) => {
          const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
          cb(null, `${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`);
        },
      });
      multer({
        storage,
        limits: { fileSize: 20 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
          const allowed = /jpeg|jpg|png|gif|webp/;
          if (allowed.test(file.originalname.toLowerCase()) && allowed.test(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
          }
        },
      }).single('image')(req, res, next);
    };
  }

  async handleAssetUpload(req: AuthRequest, res: Response): Promise<void> {
    try {
      const year = parseYearParam(req.params.year);
      const category = this.parseAssetCategory(req.params.category);
      if (!year || !category) {
        res.status(400).json({ error: 'Invalid year or category' });
        return;
      }
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      res.json({
        message: 'Asset uploaded successfully',
        filename: file.filename,
        url: `/api/durga-puja-page/${year}/assets/${category}/${file.filename}`,
      });
    } catch (error: any) {
      console.error('Error uploading Durga Puja asset:', error);
      res.status(500).json({ error: 'Failed to upload asset', details: error.message });
    }
  }

  async listAssets(req: AuthRequest, res: Response): Promise<void> {
    try {
      const year = parseYearParam(req.params.year);
      const category = this.parseAssetCategory(req.params.category);
      if (!year || !category) {
        res.status(400).json({ error: 'Invalid year or category' });
        return;
      }
      const assets = listDurgaPujaAssets(year, category).map(filename => ({
        filename,
        url: `/api/durga-puja-page/${year}/assets/${category}/${filename}`,
      }));
      res.json({ assets });
    } catch (error: any) {
      console.error('Error listing Durga Puja assets:', error);
      res.status(500).json({ error: 'Failed to list assets' });
    }
  }

  async getAsset(req: AuthRequest, res: Response): Promise<void> {
    try {
      const year = parseYearParam(req.params.year);
      const category = this.parseAssetCategory(req.params.category);
      if (!year || !category) {
        res.status(404).json({ error: 'Asset not found' });
        return;
      }
      const file = findDurgaPujaAssetFile(year, category, req.params.filename);
      if (!file) {
        res.status(404).json({ error: 'Asset not found' });
        return;
      }
      const ext = file.toLowerCase().split('.').pop();
      const contentTypeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
      };
      res.sendFile(resolve(file), {
        headers: { 'Content-Type': contentTypeMap[ext || ''] || 'image/jpeg' },
      });
    } catch (error: any) {
      console.error('Error serving Durga Puja asset:', error);
      res.status(500).json({ error: 'Failed to serve asset' });
    }
  }

  async deleteAsset(req: AuthRequest, res: Response): Promise<void> {
    try {
      const year = parseYearParam(req.params.year);
      const category = this.parseAssetCategory(req.params.category);
      if (!year || !category) {
        res.status(400).json({ error: 'Invalid year or category' });
        return;
      }
      const file = findDurgaPujaAssetFile(year, category, req.params.filename);
      if (!file) {
        res.status(404).json({ error: 'Asset not found' });
        return;
      }
      unlinkSync(file);
      res.json({ message: 'Asset deleted' });
    } catch (error: any) {
      console.error('Error deleting Durga Puja asset:', error);
      res.status(500).json({ error: 'Failed to delete asset' });
    }
  }

  async deleteImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const year = parseYearParam(req.params.year);
      if (!year) {
        res.status(400).json({ error: 'Invalid year' });
        return;
      }
      const dir = durgaPujaImageDir(year);
      let deleted = 0;
      if (existsSync(dir)) {
        for (const file of readdirSync(dir)) {
          try {
            if (IMAGE_RE.test(file) && statSync(join(dir, file)).isFile()) {
              unlinkSync(join(dir, file));
              deleted++;
            }
          } catch (error) {
            console.error(`Error deleting ${file}:`, error);
          }
        }
      }
      res.json({ message: 'Image deleted', deleted });
    } catch (error: any) {
      console.error('Error deleting Durga Puja page image:', error);
      res.status(500).json({ error: 'Failed to delete image' });
    }
  }
}
