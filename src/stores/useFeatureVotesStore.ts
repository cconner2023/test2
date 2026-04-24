/**
 * Zustand store for feature voting.
 *
 * Tracks the active voting cycle, its candidates, the current user's vote
 * (mutable), the tally (revealed post-vote), and suggestions.
 *
 * Offline-first: reads hydrate from Supabase when online, else from IDB.
 * Writes go through featureVotingService and are queued by syncService.
 */

import { create } from 'zustand'
import {
  fetchActiveCycle,
  fetchCandidates,
  fetchUserVote,
  fetchTally,
  fetchSuggestions,
  submitVote as serviceSubmitVote,
  submitSuggestion as serviceSubmitSuggestion,
  type FeatureVoteCycle,
  type FeatureVoteCandidate,
  type FeatureVote,
  type FeatureVoteSuggestion,
  type VoteTally,
} from '../lib/featureVotingService'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('FeatureVotesStore')

const DISMISS_PROMPT_KEY_PREFIX = 'featureVote.promptDismissed'
const OTHER_VOTE_KEY_PREFIX = 'featureVote.otherVote'

/**
 * Sentinel candidate id for the client-side "Other — share feedback" tile.
 * Not a DB row — userVote with this candidateId is a local-only marker meaning
 * "this user submitted feedback for this cycle instead of picking a candidate".
 */
export const OTHER_CANDIDATE_ID = '__other__'

interface FeatureVotesState {
  activeCycle: FeatureVoteCycle | null
  candidates: FeatureVoteCandidate[]
  userVote: FeatureVote | null
  tally: VoteTally
  mySuggestions: FeatureVoteSuggestion[]
  /** All suggestions (dev only — fetched by admin UI). */
  allSuggestions: FeatureVoteSuggestion[]
  loading: boolean
  error: string | null
  /** Per-session flag tracking whether the login prompt has been dismissed. */
  promptDismissedThisCycle: boolean
}

interface FeatureVotesActions {
  hydrate: (userId: string) => Promise<void>
  refreshTally: () => Promise<void>
  refreshMySuggestions: (userId: string) => Promise<void>
  refreshAllSuggestions: () => Promise<void>
  submitVote: (candidateId: string, userId: string) => Promise<{ success: boolean; error?: string }>
  submitSuggestion: (params: { userId: string; title: string; description?: string }) => Promise<{ success: boolean; error?: string }>
  dismissPromptForCycle: (cycleId: string) => void
  loadPromptDismissedForCycle: (cycleId: string) => void
  /** Mark the active cycle engaged via feedback — toggles the synthetic OTHER vote locally. */
  markFeedbackEngagement: (userId: string) => void
  reset: () => void
}

const initialState: FeatureVotesState = {
  activeCycle: null,
  candidates: [],
  userVote: null,
  tally: {},
  mySuggestions: [],
  allSuggestions: [],
  loading: false,
  error: null,
  promptDismissedThisCycle: false,
}

