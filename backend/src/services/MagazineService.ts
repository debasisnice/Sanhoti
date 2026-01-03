import { MagazineDataHelper } from '../data/MagazineDataHelper.js';
import { Magazine } from '../models/types.js';

export class MagazineService {
  private magazineDataHelper: MagazineDataHelper;

  constructor() {
    this.magazineDataHelper = new MagazineDataHelper();
  }

  async getPublicMagazines(): Promise<Magazine[]> {
    return this.magazineDataHelper.findPublic();
  }

  async getAllMagazines(): Promise<Magazine[]> {
    return this.magazineDataHelper.findAll();
  }

  async getMagazineById(id: string): Promise<Magazine | null> {
    return this.magazineDataHelper.findById(id);
  }

  async getMagazineByAccessCode(code: string): Promise<Magazine | null> {
    return this.magazineDataHelper.findByAccessCode(code);
  }

  async createMagazine(data: {
    title: string;
    description?: string;
    fileUrl: string;
    coverImageUrl?: string;
    isPublic: boolean;
    specialAccessCode?: string;
    publishDate: string;
    createdBy: string;
  }): Promise<Magazine> {
    return this.magazineDataHelper.create(data);
  }

  async updateMagazine(id: string, updates: Partial<Omit<Magazine, 'id' | 'createdAt' | 'createdBy'>>): Promise<Magazine | null> {
    return this.magazineDataHelper.update(id, updates);
  }

  async deleteMagazine(id: string): Promise<boolean> {
    return this.magazineDataHelper.delete(id);
  }
}

