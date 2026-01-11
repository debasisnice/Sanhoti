import { DatabaseHelper } from './DatabaseHelper.js';
import { SubEvent } from '../models/types.js';
import { EventDataHelper } from './EventDataHelper.js';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export class SubEventDataHelper extends DatabaseHelper {
  private readonly filename = 'subEvents.json';
  private eventsFlyersDir: string;
  private eventDataHelper: EventDataHelper;

  constructor() {
    super();
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    this.eventsFlyersDir = join(__dirname, '../../data/Events_Flyers');
    this.eventDataHelper = new EventDataHelper();
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

    // Get parent event to find its folder name
    const parentEvent = await this.eventDataHelper.findById(subEvent.event_id);
    if (!parentEvent) {
      throw new Error('Parent event not found');
    }

    // Use parent event's event_image_path as folder name, or create it if it doesn't exist
    let parentEventFolderName: string;
    if (parentEvent.event_image_path) {
      parentEventFolderName = parentEvent.event_image_path;
    } else {
      // Create folder name using same pattern as EventDataHelper
      parentEventFolderName = `${this.sanitizeFolderName(parentEvent.event_name)}-${parentEvent.event_id}`;
      // Update parent event with event_image_path
      await this.eventDataHelper.update(subEvent.event_id, { event_image_path: parentEventFolderName });
    }

    // Create sub-event folder inside parent event folder
    const parentEventFolder = join(this.eventsFlyersDir, parentEventFolderName);
    if (!existsSync(parentEventFolder)) {
      mkdirSync(parentEventFolder, { recursive: true });
    }
    
    // Create sub-event folder
    const subEventFolderName = `${this.sanitizeFolderName(subEvent.sub_event_name)}-${sub_event_id!}`;
    const subEventFolderPath = join(parentEventFolder, subEventFolderName);
    if (!existsSync(subEventFolderPath)) {
      mkdirSync(subEventFolderPath, { recursive: true });
    }
    newSubEvent.event_image_path = subEventFolderName;

    // Limit show_in_home_page to maximum 3 per parent event
    if (newSubEvent.show_in_home_page === true) {
      // Get all sub-events for the same parent event that currently have show_in_home_page: true
      const alreadyShowing = subEvents
        .filter(se => se.event_id === subEvent.event_id && se.show_in_home_page === true)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      
      // If there are already 3 or more showing, set the oldest ones to false
      // We want to keep only the 3 most recently updated ones (including the new one being created)
      if (alreadyShowing.length >= 3) {
        // Keep only the 2 most recently updated ones, set others to false
        // Since we're adding a new one, we need to set the oldest of the existing ones to false
        alreadyShowing.slice(2).forEach(se => {
          const idx = subEvents.findIndex(s => s.sub_event_id === se.sub_event_id);
          if (idx !== -1) {
            subEvents[idx].show_in_home_page = false;
            subEvents[idx].updated_at = new Date().toISOString();
          }
        });
      }
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

    // Handle removal of optional fields (if set to null, remove the property)
    if ('rsvp_link' in updates && updates.rsvp_link === null) {
      delete updatedSubEvent.rsvp_link;
    }

    // Limit show_in_home_page to maximum 3 per parent event
    if ('show_in_home_page' in updates && updates.show_in_home_page === true) {
      const parentEventId = subEvents[index].event_id;
      
      // Get all sub-events for the same parent event that currently have show_in_home_page: true
      // Exclude the current sub-event being updated
      const alreadyShowing = subEvents
        .filter(se => se.event_id === parentEventId && se.sub_event_id !== id && se.show_in_home_page === true)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      
      // If there are already 3 or more showing, set the oldest ones to false
      // We want to keep only 3 total (the current one being updated + 2 others)
      if (alreadyShowing.length >= 3) {
        // Keep only the 2 most recently updated ones, set others to false
        alreadyShowing.slice(2).forEach(se => {
          const idx = subEvents.findIndex(s => s.sub_event_id === se.sub_event_id);
          if (idx !== -1) {
            subEvents[idx].show_in_home_page = false;
            subEvents[idx].updated_at = new Date().toISOString();
          }
        });
      }
      // If alreadyShowing.length === 0, 1, or 2, we're adding the 1st, 2nd, or 3rd one, that's fine
    }

    // If sub_event_name changed, update folder name
    if (updates.sub_event_name && updates.sub_event_name !== subEvents[index].sub_event_name) {
      // Get parent event to find its folder name
      const parentEvent = await this.eventDataHelper.findById(subEvents[index].event_id);
      if (parentEvent) {
        const parentEventFolderName = parentEvent.event_image_path || `${this.sanitizeFolderName(parentEvent.event_name)}-${parentEvent.event_id}`;
        const parentEventFolder = join(this.eventsFlyersDir, parentEventFolderName);
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
      // Get parent event to find its folder name
      const parentEvent = await this.eventDataHelper.findById(subEvent.event_id);
      if (parentEvent) {
        const parentEventFolderName = parentEvent.event_image_path || `${this.sanitizeFolderName(parentEvent.event_name)}-${parentEvent.event_id}`;
        const parentEventFolder = join(this.eventsFlyersDir, parentEventFolderName);
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
    }

    subEvents.splice(index, 1);
    this.writeFile(this.filename, subEvents);
    return true;
  }

  async getSubEventImagePath(subEvent: SubEvent): Promise<string | null> {
    if (subEvent && subEvent.event_image_path) {
      const parentEvent = await this.eventDataHelper.findById(subEvent.event_id);
      if (parentEvent) {
        const parentEventFolderName = parentEvent.event_image_path || `${this.sanitizeFolderName(parentEvent.event_name)}-${parentEvent.event_id}`;
        const parentEventFolder = join(this.eventsFlyersDir, parentEventFolderName);
        return join(parentEventFolder, subEvent.event_image_path);
      }
    }
    return null;
  }

  async getSubEventImages(subEventId: string): Promise<string[]> {
    const subEvent = await this.findById(subEventId);
    if (!subEvent || !subEvent.event_image_path) {
      return [];
    }

    const parentEvent = await this.eventDataHelper.findById(subEvent.event_id);
    if (!parentEvent) {
      return [];
    }

    const parentEventFolderName = parentEvent.event_image_path || `${this.sanitizeFolderName(parentEvent.event_name)}-${parentEvent.event_id}`;
    const parentEventFolder = join(this.eventsFlyersDir, parentEventFolderName);
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

    const parentEvent = await this.eventDataHelper.findById(subEvent.event_id);
    if (!parentEvent) {
      return false;
    }

    const parentEventFolderName = parentEvent.event_image_path || `${this.sanitizeFolderName(parentEvent.event_name)}-${parentEvent.event_id}`;
    const parentEventFolder = join(this.eventsFlyersDir, parentEventFolderName);
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

