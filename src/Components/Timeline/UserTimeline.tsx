import { useEffect, useState, useMemo } from 'react'
import { Building2, Package, ClipboardCheck, Award, Activity, Calendar, Loader2 } from 'lucide-react'
import { getAuditBySubjectLocal, fetchAuditBySubject } from '../../lib/auditService'
import type { AuditEvent, AuditDomain } from '../../lib/auditTypes'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('UserTimeline')

/**
 * UserTimeline — the per-subject lifecycle spine read from the unified audit_log.
 *
 * Replaces the supervisor's forward-only "team calendar" voice with a single
 * timeline that renders BOTH past lifecycle events (joined cluster, trained,
 * certified) and future-facing ones, split by a "now" divider. Reads server
 * (read_audit RPC, RLS/dev-scoped) merged with local pending events, so it
 * paints offline-first. Lifecycle events only — not an activity feed.
 *
 * Reusable for both the supervisor (SoldierProfile) and admin (AdminUserDetail)
 * surfaces — same component, different subject.
 */

/**
 * A calendar-sourced timeline row. Calendar events are NOT audit_log rows
 * (they live in the clinic vault), so callers map them into this shape and feed
 * them alongside the audit spine. Used to fold the supervisor's separate
 * "Schedule" (future) and "Encounter Log" (past) sections into the one timeline.
 */
export interface TimelineCalendarEntry {
  id: string
  /** ISO start time — drives the past/future split and the displayed date. */
  occurredAt: string
  title: string
  kind: 'scheduled' | 'encounter'
}

interface UserTimelineProps {
  /** The user this timeline is about (soldier / member). */
  subjectId: string
  /** Caller's clinic — scopes the server read + payload decryption. */
  clinicId: string
  /** Optional synthetic events to seed the spine (e.g. a "joined" marker from
   *  profiles.created_at, which is not itself an audit event). */
  seedEvents?: AuditEvent[]
  /** Optional calendar-sourced rows (schedule + encounters) merged into the spine. */
  calendarEntries?: TimelineCalendarEntry[]
  /** Tap handler for a calendar row — opens the event in the calendar. */
  onOpenEvent?: (eventId: string) => void
  title?: string
}

/** Normalized row rendered by the timeline — from an audit event or a calendar entry. */
interface TimelineRowData {
  id: string
  occurredAt: string
  seq: number | null
  label: string
  sublabel: string
  Icon: typeof Building2
  tint: string
  onClick?: () => void
}

const DOMAIN_ICON: Record<AuditDomain, typeof Building2> = {
  personnel: Building2,
  property: Package,
  training: ClipboardCheck,
  cert: Award,
}

const DOMAIN_TINT: Record<AuditDomain, string> = {
  personnel: 'bg-themeblue3/10 text-themeblue2',
  property: 'bg-themeblue3/10 text-themeblue2',
  training: 'bg-themegreen/10 text-themegreen',
  cert: 'bg-themeblue2/10 text-themeblue2',
}

