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
      },
      // Use a minimal workbox configuration or disable it
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: '/ADTMC/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cconner2023\.github\.io\/ADTMC\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'adtmc-pages',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 24 * 60 * 60 // 24 hours
              }
            }
          }
        ]
      },
      // Let's use the default injection but customize
      injectRegister: 'auto',
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ]
})