/**
 * Environment-scoped IndexedDB database naming.
 *
 * WHY: IndexedDB is keyed by browser ORIGIN, not by backend. A dev server
 * pointed at one Supabase project and then re-pointed at another (or at prod)
 * shares the same IDB on the same origin. So messages written against one
 * backend persist into a session on a different backend — and get swept into
 * THAT backend's encrypted vault backup, because doCreateBackup snapshots the
 * entire local message store (loadAllConversations has no env/user filter).
 * That bled a dev-written self-note into the prod vault and fanned it to every
 * device on the account (2026-06-26).
 *
 * FIX: suffix every IDB database name with the Supabase project ref so each
 * backend gets an isolated set of databases.
 *
 * PRODUCTION BUILDS KEEP THE BARE NAME (empty suffix). A rename in prod would
 * orphan every existing user's local stores — including the device's Signal
 * identity keys in adtmc-signal-store, which are NOT recoverable from the vault
 * (a renamed key store = a brand-new, unregistered device). The deployed site
 * is a production build (`vite build`), so prod users are untouched; only the
 * developer's `vite dev` sessions get per-backend isolation, which is exactly
 * where the bleed happens.
 */

/** Derive a stable, filesystem-safe identifier for the active Supabase backend. */
function deriveRef(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    // Cloud project: <ref>.supabase.co / .in / .net → the ref alone is unique.
    const cloud = host.match(/^([a-z0-9]+)\.supabase\.(co|in|net)$/)
    if (cloud) return cloud[1]
    // Local / self-hosted: host + port, sanitized (e.g. 127-0-0-1-54321).
    return `${host}${u.port ? '-' + u.port : ''}`.replace(/[^a-z0-9]+/g, '-') || 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * '' in production builds (stable bare names — never orphan a prod user's local
 * stores, incl. the non-recoverable Signal identity keys); '-<ref>' otherwise,
 * isolating each Supabase backend a dev session points at.
 */
const ENV_SUFFIX = import.meta.env.PROD
  ? ''
  : `-${deriveRef((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '')}`

/**
 * Map a base IndexedDB database name to its environment-scoped name. Every IDB
 * open/delete in the app MUST route a base name through this so dev and prod
 * (and distinct dev backends) never share a database on the same origin.
 */
export function dbName(base: string): string {
  return base + ENV_SUFFIX
}
