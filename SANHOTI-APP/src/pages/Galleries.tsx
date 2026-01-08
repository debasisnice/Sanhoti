import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Image, Lock, ArrowRight } from 'lucide-react';
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

  useEffect(() => {
    galleriesAPI
      .getPublic()
      .then((galleries) => {
        // Sort galleries by event start date in descending order (newest first)
        const sorted = galleries.sort((a, b) => {
          const dateA = a.event_start_dt ? convertPSTToLocal(a.event_start_dt).getTime() : 0;
          const dateB = b.event_start_dt ? convertPSTToLocal(b.event_start_dt).getTime() : 0;
          return dateB - dateA; // Descending order
        });
        setGalleries(sorted);
      })
      .catch((error) => {
        console.error('Error fetching galleries:', error);
        // Set empty array on error so we show "No galleries available" instead of crashing
        setGalleries([]);
      })
      .finally(() => setLoading(false));
  }, []);

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleries.map((gallery, index) => (
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
                        {gallery.photos.length} {gallery.photos.length === 1 ? 'photo' : 'photos'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{gallery.title}</h3>
                  {gallery.description && (
                    <p className="text-gray-600 mb-4 line-clamp-2">{gallery.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {format(convertPSTToLocal(gallery.createdAt), 'MMM dd, yyyy')}
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
        )}
      </div>
    </div>
  );
}

