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
  getLocalFeatureVoteCycles,
  getLocalFeatureVoteCandidates,
  getLocalFeatureVoteSuggestions,
  getLocalFeatureVoteSuggestionsByUser,
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
import { deltaRead, invalidateDeltaCache, localStorageBase, type DeltaCacheConfig } from './deltaCache'

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
// UI → Local (write-through cache mappers)
// ============================================================

function cycleToLocal(c: FeatureVoteCycle): LocalFeatureVoteCycle {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    opened_at: c.openedAt,
    closed_at: c.closedAt,
    created_by: c.createdBy,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  }
}

function candidateToLocal(c: FeatureVoteCandidate): LocalFeatureVoteCandidate {
  return {
    id: c.id,
    cycle_id: c.cycleId,
    title: c.title,
    description: c.description,
    sort_order: c.sortOrder,
    source_suggestion_id: c.sourceSuggestionId,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  }
}

function suggestionToLocal(s: FeatureVoteSuggestion): LocalFeatureVoteSuggestion {
  return {
    id: s.id,
    cycle_id: s.cycleId,
    user_id: s.userId,
    title: s.title,
    description: s.description,
    status: s.status,
    reviewed_at: s.reviewedAt,
    reviewed_by: s.reviewedBy,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    _sync_status: 'synced',
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
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
    // Network failure → serve last-known open cycle from IDB (offline-first).
    logger.warn('fetchActiveCycle network failed, falling back to IDB', error.message)
    const local = await getLocalFeatureVoteCycles()
    const open = local
      .filter((c) => !c.closed_at)
      .sort((a, b) => b.opened_at.localeCompare(a.opened_at))
    return ok(open[0] ? rowToCycle(open[0] as unknown as Record<string, unknown>) : null)
  }
  const cycle = data ? rowToCycle(data as Record<string, unknown>) : null
  if (cycle) await saveLocalFeatureVoteCycle(cycleToLocal(cycle))
  return ok(cycle)
}

// Admin-only cycle list (AdminFeatureVotesSection reloads on every tab open).
// Cache-first + updated_at delta. feature_vote_cycles is hard-deleted (no archived_at
// column), so deletes can't ride the delta — clearCyclesCache() wipes after every cycle
// mutation and the next read cold-refetches. Dev-only/single-actor, so cross-device
// delete staleness is a non-issue. The user-facing store uses fetchActiveCycle, not this.
/** Raw cycle DB row: an opaque record carrying the cursor + (absent) tombstone. */
interface CycleDeltaRow {
  [key: string]: unknown
  id: string
  updated_at: string
  archived_at?: string | null
}

const CYCLES_KEY = 'fvcycles:all'
const CYCLES_TTL_MS = 5 * 60 * 1000
const cyclesBase = localStorageBase<FeatureVoteCycle>('adtmc_fvcycles_cache_v1', CYCLES_TTL_MS)

const allCyclesCfg: DeltaCacheConfig<FeatureVoteCycle, CycleDeltaRow> = {
  key: CYCLES_KEY,
  loadBase: cyclesBase.loadBase,
  saveBase: cyclesBase.saveBase,
  fetchDelta: async (since) => {
    let q = supabase.from('feature_vote_cycles').select('*').order('updated_at')
    if (since) q = q.gt('updated_at', since)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as unknown as CycleDeltaRow[]
  },
  toRow: (r) => rowToCycle(r),
  memTtlMs: 60 * 1000,
}

/** Wipe the cycles cache after any cycle mutation (hard-delete can't ride the delta). */
function clearCyclesCache(): void {
  invalidateDeltaCache(CYCLES_KEY)
  cyclesBase.clearBase(CYCLES_KEY)
}

export async function fetchAllCycles(): Promise<Result<FeatureVoteCycle[]>> {
  try {
    const rows = await deltaRead(allCyclesCfg)
    return ok([...rows].sort((a, b) => b.openedAt.localeCompare(a.openedAt)))
  } catch (e) {
    return err(getErrorMessage(e, 'Failed to load cycles'))
  }
}

export async function fetchCandidates(cycleId: string, opts?: { preferLocal?: boolean }): Promise<Result<FeatureVoteCandidate[]>> {
  // Candidates are immutable for the life of a cycle. For a CLOSED cycle the IDB
  // write-through is authoritative, so serve it directly and skip the network —
  // the admin console reloads every cycle on each open, and past cycles never
  // change. Only fall through to the wire when the local projection is empty
  // (cold device that has never opened the console).
  if (opts?.preferLocal) {
    const local = await getLocalFeatureVoteCandidates(cycleId)
    if (local.length > 0) {
      return ok(
        local
          .map((r) => rowToCandidate(r as unknown as Record<string, unknown>))
          .sort((a, b) => a.sortOrder - b.sortOrder)
      )
    }
  }

  const { data, error } = await supabase
    .from('feature_vote_candidates')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('sort_order', { ascending: true })

  if (error) {
    // Candidates are immutable for the life of a cycle → IDB is authoritative offline.
    logger.warn('fetchCandidates network failed, falling back to IDB', error.message)
    const local = await getLocalFeatureVoteCandidates(cycleId)
    return ok(
      local
        .map((r) => rowToCandidate(r as unknown as Record<string, unknown>))
        .sort((a, b) => a.sortOrder - b.sortOrder)
    )
  }
  const candidates = ((data as Record<string, unknown>[]) ?? []).map(rowToCandidate)
  await Promise.all(candidates.map((c) => saveLocalFeatureVoteCandidate(candidateToLocal(c))))
  return ok(candidates)
}

