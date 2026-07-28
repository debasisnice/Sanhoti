import { Link, useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Seo from '../components/Seo';

const SUGGESTIONS = [
  { to: '/', label: 'Home' },
  { to: '/events', label: 'All events' },
  { to: '/durga-puja', label: 'Durga Puja in Orange County' },
  { to: '/festivals', label: 'Bengali festivals' },
  { to: '/bollywood-concerts', label: 'Bollywood & Bengali concerts' },
  { to: '/artists', label: 'Artists' },
  { to: '/galleries', label: 'Photo galleries' },
  { to: '/charity', label: 'Charitable work' },
  { to: '/contact', label: 'Contact us' },
];

/**
 * Catch-all for unmatched SPA routes.
 *
 * The previous behaviour — silently redirecting unknown paths to `/` — returned
 * HTTP 200 for any typo'd or stale URL, which Search Console reports as a soft
 * 404 and which can leave junk URLs indexed as near-duplicates of the homepage.
 * This page declares `noindex` instead and offers real navigation. Crawlers get
 * a true 404 from the `/seo` prerender.
 */
export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <div className="max-w-3xl mx-auto px-4 py-24 text-center">
      <Seo
        title="Page not found | Sanhoti Bengali Association of Orange County"
        description="This page could not be found. Browse current Sanhoti events, festivals, and galleries in Orange County, CA."
        path={pathname}
        noindex
      />
      <Compass className="w-12 h-12 text-primary-600 mx-auto mb-4" />
      <h1 className="text-3xl font-bold text-gray-900 mb-3">Page not found</h1>
      <p className="text-gray-600 mb-8">
        The page you requested doesn't exist or has been moved. Here's where you might be headed:
      </p>
      <ul className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-primary-700 font-medium">
        {SUGGESTIONS.map(s => (
          <li key={s.to}>
            <Link to={s.to} className="hover:underline">
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
