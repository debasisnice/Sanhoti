import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Image as ImageIcon, ChevronLeft, ChevronRight, X, Video } from 'lucide-react';
import { galleriesAPI } from '../services/api';
import { PhotoGallery } from '../types';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import Seo from '../components/Seo';
import { getSiteOrigin } from '../utils/eventShareUrl';
import { seoPlainText } from '../seo/seoUtils';

export default function GalleryDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuthStore();
  const [gallery, setGallery] = useState<PhotoGallery | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    if (id) {
      const fetchGallery = async () => {
        try {
          // If authenticated, try to get by ID directly first
          if (isAuthenticated) {
            try {
              const gallery = await galleriesAPI.getById(id);
              setGallery(gallery);
              setLoading(false);
              return;
            } catch (err: any) {
              // If getById fails (404 or 401), fall through to try public galleries
              if (err.response?.status !== 404 && err.response?.status !== 401) {
                throw err;
              }
            }
          }
          
          // If not authenticated or getById failed, try fetching public gallery by ID
          try {
            const publicGallery = await galleriesAPI.getPublicById(id);
            setGallery(publicGallery);
          } catch (err: any) {
            // If getPublicById fails, try fetching from public galleries list as fallback
            try {
              const galleries = await galleriesAPI.getPublic();
              const found = galleries.find((g) => g.id === id);
              if (found) {
                setGallery(found);
              } else {
                toast.error('Gallery not found or not accessible');
              }
            } catch (listErr: any) {
              if (err.response?.status === 401 || err.response?.status === 403 || listErr.response?.status === 401 || listErr.response?.status === 403) {
                toast.error('Please log in to view this gallery');
              } else {
                toast.error('Gallery not found or not accessible');
              }
            }
          }
        } catch (err: any) {
          console.error(err);
          if (err.response?.status === 404) {
            toast.error('Gallery not found');
          } else if (err.response?.status === 401) {
            toast.error('Please log in to view this gallery');
          } else {
            toast.error('Failed to load gallery');
          }
        } finally {
          setLoading(false);
        }
      };

      fetchGallery();
    }
  }, [id, isAuthenticated]);

  // Keyboard navigation for photo viewer
  useEffect(() => {
    if (selectedPhotoIndex === null || !gallery) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPhotoIndex === null) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedPhotoIndex((prev) => 
          prev !== null && prev > 0 ? prev - 1 : gallery.photos.length - 1
        );
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedPhotoIndex((prev) => 
          prev !== null && prev < gallery.photos.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'Escape') {
        setSelectedPhotoIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhotoIndex, gallery]);

  const handlePreviousPhoto = () => {
    if (selectedPhotoIndex === null || !gallery) return;
    setSelectedPhotoIndex(selectedPhotoIndex > 0 ? selectedPhotoIndex - 1 : gallery.photos.length - 1);
  };

  const handleNextPhoto = () => {
    if (selectedPhotoIndex === null || !gallery) return;
    setSelectedPhotoIndex(selectedPhotoIndex < gallery.photos.length - 1 ? selectedPhotoIndex + 1 : 0);
  };

  const handleClosePhotoViewer = () => {
    setSelectedPhotoIndex(null);
  };

  if (loading) {
    return (
      <>
        <Seo
          title="Gallery | Sanhoti"
          description="Loading photo gallery — Sanhoti Bengali Association of Orange County."
          path={id ? `/galleries/${id}` : '/galleries'}
        />
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </>
    );
  }

  if (!gallery) {
    return (
      <>
        <Seo
          title="Gallery not found | Sanhoti"
          description="This gallery could not be found."
          path="/galleries"
          noindex
        />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Gallery not found</h2>
          </div>
        </div>
      </>
    );
  }

  const firstPhotoUrl =
    gallery.photos?.[0]?.url &&
    (/^https?:\/\//i.test(gallery.photos[0].url)
      ? gallery.photos[0].url
      : `${getSiteOrigin()}${gallery.photos[0].url.startsWith('/') ? gallery.photos[0].url : `/${gallery.photos[0].url}`}`);

  return (
    <div className="py-12 pb-32">
      <Seo
        title={`${gallery.title} | Sanhoti`}
        description={
          seoPlainText(gallery.description || '') ||
          `Photo gallery: ${gallery.title} — Sanhoti Bengali Association of Orange County, CA.`
        }
        path={`/galleries/${gallery.id}`}
        ogImage={firstPhotoUrl || undefined}
        ogType="article"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <div className="flex items-center gap-3 mb-2">
            <ImageIcon className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">{gallery.title}</h1>
          </div>
          {gallery.description && (
            <p className="text-2xl text-gray-600">{gallery.description}</p>
          )}
        </motion.div>

        {gallery.photos.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No photos or videos in this gallery yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gallery.photos.map((photo, index) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer relative"
                onClick={() => setSelectedPhotoIndex(index)}
              >
                <div className="aspect-square bg-gray-200 relative overflow-hidden">
                  {photo.type === 'video' ? (
                    <>
                      <div className="w-full h-full bg-black flex items-center justify-center">
                        <Video className="w-16 h-16 text-white opacity-50" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black bg-opacity-60 rounded-full p-4">
                          <Video className="w-8 h-8 text-white" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img
                      src={photo.thumbnailUrl || photo.url}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                    />
                  )}
                  {photo.type === 'video' && (
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 rounded px-2 py-1">
                      <span className="text-white text-xs font-medium flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        Video
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Photo Modal */}
        {selectedPhotoIndex !== null && gallery && gallery.photos[selectedPhotoIndex] && (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
            onClick={handleClosePhotoViewer}
          >
            {/* Close Button */}
            <button
              onClick={handleClosePhotoViewer}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors bg-black bg-opacity-50 rounded-full p-2 z-50"
              title="Close (Esc)"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Previous Button */}
            {gallery.photos.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreviousPhoto();
                }}
                className="absolute left-4 text-white hover:text-gray-300 transition-colors bg-black bg-opacity-50 rounded-full p-3 z-50"
                title="Previous (←)"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}

            {/* Photo/Video Display */}
            <div className="flex flex-col items-center justify-center w-full h-full max-w-7xl">
              {gallery.photos[selectedPhotoIndex].type === 'video' ? (
                <video
                  key={gallery.photos[selectedPhotoIndex].id}
                  src={gallery.photos[selectedPhotoIndex].url}
                  controls
                  className="max-w-full max-h-[85vh] rounded-lg"
                  style={{ maxWidth: '100%', maxHeight: '85vh' }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <img
                  src={gallery.photos[selectedPhotoIndex].url || gallery.photos[selectedPhotoIndex].thumbnailUrl}
                  alt={`Photo ${selectedPhotoIndex + 1}`}
                  className="max-w-full max-h-[85vh] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              {gallery.photos.length > 1 && (
                <p className="mt-4 text-white text-sm text-center opacity-75">
                  {selectedPhotoIndex + 1} / {gallery.photos.length} {gallery.photos[selectedPhotoIndex].type === 'video' ? '(Video)' : '(Photo)'}
                </p>
              )}
            </div>

            {/* Next Button */}
            {gallery.photos.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextPhoto();
                }}
                className="absolute right-4 text-white hover:text-gray-300 transition-colors bg-black bg-opacity-50 rounded-full p-3 z-50"
                title="Next (→)"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

