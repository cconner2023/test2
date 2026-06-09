import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { fromSupabase, succeed, fail, type ServiceResult } from './result'
import { getErrorMessage } from '../Utilities/errorUtils'
import { deltaRead, invalidateDeltaCacheByPrefix, localStorageBase, type DeltaCacheConfig } from './deltaCache'
import type { Certification } from '../Data/User'

const logger = createLogger('CertificationService')

export type CertInput = {
  title: string
  cert_number?: string | null
  issue_date?: string | null
  exp_date?: string | null
  is_primary?: boolean
}

// ─── Delta caches for certifications ──────────────────────────────────────────
// All cert reads are cache-first + updated_at delta so warm devices transfer
// nothing; removals propagate as archived_at tombstones. Three readers share the
// same persisted store (certBase), namespaced by key:
//   • own certs   → ownCertsCfg('cert:user:<id>')  — Settings (high frequency)
//   • admin all   → allCertsCfg('cert:all')        — dev RLS reads everyone
//   • clinic roster → composes ownCertsCfg per member (supervisor RLS, no all-read)
// Any mutation wipes the lot via clearCertCaches() — see that note for why uniform.

/** Delta row = stored cert plus the soft-delete tombstone the cache consumes. */
interface CertDeltaRow extends Certification {
  archived_at: string | null
}

/** Other devices tolerate up to 6h staleness on the cert list before a bg delta. */
const CERT_TTL_MS = 6 * 60 * 60 * 1000
const certBase = localStorageBase<Certification>('adtmc_cert_cache_v1', CERT_TTL_MS)

const stripCert = ({ archived_at: _archived, ...row }: CertDeltaRow): Certification => row as Certification

// NB: cfg.key is the GLOBAL memory-cache key (deltaCache mem Map) — namespace it
// per table ('cert:…') so it never collides with another table's key (e.g. feedback's).
function ownCertsCfg(userId: string): DeltaCacheConfig<Certification, CertDeltaRow> {
  return {
    key: `cert:user:${userId}`,
    loadBase: certBase.loadBase,
    saveBase: certBase.saveBase,
    fetchDelta: async (since) => {
      // since!==null → include archived rows so removals propagate; cold → live only.
      let q = supabase.from('certifications').select('*').eq('user_id', userId).order('updated_at')
      q = since ? q.gt('updated_at', since) : q.is('archived_at', null)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as CertDeltaRow[]
    },
    toRow: stripCert,
  }
}

/** Admin/dev global cache: ALL users' certs in one delta (RLS lets dev read all).
 *  Supervisors can't read all → fetchClinicCertifications composes per-user caches
 *  instead. memTtlMs keeps the admin roster fresh within a session. */
const allCertsCfg: DeltaCacheConfig<Certification, CertDeltaRow> = {
  key: 'cert:all',
  loadBase: certBase.loadBase,
  saveBase: certBase.saveBase,
  fetchDelta: async (since) => {
    let q = supabase.from('certifications').select('*').order('updated_at')
    q = since ? q.gt('updated_at', since) : q.is('archived_at', null)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as unknown as CertDeltaRow[]
  },
  toRow: stripCert,
  memTtlMs: 60 * 1000,
}

const sortCerts = (rows: Certification[]): Certification[] =>
  [...rows].sort(
    (a, b) =>
      Number(b.is_primary) - Number(a.is_primary) || b.created_at.localeCompare(a.created_at)
  )

/**
 * Wipe all cert caches (memory + persisted) after any mutation. Uniform + bulletproof:
 * some mutations (updateCertification/verify) carry only certId, so they can't target a
 * single per-user key. The next read (components reload after mutating) cold-fetches
 * fresh. Mutations only succeed online, so the cold reconcile won't hit an offline hole.
 * Cheap: cert sets are small and edits are infrequent vs. the repeat reads being cached.
 */
function clearCertCaches(): void {
  invalidateDeltaCacheByPrefix('cert:')
  certBase.clearAll()
}

