import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye, EyeOff, X } from 'lucide-react';
import { noticesAPI, eventsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { convertPSTToLocal } from '../../utils/dateUtils';

interface Notice {
  notice_id: string;
  notice_name: string;
  notice_body: string;
  event_id?: string;
  notice_image_path?: string;
  is_active: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

interface Event {
  event_id: string;
  event_name: string;
}

interface NoticeForm {
  notice_name: string;
  notice_body: string;
  event_id: string;
  notice_image_path: string;
  is_active: boolean;
  is_published: boolean;
}

export default function AdminNotices() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [formData, setFormData] = useState<NoticeForm>({
    notice_name: '',
    notice_body: '',
    event_id: '',
    notice_image_path: '',
    is_active: true,
    is_published: false,
  });
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchNotices();
    fetchEvents();
  }, []);

  useEffect(() => {
    // Check if 'new' query parameter is present to auto-open form
    const shouldOpenForm = searchParams.get('new') === 'true';
    if (shouldOpenForm) {
      setShowForm(true);
      // Remove the query parameter from URL after opening the form
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchNotices = async () => {
    try {
      setLoading(true);
      const allNotices = await noticesAPI.getAll();
      // Sort by created_at descending (newest first)
      const sorted = allNotices.sort((a, b) => 
        convertPSTToLocal(b.created_at || b.createdAt || '').getTime() - 
        convertPSTToLocal(a.created_at || a.createdAt || '').getTime()
      );
      setNotices(sorted);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch notices');
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const allEvents = await eventsAPI.getAll();
      setEvents(allEvents.filter(e => e.is_active));
    } catch (error: any) {
      console.error('Failed to fetch events:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUploading(true);
      const submitData = {
        notice_name: formData.notice_name,
        notice_body: formData.notice_body,
        event_id: formData.event_id || undefined,
        notice_image_path: formData.notice_image_path || undefined,
        is_active: formData.is_active,
        is_published: formData.is_published,
      };

      let noticeId: string;
      if (editingNotice) {
        await noticesAPI.update(editingNotice.notice_id, submitData);
        noticeId = editingNotice.notice_id;
        toast.success('Notice updated successfully');
      } else {
        const newNotice = await noticesAPI.create(submitData);
        noticeId = newNotice.notice_id;
        toast.success('Notice created successfully');
      }

      // Upload images if selected
      if (selectedImages.length > 0) {
        try {
          await noticesAPI.uploadImages(noticeId, selectedImages);
          toast.success(`${selectedImages.length} image(s) uploaded successfully`);
        } catch (error: any) {
          toast.error(error.response?.data?.error || 'Failed to upload images');
        }
      }

      setShowForm(false);
      setEditingNotice(null);
      resetForm();
      fetchNotices();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save notice');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setFormData({
      notice_name: notice.notice_name,
      notice_body: notice.notice_body,
      event_id: notice.event_id || '',
      notice_image_path: notice.notice_image_path || '',
      is_active: notice.is_active,
      is_published: notice.is_published,
    });
    setSelectedImages([]);
    setShowForm(true);
  };

  const handleDelete = async (noticeId: string) => {
    if (!window.confirm('Are you sure you want to delete this notice?')) {
      return;
    }
    try {
      await noticesAPI.delete(noticeId);
      toast.success('Notice deleted successfully');
      fetchNotices();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete notice');
    }
  };

  const handlePublish = async (noticeId: string) => {
    try {
      await noticesAPI.publish(noticeId);
      toast.success('Notice published successfully');
      fetchNotices();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to publish notice');
    }
  };

  const handleUnpublish = async (noticeId: string) => {
    try {
      await noticesAPI.unpublish(noticeId);
      toast.success('Notice unpublished successfully');
      fetchNotices();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to unpublish notice');
    }
  };

  const resetForm = () => {
    setFormData({
      notice_name: '',
      notice_body: '',
      event_id: '',
      notice_image_path: '',
      is_active: true,
      is_published: false,
    });
    setSelectedImages([]);
    setEditingNotice(null);
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
          <h1 className="text-3xl font-bold text-gray-900">Notices Management</h1>
          <p className="text-gray-600 mt-1">Manage community notices and announcements</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Notice</span>
        </button>
      </div>

      {/* Notice Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingNotice ? 'Edit Notice' : 'Add New Notice'}
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
                    Notice Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.notice_name}
                    onChange={(e) => setFormData({ ...formData, notice_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter notice name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notice Body *
                  </label>
                  <textarea
                    required
                    rows={8}
                    value={formData.notice_body}
                    onChange={(e) => setFormData({ ...formData, notice_body: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter notice content"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Related Event (Optional)
                  </label>
                  <select
                    value={formData.event_id}
                    onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">No Event</option>
                    {events.map((event) => (
                      <option key={event.event_id} value={event.event_id}>
                        {event.event_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notice Images (Optional, Maximum 3)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 3) {
                        toast.error('Maximum 3 images allowed. Only the first 3 will be selected.');
                        setSelectedImages(files.slice(0, 3));
                      } else {
                        setSelectedImages(files);
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {selectedImages.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600 mb-2">
                        Selected {selectedImages.length} image(s):
                      </p>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        {selectedImages.map((file, index) => (
                          <li key={index}>{file.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {editingNotice && editingNotice.notice_image_path && selectedImages.length === 0 && (
                    <p className="mt-2 text-sm text-gray-600">
                      Current folder: {editingNotice.notice_image_path}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-6">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => {
                        const isActive = e.target.checked;
                        setFormData({ 
                          ...formData, 
                          is_active: isActive,
                          // Automatically uncheck publish if active is unchecked
                          is_published: isActive ? formData.is_published : false
                        });
                      }}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.is_published}
                      disabled={!formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                      className={`w-4 h-4 text-primary-600 rounded focus:ring-primary-500 ${
                        !formData.is_active ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                    <span className={`text-sm font-medium ${!formData.is_active ? 'text-gray-400' : 'text-gray-700'}`}>
                      Published
                    </span>
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
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Saving...' : editingNotice ? 'Update Notice' : 'Create Notice'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Notices List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="inline-block min-w-full align-middle px-4 md:px-0">
            <div className="relative max-h-[600px] overflow-y-auto">
              <table className="w-full min-w-[700px] md:min-w-0">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Notice Name
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Event
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Status
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Published
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
              {notices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-gray-500">
                    No notices found. Click "Add Notice" to create your first notice.
                  </td>
                </tr>
              ) : (
                notices.map((notice) => {
                  const relatedEvent = notice.event_id 
                    ? events.find(e => e.event_id === notice.event_id)
                    : null;
                  
                  return (
                    <tr key={notice.notice_id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-xs">{notice.notice_name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {notice.notice_body.substring(0, 80)}...
                        </div>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-500 truncate max-w-[150px]">
                        {relatedEvent ? relatedEvent.event_name : '-'}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded-full ${
                            notice.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {notice.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded-full ${
                            notice.is_published
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {notice.is_published ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-500">
                        {formatDate(notice.created_at)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-1">
                          {notice.is_published ? (
                            <button
                              onClick={() => handleUnpublish(notice.notice_id)}
                              className="text-yellow-600 hover:text-yellow-900"
                              title="Unpublish"
                            >
                              <EyeOff className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePublish(notice.notice_id)}
                              disabled={!notice.is_active}
                              className={`${
                                notice.is_active
                                  ? 'text-green-600 hover:text-green-900'
                                  : 'text-gray-400 cursor-not-allowed'
                              }`}
                              title={
                                notice.is_active
                                  ? 'Publish'
                                  : 'Cannot publish inactive notice. Please activate the notice first.'
                              }
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(notice)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(notice.notice_id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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

