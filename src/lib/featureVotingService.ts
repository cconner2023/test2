/**
 * Feature Voting service — offline-first reads + writes for the community
 * feature-vote subsystem.
 *
 * Voting model:
 *   - One vote per cycle per user, stored with unique(cycle_id, user_id).
 *   - Votes are mutable — re-voting is an UPDATE on the same row.
 *   - Tally is fetched after submit and derived from aggregate row counts.
 *
 * Suggestion model:
 *   - Users create suggestions with status='pending'.
 *   - Dev admins approve → convert to feature_vote_candidates; reject → status change.
 *   - Approved suggestions link back via feature_vote_candidates.source_suggestion_id.
 *
 * Dev gate: admin-only operations check useAuthStore.isDevRole and fail fast.
 * Server RLS is permissive (matches training_completions pattern) — the gate
 * is app-layer, not defense-in-depth.
 */

import { supabase } from './supabase'
import { useAuthStore } from '../stores/useAuthStore'
import {
  addToSyncQueue,
  stripLocalFields,
  saveLocalFeatureVoteCycle,
  deleteLocalFeatureVoteCycle,
  saveLocalFeatureVoteCandidate,
  deleteLocalFeatureVoteCandidate,
  saveLocalFeatureVote,
  getLocalFeatureVoteForUserCycle,
  updateFeatureVoteSyncStatus,
  saveLocalFeatureVoteSuggestion,
  deleteLocalFeatureVoteSuggestion,
  updateFeatureVoteSuggestionSyncStatus,
  type LocalFeatureVote,
  type LocalFeatureVoteCycle,
  type LocalFeatureVoteCandidate,
  type LocalFeatureVoteSuggestion,
} from './offlineDb'
import { createLogger } from '../Utilities/Logger'
import { immediateSync } from './syncEngine'
import { type Result, ok, err, type ServiceResult, succeed, fail } from './result'
import { ErrorCode } from './errorCodes'
import { getErrorMessage } from '../Utilities/errorUtils'

const logger = createLogger('FeatureVotingService')

// ============================================================
// Types
// ============================================================

