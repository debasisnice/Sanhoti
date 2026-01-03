import { EventDataHelper } from '../data/EventDataHelper.js';
import { Event, EventType } from '../models/types.js';

export class EventService {
  private eventDataHelper: EventDataHelper;

  constructor() {
    this.eventDataHelper = new EventDataHelper();
  }

  async getAllEvents(): Promise<Event[]> {
    return this.eventDataHelper.findAll();
  }

  async getActiveEvents(): Promise<Event[]> {
    return this.eventDataHelper.findActive();
  }

  async getUpcomingEvents(): Promise<Event[]> {
    return this.eventDataHelper.findUpcoming();
  }

  async getPastEvents(): Promise<Event[]> {
    return this.eventDataHelper.findPast();
  }

  async getEventById(id: string): Promise<Event | null> {
    return this.eventDataHelper.findById(id);
  }

  async createEvent(data: {
    event_name: string;
    event_start_dt: string;
    event_end_dt: string;
    year: number;
    event_description: string;
    location?: string;
    photo_gallery_link?: string;
    is_priority?: boolean;
  }): Promise<Event> {
    // Validate that end date is not before start date
    const startDate = new Date(data.event_start_dt);
    const endDate = new Date(data.event_end_dt);
    
    if (endDate < startDate) {
      throw new Error('End date cannot be prior to start date');
    }
    
    return this.eventDataHelper.create({
      event_name: data.event_name,
      event_start_dt: data.event_start_dt,
      event_end_dt: data.event_end_dt,
      year: data.year,
      event_description: data.event_description,
      location: data.location,
      photo_gallery_link: data.photo_gallery_link,
      is_active: true,
      is_priority: data.is_priority !== undefined ? data.is_priority : false,
    });
  }

  async updateEvent(eventId: string, updates: Partial<Omit<Event, 'event_id' | 'created_at'>>): Promise<Event | null> {
    // Validate date range if both dates are being updated
    if (updates.event_start_dt && updates.event_end_dt) {
      const startDate = new Date(updates.event_start_dt);
      const endDate = new Date(updates.event_end_dt);
      
      if (endDate < startDate) {
        throw new Error('End date cannot be prior to start date');
      }
    }
    
    // Validate date range if only one date is being updated
    const existingEvent = await this.eventDataHelper.findById(eventId);
    if (existingEvent) {
      const startDate = new Date(updates.event_start_dt || existingEvent.event_start_dt);
      const endDate = new Date(updates.event_end_dt || existingEvent.event_end_dt);
      
      if (endDate < startDate) {
        throw new Error('End date cannot be prior to start date');
      }
    }
    
    return this.eventDataHelper.update(eventId, updates);
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    return this.eventDataHelper.delete(eventId);
  }

  async deactivateEvent(eventId: string): Promise<Event | null> {
    return this.eventDataHelper.deactivate(eventId);
  }

  async activateEvent(eventId: string): Promise<Event | null> {
    return this.eventDataHelper.activate(eventId);
  }

  async getGalleryFolders(): Promise<Array<{ folderName: string; folderPath: string; event_id?: string; event_name?: string; year?: number; gallery_is_public?: boolean; is_active?: boolean; event_start_dt?: string }>> {
    return this.eventDataHelper.listGalleryFolders();
  }
}

