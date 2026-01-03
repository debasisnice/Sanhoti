import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { AuditService } from '../services/AuditService.js';

export function auditLog(action: string, resource: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to capture response
    res.json = function (body: unknown) {
      // Log audit trail after response is sent
      if (req.user) {
        const auditService = new AuditService();
        auditService.logAction({
          userId: req.user.userId,
          action,
          resource,
          resourceId: (req.params?.id || req.body?.id) as string | undefined,
          details: {
            method: req.method,
            path: req.path,
            body: req.method !== 'GET' ? req.body : undefined,
          },
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.get('user-agent'),
        }).catch(err => console.error('Audit log error:', err));
      }
      return originalJson(body);
    };

    next();
  };
}

