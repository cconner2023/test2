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
import type { AccountRequest } from './accountRequestService'

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
}

/**
 * Check if the current user has dev role
 */
export async function isDevUser(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
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
    console.error('Failed to get account requests:', error)
    return []
  }
}

/**
 * Approve an account request and create the user account.
 *
 * The RPC function verifies the caller has dev role via auth.uid(),
 * creates the auth user, populates the profile, and marks approved.
 */
export async function approveAccountRequest(
  requestId: string,
  tempPassword: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      return { success: false, error: 'Not authenticated' }
    }

    if (tempPassword.length < 12) {
      return { success: false, error: 'Temporary password must be at least 12 characters' }
    }

    const { data, error: approveError } = await supabase.rpc('approve_account_request', {
      request_id: requestId,
      admin_user_id: currentUser.id,
      temp_password: tempPassword,
    })

    if (approveError) {
      return { success: false, error: approveError.message }
    }

    const result = data as { user_id: string; email: string; message: string } | null
    return {
      success: true,
      userId: result?.user_id,
    }
  } catch (error) {
    console.error('Failed to approve request:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Reject an account request.
 * The RPC function verifies the caller has dev role via auth.uid().
 */
export async function rejectAccountRequest(
  requestId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase.rpc('reject_account_request', {
      request_id: requestId,
      admin_user_id: currentUser.id,
      reason,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to reject request:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
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
 * Add a role to a user via SECURITY DEFINER RPC function.
 * The RPC verifies the caller has dev role — prevents self-escalation.
 */
export async function addUserRole(
  userId: string,
  role: 'medic' | 'supervisor' | 'dev'
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentRoles = await getUserRoles(userId)

    if (currentRoles.includes(role)) {
      return { success: true }
    }

    const newRoles = [...currentRoles, role] as ('medic' | 'supervisor' | 'dev')[]

    const { error } = await supabase.rpc('set_user_roles', {
      target_user_id: userId,
      new_roles: newRoles,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Remove a role from a user via SECURITY DEFINER RPC function.
 */
export async function removeUserRole(
  userId: string,
  role: 'medic' | 'supervisor' | 'dev'
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentRoles = await getUserRoles(userId)
    const newRoles = currentRoles.filter(r => r !== role) as ('medic' | 'supervisor' | 'dev')[]

    if (newRoles.length === currentRoles.length) {
      return { success: true } // Role wasn't present
    }

    const { error } = await supabase.rpc('set_user_roles', {
      target_user_id: userId,
      new_roles: newRoles,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * List all users (profiles + email). Dev only.
 */
export async function listAllUsers(): Promise<AdminUser[]> {
  try {
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) throw error
    return (data as unknown as AdminUser[]) || []
  } catch (error) {
    console.error('Failed to list users:', error)
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
  roles?: ('medic' | 'supervisor' | 'dev')[]
}): Promise<{ success: boolean; error?: string; userId?: string }> {
  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { success: false, error: 'Not authenticated' }

    if (userData.tempPassword.length < 12) {
      return { success: false, error: 'Password must be at least 12 characters' }
    }

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
      p_roles: userData.roles as ('medic' | 'supervisor' | 'dev')[] | undefined,
    })

    if (error) return { success: false, error: error.message }

    const result = data as { user_id: string; email: string; message: string } | null
    return { success: true, userId: result?.user_id }
  } catch (error) {
    console.error('Failed to create user:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Reset a user's password (dev only).
 */
export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { success: false, error: 'Not authenticated' }

    if (newPassword.length < 12) {
      return { success: false, error: 'Password must be at least 12 characters' }
    }

    const { error } = await supabase.rpc('admin_reset_password', {
      p_target_user_id: userId,
      p_new_password: newPassword,
    })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (error) {
    console.error('Failed to reset password:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
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
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { success: false, error: 'Not authenticated' }

    if (currentUser.id === userId) {
      return { success: false, error: 'Cannot delete your own account' }
    }

    const { error } = await supabase.rpc('admin_delete_user', {
      p_target_user_id: userId,
    })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (error) {
    console.error('Failed to delete user:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Clinic summary returned by listClinics.
 */
export interface AdminClinic {
  id: string
  name: string
  uics: string[]
  location: string | null
}

/**
 * List all clinics. Dev only.
 */
export async function listClinics(): Promise<AdminClinic[]> {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('id, name, uics, location')
      .order('name')

    if (error) throw error
    return (data || []) as AdminClinic[]
  } catch (error) {
    console.error('Failed to list clinics:', error)
    return []
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
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase.rpc('admin_set_clinic', {
      p_target_user_id: userId,
      p_clinic_id: clinicId,
    })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (error) {
    console.error('Failed to set user clinic:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
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
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase.rpc('admin_update_profile', {
      p_target_user_id: userId,
      p_first_name: profileData.firstName || undefined,
      p_last_name: profileData.lastName || undefined,
      p_middle_initial: profileData.middleInitial ?? undefined,
      p_credential: profileData.credential ?? undefined,
      p_component: profileData.component ?? undefined,
      p_rank: profileData.rank ?? undefined,
      p_uic: profileData.uic || undefined,
    })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (error) {
    console.error('Failed to update profile:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
