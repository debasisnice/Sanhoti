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

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isIOS) {
      const appUrl = `fb://share?u=${encodedUrl}`;
      const link = document.createElement('a');
      link.href = appUrl;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
      }, 1000);
    } else if (isAndroid) {
      const intentUrl = `intent://share#Intent;scheme=fb;package=com.facebook.katana;S.url=${encodedUrl};end`;
      const link = document.createElement('a');
      link.href = intentUrl;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
      }, 1000);
    } else {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
    }
  } else {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank', 'width=600,height=400');
  }
}

export function shareEventOnWhatsApp(eventId: string, eventName: string): void {
  const url = getEventSharePageUrl(eventId);
  const text = `Check out this event: ${eventName}\n${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

export async function shareEventOnInstagram(eventId: string, eventName: string): Promise<void> {
  const url = getEventSharePageUrl(eventId);
  const text = `Check out this event: ${eventName}\n${url}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: eventName,
        text,
        url,
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
