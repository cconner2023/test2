import { supabase } from './supabase'

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
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()
      display_name = profile?.display_name ?? null
    }

    const { error } = await supabase.from('feedback').insert({
      user_id,
      display_name,
      rating: data.rating,
      comments: data.comments?.trim() || null,
      most_useful_feature: data.most_useful_feature?.trim() || null,
      desired_feature: data.desired_feature?.trim() || null,
      needs_improvement: data.needs_improvement?.trim() || null,
    })

    if (error) throw error

    // Fire-and-forget: notify dev users of new feedback
    supabase.functions.invoke('send-push-notification', {
      body: {
        type: 'new_feedback',
        name: display_name,
        email: null,
      },
    }).catch(() => { /* push notification delivery is best-effort */ })

    return { success: true }
  } catch (error) {
    console.error('Failed to submit feedback:', error)
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
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []) as FeedbackRow[]
  } catch (error) {
    console.error('Failed to get feedback:', error)
    return []
  }
}
