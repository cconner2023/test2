/**
 * Admin Service
 *
 * Handles admin operations like approving/rejecting account requests
 * and managing user roles.
 *
 * Role changes go through SECURITY DEFINER RPC functions to prevent
 * privilege escalation via direct table updates.
 */

import { supabase } from './supabase'
import { useAuthStore } from '../stores/useAuthStore'
import type { AccountRequest } from './accountRequestService'
import { createLogger } from '../Utilities/Logger'
import {
  generateClinicKeyBase64,
  encryptWithRawKey,
  decryptWithRawKey,
  encryptClinicField,
} from './cryptoService'
import { ensureClinicVaultExists } from './signal/clinicVaultDevice'
import { validatePasswordComplexity } from './constants'
import { getErrorMessage } from '../Utilities/errorUtils'
import { succeed, fail, type ServiceResult } from './result'
import { classifySupabaseError, ErrorCode } from './errorCodes'
import { validateRpcResult } from './validators'

const logger = createLogger('AdminService')

export interface AdminUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  middle_initial: string | null
  credential: string | null
  component: string | null
  rank: string | null
  uic: string | null
  roles: string[]
  clinic_id: string | null
  created_at: string
  last_active_at: string | null
  avatar_id: string | null
}

/**
 * Check if the current user has dev role
 */
export async function isDevUser(): Promise<boolean> {
  try {
    const user = useAuthStore.getState().user
    if (!user) return false

    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single()

    return profile?.roles?.includes('dev') ?? false
  } catch {
    return false
  }
}

/**
 * Get all pending account requests (dev only)
 */
export async function getAllAccountRequests(
  status?: 'pending' | 'approved' | 'rejected'
): Promise<AccountRequest[]> {
  try {
    let query = supabase
      .from('account_requests')
      .select('*')
      .order('requested_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map((row) => ({
      id: row.id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      middle_initial: row.middle_initial,
      credential: row.credential,
      rank: row.rank,
      component: row.component,
      uic: row.uic,
      status: row.status,
      request_type: row.request_type || 'new_account',
      status_check_token: row.status_check_token || null,
      user_id: row.user_id,
      requested_at: row.requested_at,
      reviewed_at: row.reviewed_at,
      rejection_reason: row.rejection_reason,
      notes: row.notes,
    }))
  } catch (error) {
    logger.error('Failed to get account requests:', error)
    return []
  }
}

/**
 * Approve an account request and create the user account.
 *
 * The user already set their password when submitting the request.
 * The RPC creates the auth user using the stored password hash.
 * The user can immediately log in with their email and password.
 */
export async function approveAccountRequest(
  requestId: string,
): Promise<ServiceResult<{ userId: string; email: string; firstName: string; lastName: string }>> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    const { data, error: approveError } = await supabase.rpc('approve_account_request', {
      request_id: requestId,
      admin_user_id: currentUser.id,
    })

    if (approveError) {
      const code = classifySupabaseError(approveError)
      if (code === ErrorCode.RATE_LIMITED) {
        return fail('Rate limited. Please try again later.')
      }
      return fail(approveError.message)
    }

    const validated = validateRpcResult<{
      user_id: string
      email: string
      first_name: string
      last_name: string
      message: string
    }>(data, ['user_id'], 'approveAccountRequest')

    if (!validated.ok) {
      return fail(validated.error ?? 'Approval succeeded but returned unexpected data')
    }

    return succeed({
      userId: validated.data.user_id,
      email: validated.data.email,
      firstName: validated.data.first_name,
      lastName: validated.data.last_name,
    })
  } catch (error) {
    logger.error('Failed to approve request:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Send the "account approved" notification email via Magic Link template.
 */
export function sendApprovalEmail(email: string): void {
  supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  }).catch((e) => logger.warn('Approval notification email failed:', e))
}

/**
 * Reject an account request.
 * The RPC function verifies the caller has dev role via auth.uid().
 */
