import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
const APP_VERSION = '2.6.1.1'

export default defineConfig({
  base: '/test2/',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-144.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'browserconfig.xml', 'splash/*.png'],
      manifest: {
        name: `ADTMC V${APP_VERSION}`,
        short_name: 'ADTMC',
        description: 'ADTMC documentation and barcode generation',
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
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: true,
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
          }
        ]
      },
      devOptions: {
        enabled: false // PWA disabled in dev; test with 'npm run preview' after build
      }
    })
  ]
})
