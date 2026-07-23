import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar,
  MapPin,
  Music,
  Utensils,
  Users,
  Sparkles,
  Ticket,
  ChevronLeft,
  Clock,
  Car,
  Baby,
  Store,
  Heart,
  Info,
  Phone,
  Mail,
  ImageIcon,
  Youtube,
  Facebook,
  Instagram,
  MessageCircle,
  ExternalLink,
  PartyPopper,
} from 'lucide-react';
import Seo from '../components/Seo';
import YapsodyEventListEmbed from '../components/YapsodyEventListEmbed';
import { getSiteOrigin } from '../utils/eventShareUrl';
import {
  durgaPujaPageAPI,
  DurgaPujaPageContent,
  DurgaPujaArtist,
  DurgaPujaHighlight,
  subEventsAPI,
  ticketingAPI,
  categoriesForEntireEvent,
  categoriesForSubEvent,
  categoryAdultPrice,
  categoryChildPrice,
  PublicTicketingConfig,
} from '../services/api';
import { SubEvent } from '../types';
import { formatDateWithTime } from '../utils/dateUtils';
import { durgaPujaPagePath, parseDurgaPujaYearFromPath } from '../utils/durgaPuja';
import { toVideoEmbedUrl } from '../utils/videoEmbedUrl';

/**
 * Year-specific Durga Puja landing page at /durga-puja-YYYY.
 * A full festival page (hero + countdown, highlights, 3-day schedule, artists,
 * tickets, venue/parking, food, puja info, kids, sponsorship, vendors, volunteer,
 * about, gallery, FAQ, contact). All content is admin-editable per year from
 * /admin/durga-puja; the hero/schedule/sub-events flow from the linked event.
 * /durga-puja redirects to the active year.
 */

const DEFAULT_CONTENT = (year: number): DurgaPujaPageContent => ({
  year,
  intro:
    "Sanhoti Bengali Association hosts one of Orange County's most vibrant Durga Puja (Durgotsav) celebrations — three days of puja, pushpanjali, dhunuchi naach, Bengali food, and evening cultural concerts. Our celebration welcomes Bengali and Indian families from across Southern California.",
  datesText: `October 16–21, ${year} (Shashthi through Vijayadashami)`,
  startDate: `${year}-10-16`,
  endDate: `${year}-10-21`,
  venueName: 'Venue to be announced — Orange County, CA',
  venueCity: 'Costa Mesa',
  venueNote: 'Schedule and venue will be announced on our Events page.',
  faqs: [
    {
      question: 'Where is Durga Puja celebrated in Orange County?',
      answer:
        "Sanhoti Bengali Association hosts Durga Puja in central Orange County, an easy drive from Irvine, Tustin, Santa Ana, Anaheim, and Mission Viejo.",
    },
    {
      question: 'Is there a Durga Puja near Irvine?',
      answer:
        "Yes — Sanhoti's Durga Puja is held minutes from Irvine, CA. The celebration includes puja, pushpanjali, dhunuchi naach, Bengali food, and cultural concerts.",
    },
    {
      question: 'Is Durga Puja open to non-members?',
      answer:
        'Yes. Sanhoti Durga Puja is open to the entire community — families, students, and visitors from across Southern California are welcome.',
    },
  ],
  ticketLinks: [],
  ticketsNote: '',
  updated_at: '',
});

/** Icon key → component, used by admin-configured highlight cards. */
const HIGHLIGHT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  music: Music,
  utensils: Utensils,
  users: Users,
  calendar: Calendar,
  ticket: Ticket,
  heart: Heart,
  baby: Baby,
  store: Store,
  party: PartyPopper,
};

/** Sponsor tiers, most prominent first, with a gradient accent per tier. */
const SPONSOR_TIERS: { key: string; label: string; accent: string }[] = [
  { key: 'PRESENTING', label: 'Presenting Sponsor', accent: 'from-orange-500 to-primary-600' },
  { key: 'PLATINUM', label: 'Platinum Sponsors', accent: 'from-slate-400 to-slate-500' },
  { key: 'GOLD', label: 'Gold Sponsors', accent: 'from-amber-400 to-yellow-500' },
  { key: 'SILVER', label: 'Silver Sponsors', accent: 'from-gray-300 to-gray-400' },
];

const DEFAULT_HIGHLIGHTS: DurgaPujaHighlight[] = [
  {
    icon: 'sparkles',
    title: 'Traditional Puja & Rituals',
    text: 'Anjali, Sandhi Puja, dhunuchi naach, and Sindoor Khela across three days.',
  },
  {
    icon: 'music',
    title: 'Live Cultural Performances',
    text: 'Evening concerts by visiting artists plus Bengali cultural programs.',
  },
  {
    icon: 'utensils',
    title: 'Authentic Bengali Food',
    text: 'Home-style bhog and Bengali food stalls throughout the celebration.',
  },
  {
    icon: 'baby',
    title: "Children's Activities",
    text: 'Games, art, and youth performances — a family-friendly celebration.',
  },
  {
    icon: 'store',
    title: 'Shopping & Community Stalls',
    text: 'Clothing, jewelry, food, and community organization stalls.',
  },
  {
    icon: 'users',
    title: 'Open to Everyone',
    text: 'Families, students, and visitors from across Southern California are welcome.',
  },
];

function featuredArtistPageHref(artist: DurgaPujaArtist): string | null {
  if (!artist.linkSubEventPage || !artist.subEventId?.trim()) return null;
  return `/sub-events/${artist.subEventId.trim()}`;
}

/** Hero / ticket CTAs that should not appear after the celebration has ended. */
function isTicketRelatedCta(cta: { label?: string; href?: string }): boolean {
  const label = (cta.label ?? '').trim().toLowerCase();
  const href = (cta.href ?? '').trim().toLowerCase();
  if (href === '#tickets' || href.endsWith('#tickets')) return true;
  if (href.includes('/book-your-seat')) return true;
  return (
    /\b(buy|book)\s+(tickets?|seats?)\b/.test(label) ||
    label.includes('book your seat')
  );
}

const ARTIST_CARD_CLS =
  'group flex flex-col h-full bg-white rounded-2xl shadow-md overflow-hidden border border-yellow-200/70 transition-all duration-300 hover:shadow-xl hover:-translate-y-1';

const ARTIST_VIDEO_CARD_CLS =
  'bg-white rounded-2xl shadow-md overflow-hidden border border-yellow-200/70 p-4';

