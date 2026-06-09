import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { useAuthStore } from '../stores/useAuthStore'
import { fireNotification } from './notifyDispatcher'
import { fromSupabase, succeed, fail, type ServiceResult } from './result'
import { getErrorMessage } from '../Utilities/errorUtils'
import { deltaRead, revalidateDeltaCache, localStorageBase, type DeltaCacheConfig } from './deltaCache'

const logger = createLogger('FeedbackService')

export interface FeedbackSubmission {
  rating: number | null
  comments?: string | null
  most_useful_feature?: string | null
  desired_feature?: string | null
  needs_improvement?: string | null
}

export interface FeedbackRow {
  id: string
  user_id: string | null
  display_name: string | null
  rating: number | null
  comments: string | null
  most_useful_feature: string | null
  desired_feature: string | null
  needs_improvement: string | null
  created_at: string
}

// ─── Delta cache for the dev-only feedback list ───────────────────────────────
// getFeedbackList polled repeatedly in the admin panel (see api logs). Single
// dev-scope set; cache-first + updated_at delta so reopening transfers nothing.
// Deletes soft-delete via archived_at so removals ride the delta.

/** Delta row = stored feedback plus the cursor + tombstone the cache consumes. */
interface FeedbackDeltaRow extends FeedbackRow {
  updated_at: string
  archived_at: string | null
}

/** Dev tolerates up to 5 min staleness on the feedback list before a bg delta. */
const FEEDBACK_TTL_MS = 5 * 60 * 1000
// Globally-namespaced mem-cache key (deltaCache mem Map is shared across tables).
const FEEDBACK_KEY = 'feedback:all'
const feedbackBase = localStorageBase<FeedbackRow>('adtmc_feedback_cache_v1', FEEDBACK_TTL_MS)

const feedbackListCfg: DeltaCacheConfig<FeedbackRow, FeedbackDeltaRow> = {
  key: FEEDBACK_KEY,
  loadBase: feedbackBase.loadBase,
  saveBase: feedbackBase.saveBase,
  fetchDelta: async (since) => {
    // since!==null → include archived rows so removals propagate; cold → live only.
    let q = supabase.from('feedback').select('*').order('updated_at')
    q = since ? q.gt('updated_at', since) : q.is('archived_at', null)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as unknown as FeedbackDeltaRow[]
  },
  toRow: ({ updated_at: _u, archived_at: _a, ...row }) => row as FeedbackRow,
  // Monitoring view: refresh warm memory via a cheap delta at most every 30s so a
  // dev catches new submissions within a session without re-pulling the full list.
  memTtlMs: 30 * 1000,
}

/**
 * Submit feedback to the feedback table.
 * Attaches user_id and display_name from the current auth session if available.
 */
export async function submitFeedback(
  data: FeedbackSubmission
): Promise<ServiceResult> {
  try {
    let user_id: string | null = null
    let display_name: string | null = null

    const user = useAuthStore.getState().user
    if (user) {
      user_id = user.id
      const profileResult = fromSupabase<{ display_name: string | null }>(
        await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .single()
      )
      display_name = profileResult.ok ? profileResult.data.display_name : null
    }

    const { error: insertError } = await supabase.from('feedback').insert({
      user_id,
      display_name,
      rating: data.rating || null,
      comments: data.comments?.trim() || null,
      most_useful_feature: data.most_useful_feature?.trim() || null,
      desired_feature: data.desired_feature?.trim() || null,
      needs_improvement: data.needs_improvement?.trim() || null,
    })

    if (insertError) return fail(insertError.message)

    fireNotification({
      type: 'new_feedback',
      name: display_name,
      email: null,
    })

    return succeed()
  } catch (error) {
    logger.error('Failed to submit feedback:', error)
    return fail(getErrorMessage(error, 'Failed to submit feedback'))
  }
}

/**
 * Delete a feedback row. Dev-only via RLS.
 */
export async function deleteFeedback(id: string): Promise<ServiceResult> {
  try {
    // Soft-delete: stamp archived_at so the tombstone rides the updated_at delta
    // (the BEFORE UPDATE trigger bumps updated_at). Dev-gated by feedback_update_dev RLS.
    const { error } = await supabase
      .from('feedback')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return fail(error.message)
    void revalidateDeltaCache(feedbackListCfg)
    return succeed()
  } catch (error) {
    return fail(getErrorMessage(error, 'Failed to delete feedback'))
  }
}

/**
 * Get all feedback ordered by created_at desc.
 * Only succeeds for dev users due to RLS policies.
 */
export async function getFeedbackList(): Promise<FeedbackRow[]> {
  try {
    // Cache-first + delta. Cache holds insertion order; restore the public sort.
    const rows = await deltaRead(feedbackListCfg)
    return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))
  } catch (error) {
    logger.error('Failed to get feedback:', error)
    return []
  }
}
