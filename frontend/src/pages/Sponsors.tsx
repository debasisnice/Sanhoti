import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, X, FileText } from 'lucide-react';
import { sponsorsAPI, durgaPujaPageAPI } from '../services/api';
import Seo from '../components/Seo';
import PageHero from '../components/PageHero';
import PageContent from '../components/PageContent';

interface SponsorImage {
  filename: string;
  url: string;
  sponsorshipType?: string;
}

/**
 * Sponsor tiers, highest first. `key` matches the filename prefix the upload
 * writes (see SponsorController) — 'None' covers files uploaded before tiers
 * existed, or with no tier chosen.
 */
const TIERS = [
  { key: 'Grand',    label: 'Grand Sponsors',    accent: 'text-amber-700',  ring: 'ring-amber-300',  chip: 'bg-amber-100 text-amber-800' },
  { key: 'Platinum', label: 'Platinum Sponsors', accent: 'text-slate-600',  ring: 'ring-slate-300',  chip: 'bg-slate-100 text-slate-700' },
  { key: 'Gold',     label: 'Gold Sponsors',     accent: 'text-yellow-700', ring: 'ring-yellow-300', chip: 'bg-yellow-100 text-yellow-800' },
  { key: 'Silver',   label: 'Silver Sponsors',   accent: 'text-gray-600',   ring: 'ring-gray-300',   chip: 'bg-gray-100 text-gray-700' },
  { key: 'None',     label: 'Our Supporters',    accent: 'text-primary-700', ring: 'ring-primary-200', chip: 'bg-primary-50 text-primary-700' },
] as const;

export default function Sponsors() {
  const [sponsorImages, setSponsorImages] = useState<SponsorImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<SponsorImage | null>(null);
  const [prospectusYear, setProspectusYear] = useState<number | null>(null);
  const [prospectusVersion, setProspectusVersion] = useState<number>(0);

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

  // Highest tier first. Anything uploaded without a tier prefix still has to
  // appear — dropping it would silently hide a sponsor who paid.
  const groups = TIERS.map(tier => ({
    tier,
    images: sponsorImages.filter(img => (img.sponsorshipType || 'None') === tier.key),
  })).filter(g => g.images.length > 0);

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
      <PageContent>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : sponsorImages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No sponsor images available at this time.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {groups.map(({ tier, images }) => (
              <section key={tier.key} aria-labelledby={`tier-${tier.key}`}>
                <div className="flex items-center gap-3 mb-5">
                  <h2 id={`tier-${tier.key}`} className={`text-2xl font-bold ${tier.accent}`}>
                    {tier.label}
                  </h2>
                  <span className="flex-1 h-px bg-gray-200" />
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tier.chip}`}>
                    {images.length}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                  {images.map((image, i) => (
                    <motion.button
                      key={image.filename}
                      type="button"
                      onClick={() => setSelectedImage(image)}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: Math.min(i * 0.04, 0.3) }}
                      className={`group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg
                        ring-1 ring-transparent hover:${tier.ring} transition-all
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
                      aria-label={`View ${tier.label.replace(/s$/, '')} logo`}
                    >
                      {/* Fixed square keeps every card the same size whatever the
                          logo's aspect ratio; object-contain means no logo is cropped. */}
                      <div className="aspect-square p-5 flex items-center justify-center">
                        <img
                          src={image.url}
                          alt={`${tier.label.replace(/s$/, '')} of Sanhoti Bengali Association, Orange County`}
                          className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            (e.currentTarget.closest('button') as HTMLElement | null)?.style.setProperty('display', 'none');
                          }}
                        />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </section>
            ))}
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
      </PageContent>

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
