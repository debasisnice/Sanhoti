import { GateCheckin, SeatBooking } from '../models/types.js';

/**
 * Pure, I/O-free helpers for event-day admission scanning. Keeping the rules
 * here (separate from TicketingService) makes them unit-testable without touching
 * the JSON store. The service layer handles lookups, stamping, and audit.
 */

/** The QR payload printed on a guest's confirmation email. */
export const ADMISSION_QR_PREFIX = 'SANHOTI';

export type AdmissionResult =
  | 'admitted'
  | 'already_checked_in'
  | 'over_capacity'
  | 'payment_pending'
  | 'wrong_gate'
  | 'cancelled'
  | 'expired'
  | 'not_found'
  | 'invalid_qr';

export type GateKind = 'sub' | 'meal' | 'addon' | 'event';

export interface ParsedGate {
  kind: GateKind;
  subEventId?: string;
  dayId?: string;
  mealType?: 'lunch' | 'dinner';
  addonId?: string;
  raw: string;
}

export interface ParsedAdmissionPayload {
  booking_id: string;
  token: string;
}

export interface AdmissionEvaluation {
  result: AdmissionResult;
  capacity: number;
  already: number;
  remaining: number;
  admit: boolean;
}

export interface ClassifyOptions {
  scope: string;
  tokenValid: boolean;
  activeEventId?: string;
}

/** Parse gate scope strings: sub:, meal:, addon:, or event. */
export function parseGateScope(scope: string): ParsedGate | null {
  const raw = String(scope ?? '').trim();
  if (!raw) return null;
  if (raw === 'event') return { kind: 'event', raw };
  const subMatch = /^sub:([^:]+)$/.exec(raw);
  if (subMatch) return { kind: 'sub', subEventId: subMatch[1], raw };
  const mealMatch = /^meal:([^:]+):(lunch|dinner)$/.exec(raw);
  if (mealMatch) {
    return {
      kind: 'meal',
      dayId: mealMatch[1],
      mealType: mealMatch[2] as 'lunch' | 'dinner',
      raw,
    };
  }
  const addonMatch = /^addon:([^:]+):([^:]+)$/.exec(raw);
  if (addonMatch) {
    return { kind: 'addon', subEventId: addonMatch[1], addonId: addonMatch[2], raw };
  }
  return null;
}

/** Parse `SANHOTI|{booking_id}|{token}` — returns null for anything else. */
export function parseAdmissionPayload(raw: string): ParsedAdmissionPayload | null {
  const value = String(raw ?? '').trim();
  const parts = value.split('|');
  if (parts.length !== 3) return null;
  const [prefix, booking_id, token] = parts.map(part => part.trim());
  if (prefix !== ADMISSION_QR_PREFIX || !booking_id || !token) return null;
  return { booking_id, token };
}

/** All sub-events a booking is associated with (new array + legacy single field). */
export function bookingSubEventIds(booking: SeatBooking): string[] {
  const ids = new Set<string>();
  for (const id of booking.sub_event_ids ?? []) {
    if (id) ids.add(id);
  }
  if (booking.sub_event_id) ids.add(booking.sub_event_id);
  return [...ids];
}

/** True for entire-event pass bookings and legacy meals-only bookings. */
export function isWholeEventBooking(booking: SeatBooking): boolean {
  const subIds = bookingSubEventIds(booking);
  const hasBundledMeals = (booking.meals_detail?.length ?? 0) > 0;
  const hasSeats = (booking.seats_detail?.length ?? 0) > 0;

  // Entire-event pass: bundled meals + seats (sub_event_ids lists every program on the pass).
  if (hasBundledMeals && hasSeats && !(booking.food_addons_detail?.length)) {
    return true;
  }

  // Meals-only booking or legacy entire-event records without sub_event_ids.
  return subIds.length === 0;
}

/** Map food add-on display name (e.g. "Oct-9 Friday Dinner") to a meal day slot. */
export function inferMealSlotFromFoodAddonName(
  name: string,
  mealDays: Array<{ day_id: string; label: string }>
): { day_id: string; meal_type: 'lunch' | 'dinner' } | null {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return null;
  for (const mealType of ['lunch', 'dinner'] as const) {
    const suffix = mealType === 'lunch' ? ' Lunch' : ' Dinner';
    if (!trimmed.endsWith(suffix)) continue;
    const label = trimmed.slice(0, -suffix.length);
    const day = mealDays.find(row => row.label === label);
    if (day) return { day_id: day.day_id, meal_type: mealType };
  }
  return null;
}

