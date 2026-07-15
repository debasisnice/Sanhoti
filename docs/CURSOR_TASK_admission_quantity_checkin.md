# Cursor Task — Per‑Gate Quantity Check‑in, Meal Gates & Food‑Addon Picker

> **How to run this task (read first).** This is a single, self‑contained spec.
> Implement it **top‑to‑bottom** following the **§9 Execution steps**. After each
> numbered step, run that step's **Verify** command and fix errors before moving on.
> Only edit files listed in **§8 File change map**. Keep all pure logic (no I/O) in
> `backend/src/data/admissionCheckin.ts`. Do not refactor unrelated code.

---

## 1. Project context

**Sanhoti** is a Bengali community website. Monorepo, two npm workspaces:
`backend/` (Express + TypeScript, data stored as JSON files under `backend/data/`)
and `frontend/` (React + TypeScript + Vite + Tailwind).

**Backend layering (never skip a layer):**
`routes/index.ts → controllers/*Controller.ts → services/*Service.ts → data/*DataHelper.ts → backend/data/*.json`.
Controllers parse req/res only. Services hold business logic. DataHelpers are the only
layer that touches storage (`readFile`/`writeFile`, `generateId`,
`generate12DigitAlphanumericId`). All admin routes sit below `router.use(authenticate)`
and use `requireAdmin`; admin mutations add `auditLog(action, resource)`.

**Frontend:** `src/services/api.ts` is the only place HTTP calls are made (single
Axios instance, JWT auto‑attached, translates camelCase↔snake_case). Admin ticketing
UI is `src/pages/admin/AdminBookYourSeat.tsx` (tabs: Setup, Seat Maps, Bookings,
Discounts, **Scan QR**) and `src/pages/admin/AdminScanQR.tsx`.

**Commands** (run from `backend/` or `frontend/`):
`npx tsc --noEmit` (typecheck), `npx vitest run <file>` (tests), `npm run lint`,
`npm test`. `html5-qrcode` is already installed in `frontend`.

---

## 2. Current baseline (already implemented — this task MODIFIES it)

The event‑day admission scanner already exists and works for single‑entry check‑in:

- **QR token:** issued on "Mark Paid" (`BookingDataHelper.issueAdmissionQrToken`),
  encoded as `SANHOTI|{booking_id}|{token}` and emailed as the admission QR
  (`backend/src/data/AdmissionQRHelper.ts`). Confirmation email groups seats by
  sub‑event with meals at the bottom (`EmailService.renderBookingLineItems`).
- **Pure rules** in `backend/src/data/admissionCheckin.ts`: `parseAdmissionPayload`,
  `bookingSubEventIds`, `isWholeEventBooking`, `bookingCoversScope`,
  `scopeCheckedInAt`, `classifyAdmission`. **Scope today = `'event'` or a bare
  `sub_event_id`.** Entire‑event gate admits only whole‑event passes; a sub‑event
  gate admits whole‑event passes or that sub‑event's tickets.
- **`SeatBooking.admission_checkins`** is currently `Record<string, string>`
  (scope → ISO timestamp) — one boolean‑style check‑in per gate. Plus legacy mirror
  `admission_checked_in_at?`.
- **Service** (`TicketingService`): `scanAdmission(payload, scope, {dryRun,manual})`
  (stamps a timestamp per gate), `undoCheckin(bookingId, scope)`,
  `checkinStats(scope)` (returns seat counts), `toCheckinView(booking, scope)`
  (grouped seats + meals), `resolveActiveEventId`, `subEventNameMap`.
- **Routes:** `POST /booking/admin/checkin/scan`, `POST /booking/admin/checkin/undo`,
  `GET /booking/admin/checkin/stats?scope=`. Also `POST /booking/admin/bookings/:id/resend-ticket`.
- **Frontend** `AdminScanQR.tsx`: one gate dropdown (whole‑event + sub‑events passed
  in as props from `AdminBookYourSeat`), camera via **dynamic import** of
  `html5-qrcode`, manual‑entry fallback, insecure‑context (HTTP) banner, a seats
  counter, and an Undo button. `api.ts` has `ticketingAPI.scanAdmission`,
  `undoCheckin`, `checkinStats`, `resendTicket`.

**This task upgrades that baseline to:** two dropdowns (event → gate), meal gates &
food‑addon gates, **quantity/partial check‑in** with per‑gate people counts, and a
**correct‑to‑count** control replacing Undo.

