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
      toast.error(error.response?.data?.error || 'Failed to fetch media');
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
        // Update existing item
        await newsAPI.update(editingNews.news_id, {
          title: formData.title,
          content: formData.content,
          media_type: formData.media_type,
          media_url: formData.media_url || undefined,
          is_active: formData.is_active,
          is_published: formData.is_published,
        });
        toast.success('Media updated successfully');
      } else {
        // Create new item
        await newsAPI.create({
          title: formData.title,
          content: formData.content,
          media_type: formData.media_type,
          media_url: formData.media_url || undefined,
          media: selectedMediaFile || undefined,
          is_active: formData.is_active,
          is_published: formData.is_published,
        });
        toast.success('Media created successfully');
      }
      
      setShowForm(false);
      resetForm();
      fetchNews();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save media');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (newsId: string) => {
    if (!window.confirm('Are you sure you want to delete this media item?')) {
      return;
    }

    try {
      await newsAPI.delete(newsId);
      toast.success('Media deleted successfully');
      fetchNews();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete media');
    }
  };

  const handleTogglePublish = async (newsItem: News) => {
    const newStatus = !newsItem.is_published;
    
    if (newStatus && !newsItem.is_active) {
      toast.error('Cannot publish inactive media. Please activate the item first.');
      return;
    }

    try {
      await newsAPI.update(newsItem.news_id, { is_published: newStatus });
      toast.success(`Media ${newStatus ? 'published' : 'unpublished'} successfully`);
      fetchNews();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update publish status');
    }
  };

  const handleArchive = async (newsItem: News) => {
    try {
      await newsAPI.archive(newsItem.news_id);
      toast.success('Media archived successfully');
      fetchNews();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to archive media');
    }
  };

  const handleUnarchive = async (newsItem: News) => {
    try {
      await newsAPI.unarchive(newsItem.news_id);
      toast.success('Media unarchived successfully');
      fetchNews();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to unarchive media');
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
          <h1 className="text-3xl font-bold text-gray-900">Media Management</h1>
          <p className="text-gray-600 mt-1">Manage media coverage, articles, and stories</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Media</span>
        </button>
      </div>

      {/* Media form modal */}
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
                  {editingNews ? 'Edit Media' : 'Add New Media'}
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
                    placeholder="Enter title"
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
                    placeholder="Enter content or article text"
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
                    {uploading ? 'Saving...' : editingNews ? 'Update Media' : 'Create Media'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Media list */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="inline-block min-w-full align-middle px-4 md:px-0">
            <div className="relative max-h-[600px] overflow-y-auto">
              <table className="w-full min-w-[700px] md:min-w-0">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Title
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Type
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Status
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Published
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Archived
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Created
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Actions
                    </th>
                  </tr>
                </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {news.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-gray-500">
                      <Newspaper className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p>No media items yet. Create your first item!</p>
                    </td>
                  </tr>
                ) : (
                  news.map((newsItem) => (
                    <tr key={newsItem.news_id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <div className="flex items-center space-x-1.5">
                          {getMediaTypeIcon(newsItem.media_type)}
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs">{newsItem.title}</div>
                            <div className="text-xs text-gray-500 truncate max-w-xs">
                              {newsItem.content.substring(0, 80)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 capitalize">
                          {newsItem.media_type}
                        </span>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded-full ${
                            newsItem.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {newsItem.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded-full ${
                            newsItem.is_published
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {newsItem.is_published ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        {newsItem.is_archived ? (
                          <span className="inline-block px-1.5 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-500">
                        {formatDate(newsItem.created_at)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleTogglePublish(newsItem)}
                            disabled={!newsItem.is_active && !newsItem.is_published}
                            className={`${
                              newsItem.is_published
                                ? 'text-gray-600 hover:text-gray-900'
                                : newsItem.is_active
                                ? 'text-green-600 hover:text-green-900'
                                : 'text-gray-400 cursor-not-allowed'
                            }`}
                            title={!newsItem.is_active && !newsItem.is_published 
                              ? 'Media must be active before publishing'
                              : newsItem.is_published 
                              ? 'Unpublish'
                              : 'Publish'
                            }
                          >
                            {newsItem.is_published ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                          {!newsItem.is_archived ? (
                            <button
                              onClick={() => handleArchive(newsItem)}
                              className="text-yellow-600 hover:text-yellow-900"
                              title="Archive"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnarchive(newsItem)}
                              className="text-green-600 hover:text-green-900"
                              title="Unarchive"
                            >
                              <ArchiveRestore className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(newsItem)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(newsItem.news_id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

