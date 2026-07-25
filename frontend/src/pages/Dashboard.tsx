import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Image, BookOpen, User, Key, X, Eye, EyeOff } from 'lucide-react';
import Seo from '../components/Seo';
import { useAuthStore } from '../store/authStore';
import { rsvpAPI, galleriesAPI, magazinesAPI, eventsAPI, authAPI, subEventsAPI } from '../services/api';
import { RSVP, PhotoGallery, Magazine, Event, SubEvent } from '../types';
import { format } from 'date-fns';
import { convertPSTToLocal } from '../utils/dateUtils';
import toast from 'react-hot-toast';

interface RSVPWithEvent extends RSVP {
  event?: Event;
  subEvent?: SubEvent;
  displayName?: string; // Formatted display name (e.g., "Event Name - Sub Event Name")
  linkTo?: string; // Link to event or sub-event page
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [myRSVPs, setMyRSVPs] = useState<RSVPWithEvent[]>([]);
  const [galleries, setGalleries] = useState<PhotoGallery[]>([]);
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const rsvps = await rsvpAPI.getMyRSVPs();
        
        if (!rsvps || rsvps.length === 0) {
          setMyRSVPs([]);
          return;
        }
        
        // Fetch event/sub-event details for each RSVP
        const rsvpsWithEvents = await Promise.all(
          rsvps.map(async (rsvp) => {
            try {
              if (rsvp.subEventId) {
                // This is a sub-event RSVP
                const subEvent = await subEventsAPI.getById(rsvp.subEventId);
                const parentEvent = await eventsAPI.getById(subEvent.event_id);
                return {
                  ...rsvp,
                  subEvent,
                  event: parentEvent,
                  displayName: `${parentEvent.event_name} - ${subEvent.sub_event_name}`,
                  linkTo: `/events/${parentEvent.event_id}`,
                };
              } else if (rsvp.eventId) {
                // This is a regular event RSVP
                const event = await eventsAPI.getById(rsvp.eventId);
                return {
                  ...rsvp,
                  event,
                  displayName: event.event_name,
                  linkTo: `/events/${rsvp.eventId}`,
                };
              } else {
                // Neither eventId nor subEventId is present
                return {
                  ...rsvp,
                  event: undefined,
                  displayName: 'Unknown Event',
                  linkTo: '/events',
                };
              }
            } catch (error) {
              console.error(`Error fetching event/sub-event for RSVP:`, error);
              // If fetch fails, just return RSVP without event/sub-event
              return {
                ...rsvp,
                event: undefined,
                subEvent: undefined,
                displayName: 'Unknown Event',
                linkTo: '/events',
              };
            }
          })
        );
        
