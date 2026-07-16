import { Request, Response, NextFunction } from 'express';

/**
 * Tiny dependency-free, in-memory rate limiter for abuse-prone public endpoints
 * (login brute-force, code guessing, contact/RSVP spam). Keyed on the real client
 * IP — Cloudflare's `CF-Connecting-IP` is preferred so each visitor is limited
 * individually behind the proxy. Fails OPEN on any error so it can never lock out
 * legitimate traffic.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return cf.trim();
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function rateLimit(opts: { windowMs: number; max: number; key?: string }) {
  const prefix = opts.key ?? 'rl';
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const id = `${prefix}:${clientIp(req)}`;
      const now = Date.now();
      const bucket = buckets.get(id);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(id, { count: 1, resetAt: now + opts.windowMs });
        next();
        return;
      }
      bucket.count += 1;
      if (bucket.count > opts.max) {
        res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
        res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
        return;
      }
      next();
    } catch {
      next(); // fail open — never block legitimate users on a limiter error
    }
  };
}

// Periodically drop expired buckets so memory stays bounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();
