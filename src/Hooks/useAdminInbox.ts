import { useState, useEffect, useCallback, useMemo } from 'react'
import { getAllAccountRequests, listClinics } from '../lib/adminService'
import type { AdminClinic } from '../lib/adminService'
import type { AccountRequest } from '../lib/accountRequestService'
import { fetchSuggestions, type FeatureVoteSuggestion } from '../lib/featureVotingService'
import { getFeedbackList, type FeedbackRow } from '../lib/feedbackService'
import { useInvalidation } from '../stores/useInvalidationStore'

export type FeedKind = 'request' | 'suggestion' | 'feedback'

export type FeedItem =
  | { key: string; kind: 'request'; data: AccountRequest; date: string; pendingRank: 0 | 1 }
  | { key: string; kind: 'suggestion'; data: FeatureVoteSuggestion; date: string; pendingRank: 0 | 1 }
  | { key: string; kind: 'feedback'; data: FeedbackRow; date: string; pendingRank: 0 | 1 }

export interface AdminInbox {
  /** Every triage item, pending first then newest first. Filter by kind at the
   *  render site — the fetch is shared. */
  items: FeedItem[]
  /** UIC (upper-cased) → the cluster claiming it, for the request rows' cluster
   *  match. */
  uicToClinic: Map<string, AdminClinic>
}

const matchesQuery = (item: FeedItem, q: string): boolean => {
  if (item.kind === 'request') {
    const r = item.data
    const fullName = `${r.first_name} ${r.middle_initial ?? ''} ${r.last_name}`.toLowerCase()
    return fullName.includes(q)
      || r.email.toLowerCase().includes(q)
      || (r.credential?.toLowerCase().includes(q) ?? false)
      || (r.rank?.toLowerCase().includes(q) ?? false)
      || (r.notes?.toLowerCase().includes(q) ?? false)
  }
  if (item.kind === 'suggestion') {
    const s = item.data
    return s.title.toLowerCase().includes(q)
      || (s.description?.toLowerCase().includes(q) ?? false)
  }
  const f = item.data
  return (f.display_name?.toLowerCase().includes(q) ?? false)
    || (f.comments?.toLowerCase().includes(q) ?? false)
    || (f.most_useful_feature?.toLowerCase().includes(q) ?? false)
    || (f.desired_feature?.toLowerCase().includes(q) ?? false)
    || (f.needs_improvement?.toLowerCase().includes(q) ?? false)
}

/**
 * The admin inbox's shared read — account requests, feature suggestions, and
 * user feedback merged into one sorted feed.
 *
 * WHY A HOOK AND NOT PER-SECTION STATE: the rail renders these as SEPARATE
 * labelled sections (Requests / Feedback), and each section used to own a copy
 * of this load — so painting the rail once fired the whole four-source fetch
 * twice. The sections are a grouping of one feed, so the feed loads once here
 * and each section filters it by kind.
 *
 * Approved requests never appear: they are no longer triage.
 */
export function useAdminInbox(): AdminInbox {
  const gen = useInvalidation('requests')

  const [requests, setRequests] = useState<AccountRequest[]>([])
  const [suggestions, setSuggestions] = useState<FeatureVoteSuggestion[]>([])
  const [feedback, setFeedback] = useState<FeedbackRow[]>([])
  const [clinics, setClinics] = useState<AdminClinic[]>([])

  const load = useCallback(async () => {
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
  }, [])

  useEffect(() => { load() }, [load, gen])

  const uicToClinic = useMemo(() => {
    const map = new Map<string, AdminClinic>()
    for (const clinic of clinics) {
      for (const uic of clinic.uics) map.set(uic.toUpperCase(), clinic)
    }
    return map
  }, [clinics])

  const items = useMemo<FeedItem[]>(() => {
    const merged: FeedItem[] = [
      ...requests.filter(r => r.status !== 'approved').map((r): FeedItem => ({
        key: `req-${r.id}`, kind: 'request', data: r, date: r.requested_at, pendingRank: r.status === 'pending' ? 0 : 1,
      })),
      ...suggestions.map((s): FeedItem => ({
        key: `sug-${s.id}`, kind: 'suggestion', data: s, date: s.createdAt, pendingRank: 0,
      })),
      ...feedback.map((f): FeedItem => ({
        key: `fb-${f.id}`, kind: 'feedback', data: f, date: f.created_at, pendingRank: 0,
      })),
    ]
    return merged.sort((a, b) => {
      if (a.pendingRank !== b.pendingRank) return a.pendingRank - b.pendingRank
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [requests, suggestions, feedback])

  return { items, uicToClinic }
}

/** Narrow a loaded feed to one section: the kinds it shows, matching the query. */
export function selectFeedItems(
  items: FeedItem[],
  kinds: ReadonlyArray<FeedKind>,
  searchQuery: string,
): FeedItem[] {
  const allow = new Set(kinds)
  const q = searchQuery.trim().toLowerCase()
  return items.filter(item =>
    allow.has(item.kind) && (!q || matchesQuery(item, q)),
  )
}
