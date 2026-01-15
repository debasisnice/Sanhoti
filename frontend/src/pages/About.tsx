import { motion } from 'framer-motion';
import { Heart, Users, Target, Eye, Info } from 'lucide-react';

export default function About() {
  return (
    <div className="py-12 pb-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Info className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              About Us
            </h1>
          </div>
          <p className="text-2xl text-gray-600">
            Learn more about our community
          </p>
        </motion.div>

        <div className="space-y-8">
          {/* Main About Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg p-8"
          >
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              Sanhoti is a non-profit 501(c)(3) cultural and charitable organization dedicated to preserving and celebrating the rich heritage of Bengali culture in Orange County, California. As the premier Bengali Association near me in Orange County, we serve Bengali families in Rancho Santa Margarita (RSM), Irvine, Tustin, Mission Viejo, and throughout Orange County, CA.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              Established in 2025, Sanhoti strives to build an inclusive and vibrant Bengali community where traditions flourish through festivals, arts, and meaningful community connections. From the grandeur of Durga Puja and Saraswati Puja to the joyous spirit of Poila Boishakh, we proudly bring Bengali families together to honor our roots and celebrate togetherness in Orange County.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              While our foundation is deeply rooted in Bengali customs, Sanhoti embraces diversity and warmly welcomes individuals from all backgrounds to join in and experience the richness of Bengali culture. Our doors are open to everyone—regardless of race, religion, or ethnicity. If you're searching for a Bengali association near me in Orange County, look no further than Sanhoti.
            </p>
          </motion.div>

          {/* Vision Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-lg p-8"
          >
            <div className="flex items-center mb-4">
              <div className="bg-primary-100 rounded-lg p-3 mr-4">
                <Eye className="w-6 h-6 text-primary-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Vision</h2>
            </div>
            <p className="text-lg text-gray-700 leading-relaxed">
              Sanhoti also serves as a nurturing platform for the next generation to stay connected to their cultural roots. Through a variety of cultural, literary, and social events held year-round, we create meaningful opportunities for children to explore and engage with the Bengali language, literature, music, and traditions.
            </p>
          </motion.div>

          {/* Mission Statement Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-8"
          >
            <div className="flex items-center mb-4">
              <div className="bg-primary-100 rounded-lg p-3 mr-4">
                <Target className="w-6 h-6 text-primary-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Mission Statement</h2>
            </div>
            <p className="text-lg text-gray-700 leading-relaxed">
              Sanhoti is committed to fostering an inclusive, diverse, and harmonious community in the Greater Orange County, CA region, while enriching the broader cultural landscape with the distinctive values and contributions of Indian heritage.
            </p>
          </motion.div>

          {/* Values/Icons Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12"
          >
            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <div className="bg-primary-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Heart className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Cultural Heritage</h3>
              <p className="text-gray-600">Preserving and celebrating Bengali traditions</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <div className="bg-primary-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Users className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Inclusive Community</h3>
              <p className="text-gray-600">Welcoming people from all backgrounds</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <div className="bg-primary-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Target className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Next Generation</h3>
              <p className="text-gray-600">Nurturing cultural roots for children</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

