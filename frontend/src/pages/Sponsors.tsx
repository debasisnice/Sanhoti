import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, ChevronLeft, ChevronRight, X, FileText } from 'lucide-react';
import { sponsorsAPI, durgaPujaPageAPI } from '../services/api';
import Seo from '../components/Seo';
import PageHero from '../components/PageHero';

interface SponsorImage {
  filename: string;
  url: string;
  sponsorshipType?: string;
}

export default function Sponsors() {
  const [sponsorImages, setSponsorImages] = useState<SponsorImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedImage, setSelectedImage] = useState<SponsorImage | null>(null);
  const [prospectusYear, setProspectusYear] = useState<number | null>(null);
  const [prospectusVersion, setProspectusVersion] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const sponsorCount = sponsorImages.length;

  const restartAutoRotate = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (sponsorCount <= 2) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sponsorCount);
    }, 3000);
  }, [sponsorCount]);

  useEffect(() => {
    const fetchSponsors = async () => {
      try {
        const images = await sponsorsAPI.getImages();
        setSponsorImages(images);
      } catch (error) {
        console.error('Failed to load sponsor images:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSponsors();
  }, []);

  // Load the active Durga Puja year's sponsorship prospectus (if one is uploaded).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { activeYear } = await durgaPujaPageAPI.listYears();
        const year = activeYear || new Date().getFullYear();
        const { hasPdf, updatedAt } = await durgaPujaPageAPI.hasSponsorshipPdf(year);
        if (!cancelled) {
          setProspectusYear(hasPdf ? year : null);
          setProspectusVersion(updatedAt || 0);
        }
      } catch {
        if (!cancelled) setProspectusYear(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-rotate carousel every 3 seconds (more than 2 images only)
  useEffect(() => {
    restartAutoRotate();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [restartAutoRotate]);

  const goNext = useCallback(() => {
    if (sponsorCount < 1) return;
    setCurrentIndex((prev) => (prev + 1) % sponsorCount);
    restartAutoRotate();
  }, [sponsorCount, restartAutoRotate]);

  const goPrev = useCallback(() => {
    if (sponsorCount < 1) return;
    setCurrentIndex((prev) => (prev - 1 + sponsorCount) % sponsorCount);
    restartAutoRotate();
  }, [sponsorCount, restartAutoRotate]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || touchStartY.current == null || sponsorCount <= 1) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - touchStartX.current;
    const dy = endY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    // Prefer vertical scrolling when gesture is mostly vertical
    if (Math.abs(dy) > Math.abs(dx)) return;
    const threshold = 48;
    if (dx > threshold) goPrev();
    else if (dx < -threshold) goNext();
  };

  // Get visible cards - show one card in front, with side cards for smooth scrolling effect
  const getVisibleCards = () => {
    if (sponsorImages.length === 0) return [];
    
    const visible: Array<{ image: SponsorImage; index: number; position: number }> = [];
    
    // Show 5 cards: 2 on left, 1 middle (front), 2 on right
    for (let i = -2; i <= 2; i++) {
      const imageIndex = (currentIndex + i + sponsorImages.length) % sponsorImages.length;
      visible.push({
        image: sponsorImages[imageIndex],
        index: imageIndex,
        position: i,
      });
    }
    
    return visible;
  };

  const visibleCards = getVisibleCards();

  return (
    <div className="pb-32">
      <Seo
        title="Sponsors & Partners | Sanhoti Bengali Association of Orange County, CA"
        description="Sanhoti thanks the sponsors and partners who support Bengali cultural events — Durga Puja, concerts, and community programs — in Orange County and Southern California."
        path="/sponsors"
      />
<PageHero
      icon={Award}
      title="Sanhoti Sponsors & Partners — Orange County, California"
      subtitle="Our sponsors make Durga Puja, Bengali concerts, and Sanhoti cultural programming in Orange County possible. We are grateful to every business and partner investing in Bengali community life across Southern California."
        />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : sponsorImages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No sponsor images available at this time.</p>
          </div>
        ) : (
          <div className="relative h-[600px] flex items-center justify-center overflow-hidden py-12">
            {sponsorCount > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-1 sm:left-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/95 p-2.5 sm:p-3 shadow-lg ring-1 ring-gray-200 hover:bg-primary-50 hover:ring-primary-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  aria-label="Previous sponsor"
                >
                  <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8 text-gray-800" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-1 sm:right-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/95 p-2.5 sm:p-3 shadow-lg ring-1 ring-gray-200 hover:bg-primary-50 hover:ring-primary-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  aria-label="Next sponsor"
                >
                  <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8 text-gray-800" />
                </button>
              </>
            )}
            <div
              className="relative w-full h-full flex items-center justify-center touch-pan-y select-none"
              style={{
                perspective: '1200px',
                perspectiveOrigin: 'center center',
              }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              role="region"
              aria-roledescription="carousel"
              aria-label="Sponsor logos"
            >
              {visibleCards.map((card) => {
                const isMiddle = card.position === 0;
                const isLeft = card.position < 0;
                const isRight = card.position > 0;

                // Calculate styles - cards flow from right to left
                // Only position 0 is the front card
                const scale = card.position === 0 ? 1.4 : 0.75;
                
                // Continuous horizontal positioning - cards move from right (+x) to left (-x)
                // Base spacing of 280px for side cards
                let xOffset;
                if (card.position === 0) {
                  xOffset = 0; // Front card centered
                } else {
                  // Side cards: maintain continuous spacing
                  const baseSpacing = 280;
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
                    key={`sponsor-${card.image.filename}`}
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
                    className="will-change-transform cursor-pointer"
                    onClick={() => setSelectedImage(card.image)}
                  >
                    <div className="flex flex-col items-center">
                      <div
                        className={`bg-white rounded-xl overflow-hidden transition-all duration-300 ${
                          isMiddle
                            ? 'shadow-2xl ring-4 ring-primary-200 ring-opacity-50'
                            : 'shadow-lg'
                        }`}
                        style={{
                          width: card.position === 0 ? '280px' : '200px',
                          height: card.position === 0 ? '320px' : '240px',
                        }}
                      >
                        <div className="w-full h-full bg-gray-50 relative overflow-hidden flex flex-col">
                          <div className="flex-1 overflow-hidden">
                            <img
                              src={card.image.url}
                              alt={card.image.filename}
                              className="w-full h-full object-contain p-6"
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                console.error('Failed to load sponsor image:', card.image.url);
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                          {card.image.sponsorshipType && card.image.sponsorshipType !== 'None' && (
                            <div className="md:hidden bg-white border-t border-gray-200 px-3 py-2">
                              <p 
                                className={`text-xs font-semibold text-center ${
                                  card.image.sponsorshipType === 'Grand' ? 'text-yellow-600' :
                                  card.image.sponsorshipType === 'Platinum' ? 'text-gray-400' :
                                  card.image.sponsorshipType === 'Gold' ? 'text-yellow-500' :
                                  'text-gray-500'
                                }`}
                              >
                                {card.image.sponsorshipType} Sponsor
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      {card.image.sponsorshipType && card.image.sponsorshipType !== 'None' && (
                        <p 
                          className={`hidden md:block mt-3 text-sm font-semibold text-center ${
                            card.image.sponsorshipType === 'Grand' ? 'text-yellow-600' :
                            card.image.sponsorshipType === 'Platinum' ? 'text-gray-400' :
                            card.image.sponsorshipType === 'Gold' ? 'text-yellow-500' :
                            'text-gray-500'
                          }`}
                        >
                          {card.image.sponsorshipType} Sponsor
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sponsorship prospectus tile */}
        {prospectusYear && (
          <div className="mt-6 flex justify-center">
            <a
              href={`${durgaPujaPageAPI.sponsorshipPdfUrl(prospectusYear)}?v=${prospectusVersion}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-3 bg-white border border-yellow-200 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4"
            >
              <div className="w-11 h-14 rounded-md bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-red-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 group-hover:text-primary-700">
                  Sponsorship Prospectus {prospectusYear}
                </p>
                <p className="text-sm text-gray-500">Durga Puja {prospectusYear} — opens the PDF in a new tab</p>
              </div>
            </a>
          </div>
        )}
      </div>

      {/* Image Popup Modal */}
      <AnimatePresence>
        {selectedImage && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-4xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors z-10"
                aria-label="Close"
              >
                <X className="w-6 h-6 text-gray-800" />
              </button>
              <div className="bg-white rounded-xl overflow-hidden shadow-2xl">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.filename}
                  className="w-full h-full object-contain max-h-[85vh]"
                  onError={(e) => {
                    console.error('Failed to load sponsor image:', selectedImage.url);
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
