import { useState, useEffect, useCallback, useMemo } from 'react'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { SectionCard } from '@/Components/primitives/Section'
import { AdminListSkeleton } from './AdminSkeletons'
import { RequestCard } from './RequestCard'
import { SuggestionCard } from './SuggestionCard'
import { FeedbackCard } from './FeedbackCard'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { getAllAccountRequests, listClinics } from '../../lib/adminService'
import type { AdminClinic } from '../../lib/adminService'
import type { AccountRequest } from '../../lib/accountRequestService'
import { fetchSuggestions, type FeatureVoteSuggestion } from '../../lib/featureVotingService'
import { getFeedbackList, type FeedbackRow } from '../../lib/feedbackService'
import { useInvalidation } from '../../stores/useInvalidationStore'

type FeedKind = 'request' | 'suggestion' | 'feedback'

interface AdminRequestsListProps {
  searchQuery?: string
  /** When true, renders items without wrapper chrome (rail sections). */
  bare?: boolean
  /** Restrict to specific item kinds. Omit for all. The admin rail renders one
   *  instance scoped to ['request'] (Requests section) and another scoped to
   *  ['suggestion','feedback'] (Feedback section) so like items group together. */
  kinds?: ReadonlyArray<FeedKind>
  /** Bare mode only: section label rendered ABOVE the items — and only when the
   *  section has items, so an empty queue (and its label) vanishes entirely. */
  bareLabel?: string
  /** Open a request in the drawer detail pane / Sheet. */
  onOpenRequest: (request: AccountRequest) => void
  /** Open a feedback row in the drawer detail pane / Sheet. */
  onOpenFeedback: (feedback: FeedbackRow) => void
  /** Open a feature suggestion in the drawer detail pane / Sheet. */
  onOpenSuggestion: (suggestion: FeatureVoteSuggestion) => void
}

