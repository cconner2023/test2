/**
 * Account Request Service
 *
 * Handles account request submissions and status checking.
 * Users submit requests without authentication, and admins approve them.
 */

import { supabase } from './supabase'

export interface AccountRequest {
  id: string
  email: string
  first_name: string
  last_name: string
  middle_initial: string | null
  credential: string | null
  rank: string | null
  component: string | null
  uic: string
  status: 'pending' | 'approved' | 'rejected'
  request_type: 'new_account' | 'profile_change'
  user_id: string | null
  requested_at: string
  reviewed_at: string | null
  rejection_reason: string | null
  notes: string | null
}

export interface AccountRequestSubmission {
  email: string
  firstName: string
  lastName: string
  middleInitial?: string
  credential?: string
  rank?: string
  component?: string
  uic: string
  notes?: string
}

/**
 * Submit a new account request
 */
export async function submitAccountRequest(
  request: AccountRequestSubmission
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('account_requests').insert({
      email: request.email.toLowerCase().trim(),
      first_name: request.firstName.trim(),
      last_name: request.lastName.trim(),
      middle_initial: request.middleInitial?.trim() || null,
      credential: request.credential || null,
      rank: request.rank || null,
      component: request.component || null,
      uic: request.uic.toUpperCase().trim(),
      notes: request.notes?.trim() || null,
      request_type: 'new_account',
    })

    if (error) {
      // Check for duplicate email
      if (error.code === '23505') {
        return {
          success: false,
          error: 'An account request with this email already exists.',
        }
      }
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to submit account request:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit request',
    }
  }
}

/**
 * Submit a profile change request (authenticated users only)
 */
export async function submitProfileChangeRequest(
  request: AccountRequestSubmission
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to request profile changes.',
      }
    }

    const { error } = await supabase.from('account_requests').insert({
      email: request.email.toLowerCase().trim(),
      first_name: request.firstName.trim(),
      last_name: request.lastName.trim(),
      middle_initial: request.middleInitial?.trim() || null,
      credential: request.credential || null,
      rank: request.rank || null,
      component: request.component || null,
      uic: request.uic.toUpperCase().trim(),
      notes: request.notes?.trim() || null,
      request_type: 'profile_change',
      user_id: user.id,
    })

    if (error) {
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to submit profile change request:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit request',
    }
  }
}

/**
 * Check the status of an account request by email
 */
export async function checkRequestStatus(
  email: string
): Promise<AccountRequest | null> {
  try {
    const { data, error } = await supabase
      .from('account_requests')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    if (!data) return null

    return {
      id: data.id,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      middle_initial: data.middle_initial,
      credential: data.credential,
      rank: data.rank,
      component: data.component,
      uic: data.uic,
      status: data.status,
      request_type: data.request_type || 'new_account',
      user_id: data.user_id,
      requested_at: data.requested_at,
      reviewed_at: data.reviewed_at,
      rejection_reason: data.rejection_reason,
      notes: data.notes,
    }
  } catch (error) {
    console.error('Failed to check request status:', error)
    return null
  }
}

/**
 * Get all pending account requests (admin only)
 */
export async function getPendingRequests(): Promise<AccountRequest[]> {
  try {
    const { data, error } = await supabase
      .from('account_requests')
      .select('*')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true })

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
    console.error('Failed to get pending requests:', error)
    return []
  }
}