---

## 3. Goals (admin experience)

On `/admin/book-your-seat` → **Scan QR** tab:

1. **First dropdown — Event.** Entire events only, showing future/ongoing events and
   events that ended **within the last 7 days** (hide events whose `event_end_dt` is
   more than 7 days in the past). Sorted by start date.
2. **Second dropdown — Gate.** After picking an event, show that event's **sub‑events**
   and **meals** (e.g. "Oct‑9 Friday Dinner", "Oct‑10 Saturday Lunch", "Cultural
   Night", "Concert"), grouped with `<optgroup>`.
3. **Entire‑event pass** validates at **any** sub‑event gate and **any** meal gate.
   **Sub‑event ticket** validates only at its own sub‑event gate (and its own food
   add‑on meal gates). Wrong gate → rejected.
4. **Quantity / partial check‑in.** Each gate tracks *people admitted / capacity*.
   A booking of **6** shows `0/6` at each of its gates; the admin admits people in any
   combination summing to ≤ 6 (6; 3+3; 3+2+1; 2+2+2; 1×6; …). At each scan the admin
   picks how many enter **now** from a `<select>` offering **`1 … remaining`**
   (defaults to `remaining`). When a gate reaches capacity, further scans there are
   blocked ("Already checked in — N/N").
5. **Correct count.** On any card with a real gate, a `0 … capacity` `<select>` preset
   to the current count lets the admin set the gate's checked‑in count to an absolute
   number (walk‑backs, over‑counts, resets).

Prerequisite (**Feature A**) makes sub‑event **food add‑ons** selectable from the
meals defined in *Daily Lunch & Dinner Pricing*, with an editable price.

---

## 4. Feature A — Sub‑event food‑addon picker (prerequisite)

**Where:** `AdminBookYourSeat.tsx`, Setup tab → **Sub Event Tickets** sub‑tab →
"Food add‑ons (checkout)" (currently a free‑text `name` input + prices, ~lines
1282–1365).

**Change:** the add‑on **name becomes a dropdown** built from the profile's
`meal_days` (the *Daily Lunch & Dinner Pricing* sub‑tab, `config.meal_days`):
for each `day`, add an option for lunch if `lunch_adult_price>0 || lunch_child_price>0`
(value `"${day.day_id}:lunch"`, label `"${day.label} Lunch"`) and likewise for dinner.

On select: set `addon.name = label`, `addon.meal_day_id = day.day_id`,
`addon.meal_type = 'lunch'|'dinner'`, and **prefill** `adult_price`/`child_price`
from that slot (admin may edit before saving — the sub‑event price is an override; do
not force‑resync on later meal_day edits).

**Types** — `FoodAddon` (in `backend/src/models/types.ts` **and** mirror in
`frontend/src/services/api.ts`):
```ts
export interface FoodAddon {
  addon_id: string;
  name: string;
  description?: string;
  adult_price: number;
  child_price: number;
  meal_day_id?: string;            // NEW
  meal_type?: 'lunch' | 'dinner';  // NEW
}
```
**Validation:** in the sub‑event‑config validator in `TicketingService`, accept and
pass through the two new optional fields; if `meal_day_id` is set it must exist in
`profile.meal_days` and `meal_type ∈ {lunch,dinner}`. Free‑text add‑ons (both fields
absent) remain valid.

---

## 5. Feature B — Gate scopes + capacity (pure, in `admissionCheckin.ts`)

Replace the `'event' | sub_event_id` scope with typed gate scopes:
```
sub:{sub_event_id}                // seat entry to a sub-event
meal:{day_id}:{lunch|dinner}      // entire-event meal (from meal_days)
addon:{sub_event_id}:{addon_id}   // sub-event food add-on meal
event                             // fallback single gate (event has no sub-events/meals)
```

**Capacity** — how many people this booking may admit at this gate,
`gateCapacity(booking, scope): number`:
- `sub:{id}` → entire‑event pass: `seats_detail.length`; sub‑event ticket incl. `{id}`:
  count of its seats for `{id}` (fallback `seats_detail.length`); else `0`.
- `meal:{day}:{type}` → entire‑event pass: matching `meals_detail` row's
  `adult_qty + child_qty` (0 if not present); else `0`.
- `addon:{sub}:{addon}` → matching `food_addons_detail` row's `adult_qty + child_qty`;
  else `0`.
- `event` → whole‑event booking: `seats_detail.length || 1`; else `0`.

`bookingCoversGate(booking, scope) = gateCapacity(...) > 0`. (This supersedes
`bookingCoversScope`; update or remove old callers.)

---

## 6. Feature C — Quantity data model + migration

**`SeatBooking.admission_checkins`** changes from `Record<string,string>` to counts
(in `types.ts` and mirror in `api.ts`):
```ts
export interface GateCheckinEvent { at: string; admitted?: number; set_to?: number; }
export interface GateCheckin {
  checked_in: number;        // people admitted so far at this gate
  updated_at: string;
  log?: GateCheckinEvent[];  // audit of admits + corrections
}
// SeatBooking.admission_checkins?: Record<string, GateCheckin>;
// keep admission_checked_in_at?: string as "most recent check-in" mirror
```

**`normalizeCheckins(booking)`** (pure, in `admissionCheckin.ts`) tolerates old data:
- value is a string `ts` → `{ checked_in: gateCapacity(booking, scope) || 1, updated_at: ts }`.
- value already a `GateCheckin` → keep.
- legacy `admission_checked_in_at` with no map, booking has no sub‑events/meals →
  treat as `event` gate fully checked in.
Call it wherever counts are read (`gateCheckedIn`, stats, scan, correct).

---

## 7. Feature D & E — Behavior (service, routes, UI)

### Scan (two‑step: scan → confirm)
`TicketingService.scanAdmission(rawPayload, rawScope, opts)`,
`opts = { manual?, dryRun?, admitQty? }`:
1. Parse payload / manual booking id; look up booking; verify token (unchanged).
2. `classifyAdmission(booking, { scope, tokenValid })` computes
   `capacity = gateCapacity`, `already = gateCheckedIn`, `remaining = capacity - already`,
   and `result`: `wrong_gate` if `capacity===0`; `already_checked_in` if `remaining<=0`;
   status/token branches (`cancelled|expired|payment_pending|not_found|invalid_qr`);
   else `admitted`.
3. **dry_run / no `admitQty`:** no mutation; return result + `{capacity, already, remaining}`
   + booking view (grouped seats/meals) + `gate_label`.
4. **commit (`dryRun!==true` && `admitQty` given):** re‑read booking, recompute
   `remaining`; if `remaining<=0` → `already_checked_in`; if `admitQty<1 || admitQty>remaining`
   → `over_capacity` (**no write**); else set
   `checkins[scope] = { checked_in: already+admitQty, updated_at: now, log: [...prev, {at:now, admitted:admitQty}] }`,
   set the mirror, persist; return `admitted` with `{capacity, checked_in, admitted_now, remaining}`.
5. Audit manually: booking_id + scope + admitted_now + result **only** (never the QR payload).

Result union (add `over_capacity`), backend + `api.ts`:
`admitted | already_checked_in | over_capacity | wrong_gate | cancelled | expired | payment_pending | not_found | invalid_qr`.

### Correct count — `setGateCheckin(bookingId, scope, count)`
`count` integer in `0..gateCapacity`; out of range → `over_capacity` (no write).
Set `checkins[scope] = { checked_in: count, updated_at: now, log: [...prev, {at:now, set_to:count}] }`;
`count===0` clears the gate. Recompute mirror = most recent `updated_at` among gates
with `checked_in>0`, else clear.

### Stats — `checkinStats(scope)` in **people**
Over confirmed bookings of the active event that cover `scope`:
`checked_in = Σ min(gateCheckedIn, capacity)`, `total = Σ gateCapacity`,
plus `bookings_total`, `bookings_done`. Returns
`{ scope, checked_in, total, bookings_total, bookings_done }`.

### Gates endpoint — `GET /booking/admin/checkin/gates?event_id=`
`listCheckinGates(eventId)` reads the event's `TicketingProfile` (`meal_days`,
`sub_event_configs`) + its sub‑events →
`{ event:{event_id,event_name}|null, gates: Array<{scope, group, label}> }`:
- Sub‑event gates (group "Sub‑events") for ticketed/`concert` sub‑events.
- Meal gates (group "Meals") `meal:{day_id}:{type}` for each priced meal slot; label
  from `meal_day.label`, prefixed with a weekday when `meal_day.date` is set
  ("Oct‑9 Friday Dinner").
