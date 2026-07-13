import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { DurgaPujaPageService } from '../services/DurgaPujaPageService.js';

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
}