/** Backfill meal_day_id / meal_type on booked food add-ons for legacy rows. */
export function enrichFoodAddonsWithMealSlots(
  booking: SeatBooking,
  mealDays: Array<{ day_id: string; label: string }>
): SeatBooking {
  if (!booking.food_addons_detail?.length || !mealDays.length) return booking;
  const food_addons_detail = booking.food_addons_detail.map(addon => {
    if (addon.meal_day_id && addon.meal_type) return addon;
    const slot = inferMealSlotFromFoodAddonName(addon.name, mealDays);
    if (!slot) return addon;
    return { ...addon, meal_day_id: slot.day_id, meal_type: slot.meal_type };
  });
  return { ...booking, food_addons_detail };
}

function seatsForSubEvent(booking: SeatBooking, subEventId: string): number {
  const matched = booking.seats_detail.filter(seat => seat.sub_event_id === subEventId).length;
  if (matched > 0) return matched;
  return isWholeEventBooking(booking) ? booking.seats_detail.length : 0;
}

/** How many people this booking may admit at this gate (computed live, never stored). */
export function gateCapacity(booking: SeatBooking, scope: string): number {
  const gate = parseGateScope(scope);
  if (!gate) return 0;

  if (gate.kind === 'sub' && gate.subEventId) {
    if (isWholeEventBooking(booking)) {
      return seatsForSubEvent(booking, gate.subEventId);
    }
    if (!bookingSubEventIds(booking).includes(gate.subEventId)) return 0;
    const forSub = booking.seats_detail.filter(seat => seat.sub_event_id === gate.subEventId).length;
    return forSub > 0 ? forSub : booking.seats_detail.length;
  }

  if (gate.kind === 'meal' && gate.dayId && gate.mealType) {
    let total = 0;
    const mealRow = (booking.meals_detail ?? []).find(
      meal => meal.day_id === gate.dayId && meal.meal_type === gate.mealType
    );
    if (mealRow) total += mealRow.adult_qty + mealRow.child_qty;
    for (const addon of booking.food_addons_detail ?? []) {
      if (addon.meal_day_id === gate.dayId && addon.meal_type === gate.mealType) {
        total += addon.adult_qty + addon.child_qty;
      }
    }
    return total;
  }

  if (gate.kind === 'addon' && gate.subEventId && gate.addonId) {
    const row = (booking.food_addons_detail ?? []).find(
      addon => addon.sub_event_id === gate.subEventId && addon.addon_id === gate.addonId
    );
    return row ? row.adult_qty + row.child_qty : 0;
  }

  if (gate.kind === 'event') {
    return isWholeEventBooking(booking) ? booking.seats_detail.length || 1 : 0;
  }

  return 0;
}

export function bookingCoversGate(booking: SeatBooking, scope: string): boolean {
  return gateCapacity(booking, scope) > 0;
}

/** @deprecated Use bookingCoversGate — kept for transitional imports. */
export function bookingCoversScope(booking: SeatBooking, scope: string): boolean {
  const parsed = parseGateScope(scope);
  if (parsed) return bookingCoversGate(booking, scope);
  // Legacy bare sub_event_id scopes
  if (scope === 'event') return isWholeEventBooking(booking);
  if (isWholeEventBooking(booking)) return true;
  return bookingSubEventIds(booking).includes(scope);
}

function isGateCheckin(value: unknown): value is GateCheckin {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as GateCheckin).checked_in === 'number' &&
    typeof (value as GateCheckin).updated_at === 'string'
  );
}

function bookingHasStructuredGates(booking: SeatBooking): boolean {
  return (
    bookingSubEventIds(booking).length > 0 ||
    (booking.meals_detail?.length ?? 0) > 0 ||
    (booking.food_addons_detail?.length ?? 0) > 0
  );
}

