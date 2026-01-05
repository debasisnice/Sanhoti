import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <img 
                src="/images/logo.png" 
                alt="Sanhoti (সংহতি) Bengali Association of Orange County"
                className="h-12 w-12 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <h3 className="text-2xl font-bold text-white">
                <span className="font-bengali">Sanhoti (সংহতি) Bengali Association of Orange County</span>
              </h3>
            </div>
            <p className="text-gray-400 mb-4">
              Celebrating Bengali culture and fostering community connections across the USA.
              Join us for events, festivals, and cultural celebrations throughout the year.
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4" />
                <span>info@sanhoti.org</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4" />
                <span>+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4" />
                <span>USA</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/events" className="hover:text-white transition-colors">
                  Events
                </Link>
              </li>
              <li>
                <Link to="/notices" className="hover:text-white transition-colors">
                  Notices
                </Link>
              </li>
              <li>
                <Link to="/galleries" className="hover:text-white transition-colors">
                  Galleries
                </Link>
              </li>
              <li>
                <Link to="/magazines" className="hover:text-white transition-colors">
                  Magazines
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Community</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://www.facebook.com/profile.php?id=61577899858876&mibextid=wwXIfr&mibextid=wwXIfr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Join our Facebook Page
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} Sanhoti (সংহতি) Bengali Association of Orange County. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

