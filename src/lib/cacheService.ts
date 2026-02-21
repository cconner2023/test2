/**
 * Cache clearing service for SW caches.
 * Removes user-specific caches on signout while preserving app-level caches.
 */

const USER_CACHES = ['supabase-api-cache', 'supabase-storage-cache']

export async function clearServiceWorkerCaches(): Promise<void> {
  try {
    if (!('caches' in window)) return
    await Promise.all(USER_CACHES.map((name) => caches.delete(name)))
  } catch {
    // caches API unavailable or errored — fail silently
  }
}
