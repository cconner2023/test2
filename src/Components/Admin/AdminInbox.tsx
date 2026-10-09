import { useMemo, type ReactNode } from 'react'
import { Clock, UserCheck, X, HelpCircle, MessageSquare, Lightbulb, Star, type LucideIcon } from 'lucide-react'
import { ListItemRow } from '@/Components/primitives/ListItemRow'
import { ListGroupLabel } from '@/Components/primitives/Section'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { UserAvatar } from '../Settings/UserAvatar'
import { getDisplayName } from '../../Utilities/nameUtils'
import { SYSTEM_USER_ID } from '../../lib/signal/systemIdentity'
import { selectFeedItems, type AdminInbox as InboxData, type FeedItem } from '../../Hooks/useAdminInbox'
import type { AdminSystemConversation } from '../../Hooks/useAdminSystemConversations'
import type { AccountRequest } from '../../lib/accountRequestService'
import type { FeedbackRow } from '../../lib/feedbackService'
import type { FeatureVoteSuggestion } from '../../lib/featureVotingService'

interface AdminInboxProps {
  inbox: InboxData
  threads: AdminSystemConversation[]
  searchQuery: string
  /** Feed key of the open item (`req-…`, `fb-…`, `sug-…`, `sys-…`) — gets the selection rail. */
  activeKey: string | null
  onOpenRequest: (request: AccountRequest) => void
  onOpenFeedback: (feedback: FeedbackRow) => void
  onOpenSuggestion: (suggestion: FeatureVoteSuggestion) => void
  onOpenThread: (peerId: string) => void
}

const REQUEST_KINDS = ['request'] as const
// Suggestions and feedback share a section: both are "a user told us something".
const FEEDBACK_KINDS = ['suggestion', 'feedback'] as const

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Literal class pairs — Tailwind can't see interpolated colour names.
const TONES = {
  blue: ['bg-themeblue2/10', 'text-themeblue2'],
  yellow: ['bg-themeyellow/10', 'text-themeyellow'],
  green: ['bg-themegreen/10', 'text-themegreen'],
  red: ['bg-themeredred/10', 'text-themeredred'],
} as const
type Tone = keyof typeof TONES

function Glyph({ icon: Icon, tone }: { icon: LucideIcon; tone: Tone }) {
  const [bg, fg] = TONES[tone]
  return (
    <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
      <Icon size={16} className={fg} />
    </span>
  )
}

function Lines({ title, lines, extra }: { title: ReactNode; lines: (string | null | undefined)[]; extra?: ReactNode }) {
  return (
    <>
      <p className="text-[10pt] font-medium text-primary truncate">{title}</p>
      {extra}
      {lines.filter(Boolean).map((l, i) => <p key={i} className="text-[9pt] text-tertiary mt-0.5 truncate">{l}</p>)}
    </>
  )
}

const REQUEST_GLYPH: Record<string, { icon: LucideIcon; tone: Tone }> = {
  support: { icon: HelpCircle, tone: 'blue' },
  pending: { icon: Clock, tone: 'yellow' },
  approved: { icon: UserCheck, tone: 'green' },
  rejected: { icon: X, tone: 'red' },
}

/**
 * The admin triage queue — account requests, user feedback + suggestions, and
 * dev↔user system threads, as labelled sections of one list. A section renders
 * only when it has items; presence is the signal. Every row opens its detail
 * in the drawer's detail pane / sheet, where its actions live.
 */
