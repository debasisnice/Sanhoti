import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mic2, Music, ArrowRight, MapPin } from 'lucide-react';
import Seo from '../components/Seo';
import PageHero from '../components/PageHero';
import PageContent from '../components/PageContent';
import { artistsAPI } from '../services/api';
import { getSiteOrigin } from '../utils/eventShareUrl';
import type { Artist } from '../types';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Which artists perform at Sanhoti events in Orange County?',
    a: 'Sanhoti presents singers, musicians, and performers from India and the Bengali diaspora — Bollywood and playback singers, Rabindra Sangeet and adhunik artists, classical musicians, and live bands. Each artist page lists upcoming and past Sanhoti performances.',
  },
  {
    q: 'Where do Sanhoti artists perform?',
    a: 'At venues across Orange County, California — most often in Costa Mesa, minutes from Irvine — usually as part of our Durga Puja Durgotsav or a standalone concert evening.',
  },
  {
    q: 'How can I book or enquire about an artist?',
    a: 'Sanhoti presents artists at its own community events rather than acting as a booking agency. For press, artist management, or performance enquiries, contact us at info@sanhoti.org.',
  },
];

/** Comma-separated string to a trimmed, non-empty list. */
function splitList(value?: string): string[] {
  return String(value ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * `/artists` — the hub that gives search engines a crawl path to every artist
 * page. Artist-name searches are a primary acquisition channel for Sanhoti, and
 * this index plus the per-artist pages is what makes them reachable.
 */
export default function Artists() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    artistsAPI
      .getPublic()
      .then(list => {
        if (cancelled) return;
        setArtists(list);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setArtists([]);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (artists.length === 0) return faqNode;
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Artists & performers at Sanhoti events in Orange County, California',
        numberOfItems: artists.length,
        itemListElement: artists.map((a, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${origin}/artists/${a.slug}`,
          item: {
            '@type': a.artist_type === 'MusicGroup' ? 'MusicGroup' : 'Person',
            '@id': `${origin}/artists/${a.slug}#artist`,
            name: a.name,
            url: `${origin}/artists/${a.slug}`,
            ...(a.image_path
              ? { image: artistsAPI.getImageUrl(a.artist_id, a.image_path) }
              : {}),
            ...(splitList(a.genres).length ? { genre: splitList(a.genres) } : {}),
          },
        })),
      },
      faqNode,
    ];
  }, [artists]);

  return (
    <div className="pb-32">
      <Seo
        title="Artists & Performers | Sanhoti Bengali Association of Orange County, CA"
        description="Singers, musicians, and performers featured at Sanhoti events in Orange County, California — past and upcoming Bollywood, Rabindra Sangeet, and live Bengali concerts across Southern California."
        path="/artists"
        jsonLd={jsonLd}
      />

      <PageHero
        icon={Mic2}
        title="Sanhoti Artists & Performers — Orange County, California"
        subtitle="Singers and musicians from India and the Bengali diaspora that Sanhoti presents in Orange County — past concerts and upcoming Durga Puja performances, from Bollywood playback to Rabindra Sangeet across Southern California."
      />

      <PageContent>
        {artists.length > 0 && (
          <section className="mb-14">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured artists</h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {artists.map(a => {
                const meta = [a.roles, a.genres].map(s => (s || '').trim()).filter(Boolean).join(' · ');
                return (
                  <motion.article
                    key={a.artist_id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow flex flex-col"
                  >
                    {a.image_path ? (
                      <img
                        src={artistsAPI.getImageUrl(a.artist_id, a.image_path)}
                        alt={
                          a.image_alt ||
                          `${a.name} — artist at Sanhoti Bengali Association in Orange County, CA`
                        }
                        className="w-full h-56 object-cover"
                        width={480}
                        height={224}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-56 bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center">
                        <Music className="w-14 h-14 text-white/30" />
                      </div>
                    )}
                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        <Link to={`/artists/${a.slug}`} className="hover:text-primary-700">
                          {a.name}
                        </Link>
                      </h3>
                      {meta && <p className="text-sm text-primary-700 font-medium mb-2">{meta}</p>}
                      {a.origin && (
                        <p className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
                          <MapPin className="w-3.5 h-3.5 shrink-0" /> {a.origin}
                        </p>
                      )}
                      {a.short_bio && (
                        <p className="text-gray-600 text-sm mb-4 flex-1">{a.short_bio}</p>
                      )}
                      <Link
                        to={`/artists/${a.slug}`}
                        className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline mt-auto"
                      >
                        View performances <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </section>
        )}

        {loaded && artists.length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center text-gray-600 mb-14">
            <Music className="w-10 h-10 text-primary-600 mx-auto mb-3" />
            <p>
              Our artist line-up for the coming season will be announced soon. See{' '}
              <Link to="/bollywood-concerts" className="text-primary-600 hover:underline font-medium">
                Bengali concerts
              </Link>{' '}
              and{' '}
              <Link to="/durga-puja" className="text-primary-600 hover:underline font-medium">
                Durga Puja
              </Link>{' '}
              for the latest.
            </p>
          </div>
        )}

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
          <div className="flex flex-wrap justify-center gap-4 text-primary-700 font-medium">
            <Link to="/bollywood-concerts" className="hover:underline">
              Bengali Concerts
            </Link>
            <Link to="/durga-puja" className="hover:underline">
              Durga Puja in Orange County
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
