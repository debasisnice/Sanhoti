import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Lock, X, ExternalLink } from 'lucide-react';
import { documentsAPI } from '../services/api';
import { Document } from '../types';
import { format } from 'date-fns';
import { convertPSTToLocal } from '../utils/dateUtils';
import PDFThumbnail from '../components/PDFThumbnail';
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the PDF.js worker - use local worker file for better reliability
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
}

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  useEffect(() => {
    documentsAPI
      .getPublic()
      .then(setDocuments)
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
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Documents</h1>
          <p className="text-xl text-gray-600">Browse our community documents and files</p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-lg">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No documents available yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((document, index) => (
              <motion.div
                key={document.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
                onClick={() => setSelectedDocument(document)}
              >
                <div className="h-64 bg-gradient-to-br from-primary-400 to-primary-600 relative overflow-hidden flex items-center justify-center">
                  <PDFThumbnail
                    fileUrl={document.fileUrl}
                    alt={document.title}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-primary-600" />
                    <h3 className="text-xl font-bold text-gray-900 line-clamp-2">{document.title}</h3>
                  </div>
                  {document.description && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">{document.description}</p>
                  )}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{format(convertPSTToLocal(document.publishDate), 'MMM dd, yyyy')}</span>
                    {document.isPublic ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                        Public
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Lock className="w-4 h-4" />
                        <span className="text-xs">Private</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* PDF Modal */}
      <AnimatePresence>
        {selectedDocument && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedDocument(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-primary-600 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6" />
                  <div>
                    <h2 className="text-xl font-bold">{selectedDocument.title}</h2>
                    {selectedDocument.description && (
                      <p className="text-sm text-primary-100">{selectedDocument.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={selectedDocument.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-white text-primary-600 rounded-lg hover:bg-primary-50 transition-colors text-sm font-medium flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in new window
                  </a>
                  <button
                    onClick={() => setSelectedDocument(null)}
                    className="p-2 hover:bg-primary-700 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-gray-100 p-4">
                <PDFViewer document={selectedDocument} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PDFViewer({ document }: { document: Document }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.scrollTop = 0;
    }
  }, [document]);

  const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5001/api');
  const pdfUrl = document.fileUrl.startsWith('http') 
    ? document.fileUrl 
    : document.fileUrl.startsWith('/api') 
      ? `${API_BASE_URL}${document.fileUrl.replace('/api', '')}`
      : `${API_BASE_URL}${document.fileUrl}`;

  return (
    <div ref={viewerRef} className="flex flex-col items-center">
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      )}
      {error && (
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline"
          >
            Open PDF in new window
          </a>
        </div>
      )}
      <PDFDocument
        file={pdfUrl}
        onLoadSuccess={({ numPages }) => {
          setNumPages(numPages);
          setLoading(false);
          setError(null);
        }}
        onLoadError={(error) => {
          console.error('PDF load error:', error);
          setError('Failed to load PDF. Please try opening it in a new window.');
          setLoading(false);
        }}
        loading={
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        }
      >
        {numPages && (
          <div className="space-y-4">
            {Array.from(new Array(numPages), (_el, index) => (
              <Page
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                width={Math.min(800, window.innerWidth - 100)}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="shadow-lg"
              />
            ))}
          </div>
        )}
      </PDFDocument>
    </div>
  );
}

