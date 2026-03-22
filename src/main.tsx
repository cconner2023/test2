import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { checkSupabaseConnection } from './lib/supabase.ts'
import { createLogger } from './Utilities/Logger.ts'

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
    const h = window.screen.height
    const fallback = h >= 812 && h <= 956 ? '47px' : '20px'
    document.documentElement.style.setProperty('--sat', fallback)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Expose splash dismissal for React (called by LockGate when auth settles)
;(window as unknown as { dismissSplash: () => void }).dismissSplash = () => {
  const splashEl = document.getElementById('splash')
  if (!splashEl) return
  splashEl.classList.add('splash-out')
  splashEl.addEventListener('transitionend', () => splashEl.remove(), { once: true })
  // Fallback removal if transitionend doesn't fire
  setTimeout(() => { if (splashEl.parentNode) splashEl.remove() }, 500)
}
