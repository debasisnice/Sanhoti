import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { TicketSetupService } from '../services/TicketSetupService.js';

function status400(res: Response, error: unknown, fallback: string): void {
  const message = error instanceof Error ? error.message : '';
  if (message) {
    res.status(400).json({ error: message });
  } else {
    res.status(500).json({ error: fallback });
  }
}

export class TicketSetupController {
  private service = new TicketSetupService();

  async listSetups(_req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await this.service.listSetups());
    } catch {
      res.status(500).json({ error: 'Failed to list ticket setups' });
    }
  }

  async getSetup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const setup = await this.service.getSetup(req.params.id);
      if (!setup) {
        res.status(404).json({ error: 'Ticket setup not found' });
        return;
      }
      res.json(setup);
    } catch {
      res.status(500).json({ error: 'Failed to load ticket setup' });
    }
  }

  async saveActive(req: AuthRequest, res: Response): Promise<void> {
    try {
      const eventId = String(req.body?.event_id ?? '').trim();
      if (!eventId) {
        res.status(400).json({ error: 'event_id is required' });
        return;
      }
      res.json(await this.service.saveActiveFromLiveConfig(eventId));
    } catch (error) {
      status400(res, error, 'Failed to save ticket setup');
    }
  }

  async archiveSetup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const setup = await this.service.archiveSetup(req.params.id);
      if (!setup) {
        res.status(404).json({ error: 'Ticket setup not found' });
        return;
      }
      res.json(setup);
    } catch (error) {
      status400(res, error, 'Failed to archive ticket setup');
    }
  }

  async deleteSetup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await this.service.deleteSetup(req.params.id);
      if (!result.deleted) {
        res.status(404).json({ error: 'Ticket setup not found' });
        return;
      }
      res.json(result);
    } catch (error) {
      status400(res, error, 'Failed to delete ticket setup');
    }
  }
}
