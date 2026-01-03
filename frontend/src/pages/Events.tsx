import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, ArrowRight, Star } from 'lucide-react';
import { eventsAPI } from '../services/api';
import { Event } from '../types';
import { format } from 'date-fns';

export default function Events() {
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [priorityEvent, setPriorityEvent] = useState<Event | null>(null);
  const [priorityEventImage, setPriorityEventImage] = useState<string | null>(null);
  const [imageOrientation, setImageOrientation] = useState<'portrait' | 'landscape' | null>(null);
  const [eventImages, setEventImages] = useState<Record<string, string>>({});
  const [eventImageOrientations, setEventImageOrientations] = useState<Record<string, 'portrait' | 'landscape'>>({});
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

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
    // Fetch upcoming and past events
    const fetchEventsAndImages = async () => {
      try {
        const [upcoming, past] = await Promise.all([
          eventsAPI.getUpcoming(),
          eventsAPI.getPast(),
        ]);
        
        // Find priority event from both lists
        const allEvents = [...upcoming, ...past];
        const priority = allEvents.find(e => e.is_priority === true);
        
        if (priority) {
          setPriorityEvent(priority);
          
          // Fetch event image if event has event_image_path
          if (priority.event_id && priority.event_image_path) {
            try {
              const imageData = await eventsAPI.getImagePublic(priority.event_id);
              if (imageData) {
                // Construct full URL using getImageUrl method
                const imageUrl = eventsAPI.getImageUrl(priority.event_id, imageData.filename);
                setPriorityEventImage(imageUrl);
                
                // Detect image orientation
                const orientation = await detectImageOrientation(imageUrl);
                setImageOrientation(orientation);
              }
            } catch (error) {
              // Silently fail if no images are found - image is optional
            }
          } else {
            // Reset image orientation if no image
            setImageOrientation(null);
          }
        }
        
        // Keep priority event in the lists (it will show both at top and in the list)
        setUpcomingEvents(upcoming);
        setPastEvents(past);
        
        // Fetch images for all events
        const allEventsList = [...upcoming, ...past];
        const imagePromises = allEventsList
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

  // Display events based on active tab (priority event is already filtered out)
  const events = activeTab === 'upcoming' ? upcomingEvents : pastEvents;

  return (
    <div className="py-12 pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Calendar className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              Community Events
            </h1>
          </div>
          <p className="text-2xl text-gray-600">
            Join us in celebrating Bengali culture and traditions
          </p>
        </motion.div>

        {/* Priority Event Card */}
        {priorityEvent && (() => {
          const eventId = priorityEvent.event_id || priorityEvent.id || '';
          const eventName = priorityEvent.event_name || priorityEvent.title || 'Untitled Event';
          const eventDescription = priorityEvent.event_description || priorityEvent.description || '';
          const eventDate = priorityEvent.event_start_dt || priorityEvent.date || '';
          const eventLocation = priorityEvent.location || '';
          
          // Use event image from Events_Flyers if available, otherwise use the old imageUrl/photo_gallery_link as fallback
          const eventImage = priorityEventImage || priorityEvent.photo_gallery_link || priorityEvent.imageUrl;
          
          // Determine layout based on image orientation
          const isPortrait = imageOrientation === 'portrait' && eventImage;
          const isLandscape = imageOrientation === 'landscape' && eventImage;
          
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
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
                          {priorityEvent.year || new Date(eventDate).getFullYear()}
                        </span>
                      </div>
                      <h2 className="text-4xl font-bold text-gray-900 mb-4">{eventName}</h2>
                      <p className="text-lg text-gray-700 mb-6">{eventDescription}</p>
                      
                      <div className="grid grid-cols-1 gap-4 mb-6">
                        <div className="flex items-center text-gray-700">
                          <Calendar className="w-5 h-5 mr-3 text-primary-600" />
                          <span className="text-lg">{format(new Date(eventDate), 'MMMM dd, yyyy')}</span>
                        </div>
                        {eventLocation && (
                          <div className="flex items-center text-gray-700">
                            <MapPin className="w-5 h-5 mr-3 text-primary-600" />
                            <span className="text-lg">{eventLocation}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3">
                        <Link
                          to={`/events/${eventId}`}
                          className="inline-flex items-center justify-center bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors text-lg"
                        >
                          View Details <ArrowRight className="w-5 h-5 ml-2" />
                        </Link>
                        
                        {/* Show RSVP link only for upcoming events */}
                        {(() => {
                          const now = new Date();
                          const eventEndDate = priorityEvent.event_end_dt ? new Date(priorityEvent.event_end_dt) : new Date(eventDate);
                          const isPastEvent = eventEndDate < now;
                          
                          if (!isPastEvent) {
                            return (
                              <Link
                                to={`/events/${eventId}/rsvp`}
                                className="inline-flex items-center justify-center bg-white border-2 border-primary-600 text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-lg"
                              >
                                RSVP for This Event
                              </Link>
                            );
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
                          {priorityEvent.year || new Date(eventDate).getFullYear()}
                        </span>
                      </div>
                      <h2 className="text-4xl font-bold text-gray-900 mb-4">{eventName}</h2>
                      <p className="text-lg text-gray-700 mb-6">{eventDescription}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="flex items-center text-gray-700">
                          <Calendar className="w-5 h-5 mr-3 text-primary-600" />
                          <span className="text-lg">{format(new Date(eventDate), 'MMMM dd, yyyy')}</span>
                        </div>
                        {eventLocation && (
                          <div className="flex items-center text-gray-700">
                            <MapPin className="w-5 h-5 mr-3 text-primary-600" />
                            <span className="text-lg">{eventLocation}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3">
                        <Link
                          to={`/events/${eventId}`}
                          className="inline-flex items-center justify-center bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors text-lg"
                        >
                          View Details <ArrowRight className="w-5 h-5 ml-2" />
                        </Link>
                        
                        {/* Show RSVP link only for upcoming events */}
                        {(() => {
                          const now = new Date();
                          const eventEndDate = priorityEvent.event_end_dt ? new Date(priorityEvent.event_end_dt) : new Date(eventDate);
                          const isPastEvent = eventEndDate < now;
                          
                          if (!isPastEvent) {
                            return (
                              <Link
                                to={`/events/${eventId}/rsvp`}
                                className="inline-flex items-center justify-center bg-white border-2 border-primary-600 text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-lg"
                              >
                                RSVP for This Event
                              </Link>
                            );
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

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-md inline-flex">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                activeTab === 'upcoming'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                activeTab === 'past'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Past Events
            </button>
          </div>
        </div>

        {/* Events Grid */}
        {events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No {activeTab} events at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ gridAutoRows: '1fr' }}>
            {events.map((event, index) => {
              const eventId = event.event_id || event.id || '';
              const eventName = event.event_name || event.title || 'Untitled Event';
              const eventDescription = event.event_description || event.description || '';
              const eventDate = event.event_start_dt || event.date || '';
              const eventLocation = event.location || '';
              // Use event image from Events_Flyers if available, otherwise use fallback
              const eventImage = eventImages[eventId] || event.photo_gallery_link || event.imageUrl;
              const eventImageOrientation = eventImageOrientations[eventId];
              const isPortrait = eventImageOrientation === 'portrait' && eventImage;
              
              return (
                <motion.div
                  key={eventId}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-2 flex flex-col"
                  style={{ minHeight: '450px', maxHeight: '450px', height: '450px' }}
                >
                  {eventImage && (
                    <>
                      {/* Portrait Layout: Image on left, details on right */}
                      {isPortrait ? (
                        <div className="flex flex-col md:flex-row h-full">
                          <div className="md:w-1/2 bg-gradient-to-br from-primary-400 to-primary-600 relative overflow-hidden flex items-center justify-center" style={{ minHeight: '200px' }}>
                            <img
                              src={eventImage}
                              alt={eventName}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="md:w-1/2 p-6 flex flex-col justify-center flex-1" style={{ minHeight: '200px' }}>
                            <div className="flex items-center justify-between mb-3">
                              <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-medium">
                                {event.year || new Date(eventDate).getFullYear()}
                              </span>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">{eventName}</h3>
                            <p className="text-gray-600 mb-4 line-clamp-3 text-sm flex-1">{eventDescription}</p>
                            
                            <div className="space-y-2 mb-4">
                              <div className="flex items-center text-gray-600">
                                <Calendar className="w-4 h-4 mr-2" />
                                <span className="text-sm">{format(new Date(eventDate), 'MMM dd, yyyy')}</span>
                              </div>
                              {eventLocation && (
                                <div className="flex items-center text-gray-600">
                                  <MapPin className="w-4 h-4 mr-2" />
                                  <span className="truncate text-sm">{eventLocation}</span>
                                </div>
                              )}
                            </div>

                            <Link
                              to={`/events/${eventId}`}
                              className="inline-flex items-center text-primary-600 font-medium hover:text-primary-700 text-sm"
                            >
                              View Details <ArrowRight className="w-4 h-4 ml-1" />
                            </Link>
                          </div>
                        </div>
                      ) : (
                        /* Landscape Layout: Image on top, details on bottom */
                        <>
                          <div className="h-48 bg-gradient-to-br from-primary-400 to-primary-600 relative overflow-hidden flex-shrink-0 flex items-center justify-center">
                            <img
                              src={eventImage}
                              alt={eventName}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="p-6 flex-1 flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                              <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-medium">
                                {event.year || new Date(eventDate).getFullYear()}
                              </span>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">{eventName}</h3>
                            <p className="text-gray-600 mb-4 line-clamp-2 text-sm flex-1">{eventDescription}</p>
                            
                            <div className="space-y-2 mb-4">
                              <div className="flex items-center text-gray-600">
                                <Calendar className="w-4 h-4 mr-2" />
                                <span className="text-sm">{format(new Date(eventDate), 'MMM dd, yyyy')}</span>
                              </div>
                              {eventLocation && (
                                <div className="flex items-center text-gray-600">
                                  <MapPin className="w-4 h-4 mr-2" />
                                  <span className="truncate text-sm">{eventLocation}</span>
                                </div>
                              )}
                            </div>

                            <Link
                              to={`/events/${eventId}`}
                              className="inline-flex items-center text-primary-600 font-medium hover:text-primary-700 text-sm"
                            >
                              View Details <ArrowRight className="w-4 h-4 ml-1" />
                            </Link>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {!eventImage && (
                    <div className="p-6 flex-1 flex flex-col" style={{ height: '100%' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-medium">
                          {event.year || new Date(eventDate).getFullYear()}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{eventName}</h3>
                      <p className="text-gray-600 mb-4 line-clamp-2 text-sm flex-1">{eventDescription}</p>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-gray-600">
                          <Calendar className="w-4 h-4 mr-2" />
                          <span className="text-sm">{format(new Date(eventDate), 'MMM dd, yyyy')}</span>
                        </div>
                        {eventLocation && (
                          <div className="flex items-center text-gray-600">
                            <MapPin className="w-4 h-4 mr-2" />
                            <span className="truncate text-sm">{eventLocation}</span>
                          </div>
                        )}
                      </div>

                      <Link
                        to={`/events/${eventId}`}
                        className="inline-flex items-center text-primary-600 font-medium hover:text-primary-700 text-sm"
                      >
                        View Details <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

