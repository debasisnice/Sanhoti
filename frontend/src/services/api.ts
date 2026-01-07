import axios from 'axios';
import { AuthResponse, Event, RSVP, Notice, PhotoGallery, Magazine, Document, SubEvent, AuditLog } from '../types';

// Use relative path in production (when served by Nginx), absolute URL in development
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5001/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  register: async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    phoneNumber?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  }): Promise<AuthResponse> => {
    // Transform to snake_case for backend
    const backendData = {
      email_address: data.email,
      password: data.password,
      first_name: data.firstName,
      last_name: data.lastName,
      phone_number: data.phoneNumber || data.phone || '',
      address1: data.address1,
      address2: data.address2,
      city: data.city,
      state: data.state,
      zip: data.zip,
      country: data.country,
    };
    const response = await api.post('/auth/register', backendData);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { email_address: email, email, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getProfile: async (): Promise<any> => {
    const response = await api.get('/auth/profile');
    return response.data;
  },
};

// Events API
export const eventsAPI = {
  getUpcoming: async (): Promise<Event[]> => {
    const response = await api.get('/events/upcoming');
    return response.data;
  },

  getPast: async (): Promise<Event[]> => {
    const response = await api.get('/events/past');
    return response.data;
  },

  getById: async (id: string): Promise<Event> => {
    const response = await api.get(`/events/${id}`);
    return response.data;
  },

  getAll: async (): Promise<Event[]> => {
    const response = await api.get('/events/all');
    return response.data;
  },

  create: async (data: {
    event_name: string;
    event_start_dt: string;
    event_end_dt: string;
    year: number;
    event_description: string;
    location?: string;
    photo_gallery_link?: string;
    is_priority?: boolean;
  }): Promise<Event> => {
    const response = await api.post('/events', data);
    return response.data;
  },

  update: async (eventId: string, data: Partial<{
    event_name: string;
    event_start_dt: string;
    event_end_dt: string;
    year: number;
    event_description: string;
    location?: string;
    photo_gallery_link?: string;
    is_active?: boolean;
    is_priority?: boolean;
  }>): Promise<Event> => {
    const response = await api.put(`/events/${eventId}`, data);
    return response.data;
  },

  delete: async (eventId: string): Promise<void> => {
    await api.delete(`/events/${eventId}`);
  },

  deactivate: async (eventId: string): Promise<Event> => {
    const response = await api.post(`/events/${eventId}/deactivate`);
    return response.data;
  },

  activate: async (eventId: string): Promise<Event> => {
    const response = await api.post(`/events/${eventId}/activate`);
    return response.data;
  },

  getGalleryFolders: async (): Promise<Array<{ folderName: string; folderPath: string; event_id?: string; event_name?: string; year?: number; gallery_is_public?: boolean; is_active?: boolean; event_start_dt?: string }>> => {
    const response = await api.get('/galleries/folders');
    return response.data;
  },

  toggleGalleryPublish: async (eventId: string, isPublic: boolean): Promise<Event> => {
    const response = await api.post(`/events/${eventId}/gallery/publish`, { isPublic });
    return response.data;
  },

  uploadImage: async (eventId: string, imageFile: File): Promise<any> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    const response = await api.post(`/events/${eventId}/upload-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getImages: async (eventId: string): Promise<Array<{ filename: string; url: string }>> => {
    const response = await api.get(`/events/${eventId}/images`);
    return response.data;
  },

  getImageUrl: (eventId: string, filename: string): string => {
    return `${API_BASE_URL}/events/${eventId}/image/${encodeURIComponent(filename)}`;
  },

  getImagePublic: async (eventId: string): Promise<{ filename: string; url: string } | null> => {
    try {
      const response = await api.get(`/events/${eventId}/image-public`);
      return response.data;
    } catch (error) {
      return null;
    }
  },
};

// Sub-Events API
export const subEventsAPI = {
  getAll: async (): Promise<SubEvent[]> => {
    const response = await api.get('/sub-events');
    return response.data;
  },

  getByEventId: async (eventId: string): Promise<SubEvent[]> => {
    // Use public endpoint (no auth required)
    const response = await axios.get(`${API_BASE_URL}/sub-events/event/${eventId}`);
    return response.data;
  },

  getById: async (id: string): Promise<SubEvent> => {
    const response = await api.get(`/sub-events/${id}`);
    return response.data;
  },

  create: async (data: {
    sub_event_name: string;
    sub_event_start_dt: string;
    sub_event_end_dt: string;
    year: number;
    event_description: string;
    location: string;
    is_active: boolean;
    event_id: string;
    rsvp_link?: string;
  }): Promise<SubEvent> => {
    const response = await api.post('/sub-events', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    sub_event_name: string;
    sub_event_start_dt: string;
    sub_event_end_dt: string;
    event_description: string;
    location: string;
    is_active: boolean;
    rsvp_link: string;
  }>): Promise<SubEvent> => {
    const response = await api.put(`/sub-events/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/sub-events/${id}`);
  },

  uploadImage: async (subEventId: string, imageFile: File): Promise<any> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    const response = await api.post(`/sub-events/${subEventId}/upload-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getImageUrl: (subEventId: string, filename: string): string => {
    // Use public endpoint (no auth required)
    return `${API_BASE_URL}/sub-events/${subEventId}/image/${filename}`;
  },

  getImages: async (subEventId: string): Promise<string[]> => {
    // Use public endpoint (no auth required)
    const response = await axios.get(`${API_BASE_URL}/sub-events/${subEventId}/images`);
    return response.data;
  },
};

// RSVP API
export const rsvpAPI = {
  create: async (data: {
    eventId: string;
    email: string;
    name: string;
    phone: string;
    numberOfAdults: number;
    numberOfChildren: number;
  }): Promise<RSVP> => {
    const response = await api.post('/rsvps', data);
    return response.data;
  },

  getMyRSVPs: async (): Promise<RSVP[]> => {
    const response = await api.get('/rsvps/my');
    return response.data;
  },

  getByEvent: async (eventId: string): Promise<RSVP[]> => {
    const response = await api.get(`/rsvps/event/${eventId}`);
    return response.data;
  },

  cancel: async (id: string): Promise<RSVP> => {
    const response = await api.post(`/rsvps/${id}/cancel`);
    return response.data;
  },
};

// Notices API
export const noticesAPI = {
  getPublic: async (): Promise<Notice[]> => {
    const response = await api.get('/notices/public');
    return response.data;
  },
  getAll: async (): Promise<Notice[]> => {
    const response = await api.get('/notices');
    return response.data;
  },
  getById: async (id: string): Promise<Notice> => {
    const response = await api.get(`/notices/${id}`);
    return response.data;
  },
  create: async (data: {
    notice_name: string;
    notice_body: string;
    event_id?: string;
    notice_image_path?: string;
    is_active?: boolean;
    is_published?: boolean;
  }): Promise<Notice> => {
    const response = await api.post('/notices', data);
    return response.data;
  },
  update: async (id: string, data: Partial<{
    notice_name: string;
    notice_body: string;
    event_id?: string;
    notice_image_path?: string;
    is_active?: boolean;
    is_published?: boolean;
  }>): Promise<Notice> => {
    const response = await api.put(`/notices/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/notices/${id}`);
  },
  publish: async (id: string): Promise<Notice> => {
    const response = await api.post(`/notices/${id}/publish`);
    return response.data;
  },
  unpublish: async (id: string): Promise<Notice> => {
    const response = await api.post(`/notices/${id}/unpublish`);
    return response.data;
  },
  uploadImages: async (noticeId: string, files: File[]): Promise<any> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file);
    });
    const response = await api.post(`/notices/${noticeId}/upload-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  getImageUrl: (noticeId: string, filename: string): string => {
    return `${API_BASE_URL}/notices/${noticeId}/images/${filename}`;
  },
  getImages: async (noticeId: string): Promise<Array<{ filename: string; url: string }>> => {
    const response = await api.get(`/notices/${noticeId}/images`);
    return response.data;
  },
};

// Sponsors API
export const sponsorsAPI = {
  getImages: async (): Promise<Array<{ filename: string; url: string; sponsorshipType?: string }>> => {
    const response = await api.get('/sponsors/images');
    return response.data;
  },
  uploadImages: async (files: File[], sponsorshipType: string = 'Silver'): Promise<any> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('images', file);
    });
    formData.append('sponsorshipType', sponsorshipType);
    const response = await api.post('/sponsors/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  updateSponsorshipType: async (filename: string, newType: string): Promise<void> => {
    // This will require renaming the file on the backend
    await api.put(`/sponsors/images/${encodeURIComponent(filename)}/type`, { sponsorshipType: newType });
  },
  deleteImage: async (filename: string): Promise<void> => {
    await api.delete(`/sponsors/images/${encodeURIComponent(filename)}`);
  },
  deleteAllImages: async (): Promise<void> => {
    await api.delete('/sponsors/images');
  },
};

// Homepage Images API
export const homepageAPI = {
  getImages: async (): Promise<Array<{ filename: string; url: string }>> => {
    const response = await api.get('/homepage/images');
    return response.data;
  },
  uploadImages: async (files: File[]): Promise<any> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('images', file);
    });
    const response = await api.post('/homepage/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  deleteImage: async (filename: string): Promise<void> => {
    await api.delete(`/homepage/images/${encodeURIComponent(filename)}`);
  },
  deleteAllImages: async (): Promise<void> => {
    await api.delete('/homepage/images');
  },
};

// Board Members API
export const boardMembersAPI = {
  getImages: async (): Promise<Array<{ postName: string; filename: string; url: string }>> => {
    const response = await api.get('/boardmembers/images');
    return response.data;
  },
  getImageByPostName: async (postName: string): Promise<string> => {
    return `/api/boardmembers/post/${encodeURIComponent(postName)}`;
  },
  getPostNames: async (): Promise<string[]> => {
    const response = await api.get('/boardmembers/postnames');
    return response.data.postNames;
  },
  uploadImage: async (file: File, postName: string): Promise<any> => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('postName', postName);
    const response = await api.post('/boardmembers/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  deleteImageByPostName: async (postName: string): Promise<void> => {
    await api.delete(`/boardmembers/post/${encodeURIComponent(postName)}`);
  },
  deleteImage: async (filename: string): Promise<void> => {
    await api.delete(`/boardmembers/images/${encodeURIComponent(filename)}`);
  },
};

// Payment QR API
export const paymentQRAPI = {
  getImageUrl: (): string => {
    return '/api/paymentqr/image';
  },
  hasImage: async (): Promise<{ hasImage: boolean }> => {
    const response = await api.get('/paymentqr/has-image');
    return response.data;
  },
  uploadImage: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/paymentqr/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  deleteImage: async (): Promise<void> => {
    await api.delete('/paymentqr/image');
  },
};

// Galleries API
export const galleriesAPI = {
  getPublic: async (): Promise<PhotoGallery[]> => {
    const response = await api.get('/galleries/public');
    return response.data;
  },

  getPublicById: async (id: string): Promise<PhotoGallery> => {
    const response = await api.get(`/galleries/public/${id}`);
    return response.data;
  },

  getByAccessCode: async (code: string): Promise<PhotoGallery> => {
    const response = await api.get(`/galleries/access-code/${code}`);
    return response.data;
  },

  getAll: async (): Promise<PhotoGallery[]> => {
    const response = await api.get('/galleries');
    return response.data;
  },

  getById: async (id: string): Promise<PhotoGallery> => {
    const response = await api.get(`/galleries/${id}`);
    return response.data;
  },

  getByEvent: async (eventId: string): Promise<PhotoGallery[]> => {
    const response = await api.get(`/galleries/event/${eventId}`);
    return response.data;
  },

  getGalleryPhotos: async (eventId: string): Promise<any[]> => {
    const response = await api.get(`/galleries/${eventId}/photos`);
    return response.data;
  },

  uploadPhotos: async (eventId: string, files: File[]): Promise<any> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('photos', file);
    });
    const response = await api.post(`/galleries/${eventId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deletePhoto: async (eventId: string, filename: string): Promise<void> => {
    await api.delete(`/galleries/${eventId}/photos/${encodeURIComponent(filename)}`);
  },
};

// Magazines API
export const magazinesAPI = {
  getPublic: async (): Promise<Magazine[]> => {
    const response = await api.get('/magazines/public');
    return response.data;
  },

  getByAccessCode: async (code: string): Promise<Magazine> => {
    const response = await api.get(`/magazines/access-code/${code}`);
    return response.data;
  },

  getAll: async (): Promise<Magazine[]> => {
    const response = await api.get('/magazines');
    return response.data;
  },

  uploadMagazine: async (file: File, title: string, description?: string, isPublic?: boolean): Promise<Magazine> => {
    const formData = new FormData();
    formData.append('magazine', file);
    formData.append('title', title);
    if (description) formData.append('description', description);
    if (isPublic !== undefined) formData.append('isPublic', String(isPublic));
    const response = await api.post('/magazines/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deleteMagazine: async (id: string): Promise<void> => {
    await api.delete(`/magazines/${id}`);
  },

  getFileUrl: (filename: string): string => {
    return `${API_BASE_URL}/magazines/files/${encodeURIComponent(filename)}`;
  },
};

export const documentsAPI = {
  getPublic: async (): Promise<Document[]> => {
    const response = await api.get('/documents/public');
    return response.data;
  },

  getByAccessCode: async (code: string): Promise<Document> => {
    const response = await api.get(`/documents/access-code/${code}`);
    return response.data;
  },

  getAll: async (): Promise<Document[]> => {
    const response = await api.get('/documents');
    return response.data;
  },

  uploadDocument: async (file: File, title: string, description?: string, isPublic?: boolean): Promise<Document> => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('title', title);
    if (description) formData.append('description', description);
    if (isPublic !== undefined) formData.append('isPublic', String(isPublic));
    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deleteDocument: async (id: string): Promise<void> => {
    await api.delete(`/documents/${id}`);
  },

  getFileUrl: (filename: string): string => {
    return `${API_BASE_URL}/documents/files/${encodeURIComponent(filename)}`;
  },
};

// Audit API
export const auditAPI = {
  getAll: async (): Promise<AuditLog[]> => {
    const response = await api.get('/audit');
    return response.data;
  },

  getRecent: async (limit: number = 100): Promise<AuditLog[]> => {
    const response = await api.get(`/audit/recent?limit=${limit}`);
    return response.data;
  },

  getByUser: async (userId: string): Promise<AuditLog[]> => {
    const response = await api.get(`/audit/user/${userId}`);
    return response.data;
  },

  getByResource: async (resource: string, resourceId?: string): Promise<AuditLog[]> => {
    const url = resourceId 
      ? `/audit/resource/${resource}/${resourceId}`
      : `/audit/resource/${resource}`;
    const response = await api.get(url);
    return response.data;
  },
};

// Special Access API
export const specialAccessAPI = {
  validateCode: async (code: string): Promise<any> => {
    const response = await api.post('/special-access/validate', { code });
    return response.data;
  },
};

// Contact API
export const contactAPI = {
  sendMessage: async (data: {
    first_name: string;
    last_name: string;
    email_address: string;
    phone_number?: string;
    message: string;
  }): Promise<any> => {
    const response = await api.post('/messages', data);
    return response.data;
  },
};

// Messages API (Admin)
export const messagesAPI = {
  getAll: async (): Promise<any[]> => {
    const response = await api.get('/messages');
    return response.data;
  },
  getById: async (id: string): Promise<any> => {
    const response = await api.get(`/messages/${id}`);
    return response.data;
  },
  markAsResponded: async (id: string): Promise<any> => {
    const response = await api.put(`/messages/${id}/responded`);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/messages/${id}`);
  },
};

// Committee API
export const committeeAPI = {
  getMembers: async (): Promise<any[]> => {
    const response = await api.get('/committee');
    return response.data;
  },
};

// Settings API
export const settingsAPI = {
  getSettings: async (): Promise<any> => {
    const response = await api.get('/settings');
    return response.data;
  },
  updateNavbarSettings: async (navbar: any): Promise<any> => {
    const response = await api.put('/settings/navbar', { navbar });
    return response.data;
  },
  updateZellePhoneNumber: async (phoneNumber: string): Promise<any> => {
    const response = await api.put('/settings/zelle-phone', { phoneNumber });
    return response.data;
  },
  updateSocialLinks: async (facebookLink: string, whatsappLink: string, instagramLink: string): Promise<any> => {
    const response = await api.put('/settings/social-links', { facebookLink, whatsappLink, instagramLink });
    return response.data;
  },
  updateEmailSettings: async (emailAddress: string, emailPassword: string): Promise<any> => {
    const response = await api.put('/settings/email', { emailAddress, emailPassword });
    return response.data;
  },
  getEmailSettings: async (): Promise<any> => {
    const response = await api.get('/settings/email');
    return response.data;
  },
};

// Email API
export const emailAPI = {
  getMemberEmails: async (): Promise<string[]> => {
    const response = await api.get('/email/members');
    return response.data.emails || [];
  },
  getAdminEmails: async (): Promise<string[]> => {
    const response = await api.get('/email/admins');
    return response.data.emails || [];
  },
  sendToMembers: async (emails: string[], subject: string, html: string): Promise<any> => {
    const response = await api.post('/email/members', { emails, subject, html });
    return response.data;
  },
  sendToAdmins: async (emails: string[], subject: string, html: string): Promise<any> => {
    const response = await api.post('/email/admins', { emails, subject, html });
    return response.data;
  },
  sendToOrganizations: async (organizations: string[], subject: string, html: string): Promise<any> => {
    const response = await api.post('/email/organizations', { organizations, subject, html });
    return response.data;
  },
  sendEventNotification: async (eventId: string): Promise<any> => {
    const response = await api.post(`/email/events/${eventId}/notify`);
    return response.data;
  },
  testEmail: async (to: string): Promise<any> => {
    const response = await api.post('/email/test', { to });
    return response.data;
  },
};

// Users API
export const usersAPI = {
  getAll: async (): Promise<any[]> => {
    const response = await api.get('/users');
    return response.data;
  },
  create: async (data: any): Promise<any> => {
    const response = await api.post('/users', data);
    return response.data;
  },
  update: async (userId: string, data: any): Promise<any> => {
    const response = await api.put(`/users/${userId}`, data);
    return response.data;
  },
  delete: async (userId: string): Promise<void> => {
    await api.delete(`/users/${userId}`);
  },
};

export { api };
export default api;

