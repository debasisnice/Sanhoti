import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const paymentQRDir = join(dirname(fileURLToPath(import.meta.url)), '../../data/PaymentQR');

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

export function findPaymentQRImagePath(): string | null {
  if (!existsSync(paymentQRDir)) return null;
  for (const file of readdirSync(paymentQRDir)) {
    if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(file)) continue;
    const filePath = join(paymentQRDir, file);
    try {
      if (statSync(filePath).isFile()) return filePath;
    } catch {
      /* ignore unreadable entries */
    }
  }
  return null;
}

/** Inline attachment for nodemailer — referenced in HTML as cid:payment-qr */
export function readPaymentQRAttachment(): {
  filename: string;
  content: Buffer;
  cid: string;
  contentType: string;
} | null {
  const filePath = findPaymentQRImagePath();
  if (!filePath) return null;
  const ext = filePath.toLowerCase().split('.').pop() || 'jpg';
  return {
    filename: `zelle-qr.${ext}`,
    content: readFileSync(filePath),
    cid: 'payment-qr',
    contentType: CONTENT_TYPE_BY_EXT[ext] ?? 'image/jpeg',
  };
}