export function AdminRequestsList({
  searchQuery: searchQueryProp,
  bare,
  kinds,
  bareLabel,
  onOpenRequest,
  onOpenFeedback,
  onOpenSuggestion,
}: AdminRequestsListProps) {
  const searchQuery = searchQueryProp ?? ''

  const gen = useInvalidation('requests')

  // Data
  const [requests, setRequests] = useState<AccountRequest[]>([])
  const [suggestions, setSuggestions] = useState<FeatureVoteSuggestion[]>([])
  const [feedback, setFeedback] = useState<FeedbackRow[]>([])
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [loading, setLoading] = useState(true)
  const showLoading = useMinLoadTime(loading)

  // ── Data loading ────────────────────────────────────────
  const loadRequests = useCallback(async () => {
    setLoading(true)
    const [reqData, clinicData, sugResult, fbData] = await Promise.all([
      getAllAccountRequests(),
      listClinics(),
      fetchSuggestions({ status: 'pending' }),
      getFeedbackList(),
    ])
    setRequests(reqData)
    setClinics(clinicData)
    setSuggestions(sugResult.ok ? sugResult.data : [])
    setFeedback(fbData)
    setLoading(false)
  }, [])

  useEffect(() => { loadRequests() }, [loadRequests, gen])

  // ── UIC → clinic lookup ────────────────────────────────
  const uicToClinic = useMemo(() => {
    const map = new Map<string, AdminClinic>()
    for (const clinic of clinics) {
      for (const uic of clinic.uics) map.set(uic.toUpperCase(), clinic)
    }
    return map
  }, [clinics])

  // ── Search filtering + sorting (pending first, then by date) ──
  const filteredRequests = useMemo(() => {
    let result = requests.filter(r => r.status !== 'approved')
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((r) => {
        const fullName = `${r.first_name} ${r.middle_initial ?? ''} ${r.last_name}`.toLowerCase()
        return (
          fullName.includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.credential?.toLowerCase().includes(q) ?? false) ||
          (r.rank?.toLowerCase().includes(q) ?? false) ||
          (r.notes?.toLowerCase().includes(q) ?? false)
        )
      })
    }
    return [...result].sort((a, b) => {
      const aPending = a.status === 'pending' ? 0 : 1
      const bPending = b.status === 'pending' ? 0 : 1
      if (aPending !== bPending) return aPending - bPending
      return new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    })
  }, [requests, searchQuery])

  const filteredSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return suggestions
    const q = searchQuery.toLowerCase()
    return suggestions.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      (s.description?.toLowerCase().includes(q) ?? false)
    )
  }, [suggestions, searchQuery])

  const filteredFeedback = useMemo(() => {
    if (!searchQuery.trim()) return feedback
    const q = searchQuery.toLowerCase()
    return feedback.filter((f) =>
      (f.display_name?.toLowerCase().includes(q) ?? false) ||
      (f.comments?.toLowerCase().includes(q) ?? false) ||
      (f.most_useful_feature?.toLowerCase().includes(q) ?? false) ||
      (f.desired_feature?.toLowerCase().includes(q) ?? false) ||
      (f.needs_improvement?.toLowerCase().includes(q) ?? false)
    )
  }, [feedback, searchQuery])

  type FeedItem =
    | { key: string; kind: 'request'; data: AccountRequest; date: string; pendingRank: 0 | 1 }
    | { key: string; kind: 'suggestion'; data: FeatureVoteSuggestion; date: string; pendingRank: 0 | 1 }
    | { key: string; kind: 'feedback'; data: FeedbackRow; date: string; pendingRank: 0 | 1 }

  const feedItems: FeedItem[] = useMemo(() => {
    const allow = kinds ? new Set(kinds) : null
    const req: FeedItem[] = (allow && !allow.has('request') ? [] : filteredRequests).map((r) => ({
      key: `req-${r.id}`, kind: 'request', data: r, date: r.requested_at, pendingRank: r.status === 'pending' ? 0 : 1,
    }))
    const sug: FeedItem[] = (allow && !allow.has('suggestion') ? [] : filteredSuggestions).map((s) => ({
      key: `sug-${s.id}`, kind: 'suggestion', data: s, date: s.createdAt, pendingRank: 0,
    }))
    const fb: FeedItem[] = (allow && !allow.has('feedback') ? [] : filteredFeedback).map((f) => ({
      key: `fb-${f.id}`, kind: 'feedback', data: f, date: f.created_at, pendingRank: 0,
    }))
    return [...req, ...sug, ...fb].sort((a, b) => {
      if (a.pendingRank !== b.pendingRank) return a.pendingRank - b.pendingRank
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [filteredRequests, filteredSuggestions, filteredFeedback, kinds])

  const renderFeedItem = (item: FeedItem) => {
    if (item.kind === 'request') {
      const matchedClinic = item.data.uic ? uicToClinic.get(item.data.uic.toUpperCase()) : undefined
      return <RequestCard key={item.key} request={item.data} matchedClinic={matchedClinic} onOpen={onOpenRequest} />
    }
    if (item.kind === 'suggestion') {
      return <SuggestionCard key={item.key} suggestion={item.data} onOpen={onOpenSuggestion} />
    }
    return <FeedbackCard key={item.key} feedback={item.data} onOpen={onOpenFeedback} />
  }

  // ── Bare mode: rail section. The label rides here so it only renders when the
  //    section has items — an empty queue and its label vanish entirely. ──────
  if (bare) {
    if (feedItems.length === 0) return null
    return (
      <>
        {bareLabel && (
          <div className="px-4 pt-3 pb-1.5">
            <p className="text-[10pt] font-semibold text-tertiary uppercase tracking-wider">{bareLabel}</p>
          </div>
        )}
        {feedItems.map(renderFeedItem)}
      </>
    )
  }

  return (
    <div className="pb-24">
      <div className="px-5 pt-4 pb-4">
        {showLoading ? (
          <AdminListSkeleton />
        ) : feedItems.length === 0 ? (
          <EmptyState title={searchQuery ? 'No items match your search.' : 'No pending items'} />
        ) : (
          <SectionCard className="divide-y divide-themeblue3/10">
            {feedItems.map(renderFeedItem)}
          </SectionCard>
        )}
      </div>
    </div>
  )
}
