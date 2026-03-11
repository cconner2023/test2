import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
const APP_VERSION = '2.6.3'

export default defineConfig({
  base: '/test2/',
  server: {
    // Explicit HMR WebSocket — Windows often fails with default auto-detection
    hmr: true,
    watch: {
      // Use polling on Windows for reliable file-change detection
      usePolling: true,
      interval: 1000,
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    react(),
    {
      name: 'html-version',
      transformIndexHtml(html, ctx) {
        let result = html.replace(/%APP_VERSION%/, APP_VERSION)
        // Inject CSP only in production builds (inline scripts break CSP in dev)
        if (ctx.bundle) {
          // Hash allows the inline splash-screen theme-detection script
          const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'sha256-Zblva+Y24jGsap4fF/wYX94AXAYZOGIx/aCQnOc1mQ4='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';">`
          result = result.replace('<!--CSP_PLACEHOLDER-->', csp)
        } else {
          result = result.replace('<!--CSP_PLACEHOLDER-->', '')
        }
        return result
      }
    },
    {
      name: 'generate-version-json',
      writeBundle(options) {
        const outDir = options.dir || resolve('dist')
        mkdirSync(outDir, { recursive: true })
        writeFileSync(
          resolve(outDir, 'version.json'),
          JSON.stringify({ version: APP_VERSION })
        )
      }
    },
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      includeAssets: ['icon-144.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'browserconfig.xml', 'splash/*.png'],
      manifest: {
        id: '/test2/',
        name: `ADTMC V${APP_VERSION}`,
        short_name: `ADTMC ${APP_VERSION}`,
        description: 'knowledge base, training, logistics, and mesh communications',
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
        screenshots: [
          {
            src: '/test2/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'wide',
            label: 'ADTMC Desktop'
          },
          {
            src: '/test2/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'ADTMC Mobile'
          }
        ],
        shortcuts: [
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
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,mp3}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB
      },
      devOptions: {
        enabled: false // PWA disabled in dev; test with 'npm run preview' after build
      }
    })
  ]
})