        setMyRSVPs(rsvpsWithEvents);
      } catch (error) {
        console.error('Error fetching RSVPs:', error);
        setMyRSVPs([]);
      }
    };
    
    fetchData();
    galleriesAPI.getPublic().then(setGalleries).catch((error) => {
      console.error('Error fetching galleries:', error);
      setGalleries([]);
    });
    magazinesAPI.getAll().then(setMagazines).catch(console.error);
  }, []);

  return (
    <div className="py-12 pb-32">
      <Seo title="Dashboard | Sanhoti" description="Your Sanhoti member dashboard." path="/dashboard" noindex />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <User className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {user?.firstName}!
            </h1>
          </div>
          <p className="text-2xl text-gray-600">Your community dashboard</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My RSVPs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <Calendar className="w-6 h-6 mr-2 text-primary-600" />
                My RSVPs
              </h2>
              <Link
                to="/events"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                View All Events
              </Link>
            </div>
            {myRSVPs.length === 0 ? (
              <p className="text-gray-500">You haven't RSVPed to any events yet.</p>
            ) : (
              <div className="space-y-4">
                {myRSVPs.map((rsvp) => {
                  const eventDate = rsvp.subEvent?.sub_event_start_dt 
                    || rsvp.event?.event_start_dt 
                    || rsvp.event?.date 
                    || '';
                  
                  // Calculate total attendees
                  
                  // Format guests text
                  let guestsText = '';
                  if (rsvp.numberOfAdults && rsvp.numberOfChildren) {
                    guestsText = `${rsvp.numberOfAdults} adult${rsvp.numberOfAdults > 1 ? 's' : ''}, ${rsvp.numberOfChildren} child${rsvp.numberOfChildren > 1 ? 'ren' : ''}`;
                  } else if (rsvp.numberOfAdults) {
                    guestsText = `${rsvp.numberOfAdults} adult${rsvp.numberOfAdults > 1 ? 's' : ''}`;
                  } else if (rsvp.numberOfChildren) {
                    guestsText = `${rsvp.numberOfChildren} child${rsvp.numberOfChildren > 1 ? 'ren' : ''}`;
                  } else if (rsvp.numberOfGuests) {
                    guestsText = `${rsvp.numberOfGuests} guest${rsvp.numberOfGuests > 1 ? 's' : ''}`;
                  } else {
                    guestsText = 'No guests';
                  }
                  
                  return (
                    <Link
                      key={rsvp.id}
                      to={rsvp.linkTo || '/events'}
                      className="block border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">{rsvp.displayName || 'Event'}</h3>
                          {eventDate && (
                            <p className="text-sm text-gray-600 mb-1">
                              {format(convertPSTToLocal(eventDate), 'MMMM dd, yyyy')}
                            </p>
                          )}
                          <p className="text-sm text-gray-500">{guestsText}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ml-4 ${
                            rsvp.status === 'confirmed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {rsvp.status}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center mb-4">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {user?.firstName} {user?.lastName}
                </h3>
                <p className="text-gray-600">{user?.email}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {user?.phone && (
                <p className="text-gray-600">
                  <span className="font-medium">Phone:</span> {user.phone}
                </p>
              )}
              <p className="text-gray-600">
                <span className="font-medium">Role:</span>{' '}
                <span className="capitalize">{user?.role}</span>
              </p>
            </div>

            {/* Change Password Button */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowChangePassword(true)}
                className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium text-sm"
              >
                <Key className="w-4 h-4" />
                Change Password
              </button>
            </div>

            {/* Change Password Modal */}
            {showChangePassword && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Key className="w-5 h-5 text-primary-600" />
                      Change Password
                    </h3>
                    <button
                      onClick={() => {
                        setShowChangePassword(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      className="p-1 hover:bg-gray-100 rounded-full"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Current Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Enter new password (min 6 characters)"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm New Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => {
                          setShowChangePassword(false);
                          setCurrentPassword('');
                          setNewPassword('');
                          setConfirmPassword('');
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleChangePassword}
                        disabled={changingPassword}
                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {changingPassword ? 'Changing...' : 'Change Password'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* Member Galleries */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Image className="w-5 h-5 mr-2 text-primary-600" />
                Galleries
              </h2>
              <Link
                to="/galleries"
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                View All
              </Link>
            </div>
            {galleries.length === 0 ? (
              <p className="text-gray-500 text-sm">No galleries available.</p>
            ) : (
              <div className="space-y-2">
                {galleries.slice(0, 3).map((gallery) => (
                  <Link
                    key={gallery.id}
                    to={`/galleries/${gallery.id}`}
                    className="block p-2 hover:bg-gray-50 rounded transition-colors"
                  >
                    <p className="font-medium text-gray-900 text-sm">{gallery.title}</p>
                    <p className="text-xs text-gray-500">
                      {gallery.photos.length} photos
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>

          {/* Member Magazines */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <BookOpen className="w-5 h-5 mr-2 text-primary-600" />
                Magazines
              </h2>
              <Link
                to="/magazines"
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                View All
              </Link>
            </div>
            {magazines.length === 0 ? (
              <p className="text-gray-500 text-sm">No magazines available.</p>
            ) : (
              <div className="space-y-2">
                {magazines.slice(0, 3).map((magazine) => (
                  <div key={magazine.id} className="p-2 hover:bg-gray-50 rounded transition-colors">
                    <p className="font-medium text-gray-900 text-sm">{magazine.title}</p>
                    <p className="text-xs text-gray-500">
                      {format(convertPSTToLocal(magazine.publishDate), 'MMM dd, yyyy')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

