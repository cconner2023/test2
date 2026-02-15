/**
 * Admin Service
 *
 * Handles admin operations like approving/rejecting account requests
 * and creating user accounts.
 *
 * Requires service_role key for creating users.
 */

import { supabase } from './supabase'
import type { AccountRequest } from './accountRequestService'

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
 * Approve an account request and create the user account
 *
 * NOTE: This requires the service_role key to create users.
 * For now, this will mark as approved, but account creation
 * must be done manually via Supabase Dashboard.
 */
export async function approveAccountRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get the request details
    const { data: request, error: fetchError } = await supabase
      .from('account_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchError || !request) {
      return { success: false, error: 'Request not found' }
    }

    // Mark as approved using the RPC function
    const { error: approveError } = await supabase.rpc('approve_account_request', {
      request_id: requestId,
      admin_user_id: currentUser.id,
    })

    if (approveError) {
      return { success: false, error: approveError.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to approve request:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Reject an account request
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
 * Add a role to a user
 */
export async function addUserRole(
  userId: string,
  role: 'medic' | 'supervisor' | 'dev'
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentRoles = await getUserRoles(userId)

    if (currentRoles.includes(role)) {
      return { success: true } // Already has the role
    }

    const { error } = await supabase
      .from('profiles')
      .update({ roles: [...currentRoles, role] })
      .eq('id', userId)

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
