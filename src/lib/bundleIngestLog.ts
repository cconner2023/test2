/**
 * Device-local idempotency log for ingested shared bundles. Remembers which
 * bundle content-hashes this device has already materialized so re-tapping Add
 * (or a re-render after sync) shows "Added" instead of creating a duplicate.
 * localStorage so it survives reload on this device. Shared by every bundle
 * card kind (calendar/overlay object bundles + note-blocks config bundles).
 */

const INGEST_KEY = 'beacon_ingested_bundles_v1'
const INGEST_CAP = 500

export function loadIngested(): Set<string> {
  try {
    const raw = localStorage.getItem(INGEST_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function markIngested(hash: string): void {
  try {
    const list = [...loadIngested(), hash].slice(-INGEST_CAP)
    localStorage.setItem(INGEST_KEY, JSON.stringify(list))
  } catch {
    /* best-effort */
  }
}
