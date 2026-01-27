import { motion } from 'framer-motion';
import { ExternalLink, Download, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function AdminUserManual() {
  // Use relative path in production (when served by Nginx), absolute URL in development
  const isProd = import.meta.env.MODE === 'production' || import.meta.env.PROD;
  const apiUrl = isProd ? '/api' : (import.meta.env.VITE_API_URL || 'http://localhost:5001/api');
  const manualUrl = `${apiUrl}/user-manual/index.html`;

  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchManual = async () => {
      try {
        setLoading(true);
        const response = await fetch(manualUrl);
        if (!response.ok) {
          throw new Error(`Failed to load manual: ${response.status}`);
        }
        let html = await response.text();
        
        // Fix image paths to use API URL
        html = html.replace(/src="(\d+\.png)"/g, `src="${apiUrl}/user-manual/$1"`);
        
        setHtmlContent(html);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load manual');
      } finally {
        setLoading(false);
      }
    };

    fetchManual();
  }, [manualUrl, apiUrl]);

  const handleOpenInNewTab = () => {
    window.open(manualUrl, '_blank');
  };

  const handleDownloadPDF = () => {
    // Open the manual in a new tab for printing/saving as PDF
    const printWindow = window.open(manualUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Manual</h1>
          <p className="text-gray-600">Admin documentation and guidelines</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleOpenInNewTab}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open in New Tab
          </button>
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden" style={{ height: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            <span className="ml-2 text-gray-600">Loading manual...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full text-red-600">
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && (
          <div 
            className="manual-content"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        )}
      </div>
    </motion.div>
  );
}
