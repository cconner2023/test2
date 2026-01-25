import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/ADTMC/',
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-144.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'ADTMC V2.6',
        short_name: 'ADTMC',
        description: 'ADTMC documentation and barcode generation',
        start_url: '/ADTMC/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#646cff',
        orientation: 'portrait-primary',
        categories: ['productivity', 'utilities'],
        scope: '/ADTMC/',
        icons: [
          {
            src: '/ADTMC/icon-144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/ADTMC/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/ADTMC/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/ADTMC/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Scan Note',
            short_name: 'Scan',
            description: 'Quickly scan a Note Barcode',
            url: '/ADTMC/scan',
            icons: [
              {
                src: '/ADTMC/icon-192.png',
                sizes: '192x192',
                type: 'image/png'
              }
            ]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ],
        skipWaiting: false, // Set to false so we can show notification
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    copyPublicDir: true
  },
  server: {
    port: 3000,
    host: true
  },
  preview: {
    port: 4173,
    host: true,
    open: '/ADTMC/'
  }
})