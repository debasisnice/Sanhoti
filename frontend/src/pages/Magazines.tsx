import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Lock, X, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { magazinesAPI } from '../services/api';
import { Magazine } from '../types';
import { format } from 'date-fns';
import { convertPSTToLocal } from '../utils/dateUtils';
import PDFThumbnail from '../components/PDFThumbnail';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the PDF.js worker - use local worker file for better reliability
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
}

export default function Magazines() {
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMagazine, setSelectedMagazine] = useState<Magazine | null>(null);

  useEffect(() => {
    magazinesAPI
      .getPublic()
      .then(setMagazines)
      .catch(console.error)
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
            <BookOpen className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              Community Magazines
            </h1>
          </div>
          <p className="text-2xl text-gray-600">
            Read our latest publications and community updates
          </p>
        </motion.div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : magazines.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No magazines available at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {magazines.map((magazine, index) => (
              <motion.div
                key={magazine.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-2 cursor-pointer"
                onClick={() => setSelectedMagazine(magazine)}
              >
                <div className="relative h-64 bg-gradient-to-br from-primary-400 to-primary-600 overflow-hidden">
                  <PDFThumbnail
                    fileUrl={magazine.fileUrl}
                    alt={magazine.title}
                  />
                  {!magazine.isPublic && (
                    <div className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-2 z-10">
                      <Lock className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{magazine.title}</h3>
                  {magazine.description && (
                    <p className="text-gray-600 mb-4 line-clamp-2">{magazine.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {format(convertPSTToLocal(magazine.publishDate), 'MMM dd, yyyy')}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* PDF Viewer Modal */}
      <AnimatePresence>
        {selectedMagazine && (
          <PDFModal 
            magazine={selectedMagazine}
            onClose={() => {
              setSelectedMagazine(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// PDF Modal Component - E-Zine Style Reader
function PDFModal({ magazine, onClose }: { magazine: Magazine; onClose: () => void }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState(800);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const [flipDirection, setFlipDirection] = useState<'left' | 'right' | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [displayPage, setDisplayPage] = useState(1); // Page to display (doesn't change during flip)
  const [flipProgress, setFlipProgress] = useState(0); // 0 to 1 for animation progress

  const pdfUrl = (() => {
    const fileUrl = magazine.fileUrl;
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return fileUrl;
    }
    // Use relative path in production (when served by Nginx), absolute URL in development
    const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:5001');
    // If fileUrl already starts with /api/, backend already includes /api
    if (fileUrl.startsWith('/api/')) {
      // In production (API_BASE_URL is empty), use as-is
      // In development (API_BASE_URL is http://localhost:5001), prepend it
      if (API_BASE_URL && !API_BASE_URL.endsWith('/api')) {
        return `${API_BASE_URL}${fileUrl}`;
      } else {
        // In production, use as-is (fileUrl already has /api/)
        return fileUrl;
      }
    }
    // Otherwise, add /api prefix
    const fullPath = `/api${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}`;
    return API_BASE_URL && !API_BASE_URL.endsWith('/api') ? `${API_BASE_URL}${fullPath}` : fullPath;
  })();

  // Detect desktop vs mobile
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (numPages === null) return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePreviousPage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages, currentPage, onClose, isDesktop]);

  const handlePreviousPage = () => {
    if (isDesktop) {
      // Desktop: Flip left page to reveal previous pages
      setFlipDirection('right');
      setIsFlipping(true);
      setFlipProgress(0);
      
      // Animate flip progress
      const startTime = Date.now();
      const duration = 1000; // 1 second
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setFlipProgress(progress);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Animation complete - update pages
          if (currentPage > 2) {
            const newPage = currentPage - 2;
            setCurrentPage(newPage);
            setDisplayPage(newPage);
          } else if (currentPage > 1) {
            setCurrentPage(1);
            setDisplayPage(1);
          }
          setTimeout(() => {
            setFlipDirection(null);
            setIsFlipping(false);
            setFlipProgress(0);
          }, 50);
        }
      };
      requestAnimationFrame(animate);
    } else {
      // Mobile: Simple page change
      setFlipDirection('right');
      setTimeout(() => {
        if (currentPage > 1) {
          setCurrentPage(currentPage - 1);
          setDisplayPage(currentPage - 1);
        }
        setTimeout(() => setFlipDirection(null), 600);
      }, 50);
    }
  };

  const handleNextPage = () => {
    if (isDesktop) {
      // Desktop: Flip right page to reveal next pages
      setFlipDirection('left');
      setIsFlipping(true);
      setFlipProgress(0);
      
      // Animate flip progress
      const startTime = Date.now();
      const duration = 1000; // 1 second
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setFlipProgress(progress);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Animation complete - update pages
          if (numPages && currentPage < numPages - 1) {
            const newPage = currentPage + 2;
            setCurrentPage(newPage);
            setDisplayPage(newPage);
          } else if (numPages && currentPage < numPages) {
            setCurrentPage(numPages);
            setDisplayPage(numPages);
          }
          setTimeout(() => {
            setFlipDirection(null);
            setIsFlipping(false);
            setFlipProgress(0);
          }, 50);
        }
      };
      requestAnimationFrame(animate);
    } else {
      // Mobile: Simple page change
      setFlipDirection('left');
      setTimeout(() => {
        if (numPages && currentPage < numPages) {
          setCurrentPage(currentPage + 1);
          setDisplayPage(currentPage + 1);
        }
        setTimeout(() => setFlipDirection(null), 600);
      }, 50);
    }
  };

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value);
    if (page >= 1 && numPages && page <= numPages) {
      // Direct page jump - no flip effect
      setFlipDirection(null);
      setCurrentPage(page);
      setDisplayPage(page);
    }
  };

  // Calculate page width based on viewport
  useEffect(() => {
    const calculatePageWidth = () => {
      const isDesktopView = window.innerWidth >= 768;
      // Account for padding (2*24px = 48px on desktop, 2*8px = 16px on mobile)
      // Account for navigation buttons (2*80px = 160px)
      // Account for header only (approximately 100px, footer removed)
      const padding = isDesktopView ? 48 : 16;
      const buttonSpace = 160;
      const headerOnly = 100;
      const availableWidth = window.innerWidth - padding - buttonSpace;
      const availableHeight = window.innerHeight - headerOnly;
      
      if (isDesktopView) {
        // Desktop: Two pages side by side, need space for gap between pages
        const gapBetweenPages = 16;
        const availableWidthForTwoPages = availableWidth - gapBetweenPages;
        const widthFromHeight = availableHeight * 0.707; // A4 ratio
        const widthFromWidth = availableWidthForTwoPages / 2; // Each page gets half
        
        // Use the smaller of the two to ensure pages fit
        const calculatedWidth = Math.min(450, Math.min(widthFromWidth, widthFromHeight));
        setPageWidth(Math.max(300, calculatedWidth)); // Minimum 300px per page
      } else {
        // Mobile: Single page
        const widthFromHeight = availableHeight * 0.707; // A4 ratio
        const widthFromWidth = availableWidth;
        
        // Use the smaller of the two to ensure page fits
        const calculatedWidth = Math.min(900, Math.min(widthFromWidth, widthFromHeight));
        setPageWidth(Math.max(400, calculatedWidth)); // Minimum 400px
      }
    };

    calculatePageWidth();
    window.addEventListener('resize', calculatePageWidth);
    return () => window.removeEventListener('resize', calculatePageWidth);
  }, []);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-75 z-50"
        onClick={onClose}
      />
      
      {/* Modal - Full Screen E-Zine Reader */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg shadow-2xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col">
          {/* Header with Navigation - Single Line */}
          <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-700 bg-gray-800 gap-2 md:gap-4 overflow-x-auto">
            {/* Title */}
            <div className="flex-shrink-0 min-w-0">
              <h2 className="text-sm md:text-lg lg:text-xl font-bold text-white truncate">{magazine.title}</h2>
            </div>

            {/* Navigation Controls */}
            {!pdfLoading && numPages && numPages > 0 && (
              <>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className={`px-2 py-1.5 md:px-3 md:py-2 rounded-lg transition-colors text-xs md:text-sm font-medium whitespace-nowrap ${
                      currentPage === 1
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-primary-600 text-white hover:bg-primary-700'
                    }`}
                  >
                    <ChevronLeft className="w-3 h-3 md:w-4 md:h-4 inline mr-1" />
                    <span className="hidden sm:inline">{isDesktop ? 'Previous Spread' : 'Previous'}</span>
                  </button>
                  <button
                    onClick={handleNextPage}
                    disabled={isDesktop ? (numPages ? currentPage >= numPages - 1 : false) : (currentPage === numPages)}
                    className={`px-2 py-1.5 md:px-3 md:py-2 rounded-lg transition-colors text-xs md:text-sm font-medium whitespace-nowrap ${
                      (isDesktop ? (numPages ? currentPage >= numPages - 1 : false) : (currentPage === numPages))
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-primary-600 text-white hover:bg-primary-700'
                    }`}
                  >
                    <span className="hidden sm:inline">{isDesktop ? 'Next Spread' : 'Next'}</span>
                    <ChevronRight className="w-3 h-3 md:w-4 md:h-4 inline ml-1" />
                  </button>
                </div>

                {/* Page Counter */}
                <div className="flex items-center gap-1 md:gap-2 text-white flex-shrink-0">
                  <span className="text-xs md:text-sm text-gray-400 whitespace-nowrap">
                    {isDesktop && numPages && currentPage < numPages 
                      ? `Pages ${currentPage}-${currentPage + 1}` 
                      : 'Page'}
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={numPages}
                    value={currentPage}
                    onChange={handlePageInput}
                    className="w-10 md:w-12 lg:w-16 px-1 md:px-2 py-1 text-center bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs md:text-sm"
                  />
                  <span className="text-xs md:text-sm text-gray-400 whitespace-nowrap">of {numPages}</span>
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
              <button
                onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
                className="hidden md:flex items-center gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs md:text-sm font-medium whitespace-nowrap"
                title="Open in a new window"
              >
                <ExternalLink className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden lg:inline">Open in new window</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 md:p-2 hover:bg-gray-700 rounded-full transition-colors flex-shrink-0"
                title="Close (Esc)"
              >
                <X className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </button>
            </div>
          </div>

          {/* E-Zine PDF Viewer with External Navigation Arrows */}
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 overflow-auto relative">
            {/* Left Arrow - Outside PDF Area */}
            {!pdfLoading && numPages && numPages > 0 && (
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className={`absolute left-2 md:left-4 z-10 p-3 md:p-4 rounded-full transition-all ${
                  currentPage === 1
                    ? 'bg-gray-700 opacity-50 cursor-not-allowed'
                    : 'bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm'
                }`}
                title={isDesktop ? "Previous spread (←)" : "Previous page (←)"}
              >
                <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </button>
            )}

            {/* PDF Viewer Container */}
            <div className="flex-1 flex items-center justify-center p-2 md:p-6 h-full">
              {pdfLoading && (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
                </div>
              )}

              <Document
                file={pdfUrl}
              onLoadSuccess={({ numPages }) => {
                setNumPages(numPages);
                setPdfLoading(false);
                setPdfError(null);
                setCurrentPage(1);
                setDisplayPage(1);
              }}
                onLoadError={(_error) => {
                  setPdfError('Failed to load PDF');
                  setPdfLoading(false);
                }}
                loading={null}
              >
                {pdfError ? (
                  <div className="text-center py-12">
                    <p className="text-red-400 text-lg">{pdfError}</p>
                  </div>
                ) : !pdfLoading && numPages && numPages > 0 ? (
                  <div className="w-full h-full flex items-center justify-center min-h-0" style={{ perspective: '2500px', perspectiveOrigin: 'center center' }}>
                    {isDesktop ? (
                      /* Desktop: Realistic book page flip - left page static, right page flips */
                      <div className="relative flex items-center justify-center gap-4" style={{ transformStyle: 'preserve-3d', perspective: '2000px', perspectiveOrigin: 'center center' }}>
                        {/* Left page - stays static during flip */}
                        <div 
                          className="bg-white shadow-2xl rounded-lg overflow-hidden relative" 
                          style={{
                            width: pageWidth,
                            minHeight: '600px',
                            zIndex: 1,
                            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                          }}
                        >
                          <Page
                            pageNumber={displayPage}
                            width={pageWidth}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                            className="shadow-xl"
                          />
                        </div>

                        {/* Right page - flips from right to left */}
                        {numPages && displayPage < numPages && (
                          <>
                            {/* Flipping page (page 2) - fades out until middle, then shows page 3 on back */}
                            <div 
                              className="relative"
                              style={{
                                transformStyle: 'preserve-3d',
                                transform: flipDirection === 'left' && isFlipping
                                  ? `rotateY(${-flipProgress * 180}deg)`
                                  : 'rotateY(0deg)',
                                transformOrigin: 'left center',
                                zIndex: flipDirection === 'left' && isFlipping ? 10 : 2,
                                transition: isFlipping ? 'none' : 'transform 0.3s ease',
                                opacity: flipDirection === 'left' && isFlipping
                                  ? flipProgress <= 0.5 ? (1 - flipProgress * 2) : 0
                                  : 1
                              }}
                            >
                              <div 
                                className="bg-white shadow-2xl rounded-lg overflow-hidden" 
                                style={{
                                  transformStyle: 'preserve-3d',
                                  width: pageWidth,
                                  position: 'relative',
                                  minHeight: '600px',
                                  boxShadow: flipDirection === 'left' && isFlipping && flipProgress > 0.1
                                    ? `0 ${20 + flipProgress * 50}px ${60 + flipProgress * 100}px rgba(0, 0, 0, ${0.5 + flipProgress * 0.5}), inset ${-25 * flipProgress}px 0 ${50 * flipProgress}px rgba(0, 0, 0, ${0.5 * flipProgress})`
                                    : '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                                }}
                              >
                                {/* Front face - current right page (page 2) - fades out */}
                                <div
                                  style={{
                                    backfaceVisibility: 'hidden',
                                    WebkitBackfaceVisibility: 'hidden',
                                    transform: 'rotateY(0deg)',
                                    transformStyle: 'preserve-3d',
                                    position: 'relative',
                                    width: '100%'
                                  }}
                                >
                                  <Page
                                    pageNumber={displayPage + 1}
                                    width={pageWidth}
                                    renderTextLayer={!isFlipping || flipProgress < 0.3}
                                    renderAnnotationLayer={!isFlipping || flipProgress < 0.3}
                                    className="shadow-xl"
                                  />
                                </div>
                                {/* Back face - next page (page 3) - fades in after middle */}
                                {numPages && displayPage + 2 <= numPages && (
                                  <div
                                    style={{
                                      backfaceVisibility: 'hidden',
                                      WebkitBackfaceVisibility: 'hidden',
                                      transform: 'rotateY(180deg)',
                                      transformStyle: 'preserve-3d',
                                      position: 'absolute',
                                      width: '100%',
                                      top: 0,
                                      left: 0,
                                      opacity: flipDirection === 'left' && isFlipping
                                        ? flipProgress > 0.5 ? ((flipProgress - 0.5) * 2) : 0
                                        : 0
                                    }}
                                  >
                                    <Page
                                      pageNumber={displayPage + 2}
                                      width={pageWidth}
                                      renderTextLayer={false}
                                      renderAnnotationLayer={false}
                                      className="shadow-xl"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* New right page (page 4) - appears during flip */}
                            {isFlipping && flipDirection === 'left' && numPages && displayPage + 3 <= numPages && (
                              <div 
                                className="bg-white shadow-2xl rounded-lg overflow-hidden relative" 
                                style={{
                                  width: pageWidth,
                                  minHeight: '600px',
                                  zIndex: 2,
                                  opacity: Math.min(flipProgress * 2, 1),
                                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                                  transition: 'opacity 0.3s ease'
                                }}
                              >
                                <Page
                                  pageNumber={displayPage + 3}
                                  width={pageWidth}
                                  renderTextLayer={flipProgress > 0.3}
                                  renderAnnotationLayer={flipProgress > 0.3}
                                  className="shadow-xl"
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      /* Mobile: Single page flip */
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={currentPage}
                          initial={flipDirection === 'left' 
                            ? { 
                                opacity: 0, 
                                rotateY: 180,
                                scaleX: 0.3,
                                x: pageWidth * 0.5
                              }
                            : flipDirection === 'right'
                            ? { 
                                opacity: 0, 
                                rotateY: -180,
                                scaleX: 0.3,
                                x: -pageWidth * 0.5
                              }
                            : { opacity: 0, x: 20 }
                          }
                          animate={{ 
                            opacity: 1, 
                            rotateY: 0,
                            scaleX: 1,
                            x: 0
                          }}
                          exit={flipDirection === 'left'
                            ? { 
                                opacity: [1, 1, 0.3, 0],
                                rotateY: [0, -90, -180],
                                scaleX: [1, 0.5, 0.2],
                                x: [0, -pageWidth * 0.3, -pageWidth * 0.6],
                                z: [0, 50, -100]
                              }
                            : flipDirection === 'right'
                            ? { 
                                opacity: [1, 1, 0.3, 0],
                                rotateY: [0, 90, 180],
                                scaleX: [1, 0.5, 0.2],
                                x: [0, pageWidth * 0.3, pageWidth * 0.6],
                                z: [0, 50, -100]
                              }
                            : { opacity: 0, x: -20 }
                          }
                          transition={{ 
                            duration: 1.0,
                            ease: [0.25, 0.46, 0.45, 0.94],
                            times: flipDirection ? [0, 0.3, 0.7, 1] : undefined
                          }}
                          style={{
                            transformStyle: 'preserve-3d',
                            backfaceVisibility: 'hidden'
                          }}
                          className="flex items-center justify-center max-w-full max-h-full"
                        >
                          <div 
                            className="bg-white shadow-2xl rounded-lg overflow-hidden relative" 
                            style={{
                              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                              maxWidth: '100%',
                              maxHeight: '100%'
                            }}
                          >
                            <Page
                              pageNumber={currentPage}
                              width={pageWidth}
                              renderTextLayer={true}
                              renderAnnotationLayer={true}
                              className="shadow-xl"
                            />
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>
                ) : null}
              </Document>
            </div>

            {/* Right Arrow - Outside PDF Area */}
            {!pdfLoading && numPages && numPages > 0 && (
              <button
                onClick={handleNextPage}
                disabled={isDesktop ? (numPages ? currentPage >= numPages - 1 : false) : (currentPage === numPages)}
                className={`absolute right-2 md:right-4 z-10 p-3 md:p-4 rounded-full transition-all ${
                  (isDesktop ? (numPages ? currentPage >= numPages - 1 : false) : (currentPage === numPages))
                    ? 'bg-gray-700 opacity-50 cursor-not-allowed'
                    : 'bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm'
                }`}
                title={isDesktop ? "Next spread (→)" : "Next page (→)"}
              >
                <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

