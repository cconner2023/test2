/**
 * Feature flags for gating functionalities.
 *
 * NOTES_ENABLED: When false, all note persistence (IndexedDB, sync,
 * realtime subscriptions) is disabled. Users can still compose, preview, copy,
 * share, and export PDF — just not save/sync notes.
 */
export const NOTES_ENABLED = false;
