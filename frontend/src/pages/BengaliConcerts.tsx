import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Music, Ticket, MapPin, Calendar, Mic2, ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';
import { subEventsAPI } from '../services/api';
import { getSiteOrigin } from '../utils/eventShareUrl';
import type { SubEvent } from '../types';

function fmtDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const hasTime = /T\d{2}:\d{2}/.test(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(hasTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    timeZone: 'America/Los_Angeles',
  });
}

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
 * Evergreen `/bengali-concerts` hub — targets "Bengali concert Southern California"
 * and artist-name queries. Live from the public sub-events endpoint, so any concert
 * with "Generate SEO page" enabled appears here automatically. Crawlers get the
 * server-rendered `/seo` version.
 */
export default function BengaliConcerts() {
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
        name: 'Bengali concerts by Sanhoti in Orange County',
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
        className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col border border-gray-100 hover:shadow-xl transition-shadow"
      >
        <Link to={`/sub-events/${se.sub_event_id}`} className="block relative">
          {img ? (
            <img
              src={img}
              alt={`${se.sub_event_name} — Bengali concert in Orange County`}
              className="w-full h-52 object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-52 bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center">
              <Music className="w-16 h-16 text-white/80" />
            </div>
          )}
          <span
            className={`absolute top-3 left-3 text-xs font-semibold px-3 py-1 rounded-full ${
              isPast ? 'bg-gray-800/80 text-white' : 'bg-primary-600 text-white'
            }`}
          >
            {isPast ? 'Past concert' : 'Upcoming'}
          </span>
        </Link>
        <div className="p-6 flex flex-col flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-1">
            <Link to={`/sub-events/${se.sub_event_id}`} className="hover:text-primary-600">
              {se.sub_event_name}
            </Link>
          </h3>
          {se.performers && (
            <p className="flex items-center gap-2 text-primary-700 font-medium mb-2">
              <Mic2 className="w-4 h-4" /> {se.performers}
            </p>
          )}
          <div className="text-gray-600 space-y-1 text-sm mb-3">
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
            <p className="text-gray-600 text-sm mb-4">{stripHtml(se.event_description)}</p>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
            <Link
              to={`/sub-events/${se.sub_event_id}`}
              className="inline-flex items-center gap-1 text-primary-600 font-medium hover:underline"
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
        title="Bengali Concerts in Orange County & Southern California | Sanhoti — Live Indian Music"
        description="Live Bengali concerts in Orange County & Southern California with Sanhoti — Bollywood, contemporary Indian, and Rabindra Sangeet artists at Durga Puja and cultural nights near Irvine and Costa Mesa."
        path="/bengali-concerts"
        jsonLd={jsonLd}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-700 via-primary-800 to-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-5">
            <Music className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Bengali Concerts in Orange County &amp; Southern California
          </h1>
          <p className="text-lg text-white/85 max-w-2xl mx-auto">
            Sanhoti brings live Bengali music to Orange County — Bollywood and contemporary Indian
            artists, Rabindra Sangeet, and band nights, most often as part of our Durga Puja
            Durgotsav in Costa Mesa, minutes from Irvine. Open to music lovers across SoCal.
          </p>
          {upcoming.length > 0 && (
            <a
              href="#upcoming"
              className="inline-flex items-center gap-2 mt-6 bg-white text-primary-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              <Ticket className="w-5 h-5" /> See upcoming concerts
            </a>
          )}
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
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
      </div>
    </div>
  );
}
