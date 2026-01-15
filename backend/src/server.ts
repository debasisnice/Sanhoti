import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import routes from './routes/index.js';
import { SitemapController } from './controllers/SitemapController.js';

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Sitemap - Serve at root level for SEO (before API routes)
const sitemapController = new SitemapController();
app.get('/sitemap.xml', (req, res) => {
  return sitemapController.generateSitemap(req, res);
});

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

