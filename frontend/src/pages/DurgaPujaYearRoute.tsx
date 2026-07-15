import { Navigate, useParams } from 'react-router-dom';
import { parseDurgaPujaYearFromPath } from '../utils/durgaPuja';
import DurgaPuja from './DurgaPuja';

/**
 * React Router v6 matches params per path segment (/foo/:id), so `/durga-puja-2026`
 * (one segment) cannot use `/durga-puja-:year`. This route handles slug `durga-puja-YYYY`.
 */
export default function DurgaPujaYearRoute() {
  const { slug } = useParams<{ slug: string }>();
  const year = parseDurgaPujaYearFromPath(`/${slug ?? ''}`);
  if (!year) return <Navigate to="/" replace />;
  return <DurgaPuja />;
}
