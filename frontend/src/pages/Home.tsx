import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Users, Image, BookOpen, ArrowRight, Eye, Star, MapPin } from 'lucide-react';
import { eventsAPI, homepageAPI } from '../services/api';
import { Event } from '../types';
import { format } from 'date-fns';

export default function Home() {
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [priorityEvent, setPriorityEvent] = useState<Event | null>(null);
  const [priorityEventImage, setPriorityEventImage] = useState<string | null>(null);
  const [imageOrientation, setImageOrientation] = useState<'portrait' | 'landscape' | null>(null);
  const [slideshowImages, setSlideshowImages] = useState<string[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Function to detect image orientation
  const detectImageOrientation = (imageUrl: string): Promise<'portrait' | 'landscape'> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const orientation = img.height > img.width ? 'portrait' : 'landscape';
        resolve(orientation);
      };
      img.onerror = () => {
        resolve('landscape');
      };
      img.src = imageUrl;
    });
  };

  // Fetch slideshow images from backend
  useEffect(() => {
    const fetchSlideshowImages = async () => {
      try {
        const images = await homepageAPI.getImages();
        // Extract URLs from the response
        const imageUrls = images.map(img => img.url);
        setSlideshowImages(imageUrls);
      } catch (error) {
        // Silently fail if no images are found - fallback to gradient background
        setSlideshowImages([]);
      }
    };
    
    fetchSlideshowImages();
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const upcoming = await eventsAPI.getUpcoming();
        setUpcomingEvents(upcoming);
        
        // Find priority event
        const priority = upcoming.find(e => e.is_priority === true);
        
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
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    };
    
    fetchEvents();
  }, []);

  // Slideshow auto-advance
  useEffect(() => {
    if (slideshowImages.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slideshowImages.length);
    }, 8000); // Change slide every 8 seconds

    return () => clearInterval(interval);
  }, [slideshowImages.length]);

  const features = [
    {
      icon: Calendar,
      title: 'Cultural Events',
      description: 'Join us for Poila Boishakh, Durga Puja, Diwali, and more',
      link: '/events',
      color: 'from-primary-500 to-primary-600',
    },
    {
      icon: Users,
      title: 'Community',
      description: 'Connect with Bengali families across the USA',
      link: 'https://m.facebook.com/groups/1379146276699787/?ref=share&mibextid=wwXIfr',
      isExternal: true,
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: Image,
      title: 'Photo Galleries',
      description: 'Relive memories from past events and celebrations',
      link: '/galleries',
      color: 'from-purple-500 to-purple-600',
    },
    {
      icon: BookOpen,
      title: 'Magazines',
      description: 'Read our community magazines and publications',
      link: '/magazines',
      color: 'from-green-500 to-green-600',
    },
  ];

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center text-white overflow-hidden">
        {/* Background Slideshow */}
        <div className="absolute inset-0 z-0">
          {/* Fallback gradient background if no images load */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 z-0"></div>
          {slideshowImages.length > 0 && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlideIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, ease: 'easeInOut' }}
                className="absolute inset-0 z-0"
              >
                <img
                  src={slideshowImages[currentSlideIndex]}
                  alt={`Slideshow ${currentSlideIndex + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </div>
        
        {/* Overlay for text readability - reduced opacity so images are visible */}
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-primary-900/50 via-primary-800/40 to-primary-900/50"></div>
        <div className="absolute inset-0 z-10 bg-black/30"></div>
        
        {/* Pattern overlay for texture */}
        <div 
          className="absolute inset-0 z-10 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat'
          }}
        ></div>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center px-4 max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="mb-6"
          >
            <img 
              src="/images/logo.png" 
              alt="Sanhoti (সংহতি) Bengali Association of Orange County"
              className="mx-auto h-32 md:h-40 w-auto mb-4"
              onError={(e) => {
                // Fallback to text if image not found
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'block';
              }}
            />
            <h1 className="text-5xl md:text-7xl font-bold hidden">
              <span className="font-bengali block mb-2">সংহতি</span>
              <span className="block">Bengali Community</span>
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl mb-8 text-primary-100"
          >
            Welcome to Sanhoti<br />
            The Bengali Association of Orange County, CA
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <a
              href="https://m.facebook.com/groups/1379146276699787/?ref=share&mibextid=wwXIfr"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-50 transition-all transform hover:scale-105 shadow-xl inline-block"
            >
              Join our Facebook Page
            </a>
            <Link
              to="/events"
              className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white hover:text-primary-600 transition-all transform hover:scale-105"
            >
              View Events
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, repeat: Infinity, repeatType: 'reverse', duration: 2 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <div className="w-6 h-10 border-2 border-white rounded-full flex justify-center">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-1 h-3 bg-white rounded-full mt-2"
            />
          </div>
        </motion.div>
      </section>

      {/* About Us Section - Moved from About page */}
      <section className="py-20 bg-amber-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">About Us</h2>
            <p className="text-xl text-gray-600">Learn more about our community</p>
          </motion.div>

          <div className="space-y-8">
            {/* Main About Section - Wider */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-gray-50 rounded-xl shadow-lg p-8 max-w-6xl mx-auto"
            >
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Sanhoti is a non-profit 501(c)(3) cultural and charitable organization dedicated to preserving and celebrating the rich heritage of Bengali culture in Orange County, California.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Established in 2025, Sanhoti strives to build an inclusive and vibrant community where Bengali traditions flourish through festivals, arts, and meaningful community connections. From the grandeur of Durga Puja and Saraswati Puja to the joyous spirit of Poila Boishakh, we proudly bring people together to honor our roots and celebrate togetherness.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                While our foundation is deeply rooted in Bengali customs, Sanhoti embraces diversity and warmly welcomes individuals from all backgrounds to join in and experience the richness of our culture. Our doors are open to everyone—regardless of race, religion, or ethnicity.
              </p>
            </motion.div>

            {/* Vision and Mission Statement - Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
              {/* Vision Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="bg-gray-50 rounded-xl shadow-lg p-8"
              >
                <div className="flex items-center mb-4">
                  <div className="bg-primary-100 rounded-lg p-3 mr-4">
                    <Eye className="w-6 h-6 text-primary-600" />
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900">Vision</h3>
                </div>
                <p className="text-lg text-gray-700 leading-relaxed">
                  Sanhoti also serves as a nurturing platform for the next generation to stay connected to their cultural roots. Through a variety of cultural, literary, and social events held year-round, we create meaningful opportunities for children to explore and engage with the Bengali language, literature, music, and traditions.
                </p>
              </motion.div>

              {/* Mission Statement Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="bg-gray-50 rounded-xl shadow-lg p-8"
              >
                <div className="flex items-center mb-4">
                  <div className="bg-primary-100 rounded-lg p-3 mr-4">
                    <Users className="w-6 h-6 text-primary-600" />
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900">Mission Statement</h3>
                </div>
                <p className="text-lg text-gray-700 leading-relaxed">
                  Sanhoti is committed to fostering an inclusive, diverse, and harmonious community in the Greater Orange County, CA region, while enriching the broader cultural landscape with the distinctive values and contributions of Indian heritage.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming Events Section */}
      {upcomingEvents.length > 0 && (
        <section className="py-20 bg-amber-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Upcoming Events</h2>
              <p className="text-xl text-gray-600">Don't miss out on our next celebration</p>
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
                              const rsvpLink = (priorityEvent as any).rsvp_link;
                              
                              if (!isPastEvent) {
                                if (rsvpLink) {
                                  return (
                                    <a
                                      href={rsvpLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center bg-white border-2 border-primary-600 text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-lg"
                                    >
                                      RSVP for This Event
                                    </a>
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
                              const rsvpLink = (priorityEvent as any).rsvp_link;
                              
                              if (!isPastEvent) {
                                if (rsvpLink) {
                                  return (
                                    <a
                                      href={rsvpLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center bg-white border-2 border-primary-600 text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-lg"
                                    >
                                      RSVP for This Event
                                    </a>
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

            {/* Other Upcoming Events Grid */}
            {(() => {
              // Filter out priority event from the list
              const otherEvents = upcomingEvents.filter(e => !e.is_priority).slice(0, 3);
              
              if (otherEvents.length === 0) return null;
              
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {otherEvents.map((event, index) => {
                      const eventId = event.event_id || event.id || '';
                      const eventName = event.event_name || event.title || 'Untitled Event';
                      const eventDescription = event.event_description || event.description || '';
                      const eventDate = event.event_start_dt || event.date || '';
                      const eventYear = event.year || new Date(eventDate).getFullYear();
                      
                      return (
                        <motion.div
                          key={eventId}
                          initial={{ opacity: 0, y: 30 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: index * 0.1, duration: 0.6 }}
                          className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <span className="bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                              {eventYear}
                            </span>
                            <span className="text-primary-700 font-semibold">
                              {format(new Date(eventDate), 'MMM dd')}
                            </span>
                          </div>
                          <h3 className="text-2xl font-bold text-gray-900 mb-2">{eventName}</h3>
                          <p className="text-gray-600 mb-4 line-clamp-2">{eventDescription}</p>
                          <Link
                            to={`/events/${eventId}`}
                            className="text-primary-600 font-medium flex items-center hover:text-primary-700"
                          >
                            View Details <ArrowRight className="w-4 h-4 ml-1" />
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                    className="text-center mt-8"
                  >
                    <Link
                      to="/events"
                      className="inline-block bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                    >
                      View All Events
                    </Link>
                  </motion.div>
                </>
              );
            })()}
          </div>
        </section>
      )}

      {/* Features Section - What We Offer */}
      <section className="py-20 bg-amber-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">What We Offer</h2>
            <p className="text-xl text-gray-600">Everything you need to stay connected with the Bengali community</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-2"
              >
                <div className={`w-12 h-12 bg-gradient-to-r ${feature.color} rounded-lg flex items-center justify-center mb-4`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 mb-4">{feature.description}</p>
                {feature.isExternal ? (
                  <a
                    href={feature.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 font-medium flex items-center hover:text-primary-700"
                  >
                    Learn more <ArrowRight className="w-4 h-4 ml-1" />
                  </a>
                ) : (
                  <Link
                    to={feature.link}
                    className="text-primary-600 font-medium flex items-center hover:text-primary-700"
                  >
                    Learn more <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold mb-4"
          >
            Join Our Community Today
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl mb-8 text-primary-100"
          >
            Be part of a vibrant Bengali community celebrating culture, traditions, and togetherness.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <a
              href="https://m.facebook.com/groups/1379146276699787/?ref=share&mibextid=wwXIfr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-50 transition-all transform hover:scale-105 shadow-xl"
            >
              Become a Facebook Member
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

