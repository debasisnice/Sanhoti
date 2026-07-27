import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ArrowRight, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { eventsAPI, galleriesAPI } from '../services/api';
import { Event } from '../types';
import { format } from 'date-fns';
import { convertPSTToLocal, generateCalendarUrl, formatDateWithTime } from '../utils/dateUtils';
import {
  getEffectiveEventType,
  getEventTypePublicLabel,
  getScopedPriorityEvent,
  parseEventsTypeQueryParam,
} from '../utils/eventType';
import { QRCodeSVG } from 'qrcode.react';
import Seo from '../components/Seo';
import { getEventDetailPath } from '../utils/eventSlug';
import { getSiteOrigin } from '../utils/eventShareUrl';
import { buildEventJsonLd } from '../seo/eventJsonLd';

/** Durga-Puja-style section heading with a kicker and accent underline. */
function SectionHeading({ kicker, children }: { kicker?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      {kicker && (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600 mb-1">{kicker}</p>
      )}
      <h2 className="text-2xl font-bold text-gray-900">{children}</h2>
      <div className="mt-2 h-1 w-12 rounded-full bg-gradient-to-r from-primary-500 to-amber-400" />
    </div>
  );
}

export default function Events() {
  const [searchParams] = useSearchParams();
  const typeQueryRaw = searchParams.get('type');
  const eventTypeScope = useMemo(() => parseEventsTypeQueryParam(typeQueryRaw), [typeQueryRaw]);

  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [priorityEventImage, setPriorityEventImage] = useState<string | null>(null);
  const [imageOrientation, setImageOrientation] = useState<'portrait' | 'landscape' | null>(null);
  const [eventImages, setEventImages] = useState<Record<string, string>>({});
  const [eventImageOrientations, setEventImageOrientations] = useState<Record<string, 'portrait' | 'landscape'>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedYear, setExpandedYear] = useState<string | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<
    { eventId?: string; galleryId: string; url: string; alt: string }[]
  >([]);

  // Function to detect image orientation
  const detectImageOrientation = (imageUrl: string): Promise<'portrait' | 'landscape'> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const orientation = img.height > img.width ? 'portrait' : 'landscape';
        resolve(orientation);
      };
      img.onerror = () => {
        // Default to landscape if image fails to load
        resolve('landscape');
      };
      img.src = imageUrl;
    });
  };

  useEffect(() => {
    // Fetch all events (upcoming + past)
    const fetchEventsAndImages = async () => {
      try {
        const [upcoming, past] = await Promise.all([
          eventsAPI.getUpcoming(),
          eventsAPI.getPast(),
        ]);
        
        // Combine all events
        const combined = [...upcoming, ...past];
        setAllEvents(combined);

        // Fetch images for all events
        const imagePromises = combined
          .filter(e => e.event_id && e.event_image_path)
          .map(async (event) => {
            try {
              const imageData = await eventsAPI.getImagePublic(event.event_id!);
              if (imageData) {
                const imageUrl = eventsAPI.getImageUrl(event.event_id!, imageData.filename);
                const orientation = await detectImageOrientation(imageUrl);
                return {
                  eventId: event.event_id!,
                  imageUrl,
                  orientation,
                };
              }
            } catch (error) {
              // Silently fail if no images are found
            }
            return null;
          });
        
        const imageResults = await Promise.all(imagePromises);
        const imagesMap: Record<string, string> = {};
        const orientationsMap: Record<string, 'portrait' | 'landscape'> = {};
        
        imageResults.forEach((result) => {
          if (result) {
            imagesMap[result.eventId] = result.imageUrl;
            orientationsMap[result.eventId] = result.orientation;
          }
        });
        
        setEventImages(imagesMap);
        setEventImageOrientations(orientationsMap);
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    };
    
    fetchEventsAndImages();
  }, []);

  // Public gallery photos — used to fill the hero collage when there are few flyers.
  useEffect(() => {
    let cancelled = false;
    galleriesAPI
      .getPublic()
      .then(galleries => {
        if (cancelled) return;
        // Keep each photo tagged with its event so the hero can show galleries
        // that match the current event-type page.
        const photos = galleries.flatMap(g =>
          (g.photos || [])
            .filter(p => p && p.type !== 'video' && (p.thumbnailUrl || p.url))
            .map(p => ({
              eventId: g.eventId,
              galleryId: g.id,
              url: (p.thumbnailUrl || p.url) as string,
              // Descriptive, unique alt: photo caption if set, else the gallery title.
              alt: (p.caption || '').trim()
                ? (p.caption as string).trim()
                : `${g.title || 'Sanhoti event'} — photo from a Sanhoti Bengali event in Orange County, CA`,
            }))
        );
        setGalleryPhotos(photos);
      })
      .catch(() => {
        /* galleries optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scopedPriorityEvent = useMemo(
    () => getScopedPriorityEvent(allEvents, eventTypeScope),
    [allEvents, eventTypeScope]
  );

  useEffect(() => {
    setCurrentIndex(0);
  }, [eventTypeScope]);

  useEffect(() => {
    if (!scopedPriorityEvent?.event_id || !scopedPriorityEvent.event_image_path) {
      setPriorityEventImage(null);
      setImageOrientation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const imageData = await eventsAPI.getImagePublic(scopedPriorityEvent.event_id!);
        if (cancelled || !imageData) {
          if (!cancelled) {
            setPriorityEventImage(null);
            setImageOrientation(null);
          }
          return;
        }
        const imageUrl = eventsAPI.getImageUrl(scopedPriorityEvent.event_id!, imageData.filename);
        setPriorityEventImage(imageUrl);
        const orientation = await detectImageOrientation(imageUrl);
        if (!cancelled) setImageOrientation(orientation);
      } catch {
        if (!cancelled) {
          setPriorityEventImage(null);
          setImageOrientation(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scopedPriorityEvent]);

  // Filter events by type from URL (Festival, Charity, Other, or All)
  const filteredEvents = useMemo(() => {
    if (eventTypeScope === 'Festival' || eventTypeScope === 'Charity' || eventTypeScope === 'Other') {
      return allEvents.filter((e) => getEffectiveEventType(e) === eventTypeScope);
    }
    return allEvents;
  }, [allEvents, eventTypeScope]);

  // Sort events chronologically and position priority event at front (index 0)
  // Sequence: past events (newest to oldest) on left, then upcoming events (nearest to farthest) on right
  const eventsForCarousel = (() => {
    const filtered = filteredEvents; // Include all events, including priority events
    
    if (filtered.length === 0) return [];
    
    const now = new Date();
    
    // Separate past and upcoming events
    // Split by end time so ongoing multi-day events are not dropped (start < now but end >= now).
    const pastEvents = filtered.filter(e => {
      const endDate = new Date(e.event_end_dt || e.event_start_dt || e.date || 0);
      return endDate < now;
    }).sort((a, b) => {
      const dateA = new Date(a.event_end_dt || a.event_start_dt || a.date || 0);
      const dateB = new Date(b.event_end_dt || b.event_start_dt || b.date || 0);
      return dateB.getTime() - dateA.getTime();
    });

    const upcomingEvents = filtered.filter(e => {
      const endDate = new Date(e.event_end_dt || e.event_start_dt || e.date || 0);
      return endDate >= now;
    }).sort((a, b) => {
      const dateA = new Date(a.event_start_dt || a.date || 0);
      const dateB = new Date(b.event_start_dt || b.date || 0);
      return dateA.getTime() - dateB.getTime();
    });
    
    // Create chronological sequence: past events first (newest to oldest), then upcoming events (nearest to farthest)
    // This places past events on the left side of the carousel
    const chronological = [...pastEvents, ...upcomingEvents];
    
    // Reverse the sequence so the carousel flows in opposite direction
    const reversed = [...chronological].reverse();

    const priority = getScopedPriorityEvent(reversed, eventTypeScope);
    
    // If priority event exists, rotate the array so priority is at index 0
    // This maintains the reversed chronological order while ensuring priority is at front
    if (priority) {
      const priorityIndex = reversed.findIndex(e => {
        const eventId = e.event_id || e.id;
        const priorityId = priority.event_id || priority.id;
        return eventId === priorityId;
      });
      
      if (priorityIndex !== -1 && priorityIndex !== 0) {
        // Rotate array: move everything after priority to the end, then priority, then everything before priority
        const beforePriority = reversed.slice(0, priorityIndex);
        const afterPriority = reversed.slice(priorityIndex + 1);
        return [priority, ...afterPriority, ...beforePriority];
      }
    }
    
    return reversed;
  })();

  // Get visible cards - show one card in front, with side cards for smooth scrolling effect
  const getVisibleCards = () => {
    if (eventsForCarousel.length === 0) return [];
    
    const visible: Array<{ event: Event; index: number; position: number }> = [];
    
    // Show 5 cards: 2 on left, 1 middle (front), 2 on right
    for (let i = -2; i <= 2; i++) {
      const eventIndex = (currentIndex + i + eventsForCarousel.length) % eventsForCarousel.length;
      visible.push({
        event: eventsForCarousel[eventIndex],
        index: eventIndex,
        position: i,
      });
    }
    
    return visible;
  };

  const visibleCards = getVisibleCards();

  const handlePrevious = () => {
    // Go to previous event in chronological sequence (left arrow)
    setCurrentIndex((prev) => (prev - 1 + eventsForCarousel.length) % eventsForCarousel.length);
  };

  const handleNext = () => {
    // Go to next event in chronological sequence (right arrow)
    setCurrentIndex((prev) => (prev + 1) % eventsForCarousel.length);
  };

  const eventsSeoTitle =
    eventTypeScope === 'Festival'
      ? 'Festival events | Sanhoti'
      : eventTypeScope === 'Charity'
        ? 'Charity events | Sanhoti'
        : eventTypeScope === 'Other'
          ? 'Community events | Sanhoti'
          : 'Community events | Sanhoti';
  const eventsSeoDescription =
    eventTypeScope === 'Festival' || eventTypeScope === 'Charity' || eventTypeScope === 'Other'
      ? `Browse ${getEventTypePublicLabel(eventTypeScope).toLowerCase()} from Sanhoti Bengali Association in Orange County & Southern California, CA — dates, locations, and how to join.`
      : 'Browse upcoming and past cultural events from Sanhoti Bengali Association of Orange County & Southern California — festivals, charity programs, and gatherings for the Bengali community.';

  const isTypeScoped =
    eventTypeScope === 'Festival' || eventTypeScope === 'Charity' || eventTypeScope === 'Other';
  // Festival filter consolidates onto the dedicated /festivals hub (avoids cannibalization);
  // Charity/Other have no hub, so they stay self-canonical.
  const canonicalPath =
    eventTypeScope === 'Festival'
      ? '/festivals'
      : isTypeScoped
        ? `/events?type=${eventTypeScope}`
        : '/events';

  const heroTitle =
    eventTypeScope === 'Festival'
      ? 'Bengali Festivals in Orange County'
      : eventTypeScope === 'Charity'
        ? 'Charity & Community Events in Orange County'
        : eventTypeScope === 'Other'
          ? 'Community Events & Gatherings in Orange County'
          : 'Bengali Events in Orange County';
  const heroSubtitle =
    eventTypeScope === 'Charity'
      ? 'Coming together to give back and strengthen our community across Southern California.'
      : eventTypeScope === 'Other'
        ? 'Picnics, socials, and community programs from Sanhoti across Orange County & SoCal.'
        : eventTypeScope === 'Festival'
          ? 'Durga Puja, Saraswati Puja, Poila Boishakh and more — celebrated with Sanhoti in Orange County & Southern California.'
          : 'Festivals, concerts, charity drives, and community gatherings from Sanhoti Bengali Association of Orange County.';

  const nowTs = Date.now();
  const upcomingEvents = useMemo(
    () =>
      filteredEvents
        .filter(e => new Date(e.event_end_dt || e.event_start_dt || e.date || 0).getTime() >= nowTs)
        .sort(
          (a, b) =>
            new Date(a.event_start_dt || a.date || 0).getTime() -
            new Date(b.event_start_dt || b.date || 0).getTime()
        ),
    [filteredEvents, nowTs]
  );

  // Hero backdrop: event flyers first (prioritized), then public gallery photos to
  // fill so the hero never looks empty when there are few events. Randomized.
  const mosaicImages = useMemo(() => {
    const shuffle = (arr: string[]) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const flyers = shuffle(
      Array.from(
        new Set(filteredEvents.map(e => eventImages[e.event_id || e.id || '']).filter(Boolean) as string[])
      )
    );
    // Gallery filler, scoped to the current type: on a type page only use galleries
    // whose event is in this type; on /events (no scope) use all public galleries.
    const scopedIds = new Set(filteredEvents.map(e => e.event_id || e.id || ''));
    const scopedGallery = isTypeScoped
      ? galleryPhotos.filter(p => p.eventId && scopedIds.has(p.eventId))
      : galleryPhotos;
    const gallery = shuffle(scopedGallery.map(p => p.url));
    // Flyers take priority; gallery photos fill the remaining slots (deduped).
    return Array.from(new Set([...flyers, ...gallery])).slice(0, 12);
  }, [filteredEvents, eventImages, galleryPhotos, isTypeScoped]);

  // Dedicated gallery section: related (type-scoped) gallery photos, randomized.
  const galleryHighlights = useMemo(() => {
    const scopedIds = new Set(filteredEvents.map(e => e.event_id || e.id || ''));
    const pool = isTypeScoped
      ? galleryPhotos.filter(p => p.eventId && scopedIds.has(p.eventId))
      : galleryPhotos;
    const a = [...pool];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, 8);
  }, [filteredEvents, galleryPhotos, isTypeScoped]);

  const absUrl = (u?: string | null) => (u ? (/^https?:/i.test(u) ? u : `${getSiteOrigin()}${u}`) : null);

  // Structured data built from admin-entered fields: an ItemList of full Event nodes
  // (venue PostalAddress, offers, status, performer, image) + a BreadcrumbList.
  const eventsJsonLd = useMemo(() => {
    const origin = getSiteOrigin();
    const items = filteredEvents.map((e, i) => {
      const id = e.event_id || e.id || '';
      const { ['@context']: _omit, ...eventNode } = buildEventJsonLd(e, {
        pageUrl: `${origin}${getEventDetailPath(e, id)}`,
        imageUrl: absUrl(eventImages[id]),
      });
      return { '@type': 'ListItem', position: i + 1, name: e.event_name || e.title || 'Event', item: eventNode };
    });
    const crumbs: { name: string; path: string }[] = [
      { name: 'Home', path: '/' },
      { name: 'Events', path: '/events' },
    ];
    if (isTypeScoped) crumbs.push({ name: getEventTypePublicLabel(eventTypeScope), path: canonicalPath });
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: `${origin}${c.path}`,
      })),
    };
    return items.length
      ? [
          { '@context': 'https://schema.org', '@type': 'ItemList', name: heroTitle, itemListElement: items },
          breadcrumb,
        ]
      : [breadcrumb];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredEvents, eventImages, heroTitle, eventTypeScope, canonicalPath, isTypeScoped]);

  return (
    <div className="pb-32">
      <Seo title={eventsSeoTitle} description={eventsSeoDescription} path={canonicalPath} jsonLd={eventsJsonLd} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ---- Hero ---- */}
        <section className="relative overflow-hidden rounded-2xl shadow-lg mb-10 min-h-[480px] flex items-center">
          {mosaicImages.length > 0 ? (
            <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-primary-700 to-gray-900" aria-hidden="true">
              {/* Masonry collage — each flyer shown in full (no cropping), varied heights */}
              <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-2 p-2">
                {mosaicImages.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="w-full h-auto mb-2 rounded-md break-inside-avoid"
                    loading="lazy"
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-primary-800" aria-hidden="true" />
          )}
          <div className="absolute inset-0 bg-black/60" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full px-6 py-14 text-center text-white"
          >
            <div className="inline-flex items-center gap-2 justify-center mb-3">
              <Calendar className="w-6 h-6 text-yellow-300" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-200">
                Sanhoti · Orange County, CA
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 [text-shadow:_0_1px_6px_rgb(0_0_0_/_0.5)]">
              {heroTitle}
            </h1>
            <p className="text-lg text-white/90 max-w-2xl mx-auto [text-shadow:_0_1px_4px_rgb(0_0_0_/_0.6)]">
              {heroSubtitle}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
              <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1">{upcomingEvents.length} upcoming</span>
              <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1">{filteredEvents.length} total</span>
              {upcomingEvents[0] && (
                <span className="bg-primary-600 rounded-full px-3 py-1 font-medium">
                  Next: {formatDateWithTime(upcomingEvents[0].event_start_dt || upcomingEvents[0].date || '')}
                </span>
              )}
            </div>
            <a
              href="#all-events"
              className="inline-flex items-center gap-2 mt-6 bg-white text-primary-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Browse all events <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>
        </section>

        {/* Intro */}
        <p className="text-lg text-gray-700 leading-relaxed border-l-4 border-primary-500 pl-4 mb-10">
          {heroSubtitle} Explore what&apos;s coming up below, or browse our full event archive.
        </p>

        {/* Upcoming events grid */}
        {upcomingEvents.length > 0 && (
          <section className="mb-12">
            <SectionHeading kicker="Don't miss">Upcoming events</SectionHeading>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcomingEvents.map((e, i) => {
                const id = e.event_id || e.id || '';
                const img = eventImages[id];
                const date = formatDateWithTime(e.event_start_dt || e.date || '');
                return (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 flex flex-col"
                  >
                    <Link to={getEventDetailPath(e, id)} className="block h-44 bg-gray-50">
                      {img ? (
                        <img src={img} alt={e.event_name || e.title || 'Event'} className="w-full h-44 object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-44 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                          <Calendar className="w-10 h-10 text-white/70" />
                        </div>
                      )}
                    </Link>
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        <Link to={getEventDetailPath(e, id)} className="hover:text-primary-600">
                          {e.event_name || e.title}
                        </Link>
                      </h3>
                      <div className="text-sm text-gray-600 space-y-1 mb-3">
                        {date && (
                          <p className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary-600 shrink-0" /> {date}
                          </p>
                        )}
                        {e.location && (
                          <p className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-primary-600 shrink-0" /> {e.location}
                          </p>
                        )}
                      </div>
                      <Link
                        to={getEventDetailPath(e, id)}
                        className="mt-auto inline-flex items-center gap-1 text-primary-600 font-medium hover:underline"
                      >
                        Details <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Priority Event Card — superseded by the hero + Upcoming grid above (kept disabled). */}
        {scopedPriorityEvent && (() => {
          const eventId = scopedPriorityEvent.event_id || scopedPriorityEvent.id || '';
          const eventName = scopedPriorityEvent.event_name || scopedPriorityEvent.title || 'Untitled Event';
          const eventDescription = scopedPriorityEvent.event_description || scopedPriorityEvent.description || '';
          const eventDate = scopedPriorityEvent.event_start_dt || scopedPriorityEvent.date || '';
          const eventLocation = scopedPriorityEvent.location || '';
          
          // Use event image from Events_Flyers if available, otherwise use the old imageUrl/photo_gallery_link as fallback
          const eventImage = priorityEventImage || scopedPriorityEvent.photo_gallery_link || scopedPriorityEvent.imageUrl;
          
          // Determine layout based on image orientation
          const isPortrait = imageOrientation === 'portrait' && eventImage;
          
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="hidden"
            >
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl shadow-2xl overflow-hidden border-4 border-yellow-400">
                {/* Portrait Layout: Image on left, details on right */}
                {isPortrait ? (
                  <div className="flex flex-col md:flex-row">
                    {/* Image Section - Left Side */}
                    <div className="md:w-1/2 bg-gradient-to-br from-primary-400 to-primary-600 relative overflow-hidden min-h-[400px] md:min-h-[500px] flex items-center justify-center">
                      {eventImage && (
                        <img
                          src={eventImage}
                          alt={eventName}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="absolute top-4 right-4 bg-yellow-500 rounded-full p-3 shadow-lg">
                        <Star className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>
                    
                    {/* Details Section - Right Side */}
                    <div className="md:w-1/2 p-8 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="bg-primary-600 text-white px-4 py-2 rounded-full text-sm font-medium">
                          {scopedPriorityEvent.year || new Date(eventDate).getFullYear()}
                        </span>
                      </div>
                      <h2 className="text-4xl font-bold text-gray-900 mb-4">{eventName}</h2>
                      <p className="text-lg text-gray-700 mb-6">{eventDescription}</p>
                      
                      <div className="grid grid-cols-1 gap-4 mb-6">
                        <div className="flex items-center text-gray-700">
                          <Calendar className="w-5 h-5 mr-3 text-primary-600" />
                          <div className="flex items-center gap-2">
                            {(() => {
                              const now = new Date();
                              const eventEndDate = scopedPriorityEvent.event_end_dt ? convertPSTToLocal(scopedPriorityEvent.event_end_dt) : convertPSTToLocal(eventDate);
                              const isUpcoming = eventEndDate >= now;
                              
                              if (isUpcoming) {
                                const calendarUrl = generateCalendarUrl(
                                  eventName,
                                  eventDate,
                                  scopedPriorityEvent.event_end_dt,
                                  eventLocation,
                                  eventDescription
                                );
                                return (
                                  <>
                                    <a
                                      href={calendarUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-lg underline hover:text-primary-600 cursor-pointer transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {formatDateWithTime(eventDate)}
                                    </a>
                                    <span className="text-sm text-gray-500">•</span>
                                    <a
                                      href={calendarUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-primary-600 underline hover:text-primary-700 cursor-pointer transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Add to Calendar
                                    </a>
                                  </>
                                );
                              }
                              return <span className="text-lg">{formatDateWithTime(eventDate)}</span>;
                            })()}
                          </div>
                        </div>
                        {eventLocation && (
                          <div className="flex items-center text-gray-700">
                            <MapPin className="w-5 h-5 mr-3 text-primary-600" />
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventLocation)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-lg underline hover:text-primary-600 cursor-pointer transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {eventLocation}
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3">
                        <Link
                          to={getEventDetailPath({ event_name: eventName }, eventId)}
                          className="inline-flex items-center justify-center bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors text-lg"
                        >
                          View Details <ArrowRight className="w-5 h-5 ml-2" />
                        </Link>
                        
                        {/* Show RSVP link only for upcoming events when RSVP is enabled */}
                        {(() => {
                          const now = new Date();
                          const eventEndDate = scopedPriorityEvent.event_end_dt ? new Date(scopedPriorityEvent.event_end_dt) : new Date(eventDate);
                          const isPastEvent = eventEndDate < now;
                          const rsvpEnabled = (scopedPriorityEvent as any).rsvp_enabled;
                          const rsvpLink = (scopedPriorityEvent as any).rsvp_link;
                          
                          if (!isPastEvent && rsvpEnabled) {
                            if (rsvpLink) {
                              return (
                                <div className="flex flex-col items-center">
                                  <a
                                    href={rsvpLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center bg-white border-2 border-primary-600 text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-lg"
                                  >
                                    RSVP for This Event
                                  </a>
                                  <div className="mt-4 flex flex-col items-center">
                                    <QRCodeSVG 
                                      value={rsvpLink} 
                                      size={150}
                                      level="M"
                                      includeMargin={true}
                                      className="bg-white p-2 rounded-lg"
                                    />
                                    <p className="text-sm text-gray-600 mt-2">Scan to RSVP</p>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <Link
                                  to={`/events/${eventId}/rsvp`}
                                  className="inline-flex items-center justify-center bg-white border-2 border-primary-600 text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-lg"
                                >
                                  RSVP for This Event
                                </Link>
                              );
                            }
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Landscape or No Image Layout: Image on top, details on bottom */
                  <>
                    <div className="h-80 bg-gradient-to-br from-primary-400 to-primary-600 relative overflow-hidden flex items-center justify-center">
                      {eventImage ? (
                        <img
                          src={eventImage}
                          alt={eventName}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      <div className="absolute top-4 right-4 bg-yellow-500 rounded-full p-3 shadow-lg">
                        <Star className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>
                    <div className="p-8">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="bg-primary-600 text-white px-4 py-2 rounded-full text-sm font-medium">
                          {scopedPriorityEvent.year || new Date(eventDate).getFullYear()}
                        </span>
                      </div>
                      <h2 className="text-4xl font-bold text-gray-900 mb-4">{eventName}</h2>
                      <p className="text-lg text-gray-700 mb-6">{eventDescription}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="flex items-center text-gray-700">
                          <Calendar className="w-5 h-5 mr-3 text-primary-600" />
                          <div className="flex items-center gap-2">
                            {(() => {
                              const now = new Date();
                              const eventEndDate = scopedPriorityEvent.event_end_dt ? convertPSTToLocal(scopedPriorityEvent.event_end_dt) : convertPSTToLocal(eventDate);
                              const isUpcoming = eventEndDate >= now;
                              
                              if (isUpcoming) {
                                const calendarUrl = generateCalendarUrl(
                                  eventName,
                                  eventDate,
                                  scopedPriorityEvent.event_end_dt,
                                  eventLocation,
                                  eventDescription
                                );
                                return (
                                  <>
                                    <a
                                      href={calendarUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-lg underline hover:text-primary-600 cursor-pointer transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {formatDateWithTime(eventDate)}
                                    </a>
                                    <span className="text-sm text-gray-500">•</span>
                                    <a
                                      href={calendarUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-primary-600 underline hover:text-primary-700 cursor-pointer transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Add to Calendar
                                    </a>
                                  </>
                                );
                              }
                              return <span className="text-lg">{formatDateWithTime(eventDate)}</span>;
                            })()}
                          </div>
                        </div>
                        {eventLocation && (
                          <div className="flex items-center text-gray-700">
                            <MapPin className="w-5 h-5 mr-3 text-primary-600" />
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventLocation)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-lg underline hover:text-primary-600 cursor-pointer transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {eventLocation}
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3">
                        <Link
                          to={getEventDetailPath({ event_name: eventName }, eventId)}
                          className="inline-flex items-center justify-center bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors text-lg"
                        >
                          View Details <ArrowRight className="w-5 h-5 ml-2" />
                        </Link>
                        
                        {/* Show RSVP link only for upcoming events when RSVP is enabled */}
                        {(() => {
                          const now = new Date();
                          const eventEndDate = scopedPriorityEvent.event_end_dt ? new Date(scopedPriorityEvent.event_end_dt) : new Date(eventDate);
                          const isPastEvent = eventEndDate < now;
                          const rsvpEnabled = (scopedPriorityEvent as any).rsvp_enabled;
                          const rsvpLink = (scopedPriorityEvent as any).rsvp_link;
                          
                          if (!isPastEvent && rsvpEnabled) {
                            if (rsvpLink) {
                              return (
                                <div className="flex flex-col items-center">
                                  <a
                                    href={rsvpLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center bg-white border-2 border-primary-600 text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-lg"
                                  >
                                    RSVP for This Event
                                  </a>
                                  <div className="mt-4 flex flex-col items-center">
                                    <QRCodeSVG 
                                      value={rsvpLink} 
                                      size={150}
                                      level="M"
                                      includeMargin={true}
                                      className="bg-white p-2 rounded-lg"
                                    />
                                    <p className="text-sm text-gray-600 mt-2">Scan to RSVP</p>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <Link
                                  to={`/events/${eventId}/rsvp`}
                                  className="inline-flex items-center justify-center bg-white border-2 border-primary-600 text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-lg"
                                >
                                  RSVP for This Event
                                </Link>
                              );
                            }
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          );
        })()}

        {/* Related gallery photos (type-scoped, randomized) */}
        {galleryHighlights.length > 0 && (
          <section className="mb-12">
            <SectionHeading kicker="From our events">Photo gallery</SectionHeading>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {galleryHighlights.map((p, i) => (
                <Link
                  key={`${p.galleryId}-${i}`}
                  to={`/galleries/${p.galleryId}`}
                  className="group block aspect-square overflow-hidden rounded-xl bg-gray-100 shadow-sm"
                >
                  <img
                    src={p.url}
                    alt={p.alt}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </Link>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Link
                to="/galleries"
                className="inline-flex items-center gap-1 text-primary-600 font-medium hover:underline"
              >
                See all photo galleries <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>
        )}

        {/* All Events Section */}
        <div id="all-events" className="mb-8 scroll-mt-24">
          <SectionHeading kicker="Full archive">Browse all events</SectionHeading>
        </div>

        {/* Events Carousel */}
        {eventsForCarousel.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No events available at this time.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Navigation Arrows */}
            <button
              onClick={handlePrevious}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white rounded-full p-3 shadow-lg hover:bg-gray-100 transition-colors border-2 border-primary-600"
              aria-label="Previous events"
            >
              <ChevronLeft className="w-6 h-6 text-primary-600" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white rounded-full p-3 shadow-lg hover:bg-gray-100 transition-colors border-2 border-primary-600"
              aria-label="Next events"
            >
              <ChevronRight className="w-6 h-6 text-primary-600" />
            </button>

            {/* Carousel Container */}
            <div className="relative h-[500px] flex items-center justify-center overflow-hidden py-12 px-16">
              <div
                className="relative w-full h-full flex items-center justify-center"
                style={{
                  perspective: '1200px',
                  perspectiveOrigin: 'center center',
                }}
              >
                {visibleCards.map((card) => {
                  const event = card.event;
              const eventId = event.event_id || event.id || '';
              const eventName = event.event_name || event.title || 'Untitled Event';
              const eventDate = event.event_start_dt || event.date || '';
              const eventImage = eventImages[eventId]; // Only use images from eventImages state
              const eventImageOrientation = eventImageOrientations[eventId];
              const isPortrait = eventImageOrientation === 'portrait' && eventImage;

                  const isMiddle = card.position === 0;
                  const isLeft = card.position < 0;
                  const isRight = card.position > 0;

                  // Calculate styles - cards flow from right to left
                  // Only position 0 is the front card
                  const scale = card.position === 0 ? 1.3 : 0.7;
                  
                  // Continuous horizontal positioning
                  let xOffset;
                  if (card.position === 0) {
                    xOffset = 0; // Front card centered
                  } else {
                    // Side cards: maintain continuous spacing
                    const baseSpacing = 240;
                    if (card.position < 0) {
                      // Left side cards
                      xOffset = card.position * baseSpacing;
                    } else {
                      // Right side cards
                      xOffset = card.position * baseSpacing;
                    }
                  }
                  
                  // Create wheel effect: front card forward, side cards go back
                  const zOffset = isMiddle ? 100 : -Math.abs(card.position) * 80 - 50;
                  const rotateY = isLeft ? 15 : isRight ? -15 : 0;
                  const opacity = isMiddle ? 1 : 0.7;
              
              return (
                <motion.div
                      key={`event-${eventId}-${card.position}-${card.index}`}
                      animate={{
                        opacity,
                        x: xOffset,
                        scale,
                        rotateY,
                        z: zOffset,
                      }}
                      transition={{
                        duration: 1.0,
                        ease: [0.25, 0.1, 0.25, 1],
                      }}
                      style={{
                        position: 'absolute',
                        transformStyle: 'preserve-3d',
                        zIndex: isMiddle ? 10 : 5 - Math.abs(card.position),
                      }}
                      className="will-change-transform flex flex-col items-center"
                    >
                      <Link to={getEventDetailPath({ event_name: eventName }, eventId)} className="flex flex-col items-center">
                        <div
                          className={`bg-white rounded-xl overflow-hidden transition-all duration-300 cursor-pointer ${
                            isMiddle
                              ? 'shadow-2xl ring-4 ring-primary-200 ring-opacity-50'
                              : 'shadow-lg'
                          }`}
                          style={{
                            width: card.position === 0 ? '240px' : '180px',
                            height: card.position === 0 ? '300px' : '220px',
                          }}
                        >
                          {/* Event Image */}
                  {eventImage && (
                            <div 
                              className="bg-gradient-to-br from-primary-400 to-primary-600 relative overflow-hidden flex items-center justify-center"
                              style={{
                                height: card.position === 0 
                                  ? (isPortrait ? '180px' : '140px')
                                  : (isPortrait ? '120px' : '90px'),
                              }}
                            >
                            <img
                              src={eventImage}
                              alt={eventName}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                          )}

                          {/* Event Details */}
                          <div className={`p-3 ${eventImage ? '' : 'pt-4'}`}>
                            <h3 className={`font-bold text-gray-900 mb-1.5 ${isMiddle ? 'text-lg' : 'text-sm'} line-clamp-2`}>
                              {eventName}
                            </h3>

                            {/* Date and Location */}
                            <div className="space-y-0.5 mb-2">
                              <div className="flex items-center text-gray-600">
                                <Calendar className={`${isMiddle ? 'w-3 h-3' : 'w-3 h-3'} mr-2 flex-shrink-0`} />
                                {(() => {
                                  const now = new Date();
                                  const eventEndDate = event.event_end_dt ? convertPSTToLocal(event.event_end_dt) : convertPSTToLocal(eventDate);
                                  const isUpcoming = eventEndDate >= now;
                                  
                                  if (isUpcoming) {
                                    const eventName = event.event_name || event.title || 'Untitled Event';
                                    const eventDescription = event.event_description || event.description || '';
                                    const calendarUrl = generateCalendarUrl(
                                      eventName,
                                      eventDate,
                                      event.event_end_dt,
                                      event.location,
                                      eventDescription
                                    );
                                    return (
                                      <a
                                        href={calendarUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`truncate ${isMiddle ? 'text-xs' : 'text-xs'} underline hover:text-primary-600 cursor-pointer transition-colors`}
                                        onClick={(e) => e.stopPropagation()}
                                        title="Add to calendar"
                                      >
                                        {formatDateWithTime(eventDate, 'MMM dd, yyyy', 'h:mm a')}
                                      </a>
                                    );
                                  }
                                  return <span className={`truncate ${isMiddle ? 'text-xs' : 'text-xs'}`}>{formatDateWithTime(eventDate, 'MMM dd, yyyy', 'h:mm a')}</span>;
                                })()}
                              </div>
                              {event.location && (
                                <div className="flex items-center text-gray-600">
                                  <MapPin className={`${isMiddle ? 'w-3 h-3' : 'w-3 h-3'} mr-2 flex-shrink-0`} />
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`truncate ${isMiddle ? 'text-xs' : 'text-xs'} underline hover:text-primary-600 cursor-pointer transition-colors`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {event.location}
                                  </a>
                                </div>
                              )}
                            </div>

                            {/* View Details Link */}
                            <div className="flex items-center text-primary-600 font-medium mt-auto">
                              <span className="text-xs">View Details</span>
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </div>
                          </div>
                        </div>
                      </Link>
                      
                      {/* Month and Year - Outside and below the card */}
                      <div className="mt-3 text-center">
                        <p className={`text-primary-600 font-semibold ${isMiddle ? 'text-base' : 'text-sm'}`}>
                          {eventDate ? (() => {
                            const date = convertPSTToLocal(eventDate);
                            return !isNaN(date.getTime()) ? format(date, 'MMMM yyyy') : '';
                          })() : ''}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Timeline */}
            {eventsForCarousel.length > 0 && (() => {
              // Find earliest and latest event dates
              const eventDates = eventsForCarousel
                .map(e => new Date(e.event_start_dt || e.date || 0))
                .filter(date => !isNaN(date.getTime()))
                .sort((a, b) => a.getTime() - b.getTime());
              
              if (eventDates.length === 0) return null;
              
              const earliestDate = eventDates[0];
              const latestDate = eventDates[eventDates.length - 1];
              
              // Group events by year, then by month
              const eventsByYearMonth: Record<string, Record<string, Date[]>> = {};
              eventsForCarousel.forEach(e => {
                const eventDate = convertPSTToLocal(e.event_start_dt || e.date || '');
                if (!isNaN(eventDate.getTime())) {
                  const year = format(eventDate, 'yyyy');
                  const monthYear = format(eventDate, 'yyyy-MM');
                  const [y, m] = monthYear.split('-');
                  
                  if (!eventsByYearMonth[year]) {
                    eventsByYearMonth[year] = {};
                  }
                  if (!eventsByYearMonth[year][monthYear]) {
                    eventsByYearMonth[year][monthYear] = [];
                  }
                  eventsByYearMonth[year][monthYear].push(new Date(parseInt(y), parseInt(m) - 1, 1));
                }
              });
              
              // Get unique years and sort
              const years = Object.keys(eventsByYearMonth)
                .map(y => parseInt(y))
                .sort((a, b) => a - b);
              
              // Calculate total time range in milliseconds
              const totalRange = latestDate.getTime() - earliestDate.getTime();
              
              // Helper to get year position
              const getYearPosition = (year: number) => {
                const yearDate = new Date(year, 0, 1); // January 1st of the year
                if (totalRange === 0) return 50;
                let position = ((yearDate.getTime() - earliestDate.getTime()) / totalRange) * 100;
                return Math.max(2, Math.min(98, position));
              };
              
              // Helper to get month position within a year
              const getMonthPosition = (year: number, month: number) => {
                const yearStart = new Date(year, 0, 1);
                const yearEnd = new Date(year, 11, 31);
                const monthDate = new Date(year, month - 1, 1);
                const yearRange = yearEnd.getTime() - yearStart.getTime();
                if (yearRange === 0) return 0;
                return ((monthDate.getTime() - yearStart.getTime()) / yearRange) * 100;
              };
              
              return (
                <div className="mt-12 mb-8 px-8">
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-primary-200 transform -translate-y-1/2"></div>
                    
                    {/* Year markers */}
                    <div className="relative">
                      {years.map((year) => {
                        const yearPosition = getYearPosition(year);
                        const isExpanded = expandedYear === year.toString();
                        const yearMonths = Object.keys(eventsByYearMonth[year.toString()])
                          .map(my => {
                            const [y, m] = my.split('-');
                            return { monthYear: my, month: parseInt(m), date: new Date(parseInt(y), parseInt(m) - 1, 1) };
                          })
                          .sort((a, b) => a.month - b.month);
                        
                        return (
                          <div key={year}>
                            {/* Year marker */}
                            <div
                              className="absolute flex flex-col items-center z-20 cursor-pointer group"
                              style={{
                                left: `${yearPosition}%`,
                                transform: 'translate(-50%, -50%)',
                                top: '50%',
                              }}
                              onClick={() => setExpandedYear(isExpanded ? null : year.toString())}
                            >
                              <div className={`w-4 h-4 bg-primary-600 rounded-full border-2 border-white shadow-lg transition-all ${isExpanded ? 'ring-2 ring-primary-400' : ''}`}></div>
                              <div className="mt-2 text-center whitespace-nowrap">
                                <p className="text-sm font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                                  {year}
                                </p>
                                {yearMonths.length > 0 && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {yearMonths.length} {yearMonths.length === 1 ? 'month' : 'months'}
                                  </p>
                                )}
                          </div>
                            </div>
                            
                            {/* Month markers (shown when year is expanded) */}
                            {isExpanded && yearMonths.map((monthData) => {
                              const monthPosition = getMonthPosition(year, monthData.month);
                              // Position relative to year marker
                              const yearStartPos = getYearPosition(year);
                              const yearEndPos = year < years[years.length - 1] 
                                ? getYearPosition(year + 1) 
                                : 98;
                              const yearWidth = yearEndPos - yearStartPos;
                              const absolutePosition = yearStartPos + (monthPosition / 100) * yearWidth;
                              
                              // Find events for this month-year
                              const eventsInMonth = eventsForCarousel.filter(e => {
                                const eventDate = convertPSTToLocal(e.event_start_dt || e.date || '');
                                if (isNaN(eventDate.getTime())) return false;
                                const eventMonthYear = format(eventDate, 'yyyy-MM');
                                return eventMonthYear === monthData.monthYear;
                              });
                              
                              // Find the index of the first event in this month
                              const firstEventIndex = eventsInMonth.length > 0 
                                ? eventsForCarousel.findIndex(e => {
                                    const eventId = e.event_id || e.id;
                                    return eventId === (eventsInMonth[0].event_id || eventsInMonth[0].id);
                                  })
                                : -1;
                              
                              const handleMonthClick = () => {
                                if (firstEventIndex >= 0) {
                                  // Rotate to show the event at position 0 (left front card)
                                  setCurrentIndex(firstEventIndex);
                                }
                              };
                              
                              return (
                                <div
                                  key={monthData.monthYear}
                                  className="absolute flex flex-col items-center z-10 cursor-pointer group"
                                  style={{
                                    left: `${Math.max(2, Math.min(98, absolutePosition))}%`,
                                    transform: 'translate(-50%, -50%)',
                                    top: '50%',
                                    marginTop: '40px', // Position below year marker
                                  }}
                                  onClick={handleMonthClick}
                                >
                                  <div className="w-2.5 h-2.5 bg-primary-400 rounded-full border-2 border-white shadow-md group-hover:bg-primary-500 transition-colors"></div>
                                  <div className="mt-1.5 text-center">
                                    <p className="text-xs font-medium text-gray-600 group-hover:text-primary-600 transition-colors hidden md:block">
                                      {format(monthData.date, 'MMM')}
                                    </p>
                                    <p className="text-xs font-medium text-gray-600 group-hover:text-primary-600 transition-colors md:hidden" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                                      {format(monthData.date, 'MMM')}
                                    </p>
                              </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
