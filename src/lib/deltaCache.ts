/**
 * deltaCache — generic high-water-mark delta read cache.
 *
 * The egress discipline distilled from listLocations (src/lib/adminService.ts),
 * made table-agnostic: fetch each row AT MOST ONCE, then serve from a local base
 * and reconcile with a DELTA keyed on `updated_at` so an idle revalidate transfers
 * nothing. This is the tier-2 read pattern (see v2/conventions egress drawer):
 * steady-state read egress collapses to "the rows that actually changed".
 *
 * INVARIANT — soft-delete only. A hard delete cannot flow through an updated_at
 * delta (the row simply stops appearing in `.gt(updated_at)` results, so every
 * other reader keeps it forever). Any table on this path MUST soft-delete by
 * stamping `archived_at`; the tombstone rides the delta and is dropped here.
 *
 * Layers per cache key: memory snapshot → persisted base (loadBase/saveBase) →
 * cold full fetch. Concurrent callers share one in-flight reconcile. Persisted
 * bases are stale-while-revalidate: a stale base is served instantly and
 * refreshed in the background once past the TTL.
 *
 * Persistence is pluggable (loadBase/saveBase). localStorageBase() is provided for
 * small sets (mirrors locations); tables with an existing IDB store can supply
 * IDB-backed callbacks instead.
 */

/** Minimum shape the delta query must return: an id, the cursor, and the tombstone. */
export interface DeltaRow {
  id: string
  updated_at: string
  archived_at?: string | null
}

export interface PersistedBase<TRow> {
  rows: TRow[]
  hwm: string | null
  /** True when the persisted set is past its TTL and should be background-revalidated. */
  stale: boolean
}

export interface DeltaCacheConfig<TRow extends { id: string }, TDelta extends DeltaRow> {
  /** Stable cache key. MUST embed any scoping id (userId/clinicId) for per-scope data. */
  key: string
  /** Load the persisted base for this key. null on miss. */
  loadBase: (key: string) => Promise<PersistedBase<TRow> | null>
  /** Persist the merged base + cursor for this key. */
  saveBase: (key: string, rows: TRow[], hwm: string | null) => Promise<void>
  /**
   * Rows changed since `since`. `since === null` is the COLD fallback — return the
   * full live set with archived rows EXCLUDED. When `since` is set you MUST include
   * archived rows so removals propagate to clients.
   */
  fetchDelta: (since: string | null) => Promise<TDelta[]>
  /** Strip delta-only fields (archived_at, …) down to the stored row shape. */
  toRow: (delta: TDelta) => TRow
  /**
   * Optional warm-memory freshness window (ms). When set, a memory-warm read past
   * this age serves the cached rows instantly AND kicks a background delta — the
   * in-memory analogue of the persisted SWR TTL. Omit for data the owning device
   * keeps fresh itself via revalidateDeltaCache on mutation (e.g. self-owned rows);
   * set it for monitoring views that must catch others' writes within a session.
   */
  memTtlMs?: number
}

interface Entry<TRow> {
  rows: TRow[]
  hwm: string | null
  /** True once the entry holds real data (distinguishes "loaded empty" from "cold"). */
  warm: boolean
  /** When rows were last set (epoch ms) — drives memTtlMs background revalidation. */
  ts: number
  inflight: Promise<TRow[]> | null
}

// Module-level memory cache, keyed by cfg.key. Survives component remounts.
const mem = new Map<string, Entry<unknown>>()

function getEntry<TRow>(key: string): Entry<TRow> | undefined {
  return mem.get(key) as Entry<TRow> | undefined
}

/** Merge a delta into a base keyed by id: upsert live rows, drop archived, advance hwm. */
function applyDelta<TRow extends { id: string }, TDelta extends DeltaRow>(
  base: TRow[],
  delta: TDelta[],
  baseHwm: string | null,
  toRow: (d: TDelta) => TRow,
): { rows: TRow[]; hwm: string | null } {
  const map = new Map(base.map((r) => [r.id, r]))
  let hwm = baseHwm
  for (const row of delta) {
    if (row.archived_at) map.delete(row.id)
    else map.set(row.id, toRow(row))
    if (!hwm || row.updated_at > hwm) hwm = row.updated_at
  }
  return { rows: [...map.values()], hwm }
}

/** Establish a base (memory → persisted), apply the delta, persist. Serves the
 *  stale base on network failure (offline-safe). Concurrent callers share it. */
