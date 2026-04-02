/**
 * Canonical site origin for share links. Crawlers must load this exact host; `window.location.origin`
 * can be wrong (PWA, saved typo URL like www.sanhotiorg, IP) and breaks previews with no image.
 */
const DEFAULT_PRODUCTION_ORIGIN = 'https://www.sanhoti.org';

function getPublicOriginForShareLinks(): string {
  const fromEnv = (import.meta.env.VITE_PUBLIC_SITE_ORIGIN as string | undefined)
    ?.trim()
    .replace(/\/$/, '');
  if (fromEnv && /^https:\/\//i.test(fromEnv)) return fromEnv;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host === 'www.sanhoti.org' || host === 'sanhoti.org') {
      return DEFAULT_PRODUCTION_ORIGIN;
    }
    if (import.meta.env.DEV || host === 'localhost' || host === '127.0.0.1') {
      return window.location.origin.replace(/\/$/, '');
    }
  }

  if (import.meta.env.PROD) {
    return DEFAULT_PRODUCTION_ORIGIN;
  }

  return typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : '';
}

/**
 * Public URL we put in share dialogs (Facebook, WhatsApp, copy, etc.).
 * Always `/events/:id` so opening the link loads the SPA directly. Rich previews use the site
 * shell in `index.html` (logo, site title); `/og/events/:id` stays available for bots and old links.
 */
export function getEventSharePageUrl(eventId: string): string {
  const id = (eventId ?? '').trim();
  const origin = getPublicOriginForShareLinks();
  if (!id) return `${origin}/events`;
  return `${origin}/events/${encodeURIComponent(id)}`;
}

/** Stable id for share URLs when API fields or route param differ (legacy rows, redirects). */
export function getCanonicalEventIdForShare(
  event: { event_id?: string; id?: string },
  routeParamId?: string
): string {
  const a = (event.event_id ?? '').trim();
  const b = (event.id ?? '').trim();
  const c = (routeParamId ?? '').trim();
  return a || b || c;
}
