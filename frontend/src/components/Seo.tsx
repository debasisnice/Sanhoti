import { Helmet } from 'react-helmet-async';
import { getSiteOrigin } from '../utils/eventShareUrl';

const DEFAULT_DESCRIPTION =
  'Sanhoti Bengali Association of Orange County, CA — cultural events, festivals, and community for Bengali families in Orange County.';
const DEFAULT_OG_IMAGE_PATH = '/images/logo.png';

export type SeoProps = {
  title: string;
  description?: string;
  /** Site-relative path (e.g. `/events`) used to build canonical & og:url. */
  path: string;
  noindex?: boolean;
  ogType?: 'website' | 'article';
  /** Absolute URL, or path starting with `/` */
  ogImage?: string | null;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

function absolutizeImage(urlOrPath: string): string {
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
  const origin = getSiteOrigin();
  const path = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  return `${origin}${path}`;
}

function normalizePath(path: string): string {
  if (!path || path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  noindex = false,
  ogType = 'website',
  ogImage,
  jsonLd,
}: SeoProps) {
  const origin = getSiteOrigin();
  const p = normalizePath(path);
  const canonical = `${origin}${p === '/' ? '' : p}`;
  const imageUrl = ogImage ? absolutizeImage(ogImage) : absolutizeImage(DEFAULT_OG_IMAGE_PATH);

  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet prioritizeSeoTags>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta
        name="robots"
        content={noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}
      />

      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:site_name" content="Sanhoti Bengali Association of Orange County" />
      <meta property="og:locale" content="en_US" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      {blocks.map((obj, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(obj)}
        </script>
      ))}
    </Helmet>
  );
}
