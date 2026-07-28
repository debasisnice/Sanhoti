import { describe, it, expect } from 'vitest';
import { EventService } from '../services/EventService.js';

/**
 * Storage is redirected to a temp copy of backend/data by src/tests/setup.ts,
 * so these create/update/delete cycles never touch real event records.
 *
 * Event names avoid the word "Durga": `createEvent` auto-promotes the first
 * Durga-named event to the active Durga Puja event, which would be a
 * surprising side effect in a test about basic CRUD.
 */
function newEvent(overrides: Record<string, unknown> = {}) {
  const start = new Date();
  start.setDate(start.getDate() + 30);
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  return {
    event_name: `Test Event ${Math.random().toString(36).slice(2, 8)}`,
    event_start_dt: start.toISOString(),
    event_end_dt: end.toISOString(),
    year: start.getFullYear(),
    event_description: 'Created by the automated test suite.',
    event_type: 'Other' as const,
    location: 'Community Center',
    ...overrides,
  };
}

describe('EventService', () => {
  it('should create an event', async () => {
    const eventService = new EventService();
    const data = newEvent();

    const event = await eventService.createEvent(data);

    expect(event).toBeDefined();
    expect(event.event_id).toBeTruthy();
    expect(event.event_name).toBe(data.event_name);
    expect(event.event_type).toBe('Other');
    expect(event.is_active).toBe(true);
  });

  it('defaults an unrecognised event type to Festival', async () => {
    const eventService = new EventService();
    const event = await eventService.createEvent(
      newEvent({ event_type: 'NotAType' as unknown as 'Other' })
    );
    expect(event.event_type).toBe('Festival');
  });

  it('rejects an end date before the start date', async () => {
    const eventService = new EventService();
    const start = new Date();
    const earlier = new Date(start.getTime() - 60 * 60 * 1000);

    await expect(
      eventService.createEvent(
        newEvent({ event_start_dt: start.toISOString(), event_end_dt: earlier.toISOString() })
      )
    ).rejects.toThrow();
  });

  it('should get upcoming events', async () => {
    const eventService = new EventService();
    const created = await eventService.createEvent(newEvent());

    const upcoming = await eventService.getUpcomingEvents();

    expect(upcoming.length).toBeGreaterThan(0);
    expect(upcoming.some(e => e.event_id === created.event_id)).toBe(true);
  });

  it('should update an event', async () => {
    const eventService = new EventService();
    const event = await eventService.createEvent(newEvent());

    const updated = await eventService.updateEvent(event.event_id, {
      event_name: 'Updated Event Name',
    });

    expect(updated?.event_name).toBe('Updated Event Name');
    // The id is part of the public URL and must survive an edit.
    expect(updated?.event_id).toBe(event.event_id);
  });

  it('should delete an event', async () => {
    const eventService = new EventService();
    const event = await eventService.createEvent(newEvent());

    const deleted = await eventService.deleteEvent(event.event_id);
    expect(deleted).toBe(true);

    const found = await eventService.getEventById(event.event_id);
    expect(found).toBeNull();
  });

  it('returns false when deleting an event that does not exist', async () => {
    const eventService = new EventService();
    await expect(eventService.deleteEvent('NO-SUCH-EVENT-ID')).resolves.toBe(false);
  });
});
