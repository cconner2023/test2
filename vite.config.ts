import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/ADTMC/',
  plugins: [
    tailwindcss(),
    // Minimal PWA config - just manifest generation
    VitePWA({
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
        ]
      },
      // Disable ALL service worker features
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: false
    })
  ]
})