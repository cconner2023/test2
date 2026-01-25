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
      filename: 'serviceWorker.js', // Changed from sw.js to match your file

      // Auto register and update
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      // Include additional assets
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'mask-icon.svg',
        'icon-192.png',
        'icon-512.png',
        'icon-512-maskable.png'
      ],

      // Use your existing manifest.json
      manifest: false, // Disable Vite PWA's manifest generation

      // Inject manifest into your custom SW
      injectManifest: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,jpg,jpeg,gif,webp,woff,woff2,ttf,eot,json}'
        ],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
        globIgnores: [
          '**/node_modules/**',
          '**/src/**',
          '**/*.map'
        ],
        // Ensure your manifest.json is included in precache
        injectionPoint: 'self.__WB_MANIFEST'
      },

      // Workbox configuration (minimal since we're using custom SW)
      workbox: {
        cleanupOutdatedCaches: true,
        sourcemap: false,
        mode: 'production'
      },

      // Development options
      devOptions: {
        enabled: false, // Disable PWA in dev to see network requests
        type: 'module',
        navigateFallback: '/ADTMC/index.html'
      }
    })
  ],

  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: 'index.html'
      },
      output: {
        manualChunks: undefined,
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    },
    // Ensure assets are properly hashed for cache busting
    assetsInlineLimit: 4096,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },

  // Server configuration for development
  server: {
    port: 3000,
    open: true,
    host: true
  },

  // Preview configuration (for npm run preview)
  preview: {
    port: 4173,
    open: true,
    host: true
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', 'qr-scanner']
  }
})