import { describe, it, expect } from 'vitest';
import { formatEventDate, isDateOnly, hasTimeComponent } from '../utils/dateUtils';

/**
 * The mirror of backend/src/tests/eventDate.test.ts.
 *
 * The two implementations of `formatEventDate` cannot import each other (one
 * runs in Node, one in the browser), so they are held together by asserting the
 * same expectations on both sides. If someone edits one copy, this suite or its
 * backend twin fails.
 */
describe('formatEventDate', () => {
  describe('date-only values are calendar dates, not instants', () => {
    it('renders the stored day, not the day before', () => {
      // `new Date("2025-12-06")` is UTC midnight = 4pm 5 Dec in Pacific, which
      // is why this once displayed "December 5".
      expect(formatEventDate('2025-12-06')).toBe('December 6, 2025');
    });

    it('holds across the whole affected production set', () => {
      const cases: Array<[string, string]> = [
        ['2025-07-19', 'July 19, 2025'],
        ['2025-08-09', 'August 9, 2025'],
        ['2025-09-20', 'September 20, 2025'],
        ['2025-09-26', 'September 26, 2025'],
        ['2025-09-28', 'September 28, 2025'],
        ['2025-10-19', 'October 19, 2025'],
        ['2025-12-06', 'December 6, 2025'],
        ['2026-01-24', 'January 24, 2026'],
        ['2026-01-01', 'January 1, 2026'],
        ['2026-10-10', 'October 10, 2026'],
      ];
      for (const [stored, expected] of cases) {
        expect(formatEventDate(stored), stored).toBe(expected);
      }
    });

    it('is stable either side of a daylight-saving transition', () => {
      expect(formatEventDate('2026-03-07')).toBe('March 7, 2026');
      expect(formatEventDate('2026-03-08')).toBe('March 8, 2026');
      expect(formatEventDate('2026-11-01')).toBe('November 1, 2026');
      expect(formatEventDate('2026-11-02')).toBe('November 2, 2026');
    });

    it('never invents a time the organisers did not give', () => {
      expect(
        formatEventDate('2025-12-06', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })
      ).toBe('December 6, 2025');
    });
  });

  describe('timestamps are instants, shown in club time', () => {
    it('shows the time on the door regardless of the reader location', () => {
      expect(
        formatEventDate('2026-10-09T19:00:00-07:00', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })
      ).toBe('October 9, 2026 at 7:00 PM');
    });

    it('omits the time when the caller did not ask for it', () => {
      expect(formatEventDate('2026-10-09T19:00:00-07:00')).toBe('October 9, 2026');
    });

    it('converts an explicit UTC instant into Pacific', () => {
      expect(
        formatEventDate('2026-10-10T03:00:00Z', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })
      ).toBe('October 9, 2026 at 8:00 PM');
    });
  });

  describe('degenerate input', () => {
    it('returns an empty string for missing values', () => {
      expect(formatEventDate(undefined)).toBe('');
      expect(formatEventDate(null)).toBe('');
      expect(formatEventDate('   ')).toBe('');
    });

    it('passes unparseable values through rather than printing Invalid Date', () => {
      expect(formatEventDate('to be announced')).toBe('to be announced');
    });
  });
});

describe('isDateOnly / hasTimeComponent', () => {
  it('classifies stored values correctly', () => {
    expect(isDateOnly('2025-12-06')).toBe(true);
    expect(isDateOnly('2025-12-06T18:00:00')).toBe(false);
    expect(hasTimeComponent('2025-12-06')).toBe(false);
    expect(hasTimeComponent('2025-12-06T18:00:00')).toBe(true);
  });
});
