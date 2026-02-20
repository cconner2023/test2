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

// Dismiss splash screen when bar fill animation completes
const splashBar = document.querySelector('.splash-bar-fill')
if (splashBar) {
  splashBar.addEventListener('animationend', () => {
    const splash = document.getElementById('splash')
    if (splash) {
      splash.classList.add('splash-out')
      setTimeout(() => splash.remove(), UI_TIMING.SLIDE_ANIMATION)
    }
  }, { once: true })
}