export interface FeatureVoteCycle {
  id: string
  title: string
  description: string | null
  openedAt: string
  closedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface FeatureVoteCandidate {
  id: string
  cycleId: string
  title: string
  description: string | null
  sortOrder: number
  sourceSuggestionId: string | null
  createdAt: string
  updatedAt: string
}

export interface FeatureVote {
  id: string
  cycleId: string
  candidateId: string
  userId: string
  createdAt: string
  updatedAt: string
}

export type FeatureVoteSuggestionStatus = 'pending' | 'approved' | 'rejected'

export interface FeatureVoteSuggestion {
  id: string
  cycleId: string | null
  userId: string
  title: string
  description: string | null
  status: FeatureVoteSuggestionStatus
  reviewedAt: string | null
  reviewedBy: string | null
  createdAt: string
  updatedAt: string
}

export type VoteTally = Record<string, number>

// ============================================================
// Row → UI converters
// ============================================================

function rowToCycle(r: Record<string, unknown>): FeatureVoteCycle {
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    openedAt: r.opened_at as string,
    closedAt: (r.closed_at as string | null) ?? null,
    createdBy: (r.created_by as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

function rowToCandidate(r: Record<string, unknown>): FeatureVoteCandidate {
  return {
    id: r.id as string,
    cycleId: r.cycle_id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    sortOrder: (r.sort_order as number) ?? 0,
    sourceSuggestionId: (r.source_suggestion_id as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

function rowToVote(r: Record<string, unknown>): FeatureVote {
  return {
    id: r.id as string,
    cycleId: r.cycle_id as string,
    candidateId: r.candidate_id as string,
    userId: r.user_id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

function rowToSuggestion(r: Record<string, unknown>): FeatureVoteSuggestion {
  return {
    id: r.id as string,
    cycleId: (r.cycle_id as string | null) ?? null,
    userId: r.user_id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    status: r.status as FeatureVoteSuggestionStatus,
    reviewedAt: (r.reviewed_at as string | null) ?? null,
    reviewedBy: (r.reviewed_by as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

// ============================================================
// Public Reads
// ============================================================

/** Fetch the currently open voting cycle (closed_at is null). Returns null if none. */
export async function fetchActiveCycle(): Promise<Result<FeatureVoteCycle | null>> {
  const { data, error } = await supabase
    .from('feature_vote_cycles')
    .select('*')
    .is('closed_at', null)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logger.error('fetchActiveCycle failed', error.message)
    return err(error.message, error.code)
  }
  return ok(data ? rowToCycle(data as Record<string, unknown>) : null)
}

export async function fetchAllCycles(): Promise<Result<FeatureVoteCycle[]>> {
  const { data, error } = await supabase
    .from('feature_vote_cycles')
    .select('*')
    .order('opened_at', { ascending: false })

  if (error) return err(error.message, error.code)
  return ok(((data as Record<string, unknown>[]) ?? []).map(rowToCycle))
}

export async function fetchCandidates(cycleId: string): Promise<Result<FeatureVoteCandidate[]>> {
  const { data, error } = await supabase
    .from('feature_vote_candidates')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('sort_order', { ascending: true })

  if (error) return err(error.message, error.code)
  return ok(((data as Record<string, unknown>[]) ?? []).map(rowToCandidate))
}

export async function fetchUserVote(cycleId: string, userId: string): Promise<Result<FeatureVote | null>> {
  const { data, error } = await supabase
    .from('feature_votes')
    .select('*')
    .eq('cycle_id', cycleId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return err(error.message, error.code)
  return ok(data ? rowToVote(data as Record<string, unknown>) : null)
}

export async function fetchTally(cycleId: string): Promise<Result<VoteTally>> {
  const { data, error } = await supabase
    .from('feature_votes')
    .select('candidate_id')
    .eq('cycle_id', cycleId)

  if (error) return err(error.message, error.code)
  const tally: VoteTally = {}
  for (const row of (data as Record<string, unknown>[]) ?? []) {
    const cid = row.candidate_id as string
    tally[cid] = (tally[cid] ?? 0) + 1
  }
  return ok(tally)
}

export async function fetchSuggestions(opts?: { status?: FeatureVoteSuggestionStatus; userId?: string }): Promise<Result<FeatureVoteSuggestion[]>> {
  let q = supabase.from('feature_vote_suggestions').select('*').order('created_at', { ascending: false })
  if (opts?.status) q = q.eq('status', opts.status)
  if (opts?.userId) q = q.eq('user_id', opts.userId)
  const { data, error } = await q
  if (error) return err(error.message, error.code)
  return ok(((data as Record<string, unknown>[]) ?? []).map(rowToSuggestion))
}

// ============================================================
// User Writes (offline-first)
// ============================================================

/**
 * Submit or update the user's vote for an active cycle.
 * Upserts on (cycle_id, user_id) — a second call replaces the candidate choice.
 */
export async function submitVote(params: {
  cycleId: string
  candidateId: string
  userId: string
}): Promise<ServiceResult<{ vote: FeatureVote }>> {
  const { cycleId, candidateId, userId } = params
  const now = new Date().toISOString()

  const existing = await getLocalFeatureVoteForUserCycle(userId, cycleId)
  const local: LocalFeatureVote = {
    id: existing?.id ?? crypto.randomUUID(),
    cycle_id: cycleId,
    candidate_id: candidateId,
    user_id: userId,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    _sync_status: 'pending',
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }

  await saveLocalFeatureVote(local)

  const payload = stripLocalFields(local as unknown as Record<string, unknown>)
  const action = existing ? 'update' : 'create'

  await addToSyncQueue({
    user_id: userId,
    action,
    table_name: 'feature_votes',
    record_id: local.id,
    payload,
  })

  const synced = await immediateSync(
    { id: local.id, payload },
    {
      tableName: 'feature_votes',
      upsertFn: async (rec) => {
        const { error } = await supabase
          .from('feature_votes')
          .upsert(rec.payload as never, { onConflict: 'cycle_id,user_id' })
        if (error) throw error
      },
      updateSyncStatus: updateFeatureVoteSyncStatus,
    },
    action
  )
  if (synced) local._sync_status = 'synced'

  return succeed({
    vote: {
      id: local.id,
      cycleId: local.cycle_id,
      candidateId: local.candidate_id,
      userId: local.user_id,
      createdAt: local.created_at,
      updatedAt: local.updated_at,
    },
  })
}

/** Submit a feature suggestion (pending admin approval). */
export async function submitSuggestion(params: {
  userId: string
  title: string
  description?: string
  cycleId?: string | null
}): Promise<ServiceResult<{ suggestion: FeatureVoteSuggestion }>> {
  const { userId, title, description, cycleId } = params
  const trimmed = title.trim()
  if (!trimmed) return fail('Title is required')
  if (trimmed.length > 120) return fail('Title too long (max 120 characters)')

  const now = new Date().toISOString()
  const local: LocalFeatureVoteSuggestion = {
    id: crypto.randomUUID(),
    cycle_id: cycleId ?? null,
    user_id: userId,
    title: trimmed,
    description: description?.trim() || null,
    status: 'pending',
    reviewed_at: null,
    reviewed_by: null,
    created_at: now,
    updated_at: now,
    _sync_status: 'pending',
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }

  await saveLocalFeatureVoteSuggestion(local)

  const payload = stripLocalFields(local as unknown as Record<string, unknown>)
  await addToSyncQueue({
    user_id: userId,
    action: 'create',
    table_name: 'feature_vote_suggestions',
    record_id: local.id,
    payload,
  })

  const synced = await immediateSync(
    { id: local.id, payload },
    {
      tableName: 'feature_vote_suggestions',
      upsertFn: async (rec) => {
        const { error } = await supabase
          .from('feature_vote_suggestions')
          .upsert(rec.payload as never, { onConflict: 'id' })
        if (error) throw error
      },
      updateSyncStatus: updateFeatureVoteSuggestionSyncStatus,
    },
    'create'
  )
  if (synced) local._sync_status = 'synced'

  return succeed({
    suggestion: {
      id: local.id,
      cycleId: local.cycle_id,
      userId: local.user_id,
      title: local.title,
      description: local.description,
      status: local.status,
      reviewedAt: local.reviewed_at,
      reviewedBy: local.reviewed_by,
      createdAt: local.created_at,
      updatedAt: local.updated_at,
    },
  })
}

/** Delete a suggestion — user can remove their own pending suggestion. */
export async function deleteSuggestion(suggestionId: string, userId: string): Promise<ServiceResult> {
  await deleteLocalFeatureVoteSuggestion(suggestionId)
  const { error } = await supabase.from('feature_vote_suggestions').delete().eq('id', suggestionId).eq('user_id', userId)
  if (error) return fail(error.message)
  return succeed()
}

// ============================================================
// Admin Writes (dev-role gated)
// ============================================================

function requireDev(): Result<true> {
  const { isDevRole } = useAuthStore.getState()
  if (!isDevRole) return err('Dev role required', ErrorCode.PERMISSION_DENIED)
  return ok(true)
}

export async function createCycle(params: {
  title: string
  description?: string
  createdBy: string
}): Promise<ServiceResult<{ cycle: FeatureVoteCycle }>> {
  const gate = requireDev()
  if (!gate.ok) return fail(gate.error)

  const trimmed = params.title.trim()
  if (!trimmed) return fail('Title is required')

  const now = new Date().toISOString()
  const row = {
    id: crypto.randomUUID(),
    title: trimmed,
    description: params.description?.trim() || null,
    opened_at: now,
    closed_at: null,
    created_by: params.createdBy,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from('feature_vote_cycles')
    .insert(row as never)
    .select('*')
    .single()

  if (error) return fail(error.message)
  const cycle = rowToCycle(data as Record<string, unknown>)
  await saveLocalFeatureVoteCycle({
    id: cycle.id,
    title: cycle.title,
    description: cycle.description,
    opened_at: cycle.openedAt,
    closed_at: cycle.closedAt,
    created_by: cycle.createdBy,
    created_at: cycle.createdAt,
    updated_at: cycle.updatedAt,
  })
  return succeed({ cycle })
}

export async function updateCycle(cycleId: string, patch: { title?: string; description?: string | null; closedAt?: string | null }): Promise<ServiceResult<{ cycle: FeatureVoteCycle }>> {
  const gate = requireDev()
  if (!gate.ok) return fail(gate.error)

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.title !== undefined) {
    const t = patch.title.trim()
    if (!t) return fail('Title cannot be empty')
    updates.title = t
  }
  if (patch.description !== undefined) updates.description = patch.description?.trim() || null
  if (patch.closedAt !== undefined) updates.closed_at = patch.closedAt

  const { data, error } = await supabase
    .from('feature_vote_cycles')
    .update(updates as never)
    .eq('id', cycleId)
    .select('*')
    .single()

  if (error) return fail(error.message)
  const cycle = rowToCycle(data as Record<string, unknown>)
  return succeed({ cycle })
}

export async function closeCycle(cycleId: string): Promise<ServiceResult<{ cycle: FeatureVoteCycle }>> {
  return updateCycle(cycleId, { closedAt: new Date().toISOString() })
}

export async function deleteCycle(cycleId: string): Promise<ServiceResult> {
  const gate = requireDev()
  if (!gate.ok) return fail(gate.error)

  const { error } = await supabase.from('feature_vote_cycles').delete().eq('id', cycleId)
  if (error) return fail(error.message)
  await deleteLocalFeatureVoteCycle(cycleId)
  return succeed()
}

export async function addCandidate(params: {
  cycleId: string
  title: string
  description?: string
  sortOrder?: number
  sourceSuggestionId?: string
}): Promise<ServiceResult<{ candidate: FeatureVoteCandidate }>> {
  const gate = requireDev()
  if (!gate.ok) return fail(gate.error)

  const trimmed = params.title.trim()
  if (!trimmed) return fail('Title is required')

  const now = new Date().toISOString()
  const row = {
    id: crypto.randomUUID(),
    cycle_id: params.cycleId,
    title: trimmed,
    description: params.description?.trim() || null,
    sort_order: params.sortOrder ?? 0,
    source_suggestion_id: params.sourceSuggestionId ?? null,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from('feature_vote_candidates')
    .insert(row as never)
    .select('*')
    .single()

  if (error) return fail(error.message)
  const candidate = rowToCandidate(data as Record<string, unknown>)
  await saveLocalFeatureVoteCandidate({
    id: candidate.id,
    cycle_id: candidate.cycleId,
    title: candidate.title,
    description: candidate.description,
    sort_order: candidate.sortOrder,
    source_suggestion_id: candidate.sourceSuggestionId,
    created_at: candidate.createdAt,
    updated_at: candidate.updatedAt,
  })
  return succeed({ candidate })
}

export async function updateCandidate(candidateId: string, patch: { title?: string; description?: string | null; sortOrder?: number }): Promise<ServiceResult<{ candidate: FeatureVoteCandidate }>> {
  const gate = requireDev()
  if (!gate.ok) return fail(gate.error)

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.title !== undefined) {
    const t = patch.title.trim()
    if (!t) return fail('Title cannot be empty')
    updates.title = t
  }
  if (patch.description !== undefined) updates.description = patch.description?.trim() || null
  if (patch.sortOrder !== undefined) updates.sort_order = patch.sortOrder

  const { data, error } = await supabase
    .from('feature_vote_candidates')
    .update(updates as never)
    .eq('id', candidateId)
    .select('*')
    .single()

  if (error) return fail(error.message)
  const candidate = rowToCandidate(data as Record<string, unknown>)
  return succeed({ candidate })
}

export async function deleteCandidate(candidateId: string): Promise<ServiceResult> {
  const gate = requireDev()
  if (!gate.ok) return fail(gate.error)

  const { error } = await supabase.from('feature_vote_candidates').delete().eq('id', candidateId)
  if (error) return fail(error.message)
  await deleteLocalFeatureVoteCandidate(candidateId)
  return succeed()
}

/**
 * Approve a suggestion: mark approved + create a candidate in the target cycle.
 * The candidate records source_suggestion_id so admins can trace it back.
 */
export async function approveSuggestion(params: {
  suggestionId: string
  cycleId: string
  reviewerId: string
}): Promise<ServiceResult<{ candidate: FeatureVoteCandidate }>> {
  const gate = requireDev()
  if (!gate.ok) return fail(gate.error)

  const { data: sugg, error: suggErr } = await supabase
    .from('feature_vote_suggestions')
    .select('*')
    .eq('id', params.suggestionId)
    .single()
  if (suggErr || !sugg) return fail(suggErr?.message ?? 'Suggestion not found')

  const suggRow = sugg as Record<string, unknown>
  const addResult = await addCandidate({
    cycleId: params.cycleId,
    title: suggRow.title as string,
    description: (suggRow.description as string | null) ?? undefined,
    sourceSuggestionId: params.suggestionId,
  })
  if (!addResult.success) return addResult

  const { error: updErr } = await supabase
    .from('feature_vote_suggestions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: params.reviewerId,
      cycle_id: params.cycleId,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', params.suggestionId)

  if (updErr) {
    logger.warn('Suggestion approved but status update failed', updErr.message)
  }

  return succeed({ candidate: addResult.candidate })
}

export async function rejectSuggestion(params: {
  suggestionId: string
  reviewerId: string
}): Promise<ServiceResult> {
  const gate = requireDev()
  if (!gate.ok) return fail(gate.error)

  const { error } = await supabase
    .from('feature_vote_suggestions')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: params.reviewerId,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', params.suggestionId)

  if (error) return fail(error.message)
  return succeed()
}

/** Admin-only: permanently delete a suggestion (treats it as a dismissable feedback item). */
export async function adminDeleteSuggestion(suggestionId: string): Promise<ServiceResult> {
  const gate = requireDev()
  if (!gate.ok) return fail(gate.error)

  const { error } = await supabase.from('feature_vote_suggestions').delete().eq('id', suggestionId)
  if (error) return fail(error.message)
  await deleteLocalFeatureVoteSuggestion(suggestionId)
  return succeed()
}

// ============================================================
// Errors
// ============================================================

export function getFeatureVotingErrorMessage(e: unknown): string {
  return getErrorMessage(e, 'Feature voting action failed')
}
