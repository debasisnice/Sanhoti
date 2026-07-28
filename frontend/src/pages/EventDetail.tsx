import axios from 'axios';
import { useEffect, useState, type ReactNode } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ArrowLeft, Bell, Image as ImageIcon, ArrowRight, Palette } from 'lucide-react';
import { eventsAPI, noticesAPI, galleriesAPI, subEventsAPI } from '../services/api';
import { Event, Notice, PhotoGallery, SubEvent } from '../types';
import { format } from 'date-fns';
import { convertPSTToLocal, generateCalendarUrl, formatDateWithTime } from '../utils/dateUtils';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import EventShareButtons from '../components/EventShareButtons';
import { getCanonicalEventIdForShare, getEventSharePageUrl, getSiteOrigin } from '../utils/eventShareUrl';
import Seo from '../components/Seo';
import MenuDisplay, { buildMenuJsonLd } from '../components/MenuDisplay';
import { seoPlainText } from '../seo/seoUtils';
import { buildEventJsonLd } from '../seo/eventJsonLd';
import { getEventPath } from '../utils/eventSlug';
import { isDurgaPujaEventName, durgaPujaEventYear, durgaPujaPagePath } from '../utils/durgaPuja';
import FlyerImage from '../components/FlyerImage';

/** Durga-Puja-style section heading with a kicker and accent underline. */
function SectionHeading({ kicker, children }: { kicker?: string; children: ReactNode }) {
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

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [eventImage, setEventImage] = useState<string | null>(null);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [subEventImages, setSubEventImages] = useState<Record<string, string>>({});
  const [relatedNotices, setRelatedNotices] = useState<Notice[]>([]);
  const [relatedGalleries, setRelatedGalleries] = useState<PhotoGallery[]>([]);
  const [noticeImages, setNoticeImages] = useState<Record<string, Array<{ filename: string; url: string }>>>({});
  const [loading, setLoading] = useState(true);
  const [eventMissing, setEventMissing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (id) {
      const fetchEventAndImage = async () => {
        setEventMissing(false);
        setFetchError(false);
        try {
          const fetchedEvent = await eventsAPI.getById(id);
          setEvent(fetchedEvent);

          // Fetch event image if event has event_image_path
          if (fetchedEvent.event_id && fetchedEvent.event_image_path) {
            try {
              const imageData = await eventsAPI.getImagePublic(fetchedEvent.event_id);
              if (imageData) {
                const imageUrl = eventsAPI.getImageUrl(fetchedEvent.event_id, imageData.filename);
                setEventImage(imageUrl);
              }
            } catch (error) {
              // Silently fail if no images are found - image is optional
            }
          }

          // Fetch sub-events for this event
          if (fetchedEvent.event_id) {
            try {
              const fetchedSubEvents = await subEventsAPI.getByEventId(fetchedEvent.event_id);
              // Sort by start date descending, with defensive checks
              const sortedSubEvents = fetchedSubEvents
                .filter(se => se && se.sub_event_start_dt) // Filter out any invalid sub-events
                .sort((a, b) => {
                  const dateA = a.sub_event_start_dt ? new Date(a.sub_event_start_dt).getTime() : 0;
                  const dateB = b.sub_event_start_dt ? new Date(b.sub_event_start_dt).getTime() : 0;
                  return dateB - dateA; // Descending order (newest first)
                });
              setSubEvents(sortedSubEvents);

              // Fetch images for sub-events
              const imagesMap: Record<string, string> = {};
              for (const subEvent of sortedSubEvents) {
                if (subEvent.event_image_path) {
                  try {
                    // Get image filenames
                    const filenames = await subEventsAPI.getImages(subEvent.sub_event_id);
                    if (filenames && filenames.length > 0) {
                      // Use the first image
                      const filename = filenames[0];
                      imagesMap[subEvent.sub_event_id] = subEventsAPI.getImageUrl(subEvent.sub_event_id, filename);
                    }
                  } catch (error) {
                    // Silently fail if no images found
                  }
                }
              }
              setSubEventImages(imagesMap);
            } catch (error: any) {
              // Log error for debugging
              console.error('Error fetching sub-events:', error);
              setSubEvents([]);
            }
          }

          // Fetch related notices and galleries
          if (fetchedEvent.event_id) {
            try {
              // Fetch all public notices and filter by event_id
              const allNotices = await noticesAPI.getPublic();
              const notices = allNotices
                .filter(n => {
                  // Defensive check: ensure both event_id values exist
                  if (!n.event_id || !fetchedEvent.event_id) {
                    return false;
                  }
                  // Convert both to strings for safe comparison
                  return String(n.event_id) === String(fetchedEvent.event_id);
                })
                .sort((a, b) => {
                  const dateA = a.created_at || a.createdAt || '';
                  const dateB = b.created_at || b.createdAt || '';
                  return new Date(dateB).getTime() - new Date(dateA).getTime(); // Descending order (newest first)
                });
              setRelatedNotices(notices);

              // Fetch images for notices
              const imagesMap: Record<string, Array<{ filename: string; url: string }>> = {};
              for (const notice of notices) {
                const noticeId = notice.notice_id || notice.id;
                if (noticeId && notice.notice_image_path) {
                  try {
                    const images = await noticesAPI.getImages(noticeId);
                    imagesMap[noticeId] = images;
                  } catch (error) {
                    imagesMap[noticeId] = [];
                  }
                }
              }
              setNoticeImages(imagesMap);

              // Published galleries only (same rule as /galleries index)
              try {
                const allGalleries = await galleriesAPI.getPublic();
                const linked = allGalleries.filter(
                  (g) => g.eventId && String(g.eventId) === String(fetchedEvent.event_id)
                );
                setRelatedGalleries(linked);
              } catch {
                setRelatedGalleries([]);
              }
            } catch (error) {
              // Silently fail if notices/galleries can't be loaded
            }
          }
        } catch (err) {
          console.error(err);
          if (axios.isAxiosError(err) && err.response?.status === 404) {
            setEventMissing(true);
          } else {
            setFetchError(true);
            toast.error('Failed to load event');
          }
        } finally {
          setLoading(false);
        }
      };

      fetchEventAndImage();
    }
  }, [id]);

  if (!loading && event && isDurgaPujaEventName(event.event_name)) {
    return <Navigate to={durgaPujaPagePath(durgaPujaEventYear(event))} replace />;
  }

  if (loading) {
    return (
      <>
        <Seo
          title="Event | Sanhoti"
          description="Loading event details — Sanhoti Bengali Association of Orange County, CA."
          path={id ? `/events/${id}` : '/events'}
          ogType="article"
        />
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </>
    );
  }

  if (!loading && eventMissing) {
    return (
      <>
        <Seo
          title="Event not found | Sanhoti"
          description="This event could not be found. Browse current events at Sanhoti in Orange County, CA."
          path={id ? `/events/${id}` : '/events'}
          noindex
        />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Event not found</h2>
            <Link to="/events" className="text-primary-600 hover:text-primary-700">
              Back to Events
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!loading && fetchError) {
    return (
      <>
        <Seo
          title="Event | Sanhoti"
          description="Sanhoti Bengali Association event in Orange County, CA."
          path={id ? `/events/${id}` : '/events'}
          ogType="article"
        />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Could not load this event</h2>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setFetchError(false);
                window.location.reload();
              }}
              className="text-primary-600 hover:text-primary-700"
            >
              Try again
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!event) {
    return null;
  }

  const detailEventId = getCanonicalEventIdForShare(event, id);
  const detailEventName = event.event_name || event.title || 'Event';
  const detailPageUrl = getEventSharePageUrl(detailEventId);
  const detailDescription =
    seoPlainText(event.event_description || event.description || '') ||
    `${detailEventName} — Bengali community event with Sanhoti in Orange County, CA.`;
  const detailAbsImage = eventImage
    ? /^https?:\/\//i.test(eventImage)
      ? eventImage
      : `${getSiteOrigin()}${eventImage.startsWith('/') ? eventImage : `/${eventImage}`}`
    : null;
  const detailJsonLd = buildEventJsonLd(event, { pageUrl: detailPageUrl, imageUrl: detailAbsImage });

  // ---- Derived display values ----
  const eventDescription = event.event_description || event.description || '';
  // Blank lines separate paragraphs in the admin textarea.
  const descriptionParagraphs = eventDescription
    .split(/\n\s*\n/)
    .map(t => t.trim())
    .filter(Boolean);
  const eventDate = event.event_start_dt || event.date || '';
  const eventLocation = event.location || '';
  const eventYear = event.year || (eventDate ? new Date(eventDate).getFullYear() : new Date().getFullYear());
  const heroImg = eventImage || event.photo_gallery_link || event.imageUrl || '';
  const now = new Date();
  const eventEndForStatus = event.event_end_dt
    ? convertPSTToLocal(event.event_end_dt)
    : eventDate
      ? convertPSTToLocal(eventDate)
      : now;
  const isUpcoming = eventEndForStatus >= now;
  const calendarUrl = generateCalendarUrl(detailEventName, eventDate, event.event_end_dt, eventLocation, eventDescription);
  const rsvpEnabled = (event as unknown as { rsvp_enabled?: boolean }).rsvp_enabled;
  const rsvpLink = (event as unknown as { rsvp_link?: string }).rsvp_link;
  const mapsHref = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  const eventTypeWord =
    event.event_type === 'Charity'
      ? 'charity'
      : event.event_type === 'Workshop'
        ? 'workshop'
        : event.event_type === 'Festival'
          ? 'cultural'
          : 'community';
  const isWorkshop = event.event_type === 'Workshop';

  return (
    <div className="pb-32">
      <Seo
        title={`${detailEventName} | Sanhoti`}
        description={detailDescription}
        path={getEventPath(event, detailEventId)}
        ogType="article"
        ogImage={detailAbsImage}
        jsonLd={[
          ...(Array.isArray(detailJsonLd) ? detailJsonLd : [detailJsonLd]),
          // Standalone Menu node: schema.org Event has no `hasMenu`, so the
          // food is described alongside the event rather than nested in it.
          ...(() => {
            const m = buildMenuJsonLd(event.menu, {
              name: detailEventName,
              url: `${getSiteOrigin()}${getEventPath(event, detailEventId)}`,
            });
            return m ? [m] : [];
          })(),
        ]}
      />

      {/* ---- Hero ----
          The flyer is a background, so this box's height comes from the text on
          top of it. On a wide display the box is short and wide, and
          `object-cover` centres the crop — slicing the flyer from both edges.
          `object-top` moves the whole crop to the bottom so the title artwork
          survives. No min-height here, unlike /durga-puja: this image sits under
          a from-black/75 gradient and the readable flyer is rendered in full by
          FlyerImage further down, so there is nothing to gain from making all
          15 event heroes taller. */}
      <section className="relative overflow-hidden">
        {heroImg && (
          <div className="absolute inset-0">
            <img src={heroImg} alt="" aria-hidden="true" className="w-full h-full object-cover object-top" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-white" />
          </div>
        )}
        <div
          className={`relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 ${
            heroImg ? 'text-white' : 'text-gray-900'
          }`}
        >
          <Link
            to="/events"
            className={`inline-flex items-center mb-6 transition-colors ${
              heroImg ? 'text-white/90 hover:text-white' : 'text-primary-600 hover:text-primary-700'
            }`}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Events
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span
              className={`inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] px-3 py-1 rounded-full ${
                heroImg ? 'bg-white/15 text-white' : 'bg-primary-100 text-primary-700'
              }`}
            >
              {eventYear}
              {event.event_type ? ` · ${event.event_type}` : ''}
            </span>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-4">{detailEventName}</h1>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {eventDate &&
                (isUpcoming ? (
                  <a
                    href={calendarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 font-semibold ${
                      heroImg ? 'text-yellow-200 hover:text-yellow-100' : 'text-primary-700 hover:text-primary-800'
                    }`}
                  >
                    <Calendar className="w-5 h-5" /> {formatDateWithTime(eventDate)}
                  </a>
                ) : (
                  <span
                    className={`inline-flex items-center gap-2 font-semibold ${
                      heroImg ? 'text-yellow-100' : 'text-primary-700'
                    }`}
                  >
                    <Calendar className="w-5 h-5" /> {formatDateWithTime(eventDate)}
                  </span>
                ))}
              {eventLocation && (
                <a
                  href={mapsHref(eventLocation)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 ${
                    heroImg ? 'text-gray-100 hover:text-white' : 'text-gray-700 hover:text-primary-700'
                  }`}
                >
                  <MapPin className="w-5 h-5" /> {eventLocation}
                </a>
              )}
            </div>

            {eventDate && isUpcoming && (
              <p className={`mt-2 text-sm ${heroImg ? 'text-gray-200' : 'text-gray-500'}`}>
                <a href={calendarUrl} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                  Add to Calendar
                </a>
              </p>
            )}

            <div className="mt-6">
              <EventShareButtons eventId={detailEventId} eventName={detailEventName} />
            </div>

            {isUpcoming && rsvpEnabled && (
              <div className="mt-8">
                {rsvpLink ? (
                  <a
                    href={rsvpLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-lg"
                  >
                    RSVP for This Event
                  </a>
                ) : (
                  <Link
                    to={`/events/${detailEventId}/rsvp`}
                    className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-lg"
                  >
                    RSVP for This Event
                  </Link>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        {/* ---- About ---- */}
        <MenuDisplay menu={event.menu} className="mb-12" />

        <div className="mb-12">
          <SectionHeading kicker="About">About This Event</SectionHeading>
          {/* Real <p> elements rather than one pre-line block: descriptions are
              now several paragraphs long, and proper paragraphs read better and
              are better semantics for screen readers and search engines. */}
          {descriptionParagraphs.length > 0 && (
            <div className="border-l-4 border-primary-500 pl-4 space-y-4">
              {descriptionParagraphs.map((text, i) => (
                <p
                  key={i}
                  className={`leading-relaxed ${
                    i === 0 ? 'text-lg text-gray-800' : 'text-base text-gray-700'
                  }`}
                >
                  {text}
                </p>
              ))}
            </div>
          )}

          {/* Generic framing only when the admin's own description is too short to
              carry the page. Mirrors the /seo prerender's RICH_DESCRIPTION_CHARS
              rule so browsers and crawlers never see different content. */}
          {eventDescription.replace(/\s+/g, ' ').trim().length < 300 && (
            <p className="mt-4 text-gray-600 leading-relaxed">
              {detailEventName} {isUpcoming ? 'is' : 'was'} a Bengali {eventTypeWord} event organized by
              Sanhoti Bengali Association of Orange County{eventLocation ? ` at ${eventLocation}` : ''} in
              Orange County, California. Sanhoti is a 501(c)(3) non-profit celebrating Bengali culture
              across Orange County and Southern California through Durga Puja, Saraswati Puja, Poila
              Boishakh, Kali Puja, concerts, picnics, and community programs — open to everyone.
            </p>
          )}

          {/* Key details */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isWorkshop && event.workshop_theme && (
              <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <Palette className="w-5 h-5 text-primary-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Workshop theme</p>
                  <p className="font-semibold text-gray-900">{event.workshop_theme}</p>
                </div>
              </div>
            )}
            {isWorkshop && event.workshop_program_start_dt && (
              <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <Calendar className="w-5 h-5 text-primary-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Program starts</p>
                  <p className="font-semibold text-gray-900">
                    {formatDateWithTime(event.workshop_program_start_dt)}
                  </p>
                </div>
              </div>
            )}
            {isWorkshop && event.workshop_exhibition_dt && (
              <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <Calendar className="w-5 h-5 text-primary-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Final exhibition</p>
                  <p className="font-semibold text-gray-900">
                    {formatDateWithTime(event.workshop_exhibition_dt)}
                  </p>
                </div>
              </div>
            )}
            {eventDate && (
              <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <Calendar className="w-5 h-5 text-primary-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Date &amp; time</p>
                  <p className="font-semibold text-gray-900">
                    {formatDateWithTime(eventDate)}
                    {event.event_end_dt ? ` – ${formatDateWithTime(event.event_end_dt)}` : ''}
                  </p>
                </div>
              </div>
            )}
            {eventLocation && (
              <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <MapPin className="w-5 h-5 text-primary-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Location</p>
                  <a
                    href={mapsHref(eventLocation)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-gray-900 underline hover:text-primary-600"
                  >
                    {eventLocation}
                  </a>
                </div>
              </div>
            )}
          </div>

          {isWorkshop && event.workshop_registration_url && (
            <div className="mt-6">
              <a
                href={event.workshop_registration_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-lg"
              >
                Register for this workshop
              </a>
            </div>
          )}

          {/* Full flyer. object-contain keeps the text baked into the artwork
              readable; the blurred backdrop fills the section around it. */}
          <FlyerImage src={heroImg} alt={detailEventName} maxHeight={680} className="mt-6" />

          {/* RSVP QR for external link */}
          {isUpcoming && rsvpEnabled && rsvpLink && (
            <div className="mt-8 flex flex-col items-center">
              <QRCodeSVG
                value={rsvpLink}
                size={150}
                level="M"
                includeMargin={true}
                className="bg-white p-2 rounded-lg border border-gray-200"
              />
              <p className="text-sm text-gray-600 mt-2">Scan to RSVP</p>
            </div>
          )}
        </div>

        {/* ---- Sub-Events ---- */}
        {subEvents.length > 0 && (
          <div className="mb-12">
            <SectionHeading kicker="Programs">Sub-Events</SectionHeading>
            <div className="grid gap-6 md:grid-cols-2">
              {subEvents.map((subEvent, index) => {
                const subEventImage = subEventImages[subEvent.sub_event_id];
                const subEnd = subEvent.sub_event_end_dt
                  ? convertPSTToLocal(subEvent.sub_event_end_dt)
                  : convertPSTToLocal(subEvent.sub_event_start_dt);
                const subUpcoming = subEnd >= new Date();
                return (
                  <motion.div
                    key={subEvent.sub_event_id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 flex flex-col"
                  >
                    {subEventImage && (
                      <div className="h-48 bg-gray-50 flex items-center justify-center p-3">
                        <img
                          src={subEventImage}
                          alt={subEvent.sub_event_name}
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{subEvent.sub_event_name}</h3>
                      <div className="space-y-1 text-sm text-gray-600 mb-3">
                        <p className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary-600 shrink-0" />{' '}
                          {formatDateWithTime(subEvent.sub_event_start_dt)}
                          {subEvent.sub_event_end_dt ? ` – ${formatDateWithTime(subEvent.sub_event_end_dt)}` : ''}
                        </p>
                        {subEvent.location && (
                          <p className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-primary-600 shrink-0" />
                            <a
                              href={mapsHref(subEvent.location)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-primary-600"
                            >
                              {subEvent.location}
                            </a>
                          </p>
                        )}
                      </div>
                      {subEvent.event_description && (
                        <p className="text-gray-700 text-sm whitespace-pre-line mb-4">{subEvent.event_description}</p>
                      )}
                      {subUpcoming && subEvent.rsvp_enabled && (
                        <div className="mt-auto pt-2">
                          {subEvent.rsvp_link ? (
                            <a
                              href={subEvent.rsvp_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-primary-700 transition-colors text-sm"
                            >
                              RSVP for This Sub-Event
                            </a>
                          ) : (
                            <Link
                              to={`/sub-events/${subEvent.sub_event_id}/rsvp`}
                              className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-primary-700 transition-colors text-sm"
                            >
                              RSVP for This Sub-Event
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- Related Notices ---- */}
        {relatedNotices.length > 0 && (
          <div className="mb-12">
            <SectionHeading kicker="Updates">Related Notices</SectionHeading>
            <div className="space-y-6">
              {relatedNotices.map((notice, index) => {
                const noticeId = notice.notice_id || notice.id;
                const noticeName = notice.notice_name || notice.title || 'Untitled Notice';
                const noticeBody = notice.notice_body || notice.content || '';
                const createdAt = notice.created_at || notice.createdAt || '';
                const images = noticeId ? noticeImages[noticeId] || [] : [];

                return (
                  <motion.div
                    key={noticeId}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
                  >
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <Bell className="w-6 h-6 text-primary-600" />
                        <h3 className="text-xl font-bold text-gray-900">{noticeName}</h3>
                      </div>
                      <div className="text-sm text-gray-500">
                        Posted on {createdAt ? format(convertPSTToLocal(createdAt), 'MMMM dd, yyyy') : ''}
                      </div>
                    </div>
                    <p className="text-gray-700 whitespace-pre-line mb-4">{noticeBody}</p>
                    {images.length > 0 && (
                      <div
                        className={`grid ${
                          images.length === 1
                            ? 'grid-cols-1'
                            : images.length === 2
                              ? 'grid-cols-1 md:grid-cols-2'
                              : 'grid-cols-1 md:grid-cols-3'
                        } gap-6`}
                      >
                        {images.map((image, imgIndex) => (
                          <div
                            key={imgIndex}
                            className="w-full overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-shadow"
                          >
                            <img
                              src={image.url}
                              alt={`${noticeName} - Image ${imgIndex + 1}`}
                              className="w-full h-auto object-contain max-h-[600px] mx-auto"
                              style={{ display: 'block' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- Related Galleries ---- */}
        {relatedGalleries.length > 0 && (
          <div>
            <SectionHeading kicker="Photos">Related Photo Galleries</SectionHeading>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedGalleries
                .filter(gallery => gallery && gallery.id)
                .map((gallery, index) => {
                  const photos = gallery.photos || [];
                  const firstPhoto = photos.length > 0 ? photos[0] : null;
                  const imageUrl = firstPhoto?.thumbnailUrl || firstPhoto?.url || '';
                  const title = gallery.title || 'Untitled Gallery';

                  return (
                    <motion.div
                      key={gallery.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-1"
                    >
                      <Link to={`/galleries/${gallery.id}`}>
                        <div className="relative h-48 bg-gradient-to-br from-primary-400 to-primary-600">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-16 h-16 text-white opacity-50" />
                            </div>
                          )}
                        </div>
                        <div className="p-6">
                          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                          {gallery.description && (
                            <p className="text-gray-600 text-sm mb-4">{gallery.description}</p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">
                              {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                            </span>
                            <ArrowRight className="w-5 h-5 text-primary-600" />
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
