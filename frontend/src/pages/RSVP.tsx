import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle } from 'lucide-react';
import { eventsAPI, rsvpAPI, subEventsAPI } from '../services/api';
import { Event, SubEvent } from '../types';
import { format } from 'date-fns';
import { convertPSTToLocal } from '../utils/dateUtils';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

interface RSVPForm {
  name: string;
  email: string;
  phone: string;
  numberOfAdults: number;
  numberOfChildren: number;
  attendeeNames: string[]; // Names of all attendees
}

// Simple profanity filter - common inappropriate words
const profanityWords = [
  'damn', 'hell', 'crap', 'bitch', 'bastard', 'ass', 'piss', 'fuck', 'shit',
  // Add more if needed - keeping it minimal for basic filtering
];

function containsProfanity(text: string): boolean {
  const lowerText = text.toLowerCase();
  return profanityWords.some(word => lowerText.includes(word));
}

export default function RSVP() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const [event, setEvent] = useState<Event | null>(null);
  const [subEvent, setSubEvent] = useState<SubEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<RSVPForm>({
    defaultValues: {
      numberOfAdults: 0,
      numberOfChildren: 0,
      attendeeNames: [],
    },
  });

  const numberOfAdults = watch('numberOfAdults', 0);
  const numberOfChildren = watch('numberOfChildren', 0);
  const totalAttendees = (numberOfAdults || 0) + (numberOfChildren || 0);

  useEffect(() => {
    if (id) {
      // Check if URL path contains 'sub-events' to determine which to fetch
      const isSubEvent = location.pathname.includes('/sub-events/');
      
      if (isSubEvent) {
        // Fetch sub-event
        subEventsAPI
          .getById(id)
          .then((subEventData) => {
            setSubEvent(subEventData);
            setEvent(null);
            setLoading(false);
          })
          .catch((err) => {
            console.error(err);
            toast.error('Failed to load sub-event');
            setLoading(false);
          });
      } else {
        // Fetch event
        eventsAPI
          .getById(id)
          .then((eventData) => {
            setEvent(eventData);
            setSubEvent(null);
            setLoading(false);
          })
          .catch((err) => {
            console.error(err);
            toast.error('Failed to load event');
            setLoading(false);
          });
      }
    }
  }, [id, location.pathname]);

  useEffect(() => {
    if (isAuthenticated && user) {
      setValue('name', `${user.firstName} ${user.lastName}`);
      setValue('email', user.email);
      if (user.phone) {
        setValue('phone', user.phone);
      }
    }
  }, [isAuthenticated, user, setValue]);

  // Update attendeeNames array when total attendees changes
  useEffect(() => {
    const currentNames = watch('attendeeNames') || [];
    const newLength = totalAttendees;
    
    if (currentNames.length < newLength) {
      // Add empty strings for new attendees
      const newNames = [...currentNames, ...Array(newLength - currentNames.length).fill('')];
      setValue('attendeeNames', newNames);
    } else if (currentNames.length > newLength) {
      // Remove excess names
      const newNames = currentNames.slice(0, newLength);
      setValue('attendeeNames', newNames);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalAttendees, setValue]);

  const onSubmit = async (data: RSVPForm) => {
    if (!id) return;

    setSubmitting(true);
    try {
      // Validate that at least one attendee is entered
      if (totalAttendees === 0) {
        toast.error('At least one attendee must be entered');
        setSubmitting(false);
        return;
      }

      // Filter out empty names and ensure all names are provided
      const attendeeNames = (data.attendeeNames || []).filter(name => name.trim() !== '');
      if (attendeeNames.length !== totalAttendees) {
        toast.error('Please provide names for all attendees');
        setSubmitting(false);
        return;
      }

      // Check for duplicate names (case-insensitive, trimmed)
      const nameMap = new Map<string, number>();
      for (let i = 0; i < attendeeNames.length; i++) {
        const trimmedName = attendeeNames[i].trim().toLowerCase();
        if (nameMap.has(trimmedName)) {
          toast.error('All attendee names must be unique. Please use different names for each attendee.');
          setSubmitting(false);
          return;
        }
        nameMap.set(trimmedName, i);
      }

      const rsvpData: any = {
        name: data.name,
        email: data.email,
        phone: data.phone.trim(),
        numberOfAdults: data.numberOfAdults,
        numberOfChildren: data.numberOfChildren,
        attendeeNames: attendeeNames,
      };
      
      // Include eventId or subEventId based on which type it is
      if (subEvent) {
        rsvpData.subEventId = id;
      } else {
        rsvpData.eventId = id;
      }
      
      await rsvpAPI.create(rsvpData);
      toast.success('RSVP submitted successfully!');
      
      // Navigate back to event detail page
      if (event) {
        navigate(`/events/${id}`);
      } else if (subEvent) {
        // Get parent event ID from sub-event
        navigate(`/events/${subEvent.event_id}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit RSVP');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!event && !subEvent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Event/Sub-Event not found</h2>
        </div>
      </div>
    );
  }

  const displayName = event 
    ? (event.event_name || event.title || 'Event')
    : (subEvent?.sub_event_name || 'Sub-Event');
  const displayDate = event
    ? (event.event_start_dt || event.date || '')
    : (subEvent?.sub_event_start_dt || '');

  return (
    <div className="py-12 pb-32">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-8"
        >
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-8 h-8 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                RSVP for {event ? 'Event' : 'Sub-Event'}
              </h1>
            </div>
            <p className="text-2xl text-gray-600 mb-4">
              <span>
                <span className="font-semibold">{displayName}</span>
                <span className="mx-2">•</span>
                <span>{format(convertPSTToLocal(displayDate), 'MMMM dd, yyyy')}</span>
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                {...register('name', {
                  required: 'Name is required',
                  maxLength: {
                    value: 40,
                    message: 'Name must be 40 characters or less',
                  },
                  pattern: {
                    value: /^[A-Za-z\s\-'\.]+$/,
                    message: 'Name cannot contain numbers or special characters',
                  },
                  validate: (value) => {
                    if (containsProfanity(value)) {
                      return 'Name contains inappropriate language. Please use appropriate language.';
                    }
                    return true;
                  },
                })}
                type="text"
                id="name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter your full name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
                type="email"
                id="email"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                {...register('phone', {
                  required: 'Phone number is required',
                  pattern: {
                    value: /^[\d\s\-\+\(\)]+$/,
                    message: 'Please enter a valid phone number',
                  },
                  validate: (value) => {
                    // Remove all non-digit characters for validation
                    const digitsOnly = value.replace(/\D/g, '');
                    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
                      return 'Phone number must be between 10 and 15 digits';
                    }
                    return true;
                  },
                })}
                type="tel"
                id="phone"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter your phone number"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="adults" className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Adults *
                </label>
                <input
                  {...register('numberOfAdults', {
                    required: 'Number of adults is required',
                    min: { value: 0, message: 'Cannot be negative' },
                    valueAsNumber: true,
                  })}
                  type="number"
                  id="adults"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter number of adults"
                />
                {errors.numberOfAdults && (
                  <p className="mt-1 text-sm text-red-600">{errors.numberOfAdults.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="children" className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Children
                </label>
                <input
                  {...register('numberOfChildren', {
                    min: { value: 0, message: 'Cannot be negative' },
                    valueAsNumber: true,
                  })}
                  type="number"
                  id="children"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter number of children"
                />
                {errors.numberOfChildren && (
                  <p className="mt-1 text-sm text-red-600">{errors.numberOfChildren.message}</p>
                )}
              </div>
            </div>

            {totalAttendees > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attendee Names * (Enter name for each attendee)
                </label>
                <div className="space-y-3">
                  {Array.from({ length: totalAttendees }).map((_, index) => {
                    const label = index < numberOfAdults 
                      ? `Adult ${index + 1} Name *`
                      : `Child ${index - numberOfAdults + 1} Name *`;
                    return (
                      <div key={index}>
                        <input
                          {...register(`attendeeNames.${index}` as const, {
                            required: `${label} is required`,
                            maxLength: {
                              value: 40,
                              message: 'Name must be 40 characters or less',
                            },
                            pattern: {
                              value: /^[A-Za-z\s\-'\.]+$/,
                              message: 'Name cannot contain numbers or special characters',
                            },
                            validate: (value, formValues) => {
                              if (containsProfanity(value)) {
                                return 'Name contains inappropriate language. Please use appropriate language.';
                              }
                              // Check for duplicate names (case-insensitive, trimmed)
                              const allNames = formValues.attendeeNames || [];
                              const trimmedValue = value.trim().toLowerCase();
                              const duplicateIndex = allNames.findIndex((name: string, idx: number) => 
                                idx !== index && name && name.trim().toLowerCase() === trimmedValue
                              );
                              if (duplicateIndex !== -1) {
                                return 'This name is already entered. Please use a unique name for each attendee.';
                              }
                              return true;
                            },
                          })}
                          type="text"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder={label}
                        />
                        {errors.attendeeNames?.[index] && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.attendeeNames[index]?.message}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Confirm RSVP
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (event) {
                    navigate(`/events/${id}`);
                  } else if (subEvent) {
                    navigate(`/events/${subEvent.event_id}`);
                  }
                }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

