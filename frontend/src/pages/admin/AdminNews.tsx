import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, Plus, Edit, Trash2, Eye, EyeOff, X, Video, Link as LinkIcon, FileText, Image as ImageIcon, Archive, ArchiveRestore } from 'lucide-react';
import { newsAPI } from '../../services/api';
import { News } from '../../types';
import toast from 'react-hot-toast';
import { convertPSTToLocal } from '../../utils/dateUtils';

interface NewsForm {
  title: string;
  content: string;
  media_type: 'video' | 'link' | 'article' | 'image';
  media_url: string;
  is_active: boolean;
  is_published: boolean;
}

export default function AdminNews() {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [formData, setFormData] = useState<NewsForm>({
    title: '',
    content: '',
    media_type: 'article',
    media_url: '',
    is_active: true,
    is_published: false,
  });
  const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const data = await newsAPI.getAll();
      // Sort by created_at descending (newest first)
      data.sort((a, b) => 
        convertPSTToLocal(b.created_at).getTime() - 
        convertPSTToLocal(a.created_at).getTime()
      );
      setNews(data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch news');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      media_type: 'article',
      media_url: '',
      is_active: true,
      is_published: false,
    });
    setSelectedMediaFile(null);
    setEditingNews(null);
  };

  const handleEdit = (newsItem: News) => {
    setEditingNews(newsItem);
    setFormData({
      title: newsItem.title,
      content: newsItem.content,
      media_type: newsItem.media_type,
      media_url: newsItem.media_url || '',
      is_active: newsItem.is_active,
      is_published: newsItem.is_published,
    });
    setSelectedMediaFile(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.content) {
      toast.error('Title and content are required');
      return;
    }

    // Validate media requirements
    if (formData.media_type === 'link' && !formData.media_url && !selectedMediaFile) {
      toast.error('Media URL is required for link type');
      return;
    }

    if ((formData.media_type === 'video' || formData.media_type === 'image') && !formData.media_url && !selectedMediaFile && !editingNews?.media_file_path) {
      toast.error(`Please provide a ${formData.media_type} URL or upload a file`);
      return;
    }

    try {
      setUploading(true);
      
      if (editingNews) {
        // Update existing news
        await newsAPI.update(editingNews.news_id, {
          title: formData.title,
          content: formData.content,
          media_type: formData.media_type,
          media_url: formData.media_url || undefined,
          is_active: formData.is_active,
          is_published: formData.is_published,
        });
        toast.success('News updated successfully');
      } else {
        // Create new news
        await newsAPI.create({
          title: formData.title,
          content: formData.content,
          media_type: formData.media_type,
          media_url: formData.media_url || undefined,
          media: selectedMediaFile || undefined,
          is_active: formData.is_active,
          is_published: formData.is_published,
        });
        toast.success('News created successfully');
      }
      
      setShowForm(false);
      resetForm();
      fetchNews();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save news');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (newsId: string) => {
    if (!window.confirm('Are you sure you want to delete this news item?')) {
      return;
    }

    try {
      await newsAPI.delete(newsId);
      toast.success('News deleted successfully');
      fetchNews();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete news');
    }
  };

  const handleTogglePublish = async (newsItem: News) => {
    const newStatus = !newsItem.is_published;
    
    if (newStatus && !newsItem.is_active) {
      toast.error('Cannot publish inactive news. Please activate the news first.');
      return;
    }

    try {
      await newsAPI.update(newsItem.news_id, { is_published: newStatus });
      toast.success(`News ${newStatus ? 'published' : 'unpublished'} successfully`);
      fetchNews();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update news status');
    }
  };

  const handleArchive = async (newsItem: News) => {
    try {
      await newsAPI.archive(newsItem.news_id);
      toast.success('News archived successfully');
      fetchNews();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to archive news');
    }
  };

  const handleUnarchive = async (newsItem: News) => {
    try {
      await newsAPI.unarchive(newsItem.news_id);
      toast.success('News unarchived successfully');
      fetchNews();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to unarchive news');
    }
  };

  const formatDate = (dateString: string) => {
    return convertPSTToLocal(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMediaTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'link':
        return <LinkIcon className="w-4 h-4" />;
      case 'image':
        return <ImageIcon className="w-4 h-4" />;
      case 'article':
        return <FileText className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">News Management</h1>
          <p className="text-gray-600 mt-1">Manage news, media coverage, and articles</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add News</span>
        </button>
      </div>

      {/* News Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingNews ? 'Edit News' : 'Add New News'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter news title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content *
                  </label>
                  <textarea
                    required
                    rows={8}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter news content/article text"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Media Type *
                  </label>
                  <select
                    required
                    value={formData.media_type}
                    onChange={(e) => {
                      setFormData({ 
                        ...formData, 
                        media_type: e.target.value as 'video' | 'link' | 'article' | 'image',
                        media_url: '', // Reset URL when changing type
                      });
                      setSelectedMediaFile(null); // Reset file when changing type
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="article">Article (Text Only)</option>
                    <option value="video">Video</option>
                    <option value="link">External Link</option>
                    <option value="image">Image</option>
                  </select>
                </div>

                {/* Media URL Input (for link, video URL, or image URL) */}
                {(formData.media_type === 'link' || formData.media_type === 'video' || formData.media_type === 'image') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {formData.media_type === 'link' ? 'External Link URL *' : 
                       formData.media_type === 'video' ? 'Video URL (or upload file below)' :
                       'Image URL (or upload file below)'}
                    </label>
                    <input
                      type="url"
                      value={formData.media_url}
                      onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder={formData.media_type === 'link' ? 'https://example.com' : 
                                   formData.media_type === 'video' ? 'https://youtube.com/watch?v=...' :
                                   'https://example.com/image.jpg'}
                    />
                  </div>
                )}

                {/* File Upload (for video or image) */}
                {(formData.media_type === 'video' || formData.media_type === 'image') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {formData.media_type === 'video' ? 'Upload Video File (or use URL above)' : 'Upload Image File (or use URL above)'}
                    </label>
                    <input
                      type="file"
                      accept={formData.media_type === 'video' ? 'video/*' : 'image/*'}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedMediaFile(e.target.files[0]);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    {selectedMediaFile && (
                      <p className="mt-2 text-sm text-gray-600">
                        Selected: {selectedMediaFile.name}
                      </p>
                    )}
                    {editingNews && editingNews.media_file_path && !selectedMediaFile && (
                      <p className="mt-2 text-sm text-gray-600">
                        Current file: {editingNews.media_file_path}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-6">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.is_published}
                      onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                      disabled={!formData.is_active}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-700">Published</span>
                  </label>
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                    disabled={uploading}
                  >
                    {uploading ? 'Saving...' : editingNews ? 'Update News' : 'Create News'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* News List */}
      {news.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <Newspaper className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No news items yet. Create your first news item!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {news.map((newsItem) => (
            <motion.div
              key={newsItem.news_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {getMediaTypeIcon(newsItem.media_type)}
                    <h3 className="text-xl font-bold text-gray-900">{newsItem.title}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      newsItem.is_published
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {newsItem.is_published ? 'Published' : 'Draft'}
                    </span>
                    {!newsItem.is_active && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        Inactive
                      </span>
                    )}
                    {newsItem.is_archived && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        Archived
                      </span>
                    )}
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 capitalize">
                      {newsItem.media_type}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-2 line-clamp-2">{newsItem.content}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Created: {formatDate(newsItem.created_at)}</span>
                    {newsItem.media_url && (
                      <span className="flex items-center space-x-1">
                        <LinkIcon className="w-3 h-3" />
                        <span>Has {newsItem.media_type === 'link' ? 'Link' : 'Media URL'}</span>
                      </span>
                    )}
                    {newsItem.media_file_path && (
                      <span className="flex items-center space-x-1">
                        <ImageIcon className="w-3 h-3" />
                        <span>Has Uploaded File</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleTogglePublish(newsItem)}
                    disabled={!newsItem.is_active && !newsItem.is_published}
                    className={`p-2 rounded-lg transition-colors ${
                      newsItem.is_published
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : newsItem.is_active
                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                        : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                    title={!newsItem.is_active && !newsItem.is_published 
                      ? 'News must be active before publishing'
                      : newsItem.is_published 
                      ? 'Unpublish news'
                      : 'Publish news'
                    }
                  >
                    {newsItem.is_published ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                  {!newsItem.is_archived ? (
                    <button
                      onClick={() => handleArchive(newsItem)}
                      className="p-2 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors"
                      title="Archive news"
                    >
                      <Archive className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnarchive(newsItem)}
                      className="p-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                      title="Unarchive news"
                    >
                      <ArchiveRestore className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(newsItem)}
                    className="p-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(newsItem.news_id)}
                    className="p-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

