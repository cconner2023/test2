/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import { resolve } from 'path'
import { hudSplashMarkup } from './src/lib/hudGeometry'

const APP_VERSION = '2.7.1'
const BUILD_ID = 'A1'

export default defineConfig({
  base: '/test2/',
  test: {
    // jsdom, not the vitest default 'node': importing useAuthStore runs
    // init() at module scope, which touches sessionStorage/localStorage.
    // Under 'node' those are undefined and the suite throws before any
    // test registers.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    // @/ -> src/ (matches tsconfig paths). Uses cwd-relative resolve() to
    // mirror the existing input resolution above.
    alias: {
      '@': resolve('src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        // Main Beacon app entry. Without naming inputs explicitly, Vite
        // auto-discovers index.html only — adding intake.html as a sibling
        // named input lets Vite emit a second tree-shaken bundle for the
        // public outside-event-intake form.
        main: resolve('index.html'),
        intake: resolve('intake.html'),
      },
    },
  },
  server: {
    // Explicit HMR WebSocket — Windows often fails with default auto-detection
    hmr: true,
    // Accept Cloudflare quick-tunnel hosts so an iOS device can reach this dev
    // server over HTTPS (needed for secure-context WebCrypto/Signal). Dev-only.
    allowedHosts: ['.trycloudflare.com'],
    watch: {
      // Use polling on Windows for reliable file-change detection
      usePolling: true,
      interval: 1000,
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    {
      name: 'html-version',
      transformIndexHtml(html, ctx) {
        let result = html.replace(/%APP_VERSION%/, APP_VERSION)
        // Bake the HUD splash from the shared geometry module (runs in dev +
        // build) so the pre-React splash never drifts from HudLoader.tsx.
        result = result.replace('<!--HUD_SPLASH-->', hudSplashMarkup())
        // Inject CSP only in production builds (inline scripts break CSP in dev)
        if (ctx.bundle) {
          // Branch by filename so the public intake bundle gets a narrower
          // CSP than the main app (no map tiles, no Firebase, no Google APIs,
          // no blob workers — only Supabase). Rev6.1.
          const isIntake = ctx.filename?.endsWith('intake.html')
          // Hash the inline splash script from the transformed HTML so the CSP
          // self-maintains — any edit to that script (or the injected splash)
          // can't break it. Computed from `result` (post HUD/THEME injection).
          const inlineScript = result.match(/<script>([\s\S]*?)<\/script>/)
          // Hash both the raw (CRLF) and LF-normalized script so the CSP matches
          // whether or not the build normalizes line endings (Windows safety).
          const variants = inlineScript
            ? [...new Set([inlineScript[1], inlineScript[1].replace(/\r\n/g, '\n')])]
            : []
          const scriptHash = variants
            .map(s => `'sha256-${createHash('sha256').update(s).digest('base64')}'`)
            .join(' ')
          const mainCsp = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' ${scriptHash}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org https://*.tile.opentopomap.org https://server.arcgisonline.com https://basemap.nationalmap.gov; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org https://*.googleapis.com https://*.firebaseio.com https://*.firebaseinstallations.googleapis.com wss://*.firebaseio.com https://fcmregistrations.googleapis.com; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';">`
          const intakeCsp = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';">`
          result = result.replace('<!--CSP_PLACEHOLDER-->', isIntake ? intakeCsp : mainCsp)
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
        // Manifest name is stable app IDENTITY — NOT a version channel. Embedding
        // APP_VERSION here mutates the manifest every release, which makes desktop
        // Chrome fire its OWN native "App update available" flow and activate the new
        // SW itself — preempting the in-app UpdateNotification card (onNeedRefresh
        // never fires because the SW never sits in `waiting`). iOS Safari ignores
        // manifest-update, so mobile was unaffected; desktop was not. Keep this static
        // so version signaling stays solely in version.json (swService gate) + the card.
        name: 'ADTMC',
        short_name: 'ADTMC',
        description: 'knowledge base, training, logistics, and mesh communications',
        start_url: '/test2/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#646cff',
        orientation: 'portrait-primary',
        categories: ['productivity', 'utilities'],
        scope: '/test2/',
        gcm_sender_id: '103953800507',
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,mp3,pdf}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // 8 MiB
      },
      devOptions: {
        enabled: false // PWA disabled in dev; test with 'npm run preview' after build
      }
    })
  ]
})
