import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Users } from 'lucide-react';
import { settingsAPI, usersAPI } from '../../services/api';
import toast from 'react-hot-toast';

interface NavbarSettings {
  home: boolean;
  about: boolean;
  events: boolean;
  noticeBoard: boolean;
  galleries: boolean;
  magazines: boolean;
  contactUs: boolean;
  committee: boolean;
}

interface SettingsData {
  navbar: NavbarSettings;
  updated_at: string;
}

interface User {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  userType?: string;
  memberType?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

const menuItemLabels: Record<keyof NavbarSettings, string> = {
  home: 'Home',
  about: 'About',
  events: 'Events',
  noticeBoard: 'Notice Board',
  galleries: 'Galleries',
  magazines: 'Magazines',
  contactUs: 'Contact Us',
  committee: 'Committee',
};

type TabType = 'navbar' | 'users';

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<TabType>('navbar');
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<User>>({});

  useEffect(() => {
    fetchSettings();
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      const data = await settingsAPI.getSettings();
      setSettings(data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await usersAPI.getAll();
      setUsers(data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch users');
    }
  };

  const handleToggle = async (key: keyof NavbarSettings) => {
    if (!settings) return;

    const updatedNavbar = {
      ...settings.navbar,
      [key]: !settings.navbar[key],
    };

    try {
      setSaving(true);
      const updated = await settingsAPI.updateNavbarSettings(updatedNavbar);
      setSettings(updated);
      toast.success('Settings updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      address1: user.address1 || '',
      address2: user.address2 || '',
      city: user.city || '',
      state: user.state || '',
      zip: user.zip || '',
      country: user.country || '',
      userType: user.userType || 'user',
      memberType: user.memberType || 'member',
      isActive: user.isActive !== false,
    });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditFormData({});
  };

  const handleSaveUser = async (userId: string) => {
    try {
      setSaving(true);
      // Transform to backend format (snake_case)
      const backendData = {
        first_name: editFormData.firstName,
        last_name: editFormData.lastName,
        email_address: editFormData.email,
        phone_number: editFormData.phone || '',
        address1: editFormData.address1 || '',
        address2: editFormData.address2 || '',
        city: editFormData.city || '',
        state: editFormData.state || '',
        zip: editFormData.zip || '',
        country: editFormData.country || '',
        user_type: editFormData.userType || 'user',
        member_type: editFormData.memberType || 'member',
        is_active: editFormData.isActive !== false,
      };

      await usersAPI.update(userId, backendData);
      toast.success('User updated successfully');
      setEditingUserId(null);
      setEditFormData({});
      await fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (loading && !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage website settings and configurations</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('navbar')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'navbar'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                <span>Navbar Menu Visibility</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span>Users</span>
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'navbar' && settings && (
            <div>
              <div className="mb-6">
                <p className="text-gray-600">
                  Control which menu items are visible in the navigation bar. Toggle items on or off to show or hide them from the public navigation.
                </p>
              </div>

              <div className="space-y-4">
                {(Object.keys(menuItemLabels) as Array<keyof NavbarSettings>).map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <h3 className="font-semibold text-gray-900">{menuItemLabels[key]}</h3>
                      <p className="text-sm text-gray-500">
                        {settings.navbar[key] ? 'Visible in navbar' : 'Hidden from navbar'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggle(key)}
                      disabled={saving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                        settings.navbar[key] ? 'bg-primary-600' : 'bg-gray-300'
                      } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      aria-label={`Toggle ${menuItemLabels[key]}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.navbar[key] ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              {settings.updated_at && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    Last updated: {new Date(settings.updated_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <div className="mb-6">
                <p className="text-gray-600">
                  View and edit user details. You can update user information, roles, and status.
                </p>
              </div>

              {users.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No users found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Phone</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">User Type</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Member Type</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                          {editingUserId === user.id ? (
                            <td colSpan={7} className="py-4 px-4">
                              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                                    <input
                                      type="text"
                                      value={editFormData.firstName || ''}
                                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                                    <input
                                      type="text"
                                      value={editFormData.lastName || ''}
                                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                      required
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                    <input
                                      type="email"
                                      value={editFormData.email || ''}
                                      onChange={(e) => handleInputChange('email', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                                    <input
                                      type="tel"
                                      value={editFormData.phone || ''}
                                      onChange={(e) => handleInputChange('phone', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                      required
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address 1</label>
                                    <input
                                      type="text"
                                      value={editFormData.address1 || ''}
                                      onChange={(e) => handleInputChange('address1', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address 2</label>
                                    <input
                                      type="text"
                                      value={editFormData.address2 || ''}
                                      onChange={(e) => handleInputChange('address2', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                    <input
                                      type="text"
                                      value={editFormData.city || ''}
                                      onChange={(e) => handleInputChange('city', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                    <input
                                      type="text"
                                      value={editFormData.state || ''}
                                      onChange={(e) => handleInputChange('state', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                                    <input
                                      type="text"
                                      value={editFormData.zip || ''}
                                      onChange={(e) => handleInputChange('zip', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                                  <input
                                    type="text"
                                    value={editFormData.country || ''}
                                    onChange={(e) => handleInputChange('country', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">User Type *</label>
                                    <select
                                      value={editFormData.userType || 'user'}
                                      onChange={(e) => handleInputChange('userType', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                    >
                                      <option value="user">User</option>
                                      <option value="admin">Admin</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Member Type</label>
                                    <input
                                      type="text"
                                      value={editFormData.memberType || ''}
                                      onChange={(e) => handleInputChange('memberType', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                      placeholder="e.g., member, President, etc."
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <label className="flex items-center gap-2 mt-2">
                                      <input
                                        type="checkbox"
                                        checked={editFormData.isActive !== false}
                                        onChange={(e) => handleInputChange('isActive', e.target.checked)}
                                        className="w-4 h-4 text-primary-600 rounded"
                                      />
                                      <span className="text-sm">Active</span>
                                    </label>
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                  <button
                                    onClick={handleCancelEdit}
                                    disabled={saving}
                                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400 disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleSaveUser(user.id)}
                                    disabled={saving}
                                    className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50"
                                  >
                                    {saving ? 'Saving...' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="py-3 px-4 text-sm text-gray-900">
                                {user.firstName} {user.lastName}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600">{user.email}</td>
                              <td className="py-3 px-4 text-sm text-gray-600">{user.phone || '-'}</td>
                              <td className="py-3 px-4 text-sm text-gray-600">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  user.userType === 'admin' 
                                    ? 'bg-purple-100 text-purple-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {user.userType || 'user'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600">{user.memberType || '-'}</td>
                              <td className="py-3 px-4 text-center">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  user.isActive !== false
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {user.isActive !== false ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <button
                                  onClick={() => handleEditUser(user)}
                                  className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
                                >
                                  Edit
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
