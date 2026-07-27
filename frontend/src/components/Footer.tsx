import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { settingsAPI } from '../services/api';
import { Mail, Phone, MapPin, Star } from 'lucide-react';

export default function Footer() {
  const [facebookLink, setFacebookLink] = useState<string>('https://m.facebook.com/groups/1379146276699787/?ref=share&mibextid=wwXIfr');
  const [whatsappLink, setWhatsappLink] = useState<string>('https://chat.whatsapp.com/HzI914nVyvGIZwarXzWzlH');
  const [instagramLink, setInstagramLink] = useState<string>('');

  useEffect(() => {
    const fetchSocialLinks = async () => {
      try {
        const settings = await settingsAPI.getSettings();
        if (settings.facebookLink) setFacebookLink(settings.facebookLink);
        if (settings.whatsappLink) setWhatsappLink(settings.whatsappLink);
        if (settings.instagramLink) setInstagramLink(settings.instagramLink);
      } catch (error) {
        // Use default links if fetch fails
      }
    };
    fetchSocialLinks();
  }, []);

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
              Celebrating Bengali culture and fostering community connections across Orange County, Southern California, and the USA.
              Join us for events, festivals, and cultural celebrations throughout the year.
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4" />
                <span>info@sanhoti.org</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4" />
                <span>+1 949-378-6425</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4" />
                <span>23 Calle Alamitos, RSM, CA 92688</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold">EIN:</span>
                <span>39-2903777</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/events" className="hover:text-white transition-colors">
                  Events
                </Link>
              </li>
              <li>
                <Link to="/durga-puja" className="hover:text-white transition-colors">
                  Durga Puja in Orange County
                </Link>
              </li>
              <li>
                <Link to="/festivals" className="hover:text-white transition-colors">
                  Bengali Festivals
                </Link>
              </li>
              <li>
                <Link to="/bengali-concerts" className="hover:text-white transition-colors">
                  Bengali Concerts
                </Link>
              </li>
              <li>
                <Link to="/become-our-sponsor" className="hover:text-white transition-colors">
                  Become a Sponsor
                </Link>
              </li>
              <li>
                <Link to="/corporate-partnerships" className="hover:text-white transition-colors">
                  Corporate Partnerships & CSR
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
                  href={facebookLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                  </svg>
                  <span>Join our Facebook Page</span>
                </a>
              </li>
              <li>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  <span>Join us in WhatsApp</span>
                </a>
              </li>
              {instagramLink && (
                <li>
                  <a
                    href={instagramLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    <span>Follow us on Instagram</span>
                  </a>
                </li>
              )}
              <li>
                <a
                  href="https://g.page/r/CUvBja7zNmgjEBM/review"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 hover:text-white transition-colors"
                >
                  <Star className="w-4 h-4" />
                  <span>Review us on Google</span>
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

