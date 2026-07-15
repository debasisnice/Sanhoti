/**
 * SEO slug helpers. Keep in sync with frontend/src/utils/eventSlug.ts:
 * event URLs are /events/<slug>-<eventId>, raw id after the last "-".
 */

import { durgaPujaEventYear, durgaPujaPagePath, isDurgaPujaEventName } from './durgaPuja.js';

export function slugifyEventName(name: string | undefined | null): string {
  if (!name) return '';
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .trim()
    .replace(/[\s-]+/g, '-')
    .toLowerCase()
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
}

export function getEventPath(
  event: { event_name?: string; title?: string },
  id: string
): string {
  const slug = slugifyEventName(event.event_name || (event as { title?: string }).title);
  return slug ? `/events/${slug}-${id}` : `/events/${id}`;
}

export function getEventDetailPath(
  event: {
    event_name?: string;
    title?: string;
    year?: number;
    event_start_dt?: string;
    date?: string;
  },
  id: string
): string {
  if (isDurgaPujaEventName(event.event_name || event.title)) {
    return durgaPujaPagePath(durgaPujaEventYear(event));
  }
  return getEventPath(event, id);
}
