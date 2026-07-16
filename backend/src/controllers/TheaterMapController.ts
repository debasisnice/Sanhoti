import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { TheaterMapService } from '../services/TheaterMapService.js';

function status400(res: Response, error: unknown, fallback: string): void {
  const message = error instanceof Error ? error.message : '';
  if (message) {
    res.status(400).json({ error: message });
  } else {
    res.status(500).json({ error: fallback });
  }
}

export class TheaterMapController {
  private service = new TheaterMapService();

  async listMaps(_req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await this.service.listMaps());
    } catch {
      res.status(500).json({ error: 'Failed to list theater maps' });
    }
  }

  async createMap(req: AuthRequest, res: Response): Promise<void> {
    try {
      const created = await this.service.createMap(req.body ?? {});
      res.status(201).json(created);
    } catch (error) {
      status400(res, error, 'Failed to create theater map');
    }
  }

  async updateMap(req: AuthRequest, res: Response): Promise<void> {
    try {
      const updated = await this.service.updateMap(req.params.id, req.body ?? {});
      if (!updated) {
        res.status(404).json({ error: 'Theater map not found' });
        return;
      }
      res.json(updated);
    } catch (error) {
      status400(res, error, 'Failed to update theater map');
    }
  }

  async deleteMap(req: AuthRequest, res: Response): Promise<void> {
    try {
      const deleted = await this.service.deleteMap(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Theater map not found' });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      status400(res, error, 'Failed to delete theater map');
    }
  }
}
