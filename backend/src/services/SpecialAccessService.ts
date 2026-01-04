import { SpecialAccessDataHelper } from '../data/SpecialAccessDataHelper.js';
import { SpecialAccessCode } from '../models/types.js';

export class SpecialAccessService {
  private specialAccessDataHelper: SpecialAccessDataHelper;

  constructor() {
    this.specialAccessDataHelper = new SpecialAccessDataHelper();
  }

  generateCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  async createCode(data: {
    description?: string;
    resourceType: 'gallery' | 'magazine' | 'all';
    resourceId?: string;
    expiresAt?: string;
    createdBy: string;
  }): Promise<SpecialAccessCode> {
    // Generate unique code
    let code: string;
    let exists = true;
    while (exists) {
      code = this.generateCode();
      const existing = await this.specialAccessDataHelper.findByCode(code);
      exists = existing !== null;
    }

    return this.specialAccessDataHelper.create({
      ...data,
      code: code!,
      isActive: true,
    });
  }

  async validateCode(code: string): Promise<SpecialAccessCode | null> {
    return this.specialAccessDataHelper.findByCode(code);
  }

  async getAllCodes(): Promise<SpecialAccessCode[]> {
    return this.specialAccessDataHelper.findAll();
  }

  async getCodeById(id: string): Promise<SpecialAccessCode | null> {
    return this.specialAccessDataHelper.findById(id);
  }

  async updateCode(id: string, updates: Partial<Omit<SpecialAccessCode, 'id' | 'createdAt' | 'createdBy'>>): Promise<SpecialAccessCode | null> {
    return this.specialAccessDataHelper.update(id, updates);
  }

  async deleteCode(id: string): Promise<boolean> {
    return this.specialAccessDataHelper.delete(id);
  }
}


