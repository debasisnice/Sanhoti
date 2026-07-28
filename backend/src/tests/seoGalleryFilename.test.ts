import { describe, expect, it } from 'vitest';
import {
  buildSeoGalleryFilename,
  extractDescriptiveStem,
  galleryPhotoCaptionFromFilename,
  isGenericPhotoFilename,
} from '../utils/seoGalleryFilename.js';

describe('seoGalleryFilename', () => {
  it('detects generic camera and messenger names', () => {
    expect(isGenericPhotoFilename('IMG_3332.jpeg')).toBe(true);
    expect(isGenericPhotoFilename('PHOTO-2026-06-06-22-55-29.jpg')).toBe(true);
    expect(isGenericPhotoFilename('1776794506024-IMG_3332.jpeg')).toBe(true);
  });

  it('keeps descriptive original stems', () => {
    expect(extractDescriptiveStem('group-traditional-dress.jpg')).toBe('group-traditional-dress');
    expect(extractDescriptiveStem('IMG_3332.jpeg')).toBeNull();
  });

  it('builds event-scoped SEO filenames', () => {
    const name = buildSeoGalleryFilename({
      originalName: 'IMG_3332.jpeg',
      eventName: 'Sanhoti Baisakhi 2026',
      year: 2026,
      existingFilenames: [],
    });
    expect(name).toBe('sanhoti-baisakhi-2026-photo-1.jpeg');
  });

  it('includes descriptive words when the upload name is meaningful', () => {
    const name = buildSeoGalleryFilename({
      originalName: 'group-traditional-dress.jpg',
      eventName: 'Sanhoti Baisakhi 2026',
      year: 2026,
      existingFilenames: [],
    });
    expect(name).toBe('sanhoti-baisakhi-2026-group-traditional-dress-1.jpg');
  });

  it('avoids filename collisions', () => {
    const name = buildSeoGalleryFilename({
      originalName: 'IMG_1.jpg',
      eventName: 'Srijan',
      year: 2026,
      existingFilenames: ['srijan-2026-photo-1.jpg', 'srijan-2026-photo-2.jpg'],
    });
    expect(name).toBe('srijan-2026-photo-3.jpg');
  });

  it('never reuses any existing filename in the folder', () => {
    const name = buildSeoGalleryFilename({
      originalName: 'IMG_3332.jpg',
      eventName: 'Srijan',
      year: 2026,
      existingFilenames: ['1776794506024-IMG_3332.jpeg', 'srijan-2026-photo-1.jpg'],
    });
    expect(name).toBe('srijan-2026-photo-2.jpg');
  });

  it('assigns unique names within a single upload batch', () => {
    const first = buildSeoGalleryFilename({
      originalName: 'a.jpg',
      eventName: 'Srijan',
      year: 2026,
      existingFilenames: ['srijan-2026-photo-1.jpg'],
      reservedFilenames: [],
    });
    const second = buildSeoGalleryFilename({
      originalName: 'b.jpg',
      eventName: 'Srijan',
      year: 2026,
      existingFilenames: ['srijan-2026-photo-1.jpg'],
      reservedFilenames: [first],
    });
    expect(first).toBe('srijan-2026-photo-2.jpg');
    expect(second).toBe('srijan-2026-photo-3.jpg');
  });

  it('formats captions for alt text', () => {
    expect(galleryPhotoCaptionFromFilename('sanhoti-baisakhi-2026-photo-3.jpeg')).toBe(
      'Sanhoti Baisakhi 2026 Photo'
    );
  });
});
