import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { MagazineService } from '../services/MagazineService.js';

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
}


