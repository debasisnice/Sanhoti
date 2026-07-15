import QRCode from 'qrcode';
import { SeatBooking } from '../models/types.js';

/** Payload encoded in the event-day admission QR — lookup by token in seatBookings.json. */
export function buildAdmissionQrPayload(booking: SeatBooking): string {
  const token = String(booking.admission_qr_token ?? '').trim();
  if (!token) throw new Error('Booking has no admission QR token');
  return `SANHOTI|${booking.booking_id}|${token}`;
}

export async function generateAdmissionQrPng(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: 'png',
    width: 280,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}

/** Inline attachment for nodemailer — referenced in HTML as cid:admission-qr */
export async function buildAdmissionQrAttachment(booking: SeatBooking): Promise<{
  filename: string;
  content: Buffer;
  cid: string;
  contentType: string;
} | null> {
  if (!booking.admission_qr_token) return null;
  const payload = buildAdmissionQrPayload(booking);
  const content = await generateAdmissionQrPng(payload);
  return {
    filename: `admission-${booking.booking_id}.png`,
    content,
    cid: 'admission-qr',
    contentType: 'image/png',
  };
}
