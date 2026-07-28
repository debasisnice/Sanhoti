import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Music, Ticket, MapPin, Calendar, Mic2, ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';
import PageHero from '../components/PageHero';
import PageContent from '../components/PageContent';
import { subEventsAPI } from '../services/api';
import { getSiteOrigin } from '../utils/eventShareUrl';
import type { SubEvent } from '../types';
import { formatEventDate } from '../utils/dateUtils';

/** Event date for display. Date-only values are calendar dates, not instants. */
const fmtDateTime = (iso?: string): string =>
  formatEventDate(iso, {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    // Honoured only when the stored value actually has a time.
    hour: 'numeric',
    minute: '2-digit',
  });

function venueLine(se: SubEvent): string {
  const where = [se.venue_name, se.venue_city && `${se.venue_city}, ${se.venue_region || 'CA'}`]
    .filter(Boolean)
    .join(', ');
  return where || se.location || '';
}

function stripHtml(s?: string, maxLen = 200): string {
  const t = String(s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length <= maxLen ? t : `${t.slice(0, maxLen - 1).trimEnd()}…`;
}

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Where are Sanhoti concerts held?',
    a: 'At venues across Orange County, California — recent concerts have been in Costa Mesa, minutes from Irvine — usually as part of our Durga Puja Durgotsav. Each concert page lists the exact venue.',
  },
  {
    q: 'How do I get tickets?',
    a: "Open the concert you're interested in and use its ticket link. Tickets are often available as concert-only or bundled with Durga Puja weekend passes.",
  },
  {
    q: 'Who performs at Sanhoti concerts?',
    a: 'We host visiting artists from India and the diaspora — Bollywood and contemporary singers, Rabindra Sangeet and adhunik performers, and live bands. See each concert page for the featured artist.',
  },
  {
    q: 'Are the concerts open to everyone?',
    a: 'Yes. Sanhoti concerts are family-friendly and open to music lovers of all backgrounds across Orange County and Southern California.',
  },
];

/**
 * Evergreen `/bollywood-concerts` hub. The URL leads on Bollywood (the higher-volume
 * term) while the h1, meta and body keep "Bengali concert" too, so one page can rank
 * for both. Renamed from /bengali-concerts; nginx 301s the old path.
 * and artist-name queries. Live from the public sub-events endpoint, so any concert
 * with "Generate SEO page" enabled appears here automatically. Crawlers get the
 * server-rendered `/seo` version.
 */
