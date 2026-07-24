import { useEffect, useMemo, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Users, Image, BookOpen, ArrowRight, Eye, Star, MapPin, Share2, Target } from 'lucide-react';
import { eventsAPI, homepageAPI, settingsAPI, subEventsAPI } from '../services/api';
import { Event, SubEvent } from '../types';
import { convertPSTToLocal, generateCalendarUrl, formatDateWithTime } from '../utils/dateUtils';
import { getEffectiveEventType } from '../utils/eventType';
import { DEFAULT_HOME_STATEMENTS, resolveHomeHeroBannerMessage } from '../constants/homePageStatements';
import { mergeStatement, renderHomeStatementBlocks } from '../utils/renderHomeStatements';
import { copyTextToClipboard } from '../utils/socialShare';
import EventShareButtons from '../components/EventShareButtons';
import { getCanonicalEventIdForShare } from '../utils/eventShareUrl';
import { QRCodeSVG } from 'qrcode.react';
import Seo from '../components/Seo';
import { getEventDetailPath } from '../utils/eventSlug';

type AboutStatementTabKey = 'about' | 'vision' | 'mission' | 'purpose';

const ABOUT_STATEMENT_TAB_ORDER: AboutStatementTabKey[] = ['about', 'vision', 'mission', 'purpose'];

const ABOUT_TAB_BUTTON_LABEL: Record<AboutStatementTabKey, string> = {
  about: 'About Us',
  vision: 'Vision',
  mission: 'Mission',
  purpose: 'Purpose',
};

/**
 * onError handler for event `<img>`s that retries a few times (with backoff and a
 * cache-buster) before hiding. Without this, a single transient failure on first
 * load — common when the small backend instance is cold/slow — permanently hides
 * the image, so it only appears after a manual refresh.
 */
function retryImageOnError(originalSrc: string) {
  return (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const tries = Number(img.dataset.retry || '0');
    if (tries >= 3) {
      img.style.display = 'none';
      return;
    }
    img.dataset.retry = String(tries + 1);
    const sep = originalSrc.includes('?') ? '&' : '?';
    window.setTimeout(() => {
      img.style.display = '';
      img.src = `${originalSrc}${sep}retry=${tries + 1}`;
    }, 600 * (tries + 1));
  };
}

/** Charity card: show priority image longer so it is on screen most of the time. */
const CHARITY_PRIORITY_IMAGE_MS = 14_000;
const CHARITY_OTHER_IMAGE_MS = 3_500;

function buildCharitySlideSchedule(
  imageCount: number,
  priorityImageIndex: number | null
): { index: number; dwellMs: number }[] {
  if (imageCount <= 1) return [];
  if (priorityImageIndex == null || priorityImageIndex < 0 || priorityImageIndex >= imageCount) {
    return Array.from({ length: imageCount }, (_, i) => ({
      index: i,
      dwellMs: CHARITY_OTHER_IMAGE_MS,
    }));
  }
  const others = Array.from({ length: imageCount }, (_, i) => i).filter((i) => i !== priorityImageIndex);
  const steps: { index: number; dwellMs: number }[] = [
    { index: priorityImageIndex, dwellMs: CHARITY_PRIORITY_IMAGE_MS },
  ];
  for (const o of others) {
    steps.push({ index: o, dwellMs: CHARITY_OTHER_IMAGE_MS });
  }
  return steps;
}

