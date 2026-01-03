import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle } from 'lucide-react';
import { eventsAPI, rsvpAPI } from '../services/api';
import { Event } from '../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

interface RSVPForm {
  name: string;
  email: string;
  phone: string;
  numberOfAdults: number;
  numberOfChildren: number;
}

export default function RSVP() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<RSVPForm>({
    defaultValues: {
      numberOfAdults: 1,
      numberOfChildren: 0,
    },
  });

  useEffect(() => {
    if (id) {
      eventsAPI
        .getById(id)
        .then(setEvent)
        .catch((err) => {
          console.error(err);
          toast.error('Failed to load event');
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  useEffect(() => {
    if (isAuthenticated && user) {
      setValue('name', `${user.firstName} ${user.lastName}`);
      setValue('email', user.email);
      if (user.phone) {
        setValue('phone', user.phone);
      }
    }
  }, [isAuthenticated, user, setValue]);

  const onSubmit = async (data: RSVPForm) => {
    if (!id) return;

    setSubmitting(true);
    try {
      const rsvpData = {
        eventId: id,
        ...data,
        phone: data.phone.trim(),
      };
      
      await rsvpAPI.create(rsvpData);
      toast.success('RSVP submitted successfully!');
      navigate(`/events/${id}`);
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

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Event not found</h2>
        </div>
      </div>
    );
  }

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
              <h1 className="text-2xl font-bold text-gray-900">RSVP for Event</h1>
            </div>
            <p className="text-2xl text-gray-600 mb-4">
              {(() => {
                const eventName = event.event_name || event.title || 'Event';
                const eventDate = event.event_start_dt || event.date || '';
                return (
                  <span>
                    <span className="font-semibold">{eventName}</span>
                    <span className="mx-2">•</span>
                    <span>{format(new Date(eventDate), 'MMMM dd, yyyy')}</span>
                  </span>
                );
              })()}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                {...register('name', { required: 'Name is required' })}
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
                    min: { value: 1, message: 'At least 1 adult is required' },
                    valueAsNumber: true,
                  })}
                  type="number"
                  id="adults"
                  min="1"
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
                onClick={() => navigate(`/events/${id}`)}
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

