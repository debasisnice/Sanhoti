import { describe, it, expect } from 'vitest';
import {
  parseAdmissionPayload,
  parseGateScope,
  gateCapacity,
  bookingCoversGate,
  gateCheckedIn,
  classifyAdmission,
  normalizeCheckins,
  validateAdmitQty,
  validateCorrectCount,
  applyAdmitToGate,
  applySetGateCheckin,
  isWholeEventBooking,
  enrichFoodAddonsWithMealSlots,
  inferMealSlotFromFoodAddonName,
} from '../data/admissionCheckin.js';
import { SeatBooking } from '../models/types.js';

function makeBooking(overrides: Partial<SeatBooking> = {}): SeatBooking {
  return {
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
    ...overrides,
  };
}

const entireEvent6: SeatBooking = makeBooking({
  sub_event_ids: [],
  seats_detail: [
    { seat_id: 'A', label: 'J1', category_name: 'Platinum', price: 60, sub_event_id: 'SE1' },
    { seat_id: 'B', label: 'J2', category_name: 'Platinum', price: 60, sub_event_id: 'SE1' },
    { seat_id: 'C', label: 'J3', category_name: 'Platinum', price: 60, sub_event_id: 'SE1' },
    { seat_id: 'D', label: 'K1', category_name: 'Platinum', price: 60, sub_event_id: 'SE2' },
    { seat_id: 'E', label: 'K2', category_name: 'Platinum', price: 60, sub_event_id: 'SE2' },
    { seat_id: 'F', label: 'K3', category_name: 'Platinum', price: 60, sub_event_id: 'SE2' },
  ],
  meals_detail: [
    {
      day_id: 'DAY1',
      label: 'Oct-9 Friday',
      meal_type: 'dinner',
      adult_qty: 6,
      child_qty: 0,
      adult_price: 25,
      child_price: 15,
      line_total: 150,
    },
  ],
});

/** Real-world entire-event pass shape: sub_event_ids populated from seat maps. */
const entireEventPassWithSubIds: SeatBooking = makeBooking({
  sub_event_ids: ['SE1', 'SE2'],
  seats_detail: entireEvent6.seats_detail,
  meals_detail: [
    {
      day_id: 'DAY1',
      label: 'Oct-9 Friday',
      meal_type: 'dinner',
      adult_qty: 6,
      child_qty: 0,
      adult_price: 25,
      child_price: 15,
      line_total: 150,
    },
    {
      day_id: 'DAY2',
      label: 'Oct-10 Saturday',
      meal_type: 'lunch',
      adult_qty: 6,
      child_qty: 0,
      adult_price: 25,
      child_price: 15,
      line_total: 150,
    },
  ],
});

const se1Ticket4: SeatBooking = makeBooking({
  sub_event_ids: ['SE1'],
  seats_detail: [
    { seat_id: 'A', label: 'J1', category_name: 'Platinum', price: 60, sub_event_id: 'SE1' },
    { seat_id: 'B', label: 'J2', category_name: 'Platinum', price: 60, sub_event_id: 'SE1' },
    { seat_id: 'C', label: 'J3', category_name: 'Platinum', price: 60, sub_event_id: 'SE1' },
    { seat_id: 'D', label: 'J4', category_name: 'Platinum', price: 60, sub_event_id: 'SE1' },
  ],
  food_addons_detail: [
    {
      addon_id: 'ADDON1',
      sub_event_id: 'SE1',
      name: 'Oct-9 Friday Dinner',
      adult_qty: 4,
      child_qty: 0,
      adult_price: 25,
      child_price: 15,
      line_total: 100,
      meal_day_id: 'DAY1',
      meal_type: 'dinner',
    },
  ],
});

describe('isWholeEventBooking', () => {
  it('treats bundled-meal passes with sub_event_ids as entire-event', () => {
    expect(isWholeEventBooking(entireEventPassWithSubIds)).toBe(true);
    expect(isWholeEventBooking(entireEvent6)).toBe(true);
  });

  it('does not treat sub-event concert tickets as entire-event', () => {
    expect(isWholeEventBooking(se1Ticket4)).toBe(false);
  });
});

describe('parseGateScope', () => {
  it('parses all four gate shapes', () => {
    expect(parseGateScope('event')).toEqual({ kind: 'event', raw: 'event' });
    expect(parseGateScope('sub:SE1')).toEqual({ kind: 'sub', subEventId: 'SE1', raw: 'sub:SE1' });
    expect(parseGateScope('meal:DAY1:dinner')).toEqual({
      kind: 'meal',
      dayId: 'DAY1',
      mealType: 'dinner',
      raw: 'meal:DAY1:dinner',
    });
    expect(parseGateScope('addon:SE1:ADDON1')).toEqual({
      kind: 'addon',
      subEventId: 'SE1',
      addonId: 'ADDON1',
      raw: 'addon:SE1:ADDON1',
    });
  });

  it('rejects garbage', () => {
    expect(parseGateScope('')).toBeNull();
    expect(parseGateScope('SUB_A')).toBeNull();
    expect(parseGateScope('meal:DAY1')).toBeNull();
    expect(parseGateScope('addon:SE1')).toBeNull();
  });
});

