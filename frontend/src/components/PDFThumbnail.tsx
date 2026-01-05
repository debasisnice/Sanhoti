import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { BookOpen } from 'lucide-react';

// Import CSS for react-pdf (v10 uses dist/Page, not dist/esm/Page)
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the PDF.js worker - use local worker file for better reliability
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
}

interface PDFThumbnailProps {
  fileUrl: string;
  alt: string;
  className?: string;
}

export default function PDFThumbnail({ fileUrl, alt: _alt, className = '' }: PDFThumbnailProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fullUrl, setFullUrl] = useState<string>('');

  useEffect(() => {
    // Construct full URL if fileUrl is relative
    let constructedUrl = fileUrl;
    if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      // If fileUrl already starts with /api/, just prepend the base URL
      // Otherwise, add /api prefix
      if (fileUrl.startsWith('/api/')) {
        constructedUrl = `${API_BASE_URL}${fileUrl}`;
      } else if (fileUrl.startsWith('/')) {
        constructedUrl = `${API_BASE_URL}/api${fileUrl}`;
      } else {
        constructedUrl = `${API_BASE_URL}/api/${fileUrl}`;
      }
    }
    console.log('PDFThumbnail - fileUrl:', fileUrl, 'constructedUrl:', constructedUrl);
    setFullUrl(constructedUrl);
  }, [fileUrl]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log('PDFThumbnail - Document loaded successfully, numPages:', numPages);
    setNumPages(numPages);
    setLoading(false);
    setError(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDFThumbnail - Error loading PDF:', error);
    setLoading(false);
    setError(true);
  };

  if (!fullUrl) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-400 to-primary-600 ${className}`}>
        <BookOpen className="w-16 h-16 text-white opacity-50" />
      </div>
    );
  }

  if (error) {
    console.log('PDFThumbnail - Rendering error state');
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-400 to-primary-600 ${className}`}>
        <BookOpen className="w-16 h-16 text-white opacity-50" />
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-primary-400 to-primary-600 ${className}`}>
      <Document
        file={fullUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={
          <div className="w-full h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        }
        error={
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-16 h-16 text-white opacity-50" />
          </div>
        }
      >
        {!loading && numPages !== null && numPages > 0 && (
          <div className="w-full h-full flex items-center justify-center p-2">
            <Page
              pageNumber={1}
              width={240}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </div>
        )}
      </Document>
    </div>
  );
}

