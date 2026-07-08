import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Mail, User, Phone, MessageSquare, Send } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { contactAPI } from '../services/api';
import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import Seo from '../components/Seo';

interface ContactForm {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  message: string;
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

export default function Contact() {
  const { isAuthenticated, user } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<ContactForm>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      message: '',
    },
  });

  // Pre-populate form if user is logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      setValue('firstName', user.firstName || '');
      setValue('lastName', user.lastName || '');
      setValue('email', user.email || '');
      setValue('phone', user.phone || '');
    }
  }, [isAuthenticated, user, setValue]);

  const onSubmit = async (data: ContactForm) => {
    setLoading(true);
    try {
      await contactAPI.sendMessage({
        first_name: data.firstName,
        last_name: data.lastName,
        email_address: data.email,
        phone_number: data.phone || undefined,
        message: data.message,
      });
      toast.success('Your message has been sent successfully!');
      reset({
        firstName: isAuthenticated && user ? (user.firstName || '') : '',
        lastName: isAuthenticated && user ? (user.lastName || '') : '',
        email: isAuthenticated && user ? (user.email || '') : '',
        phone: isAuthenticated && user ? (user.phone || '') : '',
        message: '',
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12 pb-32 px-4 sm:px-6 lg:px-8">
      <Seo
        title="Contact us | Sanhoti"
        description="Contact Sanhoti Bengali Association of Orange County & Southern California — questions about events, membership, volunteering, or partnerships."
        path="/contact"
      />
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Mail className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">Contact Us</h1>
          </div>
          <p className="text-2xl text-gray-600">
            We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-xl p-8"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First Name */}
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  Your First Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    {...register('firstName', {
                      required: 'First name is required',
                      maxLength: {
                        value: 20,
                        message: 'First name must be 20 characters or less',
                      },
                      pattern: {
                        value: /^[A-Za-z\s\-'\.]+$/,
                        message: 'First name cannot contain numbers or special characters',
                      },
                    })}
                    type="text"
                    id="firstName"
                    disabled={isAuthenticated}
                    className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                      isAuthenticated ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                    placeholder="Enter your first name"
                  />
                </div>
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Last Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    {...register('lastName', {
                      required: 'Last name is required',
                      maxLength: {
                        value: 20,
                        message: 'Last name must be 20 characters or less',
                      },
                      pattern: {
                        value: /^[A-Za-z\s\-'\.]+$/,
                        message: 'Last name cannot contain numbers or special characters',
                      },
                    })}
                    type="text"
                    id="lastName"
                    disabled={isAuthenticated}
                    className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                      isAuthenticated ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                    placeholder="Enter your last name"
                  />
                </div>
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  {...register('email', {
                    required: 'Email address is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  type="email"
                  id="email"
                  disabled={isAuthenticated}
                  className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    isAuthenticated ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  placeholder="Enter your email address"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number (Optional)
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  {...register('phone', {
                    pattern: {
                      value: /^[\d\s\-\+\(\)]+$/,
                      message: 'Please enter a valid phone number',
                    },
                    validate: (value) => {
                      if (!value) return true; // Optional field
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
                  disabled={isAuthenticated}
                  className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    isAuthenticated ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  placeholder="Enter your phone number"
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                )}
              </div>
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                Message *
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <textarea
                  {...register('message', {
                    required: 'Message is required',
                    maxLength: {
                      value: 500,
                      message: 'Message cannot exceed 500 characters',
                    },
                    validate: (value) => {
                      if (containsProfanity(value)) {
                        return 'Message contains inappropriate language. Please use appropriate language.';
                      }
                      return true;
                    },
                  })}
                  id="message"
                  rows={6}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter your message..."
                />
              </div>
              {errors.message && (
                <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

