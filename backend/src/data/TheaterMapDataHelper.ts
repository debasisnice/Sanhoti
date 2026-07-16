import { DatabaseHelper } from './DatabaseHelper.js';
import { TheaterMap } from '../models/types.js';

const FILENAME = 'theaterMaps.json';

export class TheaterMapDataHelper extends DatabaseHelper {
  async findAll(): Promise<TheaterMap[]> {
    return this.readFile<TheaterMap>(FILENAME);
  }

  async findById(theaterMapId: string): Promise<TheaterMap | null> {
    return (await this.findAll()).find(map => map.theater_map_id === theaterMapId) ?? null;
  }

  async create(data: Omit<TheaterMap, 'theater_map_id' | 'created_at' | 'updated_at'>): Promise<TheaterMap> {
    const all = await this.findAll();
    const now = new Date().toISOString();
    const map: TheaterMap = {
      ...data,
      theater_map_id: this.generate12DigitAlphanumericId(),
      created_at: now,
      updated_at: now,
    };
    all.push(map);
    this.writeFile<TheaterMap>(FILENAME, all);
    return map;
  }

  async update(theaterMapId: string, patch: Partial<TheaterMap>): Promise<TheaterMap | null> {
    const all = await this.findAll();
    const index = all.findIndex(map => map.theater_map_id === theaterMapId);
    if (index === -1) return null;
    all[index] = { ...all[index], ...patch, updated_at: new Date().toISOString() };
    this.writeFile<TheaterMap>(FILENAME, all);
    return all[index];
  }

  async delete(theaterMapId: string): Promise<boolean> {
    const all = await this.findAll();
    const remaining = all.filter(map => map.theater_map_id !== theaterMapId);
    if (remaining.length === all.length) return false;
    this.writeFile<TheaterMap>(FILENAME, remaining);
    return true;
  }
}
