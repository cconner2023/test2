/**
 * echelonVault — child→parent readiness-summary fan-out via the Signal clinic
 * vault. Non-hook module (callable from the activity heartbeat). Mirrors
 * propertyVault.sendPropertyEvent / useCalendarVault.sendEvent: the summary is
 * sealed once per PARENT-clinic device (the vault peer + each parent member's
 * clinic device) using the parent's PUBLIC bundle — no membership in the parent
 * vault and no shared key, the same no-transport-barrier the cross-cluster
 * calendar/loan fan-out established.
 *
 * DOWNTRACE TRIGGER: the CHILD computes and fans on its own activity heartbeat.
 * recipient_id = the parent clinic id, so the parent reads it from its OWN vault
 * (parent clinic id ∈ the parent's auth_clinic_ids) — the parent never reads
 * another cluster's messages. One echelon hop per publish (child → its parent).
 *
 * NO PHI: the payload is EchelonReadinessSummary (percentages + counts only).
 * Signal fns are called IN A LOOP only — this is not a signal/* refactor.
 */

import { supabase } from './supabase'
import { useMessagingStore } from '../stores/useMessagingStore'
import { createLogger } from '../Utilities/Logger'
import { computeReadinessSummary } from './echelonService'
import { summaryValueKey, type EchelonReadinessSummary } from './echelonSummary'
import { serializeContent } from './signal/messageContent'
import type { ReadinessSummaryContent } from './signal/messageContent'
import { fanOutToClinics } from './clinicFanOut'

const logger = createLogger('echelonVault')

/** localStorage key holding the last-fanned summaryValueKey for a source clinic. */
const lastFanKey = (clinicId: string) => `adtmc_echelon_last_fan_${clinicId}`

/**
 * Fan one readiness summary to the parent clinic vault. Returns true if any
 * envelope was sent. Best-effort: offline / no parent devices / no local clinic
 * device → returns false and the caller leaves the change-detect memo untouched
 * so the next tick retries.
 */
export async function fanReadinessSummary(
  userId: string,
  parentClinicId: string,
  summary: EchelonReadinessSummary,
): Promise<boolean> {
  const clinicDeviceId = useMessagingStore.getState().clinicDeviceId
  if (!clinicDeviceId) return false

  const content: ReadinessSummaryContent = { type: 'readiness_summary', data: summary }
  const serialized = serializeContent(content)
  const originId = crypto.randomUUID()

  const { landed } = await fanOutToClinics(userId, clinicDeviceId, [parentClinicId], serialized, originId, 'readiness summary')
  return landed.length > 0
}

/**
 * Full publish path for a child clinic (the heartbeat entry point):
 *   1. look up the clinic's parent (cached) — none → skip (top of tree)
 *   1b. recompute gate — computed within RECOMPUTE_GATE_MS → skip
 *   2. computeReadinessSummary — null (no active users) → skip
 *   3. change-detect vs the last-fanned value key — unchanged → skip the fan
 *   4. fan to the parent vault; memo the value key only on a confirmed send
 *
 * Fire-and-forget; every failure path is a silent skip that retries next tick.
 */
// Both gates exist because the heartbeat calls this every beat, and the parent
// lookup plus the recompute (medics, certifications, read_audit) were 4+ reads a
// beat per clinic even when the fan was skipped. Readiness moves on a scale of
// hours, so a 30-min recompute is ample. A re-parented clinic is picked up
// within PARENT_TTL_MS.
const PARENT_TTL_MS = 6 * 60 * 60 * 1000
const RECOMPUTE_GATE_MS = 30 * 60 * 1000
const parentKey = (clinicId: string) => `echelon:parent:${clinicId}`
const computedAtKey = (clinicId: string) => `echelon:computedAt:${clinicId}`

/** Parent clinic id ('' = top of tree), cached in localStorage for PARENT_TTL_MS.
 *  null = lookup failed (not cached, retried next beat). */
async function getParentClinicId(clinicId: string): Promise<string | null> {
  try {
    const cached = JSON.parse(localStorage.getItem(parentKey(clinicId)) ?? 'null') as { id: string; at: number } | null
    if (cached && Date.now() - cached.at < PARENT_TTL_MS) return cached.id
  } catch { /* corrupt, refetch */ }
  const { data, error } = await supabase
    .from('clinics')
    .select('parent_clinic_id')
    .eq('id', clinicId)
    .single()
  if (error) return null
  const id = (data?.parent_clinic_id as string | null) ?? ''
  try { localStorage.setItem(parentKey(clinicId), JSON.stringify({ id, at: Date.now() })) } catch { /* ignore */ }
  return id
}

export async function publishReadinessSummary(userId: string, ownClinicId: string): Promise<void> {
  try {
    const parentClinicId = await getParentClinicId(ownClinicId)
    if (!parentClinicId) return

    const lastComputed = Number(localStorage.getItem(computedAtKey(ownClinicId)))
    if (Number.isFinite(lastComputed) && Date.now() - lastComputed < RECOMPUTE_GATE_MS) return

    const summary = await computeReadinessSummary(ownClinicId, parentClinicId)
    if (!summary) {
      localStorage.setItem(computedAtKey(ownClinicId), String(Date.now()))
      return
    }

    const key = summaryValueKey(summary)
    if (localStorage.getItem(lastFanKey(ownClinicId)) === key) {
      localStorage.setItem(computedAtKey(ownClinicId), String(Date.now()))
      return
    }

    const sent = await fanReadinessSummary(userId, parentClinicId, summary)
    // Gate only after a settled outcome, so a failed fan retries next beat.
    if (sent) {
      localStorage.setItem(lastFanKey(ownClinicId), key)
      localStorage.setItem(computedAtKey(ownClinicId), String(Date.now()))
    }
  } catch (e) {
    logger.warn('publishReadinessSummary threw:', e instanceof Error ? e.message : e)
  }
}