export async function rejectAccountRequest(
  requestId: string,
  reason: string
): Promise<ServiceResult> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    const { error } = await supabase.rpc('reject_account_request', {
      request_id: requestId,
      admin_user_id: currentUser.id,
      reason,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to reject request:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Reopen a rejected account request (move back to pending).
 * Guards with .eq('status', 'rejected') to prevent stale-state corruption.
 */
export async function reopenAccountRequest(
  requestId: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase
      .from('account_requests')
      .update({
        status: 'pending',
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: null,
      })
      .eq('id', requestId)
      .eq('status', 'rejected')

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to reopen request:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Permanently delete an account request.
 */
export async function deleteAccountRequest(
  requestId: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase
      .from('account_requests')
      .delete()
      .eq('id', requestId)

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to delete account request:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Get user's roles
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', userId)
      .single()

    return data?.roles || []
  } catch {
    return []
  }
}

/**
 * Set all roles for a user in a single RPC call.
 * The RPC verifies the caller has dev role — prevents self-escalation.
 */
export async function setUserRoles(
  userId: string,
  roles: ('medic' | 'supervisor' | 'dev' | 'provider')[]
): Promise<ServiceResult> {
  try {
    const { error } = await supabase.rpc('set_user_roles', {
      target_user_id: userId,
      new_roles: roles,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    return fail(getErrorMessage(error))
  }
}

/**
 * Add a role to a user via SECURITY DEFINER RPC function.
 * The RPC verifies the caller has dev role — prevents self-escalation.
 */
export async function addUserRole(
  userId: string,
  role: 'medic' | 'supervisor' | 'dev' | 'provider'
): Promise<ServiceResult> {
  try {
    const currentRoles = await getUserRoles(userId)

    if (currentRoles.includes(role)) return succeed()

    const newRoles = [...currentRoles, role] as ('medic' | 'supervisor' | 'dev' | 'provider')[]

    const { error } = await supabase.rpc('set_user_roles', {
      target_user_id: userId,
      new_roles: newRoles,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    return fail(getErrorMessage(error))
  }
}

/**
 * Remove a role from a user via SECURITY DEFINER RPC function.
 */
export async function removeUserRole(
  userId: string,
  role: 'medic' | 'supervisor' | 'dev' | 'provider'
): Promise<ServiceResult> {
  try {
    const currentRoles = await getUserRoles(userId)
    const newRoles = currentRoles.filter(r => r !== role) as ('medic' | 'supervisor' | 'dev' | 'provider')[]

    if (newRoles.length === currentRoles.length) return succeed() // Role wasn't present

    const { error } = await supabase.rpc('set_user_roles', {
      target_user_id: userId,
      new_roles: newRoles,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    return fail(getErrorMessage(error))
  }
}

/**
 * List all users (profiles + email). Dev only.
 */
export async function listAllUsers(): Promise<AdminUser[]> {
  try {
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) throw error
    if (!Array.isArray(data)) return []
    return data as unknown as AdminUser[]
  } catch (error) {
    logger.error('Failed to list users:', error)
    return []
  }
}

/**
 * Create a new user directly (dev only).
 */
export async function createUser(userData: {
  email: string
  tempPassword: string
  firstName: string
  lastName: string
  middleInitial?: string
  credential?: string
  component?: string
  rank?: string
  uic?: string
  roles?: ('medic' | 'supervisor' | 'dev' | 'provider')[]
}): Promise<ServiceResult<{ userId?: string }>> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    const createPwError = validatePasswordComplexity(userData.tempPassword)
    if (createPwError) return fail(createPwError)

    const { data, error } = await supabase.rpc('admin_create_user', {
      p_email: userData.email,
      p_temp_password: userData.tempPassword,
      p_first_name: userData.firstName,
      p_last_name: userData.lastName,
      p_middle_initial: userData.middleInitial || undefined,
      p_credential: userData.credential || undefined,
      p_component: userData.component || undefined,
      p_rank: userData.rank || undefined,
      p_uic: userData.uic || undefined,
      p_roles: userData.roles as ('medic' | 'supervisor' | 'dev' | 'provider')[] | undefined,
    })

    if (error) return fail(error.message)

    const validated = validateRpcResult<{ user_id: string; email: string; message: string }>(
      data, ['user_id'], 'createUser'
    )
    return succeed({ userId: validated.ok ? validated.data.user_id : undefined })
  } catch (error) {
    logger.error('Failed to create user:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Reset a user's password (dev only).
 */
export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<ServiceResult> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    const resetPwError = validatePasswordComplexity(newPassword)
    if (resetPwError) return fail(resetPwError)

    const { error } = await supabase.rpc('admin_reset_password', {
      p_target_user_id: userId,
      p_new_password: newPassword,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to reset password:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Delete a user and all associated data (dev only).
 * Calls admin_delete_user RPC which removes notes, training
 * completions, sync queue entries, account requests, profile,
 * auth identity, and auth user. Prevents self-deletion.
 */
export async function deleteUser(
  userId: string
): Promise<ServiceResult> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    if (currentUser.id === userId) return fail('Cannot delete your own account')

    const { error } = await supabase.rpc('admin_delete_user', {
      p_target_user_id: userId,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to delete user:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Force-logout a user across all devices (dev only).
 * Invalidates all auth sessions and clears device registrations + Signal key bundles.
 * The user must re-authenticate and re-register on every device.
 */
export async function forceLogoutUser(
  userId: string
): Promise<ServiceResult<{ sessionsDeleted?: number; devicesDeleted?: number; bundlesDeleted?: number }>> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    const { data, error } = await supabase.rpc('admin_force_logout', {
      p_target_user_id: userId,
    })

    if (error) return fail(error.message)

    const result = data as { sessions_deleted?: number; devices_deleted?: number; bundles_deleted?: number } | null
    return succeed({
      sessionsDeleted: result?.sessions_deleted ?? 0,
      devicesDeleted: result?.devices_deleted ?? 0,
      bundlesDeleted: result?.bundles_deleted ?? 0,
    })
  } catch (error) {
    logger.error('Failed to force logout user:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Clinic summary returned by listClinics.
 */
export interface AdminClinic {
  id: string
  name: string
  uics: string[]
  child_clinic_ids: string[]
  associated_clinic_ids: string[]
  location: string | null
  additional_user_ids: string[]
}

/**
 * List all clinics. Dev only.
 */
export async function listClinics(): Promise<AdminClinic[]> {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('id, name, uics, child_clinic_ids, associated_clinic_ids, location, additional_user_ids, encryption_key')
      .order('name')

    if (error) throw error

    // Decrypt location fields using each clinic's own encryption key
    const clinics = await Promise.all(
      (data || []).map(async (row) => ({
        id: row.id,
        name: row.name,
        uics: row.uics || [],
        child_clinic_ids: row.child_clinic_ids || [],
        additional_user_ids: row.additional_user_ids || [],
        associated_clinic_ids: row.associated_clinic_ids || [],
        location: row.encryption_key
          ? await decryptWithRawKey(row.encryption_key, row.location)
          : row.location,
      }))
    )

    return clinics
  } catch (error) {
    logger.error('Failed to list clinics:', error)
    return []
  }
}

/**
 * Create a new clinic (dev only).
 */
export async function createClinic(data: {
  name: string
  location?: string
  uics?: string[]
  child_clinic_ids?: string[]
  associated_clinic_ids?: string[]
  additional_user_ids?: string[]
}): Promise<ServiceResult<{ id?: string }>> {
  try {
    const rawKey = generateClinicKeyBase64()
    const encryptedLocation = data.location
      ? await encryptWithRawKey(rawKey, data.location)
      : null

    const { data: result, error } = await supabase
      .from('clinics')
      .insert({
        name: data.name,
        location: encryptedLocation,
        uics: data.uics || [],
        child_clinic_ids: data.child_clinic_ids || [],
        associated_clinic_ids: data.associated_clinic_ids || [],
        additional_user_ids: data.additional_user_ids || [],
        encryption_key: rawKey,
        vault_chain_key: rawKey,
        vault_iteration: 0,
      })
      .select('id')
      .single()

    if (error) return fail(error.message)

    const newId = result.id

    // Provision clinic vault device immediately so the encryption identity
    // exists from creation — not deferred until first member login.
    if (newId) {
      const vaultResult = await ensureClinicVaultExists(newId, rawKey)
      if (!vaultResult.ok) {
        logger.error('Clinic created but vault provisioning failed:', vaultResult.error)
      }
    }

    // Reciprocal: add new clinic to each associated clinic's array
    const associated = data.associated_clinic_ids || []
    if (newId && associated.length > 0) {
      await syncAssociatedClinics(newId, [], associated)
    }

    return succeed({ id: newId })
  } catch (error) {
    logger.error('Failed to create clinic:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Sync associated_clinic_ids reciprocally.
 * Adds `clinicId` to every clinic in `added`, removes it from every clinic in `removed`.
 */
async function syncAssociatedClinics(clinicId: string, removed: string[], added: string[]) {
  // Disassociate via RPC (bi-directional, audited, marks invites as revoked)
  for (const peerId of removed) {
    await supabase.rpc('disassociate_clinic', {
      p_clinic_id: clinicId,
      p_peer_clinic_id: peerId,
    })
  }
  // Add this clinic to newly associated clinics
  for (const peerId of added) {
    const { data: peer } = await supabase
      .from('clinics')
      .select('associated_clinic_ids')
      .eq('id', peerId)
      .single()
    if (peer) {
      const existing: string[] = peer.associated_clinic_ids || []
      if (!existing.includes(clinicId)) {
        await supabase.from('clinics').update({ associated_clinic_ids: [...existing, clinicId] }).eq('id', peerId)
      }
    }
  }
}

/**
 * Update an existing clinic (dev only).
 */
export async function updateClinic(
  id: string,
  updates: {
    name?: string
    location?: string | null
    uics?: string[]
    child_clinic_ids?: string[]
    associated_clinic_ids?: string[]
    additional_user_ids?: string[]
  }
): Promise<ServiceResult> {
  try {
    // Encrypt location if it's being updated
    const payload: Record<string, unknown> = { ...updates }
    if (updates.location !== undefined && updates.location !== null) {
      payload.location = await encryptClinicField(id, updates.location)
    }

    // Reciprocal sync: diff old vs new associated_clinic_ids
    if (updates.associated_clinic_ids !== undefined) {
      const { data: current } = await supabase
        .from('clinics')
        .select('associated_clinic_ids')
        .eq('id', id)
        .single()
      const oldIds: string[] = current?.associated_clinic_ids || []
      const newIds = updates.associated_clinic_ids
      const added = newIds.filter(cid => !oldIds.includes(cid))
      const removed = oldIds.filter(cid => !newIds.includes(cid))
      await syncAssociatedClinics(id, removed, added)
    }

    const { error } = await supabase
      .from('clinics')
      .update(payload)
      .eq('id', id)

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to update clinic:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Delete a clinic (dev only).
 */
export async function deleteClinic(
  id: string
): Promise<ServiceResult> {
  try {
    const { error } = await supabase
      .from('clinics')
      .delete()
      .eq('id', id)

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to delete clinic:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Set a user's clinic assignment (dev only).
 * Pass null to clear the clinic.
 *
 * Uses the admin_set_clinic RPC function which verifies the
 * caller has dev role and validates the clinic exists.
 */
export async function setUserClinic(
  userId: string,
  clinicId: string | null
): Promise<ServiceResult> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    const { error } = await supabase.rpc('admin_set_clinic', {
      p_target_user_id: userId,
      p_clinic_id: clinicId,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to set user clinic:', error)
    return fail(getErrorMessage(error))
  }
}

/**
 * Update a user's profile fields (dev only).
 */
export async function updateUserProfile(
  userId: string,
  profileData: {
    firstName?: string
    lastName?: string
    middleInitial?: string
    credential?: string
    component?: string
    rank?: string
    uic?: string
  }
): Promise<ServiceResult> {
  try {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return fail('Not authenticated')

    const { error } = await supabase.rpc('update_user_profile', {
      p_target_user_id: userId,
      p_as_role: 'dev',
      p_first_name: profileData.firstName || undefined,
      p_last_name: profileData.lastName || undefined,
      p_middle_initial: profileData.middleInitial ?? undefined,
      p_credential: profileData.credential ?? undefined,
      p_component: profileData.component ?? undefined,
      p_rank: profileData.rank ?? undefined,
      p_uic: profileData.uic || undefined,
    })

    if (error) return fail(error.message)
    return succeed()
  } catch (error) {
    logger.error('Failed to update profile:', error)
    return fail(getErrorMessage(error))
  }
}
