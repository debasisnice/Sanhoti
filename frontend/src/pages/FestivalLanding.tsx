import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Sparkles } from 'lucide-react';
import Seo from '../components/Seo';
import PageHero from '../components/PageHero';
import PageContent from '../components/PageContent';
import { eventsAPI } from '../services/api';
import { getSiteOrigin } from '../utils/eventShareUrl';
import { getEventDetailPath } from '../utils/eventSlug';
import type { Event } from '../types';
import { formatEventDate } from '../utils/dateUtils';

export interface FestivalLandingConfig {
  path: string;
  shortName: string;
  title: string;
  description: string;
  h1: string;
  /** Two-line hero blurb under the h1 (location + value prop for SEO pages). */
  heroSubtitle: string;
  intro: string;
  highlights: { title: string; text: string }[];
  /** Matches live events (by name/description) that belong on this page. */
  match: RegExp;
  faq: { q: string; a: string }[];
}

/**
 * Per-festival landing pages. Every Bengali festival previously shared the
 * single /festivals page, so no URL could rank for an individual festival plus
 * a location ("Saraswati Puja Orange County"). Each config below gets its own
 * indexable page that also surfaces the matching live events.
 */
export const FESTIVAL_CONFIGS: Record<string, FestivalLandingConfig> = {
  saraswatiPuja: {
    path: '/saraswati-puja',
    shortName: 'Saraswati Puja',
    title: 'Saraswati Puja in Orange County, CA | Sanhoti Bengali Association',
    description:
      'Saraswati Puja in Orange County, California with Sanhoti — pushpanjali, hatekhori for children, Bengali bhog, and cultural programs open to all families across Southern California.',
    h1: 'Saraswati Puja in Orange County, California — Sanhoti',
    heroSubtitle:
      'Spring pushpanjali, hatekhori for children, Bengali bhog, and cultural programmes open to families across Orange County and Southern California.',
    intro:
      'Saraswati Puja — Basant Panchami — honours the goddess of knowledge, music, and the arts. Sanhoti celebrates it every spring in Orange County with traditional pushpanjali, hatekhori for young children, Bengali bhog, and a cultural programme of song, recitation, and dance.',
    highlights: [
      {
        title: 'Pushpanjali',
        text: 'The flower offering, performed together by everyone present.',
      },
      {
        title: 'Hatekhori',
        text: "Young children write their first letters — a cherished Bengali rite of passage marking the start of their education.",
      },
      {
        title: 'Bhog',
        text: 'Traditional vegetarian khichuri prasad served to all attendees.',
      },
      {
        title: 'Cultural programme',
        text: 'Rabindra Sangeet, recitation, and dance performed by community members of every age.',
      },
    ],
    match: /saraswat(i|ee)|basant\s*panchami|vasant\s*panchami/i,
    faq: [
      {
        q: 'Where is Saraswati Puja celebrated in Orange County?',
        a: 'Sanhoti Bengali Association hosts Saraswati Puja in Orange County, California each spring. The venue is announced on our events page ahead of each celebration, and the event is open to all families across Orange County and Southern California.',
      },
      {
        q: 'What is hatekhori?',
        a: 'Hatekhori is the traditional Bengali ceremony marking a child’s first writing lesson, performed on Saraswati Puja day. A priest guides the child to write their first letters, symbolising the start of their education under the blessing of the goddess of learning.',
      },
      {
        q: 'Do I need a ticket to attend Saraswati Puja?',
        a: 'Sanhoti’s Saraswati Puja is generally open to the community. Where a ticket or RSVP is required to help us plan food, it is listed on the event page. Check our events page for the current year’s details.',
      },
      {
        q: 'What should I wear to Saraswati Puja?',
        a: 'Yellow is traditionally worn on Basant Panchami — saris, panjabis, or any yellow outfit. There is no dress requirement, and guests are welcome in whatever they are comfortable in.',
      },
    ],
  },
  poilaBoishakh: {
    path: '/poila-boishakh',
    shortName: 'Poila Boishakh',
    title: 'Poila Boishakh (Bengali New Year) in Orange County, CA | Sanhoti',
    description:
      'Celebrate Poila Boishakh — Bengali New Year — in Orange County, California with Sanhoti. Bengali food, live music, cultural programs, and community for families across Southern California.',
    h1: 'Poila Boishakh in Orange County, California — Sanhoti',
    heroSubtitle:
      'Welcome the Bengali New Year with a full feast, live music, and cultural programmes for families across Orange County and Southern California.',
    intro:
      'Poila Boishakh (পয়লা বৈশাখ) marks the first day of the Bengali calendar and is the biggest secular celebration of the Bengali year. Sanhoti celebrates it each April in Orange County with a full Bengali feast, live music, and a cultural programme.',
    highlights: [
      {
        title: 'Bengali New Year feast',
        text: 'A full traditional menu — rice and fish dishes, vegetable preparations, and Bengali sweets.',
      },
      {
        title: 'Live music',
        text: 'Rabindra Sangeet, adhunik, and band performances to welcome the new year.',
      },
      {
        title: "Children's performances",
        text: 'Our youngest community members take the stage with song, dance, and recitation.',
      },
      {
        title: 'Traditional attire',
        text: 'Red-and-white saris and panjabis are customary — but entirely optional.',
      },
    ],
    match: /poila|pohela|pahela|boishakh|baishakh|baisakhi|bengali\s*new\s*year|nobo\s*borsho|noboborsho/i,
    faq: [
      {
        q: 'When is Poila Boishakh celebrated?',
        a: 'Poila Boishakh, the Bengali New Year, falls in mid-April each year (usually 14 or 15 April). Sanhoti schedules its Orange County celebration on the nearest weekend so families can attend — exact dates are posted on our events page.',
      },
      {
        q: 'Where can I celebrate Bengali New Year in Orange County?',
        a: 'Sanhoti Bengali Association hosts a Poila Boishakh celebration in Orange County, California each spring, with Bengali food, live music, and cultural programs. It is open to everyone across Orange County and Southern California.',
      },
      {
        q: 'Is Poila Boishakh a religious festival?',
        a: 'No. Poila Boishakh is a secular cultural celebration of the Bengali New Year, welcoming people of every background, faith, and nationality.',
      },
      {
        q: 'What food is served at Poila Boishakh?',
        a: 'A traditional Bengali New Year menu — typically rice and fish dishes, vegetable preparations, and Bengali sweets such as rosogolla and mishti doi. Vegetarian options are always available.',
      },
    ],
  },
  kaliPuja: {
    path: '/kali-puja',
    shortName: 'Kali Puja',
    title: 'Kali Puja & Diwali in Orange County, CA | Sanhoti Bengali Association',
    description:
      'Kali Puja and Diwali in Orange County, California with Sanhoti Bengali Association — evening puja, anjali, Bengali prasad, and cultural programs for families across Southern California.',
    h1: 'Kali Puja & Diwali in Orange County — Sanhoti',
    heroSubtitle:
      'Evening puja, anjali, prasad, and community gathering for Bengali and Indian families across Orange County and Southern California.',
    intro:
      'Kali Puja is celebrated on the new-moon night of Kartik, coinciding with Diwali, and is one of the most important observances in the Bengali calendar. Sanhoti marks it in Orange County with an evening puja and anjali, traditional prasad, and a community gathering.',
    highlights: [
      {
        title: 'Evening puja & anjali',
        text: 'The traditional night-time worship of Goddess Kali, performed with full ritual.',
      },
      {
        title: 'Prasad & Bengali food',
        text: 'Served to all attendees after the puja.',
      },
      {
        title: 'Diwali celebration',
        text: 'Lights, community gathering, and cultural performances.',
      },
      {
        title: 'Family friendly',
        text: 'Children and guests of every background are welcome.',
      },
    ],
    match: /kali\s*p[ou]{1,2}j[ao]|shyama\s*p[ou]{1,2}j[ao]|diwali|deepavali|dipavali/i,
    faq: [
      {
        q: 'When is Kali Puja celebrated?',
        a: 'Kali Puja falls on the new-moon night of the Bengali month of Kartik, the same night as Diwali — usually in late October or November. Sanhoti announces its Orange County celebration date on the events page each year.',
      },
      {
        q: 'How is Kali Puja different from Diwali?',
        a: 'They fall on the same night. Diwali is the pan-Indian festival of lights; Kali Puja is the Bengali observance in which Goddess Kali is worshipped at night. Bengali communities typically celebrate both together.',
      },
      {
        q: 'Can non-Bengalis attend Sanhoti’s Kali Puja?',
        a: 'Yes. Sanhoti events are open to everyone regardless of background, faith, or nationality. Guests from across Orange County and Southern California are warmly welcome.',
      },
    ],
  },
};

