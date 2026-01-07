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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (numPages === null) return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentPage > 1) {
          setCurrentPage(currentPage - 1);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentPage < numPages) {
          setCurrentPage(currentPage + 1);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages, currentPage, onClose]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (numPages && currentPage < numPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value);
    if (page >= 1 && numPages && page <= numPages) {
      setCurrentPage(page);
    }
  };

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
          {/* Header */}
          <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-700">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg md:text-2xl font-bold text-white truncate">{magazine.title}</h2>
              {magazine.description && (
                <p className="text-gray-400 text-xs md:text-sm mt-1 truncate">{magazine.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
                className="hidden md:flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                title="Open in a new window"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden lg:inline">Open in new window</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                title="Close (Esc)"
              >
                <X className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </button>
            </div>
          </div>

          {/* E-Zine PDF Viewer */}
          <div className="flex-1 flex items-center justify-center p-2 md:p-6 bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden relative">
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
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* Previous Page Button */}
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className={`absolute left-2 md:left-4 z-10 p-2 md:p-3 rounded-full transition-all ${
                      currentPage === 1
                        ? 'bg-gray-700 opacity-50 cursor-not-allowed'
                        : 'bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm'
                    }`}
                    title="Previous page (←)"
                  >
                    <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </button>

                  {/* PDF Page - Magazine Style */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentPage}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-center"
                    >
                      <div className="bg-white shadow-2xl rounded-lg overflow-hidden" style={{
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                      }}>
                        <Page
                          pageNumber={currentPage}
                          width={Math.min(900, window.innerWidth - 120)}
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                          className="shadow-xl"
                        />
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {/* Next Page Button */}
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === numPages}
                    className={`absolute right-2 md:right-4 z-10 p-2 md:p-3 rounded-full transition-all ${
                      currentPage === numPages
                        ? 'bg-gray-700 opacity-50 cursor-not-allowed'
                        : 'bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm'
                    }`}
                    title="Next page (→)"
                  >
                    <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </button>
                </div>
              ) : null}
            </Document>
          </div>

          {/* Footer Navigation */}
          {!pdfLoading && numPages && numPages > 0 && (
            <div className="flex items-center justify-between p-3 md:p-4 border-t border-gray-700 bg-gray-800">
              <div className="flex items-center gap-2 md:gap-4">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-colors text-sm md:text-base font-medium ${
                    currentPage === 1
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4 inline mr-1" />
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === numPages}
                  className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-colors text-sm md:text-base font-medium ${
                    currentPage === numPages
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4 inline ml-1" />
                </button>
              </div>

              {/* Page Counter */}
              <div className="flex items-center gap-2 text-white">
                <span className="text-xs md:text-sm text-gray-400">Page</span>
                <input
                  type="number"
                  min="1"
                  max={numPages}
                  value={currentPage}
                  onChange={handlePageInput}
                  className="w-12 md:w-16 px-2 py-1 text-center bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm md:text-base"
                />
                <span className="text-xs md:text-sm text-gray-400">of {numPages}</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

