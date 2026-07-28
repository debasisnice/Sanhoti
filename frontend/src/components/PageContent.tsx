/** Standard content width below {@link PageHero} — matches /notices on desktop (max-w-7xl). */
export const PAGE_CONTENT_CLASS = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';

export default function PageContent({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section';
}) {
  return <Tag className={`${PAGE_CONTENT_CLASS} pt-12 ${className}`.trim()}>{children}</Tag>;
}
