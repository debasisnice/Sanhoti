import { basename } from 'path';

/** Lowercase slug safe for URLs and stored filenames. */
export function slugifyForFilename(text: string, maxLen = 40): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/-+$/g, '');
}

const GENERIC_STEM =
  /^(?:img|dsc|photo|image|pic|screenshot|snap|mvimg|wp|telegram)[-_]?\d*$/i;

/** Camera / messenger exports that carry no descriptive meaning for SEO. */
const GENERIC_PATTERNS: RegExp[] = [
  /^IMG[_-]?\d+$/i,
  /^DSC[_-]?\d+$/i,
  /^PXL[_-]?\d+$/i,
  /^PHOTO[-_]?\d{4}[-_]?\d{2}[-_]?\d{2}/i,
  /^20\d{2}[-_]?\d{2}[-_]?\d{2}[-_]?\d{2}[-_]?\d{2}[-_]?\d{2}/i,
  /^[A-F0-9]{8}-(?:[A-F0-9]{4}-){3}[A-F0-9]{12}$/i,
];

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

function normalizeOriginalStem(originalName: string): string {
  const base = stripExtension(basename(originalName));
  // Ignore any prior upload timestamp prefix
  return base.replace(/^\d{13,}-/, '');
}

/** True when the uploaded name is a generic camera / chat export. */
export function isGenericPhotoFilename(originalName: string): boolean {
  const stem = normalizeOriginalStem(originalName).replace(/[-_\s]+/g, '');
  if (!stem || stem.length < 2) return true;
  if (GENERIC_STEM.test(stem)) return true;
  const raw = normalizeOriginalStem(originalName);
  return GENERIC_PATTERNS.some((p) => p.test(raw));
}

/** Optional descriptive words from the uploader's original filename. */
export function extractDescriptiveStem(originalName: string): string | null {
  const raw = normalizeOriginalStem(originalName);
  if (isGenericPhotoFilename(originalName)) return null;

  const slug = slugifyForFilename(raw.replace(/_/g, '-'), 50);
  if (!slug || slug.length < 3) return null;
  if (/^\d+$/.test(slug.replace(/-/g, ''))) return null;
  return slug;
}

export function buildSeoGalleryFilename(options: {
  originalName: string;
  eventName: string;
  year?: number;
  existingFilenames: string[];
  /** Additional names reserved in this upload batch (avoid collisions). */
  reservedFilenames?: string[];
}): string {
  const extMatch = options.originalName.match(/(\.[a-z0-9]+)$/i);
  const ext = (extMatch?.[1] || '.jpg').toLowerCase();

  const eventSlug = slugifyForFilename(options.eventName, 45) || 'sanhoti-event';
  const yearStr = options.year ? String(options.year) : '';
  const eventPart =
    yearStr && !eventSlug.includes(yearStr) ? `${eventSlug}-${yearStr}` : eventSlug;

  const descriptive = extractDescriptiveStem(options.originalName);
  const baseStem = descriptive ? `${eventPart}-${descriptive}` : `${eventPart}-photo`;

  const taken = new Set([
    ...options.existingFilenames.map((f) => f.toLowerCase()),
    ...(options.reservedFilenames ?? []).map((f) => f.toLowerCase()),
  ]);

  // Pick the lowest free sequence number — never reuse a name already in the folder.
  let n = 1;
  let candidate = `${baseStem}-${n}${ext}`;
  while (taken.has(candidate.toLowerCase())) {
    n += 1;
    candidate = `${baseStem}-${n}${ext}`;
    if (n > 10_000) {
      // Absolute fallback (should never happen)
      candidate = `${baseStem}-${Date.now()}${ext}`;
      break;
    }
  }
  return candidate;
}

/**
 * Human-readable caption / alt-text stem from a stored SEO filename.
 * e.g. sanhoti-baisakhi-2026-photo-3.jpg → "Sanhoti Baisakhi 2026 Photo"
 */
export function galleryPhotoCaptionFromFilename(filename: string): string {
  const stem = stripExtension(basename(filename));
  const withoutSeq = stem.replace(/-\d+$/, '');
  if (!withoutSeq) return 'Photo';

  return withoutSeq
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
