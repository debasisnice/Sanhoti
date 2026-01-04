import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, UserCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { eventsAPI, rsvpAPI } from '../../services/api';
import { Event, RSVP } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface EventRSVPData {
  event: Event;
  rsvps: RSVP[];
  totalAdults: number;
  totalChildren: number;
  totalGuests: number;
}

export default function AdminRSVP() {
  const [, setEvents] = useState<Event[]>([]);
  const [eventRSVPData, setEventRSVPData] = useState<EventRSVPData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const allEvents = await eventsAPI.getAll();
      // Filter to show only active events
      const activeEvents = allEvents.filter(e => e.is_active === true);
      setEvents(activeEvents);

      // Fetch RSVPs for each event
      const rsvpDataPromises = activeEvents.map(async (event) => {
        try {
          const rsvps = await rsvpAPI.getByEvent(event.event_id);
          
          // Calculate totals
          let totalAdults = 0;
          let totalChildren = 0;
          let totalGuests = 0;

          rsvps.forEach((rsvp: RSVP) => {
            if (rsvp.status === 'confirmed') {
              if (rsvp.numberOfAdults !== undefined) {
                totalAdults += rsvp.numberOfAdults;
                totalChildren += rsvp.numberOfChildren || 0;
                totalGuests += rsvp.numberOfAdults + (rsvp.numberOfChildren || 0);
              } else if (rsvp.numberOfGuests !== undefined) {
                // Legacy format
                totalGuests += rsvp.numberOfGuests;
                totalAdults += rsvp.numberOfGuests; // Assume all are adults for legacy
              }
            }
          });

          return {
            event,
            rsvps: rsvps.filter((r: RSVP) => r.status === 'confirmed'),
            totalAdults,
            totalChildren,
            totalGuests,
          };
        } catch (error) {
          console.error(`Error fetching RSVPs for event ${event.event_id}:`, error);
          return {
            event,
            rsvps: [],
            totalAdults: 0,
            totalChildren: 0,
            totalGuests: 0,
          };
        }
      });

      const rsvpData = await Promise.all(rsvpDataPromises);
      // Sort by event start date descending (newest first)
      rsvpData.sort((a, b) => {
        const dateA = new Date(a.event.event_start_dt).getTime();
        const dateB = new Date(b.event.event_start_dt).getTime();
        return dateB - dateA;
      });
      setEventRSVPData(rsvpData);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch RSVP data');
    } finally {
      setLoading(false);
    }
  };

  const toggleEvent = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">RSVP Management</h1>
        <p className="text-gray-600">View event-wise RSVP details</p>
      </div>

      {eventRSVPData.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <UserCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No RSVPs found for any events.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {eventRSVPData.map((data) => {
            const isExpanded = expandedEvents.has(data.event.event_id);
            return (
              <div
                key={data.event.event_id}
                className="bg-white rounded-xl shadow-lg overflow-hidden"
              >
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleEvent(data.event.event_id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-5 h-5 text-primary-600" />
                        <h3 className="text-xl font-bold text-gray-900">
                          {data.event.event_name}
                        </h3>
                        {data.event.is_priority && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                            Priority
                          </span>
                        )}
                      </div>
                      <div className="ml-8 text-sm text-gray-600">
                        <p>
                          {format(new Date(data.event.event_start_dt), 'MMMM dd, yyyy')}
                          {data.event.event_end_dt !== data.event.event_start_dt && (
                            <> - {format(new Date(data.event.event_end_dt), 'MMMM dd, yyyy')}</>
                          )}
                        </p>
                        {data.event.location && (
                          <p className="mt-1">{data.event.location}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total RSVPs</p>
                        <p className="text-2xl font-bold text-primary-600">
                          {data.rsvps.length}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total Guests</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {data.totalGuests}
                        </p>
                      </div>
                      <div className="text-right border-l pl-6">
                        <p className="text-sm text-gray-600">Adults | Kids</p>
                        <p className="text-xl font-bold text-gray-900">
                          {data.totalAdults} | {data.totalChildren}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-gray-50">
                    <div className="p-6">
                      {data.rsvps.length === 0 ? (
                        <p className="text-gray-600 text-center py-4">
                          No confirmed RSVPs for this event.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-gray-900 mb-4">
                            RSVP Details ({data.rsvps.length})
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Name
                                  </th>
                                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Email
                                  </th>
                                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    Phone
                                  </th>
                                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                                    Adults
                                  </th>
                                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                                    Kids
                                  </th>
                                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                                    Total
                                  </th>
                                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    RSVP Date
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.rsvps.map((rsvp) => {
                                  const adults = rsvp.numberOfAdults ?? rsvp.numberOfGuests ?? 0;
                                  const children = rsvp.numberOfChildren ?? 0;
                                  const total = adults + children;
                                  return (
                                    <tr
                                      key={rsvp.id}
                                      className="border-b border-gray-100 hover:bg-white transition-colors"
                                    >
                                      <td className="py-3 px-4 text-sm text-gray-900">
                                        {rsvp.name}
                                      </td>
                                      <td className="py-3 px-4 text-sm text-gray-600">
                                        {rsvp.email}
                                      </td>
                                      <td className="py-3 px-4 text-sm text-gray-600">
                                        {rsvp.phone || '-'}
                                      </td>
                                      <td className="py-3 px-4 text-sm text-center text-gray-900">
                                        {adults}
                                      </td>
                                      <td className="py-3 px-4 text-sm text-center text-gray-900">
                                        {children}
                                      </td>
                                      <td className="py-3 px-4 text-sm text-center font-semibold text-gray-900">
                                        {total}
                                      </td>
                                      <td className="py-3 px-4 text-sm text-gray-600">
                                        {format(
                                          new Date(rsvp.createdAt || ''),
                                          'MMM dd, yyyy'
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

