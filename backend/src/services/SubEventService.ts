import { SubEventDataHelper } from '../data/SubEventDataHelper.js';
import { EventDataHelper } from '../data/EventDataHelper.js';
import { SubEvent } from '../models/types.js';

export class SubEventService {
  private subEventDataHelper: SubEventDataHelper;
  private eventDataHelper: EventDataHelper;

  constructor() {
    this.subEventDataHelper = new SubEventDataHelper();
    this.eventDataHelper = new EventDataHelper();
  }

  async getAllSubEvents(): Promise<SubEvent[]> {
    return this.subEventDataHelper.findAll();
  }

  async getSubEventById(id: string): Promise<SubEvent | null> {
    return this.subEventDataHelper.findById(id);
  }

  async getSubEventsByEventId(eventId: string): Promise<SubEvent[]> {
    return this.subEventDataHelper.findByEventId(eventId);
  }

  /**
   * Opted-in, active sub-events that have a dedicated SEO page enabled
   * (e.g. concerts), sorted soonest-first. Used by the public `/bollywood-concerts`
   * hub page and its crawler prerender. Returns full records — the public
   * concert fields (name, date, venue, performers, ticket URL) are all safe to
   * expose since each already has an indexable `/sub-events/:id` page.
   */
  async getPublicSeoSubEvents(): Promise<SubEvent[]> {
    const all = await this.subEventDataHelper.findAll();
    return all
      .filter(se => se.seo_page_enabled === true && se.is_active !== false && !!se.sub_event_id)
      .sort((a, b) => {
        const ta = a.sub_event_start_dt ? new Date(a.sub_event_start_dt).getTime() : 0;
        const tb = b.sub_event_start_dt ? new Date(b.sub_event_start_dt).getTime() : 0;
        return ta - tb;
      });
  }

  async createSubEvent(data: {
    sub_event_name: string;
    sub_event_start_dt: string;
    sub_event_end_dt: string;
    year: number;
    event_description: string;
    location: string;
    is_active: boolean;
    event_id: string;
    rsvp_link?: string;
  } & Partial<Omit<SubEvent, 'sub_event_id' | 'created_at' | 'updated_at'>>): Promise<SubEvent> {
    // Validate parent event exists
    const parentEvent = await this.eventDataHelper.findById(data.event_id);
    if (!parentEvent) {
      throw new Error('Parent event not found');
    }

    // Validate dates are within parent event range
    const parentStart = new Date(parentEvent.event_start_dt);
    const parentEnd = new Date(parentEvent.event_end_dt);
    const subStart = new Date(data.sub_event_start_dt);
    const subEnd = new Date(data.sub_event_end_dt);

    if (subStart < parentStart || subStart > parentEnd) {
      throw new Error('Sub-event start date must be between parent event start and end date');
    }

    if (subEnd < parentStart || subEnd > parentEnd) {
      throw new Error('Sub-event end date must be between parent event start and end date');
    }

    if (subEnd < subStart) {
      throw new Error('Sub-event end date cannot be prior to start date');
    }

    // Validate year matches parent event
    if (data.year !== parentEvent.year) {
      throw new Error('Sub-event year must match parent event year');
    }

    const {
      sub_event_name,
      sub_event_start_dt,
      sub_event_end_dt,
      year,
      event_description,
      location,
      is_active,
      event_id,
      rsvp_link,
      rsvp_enabled,
      show_in_home_page,
      show_in_durga_puja_page,
      seo_page_enabled,
      seo_event_type,
      performers,
      performer_type,
      venue_name,
      venue_city,
      venue_region,
      venue_street,
      venue_postal,
      venue_area,
      ticket_url,
      ticket_price,
      ticket_currency,
      artist_ids,
      meta_title,
      meta_description,
      image_alt,
      faqs,
      menu,
    } = data;

    return this.subEventDataHelper.create({
      sub_event_name,
      sub_event_start_dt,
      sub_event_end_dt,
      year,
      event_description,
      location,
      is_active,
      event_id,
      rsvp_link,
      rsvp_enabled,
      show_in_home_page,
      show_in_durga_puja_page,
      seo_page_enabled,
      seo_event_type,
      performers,
      performer_type,
      venue_name,
      venue_city,
      venue_region,
      venue_street,
      venue_postal,
      venue_area,
      ticket_url,
      ticket_price,
      ticket_currency,
      artist_ids,
      meta_title,
      meta_description,
      image_alt,
      faqs,
      menu,
    });
  }

  async updateSubEvent(id: string, data: Partial<{
    sub_event_name: string;
    sub_event_start_dt: string;
    sub_event_end_dt: string;
    event_description: string;
    location: string;
    is_active: boolean;
    rsvp_link: string;
  }>): Promise<SubEvent | null> {
    const subEvent = await this.subEventDataHelper.findById(id);
    if (!subEvent) {
      return null;
    }

    // If dates are being updated, validate them
    if (data.sub_event_start_dt || data.sub_event_end_dt) {
      const parentEvent = await this.eventDataHelper.findById(subEvent.event_id);
      if (!parentEvent) {
        throw new Error('Parent event not found');
      }

      const parentStart = new Date(parentEvent.event_start_dt);
      const parentEnd = new Date(parentEvent.event_end_dt);
      const subStart = new Date(data.sub_event_start_dt || subEvent.sub_event_start_dt);
      const subEnd = new Date(data.sub_event_end_dt || subEvent.sub_event_end_dt);

      if (subStart < parentStart || subStart > parentEnd) {
        throw new Error('Sub-event start date must be between parent event start and end date');
      }

      if (subEnd < parentStart || subEnd > parentEnd) {
        throw new Error('Sub-event end date must be between parent event start and end date');
      }

      if (subEnd < subStart) {
        throw new Error('Sub-event end date cannot be prior to start date');
      }
    }

    return this.subEventDataHelper.update(id, data);
  }

  async deleteSubEvent(id: string): Promise<boolean> {
    return this.subEventDataHelper.delete(id);
  }

  async getSubEventImages(subEventId: string): Promise<string[]> {
    return this.subEventDataHelper.getSubEventImages(subEventId);
  }

  async deleteSubEventImage(subEventId: string, filename: string): Promise<boolean> {
    return this.subEventDataHelper.deleteSubEventImage(subEventId, filename);
  }
}

