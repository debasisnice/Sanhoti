import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ArrowRight, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { eventsAPI } from '../services/api';
import { Event } from '../types';
import { format } from 'date-fns';

export default function Events() {
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [priorityEvent, setPriorityEvent] = useState<Event | null>(null);
  const [priorityEventImage, setPriorityEventImage] = useState<string | null>(null);
  const [imageOrientation, setImageOrientation] = useState<'portrait' | 'landscape' | null>(null);
  const [eventImages, setEventImages] = useState<Record<string, string>>({});
  const [eventImageOrientations, setEventImageOrientations] = useState<Record<string, 'portrait' | 'landscape'>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedYear, setExpandedYear] = useState<string | null>(null);

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
        
        // Find priority event
        const priority = combined.find(e => e.is_priority === true);
        
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

  // Reorganize events to show nearest upcoming and most recent past first (include all events including priority)
  const eventsForCarousel = (() => {
    const filtered = allEvents; // Include all events, including priority events
    
    if (filtered.length === 0) return [];
    
    // Find nearest upcoming event and most recently completed event
    const now = new Date();
    const upcomingEvents = filtered.filter(e => {
      const eventDate = new Date(e.event_start_dt || e.date || 0);
      return eventDate >= now;
    }).sort((a, b) => {
      const dateA = new Date(a.event_start_dt || a.date || 0);
      const dateB = new Date(b.event_start_dt || b.date || 0);
      return dateA.getTime() - dateB.getTime(); // Ascending: nearest first
    });
    
    const pastEvents = filtered.filter(e => {
      const eventDate = e.event_end_dt ? new Date(e.event_end_dt) : new Date(e.event_start_dt || e.date || 0);
      return eventDate < now;
    }).sort((a, b) => {
      // Use event_end_dt for most recently completed, fallback to event_start_dt
      const dateA = a.event_end_dt ? new Date(a.event_end_dt) : new Date(a.event_start_dt || a.date || 0);
      const dateB = b.event_end_dt ? new Date(b.event_end_dt) : new Date(b.event_start_dt || b.date || 0);
      return dateB.getTime() - dateA.getTime(); // Descending: most recent first
    });
    
    const nearestUpcoming = upcomingEvents[0];
    const mostRecentPast = pastEvents[0];
    
    // Reorganize array: most recent past at index 0 (left), nearest upcoming at index 1 (right), then rest
    const reorganized: Event[] = [];
    const remainingEvents = filtered.filter(e => {
      const eventId = e.event_id || e.id;
      const nearestUpcomingId = nearestUpcoming?.event_id || nearestUpcoming?.id;
      const mostRecentPastId = mostRecentPast?.event_id || mostRecentPast?.id;
      return eventId !== nearestUpcomingId && eventId !== mostRecentPastId;
    });
    
    // Reverse order: past events on left, upcoming events on right
    if (mostRecentPast) {
      reorganized.push(mostRecentPast);
    }
    if (nearestUpcoming) {
      reorganized.push(nearestUpcoming);
    }
    reorganized.push(...remainingEvents);
    
    return reorganized;
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
    setCurrentIndex((prev) => (prev - 1 + eventsForCarousel.length) % eventsForCarousel.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % eventsForCarousel.length);
  };

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

        {/* All Events Section */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-3">
            <Calendar className="w-8 h-8 text-primary-600" />
            <h2 className="text-2xl font-bold text-gray-900">All Events</h2>
          </div>
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
                      key={`event-${eventId}`}
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
                      <Link to={`/events/${eventId}`} className="flex flex-col items-center">
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
                                <span className={`truncate ${isMiddle ? 'text-xs' : 'text-xs'}`}>
                                  {format(new Date(eventDate), 'MMM dd, yyyy')}
                                </span>
                              </div>
                              {event.location && (
                                <div className="flex items-center text-gray-600">
                                  <MapPin className={`${isMiddle ? 'w-3 h-3' : 'w-3 h-3'} mr-2 flex-shrink-0`} />
                                  <span className={`truncate ${isMiddle ? 'text-xs' : 'text-xs'}`}>
                                    {event.location}
                                  </span>
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
                          {format(new Date(eventDate), 'MMMM yyyy')}
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
                const eventDate = new Date(e.event_start_dt || e.date || 0);
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
                                const eventDate = new Date(e.event_start_dt || e.date || 0);
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
                                  <div className="mt-1.5 text-center whitespace-nowrap">
                                    <p className="text-xs font-medium text-gray-600 group-hover:text-primary-600 transition-colors">
                                      {format(monthData.date, 'MMM yyyy')}
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
