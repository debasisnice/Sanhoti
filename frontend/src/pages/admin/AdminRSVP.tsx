import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, UserCheck, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { eventsAPI, rsvpAPI, subEventsAPI } from '../../services/api';
import { Event, RSVP, SubEvent } from '../../types';
import { format } from 'date-fns';
import { convertPSTToLocal } from '../../utils/dateUtils';
import toast from 'react-hot-toast';

interface EventRSVPData {
  event: Event;
  rsvps: RSVP[];
  totalAdults: number;
  totalChildren: number;
  totalGuests: number;
  isSubEvent?: boolean;
}

export default function AdminRSVP() {
  const [, setEvents] = useState<Event[]>([]);
  const [eventRSVPData, setEventRSVPData] = useState<EventRSVPData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [deletingRSVP, setDeletingRSVP] = useState<string | null>(null);

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

      // Fetch all sub-events
      const allSubEvents = await subEventsAPI.getAll();

      // Create a map of event IDs to event names for quick lookup
      const eventNameMap = new Map<string, string>();
      activeEvents.forEach(event => {
        eventNameMap.set(event.event_id, event.event_name);
      });

      // Fetch RSVPs for each event
      const eventRSVPDataPromises = activeEvents.map(async (event) => {
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
            isSubEvent: false,
          };
        } catch (error) {
          console.error(`Error fetching RSVPs for event ${event.event_id}:`, error);
          return {
            event,
            rsvps: [],
            totalAdults: 0,
            totalChildren: 0,
            totalGuests: 0,
            isSubEvent: false,
          };
        }
      });

      // Fetch RSVPs for each sub-event
      const subEventRSVPDataPromises = allSubEvents.map(async (subEvent) => {
        try {
          const rsvps = await rsvpAPI.getBySubEvent(subEvent.sub_event_id);
          
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

          // Get parent event name and format display name
          const parentEventName = eventNameMap.get(subEvent.event_id) || 'Unknown Event';
          const displayName = `${parentEventName} - ${subEvent.sub_event_name}`;

          return {
            event: {
              event_id: subEvent.sub_event_id,
              event_name: displayName,
              event_start_dt: subEvent.sub_event_start_dt,
              event_end_dt: subEvent.sub_event_end_dt,
              location: subEvent.location,
              is_priority: false,
              is_active: true,
              year: subEvent.year,
              event_description: subEvent.event_description,
              created_at: subEvent.created_at,
              updated_at: subEvent.updated_at,
            } as Event,
            rsvps: rsvps.filter((r: RSVP) => r.status === 'confirmed'),
            totalAdults,
            totalChildren,
            totalGuests,
            isSubEvent: true,
          };
        } catch (error) {
          console.error(`Error fetching RSVPs for sub-event ${subEvent.sub_event_id}:`, error);
          // Get parent event name and format display name for error case too
          const parentEventName = eventNameMap.get(subEvent.event_id) || 'Unknown Event';
          const displayName = `${parentEventName} - ${subEvent.sub_event_name}`;
          return {
            event: {
              event_id: subEvent.sub_event_id,
              event_name: displayName,
              event_start_dt: subEvent.sub_event_start_dt,
              event_end_dt: subEvent.sub_event_end_dt,
              location: subEvent.location,
              is_priority: false,
              is_active: true,
              year: subEvent.year,
              event_description: subEvent.event_description,
              created_at: subEvent.created_at,
              updated_at: subEvent.updated_at,
            } as Event,
            rsvps: [],
            totalAdults: 0,
            totalChildren: 0,
            totalGuests: 0,
            isSubEvent: true,
          };
        }
      });

      const [eventRSVPData, subEventRSVPData] = await Promise.all([
        Promise.all(eventRSVPDataPromises),
        Promise.all(subEventRSVPDataPromises),
      ]);

      // Combine event and sub-event RSVP data
      const allRSVPData = [...eventRSVPData, ...subEventRSVPData];
      
      // Sort by start date descending (newest first)
      allRSVPData.sort((a, b) => {
        const dateA = convertPSTToLocal(a.event.event_start_dt).getTime();
        const dateB = convertPSTToLocal(b.event.event_start_dt).getTime();
        return dateB - dateA;
      });
      setEventRSVPData(allRSVPData);
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

  const handleDeleteRSVP = async (rsvpId: string, eventId: string, isSubEvent: boolean = false) => {
    if (!window.confirm('Are you sure you want to delete this RSVP?')) {
      return;
    }

    setDeletingRSVP(rsvpId);
    try {
      await rsvpAPI.delete(rsvpId);
      toast.success('RSVP deleted successfully');
      
      // Refresh data for the specific event or sub-event
      const rsvps = isSubEvent 
        ? await rsvpAPI.getBySubEvent(eventId)
        : await rsvpAPI.getByEvent(eventId);
      
      // Recalculate totals
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
            totalGuests += rsvp.numberOfGuests;
            totalAdults += rsvp.numberOfGuests;
          }
        }
      });

      // Update state
      setEventRSVPData(prevData => 
        prevData.map(data => 
          data.event.event_id === eventId
            ? {
                ...data,
                rsvps: rsvps.filter((r: RSVP) => r.status === 'confirmed'),
                totalAdults,
                totalChildren,
                totalGuests,
              }
            : data
        )
      );
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete RSVP');
    } finally {
      setDeletingRSVP(null);
    }
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
                        {data.isSubEvent && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                            Sub-Event
                          </span>
                        )}
                        {data.event.is_priority && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                            Priority
                          </span>
                        )}
                      </div>
                      <div className="ml-8 text-sm text-gray-600">
                        <p>
                          {format(convertPSTToLocal(data.event.event_start_dt), 'MMMM dd, yyyy')}
                          {data.event.event_end_dt !== data.event.event_start_dt && (
                            <> - {format(convertPSTToLocal(data.event.event_end_dt), 'MMMM dd, yyyy')}</>
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
                                    Attendees
                                  </th>
                                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                    RSVP Date
                                  </th>
                                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                                    Actions
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
                                        {rsvp.attendeeNames && rsvp.attendeeNames.length > 0 ? (
                                          <div className="flex flex-col gap-1">
                                            {rsvp.attendeeNames.map((attendeeName, index) => (
                                              <span key={index} className="block">
                                                {attendeeName}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-4 text-sm text-gray-600">
                                        {format(
                                          convertPSTToLocal(rsvp.createdAt || ''),
                                          'MMM dd, yyyy'
                                        )}
                                      </td>
                                      <td className="py-3 px-4 text-center">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRSVP(rsvp.id, data.event.event_id, data.isSubEvent);
                                          }}
                                          disabled={deletingRSVP === rsvp.id}
                                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                          title="Delete RSVP"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
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

