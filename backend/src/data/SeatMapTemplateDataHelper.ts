import { DatabaseHelper } from './DatabaseHelper.js';
import { SeatMapTemplate } from '../models/types.js';

const FILENAME = 'seatMapTemplates.json';
export const MAX_SEAT_MAP_TEMPLATES = 2;

export class SeatMapTemplateDataHelper extends DatabaseHelper {
  async findAll(): Promise<SeatMapTemplate[]> {
    return this.readFile<SeatMapTemplate>(FILENAME).sort((a, b) => a.slot - b.slot);
  }

  async findBySlot(slot: 1 | 2): Promise<SeatMapTemplate | null> {
    return (await this.findAll()).find(template => template.slot === slot) ?? null;
  }

  async upsertSlot(
    slot: 1 | 2,
    data: Pick<SeatMapTemplate, 'name' | 'matrix' | 'seats'>
  ): Promise<SeatMapTemplate> {
    const templates = await this.findAll();
    const template: SeatMapTemplate = {
      template_id: templates.find(item => item.slot === slot)?.template_id ?? this.generate12DigitAlphanumericId(),
      slot,
      ...data,
      updated_at: new Date().toISOString(),
    };
    const index = templates.findIndex(item => item.slot === slot);
    if (index === -1) {
      if (templates.length >= MAX_SEAT_MAP_TEMPLATES) {
        throw new Error(`You can save at most ${MAX_SEAT_MAP_TEMPLATES} seat layouts`);
      }
      templates.push(template);
    } else {
      templates[index] = template;
    }
    this.writeFile<SeatMapTemplate>(FILENAME, templates.sort((a, b) => a.slot - b.slot));
    return template;
  }

  async deleteBySlot(slot: 1 | 2): Promise<boolean> {
    const templates = await this.findAll();
    const remaining = templates.filter(template => template.slot !== slot);
    if (remaining.length === templates.length) return false;
    this.writeFile<SeatMapTemplate>(FILENAME, remaining);
    return true;
  }
}
