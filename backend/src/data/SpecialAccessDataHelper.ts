import { DatabaseHelper } from './DatabaseHelper.js';
import { SpecialAccessCode } from '../models/types.js';

export class SpecialAccessDataHelper extends DatabaseHelper {
  private readonly filename = 'specialAccessCodes.json';

  async findAll(): Promise<SpecialAccessCode[]> {
    return this.readFile<SpecialAccessCode>(this.filename);
  }

  async findById(id: string): Promise<SpecialAccessCode | null> {
    const codes = await this.findAll();
    return codes.find(c => c.id === id) || null;
  }

  async findByCode(code: string): Promise<SpecialAccessCode | null> {
    const codes = await this.findAll();
    const now = new Date().toISOString();
    return codes.find(c => {
      if (c.code !== code) return false;
      if (!c.isActive) return false;
      if (c.expiresAt && new Date(c.expiresAt) < new Date(now)) return false;
      return true;
    }) || null;
  }

  async create(code: Omit<SpecialAccessCode, 'id' | 'createdAt'>): Promise<SpecialAccessCode> {
    const codes = await this.findAll();
    const newCode: SpecialAccessCode = {
      ...code,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    };
    codes.push(newCode);
    this.writeFile(this.filename, codes);
    return newCode;
  }

  async update(id: string, updates: Partial<SpecialAccessCode>): Promise<SpecialAccessCode | null> {
    const codes = await this.findAll();
    const index = codes.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    codes[index] = {
      ...codes[index],
      ...updates,
    };
    this.writeFile(this.filename, codes);
    return codes[index];
  }

  async delete(id: string): Promise<boolean> {
    const codes = await this.findAll();
    const filtered = codes.filter(c => c.id !== id);
    if (filtered.length === codes.length) return false;
    this.writeFile(this.filename, filtered);
    return true;
  }
}

