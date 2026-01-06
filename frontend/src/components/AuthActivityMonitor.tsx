import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

export default function AuthActivityMonitor() {
  const { isAuthenticated, logout, lastActivityTime, updateActivityTime } = useAuthStore();
  const navigate = useNavigate();
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityTimeRef = useRef<number | null>(null);

  // Sync ref with store value
  useEffect(() => {
    lastActivityTimeRef.current = lastActivityTime;
  }, [lastActivityTime]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Clear any existing timers if user is not authenticated
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      lastActivityTimeRef.current = null;
      return;
    }

    // Update activity time on initial mount if authenticated
    updateActivityTime();
    lastActivityTimeRef.current = Date.now();

    // Activity event handlers
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => {
      updateActivityTime();
      lastActivityTimeRef.current = Date.now();
    };

    // Add event listeners for user activity
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Function to check inactivity and logout
    const checkInactivity = () => {
      if (!isAuthenticated) return;

      const currentLastActivity = lastActivityTimeRef.current;
      if (!currentLastActivity) {
        // No activity time recorded, set it now
        updateActivityTime();
        lastActivityTimeRef.current = Date.now();
        return;
      }

      const now = Date.now();
      const timeSinceLastActivity = now - currentLastActivity;

      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        // User has been inactive for 30 minutes, logout
        authAPI.logout();
        logout();
        toast.error('You have been logged out due to inactivity.');
        navigate('/');
      }
    };

    // Check inactivity every minute
    checkIntervalRef.current = setInterval(checkInactivity, 60 * 1000);

    // Also check immediately
    checkInactivity();

    // Handle browser close/tab close
    const handleBeforeUnload = () => {
      if (isAuthenticated) {
        // Clear auth data on browser close
        authAPI.logout();
        logout();
      }
    };

    // Handle visibility change (tab switch, minimize, etc.)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - activity time is already tracked, no action needed
      } else {
        // Tab is visible again, check if we should logout
        checkInactivity();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, logout, navigate, updateActivityTime]);

  return null; // This component doesn't render anything
}

