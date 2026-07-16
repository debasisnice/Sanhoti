# Cursor Task — Ticket Setups (save / archive) + Saved Theater Maps

> **How to run.** Self-contained spec. Implement **top-to-bottom** via **§10 Execution
> steps**, running each step's **Verify** before continuing. Edit only files listed in
> **§9**. Keep the public booking flow working unchanged. Ask nothing — defaults are
> chosen; deviations are called out as NOTE.

---

## 1. Project context

**Sanhoti** — monorepo, `backend/` (Express + TypeScript, JSON files in `backend/data/`)
and `frontend/` (React + TS + Vite + Tailwind). Layering (never skip):
`routes/index.ts → controllers/*Controller.ts → services/*Service.ts → data/*DataHelper.ts → backend/data/*.json`.
Admin routes sit below `router.use(authenticate)`, use `requireAdmin`, and add
`auditLog(action, resource)` for mutations. Frontend HTTP lives only in
`frontend/src/services/api.ts` (JWT auto-attached). Ticketing admin is
`frontend/src/pages/admin/AdminBookYourSeat.tsx` (route `/admin/book-your-seat`,
title "Ticket Settings"). Commands (per package): `npx tsc --noEmit`,
`npx vitest run <file>`, `npm run lint`.

## 2. Current baseline (what exists today)

- **Live ticketing config per event** = `TicketingProfile` (keyed by `event_id`, in
  `backend/data/ticketingProfile.json`): `categories`, `child_age_range`, `meal_days`,
  `sub_event_configs` (each has `enabled_category_ids`, `category_prices`,
  `food_addons` with `meal_day_id`/`meal_type`), `hold_minutes`,
  `payment_window_hours`, `booking_note`.
- **Seat maps** = `SeatMap[]` per event/sub-event (`backend/data/seatMaps.json`),
  designed with `SeatGridDesigner` (frontend).
- **Reusable layouts** = `SeatMapTemplate` limited to **2 fixed slots** (slot 1|2) in
  `backend/data/seatMapTemplates.json` (`SeatMapTemplateDataHelper.upsertSlot`).
- **Discounts** = `DiscountCode[]` — **global**, not event-scoped
  (`backend/data/discountCodes.json`).
- The public booking flow (`TicketingService.getPublicConfig`, `checkout`,
  `getUnavailableSeats`, …) reads the profile + open maps for the active event. **Do
  not change this read path.**
- `AdminBookYourSeat.tsx` currently has one tab row (Entire Event Tickets · Daily Lunch
  & Dinner Pricing · Sub Event Tickets · Seat Maps · Discounts), all editing the live
  config for the selected event; a `saveSetup()` writes the profile.

## 3. Goal

Restructure the ticketing admin into **three top-level tabs**, and add saved,
archivable, event-level **ticket setups** plus a reusable **theater-map library**:

