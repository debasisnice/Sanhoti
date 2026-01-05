import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Trash2, User, Phone, Calendar, MessageSquare, ChevronLeft, ChevronRight, Send, X } from 'lucide-react';
import { messagesAPI, emailAPI } from '../../services/api';
import { convertPSTToLocal } from '../../utils/dateUtils';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  message: string;
  userId?: string;
  read: boolean;
  responded?: boolean;
  createdAt: string;
}

export default function AdminMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [currentMessageIndex, setCurrentMessageIndex] = useState<number>(0);
  const [showEmailForm, setShowEmailForm] = useState<boolean>(false);
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailContent, setEmailContent] = useState<string>('');
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    if (messages.length > 0 && !selectedMessage) {
      setSelectedMessage(messages[0]);
      setCurrentMessageIndex(0);
    }
  }, [messages]);

  useEffect(() => {
    if (selectedMessage) {
      const index = messages.findIndex(m => m.id === selectedMessage.id);
      if (index !== -1) {
        setCurrentMessageIndex(index);
      }
    }
  }, [selectedMessage, messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const allMessages = await messagesAPI.getAll();
      // Sort: unresponded first, then responded. Within each group, sort by date descending (newest first)
      const sorted = allMessages.sort((a, b) => {
        const aResponded = a.responded || false;
        const bResponded = b.responded || false;
        
        // If one is responded and the other isn't, unresponded comes first
        if (aResponded !== bResponded) {
          return aResponded ? 1 : -1;
        }
        
        // If both have same responded status, sort by date descending
        return convertPSTToLocal(b.createdAt).getTime() - convertPSTToLocal(a.createdAt).getTime();
      });
      setMessages(sorted);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      await messagesAPI.delete(id);
      toast.success('Message deleted successfully');
      fetchMessages();
      if (selectedMessage?.id === id) {
        setSelectedMessage(null);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete message');
    }
  };

  const formatDate = (dateString: string) => {
    return convertPSTToLocal(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePreviousMessage = () => {
    if (messages.length === 0) return;
    const newIndex = currentMessageIndex > 0 ? currentMessageIndex - 1 : messages.length - 1;
    setCurrentMessageIndex(newIndex);
    setSelectedMessage(messages[newIndex]);
  };

  const handleNextMessage = () => {
    if (messages.length === 0) return;
    const newIndex = currentMessageIndex < messages.length - 1 ? currentMessageIndex + 1 : 0;
    setCurrentMessageIndex(newIndex);
    setSelectedMessage(messages[newIndex]);
  };

  const handleReplyViaEmail = () => {
    if (!selectedMessage) return;
    setEmailSubject(`Re: Your Message from Sanhoti Website`);
    setEmailContent('');
    setShowEmailForm(true);
  };

  const handleSendReplyEmail = async () => {
    if (!selectedMessage || !emailSubject || !emailContent) {
      toast.error('Please enter both subject and email content');
      return;
    }

    const messageId = selectedMessage.id;

    try {
      setSendingEmail(true);
      await emailAPI.sendToOrganizations([selectedMessage.email], emailSubject, emailContent);
      
      // Mark message as responded
      await messagesAPI.markAsResponded(messageId);
      
      toast.success('Reply email sent successfully');
      setShowEmailForm(false);
      setEmailSubject('');
      setEmailContent('');
      
      // Refresh messages to update the order and styling
      const allMessages = await messagesAPI.getAll();
      // Sort: unresponded first, then responded. Within each group, sort by date descending (newest first)
      const sorted = allMessages.sort((a, b) => {
        const aResponded = a.responded || false;
        const bResponded = b.responded || false;
        
        // If one is responded and the other isn't, unresponded comes first
        if (aResponded !== bResponded) {
          return aResponded ? 1 : -1;
        }
        
        // If both have same responded status, sort by date descending
        return convertPSTToLocal(b.createdAt).getTime() - convertPSTToLocal(a.createdAt).getTime();
      });
      setMessages(sorted);
      
      // Update selected message to reflect responded status and find its new index
      const updatedMessage = sorted.find(m => m.id === messageId);
      if (updatedMessage) {
        setSelectedMessage(updatedMessage);
        const newIndex = sorted.findIndex(m => m.id === messageId);
        setCurrentMessageIndex(newIndex);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.response?.data?.details || 'Failed to send email';
      toast.error(errorMsg, { duration: 6000 });
    } finally {
      setSendingEmail(false);
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
          <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600 mt-1">View messages from the contact form</p>
        </div>
        <div className="flex items-center space-x-2 bg-primary-100 rounded-lg px-4 py-2">
          <Mail className="w-5 h-5 text-primary-600" />
          <span className="text-primary-600 font-semibold">{messages.length}</span>
          <span className="text-primary-600">message{messages.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No messages found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Message Cards Carousel */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {currentMessageIndex + 1} of {messages.length}
                </span>
              </div>
            </div>
            <div className="relative">
              <AnimatePresence mode="wait">
                {selectedMessage && (
                  <motion.div
                    key={selectedMessage.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`rounded-lg p-4 border ${
                      selectedMessage.responded
                        ? 'bg-green-50 border-green-300'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {selectedMessage.firstName} {selectedMessage.lastName}
                          </h3>
                          {selectedMessage.responded && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                              Responded
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{selectedMessage.email}</p>
                      </div>
                      <button
                        onClick={() => handleDelete(selectedMessage.id)}
                        className="text-red-600 hover:text-red-900 ml-2"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {selectedMessage.message}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(selectedMessage.createdAt)}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                onClick={handlePreviousMessage}
                disabled={messages.length <= 1}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous message"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
              <button
                onClick={handleNextMessage}
                disabled={messages.length <= 1}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next message"
              >
                <ChevronRight className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          </div>

          {/* Message Detail */}
          <div>
            {selectedMessage ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-lg p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Message Details</h2>
                  <button
                    onClick={() => handleDelete(selectedMessage.id)}
                    className="flex items-center space-x-2 text-red-600 hover:text-red-900 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>Delete</span>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Sender Information */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Sender Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start space-x-3">
                        <User className="w-5 h-5 text-gray-400 mt-1" />
                        <div>
                          <p className="text-sm text-gray-500">Name</p>
                          <p className="font-medium text-gray-900">
                            {selectedMessage.firstName} {selectedMessage.lastName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <Mail className="w-5 h-5 text-gray-400 mt-1" />
                        <div>
                          <p className="text-sm text-gray-500">Email</p>
                          <a
                            href={`mailto:${selectedMessage.email}`}
                            className="font-medium text-primary-600 hover:text-primary-700"
                          >
                            {selectedMessage.email}
                          </a>
                        </div>
                      </div>
                      {selectedMessage.phone && (
                        <div className="flex items-start space-x-3">
                          <Phone className="w-5 h-5 text-gray-400 mt-1" />
                          <div>
                            <p className="text-sm text-gray-500">Phone</p>
                            <a
                              href={`tel:${selectedMessage.phone}`}
                              className="font-medium text-gray-900"
                            >
                              {selectedMessage.phone}
                            </a>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start space-x-3">
                        <Calendar className="w-5 h-5 text-gray-400 mt-1" />
                        <div>
                          <p className="text-sm text-gray-500">Date</p>
                          <p className="font-medium text-gray-900">
                            {formatDate(selectedMessage.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Message
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-l-primary-600">
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedMessage.message}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleReplyViaEmail}
                      className="flex items-center space-x-2 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Reply via Email</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Select a message to view details</p>
              </div>
            )}
          </div>

          {/* Email Form Modal */}
          <AnimatePresence>
            {showEmailForm && selectedMessage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
                onClick={() => setShowEmailForm(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                >
                  <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">Send Reply Email</h2>
                    <button
                      onClick={() => setShowEmailForm(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        To *
                      </label>
                      <input
                        type="email"
                        value={selectedMessage.email}
                        disabled
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Subject *
                      </label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Enter email subject"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Content (HTML) *
                      </label>
                      <textarea
                        value={emailContent}
                        onChange={(e) => setEmailContent(e.target.value)}
                        placeholder="Enter email content in HTML format..."
                        rows={12}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        You can use HTML tags for formatting. Example: &lt;p&gt;Hello!&lt;/p&gt;
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => setShowEmailForm(false)}
                        disabled={sendingEmail}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSendReplyEmail}
                        disabled={sendingEmail || !emailSubject || !emailContent}
                        className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-4 h-4" />
                        {sendingEmail ? 'Sending...' : 'Send Email'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

