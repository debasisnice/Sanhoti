import { describe, it, expect } from 'vitest';
import { DurgaPujaPageService } from '../services/DurgaPujaPageService.js';

// Validation-only tests: every case below must throw before anything is written
// to backend/data/durgaPujaPage.json.
describe('DurgaPujaPageService ticket link validation', () => {
  const service = new DurgaPujaPageService();

  it('rejects a non-array ticketLinks value', async () => {
    await expect(
      service.updateContent(2026, { ticketLinks: 'not-an-array' as any })
    ).rejects.toThrow(/ticketLinks must be an array/);
  });

  it('rejects more than 6 ticket links', async () => {
    const links = Array.from({ length: 7 }, (_, i) => ({
      label: `Link ${i}`,
      url: `https://example.com/${i}`,
    }));
    await expect(service.updateContent(2026, { ticketLinks: links })).rejects.toThrow(/at most 6/);
  });

  it('rejects a link with a label but no URL', async () => {
    await expect(
      service.updateContent(2026, { ticketLinks: [{ label: 'Full Pass', url: '' }] })
    ).rejects.toThrow(/both a label and a URL/);
  });

  it('rejects a link with a URL but no label', async () => {
    await expect(
      service.updateContent(2026, { ticketLinks: [{ label: '', url: 'https://example.com' }] })
    ).rejects.toThrow(/both a label and a URL/);
  });

  it('rejects non-http(s) URLs', async () => {
    await expect(
      service.updateContent(2026, {
        ticketLinks: [{ label: 'Bad', url: 'javascript:alert(1)' }],
      })
    ).rejects.toThrow(/must start with http/);
    await expect(
      service.updateContent(2026, { ticketLinks: [{ label: 'Bad', url: 'example.com/tickets' }] })
    ).rejects.toThrow(/must start with http/);
  });

  it('rejects non-string label/url', async () => {
    await expect(
      service.updateContent(2026, { ticketLinks: [{ label: 123, url: 'https://x.com' } as any] })
    ).rejects.toThrow(/label and a URL/);
  });

  it('rejects a non-string ticketsNote', async () => {
    await expect(service.updateContent(2026, { ticketsNote: 42 as any })).rejects.toThrow(
      /Invalid value for ticketsNote/
    );
  });
});
