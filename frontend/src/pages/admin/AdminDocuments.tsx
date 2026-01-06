import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, Trash2, Plus, X } from 'lucide-react';
import { documentsAPI } from '../../services/api';
import { Document } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { convertPSTToLocal } from '../../utils/dateUtils';

export default function AdminDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentDescription, setDocumentDescription] = useState('');
  const [documentIsPublic, setDocumentIsPublic] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const data = await documentsAPI.getAll();
      // Sort by publish date descending
      data.sort((a, b) => convertPSTToLocal(b.publishDate).getTime() - convertPSTToLocal(a.publishDate).getTime());
      setDocuments(data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setSelectedDocumentFile(file);
      } else {
        toast.error('Please select a PDF file');
        e.target.value = '';
      }
    }
  };

  const handleDocumentUpload = async () => {
    if (!selectedDocumentFile) {
      toast.error('Please select a PDF file');
      return;
    }
    if (!documentTitle.trim()) {
      toast.error('Please enter a document title');
      return;
    }

    try {
      setUploading(true);
      await documentsAPI.uploadDocument(
        selectedDocumentFile,
        documentTitle.trim(),
        documentDescription.trim() || undefined,
        documentIsPublic
      );
      toast.success('Document uploaded successfully');
      resetForm();
      await fetchDocuments();
      setShowAddForm(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This will also delete the PDF file.`)) {
      return;
    }

    try {
      setDeleting(true);
      await documentsAPI.deleteDocument(id);
      toast.success('Document deleted successfully');
      await fetchDocuments();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setSelectedDocumentFile(null);
    setDocumentTitle('');
    setDocumentDescription('');
    setDocumentIsPublic(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancelAdd = () => {
    resetForm();
    setShowAddForm(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Documents</h1>
          <p className="text-gray-600">Manage community documents and files</p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add New Document
          </button>
        )}
      </div>

      {/* Add Document Form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 border-2 border-primary-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Add New Document</h2>
            <button
              onClick={handleCancelAdd}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PDF File <span className="text-red-500">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleDocumentFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-700"
              />
              {selectedDocumentFile && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: <span className="font-medium">{selectedDocumentFile.name}</span>
                  {' '}({(selectedDocumentFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Document Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="Enter document title"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={documentDescription}
                onChange={(e) => setDocumentDescription(e.target.value)}
                placeholder="Enter document description"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={documentIsPublic}
                  onChange={(e) => setDocumentIsPublic(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Make this document public</span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleDocumentUpload}
                disabled={uploading || !selectedDocumentFile || !documentTitle.trim()}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Upload Document'}
              </button>
              <button
                onClick={handleCancelAdd}
                disabled={uploading}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Documents List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg mb-2">No documents uploaded yet</p>
          <p className="text-gray-500 text-sm">Click "Add New Document" to upload your first document</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Title</th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Description</th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">Published Date</th>
                  <th className="text-center py-3 px-6 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {documents.map((document) => (
                  <tr key={document.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary-600" />
                        <span className="font-medium text-gray-900">{document.title}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {document.description || '-'}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      {document.isPublic ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                          Public
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                          Private
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600">
                        {format(convertPSTToLocal(document.publishDate), 'MMM dd, yyyy')}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2">
                        <a
                          href={document.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium flex items-center gap-1"
                        >
                          <FileText className="w-4 h-4" />
                          View PDF
                        </a>
                        <button
                          onClick={() => handleDeleteDocument(document.id, document.title)}
                          disabled={deleting}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}

