import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/ADTMC/',
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],

      // Add workbox configuration for aggressive updates
      workbox: {
        // Cache all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2}'],

        // Skip waiting immediately (like your old skipWaiting())
        skipWaiting: true,
        clientsClaim: true,

        // IMPORTANT: Set navigateFallback to your base path
        navigateFallback: '/ADTMC/index.html',

        // Maximum file size to cache (5MB)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

        // Runtime caching strategies
        runtimeCaching: [
          {
            // HTML files - always check network first
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          },
          {
            // JS and CSS - StaleWhileRevalidate to check for updates
            urlPattern: ({ request }) =>
              request.destination === 'script' ||
              request.destination === 'style',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            // Images and fonts - CacheFirst
            urlPattern: ({ request }) =>
              request.destination === 'image' ||
              request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            // API calls (if any) - NetworkFirst
            urlPattern: ({ url }) => url.pathname.includes('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 // 1 hour
              }
            }
          }
        ],

        // Clean up old caches
        cleanupOutdatedCaches: true,

        // Disable sourcemap for service worker in production
        sourcemap: false
      },

      // Development options
      devOptions: {
        enabled: false, // Disable in dev to see network requests
        type: 'module',
        navigateFallback: '/ADTMC/index.html'
      },

      // Inject manifest into service worker
      injectManifest: {
        injectionPoint: undefined // Auto-inject
      },

      manifest: {
        name: 'ADTMC V2.6',
        short_name: 'ADTMC',
        description: 'ADTMC documentation and barcode generation',
        theme_color: '#646cff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/ADTMC/',
        scope: '/ADTMC/',
        icons: [
          {
            src: '/ADTMC/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/ADTMC/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            // Maskable icon for Android
            src: '/ADTMC/maskable-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          }
        ],
        shortcuts: [
          {
            name: 'Scan QR Code',
            short_name: 'Scan',
            description: 'Quickly scan a QR code',
            url: '/ADTMC/?scan',
            icons: [
              {
                src: '/ADTMC/icon-192.png',
                sizes: '192x192',
                type: 'image/png'
              }
            ]
          }
        ]
      }
    })
  ]
})