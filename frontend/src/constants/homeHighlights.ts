import type { PhotoGallery } from '../types';
import { getEffectiveEventType } from '../utils/eventType';

export type HomeHighlightsMode = 'videos' | 'charity_gallery' | 'durga_puja_gallery';

export const DEFAULT_HOME_HIGHLIGHTS_MODE: HomeHighlightsMode = 'videos';

export const HOME_HIGHLIGHTS_MODE_OPTIONS: {
  value: HomeHighlightsMode;
  label: string;
  description: string;
}[] = [
  {
    value: 'videos',
    label: 'Videos',
    description: 'YouTube links from the list below',
  },
  {
    value: 'charity_gallery',
    label: 'Charity gallery photos',
    description: 'Random images from public galleries of all charity events',
  },
  {
    value: 'durga_puja_gallery',
    label: 'Durga Puja gallery photos',
    description: 'Random images from public galleries of all Durga Puja / Durgotsav events',
  },
];

const DURGA_NAME = /durga|durgotsav/i;

export function parseHomeHighlightsMode(raw: unknown): HomeHighlightsMode {
  if (raw === 'charity_gallery' || raw === 'durga_puja_gallery' || raw === 'videos') return raw;
  return DEFAULT_HOME_HIGHLIGHTS_MODE;
}

export function isDurgaPujaEventName(name?: string): boolean {
  return DURGA_NAME.test(name || '');
}

export type GalleryHighlightPhoto = {
  eventId: string;
  galleryId: string;
  url: string;
  alt: string;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function galleryMatchesMode(g: PhotoGallery, mode: 'charity_gallery' | 'durga_puja_gallery'): boolean {
  if (mode === 'charity_gallery') {
    return getEffectiveEventType({ event_type: g.event_type }) === 'Charity';
  }
  return isDurgaPujaEventName(g.event_name || g.title);
}

/** Pick up to `limit` random gallery images scoped to charity or Durga Puja events. */
export function pickGalleryHighlightPhotos(
  galleries: PhotoGallery[],
  mode: 'charity_gallery' | 'durga_puja_gallery',
  limit = 8
): GalleryHighlightPhoto[] {
  const photos = galleries.flatMap(g => {
    if (!galleryMatchesMode(g, mode)) return [];
    const eventId = g.eventId || g.id || '';
    const eventLabel = g.event_name || g.title || 'Sanhoti event';
    return (g.photos || [])
      .filter(p => p && p.type !== 'video' && (p.thumbnailUrl || p.url))
      .map(p => ({
        eventId,
        galleryId: g.id,
        url: (p.thumbnailUrl || p.url) as string,
        alt: (p.caption || '').trim()
          ? (p.caption as string).trim()
          : `${eventLabel} — photo from a Sanhoti event in Orange County, CA`,
      }));
  });

  return shuffle(photos).slice(0, limit);
}
