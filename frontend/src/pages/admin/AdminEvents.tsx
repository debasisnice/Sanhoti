import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye, EyeOff, X, Image as ImageIcon, Star } from 'lucide-react';
import { eventsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { convertPSTToLocal, convertLocalToPST } from '../../utils/dateUtils';

interface Event {
  event_id: string;
  event_name: string;
  event_start_dt: string;
  event_end_dt: string;
  year: number;
  event_description: string;
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
  location: string;
  is_priority?: boolean;
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
  const [formData, setFormData] = useState<EventForm>({
    event_name: '',
    event_start_dt: '',
    event_end_dt: '',
    year: new Date().getFullYear(),
    event_description: '',
    location: '',
    is_priority: false,
    rsvp_link: '',
  });

  useEffect(() => {
    fetchEvents();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that end date is not before start date
    if (formData.event_start_dt && formData.event_end_dt) {
      const startDate = convertPSTToLocal(formData.event_start_dt);
      const endDate = convertPSTToLocal(formData.event_end_dt);
      
      if (endDate < startDate) {
        toast.error('End date cannot be prior to start date');
        return;
      }
    }
    
    try {
      // Convert dates from local timezone to PST before sending to backend
      const formDataWithPST = {
        ...formData,
        event_start_dt: formData.event_start_dt ? convertLocalToPST(formData.event_start_dt) : formData.event_start_dt,
        event_end_dt: formData.event_end_dt ? convertLocalToPST(formData.event_end_dt) : formData.event_end_dt,
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
    setFormData({
      event_name: event.event_name,
      event_start_dt: event.event_start_dt.split('T')[0],
      event_end_dt: event.event_end_dt.split('T')[0],
      year: event.year,
      event_description: event.event_description,
      location: (event as any).location || '',
      is_priority: event.is_priority || false,
      rsvp_link: (event as any).rsvp_link || '',
    });
    
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

  const resetForm = () => {
    setFormData({
      event_name: '',
      event_start_dt: '',
      event_end_dt: '',
      year: new Date().getFullYear(),
      event_description: '',
      location: '',
      is_priority: false,
      rsvp_link: '',
    });
    setEditingEvent(null);
    setSelectedImage(null);
  };

  const formatDate = (dateString: string) => {
    return convertPSTToLocal(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
                    {formData.event_start_dt && formData.event_end_dt && convertPSTToLocal(formData.event_end_dt) < convertPSTToLocal(formData.event_start_dt) && (
                      <p className="mt-1 text-sm text-red-600">End date cannot be prior to start date</p>
                    )}
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

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_priority"
                    checked={formData.is_priority || false}
                    onChange={(e) => setFormData({ ...formData, is_priority: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="is_priority" className="text-sm font-medium text-gray-700">
                    Mark as Priority Event
                  </label>
                  <span className="text-xs text-gray-500">
                    (Only one event can be priority at a time)
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
                <th className="w-[25%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Name
                </th>
                <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Start Date
                </th>
                <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  End Date
                </th>
                <th className="w-[8%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Year
                </th>
                <th className="w-[18%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="w-[15%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {selectedYear 
                      ? `No events found for ${selectedYear}. Click "Add Event" to create a new event.`
                      : 'No events found. Click "Add Event" to create your first event.'}
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => (
                  <tr key={event.event_id} className="hover:bg-gray-50">
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
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 align-top">
                      {formatDate(event.event_start_dt)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 align-top">
                      {formatDate(event.event_end_dt)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 align-top">
                      {event.year}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 align-top break-words">
                      {(event as any).location || '-'}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                          event.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {event.is_active ? 'Active' : 'Inactive'}
                      </span>
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
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}