/** Event date for display. Date-only values are calendar dates, not instants. */
const fmtDate = (iso?: string): string =>
  formatEventDate(iso, { year: 'numeric', month: 'long', day: 'numeric' });

function venueLine(e: Event): string {
  const where = [e.venue_name, e.venue_city && `${e.venue_city}, ${e.venue_region || 'CA'}`]
    .filter(Boolean)
    .join(', ');
  return where || e.location || '';
}

export default function FestivalLanding({ config }: { config: FestivalLandingConfig }) {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    let cancelled = false;
    // Upcoming + past together: the page shows both, and past celebrations are
    // what give a brand-new festival page real content to rank on.
    Promise.all([eventsAPI.getUpcoming().catch(() => []), eventsAPI.getPast().catch(() => [])])
      .then(([up, old]) => {
        if (!cancelled) setEvents([...up, ...old]);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { upcoming, past } = useMemo(() => {
    const matched = events
      .filter(e => config.match.test(`${e.event_name ?? ''} ${e.event_description ?? ''}`))
      .sort(
        (a, b) =>
          new Date(a.event_start_dt || 0).getTime() - new Date(b.event_start_dt || 0).getTime()
      );
    const now = Date.now();
    return {
      upcoming: matched.filter(e => new Date(e.event_start_dt || 0).getTime() >= now),
      past: matched.filter(e => new Date(e.event_start_dt || 0).getTime() < now).reverse(),
    };
  }, [events, config]);

  const jsonLd = useMemo(() => {
    const origin = getSiteOrigin();
    const faqNode = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: config.faq.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    };
    if (upcoming.length === 0) return faqNode;
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `${config.shortName} celebrations by Sanhoti in Orange County`,
        itemListElement: upcoming.map((e, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Event',
            name: e.event_name,
            url: `${origin}${getEventDetailPath(e, e.event_id)}`,
            ...(e.event_start_dt ? { startDate: e.event_start_dt } : {}),
            ...(e.event_end_dt ? { endDate: e.event_end_dt } : {}),
            eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
            eventStatus: 'https://schema.org/EventScheduled',
            organizer: {
              '@type': 'Organization',
              name: 'Sanhoti Bengali Association of Orange County',
              url: origin,
            },
            location: {
              '@type': 'Place',
              name: e.venue_name || e.venue_city || 'Orange County, California',
              address: {
                '@type': 'PostalAddress',
                ...(e.venue_city ? { addressLocality: e.venue_city } : {}),
                addressRegion: e.venue_region || 'CA',
                addressCountry: 'US',
              },
            },
          },
        })),
      },
      faqNode,
    ];
  }, [config, upcoming]);

  const renderList = (list: Event[]) => (
    <ul className="space-y-4">
      {list.map(e => (
        <li key={e.event_id} className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-2">
            <Link to={getEventDetailPath(e, e.event_id)} className="hover:text-primary-700">
              {e.event_name}
            </Link>
          </h3>
          <div className="text-sm text-gray-600 space-y-1">
            {e.event_start_dt && (
              <p className="flex items-center gap-2">
                <Calendar className="w-4 h-4 shrink-0" /> {fmtDate(e.event_start_dt)}
              </p>
            )}
            {venueLine(e) && (
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0" /> {venueLine(e)}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="pb-32">
      <Seo
        title={config.title}
        description={config.description}
        path={config.path}
        jsonLd={jsonLd}
      />

      <PageHero icon={Sparkles} title={config.h1} subtitle={config.heroSubtitle} />

      <PageContent>
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Upcoming {config.shortName} celebrations
          </h2>
          {upcoming.length > 0 ? (
            renderList(upcoming)
          ) : (
            <div className="bg-white rounded-xl shadow p-6 text-gray-600">
              Dates for our next {config.shortName} celebration will be announced soon. See{' '}
              <Link to="/events" className="text-primary-600 hover:underline font-medium">
                all upcoming Sanhoti events
              </Link>{' '}
              or{' '}
              <Link to="/contact" className="text-primary-600 hover:underline font-medium">
                contact us
              </Link>{' '}
              to be notified.
            </div>
          )}
        </section>

        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            What happens at Sanhoti's {config.shortName}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {config.highlights.map(h => (
              <div key={h.title} className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="font-bold text-gray-900 mb-2">{h.title}</h3>
                <p className="text-gray-600 text-sm">{h.text}</p>
              </div>
            ))}
          </div>
        </section>

        {past.length > 0 && (
          <section className="mb-14">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Past {config.shortName} celebrations
            </h2>
            {renderList(past)}
          </section>
        )}

        <section className="mb-14 bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Who can attend</h2>
          <p className="text-gray-600">
            Everyone is welcome. Sanhoti's {config.shortName} celebration is open to Bengali, Indian,
            and non-Indian families from across Orange County and Southern California — Rancho Santa
            Margarita, Irvine, Tustin, Costa Mesa, Mission Viejo, Lake Forest, Aliso Viejo, and
            beyond.
          </p>
        </section>

        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {config.faq.map(item => (
              <div key={item.q} className="bg-white rounded-xl shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-600">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="bg-primary-50 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-3">More from Sanhoti</h2>
          <div className="flex flex-wrap justify-center gap-4 text-primary-700 font-medium">
            <Link to="/festivals" className="hover:underline">
              All Bengali Festivals
            </Link>
            <Link to="/durga-puja" className="hover:underline">
              Durga Puja in Orange County
            </Link>
            <Link to="/bengali-food" className="hover:underline">
              Bengali Food
            </Link>
            <Link to="/events" className="hover:underline">
              Upcoming Events
            </Link>
          </div>
        </div>
      </PageContent>
    </div>
  );
}
