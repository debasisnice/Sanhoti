import { describe, it, expect } from 'vitest';
import { TicketingService, rowLabel } from '../services/TicketingService.js';

// Validation-only tests: every case below must throw (or is a pure function)
// before anything is written to the JSON data files.
describe('TicketingService validation', () => {
  const service = new TicketingService();

  it('rejects categories without a valid hex color', async () => {
    await expect(
      service.updateConfig({ categories: [{ name: 'VIP', price: 50, color: 'red' } as any] })
    ).rejects.toThrow(/hex color/);
  });

  it('rejects a section assigned to a non-existent category', async () => {
    await expect(
      service.updateConfig({
        categories: [],
        sections: [{ name: 'Center', rows: 5, seats_per_row: 10, category_id: 'NOPE' } as any],
      })
    ).rejects.toThrow(/existing category/);
  });

  it('rejects sections with out-of-range dimensions', async () => {
    await expect(
      service.updateConfig({
        categories: [{ name: 'A', price: 1, color: '#ff0000' } as any],
        sections: [{ name: 'S', rows: 0, seats_per_row: 10, category_id: 'x' } as any],
      })
    ).rejects.toThrow(/rows must be/);
  });

  it('rejects invalid hold_minutes', async () => {
    await expect(service.updateConfig({ hold_minutes: 0 })).rejects.toThrow(/between 1 and 60/);
    await expect(service.updateConfig({ hold_minutes: 999 })).rejects.toThrow(/between 1 and 60/);
  });

  it('rejects discount codes with invalid characters or values', async () => {
    await expect(
      service.createDiscount({ code: 'BAD CODE!', type: 'percent', value: 10 })
    ).rejects.toThrow(/letters\/numbers/);
    await expect(
      service.createDiscount({ code: 'OK', type: 'percent', value: 150 })
    ).rejects.toThrow(/cannot exceed 100/);
    await expect(
      service.createDiscount({ code: 'OK', type: 'fixed', value: -5 })
    ).rejects.toThrow(/must be positive/);
    await expect(
      service.createDiscount({ code: 'OK', type: 'bogus' as any, value: 5 })
    ).rejects.toThrow(/percent.*fixed/);
  });

  it('rejects invalid booking status transitions input', async () => {
    await expect(service.setBookingStatus('SOME-ID', 'refunded' as any)).rejects.toThrow(
      /Invalid booking status/
    );
  });

  it('returns false when deleting a missing booking', async () => {
    await expect(service.deleteBooking('MISSING-BOOKING-ID')).resolves.toBe(false);
  });

  it('generates spreadsheet-style row labels', () => {
    expect(rowLabel(1)).toBe('A');
    expect(rowLabel(26)).toBe('Z');
    expect(rowLabel(27)).toBe('AA');
  });

  // SKIPPED — not a code defect. This test hardcodes seat keys from two seat
  // maps (0F8T66PJOV0F, 02C8H6T8GUA3) that no longer exist in seatingConfig;
  // they survive only in auditLogs. `resolveSeatKey` therefore throws
  // "references an unavailable seat map" before any discount maths runs.
  //
  // The underlying problem is the coupling: the test asserts against live admin
  // data, so editing a seat map in the admin UI breaks the suite. To restore it,
  // build the fixture inside the test — saveMapTemplate + createDiscount + a
  // pricing profile — then assert the arithmetic. The expected 192 / 768 depend
  // on the original pricing, so confirm those figures before re-enabling.
  it.skip('applies promo percent to entire-event pass subtotal, not per-seat sum', async () => {
    const seatKeys = [
      '0F8T66PJOV0F|G5T2WTZ2M2CP:1:1',
      '0F8T66PJOV0F|76O31XF7GGTT:1:1',
      '0F8T66PJOV0F|RYC30EJ6WVGG:1:1',
      '0F8T66PJOV0F|J1QYYTP2DR82:1:1',
      '0F8T66PJOV0F|HDKZTCOU13OL:1:1',
      '0F8T66PJOV0F|38HC4SERCJIF:1:1',
      '02C8H6T8GUA3|AUDHXHDJFFFI:1:1',
      '02C8H6T8GUA3|0BGTR78Q8SKQ:1:1',
      '02C8H6T8GUA3|1S38Y2KIQV5P:1:1',
      '02C8H6T8GUA3|N9VS07W5MYS5:1:1',
      '02C8H6T8GUA3|UW8D6LCMXJ0J:1:1',
      '02C8H6T8GUA3|LGN9OMAHH2B8:1:1',
    ];
    const seatAudiences = Object.fromEntries(seatKeys.map(key => [key, 'adult' as const]));
    const preview = await service.previewDiscount('SANHOTI20', seatKeys, {
      seat_audiences: seatAudiences,
      category_id: 'NEW-1784039200260-1',
      adult_count: 6,
      child_count: 0,
    });
    expect(preview.discount_amount).toBe(192);
    expect(preview.total).toBe(768);
  });

  it('rejects invalid saved layout slot numbers', async () => {
    await expect(service.saveMapTemplate(3, 'Test', 'MAP-ID')).rejects.toThrow(/slot must be 1 or 2/);
    await expect(service.deleteMapTemplate(0)).rejects.toThrow(/slot must be 1 or 2/);
  });
});
