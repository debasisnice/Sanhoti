import { DatabaseHelper } from './DatabaseHelper.js';
import { Magazine } from '../models/types.js';

export class MagazineDataHelper extends DatabaseHelper {
  private readonly filename = 'magazines.json';

  async findAll(): Promise<Magazine[]> {
    return this.readFile<Magazine>(this.filename);
  }

  async findById(id: string): Promise<Magazine | null> {
    const magazines = await this.findAll();
    return magazines.find(m => m.id === id) || null;
  }

  async findPublic(): Promise<Magazine[]> {
    const magazines = await this.findAll();
    return magazines
      .filter(m => m.isPublic)
      .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
  }

  async findByAccessCode(code: string): Promise<Magazine | null> {
    const magazines = await this.findAll();
    return magazines.find(m => m.specialAccessCode === code) || null;
  }

  async create(magazine: Omit<Magazine, 'id' | 'createdAt' | 'updatedAt'>): Promise<Magazine> {
    const magazines = await this.findAll();
    const newMagazine: Magazine = {
      ...magazine,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    magazines.push(newMagazine);
    this.writeFile(this.filename, magazines);
    return newMagazine;
  }

  async update(id: string, updates: Partial<Magazine>): Promise<Magazine | null> {
    const magazines = await this.findAll();
    const index = magazines.findIndex(m => m.id === id);
    if (index === -1) return null;
    
    magazines[index] = {
      ...magazines[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.writeFile(this.filename, magazines);
    return magazines[index];
  }

  async delete(id: string): Promise<boolean> {
    const magazines = await this.findAll();
    const filtered = magazines.filter(m => m.id !== id);
    if (filtered.length === magazines.length) return false;
    this.writeFile(this.filename, filtered);
    return true;
  }
}


