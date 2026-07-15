# Seat Booking — Phase 2 Plan

Implementation plan for the next iteration of the "Book Your Seat" feature.
Written for an AI coding agent (Cursor); file paths and behavioral contracts are
explicit. Follow the existing layered architecture strictly (see `CLAUDE.md`):
`routes/index.ts → Controller → Service → DataHelper → backend/data/*.json`.

---

## 0. Current architecture (read first, do not re-derive)

- **Backend**: `TicketingController` → `TicketingService` → `SeatingConfigDataHelper`
  (singleton config in `seatingConfig.json`), `SeatHoldDataHelper` (`seatHolds.json`,
  TTL-pruned), `BookingDataHelper` (`seatBookings.json`), `DiscountDataHelper`
  (`discountCodes.json`). Types in `backend/src/models/types.ts`
  (`SeatingConfig`, `SeatingSection`, `SeatBooking`, `SeatHold`, `DiscountCode`).
- **Seat model**: every seat is its own 1×1 `SeatingSection` (stable `section_id`);
  seat id = `${section_id}:1:1`. Matrix layout: `layout_mode: 'matrix'`,
  `matrix: {rows, cols}`, `seat_positions[seatId] = {x: col, y: row}`.
  Labels are `A1, B12` (row letter from stage + seat number skipping passages).
- **Availability**: `blocked` (admin) → `booked` (bookings with status
  `pending_payment` OR `confirmed`) → `held` (active holds). Cancelled bookings free seats.
- **Flow**: select seats + enter name/valid email/valid mobile → 10-min hold
  (`hold_minutes`) → checkout creates booking `pending_payment` → admin
  "Mark Paid" (→ `confirmed`) or "Cancel" (→ `cancelled`).
- **Frontend**: public `frontend/src/pages/BookYourSeat.tsx`; admin
  `frontend/src/pages/admin/AdminBookYourSeat.tsx` + `SeatGridDesigner.tsx`;
  API layer `frontend/src/services/api.ts` (`ticketingAPI`).
- **Important existing behavior (correcting a misconception)**: the 10-minute
  hold applies only BEFORE checkout. After checkout, a `pending_payment`
  booking blocks its seats indefinitely — there is no auto-release. A slow
  admin can NEVER cost a paying user their seats. The real gap is the
  opposite: a no-pay user locks seats forever until admin cancels manually.

---

## 1. Feature A — Pending-payment lifecycle (closes the no-pay gap)

### Requirements
1. `pending_payment` bookings must not lock seats forever.
2. A user who paid must never lose seats to a timer — payment verification is
   manual (Zelle), so the window must be generous and configurable, NOT the
   10-minute hold timer.

### Design
- Add to `SeatingConfig`: `payment_window_hours: number` (default **48**,
  admin-editable in Setup tab, validate integer 1–336).
- Add to `SeatBooking`: `payment_due_at: string` (ISO, set at checkout =
  created_at + payment_window_hours). Persisted so later config changes don't
  move existing deadlines.
- **Lazy expiry sweep** (same pattern as `SeatHoldDataHelper.findActive()`):
  in `BookingDataHelper`, add `expireOverdue()` — any `pending_payment` booking
  with `payment_due_at < now` becomes status `'expired'` (new `BookingStatus`
  value; do NOT reuse `cancelled` so admins can distinguish). Call it at the
  top of `findSeatBlocking()`, `findAll()`, and `findById()`. `expired` does
  not block seats.
- **Admin protections against the "user paid but window lapsed" edge**:
  - Bookings tab: pending bookings show a live countdown ("expires in 41h") and
    an **Extend +24h** button (`PUT /booking/admin/bookings/:id/extend`,
    auditLogged) that pushes `payment_due_at`.
  - A booking that expired can be **revived**: "Mark Paid" on an `expired`
    booking re-validates seat availability first (its seats may have been
    resold); if all seats are still free → set `confirmed`; else return 409
    with the list of conflicting seats so the admin can rebook the guest.
