import { DatabaseHelper } from './DatabaseHelper.js';
import { SeatHold } from '../models/types.js';

const FILENAME = 'seatHolds.json';

export class SeatHoldDataHelper extends DatabaseHelper {
  /** All holds that have not expired; expired ones are pruned on every read. */
  async findActive(): Promise<SeatHold[]> {
    const holds = this.readFile<SeatHold>(FILENAME);
    const now = Date.now();
    const active = holds.filter(h => new Date(h.expires_at).getTime() > now);
    if (active.length !== holds.length) {
      this.writeFile<SeatHold>(FILENAME, active);
    }
    return active;
  }

  async findById(holdId: string): Promise<SeatHold | null> {
    const holds = await this.findActive();
    return holds.find(h => h.hold_id === holdId) ?? null;
  }

  async create(seatIds: string[], holdMinutes: number): Promise<SeatHold> {
    const holds = await this.findActive();
    const hold: SeatHold = {
      hold_id: this.generate12DigitAlphanumericId(),
      seat_ids: seatIds,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + holdMinutes * 60_000).toISOString(),
    };
    holds.push(hold);
    this.writeFile<SeatHold>(FILENAME, holds);
    return hold;
  }

  async delete(holdId: string): Promise<boolean> {
    const holds = await this.findActive();
    const remaining = holds.filter(h => h.hold_id !== holdId);
    this.writeFile<SeatHold>(FILENAME, remaining);
    return remaining.length !== holds.length;
  }

  async deleteAll(): Promise<void> {
    this.writeFile<SeatHold>(FILENAME, []);
  }
}
