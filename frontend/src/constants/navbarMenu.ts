/** Reorderable main navbar links (excludes Donate / Join Us CTAs). */
export const DEFAULT_NAVBAR_MENU_ORDER = [
  'home',
  'durgaPuja',
  'sponsors',
  'events',
  'corporatePartnerships',
  'noticeBoard',
  'media',
  'news',
  'contactUs',
  'committee',
] as const;

export type NavbarMenuKey = (typeof DEFAULT_NAVBAR_MENU_ORDER)[number];

export const NAVBAR_MENU_LABELS: Record<NavbarMenuKey, string> = {
  home: 'Home',
  durgaPuja: 'Durga Puja',
  sponsors: 'Sponsors',
  events: 'Events',
  corporatePartnerships: 'Corporate Partnerships',
  noticeBoard: 'Notice Board',
  media: 'Media',
  news: 'News',
  contactUs: 'Contact Us',
  committee: 'Committee',
};

/** Sub-links under the Media dropdown (each has its own visibility toggle). */
export const MEDIA_SUBMENU = [
  { key: 'galleries', path: '/galleries', label: 'Galleries' },
  { key: 'magazines', path: '/magazines', label: 'Magazines' },
  { key: 'blogs', path: '/blogs', label: 'Blogs' },
  { key: 'documents', path: '/documents', label: 'Documents' },
] as const;

export type MediaSubKey = (typeof MEDIA_SUBMENU)[number]['key'];

export const MEDIA_SUB_LABELS: Record<MediaSubKey, string> = {
  galleries: 'Galleries',
  magazines: 'Magazines',
  blogs: 'Blogs',
  documents: 'Documents',
};

/** @deprecated use MEDIA_SUBMENU */
export const RESOURCE_SUBMENU = MEDIA_SUBMENU;

const LEGACY_RESOURCE_KEYS = ['galleries', 'magazines', 'documents'] as const;

/**
 * Resolve a saved order into a valid, complete ordering: keep known keys in the
 * saved order, append any default sections the saved list is missing, and drop
 * unknown keys. Migrates legacy separate resource keys to a single `media` entry.
 */
export function resolveNavbarMenuOrder(saved?: string[]): NavbarMenuKey[] {
  const defaults = [...DEFAULT_NAVBAR_MENU_ORDER] as NavbarMenuKey[];
  let raw = [...(saved ?? [])];

  raw = raw.map(k => (k === 'resources' ? 'media' : k));

  if (!raw.includes('media') && raw.some(k => (LEGACY_RESOURCE_KEYS as readonly string[]).includes(k))) {
    const withoutLegacy = raw.filter(k => !(LEGACY_RESOURCE_KEYS as readonly string[]).includes(k));
    const firstLegacy = raw.findIndex(k => (LEGACY_RESOURCE_KEYS as readonly string[]).includes(k));
    withoutLegacy.splice(Math.min(Math.max(firstLegacy, 0), withoutLegacy.length), 0, 'media');
    raw = withoutLegacy;
  }

  const validSaved = raw.filter((k): k is NavbarMenuKey =>
    (defaults as readonly string[]).includes(k)
  );
  const missing = defaults.filter(k => !validSaved.includes(k));
  return [...validSaved, ...missing];
}
