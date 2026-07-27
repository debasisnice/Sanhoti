import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getDefaultAuthenticatedPath } from '../utils/authRoutes';

/** Send already-authenticated users away from /login and /register. */
export default function AuthenticatedRedirect() {
  const { isAdmin } = useAuthStore();
  return <Navigate to={getDefaultAuthenticatedPath(isAdmin)} replace />;
}
