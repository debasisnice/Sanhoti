import { RSVPDataHelper } from '../data/RSVPDataHelper.js';
import { RSVP } from '../models/types.js';

export class RSVPService {
  private rsvpDataHelper: RSVPDataHelper;

  constructor() {
    this.rsvpDataHelper = new RSVPDataHelper();
  }

  async getAllRSVPs(): Promise<RSVP[]> {
    return this.rsvpDataHelper.findAll();
  }

  async getRSVPById(id: string): Promise<RSVP | null> {
    return this.rsvpDataHelper.findById(id);
  }

  async getRSVPsByEvent(eventId: string): Promise<RSVP[]> {
    return this.rsvpDataHelper.findByEventId(eventId);
  }

  async getRSVPsByUser(userId: string): Promise<RSVP[]> {
    return this.rsvpDataHelper.findByUserId(userId);
  }

  async getRSVPsByEmail(email: string): Promise<RSVP[]> {
    return this.rsvpDataHelper.findByEmail(email);
  }

  async createRSVP(data: {
    eventId: string;
    userId?: string;
    email: string;
    name: string;
    phone: string;
    numberOfGuests?: number; // Legacy field
    numberOfAdults: number;
    numberOfChildren: number;
  }): Promise<RSVP> {
    // Check if email has already RSVP'd for this event
    const existingRSVP = await this.rsvpDataHelper.findByEventIdAndEmail(data.eventId, data.email);
    if (existingRSVP) {
      throw new Error('This email address has already RSVP\'d for this event');
    }

    return this.rsvpDataHelper.create({
      ...data,
      status: 'confirmed',
    });
  }

  async updateRSVP(id: string, updates: Partial<Omit<RSVP, 'id' | 'createdAt'>>): Promise<RSVP | null> {
    return this.rsvpDataHelper.update(id, updates);
  }

  async cancelRSVP(id: string): Promise<RSVP | null> {
    return this.rsvpDataHelper.update(id, { status: 'cancelled' });
  }

  async deleteRSVP(id: string): Promise<boolean> {
    return this.rsvpDataHelper.delete(id);
  }
}

