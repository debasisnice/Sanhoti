/** Extract a YouTube video id from a watch/shorts/live/embed/youtu.be URL, or null. */
export function youtubeVideoId(raw: string): string | null {
  const url = (raw ?? '').trim();
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.split('/').filter(Boolean)[0] ?? null;
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Poster/thumbnail image for a YouTube URL, or null if it isn't YouTube. */
export function youtubeThumbnailUrl(raw: string): string | null {
  const id = youtubeVideoId(raw);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

/** Convert common video page URLs to an iframe-safe embed URL, or null if not embeddable. */
export function toVideoEmbedUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'm.youtube.com') {
      if (u.pathname.startsWith('/embed/')) return url;
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/').filter(Boolean)[1];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (u.pathname.startsWith('/live/')) {
        const id = u.pathname.split('/').filter(Boolean)[1];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
    }

    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }

    if (host === 'player.vimeo.com') return url;

    if (/\/embed\//.test(u.pathname)) return url;

    return null;
  } catch {
    return null;
  }
}