- Add‑on gates (group "{sub‑event} add‑ons") `addon:{sub}:{addon_id}` for each
  sub‑event food add‑on.
- If the event has no sub‑events and no meals → single `{scope:'event', group:'Event', label:'Event entry'}`.

### Routes (`backend/src/routes/index.ts`)
- Keep `POST /booking/admin/checkin/scan` (now accepts `scope`, `admit_qty`, `dry_run`, `manual`).
- **Replace** `/checkin/undo` with `POST /booking/admin/checkin/correct` body `{booking_id, scope, count}`
  (`requireAdmin`, `auditLog('UPDATE','admission-checkin')` — body has no secret).
- Keep `GET /booking/admin/checkin/stats?scope=`.
- **Add** `GET /booking/admin/checkin/gates?event_id=` (`requireAdmin`).

### Scan tab UI (`AdminScanQR.tsx`) — self‑contained now
1. **Event `<select>`:** `eventsAPI.getAll()`, filter
   `new Date(e.event_end_dt) >= Date.now() - 7*86400000`, sort by `event_start_dt`;
   persist in `sessionStorage`.
2. **Gate `<select>`:** on event change `ticketingAPI.checkinGates(eventId)` →
   `<optgroup>` per `group`; persist in `sessionStorage`.
3. **Counter:** `ticketingAPI.checkinStats(scope)` → `checked_in / total` (people);
   refresh after each commit.
