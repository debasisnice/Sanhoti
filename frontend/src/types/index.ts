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
  /** Artist records featured here — links the event to its /artists page. */
  artist_ids?: string[];
  // ---- admin-authored SEO overrides ----
  meta_title?: string;
  meta_description?: string;
  image_alt?: string;
  faqs?: SeoFaq[];
  /** Food served at this event (Durga Puja uses the Durga Puja page instead). */
  menu?: EventMenu;
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
  /** Artist records featured here — links the event to its /artists page. */
  artist_ids?: string[];
  // ---- admin-authored SEO overrides ----
  meta_title?: string;
  meta_description?: string;
  image_alt?: string;
  faqs?: SeoFaq[];
  /** Food served at this sub-event. */
  menu?: EventMenu;
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


// ============================================================================
// Artists — dedicated, crawlable /artists/<slug> pages
// Mirrors backend/src/models/types.ts. Performers used to be a free-text field
// on an event, which gave search engines nothing to rank when someone searched
// the artist's name; an Artist record becomes its own indexable entity page.
// ============================================================================

/** One external profile emitted as schema.org `sameAs`. */
export interface ArtistLink {
  label: string;
  url: string;
}

export interface Artist {
  artist_id: string;
  /** URL slug used at /artists/<slug>. */
  slug: string;
  name: string;
  /** Comma-separated spelling variants, e.g. "Akriti Kakkar, Aakriti Kakar". */
  alternate_names?: string;
  artist_type?: 'Person' | 'MusicGroup';
  short_bio?: string;
  bio?: string;
  genres?: string;
  roles?: string;
  origin?: string;
  image_path?: string;
  image_alt?: string;
  website_url?: string;
  wikipedia_url?: string;
  social_links?: ArtistLink[];
  video_urls?: string[];
  meta_title?: string;
  meta_description?: string;
  is_active: boolean;
  is_featured?: boolean;
  previous_slugs?: string[];
  created_at: string;
  updated_at: string;
}

/** One Sanhoti event or sub-event an artist has performed at. */
export interface ArtistAppearance {
  kind: 'event' | 'sub-event';
  event: Event | SubEvent;
}

export interface ArtistAppearances {
  upcoming: ArtistAppearance[];
  past: ArtistAppearance[];
}

/** A performer name found on an event that has no Artist record yet. */
export interface ArtistSuggestion {
  name: string;
  proposedSlug: string;
  sources: Array<{ kind: 'event' | 'sub-event'; id: string; title: string }>;
  /** Source record types this performer as a band — usually wrong for a soloist. */
  flaggedAsMusicGroup: boolean;
}

// ============================================================================
// Blogs — long-form articles at /blogs/<slug>
// ============================================================================

export interface Blog {
  blog_id: string;
  slug: string;
  title: string;
  body: string;
  excerpt?: string;
  author_name?: string;
  author_contact?: string;
  cover_image_path?: string;
  cover_image_alt?: string;
  tags?: string;
  published_at?: string;
  meta_title?: string;
  meta_description?: string;
  is_published: boolean;
  is_active: boolean;
  is_featured?: boolean;
  previous_slugs?: string[];
  created_at: string;
  updated_at: string;
}

/** Blog as returned by the public API (body pre-rendered to HTML). */
export interface PublicBlog {
  blog_id: string;
  slug: string;
  title: string;
  body_html?: string;
  excerpt: string;
  author_name?: string;
  author_contact?: string;
  cover_image_url?: string;
  cover_image_alt: string;
  tags: string[];
  published_at: string;
  updated_at: string;
  reading_minutes: number;
  meta_title?: string;
  meta_description?: string;
  is_featured: boolean;
  path: string;
}

/** A labelled group within a meal, e.g. "Veg", "Non-Veg", "Kids Meal". */
export interface MenuCategory {
  label: string;
  items: string[];
  color?: string;
}

/** One meal service, e.g. "Saturday Lunch" with its serving hours. */
export interface MenuMeal {
  name: string;
  description?: string;
  hours?: string;
  categories?: MenuCategory[];
  bgColor?: string;
}

/**
 * Food served at an event or sub-event. Structurally identical to the Durga
 * Puja food shape so one editor and one schema builder serve both.
 */
export interface EventMenu {
  intro?: string;
  meals?: MenuMeal[];
  vegetarian?: string;
  kidsMenu?: string;
  allergyNotice?: string;
}

/** One question/answer pair emitted as schema.org FAQPage. */
export interface SeoFaq {
  question: string;
  answer: string;
}

/** Admin-authored SEO overrides shared by events and sub-events. */
export interface SeoOverrideFields {
  meta_title?: string;
  meta_description?: string;
  image_alt?: string;
  faqs?: SeoFaq[];
  artist_ids?: string[];
}
