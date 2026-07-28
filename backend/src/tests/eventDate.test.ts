import { describe, it, expect } from 'vitest';
import { formatEventDate, isDateOnly, hasTime, schemaDate } from '../utils/eventDate.js';

/**
 * These cases exist because `new Date("2025-12-06")` parses as UTC midnight,
 * which is 4pm on 5 December in Pacific time. Every display site in the app
 * once rendered the Holiday Party a day early because of it.
 *
 * frontend/src/tests/dateUtils.test.ts asserts the same expectations against
 * the frontend copy of this helper — if the two implementations ever drift,
 * one of the two suites fails.
 */
describe('formatEventDate', () => {
  describe('date-only values are calendar dates, not instants', () => {
    it('renders the stored day, not the day before', () => {
      // The regression that prompted this helper.
      expect(formatEventDate('2025-12-06')).toBe('December 6, 2025');
    });

    it('holds across the whole affected production set', () => {
      const cases: Array<[string, string]> = [
        ['2025-07-19', 'July 19, 2025'],   // Laura's House charity
        ['2025-08-09', 'August 9, 2025'],  // Annual Picnic
        ['2025-09-20', 'September 20, 2025'], // Mahalaya
        ['2025-09-26', 'September 26, 2025'], // Durga Puja start
        ['2025-09-28', 'September 28, 2025'], // Durga Puja end
        ['2025-10-19', 'October 19, 2025'], // Kali Puja
        ['2025-12-06', 'December 6, 2025'], // Holiday Party
        ['2026-01-24', 'January 24, 2026'], // Saraswati Puja
        ['2026-01-01', 'January 1, 2026'],  // Srijan start — new-year boundary
        ['2026-10-10', 'October 10, 2026'], // Srijan end
      ];
      for (const [stored, expected] of cases) {
        expect(formatEventDate(stored), stored).toBe(expected);
      }
    });

    it('is stable either side of a daylight-saving transition', () => {
      // US DST began 8 Mar 2026 and ends 1 Nov 2026. A naive month-range
      // heuristic gets these wrong; anchoring at UTC noon cannot.
      expect(formatEventDate('2026-03-07')).toBe('March 7, 2026');
      expect(formatEventDate('2026-03-08')).toBe('March 8, 2026');
      expect(formatEventDate('2026-11-01')).toBe('November 1, 2026');
      expect(formatEventDate('2026-11-02')).toBe('November 2, 2026');
    });

    it('never invents a time the organisers did not give', () => {
      const withTimeRequested = formatEventDate('2025-12-06', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      });
      expect(withTimeRequested).toBe('December 6, 2025');
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
      // 03:00Z on 10 Oct is 8pm on 9 Oct in Pacific.
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

describe('isDateOnly / hasTime', () => {
  it('classifies stored values correctly', () => {
    expect(isDateOnly('2025-12-06')).toBe(true);
    expect(isDateOnly('2025-12-06T18:00:00')).toBe(false);
    expect(hasTime('2025-12-06')).toBe(false);
    expect(hasTime('2025-12-06T18:00:00')).toBe(true);
  });
});

describe('schemaDate', () => {
  it('emits a bare calendar date unchanged — it is already valid ISO 8601', () => {
    // Converting to a timestamp would invent a start time and reintroduce the
    // same off-by-one for anything consuming the structured data.
    expect(schemaDate('2025-12-06')).toBe('2025-12-06');
  });

  it('leaves timestamps alone', () => {
    expect(schemaDate('2026-10-09T19:00:00-07:00')).toBe('2026-10-09T19:00:00-07:00');
  });
});