4. **Scan:** decode / manual id → `scanAdmission(payload, scope, {dryRun:true})`; show
   card. For an admissible result show `capacity`, `already`, `remaining`, a
   **"People entering now" `<select>`** with options `1..remaining` (default `remaining`),
   and **"Admit N"** → `scanAdmission(payload, scope, {admitQty:n})` (or `{manual:true,admitQty:n}`),
   then refresh. When `remaining===0`: no dropdown; show "Already checked in — N/N".
5. **Correct count control:** a `0..capacity` `<select>` preset to current `checked_in`
   + Save → `correctCheckin(bookingId, scope, count)`, then refresh. (Replaces Undo.)
6. Keep: dynamic import of `html5-qrcode`, manual entry, insecure‑context banner,
   `invalid_qr` diagnostic (shows scanned text), grouped seats + meals in the card.

### `api.ts`
Add/adjust: `getProfile(eventId)` (`GET /booking/admin/profile?event_id=`),
`checkinGates(eventId)`, `scanAdmission(payload, scope, {manual?,dryRun?,admitQty?})`
(sends `admit_qty`), `correctCheckin(bookingId, scope, count)` (replaces `undoCheckin`),
and the updated `CheckinStats`, `AdmissionScanResult` (gate fields), gate‑list types,
and `AdmissionResult` union.

---

## 8. File change map (edit ONLY these)

- `backend/src/models/types.ts`
- `backend/src/data/admissionCheckin.ts`
- `backend/src/services/TicketingService.ts`
- `backend/src/controllers/TicketingController.ts`
- `backend/src/routes/index.ts`
- `backend/src/tests/admission-checkin.test.ts`
- `frontend/src/services/api.ts`
- `frontend/src/pages/admin/AdminScanQR.tsx`
- `frontend/src/pages/admin/AdminBookYourSeat.tsx`

## 8b. Exact signatures (names verbatim)

```ts
// admissionCheckin.ts
export type GateKind = 'sub' | 'meal' | 'addon' | 'event';
export interface ParsedGate { kind: GateKind; subEventId?: string; dayId?: string;
  mealType?: 'lunch'|'dinner'; addonId?: string; raw: string; }
export function parseGateScope(scope: string): ParsedGate | null;
export function gateCapacity(booking: SeatBooking, scope: string): number;
export function bookingCoversGate(booking: SeatBooking, scope: string): boolean;
export function gateCheckedIn(booking: SeatBooking, scope: string): number;
export function normalizeCheckins(booking: SeatBooking): Record<string, GateCheckin>;
export interface AdmissionEvaluation { result: AdmissionResult; capacity: number;
  already: number; remaining: number; admit: boolean; }
export function classifyAdmission(booking: SeatBooking | null,
  opts: { scope: string; tokenValid: boolean }): AdmissionEvaluation;

// TicketingService
async scanAdmission(rawPayload: unknown, rawScope: unknown,
  opts?: { dryRun?: boolean; manual?: boolean; admitQty?: number }): Promise<AdmissionScanResult>;
async setGateCheckin(bookingId: string, rawScope: unknown, rawCount: unknown): Promise<AdmissionScanResult | null>;
async checkinStats(rawScope: unknown): Promise<CheckinStats>;
async listCheckinGates(eventId: string): Promise<{ event: {event_id:string; event_name:string}|null; gates: Array<{scope:string; group:string; label:string}> }>;
// TicketingController: scanAdmission, correctCheckin, checkinStats, listCheckinGates
```

