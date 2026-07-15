import { DatabaseHelper } from './DatabaseHelper.js';
import { SeatMapDataHelper } from './SeatMapDataHelper.js';
import {
  ChildAgeRange,
  FoodAddon,
  MealDayPricing,
  SeatCategory,
  SubEventCategoryPricing,
  SubEventTicketingConfig,
  TicketingProfile,
} from '../models/types.js';

const FILENAME = 'ticketingProfile.json';

export function categoryAdultPrice(category: SeatCategory): number {
  return Number(category.adult_price ?? category.price ?? 0);
}

export function categoryChildPrice(category: SeatCategory): number {
  return Number(category.child_price ?? categoryAdultPrice(category));
}

const nameKey = (name: string) => name.trim().toLowerCase();

function normalizeCategory(category: SeatCategory, defaults?: Partial<SeatCategory>): SeatCategory {
  const adult_price = categoryAdultPrice(category);
  const child_price = categoryChildPrice(category);
  return {
    category_id: category.category_id,
    name: category.name,
    color: category.color,
    adult_price,
    child_price,
    price: adult_price,
    entire_event_enabled: category.entire_event_enabled ?? defaults?.entire_event_enabled ?? false,
  };
}

function normalizeCategoryPrices(
  prices: SubEventCategoryPricing[] | undefined,
  enabledIds: string[],
  legacyCategories: SeatCategory[] | undefined,
  masterCategories: SeatCategory[],
  categoryIdRemap: Map<string, string>
): SubEventCategoryPricing[] {
  const validIds = new Set(masterCategories.map(category => category.category_id));
  const byId = new Map<string, SubEventCategoryPricing>();

  for (const row of prices ?? []) {
    const category_id = categoryIdRemap.get(row.category_id) ?? row.category_id;
    if (!validIds.has(category_id)) continue;
    byId.set(category_id, {
      category_id,
      adult_price: Number(row.adult_price ?? 0),
      child_price: Number(row.child_price ?? 0),
    });
  }

  for (const cat of legacyCategories ?? []) {
    const category_id = categoryIdRemap.get(cat.category_id) ?? cat.category_id;
    if (!validIds.has(category_id)) continue;
    if (!byId.has(category_id)) {
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

  return [...byId.values()];
}

function normalizeChildAgeRange(range?: ChildAgeRange): ChildAgeRange {
  const min_age = Number(range?.min_age ?? 0);
  const max_age = Number(range?.max_age ?? 12);
  return {
    min_age: Number.isInteger(min_age) && min_age >= 0 ? min_age : 0,
    max_age: Number.isInteger(max_age) && max_age >= min_age ? max_age : 12,
  };
}

function normalizeMealDays(days?: MealDayPricing[]): MealDayPricing[] {
  return (days ?? []).map(day => ({
    day_id: day.day_id,
    label: day.label,
    ...(day.date ? { date: day.date } : {}),
    lunch_adult_price: Number(day.lunch_adult_price ?? 0),
    lunch_child_price: Number(day.lunch_child_price ?? 0),
    dinner_adult_price: Number(day.dinner_adult_price ?? 0),
    dinner_child_price: Number(day.dinner_child_price ?? 0),
  }));
}

/** Merge legacy per-sub-event category copies into one master list + enabled_category_ids. */
export function migrateProfileCategories(profile: TicketingProfile): {
  profile: Pick<TicketingProfile, 'categories' | 'sub_event_configs'>;
  categoryIdRemap: Map<string, string>;
} {
  const categoryIdRemap = new Map<string, string>();
  const byName = new Map<string, SeatCategory>();

  for (const cat of profile.categories ?? []) {
    if (!cat.name?.trim()) continue;
    const key = nameKey(cat.name);
    if (byName.has(key)) {
      categoryIdRemap.set(cat.category_id, byName.get(key)!.category_id);
      continue;
    }
    const merged = normalizeCategory(cat, { entire_event_enabled: cat.entire_event_enabled ?? true });
    byName.set(key, merged);
    categoryIdRemap.set(cat.category_id, merged.category_id);
  }

  for (const config of profile.sub_event_configs ?? []) {
    for (const cat of config.categories ?? []) {
      if (!cat.name?.trim()) continue;
      const key = nameKey(cat.name);
      if (byName.has(key)) {
        categoryIdRemap.set(cat.category_id, byName.get(key)!.category_id);
        continue;
      }
      const merged = normalizeCategory(cat, { entire_event_enabled: false });
      byName.set(key, merged);
      categoryIdRemap.set(cat.category_id, merged.category_id);
    }
  }

  const categories = Array.from(byName.values());
  const validIds = new Set(categories.map(category => category.category_id));

  const sub_event_configs = (profile.sub_event_configs ?? []).map(config => {
    const enabled = new Set<string>();
    for (const id of config.enabled_category_ids ?? []) {
      const mapped = categoryIdRemap.get(id) ?? id;
      if (validIds.has(mapped)) enabled.add(mapped);
    }
    for (const cat of config.categories ?? []) {
      const mapped = categoryIdRemap.get(cat.category_id) ?? cat.category_id;
      if (validIds.has(mapped)) enabled.add(mapped);
    }
    for (const row of config.category_prices ?? []) {
      const mapped = categoryIdRemap.get(row.category_id) ?? row.category_id;
      if (validIds.has(mapped)) enabled.add(mapped);
    }
    for (const cat of categories) {
      if (cat.entire_event_enabled) enabled.add(cat.category_id);
    }
    const enabled_category_ids = [...enabled];
    const category_prices = normalizeCategoryPrices(
      config.category_prices,
      enabled_category_ids,
      config.categories,
      categories,
      categoryIdRemap
    );
    return {
      sub_event_id: config.sub_event_id,
      ticketing_type: config.ticketing_type === 'concert' ? 'concert' as const : 'general' as const,
      enabled_category_ids,
      category_prices,
      food_addons: (config.food_addons ?? []).map(addon => ({
        addon_id: addon.addon_id,
        name: addon.name,
        ...(addon.description ? { description: addon.description } : {}),
        adult_price: Number(addon.adult_price ?? 0),
        child_price: Number(addon.child_price ?? 0),
      })),
    };
  });

  return { profile: { categories, sub_event_configs }, categoryIdRemap };
}

function normalizeSubEventConfigs(
  configs: SubEventTicketingConfig[] | undefined,
  categories: SeatCategory[]
): SubEventTicketingConfig[] {
  const validIds = new Set(categories.map(category => category.category_id));
  const entireEventIds = categories.filter(category => category.entire_event_enabled).map(category => category.category_id);
  return (configs ?? []).map(config => {
    const enabled = new Set<string>();
    for (const id of config.enabled_category_ids ?? []) {
      if (validIds.has(id)) enabled.add(id);
    }
    for (const cat of config.categories ?? []) {
      if (validIds.has(cat.category_id)) enabled.add(cat.category_id);
    }
    for (const row of config.category_prices ?? []) {
      if (validIds.has(row.category_id)) enabled.add(row.category_id);
    }
    for (const id of entireEventIds) enabled.add(id);
    const enabled_category_ids = [...enabled];
    const category_prices = normalizeCategoryPrices(
      config.category_prices,
      enabled_category_ids,
      config.categories,
      categories,
      new Map()
    );
    return {
      sub_event_id: config.sub_event_id,
      ticketing_type: config.ticketing_type === 'concert' ? 'concert' : 'general',
      enabled_category_ids,
      category_prices,
      food_addons: (config.food_addons ?? []).map(addon => ({
        addon_id: addon.addon_id,
        name: addon.name,
        ...(addon.description ? { description: addon.description } : {}),
        adult_price: Number(addon.adult_price ?? 0),
        child_price: Number(addon.child_price ?? 0),
      })),
    };
  });
}

export function normalizeTicketingProfile(profile: TicketingProfile): TicketingProfile {
  const migrated = migrateProfileCategories(profile);
  return {
    ...profile,
    categories: migrated.profile.categories.map(category => normalizeCategory(category)),
    child_age_range: normalizeChildAgeRange(profile.child_age_range),
    meal_days: normalizeMealDays(profile.meal_days),
    sub_event_configs: normalizeSubEventConfigs(migrated.profile.sub_event_configs, migrated.profile.categories),
  };
}

export function categoriesForEntireEvent(profile: TicketingProfile): SeatCategory[] {
  return (profile.categories ?? []).filter(category => category.entire_event_enabled);
}

export function subEventCategoryPrice(
  config: SubEventTicketingConfig | undefined,
  categoryId: string
): SubEventCategoryPricing | undefined {
  return config?.category_prices?.find(row => row.category_id === categoryId);
}

export function categoriesForSubEvent(profile: TicketingProfile, subEventId: string): SeatCategory[] {
  const config = profile.sub_event_configs?.find(item => item.sub_event_id === subEventId);
  if (!config || config.ticketing_type !== 'concert') return [];
  const enabled = new Set(config.enabled_category_ids ?? []);
  return (profile.categories ?? [])
    .filter(category => enabled.has(category.category_id))
    .map(category => {
      const pricing = subEventCategoryPrice(config, category.category_id);
      return {
        ...category,
        adult_price: Number(pricing?.adult_price ?? 0),
        child_price: Number(pricing?.child_price ?? 0),
        price: Number(pricing?.adult_price ?? 0),
      };
    });
}

export class TicketingProfileDataHelper extends DatabaseHelper {
  private migrationHelper = new SeatMapDataHelper();

  async findAll(): Promise<TicketingProfile[]> {
    this.migrationHelper.ensureMigrated();
    return this.readFile<TicketingProfile>(FILENAME).map(normalizeTicketingProfile);
  }

  async findByEventId(eventId: string): Promise<TicketingProfile | null> {
    const profile = (await this.findAll()).find(item => item.event_id === eventId) ?? null;
    return profile;
  }

  async upsert(
    eventId: string,
    patch: Omit<TicketingProfile, 'event_id' | 'updated_at'>
  ): Promise<TicketingProfile> {
    const profiles = await this.findAll();
    const profile: TicketingProfile = normalizeTicketingProfile({
      event_id: eventId,
      ...patch,
      updated_at: new Date().toISOString(),
    });
    const index = profiles.findIndex(item => item.event_id === eventId);
    if (index === -1) profiles.push(profile);
    else profiles[index] = profile;
    this.writeFile<TicketingProfile>(FILENAME, profiles);
    return profile;
  }

  newId(): string {
    return this.generate12DigitAlphanumericId();
  }
}