export default function BollywoodConcerts() {
  const [concerts, setConcerts] = useState<SubEvent[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    subEventsAPI
      .getPublicConcerts()
      .then(async list => {
        if (cancelled) return;
        setConcerts(list);
        setLoaded(true);
        // Fetch a banner image per concert (best-effort).
        const entries = await Promise.all(
          list.map(async se => {
            try {
              const files = await subEventsAPI.getImages(se.sub_event_id);
              if (files.length > 0) {
                return [se.sub_event_id, subEventsAPI.getImageUrl(se.sub_event_id, files[0])] as const;
              }
            } catch {
              /* image optional */
            }
            return null;
          })
        );
        if (cancelled) return;
        setImages(Object.fromEntries(entries.filter(Boolean) as (readonly [string, string])[]));
      })
      .catch(() => {
        if (!cancelled) {
          setConcerts([]);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const now = Date.now();
  const upcoming = concerts.filter(
    se => se.sub_event_start_dt && new Date(se.sub_event_start_dt).getTime() >= now
  );
  const past = concerts.filter(
    se => !se.sub_event_start_dt || new Date(se.sub_event_start_dt).getTime() < now
  );

  const jsonLd = useMemo(() => {
    const origin = getSiteOrigin();
    const faqNode = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    };
    if (concerts.length === 0) return faqNode;
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Bollywood and Bengali concerts by Sanhoti in Orange County',
        itemListElement: concerts.map((se, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': se.seo_event_type === 'MusicEvent' ? 'MusicEvent' : 'Event',
            name: se.sub_event_name,
            url: `${origin}/sub-events/${se.sub_event_id}`,
            ...(se.sub_event_start_dt ? { startDate: se.sub_event_start_dt } : {}),
            location: {
              '@type': 'Place',
              name: se.venue_name || se.venue_city || 'Orange County, California',
              address: {
                '@type': 'PostalAddress',
                ...(se.venue_city ? { addressLocality: se.venue_city } : {}),
                addressRegion: se.venue_region || 'CA',
                addressCountry: 'US',
              },
            },
            ...(se.performers
              ? {
                  performer: se.performers
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean)
                    .map(n => ({
                      '@type': se.performer_type === 'MusicGroup' ? 'MusicGroup' : 'Person',
                      name: n,
                    })),
                }
              : {}),
          },
        })),
      },
      faqNode,
    ];
  }, [concerts]);

  const renderCard = (se: SubEvent, isPast: boolean) => {
    const img = images[se.sub_event_id];
    return (
      <motion.div
        key={se.sub_event_id}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="group relative rounded-2xl shadow-lg overflow-hidden min-h-[500px] flex flex-col justify-end hover:shadow-xl transition-shadow"
      >
        {/* Full-card background image */}
        {img ? (
          <img
            src={img}
            alt={`${se.sub_event_name} — Bollywood and Bengali concert in Orange County`}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center">
            <Music className="w-20 h-20 text-white/30" />
          </div>
        )}

        {/* Soft bottom scrim: darkens only the lower part so the image stays visible up top */}
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

        {/* Badge */}
        <span
          className={`absolute top-4 left-4 z-10 text-xs font-semibold px-3 py-1 rounded-full ${
            isPast ? 'bg-gray-900/80 text-white' : 'bg-primary-600 text-white'
          }`}
        >
          {isPast ? 'Past concert' : 'Upcoming'}
        </span>

        {/* Text with a shadow so it stays clear over the image without hiding it */}
        <div className="relative z-10 p-6 text-white [text-shadow:_0_1px_4px_rgb(0_0_0_/_0.85)]">
          <h3 className="text-xl font-bold mb-1">
            <Link to={`/sub-events/${se.sub_event_id}`} className="text-white hover:underline">
              {se.sub_event_name}
            </Link>
          </h3>
          {se.performers && (
            <p className="flex items-center gap-2 text-white/90 font-medium mb-2">
              <Mic2 className="w-4 h-4 shrink-0" /> {se.performers}
            </p>
          )}
          <div className="text-white/80 space-y-1 text-sm mb-3">
            {se.sub_event_start_dt && (
              <p className="flex items-center gap-2">
                <Calendar className="w-4 h-4 shrink-0" /> {fmtDateTime(se.sub_event_start_dt)}
              </p>
            )}
            {venueLine(se) && (
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0" /> {venueLine(se)}
              </p>
            )}
          </div>
          {se.event_description && (
            <p className="text-white/80 text-sm mb-4">{stripHtml(se.event_description, 140)}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              to={`/sub-events/${se.sub_event_id}`}
              className="inline-flex items-center gap-1 font-medium text-white hover:underline"
            >
              Details <ArrowRight className="w-4 h-4" />
            </Link>
            {se.ticket_url && !isPast && (
              <a
                href={se.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                <Ticket className="w-4 h-4" /> Tickets
              </a>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="pb-32">
      <Seo
        title="Bollywood & Bengali Concerts in Orange County, CA | Sanhoti"
        description="Live Bollywood and Bengali concerts in Orange County, CA with Sanhoti — playback singers, Rabindra Sangeet and contemporary Indian artists near Irvine and Costa Mesa."
        path="/bollywood-concerts"
        jsonLd={jsonLd}
      />

      <PageHero
        icon={Music}
        title="Bollywood & Bengali Concerts in Orange County & Southern California"
        subtitle="Live Bollywood, contemporary Indian, and Rabindra Sangeet artists at Sanhoti Durga Puja and cultural nights in Costa Mesa — open to music lovers across Southern California."
      />

      <PageContent>
        {upcoming.length > 0 && (
          <div className="mb-8 -mt-4">
            <a
              href="#upcoming"
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              <Ticket className="w-5 h-5" /> See upcoming concerts
            </a>
          </div>
        )}
        {upcoming.length > 0 && (
          <section id="upcoming" className="mb-14 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Upcoming concerts</h2>
            <div className="grid gap-8 md:grid-cols-2">{upcoming.map(se => renderCard(se, false))}</div>
          </section>
        )}

        {loaded && upcoming.length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center text-gray-600 mb-14">
            <Music className="w-10 h-10 text-primary-600 mx-auto mb-3" />
            <p>
              Our next concert line-up will be announced soon. See our{' '}
              <Link to="/durga-puja" className="text-primary-600 hover:underline font-medium">
                Durga Puja page
              </Link>{' '}
              and{' '}
              <Link to="/events" className="text-primary-600 hover:underline font-medium">
                Events
              </Link>{' '}
              for dates and tickets.
            </p>
          </div>
        )}

        {past.length > 0 && (
          <section className="mb-14">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent concerts</h2>
            <div className="grid gap-8 md:grid-cols-2">{past.map(se => renderCard(se, true))}</div>
          </section>
        )}

        {/* What to expect */}
        <section className="mb-14 bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            What to expect at a Sanhoti concert
          </h2>
          <p className="text-gray-600 mb-3">
            Our concerts pair visiting artists from India and the diaspora with the warmth of a
            community celebration. Expect Bollywood and contemporary hits, Rabindra Sangeet and
            adhunik classics, and full-band live sound — usually as the evening highlight of our
            Durga Puja Durgotsav, alongside Bengali food stalls and cultural programs.
          </p>
          <p className="text-gray-600">
            Concerts are family-friendly and open to everyone across Orange County and Southern
            California. Seating and ticket tiers vary by show — check each concert's page for
            details, timing, and tickets.
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {FAQ.map(item => (
              <div key={item.q} className="bg-white rounded-xl shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-600">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="bg-primary-50 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-3">More from Sanhoti</h2>
          <p className="text-gray-600 mb-4">
            Each concert has its own page with the artist, venue, and tickets. Explore the rest of
            our Bengali festivals and events in Orange County.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-primary-700 font-medium">
            <Link to="/durga-puja" className="hover:underline">
              Durga Puja in Orange County
            </Link>
            <Link to="/festivals" className="hover:underline">
              Bengali Festivals
            </Link>
            <Link to="/events" className="hover:underline">
              All Events
            </Link>
            <Link to="/contact" className="hover:underline">
              Contact Us
            </Link>
          </div>
        </div>
      </PageContent>
    </div>
  );
}