/** Human-readable one-liner for an event. Operational vocabulary only. */
function describeEvent(e: AuditEvent): string {
  const p = e.payload ?? {}
  const item = (p.training_item_id as string) || ''
  switch (e.eventType) {
    case 'home.assigned': return 'Assigned to cluster'
    case 'home.returned': return 'Left cluster'
    case 'loan.assigned': return 'Loaned to cluster'
    case 'loan.returned': return 'Loan ended'
    case 'read.recorded': return item ? `Completed ${item}` : 'Completed training'
    case 'test.graded': return `Evaluated ${item}${p.result ? ` — ${p.result}` : ''}`
    case 'assignment.created': return item ? `Assigned ${item}` : 'Training assigned'
    case 'assignment.completed': return item ? `Completed assignment ${item}` : 'Assignment completed'
    case 'completion.voided': return 'Training record removed'
    case 'item.transferred': return `Equipment ${(p.action as string) || 'transferred'}`
    case 'item.expended': return `Expended${p.quantity_delta ? ` ×${p.quantity_delta}` : ''}`
    case 'cert.earned': return 'Certification earned'
    case 'cert.expired': return 'Certification expired'
    default: return e.eventType
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** Map an audit event to a render row. */
function auditToRow(e: AuditEvent): TimelineRowData {
  return {
    id: e.id,
    occurredAt: e.occurredAt,
    seq: e.seq,
    label: describeEvent(e),
    sublabel: e.domain,
    Icon: DOMAIN_ICON[e.domain] ?? Activity,
    tint: DOMAIN_TINT[e.domain] ?? 'bg-themeblue3/10 text-themeblue2',
  }
}

/** Map a calendar entry to a render row. */
function calendarToRow(c: TimelineCalendarEntry, onOpenEvent?: (id: string) => void): TimelineRowData {
  const encounter = c.kind === 'encounter'
  return {
    id: c.id,
    occurredAt: c.occurredAt,
    seq: null,
    label: c.title,
    sublabel: encounter ? 'Encounter' : 'Scheduled',
    Icon: encounter ? Activity : Calendar,
    tint: 'bg-themeblue3/10 text-themeblue2',
    onClick: onOpenEvent ? () => onOpenEvent(c.id) : undefined,
  }
}

function TimelineRow({ row, future }: { row: TimelineRowData; future: boolean }) {
  const { Icon } = row
  const body = (
    <>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${row.tint}`}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{row.label}</p>
        <p className="text-[9pt] text-tertiary capitalize">{row.sublabel}</p>
      </div>
      <span className="text-[9pt] text-tertiary shrink-0">{fmtDate(row.occurredAt)}</span>
    </>
  )
  const cls = `w-full text-left flex items-center gap-3 px-4 py-3 ${future ? 'opacity-70' : ''}`
  return row.onClick
    ? <button type="button" onClick={row.onClick} className={`${cls} transition-colors hover:bg-themeblue3/5`}>{body}</button>
    : <div className={cls}>{body}</div>
}

export function UserTimeline({ subjectId, clinicId, seedEvents, calendarEntries, onOpenEvent, title = 'Timeline' }: UserTimelineProps) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      // Local (offline-first) + server merged, deduped by id.
      const [local, server] = await Promise.all([
        getAuditBySubjectLocal(subjectId).catch((err) => {
          logger.warn('local timeline read failed:', err); return [] as AuditEvent[]
        }),
        fetchAuditBySubject(subjectId, { clinicId }).catch(() => [] as AuditEvent[]),
      ])
      if (cancelled) return
      const byId = new Map<string, AuditEvent>()
      for (const e of [...(seedEvents ?? []), ...local, ...server]) byId.set(e.id, e)
      setEvents([...byId.values()])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [subjectId, clinicId, seedEvents])

  const { past, future, total } = useMemo(() => {
    // Merge audit rows with calendar rows, dedupe by id (audit wins on collision).
    const byId = new Map<string, TimelineRowData>()
    for (const c of calendarEntries ?? []) byId.set(c.id, calendarToRow(c, onOpenEvent))
    for (const e of events) byId.set(e.id, auditToRow(e))
    const rows = [...byId.values()]
    const now = Date.now()
    // Newest-first within each half; future shown above the now-divider.
    const sorted = rows.sort((a, b) => {
      if (a.seq != null && b.seq != null) return b.seq - a.seq
      return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    })
    return {
      future: sorted.filter((r) => new Date(r.occurredAt).getTime() > now),
      past: sorted.filter((r) => new Date(r.occurredAt).getTime() <= now),
      total: sorted.length,
    }
  }, [events, calendarEntries, onOpenEvent])

  return (
    <div>
      <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
        {title}{total > 0 && ` · ${total}`}
      </p>
      <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center px-4 py-6">
            <Loader2 size={16} className="animate-spin text-tertiary" />
          </div>
        ) : total === 0 ? (
          <p className="text-[10pt] text-tertiary px-4 py-4">No timeline events yet</p>
        ) : (
          <div className="divide-y divide-tertiary/8">
            {future.length > 0 && (
              <div className="divide-y divide-tertiary/8">
                {future.map((r) => <TimelineRow key={r.id} row={r} future />)}
              </div>
            )}
            <div className="flex items-center gap-2 px-4 py-1.5 bg-themeblue3/5">
              <span className="text-[8pt] font-semibold text-themeblue2 uppercase tracking-wider">Now</span>
              <div className="flex-1 h-px bg-themeblue3/20" />
            </div>
            <div className="divide-y divide-tertiary/8">
              {past.map((r) => <TimelineRow key={r.id} row={r} future={false} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
