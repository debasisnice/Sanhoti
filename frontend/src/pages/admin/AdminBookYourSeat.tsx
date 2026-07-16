import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import {
  ticketingAPI,
  ticketSetupsAPI,
  theaterMapsAPI,
  eventsAPI,
  subEventsAPI,
  TicketingProfile,
  SeatMap,
  TheaterMap,
  TicketSetup,
  SeatBooking,
  DiscountCode,
  UnavailableSeats,
  SeatCategory,
  MealDayPricing,
  SubEventTicketingConfig,
  FoodAddon,
  categoriesForEntireEvent,
  categoriesForSubEvent,
  subEventCategoryPrice,
} from '../../services/api';
import { SubEvent } from '../../types';
import SeatGridDesigner, { GridSeat, seatsFromConfig, MatrixLayoutPayload } from './SeatGridDesigner';
import AdminEventTickets from './AdminEventTickets';
import AdminTheaterMaps from './AdminTheaterMaps';

/**
 * Admin management for the public /book-your-seat page:
 * Setup (event association, categories, open/close) · Seat Maps · Discounts.
 */

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';

const TICKET_SETUP_DRAFT_EVENT_KEY = 'sanhoti-ticket-setup-draft-event';

function readDraftEventId(): string {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('edit')?.trim();
  if (fromUrl) {
    localStorage.setItem(TICKET_SETUP_DRAFT_EVENT_KEY, fromUrl);
    window.history.replaceState({}, '', window.location.pathname);
    return fromUrl;
  }
  return localStorage.getItem(TICKET_SETUP_DRAFT_EVENT_KEY)?.trim() ?? '';
}

function persistDraftEventId(eventId: string): void {
  localStorage.setItem(TICKET_SETUP_DRAFT_EVENT_KEY, eventId);
}

function clearDraftEventId(): void {
  localStorage.removeItem(TICKET_SETUP_DRAFT_EVENT_KEY);
}

type TopTab = 'new_setup' | 'event_tickets' | 'theater_maps';
type Tab = 'entire_event' | 'meals' | 'sub_events' | 'seatmap' | 'discounts';

/** True when the date string is valid and already in the past. */
function isPast(dateStr?: string): boolean {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  return !isNaN(t) && t < Date.now();
}

const categoryAdultPrice = (c: SeatCategory) => Number(c.adult_price ?? c.price ?? 0);
const categoryChildPrice = (c: SeatCategory) => Number(c.child_price ?? categoryAdultPrice(c));

function normalizeFoodAddons(
  food_addons: FoodAddon[],
  mealDays: MealDayPricing[]
): FoodAddon[] {
  const slots = mealSlotOptions(mealDays);
  return food_addons.map(addon => {
    if (addon.meal_day_id && addon.meal_type) return addon;
    const match = slots.find(slot => slot.label === addon.name.trim());
    if (match) {
      return { ...addon, meal_day_id: match.meal_day_id, meal_type: match.meal_type };
    }
    return addon;
  });
}

function normalizeProfile(profile: TicketingProfile): TicketingProfile {
  const meal_days = profile.meal_days ?? [];
  const categories = (profile.categories ?? []).map(c => ({
    ...c,
    adult_price: categoryAdultPrice(c),
    child_price: categoryChildPrice(c),
    price: categoryAdultPrice(c),
    entire_event_enabled: c.entire_event_enabled ?? true,
  }));
  const entireEventIds = categories.filter(c => c.entire_event_enabled).map(c => c.category_id);
  const sub_event_configs = (profile.sub_event_configs ?? []).map(cfg => {
    const enabled = new Set<string>([
      ...(cfg.enabled_category_ids ?? cfg.categories?.map(c => c.category_id) ?? []),
      ...entireEventIds,
    ]);
    const category_prices = [...(cfg.category_prices ?? [])];
    for (const cat of cfg.categories ?? []) {
      if (!category_prices.some(row => row.category_id === cat.category_id)) {
        category_prices.push({
          category_id: cat.category_id,
          adult_price: categoryAdultPrice(cat),
          child_price: categoryChildPrice(cat),
        });
      }
    }
    for (const id of enabled) {
      if (!category_prices.some(row => row.category_id === id)) {
        category_prices.push({ category_id: id, adult_price: 0, child_price: 0 });
      }
    }
    return {
      ...cfg,
      enabled_category_ids: [...enabled].filter(id => categories.some(c => c.category_id === id)),
      category_prices: category_prices.filter(row => enabled.has(row.category_id)),
      food_addons: normalizeFoodAddons(cfg.food_addons ?? [], meal_days),
    };
  });
  return {
    ...profile,
    child_age_range: profile.child_age_range ?? { min_age: 0, max_age: 12 },
    meal_days: profile.meal_days ?? [],
    sub_event_configs,
    categories,
  };
}

function syncSubEventConfigs(profile: TicketingProfile, subs: SubEvent[]): TicketingProfile {
  if (subs.length === 0) return { ...profile, sub_event_configs: [] };
  const entireEventIds = profile.categories.filter(c => c.entire_event_enabled).map(c => c.category_id);
  const merged = subs.map(se => {
    const existing = profile.sub_event_configs?.find(c => c.sub_event_id === se.sub_event_id);
    if (existing) {
      const enabled = new Set([...(existing.enabled_category_ids ?? []), ...entireEventIds]);
      const category_prices = [...(existing.category_prices ?? [])];
      for (const id of enabled) {
        if (!category_prices.some(row => row.category_id === id)) {
          category_prices.push({ category_id: id, adult_price: 0, child_price: 0 });
        }
      }
      return {
        ...existing,
        enabled_category_ids: [...enabled],
        category_prices: category_prices.filter(row => enabled.has(row.category_id)),
      };
    }
    return {
      sub_event_id: se.sub_event_id,
      ticketing_type: 'general' as const,
      enabled_category_ids: [...entireEventIds],
      category_prices: entireEventIds.map(id => ({ category_id: id, adult_price: 0, child_price: 0 })),
      food_addons: [],
    };
  });
  return { ...profile, sub_event_configs: merged };
}

function newCategory(index: number): SeatCategory {
  return {
    category_id: `NEW-${Date.now()}-${index}`,
    name: '',
    adult_price: 0,
    child_price: 0,
    color: '#f59e0b',
    price: 0,
    entire_event_enabled: true,
  };
}

function emptyProfile(): TicketingProfile {
  return {
    event_id: '',
    categories: [],
    child_age_range: { min_age: 0, max_age: 12 },
    meal_days: [],
    sub_event_configs: [],
    hold_minutes: 10,
    payment_window_hours: 48,
    booking_note: '',
  };
}

function mealSlotOptions(mealDays: MealDayPricing[]): Array<{
  value: string;
  label: string;
  meal_day_id: string;
  meal_type: 'lunch' | 'dinner';
  adult_price: number;
  child_price: number;
}> {
  const out: Array<{
    value: string;
    label: string;
    meal_day_id: string;
    meal_type: 'lunch' | 'dinner';
    adult_price: number;
    child_price: number;
  }> = [];
  for (const day of mealDays) {
    if (day.lunch_adult_price > 0 || day.lunch_child_price > 0) {
      out.push({
        value: `${day.day_id}:lunch`,
        label: `${day.label} Lunch`,
        meal_day_id: day.day_id,
        meal_type: 'lunch',
        adult_price: day.lunch_adult_price,
        child_price: day.lunch_child_price,
      });
    }
    if (day.dinner_adult_price > 0 || day.dinner_child_price > 0) {
      out.push({
        value: `${day.day_id}:dinner`,
        label: `${day.label} Dinner`,
        meal_day_id: day.day_id,
        meal_type: 'dinner',
        adult_price: day.dinner_adult_price,
        child_price: day.dinner_child_price,
      });
    }
  }
  return out;
}

