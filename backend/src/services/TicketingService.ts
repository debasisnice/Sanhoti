import { SeatMapDataHelper } from '../data/SeatMapDataHelper.js';
import { SeatMapTemplateDataHelper } from '../data/SeatMapTemplateDataHelper.js';
import { TheaterMapDataHelper } from '../data/TheaterMapDataHelper.js';
import { TicketingProfileDataHelper, categoryAdultPrice, categoryChildPrice, categoriesForEntireEvent, categoriesForSubEvent, migrateProfileCategories } from '../data/TicketingProfileDataHelper.js';
import { SeatHoldDataHelper } from '../data/SeatHoldDataHelper.js';
import { BookingDataHelper, MAX_PENDING_BOOKINGS_PER_EMAIL } from '../data/BookingDataHelper.js';
import {
  extendPaymentDueAt,
  findSeatConflictsForRevive,
  paymentDueAtFromNow,
} from '../data/bookingLifecycle.js';
import { DiscountDataHelper } from '../data/DiscountDataHelper.js';
import { SettingsDataHelper } from '../data/SettingsDataHelper.js';
import { EventDataHelper } from '../data/EventDataHelper.js';
import { SubEventDataHelper } from '../data/SubEventDataHelper.js';
import { EmailService } from '../services/EmailService.js';
import { readPaymentQRAttachment } from '../data/PaymentQRDataHelper.js';
import { buildAdmissionQrAttachment } from '../data/AdmissionQRHelper.js';
import {
  AdmissionResult,
  applyAdmitToGate,
  applySetGateCheckin,
  bookingCoversGate,
  bookingSubEventIds,
  classifyAdmission,
  gateCapacity,
  gateCheckedIn,
  mirrorCheckedInAt,
  normalizeCheckins,
  parseAdmissionPayload,
  parseGateScope,
  scopeCheckedInAt,
  validateAdmitQty,
  validateCorrectCount,
  enrichFoodAddonsWithMealSlots,
  inferMealSlotFromFoodAddonName,
} from '../data/admissionCheckin.js';
import {
  BookedFoodAddon,
  BookedMealDetail,
  BookedSeatDetail,
  BookingStatus,
  ChildAgeRange,
  DiscountCode,
  Event,
  FoodAddon,
  MealDayPricing,
  SeatBooking,
  SeatCategory,
  SeatHold,
  SeatMap,
  SeatMapTemplate,
  SeatMapTemplateSeat,
  SeatingConfig,
  SeatingSection,
  SubEvent,
  SubEventCategoryPricing,
  SubEventTicketingConfig,
  TicketingProfile,
} from '../models/types.js';

const MAX_PARTY_SIZE = 10;
const MAX_SECTIONS = 2000;
const MAX_CATEGORIES = 10;
const MAX_MEAL_DAYS = 21;
const MAX_FOOD_ADDONS = 30;
const MAX_ROWS = 50;
const MAX_SEATS_PER_ROW = 60;
const MAX_TEXT = 200;
const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function hasPricedMeals(mealDays: MealDayPricing[] | undefined): boolean {
  return (mealDays ?? []).some(day =>
    day.lunch_adult_price > 0 ||
    day.lunch_child_price > 0 ||
    day.dinner_adult_price > 0 ||
    day.dinner_child_price > 0
  );
}

export type UnavailableSeats = Record<string, 'booked' | 'held' | 'blocked'>;

export interface DiscountPreview {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  discount_amount: number;
  total: number;
}

export interface CheckinSeat {
  label: string;
  category_name: string;
  audience_type?: 'adult' | 'child';
}

export interface CheckinSeatGroup {
  sub_event_name: string;
  seats: CheckinSeat[];
}

export interface CheckinGateProgress {
  scope: string;
  label: string;
  already: number;
  capacity: number;
  remaining: number;
  current: boolean;
}

export interface CheckinBookingView {
  booking_id: string;
  name: string;
  status: BookingStatus;
  event_context: string;
  seat_count: number;
  /** Seats grouped by sub-event (entire-event seats grouped under "Entire Event"). */
  seat_groups: CheckinSeatGroup[];
  meals_detail: Array<{ label: string; meal_type: 'lunch' | 'dinner'; adult_qty: number; child_qty: number }>;
  meal_headcount: number;
  sub_event_names: string[];
  admission_checked_in_at?: string;
  capacity?: number;
  already?: number;
  remaining?: number;
  checked_in?: number;
}

export interface CheckinStats {
  scope: string;
  checked_in: number;
  total: number;
  bookings_total: number;
  bookings_done: number;
}

export interface AdmissionScanResult {
  result: AdmissionResult;
  booking: CheckinBookingView | null;
  capacity?: number;
  already?: number;
  remaining?: number;
  checked_in?: number;
  admitted_now?: number;
  gate_label?: string;
  /** Per-gate check-in status when this booking covers multiple gates (entire-event pass). */
  gate_progress?: CheckinGateProgress[];
}

export interface TicketStatCard {
  scope: string;
  label: string;
  group: string;
  total: number;
  pending_payment: number;
  confirmed: number;
  expired: number;
  cancelled: number;
  entered: number;
}

export interface TicketStatGuest {
  booking_id: string;
  name: string;
  email: string;
  phone: string;
  adult_count: number;
  child_count: number;
  capacity: number;
  checked_in: number;
}

export interface TicketStatDetail {
  scope: string;
  label: string;
  pending_payment: TicketStatGuest[];
  confirmed: TicketStatGuest[];
  expired: TicketStatGuest[];
  cancelled: TicketStatGuest[];
  entered: TicketStatGuest[];
}

export interface TicketStatsResponse {
  event: { event_id: string; event_name: string } | null;
  cards: TicketStatCard[];
  detail?: TicketStatDetail;
}

export class TicketingConflictError extends Error {
  readonly conflictingSeats: string[];

  constructor(message: string, conflictingSeats: string[] = []) {
    super(message);
    this.name = 'TicketingConflictError';
    this.conflictingSeats = conflictingSeats;
  }
}

export function normalizeSeatKey(mapId: string, seatId: string): string {
  const value = String(seatId);
  const separator = value.indexOf('|');
  return separator === -1 ? `${mapId}|${value}` : `${mapId}|${value.slice(separator + 1)}`;
}

