import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Download, Mail, FileText } from 'lucide-react';
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import Seo from '../components/Seo';
import { durgaPujaPageAPI } from '../services/api';
import { durgaPujaPagePath } from '../utils/durgaPuja';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
}

function ProspectusPdfViewer({ pdfUrl }: { pdfUrl: string }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState(800);

  useEffect(() => {
    const updateWidth = () => setPageWidth(Math.min(900, window.innerWidth - 48));
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      )}
      {error && (
        <div className="text-center py-12 px-4">
          <p className="text-red-600 mb-4">{error}</p>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline font-medium"
          >
            Open PDF in a new tab
          </a>
        </div>
      )}
      <PDFDocument
        file={pdfUrl}
        onLoadSuccess={({ numPages: pages }) => {
          setNumPages(pages);
          setLoading(false);
          setError(null);
        }}
        onLoadError={(err) => {
          console.error('Sponsorship prospectus PDF load error:', err);
          setError('Could not display the PDF in your browser.');
          setLoading(false);
        }}
        loading={null}
      >
        {numPages && (
          <div className="space-y-4">
            {Array.from({ length: numPages }, (_, index) => (
              <Page
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                width={pageWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="mx-auto shadow-md bg-white"
              />
            ))}
          </div>
        )}
      </PDFDocument>
      <p className="text-xs text-gray-500 mt-3 text-center">
        Trouble viewing the PDF?{' '}
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">
          Open it in a new tab
        </a>
        .
      </p>
    </div>
  );
}

/**
 * Sponsorship prospectus funnel page at /become-our-sponsor.
 * Shows the active Durga Puja year's uploaded prospectus PDF with a clear
 * "Contact us to sponsor" call to action. The public Durga Puja page's
 * "Become a Sponsor" button and the footer link both open this page.
 */
export default function SponsorshipProspectus() {
  const [year, setYear] = useState<number | null>(null);
  const [hasPdf, setHasPdf] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let resolvedYear = new Date().getFullYear();
      try {
        const { activeYear } = await durgaPujaPageAPI.listYears();
        if (activeYear) resolvedYear = activeYear;
      } catch {
        /* fall back to current year */
      }
      if (cancelled) return;
      setYear(resolvedYear);
      try {
        const { hasPdf: exists } = await durgaPujaPageAPI.hasSponsorshipPdf(resolvedYear);
        if (!cancelled) setHasPdf(exists);
      } catch {
        if (!cancelled) setHasPdf(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pdfUrl = year ? durgaPujaPageAPI.sponsorshipPdfUrl(year) : '';

  return (
    <div className="py-12 pb-24">
      <Seo
        title={`Become a Sponsor — Sanhoti Durga Puja ${year ?? ''} | Sponsorship Prospectus`}
        description={`Partner with Sanhoti Durga Puja ${year ?? ''} in Orange County. View our sponsorship prospectus and contact us to become a sponsor.`}
        path="/become-our-sponsor"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {year && (
            <Link
              to={durgaPujaPagePath(year)}
              className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium mb-4"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Durga Puja {year}
            </Link>
          )}

          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-7 h-7 text-primary-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Become a Sponsor{year ? ` — Durga Puja ${year}` : ''}
            </h1>
          </div>
          <p className="text-gray-700 leading-relaxed mb-6">
            Partnering with Sanhoti puts your brand in front of ~1,000 attendees across three days of
            Orange County&apos;s biggest Bengali celebration. Review our prospectus below for
            sponsorship tiers and benefits, then reach out — we&apos;ll tailor a package to your goals.
          </p>

          {/* Primary CTA */}
          <div className="flex flex-wrap gap-3 mb-8">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              <Mail className="w-5 h-5" /> Contact Us to Sponsor
            </Link>
            {hasPdf && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white border-2 border-primary-600 text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
              >
                <Download className="w-5 h-5" /> Download Prospectus (PDF)
              </a>
            )}
          </div>

          {/* Prospectus viewer */}
          {hasPdf === null ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
            </div>
          ) : hasPdf ? (
            <ProspectusPdfViewer pdfUrl={pdfUrl} />
          ) : (
            <div className="bg-white rounded-2xl shadow border border-gray-100 p-8 text-center">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-700 font-medium">Our sponsorship prospectus is coming soon.</p>
              <p className="text-gray-500 text-sm mt-1">
                In the meantime, contact us and we&apos;ll share sponsorship details directly.
              </p>
            </div>
          )}

          <div className="mt-10 border-t border-gray-200 pt-6">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              <Mail className="w-5 h-5" /> Contact Us to Sponsor
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
