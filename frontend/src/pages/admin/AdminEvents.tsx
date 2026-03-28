import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye, EyeOff, X, Image as ImageIcon, Star } from 'lucide-react';
import { eventsAPI, subEventsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { convertPSTToLocal, convertLocalToPST } from '../../utils/dateUtils';
import { SubEvent } from '../../types';

const EVENT_TYPE_OPTIONS = ['Festival', 'Charity', 'Other'] as const;
type EventTypeValue = typeof EVENT_TYPE_OPTIONS[number];

interface Event {
  event_id: string;
  event_name: string;
  event_start_dt: string;
  event_end_dt: string;
  year: number;
  event_description: string;
  event_type?: EventTypeValue;
  is_active: boolean;
  is_priority?: boolean;
  created_at: string;
  updated_at: string;
  photo_gallery_link?: string;
}

interface EventForm {
  event_name: string;
  event_start_dt: string;
  event_end_dt: string;
  year: number;
  event_description: string;
  event_type: EventTypeValue;
  location: string;
  is_priority?: boolean;
  rsvp_enabled: boolean;
  rsvp_link?: string;
}

interface EventImage {
  filename: string;
  url: string;
}

export default function AdminEvents() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [hasUserSelectedYear, setHasUserSelectedYear] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [eventImages, setEventImages] = useState<Record<string, EventImage[]>>({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [subEvents, setSubEvents] = useState<Record<string, SubEvent[]>>({});
  const [showSubEventForm, setShowSubEventForm] = useState(false);
  const [editingSubEvent, setEditingSubEvent] = useState<SubEvent | null>(null);
  const [selectedEventForSubEvent, setSelectedEventForSubEvent] = useState<Event | null>(null);
  const [subEventImage, setSubEventImage] = useState<File | null>(null);
  const [uploadingSubEventImage, setUploadingSubEventImage] = useState(false);
  const [subEventFormData, setSubEventFormData] = useState({
    sub_event_name: '',
    sub_event_start_dt: '',
    sub_event_end_dt: '',
    event_description: '',
    location: '',
    is_active: true,
    rsvp_link: '',
    rsvp_enabled: false,
    show_in_home_page: false,
  });
  const [subEventStartTime, setSubEventStartTime] = useState('');
  const [subEventEndTime, setSubEventEndTime] = useState('');
  const [formData, setFormData] = useState<EventForm>({
    event_name: '',
    event_start_dt: '',
    event_end_dt: '',
    year: new Date().getFullYear(),
    event_description: '',
    event_type: 'Festival',
    location: '',
    is_priority: false,
    rsvp_enabled: false,
    rsvp_link: '',
  });
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');

  useEffect(() => {
    fetchEvents();
    fetchAllSubEvents();
  }, []);

  const fetchAllSubEvents = async () => {
    try {
      const allSubEvents = await subEventsAPI.getAll();
      const subEventsByEvent: Record<string, SubEvent[]> = {};
      allSubEvents.forEach(subEvent => {
        if (!subEventsByEvent[subEvent.event_id]) {
          subEventsByEvent[subEvent.event_id] = [];
        }
        subEventsByEvent[subEvent.event_id].push(subEvent);
      });
      setSubEvents(subEventsByEvent);
    } catch (error: any) {
      // Silently fail - sub-events are optional
    }
  };

  useEffect(() => {
    // Check if 'new' query parameter is present to auto-open form
    const shouldOpenForm = searchParams.get('new') === 'true';
    if (shouldOpenForm) {
      setShowForm(true);
      // Remove the query parameter from URL after opening the form
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Set selected year to current year or most recent year with events
    // Only auto-select on initial load, not when user explicitly selects "All Years"
    if (events.length > 0 && selectedYear === null && !hasUserSelectedYear) {
      const years = [...new Set(events.map(e => e.year))].sort((a, b) => b - a);
      const currentYear = new Date().getFullYear();
      setSelectedYear(years.includes(currentYear) ? currentYear : years[0]);
      setHasUserSelectedYear(true); // Mark that we've done initial selection
    }
  }, [events, selectedYear, hasUserSelectedYear]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const allEvents = await eventsAPI.getAll();
      setEvents(allEvents);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  // Get unique years from events, sorted descending
  const availableYears = [...new Set(events.map(e => e.year))].sort((a, b) => b - a);

  // Filter events by selected year and sort by start date descending (newest first)
  const filteredEvents = (selectedYear 
    ? events.filter(e => e.year === selectedYear)
    : events
  ).sort((a, b) => {
    const dateA = convertPSTToLocal(a.event_start_dt).getTime();
    const dateB = convertPSTToLocal(b.event_start_dt).getTime();
    return dateB - dateA; // Descending order (newest first)
  });

  // Helper function to combine date and time into ISO string
  const combineDateAndTime = (date: string, time: string): string => {
    if (!date) return '';
    if (!time) return date; // If no time provided, return just the date
    
    // Combine date and time: "2025-07-19" + "14:30" = "2025-07-19T14:30:00"
    return `${date}T${time}:00`;
  };

  // Helper function to parse datetime string and extract date and time
  const parseDateTime = (datetime: string): { date: string; time: string } => {
    if (!datetime) return { date: '', time: '' };
    
    // Check if it's date-only format (YYYY-MM-DD)
    const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (dateOnlyPattern.test(datetime)) {
      return { date: datetime, time: '' };
    }
    
    // Parse ISO datetime string (YYYY-MM-DDTHH:mm:ss or YYYY-MM-DDTHH:mm)
    const parts = datetime.split('T');
    const date = parts[0];
    const timePart = parts[1] || '';
    
    // Extract time (HH:mm) from time part (could be "14:30:00" or "14:30")
    const timeMatch = timePart.match(/^(\d{2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : '';
    
    return { date, time };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Combine date and time
    const startDateTime = combineDateAndTime(formData.event_start_dt, eventStartTime);
    const endDateTime = combineDateAndTime(formData.event_end_dt, eventEndTime);
    
    // Validate that end date/time is not before start date/time
    if (startDateTime && endDateTime) {
      const startDate = new Date(startDateTime);
      const endDate = new Date(endDateTime);
      
      if (endDate < startDate) {
        toast.error('End date/time cannot be prior to start date/time');
        return;
      }
    }
    
    try {
      // Combine date and time into ISO format strings
      // For datetime strings with time, we send them directly (backend can parse ISO strings)
      // For date-only strings, we use convertLocalToPST
      const getPSTDateTime = (dateTime: string): string => {
        if (!dateTime) return '';
        // If it's a datetime string (contains T), send as-is (will be treated as local time, backend will handle)
        // If it's date-only, use convertLocalToPST
        if (dateTime.includes('T')) {
          return dateTime;
        }
        return convertLocalToPST(dateTime);
      };
      
      const formDataWithPST = {
        ...formData,
        event_start_dt: startDateTime ? getPSTDateTime(startDateTime) : formData.event_start_dt,
        event_end_dt: endDateTime ? getPSTDateTime(endDateTime) : formData.event_end_dt,
      };
      
      let savedEvent: Event;
      if (editingEvent) {
        savedEvent = await eventsAPI.update(editingEvent.event_id, formDataWithPST);
        toast.success('Event updated successfully');
      } else {
        savedEvent = await eventsAPI.create(formDataWithPST);
        toast.success('Event created successfully');
      }

      // Upload image if selected
      if (selectedImage && savedEvent.event_id) {
        try {
          setUploadingImage(true);
          await eventsAPI.uploadImage(savedEvent.event_id, selectedImage);
          toast.success('Event image uploaded successfully');
        } catch (error: any) {
          toast.error(error.response?.data?.error || 'Failed to upload image');
        } finally {
          setUploadingImage(false);
        }
      }

      setShowForm(false);
      setEditingEvent(null);
      resetForm();
      fetchEvents();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save event');
    }
  };

  const handleEdit = async (event: Event) => {
    setEditingEvent(event);
    
    // Parse datetime strings to extract date and time separately
    const startDateTime = parseDateTime(event.event_start_dt);
    const endDateTime = parseDateTime(event.event_end_dt);
    
    setFormData({
      event_name: event.event_name,
      event_start_dt: startDateTime.date,
      event_end_dt: endDateTime.date,
      year: event.year,
      event_description: event.event_description,
      event_type: event.event_type && EVENT_TYPE_OPTIONS.includes(event.event_type as EventTypeValue) ? (event.event_type as EventTypeValue) : 'Festival',
      location: (event as any).location || '',
      is_priority: event.is_priority || false,
      rsvp_enabled: (event as any).rsvp_enabled ?? false,
      rsvp_link: (event as any).rsvp_link || '',
    });
    
    // Set the time fields
    setEventStartTime(startDateTime.time);
    setEventEndTime(endDateTime.time);
    
    // Load existing images for this event
    if (event.event_id) {
      try {
        const images = await eventsAPI.getImages(event.event_id);
        setEventImages({ ...eventImages, [event.event_id]: images });
      } catch (error) {
        console.error('Error loading event images:', error);
      }
    }
    
    setSelectedImage(null);
    setShowForm(true);
  };

  const handleDeactivate = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to deactivate this event?')) {
      return;
    }
    try {
      await eventsAPI.deactivate(eventId);
      toast.success('Event deactivated successfully');
      fetchEvents();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to deactivate event');
    }
  };

  const handleActivate = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to activate this event for public visibility?')) {
      return;
    }
    try {
      await eventsAPI.activate(eventId);
      toast.success('Event activated successfully');
      fetchEvents();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to activate event');
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return;
    }
    try {
      await eventsAPI.delete(eventId);
      toast.success('Event deleted successfully');
      fetchEvents();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete event');
    }
  };

  const handleNavigateToGallery = (eventId: string) => {
    navigate(`/admin/galleries?eventId=${eventId}`);
  };

  const handleCreateSubEvent = (event: Event) => {
    setSelectedEventForSubEvent(event);
    setEditingSubEvent(null);
    
    // Parse datetime strings to extract date
    const startDateTime = parseDateTime(event.event_start_dt);
    const endDateTime = parseDateTime(event.event_end_dt);
    
    setSubEventFormData({
      sub_event_name: '',
      sub_event_start_dt: startDateTime.date,
      sub_event_end_dt: endDateTime.date,
      event_description: '',
      location: '',
      is_active: true,
      rsvp_link: '',
      rsvp_enabled: false,
      show_in_home_page: false,
    });
    setSubEventStartTime('');
    setSubEventEndTime('');
    setSubEventImage(null);
    setShowSubEventForm(true);
  };

  const handleEditSubEvent = async (subEvent: SubEvent, event: Event) => {
    setSelectedEventForSubEvent(event);
    setEditingSubEvent(subEvent);
    
    // Parse datetime strings to extract date and time
    const startDateTime = parseDateTime(subEvent.sub_event_start_dt);
    const endDateTime = parseDateTime(subEvent.sub_event_end_dt);
    
    setSubEventFormData({
      sub_event_name: subEvent.sub_event_name,
      sub_event_start_dt: startDateTime.date,
      sub_event_end_dt: endDateTime.date,
      event_description: subEvent.event_description,
      location: subEvent.location,
      is_active: subEvent.is_active,
      rsvp_link: subEvent.rsvp_link || '',
      rsvp_enabled: subEvent.rsvp_enabled || false,
      show_in_home_page: subEvent.show_in_home_page || false,
    });
    setSubEventStartTime(startDateTime.time);
    setSubEventEndTime(endDateTime.time);
    setSubEventImage(null);
    setShowSubEventForm(true);
  };

  const handleDeleteSubEvent = async (subEventId: string) => {
    if (!window.confirm('Are you sure you want to delete this sub-event? This action cannot be undone.')) {
      return;
    }
    try {
      await subEventsAPI.delete(subEventId);
      toast.success('Sub-event deleted successfully');
      fetchAllSubEvents();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete sub-event');
    }
  };

  const handleSubEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForSubEvent) return;

    try {
      setUploadingSubEventImage(false);
      
      // Combine date and time
      const startDateTime = combineDateAndTime(subEventFormData.sub_event_start_dt, subEventStartTime);
      const endDateTime = combineDateAndTime(subEventFormData.sub_event_end_dt, subEventEndTime);
      
      // Helper to get PST datetime
      const getPSTDateTime = (dateTime: string): string => {
        if (!dateTime) return '';
        if (dateTime.includes('T')) {
          return dateTime;
        }
        return convertLocalToPST(dateTime);
      };
      
      if (editingSubEvent) {
        // Update existing sub-event
        const updateData: any = {
          sub_event_name: subEventFormData.sub_event_name,
          sub_event_start_dt: startDateTime ? getPSTDateTime(startDateTime) : convertLocalToPST(subEventFormData.sub_event_start_dt),
          sub_event_end_dt: endDateTime ? getPSTDateTime(endDateTime) : convertLocalToPST(subEventFormData.sub_event_end_dt),
          event_description: subEventFormData.event_description,
          location: subEventFormData.location,
          is_active: subEventFormData.is_active,
          rsvp_enabled: subEventFormData.rsvp_enabled,
          show_in_home_page: subEventFormData.show_in_home_page,
        };
        
        // Handle rsvp_link: set to null if empty to remove it, otherwise set to the value
        if (subEventFormData.rsvp_link && subEventFormData.rsvp_link.trim() !== '') {
          updateData.rsvp_link = subEventFormData.rsvp_link.trim();
        } else {
          updateData.rsvp_link = null;
        }
        
        await subEventsAPI.update(editingSubEvent.sub_event_id, updateData);
        
        // Upload image if selected
        if (subEventImage) {
          setUploadingSubEventImage(true);
          try {
            await subEventsAPI.uploadImage(editingSubEvent.sub_event_id, subEventImage);
            toast.success('Sub-event image uploaded successfully');
          } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to upload image');
          } finally {
            setUploadingSubEventImage(false);
          }
        }
        
        toast.success('Sub-event updated successfully');
      } else {
        // Create new sub-event
        const newSubEvent = await subEventsAPI.create({
          sub_event_name: subEventFormData.sub_event_name,
          sub_event_start_dt: startDateTime ? getPSTDateTime(startDateTime) : convertLocalToPST(subEventFormData.sub_event_start_dt),
          sub_event_end_dt: endDateTime ? getPSTDateTime(endDateTime) : convertLocalToPST(subEventFormData.sub_event_end_dt),
          year: selectedEventForSubEvent.year,
          event_description: subEventFormData.event_description,
          location: subEventFormData.location,
          is_active: subEventFormData.is_active,
          event_id: selectedEventForSubEvent.event_id,
          rsvp_link: subEventFormData.rsvp_link || undefined,
          rsvp_enabled: subEventFormData.rsvp_enabled,
          show_in_home_page: subEventFormData.show_in_home_page,
        });
        
        // Upload image if selected
        if (subEventImage) {
          setUploadingSubEventImage(true);
          try {
            await subEventsAPI.uploadImage(newSubEvent.sub_event_id, subEventImage);
            toast.success('Sub-event image uploaded successfully');
          } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to upload image');
          } finally {
            setUploadingSubEventImage(false);
          }
        }
        
        toast.success('Sub-event created successfully');
      }
      
      fetchAllSubEvents();
      setShowSubEventForm(false);
      resetSubEventForm();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save sub-event');
    }
  };

  const resetSubEventForm = () => {
    setSubEventFormData({
      sub_event_name: '',
      sub_event_start_dt: '',
      sub_event_end_dt: '',
      event_description: '',
      location: '',
      is_active: true,
      rsvp_link: '',
      rsvp_enabled: false,
      show_in_home_page: false,
    });
    setSubEventStartTime('');
    setSubEventEndTime('');
    setEditingSubEvent(null);
    setSelectedEventForSubEvent(null);
    setSubEventImage(null);
  };

  const resetForm = () => {
    setFormData({
      event_name: '',
      event_start_dt: '',
      event_end_dt: '',
      year: new Date().getFullYear(),
      event_description: '',
      event_type: 'Festival',
      location: '',
      is_priority: false,
      rsvp_enabled: false,
      rsvp_link: '',
    });
    setEventStartTime('');
    setEventEndTime('');
    setEditingEvent(null);
    setSelectedImage(null);
  };

  const formatDate = (dateString: string) => {
    const date = convertPSTToLocal(dateString);
    const hasTime = dateString.includes('T') && !dateString.endsWith('T00:00:00');
    
    const dateOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    
    if (hasTime) {
      // Check if time is not midnight (00:00)
      const hours = date.getHours();
      const minutes = date.getMinutes();
      if (hours !== 0 || minutes !== 0) {
        return date.toLocaleDateString('en-US', dateOptions) + ' ' + 
               date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
    }
    
    return date.toLocaleDateString('en-US', dateOptions);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Events Management</h1>
          <p className="text-gray-600 mt-1">Manage all community events</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Event</span>
        </button>
      </div>

      {/* Year Pagination */}
      {availableYears.length > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700 mr-2">Filter by Year:</span>
            <button
              onClick={() => {
                setSelectedYear(null);
                setHasUserSelectedYear(true);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedYear === null
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Years
            </button>
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => {
                  setSelectedYear(year);
                  setHasUserSelectedYear(true);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedYear === year
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
          {selectedYear && (
            <div className="mt-3 text-sm text-gray-600">
              Showing {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} for {selectedYear}
            </div>
          )}
        </div>
      )}

      {/* Event Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingEvent ? 'Edit Event' : 'Add New Event'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.event_name}
                    onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter event name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Type
                  </label>
                  <select
                    value={formData.event_type}
                    onChange={(e) => setFormData({ ...formData, event_type: e.target.value as EventTypeValue })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {EVENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.event_start_dt}
                      onChange={(e) => setFormData({ ...formData, event_start_dt: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time (Optional)
                    </label>
                    <input
                      type="time"
                      value={eventStartTime}
                      onChange={(e) => setEventStartTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={formData.event_start_dt || undefined}
                      value={formData.event_end_dt}
                      onChange={(e) => {
                        const endDate = e.target.value;
                        // Validate that end date is not before start date
                        if (formData.event_start_dt && endDate < formData.event_start_dt) {
                          toast.error('End date cannot be prior to start date');
                          return;
                        }
                        setFormData({ ...formData, event_end_dt: endDate });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time (Optional)
                    </label>
                    <input
                      type="time"
                      value={eventEndTime}
                      onChange={(e) => setEventEndTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Year *
                  </label>
                  <input
                    type="number"
                    required
                    min="2020"
                    max="2100"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Description *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.event_description}
                    onChange={(e) => setFormData({ ...formData, event_description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter event description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter event location"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="rsvp_enabled"
                    checked={formData.rsvp_enabled}
                    onChange={(e) => setFormData({ ...formData, rsvp_enabled: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="rsvp_enabled" className="text-sm font-medium text-gray-700">
                    Enable RSVP
                  </label>
                  <span className="text-xs text-gray-500">
                    (If checked, RSVP option will be shown for this event)
                  </span>
                </div>

                {formData.rsvp_enabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      RSVP Link (Optional)
                    </label>
                    <input
                      type="url"
                      value={formData.rsvp_link || ''}
                      onChange={(e) => setFormData({ ...formData, rsvp_link: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="https://example.com/rsvp"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      If provided, clicking RSVP will open this link instead of the default RSVP form
                    </p>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_priority"
                    checked={formData.is_priority || false}
                    onChange={(e) => setFormData({ ...formData, is_priority: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="is_priority" className="text-sm font-medium text-gray-700">
                    Mark as priority for this event type
                  </label>
                  <span className="text-xs text-gray-500">
                    (One priority each for Festival, Charity, and Other — featured on Events and home)
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Image (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          toast.error('Image size must be less than 10MB');
                          return;
                        }
                        setSelectedImage(file);
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {editingEvent && eventImages[editingEvent.event_id] && eventImages[editingEvent.event_id].length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Current Image:</p>
                      <div className="flex items-center gap-2">
                        <img
                          src={eventsAPI.getImageUrl(editingEvent.event_id, eventImages[editingEvent.event_id][0].filename)}
                          alt="Current event image"
                          className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                        />
                        <p className="text-sm text-gray-500">
                          Upload a new image to replace the current one
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedImage && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Selected Image:</p>
                      <img
                        src={URL.createObjectURL(selectedImage)}
                        alt="Selected image preview"
                        className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingImage}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingImage ? 'Uploading...' : editingEvent ? 'Update Event' : 'Create Event'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Events List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="inline-block min-w-full align-middle px-4 md:px-0">
            <table className="w-full min-w-[800px] md:min-w-0">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Name
                </th>
                <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Start Date
                </th>
                <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  End Date
                </th>
                <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sub Events
                </th>
                <th className="w-[15%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    {selectedYear 
                      ? `No events found for ${selectedYear}. Click "Add Event" to create a new event.`
                      : 'No events found. Click "Add Event" to create your first event.'}
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => {
                  const eventSubEvents = subEvents[event.event_id] || [];
                  return (
                    <tr 
                      key={event.event_id} 
                      className={`hover:bg-gray-50 ${event.is_active ? 'bg-green-50' : ''}`}
                    >
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-bold text-red-900 break-words">{event.event_name}</div>
                          {event.is_priority && (
                            <Star 
                              className="w-5 h-5 text-yellow-500 fill-yellow-500 flex-shrink-0" 
                            />
                          )}
                        </div>
                        <div className="text-sm text-gray-500 break-words mt-1">
                          {event.event_description}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Year: {event.year}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 align-top">
                        {formatDate(event.event_start_dt)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 align-top">
                        {formatDate(event.event_end_dt)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 align-top break-words">
                        {(event as any).location || '-'}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col gap-2">
                          {eventSubEvents.map((subEvent) => (
                            <div
                              key={subEvent.sub_event_id}
                              onClick={() => handleEditSubEvent(subEvent, event)}
                              className="bg-blue-50 border border-blue-200 rounded-lg p-2 cursor-pointer hover:bg-blue-100 transition-colors"
                            >
                              <div className="text-xs font-semibold text-blue-900">{subEvent.sub_event_name}</div>
                              <div className="text-xs text-blue-700 mt-1">
                                {formatDate(subEvent.sub_event_start_dt)} - {formatDate(subEvent.sub_event_end_dt)}
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() => handleCreateSubEvent(event)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mt-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Sub Event
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-medium align-top">
                        <div className="flex items-center justify-end space-x-2 flex-wrap gap-2">
                          <button
                            onClick={() => handleNavigateToGallery(event.event_id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Gallery"
                          >
                            <ImageIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleEdit(event)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Edit"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          {event.is_active ? (
                            <button
                              onClick={() => handleDeactivate(event.event_id)}
                              className="text-yellow-600 hover:text-yellow-900"
                              title="Deactivate"
                            >
                              <EyeOff className="w-5 h-5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivate(event.event_id)}
                              className="text-green-600 hover:text-green-900"
                              title="Activate"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(event.event_id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Sub-Event Form Modal */}
      <AnimatePresence>
        {showSubEventForm && selectedEventForSubEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingSubEvent ? 'Edit Sub-Event' : 'Create Sub-Event'}
                </h2>
                <button
                  onClick={() => {
                    setShowSubEventForm(false);
                    resetSubEventForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubEventSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sub-Event Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={subEventFormData.sub_event_name}
                    onChange={(e) => setSubEventFormData({ ...subEventFormData, sub_event_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter sub-event name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={selectedEventForSubEvent.event_start_dt.split('T')[0]}
                      max={selectedEventForSubEvent.event_end_dt.split('T')[0]}
                      value={subEventFormData.sub_event_start_dt}
                      onChange={(e) => setSubEventFormData({ ...subEventFormData, sub_event_start_dt: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time (Optional)
                    </label>
                    <input
                      type="time"
                      value={subEventStartTime}
                      onChange={(e) => setSubEventStartTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={subEventFormData.sub_event_start_dt || selectedEventForSubEvent.event_start_dt.split('T')[0]}
                      max={selectedEventForSubEvent.event_end_dt.split('T')[0]}
                      value={subEventFormData.sub_event_end_dt}
                      onChange={(e) => setSubEventFormData({ ...subEventFormData, sub_event_end_dt: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time (Optional)
                    </label>
                    <input
                      type="time"
                      value={subEventEndTime}
                      onChange={(e) => setSubEventEndTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={subEventFormData.event_description}
                    onChange={(e) => setSubEventFormData({ ...subEventFormData, event_description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter sub-event description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={subEventFormData.location}
                    onChange={(e) => setSubEventFormData({ ...subEventFormData, location: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter location"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="sub_event_rsvp_enabled"
                    checked={subEventFormData.rsvp_enabled}
                    onChange={(e) => setSubEventFormData({ ...subEventFormData, rsvp_enabled: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="sub_event_rsvp_enabled" className="text-sm font-medium text-gray-700">
                    Enable RSVP
                  </label>
                  <span className="text-xs text-gray-500">
                    (If checked, users can RSVP for this sub-event)
                  </span>
                </div>

                {subEventFormData.rsvp_enabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      RSVP Link (Optional)
                    </label>
                    <input
                      type="url"
                      value={subEventFormData.rsvp_link}
                      onChange={(e) => setSubEventFormData({ ...subEventFormData, rsvp_link: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="https://example.com/rsvp"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      If provided, clicking RSVP will open this external link. If left empty, RSVP will be saved to the system.
                    </p>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="sub_event_show_in_home_page"
                    checked={subEventFormData.show_in_home_page}
                    onChange={(e) => setSubEventFormData({ ...subEventFormData, show_in_home_page: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="sub_event_show_in_home_page" className="text-sm font-medium text-gray-700">
                    Show in Home Page
                  </label>
                  <span className="text-xs text-gray-500">
                    (If checked, this sub-event will be shown on the home page below the priority event)
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="sub_event_is_active"
                    checked={subEventFormData.is_active}
                    onChange={(e) => setSubEventFormData({ ...subEventFormData, is_active: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="sub_event_is_active" className="text-sm font-medium text-gray-700">
                    Active
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sub-Event Image (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 20 * 1024 * 1024) {
                          toast.error('Image size must be less than 20MB');
                          return;
                        }
                        setSubEventImage(file);
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {subEventImage && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Selected Image:</p>
                      <img
                        src={URL.createObjectURL(subEventImage)}
                        alt="Selected image preview"
                        className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  {editingSubEvent && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to delete this sub-event?')) {
                          await handleDeleteSubEvent(editingSubEvent.sub_event_id);
                          setShowSubEventForm(false);
                          resetSubEventForm();
                        }
                      }}
                      className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowSubEventForm(false);
                      resetSubEventForm();
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingSubEventImage}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingSubEventImage ? 'Uploading...' : editingSubEvent ? 'Update Sub-Event' : 'Create Sub-Event'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

