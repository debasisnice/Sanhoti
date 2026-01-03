import { DatabaseHelper } from './DatabaseHelper.js';
import { PhotoGallery } from '../models/types.js';

export class GalleryDataHelper extends DatabaseHelper {
  private readonly filename = 'galleries.json';

  async findAll(): Promise<PhotoGallery[]> {
    return this.readFile<PhotoGallery>(this.filename);
  }

  async findById(id: string): Promise<PhotoGallery | null> {
    const galleries = await this.findAll();
    return galleries.find(g => g.id === id) || null;
  }

  async findPublic(): Promise<PhotoGallery[]> {
    const galleries = await this.findAll();
    return galleries.filter(g => g.isPublic);
  }

  async findByEventId(eventId: string): Promise<PhotoGallery[]> {
    const galleries = await this.findAll();
    return galleries.filter(g => g.eventId === eventId);
  }

  async findByAccessCode(code: string): Promise<PhotoGallery | null> {
    const galleries = await this.findAll();
    return galleries.find(g => g.specialAccessCode === code) || null;
  }

  async create(gallery: Omit<PhotoGallery, 'id' | 'createdAt' | 'updatedAt'>): Promise<PhotoGallery> {
    const galleries = await this.findAll();
    const newGallery: PhotoGallery = {
      ...gallery,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    galleries.push(newGallery);
    this.writeFile(this.filename, galleries);
    return newGallery;
  }

  async update(id: string, updates: Partial<PhotoGallery>): Promise<PhotoGallery | null> {
    const galleries = await this.findAll();
    const index = galleries.findIndex(g => g.id === id);
    if (index === -1) return null;
    
    galleries[index] = {
      ...galleries[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.writeFile(this.filename, galleries);
    return galleries[index];
  }

  async delete(id: string): Promise<boolean> {
    const galleries = await this.findAll();
    const filtered = galleries.filter(g => g.id !== id);
    if (filtered.length === galleries.length) return false;
    this.writeFile(this.filename, filtered);
    return true;
  }
}

