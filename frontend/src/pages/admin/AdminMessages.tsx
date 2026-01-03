import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Trash2, User, Phone, Calendar, MessageSquare } from 'lucide-react';
import { messagesAPI } from '../../services/api';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  first_name: string;
  last_name: string;
  email_address: string;
  phone_number?: string;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const allMessages = await messagesAPI.getAll();
      // Sort by date descending (newest first)
      const sorted = allMessages.sort((a, b) => 
        new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime()
      );
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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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
      <div className="flex items-center justify-between mb-6">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Messages List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">All Messages</h2>
              </div>
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => setSelectedMessage(message)}
                    className={`p-4 border-b border-gray-200 cursor-pointer transition-colors ${
                      selectedMessage?.id === message.id
                        ? 'bg-primary-50 border-l-4 border-l-primary-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {message.first_name} {message.last_name}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">{message.email_address}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(message.id);
                        }}
                        className="text-red-600 hover:text-red-900 ml-2"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mt-2">
                      {message.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatDate(message.createdAt)}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Message Detail */}
          <div className="lg:col-span-2">
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
                            {selectedMessage.first_name} {selectedMessage.last_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <Mail className="w-5 h-5 text-gray-400 mt-1" />
                        <div>
                          <p className="text-sm text-gray-500">Email</p>
                          <a
                            href={`mailto:${selectedMessage.email_address}`}
                            className="font-medium text-primary-600 hover:text-primary-700"
                          >
                            {selectedMessage.email_address}
                          </a>
                        </div>
                      </div>
                      {selectedMessage.phone_number && (
                        <div className="flex items-start space-x-3">
                          <Phone className="w-5 h-5 text-gray-400 mt-1" />
                          <div>
                            <p className="text-sm text-gray-500">Phone</p>
                            <a
                              href={`tel:${selectedMessage.phone_number}`}
                              className="font-medium text-gray-900"
                            >
                              {selectedMessage.phone_number}
                            </a>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start space-x-3">
                        <Calendar className="w-5 h-5 text-gray-400 mt-1" />
                        <div>
                          <p className="text-sm text-gray-500">Date</p>
                          <p className="font-medium text-gray-900">
                            {formatDate(selectedMessage.createdAt || selectedMessage.created_at)}
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
                    <a
                      href={`mailto:${selectedMessage.email_address}?subject=Re: Your Message from Sanhoti Website`}
                      className="flex items-center space-x-2 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Reply via Email</span>
                    </a>
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
        </div>
      )}
    </div>
  );
}