describe('gateCapacity', () => {
  it('entire-event pass admits at sub, meal, and event gates', () => {
    expect(gateCapacity(entireEvent6, 'sub:SE1')).toBe(3);
    expect(gateCapacity(entireEvent6, 'sub:SE2')).toBe(3);
    expect(gateCapacity(entireEvent6, 'meal:DAY1:dinner')).toBe(6);
    expect(gateCapacity(entireEvent6, 'event')).toBe(6);
  });

  it('entire-event pass with sub_event_ids still admits at each gate independently', () => {
    const checkedInFridayDinner = makeBooking({
      ...entireEventPassWithSubIds,
      admission_checkins: {
        'meal:DAY1:dinner': { checked_in: 6, updated_at: '2026-10-01T18:00:00.000Z' },
      },
    });
    expect(gateCapacity(entireEventPassWithSubIds, 'sub:SE1')).toBe(3);
    expect(gateCapacity(entireEventPassWithSubIds, 'meal:DAY2:lunch')).toBe(6);
    expect(classifyAdmission(checkedInFridayDinner, { scope: 'meal:DAY1:dinner', tokenValid: true }).result).toBe(
      'already_checked_in'
    );
    expect(classifyAdmission(checkedInFridayDinner, { scope: 'meal:DAY2:lunch', tokenValid: true }).result).toBe(
      'admitted'
    );
    expect(classifyAdmission(checkedInFridayDinner, { scope: 'sub:SE2', tokenValid: true }).result).toBe('admitted');
  });

  it('sub-event food add-on without meal_day_id admits at matching meal gate when enriched', () => {
    const raw = makeBooking({
      sub_event_ids: ['SE1'],
      seats_detail: [
        { seat_id: 'A', label: 'J1', category_name: 'Platinum', price: 60, sub_event_id: 'SE1' },
        { seat_id: 'B', label: 'J2', category_name: 'Platinum', price: 60, sub_event_id: 'SE1' },
      ],
      food_addons_detail: [
        {
          addon_id: 'ADDON1',
          sub_event_id: 'SE1',
          name: 'Oct-9 Friday Dinner',
          adult_qty: 1,
          child_qty: 0,
          adult_price: 25,
          child_price: 15,
          line_total: 25,
        },
      ],
    });
    const mealDays = [{ day_id: 'DAY1', label: 'Oct-9 Friday' }];
    expect(gateCapacity(raw, 'meal:DAY1:dinner')).toBe(0);
    const enriched = enrichFoodAddonsWithMealSlots(raw, mealDays);
    expect(gateCapacity(enriched, 'meal:DAY1:dinner')).toBe(1);
    expect(classifyAdmission(enriched, { scope: 'meal:DAY1:dinner', tokenValid: true }).result).toBe(
      'admitted'
    );
    expect(inferMealSlotFromFoodAddonName('Oct-9 Friday Dinner', mealDays)).toEqual({
      day_id: 'DAY1',
      meal_type: 'dinner',
    });
  });

  it('sub-event ticket covers its sub gate and meal gates for food add-ons', () => {
    expect(gateCapacity(se1Ticket4, 'sub:SE1')).toBe(4);
    expect(gateCapacity(se1Ticket4, 'sub:SE2')).toBe(0);
    expect(gateCapacity(se1Ticket4, 'meal:DAY1:dinner')).toBe(4);
    expect(gateCapacity(se1Ticket4, 'meal:DAY1:lunch')).toBe(0);
    expect(gateCapacity(se1Ticket4, 'addon:SE1:ADDON1')).toBe(4);
    expect(gateCapacity(se1Ticket4, 'addon:SE2:ADDON1')).toBe(0);
  });

  it('bookingCoversGate mirrors capacity > 0', () => {
    expect(bookingCoversGate(se1Ticket4, 'sub:SE2')).toBe(false);
    expect(bookingCoversGate(se1Ticket4, 'sub:SE1')).toBe(true);
  });
});

