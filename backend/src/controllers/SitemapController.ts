import { Request, Response } from 'express';
import { EventService } from '../services/EventService.js';
import { GalleryService } from '../services/GalleryService.js';
import { DurgaPujaPageService } from '../services/DurgaPujaPageService.js';
import { SubEventService } from '../services/SubEventService.js';
import { ArtistService } from '../services/ArtistService.js';
import { BlogService } from '../services/BlogService.js';
import { getEventDetailPath } from '../utils/slug.js';
import { durgaPujaPagePath } from '../utils/durgaPuja.js';

/** XML-escape a value that goes inside a <loc>/<image:*> element. */
function xml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** YYYY-MM-DD, or undefined when the input is missing/unparseable. */
function isoDay(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString().split('T')[0];
}

interface SitemapImage {
  loc: string;
  title?: string;
  caption?: string;
}

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq: string;
  priority: string;
  images?: SitemapImage[];
}

/**
 * Evergreen routes, kept as data rather than a hand-written XML blob so a new
 * public page cannot be added to the app and silently forgotten here.
 *
 * Only publicly indexable pages belong in this list: /login, /register,
 * /dashboard and /admin/* are disallowed in robots.txt and must never appear —
 * listing a robots-blocked URL in a sitemap is precisely what produces
 * "Indexed, though blocked by robots.txt" in Search Console.
 */
const STATIC_ROUTES: Array<Omit<SitemapEntry, 'lastmod'>> = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/events', changefreq: 'weekly', priority: '0.9' },
  // Type-filtered event view. Self-canonical with its own h1, title and
  // description, so listing it matches what the page claims.
  //
  // Only Charity is listed, for two different reasons:
  //   · `?type=Festival` canonicalises to /festivals — a sitemap must never
  //     advertise a URL whose canonical points elsewhere ("Alternate page with
  //     proper canonical tag").
  //   · `?type=Workshop` and `?type=Other` currently hold one event each
  //     (~100 words). Asking Google to index a one-item list invites
  //     "Crawled — currently not indexed". They stay crawlable via the nav and
  //     self-canonical; add them back when each holds three or four events.
  { path: '/events?type=Charity', changefreq: 'weekly', priority: '0.75' },
  { path: '/durga-puja', changefreq: 'weekly', priority: '0.9' },
  { path: '/festivals', changefreq: 'weekly', priority: '0.8' },
  { path: '/saraswati-puja', changefreq: 'monthly', priority: '0.8' },
  { path: '/poila-boishakh', changefreq: 'monthly', priority: '0.8' },
  { path: '/kali-puja', changefreq: 'monthly', priority: '0.8' },
  { path: '/bengali-concerts', changefreq: 'weekly', priority: '0.85' },
  { path: '/artists', changefreq: 'weekly', priority: '0.85' },
  { path: '/blogs', changefreq: 'weekly', priority: '0.8' },
  { path: '/bengali-food', changefreq: 'monthly', priority: '0.75' },
  { path: '/charity', changefreq: 'monthly', priority: '0.8' },
  { path: '/about', changefreq: 'monthly', priority: '0.8' },
  { path: '/galleries', changefreq: 'weekly', priority: '0.8' },
  { path: '/notices', changefreq: 'weekly', priority: '0.7' },
  { path: '/news', changefreq: 'weekly', priority: '0.6' },
  { path: '/magazines', changefreq: 'monthly', priority: '0.7' },
  { path: '/sponsors', changefreq: 'monthly', priority: '0.7' },
  { path: '/become-our-sponsor', changefreq: 'monthly', priority: '0.75' },
  { path: '/corporate-partnerships', changefreq: 'monthly', priority: '0.75' },
  { path: '/committee', changefreq: 'monthly', priority: '0.7' },
  { path: '/contact', changefreq: 'monthly', priority: '0.7' },
  { path: '/donate', changefreq: 'monthly', priority: '0.8' },
  { path: '/documents', changefreq: 'monthly', priority: '0.5' },
  { path: '/book-your-seat', changefreq: 'weekly', priority: '0.6' },
];

export class SitemapController {
  private eventService: EventService;
  private galleryService: GalleryService;
  private durgaPujaPageService: DurgaPujaPageService;
  private subEventService: SubEventService;
  private artistService: ArtistService;
  private blogService: BlogService;

