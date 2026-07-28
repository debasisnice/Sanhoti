import { useParams } from 'react-router-dom';
import { parseDurgaPujaYearFromPath } from '../utils/durgaPuja';
import DurgaPuja from './DurgaPuja';
import NotFound from './NotFound';

/**
 * React Router v6 matches params per path segment (/foo/:id), so `/durga-puja-2026`
 * (one segment) cannot use `/durga-puja-:year`. This route handles slug `durga-puja-YYYY`.
 *
 * It is also the SPA catch-all. Anything that is not a Durga Puja year slug now
 * renders NotFound (which sets `noindex`) instead of redirecting to `/`. The old
 * redirect served HTTP 200 for every unknown URL, which Search Console reports as
 * a soft 404 and may index as a homepage duplicate.
 */
export default function DurgaPujaYearRoute() {
  const { slug } = useParams<{ slug: string }>();
  const year = parseDurgaPujaYearFromPath(`/${slug ?? ''}`);
  if (!year) return <NotFound />;
  return <DurgaPuja />;
}
