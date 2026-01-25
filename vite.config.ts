import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/ADTMC/',
  plugins: [
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'serviceWorker.js',
      registerType: 'autoUpdate',
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,json,png,ico,svg}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      workbox: {
        cleanupOutdatedCaches: true,
        sourcemap: false
      },
      devOptions: {
        enabled: false,
        type: 'module'
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
    // ADD THIS for preview to handle base path
    open: '/ADTMC/'
  }
})