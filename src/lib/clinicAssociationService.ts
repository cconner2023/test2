/**
 * Clinic Association Service
 *
 * Handles clinic-to-clinic invite workflows: generating invite codes,
 * redeeming them, approving/rejecting pending invites, and emergency
 * association for urgent cross-clinic coordination.
 *
 * All operations go through Supabase RPCs — no direct table access.
 */

import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { succeed, fail, type ServiceResult } from './result'

const logger = createLogger('ClinicAssociation')

export interface ClinicInvite {
  id: string
  code: string
  clinic_id: string
  clinic_name: string
  created_by: string
  expires_at: string
  clinic_fingerprint: string | null
  created_at: string
}

function rpcError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as { message: string }).message
  }
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown error'
}

/** Generate a new clinic invite code with a configurable expiration window. */
export async function generateInvite(
  expiresHours = 24
): Promise<ServiceResult<{ code: string; expiresAt: string; inviteId: string }>> {
  try {
    const { data, error } = await supabase.rpc('generate_clinic_invite', {
      p_expires_hours: expiresHours,
    })

    if (error) {
      logger.error('Failed to generate invite:', error.message)
      return fail(error.message)
    }

    return succeed({
      code: data.code,
      expiresAt: data.expires_at,
      inviteId: data.id,
    })
  } catch (error) {
    const msg = rpcError(error)
    logger.error('Failed to generate invite:', msg)
    return fail(msg)
  }
}

/** Redeem an invite code to initiate a clinic association. */
export async function redeemInvite(
  code: string
): Promise<ServiceResult<{ inviteId: string; clinicName: string }>> {
  try {
    const { data, error } = await supabase.rpc('redeem_clinic_invite', {
      p_code: code.toUpperCase().trim(),
    })

    if (error) {
      logger.error('Failed to redeem invite:', error.message)
      return fail(error.message)
    }

    return succeed({
      inviteId: data.invite_id,
      clinicName: data.clinic_name,
    })
  } catch (error) {
    const msg = rpcError(error)
    logger.error('Failed to redeem invite:', msg)
    return fail(msg)
  }
}

/**
 * Fetch the freshest pending invite code for a clinic the caller is already
 * associated with. Returns null if no active code exists; fails if the
 * association gate rejects.
 */
export async function getAssociatedClinicCode(
  clinicId: string,
): Promise<ServiceResult<{ code: string | null }>> {
  try {
    const { data, error } = await supabase.rpc('get_associated_clinic_code', {
      p_clinic_id: clinicId,
    })

    if (error) {
      logger.error('Failed to fetch associated clinic code:', error.message)
      return fail(error.message)
    }

    return succeed({ code: (data as string | null) ?? null })
  } catch (error) {
    const msg = rpcError(error)
    logger.error('Failed to fetch associated clinic code:', msg)
    return fail(msg)
  }
}

/** Fetch all clinic invites (sent and received) for the current clinic. */
export async function getInvites(): Promise<ServiceResult<{ invites: ClinicInvite[] }>> {
  try {
    const { data, error } = await supabase.rpc('get_clinic_invites')

    if (error) {
      logger.error('Failed to fetch invites:', error.message)
      return fail(error.message)
    }

    const rows = Array.isArray(data) ? data : (data as ClinicInvite[]) ?? []
    const invites: ClinicInvite[] = (rows as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      code: row.code as string,
      clinic_id: row.clinic_id as string,
      clinic_name: (row.origin_clinic_name as string) ?? '',
      created_by: row.created_by as string,
      expires_at: row.expires_at as string,
      clinic_fingerprint: (row.clinic_fingerprint as string) ?? null,
      created_at: row.created_at as string,
    }))

    return succeed({ invites })
  } catch (error) {
    const msg = rpcError(error)
    logger.error('Failed to fetch invites:', msg)
    return fail(msg)
  }
}
