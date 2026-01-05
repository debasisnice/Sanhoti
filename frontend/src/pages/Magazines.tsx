import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Lock, X, ExternalLink } from 'lucide-react';
import { magazinesAPI } from '../services/api';
import { Magazine } from '../types';
import { format } from 'date-fns';
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
                      {format(new Date(magazine.publishDate), 'MMM dd, yyyy')}
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

// PDF Modal Component
function PDFModal({ magazine, onClose }: { magazine: Magazine; onClose: () => void }) {
  const [numPages, setNumPages] = useState<number | null>(null);
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

  // Reset scroll position when PDF loads
  useEffect(() => {
    if (!pdfLoading && numPages) {
      const container = document.getElementById('pdf-viewer-container');
      if (container) {
        container.scrollTop = 0;
      }
    }
  }, [pdfLoading, numPages]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{magazine.title}</h2>
              {magazine.description && (
                <p className="text-gray-600 text-sm mt-1">{magazine.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                title="Open in a new window"
              >
                <ExternalLink className="w-4 h-4" />
                Open in a new window
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Close"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 overflow-auto p-4 bg-gray-100">
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages }) => {
                setNumPages(numPages);
                setPdfLoading(false);
                setPdfError(null);
                // Scroll to top after a brief delay to ensure DOM is ready
                setTimeout(() => {
                  const container = document.getElementById('pdf-viewer-container');
                  if (container) {
                    container.scrollTop = 0;
                  }
                }, 200);
              }}
              onLoadError={(_error) => {
                setPdfError('Failed to load PDF');
                setPdfLoading(false);
              }}
              loading={
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
              }
            >
              {pdfError ? (
                <div className="text-center py-12">
                  <p className="text-red-600">{pdfError}</p>
                </div>
              ) : !pdfLoading && numPages && numPages > 0 ? (
                <div className="flex flex-col items-center space-y-4">
                  {Array.from(new Array(numPages), (_el, index) => (
                    <div key={`page_${index + 1}`} className="bg-white shadow-lg">
                      <Page
                        pageNumber={index + 1}
                        width={Math.min(800, window.innerWidth - 100)}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </Document>
          </div>
        </div>
      </motion.div>
    </>
  );
}

