import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail, Users } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { fetchCommitteeMembers, type CommitteeMemberDisplay } from '../utils/fetchCommitteeMembers';
import Seo from '../components/Seo';

export default function Committee() {
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMemberDisplay[]>([]);
  const [committeeYear, setCommitteeYear] = useState<string>('2025');

  useEffect(() => {
    const fetchCommitteeYear = async () => {
      try {
        const settings = await settingsAPI.getSettings();
        setCommitteeYear(settings.committeeYear || '2025');
      } catch (error) {
        console.error('Failed to fetch committee year:', error);
      }
    };

    fetchCommitteeYear();
  }, []);

  useEffect(() => {
    fetchCommitteeMembers()
      .then(setCommitteeMembers)
      .catch(error => {
        console.error('Failed to fetch committee members:', error);
      });
  }, []);

  return (
    <div className="py-12 pb-32">
      <Seo
        title="Committee & leadership | Sanhoti"
        description="Meet the committee and board of Sanhoti Bengali Association of Orange County, CA — volunteers serving the Bengali community."
        path="/committee"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Users className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              Meet our Team
            </h1>
          </div>
          <p className="text-2xl text-gray-600 mb-6">
            Executive Committee {committeeYear}
          </p>
          
          {/* Contact Information */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-gray-700">
            <div className="flex items-center space-x-2">
              <Phone className="w-5 h-5 text-primary-600" />
              <a href="tel:+19493786425" className="hover:text-primary-600 transition-colors font-medium">
                +1 949-378-6425
              </a>
            </div>
            <div className="flex items-center space-x-2">
              <Mail className="w-5 h-5 text-primary-600" />
              <a href="mailto:ec@sanhoti.org" className="hover:text-primary-600 transition-colors font-medium">
                ec@sanhoti.org
              </a>
            </div>
          </div>
        </motion.div>

        {/* Committee Members Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {committeeMembers.map((member, index) => (
            <motion.div
              key={member.role}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
            >
              <div className="aspect-[3/4] relative overflow-hidden bg-gray-100">
                {member.image ? (
                  <img
                    src={member.image}
                    alt={[member.firstName, member.lastName].filter(Boolean).join(' ') || member.role}
                    className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                    <Users className="w-16 h-16 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="p-7 text-center">
                {(member.firstName || member.lastName) && (
                  <p className="text-lg font-semibold text-red-900 mb-1">
                    {member.firstName} {member.lastName}
                  </p>
                )}
                <h3 className="text-xl font-bold text-gray-900 mb-2">{member.role}</h3>
                <div className="w-16 h-1 bg-primary-600 mx-auto rounded-full"></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
