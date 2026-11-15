import { createClient } from '@supabase/supabase-js'
import type { Database } from '../Types/database.types.generated'
import { encryptedStorageAdapter } from './encryptedStorageAdapter'
import { authFetch, setAuthRefresher } from './authFetch'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  )
}

const isBrowser = typeof window !== 'undefined'

/**
 * True when running as an installed PWA (standalone/fullscreen display mode).
 * Browser tabs and sandboxed PWAs that don't match standalone get session-scoped auth.
 */
export const isPWA = isBrowser && (
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true
)

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // All modes: use AES-256-GCM encrypted IDB store for session tokens.
    // Browser tab cleanup is handled by sessionCleanup.ts (pagehide listener).
    storage: encryptedStorageAdapter,
  },
  // Clock-skew-proof expiry + no false revocation on intercepted refreshes.
  global: { fetch: authFetch },
})

setAuthRefresher(async () => {
  const { data } = await supabase.auth.refreshSession()
  return data.session?.access_token ?? null
})
