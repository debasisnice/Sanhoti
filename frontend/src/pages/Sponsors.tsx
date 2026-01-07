import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, X } from 'lucide-react';
import { sponsorsAPI } from '../services/api';

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Auto-rotate carousel every 3 seconds
  useEffect(() => {
    if (sponsorImages.length <= 2) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sponsorImages.length);
    }, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sponsorImages.length]);

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
    <div className="py-12 pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Award className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              Our Sponsors
            </h1>
          </div>
          <p className="text-2xl text-gray-600">
            Thank you to our generous sponsors for their support
          </p>
        </motion.div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : sponsorImages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No sponsor images available at this time.</p>
          </div>
        ) : (
          <div className="relative h-[500px] flex items-center justify-center overflow-hidden py-12">
            <div
              className="relative w-full h-full flex items-center justify-center"
              style={{
                perspective: '1200px',
                perspectiveOrigin: 'center center',
              }}
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
                        <img
                          src={card.image.url}
                          alt={card.image.filename}
                          className="w-full flex-1 object-contain p-6"
                          onError={(e) => {
                            console.error('Failed to load sponsor image:', card.image.url);
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        {card.image.sponsorshipType && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                            <p className="text-white text-sm font-semibold text-center">
                              {card.image.sponsorshipType} Sponsor
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
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
