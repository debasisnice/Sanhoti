import { DatabaseHelper } from './DatabaseHelper.js';
import { TicketSetup } from '../models/types.js';

const FILENAME = 'ticketSetups.json';

export class TicketSetupDataHelper extends DatabaseHelper {
  async findAll(): Promise<TicketSetup[]> {
    return this.readFile<TicketSetup>(FILENAME);
  }

  async findById(setupId: string): Promise<TicketSetup | null> {
    return (await this.findAll()).find(setup => setup.setup_id === setupId) ?? null;
  }

  async findActiveForEvent(eventId: string): Promise<TicketSetup | null> {
    return (await this.findAll()).find(
      setup => setup.event_id === eventId && setup.status === 'active'
    ) ?? null;
  }

  async create(
    data: Omit<TicketSetup, 'setup_id' | 'created_at' | 'updated_at'>
  ): Promise<TicketSetup> {
    const all = await this.findAll();
    if (
      data.status === 'active' &&
      all.some(setup => setup.event_id === data.event_id && setup.status === 'active')
    ) {
      throw new Error('An active setup already exists for this event');
    }
    const now = new Date().toISOString();
    const setup: TicketSetup = {
      ...data,
      setup_id: this.generate12DigitAlphanumericId(),
      created_at: now,
      updated_at: now,
    };
    all.push(setup);
    this.writeFile<TicketSetup>(FILENAME, all);
    return setup;
  }

  async update(setupId: string, patch: Partial<TicketSetup>): Promise<TicketSetup | null> {
    const all = await this.findAll();
    const index = all.findIndex(setup => setup.setup_id === setupId);
    if (index === -1) return null;
    const current = all[index];
    if (current.status === 'archived') {
      throw new Error('Archived setups cannot be modified');
    }
    if (
      patch.status === 'active' &&
      all.some(
        setup =>
          setup.setup_id !== setupId &&
          setup.event_id === (patch.event_id ?? current.event_id) &&
          setup.status === 'active'
      )
    ) {
      throw new Error('An active setup already exists for this event');
    }
    all[index] = { ...current, ...patch, updated_at: new Date().toISOString() };
    this.writeFile<TicketSetup>(FILENAME, all);
    return all[index];
  }

  async delete(setupId: string): Promise<boolean> {
    const all = await this.findAll();
    const remaining = all.filter(setup => setup.setup_id !== setupId);
    if (remaining.length === all.length) return false;
    this.writeFile<TicketSetup>(FILENAME, remaining);
    return true;
  }
}
