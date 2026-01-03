import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { SpecialAccessService } from '../services/SpecialAccessService.js';

export class SpecialAccessController {
  private specialAccessService: SpecialAccessService;

  constructor() {
    this.specialAccessService = new SpecialAccessService();
  }

  async validateCode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { code } = req.body;

      if (!code) {
        res.status(400).json({ error: 'Access code is required' });
        return;
      }

      const accessCode = await this.specialAccessService.validateCode(code);
      if (!accessCode) {
        res.status(404).json({ error: 'Invalid or expired access code' });
        return;
      }

      res.json(accessCode);
    } catch (error) {
      res.status(500).json({ error: 'Failed to validate access code' });
    }
  }

  async getAllCodes(req: AuthRequest, res: Response): Promise<void> {
    try {
      const codes = await this.specialAccessService.getAllCodes();
      res.json(codes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch access codes' });
    }
  }

  async getCodeById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const code = await this.specialAccessService.getCodeById(id);
      if (!code) {
        res.status(404).json({ error: 'Access code not found' });
        return;
      }
      res.json(code);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch access code' });
    }
  }

  async createCode(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { description, resourceType, resourceId, expiresAt } = req.body;

      if (!resourceType) {
        res.status(400).json({ error: 'Resource type is required' });
        return;
      }

      const code = await this.specialAccessService.createCode({
        description,
        resourceType,
        resourceId,
        expiresAt,
        createdBy: req.user.userId,
      });

      res.status(201).json(code);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create access code' });
    }
  }

  async updateCode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const code = await this.specialAccessService.updateCode(id, updates);
      if (!code) {
        res.status(404).json({ error: 'Access code not found' });
        return;
      }

      res.json(code);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update access code' });
    }
  }

  async deleteCode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.specialAccessService.deleteCode(id);
      if (!success) {
        res.status(404).json({ error: 'Access code not found' });
        return;
      }

      res.json({ message: 'Access code deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete access code' });
    }
  }
}

