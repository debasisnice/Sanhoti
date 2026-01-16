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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documents Management</h1>
          <p className="text-gray-600 mt-1">Manage community documents and files</p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Document</span>
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
                        Description
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                        Status
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                        Published Date
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                        Actions
                      </th>
                    </tr>
                  </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.map((document) => (
                    <tr key={document.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <div className="flex items-center space-x-1.5">
                          <FileText className="w-4 h-4 text-primary-600" />
                          <span className="text-sm font-medium text-gray-900 truncate max-w-xs">{document.title}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <p className="text-xs text-gray-500 truncate max-w-xs line-clamp-2">
                          {document.description || '-'}
                        </p>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        {document.isPublic ? (
                          <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            Public
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            Private
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-500">
                        {format(convertPSTToLocal(document.publishDate), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-1">
                          <a
                            href={document.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900"
                            title="View PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleDeleteDocument(document.id, document.title)}
                            disabled={deleting}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

