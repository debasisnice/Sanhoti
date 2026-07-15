import { DatabaseHelper } from './DatabaseHelper.js';
import { DiscountCode } from '../models/types.js';

const FILENAME = 'discountCodes.json';

export class DiscountDataHelper extends DatabaseHelper {
  async findAll(): Promise<DiscountCode[]> {
    return this.readFile<DiscountCode>(FILENAME);
  }

  async findByCode(code: string): Promise<DiscountCode | null> {
    const all = await this.findAll();
    const normalized = code.trim().toUpperCase();
    return all.find(d => d.code === normalized) ?? null;
  }

  async create(data: Omit<DiscountCode, 'discount_id' | 'used_count' | 'created_at' | 'updated_at'>): Promise<DiscountCode> {
    const all = await this.findAll();
    const created: DiscountCode = {
      ...data,
      discount_id: this.generate12DigitAlphanumericId(),
      used_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    all.push(created);
    this.writeFile<DiscountCode>(FILENAME, all);
    return created;
  }

  async update(discountId: string, patch: Partial<DiscountCode>): Promise<DiscountCode | null> {
    const all = await this.findAll();
    const index = all.findIndex(d => d.discount_id === discountId);
    if (index === -1) return null;
    all[index] = { ...all[index], ...patch, updated_at: new Date().toISOString() };
    this.writeFile<DiscountCode>(FILENAME, all);
    return all[index];
  }

  async delete(discountId: string): Promise<boolean> {
    const all = await this.findAll();
    const remaining = all.filter(d => d.discount_id !== discountId);
    if (remaining.length === all.length) return false;
    this.writeFile<DiscountCode>(FILENAME, remaining);
    return true;
  }

  async incrementUse(discountId: string): Promise<void> {
    const all = await this.findAll();
    const index = all.findIndex(d => d.discount_id === discountId);
    if (index === -1) return;
    all[index].used_count = (all[index].used_count || 0) + 1;
    all[index].updated_at = new Date().toISOString();
    this.writeFile<DiscountCode>(FILENAME, all);
  }
}
