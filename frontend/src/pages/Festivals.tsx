import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Calendar, MapPin, ArrowRight, Music } from 'lucide-react';
import Seo from '../components/Seo';
import { eventsAPI, subEventsAPI } from '../services/api';
import { getEventDetailPath } from '../utils/eventSlug';
import { getSiteOrigin } from '../utils/eventShareUrl';
import type { Event } from '../types';

/**
 * Evergreen `/festivals` hub — targets "Bengali festivals in Orange County".
 * Live from the public events endpoint: every event is sorted into a festival
 * bucket by its name, so newly created events (e.g. "Saraswati Puja 2027") appear
 * here automatically. Crawlers get the server-rendered `/seo/festivals` version.
 */

type FestivalDef = {
  key: string;
  name: string;
  blurb: string;
  href: string;
  match: RegExp;
};

const FESTIVALS: FestivalDef[] = [
  {
    key: 'durga-puja',
    name: 'Durga Puja (Durgotsav)',
    blurb:
      "Sanhoti's flagship celebration — puja, pushpanjali, dhunuchi naach, sindoor khela, Bengali food, and live concerts across Orange County.",
    href: '/durga-puja',
    match: /durga|durgotsav/i,
  },
  {
    key: 'saraswati-puja',
    name: 'Saraswati Puja',
    blurb:
      'Worship of the goddess of learning and the arts — anjali, cultural performances, and Bengali food. Welcoming students and families.',
    href: '/events',
    match: /saraswati/i,
  },
  {
    key: 'poila-boishakh',
    name: 'Poila Boishakh (Bengali New Year)',
    blurb:
      'Noboborsho / Baisakhi celebrations ringing in the Bengali New Year with music, food, and community across Southern California.',
    href: '/events',
    match: /poila|boishakh|noboborsho|baisakhi|bengali new year/i,
  },
  {
    key: 'kali-puja',
    name: 'Kali Puja',
    blurb:
      'Devotional evening puja honouring goddess Kali, part of Sanhoti’s annual festival calendar in Orange County.',
    href: '/events',
    match: /kali/i,
  },
  {
    key: 'mahalaya',
    name: 'Mahalaya & seasonal programs',
    blurb:
      'Mahalaya recitations that open the Durga Puja season, plus Pithe Puli Utsab and other seasonal cultural programs.',
    href: '/events',
    match: /mahalaya|pithe|puli/i,
  },
];

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
}

