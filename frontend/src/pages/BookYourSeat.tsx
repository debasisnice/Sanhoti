import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Armchair, Calendar, CheckCircle2, Clock, MapPin, Tag, Ticket, X } from 'lucide-react';
import Seo from '../components/Seo';
import {
  ticketingAPI,
  PublicTicketingConfig,
  SeatMap,
  SeatHold,
  SeatBooking,
  DiscountPreview,
  UnavailableSeats,
  categoriesForEntireEvent,
  categoriesForSubEvent,
  subEventCategoryPrice,
  MealDayPricing,
} from '../services/api';
import { formatDateWithTime } from '../utils/dateUtils';

/**
 * Public seat booking for the active Durga Puja event.
 * Flow: pick seats on the map -> timed hold -> checkout form (+ discount)
 * -> booking created as "pending payment" with Zelle/QR instructions.
 */

function rowLabel(row: number): string {
  let label = '';
  let n = row;
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

const usd = (n: number) => `$${n.toFixed(2)}`;

const categoryAdultPrice = (c: { adult_price?: number; price?: number }) =>
  Number(c.adult_price ?? c.price ?? 0);

const categoryChildPrice = (c: { child_price?: number; adult_price?: number; price?: number }) =>
  Number(c.child_price ?? categoryAdultPrice(c));

function formatCategoryPriceLabel(
  category: { name: string; adult_price?: number; child_price?: number; price?: number },
  entireEventPass: boolean
): string {
  const adult = categoryAdultPrice(category);
  const child = categoryChildPrice(category);
  const tier = entireEventPass ? `${category.name} Pass` : category.name;
  return `${tier} · Adult ${usd(adult)} / Child ${usd(child)}`;
}

const MAX_PARTY_SIZE = 10;

type MealOption = {
  key: string;
  day_id: string;
  label: string;
  meal_type: 'lunch' | 'dinner';
  adult_price: number;
  child_price: number;
};

function mealOptionsFromDays(mealDays: MealDayPricing[] | undefined): MealOption[] {
  const out: MealOption[] = [];
  for (const day of mealDays ?? []) {
    for (const meal_type of ['lunch', 'dinner'] as const) {
      const adult_price = Number(day[`${meal_type}_adult_price`] ?? 0);
      const child_price = Number(day[`${meal_type}_child_price`] ?? 0);
      if (adult_price > 0 || child_price > 0) {
        out.push({
          key: `${day.day_id}:${meal_type}`,
          day_id: day.day_id,
          label: day.label,
          meal_type,
          adult_price,
          child_price,
        });
      }
    }
  }
  return out;
}

function findCategoryByName<T extends { name: string }>(categories: T[] | undefined, name: string): T | undefined {
  const needle = name.trim().toLowerCase();
  return categories?.find(c => c.name.trim().toLowerCase() === needle);
}

function shortSeatCode(seatKey: string, mapById: Record<string, SeatMap>): string {
  const [mapId, seatId] = seatKey.split('|');
  const [, rowStr, seatStr] = (seatId ?? '').split(':');
  const map = mapById[mapId];
  const sectionId = seatId?.split(':')[0];
  const section = map?.sections.find(s => s.section_id === sectionId);
  const seatNum = section
    ? (section.seat_number_start ?? 1) + (Number(seatStr) - 1) * (section.seat_number_step ?? 1)
    : seatStr;
  return `${rowLabel(Number(rowStr))}${seatNum}`;
}

function categoriesByIdForMap(
  map: SeatMap,
  config: PublicTicketingConfig
): Record<string, { name: string; price: number; color: string }> {
  const categories = map.sub_event_id
    ? categoriesForSubEvent(config, map.sub_event_id)
    : categoriesForEntireEvent(config);
  const out: Record<string, { name: string; price: number; color: string }> = {};
  for (const category of categories) {
    out[category.category_id] = { ...category, price: categoryAdultPrice(category) };
  }
  return out;
}

/** sessionStorage key for the buyer's active hold, so refreshes/tab-closes release it. */
const HOLD_KEY = 'sanhoti_seat_hold_id';

type Phase = 'selecting' | 'checkout' | 'confirmed';

export default function BookYourSeat() {
  const [config, setConfig] = useState<PublicTicketingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<UnavailableSeats>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [scopeSubEventId, setScopeSubEventId] = useState<string | undefined>();
  const [categoryId, setCategoryId] = useState('');
  const [adultQty, setAdultQty] = useState(1);
  const [childQty, setChildQty] = useState(0);
  const [seatAudience, setSeatAudience] = useState<Record<string, 'adult' | 'child'>>({});
  const [phase, setPhase] = useState<Phase>('selecting');
  const [hold, setHold] = useState<SeatHold | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [discountInput, setDiscountInput] = useState('');
  const [discount, setDiscount] = useState<DiscountPreview | null>(null);
  const [booking, setBooking] = useState<SeatBooking | null>(null);
  const [foodSelections, setFoodSelections] = useState<Record<string, { adult_qty: number; child_qty: number }>>({});
  const [isMealsOnlyBooking, setIsMealsOnlyBooking] = useState(false);
  const [mealSelections, setMealSelections] = useState<Record<string, { adult_qty: number; child_qty: number }>>({});
  const [payment, setPayment] = useState<{ zelle_phone?: string }>({});
  const [hasPaymentQR, setHasPaymentQR] = useState(false);
  const holdRef = useRef<SeatHold | null>(null);
  holdRef.current = hold;

  useEffect(() => {
    if (!config) return;
    const seats = Boolean(config.seat_booking_available && (config.maps?.length ?? 0) > 0);
    const meals = Boolean(config.meals_booking_available);
    if (!seats && meals) setIsMealsOnlyBooking(true);
  }, [config]);

  const seatBookingAvailable = Boolean(config?.seat_booking_available && (config?.maps?.length ?? 0) > 0);
  const mealsBookingAvailable = Boolean(config?.meals_booking_available);
  const availableMealOptions = useMemo(
    () => mealOptionsFromDays(config?.meal_days),
    [config?.meal_days]
  );

  const buildMealSelectionsPayload = useCallback(() => {
    return availableMealOptions.flatMap(opt => {
      const qty = mealSelections[opt.key] ?? { adult_qty: 0, child_qty: 0 };
      if (qty.adult_qty === 0 && qty.child_qty === 0) return [];
      return [{
        day_id: opt.day_id,
        meal_type: opt.meal_type,
        adult_qty: qty.adult_qty,
        child_qty: qty.child_qty,
      }];
    });
  }, [availableMealOptions, mealSelections]);

  const mealsSubtotal = useMemo(() => {
    return availableMealOptions.reduce((sum, opt) => {
      const qty = mealSelections[opt.key] ?? { adult_qty: 0, child_qty: 0 };
      return sum + qty.adult_qty * opt.adult_price + qty.child_qty * opt.child_price;
    }, 0);
  }, [availableMealOptions, mealSelections]);

  const mealsSelectionComplete = buildMealSelectionsPayload().length > 0;

  const updateMealSelection = (
    key: string,
    patch: Partial<{ adult_qty: number; child_qty: number }>
  ) => {
    setMealSelections(prev => {
      const current = prev[key] ?? { adult_qty: 0, child_qty: 0 };
      return {
        ...prev,
        [key]: {
          adult_qty: Math.min(adultQty, Math.max(0, patch.adult_qty ?? current.adult_qty)),
          child_qty: Math.min(childQty, Math.max(0, patch.child_qty ?? current.child_qty)),
        },
      };
    });
  };

  const refreshAvailability = useCallback(async () => {
    try {
      const { unavailable } = await ticketingAPI.getAvailability();
      setUnavailable(unavailable);
      // Drop any of our selected seats that just became unavailable
      setSelected(prev => prev.filter(s => !unavailable[s]));
    } catch {
      // transient — keep last known availability
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      // A hold left over from a refresh/closed tab in this browser session:
      // release it immediately instead of letting it run out the 10-min TTL.
      const leftover = sessionStorage.getItem(HOLD_KEY);
      if (leftover) {
        sessionStorage.removeItem(HOLD_KEY);
        await ticketingAPI.releaseHold(leftover).catch(() => undefined);
      }
      try {
        const cfg = await ticketingAPI.getConfig();
        setConfig(cfg);
        await refreshAvailability();
      } catch {
        setConfig(null);
      } finally {
        setLoading(false);
      }
    };
    load();
    fetch('/api/paymentqr/has-image')
      .then(r => r.json())
      .then(d => setHasPaymentQR(Boolean(d?.hasImage)))
      .catch(() => setHasPaymentQR(false));
  }, [refreshAvailability]);

  // Poll availability while picking seats so the map stays honest
  useEffect(() => {
    if (phase !== 'selecting') return;
    const t = setInterval(refreshAvailability, 30_000);
    return () => clearInterval(t);
  }, [phase, refreshAvailability]);

  // Hold countdown
  useEffect(() => {
    if (!hold) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(hold.expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        sessionStorage.removeItem(HOLD_KEY);
        setHold(null);
        setPhase('selecting');
        setDiscount(null);
        toast.error('Your seat hold expired — please select seats again');
        refreshAvailability();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [hold, refreshAvailability]);

  // Release an un-used hold when leaving the page (SPA navigation)
  useEffect(() => {
    return () => {
      const h = holdRef.current;
      if (h) {
        sessionStorage.removeItem(HOLD_KEY);
        ticketingAPI.releaseHold(h.hold_id).catch(() => undefined);
      }
    };
  }, []);

  // Release the hold when the tab is closed or the page is torn down —
  // sendBeacon survives page unload where a normal XHR would be dropped.
  useEffect(() => {
    const onPageHide = (e: PageTransitionEvent) => {
      if (e.persisted) return; // going to bfcache — the user may come right back
      const h = holdRef.current;
      if (h) {
        sessionStorage.removeItem(HOLD_KEY);
        navigator.sendBeacon(`/api/booking/hold/${h.hold_id}/release`);
      }
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  const visibleMaps = useMemo(
    () =>
      (config?.maps ?? []).filter(
        map => !scopeSubEventId || map.sub_event_id === scopeSubEventId
      ),
    [config, scopeSubEventId]
  );

  const activeCategories = useMemo(() => {
    if (!config) return [];
    if (scopeSubEventId) return categoriesForSubEvent(config, scopeSubEventId);
    return categoriesForEntireEvent(config);
  }, [config, scopeSubEventId]);

  /** Whole-event booking uses main-event tier names; seat maps may use different category ids per sub-event. */
  const matchSeatsByCategoryName = !scopeSubEventId && visibleMaps.some(map => map.sub_event_id);
  const selectedCategoryName = activeCategories.find(c => c.category_id === categoryId)?.name ?? '';

  const mapById = useMemo(
    () => Object.fromEntries((config?.maps ?? []).map(map => [map.map_id, map])),
    [config]
  );
  const selectedGroups = useMemo(
    () =>
      visibleMaps
        .map(map => ({
          map,
          seats: selected.filter(seatKey => seatKey.startsWith(`${map.map_id}|`)),
        }))
        .filter(group => group.seats.length > 0),
    [selected, visibleMaps]
  );

  /** Each open sub-event map must have partySize seats for entire-event booking. */
  const requiredProgramMaps = useMemo(() => {
    if (scopeSubEventId) return [];
    return visibleMaps.filter(map => map.sub_event_id);
  }, [scopeSubEventId, visibleMaps]);

  const partySize = adultQty + childQty;
  /** Entire-event pass tier selected (vs a single sub-event concert). */
  const isEntireEventPassMode = !isMealsOnlyBooking && !scopeSubEventId;
  const isEntireEventBooking = isEntireEventPassMode && requiredProgramMaps.length > 0;
  const programMapCount = isEntireEventBooking ? requiredProgramMaps.length : 1;
  const seatsPerMap = partySize;
  const totalSeatsNeeded = seatsPerMap * programMapCount;

  const seatsForMap = useCallback(
    (mapId: string) => selected.filter(seatKey => seatKey.startsWith(`${mapId}|`)),
    [selected]
  );

  const mapPartyComplete = useCallback(
    (mapId: string) => {
      const onMap = seatsForMap(mapId);
      if (onMap.length !== seatsPerMap) return false;
      const adultsOnMap = onMap.filter(s => seatAudience[s] === 'adult').length;
      const childrenOnMap = onMap.filter(s => seatAudience[s] === 'child').length;
      return adultsOnMap === adultQty && childrenOnMap === childQty;
    },
    [seatsForMap, seatsPerMap, seatAudience, adultQty, childQty]
  );

  const missingProgramMaps = useMemo(
    () =>
      requiredProgramMaps.filter(map => !mapPartyComplete(map.map_id)),
    [requiredProgramMaps, mapPartyComplete]
  );

  const entireEventProgramsComplete =
    !isEntireEventBooking || requiredProgramMaps.every(map => mapPartyComplete(map.map_id));

  const canSelectSeats = Boolean(categoryId) && partySize >= 1;
  const adultSeatsAssigned = selected.filter(s => seatAudience[s] === 'adult').length;
  const childSeatsAssigned = selected.filter(s => seatAudience[s] === 'child').length;
  const partySeatsComplete = isEntireEventBooking
    ? entireEventProgramsComplete
    : selected.length === seatsPerMap &&
      adultSeatsAssigned === adultQty &&
      childSeatsAssigned === childQty;

  const clearSeatSelection = () => {
    setSelected([]);
    setSeatAudience({});
    setDiscount(null);
  };

  const changeSelectionContext = (nextScope: string | undefined, nextCategory: string, mealsOnly = false) => {
    if (
      selected.length > 0 &&
      !window.confirm('Changing the program or category will clear your selected seats. Continue?')
    ) {
      return;
    }
    setSelected([]);
    setSeatAudience({});
    setDiscount(null);
    setFoodSelections({});
    setIsMealsOnlyBooking(mealsOnly);
    if (mealsOnly) {
      setScopeSubEventId(undefined);
      setCategoryId('');
      setMealSelections({});
      return;
    }
    setMealSelections({});
    setScopeSubEventId(nextScope);

    let resolvedCategory = nextCategory;
    if (config && nextCategory) {
      const allCategories = config.categories ?? [];
      const currentName = allCategories.find(c => c.category_id === nextCategory)?.name;
      if (currentName) {
        const nextCategories = nextScope
          ? categoriesForSubEvent(config, nextScope)
          : categoriesForEntireEvent(config);
        const match = nextCategories.find(
          c => c.name.trim().toLowerCase() === currentName.trim().toLowerCase()
        );
        resolvedCategory = match?.category_id ?? '';
      }
    }
    setCategoryId(resolvedCategory);
  };

  const changePartyQty = (nextAdults: number, nextChildren: number) => {
    let adults = Math.max(0, Math.min(MAX_PARTY_SIZE, nextAdults));
    let children = Math.max(0, Math.min(MAX_PARTY_SIZE, nextChildren));
    if (adults + children > MAX_PARTY_SIZE) {
      if (nextAdults !== adultQty) adults = Math.max(0, MAX_PARTY_SIZE - children);
      else children = Math.max(0, MAX_PARTY_SIZE - adults);
    }
    const total = adults + children;
    if (total < 1) return;
    const nextTotalSeatsNeeded = isEntireEventBooking ? total * requiredProgramMaps.length : total;
    if (
      selected.length > 0 &&
      nextTotalSeatsNeeded !== selected.length &&
      !window.confirm('Changing ticket counts will clear your selected seats. Continue?')
    ) {
      return;
    }
    if (nextTotalSeatsNeeded !== selected.length) clearSeatSelection();
    setAdultQty(adults);
    setChildQty(children);
    setFoodSelections(prev => {
      const next: Record<string, { adult_qty: number; child_qty: number }> = {};
      for (const [key, qty] of Object.entries(prev)) {
        next[key] = {
          adult_qty: Math.min(qty.adult_qty, adults),
          child_qty: Math.min(qty.child_qty, children),
        };
      }
      return next;
    });
    setMealSelections(prev => {
      const next: Record<string, { adult_qty: number; child_qty: number }> = {};
      for (const [key, qty] of Object.entries(prev)) {
        next[key] = {
          adult_qty: Math.min(qty.adult_qty, adults),
          child_qty: Math.min(qty.child_qty, children),
        };
      }
      return next;
    });
  };

  const updateFoodSelection = (
    key: string,
    patch: Partial<{ adult_qty: number; child_qty: number }>
  ) => {
    setFoodSelections(prev => {
      const current = prev[key] ?? { adult_qty: 0, child_qty: 0 };
      return {
        ...prev,
        [key]: {
          adult_qty: Math.min(
            adultQty,
            Math.max(0, patch.adult_qty ?? current.adult_qty)
          ),
          child_qty: Math.min(
            childQty,
            Math.max(0, patch.child_qty ?? current.child_qty)
          ),
        },
      };
    });
  };

  const categoryForSeat = useCallback(
    (seatKey: string) => {
      if (!config) return undefined;
      const [mapId, seatId] = seatKey.split('|');
      const sectionId = seatId?.split(':')[0];
      const map = mapById[mapId];
      const section = map?.sections.find(s => s.section_id === sectionId);
      if (!map || !section) return undefined;
      if (isEntireEventBooking && selectedCategoryName) {
        const matched = config.categories.find(
          c => c.name.trim().toLowerCase() === selectedCategoryName.trim().toLowerCase()
        );
        if (matched && map.sub_event_id) {
          const subConfig = config.sub_event_configs?.find(item => item.sub_event_id === map.sub_event_id);
          const pricing = subEventCategoryPrice(subConfig, matched.category_id);
          return {
            ...matched,
            adult_price: Number(pricing?.adult_price ?? 0),
            child_price: Number(pricing?.child_price ?? 0),
            price: Number(pricing?.adult_price ?? 0),
          };
        }
      }
      const categories = map.sub_event_id
        ? categoriesForSubEvent(config, map.sub_event_id)
        : categoriesForEntireEvent(config);
      return categories.find(c => c.category_id === section.category_id);
    },
    [mapById, config, isEntireEventBooking, selectedCategoryName]
  );

  const seatPrice = useCallback(
    (seatKey: string): number => {
      const category = categoryForSeat(seatKey);
      if (!category) return 0;
      return seatAudience[seatKey] === 'child'
        ? categoryChildPrice(category)
        : categoryAdultPrice(category);
    },
    [categoryForSeat, seatAudience]
  );

  const seatLabel = useCallback(
    (seatKey: string): string => {
      const [mapId, seatId] = seatKey.split('|');
      const [sectionId, row, seat] = (seatId ?? '').split(':');
      const map = mapById[mapId];
      const section = map?.sections.find(s => s.section_id === sectionId);
      if (!section) return seatKey;
      const displayNum =
        (section.seat_number_start ?? 1) + (Number(seat) - 1) * (section.seat_number_step ?? 1);
      const label = section.rows === 1 && section.seats_per_row === 1
        ? section.name
        : section.rows === 1
        ? `${section.name} · Seat ${displayNum}`
        : `${section.name} ${rowLabel(Number(row))}${displayNum}`;
      return `${map.name} — ${label}`;
    },
    [mapById]
  );

  const selectedSeatSubtotal = useMemo(
    () => selected.reduce((sum, s) => sum + seatPrice(s), 0),
    [selected, seatPrice]
  );

  const pricingReady = Boolean(categoryId) && partySize >= 1;
  const hasSelectedSeats = selected.length > 0;

  const mainEventCategory = useMemo(
    () => config?.categories.find(c => c.category_id === categoryId),
    [config, categoryId]
  );

  const subEventTierCategory = useMemo(() => {
    const master = config?.categories.find(c => c.category_id === categoryId);
    if (!master) return findCategoryByName(config?.categories, selectedCategoryName);
    const subConfig = config?.sub_event_configs?.find(
      cfg => cfg.ticketing_type === 'concert' && (cfg.enabled_category_ids ?? []).includes(master.category_id)
    );
    const pricing = subEventCategoryPrice(subConfig, master.category_id);
    return {
      ...master,
      adult_price: Number(pricing?.adult_price ?? 0),
      child_price: Number(pricing?.child_price ?? 0),
      price: Number(pricing?.adult_price ?? 0),
    };
  }, [config, categoryId, selectedCategoryName]);

  const mainEventSeatEstimate = useMemo(() => {
    if (!pricingReady || !isEntireEventBooking || !mainEventCategory) return 0;
    return (
      adultQty * categoryAdultPrice(mainEventCategory) +
      childQty * categoryChildPrice(mainEventCategory)
    );
  }, [pricingReady, isEntireEventBooking, mainEventCategory, adultQty, childQty]);

  const subEventSeatPerProgram = useMemo(() => {
    if (!pricingReady || !subEventTierCategory) return 0;
    return (
      adultQty * categoryAdultPrice(subEventTierCategory) +
      childQty * categoryChildPrice(subEventTierCategory)
    );
  }, [pricingReady, subEventTierCategory, adultQty, childQty]);

  const singleSubEventSeatEstimate = useMemo(() => {
    if (!pricingReady || isEntireEventBooking) return 0;
    const cat = activeCategories.find(c => c.category_id === categoryId);
    if (!cat) return 0;
    return adultQty * categoryAdultPrice(cat) + childQty * categoryChildPrice(cat);
  }, [pricingReady, isEntireEventBooking, activeCategories, categoryId, adultQty, childQty]);

  const mealTotal = useMemo(() => {
    if (!config || !isEntireEventBooking || !pricingReady) return 0;
    let total = 0;
    for (const day of config.meal_days ?? []) {
      if (day.lunch_adult_price > 0 || day.lunch_child_price > 0) {
        total += adultQty * day.lunch_adult_price + childQty * day.lunch_child_price;
      }
      if (day.dinner_adult_price > 0 || day.dinner_child_price > 0) {
        total += adultQty * day.dinner_adult_price + childQty * day.dinner_child_price;
      }
    }
    return total;
  }, [config, isEntireEventBooking, pricingReady, adultQty, childQty]);

  const includedExtrasSubtotal = useMemo(() => {
    if (!isEntireEventBooking || !hasSelectedSeats) return 0;
    return Math.max(0, mainEventSeatEstimate - selectedSeatSubtotal);
  }, [isEntireEventBooking, hasSelectedSeats, mainEventSeatEstimate, selectedSeatSubtotal]);

  const alaCarteTotal = useMemo(() => {
    if (!isEntireEventBooking || !pricingReady) return 0;
    return subEventSeatPerProgram * programMapCount + mealTotal;
  }, [isEntireEventBooking, pricingReady, subEventSeatPerProgram, programMapCount, mealTotal]);

  const packageSavings = useMemo(() => {
    if (!isEntireEventBooking || !pricingReady) return 0;
    return Math.max(0, alaCarteTotal - mainEventSeatEstimate);
  }, [isEntireEventBooking, pricingReady, alaCarteTotal, mainEventSeatEstimate]);

  const checkoutFoodAddons = useMemo(() => {
    if (!config || !scopeSubEventId) return [];
    const subConfig = config.sub_event_configs?.find(cfg => cfg.sub_event_id === scopeSubEventId);
    if (!subConfig) return [];
    const subName =
      config.sub_events.find(se => se.sub_event_id === scopeSubEventId)?.sub_event_name ?? 'Sub-event';
    return subConfig.food_addons.map(addon => ({
      ...addon,
      sub_event_id: scopeSubEventId,
      sub_event_name: subName,
    }));
  }, [config, scopeSubEventId]);

  const optionalFoodSubtotal = useMemo(() => {
    if (isEntireEventBooking) return 0;
    return checkoutFoodAddons.reduce((sum, addon) => {
      const key = `${addon.sub_event_id}:${addon.addon_id}`;
      const qty = foodSelections[key] ?? { adult_qty: 0, child_qty: 0 };
      return sum + qty.adult_qty * addon.adult_price + qty.child_qty * addon.child_price;
    }, 0);
  }, [isEntireEventBooking, checkoutFoodAddons, foodSelections]);

  const displaySubtotal = useMemo(() => {
    if (!pricingReady) return 0;
    if (isEntireEventBooking) return mainEventSeatEstimate;
    if (hasSelectedSeats) return selectedSeatSubtotal + optionalFoodSubtotal;
    return singleSubEventSeatEstimate;
  }, [
    pricingReady,
    isEntireEventBooking,
    mainEventSeatEstimate,
    hasSelectedSeats,
    selectedSeatSubtotal,
    optionalFoodSubtotal,
    singleSubEventSeatEstimate,
  ]);

  const subtotal = displaySubtotal;
  const total = useMemo(() => {
    if (discount) {
      if (isEntireEventBooking) return discount.total;
      return discount.total + optionalFoodSubtotal;
    }
    return subtotal;
  }, [discount, isEntireEventBooking, optionalFoodSubtotal, subtotal]);

  // Buyer details must be valid BEFORE seats can be held
  const nameValid = form.name.trim().length > 0;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const phoneDigits = form.phone.replace(/\D/g, '');
  const phoneValid = phoneDigits.length >= 10 && phoneDigits.length <= 15;
  const detailsValid = nameValid && emailValid && phoneValid;

  const toggleSeat = (seatId: string) => {
    if (!canSelectSeats) return;
    if (unavailable[seatId]) return;
    const mapId = seatId.split('|')[0];
    const onThisMap = seatsForMap(mapId);

    if (selected.includes(seatId)) {
      setSelected(prev => prev.filter(s => s !== seatId));
      setSeatAudience(audiences => {
        const next = { ...audiences };
        delete next[seatId];
        return next;
      });
      return;
    }

    if (onThisMap.length >= seatsPerMap) {
      const mapName = mapById[mapId]?.name ?? 'this program';
      toast.error(
        `Select exactly ${seatsPerMap} seat${seatsPerMap === 1 ? '' : 's'} on ${mapName} (${adultQty} adult${adultQty === 1 ? '' : 's'}, ${childQty} child${childQty === 1 ? '' : 'ren'})`
      );
      return;
    }

    const adultsAssignedOnMap = onThisMap.filter(s => seatAudience[s] === 'adult').length;
    const audience: 'adult' | 'child' = adultsAssignedOnMap < adultQty ? 'adult' : 'child';
    setSelected(prev => [...prev, seatId]);
    setSeatAudience(audiences => ({ ...audiences, [seatId]: audience }));
  };

  const toggleSeatAudience = (seatId: string) => {
    const audience = seatAudience[seatId];
    if (!audience) return;
    const mapId = seatId.split('|')[0];
    const onMap = seatsForMap(mapId);
    const adultsOnMap = onMap.filter(s => seatAudience[s] === 'adult').length;
    const childrenOnMap = onMap.filter(s => seatAudience[s] === 'child').length;
    if (audience === 'adult' && childrenOnMap >= childQty) return;
    if (audience === 'child' && adultsOnMap >= adultQty) return;
    setSeatAudience(audiences => ({
      ...audiences,
      [seatId]: audience === 'adult' ? 'child' : 'adult',
    }));
  };

  const startMealsCheckout = () => {
    if (!detailsValid || !mealsSelectionComplete) return;
    setDiscount(null);
    setPhase('checkout');
  };

  const startCheckout = async () => {
    if (!partySeatsComplete || !detailsValid) return;
    if (!entireEventProgramsComplete) {
      toast.error(
        `Complete seat selection on each program: ${missingProgramMaps.map(map => map.name).join(', ')}`
      );
      return;
    }
    setSubmitting(true);
    try {
      const h = await ticketingAPI.holdSeats(
        selected,
        categoryId,
        scopeSubEventId,
        adultQty,
        childQty
      );
      sessionStorage.setItem(HOLD_KEY, h.hold_id);
      setHold(h);
      setPhase('checkout');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Could not hold seats');
      refreshAvailability();
    } finally {
      setSubmitting(false);
    }
  };

  const backToSeats = async () => {
    if (hold) {
      sessionStorage.removeItem(HOLD_KEY);
      ticketingAPI.releaseHold(hold.hold_id).catch(() => undefined);
      setHold(null);
    }
    setDiscount(null);
    setPhase('selecting');
    refreshAvailability();
  };

  const applyDiscount = async () => {
    const code = discountInput.trim();
    if (!code) return;
    try {
      const preview = isMealsOnlyBooking
        ? await ticketingAPI.previewMealsDiscount(
            code,
            buildMealSelectionsPayload(),
            adultQty,
            childQty
          )
        : await ticketingAPI.previewDiscount(code, selected, seatAudience, {
            category_id: categoryId,
            scope_sub_event_id: scopeSubEventId,
            adult_count: adultQty,
            child_count: childQty,
          });
      setDiscount(preview);
      toast.success(`Discount applied: −${usd(preview.discount_amount)}`);
    } catch (error: any) {
      setDiscount(null);
      toast.error(error?.response?.data?.error || 'Invalid discount code');
    }
  };

  const confirmMealsBooking = async () => {
    setSubmitting(true);
    try {
      const result = await ticketingAPI.checkoutMeals({
        name: form.name,
        email: form.email,
        phone: form.phone,
        discount_code: discount?.code,
        adult_count: adultQty,
        child_count: childQty,
        meal_selections: buildMealSelectionsPayload(),
      });
      setBooking(result.booking);
      setPayment(result.payment);
      setMealSelections({});
      setPhase('confirmed');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmBooking = async () => {
    if (isMealsOnlyBooking) {
      await confirmMealsBooking();
      return;
    }
    if (!hold) return;
    setSubmitting(true);
    try {
      const result = await ticketingAPI.checkout({
        hold_id: hold.hold_id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        discount_code: discount?.code,
        seat_keys: selected,
        category_id: categoryId,
        scope_sub_event_id: scopeSubEventId,
        adult_count: adultQty,
        child_count: childQty,
        seat_audiences: seatAudience,
        ...(scopeSubEventId
          ? {
              food_addons: checkoutFoodAddons.flatMap(addon => {
                const key = `${addon.sub_event_id}:${addon.addon_id}`;
                const qty = foodSelections[key] ?? { adult_qty: 0, child_qty: 0 };
                if (qty.adult_qty === 0 && qty.child_qty === 0) return [];
                return [{
                  addon_id: addon.addon_id,
                  sub_event_id: addon.sub_event_id,
                  adult_qty: qty.adult_qty,
                  child_qty: qty.child_qty,
                }];
              }),
            }
          : {}),
      });
      sessionStorage.removeItem(HOLD_KEY);
      setBooking(result.booking);
      setPayment(result.payment);
      setHold(null);
      setSelected([]);
      setSeatAudience({});
      setPhase('confirmed');
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Booking failed';
      toast.error(msg);
      if (/expired|taken/i.test(msg)) {
        sessionStorage.removeItem(HOLD_KEY);
        setHold(null);
        setPhase('selecting');
        setDiscount(null);
        refreshAvailability();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const timer = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const closed = !config?.event || (!seatBookingAvailable && !mealsBookingAvailable);

  const mealsTotal = discount && isMealsOnlyBooking ? discount.total : mealsSubtotal;

  return (
    <div className="py-12 pb-24">
      <Seo
        title="Book Your Seat | Sanhoti Durga Puja"
        description="Reserve your seats for Sanhoti's Durga Puja celebration in Orange County — pick your seats on the map, see pricing by category, and book online."
        path="/book-your-seat"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
              <Ticket className="w-8 h-8 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">Book Your Seat</h1>
            </div>
            {config?.event && (
              <p className="text-lg text-gray-600 flex items-center justify-center gap-4 flex-wrap">
                <span className="font-semibold text-gray-800">
                  {config.event.event_name}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-primary-600" />
                  {formatDateWithTime(
                    config.event.event_start_dt
                  )}
                </span>
                {config.event.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-primary-600" />
                    {config.event.location}
                  </span>
                )}
              </p>
            )}
            {config?.booking_note && <p className="text-gray-600 mt-2">{config.booking_note}</p>}
          </div>

          {closed ? (
            <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-lg border border-yellow-200 p-8 text-center">
              <Armchair className="w-10 h-10 text-primary-600 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Booking is not open yet
              </h2>
              <p className="text-gray-600">
                {config?.event
                  ? `Online booking for ${config.event.event_name} is not available right now. Check back soon.`
                  : 'Check back soon, or see the'}{' '}
                {!config?.event && (
                  <>
                    <Link to="/durga-puja" className="text-primary-600 hover:text-primary-700 underline">
                      Durga Puja page
                    </Link>{' '}
                    for updates.
                  </>
                )}
              </p>
            </div>
          ) : phase === 'confirmed' && booking ? (
            <ConfirmationCard booking={booking} payment={payment} hasPaymentQR={hasPaymentQR} />
          ) : (
            <>
            <div className="bg-white rounded-2xl shadow border border-yellow-200 p-5 mb-6 space-y-4">
              {(seatBookingAvailable && (config.sub_events.length > 0 || mealsBookingAvailable)) ||
              (mealsBookingAvailable && !seatBookingAvailable) ? (
                <fieldset>
                  <legend className="text-sm font-semibold text-gray-900 mb-2">What would you like to book?</legend>
                  <div className="flex flex-wrap gap-2">
                    {seatBookingAvailable && (
                      <>
                        <label className="inline-flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer">
                          <input
                            type="radio"
                            name="booking-mode"
                            checked={!isMealsOnlyBooking && !scopeSubEventId}
                            onChange={() => changeSelectionContext(undefined, categoryId)}
                          />
                          Entire event (all programs)
                        </label>
                        {config.sub_events.map(subEvent => (
                          <label
                            key={subEvent.sub_event_id}
                            className="inline-flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name="booking-mode"
                              checked={!isMealsOnlyBooking && scopeSubEventId === subEvent.sub_event_id}
                              onChange={() => changeSelectionContext(subEvent.sub_event_id, categoryId)}
                            />
                            {subEvent.sub_event_name}
                          </label>
                        ))}
                      </>
                    )}
                    {mealsBookingAvailable && (
                      <label className="inline-flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer">
                        <input
                          type="radio"
                          name="booking-mode"
                          checked={isMealsOnlyBooking}
                          onChange={() => changeSelectionContext(undefined, '', true)}
                        />
                        Meals only (no seats)
                      </label>
                    )}
                  </div>
                </fieldset>
              ) : null}
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  {isMealsOnlyBooking ? 'How many people?' : 'How many tickets?'}
                  {!isMealsOnlyBooking && !scopeSubEventId && config.sub_events.length > 0 && (
                    <span className="font-normal text-gray-500">
                      {' '}(Entire-event pass includes all meals for your party automatically.)
                    </span>
                  )}
                </p>
                {config.child_age_range && (
                  <p className="text-xs text-gray-500 mb-3">
                    Child = ages {config.child_age_range.min_age}–{config.child_age_range.max_age}
                  </p>
                )}
                <div className="flex flex-wrap gap-6">
                  <PartyQtyControl
                    label="Adults"
                    value={adultQty}
                    min={childQty > 0 ? 0 : 1}
                    max={MAX_PARTY_SIZE - childQty}
                    onChange={next => changePartyQty(next, childQty)}
                  />
                  <PartyQtyControl
                    label="Children"
                    value={childQty}
                    min={adultQty > 0 ? 0 : 1}
                    max={MAX_PARTY_SIZE - adultQty}
                    onChange={next => changePartyQty(adultQty, next)}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  {partySize} {isMealsOnlyBooking ? 'person' : 'ticket'}{partySize === 1 ? '' : 's'} total ({adultQty} adult{adultQty === 1 ? '' : 's'}, {childQty} child{childQty === 1 ? '' : 'ren'}).
                  {isMealsOnlyBooking
                    ? ' Choose lunch and/or dinner in the meal selection section below.'
                    : !categoryId
                      ? ' Choose a category next, then select seats on the map.'
                      : ''}
                </p>
              </div>
              {!isMealsOnlyBooking && (
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  Choose a seat category
                  {isEntireEventPassMode && (
                    <span className="font-normal text-gray-500">
                      {' '}(Entire-event pass pricing — all programs and meals for your party.
                      {isEntireEventBooking
                        ? ` Select ${partySize} seat${partySize === 1 ? '' : 's'} on every program map below.`
                        : ` Select ${partySize} seat${partySize === 1 ? '' : 's'} on the map below.`}
                      )
                    </span>
                  )}
                  {scopeSubEventId && (
                    <span className="font-normal text-gray-500">
                      {' '}(Per-seat pricing for this program only. Food add-ons available at checkout.)
                    </span>
                  )}
                  {!isEntireEventPassMode && !scopeSubEventId && config.sub_events.length === 0 && (
                    <span className="font-normal text-gray-500">
                      {' '}(Select {partySize} seat{partySize === 1 ? '' : 's'} on the map below.)
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeCategories.map(category => (
                    <button
                      key={category.category_id}
                      type="button"
                      onClick={() => changeSelectionContext(scopeSubEventId, category.category_id)}
                      className={`rounded-full border-2 px-4 py-2 text-sm font-semibold ${
                        categoryId === category.category_id ? 'ring-2 ring-offset-2 ring-gray-800' : ''
                      }`}
                      style={{ borderColor: category.color, color: category.color }}
                    >
                      {formatCategoryPriceLabel(category, isEntireEventPassMode)}
                    </button>
                  ))}
                </div>
              </div>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Seat map or meal selection */}
              {isMealsOnlyBooking ? (
                <div className="lg:col-span-2">
                  <MealSelectionView
                    options={availableMealOptions}
                    mealSelections={mealSelections}
                    adultQty={adultQty}
                    childQty={childQty}
                    disabled={phase === 'checkout'}
                    onUpdate={updateMealSelection}
                  />
                </div>
              ) : (
              <div className="lg:col-span-2 space-y-6">
                {visibleMaps.map(map => (
                  <SeatMapView
                    key={map.map_id}
                    map={map}
                    categories={config ? categoriesByIdForMap(map, config) : {}}
                    selectedCategoryId={categoryId}
                    selectedCategoryName={selectedCategoryName}
                    matchByCategoryName={matchSeatsByCategoryName}
                    unavailable={unavailable}
                    selected={selected}
                    disabled={phase === 'checkout' || !canSelectSeats}
                    lockReason={
                      !categoryId
                        ? 'Choose a seat category above to enable the map.'
                        : undefined
                    }
                    onToggle={toggleSeat}
                    seatLabel={seatLabel}
                  />
                ))}
              </div>
              )}

              {/* Right panel: selection or checkout */}
              <div>
                <div className="bg-white rounded-2xl shadow-lg border border-yellow-200 p-6 sticky top-24">
                  {phase === 'selecting' ? (
                    isMealsOnlyBooking ? (
                      <>
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">Your meals</h2>
                        {!mealsSelectionComplete ? (
                          <p className="text-gray-500 text-sm mb-4">
                            Select at least one lunch or dinner in the meal selection section to continue.
                          </p>
                        ) : (
                          <ul className="mb-4 space-y-2 text-sm">
                            {availableMealOptions.map(opt => {
                              const qty = mealSelections[opt.key] ?? { adult_qty: 0, child_qty: 0 };
                              const lineTotal = qty.adult_qty * opt.adult_price + qty.child_qty * opt.child_price;
                              if (lineTotal === 0) return null;
                              return (
                                <li key={opt.key} className="flex justify-between gap-2">
                                  <span className="text-gray-700">
                                    {opt.label} — {opt.meal_type === 'lunch' ? 'Lunch' : 'Dinner'}
                                    {qty.adult_qty > 0 ? ` · ${qty.adult_qty} adult` : ''}
                                    {qty.child_qty > 0 ? ` · ${qty.child_qty} child` : ''}
                                  </span>
                                  <span className="text-gray-900 shrink-0">{usd(lineTotal)}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <div className="border-t border-gray-100 pt-3 mb-4 space-y-1 text-sm">
                          <div className="flex justify-between font-semibold text-gray-900">
                            <span>Subtotal</span>
                            <span>{usd(mealsSubtotal)}</span>
                          </div>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Your details</h3>
                        <div className="space-y-2 mb-4">
                          <input
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="Full name *"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                          />
                          <div>
                            <input
                              type="email"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="Email *"
                              value={form.email}
                              onChange={e => setForm({ ...form, email: e.target.value })}
                            />
                            {form.email.trim() !== '' && !emailValid && (
                              <p className="text-xs text-red-600 mt-0.5">Enter a valid email address</p>
                            )}
                          </div>
                          <div>
                            <input
                              type="tel"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="Mobile number *"
                              value={form.phone}
                              onChange={e => setForm({ ...form, phone: e.target.value })}
                            />
                            {form.phone.trim() !== '' && !phoneValid && (
                              <p className="text-xs text-red-600 mt-0.5">
                                Enter a valid mobile number (at least 10 digits)
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!mealsSelectionComplete || !detailsValid || submitting}
                          onClick={startMealsCheckout}
                          className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
                        >
                          Continue to Checkout
                        </button>
                        <p className="text-xs text-gray-500 mt-2">
                          {!mealsSelectionComplete
                            ? 'Choose at least one meal in the selection section.'
                            : !detailsValid
                              ? 'Fill in your name, a valid email, and a valid mobile number to continue.'
                              : 'No seat hold needed — proceed to checkout when ready.'}
                        </p>
                      </>
                    ) : (
                    <>
                      <h2 className="text-lg font-semibold text-gray-900 mb-3">Your seats</h2>
                      {isEntireEventBooking && requiredProgramMaps.length > 0 && (
                        <ul className="mb-4 space-y-1.5 text-sm">
                          {requiredProgramMaps.map(map => {
                            const onMap = seatsForMap(map.map_id);
                            const done = mapPartyComplete(map.map_id);
                            const adultsOnMap = onMap.filter(s => seatAudience[s] === 'adult').length;
                            const childrenOnMap = onMap.filter(s => seatAudience[s] === 'child').length;
                            return (
                              <li
                                key={map.map_id}
                                className={`flex items-center gap-2 ${done ? 'text-green-700' : 'text-amber-800'}`}
                              >
                                <span aria-hidden>{done ? '✓' : '○'}</span>
                                <span>
                                  {map.name}
                                  {done
                                    ? ` — ${seatsPerMap} seats`
                                    : ` — ${onMap.length}/${seatsPerMap} seats (${adultsOnMap}/${adultQty} adult, ${childrenOnMap}/${childQty} child)`}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {!pricingReady ? (
                        <p className="text-gray-500 text-sm mb-4">
                          Set adult and child counts, then choose a category to see pricing.
                        </p>
                      ) : !hasSelectedSeats ? (
                        <p className="text-gray-500 text-sm mb-4">
                          {isEntireEventBooking
                            ? `Entire-event pass: ${usd(mainEventSeatEstimate)} for seats. Select ${seatsPerMap} seats on each program map to continue.`
                            : `Select ${seatsPerMap} seat${seatsPerMap === 1 ? '' : 's'} on the map.`}
                        </p>
                      ) : (
                        <div className="mb-4 space-y-3">
                          {!isEntireEventBooking && (
                            <p className="text-xs text-gray-500">
                              {adultSeatsAssigned}/{adultQty} adult · {childSeatsAssigned}/{childQty} child
                              {!partySeatsComplete ? ` · ${seatsPerMap - selected.length} more needed` : ''}
                            </p>
                          )}
                          {selectedGroups.map(group => (
                            <div key={group.map.map_id}>
                              <h3 className="text-sm font-semibold text-gray-900 mb-1">{group.map.name}</h3>
                              <ul className="space-y-1">
                                {group.seats.map(s => (
                                  <li key={s} className="flex items-center justify-between text-sm gap-2">
                                    <span className="text-gray-700 flex items-center gap-2 min-w-0">
                                      <span className="font-medium">{shortSeatCode(s, mapById)}</span>
                                      <button
                                        type="button"
                                        onClick={() => toggleSeatAudience(s)}
                                        className="text-xs font-medium px-2 py-0.5 rounded-full border border-gray-300 text-gray-600 hover:border-primary-500 hover:text-primary-700"
                                        title="Switch adult / child for this seat"
                                      >
                                        {seatAudience[s] === 'child' ? 'Child' : 'Adult'}
                                      </button>
                                    </span>
                                    <span className="flex items-center gap-2 shrink-0">
                                      <span className="text-gray-900 font-medium">{usd(seatPrice(s))}</span>
                                      <button
                                        type="button"
                                        onClick={() => toggleSeat(s)}
                                        className="text-gray-400 hover:text-red-500"
                                        aria-label={`Remove ${seatLabel(s)}`}
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="border-t border-gray-100 pt-3 mb-4 space-y-1 text-sm">
                        {hasSelectedSeats && (
                          <>
                            <div className="flex justify-between text-gray-700">
                              <span>Seats</span>
                              <span>{usd(selectedSeatSubtotal)}</span>
                            </div>
                            {isEntireEventBooking && hasSelectedSeats && (
                              <div className="flex justify-between text-gray-700">
                                <span>Meals (included)</span>
                                <span>{usd(includedExtrasSubtotal)}</span>
                              </div>
                            )}
                            {!isEntireEventBooking && optionalFoodSubtotal > 0 && (
                              <div className="flex justify-between text-gray-700">
                                <span>Food add-ons</span>
                                <span>{usd(optionalFoodSubtotal)}</span>
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex justify-between font-semibold text-gray-900 pt-1">
                          <span>Subtotal</span>
                          <span>{usd(subtotal)}</span>
                        </div>
                        {isEntireEventBooking && pricingReady && packageSavings > 0 && (
                          <div className="flex justify-between text-green-700 text-xs pt-1">
                            <span>Package savings (vs programs &amp; meals separately)</span>
                            <span>{usd(packageSavings)}</span>
                          </div>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Your details</h3>
                      <div className="space-y-2 mb-4">
                        <input
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="Full name *"
                          value={form.name}
                          onChange={e => setForm({ ...form, name: e.target.value })}
                        />
                        <div>
                          <input
                            type="email"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="Email *"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                          />
                          {form.email.trim() !== '' && !emailValid && (
                            <p className="text-xs text-red-600 mt-0.5">Enter a valid email address</p>
                          )}
                        </div>
                        <div>
                          <input
                            type="tel"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="Mobile number *"
                            value={form.phone}
                            onChange={e => setForm({ ...form, phone: e.target.value })}
                          />
                          {form.phone.trim() !== '' && !phoneValid && (
                            <p className="text-xs text-red-600 mt-0.5">
                              Enter a valid mobile number (at least 10 digits)
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!partySeatsComplete || !detailsValid || !entireEventProgramsComplete || submitting}
                        onClick={startCheckout}
                        className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
                      >
                        {submitting ? 'Holding seats…' : 'Continue — Hold My Seats'}
                      </button>
                      <p className="text-xs text-gray-500 mt-2">
                        {!entireEventProgramsComplete
                          ? `Still needed: ${missingProgramMaps.map(map => map.name).join(', ')}`
                          : !partySeatsComplete
                            ? isEntireEventBooking
                              ? `Select ${seatsPerMap} seats on each program (${totalSeatsNeeded} total).`
                              : `Select ${seatsPerMap} seat${seatsPerMap === 1 ? '' : 's'} (${adultQty} adult${adultQty === 1 ? '' : 's'}, ${childQty} child${childQty === 1 ? '' : 'ren'}).`
                            : !detailsValid
                              ? 'Fill in your name, a valid email, and a valid mobile number to hold seats.'
                              : `Seats are held for ${config!.hold_minutes} minutes while you check out.`}
                      </p>
                    </>
                    )
                  ) : isMealsOnlyBooking ? (
                    <>
                      <h2 className="text-lg font-semibold text-gray-900 mb-3">Checkout</h2>
                      <ul className="mb-3 space-y-1 text-sm">
                        {availableMealOptions.map(opt => {
                          const qty = mealSelections[opt.key] ?? { adult_qty: 0, child_qty: 0 };
                          const lineTotal = qty.adult_qty * opt.adult_price + qty.child_qty * opt.child_price;
                          if (lineTotal === 0) return null;
                          return (
                            <li key={opt.key} className="flex justify-between gap-2">
                              <span className="text-gray-700">
                                {opt.label} — {opt.meal_type === 'lunch' ? 'Lunch' : 'Dinner'}
                                {qty.adult_qty > 0 ? ` · ${qty.adult_qty} adult` : ''}
                                {qty.child_qty > 0 ? ` · ${qty.child_qty} child` : ''}
                              </span>
                              <span className="text-gray-900">{usd(lineTotal)}</span>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 text-sm">
                        <p className="font-medium text-gray-900">{form.name}</p>
                        <p className="text-gray-600">
                          {form.email} · {form.phone}
                        </p>
                        <button
                          type="button"
                          onClick={backToSeats}
                          className="text-primary-600 hover:text-primary-700 underline text-xs mt-1"
                        >
                          Edit details or meals
                        </button>
                      </div>
                      <div className="space-y-3 mb-4">
                        <div className="flex gap-2">
                          <input
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase"
                            placeholder="Discount code"
                            value={discountInput}
                            onChange={e => setDiscountInput(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={applyDiscount}
                            className="inline-flex items-center gap-1 border-2 border-primary-600 text-primary-600 px-3 py-2 rounded-lg font-medium hover:bg-primary-50"
                          >
                            <Tag className="w-4 h-4" /> Apply
                          </button>
                        </div>
                      </div>
                      <div className="border-t border-gray-100 pt-3 mb-4 space-y-1 text-sm">
                        <div className="flex justify-between text-gray-700">
                          <span>Meals</span>
                          <span>{usd(mealsSubtotal)}</span>
                        </div>
                        {discount && (
                          <div className="flex justify-between text-green-700">
                            <span>Promo discount ({discount.code})</span>
                            <span>−{usd(discount.discount_amount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-gray-900 text-base">
                          <span>Total</span>
                          <span>{usd(mealsTotal)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={submitting || !detailsValid}
                        onClick={confirmBooking}
                        className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 mb-2"
                      >
                        {submitting ? 'Booking…' : 'Confirm Booking'}
                      </button>
                      <button
                        type="button"
                        onClick={backToSeats}
                        className="w-full text-gray-600 hover:text-gray-800 py-2 text-sm font-medium"
                      >
                        ← Back to meal selection
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-gray-900">Checkout</h2>
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full ${
                            secondsLeft < 60 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          <Clock className="w-4 h-4" /> {timer}
                        </span>
                      </div>
                      {selectedGroups.map(group => (
                        <div key={group.map.map_id} className="mb-3">
                          <h3 className="text-sm font-semibold text-gray-900 mb-1">{group.map.name}</h3>
                          <ul className="space-y-1 text-sm">
                            {group.seats.map(s => (
                              <li key={s} className="flex justify-between gap-2">
                                <span className="text-gray-700">
                                  {shortSeatCode(s, mapById)}{' '}
                                  <span className="text-gray-400 text-xs">
                                    {seatAudience[s] === 'child' ? 'Child' : 'Adult'}
                                  </span>
                                </span>
                                <span className="text-gray-900">{usd(seatPrice(s))}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 text-sm">
                        <p className="font-medium text-gray-900">{form.name}</p>
                        <p className="text-gray-600">
                          {form.email} · {form.phone}
                        </p>
                        <button
                          type="button"
                          onClick={backToSeats}
                          className="text-primary-600 hover:text-primary-700 underline text-xs mt-1"
                        >
                          Edit details or seats
                        </button>
                      </div>
                      <div className="space-y-3 mb-4">
                        <div className="flex gap-2">
                          <input
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase"
                            placeholder="Discount code"
                            value={discountInput}
                            onChange={e => setDiscountInput(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={applyDiscount}
                            className="inline-flex items-center gap-1 border-2 border-primary-600 text-primary-600 px-3 py-2 rounded-lg font-medium hover:bg-primary-50"
                          >
                            <Tag className="w-4 h-4" /> Apply
                          </button>
                        </div>
                        {scopeSubEventId && checkoutFoodAddons.length > 0 && (
                          <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                            <p className="text-sm font-semibold text-gray-900">Food add-ons (optional)</p>
                            <p className="text-xs text-gray-500">
                              Up to {adultQty} adult{adultQty === 1 ? '' : 's'} and {childQty} child{childQty === 1 ? '' : 'ren'} per add-on (your party size).
                            </p>
                            {config?.child_age_range && (
                              <p className="text-xs text-gray-500">
                                Child = ages {config.child_age_range.min_age}–{config.child_age_range.max_age}
                              </p>
                            )}
                            {checkoutFoodAddons.map(addon => {
                              const key = `${addon.sub_event_id}:${addon.addon_id}`;
                              const qty = foodSelections[key] ?? { adult_qty: 0, child_qty: 0 };
                              return (
                                <div key={key} className="text-sm border-t border-gray-100 pt-2 first:border-t-0 first:pt-0">
                                  <p className="font-medium text-gray-800">{addon.name}</p>
                                  {addon.description && <p className="text-xs text-gray-500">{addon.description}</p>}
                                  <div className="flex flex-wrap gap-3 mt-1">
                                    <label className="flex items-center gap-1">
                                      Adult ({usd(addon.adult_price)})
                                      <input
                                        type="number"
                                        min={0}
                                        max={adultQty}
                                        className="w-14 border border-gray-300 rounded px-2 py-1"
                                        value={qty.adult_qty}
                                        onChange={e =>
                                          updateFoodSelection(key, {
                                            adult_qty: parseInt(e.target.value, 10) || 0,
                                          })
                                        }
                                      />
                                    </label>
                                    <label className="flex items-center gap-1">
                                      Child ({usd(addon.child_price)})
                                      <input
                                        type="number"
                                        min={0}
                                        max={childQty}
                                        className="w-14 border border-gray-300 rounded px-2 py-1"
                                        value={qty.child_qty}
                                        onChange={e =>
                                          updateFoodSelection(key, {
                                            child_qty: parseInt(e.target.value, 10) || 0,
                                          })
                                        }
                                      />
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="border-t border-gray-100 pt-3 mb-4 space-y-1 text-sm">
                        <div className="flex justify-between text-gray-700">
                          <span>Seats</span>
                          <span>{usd(selectedSeatSubtotal)}</span>
                        </div>
                        {isEntireEventBooking && hasSelectedSeats && (
                          <div className="flex justify-between text-gray-700">
                            <span>Meals (included)</span>
                            <span>{usd(includedExtrasSubtotal)}</span>
                          </div>
                        )}
                        {!isEntireEventBooking && optionalFoodSubtotal > 0 && (
                          <div className="flex justify-between text-gray-700">
                            <span>Food add-ons</span>
                            <span>{usd(optionalFoodSubtotal)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-gray-700">
                          <span>Subtotal</span>
                          <span>{usd(subtotal)}</span>
                        </div>
                        {isEntireEventBooking && packageSavings > 0 && (
                          <div className="flex justify-between text-green-700 text-xs">
                            <span>Package savings (vs programs &amp; meals separately)</span>
                            <span>{usd(packageSavings)}</span>
                          </div>
                        )}
                        {discount && (
                          <div className="flex justify-between text-green-700">
                            <span>Promo discount ({discount.code})</span>
                            <span>−{usd(discount.discount_amount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-gray-900 text-base">
                          <span>Total</span>
                          <span>{usd(total)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={submitting || !detailsValid}
                        onClick={confirmBooking}
                        className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 mb-2"
                      >
                        {submitting ? 'Booking…' : 'Confirm Booking'}
                      </button>
                      <button
                        type="button"
                        onClick={backToSeats}
                        className="w-full text-gray-600 hover:text-gray-800 py-2 text-sm font-medium"
                      >
                        ← Back to seat selection
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function MealSelectionView({
  options,
  mealSelections,
  adultQty,
  childQty,
  disabled,
  onUpdate,
}: {
  options: MealOption[];
  mealSelections: Record<string, { adult_qty: number; child_qty: number }>;
  adultQty: number;
  childQty: number;
  disabled: boolean;
  onUpdate: (key: string, patch: Partial<{ adult_qty: number; child_qty: number }>) => void;
}) {
  const byDay = useMemo(() => {
    const days: Array<{ day_id: string; label: string; options: MealOption[] }> = [];
    const index = new Map<string, number>();
    for (const opt of options) {
      if (!index.has(opt.day_id)) {
        index.set(opt.day_id, days.length);
        days.push({ day_id: opt.day_id, label: opt.label, options: [] });
      }
      days[index.get(opt.day_id)!].options.push(opt);
    }
    return days;
  }, [options]);

  if (options.length === 0) {
    return (
      <section className="bg-white rounded-2xl shadow-lg border border-yellow-200 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Meal selection</h2>
        <p className="text-sm text-gray-500">No meals are available for booking right now.</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl shadow-lg border border-yellow-200 p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Meal selection</h2>
      <p className="text-sm text-gray-500 mb-6">
        Up to {adultQty} adult{adultQty === 1 ? '' : 's'} and {childQty} child{childQty === 1 ? '' : 'ren'} per meal
        (your party size).
      </p>
      <div className="space-y-6">
        {byDay.map(day => (
          <div key={day.day_id}>
            <h3 className="text-base font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">
              {day.label}
            </h3>
            <div className="space-y-3">
              {day.options.map(opt => {
                const qty = mealSelections[opt.key] ?? { adult_qty: 0, child_qty: 0 };
                const lineTotal = qty.adult_qty * opt.adult_price + qty.child_qty * opt.child_price;
                const selected = lineTotal > 0;
                return (
                  <div
                    key={opt.key}
                    className={`border rounded-lg p-4 transition-colors ${
                      selected ? 'border-primary-300 bg-primary-50/40' : 'border-gray-200 bg-white'
                    } ${disabled ? 'opacity-60' : ''}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {opt.meal_type === 'lunch' ? 'Lunch' : 'Dinner'}
                        </p>
                        <p className="text-sm text-gray-600 mt-0.5">
                          Adult {usd(opt.adult_price)} · Child {usd(opt.child_price)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="font-medium w-10">Adult</span>
                          <input
                            type="number"
                            min={0}
                            max={adultQty}
                            disabled={disabled}
                            className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
                            value={qty.adult_qty}
                            onChange={e =>
                              onUpdate(opt.key, { adult_qty: parseInt(e.target.value, 10) || 0 })
                            }
                          />
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="font-medium w-10">Child</span>
                          <input
                            type="number"
                            min={0}
                            max={childQty}
                            disabled={disabled}
                            className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
                            value={qty.child_qty}
                            onChange={e =>
                              onUpdate(opt.key, { child_qty: parseInt(e.target.value, 10) || 0 })
                            }
                          />
                        </label>
                        {selected && (
                          <span className="font-semibold text-gray-900 min-w-[5rem] text-right">
                            {usd(lineTotal)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PartyQtyControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700 w-20">{label}</span>
      <button
        type="button"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="w-8 h-8 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label={`Fewer ${label.toLowerCase()}`}
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(clamp(parseInt(e.target.value, 10) || min))}
        className="w-12 text-center font-semibold text-gray-900 border border-gray-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        aria-label={`${label} count`}
      />
      <button
        type="button"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label={`More ${label.toLowerCase()}`}
      >
        +
      </button>
    </div>
  );
}

function SeatMapView({
  map,
  categories,
  selectedCategoryId,
  selectedCategoryName,
  matchByCategoryName,
  unavailable,
  selected,
  disabled,
  lockReason,
  onToggle,
  seatLabel,
}: {
  map: SeatMap;
  categories: Record<string, { name: string; price: number; color: string }>;
  selectedCategoryId: string;
  selectedCategoryName: string;
  matchByCategoryName: boolean;
  unavailable: UnavailableSeats;
  selected: string[];
  disabled: boolean;
  lockReason?: string;
  onToggle: (seatKey: string) => void;
  seatLabel: (seatKey: string) => string;
}) {
  const seatAtCell = useMemo(() => {
    const cells: Record<string, string> = {};
    for (const [innerId, pos] of Object.entries(map.seat_positions ?? {})) {
      cells[`${Math.round(pos.y)}:${Math.round(pos.x)}`] = innerId;
    }
    return cells;
  }, [map]);

  return (
    <section className="bg-white rounded-2xl shadow-lg border border-yellow-200 p-4 sm:p-6 overflow-x-auto">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{map.name}</h2>
      <div className="bg-gray-800 text-white text-center text-sm font-semibold tracking-widest rounded-lg py-2 mb-6">
        STAGE
      </div>
      {!selectedCategoryId && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-4">
          Choose a category above to enable seats.
        </p>
      )}
      {selectedCategoryId && lockReason && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-4">
          {lockReason}
        </p>
      )}
      <div className="space-y-1 min-w-[28rem]">
        {Array.from({ length: map.matrix.rows }, (_, r) => (
          <div
            key={r}
            className="grid items-center gap-[2px] sm:gap-1"
            style={{ gridTemplateColumns: `1.25rem repeat(${map.matrix.cols}, minmax(0, 1fr))` }}
          >
            <span className="text-xs text-gray-400 text-right pr-1">{rowLabel(r + 1)}</span>
            {Array.from({ length: map.matrix.cols }, (_, c) => {
              const innerId = seatAtCell[`${r + 1}:${c + 1}`];
              if (!innerId) return <span key={c} className="aspect-square w-full" />;
              const sectionId = innerId.split(':')[0];
              const section = map.sections.find(s => s.section_id === sectionId);
              const category = section ? categories[section.category_id] : undefined;
              const seatKey = `${map.map_id}|${innerId}`;
              const state = unavailable[seatKey];
              const matchesCategory = Boolean(
                selectedCategoryId &&
                section &&
                (matchByCategoryName && selectedCategoryName
                  ? category?.name.trim().toLowerCase() === selectedCategoryName.trim().toLowerCase()
                  : section.category_id === selectedCategoryId)
              );
              const isSelected = selected.includes(seatKey);
              return (
                <button
                  key={c}
                  type="button"
                  disabled={disabled || Boolean(state) || !matchesCategory}
                  onClick={() => onToggle(seatKey)}
                  aria-label={`${map.name} — ${seatLabel(seatKey)}`}
                  aria-pressed={isSelected}
                  title={`${map.name} — ${seatLabel(seatKey)} — ${state ?? category?.name ?? ''}`}
                  className={`aspect-square w-full rounded-t font-medium leading-none ${
                    map.matrix.cols > 28 ? 'text-[6px]' : 'text-[8px] sm:text-[9px]'
                  } ${
                    !matchesCategory || state
                      ? 'opacity-30 cursor-not-allowed'
                      : isSelected
                        ? 'ring-2 ring-offset-1 ring-gray-900 text-white'
                        : 'hover:scale-110 transition-transform text-white/90'
                  }`}
                  style={{
                    backgroundColor: state
                      ? '#9ca3af'
                      : isSelected
                        ? '#111827'
                        : category?.color ?? '#9ca3af',
                  }}
                >
                  {section?.name?.replace(/^[A-Z]+/, '')}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-4">
        {lockReason
          ? lockReason
          : selectedCategoryId
            ? `${categories[selectedCategoryId]?.name ?? 'Selected category'} seats are enabled.`
            : 'Seats remain disabled until a category is selected.'}
      </p>
    </section>
  );
}

function ConfirmationCard({
  booking,
  payment,
  hasPaymentQR,
}: {
  booking: SeatBooking;
  payment: { zelle_phone?: string };
  hasPaymentQR: boolean;
}) {
  const seatsSubtotal = booking.seats_detail.reduce((sum, s) => sum + s.price, 0);
  const meals = booking.meals_detail ?? [];
  const mealsRetailValue = meals.reduce((sum, m) => sum + m.line_total, 0);
  const isMealsOnlyBooking = booking.seats_detail.length === 0 && meals.length > 0;
  /** Entire-event pass: subtotal is main-event package price, not seats + meals à la carte. */
  const isEntireEventPass =
    !isMealsOnlyBooking &&
    meals.length > 0 &&
    mealsRetailValue > 0 &&
    booking.subtotal <= seatsSubtotal + 0.01;
  const packageSavings = isEntireEventPass
    ? Math.max(0, seatsSubtotal + mealsRetailValue - booking.subtotal)
    : 0;

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-yellow-200 p-8">
      <div className="text-center mb-6">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          {isMealsOnlyBooking ? 'Meals reserved!' : 'Seats reserved!'}
        </h2>
        {booking.event_context && (
          <p className="text-gray-700 font-medium mb-1">{booking.event_context}</p>
        )}
        <p className="text-gray-600">
          Booking ID: <span className="font-mono font-semibold text-gray-900">{booking.booking_id}</span>
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Save this ID — you'll need it for any questions about your booking.
        </p>
      </div>
      <ul className="mb-4 space-y-1.5 text-sm border-t border-b border-gray-100 py-4">
        {booking.seats_detail.map(s => (
          <li key={s.seat_id} className="flex justify-between gap-2">
            <span className="text-gray-700">
              {s.map_name ? `${s.map_name} — ` : ''}{s.label}{' '}
              <span className="text-gray-400">
                ({s.category_name}
                {s.audience_type === 'child' ? ' · Child' : s.audience_type === 'adult' ? ' · Adult' : ''})
              </span>
            </span>
            <span className="text-gray-900 shrink-0">${s.price.toFixed(2)}</span>
          </li>
        ))}
        {isEntireEventPass ? (
          <li className="flex justify-between gap-2">
            <span className="text-gray-700">
              Meals (included)
              <span className="block text-xs text-gray-500 mt-0.5">
                {meals.map(m => m.label).join(' · ')}
              </span>
            </span>
            <span className="text-gray-900 shrink-0">$0.00</span>
          </li>
        ) : (
          meals.map(item => (
            <li key={`${item.day_id}-${item.meal_type}`} className="flex justify-between gap-2">
              <span className="text-gray-700">
                {item.label} — {item.meal_type}
                {item.adult_qty > 0 ? ` · ${item.adult_qty} adult` : ''}
                {item.child_qty > 0 ? ` · ${item.child_qty} child` : ''}
              </span>
              <span className="text-gray-900 shrink-0">${item.line_total.toFixed(2)}</span>
            </li>
          ))
        )}
        {(booking.food_addons_detail ?? []).map(item => (
          <li key={`${item.sub_event_id}-${item.addon_id}`} className="flex justify-between gap-2">
            <span className="text-gray-700">
              {item.name}
              {item.adult_qty > 0 ? ` · ${item.adult_qty} adult` : ''}
              {item.child_qty > 0 ? ` · ${item.child_qty} child` : ''}
            </span>
            <span className="text-gray-900 shrink-0">${item.line_total.toFixed(2)}</span>
          </li>
        ))}
        {isEntireEventPass && (
          <li className="flex justify-between text-gray-700 border-t border-gray-100 pt-2 mt-1">
            <span>Entire-event pass</span>
            <span>${booking.subtotal.toFixed(2)}</span>
          </li>
        )}
        {packageSavings > 0 && (
          <li className="flex justify-between text-green-700 text-xs">
            <span>Package savings (vs programs &amp; meals separately)</span>
            <span>${packageSavings.toFixed(2)}</span>
          </li>
        )}
        {booking.discount_amount > 0 && (
          <li className="flex justify-between text-green-700">
            <span>Promo discount ({booking.discount_code})</span>
            <span>−${booking.discount_amount.toFixed(2)}</span>
          </li>
        )}
        <li className="flex justify-between font-bold text-gray-900 text-base pt-1">
          <span>Total due</span>
          <span>${booking.total.toFixed(2)}</span>
        </li>
      </ul>
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Complete your payment</h3>
        <p className="text-sm text-gray-700 mb-3">
          Your {isMealsOnlyBooking ? 'meals are' : 'seats are'} reserved as{' '}
          <span className="font-semibold">pending payment</span>. Please
          pay <span className="font-semibold">${booking.total.toFixed(2)}</span>
          {payment.zelle_phone ? (
            <>
              {' '}via Zelle to <span className="font-semibold">{payment.zelle_phone}</span>
            </>
          ) : (
            ' via Zelle'
          )}{' '}
          with your Booking ID <span className="font-mono font-semibold">{booking.booking_id}</span> in
          the memo. We'll confirm your booking once payment is received.
        </p>
        {booking.payment_due_at && (
          <p className="text-sm text-amber-800 font-medium mb-3">
            Pay by{' '}
            <span className="font-semibold">{formatDateWithTime(booking.payment_due_at)}</span>{' '}
            or your reservation will lapse.
          </p>
        )}
        {hasPaymentQR && (
          <img
            src="/api/paymentqr/image"
            alt="Zelle payment QR code"
            className="max-h-56 rounded-lg border border-gray-200 bg-white mx-auto"
          />
        )}
      </div>
      <div className="text-center mt-6">
        <Link
          to="/durga-puja"
          className="text-primary-600 hover:text-primary-700 underline text-sm font-medium"
        >
          Back to the Durga Puja page
        </Link>
      </div>
    </div>
  );
}