export function rowLabel(row: number): string {
  let label = '';
  let n = row;
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = ROW_LETTERS[rem] + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

type ActiveContext = {
  event: Event;
  maps: SeatMap[];
  profile: TicketingProfile;
  subEvents: SubEvent[];
};

export class TicketingService {
  private mapHelper = new SeatMapDataHelper();
  private templateHelper = new SeatMapTemplateDataHelper();
  private theaterMapHelper = new TheaterMapDataHelper();
  private profileHelper = new TicketingProfileDataHelper();
  private holdHelper = new SeatHoldDataHelper();
  private bookingHelper = new BookingDataHelper();
  private discountHelper = new DiscountDataHelper();
  private settingsHelper = new SettingsDataHelper();
  private eventHelper = new EventDataHelper();
  private subEventHelper = new SubEventDataHelper();
  private emailService = new EmailService();

  // --------------------------------------------------------- public config

  private async getActiveContext(requireOpen = true): Promise<ActiveContext> {
    const allMaps = await this.mapHelper.findAll();
    const openMaps = allMaps
      .filter(map => map.is_open && map.event_id)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    if (openMaps.length === 0) {
      if (requireOpen) throw new Error('Booking is not open');
      throw new Error('No ticketing event is configured');
    }
    const eventId = openMaps[0].event_id;
    const maps = openMaps.filter(map => map.event_id === eventId);
    const event = await this.eventHelper.findById(eventId);
    if (!event) throw new Error('The event this booking belongs to no longer exists');
    const profile = await this.profileHelper.findByEventId(eventId);
    if (!profile) throw new Error('Ticketing profile is not configured for this event');
    const mapSubEventIds = new Set(maps.map(map => map.sub_event_id).filter(Boolean));
    const subEvents = (await this.subEventHelper.findByEventId(eventId)).filter(sub =>
      mapSubEventIds.has(sub.sub_event_id)
    );
    return { event, maps, profile, subEvents };
  }

  async getPublicConfig(): Promise<{
    is_open: boolean;
    seat_booking_available: boolean;
    meals_booking_available: boolean;
    event: Pick<Event, 'event_id' | 'event_name' | 'event_start_dt' | 'event_end_dt' | 'location'> | null;
    sub_events: Array<Pick<SubEvent, 'sub_event_id' | 'sub_event_name' | 'sub_event_start_dt' | 'sub_event_end_dt' | 'location'>>;
    categories: SeatCategory[];
    child_age_range: ChildAgeRange;
    meal_days: MealDayPricing[];
    sub_event_configs: SubEventTicketingConfig[];
    hold_minutes: number;
    payment_window_hours: number;
    booking_note?: string;
    maps: Array<Omit<SeatMap, 'blocked_seats' | 'event_id' | 'is_open' | 'updated_at' | 'migrated_from_legacy'>>;
  }> {
    const allMaps = await this.mapHelper.findAll();
    const openMaps = allMaps
      .filter(map => map.is_open && map.event_id)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

    if (openMaps.length === 0) {
      const latest = [...allMaps]
        .filter(map => map.event_id)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
      if (!latest) {
        return {
          is_open: false,
          seat_booking_available: false,
          meals_booking_available: false,
          event: null,
          sub_events: [],
          categories: [],
          child_age_range: { min_age: 0, max_age: 12 },
          meal_days: [],
          sub_event_configs: [],
          hold_minutes: 10,
          payment_window_hours: 48,
          maps: [],
        };
      }
      const event = await this.eventHelper.findById(latest.event_id);
      const profile = await this.profileHelper.findByEventId(latest.event_id);
      if (!event || !profile) {
        return {
          is_open: false,
          seat_booking_available: false,
          meals_booking_available: false,
          event: null,
          sub_events: [],
          categories: [],
          child_age_range: { min_age: 0, max_age: 12 },
          meal_days: [],
          sub_event_configs: [],
          hold_minutes: 10,
          payment_window_hours: 48,
          maps: [],
        };
      }
      const configuredSubIds = new Set(
        profile.sub_event_configs
          .filter(cfg => cfg.ticketing_type === 'concert')
          .map(cfg => cfg.sub_event_id)
      );
      const subEvents = (await this.subEventHelper.findByEventId(latest.event_id)).filter(sub =>
        configuredSubIds.has(sub.sub_event_id)
      );
      const meals_booking_available = hasPricedMeals(profile.meal_days);
      return {
        is_open: meals_booking_available,
        seat_booking_available: false,
        meals_booking_available,
        event: {
          event_id: event.event_id,
          event_name: event.event_name,
          event_start_dt: event.event_start_dt,
          event_end_dt: event.event_end_dt,
          location: event.location,
        },
        sub_events: subEvents.map(sub => ({
          sub_event_id: sub.sub_event_id,
          sub_event_name: sub.sub_event_name,
          sub_event_start_dt: sub.sub_event_start_dt,
          sub_event_end_dt: sub.sub_event_end_dt,
          location: sub.location,
        })),
        categories: profile.categories,
        child_age_range: profile.child_age_range,
        meal_days: profile.meal_days,
        sub_event_configs: profile.sub_event_configs,
        hold_minutes: profile.hold_minutes,
        payment_window_hours: profile.payment_window_hours,
        ...(profile.booking_note ? { booking_note: profile.booking_note } : {}),
        maps: [],
      };
    }

    const eventId = openMaps[0].event_id;
    const maps = openMaps.filter(map => map.event_id === eventId);
    const event = await this.eventHelper.findById(eventId);
    if (!event) throw new Error('The event this booking belongs to no longer exists');
    const profile = await this.profileHelper.findByEventId(eventId);
    if (!profile) throw new Error('Ticketing profile is not configured for this event');
    const mapSubEventIds = new Set(maps.map(map => map.sub_event_id).filter(Boolean));
    const subEvents = (await this.subEventHelper.findByEventId(eventId)).filter(sub =>
      mapSubEventIds.has(sub.sub_event_id)
    );
    const meals_booking_available = hasPricedMeals(profile.meal_days);
    return {
      is_open: true,
      seat_booking_available: true,
      meals_booking_available,
      event: {
        event_id: event.event_id,
        event_name: event.event_name,
        event_start_dt: event.event_start_dt,
        event_end_dt: event.event_end_dt,
        location: event.location,
      },
      sub_events: subEvents.map(sub => ({
        sub_event_id: sub.sub_event_id,
        sub_event_name: sub.sub_event_name,
        sub_event_start_dt: sub.sub_event_start_dt,
        sub_event_end_dt: sub.sub_event_end_dt,
        location: sub.location,
      })),
      categories: profile.categories,
      child_age_range: profile.child_age_range,
      meal_days: profile.meal_days,
      sub_event_configs: profile.sub_event_configs,
      hold_minutes: profile.hold_minutes,
      payment_window_hours: profile.payment_window_hours,
      ...(profile.booking_note ? { booking_note: profile.booking_note } : {}),
      maps: maps.map(({ blocked_seats, event_id, is_open, updated_at, migrated_from_legacy, ...map }) => map),
    };
  }

  // ----------------------------------------------- compatibility wrappers

  async getConfig(): Promise<SeatingConfig> {
    const maps = await this.mapHelper.findAll();
    const map = maps.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    if (!map) {
      return {
        is_open: false,
        hold_minutes: 10,
        categories: [],
        sections: [],
        layout_mode: 'matrix',
        matrix: { rows: 1, cols: 1 },
        seat_positions: {},
        blocked_seats: [],
        booking_note: '',
        updated_at: new Date().toISOString(),
      };
    }
    const profile = await this.profileHelper.findByEventId(map.event_id);
    return {
      event_id: map.event_id,
      sub_event_id: map.sub_event_id,
      is_open: map.is_open,
      hold_minutes: profile?.hold_minutes ?? 10,
      categories: profile?.categories ?? [],
      sections: map.sections,
      layout_mode: 'matrix',
      matrix: map.matrix,
      seat_positions: map.seat_positions,
      blocked_seats: map.blocked_seats,
      booking_note: profile?.booking_note ?? '',
      updated_at: map.updated_at,
    };
  }

  async updateConfig(patch: Partial<SeatingConfig>): Promise<SeatingConfig> {
    const categories = patch.categories !== undefined ? this.validateCategories(patch.categories) : undefined;
    if (patch.hold_minutes !== undefined) this.validateHoldMinutes(patch.hold_minutes);
    if (patch.sections !== undefined && categories) this.validateSections(patch.sections, categories);
    const current = await this.getConfig();
    const maps = await this.mapHelper.findAll();
    const map = maps.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    if (!map) throw new Error('Create a seat map before using the legacy config endpoint');

    if (
      patch.event_id !== undefined || patch.sub_event_id !== undefined || patch.is_open !== undefined ||
      patch.matrix !== undefined || patch.sections !== undefined || patch.seat_positions !== undefined ||
      patch.blocked_seats !== undefined
    ) {
      await this.updateMap(map.map_id, {
        event_id: patch.event_id,
        sub_event_id: patch.sub_event_id,
        is_open: patch.is_open,
        matrix: patch.matrix,
        sections: patch.sections,
        seat_positions: patch.seat_positions,
        blocked_seats: patch.blocked_seats,
      });
    }
    if (categories || patch.hold_minutes !== undefined || patch.booking_note !== undefined) {
      const profile = await this.profileHelper.findByEventId(patch.event_id || current.event_id || map.event_id);
      await this.updateProfile(patch.event_id || current.event_id || map.event_id, {
        categories: categories ?? current.categories,
        child_age_range: profile?.child_age_range ?? { min_age: 0, max_age: 12 },
        meal_days: profile?.meal_days ?? [],
        sub_event_configs: profile?.sub_event_configs ?? [],
        hold_minutes: patch.hold_minutes ?? current.hold_minutes,
        payment_window_hours: 48,
        booking_note: patch.booking_note ?? current.booking_note,
      });
    }
    return this.getConfig();
  }

  // -------------------------------------------------------------- profile

  /** Profile for the event tied to the most recently updated seat map (admin default). */
  async getAdminProfile(): Promise<TicketingProfile | null> {
    const maps = await this.mapHelper.findAll();
    if (maps.length > 0) {
      const latest = [...maps].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
      return this.profileHelper.findByEventId(latest.event_id);
    }
    const profiles = await this.profileHelper.findAll();
    return profiles[0] ?? null;
  }

  async getProfile(eventId: string): Promise<TicketingProfile | null> {
    return this.profileHelper.findByEventId(String(eventId));
  }

  private async remapMapCategoryIds(eventId: string, idRemap: Map<string, string>): Promise<void> {
    const maps = await this.mapHelper.findByEventId(eventId);
    for (const map of maps) {
      let changed = false;
      const sections = map.sections.map(section => {
        const nextId = idRemap.get(section.category_id);
        if (nextId && nextId !== section.category_id) {
          changed = true;
          return { ...section, category_id: nextId };
        }
        return section;
      });
      if (changed) {
        await this.mapHelper.update(map.map_id, { sections });
      }
    }
  }

  async updateProfile(eventId: string, input: Partial<TicketingProfile>): Promise<TicketingProfile> {
    const id = String(eventId || input.event_id || '').trim();
    if (!id || !(await this.eventHelper.findById(id))) throw new Error('The selected event does not exist');
    const existing = await this.profileHelper.findByEventId(id);
    let categories = input.categories !== undefined
      ? this.validateCategories(input.categories)
      : existing?.categories ?? [];
    const child_age_range = input.child_age_range !== undefined
      ? this.validateChildAgeRange(input.child_age_range)
      : existing?.child_age_range ?? { min_age: 0, max_age: 12 };
    const meal_days = input.meal_days !== undefined
      ? this.validateMealDays(input.meal_days)
      : existing?.meal_days ?? [];
    let sub_event_configs = input.sub_event_configs !== undefined
      ? await this.validateSubEventConfigs(id, input.sub_event_configs, categories, meal_days)
      : existing?.sub_event_configs ?? [];
    const hold_minutes = this.validateHoldMinutes(input.hold_minutes ?? existing?.hold_minutes ?? 10);
    const payment_window_hours = Number(input.payment_window_hours ?? existing?.payment_window_hours ?? 48);
    if (!Number.isInteger(payment_window_hours) || payment_window_hours < 1 || payment_window_hours > 336) {
      throw new Error('payment_window_hours must be an integer between 1 and 336');
    }
    const booking_note = String(input.booking_note ?? existing?.booking_note ?? '').trim();
    if (booking_note.length > 2000) throw new Error('Invalid booking_note');

    const maps = existing ? await this.mapHelper.findByEventId(id) : [];

    // Preserve any category still painted on this event's seat maps but missing
    // from the incoming master list, carried over from the saved profile. This
    // keeps a save from orphaning a map's seats (which would lose their pricing
    // tier) and is what prevents the "category is still used by seat map" mismatch
    // from ever forming. The admin can remove it later after re-painting the map.
    if (existing && input.sub_event_configs !== undefined && maps.length > 0) {
      const masterIds = new Set(categories.map(category => category.category_id));
      const existingById = new Map(
        (existing.categories ?? []).map(category => [category.category_id, category] as const)
      );
      const usedByMaps = new Set(
        maps.flatMap(map => map.sections.map(section => section.category_id))
      );
      const carried: SeatCategory[] = [];
      for (const categoryId of usedByMaps) {
        if (!masterIds.has(categoryId) && existingById.has(categoryId)) {
          carried.push(existingById.get(categoryId)!);
          masterIds.add(categoryId);
        }
      }
      if (carried.length > 0) categories = [...categories, ...carried];
    }

    if (input.sub_event_configs !== undefined && maps.length > 0) {
      sub_event_configs = this.mergeMapCategoriesIntoSubEventConfigs(sub_event_configs, maps, categories);
    }

    if (existing && input.categories !== undefined) {
      const retained = new Set(categories.map(category => category.category_id));
      const inUse = maps
        .filter(map => !map.sub_event_id)
        .flatMap(map => map.sections)
        .find(section => !retained.has(section.category_id));
      if (inUse) {
        throw new TicketingConflictError(`Category "${inUse.category_id}" is still used by a seat map`);
      }
    }
    if (existing && input.sub_event_configs !== undefined) {
      // `mergeMapCategoriesIntoSubEventConfigs` already forces every VALID master
      // category used by a map back into the sub-event's enabled list, so a real
      // category can never be silently dropped here. Only enforce this guard for
      // known master categories; ignore ids a map still references that are absent
      // from the saved master list (a stale category left on the map after it was
      // removed/renamed). Blocking on those just traps the admin — they can't be
      // re-enabled anyway — so we let the save through.
      const validIds = new Set(categories.map(category => category.category_id));
      for (const map of maps.filter(item => item.sub_event_id)) {
        const config = sub_event_configs.find(item => item.sub_event_id === map.sub_event_id);
        const allowed = new Set(config?.enabled_category_ids ?? []);
        const inUse = map.sections.find(
          section => validIds.has(section.category_id) && !allowed.has(section.category_id)
        );
        if (inUse) {
          throw new TicketingConflictError(`Sub-event category "${inUse.category_id}" is still used by seat map "${map.name}"`);
        }
      }
    }

    const migrated = existing && (input.categories !== undefined || input.sub_event_configs !== undefined)
      ? migrateProfileCategories({
          ...(existing ?? { event_id: id, categories: [], meal_days: [], sub_event_configs: [], hold_minutes: 10 }),
          categories,
          sub_event_configs,
        })
      : null;
    if (migrated && migrated.categoryIdRemap.size > 0) {
      await this.remapMapCategoryIds(id, migrated.categoryIdRemap);
    }

    return this.profileHelper.upsert(id, {
      categories,
      child_age_range,
      meal_days,
      sub_event_configs,
      hold_minutes,
      payment_window_hours,
      ...(booking_note ? { booking_note } : {}),
    });
  }

  // ---------------------------------------------------------------- maps

  async listMaps(eventId?: string): Promise<SeatMap[]> {
    return eventId ? this.mapHelper.findByEventId(String(eventId)) : this.mapHelper.findAll();
  }

  async createMap(input: Partial<SeatMap> & { template_slot?: unknown; theater_map_id?: unknown }): Promise<SeatMap> {
    const association = await this.validateAssociation(input.event_id, input.sub_event_id, undefined);
    const profile = await this.profileHelper.findByEventId(association.event_id);
    if (!profile) throw new Error('Create the event ticketing profile before adding maps');
    const maps = await this.mapHelper.findByEventId(association.event_id);
    this.ensureUniqueAssociation(maps, association.sub_event_id);
    const templateSlot = this.parseTemplateSlot(input.template_slot);
    const template = templateSlot ? await this.templateHelper.findBySlot(templateSlot) : null;
    if (templateSlot && !template) throw new Error(`Saved layout slot ${templateSlot} is empty`);
    const theaterMapId = String(input.theater_map_id ?? '').trim();
    const theaterMap = theaterMapId ? await this.theaterMapHelper.findById(theaterMapId) : null;
    if (theaterMapId && !theaterMap) throw new Error('Saved theater map not found');
    const mapCategories = this.categoriesForMap(association, profile);
    const layoutSource = theaterMap ?? template;
    const layout = layoutSource
      ? this.buildLayoutFromSavedSeats(layoutSource, mapCategories)
      : this.validateMapPayload(
          {
            matrix: input.matrix ?? { rows: 15, cols: 24 },
            sections: input.sections ?? [],
            seat_positions: input.seat_positions ?? {},
            blocked_seats: input.blocked_seats ?? [],
          },
          mapCategories
        );
    return this.mapHelper.create({
      ...layout,
      ...association,
      name: this.validateMapName(input.name),
      is_open: input.is_open === true,
    });
  }

  async updateMap(
    mapId: string,
    input: Partial<SeatMap> & {
      template_slot?: unknown;
      apply_template_slot?: unknown;
      theater_map_id?: unknown;
      apply_theater_map_id?: unknown;
    }
  ): Promise<SeatMap | null> {
    const current = await this.mapHelper.findById(String(mapId));
    if (!current) return null;
    const eventId = input.event_id !== undefined ? input.event_id : current.event_id;
    const subEventId = input.sub_event_id !== undefined ? input.sub_event_id : current.sub_event_id;
    const association = await this.validateAssociation(eventId, subEventId, current);
    const profile = await this.profileHelper.findByEventId(association.event_id);
    if (!profile) throw new Error('Create the event ticketing profile before saving maps');
    if (association.event_id !== current.event_id || association.sub_event_id !== current.sub_event_id) {
      const maps = (await this.mapHelper.findByEventId(association.event_id)).filter(map => map.map_id !== current.map_id);
      this.ensureUniqueAssociation(maps, association.sub_event_id);
    }
    if (input.is_open === true && !association.event_id) {
      throw new Error('Associate the map with an event before opening it');
    }
    const applySlot = this.parseTemplateSlot(input.apply_template_slot ?? input.template_slot);
    const template = applySlot ? await this.templateHelper.findBySlot(applySlot) : null;
    if (applySlot && !template) throw new Error(`Saved layout slot ${applySlot} is empty`);
    const applyTheaterMapId = String(input.apply_theater_map_id ?? input.theater_map_id ?? '').trim();
    const theaterMap = applyTheaterMapId ? await this.theaterMapHelper.findById(applyTheaterMapId) : null;
    if (applyTheaterMapId && !theaterMap) throw new Error('Saved theater map not found');
    const mapCategories = this.categoriesForMap(association, profile, current);
    const layoutSource = theaterMap ?? template;
    const clean = layoutSource
      ? this.buildLayoutFromSavedSeats(layoutSource, mapCategories)
      : this.validateMapPayload(input, mapCategories, current);
    return this.mapHelper.update(current.map_id, {
      ...clean,
      ...association,
      ...(input.name !== undefined ? { name: this.validateMapName(input.name) } : {}),
      ...(input.is_open !== undefined ? { is_open: Boolean(input.is_open) } : {}),
    });
  }

  async deleteMap(mapId: string): Promise<boolean> {
    const map = await this.mapHelper.findById(String(mapId));
    if (!map) return false;
    const blocking = (await this.bookingHelper.findSeatBlocking()).some(booking =>
      booking.event_id === map.event_id && booking.seat_ids.some(seatId => this.seatBelongsToMap(seatId, map))
    );
    if (blocking) throw new TicketingConflictError('Cannot delete a map with pending or confirmed bookings');
    return this.mapHelper.delete(map.map_id);
  }

  // ----------------------------------------------------------- map templates

  async listMapTemplates(): Promise<SeatMapTemplate[]> {
    return this.templateHelper.findAll();
  }

  async saveMapTemplate(slot: unknown, name: unknown, mapId: unknown): Promise<SeatMapTemplate> {
    const parsedSlot = this.parseTemplateSlot(slot);
    if (!parsedSlot) throw new Error('template slot must be 1 or 2');
    const map = await this.mapHelper.findById(String(mapId ?? '').trim());
    if (!map) throw new Error('Seat map not found');
    const profile = await this.profileHelper.findByEventId(map.event_id);
    if (!profile || profile.categories.length === 0) {
      throw new Error('Save categories on the Setup tab before saving a layout');
    }
    const mapCategories = this.categoriesForMap({ event_id: map.event_id, sub_event_id: map.sub_event_id }, profile);
    const categoryNameById = new Map(mapCategories.map(category => [category.category_id, category.name]));
    const blocked = new Set(map.blocked_seats ?? []);
    const seats: SeatMapTemplateSeat[] = [];
    for (const section of map.sections) {
      if (section.rows !== 1 || section.seats_per_row !== 1) continue;
      const seatId = `${section.section_id}:1:1`;
      const pos = map.seat_positions[seatId];
      if (!pos) continue;
      seats.push({
        row: Math.round(pos.y),
        col: Math.round(pos.x),
        category_name: categoryNameById.get(section.category_id) ?? mapCategories[0].name,
        ...(blocked.has(seatId) ? { blocked: true } : {}),
      });
    }
    if (seats.length === 0) throw new Error('Paint at least one seat before saving a layout');
    const templateName = String(name ?? '').trim() || map.name;
    if (!templateName || templateName.length > MAX_TEXT) {
      throw new Error('Saved layout needs a name');
    }
    return this.templateHelper.upsertSlot(parsedSlot, {
      name: templateName,
      matrix: map.matrix,
      seats,
    });
  }

  async deleteMapTemplate(slot: unknown): Promise<boolean> {
    const parsedSlot = this.parseTemplateSlot(slot);
    if (!parsedSlot) throw new Error('template slot must be 1 or 2');
    return this.templateHelper.deleteBySlot(parsedSlot);
  }

  private parseTemplateSlot(value: unknown): 1 | 2 | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const slot = Number(value);
    if (slot === 1 || slot === 2) return slot;
    throw new Error('template slot must be 1 or 2');
  }

  private buildLayoutFromSavedSeats(
    source: { matrix: { rows: number; cols: number }; seats: SeatMapTemplateSeat[] },
    categories: SeatCategory[]
  ): Pick<SeatMap, 'matrix' | 'sections' | 'seat_positions' | 'blocked_seats'> {
    if (categories.length === 0) throw new Error('Add at least one category before applying a saved layout');
    const categoryByName = new Map(categories.map(category => [category.name.trim().toLowerCase(), category.category_id]));
    const fallbackId = categories[0].category_id;
    const sorted = [...source.seats].sort((a, b) => a.row - b.row || a.col - b.col);
    const sections: SeatingSection[] = [];
    const seat_positions: Record<string, { x: number; y: number }> = {};
    const blocked_seats: string[] = [];
    let currentRow = 0;
    let numInRow = 0;
    for (const seat of sorted) {
      if (seat.row !== currentRow) {
        currentRow = seat.row;
        numInRow = 0;
      }
      numInRow++;
      const section_id = this.mapHelper.newId();
      const category_id = categoryByName.get(seat.category_name.trim().toLowerCase()) ?? fallbackId;
      sections.push({
        section_id,
        name: `${rowLabel(seat.row)}${numInRow}`,
        rows: 1,
        seats_per_row: 1,
        category_id,
      });
      const seatId = `${section_id}:1:1`;
      seat_positions[seatId] = { x: seat.col, y: seat.row };
      if (seat.blocked) blocked_seats.push(seatId);
    }
    return {
      matrix: source.matrix,
      sections: this.validateSections(sections, categories),
      seat_positions: this.validateSeatPositions(seat_positions, sections),
      blocked_seats: this.validateBlockedSeats(blocked_seats, sections),
    };
  }

  private buildLayoutFromTemplate(
    template: SeatMapTemplate,
    categories: SeatCategory[]
  ): Pick<SeatMap, 'matrix' | 'sections' | 'seat_positions' | 'blocked_seats'> {
    return this.buildLayoutFromSavedSeats(template, categories);
  }

  private validateMapPayload(
    input: Partial<SeatMap>,
    categories: SeatCategory[],
    current?: SeatMap
  ): Pick<SeatMap, 'matrix' | 'sections' | 'seat_positions' | 'blocked_seats'> {
    const matrix = input.matrix ?? current?.matrix ?? { rows: 1, cols: 1 };
    const rows = Number(matrix.rows);
    const cols = Number(matrix.cols);
    if (!Number.isInteger(rows) || rows < 1 || rows > 60 || !Number.isInteger(cols) || cols < 1 || cols > 80) {
      throw new Error('matrix must have integer rows (1-60) and cols (1-80)');
    }
    const sections = input.sections !== undefined
      ? this.validateSections(input.sections, categories)
      : current?.sections ?? [];
    const seat_positions = input.seat_positions !== undefined
      ? this.validateSeatPositions(input.seat_positions, sections)
      : current?.seat_positions ?? {};
    const blocked_seats = input.blocked_seats !== undefined
      ? this.validateBlockedSeats(input.blocked_seats, sections)
      : current?.blocked_seats ?? [];
    return { matrix: { rows, cols }, sections, seat_positions, blocked_seats };
  }

  private async validateAssociation(
    eventValue: unknown,
    subEventValue: unknown,
    current?: SeatMap
  ): Promise<Pick<SeatMap, 'event_id' | 'sub_event_id'>> {
    const event_id = String(eventValue ?? '').trim();
    if (!event_id) throw new Error('A seat map must be associated with an event');
    const event = await this.eventHelper.findById(event_id);
    if (!event) throw new Error('The selected event does not exist');
    if (event_id !== current?.event_id && isPast(event.event_end_dt || event.event_start_dt)) {
      throw new Error('Cannot associate a seat map with a past event');
    }
    const sub_event_id = String(subEventValue ?? '').trim();
    const eventSubEvents = await this.subEventHelper.findByEventId(event_id);
    if (eventSubEvents.length > 0 && !sub_event_id) {
      throw new Error('A sub-event is required because the selected event has sub-events');
    }
    if (sub_event_id) {
      const sub = await this.subEventHelper.findById(sub_event_id);
      if (!sub) throw new Error('The selected sub-event does not exist');
      if (sub.event_id !== event_id) throw new Error('The selected sub-event does not belong to the selected event');
      if (sub_event_id !== current?.sub_event_id && isPast(sub.sub_event_end_dt || sub.sub_event_start_dt)) {
        throw new Error('Cannot associate a seat map with a past sub-event');
      }
    }
    return { event_id, ...(sub_event_id ? { sub_event_id } : {}) };
  }

  private ensureUniqueAssociation(maps: SeatMap[], subEventId?: string): void {
    if (maps.some(map => (map.sub_event_id || '') === (subEventId || ''))) {
      throw new TicketingConflictError('A seat map already exists for this event/sub-event');
    }
  }

  // ------------------------------------------------------ availability/hold

  async getUnavailableSeats(excludeHoldId?: string): Promise<UnavailableSeats> {
    const allMaps = await this.mapHelper.findAll();
    const openMaps = allMaps.filter(map => map.is_open && map.event_id);
    if (openMaps.length === 0) return {};

    const eventId = openMaps[0].event_id;
    const maps = openMaps.filter(map => map.event_id === eventId);
    const event = await this.eventHelper.findById(eventId);
    if (!event) return {};

    const out: UnavailableSeats = {};
    for (const map of maps) {
      for (const seatId of map.blocked_seats) out[normalizeSeatKey(map.map_id, seatId)] = 'blocked';
    }
    const bookings = await this.bookingHelper.findSeatBlocking();
    for (const booking of bookings.filter(item => item.event_id === event.event_id)) {
      for (const seatId of booking.seat_ids) {
        const key = this.normalizeStoredSeat(seatId, maps);
        if (key) out[key] = 'booked';
      }
    }
    const holds = await this.holdHelper.findActive();
    for (const hold of holds) {
      if (excludeHoldId && hold.hold_id === excludeHoldId) continue;
      for (const seatId of hold.seat_ids) {
        const key = this.normalizeStoredSeat(seatId, maps);
        if (key && !out[key]) out[key] = 'held';
      }
    }
    return out;
  }

  async holdSeats(
    seatKeys: unknown,
    categoryId: unknown,
    scopeSubEventId?: unknown,
    adultCount?: unknown,
    childCount?: unknown
  ): Promise<SeatHold> {
    const { maps, profile } = await this.getActiveContext();
    if (!Array.isArray(seatKeys) || seatKeys.length === 0) throw new Error('Select at least one seat');
    const { adults, children } = this.validatePartySize(adultCount, childCount);
    const category_id = String(categoryId ?? '').trim();
    const scope = scopeSubEventId === undefined || scopeSubEventId === null
      ? undefined
      : String(scopeSubEventId).trim();
    const scopeCategories = this.categoriesForScope(profile, scope);
    if (!scopeCategories.some(category => category.category_id === category_id)) {
      throw new Error('Select a valid ticket category');
    }
    const resolved = seatKeys.map(key => this.resolveSeatKey(String(key), maps));
    const normalized = resolved.map(item => item.key);
    if (new Set(normalized).size !== normalized.length) throw new Error('Duplicate seats in selection');
    for (const item of resolved) {
      if (!item.map.is_open) throw new Error(`Seat map "${item.map.name}" is not open`);
      if (scope !== undefined && item.map.sub_event_id !== scope) {
        throw new Error('Selected seats do not match the requested sub-event scope');
      }
      if (!this.sectionMatchesSelectedCategory(profile, item, category_id, scope)) {
        throw new Error('All selected seats must match the requested category');
      }
    }
    this.validateSeatSelection(resolved, maps, scope, adults, children);
    const unavailable = await this.getUnavailableSeats();
    const taken = normalized.filter(key => unavailable[key]);
    if (taken.length) throw new Error(`No longer available: ${taken.join(', ')}. Please pick different seats.`);
    return this.holdHelper.create(normalized, profile.hold_minutes);
  }

  async releaseHold(holdId: string): Promise<boolean> {
    return this.holdHelper.delete(String(holdId));
  }

  async getActiveHolds(): Promise<SeatHold[]> {
    return this.holdHelper.findActive();
  }

  // ------------------------------------------------------------- discounts

  async listDiscounts(): Promise<DiscountCode[]> {
    return this.discountHelper.findAll();
  }

  async createDiscount(data: Partial<DiscountCode>): Promise<DiscountCode> {
    return this.discountHelper.create(this.validateDiscount(data));
  }

  async updateDiscount(discountId: string, data: Partial<DiscountCode>): Promise<DiscountCode | null> {
    const existing = (await this.discountHelper.findAll()).find(discount => discount.discount_id === discountId);
    if (!existing) return null;
    return this.discountHelper.update(discountId, this.validateDiscount({ ...existing, ...data }));
  }

  async deleteDiscount(discountId: string): Promise<boolean> {
    return this.discountHelper.delete(discountId);
  }

  async previewDiscount(
    code: string,
    seatKeys: string[],
    options?: {
      seat_audiences?: unknown;
      scope_sub_event_id?: unknown;
      category_id?: unknown;
      adult_count?: unknown;
      child_count?: unknown;
    }
  ): Promise<DiscountPreview> {
    const { maps, profile } = await this.getActiveContext();
    const audiences = this.parseSeatAudiences(options?.seat_audiences, seatKeys);
    const scope =
      options?.scope_sub_event_id === undefined || options?.scope_sub_event_id === null
        ? undefined
        : String(options.scope_sub_event_id).trim();
    const category_id = String(options?.category_id ?? '').trim();
    const details = seatKeys.map(key =>
      this.seatDetail(
        this.resolveSeatKey(String(key), maps),
        profile,
        audiences[key],
        category_id,
        scope
      )
    );
    let subtotal: number;
    if (scope === undefined) {
      const mainCategory = this.findCategoryById(profile, category_id, scope);
      if (!mainCategory) throw new Error('Select a valid ticket category');
      const { adults, children } = this.validatePartySize(options?.adult_count, options?.child_count);
      subtotal = round2(
        adults * categoryAdultPrice(mainCategory) + children * categoryChildPrice(mainCategory)
      );
    } else {
      subtotal = round2(details.reduce((sum, detail) => sum + detail.price, 0));
    }
    const { discount, amount } = await this.resolveDiscount(code, details.length, subtotal);
    return {
      code: discount.code,
      type: discount.type,
      value: discount.value,
      discount_amount: amount,
      total: round2(subtotal - amount),
    };
  }

  // -------------------------------------------------------------- checkout

  async checkout(input: {
    hold_id: string;
    name: string;
    email: string;
    phone: string;
    discount_code?: string;
    food_addons?: unknown;
    adult_count?: unknown;
    child_count?: unknown;
    seat_audiences?: unknown;
    scope_sub_event_id?: unknown;
    category_id?: unknown;
  }): Promise<{ booking: SeatBooking; payment: { zelle_phone?: string } }> {
    const { event, maps, profile } = await this.getActiveContext();
    const name = String(input.name ?? '').trim();
    const email = String(input.email ?? '').trim();
    const phone = String(input.phone ?? '').trim();
    if (!name || name.length > MAX_TEXT) throw new Error('Please provide your name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please provide a valid email');
    const phoneDigits = phone.replace(/\D/g, '');
    if (phone.length > 30 || phoneDigits.length < 10 || phoneDigits.length > 15) {
      throw new Error('Please provide a valid mobile number (at least 10 digits)');
    }
    await this.enforcePendingBookingCap(email);
    const hold = await this.holdHelper.findById(String(input.hold_id ?? ''));
    if (!hold) throw new Error('Your seat hold has expired — please select seats again');
    const resolved = hold.seat_ids.map(key => this.resolveSeatKey(String(key), maps));
    if (resolved.some(item => item.map.event_id !== event.event_id || !item.map.is_open)) {
      throw new Error('One or more selected seat maps are no longer open');
    }
    const unavailable = await this.getUnavailableSeats(hold.hold_id);
    if (resolved.some(item => unavailable[item.key])) {
      await this.holdHelper.delete(hold.hold_id);
      throw new Error('Some of your seats were just taken — please select seats again');
    }
    const seatKeys = resolved.map(item => item.key);
    const scope = input.scope_sub_event_id === undefined || input.scope_sub_event_id === null
      ? undefined
      : String(input.scope_sub_event_id).trim();
    const { adults, children } = this.validatePartySize(input.adult_count, input.child_count);
    const category_id = String(input.category_id ?? '').trim();
    const audiences = this.parseSeatAudiences(input.seat_audiences, seatKeys);
    this.validateSeatSelection(resolved, maps, scope, adults, children, audiences);
    const seats_detail = resolved.map(item =>
      this.seatDetail(item, profile, audiences[item.key], category_id, scope)
    );
    const sub_event_ids = [...new Set(resolved.map(item => item.map.sub_event_id).filter(Boolean))] as string[];
    const meals_detail = scope === undefined
      ? this.buildEntireEventMeals(profile, adults, children)
      : [];
    const food_addons_detail = scope === undefined
      ? []
      : this.validateFoodAddonSelections(input.food_addons, profile, sub_event_ids, adults, children);
    let subtotal: number;
    if (scope === undefined) {
      const mainCategory = this.findCategoryById(profile, category_id, scope);
      if (!mainCategory) throw new Error('Select a valid ticket category');
      subtotal = round2(
        adults * categoryAdultPrice(mainCategory) + children * categoryChildPrice(mainCategory)
      );
    } else {
      const seatSubtotal = round2(seats_detail.reduce((sum, detail) => sum + detail.price, 0));
      const addonSubtotal = round2(food_addons_detail.reduce((sum, item) => sum + item.line_total, 0));
      subtotal = round2(seatSubtotal + addonSubtotal);
    }
    let discount_amount = 0;
    let discount_code: string | undefined;
    let discountId: string | undefined;
    if (input.discount_code && String(input.discount_code).trim()) {
      const result = await this.resolveDiscount(String(input.discount_code), seats_detail.length, subtotal);
      discount_amount = result.amount;
      discount_code = result.discount.code;
      discountId = result.discount.discount_id;
    }
    const sub_event_ids_final = [...new Set([
      ...sub_event_ids,
      ...food_addons_detail.map(item => item.sub_event_id),
    ])];
    const payment_due_at = paymentDueAtFromNow(profile.payment_window_hours);
    const booking = await this.bookingHelper.create({
      event_id: event.event_id,
      ...(sub_event_ids_final.length === 1 ? { sub_event_id: sub_event_ids_final[0] } : {}),
      sub_event_ids: sub_event_ids_final,
      event_context: event.event_name,
      seat_ids: resolved.map(item => item.key),
      seats_detail,
      ...(meals_detail.length > 0 ? { meals_detail } : {}),
      ...(food_addons_detail.length > 0 ? { food_addons_detail } : {}),
      name,
      email,
      phone,
      subtotal,
      discount_code,
      discount_amount,
      total: round2(subtotal - discount_amount),
      status: 'pending_payment',
      payment_due_at,
    });
    await this.holdHelper.delete(hold.hold_id);
    if (discountId) await this.discountHelper.incrementUse(discountId);
    const payment = await this.paymentInfo();
    this.queueBookingConfirmationEmail(booking, payment);
    return { booking, payment };
  }

  async previewMealsDiscountWithParty(
    code: string,
    mealSelections: unknown,
    adultCount?: unknown,
    childCount?: unknown
  ): Promise<DiscountPreview> {
    const { profile } = await this.getMealsBookingContext();
    const { adults, children } = this.validatePartySize(adultCount, childCount);
    const meals_detail = this.validateMealSelections(mealSelections, profile, adults, children);
    if (meals_detail.length === 0) throw new Error('Select at least one meal');
    const subtotal = round2(meals_detail.reduce((sum, item) => sum + item.line_total, 0));
    const { discount, amount } = await this.resolveDiscount(code, 0, subtotal);
    return {
      code: discount.code,
      type: discount.type,
      value: discount.value,
      discount_amount: amount,
      total: round2(subtotal - amount),
    };
  }

  async checkoutMeals(input: {
    name: string;
    email: string;
    phone: string;
    discount_code?: string;
    meal_selections?: unknown;
    adult_count?: unknown;
    child_count?: unknown;
  }): Promise<{ booking: SeatBooking; payment: { zelle_phone?: string } }> {
    const { event, profile } = await this.getMealsBookingContext();
    const name = String(input.name ?? '').trim();
    const email = String(input.email ?? '').trim();
    const phone = String(input.phone ?? '').trim();
    if (!name || name.length > MAX_TEXT) throw new Error('Please provide your name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please provide a valid email');
    const phoneDigits = phone.replace(/\D/g, '');
    if (phone.length > 30 || phoneDigits.length < 10 || phoneDigits.length > 15) {
      throw new Error('Please provide a valid mobile number (at least 10 digits)');
    }
    await this.enforcePendingBookingCap(email);
    const { adults, children } = this.validatePartySize(input.adult_count, input.child_count);
    const meals_detail = this.validateMealSelections(input.meal_selections, profile, adults, children);
    if (meals_detail.length === 0) throw new Error('Select at least one meal');
    const subtotal = round2(meals_detail.reduce((sum, item) => sum + item.line_total, 0));
    let discount_amount = 0;
    let discount_code: string | undefined;
    let discountId: string | undefined;
    if (input.discount_code && String(input.discount_code).trim()) {
      const result = await this.resolveDiscount(String(input.discount_code), 0, subtotal);
      discount_amount = result.amount;
      discount_code = result.discount.code;
      discountId = result.discount.discount_id;
    }
    const payment_due_at = paymentDueAtFromNow(profile.payment_window_hours);
    const booking = await this.bookingHelper.create({
      event_id: event.event_id,
      event_context: `${event.event_name} — Meals`,
      seat_ids: [],
      seats_detail: [],
      meals_detail,
      name,
      email,
      phone,
      subtotal,
      discount_code,
      discount_amount,
      total: round2(subtotal - discount_amount),
      status: 'pending_payment',
      payment_due_at,
    });
    if (discountId) await this.discountHelper.incrementUse(discountId);
    const payment = await this.paymentInfo();
    this.queueBookingConfirmationEmail(booking, payment);
    return { booking, payment };
  }

  private async getMealsBookingContext(): Promise<{ event: Event; profile: TicketingProfile }> {
    const allMaps = await this.mapHelper.findAll();
    const openMaps = allMaps.filter(map => map.is_open && map.event_id);
    const latest = [...allMaps]
      .filter(map => map.event_id)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    const eventId = openMaps[0]?.event_id ?? latest?.event_id;
    if (!eventId) throw new Error('Meal booking is not available');
    const event = await this.eventHelper.findById(eventId);
    const profile = await this.profileHelper.findByEventId(eventId);
    if (!event || !profile) throw new Error('Meal booking is not configured');
    if (!hasPricedMeals(profile.meal_days)) throw new Error('Meal booking is not available');
    return { event, profile };
  }

  private validateMealSelections(
    input: unknown,
    profile: TicketingProfile,
    maxAdults: number,
    maxChildren: number
  ): BookedMealDetail[] {
    if (input === undefined || input === null) return [];
    if (!Array.isArray(input)) throw new Error('meal_selections must be an array');
    const daysById = new Map((profile.meal_days ?? []).map(day => [day.day_id, day]));
    const seen = new Set<string>();
    const out: BookedMealDetail[] = [];
    for (const row of input) {
      const day_id = String(row?.day_id ?? '').trim();
      const meal_type = row?.meal_type === 'dinner' ? 'dinner' : row?.meal_type === 'lunch' ? 'lunch' : null;
      if (!day_id || !meal_type) throw new Error('Each meal selection needs day_id and meal_type');
      const key = `${day_id}:${meal_type}`;
      if (seen.has(key)) throw new Error('Duplicate meal selection');
      seen.add(key);
      const day = daysById.get(day_id);
      if (!day) throw new Error('One or more selected meals are no longer available');
      const adult_price = Number(day[`${meal_type}_adult_price`]);
      const child_price = Number(day[`${meal_type}_child_price`]);
      if (!(adult_price > 0 || child_price > 0)) {
        throw new Error(`${day.label} ${meal_type} is not available for booking`);
      }
      const adult_qty = Number(row?.adult_qty ?? 0);
      const child_qty = Number(row?.child_qty ?? 0);
      if (!Number.isInteger(adult_qty) || adult_qty < 0 || adult_qty > maxAdults) {
        throw new Error(`Meal adult quantity must be from 0 to ${maxAdults}`);
      }
      if (!Number.isInteger(child_qty) || child_qty < 0 || child_qty > maxChildren) {
        throw new Error(`Meal child quantity must be from 0 to ${maxChildren}`);
      }
      if (adult_qty === 0 && child_qty === 0) continue;
      out.push({
        day_id,
        label: day.label,
        meal_type,
        adult_qty,
        child_qty,
        adult_price,
        child_price,
        line_total: round2(adult_qty * adult_price + child_qty * child_price),
      });
    }
    return out;
  }

  private async paymentInfo(): Promise<{ zelle_phone?: string }> {
    try {
      const settings = await this.settingsHelper.get();
      const zelle = (settings as { zellePhoneNumber?: string } | null)?.zellePhoneNumber;
      return zelle ? { zelle_phone: zelle } : {};
    } catch {
      return {};
    }
  }

  /** { sub_event_id -> name } for a booking, so emails can label seat groups. */
  private async subEventNameMap(booking: SeatBooking): Promise<Record<string, string>> {
    const ids = bookingSubEventIds(booking);
    const subs = await Promise.all(ids.map(id => this.subEventHelper.findById(id)));
    const map: Record<string, string> = {};
    for (const sub of subs) {
      if (sub) map[sub.sub_event_id] = sub.sub_event_name;
    }
    return map;
  }

  /** Fire-and-forget — email failure must never fail checkout. */
  private queueBookingConfirmationEmail(
    booking: SeatBooking,
    payment: { zelle_phone?: string }
  ): void {
    void this.sendBookingConfirmationEmail(booking, payment).catch(error => {
      console.error('Booking confirmation email failed:', error);
    });
  }

  private async sendBookingConfirmationEmail(
    booking: SeatBooking,
    payment: { zelle_phone?: string }
  ): Promise<void> {
    const isMealsOnly =
      booking.seat_ids.length === 0 && (booking.meals_detail?.length ?? 0) > 0;
    const subject = isMealsOnly
      ? `Meals reserved — ${booking.event_context} (${booking.booking_id})`
      : `Seats reserved — ${booking.event_context} (${booking.booking_id})`;
    const qrAttachment = readPaymentQRAttachment();
    const html = this.emailService.generateBookingConfirmationHTML(
      booking,
      payment,
      Boolean(qrAttachment),
      await this.subEventNameMap(booking)
    );
    await this.emailService.sendEmail(booking.email, subject, html, {
      ...(qrAttachment ? { attachments: [qrAttachment] } : {}),
    });
  }

  private queueBookingPaidEmail(booking: SeatBooking): void {
    void this.sendBookingPaidEmail(booking).catch(error => {
      console.error('Booking paid email failed:', error);
    });
  }

  private async sendBookingPaidEmail(booking: SeatBooking): Promise<void> {
    const isMealsOnly =
      booking.seat_ids.length === 0 && (booking.meals_detail?.length ?? 0) > 0;
    const subject = isMealsOnly
      ? `Meals confirmed — ${booking.event_context} (${booking.booking_id})`
      : `Booking confirmed — ${booking.event_context} (${booking.booking_id})`;
    const qrAttachment = await buildAdmissionQrAttachment(booking);
    const html = this.emailService.generateBookingPaidHTML(
      booking,
      Boolean(qrAttachment),
      await this.subEventNameMap(booking)
    );
    await this.emailService.sendEmail(booking.email, subject, html, {
      ...(qrAttachment ? { attachments: [qrAttachment] } : {}),
    });
  }

  private queueBookingExtendedEmail(booking: SeatBooking): void {
    void this.sendBookingExtendedEmail(booking).catch(error => {
      console.error('Booking extension email failed:', error);
    });
  }

  private async sendBookingExtendedEmail(booking: SeatBooking): Promise<void> {
    const payment = await this.paymentInfo();
    const subject = `Payment deadline extended — ${booking.event_context} (${booking.booking_id})`;
    const html = this.emailService.generateBookingExtendedHTML(booking, payment);
    await this.emailService.sendEmail(booking.email, subject, html);
  }

  private queueBookingCancelledEmail(booking: SeatBooking, seatsReleased: boolean): void {
    void this.sendBookingCancelledEmail(booking, seatsReleased).catch(error => {
      console.error('Booking cancellation email failed:', error);
    });
  }

  private async sendBookingCancelledEmail(
    booking: SeatBooking,
    seatsReleased: boolean
  ): Promise<void> {
    const subject = `Booking cancelled — ${booking.event_context} (${booking.booking_id})`;
    const html = this.emailService.generateBookingCancelledHTML(booking, seatsReleased);
    await this.emailService.sendEmail(booking.email, subject, html);
  }

  // -------------------------------------------------------------- bookings

  async getBooking(bookingId: string): Promise<SeatBooking | null> {
    return this.bookingHelper.findById(String(bookingId));
  }

  async listBookings(): Promise<SeatBooking[]> {
    return (await this.bookingHelper.findAll()).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  async deleteBooking(bookingId: string): Promise<boolean> {
    const booking = await this.bookingHelper.findById(bookingId);
    if (!booking) return false;
    if (booking.status !== 'cancelled') {
      throw new Error('Only cancelled bookings can be deleted');
    }
    return this.bookingHelper.delete(bookingId);
  }

  async setBookingStatus(
    bookingId: string,
    status: BookingStatus,
    paymentReference?: string
  ): Promise<SeatBooking | null> {
    if (!['confirmed', 'cancelled'].includes(status)) {
      throw new Error('Invalid booking status');
    }
    const booking = await this.bookingHelper.findById(bookingId);
    if (!booking) return null;
    if (booking.status === 'cancelled') {
      throw new Error('Cancelled bookings cannot be updated');
    }
    if (booking.status === 'confirmed' && status === 'confirmed') {
      throw new Error('Booking is already confirmed');
    }
    if (status === 'confirmed') {
      if (booking.status === 'expired') {
        const blocking = await this.bookingHelper.findSeatBlocking();
        const conflicts = findSeatConflictsForRevive(booking, blocking);
        if (conflicts.length > 0) {
          throw new TicketingConflictError(
            'Some seats are no longer available and cannot be revived',
            conflicts
          );
        }
      } else if (booking.status !== 'pending_payment') {
        throw new Error('Only pending or expired bookings can be confirmed');
      }
      const reference = String(paymentReference ?? '').trim();
      const withToken = await this.bookingHelper.issueAdmissionQrToken(bookingId);
      if (!withToken) return null;
      const updated = await this.bookingHelper.update(bookingId, {
        status: 'confirmed',
        ...(reference ? { payment_reference: reference.slice(0, 500) } : {}),
      });
      if (updated) this.queueBookingPaidEmail(updated);
      return updated;
    }
    const seatsReleased =
      booking.seat_ids.length > 0 &&
      (booking.status === 'pending_payment' ||
        booking.status === 'expired' ||
        booking.status === 'confirmed');
    const cancelled = await this.bookingHelper.update(bookingId, { status: 'cancelled' });
    if (cancelled) this.queueBookingCancelledEmail(cancelled, seatsReleased);
    return cancelled;
  }

  async extendBookingPayment(bookingId: string, extraHours = 24): Promise<SeatBooking | null> {
    const hours = Number(extraHours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
      throw new Error('Extension must be between 1 and 168 hours');
    }
    const booking = await this.bookingHelper.findById(bookingId);
    if (!booking) return null;
    if (booking.status !== 'pending_payment') {
      throw new Error('Only pending bookings can be extended');
    }
    const payment_due_at = extendPaymentDueAt(booking.payment_due_at, hours);
    const updated = await this.bookingHelper.update(bookingId, { payment_due_at });
    if (updated) this.queueBookingExtendedEmail(updated);
    return updated;
  }

  // ------------------------------------------------------- admission check-in

  private formatMealDayLabel(day: MealDayPricing, mealType: 'lunch' | 'dinner'): string {
    const meal = mealType === 'lunch' ? 'Lunch' : 'Dinner';
    return `${day.label} ${meal}`;
  }

  private async gateLabelForScope(
    scope: string,
    eventId: string
  ): Promise<string> {
    const gates = await this.listCheckinGates(eventId);
    return gates.gates.find(gate => gate.scope === scope)?.label ?? scope;
  }

  async listCheckinGates(eventId: string): Promise<{
    event: { event_id: string; event_name: string } | null;
    gates: Array<{ scope: string; group: string; label: string }>;
  }> {
    const event = await this.eventHelper.findById(String(eventId));
    const profile = await this.profileHelper.findByEventId(String(eventId));
    const gates: Array<{ scope: string; group: string; label: string }> = [];

    if (!profile) {
      return {
        event: event ? { event_id: event.event_id, event_name: event.event_name } : null,
        gates: [{ scope: 'event', group: 'Event', label: 'Event entry' }],
      };
    }

    const subEvents = await this.subEventHelper.findByEventId(String(eventId));
    const subNameById = new Map(subEvents.map(sub => [sub.sub_event_id, sub.sub_event_name]));

    for (const sub of subEvents) {
      const config = profile.sub_event_configs?.find(cfg => cfg.sub_event_id === sub.sub_event_id);
      if (config) {
        gates.push({
          scope: `sub:${sub.sub_event_id}`,
          group: 'Sub-events',
          label: sub.sub_event_name,
        });
      }
    }

    for (const day of profile.meal_days ?? []) {
      if (day.lunch_adult_price > 0 || day.lunch_child_price > 0) {
        gates.push({
          scope: `meal:${day.day_id}:lunch`,
          group: 'Meals',
          label: this.formatMealDayLabel(day, 'lunch'),
        });
      }
      if (day.dinner_adult_price > 0 || day.dinner_child_price > 0) {
        gates.push({
          scope: `meal:${day.day_id}:dinner`,
          group: 'Meals',
          label: this.formatMealDayLabel(day, 'dinner'),
        });
      }
    }

    if (gates.length === 0) {
      gates.push({ scope: 'event', group: 'Event', label: 'Event entry' });
    }

    return {
      event: event ? { event_id: event.event_id, event_name: event.event_name } : null,
      gates,
    };
  }

  /** Event currently being admitted — open map's event, else the latest map's. */
  private async resolveActiveEventId(): Promise<string | undefined> {
    const maps = await this.mapHelper.findAll();
    const withEvent = maps.filter(map => map.event_id);
    const open = withEvent
      .filter(map => map.is_open)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    const latest = [...withEvent].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    return (open ?? latest)?.event_id;
  }

  private async buildGateProgress(
    booking: SeatBooking,
    eventId: string | undefined,
    currentScope: string
  ): Promise<CheckinGateProgress[] | undefined> {
    if (!eventId) return undefined;
    const { gates } = await this.listCheckinGates(eventId);
    const progress = gates
      .map(gate => {
        const capacity = gateCapacity(booking, gate.scope);
        if (capacity <= 0) return null;
        const already = gateCheckedIn(booking, gate.scope);
        return {
          scope: gate.scope,
          label: gate.label,
          already,
          capacity,
          remaining: Math.max(0, capacity - already),
          current: gate.scope === currentScope,
        };
      })
      .filter((row): row is CheckinGateProgress => row !== null);
    return progress.length > 1 ? progress : undefined;
  }

  private async bookingForCheckin(booking: SeatBooking | null): Promise<SeatBooking | null> {
    if (!booking) return null;
    const profile = await this.profileHelper.findByEventId(booking.event_id);
    if (!profile) return booking;
    return enrichFoodAddonsWithMealSlots(booking, profile.meal_days ?? []);
  }

  private async toCheckinView(
    booking: SeatBooking,
    scope: string,
    evaluation?: ReturnType<typeof classifyAdmission>
  ): Promise<CheckinBookingView> {
    const subIds = bookingSubEventIds(booking);
    const subEvents = await Promise.all(subIds.map(id => this.subEventHelper.findById(id)));
    const nameById = new Map(
      subEvents.filter((sub): sub is SubEvent => Boolean(sub)).map(sub => [sub.sub_event_id, sub.sub_event_name])
    );
    const meals = booking.meals_detail ?? [];
    const evalResult = evaluation ?? classifyAdmission(booking, { scope, tokenValid: true });
    const checkedInAt = scopeCheckedInAt(booking, scope);

    const groups = new Map<string, CheckinSeatGroup>();
    for (const seat of booking.seats_detail) {
      const key = seat.sub_event_id ?? '__entire__';
      if (!groups.has(key)) {
        const subName = seat.sub_event_id
          ? nameById.get(seat.sub_event_id) ?? seat.map_name ?? 'Sub-event'
          : 'Entire Event';
        groups.set(key, { sub_event_name: subName, seats: [] });
      }
      groups.get(key)!.seats.push({
        label: seat.label,
        category_name: seat.category_name,
        ...(seat.audience_type ? { audience_type: seat.audience_type } : {}),
      });
    }

    return {
      booking_id: booking.booking_id,
      name: booking.name,
      status: booking.status,
      event_context: booking.event_context,
      seat_count: booking.seats_detail.length,
      seat_groups: [...groups.values()],
      meals_detail: meals.map(meal => ({
        label: meal.label,
        meal_type: meal.meal_type,
        adult_qty: meal.adult_qty,
        child_qty: meal.child_qty,
      })),
      meal_headcount: meals.reduce((sum, meal) => sum + meal.adult_qty + meal.child_qty, 0),
      sub_event_names: subEvents.filter((sub): sub is SubEvent => Boolean(sub)).map(sub => sub.sub_event_name),
      ...(checkedInAt ? { admission_checked_in_at: checkedInAt } : {}),
      capacity: evalResult.capacity,
      already: evalResult.already,
      remaining: evalResult.remaining,
      checked_in: evalResult.already,
    };
  }

  private buildScanResponse(
    evaluation: ReturnType<typeof classifyAdmission>,
    booking: SeatBooking | null,
    view: CheckinBookingView | null,
    gateLabel: string,
    extra?: { admitted_now?: number; checked_in?: number; gate_progress?: CheckinGateProgress[] }
  ): AdmissionScanResult {
    return {
      result: evaluation.result,
      booking: view,
      capacity: evaluation.capacity,
      already: evaluation.already,
      remaining: evaluation.remaining,
      checked_in: extra?.checked_in ?? evaluation.already,
      ...(extra?.admitted_now !== undefined ? { admitted_now: extra.admitted_now } : {}),
      gate_label: gateLabel,
      ...(extra?.gate_progress ? { gate_progress: extra.gate_progress } : {}),
    };
  }

  async scanAdmission(
    rawPayload: unknown,
    rawScope: unknown,
    opts: { dryRun?: boolean; manual?: boolean; admitQty?: number; eventId?: string } = {}
  ): Promise<AdmissionScanResult> {
    const scope = String(rawScope ?? 'event').trim() || 'event';
    if (!parseGateScope(scope) && scope !== 'event') {
      return { result: 'wrong_gate', booking: null };
    }
    const manual = opts.manual === true;
    const payload = String(rawPayload ?? '').trim();
    if (!payload) return { result: 'invalid_qr', booking: null };

    let bookingId: string;
    let token: string | null = null;
    const parsed = parseAdmissionPayload(payload);
    if (parsed) {
      bookingId = parsed.booking_id;
      token = parsed.token;
    } else if (manual) {
      bookingId = payload;
    } else {
      return { result: 'invalid_qr', booking: null };
    }

    const booking = await this.bookingForCheckin(await this.bookingHelper.findById(bookingId));
    const activeEventId =
      String(opts.eventId ?? '').trim() || (await this.resolveActiveEventId());
    const tokenValid = manual
      ? true
      : Boolean(token && booking?.admission_qr_token && token === booking.admission_qr_token);
    const evaluation = classifyAdmission(booking, { scope, tokenValid, activeEventId });
    const gateLabel = activeEventId
      ? await this.gateLabelForScope(scope, activeEventId)
      : scope;

    const admitQty = opts.admitQty !== undefined ? Number(opts.admitQty) : undefined;
    const isDryRun = opts.dryRun === true || admitQty === undefined;
    const gateProgress = booking && activeEventId
      ? await this.buildGateProgress(booking, activeEventId, scope)
      : undefined;
    const scanExtra = { gate_progress: gateProgress };

    if (isDryRun) {
      return this.buildScanResponse(
        evaluation,
        booking,
        booking ? await this.toCheckinView(booking, scope, evaluation) : null,
        gateLabel,
        scanExtra
      );
    }

    if (!booking || !evaluation.admit) {
      return this.buildScanResponse(
        evaluation,
        booking,
        booking ? await this.toCheckinView(booking, scope, evaluation) : null,
        gateLabel,
        scanExtra
      );
    }

    const fresh = await this.bookingForCheckin(await this.bookingHelper.findById(bookingId));
    if (!fresh) return { result: 'not_found', booking: null };
    const freshEval = classifyAdmission(fresh, { scope, tokenValid, activeEventId });
    const freshProgress = activeEventId
      ? await this.buildGateProgress(fresh, activeEventId, scope)
      : undefined;
    const freshExtra = { gate_progress: freshProgress };
    if (freshEval.remaining <= 0) {
      return this.buildScanResponse(
        { ...freshEval, result: 'already_checked_in', admit: false },
        fresh,
        await this.toCheckinView(fresh, scope, freshEval),
        gateLabel,
        freshExtra
      );
    }

    const qtyErr = validateAdmitQty(freshEval.remaining, admitQty!);
    if (qtyErr) {
      return this.buildScanResponse(
        { ...freshEval, result: qtyErr, admit: false },
        fresh,
        await this.toCheckinView(fresh, scope, freshEval),
        gateLabel,
        freshExtra
      );
    }

    const now = new Date().toISOString();
    const checkins = normalizeCheckins(fresh);
    const next = applyAdmitToGate(checkins[scope], admitQty!, now);
    const stamped = await this.bookingHelper.update(bookingId, {
      admission_checkins: { ...checkins, [scope]: next },
      admission_checked_in_at: mirrorCheckedInAt({ ...checkins, [scope]: next }),
    });
    const source = (await this.bookingForCheckin(stamped ?? fresh)) ?? fresh;
    const committed = classifyAdmission(source, { scope, tokenValid, activeEventId });
    const committedProgress = activeEventId
      ? await this.buildGateProgress(source, activeEventId, scope)
      : undefined;
    return this.buildScanResponse(
      { ...committed, result: 'admitted', admit: true },
      source,
      await this.toCheckinView(source, scope, committed),
      gateLabel,
      { admitted_now: admitQty, checked_in: next.checked_in, gate_progress: committedProgress }
    );
  }

  async setGateCheckin(
    bookingId: string,
    rawScope: unknown,
    rawCount: unknown
  ): Promise<AdmissionScanResult | null> {
    const scope = String(rawScope ?? 'event').trim() || 'event';
    const count = Number(rawCount);
    const booking = await this.bookingForCheckin(await this.bookingHelper.findById(String(bookingId)));
    if (!booking) return null;

    const capacity = gateCapacity(booking, scope);
    const countErr = validateCorrectCount(capacity, count);
    const gateLabel = await this.gateLabelForScope(scope, booking.event_id);
    const evaluation = classifyAdmission(booking, { scope, tokenValid: true, activeEventId: booking.event_id });

    if (countErr) {
      return this.buildScanResponse(
        { ...evaluation, result: countErr, admit: false },
        booking,
        await this.toCheckinView(booking, scope, evaluation),
        gateLabel
      );
    }

    const now = new Date().toISOString();
    const checkins = normalizeCheckins(booking);
    const next = applySetGateCheckin(checkins[scope], count, now);
    const updated = { ...checkins };
    if (next) updated[scope] = next;
    else delete updated[scope];

    const stamped = await this.bookingHelper.update(String(bookingId), {
      admission_checkins: updated,
      admission_checked_in_at: mirrorCheckedInAt(updated),
    });
    const source = stamped ?? booking;
    const after = classifyAdmission(source, { scope, tokenValid: true, activeEventId: booking.event_id });
    return this.buildScanResponse(
      after,
      source,
      await this.toCheckinView(source, scope, after),
      gateLabel,
      { checked_in: count }
    );
  }

  async checkinStats(
    rawScope: unknown,
    rawEventId?: unknown
  ): Promise<CheckinStats> {
    const scope = String(rawScope ?? 'event').trim() || 'event';
    const eventId =
      String(rawEventId ?? '').trim() || (await this.resolveActiveEventId());
    const profile = eventId ? await this.profileHelper.findByEventId(eventId) : null;
    const mealDays = profile?.meal_days ?? [];
    const bookings = await this.bookingHelper.findAll();
    const enriched = bookings.map(booking => enrichFoodAddonsWithMealSlots(booking, mealDays));
    const relevant = enriched.filter(
      booking =>
        booking.status === 'confirmed' &&
        (!eventId || booking.event_id === eventId) &&
        bookingCoversGate(booking, scope)
    );

    let checked_in = 0;
    let total = 0;
    let bookings_done = 0;
    for (const booking of relevant) {
      const capacity = gateCapacity(booking, scope);
      const already = gateCheckedIn(booking, scope);
      total += capacity;
      checked_in += Math.min(already, capacity);
      if (capacity > 0 && already >= capacity) bookings_done += 1;
    }

    return {
      scope,
      checked_in,
      total,
      bookings_total: relevant.length,
      bookings_done,
    };
  }

  private gatePartyCounts(
    booking: SeatBooking,
    scope: string
  ): { adult_count: number; child_count: number } {
    const gate = parseGateScope(scope);
    if (!gate) return { adult_count: 0, child_count: 0 };

    if (gate.kind === 'meal' && gate.dayId && gate.mealType) {
      const meal = booking.meals_detail?.find(
        row => row.day_id === gate.dayId && row.meal_type === gate.mealType
      );
      if (meal) return { adult_count: meal.adult_qty, child_count: meal.child_qty };
      const addon = booking.food_addons_detail?.find(
        row => row.meal_day_id === gate.dayId && row.meal_type === gate.mealType
      );
      if (addon) return { adult_count: addon.adult_qty, child_count: addon.child_qty };
      return { adult_count: 0, child_count: 0 };
    }

    if (gate.kind === 'sub' && gate.subEventId) {
      const seats = booking.seats_detail.filter(
        seat => seat.sub_event_id === gate.subEventId
      );
      // A whole-event pass has seats with no sub_event_id — count all of them
      // (matches gateCapacity, which returns the full seat count for such passes).
      const relevant = seats.length > 0 ? seats : booking.seats_detail;
      let adult_count = 0;
      let child_count = 0;
      for (const seat of relevant) {
        if (seat.audience_type === 'child') child_count += 1;
        else adult_count += 1;
      }
      return { adult_count, child_count };
    }

    return { adult_count: 0, child_count: 0 };
  }

  private ticketStatGuest(booking: SeatBooking, scope: string): TicketStatGuest | null {
    const capacity = gateCapacity(booking, scope);
    if (capacity <= 0) return null;
    const { adult_count, child_count } = this.gatePartyCounts(booking, scope);
    return {
      booking_id: booking.booking_id,
      name: booking.name,
      email: booking.email,
      phone: booking.phone,
      adult_count,
      child_count,
      capacity,
      checked_in: gateCheckedIn(booking, scope),
    };
  }

  private buildTicketStatCard(
    gate: { scope: string; group: string; label: string },
    bookings: SeatBooking[]
  ): TicketStatCard {
    const card: TicketStatCard = {
      scope: gate.scope,
      label: gate.label,
      group: gate.group,
      total: 0,
      pending_payment: 0,
      confirmed: 0,
      expired: 0,
      cancelled: 0,
      entered: 0,
    };
    for (const booking of bookings) {
      const guest = this.ticketStatGuest(booking, gate.scope);
      if (!guest) continue;
      card.total += 1;
      if (guest.checked_in > 0) card.entered += 1;
      if (booking.status === 'pending_payment') card.pending_payment += 1;
      else if (booking.status === 'confirmed') card.confirmed += 1;
      else if (booking.status === 'expired') card.expired += 1;
      else if (booking.status === 'cancelled') card.cancelled += 1;
    }
    return card;
  }

  private buildTicketStatDetail(
    gate: { scope: string; label: string },
    bookings: SeatBooking[]
  ): TicketStatDetail {
    const detail: TicketStatDetail = {
      scope: gate.scope,
      label: gate.label,
      pending_payment: [],
      confirmed: [],
      expired: [],
      cancelled: [],
      entered: [],
    };
    for (const booking of bookings) {
      const guest = this.ticketStatGuest(booking, gate.scope);
      if (!guest) continue;
      if (guest.checked_in > 0) detail.entered.push(guest);
      if (booking.status === 'pending_payment') detail.pending_payment.push(guest);
      else if (booking.status === 'confirmed') detail.confirmed.push(guest);
      else if (booking.status === 'expired') detail.expired.push(guest);
      else if (booking.status === 'cancelled') detail.cancelled.push(guest);
    }
    const byName = (a: TicketStatGuest, b: TicketStatGuest) => a.name.localeCompare(b.name);
    detail.pending_payment.sort(byName);
    detail.confirmed.sort(byName);
    detail.expired.sort(byName);
    detail.cancelled.sort(byName);
    detail.entered.sort(byName);
    return detail;
  }

  async getTicketStats(eventId: string, scope?: string): Promise<TicketStatsResponse> {
    const id = String(eventId ?? '').trim();
    if (!id) throw new Error('event_id is required');
    const event = await this.eventHelper.findById(id);
    const { gates } = await this.listCheckinGates(id);
    const profile = await this.profileHelper.findByEventId(id);
    const mealDays = profile?.meal_days ?? [];
    const bookings = (await this.bookingHelper.findAll())
      .filter(booking => booking.event_id === id)
      .map(booking => enrichFoodAddonsWithMealSlots(booking, mealDays));

    const cards = gates
      .filter(gate => gate.group === 'Meals' || gate.group === 'Sub-events')
      .map(gate => this.buildTicketStatCard(gate, bookings));

    const trimmedScope = String(scope ?? '').trim();
    const selected = trimmedScope ? gates.find(gate => gate.scope === trimmedScope) : undefined;

    return {
      event: event ? { event_id: event.event_id, event_name: event.event_name } : null,
      cards,
      ...(selected ? { detail: this.buildTicketStatDetail(selected, bookings) } : {}),
    };
  }

  /**
   * Re-issue (if needed) and re-email the event-day admission ticket for a
   * confirmed booking. Covers guests who lost the email and bookings confirmed
   * before admission QRs existed (no token yet).
   */
  async resendAdmissionTicket(bookingId: string): Promise<SeatBooking | null> {
    const booking = await this.bookingHelper.findById(String(bookingId));
    if (!booking) return null;
    if (booking.status !== 'confirmed') {
      throw new Error('Only confirmed bookings have an admission ticket to send');
    }
    const withToken = await this.bookingHelper.issueAdmissionQrToken(String(bookingId));
    if (!withToken) return null;
    this.queueBookingPaidEmail(withToken);
    return withToken;
  }

  private async enforcePendingBookingCap(email: string): Promise<void> {
    const count = await this.bookingHelper.countPendingByEmail(email);
    if (count >= MAX_PENDING_BOOKINGS_PER_EMAIL) {
      throw new Error(
        `You already have ${MAX_PENDING_BOOKINGS_PER_EMAIL} bookings awaiting payment. Please complete payment on an existing booking before creating another.`
      );
    }
  }

  // ------------------------------------------------------------- validators

  private resolveSeatKey(key: string, maps: SeatMap[]): { key: string; localId: string; map: SeatMap; section: SeatingSection } {
    const separator = key.indexOf('|');
    let map: SeatMap | undefined;
    let localId = key;
    if (separator >= 0) {
      map = maps.find(item => item.map_id === key.slice(0, separator));
      localId = key.slice(separator + 1);
    } else if (maps.length === 1) {
      map = maps[0];
    }
    if (!map) throw new Error(`Seat "${key}" references an unavailable seat map`);
    const section = this.findSeatSection(localId, map.sections);
    if (!section) throw new Error(`Seat "${key}" does not exist`);
    return { key: normalizeSeatKey(map.map_id, localId), localId, map, section };
  }

  private normalizeStoredSeat(seatId: string, maps: SeatMap[]): string | null {
    if (seatId.includes('|')) {
      const mapId = seatId.slice(0, seatId.indexOf('|'));
      return maps.some(map => map.map_id === mapId) ? seatId : null;
    }
    const legacyMap = maps.find(map => map.migrated_from_legacy && this.findSeatSection(seatId, map.sections));
    return legacyMap ? normalizeSeatKey(legacyMap.map_id, seatId) : null;
  }

  private seatBelongsToMap(seatId: string, map: SeatMap): boolean {
    if (seatId.includes('|')) return seatId.slice(0, seatId.indexOf('|')) === map.map_id;
    return map.migrated_from_legacy === true && Boolean(this.findSeatSection(seatId, map.sections));
  }

  private findSeatSection(seatId: string, sections: SeatingSection[]): SeatingSection | null {
    const parts = seatId.split(':');
    if (parts.length !== 3) return null;
    const section = sections.find(item => item.section_id === parts[0]);
    const row = Number(parts[1]);
    const seat = Number(parts[2]);
    return section && Number.isInteger(row) && row >= 1 && row <= section.rows &&
      Number.isInteger(seat) && seat >= 1 && seat <= section.seats_per_row ? section : null;
  }

  private validatePartySize(
    adultCount: unknown,
    childCount: unknown
  ): { adults: number; children: number; partySize: number } {
    const adults = Number(adultCount);
    const children = Number(childCount);
    if (!Number.isInteger(adults) || adults < 0 || !Number.isInteger(children) || children < 0) {
      throw new Error('Adult and child counts must be whole numbers');
    }
    const partySize = adults + children;
    if (partySize < 1) throw new Error('Specify at least one adult or child ticket');
    if (partySize > MAX_PARTY_SIZE) {
      throw new Error(`You can book at most ${MAX_PARTY_SIZE} tickets (adults + children) per order`);
    }
    return { adults, children, partySize };
  }

  private validateSeatSelection(
    resolved: Array<{ key: string; map: SeatMap }>,
    maps: SeatMap[],
    scope: string | undefined,
    adults: number,
    children: number,
    seatAudiences?: Record<string, 'adult' | 'child'>
  ): void {
    const partySize = adults + children;
    const byMap = new Map<string, Array<{ key: string; map: SeatMap }>>();
    for (const item of resolved) {
      const list = byMap.get(item.map.map_id) ?? [];
      list.push(item);
      byMap.set(item.map.map_id, list);
    }

    if (scope !== undefined) {
      if (resolved.length !== partySize) {
        throw new Error(
          `Select exactly ${partySize} seat${partySize === 1 ? '' : 's'} (${adults} adult${adults === 1 ? '' : 's'}, ${children} child${children === 1 ? '' : 'ren'})`
        );
      }
      if (seatAudiences) {
        this.validateMapAudienceSplit(resolved.map(item => item.key), adults, children, seatAudiences);
      }
      return;
    }

    const required = maps.filter(map => map.sub_event_id && map.is_open);
    if (required.length === 0) {
      if (resolved.length !== partySize) {
        throw new Error(
          `Select exactly ${partySize} seat${partySize === 1 ? '' : 's'} (${adults} adult${adults === 1 ? '' : 's'}, ${children} child${children === 1 ? '' : 'ren'})`
        );
      }
      if (seatAudiences) {
        this.validateMapAudienceSplit(resolved.map(item => item.key), adults, children, seatAudiences);
      }
      return;
    }

    const expectedTotal = partySize * required.length;
    if (resolved.length !== expectedTotal) {
      throw new Error(
        `Entire-event booking requires ${partySize} seat${partySize === 1 ? '' : 's'} on each program (${expectedTotal} total across ${required.length} program${required.length === 1 ? '' : 's'})`
      );
    }
    for (const map of required) {
      const onMap = byMap.get(map.map_id) ?? [];
      if (onMap.length !== partySize) {
        throw new Error(
          `Select exactly ${partySize} seat${partySize === 1 ? '' : 's'} on "${map.name}" (${onMap.length} selected)`
        );
      }
      if (seatAudiences) {
        this.validateMapAudienceSplit(onMap.map(item => item.key), adults, children, seatAudiences);
      }
    }
  }

  private validateMapAudienceSplit(
    seatKeys: string[],
    adults: number,
    children: number,
    seatAudiences: Record<string, 'adult' | 'child'>
  ): void {
    let adultAssigned = 0;
    let childAssigned = 0;
    for (const key of seatKeys) {
      const audience = seatAudiences[key];
      if (audience !== 'adult' && audience !== 'child') {
        throw new Error('Each seat must be marked as adult or child');
      }
      if (audience === 'adult') adultAssigned++;
      else childAssigned++;
    }
    if (adultAssigned !== adults || childAssigned !== children) {
      throw new Error(
        `Each program needs ${adults} adult${adults === 1 ? '' : 's'} and ${children} child${children === 1 ? '' : 'ren'} seat${adults + children === 1 ? '' : 's'}`
      );
    }
  }

  private parseSeatAudiences(
    seatAudiences: unknown,
    seatKeys: string[]
  ): Record<string, 'adult' | 'child'> {
    if (!seatAudiences || typeof seatAudiences !== 'object' || Array.isArray(seatAudiences)) {
      throw new Error('Missing ticket types for selected seats');
    }
    const raw = seatAudiences as Record<string, unknown>;
    const out: Record<string, 'adult' | 'child'> = {};
    for (const key of seatKeys) {
      const audience = raw[key];
      if (audience !== 'adult' && audience !== 'child') {
        throw new Error('Each seat must be marked as adult or child');
      }
      out[key] = audience;
    }
    return out;
  }

  private seatDetail(
    item: { key: string; localId: string; map: SeatMap; section: SeatingSection },
    profile: TicketingProfile,
    audienceType: 'adult' | 'child' = 'adult',
    packageCategoryId?: string,
    scope?: string
  ): BookedSeatDetail {
    const [, rowStr, seatStr] = item.localId.split(':');
    const mapCategories = this.categoriesForMap(
      { event_id: profile.event_id, sub_event_id: item.map.sub_event_id },
      profile
    );
    let category = mapCategories.find(candidate => candidate.category_id === item.section.category_id);
    if (scope === undefined && item.map.sub_event_id && packageCategoryId) {
      const selected = this.findCategoryById(profile, packageCategoryId, scope);
      if (selected) {
        const matched = mapCategories.find(
          candidate => candidate.name.trim().toLowerCase() === selected.name.trim().toLowerCase()
        );
        if (matched) category = matched;
      }
    }
    const start = item.section.seat_number_start ?? 1;
    const step = item.section.seat_number_step ?? 1;
    const displayNum = start + (Number(seatStr) - 1) * step;
    const label = item.section.rows === 1 && item.section.seats_per_row === 1
      ? item.section.name
      : item.section.rows === 1
        ? `${item.section.name} — Seat ${displayNum}`
        : `${item.section.name} — Row ${rowLabel(Number(rowStr))}, Seat ${displayNum}`;
    return {
      seat_id: item.key,
      label,
      category_name: category?.name ?? 'General',
      price: category
        ? (audienceType === 'child' ? categoryChildPrice(category) : categoryAdultPrice(category))
        : 0,
      audience_type: audienceType,
      map_id: item.map.map_id,
      map_name: item.map.name,
      ...(item.map.sub_event_id ? { sub_event_id: item.map.sub_event_id } : {}),
    };
  }

  /** Keep sub-event enabled categories in sync with painted seat-map sections. */
  private mergeMapCategoriesIntoSubEventConfigs(
    sub_event_configs: SubEventTicketingConfig[],
    maps: SeatMap[],
    categories: SeatCategory[]
  ): SubEventTicketingConfig[] {
    const validIds = new Set(categories.map(category => category.category_id));
    return sub_event_configs.map(config => {
      const enabled = new Set(config.enabled_category_ids ?? []);
      for (const map of maps) {
        if (map.sub_event_id !== config.sub_event_id) continue;
        for (const section of map.sections) {
          if (validIds.has(section.category_id)) enabled.add(section.category_id);
        }
      }
      const enabled_category_ids = [...enabled];
      const category_prices = this.validateSubEventCategoryPrices(
        config.category_prices,
        undefined,
        enabled_category_ids,
        categories
      );
      return { ...config, enabled_category_ids, category_prices };
    });
  }

  private categoriesForMap(
    association: Pick<SeatMap, 'event_id' | 'sub_event_id'>,
    profile: TicketingProfile,
    current?: SeatMap
  ): SeatCategory[] {
    const subEventId = association.sub_event_id ?? current?.sub_event_id;
    if (subEventId) {
      return categoriesForSubEvent(profile, subEventId);
    }
    return categoriesForEntireEvent(profile);
  }

  private categoriesForScope(profile: TicketingProfile, scope?: string): SeatCategory[] {
    if (scope) {
      return categoriesForSubEvent(profile, scope);
    }
    return categoriesForEntireEvent(profile);
  }

  private findCategoryById(profile: TicketingProfile, categoryId: string, scope?: string): SeatCategory | null {
    return this.categoriesForScope(profile, scope).find(category => category.category_id === categoryId)
      ?? profile.categories.find(category => category.category_id === categoryId)
      ?? null;
  }

  private sectionMatchesSelectedCategory(
    profile: TicketingProfile,
    item: { map: SeatMap; section: SeatingSection },
    categoryId: string,
    scope?: string
  ): boolean {
    const selected = this.findCategoryById(profile, categoryId, scope);
    if (!selected) return false;
    const seatCategory = this.categoriesForMap(
      { event_id: profile.event_id, sub_event_id: item.map.sub_event_id },
      profile
    ).find(category => category.category_id === item.section.category_id);
    if (!seatCategory) return false;
    if (scope === undefined && item.map.sub_event_id) {
      return seatCategory.name.trim().toLowerCase() === selected.name.trim().toLowerCase();
    }
    return item.section.category_id === categoryId;
  }

  private validateChildAgeRange(input: unknown): ChildAgeRange {
    const value = input as ChildAgeRange;
    const min_age = Number(value?.min_age);
    const max_age = Number(value?.max_age);
    if (!Number.isInteger(min_age) || min_age < 0 || min_age > 17) {
      throw new Error('Child min age must be an integer from 0 to 17');
    }
    if (!Number.isInteger(max_age) || max_age < min_age || max_age > 17) {
      throw new Error('Child max age must be an integer from min age to 17');
    }
    return { min_age, max_age };
  }

  private validateMealDays(input: unknown): MealDayPricing[] {
    if (!Array.isArray(input) || input.length > MAX_MEAL_DAYS) {
      throw new Error(`meal_days must be an array of at most ${MAX_MEAL_DAYS} items`);
    }
    const seen = new Set<string>();
    return input.map(day => {
      if (!day || typeof day.label !== 'string' || !day.label.trim() || day.label.length > MAX_TEXT) {
        throw new Error('Each meal day needs a label');
      }
      const day_id = typeof day.day_id === 'string' && day.day_id.trim()
        ? day.day_id.trim()
        : this.profileHelper.newId();
      if (seen.has(day_id)) throw new Error('Duplicate meal day id');
      seen.add(day_id);
      const date = day.date ? String(day.date).trim() : undefined;
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Meal day date must be YYYY-MM-DD');
      const prices = ['lunch_adult_price', 'lunch_child_price', 'dinner_adult_price', 'dinner_child_price'] as const;
      const out: MealDayPricing = {
        day_id,
        label: day.label.trim(),
        lunch_adult_price: 0,
        lunch_child_price: 0,
        dinner_adult_price: 0,
        dinner_child_price: 0,
      };
      for (const key of prices) {
        const price = Number(day[key]);
        if (!Number.isFinite(price) || price < 0 || price > 100000) {
          throw new Error(`Meal day "${day.label}" has an invalid ${key}`);
        }
        out[key] = price;
      }
      if (date) out.date = date;
      return out;
    });
  }

  private async validateSubEventConfigs(
    eventId: string,
    input: unknown,
    masterCategories: SeatCategory[],
    mealDays: MealDayPricing[] = []
  ): Promise<SubEventTicketingConfig[]> {
    if (!Array.isArray(input)) throw new Error('sub_event_configs must be an array');
    const eventSubEvents = await this.subEventHelper.findByEventId(eventId);
    const allowed = new Set(eventSubEvents.map(sub => sub.sub_event_id));
    const validCategoryIds = new Set(masterCategories.map(category => category.category_id));
    const requiredEntireEventIds = masterCategories
      .filter(category => category.entire_event_enabled)
      .map(category => category.category_id);
    const seen = new Set<string>();
    return input.map(config => {
      const sub_event_id = String(config?.sub_event_id ?? '').trim();
      if (!sub_event_id || !allowed.has(sub_event_id)) {
        throw new Error('Each sub-event config must reference a valid sub-event of the selected event');
      }
      if (seen.has(sub_event_id)) throw new Error('Duplicate sub-event config');
      seen.add(sub_event_id);
      const ticketing_type = config?.ticketing_type === 'concert' ? 'concert' : 'general';
      const rawIds = Array.isArray(config?.enabled_category_ids)
        ? config.enabled_category_ids
        : (config?.categories ?? []).map((category: SeatCategory) => category.category_id);
      const enabled = new Set<string>();
      for (const raw of rawIds) {
        const category_id = String(raw ?? '').trim();
        if (!category_id) continue;
        if (!validCategoryIds.has(category_id)) {
          throw new Error('Sub-event category selection references an unknown category');
        }
        enabled.add(category_id);
      }
      for (const category_id of requiredEntireEventIds) enabled.add(category_id);
      const food_addons = this.validateFoodAddons(config?.food_addons ?? [], mealDays);
      const category_prices = this.validateSubEventCategoryPrices(
        config?.category_prices,
        config?.categories,
        [...enabled],
        masterCategories
      );
      return {
        sub_event_id,
        ticketing_type,
        enabled_category_ids: [...enabled],
        category_prices,
        food_addons,
      };
    });
  }

  private validateSubEventCategoryPrices(
    input: unknown,
    legacyCategories: unknown,
    enabledIds: string[],
    masterCategories: SeatCategory[]
  ): SubEventCategoryPricing[] {
    const validIds = new Set(masterCategories.map(category => category.category_id));
    const byId = new Map<string, SubEventCategoryPricing>();

    if (Array.isArray(input)) {
      for (const row of input) {
        const category_id = String(row?.category_id ?? '').trim();
        if (!category_id || !validIds.has(category_id)) {
          throw new Error('Sub-event category pricing references an unknown category');
        }
        const adult_price = Number(row?.adult_price ?? 0);
        const child_price = Number(row?.child_price ?? 0);
        if (!Number.isFinite(adult_price) || adult_price < 0 || adult_price > 100000) {
          throw new Error('Sub-event category adult price must be between 0 and 100000');
        }
        if (!Number.isFinite(child_price) || child_price < 0 || child_price > 100000) {
          throw new Error('Sub-event category child price must be between 0 and 100000');
        }
        byId.set(category_id, { category_id, adult_price, child_price });
      }
    }

    if (Array.isArray(legacyCategories)) {
      for (const cat of legacyCategories as SeatCategory[]) {
        const category_id = String(cat?.category_id ?? '').trim();
        if (!category_id || !validIds.has(category_id) || byId.has(category_id)) continue;
        byId.set(category_id, {
          category_id,
          adult_price: categoryAdultPrice(cat),
          child_price: categoryChildPrice(cat),
        });
      }
    }

    for (const category_id of enabledIds) {
      if (!validIds.has(category_id)) continue;
      if (!byId.has(category_id)) {
        byId.set(category_id, { category_id, adult_price: 0, child_price: 0 });
      }
    }

    return [...byId.values()].filter(row => enabledIds.includes(row.category_id));
  }

  private validateFoodAddons(input: unknown, mealDays: MealDayPricing[] = []): FoodAddon[] {
    if (!Array.isArray(input) || input.length > MAX_FOOD_ADDONS) {
      throw new Error(`food_addons must be an array of at most ${MAX_FOOD_ADDONS} items`);
    }
    const mealDayIds = new Set(mealDays.map(day => day.day_id));
    const seen = new Set<string>();
    return input.map(addon => {
      if (!addon || typeof addon.name !== 'string' || !addon.name.trim() || addon.name.length > MAX_TEXT) {
        throw new Error('Each food add-on needs a name');
      }
      const addon_id = typeof addon.addon_id === 'string' && addon.addon_id.trim()
        ? addon.addon_id.trim()
        : this.profileHelper.newId();
      if (seen.has(addon_id)) throw new Error('Duplicate food add-on id');
      seen.add(addon_id);
      const adult_price = Number(addon.adult_price);
      const child_price = Number(addon.child_price);
      if (!Number.isFinite(adult_price) || adult_price < 0 || adult_price > 100000) {
        throw new Error(`Food add-on "${addon.name}" has an invalid adult price`);
      }
      if (!Number.isFinite(child_price) || child_price < 0 || child_price > 100000) {
        throw new Error(`Food add-on "${addon.name}" has an invalid child price`);
      }
      if (!(adult_price > 0) && !(child_price > 0)) {
        throw new Error(`Food add-on "${addon.name}" must have a price`);
      }
      const description = addon.description ? String(addon.description).trim() : '';
      if (description.length > 500) throw new Error('Food add-on description is too long');

      let meal_day_id = addon.meal_day_id ? String(addon.meal_day_id).trim() : '';
      let meal_type = addon.meal_type === 'lunch' || addon.meal_type === 'dinner' ? addon.meal_type : undefined;
      if (!meal_day_id || !meal_type) {
        const name = addon.name.trim();
        for (const day of mealDays) {
          if (name === `${day.label} Lunch`) {
            meal_day_id = day.day_id;
            meal_type = 'lunch';
            break;
          }
          if (name === `${day.label} Dinner`) {
            meal_day_id = day.day_id;
            meal_type = 'dinner';
            break;
          }
        }
      }
      if (meal_day_id && !mealDayIds.has(meal_day_id)) {
        throw new Error(`Food add-on "${addon.name}" references an unknown meal day`);
      }
      if ((meal_day_id && !meal_type) || (!meal_day_id && meal_type)) {
        throw new Error('Food add-on meal_day_id and meal_type must be set together');
      }

      return {
        addon_id,
        name: addon.name.trim(),
        adult_price,
        child_price,
        ...(description ? { description } : {}),
        ...(meal_day_id && meal_type ? { meal_day_id, meal_type } : {}),
      };
    });
  }

  private buildEntireEventMeals(
    profile: TicketingProfile,
    adults: number,
    children: number
  ): BookedMealDetail[] {
    const out: BookedMealDetail[] = [];
    for (const day of profile.meal_days ?? []) {
      if (day.lunch_adult_price > 0 || day.lunch_child_price > 0) {
        out.push({
          day_id: day.day_id,
          label: day.label,
          meal_type: 'lunch',
          adult_qty: adults,
          child_qty: children,
          adult_price: day.lunch_adult_price,
          child_price: day.lunch_child_price,
          line_total: round2(adults * day.lunch_adult_price + children * day.lunch_child_price),
        });
      }
      if (day.dinner_adult_price > 0 || day.dinner_child_price > 0) {
        out.push({
          day_id: day.day_id,
          label: day.label,
          meal_type: 'dinner',
          adult_qty: adults,
          child_qty: children,
          adult_price: day.dinner_adult_price,
          child_price: day.dinner_child_price,
          line_total: round2(adults * day.dinner_adult_price + children * day.dinner_child_price),
        });
      }
    }
    return out;
  }

  private buildEntireEventFoodAddons(
    profile: TicketingProfile,
    adults: number,
    children: number
  ): BookedFoodAddon[] {
    const out: BookedFoodAddon[] = [];
    for (const config of profile.sub_event_configs) {
      for (const addon of config.food_addons) {
        out.push({
          addon_id: addon.addon_id,
          sub_event_id: config.sub_event_id,
          name: addon.name,
          adult_qty: adults,
          child_qty: children,
          adult_price: addon.adult_price,
          child_price: addon.child_price,
          line_total: round2(adults * addon.adult_price + children * addon.child_price),
        });
      }
    }
    return out;
  }

  private validateFoodAddonSelections(
    input: unknown,
    profile: TicketingProfile,
    seatSubEventIds: string[],
    adults: number,
    children: number
  ): BookedFoodAddon[] {
    if (input === undefined || input === null) return [];
    if (!Array.isArray(input)) throw new Error('food_addons must be an array');
    const allowedSubEvents = seatSubEventIds.length > 0
      ? new Set(seatSubEventIds)
      : new Set(profile.sub_event_configs.map(config => config.sub_event_id));
    const out: BookedFoodAddon[] = [];
    for (const row of input) {
      const addon_id = String(row?.addon_id ?? '').trim();
      const sub_event_id = String(row?.sub_event_id ?? '').trim();
      const adult_qty = Number(row?.adult_qty ?? 0);
      const child_qty = Number(row?.child_qty ?? 0);
      if (!addon_id || !sub_event_id) throw new Error('Each food add-on selection needs addon_id and sub_event_id');
      if (!allowedSubEvents.has(sub_event_id)) {
        throw new Error('Food add-ons must match a sub-event in your booking');
      }
      if (!Number.isInteger(adult_qty) || adult_qty < 0 || adult_qty > 50) {
        throw new Error('Food add-on adult quantity must be an integer from 0 to 50');
      }
      if (!Number.isInteger(child_qty) || child_qty < 0 || child_qty > 50) {
        throw new Error('Food add-on child quantity must be an integer from 0 to 50');
      }
      if (adult_qty > adults) {
        throw new Error(`Food add-on adult quantity cannot exceed your party (${adults} adult${adults === 1 ? '' : 's'})`);
      }
      if (child_qty > children) {
        throw new Error(`Food add-on child quantity cannot exceed your party (${children} child${children === 1 ? '' : 'ren'})`);
      }
      if (adult_qty === 0 && child_qty === 0) continue;
      const config = profile.sub_event_configs.find(item => item.sub_event_id === sub_event_id);
      const addon = config?.food_addons.find(item => item.addon_id === addon_id);
      if (!addon) throw new Error('One or more food add-ons are no longer available');
      const mealSlot =
        addon.meal_day_id && addon.meal_type
          ? { day_id: addon.meal_day_id, meal_type: addon.meal_type }
          : inferMealSlotFromFoodAddonName(addon.name, profile.meal_days ?? []);
      out.push({
        addon_id,
        sub_event_id,
        name: addon.name,
        adult_qty,
        child_qty,
        adult_price: addon.adult_price,
        child_price: addon.child_price,
        line_total: round2(adult_qty * addon.adult_price + child_qty * addon.child_price),
        ...(mealSlot ? { meal_day_id: mealSlot.day_id, meal_type: mealSlot.meal_type } : {}),
      });
    }
    return out;
  }

  private validateMapName(value: unknown): string {
    const name = String(value ?? '').trim();
    if (!name || name.length > MAX_TEXT) throw new Error('Each seat map needs a name');
    return name;
  }

  private validateHoldMinutes(value: unknown): number {
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) {
      throw new Error('hold_minutes must be an integer between 1 and 60');
    }
    return minutes;
  }

  private validateCategories(input: unknown): SeatCategory[] {
    if (!Array.isArray(input) || input.length > MAX_CATEGORIES) {
      throw new Error(`categories must be an array of at most ${MAX_CATEGORIES} items`);
    }
    const seen = new Set<string>();
    return input.map(category => {
      if (!category || typeof category.name !== 'string' || !category.name.trim() ||
        category.name.length > MAX_TEXT || typeof category.color !== 'string' ||
        !/^#[0-9a-fA-F]{6}$/.test(category.color)) {
        throw new Error('Each category needs a name and a hex color like #f59e0b');
      }
      const adult_price = Number(category.adult_price ?? category.price);
      const child_price = Number(category.child_price ?? adult_price);
      if (!Number.isFinite(adult_price) || adult_price < 0 || adult_price > 100000) {
        throw new Error(`Category "${category.name}" has an invalid adult price`);
      }
      if (!Number.isFinite(child_price) || child_price < 0 || child_price > 100000) {
        throw new Error(`Category "${category.name}" has an invalid child price`);
      }
      const entire_event_enabled = category.entire_event_enabled === true;
      const category_id = typeof category.category_id === 'string' && category.category_id.trim()
        ? category.category_id.trim()
        : this.profileHelper.newId();
      if (seen.has(category_id)) throw new Error('Duplicate category id');
      seen.add(category_id);
      return {
        category_id,
        name: category.name.trim(),
        color: category.color,
        adult_price,
        child_price,
        price: adult_price,
        entire_event_enabled,
      };
    });
  }

  private validateSections(input: unknown, categories: SeatCategory[]): SeatingSection[] {
    if (!Array.isArray(input) || input.length > MAX_SECTIONS) {
      throw new Error(`sections must be an array of at most ${MAX_SECTIONS} items`);
    }
    const categoryIds = new Set(categories.map(category => category.category_id));
    const seen = new Set<string>();
    return input.map(section => {
      if (!section || typeof section.name !== 'string' || !section.name.trim() || section.name.length > MAX_TEXT) {
        throw new Error('Each section needs a name');
      }
      const rows = Number(section.rows);
      const seats_per_row = Number(section.seats_per_row);
      if (!Number.isInteger(rows) || rows < 1 || rows > MAX_ROWS) {
        throw new Error(`Section "${section.name}": rows must be between 1 and ${MAX_ROWS}`);
      }
      if (!Number.isInteger(seats_per_row) || seats_per_row < 1 || seats_per_row > MAX_SEATS_PER_ROW) {
        throw new Error(`Section "${section.name}": seats per row must be between 1 and ${MAX_SEATS_PER_ROW}`);
      }
      if (typeof section.category_id !== 'string' || !categoryIds.has(section.category_id)) {
        throw new Error(`Section "${section.name}" must be assigned an existing category`);
      }
      const section_id = typeof section.section_id === 'string' && section.section_id.trim()
        ? section.section_id.trim()
        : this.mapHelper.newId();
      if (seen.has(section_id)) throw new Error('Duplicate section id');
      seen.add(section_id);
      const seat_number_start = section.seat_number_start === undefined
        ? undefined
        : Number(section.seat_number_start);
      const seat_number_step = section.seat_number_step === undefined
        ? undefined
        : Number(section.seat_number_step);
      if (seat_number_start !== undefined &&
        (!Number.isInteger(seat_number_start) || seat_number_start < 0 || seat_number_start > 999)) {
        throw new Error(`Section "${section.name}": seat_number_start must be an integer between 0 and 999`);
      }
      if (seat_number_step !== undefined && seat_number_step !== 1 && seat_number_step !== 2) {
        throw new Error(`Section "${section.name}": seat_number_step must be 1 or 2`);
      }
      return {
        section_id,
        name: section.name.trim(),
        rows,
        seats_per_row,
        category_id: section.category_id,
        ...(seat_number_start !== undefined ? { seat_number_start } : {}),
        ...(seat_number_step !== undefined ? { seat_number_step } : {}),
      };
    });
  }

  private validateSeatPositions(input: unknown, sections: SeatingSection[]): Record<string, { x: number; y: number }> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('seat_positions must be an object of seat_id -> {x, y}');
    }
    const positions: Record<string, { x: number; y: number }> = {};
    for (const [seatId, position] of Object.entries(input)) {
      if (!this.findSeatSection(seatId, sections)) throw new Error(`Position for unknown seat "${seatId}"`);
      const x = Number((position as { x?: unknown }).x);
      const y = Number((position as { y?: unknown }).y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) {
        throw new Error(`Seat "${seatId}" position must be percentages between 0 and 100`);
      }
      positions[seatId] = { x: round2(x), y: round2(y) };
    }
    return positions;
  }

  private validateBlockedSeats(input: unknown, sections: SeatingSection[]): string[] {
    if (!Array.isArray(input)) throw new Error('blocked_seats must be an array');
    const unique = [...new Set(input.map(String))];
    for (const seatId of unique) {
      if (!this.findSeatSection(seatId, sections)) {
        throw new Error(`Blocked seat "${seatId}" does not exist on the seat map`);
      }
    }
    return unique;
  }

  private validateDiscount(
    data: Partial<DiscountCode>
  ): Omit<DiscountCode, 'discount_id' | 'used_count' | 'created_at' | 'updated_at'> {
    const code = String(data.code ?? '').trim().toUpperCase();
    if (!code || code.length > 40 || !/^[A-Z0-9_-]+$/.test(code)) {
      throw new Error('Discount code must be letters/numbers (dashes/underscores allowed)');
    }
    if (data.type !== 'percent' && data.type !== 'fixed') {
      throw new Error('Discount type must be "percent" or "fixed"');
    }
    const value = Number(data.value);
    if (!Number.isFinite(value) || value <= 0) throw new Error('Discount value must be positive');
    if (data.type === 'percent' && value > 100) throw new Error('Percent discount cannot exceed 100');
    const out: Omit<DiscountCode, 'discount_id' | 'used_count' | 'created_at' | 'updated_at'> = {
      code,
      type: data.type,
      value,
      is_active: data.is_active !== false,
    };
    if (data.min_seats !== undefined) {
      const min = Number(data.min_seats);
      if (!Number.isInteger(min) || min < 1) throw new Error('min_seats must be a positive integer');
      out.min_seats = min;
    }
    if (data.max_uses !== undefined) {
      const max = Number(data.max_uses);
      if (!Number.isInteger(max) || max < 1) throw new Error('max_uses must be a positive integer');
      out.max_uses = max;
    }
    if (data.valid_from) out.valid_from = String(data.valid_from);
    if (data.valid_until) out.valid_until = String(data.valid_until);
    return out;
  }

  private async resolveDiscount(
    code: string,
    seatCount: number,
    subtotal: number
  ): Promise<{ discount: DiscountCode; amount: number }> {
    const discount = await this.discountHelper.findByCode(code);
    if (!discount || !discount.is_active) throw new Error('Invalid discount code');
    const now = Date.now();
    if (discount.valid_from && now < localDayBoundary(discount.valid_from, 'start')) {
      throw new Error('This discount code is not active yet');
    }
    if (discount.valid_until && now > localDayBoundary(discount.valid_until, 'end')) {
      throw new Error('This discount code has expired');
    }
    if (discount.max_uses !== undefined && discount.used_count >= discount.max_uses) {
      throw new Error('This discount code has been fully redeemed');
    }
    if (discount.min_seats !== undefined && seatCount < discount.min_seats) {
      throw new Error(`This code requires at least ${discount.min_seats} seats`);
    }
    const raw = discount.type === 'percent' ? subtotal * discount.value / 100 : discount.value;
    return { discount, amount: Math.min(round2(raw), subtotal) };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function localDayBoundary(dateStr: string, edge: 'start' | 'end'): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr).trim());
  if (match) {
    const [, year, month, day] = match;
    return edge === 'end'
      ? new Date(+year, +month - 1, +day, 23, 59, 59, 999).getTime()
      : new Date(+year, +month - 1, +day).getTime();
  }
  const time = new Date(dateStr).getTime();
  return Number.isNaN(time) ? (edge === 'end' ? Infinity : -Infinity) : time;
}

function isPast(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const time = new Date(dateStr).getTime();
  return !Number.isNaN(time) && time < Date.now();
}
