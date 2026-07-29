import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Calendar, ExternalLink, MapPin, Mic2, Music } from 'lucide-react';
import Seo from '../components/Seo';
import PageContent from '../components/PageContent';
import { artistsAPI } from '../services/api';
import { getSiteOrigin } from '../utils/eventShareUrl';
import { getEventDetailPath } from '../utils/eventSlug';
import { toVideoEmbedUrl, youtubeThumbnailUrl } from '../utils/videoEmbedUrl';
import type { Artist, ArtistAppearance, ArtistAppearances, Event, SubEvent } from '../types';
import { formatEventDate } from '../utils/dateUtils';

function splitList(value?: string): string[] {
  return String(value ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

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

/** Normalize an event or sub-event appearance into one display/schema shape. */
interface NormalizedAppearance {
  key: string;
  name: string;
  href: string;
  start?: string;
  end?: string;
  where: string;
  venueName?: string;
  city?: string;
  region?: string;
  schemaType: 'Event' | 'MusicEvent';
  description?: string;
  imageUrl?: string;
}

/**
 * Same shape as the prerender's `stripHtml` so the Event `description` this
 * page emits is character-for-character what `SeoPageController` emits. Two
 * different truncations of the same text would be a schema mismatch between
 * what a bot sees and what a browser sees.
 */
function schemaDescription(s: string | undefined | null, maxLen = 300): string {
  const t = String(s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length <= maxLen ? t : `${t.slice(0, maxLen - 1).trimEnd()}…`;
}

function normalize(entry: ArtistAppearance): NormalizedAppearance {
  if (entry.kind === 'sub-event') {
    const se = entry.event as SubEvent;
    const where = [se.venue_name, se.venue_city && `${se.venue_city}, ${se.venue_region || 'CA'}`]
      .filter(Boolean)
      .join(', ');
    return {
      key: `se-${se.sub_event_id}`,
      name: se.sub_event_name,
      href: `/sub-events/${se.sub_event_id}`,
      start: se.sub_event_start_dt,
      end: se.sub_event_end_dt,
      where: where || se.location || '',
      venueName: se.venue_name,
      city: se.venue_city,
      region: se.venue_region,
      schemaType: se.seo_event_type === 'MusicEvent' ? 'MusicEvent' : 'Event',
      // SubEvent reuses the `event_description` field name.
      description: se.event_description,
      imageUrl: entry.imageUrl,
    };
  }
  const e = entry.event as Event;
  const where = [e.venue_name, e.venue_city && `${e.venue_city}, ${e.venue_region || 'CA'}`]
    .filter(Boolean)
    .join(', ');
  return {
    key: `ev-${e.event_id}`,
    name: e.event_name,
    href: getEventDetailPath(e, e.event_id),
    start: e.event_start_dt,
    end: e.event_end_dt,
    where: where || e.location || '',
    venueName: e.venue_name,
    city: e.venue_city,
    region: e.venue_region,
    schemaType: 'Event',
    description: e.event_description,
    imageUrl: entry.imageUrl,
  };
}

/**
 * `/artists/<slug>` — the page that lets an artist-name search reach Sanhoti.
 * Emits a full Person/MusicGroup entity (alternate spellings, sameAs profiles,
 * image) plus each Sanhoti appearance as an Event whose performer references
 * the artist by @id, so Google can connect the two entities.
 */
export default function ArtistDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [appearances, setAppearances] = useState<ArtistAppearances>({ upcoming: [], past: [] });
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setStatus('missing');
      return;
    }
    setStatus('loading');
    artistsAPI
      .getPublicBySlug(slug)
      .then(data => {
        if (cancelled) return;
        setArtist(data.artist);
        setAppearances(data.appearances ?? { upcoming: [], past: [] });
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('missing');
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const upcoming = useMemo(() => (appearances.upcoming ?? []).map(normalize), [appearances]);
  const past = useMemo(() => (appearances.past ?? []).map(normalize), [appearances]);

  const jsonLd = useMemo(() => {
    if (!artist) return undefined;
    const origin = getSiteOrigin();
    const canonical = `${origin}/artists/${artist.slug}`;
    const artistId = `${canonical}#artist`;
    const schemaType = artist.artist_type === 'MusicGroup' ? 'MusicGroup' : 'Person';
    const imageUrl = artist.image_path
      ? artistsAPI.getImageUrl(artist.artist_id, artist.image_path)
      : undefined;
    const alternates = splitList(artist.alternate_names);
    const genres = splitList(artist.genres);
    const roles = splitList(artist.roles);
    const sameAs = [artist.wikipedia_url, ...(artist.social_links ?? []).map(l => l.url)].filter(
      (u): u is string => !!u && /^https?:\/\//i.test(u)
    );
    const all = [...upcoming, ...past].slice(0, 25);

    const bioFallback =
      upcoming.length && !past.length
        ? `${artist.name} is scheduled to perform for Sanhoti Bengali Association of Orange County, California.`
        : past.length
          ? `${artist.name} has performed for Sanhoti Bengali Association of Orange County, California.`
          : `${artist.name} is featured on Sanhoti Bengali Association's artist roster in Orange County, California.`;

    const artistNode: Record<string, unknown> = {
      '@type': schemaType,
      '@id': artistId,
      name: artist.name,
      ...(alternates.length ? { alternateName: alternates } : {}),
      url: artist.website_url || canonical,
      mainEntityOfPage: canonical,
      description: artist.short_bio || artist.bio || bioFallback,
      ...(imageUrl ? { image: imageUrl } : {}),
      ...(genres.length ? { genre: genres } : {}),
      ...(sameAs.length ? { sameAs } : {}),
      ...(schemaType === 'Person'
        ? {
            ...(roles.length ? { jobTitle: roles.join(', ') } : {}),
            ...(artist.origin ? { homeLocation: { '@type': 'Place', name: artist.origin } } : {}),
          }
        : artist.origin
          ? { foundingLocation: { '@type': 'Place', name: artist.origin } }
          : {}),
      // Reference the standalone Event nodes below by @id rather than
      // repeating a partial copy of each. Google validates every Event-typed
      // node it finds, so an inline copy carrying only name/url/startDate was
      // reported as `Missing field "location"` — one error per appearance.
      performerIn: all.map(a => ({ '@id': `${origin}${a.href}#event` })),
    };

    const eventNodes = all.map(a => ({
      '@type': a.schemaType,
      // Suffixed so it cannot collide with the WebPage node that uses the bare
      // canonical URL as its @id on the event's own page.
      '@id': `${origin}${a.href}#event`,
      name: a.name,
      url: `${origin}${a.href}`,
      ...(a.start ? { startDate: a.start } : {}),
      ...(a.end || a.start ? { endDate: a.end || a.start } : {}),
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      organizer: { '@type': 'Organization', name: 'Sanhoti Bengali Association of Orange County', url: origin },
      performer: { '@id': artistId },
      location: {
        '@type': 'Place',
        name: a.venueName || a.where || 'Orange County, California',
        address: {
          '@type': 'PostalAddress',
          ...(a.city ? { addressLocality: a.city } : {}),
          addressRegion: a.region || 'CA',
          addressCountry: 'US',
        },
      },
      description:
        schemaDescription(a.description) ||
        `${a.name} — presented by Sanhoti Bengali Association${
          a.venueName || a.where ? ` at ${a.venueName || a.where}` : ''
        } in Orange County, California, featuring ${artist.name}.`,
      // The event's own flyer. Falls back to the org logo rather than the
      // artist's portrait: Event.image should depict the event.
      image: [a.imageUrl ? `${origin}${a.imageUrl}` : `${origin}/images/logo.png`],
    }));

    const videoNodes = (artist.video_urls ?? [])
      .filter(u => /^https?:\/\//i.test(u))
      .map(url => ({
        '@type': 'VideoObject',
        name: `${artist.name} — performance video`,
        description: `Performance video featuring ${artist.name}, presented by Sanhoti Bengali Association of Orange County.`,
        contentUrl: url,
        embedUrl: url,
        thumbnailUrl: youtubeThumbnailUrl(url) || imageUrl,
        uploadDate: artist.created_at,
      }));

    return {
      '@context': 'https://schema.org',
      '@graph': [
        artistNode,
        ...eventNodes,
        ...videoNodes,
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: origin },
            { '@type': 'ListItem', position: 2, name: 'Artists', item: `${origin}/artists` },
            { '@type': 'ListItem', position: 3, name: artist.name, item: canonical },
          ],
        },
      ],
    };
  }, [artist, upcoming, past]);

  if (status === 'loading') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center text-gray-500">
        Loading artist…
      </div>
    );
  }

  // Unknown or deactivated artist: tell crawlers not to index this URL rather
  // than letting a blank shell be treated as a thin/soft-404 page.
  if (status === 'missing' || !artist) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <Seo
          title="Artist not found | Sanhoti Bengali Association of Orange County"
          description="This artist page could not be found. Browse all artists featured at Sanhoti events in Orange County, California."
          path={`/artists/${slug ?? ''}`}
          noindex
        />
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Artist not found</h1>
        <p className="text-gray-600 mb-6">
          We couldn't find that artist. Browse all Sanhoti artists and performers.
        </p>
        <Link
          to="/artists"
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-5 py-3 rounded-lg font-medium hover:bg-primary-700"
        >
          <Mic2 className="w-4 h-4" /> All artists
        </Link>
      </div>
    );
  }

  const imageUrl = artist.image_path
    ? artistsAPI.getImageUrl(artist.artist_id, artist.image_path)
    : undefined;
  const roles = splitList(artist.roles);
  const genres = splitList(artist.genres);
  const alternates = splitList(artist.alternate_names);
  const profileLinks = [
    ...(artist.wikipedia_url ? [{ label: 'Wikipedia', url: artist.wikipedia_url }] : []),
    ...(artist.website_url ? [{ label: 'Official website', url: artist.website_url }] : []),
    ...(artist.social_links ?? []),
  ].filter(l => /^https?:\/\//i.test(l.url));
  const videos = (artist.video_urls ?? []).filter(u => /^https?:\/\//i.test(u));

  const renderAppearances = (list: NormalizedAppearance[]) => (
    <ul className="space-y-4">
      {list.map(a => (
        <li key={a.key} className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-900 mb-1">
            <Link to={a.href} className="hover:text-primary-700">
              {a.name}
            </Link>
          </h3>
          <div className="text-sm text-gray-600 space-y-1">
            {a.start && (
              <p className="flex items-center gap-2">
                <Calendar className="w-4 h-4 shrink-0" /> {fmtDateTime(a.start)}
              </p>
            )}
            {a.where && (
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0" /> {a.where}
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
        title={
          artist.meta_title?.trim() ||
          `${artist.name} Live in Orange County, CA | Sanhoti Bengali Association`
        }
        description={
          artist.meta_description?.trim() ||
          artist.short_bio ||
          `${artist.name} performing with Sanhoti Bengali Association in Orange County, California. Concert dates, venue, tickets, and past performances.`
        }
        path={`/artists/${artist.slug}`}
        ogType="article"
        ogImage={imageUrl}
        jsonLd={jsonLd}
      />

      <section className="bg-gradient-to-br from-primary-700 via-primary-800 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <nav aria-label="Breadcrumb" className="text-sm text-white/70 mb-6">
            <Link to="/" className="hover:underline">
              Home
            </Link>{' '}
            /{' '}
            <Link to="/artists" className="hover:underline">
              Artists
            </Link>{' '}
            / <span className="text-white">{artist.name}</span>
          </nav>
          <div className="flex flex-col sm:flex-row gap-8 items-start">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={
                  artist.image_alt ||
                  `${artist.name} performing at a Sanhoti event in Orange County, CA`
                }
                className="w-40 h-40 rounded-2xl object-cover shadow-lg shrink-0"
                width={160}
                height={160}
              />
            ) : (
              <div className="w-40 h-40 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <Music className="w-14 h-14 text-white/40" />
              </div>
            )}
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                {artist.name} — Live with Sanhoti in Orange County
              </h1>
              {(roles.length > 0 || genres.length > 0) && (
                <p className="text-white/85 font-medium mb-2">
                  {[roles.join(', '), genres.join(', ')].filter(Boolean).join(' · ')}
                </p>
              )}
              {artist.origin && (
                <p className="flex items-center gap-2 text-white/75 mb-3">
                  <MapPin className="w-4 h-4 shrink-0" /> {artist.origin}
                </p>
              )}
              {artist.short_bio && <p className="text-white/85 max-w-2xl">{artist.short_bio}</p>}
            </div>
          </div>
        </div>
      </section>

      <PageContent>
        {artist.bio && artist.bio !== artist.short_bio && (
          <section className="mb-12 bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">About {artist.name}</h2>
            <div className="text-gray-600 whitespace-pre-line">{artist.bio}</div>
            {alternates.length > 0 && (
              <p className="text-sm text-gray-500 mt-4">
                Also spelled: {alternates.join(', ')}
              </p>
            )}
          </section>
        )}

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {artist.name} performances with Sanhoti
          </h2>
          {upcoming.length > 0 ? (
            <>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Upcoming</h3>
              {renderAppearances(upcoming)}
            </>
          ) : (
            <div className="bg-white rounded-xl shadow p-6 text-gray-600">
              No upcoming {artist.name} dates are announced right now. See{' '}
              <Link to="/bollywood-concerts" className="text-primary-600 hover:underline font-medium">
                upcoming Bengali concerts in Orange County
              </Link>{' '}
              for the current line-up.
            </div>
          )}

          {past.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Past performances</h3>
              {renderAppearances(past)}
            </div>
          )}
        </section>

        {videos.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Watch {artist.name}</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {videos.map(url => {
                const embed = toVideoEmbedUrl(url);
                return embed ? (
                  <div key={url} className="aspect-video rounded-xl overflow-hidden shadow-lg">
                    <iframe
                      src={embed}
                      title={`${artist.name} performance video`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white rounded-xl shadow p-5 text-primary-700 hover:underline break-all"
                  >
                    {url}
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {profileLinks.length > 0 && (
          <section className="mb-12 bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Official profiles</h2>
            <ul className="flex flex-wrap gap-4">
              {profileLinks.map(l => (
                <li key={l.url}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1.5 text-primary-700 font-medium hover:underline"
                  >
                    {l.label} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="bg-primary-50 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-3">About Sanhoti</h2>
          <p className="text-gray-600 mb-4 max-w-2xl mx-auto">
            Sanhoti is a 501(c)(3) non-profit Bengali cultural association serving Orange County and
            Southern California, presenting Bengali and Indian artists at Durga Puja, Saraswati Puja,
            Poila Boishakh, and standalone concerts.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-primary-700 font-medium">
            <Link to="/artists" className="hover:underline">
              All Artists
            </Link>
            <Link to="/bollywood-concerts" className="hover:underline">
              Bengali Concerts
            </Link>
            <Link to="/durga-puja" className="hover:underline">
              Durga Puja in Orange County
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