- **Buyer communication (requires EmailService integration, see Gap G1)**:
  - On checkout: email booking summary + payment instructions + deadline.
  - On confirm: email confirmation with seat labels.
  - On expiry: email "booking lapsed" notice.
  - Implement via existing `EmailService`; wrap in try/catch — email failure
    must never fail the booking operation (follow `syncFromEvent` pattern).
- **Public page**: confirmation screen shows the payment deadline explicitly
  ("Pay within 48 hours or the reservation lapses").

### Acceptance tests (backend, vitest-style like `src/tests/ticketing.test.ts`)
- Checkout stamps `payment_due_at` = created + window.
- Overdue pending booking flips to `expired` on read and frees seats.
- Confirmed bookings never expire.
- Extend pushes the deadline; revive succeeds when seats free, 409 when not.

---

## 2. Feature B — Multiple seat maps: event + sub-events, category-first flow

### Requirements (as specified by owner)
1. One event can have two (N) sub-events, each with its **own seat map**.
2. **Whole-event buyers** see BOTH maps and pick seats on each (one combined
   booking).
3. **Category-first UX**: buyer picks scope (whole event vs one sub-event) and
   a category (VIP / Platinum / Standard); the maps then only allow seats of
   that category (others rendered dimmed/disabled).
4. Public page needs a scope selector (radio/dropdown) + category selector.

### Data model changes
- **Replace the singleton config with a collection**: new file
  `seatMaps.json` managed by a reworked `SeatingConfigDataHelper` →
  rename/extend to `SeatMapDataHelper`:
  ```ts
  interface SeatMap {            // one per sub-event (or per event if no sub-events)
    map_id: string;              // generate12DigitAlphanumericId()
    event_id: string;            // required
    sub_event_id?: string;       // required when the event has sub-events
    name: string;                // e.g. "Cultural Night — Main Hall"
    is_open: boolean;
    matrix: { rows: number; cols: number };
    sections: SeatingSection[];  // per-seat 1×1 sections, as today
    seat_positions: Record<string, SeatPosition>;
    blocked_seats: string[];
    updated_at: string;
  }
  ```
- **Categories move to event level** (so "VIP" means the same tier on every
  map of that event): new file `ticketingProfile.json`:
  ```ts
  interface TicketingProfile {   // one per event; keep as array keyed by event_id
    event_id: string;
    categories: SeatCategory[];  // category_id, name, price, color (price per seat per sub-event map)
    hold_minutes: number;
    payment_window_hours: number;
    booking_note?: string;
    updated_at: string;
  }
  ```
  Decision (owner-confirmed default): a category has ONE price per seat and
  the price applies per seat per map (whole-event = pays for seats on both
  maps). If per-sub-event pricing is later needed, add optional
  `price_overrides: Record<sub_event_id, number>` on the category.
- **Seat ids become map-scoped**: global seat key = `${map_id}|${section_id}:1:1`.
  Holds and bookings store these full keys. `SeatHold` gains nothing (seat_ids
  are just strings); `SeatBooking.seats_detail` entries gain
  `sub_event_id` + `map_name` so tickets read
  "Cultural Night — A12 (VIP)".
- **Migration**: on first read, if legacy `seatingConfig.json` exists with
  sections, convert it into one `SeatMap` (event/sub-event association and
  matrix carried over) + one `TicketingProfile` (categories, hold_minutes,
  booking_note), then leave the legacy file untouched (read-once migration,
  write the new files). Existing bookings keep their old seat ids — the
  migrated map must preserve `section_id`s, and availability lookups must
  check BOTH old-style (`SEC:1:1`) and new-style (`MAP|SEC:1:1`) ids for the
  migrated map (write a `normalizeSeatKey(map_id, seatId)` helper used
  everywhere availability is computed).

