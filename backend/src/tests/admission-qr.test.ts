import { describe, it, expect } from 'vitest';
import {
  buildAdmissionQrPayload,
  generateAdmissionQrPng,
} from '../data/AdmissionQRHelper.js';
import { SeatBooking } from '../models/types.js';

describe('AdmissionQRHelper', () => {
  const booking: SeatBooking = {
    booking_id: 'BOOK12345678',
    event_id: 'EVT1',
    event_context: 'Durga Puja 2026',
    seat_ids: ['MAP|SEC:1:1'],
    seats_detail: [],
    name: 'Guest',
    email: 'guest@example.com',
    phone: '9495551234',
    subtotal: 60,
    discount_amount: 0,
    total: 60,
    status: 'confirmed',
    admission_qr_token: 'ADMITTOKEN12',
    created_at: '2026-07-14T23:13:00.000Z',
    updated_at: '2026-07-14T23:13:00.000Z',
  };

  it('builds a stable scan payload with booking id and token', () => {
    expect(buildAdmissionQrPayload(booking)).toBe('SANHOTI|BOOK12345678|ADMITTOKEN12');
  });

  it('generates a PNG buffer for the payload', async () => {
    const png = await generateAdmissionQrPng(buildAdmissionQrPayload(booking));
    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.length).toBeGreaterThan(100);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});
