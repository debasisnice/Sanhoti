import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { SettingsService } from '../services/SettingsService.js';

export class SettingsController {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  async getSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const settings = await this.settingsService.getSettings();
      res.json(settings);
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings', details: error.message });
    }
  }

  async updateNavbarSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const updates = req.body.navbar;
      if (!updates || typeof updates !== 'object') {
        res.status(400).json({ error: 'Invalid navbar settings' });
        return;
      }

      const settings = await this.settingsService.updateNavbarSettings(updates);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating navbar settings:', error);
      res.status(500).json({ error: 'Failed to update navbar settings', details: error.message });
    }
  }
}

