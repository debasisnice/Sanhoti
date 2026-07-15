import { DatabaseHelper } from './DatabaseHelper.js';
import { SeatBooking } from '../models/types.js';
import {
  applyPaymentExpirySweep,
  bookingBlocksSeats,
  countPendingBookingsForEmail,
  MAX_PENDING_BOOKINGS_PER_EMAIL,
} from './bookingLifecycle.js';

const FILENAME = 'seatBookings.json';

export class BookingDataHelper extends DatabaseHelper {
  async findAll(): Promise<SeatBooking[]> {
    const raw = this.readFile<SeatBooking>(FILENAME);
    const { bookings, changed } = applyPaymentExpirySweep(raw);
    if (changed) this.writeFile<SeatBooking>(FILENAME, bookings);
    return bookings;
  }

  async findById(bookingId: string): Promise<SeatBooking | null> {
    const bookings = await this.findAll();
    return bookings.find(b => b.booking_id === bookingId) ?? null;
  }

  /** Bookings whose seats are unavailable to others (pending or confirmed). */
  async findSeatBlocking(): Promise<SeatBooking[]> {
    const bookings = await this.findAll();
    return bookings.filter(b => bookingBlocksSeats(b.status));
  }

  async countPendingByEmail(email: string): Promise<number> {
    const bookings = await this.findAll();
    return countPendingBookingsForEmail(bookings, email);
  }

  async create(booking: Omit<SeatBooking, 'booking_id' | 'created_at' | 'updated_at'>): Promise<SeatBooking> {
    const bookings = await this.findAll();
    let booking_id = this.generate12DigitAlphanumericId();
    while (bookings.some(b => b.booking_id === booking_id)) {
      booking_id = this.generate12DigitAlphanumericId();
    }
    const created: SeatBooking = {
      ...booking,
      booking_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    bookings.push(created);
    this.writeFile<SeatBooking>(FILENAME, bookings);
    return created;
  }

  async update(bookingId: string, patch: Partial<SeatBooking>): Promise<SeatBooking | null> {
    const bookings = await this.findAll();
    const index = bookings.findIndex(b => b.booking_id === bookingId);
    if (index === -1) return null;
    bookings[index] = { ...bookings[index], ...patch, updated_at: new Date().toISOString() };
    this.writeFile<SeatBooking>(FILENAME, bookings);
    return bookings[index];
  }

  async delete(bookingId: string): Promise<boolean> {
    const bookings = await this.findAll();
    const index = bookings.findIndex(b => b.booking_id === bookingId);
    if (index === -1) return false;
    bookings.splice(index, 1);
    this.writeFile<SeatBooking>(FILENAME, bookings);
    return true;
  }

  /** Issue a unique admission QR token for event-day check-in (reuses existing token if present). */
  async issueAdmissionQrToken(bookingId: string): Promise<SeatBooking | null> {
    const bookings = await this.findAll();
    const index = bookings.findIndex(b => b.booking_id === bookingId);
    if (index === -1) return null;
    const booking = bookings[index];
    if (booking.admission_qr_token) return booking;
    const used = new Set(
      bookings.map(b => b.admission_qr_token).filter((token): token is string => Boolean(token))
    );
    let token = this.generate12DigitAlphanumericId();
    while (used.has(token)) token = this.generate12DigitAlphanumericId();
    bookings[index] = {
      ...booking,
      admission_qr_token: token,
      admission_qr_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.writeFile<SeatBooking>(FILENAME, bookings);
    return bookings[index];
  }
}

export { MAX_PENDING_BOOKINGS_PER_EMAIL };