export default function Home() {
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [priorityEvent, setPriorityEvent] = useState<Event | null>(null);
  const [priorityEventImage, setPriorityEventImage] = useState<string | null>(null);
  const [slideshowImages, setSlideshowImages] = useState<string[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [facebookLink, setFacebookLink] = useState<string>('https://m.facebook.com/groups/1379146276699787/?ref=share&mibextid=wwXIfr');
  const [whatsappLink, setWhatsappLink] = useState<string>('https://chat.whatsapp.com/HzI914nVyvGIZwarXzWzlH');
  const [activeAboutTab, setActiveAboutTab] = useState<AboutStatementTabKey>('about');
  const [priorityEventSubEvents, setPriorityEventSubEvents] = useState<SubEvent[]>([]);
  const [charityEventImages, setCharityEventImages] = useState<string[]>([]);
  /** Index in charityEventImages for the priority charity event’s flyer, or null if none. */
  const [priorityCharityImageIndex, setPriorityCharityImageIndex] = useState<number | null>(null);
  const [charityCardSlideIndex, setCharityCardSlideIndex] = useState(0);
  /** Featured charity event in the section below About Us (not the hero Festival card). */
  const [priorityCharityEvent, setPriorityCharityEvent] = useState<Event | null>(null);
  const [priorityCharityEventImage, setPriorityCharityEventImage] = useState<string | null>(null);
  const [priorityCharityImageOrientation, setPriorityCharityImageOrientation] = useState<'portrait' | 'landscape' | null>(null);
  const [homeStatements, setHomeStatements] = useState<{
    about: string;
    vision: string;
    mission: string;
    purpose: string;
  }>({
    about: DEFAULT_HOME_STATEMENTS.about,
    vision: DEFAULT_HOME_STATEMENTS.vision,
    mission: DEFAULT_HOME_STATEMENTS.mission,
    purpose: DEFAULT_HOME_STATEMENTS.purpose,
  });
  const [statementTabsVisible, setStatementTabsVisible] = useState({
    about: true,
    vision: true,
    mission: true,
    purpose: true,
  });
  const [heroBannerText, setHeroBannerText] = useState<string | null>(null);
  const [heroButtonsVisible, setHeroButtonsVisible] = useState({
    facebook: true,
    whatsapp: true,
    viewEvents: true,
    durgaPuja: true,
    viewCharityEvents: true,
  });

  const visibleAboutTabKeys = useMemo(
    () => ABOUT_STATEMENT_TAB_ORDER.filter((k) => statementTabsVisible[k]),
    [statementTabsVisible]
  );

  const upcomingCharityEvents = useMemo(() => {
    return [...upcomingEvents]
      .filter((e) => getEffectiveEventType(e) === 'Charity')
      .sort((a, b) => {
        const ta = new Date(a.event_start_dt || (a as any).date || 0).getTime();
        const tb = new Date(b.event_start_dt || (b as any).date || 0).getTime();
        return ta - tb;
      });
  }, [upcomingEvents]);

  const otherUpcomingCharityEvents = useMemo(() => {
    const pid = priorityCharityEvent?.event_id || priorityCharityEvent?.id || '';
    if (!pid) return upcomingCharityEvents.slice(0, 3);
    return upcomingCharityEvents.filter((e) => (e.event_id || e.id || '') !== pid).slice(0, 3);
  }, [upcomingCharityEvents, priorityCharityEvent]);

  const showCharityEventsSection =
    priorityCharityEvent !== null || upcomingCharityEvents.length > 0;

  const shareSubEventRSVP = async (subEvent: SubEvent, subEventId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const rsvpUrl = subEvent.rsvp_link
      ? subEvent.rsvp_link
      : `${window.location.origin}/sub-events/${subEventId}/rsvp`;

    await copyTextToClipboard(rsvpUrl, 'RSVP link copied to clipboard.');
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
        // Fetch upcoming + all active events concurrently (independent calls).
        const [upcoming, allActiveEvents] = await Promise.all([
          eventsAPI.getUpcoming(),
          eventsAPI.getActive(),
        ]);
        setUpcomingEvents(upcoming);
        
        // Featured fund-raising (Festival type): priority event; charity has its own hero card
        const priority = allActiveEvents.find(
          (e) => e.is_priority === true && getEffectiveEventType(e) === 'Festival'
        );
        
        if (priority) {
          setPriorityEvent(priority);
          
          // Fetch the priority event's image and home sub-events concurrently.
          await Promise.all([
            (async () => {
              if (priority.event_id) {
                try {
                  const imageData = await eventsAPI.getImagePublic(priority.event_id);
                  if (imageData) {
                    setPriorityEventImage(
                      eventsAPI.getImageUrl(priority.event_id, imageData.filename)
                    );
                  }
                } catch (error) {
                  // Silently fail if no images are found - image is optional
                }
              }
            })(),
            (async () => {
              try {
                const subEvents = await subEventsAPI.getByEventId(priority.event_id);
                setPriorityEventSubEvents(
                  subEvents.filter(
                    (se: SubEvent) => se.show_in_home_page === true && se.is_active === true
                  )
                );
              } catch (error) {
                console.error('Error fetching sub-events:', error);
                // Silently fail if no sub-events are found
                setPriorityEventSubEvents([]);
              }
            })(),
          ]);
        } else {
          setPriorityEvent(null);
          setPriorityEventImage(null);
          setPriorityEventSubEvents([]);
        }

        // Priority charity: large card in "Charity Events" section below About Us
        const priorityCharity = allActiveEvents.find(
          (e) => e.is_priority === true && getEffectiveEventType(e) === 'Charity'
        );
        if (priorityCharity) {
          setPriorityCharityEvent(priorityCharity);
          if (priorityCharity.event_id) {
            try {
              const imageData = await eventsAPI.getImagePublic(priorityCharity.event_id);
              if (imageData) {
                const imageUrl = eventsAPI.getImageUrl(priorityCharity.event_id, imageData.filename);
                setPriorityCharityEventImage(imageUrl);
                const orientation = await detectImageOrientation(imageUrl);
                setPriorityCharityImageOrientation(orientation);
              } else {
                setPriorityCharityEventImage(null);
                setPriorityCharityImageOrientation(null);
              }
            } catch {
              setPriorityCharityEventImage(null);
              setPriorityCharityImageOrientation(null);
            }
          } else {
            setPriorityCharityEventImage(null);
            setPriorityCharityImageOrientation(null);
          }
        } else {
          setPriorityCharityEvent(null);
          setPriorityCharityEventImage(null);
          setPriorityCharityImageOrientation(null);
        }

        // Charity hero images: preserve order + mark priority for weighted slideshow
        const charityEvents = allActiveEvents.filter((e) => getEffectiveEventType(e) === 'Charity');
        charityEvents.sort((a, b) => {
          if (a.is_priority && !b.is_priority) return -1;
          if (!a.is_priority && b.is_priority) return 1;
          return 0;
        });
        const pairResults = await Promise.all(
          charityEvents.map(async (e) => {
            if (!e.event_id) return null;
            try {
              const imageData = await eventsAPI.getImagePublic(e.event_id!);
              const url = imageData ? eventsAPI.getImageUrl(e.event_id!, imageData.filename) : null;
              return url ? { url, isPriority: !!e.is_priority } : null;
            } catch {
              return null;
            }
          })
        );
        const pairs = pairResults.filter(
          (p): p is { url: string; isPriority: boolean } => p !== null
        );
        const charityImages = pairs.map((p) => p.url);
        const pImgIdx = pairs.findIndex((p) => p.isPriority);
        const priorityIdx = pImgIdx >= 0 ? pImgIdx : null;
        setCharityEventImages(charityImages);
        setPriorityCharityImageIndex(priorityIdx);
        setCharityCardSlideIndex(priorityIdx ?? 0);
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    };
    
    fetchEvents();
  }, []);

  useEffect(() => {
    const fetchSocialLinksAndStatements = async () => {
      try {
        const settings = await settingsAPI.getSettings();
        if (settings.facebookLink) setFacebookLink(settings.facebookLink);
        if (settings.whatsappLink) setWhatsappLink(settings.whatsappLink);
        const s = settings.statements as Record<string, string | undefined> | undefined;
        setHomeStatements({
          about: mergeStatement(s?.about, DEFAULT_HOME_STATEMENTS.about),
          vision: mergeStatement(s?.vision, DEFAULT_HOME_STATEMENTS.vision),
          mission: mergeStatement(s?.mission, DEFAULT_HOME_STATEMENTS.mission),
          purpose: mergeStatement(s?.purpose, DEFAULT_HOME_STATEMENTS.purpose),
        });
        const tv = settings.statementTabsVisibility as Record<string, boolean | undefined> | undefined;
        setStatementTabsVisible({
          about: tv?.about !== false,
          vision: tv?.vision !== false,
          mission: tv?.mission !== false,
          purpose: tv?.purpose !== false,
        });
        setHeroBannerText(
          resolveHomeHeroBannerMessage(
            (settings as { homeHeroBannerMessage?: string }).homeHeroBannerMessage
          )
        );
        const hb = (settings as {
          homeHeroButtons?: Record<string, boolean | undefined>;
        }).homeHeroButtons;
        setHeroButtonsVisible({
          facebook: hb?.facebook !== false,
          whatsapp: hb?.whatsapp !== false,
          viewEvents: hb?.viewEvents !== false,
          durgaPuja: hb?.durgaPuja !== false,
          viewCharityEvents: hb?.viewCharityEvents !== false,
        });
      } catch {
        // Use defaults if fetch fails
      }
    };

    fetchSocialLinksAndStatements();
  }, []);

  useEffect(() => {
    if (visibleAboutTabKeys.length === 0) return;
    if (!visibleAboutTabKeys.includes(activeAboutTab)) {
      setActiveAboutTab(visibleAboutTabKeys[0]);
    }
  }, [visibleAboutTabKeys, activeAboutTab]);

  // Add Events structured data (Schema.org) for SEO — home charity section events
  useEffect(() => {
    const charityList = upcomingEvents.filter((e) => getEffectiveEventType(e) === 'Charity');
    if (charityList.length === 0) return;

    // Remove existing events structured data
    const existingScript = document.getElementById('events-structured-data');
    if (existingScript) {
      existingScript.remove();
    }

    // Create structured data for events
    const eventsData = charityList.slice(0, 10).map((event) => {
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
        "url": `https://www.sanhoti.org${getEventDetailPath(event, event.event_id || '')}`,
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

  // Charity card: stay on priority image ~14s; others ~3.5s each (priority dominates total time)
  useEffect(() => {
    const n = charityEventImages.length;
    if (n <= 1) return;

    const schedule = buildCharitySlideSchedule(n, priorityCharityImageIndex);
    if (schedule.length === 0) return;

    let step = 0;
    let timeoutId: ReturnType<typeof setTimeout>;
    const advance = () => {
      step = (step + 1) % schedule.length;
      const { index, dwellMs } = schedule[step];
      setCharityCardSlideIndex(index);
      timeoutId = setTimeout(advance, dwellMs);
    };
    timeoutId = setTimeout(advance, schedule[0].dwellMs);

    return () => clearTimeout(timeoutId);
  }, [charityEventImages, priorityCharityImageIndex]);

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
      <Seo
        title="Sanhoti — Bengali Association of Orange County, CA | Durga Puja & Cultural Events"
        description="Sanhoti is a Bengali association serving Orange County and Southern California, CA — cultural events, Durga Puja, Poila Boishakh, charity programs, and community for Bengali & Indian families in Rancho Santa Margarita, Orange County, and throughout SoCal."
        path="/"
      />
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

        {/* Center hero greeting — tablet/desktop only; mobile sits beside buttons below */}
        {heroBannerText ? (
          <div className="absolute inset-0 z-[25] hidden sm:flex items-center justify-center pointer-events-none px-2 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm md:max-w-md lg:max-w-lg border-[3px] sm:border-4 border-red-600 rounded-2xl bg-amber-400/40 px-4 py-3 sm:px-8 sm:py-5 md:px-12 md:py-7 shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
            >
              <span
                className="block w-full max-w-full text-center font-semibold sm:font-bold text-2xl sm:text-4xl md:text-5xl lg:text-6xl tracking-wide text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.85),0_0_2px_rgba(0,0,0,0.6)] break-words [overflow-wrap:anywhere] whitespace-normal leading-snug sm:leading-tight hyphens-auto"
                style={{ fontFamily: "'Noto Serif Bengali', 'Noto Sans Bengali', serif" }}
                lang="bn"
                dir="auto"
              >
                {heroBannerText}
              </span>
            </motion.div>
          </div>
        ) : null}
        
        {/* Hero Content - Logo, Welcome, Buttons, and Event Cards */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute top-4 left-2 right-2 md:top-8 md:left-12 md:right-12 lg:left-16 lg:right-16 z-20 flex flex-col gap-6 md:grid md:grid-cols-[auto_auto] md:grid-rows-[auto_auto_auto] md:items-start md:justify-between md:gap-x-8 md:gap-y-4"
        >
          {/* md+: dissolves into the grid so header/buttons/card each occupy their own row,
              keeping the right charity column aligned to the buttons/card rows regardless
              of how many sub-event cards extend below the flyer. */}
          <div className="flex flex-col gap-2 max-w-[calc(100vw-1rem)] md:contents">
            {/* Logo and Welcome Text */}
            <div className="flex items-center gap-2 md:gap-4 md:col-start-1 md:row-start-1">
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
                  <span className="block">Welcome to Sanhoti</span>
                  <span className="block text-xs md:text-base lg:text-lg font-normal opacity-90">
                    Bengali Association of Orange County, CA
                  </span>
                </motion.h1>
              </div>
            </div>
            
            {/* Mobile: buttons (left) + hero message (right); sm+: buttons row only; hero is centered overlay */}
            <div className="flex flex-row max-sm:items-stretch gap-2 w-full max-w-full sm:contents">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col md:flex-row gap-1.5 md:gap-2 w-fit flex-shrink-0 md:col-start-1 md:row-start-2"
              >
                {heroButtonsVisible.facebook && (
                  <a
                    href={facebookLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-400 text-white px-2 py-1.5 md:px-4 md:py-2.5 rounded-lg font-semibold text-xs md:text-base hover:bg-blue-500 transition-all transform hover:scale-105 shadow-lg text-center whitespace-nowrap"
                  >
                    Join our Facebook Page
                  </a>
                )}
                {heroButtonsVisible.whatsapp && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-400 text-white px-2 py-1.5 md:px-4 md:py-2.5 rounded-lg font-semibold text-xs md:text-base hover:bg-green-500 transition-all transform hover:scale-105 shadow-lg text-center whitespace-nowrap"
                  >
                    Join us in WhatsApp
                  </a>
                )}
                {heroButtonsVisible.viewEvents && (
                  <Link
                    to="/events"
                    className="bg-transparent border-2 border-white text-white px-2 py-1.5 md:px-4 md:py-2.5 rounded-lg font-semibold text-xs md:text-base hover:bg-white hover:text-primary-600 transition-all transform hover:scale-105 text-center whitespace-nowrap w-[11rem] md:w-auto"
                  >
                    View Events
                  </Link>
                )}
                {heroButtonsVisible.durgaPuja && (
                  <Link
                    to="/durga-puja"
                    className="bg-transparent border-2 border-white text-white px-2 py-1.5 md:px-4 md:py-2.5 rounded-lg font-semibold text-xs md:text-base hover:bg-white hover:text-primary-600 transition-all transform hover:scale-105 text-center whitespace-nowrap w-[11rem] md:w-auto"
                  >
                    Durga Puja
                  </Link>
                )}
              </motion.div>
              {heroBannerText ? (
                <div className="sm:hidden flex flex-1 min-w-0 justify-center items-stretch">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45, duration: 0.6 }}
                    className="flex w-[min(100%,18rem)] max-w-[18rem] min-h-0 flex-col justify-center self-stretch border-[3px] border-red-600 rounded-xl bg-amber-400/40 px-3 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.25)] pointer-events-none"
                  >
                    <span
                      className="block w-full text-center font-semibold text-3xl leading-tight text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.85)] break-words [overflow-wrap:anywhere]"
                      style={{ fontFamily: "'Noto Serif Bengali', 'Noto Sans Bengali', serif" }}
                      lang="bn"
                      dir="auto"
                    >
                      {heroBannerText}
                    </span>
                  </motion.div>
                </div>
              ) : null}
            </div>

            {/* Priority Event Card */}
            {priorityEvent && priorityEventImage && (() => {
              const eventId = getCanonicalEventIdForShare(priorityEvent);
              return (
                <div className="w-fit md:col-start-1 md:row-start-3">
                  <Link to={getEventDetailPath(priorityEvent, eventId)} className="w-fit block">
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
                        const parentEventId = getCanonicalEventIdForShare(priorityEvent);
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
                                  to={getEventDetailPath(priorityEvent, parentEventId)}
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
            className="w-full md:w-fit flex-shrink-0 flex flex-col items-start md:items-end gap-3 md:gap-4 md:col-start-2 md:row-start-2 md:row-span-2 md:self-start"
          >
            {heroButtonsVisible.viewCharityEvents && (
              <Link
                to="/events?type=Charity"
                className="bg-transparent border-2 border-white text-white px-2 py-1.5 md:px-4 md:py-2.5 rounded-lg font-semibold text-xs md:text-base hover:bg-white hover:text-primary-600 transition-all transform hover:scale-105 text-center whitespace-nowrap w-[11rem] md:w-auto"
              >
                View Charity Events
              </Link>
            )}
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
      {visibleAboutTabKeys.length > 0 && (
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

          {/* Tabs — only when more than one statement is shown */}
          {visibleAboutTabKeys.length > 1 && (
          <div className="flex justify-center mb-8 px-2">
            <div className="bg-white rounded-lg p-1 shadow-md inline-flex flex-wrap justify-center gap-1 max-w-full">
              {visibleAboutTabKeys.map((tabKey) => (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setActiveAboutTab(tabKey)}
                  className={`px-4 sm:px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                    activeAboutTab === tabKey
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                >
                  {ABOUT_TAB_BUTTON_LABEL[tabKey]}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeAboutTab === 'about' && statementTabsVisible.about && (
            <motion.div
                key="about"
              initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              className="bg-gray-50 rounded-xl shadow-lg p-8 max-w-6xl mx-auto"
            >
              {renderHomeStatementBlocks(homeStatements.about, 'about')}
            </motion.div>
            )}

            {activeAboutTab === 'vision' && statementTabsVisible.vision && (
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
                  <h3 className="text-3xl font-bold text-gray-900">Vision Statement</h3>
                </div>
                {renderHomeStatementBlocks(homeStatements.vision, 'vision')}
              </motion.div>
            )}

            {activeAboutTab === 'mission' && statementTabsVisible.mission && (
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
                {renderHomeStatementBlocks(homeStatements.mission, 'mission')}
              </motion.div>
            )}

            {activeAboutTab === 'purpose' && statementTabsVisible.purpose && (
              <motion.div
                key="purpose"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-50 rounded-xl shadow-lg p-8 max-w-6xl mx-auto"
              >
                <div className="flex items-center mb-6">
                  <div className="bg-primary-100 rounded-lg p-3 mr-4">
                    <Target className="w-6 h-6 text-primary-600" />
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900">Purpose Statement</h3>
                </div>
                {renderHomeStatementBlocks(homeStatements.purpose, 'purpose')}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
      )}

      {/* Charity Events section (below About Us): priority charity + upcoming charity */}
      {showCharityEventsSection && (
        <section className="py-20 bg-amber-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Charity Events</h2>
              <p className="text-xl text-gray-600">Coming together to give back and strengthen humanity</p>
            </motion.div>

            {/* Priority charity featured card */}
            {priorityCharityEvent && (() => {
              const priorityEvent = priorityCharityEvent;
              const priorityEventImage = priorityCharityEventImage;
              const imageOrientation = priorityCharityImageOrientation;
              const eventId = getCanonicalEventIdForShare(priorityEvent);
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
                              onError={retryImageOnError(eventImage)}
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
                              to={getEventDetailPath(priorityEvent, eventId)}
                              className="inline-flex items-center justify-center bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors text-lg"
                            >
                              View Details <ArrowRight className="w-5 h-5 ml-2" />
                            </Link>
                            
                            <EventShareButtons eventId={eventId} eventName={eventName} showCaption={false} />

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
                              onError={retryImageOnError(eventImage)}
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
                              to={getEventDetailPath(priorityEvent, eventId)}
                              className="inline-flex items-center justify-center bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors text-lg"
                            >
                              View Details <ArrowRight className="w-5 h-5 ml-2" />
                            </Link>
                            
                            <EventShareButtons eventId={eventId} eventName={eventName} showCaption={false} />

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

            {/* Other upcoming charity events */}
            {(() => {
              if (otherUpcomingCharityEvents.length === 0) return null;
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {otherUpcomingCharityEvents.map((event, index) => {
                const eventId = getCanonicalEventIdForShare(event);
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
                      to={getEventDetailPath(event, eventId)}
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
                to="/events?type=Charity"
                className="inline-block bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                View All Charity Events
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

