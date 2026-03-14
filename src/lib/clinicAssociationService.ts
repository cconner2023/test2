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
  status: 'pending' | 'redeemed' | 'accepted' | 'revoked' | 'expired'
  peer_clinic_id: string | null
  peer_clinic_name: string | null
  accepted_by: string | null
  is_emergency: boolean
  emergency_justification: string | null
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

/** Approve a redeemed invite to finalize the clinic association. */
export async function approveInvite(
  inviteId: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('approve_clinic_invite', {
      p_invite_id: inviteId,
    })

    if (error) {
      logger.error('Failed to approve invite:', error.message)
      return fail(error.message)
    }

    return succeed()
  } catch (error) {
    const msg = rpcError(error)
    logger.error('Failed to approve invite:', msg)
    return fail(msg)
  }
}

/** Reject a redeemed invite, declining the association request. */
export async function rejectInvite(
  inviteId: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('reject_clinic_invite', {
      p_invite_id: inviteId,
    })

    if (error) {
      logger.error('Failed to reject invite:', error.message)
      return fail(error.message)
    }

    return succeed()
  } catch (error) {
    const msg = rpcError(error)
    logger.error('Failed to reject invite:', msg)
    return fail(msg)
  }
}

/** Emergency association — bypasses the invite flow with a justification. */
export async function emergencyAssociate(
  peerClinicId: string,
  justification: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('emergency_associate_clinic', {
      p_peer_clinic_id: peerClinicId,
      p_justification: justification,
    })

    if (error) {
      logger.error('Failed to create emergency association:', error.message)
      return fail(error.message)
    }

    return succeed()
  } catch (error) {
    const msg = rpcError(error)
    logger.error('Failed to create emergency association:', msg)
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
      status: row.status as ClinicInvite['status'],
      peer_clinic_id: (row.peer_clinic_id as string) ?? null,
      peer_clinic_name: (row.peer_clinic_name as string) ?? null,
      accepted_by: (row.accepted_by as string) ?? null,
      is_emergency: row.is_emergency as boolean,
      emergency_justification: (row.emergency_justification as string) ?? null,
      created_at: row.created_at as string,
    }))

    return succeed({ invites })
  } catch (error) {
    const msg = rpcError(error)
    logger.error('Failed to fetch invites:', msg)
    return fail(msg)
  }
}
