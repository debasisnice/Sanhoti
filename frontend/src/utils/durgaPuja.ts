/**
 * Durga Puja landing page URL helpers. Keep year slug logic aligned with
 * backend/src/utils/durgaPuja.ts.
 */

export function isDurgaPujaEventName(name: string | undefined | null): boolean {
  return /durga|durgotsav/i.test(name || '');
}

export function durgaPujaEventYear(event: {
  year?: number;
  event_name?: string;
  title?: string;
  event_start_dt?: string;
  date?: string;
}): number {
  if (event.year && event.year >= 2000 && event.year <= 2100) return event.year;
  const fromName = (event.event_name || event.title || '').match(/\b(20\d{2})\b/);
  if (fromName) return parseInt(fromName[1], 10);
  const dt = event.event_start_dt || event.date;
  if (dt && /^\d{4}/.test(dt)) return parseInt(dt.slice(0, 4), 10);
  return new Date().getFullYear();
}

export function durgaPujaPagePath(year: number): string {
  return `/durga-puja-${year}`;
}

export function parseDurgaPujaYearFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/durga-puja-(\d{4})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  return year >= 2000 && year <= 2100 ? year : null;
}

/** True for /durga-puja and /durga-puja-YYYY (public landing pages). */
export function isDurgaPujaPagePath(pathname: string): boolean {
  return pathname === '/durga-puja' || parseDurgaPujaYearFromPath(pathname) !== null;
}