- **New Ticket Setup** (rename of today's "Setup"): submenu **Entire Event Tickets ·
  Daily Lunch & Dinner Pricing · Sub Event Tickets · Seat Maps · Discounts**. Build a
  setup for an event and **Save**.
- **Event Tickets**: the list of **saved ticket setups**. Each Save from New Ticket
  Setup stores/updates that event's **one active** setup. Dropdown when several;
  default the most recent. **Archived** setups are **read-only**. Admin can **Archive**
  the active setup and **Delete** any setup.
- **Saved Theater Maps**: a reusable seat/theater-map **library** — view, edit, save,
  create new — independent of any event.

Decisions (locked): a setup is encapsulated **at the event level** (all its sub-events,
meals, maps, discounts as one unit); **one active setup per event**; a setup is
read-only **only once archived**; **Save updates the active setup in place**, **Archive
freezes it read-only** (freeing the event to get a new active setup), **Delete** removes
any setup.

---

## 4. Data model (backend/src/models/types.ts + mirror in api.ts)

### TicketSetup — new (`backend/data/ticketSetups.json`)
```ts
export interface TicketSetupSnapshot {
  categories: SeatCategory[];
  child_age_range: ChildAgeRange;
  meal_days: MealDayPricing[];
  sub_event_configs: SubEventTicketingConfig[];
  hold_minutes: number;
  payment_window_hours: number;
  booking_note?: string;
  seat_maps: SeatMap[];      // the event's maps at save time
  discounts: DiscountCode[]; // discounts included in this setup (see NOTE-discounts)
}

export interface TicketSetup {
  setup_id: string;              // generate12DigitAlphanumericId()
  event_id: string;
  event_name: string;            // snapshot for display when the event changes
  label: string;                 // e.g. "Durga Puja 2026 — saved 2026-07-15"
  status: 'active' | 'archived';
  snapshot: TicketSetupSnapshot;
  created_at: string;
  updated_at: string;
  archived_at?: string;
}
```
**Invariant:** at most one `status:'active'` per `event_id`.

### TheaterMap — new reusable library (`backend/data/theaterMaps.json`)
```ts
export interface TheaterMap {
  theater_map_id: string;
  name: string;
  matrix: { rows: number; cols: number };
  seats: SeatMapTemplateSeat[];  // reuse existing template seat shape (row,col,category_name,blocked?)
  created_at: string;
  updated_at: string;
}
```
Generalizes the current 2-slot `SeatMapTemplate` into an unlimited library.

---

## 5. How Save / Active / Archive interact (the core behavior)

Keep the **live config** (profile + seatMaps + discounts) as the working store the
public booking flow uses — unchanged. Layer `TicketSetup` on top:

- **Save** (New Ticket Setup, for event E): write the live config exactly as
  `saveSetup` does today, **then** upsert E's **active** `TicketSetup` — snapshot the
  current profile fields + E's seat maps + the discounts, set `status:'active'`,
  `updated_at=now` (create if E has no active setup, else update in place). So the
  active setup always mirrors E's current live config.
- **Archive** (an event's active setup): set `status:'archived'`, `archived_at=now`.
  The snapshot is now frozen/read-only. E now has **no active setup**; the next Save
  from New Ticket Setup creates a new active one. (Booking continues to run off the live
  profile/maps as today — archiving is an organizational lock, not a booking switch.
  NOTE-archive-booking: if you also want Archive to close public booking for E, set all
  of E's `SeatMap.is_open=false` on archive — leave OFF unless the user asks.)
- **Delete** (any setup): remove the `TicketSetup` record. Deleting an active setup is
  allowed (it does not touch the live config).
- **Migration** (one-time, on service init or first list): for every event that has a
  `TicketingProfile`, create an **active** `TicketSetup` snapshotting its current
  profile + maps + discounts (so existing events appear under Event Tickets).

NOTE-discounts: discounts are **global** today. For event-level encapsulation, the
snapshot **copies** the current discount list into the setup (denormalized). The live
global discount store is unchanged. Archived setups therefore preserve the discounts as
they were at archive time. (A deeper refactor to scope discounts per event is out of
scope — flag if the user wants it.)

---

## 6. Backend — services, controllers, routes

### `TicketSetupService` (new, `backend/src/services/TicketSetupService.ts`)
```ts
listSetups(): Promise<TicketSetup[]>                       // newest first
getSetup(setupId): Promise<TicketSetup | null>
getActiveForEvent(eventId): Promise<TicketSetup | null>
saveActiveFromLiveConfig(eventId): Promise<TicketSetup>    // snapshot live → upsert active
archiveSetup(setupId): Promise<TicketSetup | null>         // active → archived
deleteSetup(setupId): Promise<boolean>
migrateFromExisting(): Promise<void>                        // one-time backfill
```
Reads live config via existing helpers (`TicketingProfileDataHelper.findByEventId`,
`SeatMapDataHelper.findByEventId`, `DiscountDataHelper.findAll`). Persists via new
`TicketSetupDataHelper` (extends `DatabaseHelper`, file `ticketSetups.json`).
`saveActiveFromLiveConfig` is called from `TicketingService.updateProfile`/`saveSetup`
path after the live write succeeds (or exposed as its own endpoint the frontend calls
right after Save).

### `TheaterMapService` (new) + `TheaterMapDataHelper` (`theaterMaps.json`)
```ts
listMaps(): Promise<TheaterMap[]>
getMap(id): Promise<TheaterMap | null>
createMap(input): Promise<TheaterMap>
updateMap(id, patch): Promise<TheaterMap | null>
deleteMap(id): Promise<boolean>
migrateFromTemplates(): Promise<void>   // copy the 2 SeatMapTemplate slots in
```
Validate `matrix` (rows 1–60, cols 1–80) and `seats` like the existing template
validation in `TicketingService.saveMapTemplate`.

### Routes (`backend/src/routes/index.ts`, admin, below `authenticate`)
```
GET    /booking/admin/setups                 → listSetups
GET    /booking/admin/setups/:id             → getSetup
POST   /booking/admin/setups/save            → saveActiveFromLiveConfig  (body { event_id })   auditLog('UPDATE','ticket-setup')
POST   /booking/admin/setups/:id/archive     → archiveSetup                                    auditLog('ARCHIVE','ticket-setup')
DELETE /booking/admin/setups/:id             → deleteSetup                                     auditLog('DELETE','ticket-setup')
GET    /booking/admin/theater-maps           → listMaps
POST   /booking/admin/theater-maps           → createMap    auditLog('CREATE','theater-map')
PUT    /booking/admin/theater-maps/:id       → updateMap    auditLog('UPDATE','theater-map')
DELETE /booking/admin/theater-maps/:id       → deleteMap    auditLog('DELETE','theater-map')
```
Register static paths before any parameterized ones, per repo convention.

---

## 7. Frontend — three-tab restructure (`AdminBookYourSeat.tsx` + new files)

Replace the current single tab row with **three top-level tabs**:
`type TopTab = 'new_setup' | 'event_tickets' | 'theater_maps'`.

- **New Ticket Setup** (`new_setup`): the existing editor. Keep the current sub-tab
  submenu (Entire Event Tickets · Daily Lunch & Dinner Pricing · Sub Event Tickets ·
  Seat Maps · Discounts) — restore it as a **second-level** sub-tab bar under this tab
  (it was recently flattened; re-nest it). After `saveSetup()` succeeds, call
  `ticketSetupsAPI.save(event_id)` so the active setup is snapshotted. Add an
  **"Archive this setup"** button (calls archive on the event's active setup, with a
  confirm) — after archiving, clear/refresh so the event can start a new setup.
- **Event Tickets** (`event_tickets`) → new component `AdminEventTickets.tsx`:
  - Load `ticketSetupsAPI.list()`. Show a **dropdown** (or table) of setups; default to
    the **most recent** (newest `updated_at`), preferring active. Group/label by event
    and status (Active / Archived + date).
  - Render the selected setup **read-only** when `status==='archived'` (and always for
    non-active). Read-only = a summary view of the snapshot (categories, meal pricing,
    sub-events, seat map counts, discounts) with no editable inputs.
  - Actions: **Archive** (only on an active setup), **Delete** (any, with confirm). An
    active, editable setup links back to New Ticket Setup for editing.
- **Saved Theater Maps** (`theater_maps`) → new component `AdminTheaterMaps.tsx`:
  - List theater maps (`theaterMapsAPI.list()`), **New map**, edit (reuse
    `SeatGridDesigner`), **Save** (create/update), **Delete**.
  - In **New Ticket Setup → Seat Maps**, add a "Start from saved theater map" picker
    that loads a `TheaterMap` into the grid designer (reuse the existing
    apply-template code path, generalized to a `theater_map_id`).

### `api.ts`
```ts
export const ticketSetupsAPI = {
  list, get(id), save(eventId), archive(id), remove(id)
};
export const theaterMapsAPI = {
  list, create(data), update(id, patch), remove(id)
};
```
Add `TicketSetup`, `TicketSetupSnapshot`, `TheaterMap` types (mirror backend).

---

## 8. Read-only rendering of archived setups

Build a presentational `TicketSetupView` (read-only) that renders a snapshot: event +
label + status badge, entire-event categories & prices, meal-day pricing table,
per-sub-event ticketing (categories, food add-ons), seat-map summary (name + seat
count per map), and discount list. No inputs, no Save. Used by Event Tickets for
archived/non-active setups.

## 9. File change map (create/edit only these)

Backend: `models/types.ts`; new `data/TicketSetupDataHelper.ts`,
`data/TheaterMapDataHelper.ts`, `services/TicketSetupService.ts`,
`services/TheaterMapService.ts`, `controllers/TicketSetupController.ts`,
`controllers/TheaterMapController.ts`; `routes/index.ts`; small hook in
`services/TicketingService.ts` (expose live-config snapshot helper if needed).
Frontend: `services/api.ts`; `pages/admin/AdminBookYourSeat.tsx`; new
`pages/admin/AdminEventTickets.tsx`, `pages/admin/AdminTheaterMaps.tsx`,
`pages/admin/TicketSetupView.tsx`; reuse `pages/admin/SeatGridDesigner.tsx`.

## 10. Execution steps (Verify after each)

1. **Types** (`types.ts` + `api.ts` mirror). Verify: `cd backend && npx tsc --noEmit`.
2. **Data helpers** (`TicketSetupDataHelper`, `TheaterMapDataHelper`). Verify: backend `tsc`.
3. **Services** (`TicketSetupService` incl. migration snapshot; `TheaterMapService`
   incl. template migration). Verify: backend `tsc` + a small `vitest` for
   snapshot/archive/one-active-invariant if a harness exists.
4. **Controllers + routes** (+ auditLog). Verify: backend `tsc`.
5. **api.ts** wrappers/types. Verify: `cd frontend && npx tsc --noEmit`.
6. **New Ticket Setup**: re-nest the 5 sub-tabs under the `new_setup` top tab, rename,
   wire post-save `ticketSetupsAPI.save`, add Archive button. Verify: frontend `tsc`.
7. **AdminEventTickets** + **TicketSetupView** (dropdown, read-only archived, archive/delete). Verify: frontend `tsc` + `npm run lint`.
8. **AdminTheaterMaps** + "start from saved theater map" in Seat Maps. Verify: frontend `tsc` + `npm run lint`.
9. **Full check:** `cd backend && npm test`; `cd frontend && npm test`.

## 11. Acceptance

- Saving in New Ticket Setup for an event creates/updates exactly one **active** setup
  for that event; it appears under Event Tickets, most-recent default.
- Archiving the active setup makes it **read-only** and frees the event; a later Save
  creates a new active setup. Two active setups for one event never coexist.
- Delete removes any setup (active or archived) without breaking live booking.
- Saved Theater Maps: create/edit/save/delete works; a New Ticket Setup seat map can be
  started from a saved theater map.
- The public booking pages and existing `booking/*` endpoints behave exactly as before.

## 12. Guardrails

- **Do not alter the public booking read/checkout path** — `TicketSetup` is a
  save/snapshot layer over the unchanged live config.
- Enforce the **one-active-per-event** invariant in the service on every save/archive.
- Snapshots are **deep copies** (no shared references with live config objects).
- Archived setups are **immutable** — reject any edit endpoint targeting an archived
  setup.
- Keep migrations **idempotent** (don't duplicate active setups / theater maps on
  repeated runs).
- Only touch the §9 files; follow route-ordering and audit conventions.
