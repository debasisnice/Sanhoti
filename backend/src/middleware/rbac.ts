import { Response, NextFunction } from 'express';
import { UserRole } from '../models/types.js';
import { AuthRequest } from './auth.js';

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireRole('admin')(req, res, next);
}

export function requireMember(req: AuthRequest, res: Response, next: NextFunction): void {
  requireRole('admin', 'user')(req, res, next);
}

