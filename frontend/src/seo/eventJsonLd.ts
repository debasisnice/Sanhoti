import type { Event } from '../types';
import { getSiteOrigin } from '../utils/eventShareUrl';
import { seoPlainText } from './seoUtils';

/** Lowest valid single price from a free-text field ("80,60,40" -> "40", "$50" -> "50"). */
function firstNumericPrice(raw: string | undefined | null): string | undefined {
  const nums = (String(raw ?? '').match(/\d+(\.\d+)?/g) || [])
    .map(Number)
    .filter(n => Number.isFinite(n) && n > 0);
  return nums.length ? String(Math.min(...nums)) : undefined;
}

const EVENT_STATUS_MAP: Record<string, string> = {
  Scheduled: 'https://schema.org/EventScheduled',
  Cancelled: 'https://schema.org/EventCancelled',
  Postponed: 'https://schema.org/EventPostponed',
  Rescheduled: 'https://schema.org/EventRescheduled',
};

/**
 * Build a complete schema.org Event from admin-entered fields. Every optional
 * Google-recommended field is populated from admin data when present, with safe
 * fallbacks (logo image, generated description, start-as-end) so the structured
 * data is always valid. Shared by the event detail page and the events ItemList.
 */
export function buildEventJsonLd(
  event: Event,
  opts: { pageUrl: string; imageUrl?: string | null }
): Record<string, unknown> {
  const origin = getSiteOrigin();
  const name = event.event_name || event.title || 'Event';
  const start = event.event_start_dt || event.date;
  const end = event.event_end_dt || start;
  const loc = (event.location || '').trim();

  // Prefer structured venue fields; fall back to the free-text location.
  const venueName = (event.venue_name || '').trim();
  const venueCity = (event.venue_city || '').trim();
  const hasStructuredVenue = !!(venueName || venueCity || event.venue_street || event.venue_postal);
  const location = hasStructuredVenue
    ? {
        '@type': 'Place',
        name: venueName || loc || `${venueCity || 'Orange County'}, California`,
        address: {
          '@type': 'PostalAddress',
          ...(event.venue_street ? { streetAddress: event.venue_street } : {}),
          ...(venueCity ? { addressLocality: venueCity } : {}),
          addressRegion: (event.venue_region || 'CA').trim() || 'CA',
          ...(event.venue_postal ? { postalCode: event.venue_postal } : {}),
          addressCountry: 'US',
        },
      }
    : {
        '@type': 'Place',
        name: loc || 'Orange County, California',
        address: loc
          ? { '@type': 'PostalAddress', streetAddress: loc, addressRegion: 'CA', addressCountry: 'US' }
          : { '@type': 'PostalAddress', addressRegion: 'CA', addressCountry: 'US' },
      };

  const description =
    seoPlainText(event.event_description || event.description || '', 500) ||
    `${name} — a Bengali community event hosted by Sanhoti Bengali Association${
      venueName || loc ? ` at ${venueName || loc}` : ''
    } in Orange County, California.`;

  // Offer from admin ticket fields; otherwise mark the event free.
  const price = firstNumericPrice(event.ticket_price);
  const offerFragment =
    event.ticket_url && price
      ? {
          offers: {
            '@type': 'Offer',
            url: event.ticket_url,
            price,
            priceCurrency: (event.ticket_currency || 'USD').trim() || 'USD',
            availability: 'https://schema.org/InStock',
            ...(start ? { validFrom: start } : {}),
          },
        }
      : event.ticket_url
        ? {} // ticket link with no price entered — omit a price-less Offer
        : { isAccessibleForFree: true };

  const performerNames = (event.performers || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const performerType = event.performer_type === 'MusicGroup' ? 'MusicGroup' : 'Person';

  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    url: opts.pageUrl,
    ...(start ? { startDate: start } : {}),
    endDate: end || start,
    description,
    image: [opts.imageUrl || `${origin}/images/logo.png`],
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: EVENT_STATUS_MAP[event.event_status || 'Scheduled'] || EVENT_STATUS_MAP.Scheduled,
    organizer: {
      '@type': 'Organization',
      name: 'Sanhoti Bengali Association of Orange County',
      url: origin,
    },
    location,
    ...(performerNames.length
      ? { performer: performerNames.map(n => ({ '@type': performerType, name: n })) }
      : {}),
    ...offerFragment,
  };

  return base;
}