/** Authoritative, uncached read for write-side consistency (credential sync). */
async function fetchCertsFromDb(userId: string): Promise<Certification[]> {
  const result = fromSupabase<Certification[]>(
    await supabase
      .from('certifications')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })
  )
  return result.ok ? result.data : []
}

/**
 * Fetch all certifications for a user, ordered by is_primary desc, created_at desc.
 */
export async function fetchCertifications(userId: string): Promise<Certification[]> {
  try {
    // Cache-first + delta. Cache holds insertion order; restore the public sort.
    return sortCerts(await deltaRead(ownCertsCfg(userId)))
  } catch (error) {
    logger.error('Failed to fetch certifications:', error)
    return []
  }
}

/**
 * Sync all primary cert titles to profiles.credential as a joined string.
 */
export async function syncPrimaryToProfile(userId: string): Promise<void> {
  // Read authoritative DB state, not the cache — the credential must reflect the
  // just-written rows exactly.
  const certs = await fetchCertsFromDb(userId)
  const primaryTitles = certs
    .filter(c => c.is_primary)
    .map(c => c.title)
  const joined = primaryTitles.join(', ') || null

  const { error } = await supabase
    .from('profiles')
    .update({ credential: joined })
    .eq('id', userId)

  if (error) {
    logger.error('Failed to sync credential to profile:', error.message)
  }
}

/**
 * Add a new certification for the user.
 */
export async function addCertification(
  userId: string,
  input: CertInput
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.from('certifications').insert({
      user_id: userId,
      title: input.title.trim(),
      cert_number: input.cert_number?.trim() || null,
      issue_date: input.issue_date || null,
      exp_date: input.exp_date || null,
      is_primary: input.is_primary ?? false,
    })

    if (error) return fail(error.message)

    if (input.is_primary) {
      await syncPrimaryToProfile(userId)
    }
    clearCertCaches()

    return succeed()
  } catch (error) {
    logger.error('Failed to add certification:', error)
    return fail(getErrorMessage(error, 'Failed to add certification'))
  }
}

/**
 * Remove a certification. If it was primary, re-sync profiles.credential.
 */
export async function removeCertification(
  userId: string,
  certId: string,
  wasPrimary: boolean
): Promise<ServiceResult> {
  try {
    // Soft-delete: stamp archived_at so the tombstone rides the updated_at delta
    // and every other reader drops the row. The BEFORE UPDATE trigger bumps updated_at.
    const { error } = await supabase
      .from('certifications')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', certId)
      .eq('user_id', userId)

    if (error) return fail(error.message)

    if (wasPrimary) {
      await syncPrimaryToProfile(userId)
    }
    clearCertCaches()

    return succeed()
  } catch (error) {
    logger.error('Failed to remove certification:', error)
    return fail(getErrorMessage(error, 'Failed to remove certification'))
  }
}

/**
 * Toggle is_primary on/off for a cert, then sync all primary titles to profiles.credential.
 */
export async function togglePrimary(
  userId: string,
  certId: string,
  currentlyPrimary: boolean
): Promise<ServiceResult> {
  try {
    const { error } = await supabase
      .from('certifications')
      .update({ is_primary: !currentlyPrimary })
      .eq('id', certId)
      .eq('user_id', userId)

    if (error) return fail(error.message)

    await syncPrimaryToProfile(userId)
    clearCertCaches()
    return succeed()
  } catch (error) {
    logger.error('Failed to toggle primary:', error)
    return fail(getErrorMessage(error, 'Failed to toggle primary'))
  }
}

/**
 * Fetch certifications for multiple users (supervisor view).
 */
export async function fetchClinicCertifications(
  clinicUserIds: string[]
): Promise<Certification[]> {
  if (clinicUserIds.length === 0) return []

  try {
    // Compose from the per-user delta caches (reuses each member's own-cert cache,
    // shared with their Settings view). Warm roster = zero egress; cold = one small
    // fetch per member (vs. one bulk .in() — more requests, similar bytes, then cached).
    const perUser = await Promise.all(clinicUserIds.map((id) => deltaRead(ownCertsCfg(id))))
    return sortCerts(perUser.flat())
  } catch (error) {
    logger.error('Failed to fetch clinic certifications:', error)
    return []
  }
}

