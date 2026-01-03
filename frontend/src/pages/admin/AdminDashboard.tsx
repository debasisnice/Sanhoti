import { Routes, Route, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Calendar, Bell, Image, BookOpen, DollarSign, Mail, Settings, MessageSquare, Users, ClipboardList } from 'lucide-react';
import { useEffect, useState } from 'react';
import { eventsAPI, rsvpAPI, noticesAPI } from '../../services/api';
import { Event, RSVP } from '../../types';
import AdminEvents from './AdminEvents';
import AdminGalleries from './AdminGalleries';
import AdminMessages from './AdminMessages';
import AdminNotices from './AdminNotices';
import AdminRSVP from './AdminRSVP';
import AdminSettings from './AdminSettings';

export default function AdminDashboard() {
  const location = useLocation();
  const menuItems = [
    { icon: LayoutDashboard, label: 'Overview', path: '/admin' },
    { icon: Calendar, label: 'Events', path: '/admin/events' },
    { icon: Bell, label: 'Notices', path: '/admin/notices' },
    { icon: Image, label: 'Galleries', path: '/admin/galleries' },
    { icon: BookOpen, label: 'Magazines', path: '/admin/magazines' },
    { icon: MessageSquare, label: 'Messages', path: '/admin/messages' },
    { icon: ClipboardList, label: 'RSVP', path: '/admin/rsvps' },
    { icon: Mail, label: 'Email', path: '/admin/email' },
    { icon: Settings, label: 'Settings', path: '/admin/settings' },
  ];

  return (
    <div className="min-h-screen">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-lg min-h-screen">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Admin Panel</h2>
            <nav className="space-y-2">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path || 
                  (item.path !== '/admin' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'hover:bg-primary-50 hover:text-primary-600 text-gray-700'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <Routes>
            <Route path="/" element={<AdminOverview />} />
            <Route path="/events" element={<AdminEvents />} />
            <Route path="/notices" element={<AdminNotices />} />
            <Route path="/galleries" element={<AdminGalleries />} />
            <Route path="/magazines" element={<div>Magazines Management - Coming Soon</div>} />
            <Route path="/messages" element={<AdminMessages />} />
            <Route path="/rsvps" element={<AdminRSVP />} />
            <Route path="/email" element={<div>Email Management - Coming Soon</div>} />
            <Route path="/settings" element={<AdminSettings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function AdminOverview() {
  const [totalEvents, setTotalEvents] = useState<number>(0);
  const [activeNotices, setActiveNotices] = useState<number>(0);
  const [totalGalleries, setTotalGalleries] = useState<number>(0);
  const [totalAdults, setTotalAdults] = useState<number>(0);
  const [totalChildren, setTotalChildren] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch all data in parallel
        const [events, notices, galleryFolders] = await Promise.all([
          eventsAPI.getAll(),
          noticesAPI.getAll(),
          eventsAPI.getGalleryFolders(),
        ]);

        // Count active events only
        const activeEventsCount = events.filter((event: Event) => event.is_active === true).length;
        setTotalEvents(activeEventsCount);

        // Count active notices
        const activeNoticesCount = notices.filter((notice: any) => notice.is_active === true).length;
        setActiveNotices(activeNoticesCount);

        // Count published galleries only (gallery_is_public === true)
        const publishedGalleries = galleryFolders.filter((folder: any) => {
          // Only count folders that are published (public)
          return folder.event_id && folder.gallery_is_public === true;
        });
        setTotalGalleries(publishedGalleries.length);

        // Find priority event and fetch RSVPs
        const priorityEvent = events.find((e: Event) => e.is_priority === true);
        
        if (priorityEvent && priorityEvent.event_id) {
          try {
            // Fetch RSVPs for the priority event
            const rsvps = await rsvpAPI.getByEvent(priorityEvent.event_id);
            
            // Calculate total adults and children
            let adults = 0;
            let children = 0;
            
            rsvps.forEach((rsvp: RSVP) => {
              if (rsvp.status === 'confirmed') {
                // Handle both new format and legacy format
                if (rsvp.numberOfAdults !== undefined) {
                  adults += rsvp.numberOfAdults;
                  children += rsvp.numberOfChildren || 0;
                } else if (rsvp.numberOfGuests !== undefined) {
                  // Legacy format: assume all guests are adults
                  adults += rsvp.numberOfGuests;
                }
              }
            });
            
            setTotalAdults(adults);
            setTotalChildren(children);
          } catch (rsvpError) {
            console.error('Error fetching RSVPs:', rsvpError);
            setTotalAdults(0);
            setTotalChildren(0);
          }
        } else {
          // No priority event found
          setTotalAdults(0);
          setTotalChildren(0);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Manage your community website</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active Events</p>
              {loading ? (
                <p className="text-3xl font-bold text-gray-900">...</p>
              ) : (
                <p className="text-3xl font-bold text-gray-900">{totalEvents}</p>
              )}
            </div>
            <Calendar className="w-12 h-12 text-primary-600 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active Notices</p>
              {loading ? (
                <p className="text-3xl font-bold text-gray-900">...</p>
              ) : (
                <p className="text-3xl font-bold text-gray-900">{activeNotices}</p>
              )}
            </div>
            <Bell className="w-12 h-12 text-blue-600 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Published Galleries</p>
              {loading ? (
                <p className="text-3xl font-bold text-gray-900">...</p>
              ) : (
                <p className="text-3xl font-bold text-gray-900">{totalGalleries}</p>
              )}
            </div>
            <Image className="w-12 h-12 text-purple-600 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total RSVP</p>
              {loading ? (
                <p className="text-3xl font-bold text-gray-900">...</p>
              ) : (
                <p className="text-2xl font-bold text-gray-900">
                  {totalAdults} Adults | {totalChildren} Kids
                </p>
              )}
            </div>
            <Users className="w-12 h-12 text-green-600 opacity-50" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/admin/events?new=true"
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center"
          >
            <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">New Event</p>
          </Link>
          <Link
            to="/admin/notices?new=true"
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center"
          >
            <Bell className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">New Notice</p>
          </Link>
          <Link
            to="/admin/messages"
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center"
          >
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Messages</p>
          </Link>
          <Link
            to="/admin/email"
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center"
          >
            <Mail className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Send Email</p>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

