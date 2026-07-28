import { Event } from '../types';

export type EventTypeBucket = 'Festival' | 'Charity' | 'Workshop' | 'Other';

/** Valid `?type=` values for /events; anything else is treated as "All". */
export type EventsPageTypeFilter = EventTypeBucket | null;

const EVENT_TYPE_BUCKETS: EventTypeBucket[] = ['Festival', 'Charity', 'Workshop', 'Other'];

/** `?type=` from the URL → canonical bucket or null (All Events). */
export function parseEventsTypeQueryParam(raw: string | null): EventsPageTypeFilter {
  if (raw == null) return null;
  const t = raw.trim();
  if (EVENT_TYPE_BUCKETS.includes(t as EventTypeBucket)) return t as EventTypeBucket;
  return null;
}

/** Matches backend default when event_type is missing from stored data. */
export function getEffectiveEventType(event: Pick<Event, 'event_type'>): EventTypeBucket {
  const t = event.event_type;
  if (EVENT_TYPE_BUCKETS.includes(t as EventTypeBucket)) return t as EventTypeBucket;
  return 'Festival';
}

/** Public nav and Events page titles (API/storage still uses `Festival`). */
export function getEventTypePublicLabel(type: EventTypeBucket): string {
  switch (type) {
    case 'Festival':
      return 'Fund Raising Events';
    case 'Charity':
      return 'Charity Events';
    case 'Workshop':
      return 'Workshops';
    case 'Other':
      return 'Other Events';
  }
}

/** Admin event-type dropdown labels (shorter Charity/Other). */
export function getEventTypeAdminOptionLabel(type: EventTypeBucket): string {
  switch (type) {
    case 'Festival':
      return 'Fund Raising Events';
    case 'Charity':
      return 'Charity';
    case 'Workshop':
      return 'Workshop';
    case 'Other':
      return 'Other';
  }
}

/**
 * Which single priority event to feature at the top / front of the carousel.
 * - Filtered page (`?type=Festival|Charity|Workshop|Other`): that type's priority only.
 * - All Events (`null`): Festival priority first if one exists, else Charity, Workshop, Other.
 */
export function getScopedPriorityEvent(
  events: Event[],
  eventTypeFilter: EventsPageTypeFilter
): Event | undefined {
  const prioritized = events.filter((e) => e.is_priority === true);
  if (prioritized.length === 0) return undefined;
  if (eventTypeFilter != null && EVENT_TYPE_BUCKETS.includes(eventTypeFilter)) {
    return prioritized.find((e) => getEffectiveEventType(e) === eventTypeFilter);
  }
  return (
    prioritized.find((e) => getEffectiveEventType(e) === 'Festival') ||
    prioritized.find((e) => getEffectiveEventType(e) === 'Charity') ||
    prioritized.find((e) => getEffectiveEventType(e) === 'Workshop') ||
    prioritized.find((e) => getEffectiveEventType(e) === 'Other')
  );
}
