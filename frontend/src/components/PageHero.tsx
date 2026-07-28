import type { LucideIcon } from 'lucide-react';

/**
 * Shared hero for public landing pages.
 *
 * Matches the pattern introduced on /artists, /charity, /bengali-food and the
 * festival pages so the site reads as one thing. It also fixes a hierarchy
 * problem in the older headers, where the h1 and its subtitle were both
 * `text-2xl` and competed with each other.
 *
 * The heading text should carry the location — an h1 naming the page and the
 * place is one of the stronger on-page signals available.
 */
export default function PageHero({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Optional call-to-action rendered under the subtitle. */
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-gradient-to-br from-primary-700 via-primary-800 to-gray-900 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-5">
          <Icon className="w-8 h-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-4">{title}</h1>
        {subtitle && <p className="text-lg text-white/85 max-w-3xl mx-auto">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}
