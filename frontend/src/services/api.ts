import axios from 'axios';
import { AuthResponse, Event, RSVP, Notice, PhotoGallery, Magazine, Document, SubEvent, AuditLog, News } from '../types';

// Use relative path in production (when served by Nginx), absolute URL in development
// Force relative /api in production to avoid mixed-content, ignore VITE_API_URL there
const isProd = import.meta.env.MODE === 'production' || import.meta.env.PROD;
const API_BASE_URL = isProd ? '/api' : (import.meta.env.VITE_API_URL || 'http://localhost:5001/api');

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

// Handle expired/missing sessions: if a protected call returns 401 while the app
// still believes it's authenticated (the persisted auth store says so), the JWT has
// lapsed. Clear the stale session and send the user to log in again so writes stop
// silently failing with "Authentication required". Anonymous public browsing (no
// stored session) is left untouched.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url || '';
    const isAuthCall = url.includes('/auth/');
    if (status === 401 && !isAuthCall) {
      const authRaw = localStorage.getItem('auth-storage') || '';
      const hasToken = Boolean(localStorage.getItem('token'));
      const thoughtAuthed = hasToken || authRaw.includes('"isAuthenticated":true');
      if (thoughtAuthed) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('auth-storage');
        if (!window.location.pathname.startsWith('/login')) {
          const from = encodeURIComponent(window.location.pathname);
          window.location.href = `/login?expired=1&from=${from}`;
        }
      }
    }
    return Promise.reject(error);
  }
);

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

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/change-password', { currentPassword, newPassword });
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

  // Get all active events (public endpoint)
  getActive: async (): Promise<Event[]> => {
    const response = await api.get('/events');
    return response.data;
  },

  getById: async (id: string): Promise<Event> => {
    const response = await api.get(`/events/${id}`);
    return response.data;
  },

  // Get all events including inactive (admin only)
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
    event_type?: 'Festival' | 'Charity' | 'Other';
    rsvp_enabled?: boolean;
    rsvp_link?: string;
    location?: string;
    photo_gallery_link?: string;
    is_priority?: boolean;
    is_active_durga_puja_event?: boolean;
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
      event_type?: 'Festival' | 'Charity' | 'Other';
      rsvp_enabled?: boolean;
      rsvp_link?: string;
      location?: string;
      photo_gallery_link?: string;
      is_active?: boolean;
      is_priority?: boolean;
      is_active_durga_puja_event?: boolean;
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
export interface SubEventSeoFields {
  seo_page_enabled: boolean;
  seo_event_type: string;
  performers: string;
  performer_type: 'Person' | 'MusicGroup';
  venue_name: string;
  venue_city: string;
  venue_region: string;
  venue_street: string;
  venue_postal: string;
  venue_area: string;
  ticket_url: string;
  ticket_price: string;
  ticket_currency: string;
}

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
    // Use public endpoint (no auth required) for RSVP page
    const response = await axios.get(`${API_BASE_URL}/sub-events/public/${id}`);
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
    rsvp_enabled?: boolean;
    show_in_home_page?: boolean;
  } & Partial<SubEventSeoFields>): Promise<SubEvent> => {
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
  } & SubEventSeoFields>): Promise<SubEvent> => {
    const response = await api.put(`/sub-events/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/sub-events/${id}`);
  },

  // Toggle whether this sub-event (with its banner) shows on the /durga-puja page
  setDurgaPujaVisibility: async (id: string, show: boolean): Promise<SubEvent> => {
    const response = await api.put(`/sub-events/${id}`, { show_in_durga_puja_page: show });
    return response.data;
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

  getBySubEvent: async (subEventId: string): Promise<RSVP[]> => {
    const response = await api.get(`/rsvps/sub-event/${subEventId}`);
    return response.data;
  },

  cancel: async (id: string): Promise<RSVP> => {
    const response = await api.post(`/rsvps/${id}/cancel`);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/rsvps/${id}`);
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
  uploadImages: async (files: File[], sponsorshipType: string = 'None'): Promise<any> => {
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

// News API
export const newsAPI = {
  getPublic: async (): Promise<News[]> => {
    const response = await api.get('/news/public');
    return response.data;
  },

  getAll: async (): Promise<News[]> => {
    const response = await api.get('/news');
    return response.data;
  },

  getById: async (id: string): Promise<News> => {
    const response = await api.get(`/news/${id}`);
    return response.data;
  },

  create: async (data: {
    title: string;
    content: string;
    media_type: 'video' | 'link' | 'article' | 'image';
    media_url?: string;
    media?: File; // File for video/image upload
    is_active?: boolean;
    is_published?: boolean;
  }): Promise<News> => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('content', data.content);
    formData.append('media_type', data.media_type);
    if (data.media_url) formData.append('media_url', data.media_url);
    if (data.media) formData.append('media', data.media);
    if (data.is_active !== undefined) formData.append('is_active', String(data.is_active));
    if (data.is_published !== undefined) formData.append('is_published', String(data.is_published));

    const response = await api.post('/news', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  update: async (id: string, data: {
    title?: string;
    content?: string;
    media_type?: 'video' | 'link' | 'article' | 'image';
    media_url?: string;
    is_active?: boolean;
    is_published?: boolean;
  }): Promise<News> => {
    const response = await api.put(`/news/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/news/${id}`);
  },

  getArchived: async (): Promise<News[]> => {
    const response = await axios.get(`${API_BASE_URL}/news/archived`);
    return response.data;
  },

  archive: async (id: string): Promise<News> => {
    const response = await api.post(`/news/${id}/archive`);
    return response.data;
  },

  unarchive: async (id: string): Promise<News> => {
    const response = await api.post(`/news/${id}/unarchive`);
    return response.data;
  },

  getMediaUrl: (filename: string): string => {
    return `${API_BASE_URL}/news/media/${encodeURIComponent(filename)}`;
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

// Durga Puja page content API
export interface DurgaPujaFaq {
  question: string;
  answer: string;
}
export interface TicketLink {
  label: string;
  url: string;
}
export interface DurgaPujaCta {
  label: string;
  href: string;
  style?: 'primary' | 'secondary';
}
export interface DurgaPujaHighlight {
  title: string;
  text?: string;
  icon?: string;
  imageUrl?: string;
}
export interface DurgaPujaScheduleItem {
  time?: string;
  title: string;
  description?: string;
}
export interface DurgaPujaScheduleDay {
  dayLabel: string;
  date?: string;
  items: DurgaPujaScheduleItem[];
}
export interface DurgaPujaArtist {
  name: string;
  bio?: string;
  dateTime?: string;
  performanceType?: string;
  ticketInfo?: string;
  imageUrl?: string;
  /** When true, the public card links to /sub-events/:subEventId (SEO detail page). */
  linkSubEventPage?: boolean;
  subEventId?: string;
  /** YouTube or other video URL — embedded on the public artist card when possible. */
  videoUrl?: string;
}
export interface DurgaPujaTicketing {
  adultPrice?: string;
  childPrice?: string;
  weekendPackage?: string;
  familyPackage?: string;
  concertOnly?: string;
  freeEntryAge?: string;
  foodInclusion?: string;
  refundPolicy?: string;
  transferPolicy?: string;
  maxCapacity?: string;
  buttonUrl?: string;
  buttonLabel?: string;
  qrImageUrl?: string;
}
export interface DurgaPujaVenueInfo {
  name?: string;
  buildingName?: string;
  streetAddress?: string;
  mapsUrl?: string;
  parkingLot?: string;
  parkingCost?: string;
  accessibleParking?: string;
  recommendedEntrance?: string;
  publicTransit?: string;
  layoutNote?: string;
  venueMapImageUrl?: string;
}
export interface DurgaPujaMeal {
  name: string;
  description?: string;
  hours?: string;
}
export interface DurgaPujaFoodInfo {
  intro?: string;
  meals?: DurgaPujaMeal[];
  vegetarian?: string;
  kidsMenu?: string;
  allergyNotice?: string;
  tokenProcess?: string;
  photos?: string[];
}
export interface DurgaPujaTiming {
  label: string;
  time?: string;
}
export interface DurgaPujaPujaInfo {
  intro?: string;
  timings?: DurgaPujaTiming[];
  priestInfo?: string;
  itemsToBring?: string;
  attireGuidance?: string;
  rules?: string;
}
export interface DurgaPujaKidsActivity {
  title: string;
  description?: string;
}
export interface DurgaPujaKidsInfo {
  intro?: string;
  activities?: DurgaPujaKidsActivity[];
  ageRequirements?: string;
  supervisionPolicy?: string;
}
export interface DurgaPujaSponsorPackage {
  name: string;
  price?: string;
  benefits?: string[];
}
export interface DurgaPujaSponsorshipInfo {
  intro?: string;
  packages?: DurgaPujaSponsorPackage[];
  packagePdfUrl?: string;
  contactEmail?: string;
  contactNote?: string;
  buttonUrl?: string;
}
export interface DurgaPujaVendorInfo {
  intro?: string;
  types?: string[];
  stallFees?: string;
  provisions?: string;
  electricity?: string;
  setupTimes?: string;
  insurance?: string;
  deadline?: string;
  contactEmail?: string;
  formUrl?: string;
}
export interface DurgaPujaVolunteerInfo {
  intro?: string;
  categories?: string[];
  contactEmail?: string;
  formUrl?: string;
}
export interface DurgaPujaGalleryInfo {
  intro?: string;
  galleryLink?: string;
  videoUrl?: string;
  images?: string[];
}
export interface DurgaPujaContact {
  role: string;
  name?: string;
  email?: string;
  phone?: string;
}
export interface DurgaPujaSocial {
  facebook?: string;
  instagram?: string;
  youtube?: string;
  whatsapp?: string;
}
export interface DurgaPujaSectionToggles {
  hero?: boolean;
  highlights?: boolean;
  schedule?: boolean;
  artists?: boolean;
  tickets?: boolean;
  venue?: boolean;
  food?: boolean;
  puja?: boolean;
  kids?: boolean;
  sponsorship?: boolean;
  vendors?: boolean;
  volunteer?: boolean;
  about?: boolean;
  gallery?: boolean;
  faqs?: boolean;
  contact?: boolean;
  subEvents?: boolean;
}
export interface DurgaPujaPageContent {
  year: number;
  intro: string;
  datesText: string;
  startDate: string;
  endDate: string;
  venueName: string;
  venueCity: string;
  venueNote: string;
  faqs: DurgaPujaFaq[];
  /** External ticket-booking links; empty = the public page shows a "booking opens soon" placeholder. */
  ticketLinks?: TicketLink[];
  /** Optional note shown with the ticket links, e.g. "Early-bird pricing until Sep 1". */
  ticketsNote?: string;
  /** Show the in-website "Book Your Seat" CTA (default true; also needs the seat system open). */
  showInternalBooking?: boolean;
  /** Show external ticket link buttons (default true). */
  showExternalTickets?: boolean;
  /** Master switch — hide ALL ticketing on the public page (default false). */
  ticketsOff?: boolean;
  /** Show saved ticket pricing from Book Your Seat (default false). */
  showSavedTickets?: boolean;
  /** Embed the Yapsody event-list widget in the Tickets section (default false). */
  showYapsodyWidget?: boolean;
  /** Yapsody widget event id (e.g. "212239" → div id yapwid-event-212239). */
  yapsodyEventId?: string;
  /** Yapsody widget data-venue-code (e.g. "sanhoti"). */
  yapsodyVenueCode?: string;
  /** Show a Donate button in the Tickets section (links to /donate). */
  showDonateButtonInTickets?: boolean;
  /** Set automatically when a "Durga Puja" event is created/updated. */
  linkedEventId?: string;

  // Section 1: Hero
  heroTagline?: string;
  heroSubheadline?: string;
  showCountdown?: boolean;
  ctaButtons?: DurgaPujaCta[];

  // Section 2: Highlights
  highlights?: DurgaPujaHighlight[];
  expectedAttendance?: string;

  // Section 3: Schedule
  scheduleNote?: string;
  scheduleDays?: DurgaPujaScheduleDay[];

  // Section 4: Artists
  artists?: DurgaPujaArtist[];

  // Section 5: Ticketing details
  ticketing?: DurgaPujaTicketing;

  // Section 6: Venue & parking
  venue?: DurgaPujaVenueInfo;
  venues?: DurgaPujaVenueInfo[];
  showVenueDefaults?: boolean;

  // Section 7: Food
  food?: DurgaPujaFoodInfo;

  // Section 8: Puja & religious
  puja?: DurgaPujaPujaInfo;

  // Section 9: Children & family
  kids?: DurgaPujaKidsInfo;

  // Section 10: Sponsorship
  sponsorship?: DurgaPujaSponsorshipInfo;

  // Section 11: Vendors & stalls
  vendors?: DurgaPujaVendorInfo;

  // Section 12: Volunteer
  volunteer?: DurgaPujaVolunteerInfo;

  // Section 13: About Sanhoti
  about?: string;

  // Section 14: Previous-year gallery
  gallery?: DurgaPujaGalleryInfo;

  // Section 16: Contact
  contacts?: DurgaPujaContact[];
  social?: DurgaPujaSocial;

  /** Per-section visibility toggles. */
  sections?: DurgaPujaSectionToggles;

  updated_at: string;
}
// Seat booking ("Book Your Seat") API
export interface SeatCategory {
  category_id: string;
  name: string;
  color: string;
  adult_price: number;
  child_price: number;
  entire_event_enabled?: boolean;
  /** @deprecated Use adult_price */
  price?: number;
}
export interface ChildAgeRange {
  min_age: number;
  max_age: number;
}
export interface MealDayPricing {
  day_id: string;
  label: string;
  date?: string;
  lunch_adult_price: number;
  lunch_child_price: number;
  dinner_adult_price: number;
  dinner_child_price: number;
}
export type SubEventTicketingType = 'general' | 'concert';
export interface FoodAddon {
  addon_id: string;
  name: string;
  description?: string;
  adult_price: number;
  child_price: number;
  meal_day_id?: string;
  meal_type?: 'lunch' | 'dinner';
}
export interface SubEventCategoryPricing {
  category_id: string;
  adult_price: number;
  child_price: number;
}
export interface SubEventTicketingConfig {
  sub_event_id: string;
  ticketing_type: SubEventTicketingType;
  enabled_category_ids: string[];
  category_prices: SubEventCategoryPricing[];
  food_addons: FoodAddon[];
  /** @deprecated Legacy per-sub-event category copies */
  categories?: SeatCategory[];
}
export interface SeatingSection {
  section_id: string;
  name: string;
  rows: number;
  seats_per_row: number;
  category_id: string;
  /** Display numbering: first seat number (default 1). */
  seat_number_start?: number;
  /** Display numbering step — 2 gives odd/even theatre numbering (default 1). */
  seat_number_step?: number;
}
export interface SeatPosition {
  x: number;
  y: number;
}
export interface SeatMap {
  map_id: string;
  event_id: string;
  sub_event_id?: string;
  name: string;
  is_open: boolean;
  sections: SeatingSection[];
  layout_mode?: 'grid' | 'image' | 'matrix';
  matrix: { rows: number; cols: number };
  seat_positions: Record<string, SeatPosition>;
  blocked_seats: string[];
  updated_at?: string;
}
export interface SeatMapTemplate {
  template_id: string;
  slot: 1 | 2;
  name: string;
  matrix: { rows: number; cols: number };
  seats: Array<{
    row: number;
    col: number;
    category_name: string;
    blocked?: boolean;
  }>;
  updated_at: string;
}
export interface TicketingProfile {
  event_id: string;
  categories: SeatCategory[];
  child_age_range: ChildAgeRange;
  meal_days: MealDayPricing[];
  sub_event_configs: SubEventTicketingConfig[];
  hold_minutes: number;
  payment_window_hours?: number;
  booking_note?: string;
  updated_at?: string;
}

export const categoryAdultPrice = (c: SeatCategory) => Number(c.adult_price ?? c.price ?? 0);
export const categoryChildPrice = (c: SeatCategory) => Number(c.child_price ?? categoryAdultPrice(c));

export function categoriesForEntireEvent(profile: Pick<TicketingProfile, 'categories'>): SeatCategory[] {
  return (profile.categories ?? []).filter(c => c.entire_event_enabled);
}

export function subEventCategoryPrice(
  config: SubEventTicketingConfig | undefined,
  categoryId: string
): SubEventCategoryPricing | undefined {
  return config?.category_prices?.find(row => row.category_id === categoryId);
}

export function categoriesForSubEvent(
  profile: Pick<TicketingProfile, 'categories' | 'sub_event_configs'>,
  subEventId: string
): SeatCategory[] {
  const config = profile.sub_event_configs?.find(item => item.sub_event_id === subEventId);
  if (!config || config.ticketing_type !== 'concert') return [];
  const enabled = new Set(config.enabled_category_ids ?? []);
  return (profile.categories ?? [])
    .filter(c => enabled.has(c.category_id))
    .map(c => {
      const pricing = subEventCategoryPrice(config, c.category_id);
      return {
        ...c,
        adult_price: Number(pricing?.adult_price ?? 0),
        child_price: Number(pricing?.child_price ?? 0),
        price: Number(pricing?.adult_price ?? 0),
      };
    });
}

export interface PublicTicketingConfig extends TicketingProfile {
  is_open?: boolean;
  seat_booking_available?: boolean;
  meals_booking_available?: boolean;
  event: {
    event_id: string;
    event_name: string;
    event_start_dt: string;
    event_end_dt: string;
    location?: string;
  } | null;
  sub_events: Array<{
    sub_event_id: string;
    sub_event_name: string;
    sub_event_start_dt?: string;
    sub_event_end_dt?: string;
    location?: string;
  }>;
  maps: SeatMap[];
}
/** @deprecated Phase 1 compatibility; map/profile data is now split. */
export type SeatingConfig = SeatMap & TicketingProfile & {
  event?: PublicTicketingConfig['event'];
  sub_event?: PublicTicketingConfig['sub_events'][number] | null;
};
export interface SeatHold {
  hold_id: string;
  seat_ids: string[];
  expires_at: string;
  created_at: string;
}
export interface BookedSeatDetail {
  seat_id: string;
  label: string;
  category_name: string;
  price: number;
  audience_type?: 'adult' | 'child';
  map_id?: string;
  map_name?: string;
  sub_event_id?: string;
}
export interface BookedFoodAddon {
  addon_id: string;
  sub_event_id: string;
  name: string;
  adult_qty: number;
  child_qty: number;
  adult_price: number;
  child_price: number;
  line_total: number;
  meal_day_id?: string;
  meal_type?: 'lunch' | 'dinner';
}
export interface BookedMealDetail {
  day_id: string;
  label: string;
  meal_type: 'lunch' | 'dinner';
  adult_qty: number;
  child_qty: number;
  adult_price: number;
  child_price: number;
  line_total: number;
}
export type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'expired';

export interface GateCheckinEvent {
  at: string;
  admitted?: number;
  set_to?: number;
}

export interface GateCheckin {
  checked_in: number;
  updated_at: string;
  log?: GateCheckinEvent[];
}

export interface SeatBooking {
  booking_id: string;
  event_id: string;
  sub_event_id?: string;
  sub_event_ids?: string[];
  /** Human-readable snapshot, e.g. "Durga Puja 2026 — Cultural Night". */
  event_context: string;
  seat_ids: string[];
  seats_detail: BookedSeatDetail[];
  meals_detail?: BookedMealDetail[];
  food_addons_detail?: BookedFoodAddon[];
  name: string;
  email: string;
  phone: string;
  subtotal: number;
  discount_code?: string;
  discount_amount: number;
  total: number;
  status: BookingStatus;
  payment_due_at?: string;
  payment_reference?: string;
  admission_qr_token?: string;
  admission_qr_generated_at?: string;
  admission_checkins?: Record<string, GateCheckin>;
  admission_checked_in_at?: string;
  created_at: string;
  updated_at: string;
}
export interface DiscountCode {
  discount_id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  min_seats?: number;
  max_uses?: number;
  used_count: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TicketSetupSnapshot {
  categories: SeatCategory[];
  child_age_range: ChildAgeRange;
  meal_days: MealDayPricing[];
  sub_event_configs: SubEventTicketingConfig[];
  hold_minutes: number;
  payment_window_hours: number;
  booking_note?: string;
  seat_maps: SeatMap[];
  discounts: DiscountCode[];
}

export interface TicketSetup {
  setup_id: string;
  event_id: string;
  event_name: string;
  label: string;
  status: 'active' | 'archived';
  snapshot: TicketSetupSnapshot;
  created_at: string;
  updated_at: string;
  archived_at?: string;
}

export interface TheaterMap {
  theater_map_id: string;
  name: string;
  matrix: { rows: number; cols: number };
  seats: Array<{
    row: number;
    col: number;
    category_name: string;
    blocked?: boolean;
  }>;
  created_at: string;
  updated_at: string;
}

export interface DiscountPreview {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  discount_amount: number;
  total: number;
}
export type UnavailableSeats = Record<string, 'booked' | 'held' | 'blocked'>;

export type AdmissionResult =
  | 'admitted'
  | 'already_checked_in'
  | 'over_capacity'
  | 'payment_pending'
  | 'wrong_gate'
  | 'cancelled'
  | 'expired'
  | 'not_found'
  | 'invalid_qr';

export interface CheckinGate {
  scope: string;
  group: string;
  label: string;
}

export interface CheckinGatesResponse {
  event: { event_id: string; event_name: string } | null;
  gates: CheckinGate[];
}

export interface CheckinSeat {
  label: string;
  category_name: string;
  audience_type?: 'adult' | 'child';
}

export interface CheckinSeatGroup {
  sub_event_name: string;
  seats: CheckinSeat[];
}

export interface CheckinGateProgress {
  scope: string;
  label: string;
  already: number;
  capacity: number;
  remaining: number;
  current: boolean;
}

export interface CheckinBookingView {
  booking_id: string;
  name: string;
  status: BookingStatus;
  event_context: string;
  seat_count: number;
  seat_groups: CheckinSeatGroup[];
  meals_detail: Array<{ label: string; meal_type: 'lunch' | 'dinner'; adult_qty: number; child_qty: number }>;
  meal_headcount: number;
  sub_event_names: string[];
  admission_checked_in_at?: string;
  capacity?: number;
  already?: number;
  remaining?: number;
  checked_in?: number;
}

export interface AdmissionScanResult {
  result: AdmissionResult;
  booking: CheckinBookingView | null;
  capacity?: number;
  already?: number;
  remaining?: number;
  checked_in?: number;
  admitted_now?: number;
  gate_label?: string;
  gate_progress?: CheckinGateProgress[];
}

export interface CheckinStats {
  scope: string;
  checked_in: number;
  total: number;
  bookings_total: number;
  bookings_done: number;
}

export interface TicketStatCard {
  scope: string;
  label: string;
  group: string;
  total: number;
  pending_payment: number;
  confirmed: number;
  expired: number;
  cancelled: number;
  entered: number;
}

export interface TicketStatGuest {
  booking_id: string;
  name: string;
  email: string;
  phone: string;
  adult_count: number;
  child_count: number;
  capacity: number;
  checked_in: number;
}

export interface TicketStatDetail {
  scope: string;
  label: string;
  pending_payment: TicketStatGuest[];
  confirmed: TicketStatGuest[];
  expired: TicketStatGuest[];
  cancelled: TicketStatGuest[];
  entered: TicketStatGuest[];
}

export interface TicketStatsResponse {
  event: { event_id: string; event_name: string } | null;
  cards: TicketStatCard[];
  detail?: TicketStatDetail;
}

export const ticketingAPI = {
  // Public
  getConfig: async (): Promise<PublicTicketingConfig> => {
    const response = await api.get('/booking/config');
    return response.data;
  },
  getAvailability: async (): Promise<{ unavailable: UnavailableSeats }> => {
    const response = await api.get('/booking/availability');
    return response.data;
  },
  holdSeats: async (
    seatKeys: string[],
    categoryId: string,
    scopeSubEventId?: string,
    adultCount?: number,
    childCount?: number
  ): Promise<SeatHold> => {
    const response = await api.post('/booking/hold', {
      seat_keys: seatKeys,
      category_id: categoryId,
      scope_sub_event_id: scopeSubEventId,
      adult_count: adultCount,
      child_count: childCount,
    });
    return response.data;
  },
  releaseHold: async (holdId: string): Promise<void> => {
    await api.delete(`/booking/hold/${holdId}`);
  },
  previewDiscount: async (
    code: string,
    seatKeys: string[],
    seatAudiences?: Record<string, 'adult' | 'child'>,
    context?: {
      category_id: string;
      scope_sub_event_id?: string;
      adult_count: number;
      child_count: number;
    }
  ): Promise<DiscountPreview> => {
    const response = await api.post('/booking/discount/preview', {
      code,
      seat_keys: seatKeys,
      seat_audiences: seatAudiences,
      ...(context?.category_id ? { category_id: context.category_id } : {}),
      ...(context?.scope_sub_event_id ? { scope_sub_event_id: context.scope_sub_event_id } : {}),
      ...(context
        ? { adult_count: context.adult_count, child_count: context.child_count }
        : {}),
    });
    return response.data;
  },
  checkout: async (data: {
    hold_id: string;
    name: string;
    email: string;
    phone: string;
    discount_code?: string;
    seat_keys: string[];
    category_id: string;
    scope_sub_event_id?: string;
    adult_count: number;
    child_count: number;
    seat_audiences: Record<string, 'adult' | 'child'>;
    food_addons?: Array<{
      addon_id: string;
      sub_event_id: string;
      adult_qty: number;
      child_qty: number;
    }>;
  }): Promise<{ booking: SeatBooking; payment: { zelle_phone?: string } }> => {
    const response = await api.post('/booking/checkout', data);
    return response.data;
  },
  previewMealsDiscount: async (
    code: string,
    mealSelections: Array<{
      day_id: string;
      meal_type: 'lunch' | 'dinner';
      adult_qty: number;
      child_qty: number;
    }>,
    adultCount: number,
    childCount: number
  ): Promise<DiscountPreview> => {
    const response = await api.post('/booking/discount/preview-meals', {
      code,
      meal_selections: mealSelections,
      adult_count: adultCount,
      child_count: childCount,
    });
    return response.data;
  },
  checkoutMeals: async (data: {
    name: string;
    email: string;
    phone: string;
    discount_code?: string;
    adult_count: number;
    child_count: number;
    meal_selections: Array<{
      day_id: string;
      meal_type: 'lunch' | 'dinner';
      adult_qty: number;
      child_qty: number;
    }>;
  }): Promise<{ booking: SeatBooking; payment: { zelle_phone?: string } }> => {
    const response = await api.post('/booking/checkout-meals', data);
    return response.data;
  },
  getBooking: async (bookingId: string): Promise<SeatBooking> => {
    const response = await api.get(`/booking/bookings/${bookingId}`);
    return response.data;
  },
  // Admin
  getAdminProfile: async (eventId?: string): Promise<TicketingProfile> => {
    const response = await api.get('/booking/admin/profile', {
      ...(eventId ? { params: { event_id: eventId } } : {}),
    });
    return response.data;
  },
  updateProfile: async (patch: Partial<TicketingProfile>): Promise<TicketingProfile> => {
    const response = await api.put('/booking/admin/profile', patch);
    return response.data;
  },
  listMaps: async (): Promise<SeatMap[]> => {
    const response = await api.get('/booking/admin/maps');
    return response.data;
  },
  createMap: async (
    data: Partial<SeatMap> & { template_slot?: 1 | 2; theater_map_id?: string }
  ): Promise<SeatMap> => {
    const response = await api.post('/booking/admin/maps', data);
    return response.data;
  },
  updateMap: async (
    mapId: string,
    patch: Partial<SeatMap> & {
      apply_template_slot?: 1 | 2;
      template_slot?: 1 | 2;
      apply_theater_map_id?: string;
      theater_map_id?: string;
    }
  ): Promise<SeatMap> => {
    const response = await api.put(`/booking/admin/maps/${mapId}`, patch);
    return response.data;
  },
  deleteMap: async (mapId: string): Promise<void> => {
    await api.delete(`/booking/admin/maps/${mapId}`);
  },
  listMapTemplates: async (): Promise<SeatMapTemplate[]> => {
    const response = await api.get('/booking/admin/map-templates');
    return response.data;
  },
  saveMapTemplate: async (slot: 1 | 2, data: { name?: string; map_id: string }): Promise<SeatMapTemplate> => {
    const response = await api.put(`/booking/admin/map-templates/${slot}`, data);
    return response.data;
  },
  deleteMapTemplate: async (slot: 1 | 2): Promise<void> => {
    await api.delete(`/booking/admin/map-templates/${slot}`);
  },
  listHolds: async (): Promise<SeatHold[]> => {
    const response = await api.get('/booking/admin/holds');
    return response.data;
  },
  listBookings: async (): Promise<SeatBooking[]> => {
    const response = await api.get('/booking/admin/bookings');
    return response.data;
  },
  setBookingStatus: async (
    bookingId: string,
    status: BookingStatus,
    paymentReference?: string
  ): Promise<SeatBooking> => {
    const response = await api.put(`/booking/admin/bookings/${bookingId}/status`, {
      status,
      ...(paymentReference ? { payment_reference: paymentReference } : {}),
    });
    return response.data;
  },
  deleteBooking: async (bookingId: string): Promise<{ deleted: boolean; booking_id: string }> => {
    const response = await api.delete(`/booking/admin/bookings/${bookingId}`);
    return response.data;
  },
  extendBookingPayment: async (bookingId: string, hours = 24): Promise<SeatBooking> => {
    const response = await api.put(`/booking/admin/bookings/${bookingId}/extend`, { hours });
    return response.data;
  },
  resendTicket: async (bookingId: string): Promise<{ resent: boolean; booking_id: string; email: string }> => {
    const response = await api.post(`/booking/admin/bookings/${bookingId}/resend-ticket`);
    return response.data;
  },
  // Admission QR check-in (event-day scanning)
  scanAdmission: async (
    payload: string,
    scope: string,
    opts?: { manual?: boolean; dryRun?: boolean; admitQty?: number; eventId?: string }
  ): Promise<AdmissionScanResult> => {
    const response = await api.post('/booking/admin/checkin/scan', {
      payload,
      scope,
      ...(opts?.manual ? { manual: true } : {}),
      ...(opts?.dryRun ? { dry_run: true } : {}),
      ...(opts?.admitQty !== undefined ? { admit_qty: opts.admitQty } : {}),
      ...(opts?.eventId ? { event_id: opts.eventId } : {}),
    });
    return response.data;
  },
  correctCheckin: async (
    bookingId: string,
    scope: string,
    count: number
  ): Promise<AdmissionScanResult> => {
    const response = await api.post('/booking/admin/checkin/correct', {
      booking_id: bookingId,
      scope,
      count,
    });
    return response.data;
  },
  checkinGates: async (eventId: string): Promise<CheckinGatesResponse> => {
    const response = await api.get('/booking/admin/checkin/gates', { params: { event_id: eventId } });
    return response.data;
  },
  checkinStats: async (scope: string, eventId?: string): Promise<CheckinStats> => {
    const response = await api.get('/booking/admin/checkin/stats', {
      params: { scope, ...(eventId ? { event_id: eventId } : {}) },
    });
    return response.data;
  },
  getTicketStats: async (eventId: string, scope?: string): Promise<TicketStatsResponse> => {
    const response = await api.get('/booking/admin/ticket-stats', {
      params: { event_id: eventId, ...(scope ? { scope } : {}) },
    });
    return response.data;
  },
  listDiscounts: async (): Promise<DiscountCode[]> => {
    const response = await api.get('/booking/admin/discounts');
    return response.data;
  },
  createDiscount: async (data: Partial<DiscountCode>): Promise<DiscountCode> => {
    const response = await api.post('/booking/admin/discounts', data);
    return response.data;
  },
  updateDiscount: async (discountId: string, data: Partial<DiscountCode>): Promise<DiscountCode> => {
    const response = await api.put(`/booking/admin/discounts/${discountId}`, data);
    return response.data;
  },
  deleteDiscount: async (discountId: string): Promise<void> => {
    await api.delete(`/booking/admin/discounts/${discountId}`);
  },
};

export const ticketSetupsAPI = {
  list: async (): Promise<TicketSetup[]> => {
    const response = await api.get('/booking/admin/setups');
    return response.data;
  },
  get: async (setupId: string): Promise<TicketSetup> => {
    const response = await api.get(`/booking/admin/setups/${setupId}`);
    return response.data;
  },
  save: async (eventId: string): Promise<TicketSetup> => {
    const response = await api.post('/booking/admin/setups/save', { event_id: eventId });
    return response.data;
  },
  archive: async (setupId: string): Promise<TicketSetup> => {
    const response = await api.post(`/booking/admin/setups/${setupId}/archive`);
    return response.data;
  },
  remove: async (
    setupId: string
  ): Promise<{ deleted: boolean; live_config_cleared: boolean; event_id?: string }> => {
    const response = await api.delete(`/booking/admin/setups/${setupId}`);
    return response.data;
  },
};

export const theaterMapsAPI = {
  list: async (): Promise<TheaterMap[]> => {
    const response = await api.get('/booking/admin/theater-maps');
    return response.data;
  },
  create: async (data: {
    name: string;
    matrix: { rows: number; cols: number };
    seats: TheaterMap['seats'];
  }): Promise<TheaterMap> => {
    const response = await api.post('/booking/admin/theater-maps', data);
    return response.data;
  },
  update: async (
    theaterMapId: string,
    patch: Partial<Pick<TheaterMap, 'name' | 'matrix' | 'seats'>>
  ): Promise<TheaterMap> => {
    const response = await api.put(`/booking/admin/theater-maps/${theaterMapId}`, patch);
    return response.data;
  },
  remove: async (theaterMapId: string): Promise<void> => {
    await api.delete(`/booking/admin/theater-maps/${theaterMapId}`);
  },
};

export const durgaPujaPageAPI = {
  listYears: async (): Promise<{ years: number[]; activeYear: number }> => {
    const response = await api.get('/durga-puja-page/years');
    return response.data;
  },
  getActive: async (): Promise<{ year: number; content: DurgaPujaPageContent }> => {
    const response = await api.get('/durga-puja-page/active');
    return response.data;
  },
  getContent: async (year?: number): Promise<DurgaPujaPageContent> => {
    const response = await api.get(year ? `/durga-puja-page/${year}` : '/durga-puja-page');
    return response.data;
  },
  updateContent: async (
    year: number,
    patch: Partial<Omit<DurgaPujaPageContent, 'updated_at' | 'year'>>
  ): Promise<DurgaPujaPageContent> => {
    const response = await api.put(`/durga-puja-page/${year}`, patch);
    return response.data;
  },
  getImageUrl: (year: number): string => {
    return `/api/durga-puja-page/${year}/image`;
  },
  hasImage: async (year: number): Promise<{ hasImage: boolean }> => {
    const response = await api.get(`/durga-puja-page/${year}/has-image`);
    return response.data;
  },
  uploadImage: async (year: number, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post(`/durga-puja-page/${year}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  deleteImage: async (year: number): Promise<void> => {
    await api.delete(`/durga-puja-page/${year}/image`);
  },
  // Generic per-category assets (artist/food/venue/gallery/qr images).
  listAssets: async (
    year: number,
    category: string
  ): Promise<{ filename: string; url: string }[]> => {
    const response = await api.get(`/durga-puja-page/${year}/assets/${category}`);
    return response.data.assets ?? [];
  },
  uploadAsset: async (
    year: number,
    category: string,
    file: File
  ): Promise<{ filename: string; url: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post(`/durga-puja-page/${year}/assets/${category}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  deleteAsset: async (year: number, category: string, filename: string): Promise<void> => {
    await api.delete(`/durga-puja-page/${year}/assets/${category}/${filename}`);
  },
  // Sponsorship prospectus PDF (one per year).
  sponsorshipPdfUrl: (year: number): string => `/api/durga-puja-page/${year}/sponsorship-pdf`,
  hasSponsorshipPdf: async (year: number): Promise<{ hasPdf: boolean }> => {
    const response = await api.get(`/durga-puja-page/${year}/sponsorship-pdf/has`);
    return response.data;
  },
  uploadSponsorshipPdf: async (year: number, file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('pdf', file);
    const response = await api.post(`/durga-puja-page/${year}/sponsorship-pdf`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  deleteSponsorshipPdf: async (year: number): Promise<void> => {
    await api.delete(`/durga-puja-page/${year}/sponsorship-pdf`);
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
  updateStripeDonation: async (payload: {
    showStripeDonateButton: boolean;
    stripeBuyButtonId: string;
    stripePublishableKey: string;
  }): Promise<any> => {
    const response = await api.put('/settings/stripe-donation', payload);
    return response.data;
  },
  updateSocialLinks: async (facebookLink: string, whatsappLink: string, instagramLink: string): Promise<any> => {
    const response = await api.put('/settings/social-links', { facebookLink, whatsappLink, instagramLink });
    return response.data;
  },
  updateYoutubeChannelUrl: async (youtubeChannelUrl: string): Promise<any> => {
    const response = await api.put('/settings/youtube-channel', { youtubeChannelUrl });
    return response.data;
  },
  updateEmailSettings: async (emailAddress: string, emailPassword: string): Promise<any> => {
    const response = await api.put('/settings/email', { emailAddress, emailPassword });
    return response.data;
  },
  updateCommitteeYear: async (committeeYear: string): Promise<any> => {
    const response = await api.put('/settings/committee-year', { committeeYear });
    return response.data;
  },
  updateHomeStatements: async (payload: {
    about?: string;
    vision?: string;
    mission?: string;
    purpose?: string;
    tabVisibility?: Partial<Record<'about' | 'vision' | 'mission' | 'purpose', boolean>>;
  }): Promise<any> => {
    const response = await api.put('/settings/home-statements', payload);
    return response.data;
  },
  updateHomeHeroBanner: async (message: string): Promise<any> => {
    const response = await api.put('/settings/home-hero-banner', { message });
    return response.data;
  },
  updateHomeHeroButtons: async (
    buttons: Partial<Record<'facebook' | 'whatsapp' | 'viewEvents' | 'durgaPuja' | 'viewCharityEvents', boolean>>
  ): Promise<any> => {
    const response = await api.put('/settings/home-hero-buttons', { buttons });
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

