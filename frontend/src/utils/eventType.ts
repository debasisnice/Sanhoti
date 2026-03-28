import { Event } from '../types';

export type EventTypeBucket = 'Festival' | 'Charity' | 'Other';

/** Valid `?type=` values for /events; anything else is treated as "All". */
export type EventsPageTypeFilter = EventTypeBucket | null;

/** `?type=` from the URL → canonical bucket or null (All Events). */
export function parseEventsTypeQueryParam(raw: string | null): EventsPageTypeFilter {
  if (raw == null) return null;
  const t = raw.trim();
  if (t === 'Festival' || t === 'Charity' || t === 'Other') return t;
  return null;
}

/** Matches backend default when event_type is missing from stored data. */
export function getEffectiveEventType(event: Pick<Event, 'event_type'>): EventTypeBucket {
  const t = event.event_type;
  if (t === 'Festival' || t === 'Charity' || t === 'Other') return t;
  return 'Festival';
}

/**
 * Which single priority event to feature at the top / front of the carousel.
 * - Filtered page (`?type=Festival|Charity|Other`): that type's priority only.
 * - All Events (`null`): Festival priority first if one exists, else Charity, else Other.
 */
export function getScopedPriorityEvent(
  events: Event[],
  eventTypeFilter: EventsPageTypeFilter
): Event | undefined {
  const prioritized = events.filter((e) => e.is_priority === true);
  if (prioritized.length === 0) return undefined;
  if (eventTypeFilter === 'Festival' || eventTypeFilter === 'Charity' || eventTypeFilter === 'Other') {
    return prioritized.find((e) => getEffectiveEventType(e) === eventTypeFilter);
  }
  return (
    prioritized.find((e) => getEffectiveEventType(e) === 'Festival') ||
    prioritized.find((e) => getEffectiveEventType(e) === 'Charity') ||
    prioritized.find((e) => getEffectiveEventType(e) === 'Other')
  );
}
