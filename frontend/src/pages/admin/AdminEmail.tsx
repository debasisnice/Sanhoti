import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Send, Users, Shield, Building2, TestTube, Save, Eye, EyeOff } from 'lucide-react';
import { settingsAPI, emailAPI } from '../../services/api';
import toast from 'react-hot-toast';

type EmailRecipient = 'members' | 'admins' | 'organizations';

export default function AdminEmail() {
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [emailPassword, setEmailPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState<string>('');
  
  const [recipientType, setRecipientType] = useState<EmailRecipient>('members');
  const [subject, setSubject] = useState<string>('');
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [organizations, setOrganizations] = useState<string>('');

  useEffect(() => {
    fetchEmailSettings();
  }, []);

  const fetchEmailSettings = async () => {
    try {
      setLoading(true);
      const settings = await settingsAPI.getEmailSettings();
      if (settings.emailAddress) setEmailAddress(settings.emailAddress);
      // Don't load password for security reasons
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch email settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmailSettings = async () => {
    if (!emailAddress || !emailPassword) {
      toast.error('Please enter both email address and password');
      return;
    }

    try {
      setSaving(true);
      await settingsAPI.updateEmailSettings(emailAddress, emailPassword);
      toast.success('Email settings saved successfully');
      setEmailPassword(''); // Clear password field after saving
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save email settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailTo) {
      toast.error('Please enter a recipient email address');
      return;
    }

    try {
      setTesting(true);
      await emailAPI.testEmail(testEmailTo);
      toast.success('Test email sent successfully!');
      setTestEmailTo('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!subject || !htmlContent) {
      toast.error('Please enter both subject and email content');
      return;
    }

    try {
      setSending(true);
      
      if (recipientType === 'members') {
        await emailAPI.sendToMembers(subject, htmlContent);
        toast.success('Email sent successfully to all members');
      } else if (recipientType === 'admins') {
        await emailAPI.sendToAdmins(subject, htmlContent);
        toast.success('Email sent successfully to all admins');
      } else if (recipientType === 'organizations') {
        const orgList = organizations.split(',').map(email => email.trim()).filter(email => email);
        if (orgList.length === 0) {
          toast.error('Please enter at least one organization email address');
          return;
        }
        await emailAPI.sendToOrganizations(orgList, subject, htmlContent);
        toast.success(`Email sent successfully to ${orgList.length} organization(s)`);
      }

      // Reset form
      setSubject('');
      setHtmlContent('');
      setOrganizations('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send email');
    } finally {
      setSending(false);
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Management</h1>
        <p className="text-gray-600">Configure email settings and send emails to members, admins, or organizations</p>
      </div>

      {/* Email Configuration */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Configuration
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="sanhoti.info@gmail.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="Enter email password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              For Gmail, you may need to use an App Password instead of your regular password.
            </p>
          </div>
          <button
            onClick={handleSaveEmailSettings}
            disabled={saving || !emailAddress || !emailPassword}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Email Settings'}
          </button>
        </div>
      </div>

      {/* Test Email */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TestTube className="w-5 h-5" />
          Test Email Configuration
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Send Test Email To
            </label>
            <input
              type="email"
              value={testEmailTo}
              onChange={(e) => setTestEmailTo(e.target.value)}
              placeholder="your-email@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleTestEmail}
            disabled={testing || !testEmailTo}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TestTube className="w-4 h-4" />
            {testing ? 'Sending...' : 'Send Test Email'}
          </button>
        </div>
      </div>

      {/* Send Email */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Send className="w-5 h-5" />
          Send Email
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipient Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setRecipientType('members')}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                  recipientType === 'members'
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="font-medium">All Members</span>
              </button>
              <button
                onClick={() => setRecipientType('admins')}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                  recipientType === 'admins'
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Shield className="w-5 h-5" />
                <span className="font-medium">Admins Only</span>
              </button>
              <button
                onClick={() => setRecipientType('organizations')}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                  recipientType === 'organizations'
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Building2 className="w-5 h-5" />
                <span className="font-medium">Organizations</span>
              </button>
            </div>
          </div>

          {recipientType === 'organizations' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization Email Addresses (comma-separated) *
              </label>
              <input
                type="text"
                value={organizations}
                onChange={(e) => setOrganizations(e.target.value)}
                placeholder="org1@example.com, org2@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Content (HTML) *
            </label>
            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="Enter email content in HTML format..."
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
            />
            <p className="mt-1 text-sm text-gray-500">
              You can use HTML tags for formatting. Example: &lt;p&gt;Hello!&lt;/p&gt;
            </p>
          </div>

          <button
            onClick={handleSendEmail}
            disabled={sending || !subject || !htmlContent || (recipientType === 'organizations' && !organizations)}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
            {sending ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

