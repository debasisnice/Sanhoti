import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import routes from './routes/index.js';
import { SitemapController } from './controllers/SitemapController.js';
import { SeoPageController } from './controllers/SeoPageController.js';
import { EventController } from './controllers/EventController.js';
import { GalleryController } from './controllers/GalleryController.js';
import { SubEventController } from './controllers/SubEventController.js';
import type { AuthRequest } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware - CORS configuration
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3000', 
      'http://localhost:5173',
      'https://www.sanhoti.org',
      'https://sanhoti.org',
      'http://www.sanhoti.org',
      'http://sanhoti.org'
    ];

// Security Headers Middleware - Improve trust signals and security
app.use((req, res, next) => {
  // Plain image bytes for social previews — avoid CSP/HSTS noise that some crawlers mishandle
  if (req.path.startsWith('/og/')) {
    return next();
  }
  // Skip restrictive headers for user manual (to allow iframe embedding)
  if (req.path.startsWith('/api/user-manual')) {
    // Allow embedding from sanhoti.org and localhost
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://www.sanhoti.org https://sanhoti.org http://localhost:3000 http://localhost:5173");
    return next();
  }
  
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Prevent MIME-type sniffing attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable HSTS (force HTTPS for 1 year, including subdomains)
  // Preload allows inclusion in browser HSTS preload lists
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Referrer Policy - control what referrer information is sent
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy - control browser features and APIs
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy - prevent XSS attacks
  // Adjust based on your specific needs (fonts, scripts, etc.)
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  res.setHeader('Content-Security-Policy', cspHeader);
  
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Always allow requests from allowed origins
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    // In production or when behind proxy, allow all origins
    // This handles Cloudflare and Nginx proxy scenarios
    const isProduction = process.env.NODE_ENV === 'production' || process.env.PORT === '5001';
    if (isProduction) {
      return callback(null, true);
    }
    
    // In development, only allow localhost origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Default: allow (to prevent blocking legitimate requests)
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve User Manual static files
app.use('/api/user-manual', express.static(join(__dirname, '../data/UserManual')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Sitemap - Serve at root level for SEO (before API routes)
const sitemapController = new SitemapController();
app.get('/sitemap.xml', (req, res) => {
  return sitemapController.generateSitemap(req, res);
});

// Dynamic rendering for search engines: Nginx rewrites bot requests for SPA
// routes to /seo/<path> (see docs/SEO_DEPLOYMENT.md). Serves crawlable HTML
// with canonical/meta/JSON-LD and real content from the JSON data files.
const seoPageController = new SeoPageController();
app.get(['/seo', '/seo/*'], (req, res) => seoPageController.renderPage(req, res));

// Crawler-friendly image URLs (not under /api). WhatsApp/Meta often omit previews when og:image is /api/...
const eventController = new EventController();
const galleryController = new GalleryController();
const subEventController = new SubEventController();
app.get('/og/events/:eventId/image/:filename', (req, res) =>
  eventController.getEventImage(req as AuthRequest, res)
);
app.get('/og/sub-events/:id/image/:filename', (req, res) =>
  subEventController.getSubEventImage(req, res)
);
app.get('/og/galleries/:eventId/photos/:filename', (req, res) =>
  galleryController.servePhoto(req as AuthRequest, res)
);
// Share landing HTML (must be after /og/events/:id/image/:file so "image" is not captured as eventId)
app.get('/og/events/:eventId', (req, res) =>
  eventController.getEventSharePage(req as AuthRequest, res)
);

// API routes
app.use('/api', routes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

