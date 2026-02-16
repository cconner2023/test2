import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
const APP_VERSION = '2.6.2'

export default defineConfig({
  base: '/test2/',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    {
      name: 'html-version',
      transformIndexHtml(html) {
        return html.replace(/%APP_VERSION%/g, APP_VERSION)
      }
    },
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-144.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'browserconfig.xml', 'splash/*.png'],
      manifest: {
        name: `ADTMC V${APP_VERSION}`,
        short_name: `ADTMC ${APP_VERSION}`,
        description: 'ADTMC documentation',
        start_url: '/test2/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#646cff',
        orientation: 'portrait-primary',
        categories: ['productivity', 'utilities'],
        scope: '/test2/',
        icons: [
          {
            src: '/test2/icon-144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/test2/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/test2/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/test2/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'My Notes',
            short_name: 'My Notes',
            description: 'View notes notes saved to this device',
            url: '/test2/?view=mynotes',
            icons: [
              {
                src: '/test2/icon-192.png',
                sizes: '192x192',
                type: 'image/png'
              }
            ]
          },
          {
            name: 'Import Note',
            short_name: 'Import',
            description: 'Import a note via barcode',
            url: '/test2/?view=import',
            icons: [
              {
                src: '/test2/icon-192.png',
                sizes: '192x192',
                type: 'image/png'
              }
            ]
          },
          {
            name: 'My Training',
            short_name: 'Training',
            description: 'View your training progress',
            url: '/test2/?view=training',
            icons: [
              {
                src: '/test2/icon-192.png',
                sizes: '192x192',
                type: 'image/png'
              }
            ]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: true,

        // SPA fallback: serve cached index.html for all navigation requests under /test2/
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [/^\/test2\//],

        // Exclude Supabase API and auth callback URLs from navigation fallback
        navigateFallbackDenylist: [/^\/test2\/auth\//, /\/rest\/v1\//, /\/auth\/v1\//],

        runtimeCaching: [
          // Google Fonts stylesheets (CSS)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Google Fonts files (woff2) - CacheFirst since font files are immutable
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Supabase REST API - NetworkFirst with offline fallback
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Supabase Auth — no route registered. Requests pass through to the
          // browser's default fetch, so offline failures are handled by app code
          // instead of causing FetchEvent.respondWith TypeError in the SW.
          // Supabase Storage - CacheFirst for uploaded files
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false // PWA disabled in dev; test with 'npm run preview' after build
      }
    })
  ]
})