### Service/API changes (`TicketingService`, `TicketingController`, `routes/index.ts`)
- Public:
  - `GET /booking/config` → returns: active event info, its sub-events that
    have maps, the profile (categories etc.), and all OPEN maps (without
    blocked_seats). Shape:
    `{ event, sub_events: [...], categories, hold_minutes, maps: [{map_id, name, sub_event_id, matrix, sections, seat_positions}] }`.
  - `GET /booking/availability` → `{ unavailable: Record<fullSeatKey, reason> }`
    across all maps of the active event.
  - `POST /booking/hold` body `{ seat_keys: string[] }` — seats may span
    multiple maps; validate each against its map; enforce the 10-seat cap
    ACROSS the whole order (all maps combined).
  - `POST /booking/checkout` unchanged shape; `seats_detail` now carries
    sub-event context; booking `event_id` from the maps' shared event;
    stamp `sub_event_ids: string[]` (all maps touched).
  - **Category enforcement server-side**: hold request also carries
    `category_id`; reject any seat whose section category ≠ requested
    category (the category-first rule must not be client-only).
- Admin:
  - `GET/POST/PUT/DELETE /booking/admin/maps` (+ `/maps/:mapId`) — CRUD for
    seat maps; each map keeps the SeatGridDesigner payload (matrix, sections,
    positions, blocked). Deleting a map with non-cancelled bookings → 409.
  - `PUT /booking/admin/profile` — categories, hold_minutes,
    payment_window_hours, booking_note. Guard: cannot delete a category still
    used by any map's sections.
  - Event/sub-event association moves from config to each map (`event_id` +
    `sub_event_id`); keep the existing rules: must exist, sub-event must
    belong to event, no past events/sub-events on NEW association, cannot
    open a map without association.
  - All mutations keep `requireAdmin` + `auditLog(...)` per route, wired in
    `routes/index.ts` below the `authenticate` line.

### Admin UI (`AdminBookYourSeat.tsx`)
- Setup tab: event picker (unchanged) + profile fields (categories,
  hold_minutes, payment_window_hours, note).
