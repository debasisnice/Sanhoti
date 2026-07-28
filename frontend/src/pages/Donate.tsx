import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, CreditCard, Mail } from 'lucide-react';
import { paymentQRAPI, settingsAPI } from '../services/api';
import Seo from '../components/Seo';
import PageHero from '../components/PageHero';
import PageContent from '../components/PageContent';
import StripeBuyButtonEmbed from '../components/StripeBuyButtonEmbed';

export default function Donate() {
  const [paymentQRImage, setPaymentQRImage] = useState<string | null>(null);
  const [zellePhoneNumber, setZellePhoneNumber] = useState<string>('');
  const [showStripeDonateButton, setShowStripeDonateButton] = useState(false);
  const [stripeBuyButtonId, setStripeBuyButtonId] = useState('');
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch payment QR image
        const hasImage = await paymentQRAPI.hasImage();
        if (hasImage.hasImage) {
          setPaymentQRImage(paymentQRAPI.getImageUrl());
        } else {
          setPaymentQRImage(null);
        }

        // Fetch Zelle phone number from settings
        const settings = await settingsAPI.getSettings();
        if (settings.zellePhoneNumber) {
          setZellePhoneNumber(settings.zellePhoneNumber);
        } else {
          setZellePhoneNumber('');
        }

        setShowStripeDonateButton(settings.showStripeDonateButton === true);
        setStripeBuyButtonId(settings.stripeBuyButtonId ?? '');
        setStripePublishableKey(settings.stripePublishableKey ?? '');
      } catch (error) {
        console.error('Failed to fetch payment data:', error);
        setPaymentQRImage(null);
        setZellePhoneNumber('');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  return (
    <div className="pb-32">
      <Seo
        title="Donate to Sanhoti | 501(c)(3) Non-Profit in Orange County, CA"
        description="Donate to Sanhoti Bengali Association — a 501(c)(3) non-profit in Orange County, California. Your gift funds cultural events, charity programs, and community services."
        path="/donate"
      />
      <PageHero
        icon={Heart}
        title="Donate to Sanhoti — 501(c)(3) Orange County, California"
        subtitle="Your tax-deductible gift funds Durga Puja, cultural programmes, charity drives, and youth education for the Bengali community across Orange County and Southern California."
      />
      <PageContent>
        <div className="space-y-8">
          {/* Main Donate Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg p-8"
          >
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              We warmly invite you to join Sanhoti in its ongoing volunteer and charitable efforts—every contribution, big or small, makes a difference. We call upon all well-wishers to stand with us in this meaningful journey. Together, we can build a brighter and more compassionate future for the generations to come. If you wish to support us financially, donations can be made online by card or through Zelle.
            </p>
          </motion.div>

          {/* Stripe Card Donation Section */}
          {!loading && showStripeDonateButton && stripeBuyButtonId && stripePublishableKey && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-xl shadow-lg p-8"
            >
              <div className="flex items-center mb-6">
                <div className="bg-primary-100 rounded-lg p-3 mr-4">
                  <CreditCard className="w-6 h-6 text-primary-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">Donate by Card</h2>
              </div>
              <p className="text-lg text-gray-700 leading-relaxed mb-6 text-center">
                Make a secure online donation with your credit or debit card.
              </p>
              <StripeBuyButtonEmbed
                buyButtonId={stripeBuyButtonId}
                publishableKey={stripePublishableKey}
              />
            </motion.div>
          )}

          {/* Zelle Donation Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-lg p-8"
          >
            <div className="flex items-center mb-6">
              <div className="bg-primary-100 rounded-lg p-3 mr-4">
                <CreditCard className="w-6 h-6 text-primary-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Zelle</h2>
            </div>
            
            <div className="bg-amber-50 rounded-lg p-6 mb-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
              ) : (paymentQRImage || zellePhoneNumber) ? (
                <>
                  <p className="text-lg text-gray-800 leading-relaxed mb-6 text-center">
                    You can donate to Sanhoti via Zelle. {paymentQRImage && 'Scan the QR code'} {paymentQRImage && zellePhoneNumber && 'or'} {zellePhoneNumber && 'use the phone number below'}:
                  </p>
                  
                  {/* QR Code Section */}
                  <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-6">
                    {paymentQRImage && (
                      <div className="bg-white rounded-lg p-6 shadow-md">
                        <img 
                          src={paymentQRImage} 
                          alt="Zelle QR Code - Send Money to Sanhoti"
                          className="w-64 h-64 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    
                    {zellePhoneNumber && (
                      <div className="text-center md:text-left">
                        <p className="text-sm text-gray-600 mb-2">Send Money with Zelle®</p>
                        <p className="text-lg font-semibold text-gray-900 mb-3">SANHOTI INC</p>
                        <div className="bg-white rounded-lg p-4 border-2 border-primary-200">
                          <div className="flex items-center justify-center md:justify-start">
                            <div>
                              <p className="text-sm text-gray-600 mb-1">Zelle Phone Number</p>
                              <p className="text-2xl font-bold text-primary-600">{zellePhoneNumber}</p>
                            </div>
                          </div>
                        </div>
                        {paymentQRImage && (
                          <p className="text-sm text-gray-600 mt-3">Scan in your banking app to pay</p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Payment information will be available here once configured by the administrator.</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Mail className="w-5 h-5 text-primary-600 mt-1 flex-shrink-0" />
                <p className="text-gray-700 leading-relaxed">
                  <strong>Important:</strong> Please include your email address in the memo section to receive a donation receipt.
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <CreditCard className="w-5 h-5 text-primary-600 mt-1 flex-shrink-0" />
                <p className="text-gray-700 leading-relaxed">
                  Zelle transactions are free of charge through participating banks.
                </p>
              </div>
            </div>
          </motion.div>

          {/* How to Use Zelle Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-8"
          >
            <h3 className="text-2xl font-bold text-gray-900 mb-4">How to Donate via Zelle</h3>
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Option 1: Using QR Code (Easiest)</h4>
              <ol className="space-y-3 text-gray-700 mb-6">
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold mr-3">1</span>
                  <span>Open your banking app that supports Zelle</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold mr-3">2</span>
                  <span>Look for "Scan QR Code" or "Pay with QR Code" option</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold mr-3">3</span>
                  <span>Scan the QR code above</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold mr-3">4</span>
                  <span>Enter your donation amount and add your email in the memo for receipt</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold mr-3">5</span>
                  <span>Review and send your donation</span>
                </li>
              </ol>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Option 2: Using Phone Number</h4>
              <ol className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold mr-3">1</span>
                  <span>Open your banking app or Zelle app</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold mr-3">2</span>
                  <span>Select "Send Money with Zelle"</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold mr-3">3</span>
                  <span>Enter the phone number: <strong>{zellePhoneNumber || '[Phone number not configured]'}</strong></span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold mr-3">4</span>
                  <span>Enter your donation amount</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold mr-3">5</span>
                  <span>In the memo section, include your email address for receipt</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold mr-3">6</span>
                  <span>Review and send your donation</span>
                </li>
              </ol>
            </div>
          </motion.div>

          {/* Thank You Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl shadow-lg p-8 text-center"
          >
            <Heart className="w-12 h-12 text-primary-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You for Your Support!</h3>
            <p className="text-lg text-gray-700">
              Your generous contribution helps us continue our mission of preserving Bengali culture and building a stronger community.
            </p>
          </motion.div>
        </div>
      </PageContent>
    </div>
  );
}