---

## 9. Execution steps (run the Verify after each; fix before continuing)

1. **Types:** `types.ts` (FoodAddon fields, GateCheckin(+Event), admission_checkins
   shape) + mirror in `api.ts`. **Verify:** `cd backend && npx tsc --noEmit`.
2. **Pure helpers** in `admissionCheckin.ts` (scopes, capacity, classify, normalize)
   **+ rewrite** `admission-checkin.test.ts` (see §10). **Verify:**
   `cd backend && npx vitest run src/tests/admission-checkin.test.ts`.
3. **Service:** scan qty, `setGateCheckin`, `checkinStats` (people), `listCheckinGates`,
   `toCheckinView` gate fields, food‑addon validation. **Verify:** `cd backend && npx tsc --noEmit`.
4. **Controller + routes** (`correctCheckin`, `listCheckinGates`; swap undo→correct; add gates).
   **Verify:** `cd backend && npx tsc --noEmit`.
5. **Feature A UI** food‑addon dropdown in `AdminBookYourSeat.tsx`.
   **Verify:** `cd frontend && npx tsc --noEmit`.
6. **api.ts** wrappers + types. **Verify:** `cd frontend && npx tsc --noEmit`.
7. **Scan tab** `AdminScanQR.tsx` (two dropdowns, quantity select, correct control,
   counter). **Verify:** `cd frontend && npx tsc --noEmit && npm run lint`.
8. **Full check:** `cd backend && npm test` and `cd frontend && npm test`.

---

## 10. Tests (`backend/src/tests/admission-checkin.test.ts`)

Pure, no I/O:
- `parseGateScope` for all four shapes; rejects garbage.
- `gateCapacity`: entire‑event pass vs sub‑event ticket across `sub:`/`meal:`/`addon:`;
  0 for non‑covered gates.
- `classifyAdmission`: `admitted` with correct `capacity/already/remaining`;
  `already_checked_in` at full; `wrong_gate` at capacity 0; status + token branches.
- Quantity combos reach full: 3+3, 3+2+1, 2+2+2, 1×6 all → 6/6; `admitQty>remaining` → `over_capacity`.
- `setGateCheckin`: absolute set; `count>capacity` → `over_capacity`; `count===0` clears.
- `normalizeCheckins`: old timestamp map → counts; legacy single field → event gate.

---

## 11. Acceptance examples

Event with sub‑events SE1, SE2 and meals Fri Dinner, Sat Lunch, Sat Dinner, Sun Lunch.
- **6 entire‑event passes:** every gate shows `0/6`; each admits up to 6 across any
  combination; independent per gate.
- **4 SE1 tickets:** SE1 gate `0/4`; SE2 and all meal gates reject them (wrong gate);
  SE1 food add‑on is its own `addon:SE1:*` gate.
- **2 entire‑event passes at Fri Dinner:** admit 1 → `1/2`; same QR later admit 1 →
  `2/2`; next scan → "Already checked in 2/2". Admin can Correct to any `0..2`.

---

## 12. Invariants / guardrails (do not violate)

- Capacity is **always computed live** from the booking; never persist capacity.
- Server validates/clamps every mutation: admit `1..remaining`, correct `0..capacity`;
  out of range → `over_capacity`, **no** DB write. UI never sends values it didn't
  offer, but the server still guards.
- Scan/correct responses are **HTTP 200 with a result object** (success and failure alike).
- Never write the QR payload to the audit log (scan audits booking_id + scope +
  admitted_now + result only). `/correct` body has no secret → generic middleware is fine.
- `html5-qrcode` stays a **dynamic import** in `AdminScanQR.tsx` (no static top‑level import).
- Keep the insecure‑context (HTTP) banner and manual‑entry fallback working.
- Preserve all other booking/email behavior; touch only §8 files.
