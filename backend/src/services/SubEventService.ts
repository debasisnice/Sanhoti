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
  }): Promise<SubEvent> {
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

    return this.subEventDataHelper.create({
      sub_event_name: data.sub_event_name,
      sub_event_start_dt: data.sub_event_start_dt,
      sub_event_end_dt: data.sub_event_end_dt,
      year: data.year,
      event_description: data.event_description,
      location: data.location,
      is_active: data.is_active,
      event_id: data.event_id,
      rsvp_link: data.rsvp_link,
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

