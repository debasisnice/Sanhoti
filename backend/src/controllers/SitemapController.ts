import { Request, Response } from 'express';
import { EventService } from '../services/EventService.js';
import { GalleryService } from '../services/GalleryService.js';
import { DurgaPujaPageService } from '../services/DurgaPujaPageService.js';
import { getEventDetailPath } from '../utils/slug.js';
import { durgaPujaPagePath } from '../utils/durgaPuja.js';

export class SitemapController {
  private eventService: EventService;
  private galleryService: GalleryService;
  private durgaPujaPageService: DurgaPujaPageService;

  constructor() {
    this.eventService = new EventService();
    this.galleryService = new GalleryService();
    this.durgaPujaPageService = new DurgaPujaPageService();
  }

  async generateSitemap(req: Request, res: Response): Promise<void> {
    try {
      const baseUrl = process.env.BASE_URL || 'https://www.sanhoti.org';
      
      // Fetch all dynamic content
      const [activeEvents, publicGalleries, durgaYears] = await Promise.all([
        this.eventService.getActiveEvents(),
        this.galleryService.getPublicGalleries(),
        this.durgaPujaPageService.listYears(),
      ]);

      // Get current date for lastmod
      const currentDate = new Date().toISOString().split('T')[0];

      // Build sitemap XML
      let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  
  <!-- Home Page -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  
  <!-- Main Pages -->
  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>

  <url>
    <loc>${baseUrl}/events</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>

  <url>
    <loc>${baseUrl}/durga-puja</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>
${durgaYears
  .map(
    year => `  <url>
    <loc>${baseUrl}${durgaPujaPagePath(year)}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`
  )
  .join('\n')}
  
  <url>
    <loc>${baseUrl}/notices</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/galleries</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/magazines</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/sponsors</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/committee</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/contact</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/donate</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/documents</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  
  <!-- Dynamic Event Pages -->
`;

      // Add event pages
      for (const event of activeEvents) {
        if (event.event_id) {
          const eventLastMod = event.updated_at 
            ? new Date(event.updated_at).toISOString().split('T')[0]
            : currentDate;
          
          sitemap += `  <url>
    <loc>${baseUrl}${getEventDetailPath(event, event.event_id)}</loc>
    <lastmod>${eventLastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
        }
      }

      // Add gallery pages
      sitemap += `  
  <!-- Dynamic Gallery Pages -->
`;
      
      for (const gallery of publicGalleries) {
        const galleryLastMod = gallery.updatedAt
          ? new Date(gallery.updatedAt).toISOString().split('T')[0]
          : currentDate;
        
        sitemap += `  <url>
    <loc>${baseUrl}/galleries/${gallery.id}</loc>
    <lastmod>${galleryLastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`;
      }

      sitemap += `</urlset>`;

      // Set response headers for XML
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.send(sitemap);
    } catch (error: any) {
      console.error('Error generating sitemap:', error);
      res.status(500).send('Error generating sitemap');
    }
  }
}

