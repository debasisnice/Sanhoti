import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'images/logo.png'],
      manifest: {
        name: 'Sanhoti - Bengali Association of Orange County',
        short_name: 'Sanhoti',
        description: 'Sanhoti Bengali Association of Orange County, CA - Celebrating Culture, Building Connections',
        theme_color: '#B8860B',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/images/logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/images/logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Events',
            short_name: 'Events',
            description: 'View upcoming events',
            url: '/events',
            icons: [{ src: '/images/logo.png', sizes: '192x192' }]
          },
          {
            name: 'Notices',
            short_name: 'Notices',
            description: 'View community notices',
            url: '/notices',
            icons: [{ src: '/images/logo.png', sizes: '192x192' }]
          },
          {
            name: 'Galleries',
            short_name: 'Galleries',
            description: 'Browse photo galleries',
            url: '/galleries',
            icons: [{ src: '/images/logo.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Never serve the SPA shell for API routes (e.g. direct PDF URLs in a new tab).
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Exclude user-manual from API caching (HTML pages don't cache well)
            urlPattern: /\/api\/user-manual\/.*/i,
            handler: 'NetworkOnly'
          },
          {
            // Large PDFs must not be cached by the service worker (breaks react-pdf / iframe viewers).
            urlPattern: /\/api\/durga-puja-page\/\d+\/sponsorship-pdf/i,
            handler: 'NetworkOnly',
          },
          {
            // Event / sub-event flyer images are keyed by filename and effectively
            // static. Keep them in their OWN cache (so they can't be evicted by the
            // 50-entry api-cache) and serve them Stale-While-Revalidate: the image
            // renders instantly from cache on refresh — never vanishing when the
            // backend is briefly slow — while refreshing in the background.
            urlPattern: /\/api\/(events|sub-events)\/[^/]+\/image\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'event-images-cache',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false,  // Disable service worker in development to avoid issues
        type: 'module'
      }
    })
  ],
  build: {
    // Split large third-party libraries into their own cacheable chunks so the
    // initial route ships less JS (better LCP/INP) and vendor code is cached
    // across deploys. pdfjs/react-pdf are already route-lazy; keep them isolated.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]react(-dom|-router[^/]*)?[\\/]/.test(id)) return 'react-vendor';
          if (id.includes('framer-motion')) return 'framer-motion';
          if (id.includes('pdfjs-dist') || id.includes('react-pdf')) return 'pdf';
          if (id.includes('date-fns')) return 'date-fns';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('html5-qrcode') || id.includes('qrcode.react')) return 'qrcode';
          return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/og': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})

