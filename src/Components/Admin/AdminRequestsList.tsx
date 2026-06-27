import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { Trash2, Eye, Mail, MessageCircle } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { SectionCard } from '../Section'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { Z } from '../BaseOverlay'
import { AdminListSkeleton } from './AdminSkeletons'
import { RequestCard } from './RequestCard'
import { SuggestionCard } from './SuggestionCard'
import { FeedbackCard } from './FeedbackCard'
import { SystemMessageComposePopover } from './SystemMessageComposePopover'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { useMessagesContext } from '../../Hooks/MessagesContext'
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
import { getFeedbackList, deleteFeedback, type FeedbackRow } from '../../lib/feedbackService'
import { buildMailtoHref } from '../../lib/mailto'
import { invalidate, useInvalidation } from '../../stores/useInvalidationStore'
import { UI_TIMING } from '../../Utilities/constants'

type FeedKind = 'request' | 'suggestion' | 'feedback'

interface AdminRequestsListProps {
  searchQuery?: string
  /** When true, renders items without wrapper chrome (for unified search results) */
  bare?: boolean
  /** Restrict to specific item kinds. Omit for all. The admin rail renders one
   *  instance scoped to ['request'] (Requests section) and another scoped to
   *  ['suggestion','feedback'] (Feedback section) so like items group together. */
  kinds?: ReadonlyArray<FeedKind>
  /** Bare mode only: render this muted line when there are no items, instead of
   *  collapsing to null. Keeps a labelled rail section reading intentionally. */
  bareEmptyText?: string
  /** When true, renders as a labelled section inside the unified search results:
   *  page-padding-free, collapses to null on an empty search. */
  embedded?: boolean
  /** Section heading shown above the list in embedded mode. */
  title?: string
  onApproved?: (
    userId: string,
    request: AccountRequest,
    configured: { roles: string[]; clinicId: string | null; warnings: string[] },
  ) => void
}

