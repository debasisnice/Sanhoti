import { EventDataHelper } from '../data/EventDataHelper.js';
import { DurgaPujaPageService } from './DurgaPujaPageService.js';
import { Event } from '../models/types.js';

const DURGA_NAME = /durga|durgotsav/i;

export class EventService {
  private eventDataHelper: EventDataHelper;
  private durgaPujaPageService: DurgaPujaPageService;

  constructor() {
    this.eventDataHelper = new EventDataHelper();
    this.durgaPujaPageService = new DurgaPujaPageService();
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
    const exact = await this.eventDataHelper.findById(id);
    if (exact) return exact;

    // SEO slug support: /events/<slug>-<eventId> — the raw id is the segment
    // after the last "-". Only tried when the exact lookup fails, so legacy
    // ids containing "-" (e.g. UUIDs) are unaffected.
    const lastSegment = id.split('-').pop();
    if (lastSegment && lastSegment !== id) {
      return this.eventDataHelper.findById(lastSegment);
    }
    return null;
  }

  async createEvent(data: {
    event_name: string;
    event_start_dt: string;
    event_end_dt: string;
    year: number;
    event_description: string;
    event_type?: 'Festival' | 'Charity' | 'Other';
    rsvp_enabled?: boolean;
    location?: string;
    photo_gallery_link?: string;
    is_priority?: boolean;
    rsvp_link?: string;
    is_active_durga_puja_event?: boolean;
  }): Promise<Event> {
    // Validate that end date is not before start date
    const startDate = new Date(data.event_start_dt);
    const endDate = new Date(data.event_end_dt);

    if (endDate < startDate) {
      throw new Error('End date cannot be prior to start date');
    }

    // "Active Durga Puja Event" flag rules:
    // - only Durga-named events can carry it
    // - if this is the first/only Durga event with no active one yet, it
    //   becomes active automatically (at least one must hold the flag)
    let activeDurgaFlag = data.is_active_durga_puja_event === true;
    if (activeDurgaFlag && !DURGA_NAME.test(data.event_name)) {
      throw new Error(
        'Only events whose name contains "Durga" can be marked as the Active Durga Puja Event'
      );
    }
    if (!activeDurgaFlag && DURGA_NAME.test(data.event_name)) {
      const existing = await this.findActiveDurgaPujaEvent();
      if (!existing) activeDurgaFlag = true; // first Durga event — must have one active
    }

    const eventType: 'Festival' | 'Charity' | 'Other' =
      data.event_type && ['Festival', 'Charity', 'Other'].includes(data.event_type)
        ? data.event_type
        : 'Festival';

    const created = await this.eventDataHelper.create({
      event_name: data.event_name,
      event_start_dt: data.event_start_dt,
      event_end_dt: data.event_end_dt,
      year: data.year,
      event_description: data.event_description,
      event_type: eventType,
      rsvp_enabled: data.rsvp_enabled,
      location: data.location,
      photo_gallery_link: data.photo_gallery_link,
      rsvp_link: data.rsvp_link,
      is_active: true,
      is_priority: data.is_priority !== undefined ? data.is_priority : false,
      is_active_durga_puja_event: activeDurgaFlag,
    });

    // If this is a Durga Puja event, sync its dates/venue to /durga-puja
    await this.durgaPujaPageService.syncFromEvent(created);

    return created;
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

    // "Active Durga Puja Event" flag rules
    if (existingEvent) {
      const effectiveName = updates.event_name ?? existingEvent.event_name;
      const isCurrentlyActive = existingEvent.is_active_durga_puja_event === true;

      if (updates.is_active_durga_puja_event === true && !DURGA_NAME.test(effectiveName || '')) {
        throw new Error(
          'Only events whose name contains "Durga" can be marked as the Active Durga Puja Event'
        );
      }
      if (updates.is_active_durga_puja_event === false && isCurrentlyActive) {
        throw new Error(
          'At least one event must be the Active Durga Puja Event. To move it, check the flag on another Durga event instead of unchecking it here.'
        );
      }
      if (
        isCurrentlyActive &&
        updates.event_name !== undefined &&
        !DURGA_NAME.test(updates.event_name || '')
      ) {
        throw new Error(
          'This event is the Active Durga Puja Event, so its name must keep containing "Durga". Move the flag to another Durga event first.'
        );
      }
    }

    const toWrite = { ...updates };
    if (toWrite.event_type !== undefined) {
      const et = toWrite.event_type;
      toWrite.event_type =
        et && ['Festival', 'Charity', 'Other'].includes(et) ? et : 'Festival';
    }

    const updated = await this.eventDataHelper.update(eventId, toWrite);

    // If this is a Durga Puja event, keep /durga-puja dates/venue in sync
    if (updated) {
      await this.durgaPujaPageService.syncFromEvent(updated);
    }

    return updated;
  }

  /** The single event carrying the "Active Durga Puja Event" flag, if any. */
  async findActiveDurgaPujaEvent(): Promise<Event | null> {
    const events = await this.eventDataHelper.findAll();
    return events.find(e => e.is_active_durga_puja_event === true) ?? null;
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

