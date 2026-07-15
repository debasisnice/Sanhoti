import { describe, it, expect } from 'vitest';
import {
  applyPaymentExpirySweep,
  bookingBlocksSeats,
  countPendingBookingsForEmail,
  extendPaymentDueAt,
  findSeatConflictsForRevive,
  paymentDueAtFromCreated,
  paymentDueAtFromNow,
  MAX_PENDING_BOOKINGS_PER_EMAIL,
} from '../data/bookingLifecycle.js';
import { SeatBooking } from '../models/types.js';

function sampleBooking(overrides: Partial<SeatBooking> = {}): SeatBooking {
  return {
    booking_id: 'BK001',
    event_id: 'EVT1',
    event_context: 'Test Event',
    seat_ids: ['MAP|SEC:1:1'],
    seats_detail: [],
    name: 'Guest',
    email: 'guest@example.com',
    phone: '5551234567',
    subtotal: 50,
    discount_amount: 0,
    total: 50,
    status: 'pending_payment',
    created_at: '2026-07-01T12:00:00.000Z',
    updated_at: '2026-07-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('booking lifecycle (Phase 1)', () => {
  it('stamps payment_due_at from window hours at checkout time', () => {
    const now = Date.parse('2026-07-01T12:00:00.000Z');
    const due = paymentDueAtFromNow(48, now);
    expect(due).toBe('2026-07-03T12:00:00.000Z');
  });

  it('backfills legacy pending bookings and expires overdue ones', () => {
    const now = Date.parse('2026-07-10T12:00:00.000Z');
    const bookings = [
      sampleBooking({
        booking_id: 'PENDING-OK',
        payment_due_at: '2026-07-11T12:00:00.000Z',
      }),
      sampleBooking({
        booking_id: 'PENDING-LATE',
        payment_due_at: '2026-07-09T12:00:00.000Z',
      }),
      sampleBooking({
        booking_id: 'LEGACY',
        payment_due_at: undefined,
        created_at: '2026-07-09T12:00:00.000Z',
      }),
      sampleBooking({ booking_id: 'CONFIRMED', status: 'confirmed' }),
    ];
    const { bookings: next, changed } = applyPaymentExpirySweep(bookings, now);
    expect(changed).toBe(true);
    expect(next.find(b => b.booking_id === 'PENDING-OK')?.status).toBe('pending_payment');
    expect(next.find(b => b.booking_id === 'PENDING-LATE')?.status).toBe('expired');
    expect(next.find(b => b.booking_id === 'LEGACY')?.payment_due_at).toBe(
      paymentDueAtFromCreated('2026-07-09T12:00:00.000Z', 48)
    );
    expect(next.find(b => b.booking_id === 'LEGACY')?.status).toBe('pending_payment');
    expect(next.find(b => b.booking_id === 'CONFIRMED')?.status).toBe('confirmed');
  });

  it('does not expire confirmed bookings', () => {
    const now = Date.parse('2026-07-10T12:00:00.000Z');
    const { bookings } = applyPaymentExpirySweep(
      [
        sampleBooking({
          status: 'confirmed',
          payment_due_at: '2026-07-01T12:00:00.000Z',
        }),
      ],
      now
    );
    expect(bookings[0].status).toBe('confirmed');
  });

  it('extends payment deadline from the later of now or current due date', () => {
    const now = Date.parse('2026-07-01T12:00:00.000Z');
    const extended = extendPaymentDueAt('2026-07-03T12:00:00.000Z', 24, now);
    expect(extended).toBe('2026-07-04T12:00:00.000Z');
  });

  it('detects seat conflicts when reviving an expired booking', () => {
    const expired = sampleBooking({
      booking_id: 'EXPIRED',
      status: 'expired',
      seat_ids: ['MAP|A:1:1', 'MAP|B:1:1'],
    });
    const blocking = [
      sampleBooking({ booking_id: 'OTHER', seat_ids: ['MAP|B:1:1'] }),
    ];
    expect(findSeatConflictsForRevive(expired, blocking)).toEqual(['MAP|B:1:1']);
    expect(findSeatConflictsForRevive(expired, [])).toEqual([]);
  });

  it('enforces pending booking cap per email', () => {
    const bookings = [
      sampleBooking({ booking_id: 'A', email: 'User@Example.com' }),
      sampleBooking({ booking_id: 'B', email: 'user@example.com' }),
      sampleBooking({ booking_id: 'C', email: 'other@example.com' }),
    ];
    expect(countPendingBookingsForEmail(bookings, 'user@example.com')).toBe(2);
    expect(countPendingBookingsForEmail(bookings, 'user@example.com')).toBe(
      MAX_PENDING_BOOKINGS_PER_EMAIL
    );
  });

  it('bookingBlocksSeats: cancelled and expired bookings release seats', () => {
    expect(bookingBlocksSeats('pending_payment')).toBe(true);
    expect(bookingBlocksSeats('confirmed')).toBe(true);
    expect(bookingBlocksSeats('cancelled')).toBe(false);
    expect(bookingBlocksSeats('expired')).toBe(false);

    const all = [
      sampleBooking({ booking_id: 'CONF', status: 'confirmed', seat_ids: ['MAP|A:1:1'] }),
      sampleBooking({ booking_id: 'CAN', status: 'cancelled', seat_ids: ['MAP|A:1:1'] }),
      sampleBooking({ booking_id: 'EXP', status: 'expired', seat_ids: ['MAP|B:1:1'] }),
    ];
    const blocking = all.filter(b => bookingBlocksSeats(b.status));
    expect(blocking.map(b => b.booking_id)).toEqual(['CONF']);
  });
});

describe('TicketingService booking status validation', () => {
  it('rejects invalid booking status transitions input', async () => {
    const { TicketingService } = await import('../services/TicketingService.js');
    const service = new TicketingService();
    await expect(service.setBookingStatus('SOME-ID', 'refunded' as any)).rejects.toThrow(
      /Invalid booking status/
    );
    await expect(service.setBookingStatus('SOME-ID', 'expired' as any)).rejects.toThrow(
      /Invalid booking status/
    );
  });
});
