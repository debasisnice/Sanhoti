import { describe, it, expect } from 'vitest';
import { EmailService } from '../services/EmailService.js';
import { SeatBooking } from '../models/types.js';

describe('EmailService booking confirmation', () => {
  const emailService = new EmailService();

  const sampleBooking: SeatBooking = {
    booking_id: 'QRR6NH035YEA',
    event_id: 'EVT1',
    event_context: 'Durga Puja 2026',
    seat_ids: ['MAP|SEC:1:1'],
    seats_detail: [
      {
        seat_id: 'SEC:1:1',
        label: 'J21',
        category_name: 'Platinum',
        price: 60,
        audience_type: 'adult',
        map_name: 'Subhadeep Live Concert',
      },
    ],
    name: 'Test Guest',
    email: 'guest@example.com',
    phone: '9495551234',
    subtotal: 60,
    discount_amount: 0,
    total: 60,
    status: 'pending_payment',
    payment_due_at: '2026-07-16T23:13:00.000Z',
    created_at: '2026-07-14T23:13:00.000Z',
    updated_at: '2026-07-14T23:13:00.000Z',
  };

  it('includes booking id, line items, total, and payment deadline in HTML', () => {
    const html = emailService.generateBookingConfirmationHTML(sampleBooking, {
      zelle_phone: '949-378-6425',
    });
    expect(html).toContain('QRR6NH035YEA');
    expect(html).toContain('Subhadeep Live Concert');
    expect(html).toContain('J21');
    expect(html).toContain('$60.00');
    expect(html).toContain('949-378-6425');
    expect(html).toContain('reservation will lapse');
    expect(html).toContain('Seats reserved!');
  });

  it('includes Zelle QR image placeholder when QR is attached', () => {
    const html = emailService.generateBookingConfirmationHTML(
      sampleBooking,
      { zelle_phone: '949-378-6425' },
      true
    );
    expect(html).toContain('cid:payment-qr');
    expect(html).toContain('Send Money with Zelle');
    expect(html).toContain('Scan in your banking app');
  });

  it('omits QR block when no QR image is configured', () => {
    const html = emailService.generateBookingConfirmationHTML(sampleBooking, {}, false);
    expect(html).not.toContain('cid:payment-qr');
  });

  it('uses meals headline for meals-only bookings', () => {
    const html = emailService.generateBookingConfirmationHTML(
      {
        ...sampleBooking,
        seat_ids: [],
        seats_detail: [],
        meals_detail: [
          {
            day_id: 'DAY1',
            label: 'Oct-10 Saturday',
            meal_type: 'dinner',
            adult_qty: 2,
            child_qty: 0,
            adult_price: 25,
            child_price: 15,
            line_total: 50,
          },
        ],
        event_context: 'Durga Puja 2026 — Meals',
        total: 50,
        subtotal: 50,
      },
      {}
    );
    expect(html).toContain('Meals reserved!');
    expect(html).toContain('Oct-10 Saturday');
    expect(html).toContain('$50.00');
  });

  it('includes admission QR in paid confirmation email', () => {
    const html = emailService.generateBookingPaidHTML(
      { ...sampleBooking, status: 'confirmed', admission_qr_token: 'ADMITTOKEN12' },
      true
    );
    expect(html).toContain('Booking confirmed!');
    expect(html).toContain('cid:admission-qr');
    expect(html).toContain('event-day admission QR');
    expect(html).toContain('Total paid');
  });

  it('includes new deadline in extension email', () => {
    const html = emailService.generateBookingExtendedHTML(sampleBooking, {
      zelle_phone: '949-378-6425',
    });
    expect(html).toContain('Payment deadline extended');
    expect(html).toContain('new payment deadline');
    expect(html).toContain('949-378-6425');
  });

  it('includes cancellation notice when seats are released', () => {
    const html = emailService.generateBookingCancelledHTML(sampleBooking, true);
    expect(html).toContain('Booking cancelled');
    expect(html).toContain('seats have been released');
    expect(html).toContain('QRR6NH035YEA');
  });
});