function reconcile<TRow extends { id: string }, TDelta extends DeltaRow>(
  cfg: DeltaCacheConfig<TRow, TDelta>,
): Promise<TRow[]> {
  const existing = getEntry<TRow>(cfg.key)
  if (existing?.inflight) return existing.inflight

  const inflight = (async (): Promise<TRow[]> => {
    try {
      let base = existing?.warm ? existing.rows : null
      let hwm = existing?.warm ? existing.hwm : null
      if (!base) {
        const persisted = await cfg.loadBase(cfg.key)
        if (persisted) {
          base = persisted.rows
          hwm = persisted.hwm
        }
      }
      // No base ⇒ no cursor: cold fallback pulls the full live set.
      const delta = await cfg.fetchDelta(base ? hwm : null)
      const merged = applyDelta(base ?? [], delta, hwm, cfg.toRow)
      mem.set(cfg.key, { rows: merged.rows, hwm: merged.hwm, warm: true, ts: Date.now(), inflight: null })
      await cfg.saveBase(cfg.key, merged.rows, merged.hwm)
      return merged.rows
    } catch {
      // Serve what we have; next call retries.
      const cur = getEntry<TRow>(cfg.key)
      if (cur) cur.inflight = null
      return existing?.rows ?? []
    }
  })()

  mem.set(cfg.key, {
    rows: existing?.rows ?? [],
    hwm: existing?.hwm ?? null,
    warm: existing?.warm ?? false,
    ts: existing?.ts ?? 0,
    inflight,
  })
  return inflight
}

/**
 * Cache-first read. Memory-warm → return instantly (zero network). Else load the
 * persisted base and serve it (revalidating in the background only past the TTL).
 * Cold (no base) → one blocking reconcile. Result order is insertion order — sort
 * at the call site if the public contract requires it.
 */
export async function deltaRead<TRow extends { id: string }, TDelta extends DeltaRow>(
  cfg: DeltaCacheConfig<TRow, TDelta>,
): Promise<TRow[]> {
  const entry = getEntry<TRow>(cfg.key)
  if (entry?.warm && !entry.inflight) {
    // Warm memory serves instantly. If a freshness window is set and we're past it,
    // kick a background delta (dedup-guarded inside reconcile) — return cached now.
    if (cfg.memTtlMs != null && Date.now() - entry.ts > cfg.memTtlMs) void reconcile(cfg)
    return entry.rows
  }
  if (entry?.inflight) return entry.inflight

  const persisted = await cfg.loadBase(cfg.key)
  if (persisted) {
    mem.set(cfg.key, { rows: persisted.rows, hwm: persisted.hwm, warm: true, ts: Date.now(), inflight: null })
    if (persisted.stale) void reconcile(cfg)
    return persisted.rows
  }
  return reconcile(cfg)
}

/**
 * Force a fresh delta-since-hwm without wiping the base — the EDITING device sees
 * its own write immediately (the delta returns exactly the changed row/tombstone).
 * Call after a mutation. Cheap: it's a delta, not a cold refetch.
 */
export function revalidateDeltaCache<TRow extends { id: string }, TDelta extends DeltaRow>(
  cfg: DeltaCacheConfig<TRow, TDelta>,
): Promise<TRow[]> {
  const entry = getEntry<TRow>(cfg.key)
  if (entry) entry.inflight = null
  return reconcile(cfg)
}

/** Drop the memory snapshot for a key (forces a persisted-base reload on next read). */
export function invalidateDeltaCache(key: string): void {
  mem.delete(key)
}

/** Drop every memory snapshot whose key starts with `prefix` (e.g. 'cert:'). Pair
 *  with the persistence layer's clearAll() to force a fresh cold fetch on next read —
 *  used after a mutation that can't target a single key (no scope id in hand). */
export function invalidateDeltaCacheByPrefix(prefix: string): void {
  for (const key of [...mem.keys()]) {
    if (key.startsWith(prefix)) mem.delete(key)
  }
}

/**
 * localStorage-backed persistence for small sets (mirrors listLocations). Returns
 * loadBase/saveBase plus a clearBase for full invalidation. Full key is
 * `${lsKeyPrefix}:${cacheKey}` so one prefix can scope many per-user/clinic keys.
 */
export function localStorageBase<TRow>(lsKeyPrefix: string, ttlMs: number) {
  const lsKey = (key: string) => `${lsKeyPrefix}:${key}`
  return {
    loadBase: async (key: string): Promise<PersistedBase<TRow> | null> => {
      try {
        const raw = localStorage.getItem(lsKey(key))
        if (!raw) return null
        const p = JSON.parse(raw) as { ts: number; rows: TRow[]; hwm: string | null }
        if (!p || !Array.isArray(p.rows)) return null
        return { rows: p.rows, hwm: p.hwm ?? null, stale: Date.now() - p.ts > ttlMs }
      } catch {
        return null
      }
    },
    saveBase: async (key: string, rows: TRow[], hwm: string | null): Promise<void> => {
      try {
        localStorage.setItem(lsKey(key), JSON.stringify({ ts: Date.now(), rows, hwm }))
      } catch {
        // Quota/private-mode — best effort; the in-memory cache still applies.
      }
    },
    clearBase: (key: string): void => {
      try {
        localStorage.removeItem(lsKey(key))
      } catch {
        /* ignore */
      }
    },
    /** Remove every persisted entry under this prefix (all keys for this table). */
    clearAll: (): void => {
      try {
        const p = `${lsKeyPrefix}:`
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i)
          if (k && k.startsWith(p)) localStorage.removeItem(k)
        }
      } catch {
        /* ignore */
      }
    },
  }
}
