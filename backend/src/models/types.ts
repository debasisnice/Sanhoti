export enum UserRole {
  ADMIN = 'admin',
  MEMBER = 'member',
  PUBLIC = 'public',
}

export enum EventType {
  POILA_BOISHAKH = 'Poila Boishakh',
  ANNUAL_PICNIC = 'Annual Picnic',
  DURGA_PUJA = 'Durga Puja',
  DIWALI = 'Diwali',
  HOLIDAY_PARTY = 'Holiday Party',
  SARASWATI_PUJA = 'Saraswati Puja',
  ADHOC = 'Adhoc',
}

export interface User {
  user_id: string; // 12 digit alphanumeric
  first_name: string;
  last_name: string;
  phone_number: string;
  email_address: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  password_hash: string;
  user_type: string; // defaults to "user"
  member_type: string; // defaults to "member"
  is_active: boolean; // defaults to true
  created_at: string;
  updated_at: string;
}

export interface Event {
  event_id: string;
  event_name: string;
  event_start_dt: string;
  event_end_dt: string;
  year: number;
  event_description: string;
  event_type?: 'Festival' | 'Charity' | 'Other';
  location?: string;
  photo_gallery_link?: string;
  gallery_is_public?: boolean; // Whether the gallery for this event is public
  event_image_path?: string; // Folder path for event flyer/image in Events_Flyers
  rsvp_link?: string; // Optional external RSVP link
  rsvp_enabled?: boolean; // If true, show RSVP option for this event
  is_active: boolean;
  is_priority?: boolean;
  /**
   * Exactly one Durga-named event should carry this flag. It marks the event
   * that feeds the public /durga-puja landing page (dates, venue, sub-events)
   * and shows the "Edit Durga Puja Page" shortcut in the admin events table.
   */
  is_active_durga_puja_event?: boolean;
  created_at: string;
  updated_at: string;
  // Legacy fields for backward compatibility (optional)
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

export interface RSVP {
  id: string;
  eventId?: string; // Optional - required if subEventId is not provided
  subEventId?: string; // Optional - required if eventId is not provided
  userId?: string; // optional for guest RSVPs
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

export interface News {
  news_id: string; // 12 digit alphanumeric, auto-generated
  title: string;
  content: string; // Article text content
  media_type: 'video' | 'link' | 'article' | 'image'; // Type of media
  media_url?: string; // URL for video, link, or image
  media_file_path?: string; // Path for uploaded video/image file
  is_active: boolean; // defaults to true
  is_published: boolean; // defaults to false
  is_archived?: boolean; // defaults to false
  created_at: string;
  updated_at: string;
  created_by?: string; // User ID who created the news
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

export interface SpecialAccessCode {
  id: string;
  code: string;
  description?: string;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface Message {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  message: string;
  userId?: string; // optional, if logged in user
  createdAt: string;
  read: boolean;
  responded?: boolean; // true if message has been replied to via email
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

export interface SubEvent {
  sub_event_id: string; // 12 digit alphanumeric
  sub_event_name: string;
  sub_event_start_dt: string;
  sub_event_end_dt: string;
  year: number;
  event_description: string;
  location: string;
  is_active: boolean;
  event_id: string; // Parent event id
  created_at: string;
  updated_at: string;
  event_image_path?: string; // Folder path for sub-event image
  rsvp_link?: string; // Optional external RSVP link
  rsvp_enabled?: boolean; // If true, allow RSVP (either external link or internal form)
  show_in_home_page?: boolean; // If true, show this sub-event on home page below priority event
  show_in_durga_puja_page?: boolean; // If true, show this sub-event (with banner) on the /durga-puja page

  // ---- Dedicated SEO page (opt-in) ----
  /** If true, generate a crawlable /sub-events/:id SEO page + sitemap entry. */
  seo_page_enabled?: boolean;
  /** schema.org Event subtype for structured data. Default 'Event'. */
  seo_event_type?: SubEventSeoType;
  /** Performer name(s), comma-separated (e.g. "Akriti Kakar"). Used for MusicEvent performer schema. */
  performers?: string;
  /** Performer schema type. Default 'Person' (solo artist); use 'MusicGroup' for a band. */
  performer_type?: 'Person' | 'MusicGroup';
  /** Structured venue for schema.org Place/PostalAddress. */
  venue_name?: string;
  venue_city?: string; // addressLocality, e.g. "Costa Mesa"
  venue_region?: string; // addressRegion, e.g. "CA"
  venue_street?: string; // streetAddress
  venue_postal?: string; // postalCode
  /** Broad area keyword for titles/description, e.g. "Orange County" or "Los Angeles". */
  venue_area?: string;
  /** Ticketing (schema.org offers). */
  ticket_url?: string;
  ticket_price?: string; // numeric string; empty = omit price
  ticket_currency?: string; // default 'USD'
}

/** schema.org Event subtypes offered for sub-event SEO pages. */
export type SubEventSeoType =
  | 'Event'
  | 'MusicEvent'
  | 'TheaterEvent'
  | 'Festival'
  | 'ChildrensEvent'
  | 'FoodEvent';

/** Home page About / Vision / Mission / Purpose tab bodies (plain text; see site docs for formatting). */
export interface HomePageStatements {
  about?: string;
  vision?: string;
  mission?: string;
  purpose?: string;
}

/** Per-tab visibility on the home page; omitted or true = show, false = hide. */
export interface HomeStatementTabsVisibility {
  about?: boolean;
  vision?: boolean;
  mission?: boolean;
  purpose?: boolean;
}

/** Visibility of the individual hero buttons on the home page; omitted or true = show, false = hide. */
export interface HomeHeroButtonsVisibility {
  /** "Join our Facebook Page" button. */
  facebook?: boolean;
  /** "Join us in WhatsApp" button. */
  whatsapp?: boolean;
  /** "View Events" button. */
  viewEvents?: boolean;
  /** "Durga Puja" button. */
  durgaPuja?: boolean;
  /** "View Charity Events" button (right-side charity column). */
  viewCharityEvents?: boolean;
}

export interface DurgaPujaFaq {
  question: string;
  answer: string;
}

/** External ticket-booking link shown on the /durga-puja page. */
export interface TicketLink {
  /** Button label, e.g. "Full Event Pass" or "Cultural Night Only". */
  label: string;
  /** External ticketing URL (http/https), e.g. Eventbrite/Sulekha page. */
  url: string;
}

// ---------------------------------------------------------------------------
// Seat booking ("Book Your Seat") — native ticketing for the active Durga Puja
// event: seat map, categories/pricing, timed holds, discounts, bookings.
// ---------------------------------------------------------------------------

/** Price/color tier, e.g. VIP / Premium / General. */
export interface SeatCategory {
  category_id: string;
  name: string;
  color: string; // hex used on the seat map legend
  /** Adult ticket price (USD). Legacy `price` is treated as adult_price when omitted. */
  adult_price: number;
  /** Child ticket price (USD), using child_age_range on the profile. */
  child_price: number;
  /** When true, this tier is offered on the entire-event pass. */
  entire_event_enabled?: boolean;
  /** @deprecated Use adult_price. Kept for backward compatibility with saved data. */
  price?: number;
}

/** Defines who qualifies for child pricing on this event. */
export interface ChildAgeRange {
  min_age: number;
  max_age: number;
}

/** Per-day lunch/dinner pricing for the main event (not tied to seat maps). */
export interface MealDayPricing {
  day_id: string;
  label: string;
  /** Optional calendar date (YYYY-MM-DD) for this Puja day. */
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

/** Per-category seat pricing for one sub-event concert map. */
export interface SubEventCategoryPricing {
  category_id: string;
  adult_price: number;
  child_price: number;
}

/** Ticketing options for one sub-event (concert maps + food add-ons). */
export interface SubEventTicketingConfig {
  sub_event_id: string;
  /** Concert sub-events get a seat map on the Seat Maps tab. */
  ticketing_type: SubEventTicketingType;
  /** Master category IDs enabled for this sub-event's seat map. */
  enabled_category_ids: string[];
  /** Seat prices per enabled category on this sub-event. */
  category_prices: SubEventCategoryPricing[];
  food_addons: FoodAddon[];
  /** @deprecated Migrated to enabled_category_ids — legacy sub-event category copies. */
  categories?: SeatCategory[];
}

/**
 * A block of seats sharing one category.
 * Grid mode: a rectangle of rows × seats_per_row.
 * Image mode: each physical row placed on the venue map is a section with
 * rows === 1, and its seats get x/y positions in SeatingConfig.seat_positions.
 */
export interface SeatingSection {
  section_id: string;
  name: string; // grid: "Center"; image: row label like "Odd A"
  rows: number;
  seats_per_row: number;
  category_id: string;
  /** Display numbering (labels only): first seat's number, default 1. */
  seat_number_start?: number;
  /** Display numbering step — 2 gives odd/even theatre numbering. Default 1. */
  seat_number_step?: number;
}

/** Percent coordinates (0-100) of a seat on the uploaded venue map image. */
export interface SeatPosition {
  x: number;
  y: number;
}

/**
 * Seat ids are `${section_id}:${row}:${seat}` with 1-based row/seat numbers,
 * e.g. "SEC1:3:12". Row 1 is closest to the stage.
 */
export interface SeatingConfig {
  /** Event this seating/booking belongs to — required before booking can open. */
  event_id?: string;
  /** Optional: narrow the association to one sub-event of that event (e.g. a paid concert night). */
  sub_event_id?: string;
  is_open: boolean; // whether public booking is open
  hold_minutes: number; // how long a checkout hold lasts
  categories: SeatCategory[];
  sections: SeatingSection[];
  /**
   * 'matrix' (preferred): admin-painted grid of seats/passages with the stage
   * on top. 'grid' renders sections as rectangles (legacy). 'image' is a
   * legacy value kept only so old saved configs stay readable.
   */
  layout_mode?: 'grid' | 'image' | 'matrix';
  /** Matrix mode: overall grid dimensions the seats live in. */
  matrix?: { rows: number; cols: number };
  /**
   * Seat coordinates keyed by seat_id. Matrix mode: x = column, y = row
   * (1-based cell indices). Legacy image mode: percent positions.
   */
  seat_positions?: Record<string, SeatPosition>;
  /** Seats the admin blocked from sale (reserved/broken/aisle). */
  blocked_seats: string[];
  /** Optional note shown on the booking page, e.g. "Doors open 5pm". */
  booking_note?: string;
  updated_at: string;
}

/** One independently managed venue layout belonging to an event/sub-event. */
export interface SeatMap {
  map_id: string;
  event_id: string;
  sub_event_id?: string;
  name: string;
  is_open: boolean;
  matrix: { rows: number; cols: number };
  sections: SeatingSection[];
  seat_positions: Record<string, SeatPosition>;
  blocked_seats: string[];
  updated_at: string;
  /** Set only on the map produced by the one-time singleton-config migration. */
  migrated_from_legacy?: boolean;
}

/** Reusable seat layout (max two slots) independent of any event. */
export interface SeatMapTemplateSeat {
  row: number;
  col: number;
  category_name: string;
  blocked?: boolean;
}

export interface SeatMapTemplate {
  template_id: string;
  /** Fixed slot 1 or 2 — at most two saved layouts globally. */
  slot: 1 | 2;
  name: string;
  matrix: { rows: number; cols: number };
  seats: SeatMapTemplateSeat[];
  updated_at: string;
}

/** Event-level ticketing settings shared by every map for that event. */
export interface TicketingProfile {
  event_id: string;
  /** Seat categories for whole-event / main concert maps. */
  categories: SeatCategory[];
  child_age_range: ChildAgeRange;
  /** Lunch/dinner pricing by Puja day (main event; not seat booking). */
  meal_days: MealDayPricing[];
  /** Per sub-event ticketing: concert seat tiers and checkout food add-ons. */
  sub_event_configs: SubEventTicketingConfig[];
  hold_minutes: number;
  payment_window_hours: number;
  booking_note?: string;
  updated_at: string;
}

/** Temporary lock on seats while a buyer completes checkout. */
export interface SeatHold {
  hold_id: string;
  seat_ids: string[];
  expires_at: string;
  created_at: string;
}

export interface BookedSeatDetail {
  seat_id: string;
  label: string; // human-readable, e.g. "Center — Row C, Seat 12"
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
  /** Event (and optionally sub-event) this booking belongs to — set from the config at checkout. */
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
  /** ISO deadline for pending_payment; stamped at checkout from profile payment_window_hours. */
  payment_due_at?: string;
  /** Admin-recorded Zelle confirmation or payment note (set on Mark Paid). */
  payment_reference?: string;
  /** Unique token for event-day admission QR scanning (issued on Mark Paid). */
  admission_qr_token?: string;
  /** ISO timestamp when admission_qr_token was first issued. */
  admission_qr_generated_at?: string;
  /**
   * Event-day check-ins keyed by gate scope (sub:, meal:, addon:, or event).
   * Each gate tracks how many people have been admitted (partial check-in supported).
   */
  admission_checkins?: Record<string, GateCheckin>;
  /** ISO timestamp of the most recent check-in across gates (mirror/back-compat). */
  admission_checked_in_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DiscountCode {
  discount_id: string;
  code: string; // stored uppercase
  type: 'percent' | 'fixed';
  value: number; // percent (0-100) or USD amount
  min_seats?: number; // minimum seats in the order to qualify
  max_uses?: number; // total redemption cap
  used_count: number;
  valid_from?: string; // ISO date
  valid_until?: string; // ISO date (inclusive)
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Frozen snapshot of an event's ticketing configuration at save/archive time. */
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

/** Saved, archivable ticket setup for one event (one active per event). */
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

/** Reusable theater seat layout in the saved-maps library (unlimited). */
export interface TheaterMap {
  theater_map_id: string;
  name: string;
  matrix: { rows: number; cols: number };
  seats: SeatMapTemplateSeat[];
  created_at: string;
  updated_at: string;
}

/** A call-to-action button in the Durga Puja hero (label + target). */
export interface DurgaPujaCta {
  label: string;
  /** Anchor (#tickets), internal path (/book-your-seat), or external URL. */
  href: string;
  style?: 'primary' | 'secondary';
}

/** A highlight card (Section 2 — event highlights). */
export interface DurgaPujaHighlight {
  title: string;
  text?: string;
  /** lucide icon key (see FE map): sparkles, music, utensils, users, etc. */
  icon?: string;
  imageUrl?: string;
}

/** One row within a day's schedule. */
export interface DurgaPujaScheduleItem {
  time?: string;
  title: string;
  description?: string;
}

/** One day of the three-day schedule (Section 3). */
export interface DurgaPujaScheduleDay {
  dayLabel: string;
  date?: string;
  items: DurgaPujaScheduleItem[];
}

/** A featured artist (Section 4). */
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

/** Structured ticket details (Section 5). */
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

/** Venue & parking details (Section 6). */
export interface DurgaPujaVenueInfo {
  /** Event/venue label for additional venues, e.g. "Durga Puja" or "Subhadeep Concert". */
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

/** A single meal listing (Section 7). */
export interface DurgaPujaMeal {
  name: string;
  description?: string;
  hours?: string;
}

/** Food information (Section 7). */
export interface DurgaPujaFoodInfo {
  intro?: string;
  meals?: DurgaPujaMeal[];
  vegetarian?: string;
  kidsMenu?: string;
  allergyNotice?: string;
  tokenProcess?: string;
  photos?: string[];
}

/** A puja/ritual timing (Section 8). */
export interface DurgaPujaTiming {
  label: string;
  time?: string;
}

/** Puja & religious information (Section 8). */
export interface DurgaPujaPujaInfo {
  intro?: string;
  timings?: DurgaPujaTiming[];
  priestInfo?: string;
  itemsToBring?: string;
  attireGuidance?: string;
  rules?: string;
}

/** A children/family activity (Section 9). */
export interface DurgaPujaKidsActivity {
  title: string;
  description?: string;
}

/** Children & family activities (Section 9). */
export interface DurgaPujaKidsInfo {
  intro?: string;
  activities?: DurgaPujaKidsActivity[];
  ageRequirements?: string;
  supervisionPolicy?: string;
}

/** A sponsorship package (Section 10). */
export interface DurgaPujaSponsorPackage {
  name: string;
  price?: string;
  benefits?: string[];
}

/** Sponsorship information (Section 10). */
export interface DurgaPujaSponsorshipInfo {
  intro?: string;
  packages?: DurgaPujaSponsorPackage[];
  packagePdfUrl?: string;
  contactEmail?: string;
  contactNote?: string;
}

/** Vendor & stall registration (Section 11). */
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

/** Volunteer registration (Section 12). */
export interface DurgaPujaVolunteerInfo {
  intro?: string;
  categories?: string[];
  contactEmail?: string;
  formUrl?: string;
}

/** Previous-year gallery (Section 14). */
export interface DurgaPujaGalleryInfo {
  intro?: string;
  galleryLink?: string;
  videoUrl?: string;
  images?: string[];
}

/** A contact row (Section 16). */
export interface DurgaPujaContact {
  role: string;
  name?: string;
  email?: string;
  phone?: string;
}

/** Social links (Section 16). */
export interface DurgaPujaSocial {
  facebook?: string;
  instagram?: string;
  youtube?: string;
  whatsapp?: string;
}

/**
 * Per-section visibility on the public page; omitted or true = shown.
 * Keys map to the 16 sections plus the sub-events strip.
 */
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

/** Admin-editable content for a public /durga-puja-YYYY landing page. */
export interface DurgaPujaPageContent {
  /** Celebration year this page represents (e.g. 2026 → /durga-puja-2026). */
  year: number;
  /** Intro paragraph under the H1. */
  intro: string;
  /** Human-readable dates line, e.g. "October 16–21, 2026 (Shashthi through Vijayadashami)". */
  datesText: string;
  /** ISO dates (yyyy-mm-dd) for Event structured data. */
  startDate: string;
  endDate: string;
  /** e.g. "Estancia High School" or "Venue to be announced — Orange County, CA". */
  venueName: string;
  /** City for structured data + copy, e.g. "Costa Mesa". */
  venueCity: string;
  /** Note shown next to the venue (schedule/announcement). */
  venueNote: string;
  faqs: DurgaPujaFaq[];
  /** External ticket-booking links; empty/absent = show "booking opens soon" placeholder. */
  ticketLinks?: TicketLink[];
  /** Optional note shown with the ticket links, e.g. "Early-bird pricing until Sep 1". */
  ticketsNote?: string;
  /**
   * Public-page ticketing visibility (admin-controlled from the Durga Puja page).
   * All default to their historical behavior when absent:
   *  - showInternalBooking (default true): show the in-website "Book Your Seat" CTA
   *    (still also requires the seat system to be open).
   *  - showExternalTickets (default true): show external ticket link buttons.
   *  - ticketsOff (default false): master switch — hides ALL ticketing on the page.
   */
  showInternalBooking?: boolean;
  showExternalTickets?: boolean;
  ticketsOff?: boolean;
  /**
   * Show the saved ticket pricing configured on the Book Your Seat admin page
   * (entire-event category prices, child age range, daily meal pricing, sub-event
   * ticketing). Default false — only shown when the admin checks the box.
   */
  showSavedTickets?: boolean;
  /** Embed the Yapsody event-list widget in the Tickets section (default false). */
  showYapsodyWidget?: boolean;
  /** Yapsody widget event id (e.g. "212239" → div id yapwid-event-212239). */
  yapsodyEventId?: string;
  /** Yapsody widget data-venue-code (e.g. "sanhoti"). */
  yapsodyVenueCode?: string;
  /** Show a Donate button in the Tickets section (links to /donate). */
  showDonateButtonInTickets?: boolean;
  /** Event this page's dates/venue were last auto-synced from (name contains "Durga"). */
  linkedEventId?: string;

  // ---- Section 1: Hero ----
  /** Short hero message under the H1 (e.g. "Join Sanhoti for three unforgettable days…"). */
  heroTagline?: string;
  /** Hero sub-headline, e.g. "Akriti Kakar & Subhadeep Das Live". */
  heroSubheadline?: string;
  /** Show the countdown to the start date in the hero (default true). */
  showCountdown?: boolean;
  /** Hero call-to-action buttons (Buy Tickets / View Schedule / Sponsor / Volunteer). */
  ctaButtons?: DurgaPujaCta[];

  // ---- Section 2: Highlights ----
  highlights?: DurgaPujaHighlight[];
  /** e.g. "Approximately 1,000 attendees". */
  expectedAttendance?: string;

  // ---- Section 3: Schedule ----
  scheduleNote?: string;
  scheduleDays?: DurgaPujaScheduleDay[];

  // ---- Section 4: Artists ----
  artists?: DurgaPujaArtist[];

  // ---- Section 5: Ticketing details ----
  ticketing?: DurgaPujaTicketing;

  // ---- Section 6: Venue & parking ----
  venue?: DurgaPujaVenueInfo;
  /** Additional named venues (e.g. a concert at a different location). */
  venues?: DurgaPujaVenueInfo[];
  /**
   * Show the venue name/address auto-pulled from the linked event and the
   * sub-event venue list. Default true. Uncheck to show only the venues the admin
   * adds explicitly (the Venue section itself still shows).
   */
  showVenueDefaults?: boolean;

  // ---- Section 7: Food ----
  food?: DurgaPujaFoodInfo;

  // ---- Section 8: Puja & religious ----
  puja?: DurgaPujaPujaInfo;

  // ---- Section 9: Children & family ----
  kids?: DurgaPujaKidsInfo;

  // ---- Section 10: Sponsorship ----
  sponsorship?: DurgaPujaSponsorshipInfo;

  // ---- Section 11: Vendors & stalls ----
  vendors?: DurgaPujaVendorInfo;

  // ---- Section 12: Volunteer ----
  volunteer?: DurgaPujaVolunteerInfo;

  // ---- Section 13: About Sanhoti ----
  about?: string;

  // ---- Section 14: Previous-year gallery ----
  gallery?: DurgaPujaGalleryInfo;

  // ---- Section 16: Contact ----
  contacts?: DurgaPujaContact[];
  social?: DurgaPujaSocial;

  /** Per-section visibility toggles. */
  sections?: DurgaPujaSectionToggles;

  updated_at: string;
}

export interface Settings {
  navbar: {
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
  };
  zellePhoneNumber?: string;
  /** Stripe Buy Button on /donate (publishable key is safe to expose publicly). */
  showStripeDonateButton?: boolean;
  stripeBuyButtonId?: string;
  stripePublishableKey?: string;
  facebookLink?: string;
  whatsappLink?: string;
  instagramLink?: string;
  /** Full URL to Sanhoti YouTube channel; shown on public /galleries (admin: Galleries management). */
  youtubeChannelUrl?: string;
  emailAddress?: string;
  emailPassword?: string;
  committeeYear?: string;
  statements?: HomePageStatements;
  statementTabsVisibility?: HomeStatementTabsVisibility;
  /** Center hero banner text (Bengali/any script). Omitted or empty = no banner on home. */
  homeHeroBannerMessage?: string;
  /** Per-button visibility for the home page hero buttons; omitted or true = show. */
  homeHeroButtons?: HomeHeroButtonsVisibility;
  updated_at: string;
}
