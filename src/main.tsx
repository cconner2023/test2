import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { checkSupabaseConnection } from './lib/supabase.ts'
import { createLogger } from './Utilities/Logger.ts'
import { initSW } from './lib/swService.ts'

// Register service worker immediately — before React mounts so update detection
// works even when the user is on the login screen.
initSW()

// Stale-bundle recovery. A page left running under a newer worker (or across a
// deploy) asks for hashed chunks its own build shipped; the new precache and the
// host no longer have them, so every lazy import fails and features silently
// die. Reload once onto the current build. Guarded so a genuinely missing chunk
// (offline with no cache) can't reload-loop — the error then propagates as usual.
const CHUNK_RELOAD_KEY = 'chunkReloadAt'
const CHUNK_RELOAD_GUARD_MS = 30 * 1000
function reloadForStaleBundle(reason: unknown): void {
  // Offline, a reload can't fetch anything newer — it would only cost the user
  // their in-progress state.
  if (!navigator.onLine) return
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0
    if (Date.now() - last < CHUNK_RELOAD_GUARD_MS) return
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
    localStorage.setItem('updateReloadPending', '1')
  } catch { return } // no storage → no loop guard → don't risk a loop
  logger.warn('Chunk load failed — reloading onto the current build:', reason)
  window.location.reload()
}
window.addEventListener('vite:preloadError', (e) => {
  reloadForStaleBundle((e as Event & { payload?: unknown }).payload)
})
// Dynamic imports Vite didn't wrap (no preload deps) only surface here, and only
// when the caller didn't catch them. Messages per engine: Chromium, WebKit, Gecko.
const CHUNK_ERROR_RE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason instanceof Error ? e.reason.message : String(e.reason ?? '')
  if (CHUNK_ERROR_RE.test(msg)) reloadForStaleBundle(e.reason)
})

const logger = createLogger('App')

// Verify Supabase connection on startup (non-blocking)
checkSupabaseConnection().then(result => {
  if (result.connected) {
    logger.info(`Supabase database connection established (${result.latencyMs}ms)`)
  } else {
    logger.warn('Supabase database connection failed:', result.error)
  }
})

// Clean up legacy service worker and cache from old test2 deployment
if ('caches' in window) {
  caches.delete('pwa-cache-v1');
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const reg of registrations) {
      if (reg.active?.scriptURL.includes('serviceWorker.js')) {
        reg.unregister();
      }
    }
  });
}

// iOS 15 standalone PWA bug: env(safe-area-inset-top) returns 0 despite
// viewport-fit=cover + black-translucent. Detect and override --sat.
// Guard: navigator.standalone is WebKit-only (iOS Safari). Confirm iOS UA
// to avoid false positives if another engine ever adds this property.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
if (
  isIOS &&
  'standalone' in navigator &&
  (navigator as unknown as { standalone: boolean }).standalone
) {
  const probe = document.createElement('div')
  probe.style.position = 'fixed'
  probe.style.top = '0'
  probe.style.paddingTop = 'env(safe-area-inset-top, 0px)'
  probe.style.visibility = 'hidden'
  probe.style.pointerEvents = 'none'
  document.body.appendChild(probe)
  const val = parseFloat(getComputedStyle(probe).paddingTop) || 0
  document.body.removeChild(probe)

  if (val === 0) {
    // env() returned 0 in standalone — apply device-appropriate fallback.
    // This bug is iOS 15-specific. No Dynamic Island device (iPhone 14 Pro+)
    // can run iOS 15, so we only need notch vs pre-notch fallbacks:
    //   ≥ 812: Notch era (iPhone X through 13 series) → 47px
    //     Actual insets vary 44-50px across models; 47px is a safe middle
    //     ground that prevents content from sitting behind the notch.
    //   < 812: Pre-notch (SE, 8, 8 Plus) → 20px status bar
    // iPads (screen.height > 1000) get 20px — no notch on any iPad.
    // Newer iOS can also read 0 here transiently at launch, then report the
    // real (larger, Dynamic Island) inset once layout settles. Use max() so the
    // fallback is only a floor and never pins --sat below the live env() value.
    const h = window.screen.height
    const fallback = h >= 812 && h <= 956 ? '47px' : '20px'
    document.documentElement.style.setProperty('--sat', `max(env(safe-area-inset-top, 0px), ${fallback})`)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Expose splash dismissal for React (called by LockGate when auth settles)
// Enforce a minimum display time so fast auth doesn't cause a flash.
// Patch reloads hold longer so the "Applying patch…" splash (set by the
// index.html inline script, which flagged window.__patchReload) is visible
// long enough to read as intentional rather than a glitch.
const PATCH_RELOAD = (window as unknown as { __patchReload?: boolean }).__patchReload === true
const SPLASH_MIN_MS = PATCH_RELOAD ? 2200 : 800
const splashStart = performance.now()
;(window as unknown as { dismissSplash: () => void }).dismissSplash = () => {
  const splashEl = document.getElementById('splash')
  if (!splashEl) return
  const elapsed = performance.now() - splashStart
  const remaining = Math.max(0, SPLASH_MIN_MS - elapsed)
  setTimeout(() => {
    splashEl.classList.add('splash-out')
    splashEl.addEventListener('transitionend', () => splashEl.remove(), { once: true })
    // Fallback removal if transitionend doesn't fire
    setTimeout(() => { if (splashEl.parentNode) splashEl.remove() }, 500)
  }, remaining)
}
