import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Music, Ticket, ChevronLeft } from 'lucide-react';
import Seo from '../components/Seo';
import { getSiteOrigin } from '../utils/eventShareUrl';
import { subEventsAPI } from '../services/api';
import { SubEvent } from '../types';
import { formatDateWithTime } from '../utils/dateUtils';

/**
 * Public detail page for a single sub-event at /sub-events/:id.
 * Primary purpose is SEO — a focused, indexable page per concert/program with
 * schema.org Event (subtype) structured data including performer, venue, and
 * offers. Crawlers are served the equivalent HTML by the backend SeoPageController
 * (dynamic rendering); this React page is what human visitors from search land on.
 */
export default function SubEventDetail() {
  const { id = '' } = useParams();
  const origin = getSiteOrigin();
  const [se, setSe] = useState<SubEvent | null>(null);
  const [banner, setBanner] = useState<string | undefined>(undefined);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setNotFound(false);
    setSe(null);
    setBanner(undefined);
    if (!id) {
      setNotFound(true);
      return;
    }
    subEventsAPI
      .getById(id)
      .then(async data => {
        if (cancelled) return;
        setSe(data);
        try {
          const files = await subEventsAPI.getImages(id);
          if (!cancelled && files && files.length > 0) {
            setBanner(subEventsAPI.getImageUrl(id, files[0].split('/').pop() || files[0]));
          }
        } catch {
          /* image optional */
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (notFound) {
    return (
      <div className="py-24 text-center px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Event not found</h1>
        <p className="text-gray-600 mb-6">We couldn&apos;t find that program.</p>
        <Link to="/events" className="text-primary-600 hover:text-primary-700 font-semibold underline">
          Browse all events
        </Link>
      </div>
    );
  }

  if (!se) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  const path = `/sub-events/${se.sub_event_id}`;
  const area = (se.venue_area || '').trim();
  const city = (se.venue_city || '').trim();
  const region = (se.venue_region || 'CA').trim();
  const type = se.seo_event_type || 'Event';
  const performerType = se.performer_type === 'MusicGroup' ? 'MusicGroup' : 'Person';
  const performerNames = (se.performers || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const venueLine = [se.venue_name, se.venue_street, city && `${city}, ${region}`, se.venue_postal]
    .filter(Boolean)
    .join(', ');
  const areaPhrase = area || 'Orange County';
  const title = `${se.sub_event_name}${area ? ` in ${area}` : ''} | Sanhoti${city ? ` — ${city}, ${region}` : ''}`;
  const description =
    (se.event_description || '').trim() ||
    `${performerNames.length ? `${performerNames.join(', ')} — ` : ''}${se.sub_event_name} with Sanhoti Bengali Association in ${areaPhrase}${city ? `, ${city}` : ''}, ${region}.`;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': type,
    name: se.sub_event_name,
    url: `${origin}${path}`,
    startDate: se.sub_event_start_dt || undefined,
    endDate: se.sub_event_end_dt || undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    organizer: {
      '@type': 'Organization',
      name: 'Sanhoti Bengali Association of Orange County',
      url: origin,
    },
    location: {
      '@type': 'Place',
      name: se.venue_name || se.location || `${areaPhrase}, California`,
      address: {
        '@type': 'PostalAddress',
        ...(se.venue_street ? { streetAddress: se.venue_street } : {}),
        ...(city ? { addressLocality: city } : {}),
        addressRegion: region,
        ...(se.venue_postal ? { postalCode: se.venue_postal } : {}),
        addressCountry: 'US',
      },
    },
    description,
    ...(banner ? { image: [banner] } : {}),
    ...(performerNames.length
      ? { performer: performerNames.map(n => ({ '@type': performerType, name: n })) }
      : {}),
    ...(se.ticket_url
      ? {
          offers: {
            '@type': 'Offer',
            url: se.ticket_url,
            ...(se.ticket_price
              ? { price: se.ticket_price, priceCurrency: se.ticket_currency || 'USD' }
              : {}),
            availability: 'https://schema.org/InStock',
            ...(se.sub_event_start_dt ? { validFrom: se.sub_event_start_dt } : {}),
          },
        }
      : { isAccessibleForFree: true }),
  };

  return (
    <div className="py-12 pb-24">
      <Seo title={title} description={description} path={path} ogImage={banner} jsonLd={[jsonLd]} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Link
            to="/durga-puja"
            className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium mb-4"
          >
            <ChevronLeft className="w-4 h-4" /> Sanhoti Durga Puja
          </Link>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {se.sub_event_name}
            {area ? ` in ${area}` : ''}
          </h1>

          <div className="mt-3 space-y-1.5 text-gray-700">
            {se.sub_event_start_dt && (
              <p className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-600 flex-shrink-0" />
                {formatDateWithTime(se.sub_event_start_dt)}
              </p>
            )}
            {(venueLine || se.location) && (
              <p className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                {venueLine || se.location}
              </p>
            )}
            {performerNames.length > 0 && (
              <p className="flex items-center gap-2 font-medium text-primary-700">
                <Music className="w-5 h-5 flex-shrink-0" />
                Performing live: {performerNames.join(', ')}
              </p>
            )}
          </div>

          {banner && (
            <img
              src={banner}
              alt={`${se.sub_event_name}${area ? ` — ${area}` : ''}`}
              className="w-full max-h-[32rem] object-contain rounded-2xl shadow-lg bg-white mt-6"
            />
          )}

          {se.event_description && (
            <p className="text-gray-700 leading-relaxed mt-6 whitespace-pre-line">
              {se.event_description}
            </p>
          )}

          <div className="flex flex-wrap gap-3 mt-8">
            {se.ticket_url && (
              <a
                href={se.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                <Ticket className="w-5 h-5" />
                Buy Tickets
                {se.ticket_price ? ` — ${se.ticket_currency || 'USD'} ${se.ticket_price}` : ''}
              </a>
            )}
            {se.rsvp_enabled && !se.ticket_url && (
              se.rsvp_link ? (
                <a
                  href={se.rsvp_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                >
                  RSVP
                </a>
              ) : (
                <Link
                  to={`/sub-events/${se.sub_event_id}/rsvp`}
                  className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                >
                  RSVP
                </Link>
              )
            )}
            <Link
              to="/durga-puja"
              className="bg-white border-2 border-primary-600 text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
            >
              Durga Puja in Orange County
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
