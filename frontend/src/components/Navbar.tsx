import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, User, LogOut, Mail, Phone, MapPin, ChevronDown, Shield } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authAPI, settingsAPI } from '../services/api';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { isAuthenticated, user, logout: logoutStore, isAdmin } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    authAPI.logout();
    logoutStore();
    navigate('/');
    setIsOpen(false);
    setIsUserMenuOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
          setIsUserMenuOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [navbarSettings, setNavbarSettings] = useState({
    home: true,
    sponsors: true,
    events: true,
    noticeBoard: true,
    galleries: true,
    magazines: true,
    contactUs: true,
    committee: true,
    donate: true,
    joinUs: true,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await settingsAPI.getSettings();
        if (settings && settings.navbar) {
          setNavbarSettings(settings.navbar);
        }
      } catch (error) {
        console.error('Failed to fetch navbar settings:', error);
        // Use default settings on error
      }
    };
    fetchSettings();
  }, []);

  const allNavLinks = [
    { path: '/', label: 'Home', key: 'home' as const },
    { path: '/sponsors', label: 'Sponsors', key: 'sponsors' as const },
    { path: '/events', label: 'Events', key: 'events' as const },
    { path: '/notices', label: 'Notice Board', key: 'noticeBoard' as const },
    { path: '/galleries', label: 'Galleries', key: 'galleries' as const },
    { path: '/magazines', label: 'Magazines', key: 'magazines' as const },
    { path: '/contact', label: 'Contact Us', key: 'contactUs' as const },
    { path: '/committee', label: 'Committee', key: 'committee' as const },
  ];

  // Filter nav links based on settings
  const navLinks = allNavLinks.filter(link => navbarSettings[link.key]);

  return (
    <nav className="relative shadow-lg sticky top-0 z-50 overflow-hidden">
      <div className="flex min-h-[6rem] relative">
        {/* Full-width red underline spanning both sections */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-primary-600 z-20"></div>
        {/* Left Section - Beige */}
        <div className="bg-amber-50 w-auto max-w-md relative pr-16">
          <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center space-x-4 lg:space-x-6">
            <Link to="/" className="flex items-center hover:opacity-90 transition-opacity">
              <img
                src="/images/logo.png"
                alt="সানহোটি Bengali Community"
                className="h-16 w-16 md:h-20 md:w-20 object-contain flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="flex flex-col justify-center hidden">
                <span className="text-lg md:text-xl font-bold font-bengali leading-tight">
                  সানহোটি
                </span>
                <span className="hidden sm:block text-xs font-medium opacity-90 leading-tight">
                  Bengali Community
                </span>
              </div>
            </Link>

            {/* Contact Information */}
            <div className="hidden lg:flex flex-col space-y-1.5 text-xs text-gray-800">
              <div className="flex items-center space-x-2">
                <Mail className="w-3 h-3 text-primary-600 flex-shrink-0" />
                <a href="mailto:info@sanhoti.org" className="hover:text-primary-600 transition-colors whitespace-nowrap">
                  info@sanhoti.org
                </a>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-3 h-3 text-primary-600 flex-shrink-0" />
                <a href="tel:+19493786425" className="hover:text-primary-600 transition-colors whitespace-nowrap">
                  +1 949-378-6425
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - Red with angled edge */}
        <div 
          className="bg-gradient-to-r from-primary-600 to-primary-700 text-white flex-1 flex items-center justify-end px-1 sm:px-2 lg:px-3 relative ml-[-2rem] pl-12"
          style={{
            clipPath: 'polygon(2rem 0, 100% 0, 100% 100%, 0 100%)'
          }}
        >
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-end">
            {navLinks.map((link, index) => {
              // Check if current path matches the link path
              const isActive = link.path === '/' 
                ? location.pathname === '/' 
                : location.pathname === link.path || location.pathname.startsWith(link.path + '/');
              
              return (
                <div key={link.path} className="flex items-center">
                  {index > 0 && (
                    <span className="mx-1 lg:mx-1.5 font-bold" style={{ color: '#8B0000' }}>|</span>
                  )}
                  <Link
                    to={link.path}
                    className={`hover:text-primary-200 transition-colors font-medium whitespace-nowrap text-base relative pb-1 ${
                      isActive ? 'border-b-2 border-white' : ''
                    }`}
                  >
                    {link.label}
                  </Link>
                </div>
              );
            })}
            
            {/* Donate and Join Us Buttons */}
            {navbarSettings.donate && (
              <Link
                to="/donate"
                className="bg-white text-primary-600 px-3 py-2 rounded-lg font-medium hover:bg-primary-50 transition-colors whitespace-nowrap text-base ml-3 lg:ml-4"
              >
                Donate
              </Link>
            )}
            {!isAuthenticated && navbarSettings.joinUs && (
              <Link
                to="/register"
                className="bg-white text-primary-600 px-3 py-2 rounded-lg font-medium hover:bg-primary-50 transition-colors whitespace-nowrap text-base ml-1"
              >
                Join Us
              </Link>
            )}

            {/* User Menu (if authenticated) */}
            {isAuthenticated && user ? (
              <div className="relative ml-3 lg:ml-4" ref={userMenuRef}>
                <button
                  ref={buttonRef}
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-1.5 hover:text-primary-200 transition-colors font-medium whitespace-nowrap px-2.5 py-2 rounded-lg hover:bg-primary-800 text-base"
                >
                  <User className="w-4 h-4" />
                  <span>{user.firstName || 'User'}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu - Attached to navbar */}
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl py-2 border border-gray-200 z-50"
                    >
                      <Link
                        to="/dashboard"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        <span>Profile</span>
                      </Link>
                      {isAdmin && (
                        <Link
                          to="/admin"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Shield className="w-4 h-4" />
                          <span>Admin Portal</span>
                        </Link>
                      )}
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={handleLogout}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                to="/login"
                className="hover:text-primary-200 transition-colors font-medium whitespace-nowrap text-base ml-3 lg:ml-4"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-white ml-auto"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-primary-700 border-t border-primary-600"
          >
            <div className="px-4 py-4 space-y-4">
              {navLinks.map((link) => {
                // Check if current path matches the link path
                const isActive = link.path === '/' 
                  ? location.pathname === '/' 
                  : location.pathname === link.path || location.pathname.startsWith(link.path + '/');
                
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsOpen(false)}
                    className={`block text-white hover:text-primary-200 transition-colors pb-1 ${
                      isActive ? 'border-b-2 border-white' : ''
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              
              {/* Donate and Join Us Buttons */}
              {navbarSettings.donate && (
                <Link
                  to="/donate"
                  onClick={() => setIsOpen(false)}
                  className="block bg-white text-primary-600 px-4 py-2 rounded-lg font-medium text-center"
                >
                  Donate
                </Link>
              )}
              {!isAuthenticated && navbarSettings.joinUs && (
                <Link
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  className="block bg-white text-primary-600 px-4 py-2 rounded-lg font-medium text-center"
                >
                  Join Us
                </Link>
              )}

              {/* User Menu (if authenticated) */}
              {isAuthenticated && user ? (
                <>
                  <div className="border-t border-primary-600 pt-4 mt-4">
                    <div className="text-sm font-medium text-primary-200 mb-2">
                      {user.firstName || 'User'}
                    </div>
                    <Link
                      to="/dashboard"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-2 py-2 text-white hover:text-primary-200 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>Profile</span>
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center space-x-2 py-2 text-white hover:text-primary-200 transition-colors"
                      >
                        <Shield className="w-4 h-4" />
                        <span>Admin Portal</span>
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 w-full text-left py-2 hover:text-primary-200 transition-colors text-red-200"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="block text-white hover:text-primary-200 transition-colors"
                >
                  Login
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