function foodAddonSlotValue(addon: FoodAddon, mealDays: MealDayPricing[]): string {
  if (addon.meal_day_id && addon.meal_type) return `${addon.meal_day_id}:${addon.meal_type}`;
  const match = mealSlotOptions(mealDays).find(slot => slot.label === addon.name.trim());
  return match?.value ?? '';
}

function updateSubEventConfig(
  configs: SubEventTicketingConfig[],
  subEventId: string,
  patch: Partial<SubEventTicketingConfig>
): SubEventTicketingConfig[] {
  return configs.map(config =>
    config.sub_event_id === subEventId ? { ...config, ...patch } : config
  );
}

export default function AdminBookYourSeat() {
  const [topTab, setTopTab] = useState<TopTab>('new_setup');
  const [tab, setTab] = useState<Tab>('entire_event');
  const [config, setConfig] = useState<TicketingProfile | null>(null);
  const [maps, setMaps] = useState<SeatMap[]>([]);
  const [theaterMaps, setTheaterMaps] = useState<TheaterMap[]>([]);
  const [activeSetup, setActiveSetup] = useState<TicketSetup | null>(null);
  const [selectedMapId, setSelectedMapId] = useState('');
  const [bookings, setBookings] = useState<SeatBooking[]>([]);
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [unavailable, setUnavailable] = useState<UnavailableSeats>({});
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<
    { event_id: string; event_name: string; year?: number; event_start_dt?: string; event_end_dt?: string }[]
  >([]);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  // Seat grid designer state (per-seat model)
  const [gridSeats, setGridSeats] = useState<GridSeat[]>([]);
  const [blockedSids, setBlockedSids] = useState<string[]>([]);
  const [matrixDims, setMatrixDims] = useState({ rows: 15, cols: 24 });
  const [layoutSource, setLayoutSource] = useState<string>('blank');
  const [loadFailed, setLoadFailed] = useState(false);
  const [draftEventId, setDraftEventId] = useState('');

  const resetToEmptySetup = useCallback(() => {
    setConfig(emptyProfile());
    setMaps([]);
    setSelectedMapId('');
    setGridSeats([]);
    setBlockedSids([]);
    setMatrixDims({ rows: 15, cols: 24 });
    setSubEvents([]);
    setActiveSetup(null);
    setDraftEventId('');
    clearDraftEventId();
    setLoadFailed(false);
  }, []);

  const loadAll = useCallback(async () => {
    const draftId = readDraftEventId();
    setDraftEventId(draftId);

    try {
      setEvents(await eventsAPI.getAll());
    } catch {
      /* ignore */
    }
    try {
      setBookings(await ticketingAPI.listBookings());
    } catch {
      /* ignore */
    }
    try {
      setDiscounts(await ticketingAPI.listDiscounts());
    } catch {
      /* ignore */
    }
    try {
      setTheaterMaps(await theaterMapsAPI.list());
    } catch {
      /* ignore */
    }
    try {
      const { unavailable } = await ticketingAPI.getAvailability();
      setUnavailable(unavailable);
    } catch {
      /* ignore */
    }

    if (draftId) {
      try {
        const profile = normalizeProfile(await ticketingAPI.getAdminProfile(draftId));
        setConfig(profile);
        setLoadFailed(false);
        const loadedMaps = await ticketingAPI.listMaps();
        const eventMaps = loadedMaps.filter(m => m.event_id === draftId);
        setMaps(eventMaps);
        setSelectedMapId(prevSelected => {
          const current = eventMaps.find(m => m.map_id === prevSelected) ?? eventMaps[0];
          if (current) {
            const parsed = seatsFromConfig(current);
            setGridSeats(parsed.seats);
            setBlockedSids(parsed.blockedSids);
            setMatrixDims(current.matrix);
            return current.map_id;
          }
          setGridSeats([]);
          setBlockedSids([]);
          return '';
        });
      } catch (error: any) {
        if (error?.response?.status === 404) {
          resetToEmptySetup();
        } else {
          setLoadFailed(true);
          toast.error('Failed to load draft setup');
        }
      }
      try {
        const loadedSubs = await subEventsAPI.getByEventId(draftId);
        setSubEvents(loadedSubs);
        setConfig(prev => (prev ? syncSubEventConfigs(prev, loadedSubs) : prev));
      } catch {
        setSubEvents([]);
      }
      try {
        const setups = await ticketSetupsAPI.list();
        setActiveSetup(setups.find(s => s.event_id === draftId && s.status === 'active') ?? null);
      } catch {
        setActiveSetup(null);
      }
    } else {
      resetToEmptySetup();
    }
  }, [resetToEmptySetup]);

  const refreshMapContext = useCallback(async () => {
    try {
      setBookings(await ticketingAPI.listBookings());
    } catch {
      /* ignore */
    }
    try {
      const { unavailable } = await ticketingAPI.getAvailability();
      setUnavailable(unavailable);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (tab === 'sub_events' && subEvents.length === 0) {
      setTab('entire_event');
    }
  }, [tab, subEvents.length]);

  // Seats taken by non-cancelled bookings (seat_id -> booking) for the map tab
  const bookedBy = useMemo(() => {
    const map: Record<string, SeatBooking> = {};
    for (const b of bookings) {
      if (b.status === 'cancelled') continue;
      for (const s of b.seat_ids) map[s] = b;
    }
    return map;
  }, [bookings]);

  const selectedMap = maps.find(map => map.map_id === selectedMapId);
  const activeCategories = useMemo(() => {
    if (!config) return [];
    if (selectedMap?.sub_event_id) return categoriesForSubEvent(config, selectedMap.sub_event_id);
    return categoriesForEntireEvent(config);
  }, [config, selectedMap]);

  const canDesignSeatMaps = useMemo(() => {
    if (!config || config.categories.length === 0) return false;
    if (categoriesForEntireEvent(config).length > 0) return true;
    return config.sub_event_configs.some(
      c => c.ticketing_type === 'concert' && (c.enabled_category_ids?.length ?? 0) > 0
    );
  }, [config]);

  const concertSubEvents = useMemo(
    () =>
      subEvents.filter(
        se => config?.sub_event_configs?.find(c => c.sub_event_id === se.sub_event_id)?.ticketing_type === 'concert'
      ),
    [subEvents, config?.sub_event_configs]
  );

  const set = <K extends keyof TicketingProfile>(key: K, value: TicketingProfile[K]) =>
    setConfig(c => (c ? { ...c, [key]: value } : c));

  const onEventChange = async (eventId: string) => {
    if (eventId) {
      try {
        const loadedSubs = await subEventsAPI.getByEventId(eventId);
        setSubEvents(loadedSubs);
        setConfig(c => (c ? syncSubEventConfigs({ ...c, event_id: eventId }, loadedSubs) : c));
      } catch {
        setSubEvents([]);
        setConfig(c => (c ? { ...c, event_id: eventId, sub_event_configs: [] } : c));
      }
      try {
        const setups = await ticketSetupsAPI.list();
        setActiveSetup(setups.find(s => s.event_id === eventId && s.status === 'active') ?? null);
      } catch {
        setActiveSetup(null);
      }
    } else {
      setSubEvents([]);
      setActiveSetup(null);
      setConfig(c => (c ? { ...c, event_id: eventId, sub_event_configs: [] } : c));
    }
  };

  const getCategoryError = (categories: SeatCategory[], label: string): string | null => {
    for (const c of categories) {
      if (!c.name.trim()) return `${label}: every category needs a name`;
      if (!(categoryAdultPrice(c) >= 0) || !(categoryChildPrice(c) >= 0)) {
        return `${label}: category "${c.name}" has invalid prices`;
      }
    }
    return null;
  };

  const seatCountOnMap = (map: SeatMap): number =>
    map.sections.filter(s => s.rows === 1 && s.seats_per_row === 1).length;

  /** Validate every sub-tab before save; returns the tab to focus when invalid. */
  const validateFullSetup = (): { tab: Tab; message: string } | null => {
    if (!config) return { tab: 'entire_event', message: 'Booking configuration is not loaded' };

    if (!config.event_id?.trim()) {
      return { tab: 'entire_event', message: 'Select an event on Entire Event Tickets' };
    }

    const hold = Number(config.hold_minutes);
    if (!Number.isInteger(hold) || hold < 1 || hold > 60) {
      return { tab: 'entire_event', message: 'Hold time must be an integer from 1 to 60 minutes' };
    }

    const paymentWindow = Number(config.payment_window_hours ?? 48);
    if (!Number.isInteger(paymentWindow) || paymentWindow < 1 || paymentWindow > 336) {
      return { tab: 'entire_event', message: 'Payment window must be an integer from 1 to 336 hours' };
    }

    const { min_age, max_age } = config.child_age_range ?? { min_age: 0, max_age: 12 };
    if (!Number.isInteger(min_age) || min_age < 0 || min_age > 17) {
      return { tab: 'entire_event', message: 'Child min age must be an integer from 0 to 17' };
    }
    if (!Number.isInteger(max_age) || max_age < min_age || max_age > 17) {
      return { tab: 'entire_event', message: 'Child max age must be an integer from min age to 17' };
    }

    const categoryErr = getCategoryError(config.categories, 'Entire Event Tickets');
    if (categoryErr) return { tab: 'entire_event', message: categoryErr };

    if (config.categories.length === 0) {
      return { tab: 'entire_event', message: 'Add at least one seat category on Entire Event Tickets' };
    }

    for (const day of config.meal_days ?? []) {
      if (!day.label?.trim()) {
        return { tab: 'meals', message: 'Every meal day needs a label on Daily Lunch & Dinner Pricing' };
      }
      for (const key of ['lunch_adult_price', 'lunch_child_price', 'dinner_adult_price', 'dinner_child_price'] as const) {
        const price = Number(day[key]);
        if (!Number.isFinite(price) || price < 0) {
          return {
            tab: 'meals',
            message: `Meal day "${day.label || 'Untitled'}": invalid ${key.replace(/_/g, ' ')}`,
          };
        }
      }
    }

    for (const subConfig of config.sub_event_configs) {
      const subName =
        subEvents.find(se => se.sub_event_id === subConfig.sub_event_id)?.sub_event_name ?? 'Sub-event';

      for (const addon of subConfig.food_addons ?? []) {
        if (!addon.name.trim()) {
          return { tab: 'sub_events', message: `${subName}: every food add-on needs a name` };
        }
        if (!foodAddonSlotValue(addon, config.meal_days ?? [])) {
          return { tab: 'sub_events', message: `${subName}: select a meal for each food add-on` };
        }
        if (!(Number(addon.adult_price) > 0) && !(Number(addon.child_price) > 0)) {
          return { tab: 'sub_events', message: `${subName}: “${addon.name}” needs a price` };
        }
      }

      if (subConfig.ticketing_type === 'concert' && (subConfig.enabled_category_ids ?? []).length === 0) {
        return {
          tab: 'sub_events',
          message: `${subName}: enable at least one seat category for the concert map`,
        };
      }

      for (const row of subConfig.category_prices ?? []) {
        if (!(Number(row.adult_price) >= 0) || !(Number(row.child_price) >= 0)) {
          return { tab: 'sub_events', message: `${subName}: invalid seat category pricing` };
        }
      }

      if (subConfig.ticketing_type === 'concert') {
        const subMap = maps.find(
          m => m.event_id === config.event_id && m.sub_event_id === subConfig.sub_event_id
        );
        if (!subMap) {
          return {
            tab: 'seatmap',
            message: `${subName}: create a seat map on Seat Maps for this concert sub-event`,
          };
        }
        if (seatCountOnMap(subMap) === 0) {
          return {
            tab: 'seatmap',
            message: `${subName}: paint at least one seat on its seat map`,
          };
        }
      }
    }

    const keptIds = new Set(config.categories.map(c => c.category_id));
    const eventMaps = maps.filter(m => m.event_id === config.event_id);

    const orphanedMain = eventMaps
      .filter(map => !map.sub_event_id)
      .flatMap(map => map.sections)
      .filter(s => !keptIds.has(s.category_id));
    if (orphanedMain.length > 0) {
      return {
        tab: 'seatmap',
        message: `${orphanedMain.length} whole-event seat(s) use a removed category — repaint on Seat Maps`,
      };
    }

    for (const subConfig of config.sub_event_configs) {
      const keptSubIds = new Set(subConfig.enabled_category_ids ?? []);
      const orphanedSub = eventMaps
        .filter(map => map.sub_event_id === subConfig.sub_event_id)
        .flatMap(map => map.sections)
        .filter(s => !keptSubIds.has(s.category_id));
      if (orphanedSub.length > 0) {
        const subName =
          subEvents.find(se => se.sub_event_id === subConfig.sub_event_id)?.sub_event_name ?? 'Sub-event';
        return {
          tab: 'seatmap',
          message: `${subName}: ${orphanedSub.length} seat(s) use a removed category — fix on Seat Maps`,
        };
      }
    }

    const hasEntireEventTiers = config.categories.some(c => c.entire_event_enabled !== false);
    if (hasEntireEventTiers) {
      const mainMap = eventMaps.find(m => !m.sub_event_id);
      if (mainMap && seatCountOnMap(mainMap) === 0) {
        return { tab: 'seatmap', message: 'Whole-event seat map has no seats — paint the grid on Seat Maps' };
      }
    }

    return null;
  };

  const syncSubEventCategoryPrices = (
    configs: SubEventTicketingConfig[],
    categories: SeatCategory[]
  ): SubEventTicketingConfig[] => {
    const entireEventIds = categories.filter(c => c.entire_event_enabled).map(c => c.category_id);
    return configs.map(cfg => {
      const enabled = new Set([...(cfg.enabled_category_ids ?? []), ...entireEventIds]);
      const category_prices = [...(cfg.category_prices ?? [])];
      for (const id of enabled) {
        if (!category_prices.some(row => row.category_id === id)) {
          category_prices.push({ category_id: id, adult_price: 0, child_price: 0 });
        }
      }
      return {
        ...cfg,
        enabled_category_ids: [...enabled].filter(id => categories.some(c => c.category_id === id)),
        category_prices: category_prices.filter(row => enabled.has(row.category_id)),
      };
    });
  };

  const setEntireEventCategoryEnabled = (categoryId: string, enabled: boolean) => {
    setConfig(c => {
      if (!c) return c;
      const categories = c.categories.map(cat =>
        cat.category_id === categoryId ? { ...cat, entire_event_enabled: enabled } : cat
      );
      let sub_event_configs = c.sub_event_configs.map(cfg => {
        const ids = new Set(cfg.enabled_category_ids ?? []);
        const category_prices = [...(cfg.category_prices ?? [])];
        if (enabled) {
          ids.add(categoryId);
          if (!category_prices.some(row => row.category_id === categoryId)) {
            category_prices.push({ category_id: categoryId, adult_price: 0, child_price: 0 });
          }
        }
        return { ...cfg, enabled_category_ids: [...ids], category_prices };
      });
      sub_event_configs = syncSubEventCategoryPrices(sub_event_configs, categories);
      return { ...c, categories, sub_event_configs };
    });
  };

  const setSubEventCategoryEnabled = (subEventId: string, categoryId: string, enabled: boolean) => {
    const category = config?.categories.find(c => c.category_id === categoryId);
    if (category?.entire_event_enabled && !enabled) return;
    setConfig(c => {
      if (!c) return c;
      return {
        ...c,
        sub_event_configs: c.sub_event_configs.map(cfg => {
          if (cfg.sub_event_id !== subEventId) return cfg;
          const ids = new Set(cfg.enabled_category_ids ?? []);
          const category_prices = [...(cfg.category_prices ?? [])];
          if (enabled) {
            ids.add(categoryId);
            if (!category_prices.some(row => row.category_id === categoryId)) {
              category_prices.push({ category_id: categoryId, adult_price: 0, child_price: 0 });
            }
          } else {
            ids.delete(categoryId);
            return {
              ...cfg,
              enabled_category_ids: [...ids],
              category_prices: category_prices.filter(row => row.category_id !== categoryId),
            };
          }
          return { ...cfg, enabled_category_ids: [...ids], category_prices };
        }),
      };
    });
  };

  const setSubEventCategoryPrice = (
    subEventId: string,
    categoryId: string,
    patch: Partial<{ adult_price: number; child_price: number }>
  ) => {
    setConfig(c => {
      if (!c) return c;
      return {
        ...c,
        sub_event_configs: c.sub_event_configs.map(cfg => {
          if (cfg.sub_event_id !== subEventId) return cfg;
          const category_prices = [...(cfg.category_prices ?? [])];
          const index = category_prices.findIndex(row => row.category_id === categoryId);
          if (index === -1) {
            category_prices.push({
              category_id: categoryId,
              adult_price: patch.adult_price ?? 0,
              child_price: patch.child_price ?? 0,
            });
          } else {
            category_prices[index] = { ...category_prices[index], ...patch };
          }
          return { ...cfg, category_prices };
        }),
      };
    });
  };

  const removeCategory = (index: number) => {
    setConfig(c => {
      if (!c) return c;
      const removedId = c.categories[index]?.category_id;
      if (!removedId) return c;
      return {
        ...c,
        categories: c.categories.filter((_, xi) => xi !== index),
        sub_event_configs: c.sub_event_configs.map(cfg => ({
          ...cfg,
          enabled_category_ids: (cfg.enabled_category_ids ?? []).filter(id => id !== removedId),
          category_prices: (cfg.category_prices ?? []).filter(row => row.category_id !== removedId),
        })),
      };
    });
  };

  const saveSetup = async () => {
    if (!config) return;
    const validationError = validateFullSetup();
    if (validationError) {
      toast.error(validationError.message);
      setTab(validationError.tab);
      return;
    }

    setSaving(true);
    try {
      const saved = await ticketingAPI.updateProfile({
        event_id: config.event_id ?? '',
        hold_minutes: config.hold_minutes,
        payment_window_hours: config.payment_window_hours,
        booking_note: config.booking_note ?? '',
        child_age_range: config.child_age_range,
        meal_days: config.meal_days,
        sub_event_configs: config.sub_event_configs,
        categories: config.categories,
      });
      setConfig(normalizeProfile(syncSubEventConfigs(saved, subEvents)));
      if (config.event_id) {
        persistDraftEventId(config.event_id);
        setDraftEventId(config.event_id);
        try {
          const setup = await ticketSetupsAPI.save(config.event_id);
          setActiveSetup(setup);
        } catch (error: any) {
          toast.error(error?.response?.data?.error || 'Setup saved but snapshot failed');
        }
        try {
          const loadedMaps = await ticketingAPI.listMaps();
          setMaps(loadedMaps.filter(m => m.event_id === config.event_id));
        } catch {
          /* ignore */
        }
      }
      toast.success('Setup saved as draft');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const archiveActiveSetup = async () => {
    if (!activeSetup) return void toast.error('No active setup to archive for this event');
    if (!window.confirm(`Archive "${activeSetup.label}"? You can start a new setup after archiving.`)) return;
    setSaving(true);
    try {
      await ticketSetupsAPI.archive(activeSetup.setup_id);
      resetToEmptySetup();
      toast.success('Setup archived');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to archive setup');
    } finally {
      setSaving(false);
    }
  };

  const syncProfileForMapOps = async (): Promise<boolean> => {
    if (!config?.event_id) {
      toast.error('Select an event on Entire Event Tickets first');
      setTab('entire_event');
      return false;
    }
    const categoryErr = getCategoryError(config.categories, 'Entire Event Tickets');
    if (categoryErr) {
      toast.error(categoryErr);
      setTab('entire_event');
      return false;
    }
    try {
      const saved = await ticketingAPI.updateProfile({
        event_id: config.event_id,
        hold_minutes: config.hold_minutes,
        payment_window_hours: config.payment_window_hours,
        booking_note: config.booking_note ?? '',
        child_age_range: config.child_age_range,
        meal_days: config.meal_days,
        sub_event_configs: config.sub_event_configs,
        categories: config.categories,
      });
      setConfig(normalizeProfile(syncSubEventConfigs(saved, subEvents)));
      return true;
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to sync categories for seat maps');
      return false;
    }
  };

  const saveLayout = async (payload: MatrixLayoutPayload) => {
    const selectedMap = maps.find(map => map.map_id === selectedMapId);
    if (!selectedMap) return;
    const activeBookings = bookings.filter(b => b.status !== 'cancelled');
    if (activeBookings.length > 0) {
      const ok = window.confirm(
        `${activeBookings.length} booking(s) exist. Booked seats are kept, but re-check the map after saving. Continue?`
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      if (!(await syncProfileForMapOps())) return;
      const saved = await ticketingAPI.updateMap(selectedMap.map_id, payload);
      setMaps(prev => prev.map(map => map.map_id === saved.map_id ? saved : map));
      const parsed = seatsFromConfig(saved);
      setGridSeats(parsed.seats);
      setBlockedSids(parsed.blockedSids);
      if (saved.matrix) setMatrixDims(saved.matrix);
      toast.success('Seat layout saved');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  const selectMap = (map: SeatMap) => {
    setSelectedMapId(map.map_id);
    const parsed = seatsFromConfig(map);
    setGridSeats(parsed.seats);
    setBlockedSids(parsed.blockedSids);
    setMatrixDims(map.matrix);
  };

  const createMap = async (subEventId?: string) => {
    const eventId = config?.event_id;
    if (!eventId) return void toast.error('Select an event on Entire Event Tickets first');
    const subEvent = subEvents.find(se => se.sub_event_id === subEventId);
    const mapCategories = subEventId
      ? categoriesForSubEvent(config!, subEventId)
      : categoriesForEntireEvent(config!);
    if (mapCategories.length === 0) {
      if (subEventId) {
        toast.error('Enable at least one seat category for this concert on Sub Event Tickets');
        setTab('sub_events');
      } else if ((config?.categories.length ?? 0) > 0) {
        toast.error('Check "Entire event" on at least one category on Entire Event Tickets');
        setTab('entire_event');
      } else {
        toast.error('Add at least one seat category on Entire Event Tickets');
        setTab('entire_event');
      }
      return;
    }
    let theaterId: string | undefined;
    if (layoutSource.startsWith('tm:')) {
      theaterId = layoutSource.slice(3);
    }
    if (theaterId && !theaterMaps.some(map => map.theater_map_id === theaterId)) {
      return void toast.error('Selected theater map not found');
    }
    setSaving(true);
    try {
      if (!(await syncProfileForMapOps())) return;
      const created = await ticketingAPI.createMap({
        event_id: eventId,
        sub_event_id: subEventId,
        name: subEvent?.sub_event_name ?? 'Whole event',
        is_open: false,
        ...(theaterId ? { theater_map_id: theaterId } : {
          matrix: { rows: 15, cols: 24 },
          sections: [],
          seat_positions: {},
          blocked_seats: [],
        }),
      });
      setMaps(prev => [...prev, created]);
      selectMap(created);
      toast.success(theaterId ? 'Seat map created from theater map' : 'Seat map created');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to create map');
    } finally {
      setSaving(false);
    }
  };

  const toggleMapOpen = async (map: SeatMap) => {
    try {
      const saved = await ticketingAPI.updateMap(map.map_id, { is_open: !map.is_open });
      setMaps(prev => prev.map(item => item.map_id === saved.map_id ? saved : item));
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update map');
    }
  };

  const deleteMap = async (map: SeatMap) => {
    if (!window.confirm(`Delete seat map "${map.name}"?`)) return;
    try {
      await ticketingAPI.deleteMap(map.map_id);
      const remaining = maps.filter(item => item.map_id !== map.map_id);
      setMaps(remaining);
      setSelectedMapId(remaining[0]?.map_id ?? '');
      if (remaining[0]) selectMap(remaining[0]);
      toast.success('Seat map deleted');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to delete map');
    }
  };

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        {loadFailed ? (
          <>
            <p className="text-gray-600">Could not load booking configuration.</p>
            <button
              type="button"
              onClick={() => loadAll()}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700"
            >
              Retry
            </button>
          </>
        ) : (
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Ticket Settings</h1>
        <a
          href="/book-your-seat"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          View public page <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(
          [
            ['new_setup', 'New Ticket Setup'],
            ['event_tickets', 'Event Tickets'],
            ['theater_maps', 'Saved Theater Maps'],
          ] as [TopTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTopTab(key)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              topTab === key ? 'bg-primary-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {topTab === 'event_tickets' && <AdminEventTickets />}
      {topTab === 'theater_maps' && <AdminTheaterMaps />}

      {topTab === 'new_setup' && (
        <>
      {!draftEventId && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          No setup is loaded yet. Choose an event, configure the tabs below, then save as draft to keep your work.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto" role="tablist" aria-label="Ticket setup sections">
            {(
              [
                ['entire_event', 'Entire Event Tickets'],
                ['meals', 'Daily Lunch & Dinner Pricing'],
                ...(subEvents.length > 0 ? [['sub_events', 'Sub Event Tickets'] as const] : []),
                ['seatmap', 'Seat Maps'],
                ['discounts', 'Discounts'],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                id={`ticket-tab-${key}`}
                aria-controls={`ticket-panel-${key}`}
                onClick={() => setTab(key)}
                className={`px-4 sm:px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  tab === key
                    ? 'border-primary-600 text-primary-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {tab === 'entire_event' && (
            <div id="ticket-panel-entire_event" role="tabpanel" aria-labelledby="ticket-tab-entire_event" className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event this booking is for <span className="text-red-500">*</span>
                </label>
                <div>
                  <select
                    className={inputCls}
                    value={config.event_id ?? ''}
                    onChange={e => onEventChange(e.target.value)}
                  >
                    <option value="">Select an event…</option>
                    {events
                      .filter(
                        e =>
                          e.event_id === config.event_id ||
                          !isPast(e.event_end_dt || e.event_start_dt)
                      )
                      .map(e => (
                        <option key={e.event_id} value={e.event_id}>
                          {e.event_name}
                          {e.year ? ` (${e.year})` : ''}
                          {isPast(e.event_end_dt || e.event_start_dt) ? ' — past' : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Configure main-event pricing, daily meals, and sub-event ticketing using the tabs above. Concert sub-events use the Seat Maps tab.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hold time (minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    className={inputCls}
                    value={config.hold_minutes}
                    onChange={e => set('hold_minutes', parseInt(e.target.value, 10) || 10)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment window (hours)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={336}
                    className={inputCls}
                    value={config.payment_window_hours ?? 48}
                    onChange={e => set('payment_window_hours', parseInt(e.target.value, 10) || 48)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note on booking page (optional)
                  </label>
                  <input
                    className={inputCls}
                    value={config.booking_note ?? ''}
                    onChange={e => set('booking_note', e.target.value)}
                    placeholder="e.g. Doors open at 5pm"
                  />
                </div>
              </div>

            <div className="space-y-5">
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Child age range</label>
                <p className="text-xs text-gray-500 mb-3">Used for child pricing on tickets, meals, and food add-ons.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">Min age</span>
                    <input
                      type="number"
                      min={0}
                      max={17}
                      className={`${inputCls} w-24`}
                      value={config.child_age_range?.min_age ?? 0}
                      onChange={e =>
                        set('child_age_range', {
                          min_age: parseInt(e.target.value, 10) || 0,
                          max_age: config.child_age_range?.max_age ?? 12,
                        })
                      }
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">Max age</span>
                    <input
                      type="number"
                      min={0}
                      max={17}
                      className={`${inputCls} w-24`}
                      value={config.child_age_range?.max_age ?? 12}
                      onChange={e =>
                        set('child_age_range', {
                          min_age: config.child_age_range?.min_age ?? 0,
                          max_age: parseInt(e.target.value, 10) || 12,
                        })
                      }
                    />
                  </div>
                  <p className="text-sm text-gray-600 self-end pb-2">
                    Child = ages {config.child_age_range?.min_age ?? 0}–{config.child_age_range?.max_age ?? 12}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Seat categories</label>
                    <p className="text-xs text-gray-500">
                      Define all tiers here. Check <strong>Entire event</strong> for pass tiers and set <strong>pass</strong> Adult/Child prices
                      (covers all programs + meals). Per-concert seat prices are set on the Sub Event Tickets tab.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => set('categories', [...config.categories, newCategory(config.categories.length)])}
                    className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" /> Add Category
                  </button>
                </div>
                <div className="space-y-2">
                  {config.categories.map((c, i) => (
                    <div key={c.category_id} className="flex flex-wrap items-center gap-2 border border-gray-200 rounded-lg p-2">
                      <label className="inline-flex items-center gap-1.5 shrink-0" title="Include on entire-event pass">
                        <input
                          type="checkbox"
                          checked={Boolean(c.entire_event_enabled)}
                          onChange={e => setEntireEventCategoryEnabled(c.category_id, e.target.checked)}
                        />
                        <span className="text-xs text-gray-600 whitespace-nowrap">Entire event</span>
                      </label>
                      <input
                        type="color"
                        value={c.color}
                        onChange={e =>
                          set('categories', config.categories.map((x, xi) => (xi === i ? { ...x, color: e.target.value } : x)))
                        }
                        className="w-10 h-10 rounded cursor-pointer border border-gray-200"
                        title="Category color on the seat map"
                      />
                      <input
                        className={`${inputCls} min-w-[8rem] flex-1`}
                        placeholder="Name (e.g. VIP)"
                        value={c.name}
                        onChange={e =>
                          set('categories', config.categories.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))
                        }
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">Adult $</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className={`${inputCls} w-24`}
                          value={categoryAdultPrice(c)}
                          onChange={e => {
                            const adult = parseFloat(e.target.value) || 0;
                            set('categories', config.categories.map((x, xi) =>
                              xi === i ? { ...x, adult_price: adult, price: adult } : x
                            ));
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">Child $</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className={`${inputCls} w-24`}
                          value={categoryChildPrice(c)}
                          onChange={e =>
                            set('categories', config.categories.map((x, xi) =>
                              xi === i ? { ...x, child_price: parseFloat(e.target.value) || 0 } : x
                            ))
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCategory(i)}
                        className="text-red-500 hover:text-red-700 p-1"
                        aria-label={`Remove category ${c.name}`}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  {config.categories.length === 0 && (
                    <p className="text-sm text-gray-500">Add categories like VIP, Platinum, Standard.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <p className="text-sm text-gray-600">
                The seat layout (rows, passages, seat categories, blocked seats) is designed visually
                on the{' '}
                <button
                  type="button"
                  onClick={() => setTab('seatmap')}
                  className="text-primary-600 hover:text-primary-700 underline font-medium"
                >
                  Seat Maps tab
                </button>
                . Define your categories above first, then paint the grid there.
              </p>
            </div>
            </div>
          )}

          {tab === 'meals' && (
            <div id="ticket-panel-meals" role="tabpanel" aria-labelledby="ticket-tab-meals" className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Daily lunch &amp; dinner pricing</label>
                  <p className="text-xs text-gray-500">Main-event meal prices by day (not tied to seat booking).</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const day: MealDayPricing = {
                      day_id: `DAY-${Date.now()}`,
                      label: '',
                      lunch_adult_price: 0,
                      lunch_child_price: 0,
                      dinner_adult_price: 0,
                      dinner_child_price: 0,
                    };
                    set('meal_days', [...(config.meal_days ?? []), day]);
                  }}
                  className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" /> Add day
                </button>
              </div>
              <div className="space-y-3">
                {(config.meal_days ?? []).map((day, i) => (
                  <div key={day.day_id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        className={`${inputCls} flex-1 min-w-[10rem]`}
                        placeholder="Day label (e.g. Panchami)"
                        value={day.label}
                        onChange={e =>
                          set('meal_days', config.meal_days.map((d, di) => (di === i ? { ...d, label: e.target.value } : d)))
                        }
                      />
                      <input
                        type="date"
                        className={`${inputCls} w-auto`}
                        value={day.date ?? ''}
                        onChange={e =>
                          set('meal_days', config.meal_days.map((d, di) => (di === i ? { ...d, date: e.target.value } : d)))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => set('meal_days', config.meal_days.filter((_, di) => di !== i))}
                        className="text-red-500 p-1"
                        aria-label="Remove meal day"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                      {(['lunch', 'dinner'] as const).map(meal => (
                        <div key={meal} className="bg-gray-50 rounded-lg p-2">
                          <p className="font-medium text-gray-800 capitalize mb-1">{meal}</p>
                          <div className="flex gap-2">
                            <label className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Adult $</span>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                className={`${inputCls} w-20`}
                                value={day[`${meal}_adult_price`]}
                                onChange={e =>
                                  set('meal_days', config.meal_days.map((d, di) =>
                                    di === i ? { ...d, [`${meal}_adult_price`]: parseFloat(e.target.value) || 0 } : d
                                  ))
                                }
                              />
                            </label>
                            <label className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Child $</span>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                className={`${inputCls} w-20`}
                                value={day[`${meal}_child_price`]}
                                onChange={e =>
                                  set('meal_days', config.meal_days.map((d, di) =>
                                    di === i ? { ...d, [`${meal}_child_price`]: parseFloat(e.target.value) || 0 } : d
                                  ))
                                }
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {(config.meal_days ?? []).length === 0 && (
                  <p className="text-sm text-gray-500">Optional — add each Puja day with lunch and dinner prices.</p>
                )}
              </div>
            </div>
          )}

          {tab === 'sub_events' && subEvents.length > 0 && (
            <div id="ticket-panel-sub_events" role="tabpanel" aria-labelledby="ticket-tab-sub_events" className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sub-event ticketing</label>
                  <p className="text-xs text-gray-500">
                    Set type to <strong>Concert</strong> to enable a seat map. Add food add-ons for checkout on any sub-event.
                  </p>
                </div>
                {config.sub_event_configs.map((subConfig, configIndex) => {
                const subEvent = subEvents.find(se => se.sub_event_id === subConfig.sub_event_id);
                if (!subEvent) return null;
                return (
                  <div key={subConfig.sub_event_id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-gray-900">{subEvent.sub_event_name}</h3>
                      <select
                        className={`${inputCls} w-auto`}
                        value={subConfig.ticketing_type}
                        onChange={e =>
                          set('sub_event_configs', updateSubEventConfig(config.sub_event_configs, subConfig.sub_event_id, {
                            ticketing_type: e.target.value as SubEventTicketingConfig['ticketing_type'],
                          }))
                        }
                      >
                        <option value="general">General (no seat map)</option>
                        <option value="concert">Concert (seat map on Seat Maps tab)</option>
                      </select>
                    </div>

                    {subConfig.ticketing_type === 'concert' && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Seat categories for this sub-event</p>
                        <p className="text-xs text-gray-500 mb-3">
                          Categories are defined under Entire Event Tickets. Choose which tiers apply to this sub-event&apos;s seat map.
                          Entire-event tiers are required on every sub-event. Set <strong>per-seat</strong> Adult/Child prices here
                          (separate from entire-event pass prices on the Entire Event tab).
                        </p>
                        {config.categories.length === 0 ? (
                          <p className="text-xs text-gray-500">Add categories on the Entire Event Tickets tab first.</p>
                        ) : (
                          <div className="space-y-2">
                            {config.categories.map(cat => {
                              const enabled = (subConfig.enabled_category_ids ?? []).includes(cat.category_id);
                              const required = Boolean(cat.entire_event_enabled);
                              const pricing = subEventCategoryPrice(subConfig, cat.category_id);
                              return (
                                <div
                                  key={cat.category_id}
                                  className="flex flex-wrap items-center gap-2 border border-gray-200 rounded-lg p-2"
                                >
                                  <label className="inline-flex items-center gap-1.5 shrink-0" title="Apply this category to this sub-event">
                                    <input
                                      type="checkbox"
                                      checked={enabled}
                                      disabled={required}
                                      onChange={e =>
                                        setSubEventCategoryEnabled(subConfig.sub_event_id, cat.category_id, e.target.checked)
                                      }
                                    />
                                    <span className="text-xs text-gray-600 whitespace-nowrap">Apply</span>
                                  </label>
                                  <input
                                    type="color"
                                    value={cat.color}
                                    disabled
                                    className="w-10 h-10 rounded border border-gray-200 opacity-80 cursor-not-allowed"
                                    title="Category color (edit on Entire Event tab)"
                                  />
                                  <span className={`${inputCls} min-w-[8rem] flex-1 bg-gray-50 text-gray-800`}>
                                    {cat.name || 'Unnamed category'}
                                    {required ? ' · entire event' : ''}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500">Adult $</span>
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      disabled={!enabled}
                                      className={`${inputCls} w-24 disabled:bg-gray-100 disabled:text-gray-500`}
                                      value={pricing?.adult_price ?? 0}
                                      onChange={e =>
                                        setSubEventCategoryPrice(subConfig.sub_event_id, cat.category_id, {
                                          adult_price: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500">Child $</span>
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      disabled={!enabled}
                                      className={`${inputCls} w-24 disabled:bg-gray-100 disabled:text-gray-500`}
                                      value={pricing?.child_price ?? 0}
                                      onChange={e =>
                                        setSubEventCategoryPrice(subConfig.sub_event_id, cat.category_id, {
                                          child_price: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-700">Food add-ons (checkout)</p>
                        <button
                          type="button"
                          onClick={() => {
                            const addon: FoodAddon = {
                              addon_id: `FOOD-${Date.now()}`,
                              name: '',
                              adult_price: 0,
                              child_price: 0,
                            };
                            set('sub_event_configs', updateSubEventConfig(config.sub_event_configs, subConfig.sub_event_id, {
                              food_addons: [...subConfig.food_addons, addon],
                            }));
                          }}
                          className="text-sm text-primary-600 font-medium"
                        >
                          + Add food item
                        </button>
                      </div>
                      <div className="space-y-2">
                        {subConfig.food_addons.map((addon, ai) => {
                          const slots = mealSlotOptions(config.meal_days ?? []);
                          const slotValue = foodAddonSlotValue(addon, config.meal_days ?? []);
                          return (
                          <div key={addon.addon_id} className="flex flex-wrap items-center gap-2 border border-gray-100 rounded-lg p-2">
                            <select
                              className={`${inputCls} flex-1 min-w-[10rem]`}
                              value={slotValue}
                              onChange={e => {
                                const picked = slots.find(slot => slot.value === e.target.value);
                                set('sub_event_configs', config.sub_event_configs.map((cfg, idx) =>
                                  idx === configIndex
                                    ? {
                                        ...cfg,
                                        food_addons: cfg.food_addons.map((x, xi) =>
                                          xi === ai
                                            ? picked
                                              ? {
                                                  ...x,
                                                  name: picked.label,
                                                  meal_day_id: picked.meal_day_id,
                                                  meal_type: picked.meal_type,
                                                  adult_price: picked.adult_price,
                                                  child_price: picked.child_price,
                                                }
                                              : { ...x, meal_day_id: undefined, meal_type: undefined }
                                            : x
                                        ),
                                      }
                                    : cfg
                                ));
                              }}
                            >
                              <option value="">Select meal…</option>
                              {slots.map(slot => (
                                <option key={slot.value} value={slot.value}>{slot.label}</option>
                              ))}
                            </select>
                            <input className={`${inputCls} w-32`} placeholder="Description (optional)" value={addon.description ?? ''}
                              onChange={e =>
                                set('sub_event_configs', config.sub_event_configs.map((cfg, idx) =>
                                  idx === configIndex
                                    ? { ...cfg, food_addons: cfg.food_addons.map((x, xi) => xi === ai ? { ...x, description: e.target.value } : x) }
                                    : cfg
                                ))
                              }
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Adult $</span>
                              <input type="number" min={0} step="0.01" className={`${inputCls} w-24`}
                                value={addon.adult_price}
                                onChange={e =>
                                  set('sub_event_configs', config.sub_event_configs.map((cfg, idx) =>
                                    idx === configIndex
                                      ? { ...cfg, food_addons: cfg.food_addons.map((x, xi) => xi === ai ? { ...x, adult_price: parseFloat(e.target.value) || 0 } : x) }
                                      : cfg
                                  ))
                                }
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Child $</span>
                              <input type="number" min={0} step="0.01" className={`${inputCls} w-24`}
                                value={addon.child_price}
                                onChange={e =>
                                  set('sub_event_configs', config.sub_event_configs.map((cfg, idx) =>
                                    idx === configIndex
                                      ? { ...cfg, food_addons: cfg.food_addons.map((x, xi) => xi === ai ? { ...x, child_price: parseFloat(e.target.value) || 0 } : x) }
                                      : cfg
                                  ))
                                }
                              />
                            </div>
                            <button type="button" className="text-red-500"
                              onClick={() =>
                                set('sub_event_configs', updateSubEventConfig(config.sub_event_configs, subConfig.sub_event_id, {
                                  food_addons: subConfig.food_addons.filter((_, xi) => xi !== ai),
                                }))
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          );
                        })}
                        {subConfig.food_addons.length === 0 && (
                          <p className="text-xs text-gray-500">Optional — e.g. dinner plate, snack box.</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'seatmap' && (
            <div id="ticket-panel-seatmap" role="tabpanel" aria-labelledby="ticket-tab-seatmap" className="overflow-x-auto space-y-5">
          {!canDesignSeatMaps ? (
            <p className="text-sm text-gray-600">
              {(config.categories.length ?? 0) > 0 ? (
                <>
                  Categories exist but none are ready for seat maps yet. Check{' '}
                  <strong>Entire event</strong> on at least one category here, or enable categories for a
                  concert on the{' '}
                  <button
                    type="button"
                    onClick={() => setTab('sub_events')}
                    className="text-primary-600 hover:text-primary-700 underline font-medium"
                  >
                    Sub Event Tickets
                  </button>{' '}
                  tab.
                </>
              ) : (
                <>
                  Add at least one seat category on the{' '}
                  <button
                    type="button"
                    onClick={() => setTab('entire_event')}
                    className="text-primary-600 hover:text-primary-700 underline font-medium"
                  >
                    Entire Event Tickets
                  </button>{' '}
                  tab first — then design the seat grid here.
                </>
              )}
            </p>
          ) : activeCategories.length === 0 && selectedMapId ? (
            <p className="text-sm text-gray-600">
              This map has no usable categories yet. For a whole-event map, check{' '}
              <strong>Entire event</strong> on categories. For a concert map, enable categories on{' '}
              <button
                type="button"
                onClick={() => setTab('sub_events')}
                className="text-primary-600 hover:text-primary-700 underline font-medium"
              >
                Sub Event Tickets
              </button>
              .
            </p>
          ) : (
            <>
              {theaterMaps.length > 0 && (
                <p className="text-sm text-gray-600">
                  Reusable layouts live on{' '}
                  <button
                    type="button"
                    onClick={() => setTopTab('theater_maps')}
                    className="text-primary-600 hover:text-primary-700 underline font-medium"
                  >
                    Saved Theater Maps
                  </button>
                  . Pick one below when creating a new seat map.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {maps.filter(map => map.event_id === config.event_id).map(map => (
                  <div
                    key={map.map_id}
                    className={`flex items-center gap-2 border rounded-lg p-2 ${
                      selectedMapId === map.map_id ? 'border-primary-600 bg-primary-50' : 'border-gray-200'
                    }`}
                  >
                    <button type="button" onClick={() => selectMap(map)} className="font-medium text-sm">
                      {map.name}
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={map.is_open}
                      onClick={() => toggleMapOpen(map)}
                      className={`text-xs px-2 py-1 rounded ${map.is_open ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {map.is_open ? 'Open' : 'Closed'}
                    </button>
                    <button type="button" onClick={() => deleteMap(map)} className="text-red-500" aria-label={`Delete ${map.name}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <select
                  className={`${inputCls} w-auto`}
                  value={layoutSource}
                  onChange={e => setLayoutSource(e.target.value)}
                  aria-label="Layout source for new map"
                >
                  <option value="blank">New blank map</option>
                  {theaterMaps.map(tm => (
                    <option key={tm.theater_map_id} value={`tm:${tm.theater_map_id}`}>
                      From theater map: {tm.name}
                    </option>
                  ))}
                </select>
                {subEvents.length > 0 ? (
                  <select
                    className={`${inputCls} w-auto`}
                    value=""
                    onChange={e => {
                      if (e.target.value) createMap(e.target.value);
                    }}
                  >
                    <option value="">Add map for concert sub-event…</option>
                    {concertSubEvents
                      .filter(se => !maps.some(map => map.sub_event_id === se.sub_event_id))
                      .map(se => <option key={se.sub_event_id} value={se.sub_event_id}>{se.sub_event_name}</option>)}
                  </select>
                ) : maps.every(map => map.event_id !== config.event_id) ? (
                  <button type="button" onClick={() => createMap()} className="inline-flex items-center gap-1 text-primary-600 font-medium text-sm">
                    <Plus className="w-4 h-4" /> Add whole-event map
                  </button>
                ) : null}
              </div>
              {selectedMapId ? (
                <SeatGridDesigner
                  mapId={selectedMapId}
                  categories={activeCategories}
                  seats={gridSeats}
                  setSeats={setGridSeats}
                  blockedSids={blockedSids}
                  setBlockedSids={setBlockedSids}
                  dims={matrixDims}
                  setDims={setMatrixDims}
                  unavailable={unavailable}
                  bookedBy={bookedBy}
                  saving={saving}
                  onSave={saveLayout}
                  onRefresh={refreshMapContext}
                />
              ) : (
                <p className="text-sm text-gray-500">Create or select a map to design its seats.</p>
              )}
            </>
          )}
            </div>
          )}

          {tab === 'discounts' && (
            <div id="ticket-panel-discounts" role="tabpanel" aria-labelledby="ticket-tab-discounts">
              <DiscountsTab discounts={discounts} onChange={setDiscounts} embedded />
            </div>
          )}

          {tab !== 'discounts' && (
            <div className="pt-6 mt-6 border-t border-gray-200 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={saveSetup}
                disabled={saving}
                className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Setup as Draft'}
              </button>
              {draftEventId && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Start a new setup? Unsaved changes in this session will be cleared from the editor.'
                      )
                    ) {
                      resetToEmptySetup();
                    }
                  }}
                  disabled={saving}
                  className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Start new setup
                </button>
              )}
              {activeSetup && (
                <button
                  type="button"
                  onClick={() => void archiveActiveSetup()}
                  disabled={saving}
                  className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Archive this setup
                </button>
              )}
              <p className="text-xs text-gray-500 w-full sm:w-auto sm:ml-auto">
                Validates all tabs before saving as draft. Your draft reloads on the next visit after you save.
              </p>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}

function DiscountsTab({
  discounts,
  onChange,
  embedded = false,
}: {
  discounts: DiscountCode[];
  onChange: (d: DiscountCode[]) => void;
  embedded?: boolean;
}) {
  const [form, setForm] = useState({
    code: '',
    type: 'percent' as 'percent' | 'fixed',
    value: '',
    min_seats: '',
    max_uses: '',
    valid_from: '',
    valid_until: '',
  });
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    try {
      const created = await ticketingAPI.createDiscount({
        code: form.code,
        type: form.type,
        value: parseFloat(form.value),
        min_seats: form.min_seats ? parseInt(form.min_seats, 10) : undefined,
        max_uses: form.max_uses ? parseInt(form.max_uses, 10) : undefined,
        valid_from: form.valid_from || undefined,
        valid_until: form.valid_until || undefined,
        is_active: true,
      });
      onChange([...discounts, created]);
      setForm({ code: '', type: 'percent', value: '', min_seats: '', max_uses: '', valid_from: '', valid_until: '' });
      toast.success(`Discount ${created.code} created`);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to create discount');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (d: DiscountCode) => {
    try {
      const updated = await ticketingAPI.updateDiscount(d.discount_id, { is_active: !d.is_active });
      onChange(discounts.map(x => (x.discount_id === d.discount_id ? updated : x)));
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update discount');
    }
  };

  const remove = async (d: DiscountCode) => {
    if (!window.confirm(`Delete discount code ${d.code}?`)) return;
    try {
      await ticketingAPI.deleteDiscount(d.discount_id);
      onChange(discounts.filter(x => x.discount_id !== d.discount_id));
      toast.success('Discount deleted');
    } catch {
      toast.error('Failed to delete discount');
    }
  };

  const sectionCls = embedded
    ? 'border border-gray-200 rounded-lg p-6'
    : 'bg-white rounded-xl shadow p-6';

  return (
    <div className="space-y-6">
      <div className={sectionCls}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">New discount code</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <input
            className={`${inputCls} uppercase col-span-2`}
            placeholder="CODE (e.g. EARLYBIRD)"
            value={form.code}
            onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
          />
          <select
            className={inputCls}
            value={form.type}
            onChange={e => setForm({ ...form, type: e.target.value as 'percent' | 'fixed' })}
          >
            <option value="percent">% off</option>
            <option value="fixed">$ off</option>
          </select>
          <input
            type="number"
            min={0}
            className={inputCls}
            placeholder={form.type === 'percent' ? '% value' : '$ value'}
            value={form.value}
            onChange={e => setForm({ ...form, value: e.target.value })}
          />
          <label className="text-xs text-gray-500">
            Min seats (optional)
            <input
              type="number"
              min={1}
              className={inputCls}
              value={form.min_seats}
              onChange={e => setForm({ ...form, min_seats: e.target.value })}
            />
          </label>
          <label className="text-xs text-gray-500">
            Max uses (optional)
            <input
              type="number"
              min={1}
              className={inputCls}
              value={form.max_uses}
              onChange={e => setForm({ ...form, max_uses: e.target.value })}
            />
          </label>
          <label className="text-xs text-gray-500">
            Valid from
            <input
              type="date"
              className={inputCls}
              value={form.valid_from}
              onChange={e => setForm({ ...form, valid_from: e.target.value })}
            />
          </label>
          <label className="text-xs text-gray-500">
            Valid until
            <input
              type="date"
              className={inputCls}
              value={form.valid_until}
              onChange={e => setForm({ ...form, valid_until: e.target.value })}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={creating || !form.code.trim() || !form.value}
          onClick={create}
          className="bg-primary-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create Discount'}
        </button>
      </div>

      <div className={sectionCls}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Existing codes</h2>
        {discounts.length === 0 ? (
          <p className="text-gray-500 text-sm">No discount codes yet.</p>
        ) : (
          <div className="space-y-2">
            {discounts.map(d => (
              <div key={d.discount_id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-3 flex-wrap">
                <div>
                  <p className="font-mono font-semibold text-gray-900">
                    {d.code}
                    {!d.is_active && (
                      <span className="ml-2 text-xs font-sans font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                        inactive
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    {d.type === 'percent' ? `${d.value}% off` : `$${d.value.toFixed(2)} off`}
                    {d.min_seats ? ` · min ${d.min_seats} seats` : ''}
                    {d.max_uses !== undefined ? ` · ${d.used_count}/${d.max_uses} used` : ` · ${d.used_count} used`}
                    {d.valid_from ? ` · from ${d.valid_from}` : ''}
                    {d.valid_until ? ` · until ${d.valid_until}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(d)}
                    className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    {d.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(d)}
                    className="text-red-500 hover:text-red-700 p-1"
                    aria-label={`Delete ${d.code}`}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
