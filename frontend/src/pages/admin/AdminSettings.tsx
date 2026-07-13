import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Users, Award, Home, Upload, Trash2, X, UserCircle, QrCode, BookOpen } from 'lucide-react';
import { settingsAPI, usersAPI, sponsorsAPI, homepageAPI, boardMembersAPI, paymentQRAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { convertPSTToLocal } from '../../utils/dateUtils';
import { DEFAULT_HOME_STATEMENTS, DEFAULT_HOME_HERO_BANNER_MESSAGE } from '../../constants/homePageStatements';
import { mergeStatement } from '../../utils/renderHomeStatements';

interface NavbarSettings {
  home: boolean;
  durgaPuja: boolean;
  sponsors: boolean;
  events: boolean;
  noticeBoard: boolean;
  galleries: boolean;
  magazines: boolean;
  news: boolean;
  contactUs: boolean;
  committee: boolean;
  documents: boolean;
  donate: boolean;
  joinUs: boolean;
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
  durgaPuja: 'Durga Puja',
  sponsors: 'Sponsors',
  events: 'Events',
  noticeBoard: 'Notice Board',
  galleries: 'Galleries',
  magazines: 'Magazines',
  news: 'Media',
  contactUs: 'Contact Us',
  committee: 'Committee',
  documents: 'Documents',
  donate: 'Donate',
  joinUs: 'Join Us',
};

type TabType = 'navbar' | 'users' | 'sponsors' | 'homepage' | 'statements' | 'boardmembers' | 'paymentqr';

interface SponsorImage {
  filename: string;
  url: string;
  sponsorshipType?: string;
}

interface HomePageImage {
  filename: string;
  url: string;
}

interface BoardMemberImage {
  postName: string;
  filename: string;
  url: string;
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<TabType>('navbar');
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [sponsorImages, setSponsorImages] = useState<SponsorImage[]>([]);
  const [homePageImages, setHomePageImages] = useState<HomePageImage[]>([]);
  const [boardMemberImages, setBoardMemberImages] = useState<BoardMemberImage[]>([]);
  const [selectedPostName, setSelectedPostName] = useState<string>('President');
  const [postNames, setPostNames] = useState<string[]>(['President', 'Secretary', 'Treasurer', 'Cultural Director', 'Executive Member']);
  const [paymentQRImage, setPaymentQRImage] = useState<string | null>(null);
  const [hasPaymentQRImage, setHasPaymentQRImage] = useState<boolean>(false);
  const [zellePhoneNumber, setZellePhoneNumber] = useState<string>('');
  const [selectedPaymentQRFile, setSelectedPaymentQRFile] = useState<File | null>(null);
  const [facebookLink, setFacebookLink] = useState<string>('');
  const [whatsappLink, setWhatsappLink] = useState<string>('');
  const [instagramLink, setInstagramLink] = useState<string>('');
  const [committeeYear, setCommitteeYear] = useState<string>('2025');
  const [stmtAbout, setStmtAbout] = useState('');
  const [stmtVision, setStmtVision] = useState('');
  const [stmtMission, setStmtMission] = useState('');
  const [stmtPurpose, setStmtPurpose] = useState('');
  const [stmtTabVisible, setStmtTabVisible] = useState({
    about: true,
    vision: true,
    mission: true,
    purpose: true,
  });
  const [homeHeroBannerMessage, setHomeHeroBannerMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedBoardMemberFile, setSelectedBoardMemberFile] = useState<File | null>(null);
  const [selectedSponsorshipType, setSelectedSponsorshipType] = useState<string>('None');
  const [editingSponsorType, setEditingSponsorType] = useState<Record<string, string>>({});
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<User>>({});
  const [showAddUserForm, setShowAddUserForm] = useState<boolean>(false);
  const [newUserFormData, setNewUserFormData] = useState<Partial<User & { password: string }>>({});

  useEffect(() => {
    fetchSettings();
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'sponsors') {
      fetchSponsorImages();
    } else if (activeTab === 'homepage') {
      fetchHomePageImages();
      fetchSettings(); // Fetch settings to load social links
    } else if (activeTab === 'statements') {
      fetchSettings();
    } else if (activeTab === 'boardmembers') {
      fetchBoardMemberImages();
      fetchPostNames();
      fetchCommitteeYear();
    } else if (activeTab === 'paymentqr') {
      fetchPaymentQRImage();
      fetchZellePhoneNumber();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      const data = await settingsAPI.getSettings();
      setSettings(data);
      // Load social media links
      if (data.facebookLink) setFacebookLink(data.facebookLink);
      if (data.whatsappLink) setWhatsappLink(data.whatsappLink);
      if (data.instagramLink) setInstagramLink(data.instagramLink);
      if (data.committeeYear) setCommitteeYear(data.committeeYear);
      const st = data.statements as Record<string, string | undefined> | undefined;
      setStmtAbout(mergeStatement(st?.about, DEFAULT_HOME_STATEMENTS.about));
      setStmtVision(mergeStatement(st?.vision, DEFAULT_HOME_STATEMENTS.vision));
      setStmtMission(mergeStatement(st?.mission, DEFAULT_HOME_STATEMENTS.mission));
      setStmtPurpose(mergeStatement(st?.purpose, DEFAULT_HOME_STATEMENTS.purpose));
      const tv = data.statementTabsVisibility as Record<string, boolean | undefined> | undefined;
      setStmtTabVisible({
        about: tv?.about !== false,
        vision: tv?.vision !== false,
        mission: tv?.mission !== false,
        purpose: tv?.purpose !== false,
      });
      const heroRaw = (data as { homeHeroBannerMessage?: string }).homeHeroBannerMessage;
      setHomeHeroBannerMessage(heroRaw ?? '');
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

  const fetchSponsorImages = async () => {
    try {
      const images = await sponsorsAPI.getImages();
      setSponsorImages(images);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch sponsor images');
    }
  };

  const fetchHomePageImages = async () => {
    try {
      const images = await homepageAPI.getImages();
      setHomePageImages(images);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch homepage images');
    }
  };

  const fetchBoardMemberImages = async () => {
    try {
      const images = await boardMembersAPI.getImages();
      setBoardMemberImages(images);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch board member images');
    }
  };

  const fetchPostNames = async () => {
    try {
      const names = await boardMembersAPI.getPostNames();
      setPostNames(names);
      if (names.length > 0 && !names.includes(selectedPostName)) {
        setSelectedPostName(names[0]);
      }
    } catch (error: any) {
      // Use default post names if API fails
      console.error('Failed to fetch post names:', error);
    }
  };

  const fetchPaymentQRImage = async () => {
    try {
      const result = await paymentQRAPI.hasImage();
      setHasPaymentQRImage(result.hasImage);
      if (result.hasImage) {
        setPaymentQRImage(paymentQRAPI.getImageUrl());
      } else {
        setPaymentQRImage(null);
      }
    } catch (error: any) {
      setHasPaymentQRImage(false);
      setPaymentQRImage(null);
    }
  };

  const fetchZellePhoneNumber = async () => {
    try {
      const settings = await settingsAPI.getSettings();
      setZellePhoneNumber(settings.zellePhoneNumber || '');
    } catch (error: any) {
      console.error('Failed to fetch Zelle phone number:', error);
    }
  };

  const fetchCommitteeYear = async () => {
    try {
      const settings = await settingsAPI.getSettings();
      setCommitteeYear(settings.committeeYear || '2025');
    } catch (error: any) {
      console.error('Failed to fetch committee year:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name));
      setSelectedFiles(imageFiles);
    }
  };

  const handleUpload = async () => {
    // Validate based on active tab
    if (activeTab === 'boardmembers') {
      if (!selectedBoardMemberFile) {
        toast.error('Please select an image file');
        return;
      }
    } else if (activeTab === 'paymentqr') {
      if (!selectedPaymentQRFile) {
        toast.error('Please select an image file');
        return;
      }
    } else {
      if (selectedFiles.length === 0) {
        toast.error('Please select at least one image file');
        return;
      }
    }

    try {
      setUploading(true);
      if (activeTab === 'sponsors') {
        await sponsorsAPI.uploadImages(selectedFiles, selectedSponsorshipType);
        toast.success('Images uploaded successfully');
        setSelectedFiles([]);
        setSelectedSponsorshipType('None');
        const fileInput = document.getElementById('sponsor-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        await fetchSponsorImages();
      } else if (activeTab === 'homepage') {
        await homepageAPI.uploadImages(selectedFiles);
        toast.success('Images uploaded successfully');
        setSelectedFiles([]);
        const fileInput = document.getElementById('homepage-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        await fetchHomePageImages();
      } else if (activeTab === 'boardmembers') {
        await boardMembersAPI.uploadImage(selectedBoardMemberFile!, selectedPostName);
        toast.success('Image uploaded successfully');
        setSelectedBoardMemberFile(null);
        const fileInput = document.getElementById('boardmember-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        await fetchBoardMemberImages();
      } else if (activeTab === 'paymentqr') {
        await paymentQRAPI.uploadImage(selectedPaymentQRFile!);
        toast.success('Image uploaded successfully');
        setSelectedPaymentQRFile(null);
        const fileInput = document.getElementById('paymentqr-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        await fetchPaymentQRImage();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateSponsorshipType = async (filename: string, newType: string) => {
    try {
      await sponsorsAPI.updateSponsorshipType(filename, newType);
      toast.success('Sponsorship type updated successfully');
      await fetchSponsorImages();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update sponsorship type');
    }
  };

  const handleDeleteImage = async (filename: string) => {
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      setDeleting(true);
      if (activeTab === 'sponsors') {
        await sponsorsAPI.deleteImage(filename);
        toast.success('Image deleted successfully');
        await fetchSponsorImages();
      } else if (activeTab === 'homepage') {
        await homepageAPI.deleteImage(filename);
        toast.success('Image deleted successfully');
        await fetchHomePageImages();
      } else if (activeTab === 'boardmembers') {
        await boardMembersAPI.deleteImageByPostName(filename);
        toast.success('Image deleted successfully');
        await fetchBoardMemberImages();
      } else if (activeTab === 'paymentqr') {
        await paymentQRAPI.deleteImage();
        toast.success('Image deleted successfully');
        await fetchPaymentQRImage();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete image');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    const confirmMessage = activeTab === 'sponsors' 
      ? 'Are you sure you want to delete ALL sponsor images? This action cannot be undone.'
      : 'Are you sure you want to delete ALL homepage images? This action cannot be undone.';
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setDeleting(true);
      if (activeTab === 'sponsors') {
        await sponsorsAPI.deleteAllImages();
        toast.success('All images deleted successfully');
        await fetchSponsorImages();
      } else if (activeTab === 'homepage') {
        await homepageAPI.deleteAllImages();
        toast.success('All images deleted successfully');
        await fetchHomePageImages();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete images');
    } finally {
      setDeleting(false);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveZellePhoneNumber = async () => {
    try {
      setSaving(true);
      await settingsAPI.updateZellePhoneNumber(zellePhoneNumber);
      toast.success('Zelle phone number updated successfully');
      await fetchZellePhoneNumber();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update Zelle phone number');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCommitteeYear = async () => {
    try {
      setSaving(true);
      await settingsAPI.updateCommitteeYear(committeeYear);
      toast.success('Committee year updated successfully');
      await fetchCommitteeYear();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update committee year');
    } finally {
      setSaving(false);
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

  type StatementTabKey = 'about' | 'vision' | 'mission' | 'purpose';

  const toggleStatementTabOnHomePage = async (key: StatementTabKey) => {
    const nextVisible = !stmtTabVisible[key];
    if (!nextVisible) {
      const othersOn = (['about', 'vision', 'mission', 'purpose'] as StatementTabKey[])
        .filter((k) => k !== key)
        .some((k) => stmtTabVisible[k]);
      if (!othersOn) {
        toast.error('At least one tab must stay visible on the home page');
        return;
      }
    }
    try {
      setSaving(true);
      await settingsAPI.updateHomeStatements({ tabVisibility: { [key]: nextVisible } });
      setStmtTabVisible((prev) => ({ ...prev, [key]: nextVisible }));
      toast.success('Home page tab visibility updated');
      await fetchSettings();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update tab visibility');
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

  const handleNewUserInputChange = (field: string, value: any) => {
    setNewUserFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateUser = async () => {
    if (!newUserFormData.firstName || !newUserFormData.lastName || !newUserFormData.email || !newUserFormData.phone || !newUserFormData.password) {
      toast.error('Please fill in all required fields (First Name, Last Name, Email, Phone, Password)');
      return;
    }

    try {
      setSaving(true);
      // Transform to backend format (snake_case)
      const backendData = {
        first_name: newUserFormData.firstName,
        last_name: newUserFormData.lastName,
        email_address: newUserFormData.email,
        phone_number: newUserFormData.phone || '',
        password: newUserFormData.password,
        address1: newUserFormData.address1 || '',
        address2: newUserFormData.address2 || '',
        city: newUserFormData.city || '',
        state: newUserFormData.state || '',
        zip: newUserFormData.zip || '',
        country: newUserFormData.country || '',
        user_type: newUserFormData.userType || 'user',
        member_type: newUserFormData.memberType || 'member',
        is_active: newUserFormData.isActive !== false,
      };

      await usersAPI.create(backendData);
      toast.success('User created successfully');
      setShowAddUserForm(false);
      setNewUserFormData({});
      await fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setSaving(true);
      await usersAPI.delete(userId);
      toast.success('User deleted successfully');
      await fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete user');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelAddUser = () => {
    setShowAddUserForm(false);
    setNewUserFormData({});
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
          <nav className="flex -mb-px overflow-x-auto">
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
            <button
              onClick={() => setActiveTab('sponsors')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sponsors'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                <span>Sponsors</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('homepage')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'homepage'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Home className="w-5 h-5" />
                <span>Home Page</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('statements')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'statements'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                <span>Statements</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('boardmembers')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'boardmembers'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <UserCircle className="w-5 h-5" />
                <span>Board Members</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('paymentqr')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'paymentqr'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                <span>Payment QR</span>
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
                    Last updated: {convertPSTToLocal(settings.updated_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <p className="text-gray-600">
                  View and edit user details. You can update user information, roles, and status.
                </p>
                <button
                  onClick={() => setShowAddUserForm(!showAddUserForm)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  {showAddUserForm ? 'Cancel' : 'Add User'}
                </button>
              </div>

              {showAddUserForm && (
                <div className="mb-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New User</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                        <input
                          type="text"
                          value={newUserFormData.firstName || ''}
                          onChange={(e) => handleNewUserInputChange('firstName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                        <input
                          type="text"
                          value={newUserFormData.lastName || ''}
                          onChange={(e) => handleNewUserInputChange('lastName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                        <input
                          type="email"
                          value={newUserFormData.email || ''}
                          onChange={(e) => handleNewUserInputChange('email', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                        <input
                          type="tel"
                          value={newUserFormData.phone || ''}
                          onChange={(e) => handleNewUserInputChange('phone', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                      <input
                        type="password"
                        value={newUserFormData.password || ''}
                        onChange={(e) => handleNewUserInputChange('password', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address 1</label>
                        <input
                          type="text"
                          value={newUserFormData.address1 || ''}
                          onChange={(e) => handleNewUserInputChange('address1', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address 2</label>
                        <input
                          type="text"
                          value={newUserFormData.address2 || ''}
                          onChange={(e) => handleNewUserInputChange('address2', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input
                          type="text"
                          value={newUserFormData.city || ''}
                          onChange={(e) => handleNewUserInputChange('city', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                        <input
                          type="text"
                          value={newUserFormData.state || ''}
                          onChange={(e) => handleNewUserInputChange('state', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                        <input
                          type="text"
                          value={newUserFormData.zip || ''}
                          onChange={(e) => handleNewUserInputChange('zip', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                      <input
                        type="text"
                        value={newUserFormData.country || ''}
                        onChange={(e) => handleNewUserInputChange('country', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">User Type *</label>
                        <select
                          value={newUserFormData.userType || 'user'}
                          onChange={(e) => handleNewUserInputChange('userType', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Member Type</label>
                        <select
                          value={newUserFormData.memberType || 'member'}
                          onChange={(e) => handleNewUserInputChange('memberType', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        >
                          <option value="member">member</option>
                          <option value="Executive Member">Executive Member</option>
                          <option value="President">President</option>
                          <option value="Secretary">Secretary</option>
                          <option value="Treasurer">Treasurer</option>
                          <option value="Cultural Director">Cultural Director</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <label className="flex items-center gap-2 mt-2">
                          <input
                            type="checkbox"
                            checked={newUserFormData.isActive !== false}
                            onChange={(e) => handleNewUserInputChange('isActive', e.target.checked)}
                            className="w-4 h-4 text-primary-600 rounded"
                          />
                          <span className="text-sm">Active</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={handleCancelAddUser}
                        disabled={saving}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateUser}
                        disabled={saving}
                        className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50"
                      >
                        {saving ? 'Creating...' : 'Create User'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {users.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No users found</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <div className="inline-block min-w-full align-middle px-4 md:px-0">
                    <table className="w-full min-w-[800px] md:min-w-0">
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                    <select
                                      value={editFormData.memberType || 'member'}
                                      onChange={(e) => handleInputChange('memberType', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                    >
                                      <option value="member">member</option>
                                      <option value="Executive Member">Executive Member</option>
                                      <option value="President">President</option>
                                      <option value="Secretary">Secretary</option>
                                      <option value="Treasurer">Treasurer</option>
                                      <option value="Cultural Director">Cultural Director</option>
                                    </select>
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
                                <div className="flex items-center gap-2 justify-center">
                                  <button
                                    onClick={() => handleEditUser(user)}
                                    className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(user.id || user.userId, `${user.firstName} ${user.lastName}`)}
                                    className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center gap-1"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sponsors' && (
            <div>
              <div className="mb-6">
                <p className="text-gray-600">
                  Upload and manage sponsor images. These images will be displayed on the public Sponsors page.
                </p>
              </div>

              {/* Upload Section */}
              <div className="mb-8 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload New Images</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Images (jpg, png, gif, webp - Max 10MB each)
                    </label>
                    <input
                      id="sponsor-file-input"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      multiple
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-700"
                    />
                  </div>
                  {selectedFiles.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sponsorship Type
                      </label>
                            <select
                              value={selectedSponsorshipType}
                              onChange={(e) => setSelectedSponsorshipType(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            >
                              <option value="None">None</option>
                              <option value="Grand">Grand</option>
                              <option value="Platinum">Platinum</option>
                              <option value="Gold">Gold</option>
                              <option value="Silver">Silver</option>
                            </select>
                    </div>
                  )}

                  {selectedFiles.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Selected Files ({selectedFiles.length}):</p>
                      <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                            <span className="text-sm text-gray-700 truncate">{file.name}</span>
                            <button
                              onClick={() => removeSelectedFile(index)}
                              className="ml-2 text-red-600 hover:text-red-800"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        {uploading ? 'Uploading...' : 'Upload Images'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Existing Images Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Existing Images ({sponsorImages.length})
                  </h3>
                  {sponsorImages.length > 0 && (
                    <button
                      onClick={handleDeleteAll}
                      disabled={deleting}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete All
                    </button>
                  )}
                </div>

                {sponsorImages.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No sponsor images uploaded yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {sponsorImages.map((image) => (
                      <div
                        key={image.filename}
                        className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow relative group"
                      >
                        <div className="aspect-square bg-gray-100 relative overflow-hidden">
                          <img
                            src={image.url}
                            alt={image.filename}
                            className="w-full h-full object-contain p-2"
                            onError={(e) => {
                              console.error('Failed to load image:', image.url);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <button
                            onClick={() => handleDeleteImage(image.filename)}
                            disabled={deleting}
                            className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50"
                            title="Delete image"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="p-2">
                          <div className="mb-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Sponsorship Type
                            </label>
                            <select
                              value={editingSponsorType[image.filename] ?? image.sponsorshipType ?? 'None'}
                              onChange={(e) => {
                                setEditingSponsorType(prev => ({ ...prev, [image.filename]: e.target.value }));
                                handleUpdateSponsorshipType(image.filename, e.target.value);
                              }}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                            >
                              <option value="None">None</option>
                              <option value="Grand">Grand</option>
                              <option value="Platinum">Platinum</option>
                              <option value="Gold">Gold</option>
                              <option value="Silver">Silver</option>
                            </select>
                          </div>
                          <p className="text-xs text-gray-500 truncate" title={image.filename}>
                            {image.filename}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'statements' && (
            <div>
              <div className="mb-6">
                <p className="text-gray-600 mb-2">
                  Edit the About Us, Vision, Mission, and Purpose content shown in the home page section. Use a blank line between paragraphs. For bullet lists (e.g. Purpose), start each bullet line with <code className="text-sm bg-gray-100 px-1 rounded">- </code>. Use the toggle on each block to show or hide that tab on the public home page (at least one tab must stay visible).
                </p>
              </div>
              <div className="space-y-6">
                {(
                  [
                    { key: 'about' as const, label: 'About Us', value: stmtAbout, set: setStmtAbout },
                    { key: 'vision' as const, label: 'Vision', value: stmtVision, set: setStmtVision },
                    { key: 'mission' as const, label: 'Mission', value: stmtMission, set: setStmtMission },
                    { key: 'purpose' as const, label: 'Purpose', value: stmtPurpose, set: setStmtPurpose },
                  ] as const
                ).map(({ key, label, value, set }) => (
                  <div key={key}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                      <label className="block text-sm font-medium text-gray-700">{label}</label>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">
                          {stmtTabVisible[key] ? 'Shown on home page' : 'Hidden on home page'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleStatementTabOnHomePage(key)}
                          disabled={saving}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                            stmtTabVisible[key] ? 'bg-primary-600' : 'bg-gray-300'
                          } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          aria-label={`Toggle ${label} on home page`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              stmtTabVisible[key] ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      rows={key === 'about' || key === 'purpose' ? 14 : 8}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setSaving(true);
                      await settingsAPI.updateHomeStatements({
                        about: stmtAbout,
                        vision: stmtVision,
                        mission: stmtMission,
                        purpose: stmtPurpose,
                        tabVisibility: { ...stmtTabVisible },
                      });
                      toast.success('Statements saved');
                      await fetchSettings();
                    } catch (error: any) {
                      toast.error(error.response?.data?.error || 'Failed to save statements');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save statements'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'homepage' && (
            <div>
              <div className="mb-6">
                <p className="text-gray-600">
                  Upload and manage homepage images. These images will be stored in the HomePage_Images directory.
                </p>
              </div>

              <div className="mb-4 sm:mb-8 px-2 py-3 sm:p-6 bg-white rounded-lg border border-gray-200">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">Hero banner message</h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-4 leading-snug">
                  Text shown in the center of the home page hero (red border, Bengali-friendly font). Clear the
                  field and save to hide the banner.
                </p>
                <label
                  htmlFor="home-hero-banner"
                  className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2"
                >
                  Message
                </label>
                <textarea
                  id="home-hero-banner"
                  value={homeHeroBannerMessage}
                  onChange={(e) => setHomeHeroBannerMessage(e.target.value)}
                  rows={2}
                  placeholder={DEFAULT_HOME_HERO_BANNER_MESSAGE}
                  className="block w-full px-1.5 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 font-bengali text-base sm:text-lg"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setSaving(true);
                      await settingsAPI.updateHomeHeroBanner(homeHeroBannerMessage.trim());
                      toast.success('Hero banner saved');
                      await fetchSettings();
                    } catch (error: any) {
                      toast.error(error.response?.data?.error || 'Failed to save hero banner');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="mt-2 sm:mt-4 px-2.5 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save hero banner'}
                </button>
              </div>

              {/* Social Links Section */}
              <div className="mb-8 p-6 bg-white rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Media Links</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Facebook Link
                    </label>
                    <input
                      type="url"
                      value={facebookLink}
                      onChange={(e) => setFacebookLink(e.target.value)}
                      placeholder="https://m.facebook.com/groups/..."
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      WhatsApp Link
                    </label>
                    <input
                      type="url"
                      value={whatsappLink}
                      onChange={(e) => setWhatsappLink(e.target.value)}
                      placeholder="https://chat.whatsapp.com/..."
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Instagram Link
                    </label>
                    <input
                      type="url"
                      value={instagramLink}
                      onChange={(e) => setInstagramLink(e.target.value)}
                      placeholder="https://www.instagram.com/..."
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        setSaving(true);
                        await settingsAPI.updateSocialLinks(facebookLink, whatsappLink, instagramLink);
                        toast.success('Social links updated successfully');
                        await fetchSettings();
                      } catch (error: any) {
                        toast.error(error.response?.data?.error || 'Failed to update social links');
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving ? 'Saving...' : 'Save Links'}
                  </button>
                </div>
              </div>

              {/* Upload Section */}
              <div className="mb-8 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload New Images</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Images (jpg, png, gif, webp - Max 10MB each)
                    </label>
                    <input
                      id="homepage-file-input"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      multiple
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-700"
                    />
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Selected Files ({selectedFiles.length}):</p>
                      <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                            <span className="text-sm text-gray-700 truncate">{file.name}</span>
                            <button
                              onClick={() => removeSelectedFile(index)}
                              className="ml-2 text-red-600 hover:text-red-800"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        {uploading ? 'Uploading...' : 'Upload Images'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Existing Images Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Existing Images ({homePageImages.length})
                  </h3>
                  {homePageImages.length > 0 && (
                    <button
                      onClick={handleDeleteAll}
                      disabled={deleting}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete All
                    </button>
                  )}
                </div>

                {homePageImages.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No homepage images uploaded yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {homePageImages.map((image) => (
                      <div
                        key={image.filename}
                        className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow relative group"
                      >
                        <div className="aspect-square bg-gray-100 relative overflow-hidden">
                          <img
                            src={image.url}
                            alt={image.filename}
                            className="w-full h-full object-contain p-2"
                            onError={(e) => {
                              console.error('Failed to load image:', image.url);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <button
                            onClick={() => handleDeleteImage(image.filename)}
                            disabled={deleting}
                            className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50"
                            title="Delete image"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="p-2">
                          <p className="text-xs text-gray-600 truncate" title={image.filename}>
                            {image.filename}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'boardmembers' && (
            <div>
              <div className="mb-6">
                <p className="text-gray-600">
                  Upload and manage board member images. Select a post name from the dropdown and upload an image. The image will be stored in the BoardMembers directory with the post name as the filename.
                </p>
              </div>

              {/* Committee Year Section */}
              <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Executive Committee Year</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Committee Year/Term
                    </label>
                    <input
                      type="text"
                      value={committeeYear}
                      onChange={(e) => setCommitteeYear(e.target.value)}
                      placeholder="e.g., 2025, 2025-2026, 2026-2027"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Enter the committee year or term (e.g., "2025", "2025-2026", "2026-2027")
                    </p>
                  </div>
                  <button
                    onClick={handleSaveCommitteeYear}
                    disabled={saving}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving ? 'Saving...' : 'Save Committee Year'}
                  </button>
                </div>
              </div>

              {/* Upload Section */}
              <div className="mb-8 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload New Image</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Post Name
                    </label>
                    <select
                      value={selectedPostName}
                      onChange={(e) => setSelectedPostName(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    >
                      {postNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Image (jpg, png, gif, webp - Max 20MB)
                    </label>
                    <input
                      id="boardmember-file-input"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedBoardMemberFile(e.target.files[0]);
                        }
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-700"
                    />
                  </div>

                  {selectedBoardMemberFile && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Selected File:</p>
                      <div className="flex items-center justify-between p-2 bg-white rounded border">
                        <span className="text-sm text-gray-700 truncate">{selectedBoardMemberFile.name}</span>
                        <button
                          onClick={() => {
                            setSelectedBoardMemberFile(null);
                            const fileInput = document.getElementById('boardmember-file-input') as HTMLInputElement;
                            if (fileInput) fileInput.value = '';
                          }}
                          className="ml-2 text-red-600 hover:text-red-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        {uploading ? 'Uploading...' : 'Upload Image'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Existing Images Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Existing Images ({boardMemberImages.length})
                  </h3>
                </div>

                {boardMemberImages.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No board member images uploaded yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {boardMemberImages.map((image) => (
                      <div key={image.postName} className="relative group bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="aspect-square relative bg-gray-100">
                          <img
                            src={image.url}
                            alt={image.postName}
                            className="w-full h-full object-contain p-2"
                            onError={(e) => {
                              console.error('Failed to load image:', image.url);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <button
                            onClick={() => handleDeleteImage(image.postName)}
                            disabled={deleting}
                            className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50"
                            title="Delete image"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-semibold text-gray-900 truncate" title={image.postName}>
                            {image.postName}
                          </p>
                          <p className="text-xs text-gray-600 truncate" title={image.filename}>
                            {image.filename}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'paymentqr' && (
            <div>
              <div className="mb-6">
                <p className="text-gray-600">
                  Upload and manage the payment QR code image. Only one image can be stored at a time. Uploading a new image will replace the existing one.
                </p>
              </div>

              {/* Zelle Phone Number Section */}
              <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Zelle Phone Number</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={zellePhoneNumber}
                      onChange={(e) => setZellePhoneNumber(e.target.value)}
                      placeholder="e.g., +1 949-378-6425"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <button
                    onClick={handleSaveZellePhoneNumber}
                    disabled={saving}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving ? 'Saving...' : 'Save Phone Number'}
                  </button>
                </div>
              </div>

              {/* Upload Section */}
              <div className="mb-8 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Payment QR Image</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Image (jpg, png, gif, webp - Max 20MB)
                    </label>
                    <input
                      id="paymentqr-file-input"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedPaymentQRFile(e.target.files[0]);
                        }
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-700"
                    />
                  </div>

                  {selectedPaymentQRFile && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Selected File:</p>
                      <div className="flex items-center justify-between p-2 bg-white rounded border">
                        <span className="text-sm text-gray-700 truncate">{selectedPaymentQRFile.name}</span>
                        <button
                          onClick={() => {
                            setSelectedPaymentQRFile(null);
                            const fileInput = document.getElementById('paymentqr-file-input') as HTMLInputElement;
                            if (fileInput) fileInput.value = '';
                          }}
                          className="ml-2 text-red-600 hover:text-red-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        {uploading ? 'Uploading...' : 'Upload Image'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Existing Image Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Current Payment QR Image
                  </h3>
                  {hasPaymentQRImage && (
                    <button
                      onClick={() => handleDeleteImage('paymentqr')}
                      disabled={deleting}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Image
                    </button>
                  )}
                </div>

                {!hasPaymentQRImage ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No payment QR image uploaded yet.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="p-4">
                      <img
                        src={paymentQRImage || ''}
                        alt="Payment QR Code"
                        className="w-full max-w-md mx-auto object-contain"
                        onError={(e) => {
                          console.error('Failed to load image:', paymentQRImage);
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </motion.div>
  );
}
