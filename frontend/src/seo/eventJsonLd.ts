import type { Event } from '../types';
import { getSiteOrigin } from '../utils/eventShareUrl';
import { seoPlainText } from './seoUtils';

export function buildEventJsonLd(
  event: Event,
  opts: { pageUrl: string; imageUrl?: string | null }
): Record<string, unknown> {
  const name = event.event_name || event.title || 'Event';
  const start = event.event_start_dt || event.date;
  const end = event.event_end_dt || start;
  const description = seoPlainText(event.event_description || event.description || '', 500);
  const loc = (event.location || '').trim();

  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    url: opts.pageUrl,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    organizer: {
      '@type': 'Organization',
      name: 'Sanhoti Bengali Association of Orange County',
      url: getSiteOrigin(),
    },
  };

  if (start) base.startDate = start;
  if (end) base.endDate = end;
  if (description) base.description = description;
  if (opts.imageUrl) base.image = [opts.imageUrl];

  if (loc) {
    base.location = {
      '@type': 'Place',
      name: loc,
      address: {
        '@type': 'PostalAddress',
        streetAddress: loc,
        addressRegion: 'CA',
        addressCountry: 'US',
      },
    };
  } else {
    base.location = {
      '@type': 'Place',
      name: 'Orange County, California',
      address: {
        '@type': 'PostalAddress',
        addressRegion: 'CA',
        addressCountry: 'US',
      },
    };
  }

  return base;
}
