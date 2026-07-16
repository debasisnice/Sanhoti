import { describe, it, expect } from 'vitest';
import { TheaterMapService } from '../services/TheaterMapService.js';

describe('TheaterMapService validation', () => {
  const service = new TheaterMapService();

  it('rejects an empty theater map name', async () => {
    await expect(
      service.createMap({ name: '', matrix: { rows: 10, cols: 10 }, seats: [{ row: 1, col: 1, category_name: 'VIP' }] })
    ).rejects.toThrow(/name is required/);
  });

  it('rejects invalid matrix dimensions', async () => {
    await expect(
      service.createMap({ name: 'Main', matrix: { rows: 0, cols: 10 }, seats: [{ row: 1, col: 1, category_name: 'VIP' }] })
    ).rejects.toThrow(/matrix must have integer rows/);
  });

  it('rejects seats outside the grid', async () => {
    await expect(
      service.createMap({
        name: 'Main',
        matrix: { rows: 5, cols: 5 },
        seats: [{ row: 6, col: 1, category_name: 'VIP' }],
      })
    ).rejects.toThrow(/within the grid bounds/);
  });

  it('rejects maps with no seats', async () => {
    await expect(
      service.createMap({ name: 'Main', matrix: { rows: 5, cols: 5 }, seats: [] })
    ).rejects.toThrow(/at least one seat/);
  });
});

describe('TicketSetupService archive validation', () => {
  it('returns null when archiving a missing setup', async () => {
    const { TicketSetupService } = await import('../services/TicketSetupService.js');
    const service = new TicketSetupService();
    await expect(service.archiveSetup('MISSINGSETUP1')).resolves.toBeNull();
  });
});
