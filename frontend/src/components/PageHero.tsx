import type { LucideIcon } from 'lucide-react';

/**
 * Shared hero for public landing pages.
 *
 * Fixed height, icon left of the h1, one-line title, three-line subtitle, and a
 * Sanhoti logo watermark — keeps /sponsors, /galleries, /charity, etc. visually
 * aligned while preserving location keywords in the visible h1 for SEO.
 */
export default function PageHero({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  /** Visible h1 — include page topic + Orange County (or SoCal) for SEO. */
  title: string;
  /** Shown in up to three lines (line-clamp-3). */
  subtitle: string;
  /** Optional content below the title block (keep minimal — height is fixed). */
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-gray-900 text-white">
      <img
        src="/images/logo.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute right-3 sm:right-8 top-1/2 -translate-y-1/2 w-36 sm:w-48 lg:w-64 opacity-[0.09] select-none object-contain"
        onError={e => {
          e.currentTarget.style.display = 'none';
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[280px] flex flex-col justify-center">
        <div className="flex items-start gap-3 sm:gap-5 min-w-0">
          <div
            className="shrink-0 flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-white/10 mt-0.5"
            aria-hidden
          >
            <Icon className="w-5 h-5 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0 flex-1 pr-16 sm:pr-24 lg:pr-32">
            <h1 className="text-lg sm:text-2xl lg:text-[1.75rem] font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
              {title}
            </h1>
            {/* `-webkit-line-clamp` cuts at exactly N x line-height, so a tight
                leading clips the descenders (g, y, p) off the last visible line.
                Mobile gets `leading-relaxed` for the extra few pixels of room
                and a 4th line, since the narrow column wraps sooner. The section
                stays 280px tall either way — 4 relaxed lines is ~92px against
                ~122px of total content, well inside the fixed height. */}
            <p className="mt-2 sm:mt-3 text-sm sm:text-base text-white/85 leading-relaxed sm:leading-snug line-clamp-4 sm:line-clamp-3 min-h-[5.75rem] sm:min-h-[4.25rem] max-w-2xl">
              {subtitle}
            </p>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}
