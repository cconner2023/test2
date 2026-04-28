/**
 * FeatureVotesPanel — user-facing voting UI.
 *
 * - Section header is the cycle title
 * - Tapping a candidate submits (or re-submits) the vote immediately
 * - Tally is hidden until the user has voted
 * - An "Other" tile at the bottom routes to the Feedback panel — submitting
 *   feedback flips the local vote to a synthetic OTHER marker (see store)
 */

import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, MessageCircleQuestion, MessageSquare } from 'lucide-react'
import { useAuthStore } from '../../stores/useAuthStore'
import { useFeatureVotesStore, OTHER_CANDIDATE_ID } from '../../stores/useFeatureVotesStore'
import { ErrorDisplay } from '../ErrorDisplay'
import { EmptyState } from '../EmptyState'

interface Props {
  onOpenFeedback: () => void
}

export const FeatureVotesPanel = ({ onOpenFeedback }: Props) => {
  const userId = useAuthStore((s) => s.user?.id)
  const isAuthenticated = useAuthStore((s) => !!s.user)

  const activeCycle = useFeatureVotesStore((s) => s.activeCycle)
  const candidates = useFeatureVotesStore((s) => s.candidates)
  const userVote = useFeatureVotesStore((s) => s.userVote)
  const tally = useFeatureVotesStore((s) => s.tally)
  const loading = useFeatureVotesStore((s) => s.loading)

  const hydrate = useFeatureVotesStore((s) => s.hydrate)
  const submitVote = useFeatureVotesStore((s) => s.submitVote)

  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    hydrate(userId)
  }, [userId, hydrate])

  const totalVotes = useMemo(
    () => Object.values(tally).reduce((sum, n) => sum + n, 0),
    [tally]
  )

  const hasVoted = !!userVote
  const votedOther = userVote?.candidateId === OTHER_CANDIDATE_ID

  const handleSelectCandidate = async (candidateId: string) => {
    if (!userId) return
    if (userVote?.candidateId === candidateId) return
    setSubmittingId(candidateId)
    setVoteError(null)
    const result = await submitVote(candidateId, userId)
    setSubmittingId(null)
    if (!result.success) {
      setVoteError(result.error ?? 'Failed to submit vote')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="px-5 py-8">
          <EmptyState
            variant="gate"
            icon={<MessageCircleQuestion size={28} />}
            title="Sign in to vote"
            subtitle="Feature voting is available to signed-in users."
          />
        </div>
      </div>
    )
  }

  if (loading && !activeCycle) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="px-5 py-8 flex items-center justify-center text-tertiary">
          <Loader2 size={18} className="animate-spin mr-2" />
          <span className="text-sm">Loading voting cycle…</span>
        </div>
      </div>
    )
  }

  if (!activeCycle) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="px-5 py-8">
          <EmptyState
            variant="gate"
            icon={<MessageCircleQuestion size={28} />}
            title="No active voting cycle"
            subtitle="Check back soon — new voting opens up regularly."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 space-y-5">

        {voteError && <ErrorDisplay message={voteError} />}

        {/* Candidates list + Other tile */}
        <div>
          <div className="mb-2">
            <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider truncate">
              {activeCycle.title}
            </p>
            {activeCycle.description && (
              <p className="text-[9pt] text-tertiary mt-0.5">{activeCycle.description}</p>
            )}
          </div>

          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-themeblue3/10">
            {candidates.map((c) => {
              const voteCount = tally[c.id] ?? 0
              const pct = hasVoted && totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0
              const isMyVote = userVote?.candidateId === c.id
              const isSubmitting = submittingId === c.id

              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectCandidate(c.id)}
                  disabled={isSubmitting}
                  className={`relative w-full px-4 py-3.5 text-left transition-all active:scale-[0.99] hover:bg-themeblue2/5 ${
                    isMyVote ? 'bg-themeblue2/10' : ''
                  }`}
                >
                  {hasVoted && (
                    <div
                      className="absolute inset-y-0 left-0 bg-themeblue2/10 transition-all"
                      style={{ width: `${pct}%` }}
                      aria-hidden="true"
                    />
                  )}
                  <div className="relative flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded-full shrink-0 border-2 flex items-center justify-center mt-0.5 ${
                        isMyVote ? 'border-themeblue2 bg-themeblue2' : 'border-tertiary/30'
                      }`}
                    >
                      {isSubmitting ? (
                        <Loader2 size={12} className="animate-spin text-themeblue2" />
                      ) : isMyVote ? (
                        <Check size={12} className="text-white" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{c.title}</p>
                      {c.description && (
                        <p className="text-[9pt] text-tertiary mt-0.5">{c.description}</p>
                      )}
                    </div>
                    {hasVoted && (
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-primary">{pct}%</p>
                        <p className="text-[9pt] text-tertiary">{voteCount} vote{voteCount === 1 ? '' : 's'}</p>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}

            {/* Other — routes to Feedback; selected state means user submitted feedback */}
            <button
              onClick={onOpenFeedback}
              className={`relative w-full px-4 py-3.5 text-left transition-all active:scale-[0.99] hover:bg-themeblue2/5 ${
                votedOther ? 'bg-themeblue2/10' : ''
              }`}
            >
              <div className="relative flex items-start gap-3">
                <div
                  className={`w-5 h-5 rounded-full shrink-0 border-2 flex items-center justify-center mt-0.5 ${
                    votedOther ? 'border-themeblue2 bg-themeblue2' : 'border-tertiary/30'
                  }`}
                >
                  {votedOther ? <Check size={12} className="text-white" /> : null}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">Other</p>
                    <p className="text-[9pt] text-tertiary mt-0.5">
                      {votedOther ? 'Thanks — your feedback was recorded.' : 'Something else in mind? Share feedback.'}
                    </p>
                  </div>
                  <MessageSquare size={14} className="text-tertiary shrink-0" />
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
