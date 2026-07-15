import { SeatBooking, BookingStatus } from '../models/types.js';

/** Default window for legacy bookings created before payment_due_at existed. */
export const LEGACY_PAYMENT_WINDOW_HOURS = 48;

export const MAX_PENDING_BOOKINGS_PER_EMAIL = 2;

/** Only pending and confirmed bookings hold seats; cancelled/expired release them. */
export function bookingBlocksSeats(status: BookingStatus): boolean {
  return status === 'pending_payment' || status === 'confirmed';
}

export function paymentDueAtFromNow(windowHours: number, nowMs = Date.now()): string {
  return new Date(nowMs + windowHours * 3600_000).toISOString();
}

export function paymentDueAtFromCreated(createdAt: string, windowHours: number): string {
  return new Date(new Date(createdAt).getTime() + windowHours * 3600_000).toISOString();
}

export function resolvePaymentDueMs(booking: SeatBooking): number {
  if (booking.payment_due_at) return new Date(booking.payment_due_at).getTime();
  return new Date(booking.created_at).getTime() + LEGACY_PAYMENT_WINDOW_HOURS * 3600_000;
}

/** Lazy expiry: pending_payment past due → expired; backfill missing payment_due_at. */
export function applyPaymentExpirySweep(
  bookings: SeatBooking[],
  nowMs = Date.now()
): { bookings: SeatBooking[]; changed: boolean } {
  let changed = false;
  const updated = bookings.map(booking => {
    if (booking.status !== 'pending_payment') return booking;
    const dueMs = resolvePaymentDueMs(booking);
    if (dueMs >= nowMs) {
      if (!booking.payment_due_at) {
        changed = true;
        return { ...booking, payment_due_at: new Date(dueMs).toISOString() };
      }
      return booking;
    }
    changed = true;
    return {
      ...booking,
      status: 'expired' as BookingStatus,
      updated_at: new Date(nowMs).toISOString(),
    };
  });
  return { bookings: updated, changed };
}

export function countPendingBookingsForEmail(bookings: SeatBooking[], email: string): number {
  const normalized = email.trim().toLowerCase();
  return bookings.filter(
    b => b.status === 'pending_payment' && b.email.trim().toLowerCase() === normalized
  ).length;
}

export function extendPaymentDueAt(currentDueAt: string | undefined, extraHours: number, nowMs = Date.now()): string {
  const baseMs = currentDueAt ? new Date(currentDueAt).getTime() : nowMs;
  return new Date(Math.max(nowMs, baseMs) + extraHours * 3600_000).toISOString();
}

export function findSeatConflictsForRevive(
  booking: SeatBooking,
  blockingBookings: SeatBooking[]
): string[] {
  if (booking.seat_ids.length === 0) return [];
  const occupied = new Set<string>();
  for (const other of blockingBookings) {
    if (other.booking_id === booking.booking_id) continue;
    for (const seatId of other.seat_ids) occupied.add(seatId);
  }
  return booking.seat_ids.filter(seatId => occupied.has(seatId));
}
