import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Users, Image, BookOpen, ArrowRight, Eye, Star, MapPin, Share2 } from 'lucide-react';
import { eventsAPI, homepageAPI, settingsAPI, subEventsAPI } from '../services/api';
import { Event, SubEvent } from '../types';
import { convertPSTToLocal, generateCalendarUrl, formatDateWithTime } from '../utils/dateUtils';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';

export default function Home() {
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [priorityEvent, setPriorityEvent] = useState<Event | null>(null);
  const [priorityEventImage, setPriorityEventImage] = useState<string | null>(null);
  const [imageOrientation, setImageOrientation] = useState<'portrait' | 'landscape' | null>(null);
  const [slideshowImages, setSlideshowImages] = useState<string[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [facebookLink, setFacebookLink] = useState<string>('https://m.facebook.com/groups/1379146276699787/?ref=share&mibextid=wwXIfr');
  const [whatsappLink, setWhatsappLink] = useState<string>('https://chat.whatsapp.com/HzI914nVyvGIZwarXzWzlH');
  const [activeAboutTab, setActiveAboutTab] = useState<'about' | 'vision' | 'mission'>('about');
  const [priorityEventSubEvents, setPriorityEventSubEvents] = useState<SubEvent[]>([]);
  const [charityEventImages, setCharityEventImages] = useState<string[]>([]);
  const [charityCardSlideIndex, setCharityCardSlideIndex] = useState(0);

  // Share functions
  const shareToFacebook = (eventId: string, _eventName: string) => {
    const url = `${window.location.origin}/events/${eventId}`;
    const encodedUrl = encodeURIComponent(url);
    
    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Try to open Facebook app on mobile
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isAndroid = /Android/i.test(navigator.userAgent);
      
      if (isIOS) {
        // iOS: Use fb:// URL scheme to open Facebook app
        const appUrl = `fb://share?u=${encodedUrl}`;
        const link = document.createElement('a');
        link.href = appUrl;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Fallback to web if app doesn't open (after a delay)
        setTimeout(() => {
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
        }, 1000);
      } else if (isAndroid) {
        // Android: Use intent URL to open Facebook app
        const intentUrl = `intent://share#Intent;scheme=fb;package=com.facebook.katana;S.url=${encodedUrl};end`;
        const link = document.createElement('a');
        link.href = intentUrl;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Fallback to web if app doesn't open (after a delay)
        setTimeout(() => {
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
        }, 1000);
      } else {
        // Other mobile devices - use web version
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
      }
    } else {
      // Desktop - use web version with popup
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank', 'width=600,height=400');
    }
  };

  const shareToWhatsApp = (eventId: string, eventName: string) => {
    const url = `${window.location.origin}/events/${eventId}`;
    const text = `Check out this event: ${eventName}\n${url}`;
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank');
  };

  const shareToInstagram = async (eventId: string, eventName: string) => {
    const url = `${window.location.origin}/events/${eventId}`;
    const text = `Check out this event: ${eventName}\n${url}`;
    
    // Use Web Share API if available (works on mobile and includes Instagram)
    if (navigator.share) {
      try {
        await navigator.share({
          title: eventName,
          text: text,
          url: url,
        });
      } catch (error: any) {
        // User cancelled or error occurred
        if (error.name !== 'AbortError') {
          // Fallback to clipboard if share fails
          await copyToClipboard(url);
        }
      }
    } else {
      // Fallback: Copy URL to clipboard
      await copyToClipboard(url);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Link copied to clipboard! You can now paste it in Instagram.');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('Link copied to clipboard! You can now paste it in Instagram.');
      } catch (err) {
        toast.error('Failed to copy link. Please copy manually.');
      }
      document.body.removeChild(textArea);
    }
  };

  const shareSubEventRSVP = async (subEvent: SubEvent, subEventId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rsvpUrl = subEvent.rsvp_link 
      ? subEvent.rsvp_link 
      : `${window.location.origin}/sub-events/${subEventId}/rsvp`;
    
    await copyToClipboard(rsvpUrl);
  };

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
        // Fetch upcoming events for the "Upcoming Events" section
        const upcoming = await eventsAPI.getUpcoming();
        setUpcomingEvents(upcoming);
        
        // Fetch ALL active events to find priority event (regardless of past/future)
        const allActiveEvents = await eventsAPI.getActive();
        
        // Find priority event from all active events
        const priority = allActiveEvents.find(e => e.is_priority === true);
        
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
          
          // Fetch sub-events for priority event that should be shown on home page
          try {
            const subEvents = await subEventsAPI.getByEventId(priority.event_id);
            const homePageSubEvents = subEvents.filter(
              (se: SubEvent) => se.show_in_home_page === true && se.is_active === true
            );
            console.log('Sub-events fetched:', subEvents.length, 'Home page sub-events:', homePageSubEvents.length);
            setPriorityEventSubEvents(homePageSubEvents);
          } catch (error) {
            console.error('Error fetching sub-events:', error);
            // Silently fail if no sub-events are found
            setPriorityEventSubEvents([]);
          }
        } else {
          setPriorityEventSubEvents([]);
        }

        // Fetch charity event images for hero right card slideshow
        const charityEvents = allActiveEvents.filter((e) => (e as any).event_type === 'Charity');
        const charityImagePromises = charityEvents
          .filter((e) => e.event_id && (e as any).event_image_path)
          .map(async (e) => {
            try {
              const imageData = await eventsAPI.getImagePublic(e.event_id!);
              return imageData ? eventsAPI.getImageUrl(e.event_id!, imageData.filename) : null;
            } catch {
              return null;
            }
          });
        const charityImages = (await Promise.all(charityImagePromises)).filter((url): url is string => !!url);
        setCharityEventImages(charityImages);
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    };
    
    fetchEvents();
  }, []);

  useEffect(() => {
    const fetchSocialLinks = async () => {
      try {
        const settings = await settingsAPI.getSettings();
        if (settings.facebookLink) setFacebookLink(settings.facebookLink);
        if (settings.whatsappLink) setWhatsappLink(settings.whatsappLink);
      } catch (error) {
        // Use default links if fetch fails
      }
    };
    
    fetchSocialLinks();
  }, []);

  // Add Events structured data (Schema.org) for SEO
  useEffect(() => {
    if (upcomingEvents.length === 0) return;

    // Remove existing events structured data
    const existingScript = document.getElementById('events-structured-data');
    if (existingScript) {
      existingScript.remove();
    }

    // Create structured data for events
    const eventsData = upcomingEvents.slice(0, 10).map((event) => {
      const startDate = event.event_start_dt ? convertPSTToLocal(event.event_start_dt) : null;
      const endDate = event.event_end_dt ? convertPSTToLocal(event.event_end_dt) : null;
      
      return {
        "@type": "Event",
        "name": event.event_name,
        "description": event.event_description || `${event.event_name} - Join us for this cultural event`,
        "startDate": startDate ? startDate.toISOString() : undefined,
        "endDate": endDate ? endDate.toISOString() : undefined,
        "location": event.location ? {
          "@type": "Place",
          "name": event.location,
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Orange County",
            "addressRegion": "CA",
            "addressCountry": "US"
          }
        } : {
          "@type": "Place",
          "name": "Sanhoti Bengali Association",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "23 Calle Alamitos",
            "addressLocality": "Rancho Santa Margarita",
            "addressRegion": "CA",
            "postalCode": "92688",
            "addressCountry": "US"
          }
        },
        "organizer": {
          "@type": "Organization",
          "name": "Sanhoti Bengali Association of Orange County",
          "url": "https://www.sanhoti.org",
          "email": "info@sanhoti.org",
          "telephone": "+1-949-378-6425"
        },
        "url": `https://www.sanhoti.org/events/${event.event_id}`,
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "eventStatus": "https://schema.org/EventScheduled"
      };
    }).filter(event => event.startDate); // Only include events with start dates

    if (eventsData.length > 0) {
      const script = document.createElement('script');
      script.id = 'events-structured-data';
      script.type = 'application/ld+json';
      script.text = JSON.stringify(eventsData.length === 1 ? eventsData[0] : eventsData);
      document.head.appendChild(script);
    }

    // Cleanup function
    return () => {
      const script = document.getElementById('events-structured-data');
      if (script) {
        script.remove();
      }
    };
  }, [upcomingEvents]);

  // Slideshow auto-advance
  useEffect(() => {
    if (slideshowImages.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slideshowImages.length);
    }, 8000); // Change slide every 8 seconds

    return () => clearInterval(interval);
  }, [slideshowImages.length]);

  // Charity card slideshow - fade between charity event images
  useEffect(() => {
    if (charityEventImages.length <= 1) return;

    const interval = setInterval(() => {
      setCharityCardSlideIndex((prev) => (prev + 1) % charityEventImages.length);
    }, 4000); // Change every 4 seconds

    return () => clearInterval(interval);
  }, [charityEventImages.length]);

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
      link: facebookLink,
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
      <section className="relative min-h-screen md:min-h-[120vh] flex items-center justify-center text-white overflow-hidden">
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
        
        {/* Hero Content - Logo, Welcome, Buttons, and Event Cards */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute top-4 left-2 right-2 md:top-8 md:left-12 md:right-12 lg:left-16 lg:right-16 z-20 flex flex-col md:flex-row md:items-end md:justify-between gap-6 md:gap-8"
        >
          <div className="flex flex-col gap-2 md:gap-4 max-w-[calc(100vw-1rem)] md:max-w-none">
            {/* Logo and Welcome Text */}
            <div className="flex items-center gap-2 md:gap-4">
              <div className="rounded-lg bg-white bg-opacity-70 p-1.5 md:p-2 md:p-3 shadow-lg flex-shrink-0">
            <img 
              src="/images/logo.png" 
                  alt="Sanhoti (সংহতি) Bengali Association of Orange County"
                  className="h-12 w-12 md:h-20 md:w-20 lg:h-24 lg:w-24 object-contain opacity-90"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div className="text-left min-w-0 flex-shrink">
                <motion.h1
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="text-base md:text-2xl lg:text-3xl font-bold text-white drop-shadow-lg mb-0.5 md:mb-1 opacity-95"
                >
                  Welcome to Sanhoti
                </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="text-xs md:text-base lg:text-lg text-white drop-shadow-lg opacity-90"
          >
                  Bengali Association of Orange County, CA
          </motion.p>
              </div>
            </div>
            
            {/* Buttons - Vertically Stacked on Mobile, Side by Side on Desktop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
              className="flex flex-col md:flex-row gap-1.5 md:gap-2 w-fit"
            >
              <a
                href={facebookLink}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-400 text-white px-2 py-1.5 md:px-4 md:py-2.5 rounded-lg font-semibold text-xs md:text-base hover:bg-blue-500 transition-all transform hover:scale-105 shadow-lg text-center whitespace-nowrap"
              >
                Join our Facebook Page
              </a>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-400 text-white px-2 py-1.5 md:px-4 md:py-2.5 rounded-lg font-semibold text-xs md:text-base hover:bg-green-500 transition-all transform hover:scale-105 shadow-lg text-center whitespace-nowrap"
              >
                Join us in WhatsApp
              </a>
            <Link
              to="/events"
                className="bg-transparent border-2 border-white text-white px-2 py-1.5 md:px-4 md:py-2.5 rounded-lg font-semibold text-xs md:text-base hover:bg-white hover:text-primary-600 transition-all transform hover:scale-105 text-center whitespace-nowrap w-[11rem] md:w-auto"
            >
              View Events
            </Link>
          </motion.div>

            {/* Priority Event Card */}
            {priorityEvent && priorityEventImage && (() => {
              const eventId = priorityEvent.event_id || priorityEvent.id || '';
              return (
                <div className="w-fit">
                  <Link to={`/events/${eventId}`} className="w-fit block">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                      className="relative rounded-lg shadow-xl w-32 md:w-80 lg:w-96 overflow-hidden aspect-[3/4] md:aspect-[3/3.5] border-2 md:border-4 border-yellow-400 cursor-pointer hover:shadow-2xl transition-shadow"
                      style={{
                        backgroundImage: `url(${priorityEventImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                    </motion.div>
                  </Link>
                  
                  {/* Sub-Events below Priority Event Card */}
                  {priorityEventSubEvents.length > 0 && (
                    <div className="mt-4 space-y-3 w-32 md:w-80 lg:w-96">
                      {priorityEventSubEvents.map((subEvent) => {
                        const subEventId = subEvent.sub_event_id;
                        const parentEventId = priorityEvent.event_id || priorityEvent.id || '';
                        return (
                          <motion.div
                            key={subEventId}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1 }}
                            className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg shadow-lg p-2.5 border-2 border-yellow-300 hover:border-yellow-400 transition-all"
                          >
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <Link
                                  to={`/events/${parentEventId}`}
                                  className="flex-1 font-semibold text-gray-900 text-xs md:text-sm hover:text-primary-600 transition-colors"
                                >
                                  {subEvent.sub_event_name}
                                </Link>
                                <div className="flex items-center gap-2">
                                  {subEvent.rsvp_enabled && (
                                    <button
                                      onClick={(e) => shareSubEventRSVP(subEvent, subEventId, e)}
                                      className="p-1.5 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                                      title="Share RSVP link"
                                    >
                                      <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                    </button>
                                  )}
                                  {subEvent.rsvp_enabled ? (
                                    subEvent.rsvp_link ? (
                                      <a
                                        href={subEvent.rsvp_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-primary-600 hover:bg-primary-700 text-white text-xs md:text-sm font-semibold px-3 md:px-4 py-0.5 md:py-1 rounded transition-colors whitespace-nowrap"
                                      >
                                        RSVP
                                      </a>
                                    ) : (
                                      <Link
                                        to={`/sub-events/${subEventId}/rsvp`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-primary-600 hover:bg-primary-700 text-white text-xs md:text-sm font-semibold px-3 md:px-4 py-0.5 md:py-1 rounded transition-colors whitespace-nowrap"
                                      >
                                        RSVP
                                      </Link>
                                    )
                                  ) : (
                                    <div className="w-[60px] h-[1.5rem]"></div>
                                  )}
                                </div>
                              </div>
                              {subEvent.sub_event_start_dt && (
                                <div className="text-[10px] md:text-xs text-gray-600 flex items-center gap-1">
                                  <Calendar className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                  <span>{formatDateWithTime(subEvent.sub_event_start_dt)}</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Right-side Charity Events Card - Fade slideshow of charity event images */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="w-full md:w-fit flex-shrink-0 flex flex-col items-start md:items-end gap-3"
          >
            <Link
              to="/events?type=Charity"
              className="bg-transparent border-2 border-white text-white px-2 py-1.5 md:px-4 md:py-2.5 rounded-lg font-semibold text-xs md:text-base hover:bg-white hover:text-primary-600 transition-all transform hover:scale-105 text-center whitespace-nowrap w-[11rem] md:w-auto"
            >
              View Charity Events
            </Link>
            <Link to="/events?type=Charity" className="block w-fit">
              <div className="relative rounded-lg shadow-xl w-32 md:w-80 lg:w-96 overflow-hidden aspect-[3/4] md:aspect-[3/3.5] border-2 md:border-4 border-yellow-400 cursor-pointer hover:shadow-2xl transition-shadow">
                {charityEventImages.length > 0 ? (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={charityCardSlideIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8 }}
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${charityEventImages[charityCardSlideIndex]})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                  </AnimatePresence>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center p-4">
                    <span className="text-white font-bold text-center text-sm md:text-lg">
                      Charity Events
                    </span>
                  </div>
                )}
              </div>
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

          {/* Tabs */}
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-lg p-1 shadow-md inline-flex">
              <button
                onClick={() => setActiveAboutTab('about')}
                className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                  activeAboutTab === 'about'
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                }`}
              >
                About Us
              </button>
              <button
                onClick={() => setActiveAboutTab('vision')}
                className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                  activeAboutTab === 'vision'
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                }`}
              >
                Vision
              </button>
              <button
                onClick={() => setActiveAboutTab('mission')}
                className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                  activeAboutTab === 'mission'
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                }`}
              >
                Mission
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeAboutTab === 'about' && (
            <motion.div
                key="about"
              initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              className="bg-gray-50 rounded-xl shadow-lg p-8 max-w-6xl mx-auto"
            >
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Sanhoti is a non-profit 501(c)(3) cultural and charitable organization dedicated to preserving and celebrating the rich heritage of Bengali culture in Orange County, California. As the premier Bengali Association in Orange County, we serve the Bengali community in Orange County, and surrounding areas.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Established in 2025, Sanhoti strives to build an inclusive and vibrant community where Bengali traditions flourish through festivals, arts, and meaningful community connections. From the grandeur of Durga Puja and Saraswati Puja to the joyous spirit of Poila Boishakh, we proudly bring people together to honor our roots and celebrate togetherness.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                While our foundation is deeply rooted in Bengali customs, Sanhoti embraces diversity and warmly welcomes individuals from all backgrounds to join in and experience the richness of our culture. Our doors are open to everyone—regardless of race, religion, or ethnicity.
              </p>
            </motion.div>
            )}

            {activeAboutTab === 'vision' && (
              <motion.div
                key="vision"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-50 rounded-xl shadow-lg p-8 max-w-6xl mx-auto"
              >
                <div className="flex items-center mb-6">
                  <div className="bg-primary-100 rounded-lg p-3 mr-4">
                    <Eye className="w-6 h-6 text-primary-600" />
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900">Vision</h3>
                </div>
                <p className="text-lg text-gray-700 leading-relaxed">
                  Sanhoti also serves as a nurturing platform for the next generation to stay connected to their cultural roots. Through a variety of cultural, literary, and social events held year-round, we create meaningful opportunities for children to explore and engage with the Bengali language, literature, music, and traditions.
                </p>
              </motion.div>
            )}

            {activeAboutTab === 'mission' && (
              <motion.div
                key="mission"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-50 rounded-xl shadow-lg p-8 max-w-6xl mx-auto"
              >
                <div className="flex items-center mb-6">
                  <div className="bg-primary-100 rounded-lg p-3 mr-4">
                    <Users className="w-6 h-6 text-primary-600" />
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900">Mission Statement</h3>
                </div>
                <p className="text-lg text-gray-700 leading-relaxed">
                  Sanhoti is committed to fostering an inclusive, diverse, and harmonious community in the Greater Orange County, CA region, while enriching the broader cultural landscape with the distinctive values and contributions of Indian heritage.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
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
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const now = new Date();
                                  const eventEndDate = priorityEvent.event_end_dt ? convertPSTToLocal(priorityEvent.event_end_dt) : convertPSTToLocal(eventDate);
                                  const isUpcoming = eventEndDate >= now;
                                  
                                  if (isUpcoming) {
                                    const calendarUrl = generateCalendarUrl(
                                      eventName,
                                      eventDate,
                                      priorityEvent.event_end_dt,
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
                              to={`/events/${eventId}`}
                              className="inline-flex items-center justify-center bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors text-lg"
                            >
                              View Details <ArrowRight className="w-5 h-5 ml-2" />
                            </Link>
                            
                            {/* Share Buttons */}
                            <div className="flex gap-3 justify-center flex-wrap">
                              <button
                                onClick={() => shareToFacebook(eventId, eventName)}
                                className="inline-flex items-center justify-center bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-base"
                                title="Share on Facebook"
                              >
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                </svg>
                                Share
                              </button>
                              <button
                                onClick={() => shareToWhatsApp(eventId, eventName)}
                                className="inline-flex items-center justify-center bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors text-base"
                                title="Share on WhatsApp"
                              >
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                </svg>
                                Share
                              </button>
                              <button
                                onClick={() => shareToInstagram(eventId, eventName)}
                                className="inline-flex items-center justify-center bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity text-base"
                                title="Share on Instagram"
                              >
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                </svg>
                                Share
                              </button>
                            </div>
                            
                            {/* Show RSVP link only for upcoming events when RSVP is enabled */}
                            {(() => {
                              const now = new Date();
                              const eventEndDate = priorityEvent.event_end_dt ? new Date(priorityEvent.event_end_dt) : new Date(eventDate);
                              const isPastEvent = eventEndDate < now;
                              const rsvpEnabled = (priorityEvent as any).rsvp_enabled;
                              const rsvpLink = (priorityEvent as any).rsvp_link;
                              
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
                              {priorityEvent.year || new Date(eventDate).getFullYear()}
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
                                  const eventEndDate = priorityEvent.event_end_dt ? convertPSTToLocal(priorityEvent.event_end_dt) : convertPSTToLocal(eventDate);
                                  const isUpcoming = eventEndDate >= now;
                                  
                                  if (isUpcoming) {
                                    const calendarUrl = generateCalendarUrl(
                                      eventName,
                                      eventDate,
                                      priorityEvent.event_end_dt,
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
                                    className="text-lg hover:text-primary-600 hover:underline cursor-pointer transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {eventLocation}
                                  </a>
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
                            
                            {/* Share Buttons */}
                            <div className="flex gap-3 justify-center flex-wrap">
                              <button
                                onClick={() => shareToFacebook(eventId, eventName)}
                                className="inline-flex items-center justify-center bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-base"
                                title="Share on Facebook"
                              >
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                </svg>
                                Share
                              </button>
                              <button
                                onClick={() => shareToWhatsApp(eventId, eventName)}
                                className="inline-flex items-center justify-center bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors text-base"
                                title="Share on WhatsApp"
                              >
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                </svg>
                                Share
                              </button>
                              <button
                                onClick={() => shareToInstagram(eventId, eventName)}
                                className="inline-flex items-center justify-center bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity text-base"
                                title="Share on Instagram"
                              >
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                </svg>
                                Share
                              </button>
                            </div>
                            
                            {/* Show RSVP link only for upcoming events when RSVP is enabled */}
                            {(() => {
                              const now = new Date();
                              const eventEndDate = priorityEvent.event_end_dt ? new Date(priorityEvent.event_end_dt) : new Date(eventDate);
                              const isPastEvent = eventEndDate < now;
                              const rsvpEnabled = (priorityEvent as any).rsvp_enabled;
                              const rsvpLink = (priorityEvent as any).rsvp_link;
                              
                              if (!isPastEvent && rsvpEnabled) {
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
                            {(() => {
                              const now = new Date();
                              const eventEndDate = event.event_end_dt ? convertPSTToLocal(event.event_end_dt) : convertPSTToLocal(eventDate);
                              const isUpcoming = eventEndDate >= now;
                              
                              if (isUpcoming) {
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
                                    className="text-primary-700 font-semibold underline hover:text-primary-600 cursor-pointer transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Add to calendar"
                                  >
                                    {formatDateWithTime(eventDate, 'MMM dd', 'h:mm a')}
                                  </a>
                                );
                              }
                              return <span className="text-primary-700 font-semibold">{formatDateWithTime(eventDate, 'MMM dd', 'h:mm a')}</span>;
                            })()}
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
              );
            })()}

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
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <a
              href={facebookLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-400 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-500 transition-all transform hover:scale-105 shadow-xl"
            >
              Become a Facebook Member
            </a>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-green-400 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-green-500 transition-all transform hover:scale-105 shadow-xl"
            >
              Join us in WhatsApp
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

