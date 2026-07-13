/**
 * SEO-friendly event URLs: /events/<slug>-<id>
 * The trailing segment after the last "-" is always the raw event id, so the
 * backend (and old bookmarks) keep working: /events/ABC123XYZ456 still resolves.
 */

/** Lowercase, ASCII-ish slug from an event name (e.g. "Durga Puja 2026!" -> "durga-puja-2026"). */
export function slugifyEventName(name: string | undefined | null): string {
  if (!name) return '';
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .trim()
    .replace(/[\s-]+/g, '-')
    .toLowerCase()
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
}

/**
 * Canonical SPA path for an event. Falls back to the bare id when there is
 * no usable name. `id` must be the canonical event id (event_id || id).
 */
export function getEventPath(
  event: { event_name?: string; title?: string },
  id: string
): string {
  const slug = slugifyEventName(event.event_name || event.title);
  return slug ? `/events/${slug}-${id}` : `/events/${id}`;
}
