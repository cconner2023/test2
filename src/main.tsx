import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { checkSupabaseConnection } from './lib/supabase.ts'

// Verify Supabase connection on startup (non-blocking)
checkSupabaseConnection().then(result => {
  if (result.connected) {
    console.log(`[App] Supabase database connection established (${result.latencyMs}ms)`)
  } else {
    console.warn('[App] Supabase database connection failed:', result.error)
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
