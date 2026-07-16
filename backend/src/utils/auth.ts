import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';

const DEFAULT_SECRET = 'your-secret-key-change-in-production';
const JWT_SECRET: string = process.env.JWT_SECRET || DEFAULT_SECRET;
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

// Fail fast: never sign/verify with the public default secret in production —
// that would let anyone forge admin tokens. (Dev keeps working with the default.)
if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEFAULT_SECRET) {
  throw new Error(
    'JWT_SECRET must be set to a strong, non-default value in production. Refusing to start.'
  );
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}

export function generateToken(payload: { userId: string; email: string; role: string }): string {
  const secret = JWT_SECRET || 'your-secret-key-change-in-production';
  if (!secret || secret === 'your-secret-key-change-in-production') {
    console.warn('Warning: JWT_SECRET is using default value. This should be changed in production.');
  }
  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN } as SignOptions);
}

export function verifyToken(token: string): { userId: string; email: string; role: string } | null {
  try {
    const secret = JWT_SECRET || 'your-secret-key-change-in-production';
    return jwt.verify(token, secret) as { userId: string; email: string; role: string };
  } catch {
    return null;
  }
}

