import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { noticesAPI } from '../services/api';
import { Notice } from '../types';
import { format } from 'date-fns';
import { convertPSTToLocal } from '../utils/dateUtils';

interface NoticeImage {
  filename: string;
  url: string;
}

export default function Notices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [noticeImages, setNoticeImages] = useState<Record<string, NoticeImage[]>>({});

  useEffect(() => {
    noticesAPI
      .getPublic()
      .then(async (fetchedNotices) => {
        setNotices(fetchedNotices);
        
        // Fetch images for each notice that has a notice_image_path
        const imagesMap: Record<string, NoticeImage[]> = {};
        for (const notice of fetchedNotices) {
          const noticeId = notice.notice_id || notice.id;
          if (noticeId && notice.notice_image_path) {
            try {
              const images = await noticesAPI.getImages(noticeId);
              imagesMap[noticeId] = images;
            } catch (error) {
              console.error(`Failed to load images for notice ${noticeId}:`, error);
              imagesMap[noticeId] = [];
            }
          }
        }
        setNoticeImages(imagesMap);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="py-12 pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Bell className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              Notice Board
            </h1>
          </div>
          <p className="text-2xl text-gray-600">
            Stay updated with the latest community announcements
          </p>
        </motion.div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : notices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No notices at this time.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {notices.map((notice, index) => {
              const noticeName = notice.notice_name || notice.title || 'Untitled Notice';
              const noticeBody = notice.notice_body || notice.content || '';
              const createdAt = notice.created_at || notice.createdAt || '';
              
              return (
                <motion.div
                  key={notice.notice_id || notice.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl shadow-2xl overflow-hidden border-4 border-yellow-400 p-6"
                >
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center space-x-3">
                      <Bell className="w-6 h-6 text-primary-600" />
                      <h3 className="text-2xl font-bold text-gray-900">{noticeName}</h3>
                    </div>
                    <div className="text-sm text-gray-500">
                      Posted on {createdAt ? format(convertPSTToLocal(createdAt), 'MMMM dd, yyyy') : ''}
                    </div>
                  </div>
                  <div className="prose max-w-none mb-4">
                    <p className="text-gray-700 whitespace-pre-line">{noticeBody}</p>
                  </div>
                  {(() => {
                    const noticeId = notice.notice_id || notice.id;
                    const images = noticeId ? noticeImages[noticeId] : [];
                    if (images && images.length > 0) {
                      const gridCols = images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3';
                      return (
                        <div className={`mb-4 grid ${gridCols} gap-6`}>
                          {images.map((image, imgIndex) => {
                            // Backend returns URLs like "/api/notices/{id}/images/{filename}"
                            // These relative URLs will work correctly with nginx proxy
                            const imageUrl = image.url;
                            return (
                              <div key={imgIndex} className="w-full overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-shadow">
                                <img
                                  src={imageUrl}
                                  alt={`${noticeName} - Image ${imgIndex + 1}`}
                                  className="w-full h-auto object-contain max-h-[600px] mx-auto"
                                  style={{ display: 'block' }}
                                  onError={(e) => {
                                    console.error('Failed to load image:', imageUrl);
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                  onLoad={() => {
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

