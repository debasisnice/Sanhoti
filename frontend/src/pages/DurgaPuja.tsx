import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Music, Utensils, Users, Sparkles } from 'lucide-react';
import Seo from '../components/Seo';
import { getSiteOrigin } from '../utils/eventShareUrl';
import { durgaPujaPageAPI, DurgaPujaPageContent } from '../services/api';

/**
 * Evergreen Durga Puja landing page (URL stays /durga-puja every year).
 * Content (dates, venue, intro, FAQs) is admin-editable: Admin → Durga Puja Page.
 * The crawler-rendered version (backend SeoPageController) reads the same data.
 */

const YEAR = new Date().getFullYear();

const DEFAULT_CONTENT: DurgaPujaPageContent = {
  intro:
    "Sanhoti Bengali Association hosts one of Orange County's most vibrant Durga Puja (Durgotsav) celebrations — three days of puja, pushpanjali, dhunuchi naach, Bengali food, and evening cultural concerts. Our Durgotsav 2025 was celebrated in Costa Mesa, CA, minutes from Irvine, Newport Beach, and Huntington Beach, welcoming Bengali and Indian families from across Southern California.",
  datesText: `October 16–21, ${YEAR} (Shashthi through Vijayadashami)`,
  startDate: `${YEAR}-10-16`,
  endDate: `${YEAR}-10-21`,
  venueName: 'Venue to be announced — Orange County, CA',
  venueCity: 'Costa Mesa',
  venueNote: 'Schedule and venue will be announced on our Events page.',
  faqs: [
    {
      question: 'Where is Durga Puja celebrated in Orange County?',
      answer:
        "Sanhoti Bengali Association hosts Durga Puja in central Orange County (2025: Costa Mesa, CA), an easy drive from Irvine, Tustin, Santa Ana, Anaheim, and Mission Viejo.",
    },
    {
      question: 'Is there a Durga Puja near Irvine?',
      answer:
        "Yes — Sanhoti's Durga Puja is held minutes from Irvine, CA. The celebration includes puja, pushpanjali, dhunuchi naach, Bengali food, and cultural concerts.",
    },
    {
      question: 'Is Durga Puja open to non-members?',
      answer:
        'Yes. Sanhoti Durga Puja is open to the entire community — families, students, and visitors from across Southern California are welcome.',
    },
  ],
  updated_at: '',
};

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: 'Puja & Pushpanjali',
    text: 'Traditional puja, anjali, sindoor khela, and dhunuchi naach across three days.',
  },
  {
    icon: Music,
    title: 'Concerts & Cultural Nights',
    text: 'Evening Bengali concerts and performances by visiting artists and community talent.',
  },
  {
    icon: Utensils,
    title: 'Bengali Food & Bhog',
    text: 'Home-style bhog and Bengali food stalls throughout the celebration.',
  },
  {
    icon: Users,
    title: 'Open to Everyone',
    text: 'Families, students, and visitors from across Southern California are welcome.',
  },
];

export default function DurgaPuja() {
  const origin = getSiteOrigin();
  const [content, setContent] = useState<DurgaPujaPageContent>(DEFAULT_CONTENT);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const data = await durgaPujaPageAPI.getContent();
        if (data && data.intro) setContent(data);
      } catch {
        // Keep defaults if the API is unavailable
      }
    };
    fetchContent();
  }, []);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: `Sanhoti Durga Puja ${YEAR} (Durgotsav)`,
      url: `${origin}/durga-puja`,
      startDate: content.startDate,
      endDate: content.endDate,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      organizer: {
        '@type': 'Organization',
        name: 'Sanhoti Bengali Association of Orange County',
        url: origin,
      },
      location: {
        '@type': 'Place',
        name: content.venueName,
        address: {
          '@type': 'PostalAddress',
          addressLocality: content.venueCity,
          addressRegion: 'CA',
          addressCountry: 'US',
        },
      },
      description:
        'Three-day Durga Puja celebration in Orange County, California: puja and pushpanjali, dhunuchi naach, sindoor khela, Bengali food, and evening cultural concerts.',
      isAccessibleForFree: true,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: content.faqs.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    },
  ];

  return (
    <div className="py-12 pb-24">
      <Seo
        title={`Durga Puja in Orange County ${YEAR} | Sanhoti — ${content.venueCity}, CA`}
        description={`Celebrate Durga Puja ${YEAR} in Orange County with Sanhoti — puja, pushpanjali, dhunuchi naach, Bengali food, and concerts. Near Irvine and ${content.venueCity}, open to all of Southern California.`}
        path="/durga-puja"
        jsonLd={jsonLd}
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Durga Puja in Orange County {YEAR}
          </h1>
          <p className="text-lg text-gray-700 mb-6">{content.intro}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <Calendar className="w-6 h-6 text-primary-600 mt-1 flex-shrink-0" />
              <div>
                <h2 className="font-semibold text-gray-900">Dates</h2>
                <p className="text-gray-700">{content.datesText}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <MapPin className="w-6 h-6 text-primary-600 mt-1 flex-shrink-0" />
              <div>
                <h2 className="font-semibold text-gray-900">Venue</h2>
                <p className="text-gray-700">
                  {content.venueName}
                  {content.venueNote ? <> — {content.venueNote} </> : ' '}
                  See the{' '}
                  <Link to="/events" className="text-primary-600 hover:text-primary-700 underline">
                    Events page
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">What to expect</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
            {HIGHLIGHTS.map(h => (
              <div key={h.title} className="bg-white rounded-xl shadow p-5 border border-gray-100">
                <h.icon className="w-7 h-7 text-primary-600 mb-2" />
                <h3 className="font-semibold text-gray-900 mb-1">{h.title}</h3>
                <p className="text-gray-600 text-sm">{h.text}</p>
              </div>
            ))}
          </div>

          {content.faqs.length > 0 && (
            <>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
                Frequently asked questions
              </h2>
              <div className="space-y-5 mb-12">
                {content.faqs.map(f => (
                  <div key={f.question}>
                    <h3 className="font-semibold text-gray-900 mb-1">{f.question}</h3>
                    <p className="text-gray-700">{f.answer}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-3">
            <Link
              to="/events"
              className="bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              See All Events
            </Link>
            <Link
              to="/galleries"
              className="bg-white border-2 border-primary-600 text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
            >
              Photos from Past Celebrations
            </Link>
            <Link
              to="/contact"
              className="bg-white border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
