import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/ADTMC/',
  plugins: [
    tailwindcss(),
    VitePWA({
      // Use your custom service worker
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'serviceWorker.js',

      // Simple registration
      registerType: 'autoUpdate',

      // Don't generate manifest, use yours
      manifest: false,

      // Minimal injectManifest config
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,json,png,ico,svg}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },

      // Minimal workbox config
      workbox: {
        cleanupOutdatedCaches: true,
        sourcemap: false
      },

      // Disable in dev
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ],

  build: {
    outDir: 'dist',
    sourcemap: false,
    copyPublicDir: true  // ADD THIS - copies public/ files to dist/
  },

  server: {
    port: 3000,
    host: true
  },

  preview: {
    port: 4173,
    host: true
  }
})