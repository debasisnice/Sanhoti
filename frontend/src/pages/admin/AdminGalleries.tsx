import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Folder, Calendar, Eye, EyeOff, Upload, Trash2, X, Image as ImageIcon, ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { eventsAPI, galleriesAPI } from '../../services/api';
import toast from 'react-hot-toast';

interface GalleryFolder {
  folderName: string;
  folderPath: string;
  event_id?: string;
  event_name?: string;
  year?: number;
  gallery_is_public?: boolean;
  is_active?: boolean;
  event_start_dt?: string;
}

interface Photo {
  id: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  uploadedAt: string;
  filename?: string;
}

// Component to handle thumbnail image loading with blob URLs
function ThumbnailImage({ 
  photo, 
  folder: _folder,
  photoBlobUrls, 
  setPhotoBlobUrls 
}: { 
  photo: Photo;
  folder: GalleryFolder;
  photoBlobUrls: Record<string, string>; 
  setPhotoBlobUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      setLoading(true);
      
      // Check if blob URL exists - use it if available
      if (photoBlobUrls[photo.id]) {
        setImageSrc(photoBlobUrls[photo.id]);
        setLoading(false);
        return;
      }

      // Fetch new image as blob with auth token
      const imageUrl = photo.thumbnailUrl || photo.url;
      // Construct full URL: if already absolute, use as-is; if relative and starts with /api, use as-is in production
      let fullUrl: string;
      if (imageUrl.startsWith('http')) {
        fullUrl = imageUrl;
      } else if (imageUrl.startsWith('/api')) {
        // Relative path starting with /api - use as-is (Nginx will proxy it)
        fullUrl = imageUrl;
      } else {
        // Relative path not starting with /api - prepend API base URL
        const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5001/api');
        fullUrl = `${API_BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
      }
      
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(fullUrl, {
          headers: token ? {
            'Authorization': `Bearer ${token}`
          } : {}
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          
          if (isMounted) {
            setImageSrc(blobUrl);
            // Only update if not already set (avoid race conditions)
            setPhotoBlobUrls(prev => {
              if (prev[photo.id]) {
                // Already exists, revoke the duplicate we just created
                URL.revokeObjectURL(blobUrl);
                return prev;
              }
              return { ...prev, [photo.id]: blobUrl };
            });
          } else {
            // Component unmounted, revoke the blob URL
            URL.revokeObjectURL(blobUrl);
          }
        } else {
          console.error(`Failed to fetch image: ${response.status} ${response.statusText}`, fullUrl);
          if (isMounted) {
            setImageSrc(null);
          }
        }
      } catch (error) {
        console.error('Failed to load image:', error, 'URL:', fullUrl);
        if (isMounted) {
          setImageSrc(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [photo.id, photo.url, photo.thumbnailUrl, photoBlobUrls]);

  if (loading) {
    return (
      <div className="relative rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center" style={{ width: '180px', height: '144px', flexShrink: 0 }}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  if (!imageSrc) {
    return (
      <div className="relative rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-400" style={{ width: '180px', height: '144px', flexShrink: 0 }}>
        Error
      </div>
    );
  }

  return (
    <div
      className="relative rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100"
      style={{ width: '180px', height: '144px', flexShrink: 0 }}
    >
      {photo.type === 'video' ? (
        <div className="w-full h-full flex items-center justify-center bg-black">
          <Video className="w-12 h-12 text-white opacity-75" />
        </div>
      ) : (
        <img
          src={imageSrc}
          alt={photo.caption || `Photo`}
          className="w-full h-full object-cover"
          onError={() => {
            // If image fails to load, remove from blob URLs and retry
            console.error('Image load error, removing blob URL:', photo.id);
            setPhotoBlobUrls(prev => {
              const updated = { ...prev };
              if (updated[photo.id]) {
                try {
                  URL.revokeObjectURL(updated[photo.id]);
                } catch (e) {
                  // Ignore errors
                }
                delete updated[photo.id];
              }
              return updated;
            });
            setImageSrc(null);
          }}
        />
      )}
      {photo.type === 'video' && (
        <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 rounded px-1.5 py-0.5">
          <Video className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  );
}

// Component to handle photo loading with blob URLs for viewer
function PhotoViewerImage({ 
  photo, 
  photoBlobUrls, 
  setPhotoBlobUrls 
}: { 
  photo: Photo; 
  photoBlobUrls: Record<string, string>; 
  setPhotoBlobUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      setLoading(true);
      
      // Check if blob URL exists - use it if available
      if (photoBlobUrls[photo.id]) {
        setImageSrc(photoBlobUrls[photo.id]);
        setLoading(false);
        return;
      }

      // Fetch new image as blob with auth token
      const imageUrl = photo.thumbnailUrl || photo.url;
      // Construct full URL: if already absolute, use as-is; if relative and starts with /api, use as-is in production
      let fullUrl: string;
      if (imageUrl.startsWith('http')) {
        fullUrl = imageUrl;
      } else if (imageUrl.startsWith('/api')) {
        // Relative path starting with /api - use as-is (Nginx will proxy it)
        fullUrl = imageUrl;
      } else {
        // Relative path not starting with /api - prepend API base URL
        const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5001/api');
        fullUrl = `${API_BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
      }
      
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(fullUrl, {
          headers: token ? {
            'Authorization': `Bearer ${token}`
          } : {}
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          
          if (isMounted) {
            setImageSrc(blobUrl);
            // Only update if not already set (avoid race conditions)
            setPhotoBlobUrls(prev => {
              if (prev[photo.id]) {
                // Already exists, revoke the duplicate we just created
                URL.revokeObjectURL(blobUrl);
                return prev;
              }
              return { ...prev, [photo.id]: blobUrl };
            });
          } else {
            // Component unmounted, revoke the blob URL
            URL.revokeObjectURL(blobUrl);
          }
        } else {
          if (isMounted) {
            setImageSrc(null);
          }
        }
      } catch (error) {
        console.error('Failed to load image:', error);
        if (isMounted) {
          setImageSrc(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [photo.id, photo.url, photo.thumbnailUrl, photoBlobUrls]);

  if (loading || !imageSrc) {
    return (
      <div className="flex items-center justify-center w-full h-[85vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <motion.img
      key={photo.id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      src={imageSrc}
      alt={photo.caption || `Photo`}
      className="max-w-full max-h-[85vh] object-contain rounded-lg"
      onError={() => {
        // If image fails to load, remove from blob URLs and retry
        console.error('Image load error in viewer, removing blob URL:', photo.id);
        setPhotoBlobUrls(prev => {
          const updated = { ...prev };
          if (updated[photo.id]) {
            try {
              URL.revokeObjectURL(updated[photo.id]);
            } catch (e) {
              // Ignore errors
            }
            delete updated[photo.id];
          }
          return updated;
        });
        setImageSrc(null);
      }}
    />
  );
}

export default function AdminGalleries() {
  const [searchParams, setSearchParams] = useSearchParams();
  const targetEventIdRef = useRef<string | null>(null);
  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [hasUserSelectedYear, setHasUserSelectedYear] = useState(false);
  const [photos, setPhotos] = useState<Record<string, Photo[]>>({});
  const [loadingPhotos, setLoadingPhotos] = useState<Record<string, boolean>>({});
  const [photoBlobUrls, setPhotoBlobUrls] = useState<Record<string, string>>({});
  const [selectedFolder, setSelectedFolder] = useState<GalleryFolder | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [viewingPhotos, setViewingPhotos] = useState<Photo[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [viewingEventId, setViewingEventId] = useState<string | null>(null);

  useEffect(() => {
    // Check for eventId in URL query params first, before fetching folders
    const eventId = searchParams.get('eventId');
    if (eventId) {
      targetEventIdRef.current = eventId;
      // Remove query param from URL after storing
      setSearchParams({}, { replace: true });
    }
    
    fetchFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Scroll to target gallery card after folders are loaded
  useEffect(() => {
    if (!targetEventIdRef.current || folders.length === 0 || loading) {
      return;
    }

    const eventIdToFind = targetEventIdRef.current;
    
    // Find the target folder
    const targetFolder = folders.find(f => f.event_id === eventIdToFind);
    
    if (!targetFolder) {
      console.error('Target folder not found for eventId:', eventIdToFind);
      targetEventIdRef.current = null;
      return;
    }


    // Get filtered folders (what's actually rendered)
    const filteredFoldersForScroll = selectedYear
      ? folders.filter(f => f.year === selectedYear)
      : folders;

    // If year filter needs to be set, do that first and wait
    if (targetFolder.year && selectedYear !== targetFolder.year) {
      setSelectedYear(targetFolder.year);
      // Don't clear the ref yet - let the next effect run handle the scroll
      return;
    }

    // Verify the folder is in the filtered list (what's actually rendered)
    const isInFilteredList = filteredFoldersForScroll.some(f => f.event_id === eventIdToFind);
    if (!isInFilteredList) {
      console.error('Target folder not in filtered list. Selected year:', selectedYear);
      // Try to set the year again if it's wrong
      if (targetFolder.year && selectedYear !== targetFolder.year) {
        setSelectedYear(targetFolder.year);
        return;
      }
    }

    // Year is correct and folder is in filtered list, scroll to the element
    // Use a longer delay to ensure React has finished rendering
    setTimeout(() => {
      const elementId = `gallery-${eventIdToFind}`;
      
      // Wait for next frame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        const targetElement = document.getElementById(elementId);
        
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the card temporarily
          targetElement.classList.add('ring-4', 'ring-blue-500', 'ring-opacity-75');
          setTimeout(() => {
            targetElement.classList.remove('ring-4', 'ring-blue-500', 'ring-opacity-75');
          }, 3000);
          targetEventIdRef.current = null; // Clear after scrolling
        } else {
          console.error('Target element not found in DOM:', elementId);
          const allGalleryIds = Array.from(document.querySelectorAll('[id^="gallery-"]')).map(el => el.id);
          
          // Retry after a longer delay in case DOM hasn't rendered yet
          setTimeout(() => {
            const retryElement = document.getElementById(elementId);
            if (retryElement) {
              retryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              retryElement.classList.add('ring-4', 'ring-blue-500', 'ring-opacity-75');
              setTimeout(() => {
                retryElement.classList.remove('ring-4', 'ring-blue-500', 'ring-opacity-75');
              }, 3000);
              targetEventIdRef.current = null;
            } else {
              console.error('Element still not found on retry. Expected:', elementId, 'Found:', allGalleryIds);
              targetEventIdRef.current = null;
            }
          }, 1500);
        }
      });
    }, 800); // Increased delay to ensure DOM is rendered
  }, [folders, selectedYear, loading]);
  
  // Cleanup blob URLs on unmount only (not on every state change)
  useEffect(() => {
    return () => {
      Object.values(photoBlobUrls).forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          // Ignore errors if URL was already revoked
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run cleanup on unmount

  // Keyboard navigation for photo viewer
  useEffect(() => {
    if (!showPhotoViewer) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : viewingPhotos.length - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentPhotoIndex((prev) => (prev < viewingPhotos.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'Escape') {
        setShowPhotoViewer(false);
        setViewingPhotos([]);
        setCurrentPhotoIndex(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPhotoViewer, viewingPhotos.length]);

  useEffect(() => {
    // Set selected year to current year or most recent year with folders
    // Only auto-select on initial load, not when user explicitly selects "All Years"
    if (folders.length > 0 && selectedYear === null && !hasUserSelectedYear) {
      const years = [...new Set(folders.filter(f => f.year).map(f => f.year!))].sort((a, b) => b - a);
      const currentYear = new Date().getFullYear();
      setSelectedYear(years.includes(currentYear) ? currentYear : years[0]);
      setHasUserSelectedYear(true); // Mark that we've done initial selection
    }
  }, [folders, selectedYear, hasUserSelectedYear]);

  // Auto-load photos for folders when they're displayed
  useEffect(() => {
    const loadPhotosForFolders = async () => {
      const filtered = selectedYear
        ? folders.filter(f => f.year === selectedYear)
        : folders;
      
      for (const folder of filtered) {
        if (folder.event_id && !photos[folder.event_id] && !loadingPhotos[folder.event_id]) {
          await fetchPhotos(folder.event_id);
        }
      }
    };

    if (folders.length > 0) {
      loadPhotosForFolders();
    }
  }, [folders, selectedYear]);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      const allFolders = await eventsAPI.getGalleryFolders();
      setFolders(allFolders);
      if (allFolders.length === 0) {
        toast.error('No gallery folders found. Create an event to generate gallery folders.');
      }
    } catch (error: any) {
      console.error('Error fetching gallery folders:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to fetch gallery folders';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };


  const fetchPhotos = async (eventId: string) => {
    if (!eventId) return;
    
    try {
      setLoadingPhotos(prev => ({ ...prev, [eventId]: true }));
      const folderPhotos = await galleriesAPI.getGalleryPhotos(eventId);
      // Always set photos, even if empty array (no error, just no photos)
      setPhotos(prev => ({ ...prev, [eventId]: Array.isArray(folderPhotos) ? folderPhotos : [] }));
    } catch (error: any) {
      // Don't show error toast - treat empty folder as normal case
      // Only log for debugging
      // Set empty array on error (treat as no photos)
      setPhotos(prev => ({ ...prev, [eventId]: [] }));
    } finally {
      setLoadingPhotos(prev => ({ ...prev, [eventId]: false }));
    }
  };

  const handleToggleExpand = async (folder: GalleryFolder) => {
    // Always fetch fresh photos to ensure we have all photos (including stacked ones)
    if (folder.event_id) {
      try {
        setLoadingPhotos(prev => ({ ...prev, [folder.event_id!]: true }));
        // Always fetch fresh photos from API to ensure we get all photos
        const folderPhotos = await galleriesAPI.getGalleryPhotos(folder.event_id);
        
        // Update photos state with ALL photos
        const allPhotos = Array.isArray(folderPhotos) ? folderPhotos : [];
        setPhotos(prev => ({ ...prev, [folder.event_id!]: allPhotos }));
        
        // Open viewer with ALL photos (including stacked ones)
        if (allPhotos.length > 0) {
          setViewingPhotos(allPhotos);
          setCurrentPhotoIndex(0);
          setViewingEventId(folder.event_id);
          setShowPhotoViewer(true);
        } else {
          toast.error('No photos found in this gallery');
        }
      } catch (error: any) {
        console.error('Error loading photos for viewer:', error);
        toast.error('Failed to load photos');
      } finally {
        setLoadingPhotos(prev => ({ ...prev, [folder.event_id!]: false }));
      }
    }
  };

  const handlePreviousPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : viewingPhotos.length - 1));
  };

  const handleNextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev < viewingPhotos.length - 1 ? prev + 1 : 0));
  };

  const handleClosePhotoViewer = () => {
    setShowPhotoViewer(false);
    setViewingPhotos([]);
    setCurrentPhotoIndex(0);
    setViewingEventId(null);
  };

  const handleDeletePhotoInViewer = async () => {
    if (!viewingEventId || viewingPhotos.length === 0 || currentPhotoIndex < 0 || currentPhotoIndex >= viewingPhotos.length) {
      toast.error('Cannot delete photo');
      return;
    }

    const photoToDelete = viewingPhotos[currentPhotoIndex];
    if (!photoToDelete.filename) {
      toast.error('Photo filename not found');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      await galleriesAPI.deletePhoto(viewingEventId, photoToDelete.filename);
      toast.success('Photo deleted successfully');
      
      // Remove the deleted photo from viewing photos
      const updatedPhotos = viewingPhotos.filter((_, index) => index !== currentPhotoIndex);
      setViewingPhotos(updatedPhotos);
      
      // Update photos state for the folder
      setPhotos(prev => ({ ...prev, [viewingEventId]: updatedPhotos }));
      
      // Handle navigation after deletion
      if (updatedPhotos.length === 0) {
        // No photos left, close viewer
        handleClosePhotoViewer();
      } else if (currentPhotoIndex >= updatedPhotos.length) {
        // Deleted the last photo, go to previous
        setCurrentPhotoIndex(updatedPhotos.length - 1);
      }
      // Otherwise, stay at current index (which now points to the next photo)
      
      // Refresh photos from server to ensure consistency
      await fetchPhotos(viewingEventId);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete photo');
    }
  };

  const handleTogglePublish = async (folder: GalleryFolder) => {
    if (!folder.event_id) {
      toast.error('Cannot publish gallery without event ID');
      return;
    }

    const newStatus = !folder.gallery_is_public;
    
    // Check if trying to publish and event is inactive
    if (newStatus === true && folder.is_active === false) {
      toast.error('Cannot publish gallery for an inactive event. Please activate the event first.');
      return;
    }

    try {
      await eventsAPI.toggleGalleryPublish(folder.event_id, newStatus);
      
      // Update local state
      setFolders(folders.map(f => 
        f.folderName === folder.folderName 
          ? { ...f, gallery_is_public: newStatus }
          : f
      ));
      
      toast.success(`Gallery ${newStatus ? 'published' : 'unpublished'} successfully`);
      
      // Refresh folders to get updated is_active status
      await fetchFolders();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to update gallery status';
      toast.error(errorMessage);
    }
  };

  const handleUploadClick = (folder: GalleryFolder) => {
    setSelectedFolder(folder);
    setSelectedFiles([]);
    setShowUploadModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (!selectedFolder || !selectedFolder.event_id || selectedFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    setUploading(true);
    try {
      const result = await galleriesAPI.uploadPhotos(selectedFolder.event_id, selectedFiles);
      toast.success(result.message || `${selectedFiles.length} file(s) uploaded successfully`);
      setShowUploadModal(false);
      setSelectedFolder(null);
      setSelectedFiles([]);
      // Refresh photos
      await fetchPhotos(selectedFolder.event_id);
    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to upload photos';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };


  // Get unique years from folders, sorted descending
  const availableYears = [...new Set(folders.filter(f => f.year).map(f => f.year!))].sort((a, b) => b - a);

  // Filter folders by selected year
  const filteredFolders = selectedYear
    ? folders.filter(f => f.year === selectedYear)
    : folders;

  const formatFolderName = (folder: GalleryFolder): string => {
    if (folder.event_name && folder.year) {
      return `${folder.event_name} (${folder.year})`;
    }
    return folder.folderName;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Galleries Management</h1>
          <p className="text-gray-600 mt-1">Manage photo galleries for events</p>
        </div>
      </div>

      {/* Year Pagination */}
      {availableYears.length > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700 mr-2">Filter by Year:</span>
            <button
              onClick={() => {
                setSelectedYear(null);
                setHasUserSelectedYear(true);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedYear === null
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Years
            </button>
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => {
                  setSelectedYear(year);
                  setHasUserSelectedYear(true);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedYear === year
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
          {selectedYear && (
            <div className="mt-3 text-sm text-gray-600">
              Showing {filteredFolders.length} gallery{filteredFolders.length !== 1 ? 'ies' : ''} for {selectedYear}
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && selectedFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Upload Photos & Videos to {formatFolderName(selectedFolder)}
                </h2>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFolder(null);
                    setSelectedFiles([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Photos & Videos
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={uploading}
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    You can select multiple images and videos to upload (max 20 files, 100MB each). Supported formats: Images (jpeg, jpg, png, gif, webp), Videos (mp4, mov, avi, webm, mkv)
                  </p>
                  {selectedFiles.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Selected files ({selectedFiles.length}):
                      </p>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        {selectedFiles.map((file, index) => (
                          <li key={index}>{file.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {uploading && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">Uploading photos...</p>
                  </div>
                )}

                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setSelectedFolder(null);
                      setSelectedFiles([]);
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUpload}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    disabled={uploading || selectedFiles.length === 0}
                  >
                    {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} File(s)`}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Gallery Folders Grid */}
      {filteredFolders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">
            {selectedYear
              ? `No gallery folders found for ${selectedYear}. Create an event to generate a gallery folder.`
              : 'No gallery folders found. Create an event to generate a gallery folder.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFolders.map((folder) => {
            const folderPhotos = folder.event_id ? photos[folder.event_id] || [] : [];
            const isLoading = folder.event_id ? loadingPhotos[folder.event_id] : false;
            
            // Debug log for Durgotsav folder

            return (
              <motion.div
                key={folder.folderName}
                id={folder.event_id ? `gallery-${folder.event_id}` : undefined}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300"
              >
                <div className="p-6">
                  {/* Card Layout: Left Column (Event Info + Buttons) | Right Column (Thumbnails) */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    {/* Left Column: Event Info and Action Buttons */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start space-x-3 mb-3">
                        <div className="bg-primary-100 rounded-lg p-3 flex-shrink-0">
                          <Folder className="w-6 h-6 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-lg font-bold text-gray-900">
                              {formatFolderName(folder)}
                            </h3>
                            <span
                              className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
                                folder.gallery_is_public
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {folder.gallery_is_public ? 'Published' : 'Unpublished'}
                            </span>
                            {folder.is_active === false && (
                              <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                Event Inactive
                              </span>
                            )}
                          </div>
                          {folder.event_id && (
                            <p className="text-sm text-gray-500 mt-1">
                              ID: {folder.event_id}
                            </p>
                          )}
                          {folder.year && (
                            <div className="flex items-center text-sm text-gray-600 mt-2">
                              <Calendar className="w-4 h-4 mr-2" />
                              <span>{folder.year}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleTogglePublish(folder)}
                          disabled={!folder.gallery_is_public && folder.is_active === false}
                          className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center ${
                            folder.gallery_is_public
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : folder.is_active === false
                              ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                              : 'bg-green-50 text-green-700 hover:bg-green-100'
                          }`}
                          title={!folder.gallery_is_public && folder.is_active === false 
                            ? 'Event must be activated before publishing gallery'
                            : folder.gallery_is_public 
                            ? 'Unpublish gallery'
                            : 'Publish gallery'
                          }
                        >
                          {folder.gallery_is_public ? (
                            <>
                              <EyeOff className="w-4 h-4 mr-2" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              Publish
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleUploadClick(folder)}
                          className="px-4 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium flex items-center"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Photos
                        </button>

                        <button
                          onClick={() => handleToggleExpand(folder)}
                          className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium flex items-center"
                        >
                          <ImageIcon className="w-4 h-4 mr-2" />
                          View Gallery
                        </button>
                      </div>
                    </div>
                    
                    {/* Right Column: Photo Thumbnails */}
                    {folder.event_id && (
                      <div className="flex items-center justify-end gap-2 flex-shrink-0" style={{ width: '600px' }}>
                        {isLoading ? (
                          <div className="w-full h-36 rounded-lg bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                          </div>
                        ) : folderPhotos.length > 0 ? (
                          <div className="relative flex items-center justify-end gap-2" style={{ width: '600px', height: '144px', flexShrink: 0 }}>
                            {/* Always use same 3-position layout */}
                            {folderPhotos.length > 3 ? (
                              <>
                                {/* Position 1: First photo */}
                                <div style={{ flexShrink: 0 }}>
                                  <ThumbnailImage
                                    photo={folderPhotos[0]}
                                    folder={folder}
                                    photoBlobUrls={photoBlobUrls}
                                    setPhotoBlobUrls={setPhotoBlobUrls}
                                  />
                                </div>
                                {/* Position 2: Second photo */}
                                <div style={{ flexShrink: 0 }}>
                                  <ThumbnailImage
                                    photo={folderPhotos[1]}
                                    folder={folder}
                                    photoBlobUrls={photoBlobUrls}
                                    setPhotoBlobUrls={setPhotoBlobUrls}
                                  />
                                </div>
                                {/* Position 3: Third photo and beyond stacked */}
                                <div className="relative" style={{ width: '180px', height: '144px', flexShrink: 0 }}>
                                  {folderPhotos.slice(2).map((photo, index) => {
                                    // Stack photos starting from 3rd with slight offset and rotation
                                    const offset = index * 4;
                                    const rotation = (index % 2 === 0 ? 1 : -1) * (index * 2);
                                    const zIndex = 10 + index; // Lower z-index to stay below modal
                                    
                                    return (
                                      <div
                                        key={photo.id}
                                        className="absolute top-0 left-0 rounded-lg overflow-hidden border-2 border-gray-300 bg-gray-100"
                                        style={{
                                          width: '180px',
                                          height: '144px',
                                          transform: `translate(${offset}px, ${offset}px) rotate(${rotation}deg)`,
                                          zIndex: zIndex,
                                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                        }}
                                      >
                                        <ThumbnailImage
                                          photo={photo}
                                          folder={folder}
                                          photoBlobUrls={photoBlobUrls}
                                          setPhotoBlobUrls={setPhotoBlobUrls}
                                        />
                                      </div>
                                    );
                                  })}
                                  {/* Indicator badge */}
                                  {folderPhotos.length > 3 && (
                                    <div 
                                      className="absolute bottom-2 right-2 bg-primary-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold shadow-lg"
                                      style={{ transform: 'translate(0, 0)', zIndex: 200 }}
                                    >
                                      +{folderPhotos.length - 3}
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              // If 3 or fewer photos, show all in fixed positions
                              <>
                                {folderPhotos.map((photo) => (
                                  <div key={photo.id} style={{ flexShrink: 0 }}>
                                    <ThumbnailImage
                                      photo={photo}
                                      folder={folder}
                                      photoBlobUrls={photoBlobUrls}
                                      setPhotoBlobUrls={setPhotoBlobUrls}
                                    />
                                  </div>
                                ))}
                                {/* Empty placeholders to maintain positions */}
                                {Array.from({ length: 3 - folderPhotos.length }).map((_, index) => (
                                  <div key={`placeholder-${index}`} style={{ width: '180px', height: '144px', flexShrink: 0 }}></div>
                                ))}
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Photo Viewer Modal */}
      {showPhotoViewer && viewingPhotos.length > 0 && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center"
          style={{ zIndex: 9999 }}
          onClick={handleClosePhotoViewer}
        >
          <div 
            className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={handleClosePhotoViewer}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors bg-black bg-opacity-50 rounded-full p-2"
              style={{ zIndex: 10000 }}
            >
              <X className="w-6 h-6" />
            </button>

            {/* Delete Button */}
            <button
              onClick={handleDeletePhotoInViewer}
              className="absolute top-4 right-20 text-white hover:text-red-400 transition-colors bg-red-600 hover:bg-red-700 bg-opacity-80 rounded-full p-2"
              style={{ zIndex: 10000 }}
              title="Delete photo"
            >
              <Trash2 className="w-6 h-6" />
            </button>

            {/* Previous Button */}
            <button
              onClick={handlePreviousPhoto}
              className="absolute left-4 text-white hover:text-gray-300 transition-colors z-10 bg-black bg-opacity-50 rounded-full p-3"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>

            {/* Photo/Video Display */}
            <div className="flex flex-col items-center justify-center w-full h-full">
              {viewingPhotos[currentPhotoIndex] ? (
                <>
                  {viewingPhotos[currentPhotoIndex].type === 'video' ? (
                    <div className="max-w-full max-h-[85vh] flex items-center justify-center">
                      <video
                        key={viewingPhotos[currentPhotoIndex].id}
                        src={viewingPhotos[currentPhotoIndex].url}
                        controls
                        className="max-w-full max-h-[85vh] rounded-lg"
                        style={{ maxWidth: '100%', maxHeight: '85vh' }}
                      />
                    </div>
                  ) : (
                    <PhotoViewerImage
                      photo={viewingPhotos[currentPhotoIndex]}
                      photoBlobUrls={photoBlobUrls}
                      setPhotoBlobUrls={setPhotoBlobUrls}
                    />
                  )}
                  {viewingPhotos[currentPhotoIndex].caption && (
                    <p className="mt-4 text-white text-lg text-center max-w-4xl px-4">
                      {viewingPhotos[currentPhotoIndex].caption}
                    </p>
                  )}
                  <p className="mt-2 text-white text-sm text-center opacity-75">
                    {currentPhotoIndex + 1} / {viewingPhotos.length} {viewingPhotos[currentPhotoIndex].type === 'video' ? '(Video)' : '(Photo)'}
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-center w-full h-[85vh]">
                  <div className="text-white">Loading...</div>
                </div>
              )}
            </div>

            {/* Next Button */}
            <button
              onClick={handleNextPhoto}
              className="absolute right-4 text-white hover:text-gray-300 transition-colors bg-black bg-opacity-50 rounded-full p-3"
              style={{ zIndex: 10000 }}
            >
              <ChevronRight className="w-8 h-8" />
            </button>

          </div>
        </div>
      )}
    </div>
  );
}
