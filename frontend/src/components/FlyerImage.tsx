import { useState } from 'react';

/**
 * Event / sub-event flyer that fills its section.
 *
 * Flyers are mostly portrait — 13 of the 21 currently uploaded are around a
 * 0.77 ratio — while the content column is wide. Scaling one to the full width
 * would crop away the text baked into the artwork (date, venue, ticket price),
 * so the flyer itself stays `object-contain` and fully legible.
 *
 * The empty space that leaves is filled by a blurred, enlarged copy of the same
 * image instead of blank white. A 791x1024 flyer in a 960px column previously
 * left ~435px of white — close to half the section.
 *
 * The backdrop is a CSS background rather than a second `<img>`, so the DOM
 * still carries exactly one real image for crawlers and image search.
 */
export default function FlyerImage({
  src,
  alt,
  /** Cap on the flyer's rendered height; the section grows no taller than this. */
  maxHeight = 680,
  className = '',
}: {
  src?: string;
  alt: string;
  maxHeight?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;

  return (
    <figure
      className={`relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm bg-gray-900 ${className}`}
    >
      {/* Decorative fill. `scale-110` pushes the blur's soft edge outside the
          frame, which would otherwise show as a pale border. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl opacity-60"
        style={{ backgroundImage: `url("${src}")` }}
      />
      <div className="relative flex justify-center">
        <img
          src={src}
          alt={alt}
          className="w-auto max-w-full object-contain"
          style={{ maxHeight: `${maxHeight}px` }}
          // Hiding just the <img> would leave a blurred box with nothing in it,
          // so a broken flyer removes the whole figure.
          onError={() => setFailed(true)}
        />
      </div>
    </figure>
  );
}
