import { DatabaseHelper } from './DatabaseHelper.js';
import { SeatMap, SeatingConfig, TicketingProfile } from '../models/types.js';

const MAPS_FILE = 'seatMaps.json';
const PROFILES_FILE = 'ticketingProfile.json';
const LEGACY_FILE = 'seatingConfig.json';

/**
 * Collection storage for seat maps. The first read also performs the one-time
 * singleton migration when neither Phase 2 file has been created yet.
 */
export class SeatMapDataHelper extends DatabaseHelper {
  ensureMigrated(): void {
    if (this.dataFileExists(MAPS_FILE) || this.dataFileExists(PROFILES_FILE)) return;

    const legacy = this.readFile<SeatingConfig>(LEGACY_FILE)[0];
    if (!legacy?.event_id || !Array.isArray(legacy.sections) || legacy.sections.length === 0) return;

    const now = new Date().toISOString();
    const map: SeatMap = {
      map_id: this.generate12DigitAlphanumericId(),
      event_id: legacy.event_id,
      ...(legacy.sub_event_id ? { sub_event_id: legacy.sub_event_id } : {}),
      name: 'Legacy Seat Map',
      is_open: legacy.is_open === true,
      matrix: legacy.matrix ?? { rows: 1, cols: Math.max(1, legacy.sections.length) },
      sections: legacy.sections,
      seat_positions: legacy.seat_positions ?? {},
      blocked_seats: legacy.blocked_seats ?? [],
      updated_at: legacy.updated_at || now,
      migrated_from_legacy: true,
    };
    const profile: TicketingProfile = {
      event_id: legacy.event_id,
      categories: (legacy.categories ?? []).map(category => ({
        category_id: category.category_id,
        name: category.name,
        color: category.color,
        adult_price: Number(category.price ?? 0),
        child_price: Number(category.price ?? 0),
        price: Number(category.price ?? 0),
      })),
      child_age_range: { min_age: 0, max_age: 12 },
      meal_days: [],
      sub_event_configs: [],
      hold_minutes: legacy.hold_minutes ?? 10,
      payment_window_hours: 48,
      ...(legacy.booking_note ? { booking_note: legacy.booking_note } : {}),
      updated_at: legacy.updated_at || now,
    };

    this.writeFile<SeatMap>(MAPS_FILE, [map]);
    this.writeFile<TicketingProfile>(PROFILES_FILE, [profile]);
  }

  async findAll(): Promise<SeatMap[]> {
    this.ensureMigrated();
    return this.readFile<SeatMap>(MAPS_FILE);
  }

  async findById(mapId: string): Promise<SeatMap | null> {
    return (await this.findAll()).find(map => map.map_id === mapId) ?? null;
  }

  async findByEventId(eventId: string): Promise<SeatMap[]> {
    return (await this.findAll()).filter(map => map.event_id === eventId);
  }

  async create(data: Omit<SeatMap, 'map_id' | 'updated_at'>): Promise<SeatMap> {
    const maps = await this.findAll();
    let map_id = this.generate12DigitAlphanumericId();
    while (maps.some(map => map.map_id === map_id)) map_id = this.generate12DigitAlphanumericId();
    const created: SeatMap = { ...data, map_id, updated_at: new Date().toISOString() };
    maps.push(created);
    this.writeFile<SeatMap>(MAPS_FILE, maps);
    return created;
  }

  async update(mapId: string, patch: Partial<Omit<SeatMap, 'map_id'>>): Promise<SeatMap | null> {
    const maps = await this.findAll();
    const index = maps.findIndex(map => map.map_id === mapId);
    if (index === -1) return null;
    maps[index] = { ...maps[index], ...patch, map_id: mapId, updated_at: new Date().toISOString() };
    this.writeFile<SeatMap>(MAPS_FILE, maps);
    return maps[index];
  }

  async delete(mapId: string): Promise<boolean> {
    const maps = await this.findAll();
    const remaining = maps.filter(map => map.map_id !== mapId);
    if (remaining.length === maps.length) return false;
    this.writeFile<SeatMap>(MAPS_FILE, remaining);
    return true;
  }

  newId(): string {
    return this.generate12DigitAlphanumericId();
  }
}
