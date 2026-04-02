/**
 * URL for social crawlers (WhatsApp, Facebook) that read server-rendered Open Graph tags.
 * Serves `/api/events/:id/share` HTML with og:image (flyer) then redirects to the SPA event page.
 */
export function getEventSharePageUrl(eventId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/api/events/${encodeURIComponent(eventId)}/share`;
}
