import { Routes, Route, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Calendar, Bell, Image, BookOpen, Mail, Settings, MessageSquare, Users, ClipboardList, Menu, X, FileText, FileCheck, Newspaper, HelpCircle, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { eventsAPI, rsvpAPI, noticesAPI, subEventsAPI } from '../../services/api';
import { Event, RSVP, SubEvent } from '../../types';
import AdminEvents from './AdminEvents';
import AdminGalleries from './AdminGalleries';
import AdminMessages from './AdminMessages';
import AdminNotices from './AdminNotices';
import AdminRSVP from './AdminRSVP';
import AdminSettings from './AdminSettings';
import AdminMagazines from './AdminMagazines';
import AdminNews from './AdminNews';
import AdminDocuments from './AdminDocuments';
import AdminEmail from './AdminEmail';
import AdminAuditLogs from './AdminAuditLogs';
import AdminUserManual from './AdminUserManual';
import AdminDurgaPuja from './AdminDurgaPuja';

export default function AdminDashboard() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuItems = [
    { icon: LayoutDashboard, label: 'Overview', path: '/admin' },
    { icon: Calendar, label: 'Events', path: '/admin/events' },
    { icon: Sparkles, label: 'Durga Puja Page', path: '/admin/durga-puja' },
    { icon: Bell, label: 'Notices', path: '/admin/notices' },
    { icon: Image, label: 'Galleries', path: '/admin/galleries' },
    { icon: BookOpen, label: 'Magazines', path: '/admin/magazines' },
    { icon: Newspaper, label: 'Media', path: '/admin/news' },
    { icon: FileText, label: 'Documents', path: '/admin/documents' },
    { icon: MessageSquare, label: 'Messages', path: '/admin/messages' },
    { icon: ClipboardList, label: 'RSVP', path: '/admin/rsvps' },
    { icon: Mail, label: 'Email', path: '/admin/email' },
    { icon: Settings, label: 'Settings', path: '/admin/settings' },
    { icon: FileCheck, label: 'Audit Logs', path: '/admin/audit-logs' },
    { icon: HelpCircle, label: 'User Manual', path: '/admin/user-manual' },
  ];

  return (
    <div className="min-h-screen">
      <div className="flex">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden fixed top-20 left-4 z-50 p-2 bg-white rounded-lg shadow-lg text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Sidebar */}
        <aside className={`w-64 bg-white shadow-lg min-h-screen fixed md:static z-40 transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>
          <div className="p-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Admin Panel</h2>
            <nav className="space-y-1">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path || 
                  (item.path !== '/admin' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
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

        {/* Mobile Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
            />
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 w-full md:w-auto">
          <Routes>
            <Route path="/" element={<AdminOverview />} />
            <Route path="/events" element={<AdminEvents />} />
            <Route path="/durga-puja" element={<AdminDurgaPuja />} />
            <Route path="/notices" element={<AdminNotices />} />
            <Route path="/galleries" element={<AdminGalleries />} />
            <Route path="/magazines" element={<AdminMagazines />} />
            <Route path="/news" element={<AdminNews />} />
            <Route path="/documents" element={<AdminDocuments />} />
            <Route path="/messages" element={<AdminMessages />} />
            <Route path="/rsvps" element={<AdminRSVP />} />
            <Route path="/email" element={<AdminEmail />} />
            <Route path="/settings" element={<AdminSettings />} />
            <Route path="/audit-logs" element={<AdminAuditLogs />} />
            <Route path="/user-manual" element={<AdminUserManual />} />
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

        // Fetch all RSVPs from all events and sub-events
        try {
          // Fetch all active events and sub-events
          const activeEvents = events.filter((e: Event) => e.is_active === true);
          const allSubEvents = await subEventsAPI.getAll();
          const activeSubEvents = allSubEvents.filter((se: SubEvent) => se.rsvp_enabled === true);

          // Fetch RSVPs for all events
          const eventRSVPsPromises = activeEvents.map(async (event: Event) => {
            try {
              return await rsvpAPI.getByEvent(event.event_id);
            } catch (error) {
              console.error(`Error fetching RSVPs for event ${event.event_id}:`, error);
              return [];
            }
          });

          // Fetch RSVPs for all sub-events
          const subEventRSVPsPromises = activeSubEvents.map(async (subEvent: SubEvent) => {
            try {
              return await rsvpAPI.getBySubEvent(subEvent.sub_event_id);
            } catch (error) {
              console.error(`Error fetching RSVPs for sub-event ${subEvent.sub_event_id}:`, error);
              return [];
            }
          });

          // Wait for all RSVP fetches to complete
          const [eventRSVPsArrays, subEventRSVPsArrays] = await Promise.all([
            Promise.all(eventRSVPsPromises),
            Promise.all(subEventRSVPsPromises),
          ]);

          // Flatten and calculate totals
          let adults = 0;
          let children = 0;

          // Sum RSVPs from events
          eventRSVPsArrays.forEach((rsvps: RSVP[]) => {
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
          });

          // Sum RSVPs from sub-events
          subEventRSVPsArrays.forEach((rsvps: RSVP[]) => {
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
          });

          setTotalAdults(adults);
          setTotalChildren(children);
        } catch (rsvpError) {
          console.error('Error fetching RSVPs:', rsvpError);
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

