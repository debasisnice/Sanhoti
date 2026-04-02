import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { HomePageStatements, HomeStatementTabsVisibility } from '../models/types.js';
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

  async updateZellePhoneNumber(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { phoneNumber } = req.body;
      if (typeof phoneNumber !== 'string') {
        res.status(400).json({ error: 'Invalid phone number' });
        return;
      }

      const settings = await this.settingsService.updateZellePhoneNumber(phoneNumber);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating Zelle phone number:', error);
      res.status(500).json({ error: 'Failed to update Zelle phone number', details: error.message });
    }
  }

  async updateSocialLinks(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { facebookLink, whatsappLink, instagramLink } = req.body;
      
      if (facebookLink !== undefined && typeof facebookLink !== 'string') {
        res.status(400).json({ error: 'Invalid Facebook link' });
        return;
      }
      
      if (whatsappLink !== undefined && typeof whatsappLink !== 'string') {
        res.status(400).json({ error: 'Invalid WhatsApp link' });
        return;
      }
      
      if (instagramLink !== undefined && typeof instagramLink !== 'string') {
        res.status(400).json({ error: 'Invalid Instagram link' });
        return;
      }

      const settings = await this.settingsService.updateSocialLinks(facebookLink, whatsappLink, instagramLink);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating social links:', error);
      res.status(500).json({ error: 'Failed to update social links', details: error.message });
    }
  }

  async updateEmailSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { emailAddress, emailPassword } = req.body;
      
      if (emailAddress !== undefined && typeof emailAddress !== 'string') {
        res.status(400).json({ error: 'Invalid email address' });
        return;
      }
      
      if (emailPassword !== undefined && typeof emailPassword !== 'string') {
        res.status(400).json({ error: 'Invalid email password' });
        return;
      }

      const settings = await this.settingsService.updateEmailSettings(emailAddress, emailPassword);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating email settings:', error);
      res.status(500).json({ error: 'Failed to update email settings', details: error.message });
    }
  }

  async getEmailSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const emailSettings = await this.settingsService.getEmailSettings();
      res.json(emailSettings);
    } catch (error: any) {
      console.error('Error fetching email settings:', error);
      res.status(500).json({ error: 'Failed to fetch email settings', details: error.message });
    }
  }

  async updateCommitteeYear(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { committeeYear } = req.body;
      if (typeof committeeYear !== 'string') {
        res.status(400).json({ error: 'Invalid committee year' });
        return;
      }

      const settings = await this.settingsService.updateCommitteeYear(committeeYear);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating committee year:', error);
      res.status(500).json({ error: 'Failed to update committee year', details: error.message });
    }
  }

  async updateHomeStatements(req: AuthRequest, res: Response): Promise<void> {
    try {
      const body = req.body ?? {};
      const keys = ['about', 'vision', 'mission', 'purpose'] as const;
      const textUpdates: Partial<HomePageStatements> = {};
      for (const k of keys) {
        if (body[k] !== undefined) {
          if (typeof body[k] !== 'string') {
            res.status(400).json({ error: `Invalid ${k}: must be a string` });
            return;
          }
          textUpdates[k] = body[k];
        }
      }

      let tabVisibilityPatch: Partial<HomeStatementTabsVisibility> | undefined;
      if (body.tabVisibility !== undefined) {
        if (typeof body.tabVisibility !== 'object' || body.tabVisibility === null) {
          res.status(400).json({ error: 'Invalid tabVisibility' });
          return;
        }
        const patch: Partial<HomeStatementTabsVisibility> = {};
        for (const k of keys) {
          if (body.tabVisibility[k] !== undefined) {
            if (typeof body.tabVisibility[k] !== 'boolean') {
              res.status(400).json({ error: `Invalid tabVisibility.${k}: must be a boolean` });
              return;
            }
            patch[k] = body.tabVisibility[k];
          }
        }
        if (Object.keys(patch).length > 0) {
          tabVisibilityPatch = patch;
        }
      }

      if (Object.keys(textUpdates).length === 0 && tabVisibilityPatch === undefined) {
        res.status(400).json({
          error: 'Provide statement text (about, vision, mission, purpose) and/or tabVisibility updates',
        });
        return;
      }

      const existing = await this.settingsService.getSettings();
      const prevVis = existing.statementTabsVisibility ?? {};
      const mergedVis =
        tabVisibilityPatch !== undefined ? { ...prevVis, ...tabVisibilityPatch } : prevVis;
      const anyVisible = keys.some((k) => mergedVis[k] !== false);
      if (!anyVisible) {
        res.status(400).json({ error: 'At least one statement tab must remain visible on the home page' });
        return;
      }

      const settings = await this.settingsService.updateHomeStatements(textUpdates, tabVisibilityPatch);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating home statements:', error);
      res.status(500).json({ error: 'Failed to update home statements', details: error.message });
    }
  }
}


