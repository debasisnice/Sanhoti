import { describe, it, expect } from 'vitest';
import { EventService } from '../services/EventService.js';
import { EventType } from '../models/types.js';

describe('EventService', () => {
  it('should create an event', async () => {
    const eventService = new EventService();
    const eventData = {
      title: 'Durga Puja 2024',
      description: 'Annual Durga Puja celebration',
      type: EventType.DURGA_PUJA,
      date: new Date('2024-10-15').toISOString(),
      location: 'Community Center',
      createdBy: 'user-id-123',
    };

    const event = await eventService.createEvent(eventData);
    expect(event).toBeDefined();
    expect(event.title).toBe(eventData.title);
    expect(event.isActive).toBe(true);
  });

  it('should get upcoming events', async () => {
    const eventService = new EventService();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    await eventService.createEvent({
      title: 'Future Event',
      description: 'Test',
      type: EventType.ADHOC,
      date: futureDate.toISOString(),
      createdBy: 'user-id-123',
    });

    const upcoming = await eventService.getUpcomingEvents();
    expect(upcoming.length).toBeGreaterThan(0);
  });

  it('should update an event', async () => {
    const eventService = new EventService();
    const event = await eventService.createEvent({
      title: 'Test Event',
      description: 'Original',
      type: EventType.ADHOC,
      date: new Date().toISOString(),
      createdBy: 'user-id-123',
    });

    const updated = await eventService.updateEvent(event.id, { title: 'Updated Event' });
    expect(updated?.title).toBe('Updated Event');
  });

  it('should delete an event', async () => {
    const eventService = new EventService();
    const event = await eventService.createEvent({
      title: 'To Delete',
      description: 'Test',
      type: EventType.ADHOC,
      date: new Date().toISOString(),
      createdBy: 'user-id-123',
    });

    const deleted = await eventService.deleteEvent(event.id);
    expect(deleted).toBe(true);

    const found = await eventService.getEventById(event.id);
    expect(found).toBeNull();
  });
});