export const useFeatureVotesStore = create<FeatureVotesState & FeatureVotesActions>()((set, get) => ({
  ...initialState,

  hydrate: async (userId) => {
    set({ loading: true, error: null })
    try {
      const cycleResult = await fetchActiveCycle()
      if (!cycleResult.ok) {
        set({ loading: false, error: cycleResult.error })
        return
      }
      const cycle = cycleResult.data
      if (!cycle) {
        set({ activeCycle: null, candidates: [], userVote: null, tally: {}, mySuggestions: [], loading: false })
        return
      }

      const [candRes, voteRes, mySuggRes] = await Promise.all([
        fetchCandidates(cycle.id),
        fetchUserVote(cycle.id, userId),
        fetchSuggestions({ userId }),
      ])

      const candidates = candRes.ok ? candRes.data : []
      let userVote = voteRes.ok ? voteRes.data : null
      const mySuggestions = mySuggRes.ok ? mySuggRes.data : []

      // Restore local OTHER vote (feedback-as-vote) if previously persisted for this cycle.
      if (!userVote) {
        try {
          const stored = localStorage.getItem(`${OTHER_VOTE_KEY_PREFIX}.${cycle.id}`)
          if (stored === '1') {
            const now = new Date().toISOString()
            userVote = {
              id: `__other_local_${cycle.id}`,
              cycleId: cycle.id,
              candidateId: OTHER_CANDIDATE_ID,
              userId,
              createdAt: now,
              updatedAt: now,
            }
          }
        } catch { /* ignore */ }
      }

      // Only reveal tally if the user has already voted (hide-until-voted rule).
      let tally: VoteTally = {}
      if (userVote) {
        const tallyRes = await fetchTally(cycle.id)
        if (tallyRes.ok) tally = tallyRes.data
      }

      set({
        activeCycle: cycle,
        candidates,
        userVote,
        tally,
        mySuggestions,
        loading: false,
      })

      get().loadPromptDismissedForCycle(cycle.id)
    } catch (e) {
      logger.warn('hydrate failed', e)
      set({ loading: false, error: e instanceof Error ? e.message : String(e) })
    }
  },

  refreshTally: async () => {
    const cycle = get().activeCycle
    if (!cycle) return
    const result = await fetchTally(cycle.id)
    if (result.ok) set({ tally: result.data })
  },

  refreshMySuggestions: async (userId) => {
    const result = await fetchSuggestions({ userId })
    if (result.ok) set({ mySuggestions: result.data })
  },

  refreshAllSuggestions: async () => {
    const result = await fetchSuggestions()
    if (result.ok) set({ allSuggestions: result.data })
  },

  submitVote: async (candidateId, userId) => {
    const cycle = get().activeCycle
    if (!cycle) return { success: false, error: 'No active voting cycle' }

    const result = await serviceSubmitVote({ cycleId: cycle.id, candidateId, userId })
    if (!result.success) return { success: false, error: result.error }

    // Optimistically update state and refresh tally
    set({ userVote: result.vote })
    await get().refreshTally()
    return { success: true }
  },

  submitSuggestion: async ({ userId, title, description }) => {
    const cycle = get().activeCycle
    const result = await serviceSubmitSuggestion({
      userId,
      title,
      description,
      cycleId: cycle?.id ?? null,
    })
    if (!result.success) return { success: false, error: result.error }

    set((s) => ({ mySuggestions: [result.suggestion, ...s.mySuggestions] }))
    return { success: true }
  },

  dismissPromptForCycle: (cycleId) => {
    try {
      sessionStorage.setItem(`${DISMISS_PROMPT_KEY_PREFIX}.${cycleId}`, '1')
    } catch { /* ignore */ }
    set({ promptDismissedThisCycle: true })
  },

  loadPromptDismissedForCycle: (cycleId) => {
    try {
      const dismissed = sessionStorage.getItem(`${DISMISS_PROMPT_KEY_PREFIX}.${cycleId}`) === '1'
      set({ promptDismissedThisCycle: dismissed })
    } catch {
      set({ promptDismissedThisCycle: false })
    }
  },

  markFeedbackEngagement: (userId) => {
    const cycle = get().activeCycle
    if (!cycle) return
    const now = new Date().toISOString()
    const syntheticVote: FeatureVote = {
      id: `__other_local_${cycle.id}`,
      cycleId: cycle.id,
      candidateId: OTHER_CANDIDATE_ID,
      userId,
      createdAt: now,
      updatedAt: now,
    }
    try {
      localStorage.setItem(`${OTHER_VOTE_KEY_PREFIX}.${cycle.id}`, '1')
      sessionStorage.setItem(`${DISMISS_PROMPT_KEY_PREFIX}.${cycle.id}`, '1')
    } catch { /* ignore */ }
    set({ userVote: syntheticVote, promptDismissedThisCycle: true })
    // Reveal tally now that user has engaged.
    void get().refreshTally()
  },

  reset: () => set(initialState),
}))

/** True when the user has already engaged with the active cycle — voted or submitted a suggestion for it. */
const hasEngagedWithActiveCycle = (s: FeatureVotesState) => {
  if (!s.activeCycle) return false
  if (s.userVote) return true
  return s.mySuggestions.some((sg) => sg.cycleId === s.activeCycle!.id)
}

/** Selector — true when there's an open cycle and the user hasn't voted or suggested yet. */
export const selectHasUnvotedActiveCycle = (s: FeatureVotesState) =>
  !!s.activeCycle && !hasEngagedWithActiveCycle(s)

/** Selector — true when the toast should render (open cycle, no engagement, not dismissed this session). */
export const selectShouldShowPrompt = (s: FeatureVotesState) =>
  !!s.activeCycle && !hasEngagedWithActiveCycle(s) && !s.promptDismissedThisCycle
