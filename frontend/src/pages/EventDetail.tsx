import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ArrowLeft } from 'lucide-react';
import { eventsAPI } from '../services/api';
import { Event } from '../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [eventImage, setEventImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      const fetchEventAndImage = async () => {
        try {
          const fetchedEvent = await eventsAPI.getById(id);
          setEvent(fetchedEvent);
          
          // Fetch event image if event has event_image_path
          if (fetchedEvent.event_id && fetchedEvent.event_image_path) {
            try {
              const imageData = await eventsAPI.getImagePublic(fetchedEvent.event_id);
              if (imageData) {
                const imageUrl = eventsAPI.getImageUrl(fetchedEvent.event_id, imageData.filename);
                setEventImage(imageUrl);
              }
            } catch (error) {
              // Silently fail if no images are found - image is optional
              console.log('No event image found');
            }
          }
        } catch (err) {
          console.error(err);
          toast.error('Failed to load event');
        } finally {
          setLoading(false);
        }
      };
      
      fetchEventAndImage();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Event not found</h2>
          <Link to="/events" className="text-primary-600 hover:text-primary-700">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 pb-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          to="/events"
          className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Events
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg overflow-hidden"
        >
          {(() => {
            const eventId = event.event_id || event.id || '';
            const eventName = event.event_name || event.title || 'Untitled Event';
            const eventDescription = event.event_description || event.description || '';
            const eventDate = event.event_start_dt || event.date || '';
            const eventLocation = event.location || '';
            // Use event image from Events_Flyers if available, otherwise use fallback
            const displayImage = eventImage || event.photo_gallery_link || event.imageUrl;
            const eventYear = event.year || new Date(eventDate).getFullYear();

            return (
              <>
                {displayImage && (
                  <div className="h-64 md:h-96 bg-gradient-to-br from-primary-400 to-primary-600 relative overflow-hidden flex items-center justify-center">
                    <img
                      src={displayImage}
                      alt={eventName}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        // If image fails to load, hide it and show gradient background
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                <div className="p-8">
                  <div className="flex items-center justify-between mb-4">
                    <span className="bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-medium">
                      {eventYear}
                    </span>
                  </div>

                  <h1 className="text-4xl font-bold text-gray-900 mb-6">{eventName}</h1>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="flex items-center text-gray-700">
                      <Calendar className="w-5 h-5 mr-3 text-primary-600" />
                      <div>
                        <p className="text-sm text-gray-500">Start Date</p>
                        <p className="font-semibold">{format(new Date(eventDate), 'MMMM dd, yyyy')}</p>
                      </div>
                    </div>
                    {event.event_end_dt && (
                      <div className="flex items-center text-gray-700">
                        <Calendar className="w-5 h-5 mr-3 text-primary-600" />
                        <div>
                          <p className="text-sm text-gray-500">End Date</p>
                          <p className="font-semibold">{format(new Date(event.event_end_dt), 'MMMM dd, yyyy')}</p>
                        </div>
                      </div>
                    )}
                    {eventLocation && (
                      <div className="flex items-center text-gray-700">
                        <MapPin className="w-5 h-5 mr-3 text-primary-600" />
                        <div>
                          <p className="text-sm text-gray-500">Location</p>
                          <p className="font-semibold">{eventLocation}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="prose max-w-none mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">About This Event</h2>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {eventDescription}
                    </p>
                  </div>

                  {/* Only show RSVP option for upcoming events */}
                  {(() => {
                    const now = new Date();
                    const eventEndDate = event.event_end_dt ? new Date(event.event_end_dt) : new Date(eventDate);
                    const isPastEvent = eventEndDate < now;
                    
                    if (!isPastEvent) {
                      return (
                        <Link
                          to={`/events/${eventId}/rsvp`}
                          className="inline-block bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                        >
                          RSVP for This Event
                        </Link>
                      );
                    }
                    return null;
                  })()}
                </div>
              </>
            );
          })()}
        </motion.div>
      </div>
    </div>
  );
}

