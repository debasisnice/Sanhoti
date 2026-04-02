import { DatabaseHelper } from './DatabaseHelper.js';
import { Event } from '../models/types.js';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs';
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

  private effectiveEventType(e: Pick<Event, 'event_type'>): 'Festival' | 'Charity' | 'Other' {
    const t = e.event_type;
    if (t === 'Festival' || t === 'Charity' || t === 'Other') return t;
    return 'Festival';
  }

  /** JSON/clients may store priority as string or 1/0 — normalize so per-type priority logic always runs. */
  private normalizePriorityFlag(value: unknown): boolean {
    if (value === true || value === 1) return true;
    if (value === false || value === 0 || value === null || value === undefined) return false;
    if (typeof value === 'string') {
      const s = value.trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes';
    }
    return false;
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

  /** Events that have not ended yet (includes not started and in-progress multi-day). */
  async findUpcoming(): Promise<Event[]> {
    const now = new Date();
    const events = await this.findActive();
    return events.filter(e => {
      const endDate = new Date(e.event_end_dt || e.event_start_dt || e.date || '');
      return endDate >= now;
    });
  }

  /** Events that have fully ended. Mutually exclusive with findUpcoming for well-formed ranges. */
  async findPast(): Promise<Event[]> {
    const now = new Date();
    const events = await this.findActive();
    return events.filter(e => {
      const endDate = new Date(e.event_end_dt || e.event_start_dt || e.date || '');
      return endDate < now;
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
      is_priority: this.normalizePriorityFlag(
        event.is_priority !== undefined ? event.is_priority : false
      ),
    };

    // One priority per event type (Festival / Charity / Other)
    if (newEvent.is_priority) {
      const typeKey = this.effectiveEventType(newEvent);
      events.forEach((existingEvent) => {
        if (
          this.normalizePriorityFlag(existingEvent.is_priority) &&
          this.effectiveEventType(existingEvent) === typeKey
        ) {
          existingEvent.is_priority = false;
        }
      });
    }
    
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

    const merged: Event = {
      ...events[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    merged.is_priority = this.normalizePriorityFlag(merged.is_priority);

    // One priority per event type; uses merged event_type + is_priority
    if (merged.is_priority) {
      const typeKey = this.effectiveEventType(merged);
      events.forEach((ev) => {
        if (ev.event_id === eventId || ev.id === eventId) return;
        if (this.normalizePriorityFlag(ev.is_priority) && this.effectiveEventType(ev) === typeKey) {
          ev.is_priority = false;
        }
      });
    }

    events[index] = merged;
    this.writeFile(this.filename, events);
    return merged;
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

  /**
   * Absolute path to the Events_Flyers folder that contains this event's flyer image(s).
   * Uses `event_image_path` when valid; otherwise finds a directory whose name ends with `-{eventId}` (upload folder convention).
   */
  async getEventImageFolderPath(eventId: string): Promise<string | null> {
    const events = await this.findAll();
    const event = events.find((e) => e.event_id === eventId || e.id === eventId);
    if (!event) return null;

    const tryFolderWithImages = (absolutePath: string | null): string | null => {
      if (!absolutePath || !existsSync(absolutePath)) return null;
      try {
        const files = readdirSync(absolutePath);
        const hasImage = files.some((file) => {
          try {
            const fp = join(absolutePath, file);
            const stats = statSync(fp);
            return stats.isFile() && /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
          } catch {
            return false;
          }
        });
        return hasImage ? absolutePath : null;
      } catch {
        return null;
      }
    };

    if (event.event_image_path) {
      const p = join(this.eventsFlyersDir, event.event_image_path);
      const hit = tryFolderWithImages(p);
      if (hit) return hit;
    }

    if (!existsSync(this.eventsFlyersDir)) return null;

    const candidateIds = [event.event_id, event.id].filter(Boolean) as string[];
    for (const id of candidateIds) {
      const suffix = `-${id}`;
      for (const ent of readdirSync(this.eventsFlyersDir, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue;
        if (!ent.name.endsWith(suffix)) continue;
        const p = join(this.eventsFlyersDir, ent.name);
        const hit = tryFolderWithImages(p);
        if (hit) return hit;
      }
    }

    return null;
  }

  /**
   * First image in the event's gallery folder for social previews when no flyer exists.
   * Uses only `photo_gallery_link` so `/api/galleries/:eventId/photos/:filename` can serve the same file.
   */
  getFirstGalleryImageForPreview(event: Event): { absPath: string; filename: string } | null {
    if (!event.photo_gallery_link) return null;
    const folderPath = join(this.galleriesDir, event.photo_gallery_link);
    if (!existsSync(folderPath)) return null;
    const files = readdirSync(folderPath)
      .filter((file) => {
        try {
          const fp = join(folderPath, file);
          return statSync(fp).isFile() && /\.(jpe?g|jpeg|png|gif|webp)$/i.test(file);
        } catch {
          return false;
        }
      })
      .sort();
    if (files.length === 0) return null;
    const fn = files[0];
    return { absPath: join(folderPath, fn), filename: fn };
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
  // This method now returns ALL events, creating missing folders automatically
  async listGalleryFolders(): Promise<Array<{ folderName: string; folderPath: string; event_id?: string; event_name?: string; year?: number; gallery_is_public?: boolean; is_active?: boolean; event_start_dt?: string }>> {
    const folders: Array<{ folderName: string; folderPath: string; event_id?: string; event_name?: string; year?: number; gallery_is_public?: boolean; is_active?: boolean; event_start_dt?: string }> = [];
    
    // Ensure galleries directory exists
    this.ensureGalleriesDir();

    // Get all events
    const events = await this.findAll();
    const eventsMap = new Map(events.map(e => [e.event_id, e]));
    const processedEventIds = new Set<string>();

    // First, process existing folders in the file system
    if (existsSync(this.galleriesDir)) {
      const entries = readdirSync(this.galleriesDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const folderPath = join(this.galleriesDir, entry.name);
          // Parse folder name: event_name-year-event_id
          const parts = entry.name.match(/^(.+)-(\d{4})-(.+)$/);
          if (parts) {
            const event_id = parts[3];
            const event = eventsMap.get(event_id);
            if (event) {
              processedEventIds.add(event_id);
              folders.push({
                folderName: entry.name,
                folderPath,
                event_name: parts[1].replace(/-/g, ' '),
                year: parseInt(parts[2]),
                event_id: event_id,
                gallery_is_public: event.gallery_is_public ?? false,
                is_active: event.is_active ?? false,
                event_start_dt: event.event_start_dt,
              });
            }
          } else {
            // For folders that don't match the pattern, just include the name
            folders.push({
              folderName: entry.name,
              folderPath,
            });
          }
        }
      }
    }

    // Second, create folders for events that don't have one yet
    for (const event of events) {
      if (!processedEventIds.has(event.event_id)) {
        try {
          // Create the folder if it doesn't exist
          const folderPath = this.createEventGalleryFolder(event);
          const folderName = `${this.sanitizeFolderName(event.event_name)}-${event.year}-${event.event_id}`;
          
          // Set photo_gallery_link if not already set
          if (!event.photo_gallery_link) {
            event.photo_gallery_link = folderName;
            // Update the event in the database
            await this.update(event.event_id, { photo_gallery_link: folderName });
          }
          
          folders.push({
            folderName,
            folderPath,
            event_name: event.event_name,
            year: event.year,
            event_id: event.event_id,
            gallery_is_public: event.gallery_is_public ?? false,
            is_active: event.is_active ?? false,
            event_start_dt: event.event_start_dt,
          });
        } catch (error) {
          console.error(`Failed to create folder for event ${event.event_id}:`, error);
          // Still add the event to the list even if folder creation failed
          const folderName = event.photo_gallery_link || `${this.sanitizeFolderName(event.event_name)}-${event.year}-${event.event_id}`;
          folders.push({
            folderName,
            folderPath: join(this.galleriesDir, folderName),
            event_name: event.event_name,
            year: event.year,
            event_id: event.event_id,
            gallery_is_public: event.gallery_is_public ?? false,
            is_active: event.is_active ?? false,
            event_start_dt: event.event_start_dt,
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

