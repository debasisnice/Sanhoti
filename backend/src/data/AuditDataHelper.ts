import { DatabaseHelper } from './DatabaseHelper.js';
import { AuditLog } from '../models/types.js';

export class AuditDataHelper extends DatabaseHelper {
  private readonly filename = 'auditLogs.json';

  async findAll(): Promise<AuditLog[]> {
    const logs = this.readFile<any>(this.filename);
    // Normalize createdAt to timestamp for backward compatibility
    const normalizedLogs = logs.map((log: any) => ({
      ...log,
      timestamp: log.timestamp || log.createdAt || new Date().toISOString()
    })) as AuditLog[];
    // Sort by timestamp descending (newest first)
    return normalizedLogs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async findById(id: string): Promise<AuditLog | null> {
    const logs = await this.findAll();
    return logs.find(l => l.id === id) || null;
  }

  async findByUserId(userId: string): Promise<AuditLog[]> {
    const logs = await this.findAll();
    return logs.filter(l => l.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async findByResource(resource: string, resourceId?: string): Promise<AuditLog[]> {
    const logs = await this.findAll();
    return logs.filter(l => {
      if (l.resource !== resource) return false;
      if (resourceId && l.resourceId !== resourceId) return false;
      return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async create(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const logs = await this.findAll();
    const newLog: AuditLog = {
      ...log,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      userEmail: log.userEmail || '',
    };
    logs.push(newLog);
    // Bound the file so admin mutations don't get slower forever (each write
    // rewrites the whole file). Keep the most recent entries by timestamp; older
    // ones age out. (`logs` came back newest-first, so cap by timestamp, not slice.)
    const MAX_AUDIT_LOGS = 20000;
    const toStore =
      logs.length > MAX_AUDIT_LOGS
        ? [...logs]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, MAX_AUDIT_LOGS)
        : logs;
    this.writeFile(this.filename, toStore);
    return newLog;
  }

  async getRecent(limit: number = 100): Promise<AuditLog[]> {
    const logs = await this.findAll();
    return logs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
}

