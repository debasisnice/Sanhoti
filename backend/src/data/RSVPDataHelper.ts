import { DatabaseHelper } from './DatabaseHelper.js';
import { RSVP } from '../models/types.js';

export class RSVPDataHelper extends DatabaseHelper {
  private readonly filename = 'rsvps.json';

  async findAll(): Promise<RSVP[]> {
    return this.readFile<RSVP>(this.filename);
  }

  async findById(id: string): Promise<RSVP | null> {
    const rsvps = await this.findAll();
    return rsvps.find(r => r.id === id) || null;
  }

  async findByEventId(eventId: string): Promise<RSVP[]> {
    const rsvps = await this.findAll();
    return rsvps.filter(r => r.eventId === eventId && r.status === 'confirmed');
  }

  async findByUserId(userId: string): Promise<RSVP[]> {
    const rsvps = await this.findAll();
    return rsvps.filter(r => r.userId === userId);
  }

  async findByEmail(email: string): Promise<RSVP[]> {
    const rsvps = await this.findAll();
    return rsvps.filter(r => r.email.toLowerCase() === email.toLowerCase());
  }

  async findByEventIdAndEmail(eventId: string, email: string): Promise<RSVP | null> {
    const rsvps = await this.findAll();
    return rsvps.find(r => 
      r.eventId === eventId && 
      r.email.toLowerCase() === email.toLowerCase() &&
      r.status === 'confirmed'
    ) || null;
  }

  async findBySubEventId(subEventId: string): Promise<RSVP[]> {
    const rsvps = await this.findAll();
    return rsvps.filter(r => r.subEventId === subEventId && r.status === 'confirmed');
  }

  async findBySubEventIdAndEmail(subEventId: string, email: string): Promise<RSVP | null> {
    const rsvps = await this.findAll();
    return rsvps.find(r => 
      r.subEventId === subEventId && 
      r.email.toLowerCase() === email.toLowerCase() &&
      r.status === 'confirmed'
    ) || null;
  }

  async create(rsvp: Omit<RSVP, 'id' | 'createdAt' | 'updatedAt'>): Promise<RSVP> {
    const rsvps = await this.findAll();
    
    // Ensure numberOfAdults and numberOfChildren are set
    // If legacy numberOfGuests is provided, convert it
    let numberOfAdults = rsvp.numberOfAdults;
    let numberOfChildren = rsvp.numberOfChildren ?? 0;
    
    if (numberOfAdults === undefined && rsvp.numberOfGuests !== undefined) {
      // Legacy format: convert numberOfGuests to numberOfAdults
      numberOfAdults = rsvp.numberOfGuests;
      numberOfChildren = 0;
    } else if (numberOfAdults === undefined) {
      // Default to 0 adults if not provided (controller should validate this, but this is a fallback)
      numberOfAdults = 0;
    }
    
    const newRSVP: RSVP = {
      ...rsvp,
      numberOfAdults,
      numberOfChildren,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    rsvps.push(newRSVP);
    this.writeFile(this.filename, rsvps);
    return newRSVP;
  }

  async update(id: string, updates: Partial<RSVP>): Promise<RSVP | null> {
    const rsvps = await this.findAll();
    const index = rsvps.findIndex(r => r.id === id);
    if (index === -1) return null;
    
    rsvps[index] = {
      ...rsvps[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.writeFile(this.filename, rsvps);
    return rsvps[index];
  }

  async delete(id: string): Promise<boolean> {
    const rsvps = await this.findAll();
    const filtered = rsvps.filter(r => r.id !== id);
    if (filtered.length === rsvps.length) return false;
    this.writeFile(this.filename, filtered);
    return true;
  }
}

