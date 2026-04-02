import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ArrowLeft, Bell, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { eventsAPI, noticesAPI, galleriesAPI, subEventsAPI } from '../services/api';
import { Event, Notice, PhotoGallery, SubEvent } from '../types';
import { format } from 'date-fns';
import { convertPSTToLocal, generateCalendarUrl, formatDateWithTime } from '../utils/dateUtils';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import EventShareButtons from '../components/EventShareButtons';
import { getCanonicalEventIdForShare } from '../utils/eventShareUrl';

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

  useEffect(() => {
    if (id) {
      const fetchEventAndImage = async () => {
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
              
              // Fetch galleries by event (use public endpoint and filter)
              try {
                const allGalleries = await galleriesAPI.getPublic();
                const galleries = allGalleries.filter(g => {
                  // Defensive check: ensure both eventId and fetchedEvent.event_id exist
                  if (!g.eventId || !fetchedEvent.event_id) {
                    return false;
                  }
                  // Convert both to strings for safe comparison
                  return String(g.eventId) === String(fetchedEvent.event_id);
                });
                setRelatedGalleries(galleries);
              } catch (error) {
                // Silently fail if no galleries found
                setRelatedGalleries([]);
              }
            } catch (error) {
              // Silently fail if notices/galleries can't be loaded
            }
          }
        } catch (err) {
          console.error(err);
          toast.error('Failed to load event');
        } finally {
          setLoading(false);
        }
      };
      
      fetchEventAndImage();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Event not found</h2>
          <Link to="/events" className="text-primary-600 hover:text-primary-700">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          to="/events"
          className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Events
        </Link>

        {/* Main Event and Sub-Events Container */}
        <div className={`grid ${subEvents.length > 0 ? 'grid-cols-1 md:grid-cols-3 gap-6' : 'grid-cols-1'}`}>
          {/* Main Event Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl shadow-2xl overflow-hidden border-4 border-yellow-400 ${subEvents.length > 0 ? 'md:col-span-2' : ''}`}
          >
          {(() => {
            const eventId = getCanonicalEventIdForShare(event, id);
            const eventName = event.event_name || event.title || 'Untitled Event';
            const eventDescription = event.event_description || event.description || '';
            const eventDate = event.event_start_dt || event.date || '';
            const eventLocation = event.location || '';
            // Use event image from Events_Flyers if available, otherwise use fallback
            const displayImage = eventImage || event.photo_gallery_link || event.imageUrl;
            const eventYear = event.year || new Date(eventDate).getFullYear();

            return (
              <>
                {displayImage && (
                  <div className="h-64 md:h-96 bg-gradient-to-br from-primary-400 to-primary-600 relative overflow-hidden flex items-center justify-center">
                    <img
                      src={displayImage}
                      alt={eventName}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        // If image fails to load, hide it and show gradient background
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                <div className="p-8">
                  <div className="flex items-center justify-between mb-4">
                    <span className="bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-medium">
                      {eventYear}
                    </span>
                  </div>

                  <h1 className="text-4xl font-bold text-gray-900 mb-4">{eventName}</h1>

                  <EventShareButtons eventId={eventId} eventName={eventName} className="mb-6" />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="flex items-center text-gray-700">
                      <Calendar className="w-5 h-5 mr-3 text-primary-600" />
                      <div>
                        <p className="text-sm text-gray-500">Start Date</p>
                        {(() => {
                          const now = new Date();
                          const eventEndDate = event.event_end_dt ? convertPSTToLocal(event.event_end_dt) : convertPSTToLocal(eventDate);
                          const isUpcoming = eventEndDate >= now;
                          
                          if (isUpcoming) {
                            const eventName = event.event_name || event.title || 'Untitled Event';
                            const eventDescription = event.event_description || event.description || '';
                            const eventLocation = event.location || '';
                            const calendarUrl = generateCalendarUrl(
                              eventName,
                              eventDate,
                              event.event_end_dt,
                              eventLocation,
                              eventDescription
                            );
                            return (
                              <div className="flex items-center gap-2 flex-wrap">
                                <a
                                  href={calendarUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold underline hover:text-primary-600 cursor-pointer transition-colors"
                                >
                                  {formatDateWithTime(eventDate)}
                                </a>
                                <span className="text-sm text-gray-400">•</span>
                                <a
                                  href={calendarUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary-600 underline hover:text-primary-700 cursor-pointer transition-colors"
                                >
                                  Add to Calendar
                                </a>
                              </div>
                            );
                          }
                          return <p className="font-semibold">{formatDateWithTime(eventDate)}</p>;
                        })()}
                      </div>
                    </div>
                    {event.event_end_dt && (
                      <div className="flex items-center text-gray-700">
                        <Calendar className="w-5 h-5 mr-3 text-primary-600" />
                        <div>
                          <p className="text-sm text-gray-500">End Date</p>
                          <p className="font-semibold">{formatDateWithTime(event.event_end_dt)}</p>
                        </div>
                      </div>
                    )}
                    {eventLocation && (
                      <div className="flex items-center text-gray-700">
                        <MapPin className="w-5 h-5 mr-3 text-primary-600" />
                        <div>
                          <p className="text-sm text-gray-500">Location</p>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventLocation)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold underline hover:text-primary-600 cursor-pointer transition-colors"
                          >
                            {eventLocation}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="prose max-w-none mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">About This Event</h2>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {eventDescription}
                    </p>
                  </div>

                  {/* Only show RSVP option for upcoming events when RSVP is enabled */}
                  {(() => {
                    const now = new Date();
                    const eventEndDate = event.event_end_dt 
                      ? convertPSTToLocal(event.event_end_dt) 
                      : convertPSTToLocal(eventDate);
                    const isPastEvent = eventEndDate < now;
                    const rsvpEnabled = (event as any).rsvp_enabled;
                    const rsvpLink = (event as any).rsvp_link;
                    
                    if (!isPastEvent && rsvpEnabled) {
                      if (rsvpLink) {
                        return (
                          <div className="flex flex-col items-center">
                            <a
                              href={rsvpLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
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
                            className="inline-block bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                          >
                            RSVP for This Event
                          </Link>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>
              </>
            );
          })()}
          </motion.div>

          {/* Sub-Events Cards (Desktop: Right side, Mobile: Below) */}
          {subEvents.length > 0 && (
            <div className="space-y-4 md:col-span-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 md:hidden">Sub Events</h2>
              {subEvents.map((subEvent, index) => {
                const subEventImage = subEventImages[subEvent.sub_event_id];
                return (
                  <motion.div
                    key={subEvent.sub_event_id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl shadow-2xl overflow-hidden border-4 border-yellow-400"
                  >
                    <div className="h-48 bg-gradient-to-br from-primary-400 to-primary-600 relative overflow-hidden flex items-center justify-center gap-4 p-4">
                      {subEventImage && (
                        <div className="flex-1 h-full flex items-center justify-center">
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
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-3">{subEvent.sub_event_name}</h3>
                      <div className="space-y-2 mb-3">
                        <div className="flex flex-row gap-4 items-start">
                          <div className="flex items-center text-gray-700">
                            <Calendar className="w-4 h-4 mr-2 text-primary-600" />
                            <div>
                              <p className="text-xs text-gray-500">Start Date</p>
                              <p className="font-semibold text-sm">{formatDateWithTime(subEvent.sub_event_start_dt)}</p>
                            </div>
                          </div>
                          {subEvent.sub_event_end_dt && (
                            <div className="flex items-center text-gray-700">
                              <Calendar className="w-4 h-4 mr-2 text-primary-600" />
                              <div>
                                <p className="text-xs text-gray-500">End Date</p>
                                <p className="font-semibold text-sm">{formatDateWithTime(subEvent.sub_event_end_dt)}</p>
                              </div>
                            </div>
                          )}
                        </div>
                        {subEvent.location && (
                          <div className="flex items-center text-gray-700">
                            <MapPin className="w-4 h-4 mr-2 text-primary-600" />
                            <div>
                              <p className="text-xs text-gray-500">Location</p>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(subEvent.location)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-sm underline hover:text-primary-600 cursor-pointer transition-colors"
                              >
                                {subEvent.location}
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                      {subEvent.event_description && (
                        <div className="prose max-w-none mb-4">
                          <p className="text-gray-700 leading-relaxed whitespace-pre-line text-xs">
                            {subEvent.event_description}
                          </p>
                        </div>
                      )}
                      {(() => {
                        const now = new Date();
                        const subEventEndDate = subEvent.sub_event_end_dt 
                          ? convertPSTToLocal(subEvent.sub_event_end_dt) 
                          : convertPSTToLocal(subEvent.sub_event_start_dt);
                        const isPastSubEvent = subEventEndDate < now;
                        
                        if (!subEvent.rsvp_enabled || isPastSubEvent) return null;
                        
                        if (subEvent.rsvp_link) {
                          // External RSVP link
                          return (
                            <div className="mt-4">
                              <a
                                href={subEvent.rsvp_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-primary-700 transition-colors text-sm"
                              >
                                RSVP for This Sub-Event
                              </a>
                            </div>
                          );
                        } else {
                          // Internal RSVP - use sub-events route
                          return (
                            <div className="mt-4">
                              <Link
                                to={`/sub-events/${subEvent.sub_event_id}/rsvp`}
                                className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-primary-700 transition-colors text-sm"
                              >
                                RSVP for This Sub-Event
                              </Link>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Related Notices */}
        {relatedNotices.length > 0 && (
          <div className="mt-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Bell className="w-8 h-8 text-primary-600" />
              Related Notices
            </h2>
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
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl shadow-2xl overflow-hidden border-4 border-yellow-400 p-6"
                  >
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="flex items-center space-x-3">
                        <Bell className="w-6 h-6 text-primary-600" />
                        <h3 className="text-2xl font-bold text-gray-900">{noticeName}</h3>
                      </div>
                      <div className="text-sm text-gray-500">
                        Posted on {createdAt ? format(convertPSTToLocal(createdAt), 'MMMM dd, yyyy') : ''}
                      </div>
                    </div>
                    <div className="prose max-w-none mb-4">
                      <p className="text-gray-700 whitespace-pre-line">{noticeBody}</p>
                    </div>
                    {images.length > 0 && (
                      <div className={`grid ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'} gap-6`}>
                        {images.map((image, imgIndex) => (
                          <div key={imgIndex} className="w-full overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-shadow">
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

        {/* Related Galleries */}
        {relatedGalleries.length > 0 && (
          <div className="mt-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <ImageIcon className="w-8 h-8 text-primary-600" />
              Related Photo Galleries
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedGalleries
                .filter(gallery => gallery && gallery.id) // Filter out invalid galleries
                .map((gallery, index) => {
                  const photos = gallery.photos || [];
                  const firstPhoto = photos.length > 0 ? photos[0] : null;
                  const imageUrl = firstPhoto?.thumbnailUrl || firstPhoto?.url || '';
                  const title = gallery.title || 'Untitled Gallery';
                  
                  return (
                    <motion.div
                      key={gallery.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-2"
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
                            <p className="text-gray-600 text-sm mb-4 line-clamp-2">{gallery.description}</p>
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

