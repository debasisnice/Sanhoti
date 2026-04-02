/**
 * Canonical site origin for share links. Crawlers must load this exact host; `window.location.origin`
 * can be wrong (PWA, saved typo URL like www.sanhotiorg, IP) and breaks previews with no image.
 */
const DEFAULT_PRODUCTION_ORIGIN = 'https://www.sanhoti.org';

function getPublicOriginForShareLinks(): string {
  const fromEnv = (import.meta.env.VITE_PUBLIC_SITE_ORIGIN as string | undefined)
    ?.trim()
    .replace(/\/$/, '');
  if (import.meta.env.PROD) {
    if (fromEnv && /^https:\/\//i.test(fromEnv)) return fromEnv;
    return DEFAULT_PRODUCTION_ORIGIN;
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/**
 * URL for social crawlers (WhatsApp, Facebook) that read server-rendered Open Graph tags.
 * Serves `/api/events/:id/share` HTML with og:image (flyer) then redirects to the SPA event page.
 */
export function getEventSharePageUrl(eventId: string): string {
  const origin = getPublicOriginForShareLinks();
  return `${origin}/api/events/${encodeURIComponent(eventId)}/share`;
}
