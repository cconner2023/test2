import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { fireNotification } from './notifyDispatcher'
import { fromSupabase } from './result'

const logger = createLogger('FeedbackService')

export interface FeedbackSubmission {
  rating: number
  comments?: string | null
  most_useful_feature?: string | null
  desired_feature?: string | null
  needs_improvement?: string | null
}

export interface FeedbackRow {
  id: string
  user_id: string | null
  display_name: string | null
  rating: number
  comments: string | null
  most_useful_feature: string | null
  desired_feature: string | null
  needs_improvement: string | null
  created_at: string
}

/**
 * Submit feedback to the feedback table.
 * Attaches user_id and display_name from the current auth session if available.
 */
export async function submitFeedback(
  data: FeedbackSubmission
): Promise<{ success: boolean; error?: string }> {
  try {
    let user_id: string | null = null
    let display_name: string | null = null

    const { data: { user } } = await supabase.auth.getUser()
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
      rating: data.rating,
      comments: data.comments?.trim() || null,
      most_useful_feature: data.most_useful_feature?.trim() || null,
      desired_feature: data.desired_feature?.trim() || null,
      needs_improvement: data.needs_improvement?.trim() || null,
    })

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    fireNotification({
      type: 'new_feedback',
      name: display_name,
      email: null,
    })

    return { success: true }
  } catch (error) {
    logger.error('Failed to submit feedback:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit feedback',
    }
  }
}

/**
 * Get all feedback ordered by created_at desc.
 * Only succeeds for dev users due to RLS policies.
 */
export async function getFeedbackList(): Promise<FeedbackRow[]> {
  try {
    const result = fromSupabase<FeedbackRow[]>(
      await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })
    )

    if (!result.ok) {
      logger.error('Failed to get feedback:', result.error)
      return []
    }

    return result.data
  } catch (error) {
    logger.error('Failed to get feedback:', error)
    return []
  }
}
