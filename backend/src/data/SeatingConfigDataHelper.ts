import { DatabaseHelper } from './DatabaseHelper.js';
import { SeatingConfig } from '../models/types.js';

const FILENAME = 'seatingConfig.json';

export function getDefaultSeatingConfig(): SeatingConfig {
  return {
    is_open: false,
    hold_minutes: 10,
    categories: [],
    sections: [],
    layout_mode: 'grid',
    seat_positions: {},
    blocked_seats: [],
    booking_note: '',
    updated_at: new Date().toISOString(),
  };
}

export class SeatingConfigDataHelper extends DatabaseHelper {
  async get(): Promise<SeatingConfig> {
    const rows = this.readFile<SeatingConfig>(FILENAME);
    if (!rows || rows.length === 0) return getDefaultSeatingConfig();
    // Merge over defaults so newly added fields always have values
    return { ...getDefaultSeatingConfig(), ...rows[0] };
  }

  async update(patch: Partial<SeatingConfig>): Promise<SeatingConfig> {
    const current = await this.get();
    const updated: SeatingConfig = {
      ...current,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.writeFile<SeatingConfig>(FILENAME, [updated]);
    return updated;
  }

  newId(): string {
    return this.generate12DigitAlphanumericId();
  }
}
