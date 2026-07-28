import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Newspaper,
  Video,
  Link as LinkIcon,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Archive,
} from 'lucide-react';
import { newsAPI } from '../services/api';
import { News } from '../types';
import { format } from 'date-fns';
import { convertPSTToLocal } from '../utils/dateUtils';
import Seo from '../components/Seo';
import PageHero from '../components/PageHero';
import PageContent from '../components/PageContent';
import FeedItemCard from '../components/FeedItemCard';

export default function NewsPage() {
  const [news, setNews] = useState<News[]>([]);
  const [archivedNews, setArchivedNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivedExpanded, setArchivedExpanded] = useState(false);

  useEffect(() => {
    Promise.all([newsAPI.getPublic(), newsAPI.getArchived()])
      .then(([fetchedNews, fetchedArchived]) => {
        setNews(fetchedNews);
        setArchivedNews(fetchedArchived);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getMediaTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return Video;
      case 'link':
        return LinkIcon;
      case 'image':
        return ImageIcon;
      case 'article':
        return FileText;
      default:
        return FileText;
    }
  };

  const renderMedia = (newsItem: News) => {
    if (newsItem.media_type === 'video') {
      if (newsItem.media_file_path) {
        const videoUrl = newsAPI.getMediaUrl(newsItem.media_file_path);
        return (
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
            <video src={videoUrl} controls className="w-full max-h-[600px]">
              Your browser does not support the video tag.
            </video>
          </div>
        );
      }
      if (newsItem.media_url) {
        return (
          <div className="mt-6">
            <a
              href={newsItem.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Watch video
            </a>
          </div>
        );
      }
    } else if (newsItem.media_type === 'image') {
      const imageUrl = newsItem.media_file_path
        ? newsAPI.getMediaUrl(newsItem.media_file_path)
        : newsItem.media_url;
      if (imageUrl) {
        return (
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
            <img
              src={imageUrl}
              alt={newsItem.title}
              className="w-full h-auto object-contain max-h-[600px] mx-auto"
              loading="lazy"
              decoding="async"
              onError={e => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        );
      }
    } else if (newsItem.media_type === 'link' && newsItem.media_url) {
      return (
        <div className="mt-6 space-y-3">
          <a
            href={newsItem.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium underline break-all"
          >
            <LinkIcon className="w-4 h-4 shrink-0" />
            {newsItem.media_url}
          </a>
          <div>
            <a
              href={newsItem.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Read more
            </a>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderNewsItem = (newsItem: News, index: number, archived = false) => (
    <FeedItemCard
      key={newsItem.news_id}
      icon={getMediaTypeIcon(newsItem.media_type)}
      title={newsItem.title}
      date={format(convertPSTToLocal(newsItem.created_at), 'MMMM dd, yyyy')}
      index={index}
      variant={archived ? 'muted' : 'default'}
      badges={
        <>
          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-primary-50 text-primary-800 capitalize">
            {newsItem.media_type}
          </span>
          {archived ? (
            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-800">
              Archived
            </span>
          ) : null}
        </>
      }
    >
      <p className="text-gray-700 whitespace-pre-line leading-relaxed">{newsItem.content}</p>
      {renderMedia(newsItem)}
    </FeedItemCard>
  );

  return (
    <div className="pb-32">
      <Seo
        title="News & Media | Sanhoti Bengali Association of Orange County, CA"
        description="News, coverage, and updates from Sanhoti Bengali Association — Durga Puja, concerts with visiting artists, charity work, and cultural programs across Orange County and Southern California."
        path="/news"
      />
      <PageHero
        icon={Newspaper}
        title="Sanhoti News & Media — Orange County, California"
        subtitle="News, coverage, and updates from Sanhoti — Durga Puja, concerts with visiting artists, charity work, and cultural programmes across Orange County and Southern California."
      />
      <PageContent>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
          </div>
        ) : (
          <>
            {news.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No media at this time.</p>
              </div>
            ) : (
              <div className="space-y-6">{news.map((item, i) => renderNewsItem(item, i))}</div>
            )}

            {archivedNews.length > 0 ? (
              <div className="mt-12">
                <button
                  type="button"
                  onClick={() => setArchivedExpanded(!archivedExpanded)}
                  className="w-full flex items-center justify-between p-5 sm:p-6 bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
                >
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Archive className="w-5 h-5 text-primary-600" />
                    Archived media
                  </h2>
                  {archivedExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>

                <AnimatePresence>
                  {archivedExpanded ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-6 pt-6">
                        {archivedNews.map((item, i) => renderNewsItem(item, i, true))}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}
          </>
        )}
      </PageContent>
    </div>
  );
}
