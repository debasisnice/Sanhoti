import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { noticesAPI } from '../services/api';
import { Notice } from '../types';
import { format } from 'date-fns';
import { convertPSTToLocal } from '../utils/dateUtils';
import Seo from '../components/Seo';
import PageHero from '../components/PageHero';
import PageContent from '../components/PageContent';
import FeedItemCard from '../components/FeedItemCard';

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
      .then(async fetchedNotices => {
        setNotices(fetchedNotices);

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
    <div className="pb-32">
      <Seo
        title="Notices & Announcements | Sanhoti Bengali Association of Orange County, CA"
        description="Latest notices and announcements from Sanhoti Bengali Association — event dates, tickets, and community updates for Orange County and Southern California."
        path="/notices"
      />
      <PageHero
        icon={Bell}
        title="Sanhoti Notices & Announcements — Orange County, California"
        subtitle="Event dates and ticket releases, Durga Puja announcements, volunteer calls, and community updates for Bengali families across Orange County and Southern California."
      />
      <PageContent>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
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
              const noticeId = notice.notice_id || notice.id;
              const images = noticeId ? noticeImages[noticeId] : [];
              const gridCols =
                images.length === 1
                  ? 'grid-cols-1'
                  : images.length === 2
                    ? 'grid-cols-1 md:grid-cols-2'
                    : 'grid-cols-1 md:grid-cols-3';

              return (
                <FeedItemCard
                  key={notice.notice_id || notice.id}
                  icon={Bell}
                  title={noticeName}
                  date={
                    createdAt ? format(convertPSTToLocal(createdAt), 'MMMM dd, yyyy') : undefined
                  }
                  index={index}
                >
                  <p className="text-gray-700 whitespace-pre-line leading-relaxed">{noticeBody}</p>
                  {images && images.length > 0 ? (
                    <div className={`mt-6 grid ${gridCols} gap-4`}>
                      {images.map((image, imgIndex) => (
                        <div
                          key={imgIndex}
                          className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50"
                        >
                          <img
                            src={image.url}
                            alt={`${noticeName} - Image ${imgIndex + 1}`}
                            className="w-full h-auto object-contain max-h-[600px] mx-auto"
                            onError={e => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </FeedItemCard>
              );
            })}
          </div>
        )}
      </PageContent>
    </div>
  );
}
