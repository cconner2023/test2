/**
 * Account Request Service
 *
 * Handles account request submissions and status checking.
 * Users submit requests without authentication via the submit_account_request RPC,
 * which returns a status_check_token. Both email AND token are required to check status.
 *
 * Security notes:
 *   - Submissions go through an RPC function (not direct table INSERT) to enforce
 *     rate limiting and return the status_check_token securely
 *   - Status checks use the check_request_status RPC which requires both email
 *     AND token (prevents unauthenticated enumeration of requests)
 *   - Direct SELECT on account_requests is blocked for anon users by RLS
 *   - Only dev-role users can read account_requests directly (admin panel)
 */

import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { classifySupabaseError, ErrorCode } from './errorCodes'
import { validateRpcResult } from './validators'
import { fireNotification } from './notifyDispatcher'

const logger = createLogger('AccountRequest')

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
  status_check_token: string | null
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

export interface SubmitResult {
  success: boolean
  error?: string
  /** Save this token -- it is required to check request status later */
  statusCheckToken?: string
  requestId?: string
}

/**
 * Submit a new account request via the submit_account_request RPC.
 * Returns a status_check_token that the user must save to check status later.
 */
export async function submitAccountRequest(
  request: AccountRequestSubmission
): Promise<SubmitResult> {
  try {
    const { data, error } = await supabase.rpc('submit_account_request', {
      p_email: request.email.toLowerCase().trim(),
      p_first_name: request.firstName.trim(),
      p_last_name: request.lastName.trim(),
      p_middle_initial: request.middleInitial?.trim() || null,
      p_credential: request.credential || null,
      p_rank: request.rank || null,
      p_component: request.component || null,
      p_uic: request.uic.toUpperCase().trim(),
      p_notes: request.notes?.trim() || null,
      p_request_type: 'new_account',
    })

    if (error) {
      const code = classifySupabaseError(error)
      if (code === ErrorCode.RATE_LIMITED) {
        return {
          success: false,
          error: 'You have too many pending requests. Please wait for existing requests to be reviewed.',
        }
      }
      throw error
    }

    const validated = validateRpcResult<{ id: string; status_check_token: string; message: string }>(
      data, ['id', 'status_check_token'], 'submitAccountRequest'
    )
    const result = validated.ok ? validated.data : null

    fireNotification({
      type: 'new_account',
      name: `${request.firstName} ${request.lastName}`.trim(),
      email: request.email,
    })

    return {
      success: true,
      statusCheckToken: result?.status_check_token,
      requestId: result?.id,
    }
  } catch (error) {
    logger.error('Failed to submit account request:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit request',
    }
  }
}

/**
 * Submit a profile change request (authenticated users only).
 * Still uses the RPC to get a status_check_token.
 */
export async function submitProfileChangeRequest(
  request: AccountRequestSubmission
): Promise<SubmitResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to request profile changes.',
      }
    }

    const { data, error } = await supabase.rpc('submit_account_request', {
      p_email: request.email.toLowerCase().trim(),
      p_first_name: request.firstName.trim(),
      p_last_name: request.lastName.trim(),
      p_middle_initial: request.middleInitial?.trim() || null,
      p_credential: request.credential || null,
      p_rank: request.rank || null,
      p_component: request.component || null,
      p_uic: request.uic.toUpperCase().trim(),
      p_notes: request.notes?.trim() || null,
      p_request_type: 'profile_change',
    })

    if (error) throw error

    const validated = validateRpcResult<{ id: string; status_check_token: string; message: string }>(
      data, ['id', 'status_check_token'], 'submitProfileChangeRequest'
    )
    const result = validated.ok ? validated.data : null

    return {
      success: true,
      statusCheckToken: result?.status_check_token,
      requestId: result?.id,
    }
  } catch (error) {
    logger.error('Failed to submit profile change request:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit request',
    }
  }
}

/**
 * Check the status of an account request using email + status_check_token.
 * Both are required -- this prevents unauthenticated enumeration.
 * Uses the check_request_status RPC (SECURITY DEFINER) since anon users
 * have no direct SELECT access to account_requests.
 */
export async function checkRequestStatus(
  email: string,
  statusCheckToken: string
): Promise<AccountRequest | null> {
  try {
    if (!email || !statusCheckToken) {
      return null
    }

    const { data, error } = await supabase.rpc('check_request_status', {
      p_email: email.toLowerCase().trim(),
      p_token: statusCheckToken,
    })

    if (error) throw error

    const validated = validateRpcResult<{
      found: boolean
      id?: string
      email?: string
      first_name?: string
      last_name?: string
      status?: string
      request_type?: string
      requested_at?: string
      reviewed_at?: string | null
      rejection_reason?: string | null
      message?: string
    }>(data, ['found'], 'checkRequestStatus')

    const result = validated.ok ? validated.data : null

    if (!result || !result.found) return null

    // The RPC only returns non-sensitive fields; fill in the rest as null
    return {
      id: result.id || '',
      email: result.email || '',
      first_name: result.first_name || '',
      last_name: result.last_name || '',
      middle_initial: null,
      credential: null,
      rank: null,
      component: null,
      uic: '',
      status: (result.status as AccountRequest['status']) || 'pending',
      request_type: (result.request_type as AccountRequest['request_type']) || 'new_account',
      status_check_token: statusCheckToken,
      user_id: null,
      requested_at: result.requested_at || '',
      reviewed_at: result.reviewed_at || null,
      rejection_reason: result.rejection_reason || null,
      notes: null,
    }
  } catch (error) {
    logger.error('Failed to check request status:', error)
    return null
  }
}