function FeaturedArtistCard({ artist }: { artist: DurgaPujaArtist }) {
  const href = featuredArtistPageHref(artist);
  const body = (
    <>
      {artist.imageUrl && (
        <div className="relative overflow-hidden">
          <img
            src={artist.imageUrl}
            alt={artist.name}
            className="w-full h-60 object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-red-600 text-white text-[0.65rem] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Live in Concert
          </span>
          <div className="absolute bottom-3 left-4 right-4">
            <h3 className="font-bold text-xl text-white drop-shadow">{artist.name}</h3>
            {artist.performanceType && (
              <p className="text-sm font-medium text-yellow-200 drop-shadow">{artist.performanceType}</p>
            )}
          </div>
        </div>
      )}
      <div className="p-5 flex flex-col gap-1.5 flex-1">
        {!artist.imageUrl && (
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary-600 flex-shrink-0" />
            <h3 className="font-bold text-lg text-gray-900">{artist.name}</h3>
          </div>
        )}
        {!artist.imageUrl && artist.performanceType && (
          <p className="text-sm font-medium text-primary-700">{artist.performanceType}</p>
        )}
        {artist.dateTime && (
          <p className="text-sm text-gray-700 font-medium flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary-600" />
            {artist.dateTime}
          </p>
        )}
        {artist.bio && <p className="text-sm text-gray-600 leading-relaxed mt-1">{artist.bio}</p>}
        {artist.ticketInfo && (
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <Ticket className="w-3.5 h-3.5" />
            {artist.ticketInfo}
          </p>
        )}
        {href && (
          <span className="mt-auto pt-3 text-sm font-semibold text-primary-600 inline-flex items-center gap-1 group-hover:text-primary-700">
            View concert page
            <ExternalLink className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        to={href}
        className={`${ARTIST_CARD_CLS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
      >
        {body}
      </Link>
    );
  }

  return <div className={ARTIST_CARD_CLS}>{body}</div>;
}

function FeaturedArtistVideoCard({ artist }: { artist: DurgaPujaArtist }) {
  if (!artist.videoUrl?.trim()) return null;
  const videoEmbed = toVideoEmbedUrl(artist.videoUrl);

  return (
    <div className={ARTIST_VIDEO_CARD_CLS}>
      <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Youtube className="w-4 h-4 text-primary-600 flex-shrink-0" />
        {artist.name}
        <span className="font-normal text-gray-500">— performance video</span>
      </p>
      {videoEmbed ? (
        <div className="aspect-video rounded-lg overflow-hidden bg-black border border-gray-200">
          <iframe
            src={videoEmbed}
            title={`${artist.name} video`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : (
        <a
          href={artist.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          <Youtube className="w-4 h-4" />
          Watch video
        </a>
      )}
    </div>
  );
}

function FeaturedArtistsGrid({ artists }: { artists: DurgaPujaArtist[] }) {
  const hasAnyVideo = artists.some(a => a.videoUrl?.trim());
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-stretch">
        {artists.map((a, i) => (
          <FeaturedArtistCard key={a.subEventId || `${a.name}-${i}`} artist={a} />
        ))}
      </div>
      {hasAnyVideo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {artists.map((a, i) => (
            <div key={a.subEventId || `${a.name}-${i}-video`}>
              {a.videoUrl?.trim() ? <FeaturedArtistVideoCard artist={a} /> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GoogleMapsLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 bg-primary-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors shrink-0"
    >
      <MapPin className="w-3.5 h-3.5" />
      Open in Google Maps
    </a>
  );
}

/** Countdown to the celebration start; hidden once the date passes. */
function Countdown({ targetIso }: { targetIso: string }) {
  const target = useMemo(() => new Date(`${targetIso}T00:00:00`).getTime(), [targetIso]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!Number.isFinite(target)) return null;
  const diff = target - now;
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  const cells: [number, string][] = [
    [days, 'Days'],
    [hours, 'Hours'],
    [minutes, 'Min'],
    [seconds, 'Sec'],
  ];
  return (
    <div className="flex justify-center gap-3 sm:gap-4 mt-6">
      {cells.map(([value, label]) => (
        <div
          key={label}
          className="bg-white/90 backdrop-blur rounded-xl px-3 sm:px-4 py-2 shadow text-center min-w-[3.75rem]"
        >
          <div className="text-2xl sm:text-3xl font-bold text-primary-700 tabular-nums">
            {String(value).padStart(2, '0')}
          </div>
          <div className="text-[0.65rem] sm:text-xs uppercase tracking-wide text-gray-500">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Renders a CTA/link that may be an anchor (#id), internal path, or external URL. */
/**
 * Normalize an admin-entered link. Anchors (#), internal paths (/), and known
 * protocols (http(s)/mailto/tel) are left alone; a bare host like
 * "forms.gle/abc" or "docs.google.com/…" gets an https:// prefix so buttons
 * actually open it instead of being treated as a same-page anchor.
 */
function normalizeUrl(raw?: string): string {
  const s = (raw || '').trim();
  if (!s) return s;
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(s)) return s;
  return `https://${s}`;
}

function SmartButton({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  const base =
    variant === 'primary'
      ? 'bg-primary-600 text-white hover:bg-primary-700'
      : 'bg-white border-2 border-primary-600 text-primary-600 hover:bg-primary-50';
  const cls = `inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${base} ${className}`;

  // Protocol links (http(s), mailto, tel) — plain anchor, external opens in a new tab.
  if (/^(https?:|mailto:|tel:)/i.test(href)) {
    const external = /^https?:\/\//i.test(href);
    return (
      <a href={href} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    );
  }
  // Internal SPA route.
  if (href.startsWith('/')) {
    return (
      <Link to={href} className={cls}>
        {children}
      </Link>
    );
  }
  // Same-page anchor (accepts "#tickets" or bare "tickets") — smooth-scroll to the
  // target so a sticky navbar and React Router don't swallow the default hash jump.
  const anchorId = href.startsWith('#') ? href.slice(1) : href;
  return (
    <a
      href={`#${anchorId}`}
      className={cls}
      onClick={e => {
        const el = document.getElementById(anchorId);
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          history.replaceState(null, '', `#${anchorId}`);
        }
      }}
    >
      {children}
    </a>
  );
}

function SectionHeading({
  id,
  kicker,
  children,
}: {
  id?: string;
  kicker?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="mb-5 scroll-mt-24">
      {kicker && (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600 mb-1">
          {kicker}
        </p>
      )}
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{children}</h2>
      <div className="mt-2 h-1 w-12 rounded-full bg-gradient-to-r from-primary-500 to-amber-400" />
    </div>
  );
}

export default function DurgaPuja() {
  const location = useLocation();
  const pageYear = parseDurgaPujaYearFromPath(location.pathname) ?? 0;
  const origin = getSiteOrigin();
  const [content, setContent] = useState<DurgaPujaPageContent>(() =>
    DEFAULT_CONTENT(pageYear || new Date().getFullYear())
  );
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [hasImage, setHasImage] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [subEventImages, setSubEventImages] = useState<Record<string, string>>({});
  const [seatBookingOpen, setSeatBookingOpen] = useState(false);
  const [ticketConfig, setTicketConfig] = useState<PublicTicketingConfig | null>(null);

  useEffect(() => {
    if (!Number.isFinite(pageYear) || pageYear < 2000) {
      setNotFound(true);
      return;
    }
    setNotFound(false);
    setContent(DEFAULT_CONTENT(pageYear));

    void durgaPujaPageAPI
      .hasImage(pageYear)
      .then(({ hasImage: img }) => setHasImage(img))
      .catch(() => setHasImage(false));

    void durgaPujaPageAPI
      .listYears()
      .then(res => setAvailableYears(res.years))
      .catch(() => setAvailableYears([]));

    ticketingAPI
      .getConfig()
      .then(cfg => {
        setSeatBookingOpen(Boolean(cfg?.is_open && cfg.maps.length > 0));
        setTicketConfig(cfg ?? null);
      })
      .catch(() => {
        setSeatBookingOpen(false);
        setTicketConfig(null);
      });

    const fetchContentAndSubEvents = async () => {
      let data: DurgaPujaPageContent | null = null;
      try {
        data = await durgaPujaPageAPI.getContent(pageYear);
        if (data?.intro) setContent(data);
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) setNotFound(true);
        return;
      }

      const linkedEventId = data?.linkedEventId;
      if (!linkedEventId) return;
      try {
        const all = await subEventsAPI.getByEventId(linkedEventId);
        const visible = all
          .filter(se => se.show_in_durga_puja_page === true && se.is_active !== false)
          .sort((a, b) => {
            const ta = a.sub_event_start_dt ? new Date(a.sub_event_start_dt).getTime() : 0;
            const tb = b.sub_event_start_dt ? new Date(b.sub_event_start_dt).getTime() : 0;
            return ta - tb;
          });
        setSubEvents(visible);

        const imagesMap: Record<string, string> = {};
        await Promise.all(
          visible.map(async se => {
            if (!se.event_image_path) return;
            try {
              const filenames = await subEventsAPI.getImages(se.sub_event_id);
              if (filenames && filenames.length > 0) {
                imagesMap[se.sub_event_id] = subEventsAPI.getImageUrl(se.sub_event_id, filenames[0]);
              }
            } catch {
              /* optional */
            }
          })
        );
        setSubEventImages(imagesMap);
      } catch {
        setSubEvents([]);
      }
    };
    void fetchContentAndSubEvents();
  }, [pageYear]);

  const ticketLinks = (content.ticketLinks ?? []).filter(t => t.label && t.url);
  const eventYear = content.year || pageYear;
  const pagePath = durgaPujaPagePath(eventYear);
  const previousYear = availableYears.find(y => y < eventYear);
  const celebrationEnded =
    (content.endDate &&
      !Number.isNaN(new Date(`${content.endDate}T23:59:59`).getTime()) &&
      new Date(`${content.endDate}T23:59:59`).getTime() < Date.now()) ||
    eventYear < new Date().getFullYear();

  const ticketsOff = content.ticketsOff === true;
  const ticketSalesOpen = !celebrationEnded;
  const externalVisible =
    ticketSalesOpen && !ticketsOff && content.showExternalTickets !== false && ticketLinks.length > 0;
  const internalVisible =
    ticketSalesOpen && !ticketsOff && content.showInternalBooking !== false && seatBookingOpen;
  const showTickets = ticketSalesOpen;
  const showYapsodyWidget =
    ticketSalesOpen &&
    !ticketsOff &&
    content.showYapsodyWidget === true &&
    Boolean(content.yapsodyEventId?.trim()) &&
    Boolean(content.yapsodyVenueCode?.trim());
  const showDonateTicketButton =
    ticketSalesOpen && !ticketsOff && content.showDonateButtonInTickets === true;

  // Section visibility — a section renders when its toggle isn't explicitly false
  // AND there's something to show.
  const show = (key: keyof NonNullable<DurgaPujaPageContent['sections']>) =>
    content.sections?.[key] !== false;

  if (notFound) {
    return (
      <div className="py-24 text-center px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Durga Puja page not found</h1>
        <p className="text-gray-600 mb-6">We do not have a landing page for that year yet.</p>
        <Link to="/events" className="text-primary-600 hover:text-primary-700 font-semibold underline">
          Browse all events
        </Link>
      </div>
    );
  }

  const highlights =
    content.highlights && content.highlights.length > 0 ? content.highlights : DEFAULT_HIGHLIGHTS;
  const ctaButtons = (
    content.ctaButtons && content.ctaButtons.length > 0
      ? content.ctaButtons
      : [
          { label: 'Buy Tickets', href: '#tickets', style: 'primary' as const },
          { label: 'View Schedule', href: '#schedule', style: 'secondary' as const },
          { label: 'Become a Sponsor', href: '#sponsor', style: 'secondary' as const },
          { label: 'Volunteer', href: '#volunteer', style: 'secondary' as const },
        ]
  ).filter(cta => ticketSalesOpen || !isTicketRelatedCta(cta));
  const heroImageUrl = hasImage ? durgaPujaPageAPI.getImageUrl(eventYear) : undefined;
  const showCountdown = content.showCountdown !== false && !celebrationEnded;

  const artists = content.artists ?? [];
  const scheduleDays = content.scheduleDays ?? [];
  const ticketing = content.ticketing;
  const venue = content.venue;
  const additionalVenues = (content.venues ?? []).filter(
    v => v && (v.name || v.buildingName || v.streetAddress || v.mapsUrl)
  );
  // When "show event & sub-event addresses" is off, suppress the event-derived venue
  // name and the sub-event venue list — but keep any venue details the admin added.
  const venueDefaultsOn = content.showVenueDefaults !== false;
  const mainVenueName = venue?.buildingName || (venueDefaultsOn ? content.venueName : '');
  const mainVenueHasDetails = Boolean(
    mainVenueName ||
      venue?.streetAddress ||
      venue?.mapsUrl ||
      venue?.parkingLot ||
      venue?.parkingCost ||
      venue?.accessibleParking ||
      venue?.recommendedEntrance ||
      venue?.publicTransit ||
      venue?.layoutNote ||
      venue?.venueMapImageUrl
  );
  const showSubEventVenues = venueDefaultsOn && subEvents.some(se => se.location);
  const food = content.food;
  const puja = content.puja;
  const kids = content.kids;
  const vendors = content.vendors;
  const volunteer = content.volunteer;
  // Volunteer & Sponsorship have no standalone public section — their toggles only
  // control the hero buttons. The "Volunteer" button opens the Google Form (only
  // shown when a form URL is set); the "Become a Sponsor" button opens the
  // configured link, defaulting to /contact when none is set.
  const volunteerButtonOn = show('volunteer');
  const sponsorButtonOn = show('sponsorship');
  // Sponsor button: an admin-set override URL (e.g. a Google Form) wins; otherwise it
  // opens the year's sponsorship prospectus page (PDF + Contact Us).
  const sponsorHref = content.sponsorship?.buttonUrl
    ? normalizeUrl(content.sponsorship.buttonUrl)
    : '/become-our-sponsor';
  const gallery = content.gallery;
  const contacts = content.contacts ?? [];
  const social = content.social;
  const sponsorEntries = (content.sponsorShowcase ?? []).filter(
    s => s && (s.title || (s.images && s.images.length))
  );

  // Saved ticket pricing from the Book Your Seat admin page (shown only when the
  // admin ticks "Show saved tickets").
  const fmtPrice = (n: number) => `$${Number.isInteger(n) ? n : Number(n).toFixed(2)}`;
  const showSavedTickets = content.showSavedTickets === true && !!ticketConfig;
  const entireEventCats = ticketConfig ? categoriesForEntireEvent(ticketConfig) : [];
  const childRange = ticketConfig?.child_age_range;
  const mealDays = ticketConfig?.meal_days ?? [];
  const subEventTicketRows = (ticketConfig?.sub_event_configs ?? [])
    .map(cfg => {
      const cats = ticketConfig
        ? categoriesForSubEvent(ticketConfig, cfg.sub_event_id).filter(
            c => categoryAdultPrice(c) > 0 || categoryChildPrice(c) > 0
          )
        : [];
      const name =
        ticketConfig?.sub_events.find(s => s.sub_event_id === cfg.sub_event_id)?.sub_event_name ??
        'Sub-event';
      return { subEventId: cfg.sub_event_id, name, cats };
    })
    .filter(row => row.cats.length > 0);
  const hasSavedTicketData =
    entireEventCats.length > 0 || mealDays.length > 0 || subEventTicketRows.length > 0;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: `Sanhoti Durga Puja ${eventYear} (Durgotsav)`,
      url: `${origin}${pagePath}`,
      startDate: content.startDate,
      endDate: content.endDate,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      organizer: {
        '@type': 'Organization',
        name: 'Sanhoti Bengali Association of Orange County',
        url: origin,
      },
      location: {
        '@type': 'Place',
        name: content.venueName,
        address: {
          '@type': 'PostalAddress',
          streetAddress: venue?.streetAddress || undefined,
          addressLocality: content.venueCity,
          addressRegion: 'CA',
          addressCountry: 'US',
        },
      },
      ...(artists.length > 0
        ? { performer: artists.map(a => ({ '@type': 'PerformingGroup', name: a.name })) }
        : {}),
      description:
        'Three-day Durga Puja celebration in Orange County, California: puja and pushpanjali, dhunuchi naach, sindoor khela, Bengali food, and evening cultural concerts.',
      ...(externalVisible
        ? {
            offers: ticketLinks.map(t => ({
              '@type': 'Offer',
              name: t.label,
              url: t.url,
              availability: 'https://schema.org/InStock',
              ...(content.startDate ? { validFrom: content.startDate } : {}),
            })),
          }
        : { isAccessibleForFree: true }),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: content.faqs.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    },
  ];

  const cardCls =
    'bg-white rounded-2xl shadow-md border border-yellow-200/70 p-5 sm:p-6 transition-shadow duration-300 hover:shadow-xl';

  return (
    <div className="pb-24">
      <Seo
        title={`Durga Puja in Orange County ${eventYear} | Sanhoti — ${content.venueCity}, CA`}
        description={`Celebrate Durga Puja ${eventYear} in Orange County with Sanhoti — puja, pushpanjali, dhunuchi naach, Bengali food, and concerts. Near Irvine and ${content.venueCity}, open to all of Southern California.`}
        path={pagePath}
        ogImage={heroImageUrl}
        jsonLd={jsonLd}
      />

      {/* ---- Section 1: Hero ---- */}
      {show('hero') && (
        <section className="relative overflow-hidden">
          {heroImageUrl && (
            <div className="absolute inset-0">
              <img
                src={heroImageUrl}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover"
                onError={() => setHasImage(false)}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-white" />
            </div>
          )}
          <div
            className={`relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center ${
              heroImageUrl ? 'text-white' : 'text-gray-900'
            }`}
          >
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-center gap-3 mb-4">
                <Sparkles className={heroImageUrl ? 'w-8 h-8 text-yellow-300' : 'w-8 h-8 text-primary-600'} />
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">
                  Durga Puja {eventYear} in Orange County
                </h1>
              </div>
              <p className={`text-xl sm:text-2xl font-semibold ${heroImageUrl ? 'text-yellow-100' : 'text-primary-700'}`}>
                {content.datesText}
              </p>
              <p className={`mt-1 text-lg ${heroImageUrl ? 'text-gray-100' : 'text-gray-700'}`}>
                <MapPin className="inline w-5 h-5 mb-1 mr-1" />
                {content.venueName}
              </p>
              {content.heroSubheadline && (
                <p className={`mt-3 text-lg font-medium ${heroImageUrl ? 'text-yellow-200' : 'text-primary-600'}`}>
                  {content.heroSubheadline}
                </p>
              )}
              <p className={`mt-4 max-w-3xl mx-auto ${heroImageUrl ? 'text-gray-100' : 'text-gray-700'}`}>
                {content.heroTagline ||
                  `Join Sanhoti for three unforgettable days of devotion, Bengali culture, music, food, family activities, and community celebration in the heart of Orange County.`}
              </p>

              {showCountdown && content.startDate && <Countdown targetIso={content.startDate} />}

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {ctaButtons
                  // Volunteer & Sponsor CTAs are gated by their admin toggles. Volunteer
                  // needs a Google Form URL to appear; Sponsor always has a target
                  // (defaults to /contact).
                  .filter(cta => {
                    const h = (cta.href || '').trim().toLowerCase();
                    const isVolunteer = h === '#volunteer' || /volunteer/i.test(cta.label || '');
                    const isSponsor = h === '#sponsor' || /sponsor/i.test(cta.label || '');
                    if (isVolunteer) return volunteerButtonOn && Boolean(volunteer?.formUrl);
                    if (isSponsor) return sponsorButtonOn;
                    return true;
                  })
                  .map((cta, i) => {
                    const h = (cta.href || '').trim().toLowerCase();
                    const isVolunteer = h === '#volunteer' || /volunteer/i.test(cta.label || '');
                    const isSponsor = h === '#sponsor' || /sponsor/i.test(cta.label || '');
                    const href = isVolunteer
                      ? normalizeUrl(volunteer?.formUrl)
                      : isSponsor
                        ? sponsorHref
                        : normalizeUrl(cta.href);
                    return (
                      <SmartButton key={i} href={href} variant={cta.style === 'secondary' ? 'secondary' : 'primary'}>
                        {cta.label}
                      </SmartButton>
                    );
                  })}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        {/* Intro */}
        <p className="text-lg text-gray-700 leading-relaxed mb-8 border-l-4 border-primary-500 pl-4">
          {content.intro}
        </p>

        {/* ---- Section 2: Highlights ---- */}
        {show('highlights') && (
          <div className="mb-10">
            <SectionHeading kicker="The Celebration">Event Highlights</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {highlights.map((h, i) => {
                const Icon = HIGHLIGHT_ICONS[h.icon || 'sparkles'] || Sparkles;
                return (
                  <div
                    key={i}
                    className="group bg-white rounded-xl shadow-sm p-5 border border-gray-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary-200"
                  >
                    {h.imageUrl ? (
                      <img
                        src={h.imageUrl}
                        alt={h.title}
                        className="w-full h-32 object-cover rounded-lg mb-3"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-50 to-amber-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Icon className="w-6 h-6 text-primary-600" />
                      </div>
                    )}
                    <h3 className="font-semibold text-gray-900 mb-1">{h.title}</h3>
                    {h.text && <p className="text-gray-600 text-sm leading-relaxed">{h.text}</p>}
                  </div>
                );
              })}
            </div>
            {content.expectedAttendance && (
              <p className="mt-4 text-sm text-gray-600 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-600" />
                {content.expectedAttendance}
              </p>
            )}
          </div>
        )}

        {/* ---- Section 3: Schedule ---- */}
        {show('schedule') && scheduleDays.length > 0 && (
          <div className="mb-10">
            <SectionHeading id="schedule" kicker="Plan Your Days">Three-Day Schedule</SectionHeading>
            <div className="space-y-6">
              {scheduleDays.map((day, di) => (
                <div key={di} className={cardCls}>
                  <h3 className="text-xl font-bold text-primary-700 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {day.dayLabel}
                  </h3>
                  <ul className="space-y-3">
                    {day.items.map((item, ii) => (
                      <li key={ii} className="flex gap-4">
                        {item.time && (
                          <span className="w-24 flex-shrink-0 text-sm font-semibold text-gray-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {item.time}
                          </span>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{item.title}</p>
                          {item.description && (
                            <p className="text-sm text-gray-600">{item.description}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              {content.scheduleNote || 'Schedule may be updated. Please check this page before attending.'}
            </p>
          </div>
        )}

        {/* ---- Section 4: Featured artists ---- */}
        {show('artists') && artists.length > 0 && (
          <div className="mb-10">
            <SectionHeading id="artists" kicker="Live on Stage">Featured Artists</SectionHeading>
            <FeaturedArtistsGrid artists={artists} />
          </div>
        )}

        {/* ---- Section 5: Tickets ---- */}
        {show('tickets') && showTickets && (
          <div className="mb-10">
            <div className={`${cardCls} scroll-mt-24`} id="tickets">
              <div className="flex items-center gap-2 mb-3 scroll-mt-24">
                <Ticket className="w-6 h-6 text-primary-600" />
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Tickets</h2>
              </div>

              {showYapsodyWidget && (
                <YapsodyEventListEmbed
                  eventId={content.yapsodyEventId!.trim()}
                  venueCode={content.yapsodyVenueCode!.trim()}
                  className="mb-6 rounded-xl border border-gray-200 bg-white p-2 sm:p-4"
                />
              )}

              {internalVisible && (
                <div className="mb-4">
                  <Link
                    to="/book-your-seat"
                    className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                  >
                    <Ticket className="w-5 h-5" />
                    Book Your Seat
                  </Link>
                  <p className="text-xs text-gray-500 mt-2">
                    Pick your exact seats on our interactive seat map.
                  </p>
                </div>
              )}

              {ticketing?.buttonUrl && !ticketsOff && (
                <a
                  href={normalizeUrl(ticketing.buttonUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors mb-4"
                >
                  <Ticket className="w-5 h-5" />
                  {ticketing.buttonLabel || 'Buy Tickets'}
                </a>
              )}

              {externalVisible || showDonateTicketButton ? (
                <div className="mb-4">
                  {content.ticketsNote && externalVisible && (
                    <p className="text-gray-700 mb-3">{content.ticketsNote}</p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {externalVisible &&
                      ticketLinks.map(t => (
                        <a
                          key={t.url}
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                        >
                          <Ticket className="w-5 h-5" />
                          {t.label}
                        </a>
                      ))}
                    {showDonateTicketButton && (
                      <Link
                        to="/donate"
                        className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                      >
                        <Heart className="w-5 h-5" />
                        Donate
                      </Link>
                    )}
                  </div>
                </div>
              ) : null}

              {!internalVisible && !externalVisible && !showDonateTicketButton && !ticketing?.buttonUrl && (
                <p className="text-gray-700 mb-4">
                  Tickets coming soon — please check back here for booking details.
                </p>
              )}

              {ticketing && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mt-2">
                  {([
                    ['Adult', ticketing.adultPrice],
                    ['Child', ticketing.childPrice],
                    ['Weekend package', ticketing.weekendPackage],
                    ['Family package', ticketing.familyPackage],
                    ['Concert-only', ticketing.concertOnly],
                    ["Children's free entry", ticketing.freeEntryAge],
                    ['Food', ticketing.foodInclusion],
                    ['Venue capacity', ticketing.maxCapacity],
                    ['Refund policy', ticketing.refundPolicy],
                    ['Ticket transfer', ticketing.transferPolicy],
                  ] as [string, string | undefined][])
                    .filter(([, v]) => v)
                    .map(([label, value]) => (
                      <div key={label} className="flex gap-2">
                        <span className="font-semibold text-gray-700">{label}:</span>
                        <span className="text-gray-600">{value}</span>
                      </div>
                    ))}
                </div>
              )}

              {showSavedTickets && hasSavedTicketData && (
                <div className="mt-6 border-t border-gray-100 pt-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Ticket className="w-5 h-5 text-primary-600" />
                    <h3 className="text-lg font-bold text-gray-900">Ticket Pricing</h3>
                  </div>

                  <div className="space-y-6">
                    {entireEventCats.length > 0 && (
                      <div>
                        <div className="flex items-baseline justify-between flex-wrap gap-x-3 mb-2">
                          <p className="font-semibold text-gray-800">Entire-event tickets</p>
                          {childRange && (childRange.min_age > 0 || childRange.max_age > 0) && (
                            <p className="text-xs text-gray-500">
                              Child price applies to ages {childRange.min_age}–{childRange.max_age}
                            </p>
                          )}
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 text-gray-500">
                                <th className="text-left font-medium px-4 py-2">Category</th>
                                <th className="text-right font-medium px-4 py-2 w-24">Adult</th>
                                <th className="text-right font-medium px-4 py-2 w-24">Child</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entireEventCats.map(c => (
                                <tr key={c.category_id} className="border-t border-gray-100">
                                  <td className="px-4 py-2 text-gray-800">{c.name}</td>
                                  <td className="px-4 py-2 text-right tabular-nums text-gray-700">{fmtPrice(categoryAdultPrice(c))}</td>
                                  <td className="px-4 py-2 text-right tabular-nums text-gray-700">{fmtPrice(categoryChildPrice(c))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {mealDays.length > 0 && (
                      <div>
                        <p className="font-semibold text-gray-800 mb-2">Daily lunch &amp; dinner</p>
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 text-gray-500">
                                <th className="text-left font-medium px-4 py-2" rowSpan={2}>Day</th>
                                <th className="text-center font-medium px-4 py-1.5 border-l border-gray-200" colSpan={2}>Lunch</th>
                                <th className="text-center font-medium px-4 py-1.5 border-l border-gray-200" colSpan={2}>Dinner</th>
                              </tr>
                              <tr className="bg-gray-50 text-gray-400 text-xs">
                                <th className="text-right font-medium px-4 py-1 border-l border-gray-200 w-20">Adult</th>
                                <th className="text-right font-medium px-4 py-1 w-20">Child</th>
                                <th className="text-right font-medium px-4 py-1 border-l border-gray-200 w-20">Adult</th>
                                <th className="text-right font-medium px-4 py-1 w-20">Child</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mealDays.map(d => {
                                const cell = (p: number) => (Number(p) > 0 ? fmtPrice(p) : '—');
                                return (
                                  <tr key={d.day_id} className="border-t border-gray-100">
                                    <td className="px-4 py-2 text-gray-800">{d.label}</td>
                                    <td className="px-4 py-2 text-right tabular-nums text-gray-700 border-l border-gray-100">{cell(d.lunch_adult_price)}</td>
                                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">{cell(d.lunch_child_price)}</td>
                                    <td className="px-4 py-2 text-right tabular-nums text-gray-700 border-l border-gray-100">{cell(d.dinner_adult_price)}</td>
                                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">{cell(d.dinner_child_price)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {subEventTicketRows.length > 0 && (
                      <div>
                        <p className="font-semibold text-gray-800 mb-2">Sub-event tickets</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {subEventTicketRows.map(row => (
                            <div key={row.subEventId} className="rounded-lg border border-gray-200 overflow-hidden">
                              <p className="text-sm font-semibold text-gray-800 bg-gray-50 px-4 py-2 border-b border-gray-200">
                                {row.name}
                              </p>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-gray-400 text-xs">
                                    <th className="text-left font-medium px-4 pt-2">Category</th>
                                    <th className="text-right font-medium px-4 pt-2 w-20">Adult</th>
                                    <th className="text-right font-medium px-4 pt-2 w-20">Child</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.cats.map(c => (
                                    <tr key={c.category_id}>
                                      <td className="px-4 py-1.5 text-gray-800">{c.name}</td>
                                      <td className="px-4 py-1.5 text-right tabular-nums text-gray-700">{fmtPrice(categoryAdultPrice(c))}</td>
                                      <td className="px-4 py-1.5 text-right tabular-nums text-gray-700">{fmtPrice(categoryChildPrice(c))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {ticketing?.qrImageUrl && (
                <div className="mt-5">
                  <img
                    src={ticketing.qrImageUrl}
                    alt="Ticket QR code"
                    className="w-40 h-40 object-contain rounded-lg border border-gray-200 bg-white p-2"
                    loading="lazy"
                  />
                  <p className="text-xs text-gray-500 mt-1">Scan to buy tickets.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sub-events from the linked event */}
        {show('subEvents') && subEvents.length > 0 && (
          <div className="mb-10">
            <SectionHeading>Programs &amp; Events</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {subEvents.map(se => {
                const banner = subEventImages[se.sub_event_id];
                const rsvpHref = se.rsvp_link ? se.rsvp_link : `/sub-events/${se.sub_event_id}/rsvp`;
                const isExternalRsvp = Boolean(se.rsvp_link);
                return (
                  <div
                    key={se.sub_event_id}
                    className="flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden border border-yellow-200"
                  >
                    {banner && (
                      <div className="bg-gray-50 flex items-center justify-center">
                        <img
                          src={banner}
                          alt={se.sub_event_name}
                          className="w-full max-h-72 object-contain"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="p-4 flex flex-col gap-2 flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">{se.sub_event_name}</h3>
                      {se.sub_event_start_dt && (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Calendar className="w-4 h-4 text-primary-600 flex-shrink-0" />
                          <span>{formatDateWithTime(se.sub_event_start_dt)}</span>
                        </div>
                      )}
                      {se.location && (
                        <div className="flex items-start gap-1.5 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 text-primary-600 flex-shrink-0 mt-0.5" />
                          <span>{se.location}</span>
                        </div>
                      )}
                      {se.event_description && (
                        <p className="text-sm text-gray-600 line-clamp-3">{se.event_description}</p>
                      )}
                      {se.rsvp_enabled && ticketSalesOpen && (
                        <div className="mt-auto pt-2">
                          {isExternalRsvp ? (
                            <a
                              href={rsvpHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-primary-700 transition-colors"
                            >
                              RSVP
                            </a>
                          ) : (
                            <Link
                              to={rsvpHref}
                              className="inline-block bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-primary-700 transition-colors"
                            >
                              RSVP
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- Section 6: Venue & parking (single card) ---- */}
        {show('venue') &&
          (mainVenueHasDetails || additionalVenues.length > 0 || showSubEventVenues) && (
            <div className="mb-10">
              <SectionHeading id="venue">Venue &amp; Parking</SectionHeading>
              <div className={cardCls}>
                {/* Main event venue */}
                {mainVenueHasDetails && (
                  <>
                    {mainVenueName && (
                      <p className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-primary-600" />
                        {mainVenueName}
                      </p>
                    )}
                    {(venue?.streetAddress || venue?.mapsUrl) && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
                        {venue?.streetAddress && (
                          <p className="text-gray-700">{venue.streetAddress}</p>
                        )}
                        {venue?.mapsUrl && <GoogleMapsLink url={venue.mapsUrl} />}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mt-4">
                      {([
                        ['Parking lot', venue?.parkingLot, MapPin],
                        ['Parking', venue?.parkingCost, Car],
                        ['Accessible parking', venue?.accessibleParking, Car],
                        ['Recommended entrance', venue?.recommendedEntrance, MapPin],
                        ['Public transit', venue?.publicTransit, MapPin],
                      ] as [string, string | undefined, React.ComponentType<{ className?: string }>][])
                        .filter(([, v]) => v)
                        .map(([label, value, Icon]) => (
                          <div key={label} className="flex items-start gap-2">
                            <Icon className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
                            <span>
                              <span className="font-semibold text-gray-700">{label}:</span>{' '}
                              <span className="text-gray-600">{value}</span>
                            </span>
                          </div>
                        ))}
                    </div>
                    {venue?.layoutNote && <p className="text-gray-700 mt-4">{venue.layoutNote}</p>}
                    {venue?.venueMapImageUrl && (
                      <img
                        src={venue.venueMapImageUrl}
                        alt="Venue map"
                        className="w-full max-h-[28rem] object-contain rounded-lg border border-gray-200 mt-5 bg-white"
                        loading="lazy"
                      />
                    )}
                  </>
                )}

                {/* Additional venues — same card, divided */}
                {additionalVenues.map((v, i) => (
                  <div key={i} className="mt-5 border-t border-gray-100 pt-4">
                    {v.name && <h3 className="text-lg font-bold text-primary-700 mb-2">{v.name}</h3>}
                    <p className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-primary-600" />
                      {v.buildingName || v.name || 'Venue'}
                    </p>
                    {(v.streetAddress || v.mapsUrl) && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
                        {v.streetAddress && <p className="text-gray-700">{v.streetAddress}</p>}
                        {v.mapsUrl && <GoogleMapsLink url={v.mapsUrl} />}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mt-4">
                      {([
                        ['Parking lot', v.parkingLot, MapPin],
                        ['Parking', v.parkingCost, Car],
                        ['Accessible parking', v.accessibleParking, Car],
                        ['Recommended entrance', v.recommendedEntrance, MapPin],
                        ['Public transit', v.publicTransit, MapPin],
                      ] as [string, string | undefined, React.ComponentType<{ className?: string }>][])
                        .filter(([, val]) => val)
                        .map(([label, val, Icon]) => (
                          <div key={label} className="flex items-start gap-2">
                            <Icon className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
                            <span>
                              <span className="font-semibold text-gray-700">{label}:</span>{' '}
                              <span className="text-gray-600">{val}</span>
                            </span>
                          </div>
                        ))}
                    </div>
                    {v.layoutNote && <p className="text-gray-700 mt-4">{v.layoutNote}</p>}
                    {v.venueMapImageUrl && (
                      <img
                        src={v.venueMapImageUrl}
                        alt={`${v.name || 'Venue'} map`}
                        className="w-full max-h-[28rem] object-contain rounded-lg border border-gray-200 mt-5 bg-white"
                        loading="lazy"
                      />
                    )}
                  </div>
                ))}

                {/* Sub-event venues — same card */}
                {showSubEventVenues && (
                  <div className="mt-5 border-t border-gray-100 pt-4">
                    <p className="font-semibold text-gray-900 mb-2">Sub-event venues</p>
                    <ul className="space-y-1.5 text-sm">
                      {subEvents
                        .filter(se => se.location)
                        .map(se => (
                          <li key={se.sub_event_id} className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
                            <span>
                              <span className="font-medium text-gray-800">{se.sub_event_name}:</span>{' '}
                              <span className="text-gray-600">{se.location}</span>
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* ---- Section 7: Food ---- */}
        {show('food') && food && (food.intro || (food.meals && food.meals.length) || food.vegetarian) && (
          <div className="mb-10">
            <SectionHeading id="food">Food</SectionHeading>
            <div className={cardCls}>
              {food.intro && <p className="text-gray-700 mb-4">{food.intro}</p>}
              {food.meals && food.meals.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  {food.meals.map((m, i) => (
                    <div key={i} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                      <p className="font-semibold text-gray-900 flex items-center gap-2">
                        <Utensils className="w-4 h-4 text-primary-600" />
                        {m.name}
                      </p>
                      {m.hours && <p className="text-xs text-gray-500 mt-0.5">{m.hours}</p>}
                      {m.description && <p className="text-sm text-gray-600 mt-1">{m.description}</p>}
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-1 text-sm">
                {food.vegetarian && (
                  <p><span className="font-semibold text-gray-700">Vegetarian:</span> <span className="text-gray-600">{food.vegetarian}</span></p>
                )}
                {food.kidsMenu && (
                  <p><span className="font-semibold text-gray-700">Kids' menu:</span> <span className="text-gray-600">{food.kidsMenu}</span></p>
                )}
                {food.tokenProcess && (
                  <p><span className="font-semibold text-gray-700">Meal tokens:</span> <span className="text-gray-600">{food.tokenProcess}</span></p>
                )}
              </div>
              {food.allergyNotice && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mt-4">
                  {food.allergyNotice}
                </p>
              )}
              {food.photos && food.photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-5">
                  {food.photos.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt="Bengali food"
                      className="w-full h-28 object-cover rounded-lg"
                      loading="lazy"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- Section 8: Puja & religious information ---- */}
        {show('puja') && puja && (puja.intro || (puja.timings && puja.timings.length) || puja.priestInfo) && (
          <div className="mb-10">
            <SectionHeading id="puja">Puja &amp; Religious Information</SectionHeading>
            <div className={cardCls}>
              {puja.intro && <p className="text-gray-700 mb-4">{puja.intro}</p>}
              {puja.timings && puja.timings.length > 0 && (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
                  {puja.timings.map((t, i) => (
                    <li key={i} className="flex justify-between border-b border-gray-100 py-1">
                      <span className="text-gray-700">{t.label}</span>
                      {t.time && <span className="font-medium text-gray-900">{t.time}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="space-y-1 text-sm">
                {puja.priestInfo && (
                  <p><span className="font-semibold text-gray-700">Priest:</span> <span className="text-gray-600">{puja.priestInfo}</span></p>
                )}
                {puja.itemsToBring && (
                  <p><span className="font-semibold text-gray-700">Please bring:</span> <span className="text-gray-600">{puja.itemsToBring}</span></p>
                )}
                {puja.attireGuidance && (
                  <p><span className="font-semibold text-gray-700">Attire:</span> <span className="text-gray-600">{puja.attireGuidance}</span></p>
                )}
                {puja.rules && (
                  <p><span className="font-semibold text-gray-700">Please note:</span> <span className="text-gray-600">{puja.rules}</span></p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---- Section 9: Children & family ---- */}
        {show('kids') && kids && (kids.intro || (kids.activities && kids.activities.length)) && (
          <div className="mb-10">
            <SectionHeading id="kids">Children &amp; Family Activities</SectionHeading>
            <div className={cardCls}>
              {kids.intro && <p className="text-gray-700 mb-4">{kids.intro}</p>}
              {kids.activities && kids.activities.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {kids.activities.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Baby className="w-4 h-4 text-primary-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">{a.title}</p>
                        {a.description && <p className="text-sm text-gray-600">{a.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-1 text-sm">
                {kids.ageRequirements && (
                  <p><span className="font-semibold text-gray-700">Ages:</span> <span className="text-gray-600">{kids.ageRequirements}</span></p>
                )}
                {kids.supervisionPolicy && (
                  <p><span className="font-semibold text-gray-700">Supervision:</span> <span className="text-gray-600">{kids.supervisionPolicy}</span></p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sponsorship has no standalone section — the hero "Become a Sponsor" button
            (gated by the admin toggle) opens the configured link (Google Form or
            /contact). See hero CTA logic above. */}

        {/* ---- Section 11: Vendors & stalls ---- */}
        {show('vendors') && vendors && (vendors.intro || (vendors.types && vendors.types.length)) && (
          <div className="mb-10">
            <SectionHeading id="vendors">Vendor &amp; Stall Registration</SectionHeading>
            <div className={cardCls}>
              {vendors.intro && <p className="text-gray-700 mb-4">{vendors.intro}</p>}
              {vendors.types && vendors.types.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {vendors.types.map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full">
                      <Store className="w-3.5 h-3.5 text-primary-600" />
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {([
                  ['Stall fees', vendors.stallFees],
                  ['Provisions', vendors.provisions],
                  ['Electricity', vendors.electricity],
                  ['Setup / close times', vendors.setupTimes],
                  ['Insurance', vendors.insurance],
                  ['Application deadline', vendors.deadline],
                ] as [string, string | undefined][])
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label}>
                      <span className="font-semibold text-gray-700">{label}:</span>{' '}
                      <span className="text-gray-600">{value}</span>
                    </div>
                  ))}
              </div>
              <div className="flex flex-wrap gap-3 mt-5">
                {vendors.formUrl && (
                  <SmartButton href={normalizeUrl(vendors.formUrl)}>
                    <Store className="w-4 h-4" /> Register as a Vendor
                  </SmartButton>
                )}
                {vendors.contactEmail && (
                  <a
                    href={`mailto:${vendors.contactEmail}?subject=Sanhoti Durga Puja ${eventYear} Vendor Stall`}
                    className="inline-flex items-center gap-2 bg-white border-2 border-primary-600 text-primary-600 px-5 py-2.5 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
                  >
                    <Mail className="w-4 h-4" /> Email Vendor Team
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Volunteer has no standalone section — the hero "Volunteer" button (gated by
            the admin toggle) opens the Google Form directly. See hero CTA logic above. */}

        {/* ---- Section 13: About Sanhoti ---- */}
        {show('about') && content.about && (
          <div className="mb-10">
            <SectionHeading id="about">About Sanhoti</SectionHeading>
            <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
              <Info className="w-6 h-6 text-primary-600 mb-2" />
              <p className="text-gray-700 whitespace-pre-line">{content.about}</p>
            </div>
          </div>
        )}

        {/* ---- Section 14: Previous-year gallery ---- */}
        {show('gallery') && gallery && (gallery.intro || gallery.galleryLink || (gallery.images && gallery.images.length) || gallery.videoUrl) && (
          <div className="mb-10">
            <SectionHeading id="gallery">Previous-Year Gallery</SectionHeading>
            <div className={cardCls}>
              {gallery.intro && <p className="text-gray-700 mb-4">{gallery.intro}</p>}
              {gallery.images && gallery.images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                  {gallery.images.map((src, i) => (
                    <img key={i} src={src} alt="Past celebration" className="w-full h-32 object-cover rounded-lg" loading="lazy" />
                  ))}
                </div>
              )}
              {gallery.videoUrl && (
                <div className="aspect-video mb-4">
                  <iframe
                    src={gallery.videoUrl}
                    title="Highlight video"
                    className="w-full h-full rounded-lg"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Link
                  to={gallery.galleryLink || '/galleries'}
                  className="inline-flex items-center gap-2 bg-white border-2 border-primary-600 text-primary-600 px-5 py-2.5 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
                >
                  <ImageIcon className="w-4 h-4" /> Browse Photo Galleries
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ---- Section 15: FAQ ---- */}
        {show('faqs') && content.faqs.length > 0 && (
          <div className="mb-10">
            <SectionHeading id="faq">Frequently Asked Questions</SectionHeading>
            <div className="space-y-5">
              {content.faqs.map((f, i) => (
                <div key={i}>
                  <h3 className="font-semibold text-gray-900 mb-1">{f.question}</h3>
                  <p className="text-gray-700">{f.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- Section 16: Contact ---- */}
        {show('contact') && (contacts.length > 0 || social) && (
          <div className="mb-10">
            <SectionHeading id="contact">Contact</SectionHeading>
            <div className={cardCls}>
              {contacts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  {contacts.map((c, i) => (
                    <div key={i} className="border border-gray-100 rounded-lg p-4">
                      <p className="font-semibold text-gray-900">{c.role}</p>
                      {c.name && <p className="text-sm text-gray-600">{c.name}</p>}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1.5 mt-1">
                          <Mail className="w-3.5 h-3.5" /> {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" /> {c.phone}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {social && (
                <div className="flex flex-wrap gap-3">
                  {social.facebook && (
                    <a href={social.facebook} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600" aria-label="Facebook">
                      <Facebook className="w-5 h-5" /> Facebook
                    </a>
                  )}
                  {social.instagram && (
                    <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600" aria-label="Instagram">
                      <Instagram className="w-5 h-5" /> Instagram
                    </a>
                  )}
                  {social.youtube && (
                    <a href={social.youtube} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600" aria-label="YouTube">
                      <Youtube className="w-5 h-5" /> YouTube
                    </a>
                  )}
                  {social.whatsapp && (
                    <a href={social.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600" aria-label="WhatsApp">
                      <MessageCircle className="w-5 h-5" /> WhatsApp
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- Sponsor showcase (logos/flyers by tier) ---- */}
        {show('sponsorShowcase') && sponsorEntries.length > 0 && (
          <div className="mb-10">
            <SectionHeading kicker="With Gratitude">Our Sponsors</SectionHeading>
            <div className="space-y-8">
              {SPONSOR_TIERS.map(tier => {
                const inTier = sponsorEntries.filter(s => s.tier === tier.key);
                if (inTier.length === 0) return null;
                return (
                  <div key={tier.key}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`h-1 w-8 rounded-full bg-gradient-to-r ${tier.accent}`} />
                      <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-gray-700">
                        {tier.label}
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6">
                      {inTier.map((s, i) => (
                        <div key={i} className="flex flex-col">
                          <div className="bg-white rounded-xl border border-yellow-200/70 shadow-sm overflow-hidden transition-shadow hover:shadow-md">
                            {(s.images ?? []).length > 0 ? (
                              (s.images ?? []).map((src, ii) => (
                                <img
                                  key={ii}
                                  src={src}
                                  alt={s.title || 'Sponsor'}
                                  className="w-full h-72 object-contain bg-white"
                                  loading="lazy"
                                />
                              ))
                            ) : (
                              <div className="w-full h-72 flex items-center justify-center text-gray-300">
                                <ImageIcon className="w-8 h-8" />
                              </div>
                            )}
                          </div>
                          {s.title && (
                            <p className="mt-2 text-center font-semibold text-gray-900">{s.title}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer CTAs */}
        <div className="flex flex-wrap gap-3 mb-10">
          {content.linkedEventId && (
            <Link
              to={`/events/${content.linkedEventId}`}
              className="bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              View Event &amp; RSVP
            </Link>
          )}
          <Link
            to="/events"
            className={
              content.linkedEventId
                ? 'bg-white border-2 border-primary-600 text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors'
                : 'bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors'
            }
          >
            See All Events
          </Link>
          <Link
            to="/galleries"
            className="bg-white border-2 border-primary-600 text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
          >
            Photos from Past Celebrations
          </Link>
          <Link
            to="/contact"
            className="bg-white border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Contact Us
          </Link>
        </div>

        {previousYear && (
          <div className="border-t border-gray-200 pt-8">
            <Link
              to={durgaPujaPagePath(previousYear)}
              className="inline-flex items-center gap-2 text-primary-700 hover:text-primary-800 font-semibold"
            >
              <ChevronLeft className="w-5 h-5" />
              Durga Puja {previousYear}
            </Link>
            <p className="text-sm text-gray-500 mt-1">
              View last year&apos;s celebration page, dates, and programs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
