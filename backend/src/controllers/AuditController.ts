import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { AuditService } from '../services/AuditService.js';

export class AuditController {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService();
  }

  async getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const logs = await this.auditService.getAuditLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }

  async getRecentLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await this.auditService.getRecentLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }

  async getLogsByUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const logs = await this.auditService.getAuditLogsByUser(userId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }

  async getLogsByResource(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { resource, resourceId } = req.params;
      const logs = await this.auditService.getAuditLogsByResource(resource, resourceId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }
}