/**
 * Mark a certification as verified (supervisor action).
 */
export async function verifyCertification(
  certId: string,
  supervisorId: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase
      .from('certifications')
      .update({
        verified: true,
        verified_by: supervisorId,
        verified_at: new Date().toISOString(),
      })
      .eq('id', certId)

    if (error) return fail(error.message)
    clearCertCaches()
    return succeed()
  } catch (error) {
    logger.error('Failed to verify certification:', error)
    return fail(getErrorMessage(error, 'Failed to verify certification'))
  }
}

/**
 * Remove verification from a certification (supervisor action).
 */
export async function unverifyCertification(
  certId: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase
      .from('certifications')
      .update({
        verified: false,
        verified_by: null,
        verified_at: null,
      })
      .eq('id', certId)

    if (error) return fail(error.message)
    clearCertCaches()
    return succeed()
  } catch (error) {
    logger.error('Failed to unverify certification:', error)
    return fail(getErrorMessage(error, 'Failed to unverify certification'))
  }
}

// ─── Admin (dev) functions ────────────────────────────────────────────────

/**
 * Fetch ALL certifications across all users (dev/admin view).
 */
export async function fetchAllCertifications(): Promise<Certification[]> {
  try {
    // Cache-first global delta (dev RLS reads all). Restore the public sort:
    // grouped by user, primary first, newest first.
    const rows = await deltaRead(allCertsCfg)
    return [...rows].sort(
      (a, b) =>
        a.user_id.localeCompare(b.user_id) ||
        Number(b.is_primary) - Number(a.is_primary) ||
        b.created_at.localeCompare(a.created_at)
    )
  } catch (error) {
    logger.error('Failed to fetch all certifications:', error)
    return []
  }
}

/**
 * Update a certification's editable fields (admin action).
 */
export async function updateCertification(
  certId: string,
  fields: Partial<CertInput>
): Promise<ServiceResult> {
  try {
    const update: Record<string, unknown> = {}
    if (fields.title !== undefined) update.title = fields.title.trim()
    if (fields.cert_number !== undefined) update.cert_number = fields.cert_number?.trim() || null
    if (fields.issue_date !== undefined) update.issue_date = fields.issue_date || null
    if (fields.exp_date !== undefined) update.exp_date = fields.exp_date || null
    if (fields.is_primary !== undefined) update.is_primary = fields.is_primary

    const { error } = await supabase
      .from('certifications')
      .update(update)
      .eq('id', certId)

    if (error) return fail(error.message)
    clearCertCaches()
    return succeed()
  } catch (error) {
    logger.error('Failed to update certification:', error)
    return fail(getErrorMessage(error, 'Failed to update certification'))
  }
}

/**
 * Admin: add a certification for any user.
 */
export async function adminAddCertification(
  userId: string,
  input: CertInput
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.from('certifications').insert({
      user_id: userId,
      title: input.title.trim(),
      cert_number: input.cert_number?.trim() || null,
      issue_date: input.issue_date || null,
      exp_date: input.exp_date || null,
      is_primary: input.is_primary ?? false,
    })

    if (error) return fail(error.message)

    if (input.is_primary) {
      await syncPrimaryToProfile(userId)
    }
    clearCertCaches()

    return succeed()
  } catch (error) {
    logger.error('Failed to admin-add certification:', error)
    return fail(getErrorMessage(error, 'Failed to add certification'))
  }
}

/**
 * Admin: delete any certification by ID. Re-syncs profile if was primary.
 */
export async function adminDeleteCertification(
  certId: string,
  userId: string,
  wasPrimary: boolean
): Promise<ServiceResult> {
  try {
    // Soft-delete (see removeCertification) so the removal propagates via the delta.
    const { error } = await supabase
      .from('certifications')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', certId)

    if (error) return fail(error.message)

    if (wasPrimary) {
      await syncPrimaryToProfile(userId)
    }
    clearCertCaches()

    return succeed()
  } catch (error) {
    logger.error('Failed to admin-delete certification:', error)
    return fail(getErrorMessage(error, 'Failed to delete certification'))
  }
}
