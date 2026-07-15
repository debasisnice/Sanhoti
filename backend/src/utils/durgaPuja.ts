import { Event } from '../models/types.js';

const DURGA_NAME = /durga|durgotsav/i;

export function isDurgaPujaEventName(name: string | undefined | null): boolean {
  return DURGA_NAME.test(name || '');
}

/** Celebration year for a Durga Puja event (from event.year, name, or start date). */
export function durgaPujaEventYear(event: {
  year?: number;
  event_name?: string;
  event_start_dt?: string;
  date?: string;
}): number {
  if (event.year && event.year >= 2000 && event.year <= 2100) return event.year;
  const fromName = (event.event_name || '').match(/\b(20\d{2})\b/);
  if (fromName) return parseInt(fromName[1], 10);
  const dt = event.event_start_dt || event.date;
  if (dt && /^\d{4}/.test(dt)) return parseInt(dt.slice(0, 4), 10);
  return new Date().getFullYear();
}

export function durgaPujaPagePath(year: number): string {
  return `/durga-puja-${year}`;
}

export function parseDurgaPujaPageYear(path: string): number | null {
  const match = path.match(/^\/durga-puja-(\d{4})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  return year >= 2000 && year <= 2100 ? year : null;
}

export function findDurgaPujaEventForYear(events: Event[], year: number): Event | null {
  const matches = events.filter(
    e => isDurgaPujaEventName(e.event_name) && durgaPujaEventYear(e) === year
  );
  if (matches.length === 0) return null;
  matches.sort(
    (a, b) => new Date(b.event_start_dt).getTime() - new Date(a.event_start_dt).getTime()
  );
  return matches[0];
}
