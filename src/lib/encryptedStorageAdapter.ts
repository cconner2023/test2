/**
 * Encrypted storage adapter for Supabase Auth.
 *
 * Implements the SupportedStorage interface expected by @supabase/auth-js,
 * routing all reads/writes through our AES-256-GCM encrypted IDB store
 * (`secureStorage.ts`). This prevents Supabase from storing plaintext JWTs
 * in localStorage or sessionStorage.
 *
 * For browser tabs (non-PWA), we still want session-scoped behavior.
 * A `pagehide`/`beforeunload` listener (registered by sessionCleanup.ts)
 * already handles cleanup — so encrypted IDB is safe for both modes.
 */

import { secureSet, secureGet, secureRemove } from './secureStorage'

export const encryptedStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    return secureGet(key)
  },
  async setItem(key: string, value: string): Promise<void> {
    await secureSet(key, value)
  },
  async removeItem(key: string): Promise<void> {
    await secureRemove(key)
  },
}
