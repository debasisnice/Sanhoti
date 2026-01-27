import { motion } from 'framer-motion';
import { ExternalLink, Download } from 'lucide-react';

export default function AdminUserManual() {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
  const manualUrl = `${apiUrl}/user-manual/index.html`;

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

      <div className="bg-white rounded-xl shadow-lg overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
        <iframe
          src={manualUrl}
          title="Admin User Manual"
          className="w-full h-full border-0"
          style={{ minHeight: '600px' }}
        />
      </div>
    </motion.div>
  );
}