  constructor() {
    this.eventService = new EventService();
    this.galleryService = new GalleryService();
    this.durgaPujaPageService = new DurgaPujaPageService();
    this.subEventService = new SubEventService();
    this.artistService = new ArtistService();
    this.blogService = new BlogService();
  }

  private renderUrl(baseUrl: string, entry: SitemapEntry): string {
    const images = (entry.images ?? [])
      .filter(img => !!img.loc)
      // Google caps image sitemap entries at 1,000 images per page URL.
      .slice(0, 1000)
      .map(
        img => `    <image:image>
      <image:loc>${xml(img.loc)}</image:loc>${
        img.title ? `\n      <image:title>${xml(img.title)}</image:title>` : ''
      }${img.caption ? `\n      <image:caption>${xml(img.caption)}</image:caption>` : ''}
    </image:image>`
      )
      .join('\n');

    return `  <url>
    <loc>${xml(`${baseUrl}${entry.path}`)}</loc>${
      entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''
    }
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>${images ? `\n${images}` : ''}
  </url>`;
  }

  async generateSitemap(_req: Request, res: Response): Promise<void> {
    try {
      const baseUrl = (process.env.BASE_URL || 'https://www.sanhoti.org').replace(/\/+$/, '');
      const today = new Date().toISOString().split('T')[0];

      const [activeEvents, publicGalleries, durgaYears, allSubEvents, artists, blogs] = await Promise.all([
        this.eventService.getActiveEvents().catch(() => []),
        this.galleryService.getPublicGalleries().catch(() => []),
        this.durgaPujaPageService.listYears().catch(() => []),
        this.subEventService.getAllSubEvents().catch(() => []),
        this.artistService.getActiveArtists().catch(() => []),
        this.blogService.getPublicBlogs().catch(() => []),
      ]);

      const entries: SitemapEntry[] = [];

      // ---- evergreen pages -------------------------------------------------
      // Content-bearing hubs take the newest lastmod of the records they list,
      // so a truthful date is sent instead of "today" for every URL. Google
      // discounts sitemaps whose lastmod moves on every fetch.
      const newest = (dates: Array<string | undefined>): string | undefined => {
        const days = dates.map(isoDay).filter((d): d is string => !!d).sort();
        return days.length ? days[days.length - 1] : undefined;
      };
      const eventsLastmod = newest(activeEvents.map(e => e.updated_at));
      const galleriesLastmod = newest(publicGalleries.map(g => g.updatedAt));
      const artistsLastmod = newest(artists.map(a => a.updated_at));
      const blogsLastmod = newest(blogs.map(b => b.updated_at));

      const dynamicLastmod: Record<string, string | undefined> = {
        '/': eventsLastmod,
        '/events': eventsLastmod,
        '/durga-puja': eventsLastmod,
        '/galleries': galleriesLastmod,
        '/artists': artistsLastmod,
        '/blogs': blogsLastmod,
        '/bengali-concerts': newest(allSubEvents.map(s => s.updated_at)),
      };

      for (const route of STATIC_ROUTES) {
        entries.push({ ...route, lastmod: dynamicLastmod[route.path] ?? today });
      }

      // ---- Durga Puja year pages ------------------------------------------
      for (const year of durgaYears) {
        entries.push({
          path: durgaPujaPagePath(year),
          lastmod: eventsLastmod ?? today,
          changefreq: 'weekly',
          priority: '0.9',
        });
      }

      // ---- event detail pages (with flyer images) --------------------------
      for (const event of activeEvents) {
        if (!event.event_id) continue;
        const images: SitemapImage[] = [];
        try {
          const flyer = await this.eventService.getEventFlyerFilename(event.event_id);
          if (flyer) {
            images.push({
              loc: `${baseUrl}/api/events/${event.event_id}/image/${encodeURIComponent(flyer)}`,
              title: event.event_name,
              caption:
                event.image_alt ||
                `${event.event_name} — Sanhoti Bengali Association event in ${
                  event.venue_city || 'Orange County'
                }, California`,
            });
          }
        } catch {
          /* the URL is still worth listing without its image */
        }
        entries.push({
          path: getEventDetailPath(event, event.event_id),
          lastmod: isoDay(event.updated_at) ?? today,
          changefreq: 'weekly',
          priority: event.is_priority ? '0.9' : '0.8',
          images,
        });
      }

      // ---- opted-in sub-event SEO pages (concerts) -------------------------
      for (const se of allSubEvents) {
        if (se.seo_page_enabled !== true || se.is_active === false || !se.sub_event_id) continue;
        const images: SitemapImage[] = [];
        try {
          const paths = await this.subEventService.getSubEventImages(se.sub_event_id);
          for (const p of paths.slice(0, 10)) {
            const filename = p.split('/').pop() ?? p;
            images.push({
              loc: `${baseUrl}/api/sub-events/${se.sub_event_id}/image/${encodeURIComponent(filename)}`,
              title: se.sub_event_name,
              caption:
                se.image_alt ||
                `${se.sub_event_name}${
                  se.performers ? ` featuring ${se.performers}` : ''
                } — Sanhoti, ${se.venue_city || 'Orange County'}, CA`,
            });
          }
        } catch {
          /* images optional */
        }
        entries.push({
          path: `/sub-events/${se.sub_event_id}`,
          lastmod: isoDay(se.updated_at) ?? today,
          changefreq: 'weekly',
          priority: '0.8',
          images,
        });
      }

      // ---- artist pages ----------------------------------------------------
      for (const artist of artists) {
        if (!artist.slug) continue;
        entries.push({
          path: `/artists/${artist.slug}`,
          lastmod: isoDay(artist.updated_at) ?? today,
          changefreq: 'monthly',
          priority: artist.is_featured ? '0.85' : '0.8',
          images: artist.image_path
            ? [
                {
                  loc: `${baseUrl}/api/artists/${artist.artist_id}/image`,
                  title: artist.name,
                  caption:
                    artist.image_alt ||
                    `${artist.name} — artist at Sanhoti Bengali Association in Orange County, CA`,
                },
              ]
            : [],
        });
      }

      // ---- blog posts ------------------------------------------------------
      for (const blog of blogs) {
        if (!blog.slug) continue;
        entries.push({
          path: `/blogs/${blog.slug}`,
          lastmod: isoDay(blog.updated_at) ?? today,
          changefreq: 'monthly',
          priority: blog.is_featured ? '0.75' : '0.7',
          images: blog.cover_image_url
            ? [
                {
                  loc: `${baseUrl}${blog.cover_image_url}`,
                  title: blog.title,
                  caption: blog.cover_image_alt || blog.title,
                },
              ]
            : [],
        });
      }

      // ---- gallery pages (photos surface in Google Images) ------------------
      for (const gallery of publicGalleries) {
        const images: SitemapImage[] = (gallery.photos ?? [])
          .filter(p => p.type !== 'video')
          .slice(0, 200)
          .map(photo => {
            const filename = photo.filename || (photo.url || '').split('/').pop() || '';
            return {
              loc: gallery.eventId
                ? `${baseUrl}/api/galleries/${gallery.eventId}/photos/${encodeURIComponent(filename)}`
                : photo.url,
              title: gallery.title,
              caption:
                photo.caption ||
                `${gallery.title} — Sanhoti Bengali Association, Orange County, California`,
            };
          })
          .filter(img => !!img.loc);

        entries.push({
          path: `/galleries/${gallery.id}`,
          lastmod: isoDay(gallery.updatedAt) ?? today,
          changefreq: 'monthly',
          priority: '0.6',
          images,
        });
      }

      // Deduplicate by path, merging images and keeping the newest lastmod.
      // Durga Puja events resolve to /durga-puja-<year> via getEventDetailPath,
      // so they collide with the entries generated from the Durga year list.
      // A sitemap that lists the same URL twice is treated as malformed.
      const byPath = new Map<string, SitemapEntry>();
      for (const entry of entries) {
        const existing = byPath.get(entry.path);
        if (!existing) {
          byPath.set(entry.path, entry);
          continue;
        }
        byPath.set(entry.path, {
          ...existing,
          lastmod:
            existing.lastmod && entry.lastmod
              ? existing.lastmod > entry.lastmod
                ? existing.lastmod
                : entry.lastmod
              : existing.lastmod ?? entry.lastmod,
          priority:
            parseFloat(entry.priority) > parseFloat(existing.priority)
              ? entry.priority
              : existing.priority,
          images: [...(existing.images ?? []), ...(entry.images ?? [])].filter(
            (img, i, all) => all.findIndex(o => o.loc === img.loc) === i
          ),
        });
      }

      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[...byPath.values()].map(e => this.renderUrl(baseUrl, e)).join('\n')}
</urlset>`;

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(sitemap);
    } catch (error) {
      console.error('Error generating sitemap:', error);
      res.status(500).send('Error generating sitemap');
    }
  }
}
