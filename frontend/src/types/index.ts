export enum UserRole {
  ADMIN = 'admin',
  MEMBER = 'member',
  PUBLIC = 'public',
}

export enum EventType {
  POILA_BOISHAKH = 'Poila Boishakh',
  DURGA_PUJA = 'Durga Puja',
  DIWALI = 'Diwali',
  ANNUAL_PICNIC = 'Annual Picnic',
  HOLIDAY_PARTY = 'Holiday Party',
  SARASWATI_PUJA = 'Saraswati Puja',
  ADHOC = 'Adhoc',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CorporatePartnershipsContent {
  heroTitle?: string;
  heroSubtitle?: string;
  whyPartnerTitle?: string;
  whyPartner?: { title: string; text: string }[];
  impactTitle?: string;
  impactIntro?: string;
  impact?: { tag: string; name: string; meta: string; text: string }[];
  waysTitle?: string;
  waysToGive?: string[];
  csrNote?: string;
  leadershipTitle?: string;
  ctaTitle?: string;
  ctaText?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface Event {
  // New schema fields
  event_id: string;
  event_name: string;
  event_start_dt: string;
  event_end_dt: string;
  year: number;
  event_description: string;
  event_type?: 'Festival' | 'Charity' | 'Other';
  location?: string;
  is_active: boolean;
  is_priority?: boolean; // At most one per event_type (Festival / Charity / Other)
  created_at: string;
  updated_at: string;
  photo_gallery_link?: string;
  gallery_is_public?: boolean; // Whether the gallery for this event is public
  event_image_path?: string; // Folder path for event flyer/image in Events_Flyers
  rsvp_link?: string; // Optional external RSVP link
  rsvp_enabled?: boolean; // If true, show RSVP option for this event
  // Structured venue (SEO) + ticketing (SEO offers)
  venue_name?: string;
  venue_street?: string;
  venue_city?: string;
  venue_region?: string;
  venue_postal?: string;
  ticket_url?: string;
  ticket_price?: string;
  ticket_currency?: string;
  event_status?: 'Scheduled' | 'Cancelled' | 'Postponed' | 'Rescheduled';
  performers?: string;
  performer_type?: 'Person' | 'MusicGroup';
  // Legacy fields for backward compatibility
  id?: string;
  title?: string;
  description?: string;
  type?: EventType;
  date?: string;
  time?: string;
  imageUrl?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface SubEvent {
  sub_event_id: string;
  sub_event_name: string;
  sub_event_start_dt: string;
  sub_event_end_dt: string;
  year: number;
  event_description: string;
  location: string;
  is_active: boolean;
  event_id: string;
  created_at: string;
  updated_at: string;
  event_image_path?: string;
  rsvp_link?: string;
  rsvp_enabled?: boolean; // If true, allow RSVP (either external link or internal form)
  show_in_home_page?: boolean; // If true, show this sub-event on home page below priority event
  show_in_durga_puja_page?: boolean; // If true, show this sub-event (with banner) on the /durga-puja page

  // Dedicated SEO page (opt-in)
  seo_page_enabled?: boolean;
  seo_event_type?: SubEventSeoType;
  performers?: string;
  performer_type?: 'Person' | 'MusicGroup';
  venue_name?: string;
  venue_city?: string;
  venue_region?: string;
  venue_street?: string;
  venue_postal?: string;
  venue_area?: string;
  ticket_url?: string;
  ticket_price?: string;
  ticket_currency?: string;
}

export type SubEventSeoType =
  | 'Event'
  | 'MusicEvent'
  | 'TheaterEvent'
  | 'Festival'
  | 'ChildrensEvent'
  | 'FoodEvent';

export interface RSVP {
  id: string;
  eventId?: string; // Optional - required if subEventId is not provided
  subEventId?: string; // Optional - required if eventId is not provided
  userId?: string;
  email: string;
  name: string;
  phone: string;
  numberOfGuests?: number; // Legacy field for backward compatibility
  numberOfAdults: number;
  numberOfChildren: number;
  attendeeNames?: string[]; // Names of all attendees (adults + children)
  status: 'confirmed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface Notice {
  notice_id: string; // 12 digit alphanumeric, auto-generated
  notice_name: string;
  notice_body: string;
  event_id?: string; // optional, links to an event
  notice_image_path?: string; // optional image path
  is_active: boolean; // defaults to true
  is_published: boolean; // defaults to false
  created_at: string;
  updated_at: string;
  // Legacy fields for backward compatibility (optional)
  id?: string;
  title?: string;
  content?: string;
  isPublic?: boolean;
  priority?: 'low' | 'medium' | 'high';
  expiryDate?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface Photo {
  id: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  uploadedAt: string;
  filename?: string; // For deletion purposes
  type?: 'image' | 'video'; // Media type: image or video
}

export interface PhotoGallery {
  id: string;
  eventId?: string;
  title: string;
  description?: string;
  isPublic: boolean;
  specialAccessCode?: string;
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  event_start_dt?: string; // Event start date for sorting
}

export interface Magazine {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  coverImageUrl?: string;
  isPublic: boolean;
  specialAccessCode?: string;
  publishDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface News {
  news_id: string;
  title: string;
  content: string;
  media_type: 'video' | 'link' | 'article' | 'image';
  media_url?: string;
  media_file_path?: string;
  is_active: boolean;
  is_published: boolean;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Legacy fields for backward compatibility
  id?: string;
}

export interface Document {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  coverImageUrl?: string;
  isPublic: boolean;
  specialAccessCode?: string;
  publishDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface Expense {
  id: string;
  eventId?: string;
  title: string;
  description?: string;
  amount: number;
  category: string;
  date: string;
  receiptUrl?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

