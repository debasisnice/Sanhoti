import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Users, Image, BookOpen, ArrowRight } from 'lucide-react';
import { eventsAPI } from '../services/api';
import { Event } from '../types';
import { format } from 'date-fns';

// Background slideshow images from /images/Slidshow/ folder
// Add your high-resolution images to frontend/public/images/Slidshow/ and update this array
const slideshowImages: string[] = [
  '/images/Slidshow/249627e4-33cb-4cf3-8db6-16f9b20a1faa.jpeg',
  '/images/Slidshow/celebration-1.jpg',
  '/images/Slidshow/community-together-1.jpg',
  '/images/Slidshow/cultural-event-1.jpg',
  '/images/Slidshow/e322dcab-dc90-43df-8a0f-87ad01bb6d72.jpeg',
];

export default function Home() {
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  useEffect(() => {
    eventsAPI.getUpcoming().then(setUpcomingEvents).catch(console.error);
  }, []);

  // Slideshow auto-advance
  useEffect(() => {
    if (slideshowImages.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slideshowImages.length);
    }, 8000); // Change slide every 8 seconds

    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: Calendar,
      title: 'Cultural Events',
      description: 'Join us for Poila Boishakh, Durga Puja, Diwali, and more',
      link: '/events',
      color: 'from-primary-500 to-primary-600',
    },
    {
      icon: Users,
      title: 'Community',
      description: 'Connect with Bengali families across the USA',
      link: '/register',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: Image,
      title: 'Photo Galleries',
      description: 'Relive memories from past events and celebrations',
      link: '/galleries',
      color: 'from-purple-500 to-purple-600',
    },
    {
      icon: BookOpen,
      title: 'Magazines',
      description: 'Read our community magazines and publications',
      link: '/magazines',
      color: 'from-green-500 to-green-600',
    },
  ];

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center text-white overflow-hidden">
        {/* Background Slideshow */}
        <div className="absolute inset-0 z-0">
          {/* Fallback gradient background if no images load */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 z-0"></div>
          {slideshowImages.length > 0 && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlideIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, ease: 'easeInOut' }}
                className="absolute inset-0 z-0"
              >
                <img
                  src={slideshowImages[currentSlideIndex]}
                  alt={`Slideshow ${currentSlideIndex + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error('Failed to load slideshow image:', slideshowImages[currentSlideIndex]);
                    e.currentTarget.style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log('Slideshow image loaded:', slideshowImages[currentSlideIndex]);
                  }}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </div>
        
        {/* Overlay for text readability - reduced opacity so images are visible */}
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-primary-900/50 via-primary-800/40 to-primary-900/50"></div>
        <div className="absolute inset-0 z-10 bg-black/30"></div>
        
        {/* Pattern overlay for texture */}
        <div 
          className="absolute inset-0 z-10 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat'
          }}
        ></div>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center px-4 max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="mb-6"
          >
            <img 
              src="/images/logo.png" 
              alt="সংহতি Bengali Community"
              className="mx-auto h-32 md:h-40 w-auto mb-4"
              onError={(e) => {
                // Fallback to text if image not found
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'block';
              }}
            />
            <h1 className="text-5xl md:text-7xl font-bold hidden">
              <span className="font-bengali block mb-2">সংহতি</span>
              <span className="block">Bengali Community</span>
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl mb-8 text-primary-100"
          >
            Celebrating Culture, Building Connections, Creating Memories
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/register"
              className="bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-50 transition-all transform hover:scale-105 shadow-xl"
            >
              Join Our Community
            </Link>
            <Link
              to="/events"
              className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white hover:text-primary-600 transition-all transform hover:scale-105"
            >
              View Events
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, repeat: Infinity, repeatType: 'reverse', duration: 2 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <div className="w-6 h-10 border-2 border-white rounded-full flex justify-center">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-1 h-3 bg-white rounded-full mt-2"
            />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">What We Offer</h2>
            <p className="text-xl text-gray-600">Everything you need to stay connected with the Bengali community</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-2"
              >
                <div className={`w-12 h-12 bg-gradient-to-r ${feature.color} rounded-lg flex items-center justify-center mb-4`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 mb-4">{feature.description}</p>
                <Link
                  to={feature.link}
                  className="text-primary-600 font-medium flex items-center hover:text-primary-700"
                >
                  Learn more <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Events Section */}
      {upcomingEvents.length > 0 && (
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Upcoming Events</h2>
              <p className="text-xl text-gray-600">Don't miss out on our next celebration</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {upcomingEvents.slice(0, 3).map((event, index) => {
                const eventId = event.event_id || event.id || '';
                const eventName = event.event_name || event.title || 'Untitled Event';
                const eventDescription = event.event_description || event.description || '';
                const eventDate = event.event_start_dt || event.date || '';
                const eventYear = event.year || new Date(eventDate).getFullYear();
                
                return (
                  <motion.div
                    key={eventId}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1, duration: 0.6 }}
                    className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                        {eventYear}
                      </span>
                      <span className="text-primary-700 font-semibold">
                        {format(new Date(eventDate), 'MMM dd')}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{eventName}</h3>
                    <p className="text-gray-600 mb-4 line-clamp-2">{eventDescription}</p>
                    <Link
                      to={`/events/${eventId}`}
                      className="text-primary-600 font-medium flex items-center hover:text-primary-700"
                    >
                      View Details <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="text-center mt-8"
            >
              <Link
                to="/events"
                className="inline-block bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                View All Events
              </Link>
            </motion.div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold mb-4"
          >
            Join Our Community Today
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl mb-8 text-primary-100"
          >
            Be part of a vibrant Bengali community celebrating culture, traditions, and togetherness.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <Link
              to="/register"
              className="inline-block bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-50 transition-all transform hover:scale-105 shadow-xl"
            >
              Become a Member
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

