import { Routes, Route, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Calendar, Bell, Image, BookOpen, Mail, Settings, MessageSquare, ClipboardList, Menu, X, FileText, FileCheck, Newspaper, HelpCircle, Sparkles, Ticket, BarChart3, QrCode, ListChecks, Users, AlertCircle, Clock, TrendingUp, Mic2, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { eventsAPI, rsvpAPI, noticesAPI, subEventsAPI, messagesAPI, usersAPI, ticketingAPI, magazinesAPI, documentsAPI, newsAPI, auditAPI } from '../../services/api';
import { Event, RSVP, SubEvent, AuditLog } from '../../types';
import { formatDateWithTime } from '../../utils/dateUtils';
import { getEventDetailPath } from '../../utils/eventSlug';
import AdminEvents from './AdminEvents';
import AdminArtists from './AdminArtists';
import AdminBlogs from './AdminBlogs';
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
import AdminBookYourSeat from './AdminBookYourSeat';
import AdminTicketStats from './AdminTicketStats';
import AdminTicketBookings from './AdminTicketBookings';
import AdminScanQR from './AdminScanQR';

export default function AdminDashboard() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuGroups: { icon: LucideIcon; label: string; path: string }[][] = [
    [
      { icon: LayoutDashboard, label: 'Overview', path: '/admin' },
      { icon: Settings, label: 'Settings', path: '/admin/settings' },
    ],
    [
      { icon: Calendar, label: 'Events', path: '/admin/events' },
      { icon: Mic2, label: 'Artists', path: '/admin/artists' },
      { icon: Sparkles, label: 'Durga Puja Page', path: '/admin/durga-puja' },
      { icon: Ticket, label: 'Ticket Settings', path: '/admin/book-your-seat' },
      { icon: ListChecks, label: 'Ticket Bookings', path: '/admin/ticket-bookings' },
      { icon: BarChart3, label: 'Ticket Stats', path: '/admin/ticket-stats' },
      { icon: QrCode, label: 'Scan QR', path: '/admin/scan-qr' },
    ],
    [
      { icon: Bell, label: 'Notices', path: '/admin/notices' },
      { icon: Image, label: 'Galleries', path: '/admin/galleries' },
      { icon: BookOpen, label: 'Magazines', path: '/admin/magazines' },
      { icon: FileText, label: 'Blog', path: '/admin/blogs' },
      { icon: Newspaper, label: 'Media', path: '/admin/news' },
      { icon: FileText, label: 'Documents', path: '/admin/documents' },
    ],
    [
      { icon: MessageSquare, label: 'Messages', path: '/admin/messages' },
      { icon: ClipboardList, label: 'RSVP', path: '/admin/rsvps' },
      { icon: Mail, label: 'Email', path: '/admin/email' },
    ],
    [
      { icon: FileCheck, label: 'Audit Logs', path: '/admin/audit-logs' },
      { icon: HelpCircle, label: 'User Manual', path: '/admin/user-manual' },
    ],
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
              {menuGroups.map((group, groupIndex) => (
                <div key={groupIndex}>
                  {groupIndex > 0 && <hr className="my-3 border-gray-200" />}
                  {group.map(item => {
                    const isActive =
                      location.pathname === item.path ||
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
                </div>
              ))}
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
            <Route path="/artists" element={<AdminArtists />} />
            <Route path="/durga-puja" element={<AdminDurgaPuja />} />
            <Route path="/book-your-seat" element={<AdminBookYourSeat />} />
            <Route path="/ticket-bookings" element={<AdminTicketBookings />} />
            <Route path="/ticket-stats" element={<AdminTicketStats />} />
            <Route path="/scan-qr" element={<AdminScanQR />} />
            <Route path="/notices" element={<AdminNotices />} />
            <Route path="/galleries" element={<AdminGalleries />} />
            <Route path="/magazines" element={<AdminMagazines />} />
            <Route path="/blogs" element={<AdminBlogs />} />
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
  const [loading, setLoading] = useState(true);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [pastEventsCount, setPastEventsCount] = useState(0);
  const [activeNotices, setActiveNotices] = useState(0);
  const [publishedGalleries, setPublishedGalleries] = useState(0);
  const [totalAdults, setTotalAdults] = useState(0);
  const [totalChildren, setTotalChildren] = useState(0);
  const [confirmedRsvps, setConfirmedRsvps] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);
  const [unrespondedMessages, setUnrespondedMessages] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [pendingBookings, setPendingBookings] = useState(0);
  const [confirmedBookings, setConfirmedBookings] = useState(0);
  const [ticketRevenue, setTicketRevenue] = useState(0);
  const [magazineCount, setMagazineCount] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);
  const [newsCount, setNewsCount] = useState(0);
  const [recentAudit, setRecentAudit] = useState<AuditLog[]>([]);
  const [eventsStartingSoon, setEventsStartingSoon] = useState(0);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const now = Date.now();
        const weekMs = 7 * 24 * 60 * 60 * 1000;

        const [
          events,
          notices,
          galleryFolders,
          messages,
          users,
          bookings,
          magazines,
          documents,
          newsItems,
          auditLogs,
          allSubEvents,
        ] = await Promise.all([
          eventsAPI.getAll(),
          noticesAPI.getAll(),
          eventsAPI.getGalleryFolders(),
          messagesAPI.getAll().catch(() => []),
          usersAPI.getAll().catch(() => []),
          ticketingAPI.listBookings().catch(() => []),
          magazinesAPI.getAll().catch(() => []),
          documentsAPI.getAll().catch(() => []),
          newsAPI.getAll().catch(() => []),
          auditAPI.getRecent(8).catch(() => []),
          subEventsAPI.getAll().catch(() => []),
        ]);

        const activeEvents = events.filter((e: Event) => e.is_active === true);
        const upcoming = activeEvents
          .filter((e: Event) => new Date(e.event_end_dt || e.event_start_dt || 0).getTime() >= now)
          .sort(
            (a, b) =>
              new Date(a.event_start_dt || 0).getTime() - new Date(b.event_start_dt || 0).getTime()
          );
        const past = activeEvents.filter(
          (e: Event) => new Date(e.event_end_dt || e.event_start_dt || 0).getTime() < now
        );

        setUpcomingEvents(upcoming.slice(0, 6));
        setPastEventsCount(past.length);
        setEventsStartingSoon(
          upcoming.filter((e: Event) => {
            const start = new Date(e.event_start_dt || 0).getTime();
            return start >= now && start <= now + weekMs;
          }).length
        );

        setActiveNotices(notices.filter((n: { is_active?: boolean }) => n.is_active === true).length);
        setPublishedGalleries(
          galleryFolders.filter((f: { event_id?: string; gallery_is_public?: boolean }) =>
            f.event_id && f.gallery_is_public === true
          ).length
        );

        setTotalMessages(messages.length);
        setUnrespondedMessages(messages.filter((m: { responded?: boolean }) => !m.responded).length);

        setMemberCount(users.filter((u: { isActive?: boolean }) => u.isActive !== false).length);
        setAdminCount(users.filter((u: { role?: string }) => u.role === 'admin').length);

        setPendingBookings(bookings.filter(b => b.status === 'pending_payment').length);
        setConfirmedBookings(bookings.filter(b => b.status === 'confirmed').length);
        setTicketRevenue(
          bookings.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + (b.total || 0), 0)
        );

        setMagazineCount(magazines.length);
        setDocumentCount(documents.length);
        setNewsCount(newsItems.length);
        setRecentAudit(auditLogs);

        const activeSubEvents = allSubEvents.filter((se: SubEvent) => se.rsvp_enabled === true);

        const [eventRSVPsArrays, subEventRSVPsArrays] = await Promise.all([
          Promise.all(
            activeEvents.map(async (event: Event) => {
              try {
                return await rsvpAPI.getByEvent(event.event_id);
              } catch {
                return [];
              }
            })
          ),
          Promise.all(
            activeSubEvents.map(async (subEvent: SubEvent) => {
              try {
                return await rsvpAPI.getBySubEvent(subEvent.sub_event_id);
              } catch {
                return [];
              }
            })
          ),
        ]);

        let adults = 0;
        let children = 0;
        let rsvpResponses = 0;

        const tallyRsvps = (rsvps: RSVP[]) => {
          rsvps.forEach((rsvp: RSVP) => {
            if (rsvp.status !== 'confirmed') return;
            rsvpResponses += 1;
            if (rsvp.numberOfAdults !== undefined) {
              adults += rsvp.numberOfAdults;
              children += rsvp.numberOfChildren || 0;
            } else if (rsvp.numberOfGuests !== undefined) {
              adults += rsvp.numberOfGuests;
            }
          });
        };

        eventRSVPsArrays.forEach(tallyRsvps);
        subEventRSVPsArrays.forEach(tallyRsvps);

        setTotalAdults(adults);
        setTotalChildren(children);
        setConfirmedRsvps(rsvpResponses);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const statCard = (
    label: string,
    value: ReactNode,
    Icon: LucideIcon,
    iconClass: string,
    sub?: string
  ) => (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm">{label}</p>
          {loading ? (
            <p className="text-3xl font-bold text-gray-900">…</p>
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
            </>
          )}
        </div>
        <Icon className={`w-12 h-12 ${iconClass} opacity-50`} />
      </div>
    </div>
  );

  const attentionItems = [
    unrespondedMessages > 0 && {
      label: `${unrespondedMessages} unresponded message${unrespondedMessages === 1 ? '' : 's'}`,
      href: '/admin/messages',
      tone: 'amber',
    },
    pendingBookings > 0 && {
      label: `${pendingBookings} ticket booking${pendingBookings === 1 ? '' : 's'} awaiting payment`,
      href: '/admin/ticket-bookings',
      tone: 'orange',
    },
    eventsStartingSoon > 0 && {
      label: `${eventsStartingSoon} event${eventsStartingSoon === 1 ? '' : 's'} starting within 7 days`,
      href: '/admin/events',
      tone: 'blue',
    },
  ].filter(Boolean) as { label: string; href: string; tone: string }[];

  const toneStyles: Record<string, string> = {
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Community site overview and quick actions</p>
      </div>

      {!loading && attentionItems.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-amber-400">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-gray-900">Needs attention</h2>
          </div>
          <ul className="space-y-2">
            {attentionItems.map(item => (
              <li key={item.label}>
                <Link
                  to={item.href}
                  className={`block rounded-lg border px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity ${toneStyles[item.tone]}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {statCard('Upcoming Events', upcomingEvents.length, Calendar, 'text-primary-600', `${pastEventsCount} past`)}
        {statCard('Registered Members', memberCount, Users, 'text-green-600', `${adminCount} admin${adminCount === 1 ? '' : 's'}`)}
        {statCard('Confirmed RSVPs', confirmedRsvps, ClipboardList, 'text-emerald-600', `${totalAdults} adults · ${totalChildren} kids`)}
        {statCard(
          'Ticket Revenue',
          `$${ticketRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          Ticket,
          'text-violet-600',
          `${confirmedBookings} confirmed · ${pendingBookings} pending`
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Notices', value: activeNotices, icon: Bell, color: 'text-blue-600', href: '/admin/notices' },
          { label: 'Galleries', value: publishedGalleries, icon: Image, color: 'text-purple-600', href: '/admin/galleries' },
          { label: 'Messages', value: totalMessages, icon: MessageSquare, color: 'text-rose-600', href: '/admin/messages' },
          { label: 'Magazines', value: magazineCount, icon: BookOpen, color: 'text-indigo-600', href: '/admin/magazines' },
          { label: 'Documents', value: documentCount, icon: FileText, color: 'text-gray-600', href: '/admin/documents' },
          { label: 'Media', value: newsCount, icon: Newspaper, color: 'text-cyan-600', href: '/admin/news' },
        ].map(item => (
          <Link
            key={item.label}
            to={item.href}
            className="bg-white rounded-xl shadow p-4 hover:shadow-md transition-shadow"
          >
            <item.icon className={`w-6 h-6 ${item.color} mb-2`} />
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className="text-xl font-bold text-gray-900">{loading ? '…' : item.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              Upcoming events
            </h2>
            <Link to="/admin/events" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Manage all
            </Link>
          </div>
          {loading ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : upcomingEvents.length === 0 ? (
            <p className="text-gray-500 text-sm">No upcoming active events.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcomingEvents.map(event => (
                <li key={event.event_id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/admin/events"
                        className="font-semibold text-gray-900 hover:text-primary-600 truncate block"
                      >
                        {event.event_name}
                      </Link>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        {formatDateWithTime(event.event_start_dt || '')}
                      </p>
                      {event.location && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{event.location}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {event.event_type && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 font-medium">
                          {event.event_type}
                        </span>
                      )}
                      {event.rsvp_enabled && (
                        <span className="text-xs text-emerald-600 font-medium">RSVP on</span>
                      )}
                      <a
                        href={getEventDetailPath(event, event.event_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 hover:text-primary-600"
                      >
                        View public →
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary-600" />
              Recent admin activity
            </h2>
            <Link to="/admin/audit-logs" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              All logs
            </Link>
          </div>
          {loading ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : recentAudit.length === 0 ? (
            <p className="text-gray-500 text-sm">No recent activity.</p>
          ) : (
            <ul className="space-y-3">
              {recentAudit.map(log => (
                <li key={log.id} className="text-sm border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <p className="font-medium text-gray-900">
                    {log.action.replace(/_/g, ' ')}
                    <span className="text-gray-500 font-normal"> · {log.resource}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {log.userEmail} · {new Date(log.timestamp).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
            to="/admin/ticket-bookings"
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center"
          >
            <Ticket className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Bookings</p>
          </Link>
          <Link
            to="/admin/ticket-stats"
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center"
          >
            <BarChart3 className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Ticket Stats</p>
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

