import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Lock, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { galleriesAPI } from '../services/api';
import { PhotoGallery } from '../types';
import { format } from 'date-fns';
import { convertPSTToLocal } from '../utils/dateUtils';

// Use relative API base in production to avoid mixed-content; absolute in dev
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5001/api');

export default function Galleries() {
  const [galleries, setGalleries] = useState<PhotoGallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  useEffect(() => {
    galleriesAPI
      .getPublic()
      .then((galleries) => {
        // Sort galleries by event start date in descending order (newest first)
        // Galleries with event dates come first, then galleries without (sorted by createdAt)
        const sorted = galleries.sort((a, b) => {
          const dateA = a.event_start_dt ? convertPSTToLocal(a.event_start_dt).getTime() : null;
          const dateB = b.event_start_dt ? convertPSTToLocal(b.event_start_dt).getTime() : null;
          
          // If both have event dates, sort by event date desc
          if (dateA !== null && dateB !== null) {
            return dateB - dateA;
          }
          
          // If only one has event date, prioritize it
          if (dateA !== null && dateB === null) {
            return -1; // a comes first
          }
          if (dateA === null && dateB !== null) {
            return 1; // b comes first
          }
          
          // If neither has event date, sort by createdAt desc
          const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return createdB - createdA;
        });
        setGalleries(sorted);
        
        // Group galleries by year and expand current year by default
        const currentYear = new Date().getFullYear();
        const years = new Set<number>();
        sorted.forEach(gallery => {
          if (gallery.event_start_dt) {
            const year = convertPSTToLocal(gallery.event_start_dt).getFullYear();
            years.add(year);
          }
        });
        
        // Expand current year and most recent year by default
        const yearsArray = Array.from(years).sort((a, b) => b - a);
        const defaultExpanded = new Set<number>();
        if (yearsArray.length > 0) {
          defaultExpanded.add(yearsArray[0]); // Most recent year
          if (years.has(currentYear)) {
            defaultExpanded.add(currentYear);
          }
        }
        setExpandedYears(defaultExpanded);
      })
      .catch((error) => {
        console.error('Error fetching galleries:', error);
        // Set empty array on error so we show "No galleries available" instead of crashing
        setGalleries([]);
      })
      .finally(() => setLoading(false));
  }, []);
  
  const toggleYear = (year: number) => {
    setExpandedYears(prev => {
      const newSet = new Set(prev);
      if (newSet.has(year)) {
        newSet.delete(year);
      } else {
        newSet.add(year);
      }
      return newSet;
    });
  };
  
  // Get latest 3 galleries to show at top
  const latestGalleries = galleries.slice(0, 3);
  const remainingGalleries = galleries.slice(3);
  
  // Group remaining galleries by year (excluding the latest 3)
  const galleriesByYear = remainingGalleries.reduce((acc, gallery) => {
    let year: number;
    if (gallery.event_start_dt) {
      year = convertPSTToLocal(gallery.event_start_dt).getFullYear();
    } else if (gallery.createdAt) {
      year = new Date(gallery.createdAt).getFullYear();
    } else {
      year = new Date().getFullYear(); // Fallback to current year
    }
    
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(gallery);
    return acc;
  }, {} as Record<number, PhotoGallery[]>);
  
  // Sort years in descending order
  const sortedYears = Object.keys(galleriesByYear)
    .map(Number)
    .sort((a, b) => b - a);

  // Helper function to format gallery title: "Event Name - Year"
  const formatGalleryTitle = (gallery: PhotoGallery): string => {
    // Remove " Gallery" from the title if it exists
    let eventName = gallery.title.replace(/\s+Gallery$/i, '').trim();
    
    // Get year from event_start_dt if available, otherwise from createdAt
    let year: number | null = null;
    if (gallery.event_start_dt) {
      year = convertPSTToLocal(gallery.event_start_dt).getFullYear();
    } else if (gallery.createdAt) {
      year = new Date(gallery.createdAt).getFullYear();
    }
    
    // Format as "Event Name - Year" if year is available
    if (year !== null) {
      return `${eventName} - ${year}`;
    }
    
    // Fallback to just the event name if no year is available
    return eventName;
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
            <Image className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              Photo Galleries
            </h1>
          </div>
          <p className="text-2xl text-gray-600">
            Explore memories from our community events
          </p>
        </motion.div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : galleries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No galleries available at this time.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Latest 3 Galleries - Always on Top */}
            {latestGalleries.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Latest Galleries</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {latestGalleries.map((gallery, index) => (
              <motion.div
                key={gallery.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-2"
              >
                <div className="relative h-48 bg-gradient-to-br from-primary-400 to-primary-600">
                  {(() => {
                    const firstPhoto = gallery.photos.length > 0 ? gallery.photos[0] : null;
                    const imageKey = `${gallery.id}-0`;
                    const hasError = imageErrors.has(imageKey);
                    
                    if (firstPhoto && !hasError) {
                      // Use thumbnailUrl if available, otherwise use url
                      let imageUrl = firstPhoto.thumbnailUrl || firstPhoto.url;
                      
                      // If URL is relative and starts with /api, use it directly (proxy handles it)
                      // Otherwise, construct full URL
                      if (!imageUrl.startsWith('http')) {
                        if (imageUrl.startsWith('/api')) {
                          // Use relative URL - Vite proxy will handle it
                          imageUrl = imageUrl;
                        } else {
                          // Construct full URL using API base
                          imageUrl = `${API_BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
                        }
                      }
                      
                      return (
                        <img
                          src={imageUrl}
                          alt={gallery.title}
                          className="w-full h-full object-cover"
                          onError={() => {
                            setImageErrors(prev => new Set(prev).add(imageKey));
                          }}
                          loading="lazy"
                        />
                      );
                    }
                    
                    // Show placeholder if no photo or error loading
                    return (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-16 h-16 text-white opacity-50" />
                      </div>
                    );
                  })()}
                  {!gallery.isPublic && (
                    <div className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-2">
                      <Lock className="w-4 h-4 text-white" />
                    </div>
                  )}
                  {gallery.photos.length > 0 && (
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 rounded px-2 py-1">
                      <span className="text-white text-sm font-medium">
                        {gallery.photos.length} {gallery.photos.length === 1 ? 'item' : 'items'}
                        {gallery.photos.some(p => p.type === 'video') && (
                          <span className="ml-1">
                            ({gallery.photos.filter(p => p.type === 'video').length} {gallery.photos.filter(p => p.type === 'video').length === 1 ? 'video' : 'videos'})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{formatGalleryTitle(gallery)}</h3>
                  {gallery.description && (
                    <p className="text-gray-600 mb-4 line-clamp-2">{gallery.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                            {gallery.event_start_dt 
                              ? format(convertPSTToLocal(gallery.event_start_dt), 'MMM dd, yyyy')
                              : format(convertPSTToLocal(gallery.createdAt), 'MMM dd, yyyy')}
                          </span>
                          <Link
                            to={`/galleries/${gallery.id}`}
                            className="text-primary-600 hover:text-primary-700 font-medium flex items-center"
                          >
                            View <ArrowRight className="w-4 h-4 ml-1" />
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Year-wise Galleries */}
            {sortedYears.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Old Galleries</h2>
              </div>
            )}
            {sortedYears.map((year) => {
              const yearGalleries = galleriesByYear[year];
              const isExpanded = expandedYears.has(year);
              
              return (
                <div key={year} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Year Header */}
                  <button
                    onClick={() => toggleYear(year)}
                    className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-4 flex items-center justify-between hover:from-primary-700 hover:to-primary-800 transition-colors"
                  >
                    <h2 className="text-2xl font-bold">{year}</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {yearGalleries.length} {yearGalleries.length === 1 ? 'gallery' : 'galleries'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-6 h-6" />
                      ) : (
                        <ChevronDown className="w-6 h-6" />
                      )}
                    </div>
                  </button>
                  
                  {/* Year Galleries */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {yearGalleries.map((gallery, index) => (
                              <motion.div
                                key={gallery.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-2"
                              >
                                <div className="relative h-48 bg-gradient-to-br from-primary-400 to-primary-600">
                                  {(() => {
                                    const firstPhoto = gallery.photos.length > 0 ? gallery.photos[0] : null;
                                    const imageKey = `${gallery.id}-0`;
                                    const hasError = imageErrors.has(imageKey);
                                    
                                    if (firstPhoto && !hasError) {
                                      // Use thumbnailUrl if available, otherwise use url
                                      let imageUrl = firstPhoto.thumbnailUrl || firstPhoto.url;
                                      
                                      // If URL is relative and starts with /api, use it directly (proxy handles it)
                                      // Otherwise, construct full URL
                                      if (!imageUrl.startsWith('http')) {
                                        if (imageUrl.startsWith('/api')) {
                                          // Use relative URL - Vite proxy will handle it
                                          imageUrl = imageUrl;
                                        } else {
                                          // Construct full URL using API base
                                          imageUrl = `${API_BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
                                        }
                                      }
                                      
                                      return (
                                        <img
                                          src={imageUrl}
                                          alt={gallery.title}
                                          className="w-full h-full object-cover"
                                          onError={() => {
                                            setImageErrors(prev => new Set(prev).add(imageKey));
                                          }}
                                          loading="lazy"
                                        />
                                      );
                                    }
                                    
                                    // Show placeholder if no photo or error loading
                                    return (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Image className="w-16 h-16 text-white opacity-50" />
                                      </div>
                                    );
                                  })()}
                                  {!gallery.isPublic && (
                                    <div className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-2">
                                      <Lock className="w-4 h-4 text-white" />
                                    </div>
                                  )}
                                  {gallery.photos.length > 0 && (
                                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 rounded px-2 py-1">
                                      <span className="text-white text-sm font-medium">
                                        {gallery.photos.length} {gallery.photos.length === 1 ? 'item' : 'items'}
                                        {gallery.photos.some(p => p.type === 'video') && (
                                          <span className="ml-1">
                                            ({gallery.photos.filter(p => p.type === 'video').length} {gallery.photos.filter(p => p.type === 'video').length === 1 ? 'video' : 'videos'})
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="p-6">
                                  <h3 className="text-xl font-bold text-gray-900 mb-2">{formatGalleryTitle(gallery)}</h3>
                                  {gallery.description && (
                                    <p className="text-gray-600 mb-4 line-clamp-2">{gallery.description}</p>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">
                                      {gallery.event_start_dt 
                                        ? format(convertPSTToLocal(gallery.event_start_dt), 'MMM dd, yyyy')
                                        : format(convertPSTToLocal(gallery.createdAt), 'MMM dd, yyyy')}
                    </span>
                    <Link
                      to={`/galleries/${gallery.id}`}
                      className="text-primary-600 hover:text-primary-700 font-medium flex items-center"
                    >
                      View <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