export async function fetchUserVote(cycleId: string, userId: string): Promise<Result<FeatureVote | null>> {
  const { data, error } = await supabase
    .from('feature_votes')
    .select('*')
    .eq('cycle_id', cycleId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    // The user's own vote is already persisted locally on submit.
    logger.warn('fetchUserVote network failed, falling back to IDB', error.message)
    const local = await getLocalFeatureVoteForUserCycle(userId, cycleId)
    return ok(local ? rowToVote(local as unknown as Record<string, unknown>) : null)
  }
  return ok(data ? rowToVote(data as Record<string, unknown>) : null)
}

export interface CandidateVoter {
  userId: string
  displayName: string
}

export type VotersByCandidate = Record<string, CandidateVoter[]>

/**
 * Fetch the voters for each candidate in a cycle.
 * Dev-gated at the call site (AdminFeatureVotesSection); profile lookup
 * is a separate pass so we don't depend on a Postgres relation hint.
 */
export async function fetchVoters(cycleId: string): Promise<Result<VotersByCandidate>> {
  const { data: votes, error } = await supabase
    .from('feature_votes')
    .select('candidate_id, user_id')
    .eq('cycle_id', cycleId)

  if (error) return err(error.message, error.code)
  const voteRows = (votes as { candidate_id: string; user_id: string }[]) ?? []

  const userIds = Array.from(new Set(voteRows.map((v) => v.user_id)))
  const nameById: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds)
    if (pErr) return err(pErr.message, pErr.code)
    for (const p of (profiles as { id: string; display_name: string | null }[]) ?? []) {
      nameById[p.id] = p.display_name?.trim() || 'Unknown'
    }
  }

  const out: VotersByCandidate = {}
  for (const v of voteRows) {
    const list = out[v.candidate_id] ?? (out[v.candidate_id] = [])
    list.push({ userId: v.user_id, displayName: nameById[v.user_id] ?? 'Unknown' })
  }
  for (const cid of Object.keys(out)) {
    out[cid].sort((a, b) => a.displayName.localeCompare(b.displayName))
  }
  return ok(out)
}

// A CLOSED cycle's tally is frozen (no new votes after close), so persist it once
// and serve from localStorage on later console opens — zero egress vs a full
// feature_votes re-pull per past cycle per open. Keyed per cycle; cleared when the
// cycle is deleted (clearClosedTally in deleteCycle).
const CLOSED_TALLY_PREFIX = 'adtmc_fvtally_'

function loadClosedTally(cycleId: string): VoteTally | null {
  try {
    const raw = localStorage.getItem(CLOSED_TALLY_PREFIX + cycleId)
    return raw ? (JSON.parse(raw) as VoteTally) : null
  } catch { return null }
}

function saveClosedTally(cycleId: string, tally: VoteTally): void {
  try { localStorage.setItem(CLOSED_TALLY_PREFIX + cycleId, JSON.stringify(tally)) } catch { /* quota */ }
}

function clearClosedTally(cycleId: string): void {
  try { localStorage.removeItem(CLOSED_TALLY_PREFIX + cycleId) } catch { /* ignore */ }
}

export async function fetchTally(cycleId: string, opts?: { cacheClosed?: boolean }): Promise<Result<VoteTally>> {
  if (opts?.cacheClosed) {
    const cached = loadClosedTally(cycleId)
    if (cached) return ok(cached)
  }

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
  if (opts?.cacheClosed) saveClosedTally(cycleId, tally)
  return ok(tally)
}

/** Load a cycle's admin-console data (candidates + tally). CLOSED cycles are
 *  immutable → served from IDB + localStorage with no egress; the single ACTIVE
 *  cycle stays live on the wire. */
export async function fetchCycleData(
  cycleId: string,
  isClosed: boolean,
): Promise<Result<{ candidates: FeatureVoteCandidate[]; tally: VoteTally }>> {
  const [candRes, tallyRes] = await Promise.all([
    fetchCandidates(cycleId, { preferLocal: isClosed }),
    fetchTally(cycleId, { cacheClosed: isClosed }),
  ])
  if (!candRes.ok) return err(candRes.error)
  if (!tallyRes.ok) return err(tallyRes.error)
  return ok({ candidates: candRes.data, tally: tallyRes.data })
}

export async function fetchSuggestions(opts?: { status?: FeatureVoteSuggestionStatus; userId?: string }): Promise<Result<FeatureVoteSuggestion[]>> {
  let q = supabase.from('feature_vote_suggestions').select('*').order('created_at', { ascending: false })
  if (opts?.status) q = q.eq('status', opts.status)
  if (opts?.userId) q = q.eq('user_id', opts.userId)
  const { data, error } = await q
  if (error) {
    logger.warn('fetchSuggestions network failed, falling back to IDB', error.message)
    const local = opts?.userId
      ? await getLocalFeatureVoteSuggestionsByUser(opts.userId)
      : await getLocalFeatureVoteSuggestions()
    const filtered = opts?.status ? local.filter((s) => s.status === opts.status) : local
    return ok(
      filtered
        .map((r) => rowToSuggestion(r as unknown as Record<string, unknown>))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    )
  }
  const suggestions = ((data as Record<string, unknown>[]) ?? []).map(rowToSuggestion)
  await Promise.all(suggestions.map((s) => saveLocalFeatureVoteSuggestion(suggestionToLocal(s))))
  return ok(suggestions)
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
  clearCyclesCache()
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
  clearCyclesCache()
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
  clearClosedTally(cycleId)
  clearCyclesCache()
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
