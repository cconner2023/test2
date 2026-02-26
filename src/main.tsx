import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { checkSupabaseConnection } from './lib/supabase.ts'
import { createLogger } from './Utilities/Logger.ts'
import { UI_TIMING } from './Utilities/constants.ts'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Dismiss splash screen after bar fill animation completes, then fade out
const splashEl = document.getElementById('splash')
const splashBar = document.querySelector('.splash-bar-fill')

function dismissSplash() {
  if (!splashEl) return
  splashEl.classList.add('splash-out')
  splashEl.addEventListener('transitionend', () => splashEl.remove(), { once: true })
  // Fallback removal if transitionend doesn't fire
  setTimeout(() => { if (splashEl.parentNode) splashEl.remove() }, 500)
}

if (splashBar && splashEl) {
  // Check if the fill animation is still running
  const anims = splashBar.getAnimations()
  if (anims.length > 0) {
    // Animation still running — wait for it to finish, then fade out
    splashBar.addEventListener('animationend', () => dismissSplash(), { once: true })
  } else {
    // Animation already completed before JS loaded — fade out now
    dismissSplash()
  }
}
