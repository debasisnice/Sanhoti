import toast from 'react-hot-toast';
import { getEventSharePageUrl } from './eventShareUrl';

export async function copyTextToClipboard(text: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      toast.success(successMessage);
    } catch {
      toast.error('Failed to copy. Please copy manually.');
    }
    document.body.removeChild(textArea);
  }
}

export function shareEventOnFacebook(eventId: string): void {
  const url = getEventSharePageUrl(eventId);
  const encodedUrl = encodeURIComponent(url);
  const sharer = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  window.open(sharer, '_blank', 'noopener,noreferrer,width=600,height=400');
}

export function shareEventOnWhatsApp(eventId: string, eventName: string): void {
  const url = getEventSharePageUrl(eventId);
  // Put the preview URL first so clients consistently attach og:image to this link.
  const text = `${url}\n\nCheck out this event: ${eventName}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

export async function shareEventOnInstagram(eventId: string, eventName: string): Promise<void> {
  const url = getEventSharePageUrl(eventId);
  const text = `${url}\n\nCheck out this event: ${eventName}`;

  if (navigator.share) {
    try {
      // Do not pass `url` or `title`: on iOS, sharing to WhatsApp can attach the *current page*
      // (SPA) as the preview link instead of the og URL in `text`.
      await navigator.share({
        text,
      });
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err?.name !== 'AbortError') {
        await copyTextToClipboard(
          url,
          'Link copied to clipboard! You can now paste it in Instagram.'
        );
      }
    }
  } else {
    await copyTextToClipboard(url, 'Link copied to clipboard! You can now paste it in Instagram.');
  }
}