/** Tolerate legacy timestamp-only check-in maps and migrate to counts. */
export function normalizeCheckins(booking: SeatBooking): Record<string, GateCheckin> {
  const out: Record<string, GateCheckin> = {};
  const raw = booking.admission_checkins ?? {};

  for (const [scope, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      const cap = gateCapacity(booking, scope) || gateCapacity(booking, legacyScopeKey(scope)) || 1;
      out[scope] = { checked_in: cap, updated_at: value };
      continue;
    }
    if (isGateCheckin(value)) {
      out[scope] = { ...value, checked_in: Math.max(0, value.checked_in) };
    }
  }

  if (
    Object.keys(out).length === 0 &&
    booking.admission_checked_in_at &&
    !bookingHasStructuredGates(booking)
  ) {
    const cap = gateCapacity(booking, 'event') || 1;
    out.event = { checked_in: cap, updated_at: booking.admission_checked_in_at };
  }

  return out;
}

function legacyScopeKey(scope: string): string {
  const parsed = parseGateScope(scope);
  if (parsed?.kind === 'sub' && parsed.subEventId) return parsed.subEventId;
  return scope;
}

function lookupGateCheckin(booking: SeatBooking, scope: string): GateCheckin | undefined {
  const normalized = normalizeCheckins(booking);
  if (normalized[scope]) return normalized[scope];
  const legacy = legacyScopeKey(scope);
  if (legacy !== scope && normalized[legacy]) return normalized[legacy];
  return undefined;
}

export function gateCheckedIn(booking: SeatBooking, scope: string): number {
  return lookupGateCheckin(booking, scope)?.checked_in ?? 0;
}

export function scopeCheckedInAt(booking: SeatBooking, scope: string): string | undefined {
  const entry = lookupGateCheckin(booking, scope);
  return entry && entry.checked_in > 0 ? entry.updated_at : undefined;
}

export function classifyAdmission(
  booking: SeatBooking | null,
  opts: ClassifyOptions
): AdmissionEvaluation {
  const empty = (result: AdmissionResult): AdmissionEvaluation => ({
    result,
    capacity: 0,
    already: 0,
    remaining: 0,
    admit: false,
  });

  if (!booking) return empty('not_found');
  if (!opts.tokenValid) return empty('invalid_qr');

  if (booking.status === 'cancelled') return empty('cancelled');
  if (booking.status === 'expired') return empty('expired');
  if (booking.status === 'pending_payment') return empty('payment_pending');
  if (booking.status !== 'confirmed') return empty('invalid_qr');

  if (opts.activeEventId && booking.event_id !== opts.activeEventId) {
    return empty('wrong_gate');
  }

  const capacity = gateCapacity(booking, opts.scope);
  const already = gateCheckedIn(booking, opts.scope);
  const remaining = Math.max(0, capacity - already);

  if (capacity === 0) {
    return { result: 'wrong_gate', capacity, already, remaining: 0, admit: false };
  }
  if (remaining <= 0) {
    return { result: 'already_checked_in', capacity, already, remaining: 0, admit: false };
  }

  return { result: 'admitted', capacity, already, remaining, admit: true };
}

/** Validate admit quantity against remaining capacity (pure). */
export function validateAdmitQty(remaining: number, admitQty: number): AdmissionResult | null {
  if (admitQty < 1 || admitQty > remaining) return 'over_capacity';
  return null;
}

/** Validate absolute correction count (pure). */
export function validateCorrectCount(capacity: number, count: number): AdmissionResult | null {
  if (!Number.isInteger(count) || count < 0 || count > capacity) return 'over_capacity';
  return null;
}

/** Apply an admit increment to a gate check-in record (pure). */
export function applyAdmitToGate(
  existing: GateCheckin | undefined,
  admitQty: number,
  now: string
): GateCheckin {
  const prev = existing?.checked_in ?? 0;
  return {
    checked_in: prev + admitQty,
    updated_at: now,
    log: [...(existing?.log ?? []), { at: now, admitted: admitQty }],
  };
}

/** Apply an absolute count correction (pure). */
export function applySetGateCheckin(
  existing: GateCheckin | undefined,
  count: number,
  now: string
): GateCheckin | undefined {
  if (count === 0) return undefined;
  return {
    checked_in: count,
    updated_at: now,
    log: [...(existing?.log ?? []), { at: now, set_to: count }],
  };
}

/** Most recent updated_at among gates with checked_in > 0 (mirror field). */
export function mirrorCheckedInAt(checkins: Record<string, GateCheckin>): string | undefined {
  let latest: string | undefined;
  for (const entry of Object.values(checkins)) {
    if (entry.checked_in > 0 && (!latest || entry.updated_at > latest)) {
      latest = entry.updated_at;
    }
  }
  return latest;
}
