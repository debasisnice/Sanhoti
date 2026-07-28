/**
 * Date formatting for event-like records.
 *
 * The problem this solves: `events.json` stores some dates as plain calendar
 * dates ("2025-12-06") and others as full timestamps. `new Date("2025-12-06")`
 * parses as **UTC midnight**, which in Pacific time is 4pm on 5 December — so
 * formatting it with `timeZone: 'America/Los_Angeles'` renders the Holiday
 * Party a day early. Every display site in the app had this bug.
 *
 * The rule, applied here once:
 *
 *   · A date-only value is a *calendar date*, not an instant. It means
 *     "6 December" and must be displayed verbatim, with no timezone maths.
 *   · A value carrying a time is a real instant, and is displayed in the
 *     club's timezone, which is where the event physically happens.
 *
 * Keep in sync with frontend/src/utils/dateUtils.ts (`formatEventDate`) — the
 * two are verified against the same cases in the tests.
 */

export const CLUB_TIMEZONE = 'America/Los_Angeles';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when the stored value is a bare calendar date with no time component. */
export function isDateOnly(value: string | undefined | null): boolean {
  return DATE_ONLY.test(String(value ?? '').trim());
}

/** True when the stored value carries a usable time of day. */
export function hasTime(value: string | undefined | null): boolean {
  return /T\d{2}:\d{2}/.test(String(value ?? ''));
}

/**
 * Format a stored event date for display.
 *
 * Time fields in `options` (hour/minute) are honoured only when the stored
 * value actually carries a time. A date-only value never grows a time it was
 * never given — so a caller can pass one set of options for mixed data.
 */
export function formatEventDate(
  value: string | undefined | null,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
  locale = 'en-US'
): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const parts = DATE_ONLY.exec(raw);
  if (parts) {
    // Anchor at UTC noon and format in UTC. Noon is far enough from either
    // midnight that no rounding can move the day, so the calendar date that
    // goes in is exactly the one that comes out. Any time fields the caller
    // asked for are dropped: this value has no time to show.
    const { hour: _h, minute: _m, timeStyle: _ts, ...dateOnlyOptions } = options;
    const d = new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 12));
    return d.toLocaleDateString(locale, { ...dateOnlyOptions, timeZone: 'UTC' });
  }

  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(locale, { ...options, timeZone: CLUB_TIMEZONE });
}

/**
 * The value to put in a schema.org date field or an HTML `datetime` attribute.
 *
 * A bare calendar date is already valid ISO 8601 and is emitted unchanged —
 * converting it to a timestamp would invent a start time the organisers never
 * gave, and would reintroduce the same off-by-one for consumers.
 */
export function schemaDate(value: string | undefined | null): string {
  return String(value ?? '').trim();
}
