import { DatabaseHelper } from './DatabaseHelper.js';
import { Event } from '../models/types.js';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export class EventDataHelper extends DatabaseHelper {
  private readonly filename = 'events.json';
  private galleriesDir: string;
  private eventsFlyersDir: string;

  constructor() {
    super();
    // Get the galleries directory path using the same approach as DatabaseHelper
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    this.galleriesDir = join(__dirname, '../../data/Galleries');
    this.eventsFlyersDir = join(__dirname, '../../data/Events_Flyers');
    this.ensureGalleriesDir();
    this.ensureEventsFlyersDir();
  }

  private ensureGalleriesDir(): void {
    if (!existsSync(this.galleriesDir)) {
      mkdirSync(this.galleriesDir, { recursive: true });
    }
  }

  private ensureEventsFlyersDir(): void {
    if (!existsSync(this.eventsFlyersDir)) {
      mkdirSync(this.eventsFlyersDir, { recursive: true });
    }
  }

  private sanitizeFolderName(name: string): string {
    // Replace invalid characters with hyphens
    return name
      .replace(/[<>:"/\\|?*]/g, '-')  // Replace invalid filename characters
      .replace(/\s+/g, '-')            // Replace spaces with hyphens
      .replace(/-+/g, '-')             // Replace multiple hyphens with single
      .replace(/^-|-$/g, '')           // Remove leading/trailing hyphens
      .trim();
  }

  private createEventGalleryFolder(event: Event): string {
    const folderName = `${this.sanitizeFolderName(event.event_name)}-${event.year}-${event.event_id}`;
    const folderPath = join(this.galleriesDir, folderName);
    
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
    }
    
    // Set photo_gallery_link to the folder name (relative path from Galleries directory)
    // This will be used to identify which folder contains photos for this event
    const folderRelativePath = folderName;
    
    return folderPath;
  }

  private createEventImageFolder(event: Event): string {
    const folderName = `${this.sanitizeFolderName(event.event_name)}-${event.event_id}`;
    const folderPath = join(this.eventsFlyersDir, folderName);
    
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
    }
    
    return folderName;
  }

  async findAll(): Promise<Event[]> {
    const events = this.readFile<Event>(this.filename);
    return events;
  }

  async findById(eventId: string): Promise<Event | null> {
    const events = await this.findAll();
    return events.find(e => e.event_id === eventId || e.id === eventId) || null;
  }

  async findActive(): Promise<Event[]> {
    const events = await this.findAll();
    return events.filter(e => e.is_active !== false).sort((a, b) => 
      new Date(a.event_start_dt || a.date || '').getTime() - new Date(b.event_start_dt || b.date || '').getTime()
    );
  }

  async findUpcoming(): Promise<Event[]> {
    const now = new Date();
    const events = await this.findActive();
    return events.filter(e => {
      const eventDate = new Date(e.event_start_dt || e.date || '');
      return eventDate >= now;
    });
  }

  async findPast(): Promise<Event[]> {
    const now = new Date();
    const events = await this.findActive();
    return events.filter(e => {
      const eventDate = new Date(e.event_end_dt || e.event_start_dt || e.date || '');
      return eventDate < now;
    });
  }

  async create(event: Omit<Event, 'event_id' | 'created_at' | 'updated_at'>): Promise<Event> {
    const events = await this.findAll();
    
    // Generate unique 12-digit alphanumeric event_id
    let event_id: string;
    let exists = true;
    while (exists) {
      event_id = this.generate12DigitAlphanumericId();
      const existing = events.find(e => e.event_id === event_id);
      exists = existing !== undefined;
    }

    const newEvent: Event = {
      ...event,
      event_id: event_id!,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      gallery_is_public: event.gallery_is_public !== undefined ? event.gallery_is_public : false, // Default to private
      is_priority: event.is_priority !== undefined ? event.is_priority : false, // Default to false
    };
    
    // Create gallery folder for the new event and set photo_gallery_link
    const folderName = `${this.sanitizeFolderName(newEvent.event_name)}-${newEvent.year}-${newEvent.event_id}`;
    this.createEventGalleryFolder(newEvent);
    
    // Set photo_gallery_link to folder name if not already set
    if (!newEvent.photo_gallery_link) {
      newEvent.photo_gallery_link = folderName;
    }
    
    // Create event image folder and set event_image_path
    const imageFolderName = this.createEventImageFolder(newEvent);
    if (!newEvent.event_image_path) {
      newEvent.event_image_path = imageFolderName;
    }
    
    events.push(newEvent);
    this.writeFile(this.filename, events);
    
    return newEvent;
  }

  async update(eventId: string, updates: Partial<Omit<Event, 'event_id' | 'created_at'>>): Promise<Event | null> {
    const events = await this.findAll();
    const index = events.findIndex(e => e.event_id === eventId || e.id === eventId);
    if (index === -1) return null;
    
    // If setting this event as priority, unset priority from all other events
    if (updates.is_priority === true) {
      events.forEach((event, i) => {
        if (i !== index && event.event_id !== eventId && event.is_priority === true) {
          event.is_priority = false;
        }
      });
    }
    
    events[index] = {
      ...events[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.writeFile(this.filename, events);
    return events[index];
  }

  async delete(eventId: string): Promise<boolean> {
    const events = await this.findAll();
    const eventToDelete = events.find(e => e.event_id === eventId || e.id === eventId);
    
    if (!eventToDelete) return false;
    
    // Delete the event image folder if it exists
    if (eventToDelete.event_image_path) {
      const folderPath = join(this.eventsFlyersDir, eventToDelete.event_image_path);
      if (existsSync(folderPath)) {
        try {
          rmSync(folderPath, { recursive: true, force: true });
        } catch (error) {
          console.error(`Error deleting event image folder ${folderPath}:`, error);
          // Continue with event deletion even if folder deletion fails
        }
      }
    }
    
    // Delete the event record
    const filtered = events.filter(e => e.event_id !== eventId && e.id !== eventId);
    this.writeFile(this.filename, filtered);
    return true;
  }

  async getEventImageFolderPath(eventId: string): Promise<string | null> {
    const events = await this.findAll();
    const event = events.find(e => e.event_id === eventId || e.id === eventId);
    if (event && event.event_image_path) {
      return join(this.eventsFlyersDir, event.event_image_path);
    }
    return null;
  }

  async deactivate(eventId: string): Promise<Event | null> {
    // When deactivating an event, also unpublish the gallery automatically
    return this.update(eventId, { 
      is_active: false,
      gallery_is_public: false 
    });
  }

  async activate(eventId: string): Promise<Event | null> {
    // When activating an event, do NOT automatically publish the gallery
    // Admin needs to manually publish the gallery if needed
    return this.update(eventId, { is_active: true });
  }

  // Create gallery folders for all existing events
  async createGalleryFoldersForAllEvents(): Promise<void> {
    const events = await this.findAll();
    events.forEach(event => {
      try {
        this.createEventGalleryFolder(event);
      } catch (error) {
        console.error(`Failed to create folder for event ${event.event_id}:`, error);
      }
    });
  }

  // Get the gallery folder path for an event
  getEventGalleryFolderPath(event: Event): string {
    const folderName = `${this.sanitizeFolderName(event.event_name)}-${event.year}-${event.event_id}`;
    return join(this.galleriesDir, folderName);
  }

  // List all gallery folders with event data
  async listGalleryFolders(): Promise<Array<{ folderName: string; folderPath: string; event_id?: string; event_name?: string; year?: number; gallery_is_public?: boolean; is_active?: boolean; event_start_dt?: string }>> {
    const folders: Array<{ folderName: string; folderPath: string; event_id?: string; event_name?: string; year?: number; gallery_is_public?: boolean; is_active?: boolean; event_start_dt?: string }> = [];
    
    if (!existsSync(this.galleriesDir)) {
      console.warn(`Gallery directory does not exist: ${this.galleriesDir}`);
      return folders;
    }

    // Get all events to match with folders
    const events = await this.findAll();
    console.log(`Found ${events.length} events to match with folders`);
    const eventsMap = new Map(events.map(e => [e.event_id, e]));

    const entries = readdirSync(this.galleriesDir, { withFileTypes: true });
    console.log(`Found ${entries.length} entries in gallery directory`);

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const folderPath = join(this.galleriesDir, entry.name);
        // Parse folder name: event_name-year-event_id
        const parts = entry.name.match(/^(.+)-(\d{4})-(.+)$/);
        if (parts) {
          const event_id = parts[3];
          const event = eventsMap.get(event_id);
          folders.push({
            folderName: entry.name,
            folderPath,
            event_name: parts[1].replace(/-/g, ' '),
            year: parseInt(parts[2]),
            event_id: event_id,
            gallery_is_public: event?.gallery_is_public ?? false,
            is_active: event?.is_active ?? false,
            event_start_dt: event?.event_start_dt,
          });
        } else {
          // For folders that don't match the pattern, just include the name
          folders.push({
            folderName: entry.name,
            folderPath,
          });
        }
      }
    }

    // Sort by event start date descending (most recent first)
    return folders.sort((a, b) => {
      const dateA = a.event_start_dt ? new Date(a.event_start_dt).getTime() : 0;
      const dateB = b.event_start_dt ? new Date(b.event_start_dt).getTime() : 0;
      return dateB - dateA; // Descending order (newest first)
    });
  }
}