export default function Festivals() {
  const [events, setEvents] = useState<Event[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [concertCount, setConcertCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    eventsAPI
      .getActive()
      .then(async list => {
        if (cancelled) return;
        setEvents(list);
        // Featured image for the soonest event in each festival bucket.
        const featured: Event[] = FESTIVALS.map(f =>
          [...list]
            .filter(e => f.match.test(e.event_name || ''))
            .sort(
              (a, b) =>
                new Date(a.event_start_dt || 0).getTime() - new Date(b.event_start_dt || 0).getTime()
            )[0]
        ).filter(Boolean) as Event[];
        const entries = await Promise.all(
          featured.map(async e => {
            try {
              const img = await eventsAPI.getImagePublic(e.event_id);
              if (img?.filename) {
                return [e.event_id, eventsAPI.getImageUrl(e.event_id, img.filename)] as const;
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
        if (!cancelled) setEvents([]);
      });
    subEventsAPI
      .getPublicConcerts()
      .then(list => !cancelled && setConcertCount(list.length))
      .catch(() => !cancelled && setConcertCount(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const now = Date.now();

  // Events grouped by festival, upcoming-first.
  const grouped = useMemo(() => {
    const byKey: Record<string, Event[]> = {};
    for (const f of FESTIVALS) {
      byKey[f.key] = events
        .filter(e => f.match.test(e.event_name || ''))
        .sort(
          (a, b) =>
            new Date(a.event_start_dt || 0).getTime() - new Date(b.event_start_dt || 0).getTime()
        );
    }
    return byKey;
  }, [events]);

  const jsonLd = useMemo(() => {
    const origin = getSiteOrigin();
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Bengali festivals celebrated by Sanhoti in Orange County',
        itemListElement: FESTIVALS.map((f, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: f.name,
          url: `${origin}${f.href}`,
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What Bengali festivals are celebrated in Orange County?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Sanhoti Bengali Association celebrates Durga Puja, Saraswati Puja, Poila Boishakh (Bengali New Year), Kali Puja, and Mahalaya, along with cultural programs and live Bengali concerts, across Orange County and Southern California.',
            },
          },
          {
            '@type': 'Question',
            name: 'Are Sanhoti festivals open to everyone?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. While rooted in Bengali traditions, Sanhoti festivals welcome people of all backgrounds, races, religions, and ethnicities from across Orange County and Southern California.',
            },
          },
        ],
      },
    ];
  }, []);

  const renderFestivalCard = (f: FestivalDef) => {
    const list = grouped[f.key] || [];
    const next = list.find(
      e => e.event_start_dt && new Date(e.event_start_dt).getTime() >= now
    );
    const featured = next || list[0];
    const img = featured ? images[featured.event_id] : undefined;
    // Card title/CTA go to the specific event; Durga Puja keeps its landing page.
    const primaryHref =
      f.key === 'durga-puja'
        ? f.href
        : featured
          ? getEventDetailPath(featured, featured.event_id)
          : f.href;

    return (
      <motion.div
        key={f.key}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="group relative rounded-2xl shadow-lg overflow-hidden min-h-[500px] flex flex-col justify-end hover:shadow-xl transition-shadow"
      >
        {/* Full-card background image */}
        {img ? (
          <img
            src={img}
            alt={`${f.name} in Orange County — Sanhoti`}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-800 flex items-center justify-center">
            <Sparkles className="w-20 h-20 text-white/30" />
          </div>
        )}

        {/* Soft bottom scrim: darkens only the lower part so the image stays visible up top */}
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

        {/* Badge */}
        {next && (
          <span className="absolute top-4 left-4 z-10 bg-primary-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Next: {fmtDate(next.event_start_dt)}
          </span>
        )}

        {/* Text with a shadow so it stays clear over the image without hiding it */}
        <div className="relative z-10 p-6 text-white [text-shadow:_0_1px_4px_rgb(0_0_0_/_0.85)]">
          <h2 className="text-xl font-bold mb-2">
            <Link to={primaryHref} className="text-white hover:underline">
              {f.name}
            </Link>
          </h2>
          <p className="text-white/80 mb-4">{f.blurb}</p>

          {list.length > 0 && (
            <ul className="space-y-2 mb-4">
              {list.slice(0, 3).map(e => (
                <li key={e.event_id} className="text-sm">
                  <Link
                    to={getEventDetailPath(e, e.event_id)}
                    className="font-medium text-white hover:underline"
                  >
                    {e.event_name}
                  </Link>
                  <span className="block text-white/70 flex flex-wrap items-center gap-x-3">
                    {e.event_start_dt && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> {fmtDate(e.event_start_dt)}
                      </span>
                    )}
                    {e.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {e.location}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Link
            to={primaryHref}
            className="inline-flex items-center gap-1 text-white font-medium hover:underline"
          >
            {f.key === 'durga-puja' ? 'Durga Puja page' : featured ? 'View event' : 'See events'}{' '}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="pb-32">
      <Seo
        title="Bengali Festivals in Orange County, CA | Sanhoti — Durga Puja, Saraswati Puja, Poila Boishakh"
        description="Bengali festivals in Orange County with Sanhoti: Durga Puja, Saraswati Puja, Poila Boishakh (Bengali New Year), Kali Puja, and concerts — for families across Southern California."
        path="/festivals"
        jsonLd={jsonLd}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-700 via-primary-800 to-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-5">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">Bengali Festivals in Orange County</h1>
          <p className="text-lg text-white/85 max-w-2xl mx-auto">
            Sanhoti (সংহতি) celebrates the full Bengali festival calendar across Orange County and
            Southern California — from the grandeur of Durga Puja to Saraswati Puja, Poila Boishakh,
            Kali Puja, and live Bengali concerts. Open to everyone, from Costa Mesa and Irvine to
            Rancho Santa Margarita and the wider SoCal region.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="grid gap-8 md:grid-cols-2">
          {FESTIVALS.map(renderFestivalCard)}

          {/* Concerts card (from sub-events) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="group relative rounded-2xl shadow-lg overflow-hidden min-h-[500px] flex flex-col justify-end hover:shadow-xl transition-shadow"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-primary-800 flex items-center justify-center">
              <Music className="w-20 h-20 text-white/25" />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />
            <div className="relative z-10 p-6 text-white [text-shadow:_0_1px_4px_rgb(0_0_0_/_0.85)]">
              <h2 className="text-xl font-bold mb-2">
                <Link to="/bengali-concerts" className="text-white hover:underline">
                  Bengali Concerts
                </Link>
              </h2>
              <p className="text-white/80 mb-4">
                Live Bengali and Indian music nights with visiting artists — Bollywood, contemporary,
                and Rabindra Sangeet, most often part of our Durgotsav.
                {concertCount ? ` ${concertCount} on the calendar.` : ''}
              </p>
              <Link
                to="/bengali-concerts"
                className="inline-flex items-center gap-1 text-white font-medium hover:underline"
              >
                See all concerts <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* About */}
        <section className="mt-14 bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Bengali festivals in Orange County, all year round
          </h2>
          <p className="text-gray-600 mb-3">
            Sanhoti's calendar follows the Bengali year. It opens with{' '}
            <strong>Mahalaya</strong>, builds to the grand five days of{' '}
            <strong>Durga Puja</strong> — our largest celebration — and continues through{' '}
            <strong>Kali Puja</strong>, <strong>Saraswati Puja</strong>, and{' '}
            <strong>Poila Boishakh</strong>, the Bengali New Year. In between there are picnics,
            Pithe Puli Utsab, charity drives, and live Bengali concerts.
          </p>
          <p className="text-gray-600">
            Every celebration blends devotion with culture — pushpanjali and aarti alongside music,
            dance, recitation, and home-style Bengali food — and every one is open to families and
            friends of all backgrounds across Costa Mesa, Irvine, Tustin, Rancho Santa Margarita,
            Mission Viejo, and the wider Southern California region.
          </p>
        </section>

        {/* FAQ */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: 'What Bengali festivals are celebrated in Orange County?',
                a: 'Sanhoti celebrates Durga Puja, Saraswati Puja, Poila Boishakh (Bengali New Year), Kali Puja, and Mahalaya, plus cultural programs and live Bengali concerts, across Orange County and Southern California.',
              },
              {
                q: 'Where are the festivals held?',
                a: 'At venues across Orange County — recent celebrations have been in Costa Mesa (minutes from Irvine), Mission Viejo, and Irvine. Check each event for its exact venue and date.',
              },
              {
                q: 'Are Sanhoti festivals open to everyone?',
                a: 'Yes. While rooted in Bengali traditions, our festivals welcome people of all backgrounds, races, religions, and ethnicities from across Orange County and Southern California.',
              },
              {
                q: 'How do I attend or get tickets?',
                a: 'Open each event above for details and RSVP or ticket links, or visit our Events page. Some events are free; concerts and Durga Puja may be ticketed.',
              },
            ].map(item => (
              <div key={item.q} className="bg-white rounded-xl shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-600">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="bg-primary-50 rounded-2xl p-8 text-center mt-12">
          <p className="text-gray-600 mb-4">
            See exact dates and venues, or browse photos from past celebrations.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-primary-700 font-medium">
            <Link to="/events" className="hover:underline">
              All Upcoming Events
            </Link>
            <Link to="/galleries" className="hover:underline">
              Photo Galleries
            </Link>
            <Link to="/about" className="hover:underline">
              About Sanhoti
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
