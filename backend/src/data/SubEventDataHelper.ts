import { DatabaseHelper } from './DatabaseHelper.js';
import { SubEvent } from '../models/types.js';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export class SubEventDataHelper extends DatabaseHelper {
  private readonly filename = 'subEvents.json';
  private eventsFlyersDir: string;

  constructor() {
    super();
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    this.eventsFlyersDir = join(__dirname, '../../data/Events_Flyers');
    this.ensureEventsFlyersDir();
  }

  private ensureEventsFlyersDir(): void {
    if (!existsSync(this.eventsFlyersDir)) {
      mkdirSync(this.eventsFlyersDir, { recursive: true });
    }
  }

  private sanitizeFolderName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .trim();
  }

  async findAll(): Promise<SubEvent[]> {
    return this.readFile<SubEvent>(this.filename);
  }

  async findById(id: string): Promise<SubEvent | null> {
    const subEvents = await this.findAll();
    return subEvents.find(se => se.sub_event_id === id) || null;
  }

  async findByEventId(eventId: string): Promise<SubEvent[]> {
    const subEvents = await this.findAll();
    return subEvents.filter(se => se.event_id === eventId);
  }

  async create(subEvent: Omit<SubEvent, 'sub_event_id' | 'created_at' | 'updated_at'>): Promise<SubEvent> {
    const subEvents = await this.findAll();
    
    // Generate unique 12-digit alphanumeric sub_event_id
    let sub_event_id: string;
    let exists = true;
    while (exists) {
      sub_event_id = this.generate12DigitAlphanumericId();
      const existing = subEvents.find(se => se.sub_event_id === sub_event_id);
      exists = existing !== undefined;
    }

    const newSubEvent: SubEvent = {
      ...subEvent,
      sub_event_id: sub_event_id!,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Create sub-event folder inside parent event folder
    const parentEventFolder = join(this.eventsFlyersDir, `event-${subEvent.event_id}`);
    if (existsSync(parentEventFolder)) {
      const subEventFolderName = `${this.sanitizeFolderName(subEvent.sub_event_name)}-${sub_event_id}`;
      const subEventFolderPath = join(parentEventFolder, subEventFolderName);
      if (!existsSync(subEventFolderPath)) {
        mkdirSync(subEventFolderPath, { recursive: true });
      }
      newSubEvent.event_image_path = subEventFolderName;
    }

    subEvents.push(newSubEvent);
    this.writeFile(this.filename, subEvents);
    return newSubEvent;
  }

  async update(id: string, updates: Partial<SubEvent>): Promise<SubEvent | null> {
    const subEvents = await this.findAll();
    const index = subEvents.findIndex(se => se.sub_event_id === id);
    
    if (index === -1) {
      return null;
    }

    const updatedSubEvent: SubEvent = {
      ...subEvents[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // If sub_event_name changed, update folder name
    if (updates.sub_event_name && updates.sub_event_name !== subEvents[index].sub_event_name) {
      const parentEventFolder = join(this.eventsFlyersDir, `event-${subEvents[index].event_id}`);
      const oldFolderName = subEvents[index].event_image_path;
      if (oldFolderName && existsSync(join(parentEventFolder, oldFolderName))) {
        const newFolderName = `${this.sanitizeFolderName(updates.sub_event_name)}-${id}`;
        const oldPath = join(parentEventFolder, oldFolderName);
        const newPath = join(parentEventFolder, newFolderName);
        try {
          const { renameSync } = await import('fs');
          renameSync(oldPath, newPath);
          updatedSubEvent.event_image_path = newFolderName;
        } catch (error) {
          // If rename fails, keep old folder name
        }
      }
    }

    subEvents[index] = updatedSubEvent;
    this.writeFile(this.filename, subEvents);
    return updatedSubEvent;
  }

  async delete(id: string): Promise<boolean> {
    const subEvents = await this.findAll();
    const index = subEvents.findIndex(se => se.sub_event_id === id);
    
    if (index === -1) {
      return false;
    }

    const subEvent = subEvents[index];
    
    // Delete sub-event folder and its contents
    if (subEvent.event_image_path) {
      const parentEventFolder = join(this.eventsFlyersDir, `event-${subEvent.event_id}`);
      const subEventFolderPath = join(parentEventFolder, subEvent.event_image_path);
      if (existsSync(subEventFolderPath)) {
        try {
          const { rmSync } = await import('fs');
          rmSync(subEventFolderPath, { recursive: true, force: true });
        } catch (error) {
          // Continue even if folder deletion fails
        }
      }
    }

    subEvents.splice(index, 1);
    this.writeFile(this.filename, subEvents);
    return true;
  }

  getSubEventImagePath(subEvent: SubEvent): string | null {
    if (subEvent && subEvent.event_image_path) {
      const parentEventFolder = join(this.eventsFlyersDir, `event-${subEvent.event_id}`);
      return join(parentEventFolder, subEvent.event_image_path);
    }
    return null;
  }

  async getSubEventImages(subEventId: string): Promise<string[]> {
    const subEvent = await this.findById(subEventId);
    if (!subEvent || !subEvent.event_image_path) {
      return [];
    }

    const parentEventFolder = join(this.eventsFlyersDir, `event-${subEvent.event_id}`);
    const subEventFolderPath = join(parentEventFolder, subEvent.event_image_path);
    
    if (!existsSync(subEventFolderPath)) {
      return [];
    }

    try {
      const files = readdirSync(subEventFolderPath);
      return files
        .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
        .map(file => join(subEventFolderPath, file));
    } catch (error) {
      return [];
    }
  }

  async deleteSubEventImage(subEventId: string, filename: string): Promise<boolean> {
    const subEvent = await this.findById(subEventId);
    if (!subEvent || !subEvent.event_image_path) {
      return false;
    }

    const parentEventFolder = join(this.eventsFlyersDir, `event-${subEvent.event_id}`);
    const subEventFolderPath = join(parentEventFolder, subEvent.event_image_path);
    const imagePath = join(subEventFolderPath, filename);
    
    if (existsSync(imagePath)) {
      try {
        unlinkSync(imagePath);
        return true;
      } catch (error) {
        return false;
      }
    }
    return false;
  }
}

