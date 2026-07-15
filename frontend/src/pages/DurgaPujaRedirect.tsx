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
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  return <Navigate to={target} replace />;
}
