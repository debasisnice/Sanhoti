import { AuditDataHelper } from '../data/AuditDataHelper.js';
import { AuditLog } from '../models/types.js';

export class AuditService {
  private auditDataHelper: AuditDataHelper;

  constructor() {
    this.auditDataHelper = new AuditDataHelper();
  }

  async logAction(data: {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    return this.auditDataHelper.create(data);
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    return this.auditDataHelper.findAll();
  }

  async getAuditLogsByUser(userId: string): Promise<AuditLog[]> {
    return this.auditDataHelper.findByUserId(userId);
  }

  async getAuditLogsByResource(resource: string, resourceId?: string): Promise<AuditLog[]> {
    return this.auditDataHelper.findByResource(resource, resourceId);
  }

  async getRecentLogs(limit: number = 100): Promise<AuditLog[]> {
    return this.auditDataHelper.getRecent(limit);
  }
}

