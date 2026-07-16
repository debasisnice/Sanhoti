import { TicketSetupDataHelper } from '../data/TicketSetupDataHelper.js';
import { TicketingProfileDataHelper } from '../data/TicketingProfileDataHelper.js';
import { SeatMapDataHelper } from '../data/SeatMapDataHelper.js';
import { DiscountDataHelper } from '../data/DiscountDataHelper.js';
import { EventDataHelper } from '../data/EventDataHelper.js';
import { TicketSetup, TicketSetupSnapshot } from '../models/types.js';

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function setupLabel(eventName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${eventName} — saved ${date}`;
}

export class TicketSetupService {
  private setupHelper = new TicketSetupDataHelper();
  private profileHelper = new TicketingProfileDataHelper();
  private mapHelper = new SeatMapDataHelper();
  private discountHelper = new DiscountDataHelper();
  private eventHelper = new EventDataHelper();
  private migrated = false;

  private async ensureMigrated(): Promise<void> {
    if (this.migrated) return;
    await this.migrateFromExisting();
    this.migrated = true;
  }

  async listSetups(): Promise<TicketSetup[]> {
    await this.ensureMigrated();
    return (await this.setupHelper.findAll()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  async getSetup(setupId: string): Promise<TicketSetup | null> {
    await this.ensureMigrated();
    return this.setupHelper.findById(String(setupId).trim());
  }

  async getActiveForEvent(eventId: string): Promise<TicketSetup | null> {
    await this.ensureMigrated();
    return this.setupHelper.findActiveForEvent(String(eventId).trim());
  }

  async buildSnapshot(eventId: string): Promise<TicketSetupSnapshot> {
    const id = String(eventId).trim();
    const profile = await this.profileHelper.findByEventId(id);
    if (!profile) throw new Error('No ticketing profile exists for this event');
    const seat_maps = (await this.mapHelper.findByEventId(id));
    const discounts = await this.discountHelper.findAll();
    return deepClone({
      categories: profile.categories,
      child_age_range: profile.child_age_range,
      meal_days: profile.meal_days,
      sub_event_configs: profile.sub_event_configs,
      hold_minutes: profile.hold_minutes,
      payment_window_hours: profile.payment_window_hours,
      booking_note: profile.booking_note,
      seat_maps,
      discounts,
    });
  }

  async saveActiveFromLiveConfig(eventId: string): Promise<TicketSetup> {
    await this.ensureMigrated();
    const id = String(eventId).trim();
    if (!id) throw new Error('event_id is required');
    const event = await this.eventHelper.findById(id);
    if (!event) throw new Error('The selected event does not exist');
    const snapshot = await this.buildSnapshot(id);
    const event_name = event.event_name;
    const label = setupLabel(event_name);
    const existing = await this.setupHelper.findActiveForEvent(id);
    if (existing) {
      const updated = await this.setupHelper.update(existing.setup_id, {
        event_name,
        label,
        snapshot,
        status: 'active',
      });
      if (!updated) throw new Error('Failed to update ticket setup');
      return updated;
    }
    return this.setupHelper.create({
      event_id: id,
      event_name,
      label,
      status: 'active',
      snapshot,
    });
  }

  async archiveSetup(setupId: string): Promise<TicketSetup | null> {
    await this.ensureMigrated();
    const setup = await this.setupHelper.findById(String(setupId).trim());
    if (!setup) return null;
    if (setup.status === 'archived') throw new Error('Setup is already archived');
    return this.setupHelper.update(setup.setup_id, {
      status: 'archived',
      archived_at: new Date().toISOString(),
    });
  }

  async deleteSetup(setupId: string): Promise<boolean> {
    await this.ensureMigrated();
    return this.setupHelper.delete(String(setupId).trim());
  }

  async migrateFromExisting(): Promise<void> {
    const profiles = await this.profileHelper.findAll();
    for (const profile of profiles) {
      if (!profile.event_id) continue;
      const active = await this.setupHelper.findActiveForEvent(profile.event_id);
      if (active) continue;
      const event = await this.eventHelper.findById(profile.event_id);
      const event_name = event?.event_name ?? profile.event_id;
      let snapshot: TicketSetupSnapshot;
      try {
        snapshot = await this.buildSnapshot(profile.event_id);
      } catch {
        continue;
      }
      await this.setupHelper.create({
        event_id: profile.event_id,
        event_name,
        label: setupLabel(event_name),
        status: 'active',
        snapshot,
      });
    }
  }
}
