import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { fromSupabase, succeed, fail, type ServiceResult } from './result'
import { getErrorMessage } from '../Utilities/errorUtils'
import type { Certification } from '../Data/User'

const logger = createLogger('CertificationService')

export type CertInput = {
  title: string
  cert_number?: string | null
  issue_date?: string | null
  exp_date?: string | null
  is_primary?: boolean
}

/**
 * Fetch all certifications for a user, ordered by is_primary desc, created_at desc.
 */
export async function fetchCertifications(userId: string): Promise<Certification[]> {
  try {
    const result = fromSupabase<Certification[]>(
      await supabase
        .from('certifications')
        .select('*')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })
    )
    if (!result.ok) {
      logger.error('Failed to fetch certifications:', result.error)
      return []
    }
    return result.data
  } catch (error) {
    logger.error('Failed to fetch certifications:', error)
    return []
  }
}

/**
 * Sync all primary cert titles to profiles.credential as a joined string.
 */
export async function syncPrimaryToProfile(userId: string): Promise<void> {
  const certs = await fetchCertifications(userId)
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
    const { error } = await supabase
      .from('certifications')
      .delete()
      .eq('id', certId)
      .eq('user_id', userId)

    if (error) return fail(error.message)

    if (wasPrimary) {
      await syncPrimaryToProfile(userId)
    }

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
    const result = fromSupabase<Certification[]>(
      await supabase
        .from('certifications')
        .select('*')
        .in('user_id', clinicUserIds)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })
    )
    if (!result.ok) {
      logger.error('Failed to fetch clinic certifications:', result.error)
      return []
    }
    return result.data
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
    const result = fromSupabase<Certification[]>(
      await supabase
        .from('certifications')
        .select('*')
        .order('user_id')
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })
    )
    if (!result.ok) {
      logger.error('Failed to fetch all certifications:', result.error)
      return []
    }
    return result.data
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
    const { error } = await supabase
      .from('certifications')
      .delete()
      .eq('id', certId)

    if (error) return fail(error.message)

    if (wasPrimary) {
      await syncPrimaryToProfile(userId)
    }

    return succeed()
  } catch (error) {
    logger.error('Failed to admin-delete certification:', error)
    return fail(getErrorMessage(error, 'Failed to delete certification'))
  }
}
