import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { durgaPujaPageAPI } from '../services/api';
import { durgaPujaPagePath } from '../utils/durgaPuja';

/** Redirect /durga-puja → /durga-puja-{activeYear} */
export default function DurgaPujaRedirect() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    durgaPujaPageAPI
      .getActive()
      .then(({ year }) => setTarget(durgaPujaPagePath(year)))
      .catch(() => setTarget(durgaPujaPagePath(new Date().getFullYear())));
  }, []);

  if (!target) {
    // Render a real H1 + intro in the initial paint so this route is never
    // "H1 missing" for crawlers/inspectors that render the raw SPA instead of
    // the /seo/ prerender (e.g. Bing's inspection crawler, which doesn't send
    // the bingbot UA that Nginx routes to /seo). Humans see this only briefly
    // before the redirect to the current year's page fires.
    return (
      <div className="min-h-[40vh] max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Durga Puja in Orange County — Sanhoti
        </h1>
        <p className="text-gray-700 mb-6">
          Sanhoti hosts one of Orange County&apos;s biggest Bengali Durga Puja celebrations —
          puja and pushpanjali, dhunuchi naach, live Bengali concerts, and food, welcoming
          families across Orange County and Southern California. Taking you to this year&apos;s
          celebration…
        </p>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto" />
      </div>
    );
  }

  return <Navigate to={target} replace />;
}
