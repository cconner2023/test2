import { useState, useEffect, useCallback, useMemo } from 'react'
import { Trash2, Eye, Mail } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { SectionCard } from '../Section'
import { ContextMenu } from '../ContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { AdminListSkeleton } from './AdminSkeletons'
import { RequestCard } from './RequestCard'
import { SuggestionCard } from './SuggestionCard'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import {
  getAllAccountRequests,
  deleteAccountRequest,
  listClinics,
  listAllUsers,
} from '../../lib/adminService'
import type { AdminClinic } from '../../lib/adminService'
import type { AccountRequest } from '../../lib/accountRequestService'
import {
  fetchSuggestions,
  adminDeleteSuggestion,
  type FeatureVoteSuggestion,
} from '../../lib/featureVotingService'
import { invalidate, useInvalidation } from '../../stores/useInvalidationStore'
import { UI_TIMING } from '../../Utilities/constants'

interface AdminRequestsListProps {
  searchQuery?: string
  /** When true, renders items without wrapper chrome (for unified search results) */
  bare?: boolean
  onApproved?: (
    userId: string,
    request: AccountRequest,
    configured: { roles: string[]; clinicId: string | null; warnings: string[] },
  ) => void
}

export function AdminRequestsList({ searchQuery: searchQueryProp, bare, onApproved }: AdminRequestsListProps) {
  const searchQuery = searchQueryProp ?? ''

  const gen = useInvalidation('requests')

  // Data
  const [requests, setRequests] = useState<AccountRequest[]>([])
  const [suggestions, setSuggestions] = useState<FeatureVoteSuggestion[]>([])
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [userEmails, setUserEmails] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const showLoading = useMinLoadTime(loading)

  // Processing state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteSuggestionId, setConfirmDeleteSuggestionId] = useState<string | null>(null)
  const [deleteProcessing, setDeleteProcessing] = useState(false)

  // Notify modal
  const [notify, setNotify] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Expand + context menu
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedSuggestionId, setExpandedSuggestionId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ requestId: string; x: number; y: number } | null>(null)

  // ── Data loading ────────────────────────────────────────
  const loadRequests = useCallback(async () => {
    setLoading(true)
    const [reqData, clinicData, userData, sugResult] = await Promise.all([
      getAllAccountRequests(),
      listClinics(),
      listAllUsers(),
      fetchSuggestions({ status: 'pending' }),
    ])
    setRequests(reqData)
    setClinics(clinicData)
    setUserEmails(new Set(userData.map(u => u.email?.toLowerCase()).filter(Boolean)))
    setSuggestions(sugResult.ok ? sugResult.data : [])
    setLoading(false)
  }, [])

  useEffect(() => { loadRequests() }, [loadRequests, gen])

  // ── UIC → clinic lookup ────────────────────────────────
  const uicToClinic = useMemo(() => {
    const map = new Map<string, AdminClinic>()
    for (const clinic of clinics) {
      for (const uic of clinic.uics) {
        map.set(uic.toUpperCase(), clinic)
      }
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

  // Pending suggestions are feedback items that share the Requests inbox.
  const filteredSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return suggestions
    const q = searchQuery.toLowerCase()
    return suggestions.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      (s.description?.toLowerCase().includes(q) ?? false)
    )
  }, [suggestions, searchQuery])

  type FeedItem =
    | { key: string; kind: 'request'; data: AccountRequest; date: string; pendingRank: 0 | 1 }
    | { key: string; kind: 'suggestion'; data: FeatureVoteSuggestion; date: string; pendingRank: 0 | 1 }

  const feedItems: FeedItem[] = useMemo(() => {
    const req: FeedItem[] = filteredRequests.map((r) => ({
      key: `req-${r.id}`,
      kind: 'request',
      data: r,
      date: r.requested_at,
      pendingRank: r.status === 'pending' ? 0 : 1,
    }))
    const sug: FeedItem[] = filteredSuggestions.map((s) => ({
      key: `sug-${s.id}`,
      kind: 'suggestion',
      data: s,
      date: s.createdAt,
      pendingRank: 0,
    }))
    return [...req, ...sug].sort((a, b) => {
      if (a.pendingRank !== b.pendingRank) return a.pendingRank - b.pendingRank
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [filteredRequests, filteredSuggestions])

  // ── Delete handler ──────────────────────────────────────
  const handleDeleteRequest = useCallback(async (requestId: string) => {
    setDeleteProcessing(true)
    const result = await deleteAccountRequest(requestId)
    if (result.success) {
      setConfirmDeleteId(null)
      setNotify({ type: 'success', message: 'Request permanently deleted' })
      await loadRequests()
      invalidate('requests')
    } else {
      setNotify({ type: 'error', message: `Failed to delete: ${result.error}` })
    }
    setDeleteProcessing(false)
  }, [loadRequests])

  const handleDeleteSuggestion = useCallback(async (suggestionId: string) => {
    setDeleteProcessing(true)
    const result = await adminDeleteSuggestion(suggestionId)
    if (result.success) {
      setConfirmDeleteSuggestionId(null)
      if (expandedSuggestionId === suggestionId) setExpandedSuggestionId(null)
      setNotify({ type: 'success', message: 'Suggestion dismissed' })
      await loadRequests()
    } else {
      setNotify({ type: 'error', message: `Failed to dismiss: ${result.error}` })
    }
    setDeleteProcessing(false)
  }, [loadRequests, expandedSuggestionId])

  // ── Context menu items for a single request ─────────────
  const buildContextItems = (ctxRequest: AccountRequest | undefined, requestId: string) => {
    if (!ctxRequest) return []
    const emailItem = ctxRequest.email ? [{
      key: 'email',
      label: 'Email',
      icon: Mail,
      onAction: () => {
        const name = ctxRequest.request_type === 'support'
          ? [ctxRequest.first_name, ctxRequest.last_name].filter(Boolean).join(' ')
          : [ctxRequest.rank, ctxRequest.last_name].filter(Boolean).join(' ')
        window.location.href = `mailto:${ctxRequest.email}?subject=${encodeURIComponent('ADTMC Web App Inquiry')}&body=${encodeURIComponent(`${name},\n\n`)}`
      },
    }] : []
    const deleteLabel = ctxRequest.request_type === 'support' ? 'Dismiss' : 'Delete'
    return [
      { key: 'view', label: 'View', icon: Eye, onAction: () => setExpandedId(requestId) },
      ...emailItem,
      { key: 'delete', label: deleteLabel, icon: Trash2, destructive: true, onAction: () => setConfirmDeleteId(requestId) },
    ]
  }

  const renderCard = (request: AccountRequest) => {
    const isRejected = request.status === 'rejected'
    const matchedClinic = request.uic ? uicToClinic.get(request.uic.toUpperCase()) : undefined
    const isExistingUser = isRejected && userEmails.has(request.email.toLowerCase())
    return (
      <RequestCard
        key={request.id}
        request={request}
        expandedId={expandedId}
        setExpandedId={setExpandedId}
        setConfirmDeleteId={setConfirmDeleteId}
        matchedClinic={matchedClinic}
        isExistingUser={isExistingUser}
        setContextMenu={setContextMenu}
        clinics={clinics}
        uicToClinic={uicToClinic}
        onApproved={onApproved}
        onRefresh={loadRequests}
      />
    )
  }

  const renderSuggestionCard = (s: FeatureVoteSuggestion) => (
    <SuggestionCard
      key={`sug-${s.id}`}
      suggestion={s}
      expandedId={expandedSuggestionId}
      setExpandedId={setExpandedSuggestionId}
      setConfirmDeleteId={setConfirmDeleteSuggestionId}
    />
  )

  const renderFeedItem = (item: FeedItem) =>
    item.kind === 'request' ? renderCard(item.data) : renderSuggestionCard(item.data)

  const renderContextMenu = () => {
    if (!contextMenu) return null
    const ctxRequest = requests.find(r => r.id === contextMenu.requestId)
    const ctxItems = buildContextItems(ctxRequest, contextMenu.requestId)
    return (
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={() => setContextMenu(null)}
        items={ctxItems}
      />
    )
  }

  const suggestionConfirmDialog = (
    <ConfirmDialog
      visible={!!confirmDeleteSuggestionId}
      title="Dismiss this suggestion?"
      subtitle="Permanent."
      confirmLabel="Dismiss"
      variant="danger"
      processing={deleteProcessing}
      onConfirm={() => { if (confirmDeleteSuggestionId) handleDeleteSuggestion(confirmDeleteSuggestionId) }}
      onCancel={() => setConfirmDeleteSuggestionId(null)}
    />
  )

  const notifyDialog = (
    <ConfirmDialog
      visible={!!notify}
      title={notify?.message ?? ''}
      variant={notify?.type === 'success' ? 'success' : 'danger'}
      notifyOnly
      autoDismissMs={UI_TIMING.FEEDBACK_DURATION}
      onCancel={() => setNotify(null)}
    />
  )

  // ── Bare mode: just the items (no wrapper chrome) ──────
  if (bare) {
    if (feedItems.length === 0) return null
    return (
      <>
        {feedItems.map(renderFeedItem)}
        {renderContextMenu()}
        <ConfirmDialog
          visible={!!confirmDeleteId}
          title="Delete this request?"
          subtitle="Permanent."
          confirmLabel="Delete"
          variant="danger"
          processing={deleteProcessing}
          onConfirm={() => { if (confirmDeleteId) handleDeleteRequest(confirmDeleteId) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
        {suggestionConfirmDialog}
        {notifyDialog}
      </>
    )
  }

  return (
    <div className="pb-24">
      <div className="px-5 pt-4 pb-4">
        {showLoading ? (
          <AdminListSkeleton />
        ) : feedItems.length === 0 ? (
          <EmptyState title={searchQuery ? 'No requests match your search' : 'No requests found'} />
        ) : (
          <SectionCard className="divide-y divide-themeblue3/10">
            {feedItems.map(renderFeedItem)}
          </SectionCard>
        )}
      </div>

      {renderContextMenu()}

      <ConfirmDialog
        visible={!!confirmDeleteId}
        title="Permanently delete this request?"
        subtitle="Permanent."
        confirmLabel="Delete"
        variant="danger"
        processing={deleteProcessing}
        onConfirm={() => { if (confirmDeleteId) handleDeleteRequest(confirmDeleteId) }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {suggestionConfirmDialog}
      {notifyDialog}
    </div>
  )
}
