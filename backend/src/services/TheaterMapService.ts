import { TheaterMapDataHelper } from '../data/TheaterMapDataHelper.js';
import { SeatMapTemplateDataHelper } from '../data/SeatMapTemplateDataHelper.js';
import { SeatMapTemplateSeat, TheaterMap } from '../models/types.js';

const MAX_NAME = 120;

export class TheaterMapService {
  private mapHelper = new TheaterMapDataHelper();
  private templateHelper = new SeatMapTemplateDataHelper();
  private migrated = false;

  private async ensureMigrated(): Promise<void> {
    if (this.migrated) return;
    await this.migrateFromTemplates();
    this.migrated = true;
  }

  async listMaps(): Promise<TheaterMap[]> {
    await this.ensureMigrated();
    return (await this.mapHelper.findAll()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  async getMap(theaterMapId: string): Promise<TheaterMap | null> {
    await this.ensureMigrated();
    return this.mapHelper.findById(String(theaterMapId).trim());
  }

  async createMap(input: {
    name?: unknown;
    matrix?: { rows?: unknown; cols?: unknown };
    seats?: SeatMapTemplateSeat[];
  }): Promise<TheaterMap> {
    await this.ensureMigrated();
    const validated = this.validateInput(input);
    return this.mapHelper.create(validated);
  }

  async updateMap(
    theaterMapId: string,
    patch: {
      name?: unknown;
      matrix?: { rows?: unknown; cols?: unknown };
      seats?: SeatMapTemplateSeat[];
    }
  ): Promise<TheaterMap | null> {
    await this.ensureMigrated();
    const current = await this.mapHelper.findById(String(theaterMapId).trim());
    if (!current) return null;
    const validated = this.validateInput({
      name: patch.name ?? current.name,
      matrix: patch.matrix ?? current.matrix,
      seats: patch.seats ?? current.seats,
    });
    return this.mapHelper.update(current.theater_map_id, validated);
  }

  async deleteMap(theaterMapId: string): Promise<boolean> {
    await this.ensureMigrated();
    return this.mapHelper.delete(String(theaterMapId).trim());
  }

  async migrateFromTemplates(): Promise<void> {
    const existing = await this.mapHelper.findAll();
    if (existing.length > 0) return;
    const templates = await this.templateHelper.findAll();
    for (const template of templates) {
      if (!template.seats?.length) continue;
      await this.mapHelper.create({
        name: template.name || `Saved layout slot ${template.slot}`,
        matrix: template.matrix,
        seats: JSON.parse(JSON.stringify(template.seats)),
      });
    }
  }

  private validateInput(input: {
    name?: unknown;
    matrix?: { rows?: unknown; cols?: unknown };
    seats?: SeatMapTemplateSeat[];
  }): Omit<TheaterMap, 'theater_map_id' | 'created_at' | 'updated_at'> {
    const name = String(input.name ?? '').trim();
    if (!name || name.length > MAX_NAME) {
      throw new Error('Theater map name is required (max 120 characters)');
    }
    const rows = Number(input.matrix?.rows);
    const cols = Number(input.matrix?.cols);
    if (!Number.isInteger(rows) || rows < 1 || rows > 60 || !Number.isInteger(cols) || cols < 1 || cols > 80) {
      throw new Error('matrix must have integer rows (1-60) and cols (1-80)');
    }
    const seats = this.validateSeats(input.seats ?? [], rows, cols);
    return { name, matrix: { rows, cols }, seats };
  }

  private validateSeats(
    seats: SeatMapTemplateSeat[],
    rows: number,
    cols: number
  ): SeatMapTemplateSeat[] {
    if (!Array.isArray(seats) || seats.length === 0) {
      throw new Error('Paint at least one seat before saving');
    }
    const seen = new Set<string>();
    const clean: SeatMapTemplateSeat[] = [];
    for (const seat of seats) {
      const row = Number(seat.row);
      const col = Number(seat.col);
      const category_name = String(seat.category_name ?? '').trim();
      if (!Number.isInteger(row) || row < 1 || row > rows || !Number.isInteger(col) || col < 1 || col > cols) {
        throw new Error('Each seat must be within the grid bounds');
      }
      if (!category_name) throw new Error('Each seat needs a category name');
      const key = `${row}:${col}`;
      if (seen.has(key)) throw new Error('Duplicate seat cells are not allowed');
      seen.add(key);
      clean.push({
        row,
        col,
        category_name,
        ...(seat.blocked ? { blocked: true } : {}),
      });
    }
    return clean;
  }
}