export function AdminRequestsList({ searchQuery: searchQueryProp, bare, embedded, title, kinds, bareEmptyText, onApproved }: AdminRequestsListProps) {
  const searchQuery = searchQueryProp ?? ''

  const gen = useInvalidation('requests')

  // Data
  const [requests, setRequests] = useState<AccountRequest[]>([])
  const [suggestions, setSuggestions] = useState<FeatureVoteSuggestion[]>([])
  const [feedback, setFeedback] = useState<FeedbackRow[]>([])
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [userEmails, setUserEmails] = useState<Set<string>>(new Set())
  const [userIdToEmail, setUserIdToEmail] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const showLoading = useMinLoadTime(loading)

  // Processing state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteSuggestionId, setConfirmDeleteSuggestionId] = useState<string | null>(null)
  const [confirmDeleteFeedbackId, setConfirmDeleteFeedbackId] = useState<string | null>(null)
  const [deleteProcessing, setDeleteProcessing] = useState(false)

  // Notify modal
  const [notify, setNotify] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Expand + context menu
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedSuggestionId, setExpandedSuggestionId] = useState<string | null>(null)
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null)
  // In-app system-message compose target (feedback author). anchorRect positions
  // the popover — card rect from the footer Chat action, cursor point from the
  // context menu. Only set for authed feedback (user_id) when messaging exists.
  const [chatTarget, setChatTarget] = useState<{ feedback: FeedbackRow; anchorRect: DOMRect | null } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ requestId: string; rect: DOMRect; clone: ReactNode } | null>(null)
  const [feedbackContextMenu, setFeedbackContextMenu] = useState<{ feedbackId: string; rect: DOMRect; clone: ReactNode } | null>(null)

  const messagesCtx = useMessagesContext()

  // ── Data loading ────────────────────────────────────────
  const loadRequests = useCallback(async () => {
    setLoading(true)
    const [reqData, clinicData, userData, sugResult, fbData] = await Promise.all([
      getAllAccountRequests(),
      listClinics(),
      listAllUsers(),
      fetchSuggestions({ status: 'pending' }),
      getFeedbackList(),
    ])
    setRequests(reqData)
    setClinics(clinicData)
    setUserEmails(new Set(userData.map(u => u.email?.toLowerCase()).filter(Boolean)))
    setUserIdToEmail(new Map(userData.filter(u => u.email).map(u => [u.id, u.email as string])))
    setSuggestions(sugResult.ok ? sugResult.data : [])
    setFeedback(fbData)
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
      key: `req-${r.id}`,
      kind: 'request',
      data: r,
      date: r.requested_at,
      pendingRank: r.status === 'pending' ? 0 : 1,
    }))
    const sug: FeedItem[] = (allow && !allow.has('suggestion') ? [] : filteredSuggestions).map((s) => ({
      key: `sug-${s.id}`,
      kind: 'suggestion',
      data: s,
      date: s.createdAt,
      pendingRank: 0,
    }))
    const fb: FeedItem[] = (allow && !allow.has('feedback') ? [] : filteredFeedback).map((f) => ({
      key: `fb-${f.id}`,
      kind: 'feedback',
      data: f,
      date: f.created_at,
      pendingRank: 0,
    }))
    return [...req, ...sug, ...fb].sort((a, b) => {
      if (a.pendingRank !== b.pendingRank) return a.pendingRank - b.pendingRank
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [filteredRequests, filteredSuggestions, filteredFeedback, kinds])

  // ── Delete handler ──────────────────────────────────────
  const handleDeleteRequest = useCallback(async (requestId: string) => {
    setDeleteProcessing(true)
    const result = await deleteAccountRequest(requestId)
    if (result.success) {
      setConfirmDeleteId(null)
      // Bust the requests cache BEFORE reloading, else loadRequests re-serves
      // the stale (pre-delete) getAllAccountRequests entry.
      invalidate('requests')
      await loadRequests()
    } else {
      setNotify({ type: 'error', message: `Failed to delete: ${result.error}` })
    }
    setDeleteProcessing(false)
  }, [loadRequests])

  const handleDeleteFeedback = useCallback(async (feedbackId: string) => {
    setDeleteProcessing(true)
    const result = await deleteFeedback(feedbackId)
    if (result.success) {
      setConfirmDeleteFeedbackId(null)
      if (expandedFeedbackId === feedbackId) setExpandedFeedbackId(null)
      await loadRequests()
    } else {
      setNotify({ type: 'error', message: `Failed to delete: ${result.error}` })
    }
    setDeleteProcessing(false)
  }, [loadRequests, expandedFeedbackId])

  const handleDeleteSuggestion = useCallback(async (suggestionId: string) => {
    setDeleteProcessing(true)
    const result = await adminDeleteSuggestion(suggestionId)
    if (result.success) {
      setConfirmDeleteSuggestionId(null)
      if (expandedSuggestionId === suggestionId) setExpandedSuggestionId(null)
      await loadRequests()
    } else {
      setNotify({ type: 'error', message: `Failed to dismiss: ${result.error}` })
    }
    setDeleteProcessing(false)
  }, [loadRequests, expandedSuggestionId])

  // ── Context menu items for a single request ─────────────
  const buildContextItems = (ctxRequest: AccountRequest | undefined, requestId: string) => {
    if (!ctxRequest) return []
    const emailName = ctxRequest.request_type === 'support'
      ? [ctxRequest.first_name, ctxRequest.last_name].filter(Boolean).join(' ')
      : [ctxRequest.rank, ctxRequest.last_name].filter(Boolean).join(' ')
    const emailItem = ctxRequest.email ? [{
      key: 'email',
      label: 'Email',
      icon: Mail,
      href: buildMailtoHref({ to: ctxRequest.email, subject: '[inquiry] -  Medical Operations Web Application', body: `${emailName},\n\n` }),
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

  const renderFeedbackCard = (f: FeedbackRow) => (
    <FeedbackCard
      key={`fb-${f.id}`}
      feedback={f}
      email={f.user_id ? userIdToEmail.get(f.user_id) ?? null : null}
      expandedId={expandedFeedbackId}
      setExpandedId={setExpandedFeedbackId}
      setConfirmDeleteId={setConfirmDeleteFeedbackId}
      setContextMenu={setFeedbackContextMenu}
      onChat={messagesCtx && f.user_id ? (rect) => setChatTarget({ feedback: f, anchorRect: rect }) : undefined}
    />
  )

  const renderFeedItem = (item: FeedItem) => {
    if (item.kind === 'request') return renderCard(item.data)
    if (item.kind === 'suggestion') return renderSuggestionCard(item.data)
    return renderFeedbackCard(item.data)
  }

  const renderContextMenu = () => {
    if (!contextMenu) return null
    const ctxRequest = requests.find(r => r.id === contextMenu.requestId)
    const ctxItems = buildContextItems(ctxRequest, contextMenu.requestId)
    return (
      <LiftedRowMenu
        isOpen
        layout="list"
        anchorRect={contextMenu.rect}
        onClose={() => setContextMenu(null)}
        items={ctxItems}
        row={contextMenu.clone}
      />
    )
  }

  const renderFeedbackContextMenu = () => {
    if (!feedbackContextMenu) return null
    const ctxFeedback = feedback.find(f => f.id === feedbackContextMenu.feedbackId)
    if (!ctxFeedback) return null
    const ctxEmail = ctxFeedback.user_id ? userIdToEmail.get(ctxFeedback.user_id) ?? null : null
    const emailItem = ctxEmail ? [{
      key: 'email',
      label: 'Email',
      icon: Mail,
      href: buildMailtoHref({ to: ctxEmail, subject: '[feedback] -  Medical Operations Web Application', body: `${ctxFeedback.display_name || ''},\n\nThanks for the feedback.\n\n` }),
    }] : []
    const chatItem = (messagesCtx && ctxFeedback.user_id) ? [{
      key: 'chat',
      label: 'Chat',
      icon: MessageCircle,
      onAction: () => setChatTarget({
        feedback: ctxFeedback,
        anchorRect: feedbackContextMenu.rect,
      }),
    }] : []
    const items = [
      { key: 'view', label: 'View', icon: Eye, onAction: () => setExpandedFeedbackId(ctxFeedback.id) },
      ...emailItem,
      ...chatItem,
      { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setConfirmDeleteFeedbackId(ctxFeedback.id) },
    ]
    return (
      <LiftedRowMenu
        isOpen
        layout="list"
        anchorRect={feedbackContextMenu.rect}
        onClose={() => setFeedbackContextMenu(null)}
        items={items}
        row={feedbackContextMenu.clone}
      />
    )
  }

  // Cards open via PreviewOverlay (Z.POPOVER); the Delete pill inside their footer
  // triggers these dialogs, which render here as siblings — outside the overlay's
  // React subtree, so they don't inherit the parent-ceiling bump. Pin above POPOVER.
  const confirmZ = Z.POPOVER + 30

  const feedbackConfirmDialog = (
    <ConfirmDialog
      visible={!!confirmDeleteFeedbackId}
      title="Delete this feedback?"
      subtitle="Permanent."
      confirmLabel="Delete"
      variant="danger"
      processing={deleteProcessing}
      zIndex={confirmZ}
      onConfirm={() => { if (confirmDeleteFeedbackId) handleDeleteFeedback(confirmDeleteFeedbackId) }}
      onCancel={() => setConfirmDeleteFeedbackId(null)}
    />
  )

  const suggestionConfirmDialog = (
    <ConfirmDialog
      visible={!!confirmDeleteSuggestionId}
      title="Dismiss this suggestion?"
      subtitle="Permanent."
      confirmLabel="Dismiss"
      variant="danger"
      processing={deleteProcessing}
      zIndex={confirmZ}
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
      zIndex={confirmZ}
      onCancel={() => setNotify(null)}
    />
  )

  const chatComposePopover = messagesCtx && chatTarget ? (
    <SystemMessageComposePopover
      anchorRect={chatTarget.anchorRect}
      title={`Message ${chatTarget.feedback.display_name || 'user'}`}
      onClose={() => setChatTarget(null)}
      onSend={async (text) => {
        const uid = chatTarget.feedback.user_id
        if (!uid) return false
        const sent = await messagesCtx.sendSystemMessageToUser(uid, text)
        if (!sent) setNotify({ type: 'error', message: "Couldn't send — user may not have signed in yet." })
        return sent
      }}
    />
  ) : null

  // ── Embedded mode: labelled section inside the unified search results ──
  if (embedded) {
    // Collapse to nothing when a search yields no matches, so the results view
    // doesn't stack a "No items" card for a single-section hit.
    if (feedItems.length === 0 && searchQuery) return null
    return (
      <section className="space-y-2">
        {title && (
          <div className="flex items-baseline justify-between px-1">
            <h3 className="text-[11pt] font-semibold text-primary">{title}</h3>
            <span className="text-[9pt] text-tertiary">{feedItems.length}</span>
          </div>
        )}
        {showLoading ? (
          <AdminListSkeleton />
        ) : feedItems.length === 0 ? (
          <EmptyState title="No pending items" />
        ) : (
          <SectionCard className="divide-y divide-themeblue3/10">
            {feedItems.map(renderFeedItem)}
          </SectionCard>
        )}
        {renderContextMenu()}
        {renderFeedbackContextMenu()}
        <ConfirmDialog
          visible={!!confirmDeleteId}
          title="Delete this request?"
          subtitle="Permanent."
          confirmLabel="Delete"
          variant="danger"
          processing={deleteProcessing}
          zIndex={confirmZ}
          onConfirm={() => { if (confirmDeleteId) handleDeleteRequest(confirmDeleteId) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
        {suggestionConfirmDialog}
        {feedbackConfirmDialog}
        {chatComposePopover}
        {notifyDialog}
      </section>
    )
  }

  // ── Bare mode: just the items (no wrapper chrome) ──────
  if (bare) {
    if (feedItems.length === 0) {
      if (!bareEmptyText) return null
      return (
        <p className="px-4 py-2.5 text-[9.5pt] text-tertiary">{bareEmptyText}</p>
      )
    }
    return (
      <>
        {feedItems.map(renderFeedItem)}
        {renderContextMenu()}
        {renderFeedbackContextMenu()}
        <ConfirmDialog
          visible={!!confirmDeleteId}
          title="Delete this request?"
          subtitle="Permanent."
          confirmLabel="Delete"
          variant="danger"
          processing={deleteProcessing}
          zIndex={confirmZ}
          onConfirm={() => { if (confirmDeleteId) handleDeleteRequest(confirmDeleteId) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
        {suggestionConfirmDialog}
        {feedbackConfirmDialog}
        {chatComposePopover}
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
            <EmptyState title={searchQuery ? 'No items match your search.' : 'No pending items'} />
        ) : (
          <SectionCard className="divide-y divide-themeblue3/10">
            {feedItems.map(renderFeedItem)}
          </SectionCard>
        )}
      </div>

      {renderContextMenu()}
      {renderFeedbackContextMenu()}

      <ConfirmDialog
        visible={!!confirmDeleteId}
        title="Permanently delete this request?"
        subtitle="Permanent."
        confirmLabel="Delete"
        variant="danger"
        processing={deleteProcessing}
        zIndex={confirmZ}
        onConfirm={() => { if (confirmDeleteId) handleDeleteRequest(confirmDeleteId) }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {suggestionConfirmDialog}
      {feedbackConfirmDialog}
      {chatComposePopover}
      {notifyDialog}
    </div>
  )
}
