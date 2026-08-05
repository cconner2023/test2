/**
 * Messaging-settings warm cache.
 *
 * The messaging settings popover (Outside-contact card + on-call roster) lives
 * inside PreviewOverlay, which UNMOUNTS its subtree when closed. So every time
 * the gear is tapped the settings components mount fresh and fire their reads —
 * `listIntakeLines`, `listLineOncallRosters`, and the `clinics.oncall`
 * select — leaving the card blank (`if (loading) return null`) for a frame.
 *
 * This module pre-fetches those three values the moment the messaging drawer
 * mounts (well before the gear is reachable) into a per-clinic module cache.
 * The settings components seed their initial state from the cache (sync read),
 * so a warm open paints immediately and the on-mount fetch merely reconciles in
 * the background. Mirrors the module-cache-by-clinic-id pattern in
 * useLoanClinicContent.
 */
import { supabase } from './supabase'
import { listIntakeLines, type IntakeLine } from './eventIntakeService'
import { listLineOncallRosters, type LineOncallSummary } from './oncallService'

interface WarmEntry {
  lines?: IntakeLine[] | null
  /** Per-line duty counts — membership-gated, so warmed for every member, not just
   *  supervisors. Also answers "is any outside channel live", which is what decides
   *  whether the on-call surface renders at all. */
  lineRosters?: LineOncallSummary[]
  roster?: string[]
  /** When prewarm last hit the wire for this clinic (TTL gate). */
  warmedAt?: number
}

const cache = new Map<string, WarmEntry>()
const inflight = new Map<string, Promise<void>>()

// On-call presence is Tier-3 (live-ish), but the messaging drawer re-mounts and
// re-prewarms on EVERY open — the hottest surface in a comms app. A short TTL
// collapses rapid reopen/close churn (each open re-issued clinics.select('oncall')
// + the status RPC) while presence stays current within the window.
const WARM_TTL_MS = 45_000

// `undefined` return = cache miss (never warmed). An empty array = warmed, the
// cluster has no lines. Callers distinguish the two to decide loud vs silent load.
export function getWarmLines(clinicId: string | null): IntakeLine[] | null | undefined {
  return clinicId ? cache.get(clinicId)?.lines : undefined
}
export function getWarmLineRosters(clinicId: string | null): LineOncallSummary[] | undefined {
  return clinicId ? cache.get(clinicId)?.lineRosters : undefined
}
export function getWarmRoster(clinicId: string | null): string[] | undefined {
  return clinicId ? cache.get(clinicId)?.roster : undefined
}

// Write-throughs so the live components keep the cache fresh after their own
// fetches/optimistic toggles — the next open stays warm and correct.
export function setWarmLines(clinicId: string, lines: IntakeLine[] | null): void {
  cache.set(clinicId, { ...cache.get(clinicId), lines })
}
export function setWarmLineRosters(clinicId: string, lineRosters: LineOncallSummary[]): void {
  cache.set(clinicId, { ...cache.get(clinicId), lineRosters })
}
export function setWarmRoster(clinicId: string, roster: string[]): void {
  cache.set(clinicId, { ...cache.get(clinicId), roster })
}

/**
 * Fire the settings reads ahead of time. `includeCredential` gates the
 * supervisor-only Outside-contact fetch so non-supervisors don't make (and log)
 * a wasted RPC. In-flight requests are deduped per clinic.
 */
export function prewarmMessagingSettings(clinicId: string | null, includeLines: boolean): Promise<void> {
  if (!clinicId) return Promise.resolve()
  const existing = inflight.get(clinicId)
  if (existing) return existing
  // Fresh within the TTL → the components already seed from the warm cache, so
  // skip the redundant reads on a quick reopen.
  const warm = cache.get(clinicId)
  if (warm?.warmedAt && Date.now() - warm.warmedAt < WARM_TTL_MS) return Promise.resolve()
  const p = (async () => {
    const [rostersRes, rosterRes, linesRes] = await Promise.all([
      listLineOncallRosters(clinicId),
      supabase.from('clinics').select('oncall').eq('id', clinicId).maybeSingle(),
      includeLines ? listIntakeLines(clinicId) : Promise.resolve(null),
    ])
    const entry: WarmEntry = { ...cache.get(clinicId) }
    if (rostersRes.ok) entry.lineRosters = rostersRes.data
    entry.roster = ((rosterRes.data as { oncall?: string[] } | null)?.oncall) ?? entry.roster ?? []
    if (linesRes && linesRes.ok) entry.lines = linesRes.data
    entry.warmedAt = Date.now()
    cache.set(clinicId, entry)
  })().finally(() => { inflight.delete(clinicId) })
  inflight.set(clinicId, p)
  return p
}