- Seat Map tab becomes **Seat Maps**: list of maps for the event
  ("Whole event" map when no sub-events, or one per sub-event with an
  "Add map for sub-event…" dropdown of that event's sub-events without maps).
  Selecting a map opens the existing `SeatGridDesigner` (component reused
  as-is; it already takes seats/blocked/dims via props — just feed it the
  selected map and save to `PUT /booking/admin/maps/:mapId`).
- Per-map open/close toggle; master "booking open" comes from: at least one
  map open.
- Bookings tab: group each booking's seats by sub-event; show countdown +
  Extend + revive (Feature A).

### Public UI (`BookYourSeat.tsx`)
- New **step 0 controls** above the map area:
  - Scope: radio — "Entire event (all programs)" / one radio per sub-event
    with a map (labels from sub-event names). If the event has no sub-events,
    hide the control entirely and behave as today.
  - Category: pill buttons (VIP / Platinum / Standard) rendered from profile
    categories with color + price. Category must be chosen before seats can
    be selected (seat clicks disabled until then).
- Map area: whole-event scope stacks BOTH maps, each under a heading
  (sub-event name + date); single-sub-event scope shows only that map.
  Seats not matching the chosen category are dimmed & disabled. Changing
  category clears the selection (confirm dialog if seats selected). Changing
  scope clears the selection.
- Selection panel: seats grouped by sub-event; the 10-seat cap counts ALL
  selected seats across maps. Everything else (details-before-hold, hold
  timer, sessionStorage hold recovery, sendBeacon release, discount, Zelle
  confirmation) is unchanged.
- Confirmation + admin booking rows display seat labels with their sub-event
  prefix.

### Acceptance tests
- Two maps under one event; whole-event hold with seats from both maps →
  one booking, seats_detail carries both sub-events, both maps' availability
  updated.
- Hold with mixed categories rejected; hold with wrong category vs declared
  category rejected (server-side).
- 10-seat cap enforced across maps combined (6 + 5 → reject).
- Sub-event scope: seats from the other map in the same request → reject.
- Legacy singleton config migrates to one map + profile; old bookings' seats
  still show as booked.

---

## 3. Other gaps found (include in implementation)

- **G1 — No emails at all.** Buyers get no record; admins must watch the
  dashboard. Integrate `EmailService` (exists for admin email page) for:
  booking created (with payment instructions + deadline + booking id),
  payment confirmed, booking cancelled/expired. Also notify the admin email
  on each new booking. All sends fire-and-forget.
- **G2 — Seat-hoarding by repeat checkouts.** One email/phone can create
  unlimited pending bookings. Enforce at checkout: max **2 active
  `pending_payment` bookings per email (case-insensitive)**; error message
  tells the user to complete payment on the existing booking first. Admin
  bookings list groups by email to spot abuse.
- **G3 — No buyer self-service.** Add public page `/my-booking`: lookup by
  booking id + email (both must match; avoids enumeration). Shows status,
  seats, deadline, payment instructions; allows self-cancel while
  `pending_payment` (frees seats instantly). Route `GET /booking/lookup?...`
  public, rate-limit lightly (simple in-memory counter is fine).
- **G4 — Manual payment matching is error-prone.** "Mark Paid" should open a
  small dialog to record `payment_reference` (free text: Zelle confirmation
  or note) stored on the booking and shown in the row + audit log.
- **G5 — No reporting.** Admin Bookings tab: summary strip (counts + revenue
  by status, by category, by sub-event) and an **Export CSV** button
  (client-side CSV from loaded bookings is sufficient).
- **G6 — Concurrency ceiling.** JSON read-modify-write is safe only in a
  single Node process. Document in `docs/`: pm2 must run this app with ONE
  instance (no cluster mode) or seat integrity breaks. (No code change; add a
  startup warning log if `process.env.pm_id` indicates cluster.)
- **G7 — Discount codes are event-agnostic.** Scope discounts to the event
  (add `event_id?` to `DiscountCode`; empty = all events); Feature B makes
  this matter once past-event codes linger.
- **G8 — Sub-event deletion/edit drift.** If an admin deletes or re-dates a
  sub-event that has a seat map: block deletion while a map with
  non-cancelled bookings exists (409 from SubEvent service), and surface a
  warning banner on the map when its sub-event date passed.
- **G9 — Accessibility/mobile polish on the map.** Seat buttons need
  `aria-pressed`, and on small screens the per-map grid should allow
  pinch/scroll when cols > ~30 (fit-to-width already exists; keep tooltips
  long-press friendly by also showing the selected seat list prominently).

---

## 4. Suggested implementation order

1. **Phase 1 (independent, small):** Feature A (payment window, expired
   status, extend/revive) + G4 (payment reference) + G2 (pending cap).
2. **Phase 2 (the big one):** Feature B data model + migration + admin
   multi-map UI + public scope/category flow. Keep every existing behavior
   test passing; extend `src/tests/ticketing.test.ts`.
3. **Phase 3:** G1 emails, G3 buyer lookup page, G5 reporting/CSV.
4. **Phase 4:** G7, G8, G9, G6 doc note.

## 5. Decisions already made (do not re-ask)

- Payment window default 48h, admin-configurable, per-booking stamp.
- Expired ≠ cancelled (separate status, revivable with availability re-check).
- Categories defined per event, one price per category per seat per map.
- Whole-event booking does NOT require equal seat counts on both maps — the
  buyer freely picks seats on each map; cap is 10 combined.
- Category-first is enforced server-side (hold carries category_id).
- Existing constraints stay: 10-min hold TTL, details-before-hold validation
  (name / valid email / 10-15 digit mobile), no past event/sub-event
  association, Zelle + manual confirm as the payment model.
