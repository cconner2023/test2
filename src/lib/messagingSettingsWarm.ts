/**
 * Messaging-settings warm cache.
 *
 * The messaging settings popover (Outside-contact card + on-call roster) lives
 * inside PreviewOverlay, which UNMOUNTS its subtree when closed. So every time
 * the gear is tapped the settings components mount fresh and fire their reads —
 * `getEventIntakeCredential`, `getOutsideContactStatus`, and the `clinics.oncall`
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
import { getEventIntakeCredential, type IntakeCredentialMetadata } from './eventIntakeService'
import { getOutsideContactStatus } from './oncallService'

interface WarmEntry {
  credential?: IntakeCredentialMetadata | null
  outsideContactOn?: boolean
  roster?: string[]
}

const cache = new Map<string, WarmEntry>()
const inflight = new Map<string, Promise<void>>()

// `undefined` return = cache miss (never warmed). `null` credential = warmed,
// no credential exists. Callers distinguish the two to decide loud vs silent load.
export function getWarmCredential(clinicId: string | null): IntakeCredentialMetadata | null | undefined {
  return clinicId ? cache.get(clinicId)?.credential : undefined
}
export function getWarmOutsideContactOn(clinicId: string | null): boolean | undefined {
  return clinicId ? cache.get(clinicId)?.outsideContactOn : undefined
}
export function getWarmRoster(clinicId: string | null): string[] | undefined {
  return clinicId ? cache.get(clinicId)?.roster : undefined
}

// Write-throughs so the live components keep the cache fresh after their own
// fetches/optimistic toggles — the next open stays warm and correct.
export function setWarmCredential(clinicId: string, credential: IntakeCredentialMetadata | null): void {
  cache.set(clinicId, { ...cache.get(clinicId), credential })
}
export function setWarmOutsideContactOn(clinicId: string, on: boolean): void {
  cache.set(clinicId, { ...cache.get(clinicId), outsideContactOn: on })
}
export function setWarmRoster(clinicId: string, roster: string[]): void {
  cache.set(clinicId, { ...cache.get(clinicId), roster })
}

/**
 * Fire the settings reads ahead of time. `includeCredential` gates the
 * supervisor-only Outside-contact fetch so non-supervisors don't make (and log)
 * a wasted RPC. In-flight requests are deduped per clinic.
 */
export function prewarmMessagingSettings(clinicId: string | null, includeCredential: boolean): Promise<void> {
  if (!clinicId) return Promise.resolve()
  const existing = inflight.get(clinicId)
  if (existing) return existing
  const p = (async () => {
    const [statusRes, rosterRes, credRes] = await Promise.all([
      getOutsideContactStatus(clinicId),
      supabase.from('clinics').select('oncall').eq('id', clinicId).maybeSingle(),
      includeCredential ? getEventIntakeCredential(clinicId) : Promise.resolve(null),
    ])
    const entry: WarmEntry = { ...cache.get(clinicId) }
    if (statusRes.ok) entry.outsideContactOn = statusRes.data.oncall_enabled || statusRes.data.outside_message_enabled
    entry.roster = ((rosterRes.data as { oncall?: string[] } | null)?.oncall) ?? entry.roster ?? []
    if (credRes && credRes.ok) entry.credential = credRes.data
    cache.set(clinicId, entry)
  })().finally(() => { inflight.delete(clinicId) })
  inflight.set(clinicId, p)
  return p
}