describe('classifyAdmission', () => {
  const ok = { scope: 'meal:DAY1:dinner', tokenValid: true, activeEventId: 'EVT1' };

  it('admits with correct capacity/already/remaining', () => {
    expect(classifyAdmission(entireEvent6, ok)).toEqual({
      result: 'admitted',
      capacity: 6,
      already: 0,
      remaining: 6,
      admit: true,
    });
  });

  it('reports already_checked_in when gate is full', () => {
    const full = makeBooking({
      ...entireEvent6,
      admission_checkins: {
        'meal:DAY1:dinner': { checked_in: 6, updated_at: '2026-10-01T18:00:00.000Z' },
      },
      meals_detail: entireEvent6.meals_detail,
      seats_detail: entireEvent6.seats_detail,
      sub_event_ids: [],
    });
    expect(classifyAdmission(full, ok)).toEqual({
      result: 'already_checked_in',
      capacity: 6,
      already: 6,
      remaining: 0,
      admit: false,
    });
  });

  it('reports wrong_gate when capacity is 0', () => {
    expect(classifyAdmission(se1Ticket4, { ...ok, scope: 'meal:DAY1:lunch' }).result).toBe('wrong_gate');
    expect(classifyAdmission(se1Ticket4, { ...ok, scope: 'sub:SE2' }).result).toBe('wrong_gate');
  });

  it('reports status and token branches', () => {
    expect(classifyAdmission(null, ok).result).toBe('not_found');
    expect(classifyAdmission(entireEvent6, { ...ok, tokenValid: false }).result).toBe('invalid_qr');
    expect(classifyAdmission(makeBooking({ status: 'pending_payment' }), ok).result).toBe(
      'payment_pending'
    );
    expect(classifyAdmission(makeBooking({ status: 'cancelled' }), ok).result).toBe('cancelled');
    expect(classifyAdmission(makeBooking({ status: 'expired' }), ok).result).toBe('expired');
  });
});

describe('quantity partial check-in', () => {
  const scope = 'meal:DAY1:dinner';
  const opts = { scope, tokenValid: true, activeEventId: 'EVT1' };

  function admit(booking: SeatBooking, qty: number, now: string): SeatBooking {
    const remaining = classifyAdmission(booking, opts).remaining;
    const err = validateAdmitQty(remaining, qty);
    if (err) throw new Error(err);
    const existing = normalizeCheckins(booking)[scope];
    const next = applyAdmitToGate(existing, qty, now);
    return {
      ...booking,
      admission_checkins: { ...normalizeCheckins(booking), [scope]: next },
    };
  }

  it('reaches 6/6 via 3+3, 3+2+1, 2+2+2, and 1×6', () => {
    const combos = [
      [3, 3],
      [3, 2, 1],
      [2, 2, 2],
      [1, 1, 1, 1, 1, 1],
    ];
    for (const combo of combos) {
      let booking = entireEvent6;
      let t = 0;
      for (const qty of combo) {
        booking = admit(booking, qty, `2026-10-01T18:0${t++}:00.000Z`);
      }
      expect(gateCheckedIn(booking, scope)).toBe(6);
      expect(classifyAdmission(booking, opts).result).toBe('already_checked_in');
    }
  });

  it('rejects admitQty > remaining as over_capacity', () => {
    const partial = admit(entireEvent6, 3, '2026-10-01T18:00:00.000Z');
    expect(validateAdmitQty(classifyAdmission(partial, opts).remaining, 4)).toBe('over_capacity');
  });
});

describe('setGateCheckin (absolute correction)', () => {
  const scope = 'sub:SE1';

  it('sets an absolute count and clears at 0', () => {
    const now = '2026-10-01T19:00:00.000Z';
    const existing = normalizeCheckins(se1Ticket4)[scope];
    const corrected = applySetGateCheckin(existing, 2, now)!;
    expect(corrected.checked_in).toBe(2);
    expect(validateCorrectCount(4, 5)).toBe('over_capacity');
    expect(applySetGateCheckin(corrected, 0, now)).toBeUndefined();
  });
});

describe('normalizeCheckins', () => {
  it('migrates old timestamp map entries to full counts', () => {
    const booking = makeBooking({
      sub_event_ids: [],
      seats_detail: entireEvent6.seats_detail,
      admission_checkins: { 'sub:SE1': '2026-10-01T18:00:00.000Z' },
    });
    const normalized = normalizeCheckins(booking);
    expect(normalized['sub:SE1'].checked_in).toBe(3);
    expect(normalized['sub:SE1'].updated_at).toBe('2026-10-01T18:00:00.000Z');
  });

  it('migrates legacy single admission_checked_in_at to event gate', () => {
    const booking = makeBooking({
      admission_checked_in_at: '2026-10-01T09:00:00.000Z',
      seats_detail: [{ seat_id: 'A', label: 'J1', category_name: 'VIP', price: 50 }],
      sub_event_ids: [],
    });
    const normalized = normalizeCheckins(booking);
    expect(normalized.event.checked_in).toBe(1);
    expect(normalized.event.updated_at).toBe('2026-10-01T09:00:00.000Z');
  });
});

describe('parseAdmissionPayload', () => {
  it('parses a valid SANHOTI payload', () => {
    expect(parseAdmissionPayload('SANHOTI|BOOK12345678|ADMITTOKEN12')).toEqual({
      booking_id: 'BOOK12345678',
      token: 'ADMITTOKEN12',
    });
  });
});
