import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Image, BookOpen, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { rsvpAPI, galleriesAPI, magazinesAPI } from '../services/api';
import { RSVP, PhotoGallery, Magazine } from '../types';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [myRSVPs, setMyRSVPs] = useState<RSVP[]>([]);
  const [galleries, setGalleries] = useState<PhotoGallery[]>([]);
  const [magazines, setMagazines] = useState<Magazine[]>([]);

  useEffect(() => {
    rsvpAPI.getMyRSVPs().then(setMyRSVPs).catch(console.error);
    galleriesAPI.getAll().then(setGalleries).catch(console.error);
    magazinesAPI.getAll().then(setMagazines).catch(console.error);
  }, []);

  return (
    <div className="py-12 pb-32">
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
                {myRSVPs.map((rsvp) => (
                  <div
                    key={rsvp.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">Event RSVP</h3>
                        <p className="text-sm text-gray-600">
                          {rsvp.numberOfGuests} {rsvp.numberOfGuests === 1 ? 'guest' : 'guests'}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          rsvp.status === 'confirmed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {rsvp.status}
                      </span>
                    </div>
                  </div>
                ))}
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
                      {format(new Date(magazine.publishDate), 'MMM dd, yyyy')}
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