export function AdminInbox({
  inbox,
  threads,
  searchQuery,
  activeKey,
  onOpenRequest,
  onOpenFeedback,
  onOpenSuggestion,
  onOpenThread,
}: AdminInboxProps) {
  const q = searchQuery.trim().toLowerCase()
  const requests = useMemo(() => selectFeedItems(inbox.items, REQUEST_KINDS, q), [inbox.items, q])
  const feedback = useMemo(() => selectFeedItems(inbox.items, FEEDBACK_KINDS, q), [inbox.items, q])
  const visibleThreads = useMemo(() => !q ? threads : threads.filter(t =>
    (t.peerProfile ? getDisplayName(t.peerProfile) : '').toLowerCase().includes(q)
    || (t.lastMessage.plaintext ?? '').toLowerCase().includes(q),
  ), [threads, q])

  const row = (key: string, onClick: () => void, left: ReactNode, center: ReactNode, right?: ReactNode) => (
    <ListItemRow
      key={key}
      onClick={onClick}
      left={left}
      center={center}
      right={right}
      className={`px-4 py-3 border-l-2 transition-colors select-none ${
        activeKey === key ? 'border-l-themeblue3 bg-themeblue3/8' : 'border-l-transparent hover:bg-secondary/5'
      }`}
    />
  )

  const feedRow = (item: FeedItem) => {
    if (item.kind === 'request') {
      const r = item.data
      const isSupport = r.request_type === 'support'
      const glyph = REQUEST_GLYPH[isSupport ? 'support' : r.status] ?? REQUEST_GLYPH.rejected
      const cluster = r.uic ? inbox.uicToClinic.get(r.uic.toUpperCase()) : undefined
      return row(item.key, () => onOpenRequest(r), <Glyph {...glyph} />, isSupport
        ? <Lines title={[r.first_name, r.last_name].filter(Boolean).join(' ')} lines={[r.email, r.notes]} />
        : <Lines
            title={[r.rank, r.first_name, r.middle_initial, r.last_name].filter(Boolean).join(' ')}
            lines={[
              [r.credential, r.email].filter(Boolean).join(' · '),
              r.uic ? `${r.uic} · ${cluster ? cluster.name : 'No cluster match'}` : r.notes,
            ]}
          />)
    }
    if (item.kind === 'suggestion') {
      const s = item.data
      return row(item.key, () => onOpenSuggestion(s), <Glyph icon={Lightbulb} tone="yellow" />,
        <Lines title={s.title} lines={['Feature suggestion', s.description]} />)
    }
    const f = item.data
    const summary = f.comments || f.most_useful_feature || f.desired_feature || f.needs_improvement
    return row(item.key, () => onOpenFeedback(f), <Glyph icon={MessageSquare} tone="blue" />,
      <Lines
        title={f.display_name || 'Anonymous'}
        lines={[summary]}
        extra={f.rating != null && (
          <div className="flex items-center gap-1 mt-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} size={10} className={i < f.rating! ? 'text-themeblue2 fill-themeblue2' : 'text-themeblue2/20'} />
            ))}
          </div>
        )}
      />)
  }

  const threadRow = (t: AdminSystemConversation) => {
    const p = t.peerProfile
    const body = t.lastMessage.plaintext || (t.lastMessage.content?.type === 'image' ? 'Photo' : '')
    // Inbound replies (recipient = SYSTEM) read bare; dev-authored ones get "You:".
    const preview = t.lastMessage.recipientId === SYSTEM_USER_ID ? body : `You: ${body}`
    return row(`sys-${t.peerId}`, () => onOpenThread(t.peerId),
      <UserAvatar
        avatarId={p?.avatarId ?? null}
        avatarBlob={p?.avatarBlob ?? null}
        userId={p?.id ?? null}
        firstName={p?.firstName ?? null}
        lastName={p?.lastName ?? null}
        className="w-9 h-9"
      />,
      <Lines
        title={
          <span className="flex items-center gap-2">
            <span className="truncate">{p ? getDisplayName(p) : 'Unknown user'}</span>
            {t.unreadCount > 0 && <span className="w-2 h-2 rounded-full bg-themeblue3 shrink-0" aria-label={`${t.unreadCount} unread`} />}
          </span>
        }
        lines={[preview]}
      />,
      <span className="text-[9pt] text-tertiary shrink-0">{formatTimestamp(t.lastMessage.createdAt)}</span>)
  }

  if (requests.length + feedback.length + visibleThreads.length === 0) {
    return inbox.loaded ? <EmptyState title={q ? 'No matches' : 'Inbox is clear'} bordered={false} /> : null
  }

  return (
    <>
      {requests.length > 0 && <ListGroupLabel>Requests</ListGroupLabel>}
      {requests.map(feedRow)}
      {feedback.length > 0 && <ListGroupLabel>Feedback</ListGroupLabel>}
      {feedback.map(feedRow)}
      {visibleThreads.length > 0 && <ListGroupLabel>Messages</ListGroupLabel>}
      {visibleThreads.map(threadRow)}
    </>
  )
}
