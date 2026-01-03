import { DatabaseHelper } from './DatabaseHelper.js';
import { AuditLog } from '../models/types.js';

export class AuditDataHelper extends DatabaseHelper {
  private readonly filename = 'auditLogs.json';

  async findAll(): Promise<AuditLog[]> {
    return this.readFile<AuditLog>(this.filename);
  }

  async findById(id: string): Promise<AuditLog | null> {
    const logs = await this.findAll();
    return logs.find(l => l.id === id) || null;
  }

  async findByUserId(userId: string): Promise<AuditLog[]> {
    const logs = await this.findAll();
    return logs.filter(l => l.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async findByResource(resource: string, resourceId?: string): Promise<AuditLog[]> {
    const logs = await this.findAll();
    return logs.filter(l => {
      if (l.resource !== resource) return false;
      if (resourceId && l.resourceId !== resourceId) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async create(log: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
    const logs = await this.findAll();
    const newLog: AuditLog = {
      ...log,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    };
    logs.push(newLog);
    this.writeFile(this.filename, logs);
    return newLog;
  }

  async getRecent(limit: number = 100): Promise<AuditLog[]> {
    const logs = await this.findAll();
    return logs
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
}

