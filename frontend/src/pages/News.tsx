import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, Video, Link as LinkIcon, FileText, Image as ImageIcon, ExternalLink, ChevronDown, ChevronUp, Archive } from 'lucide-react';
import { newsAPI } from '../services/api';
import { News } from '../types';
import { format } from 'date-fns';
import { convertPSTToLocal } from '../utils/dateUtils';
import Seo from '../components/Seo';
import PageHero from '../components/PageHero';

export default function NewsPage() {
  const [news, setNews] = useState<News[]>([]);
  const [archivedNews, setArchivedNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivedExpanded, setArchivedExpanded] = useState(false);

  useEffect(() => {
    Promise.all([
      newsAPI.getPublic(),
      newsAPI.getArchived()
    ])
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
        return <Video className="w-5 h-5" />;
      case 'link':
        return <LinkIcon className="w-5 h-5" />;
      case 'image':
        return <ImageIcon className="w-5 h-5" />;
      case 'article':
        return <FileText className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const renderMedia = (newsItem: News) => {
    if (newsItem.media_type === 'video') {
      if (newsItem.media_file_path) {
        // Uploaded video file
        const videoUrl = newsAPI.getMediaUrl(newsItem.media_file_path);
        return (
          <div className="mt-4 rounded-lg overflow-hidden">
            <video
              src={videoUrl}
              controls
              className="w-full max-h-[600px] rounded-lg"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        );
      } else if (newsItem.media_url) {
        // External video URL (YouTube, Vimeo, etc.)
        return (
          <div className="mt-4">
            <a
              href={newsItem.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Watch Video</span>
            </a>
          </div>
        );
      }
    } else if (newsItem.media_type === 'image') {
      if (newsItem.media_file_path) {
        // Uploaded image file
        const imageUrl = newsAPI.getMediaUrl(newsItem.media_file_path);
        return (
          <div className="mt-4 rounded-lg overflow-hidden">
            <img
              src={imageUrl}
              alt={newsItem.title}
              className="w-full h-auto object-contain max-h-[600px] mx-auto rounded-lg"
              loading="lazy"
              decoding="async"
            />
          </div>
        );
      } else if (newsItem.media_url) {
        // External image URL
        return (
          <div className="mt-4 rounded-lg overflow-hidden">
            <img
              src={newsItem.media_url}
              alt={newsItem.title}
              className="w-full h-auto object-contain max-h-[600px] mx-auto rounded-lg"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        );
      }
    } else if (newsItem.media_type === 'link' && newsItem.media_url) {
      // External link
      return (
        <div className="mt-4 space-y-3">
          <div>
            <a
              href={newsItem.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-medium underline break-all"
            >
              <LinkIcon className="w-4 h-4 flex-shrink-0" />
              <span>{newsItem.media_url}</span>
            </a>
          </div>
          <a
            href={newsItem.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Read More</span>
          </a>
        </div>
      );
    }
    return null;
  };

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : (
          <>
            {news.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No media at this time.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {news.map((newsItem, index) => (
                  <motion.div
                    key={newsItem.news_id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl shadow-2xl overflow-hidden border-4 border-yellow-400 p-6"
                  >
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="flex items-center space-x-3">
                        {getMediaTypeIcon(newsItem.media_type)}
                        <h3 className="text-2xl font-bold text-gray-900">{newsItem.title}</h3>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-800 capitalize">
                          {newsItem.media_type}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        Posted on {format(convertPSTToLocal(newsItem.created_at), 'MMMM dd, yyyy')}
                      </div>
                    </div>
                    <div className="prose max-w-none mb-4">
                      <p className="text-gray-700 whitespace-pre-line">{newsItem.content}</p>
                    </div>
                    {renderMedia(newsItem)}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Archived media section */}
            {archivedNews.length > 0 && (
              <div className="mt-12">
                <button
                  onClick={() => setArchivedExpanded(!archivedExpanded)}
                  className="w-full flex items-center justify-between p-4 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors mb-4"
                >
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Archive className="w-6 h-6 text-gray-600" />
                    Archived Media
                  </h2>
                  {archivedExpanded ? (
                    <ChevronUp className="w-6 h-6 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-600" />
                  )}
                </button>

                <AnimatePresence>
                  {archivedExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-6">
                        {archivedNews.map((newsItem, index) => (
                          <motion.div
                            key={newsItem.news_id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl shadow-2xl overflow-hidden border-4 border-gray-300 p-6"
                          >
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                              <div className="flex items-center space-x-3">
                                {getMediaTypeIcon(newsItem.media_type)}
                                <h3 className="text-2xl font-bold text-gray-900">{newsItem.title}</h3>
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-800 capitalize">
                                  {newsItem.media_type}
                                </span>
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-200 text-yellow-800">
                                  Archived
                                </span>
                              </div>
                              <div className="text-sm text-gray-500">
                                Posted on {format(convertPSTToLocal(newsItem.created_at), 'MMMM dd, yyyy')}
                              </div>
                            </div>
                            <div className="prose max-w-none mb-4">
                              <p className="text-gray-700 whitespace-pre-line">{newsItem.content}</p>
                            </div>
                            {renderMedia(newsItem)}
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

