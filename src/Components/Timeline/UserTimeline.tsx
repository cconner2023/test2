import { useEffect, useState, useMemo, type ReactNode } from 'react'
import { Building2, Package, ClipboardCheck, Award, Activity, Calendar, History } from 'lucide-react'
import { SkeletonRows } from '@/Components/primitives/Skeleton'
import { getAuditBySubjectLocal, fetchAuditBySubject } from '../../lib/auditService'
import type { AuditEvent, AuditDomain } from '../../lib/auditTypes'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { createLogger } from '../../Utilities/Logger'
import { ActionPill } from '@/Components/primitives/ActionPill'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { Sheet } from '@/Components/primitives/Sheet'
import { SearchInput } from '@/Components/primitives/SearchInput'

const logger = createLogger('UserTimeline')

/**
 * UserTimeline — the per-subject lifecycle spine read from the unified audit_log.
 *
 * Replaces the supervisor's forward-only "team calendar" voice with a single
 * timeline that renders BOTH past lifecycle events (trained, certified) and
 * future-facing ones, split by a standalone "now" divider line
 * (red dot + hairline, mirroring the calendar DayView marker) — future above,
 * past below. Reads server (read_audit RPC, RLS/dev-scoped) merged with local
 * pending events, so it paints offline-first. Lifecycle events only — not an
 * activity feed.
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
  /** The user this timeline is about (soldier / member). Required for the
   *  self-fetch path; omit when passing pre-fetched `rows`. */
  subjectId?: string
  /** Caller's clinic — scopes the server read + payload decryption. */
  clinicId?: string
  /** Optional synthetic events to seed the spine (e.g. a "joined" marker from
   *  profiles.created_at, which is not itself an audit event). */
  seedEvents?: AuditEvent[]
  /** Optional calendar-sourced rows (schedule + encounters) merged into the spine. */
  calendarEntries?: TimelineCalendarEntry[]
  /** Tap handler for a calendar row — opens the event in the calendar. */
  onOpenEvent?: (eventId: string) => void
  title?: string
  /** Max rows shown in the card preview; the rest live behind "View all". Default 5. */
  previewCount?: number
  /** Extra action button(s) folded into the timeline's action pill (e.g. "View in calendar"). */
  actions?: ReactNode
  /** When provided, "View all" calls this instead of opening the bottom Sheet —
   *  lets a desktop host render the full timeline in a side pane. Falls back to
   *  the Sheet when absent (mobile + admin). */
  onViewAll?: () => void
  /** Pre-fetched rows (host-owned). When provided the component is presentational
   *  and does NOT fetch — lets a host share one fetch across surfaces (the
   *  supervisor three-pane: soldier-card preview + timeline pane read one source).
   *  Supplied via useSubjectTimelineRows + buildTimelineCalendarEntries. */
  rows?: TimelineRowData[]
  rowsLoading?: boolean
}

/** Normalized row rendered by the timeline — from an audit event or a calendar entry. */
export interface TimelineRowData {
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
  property: Package,
  training: ClipboardCheck,
  cert: Award,
}

const DOMAIN_TINT: Record<AuditDomain, string> = {
  property: 'bg-themeblue3/10 text-themeblue2',
  training: 'bg-themegreen/10 text-themegreen',
  cert: 'bg-themeblue2/10 text-themeblue2',
}

/** Human-readable one-liner for an event. Operational vocabulary only. */
function describeEvent(e: AuditEvent): string {
  const p = e.payload ?? {}
  const item = (p.training_item_id as string) || ''
  switch (e.eventType) {
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
  const body = (
    <>
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

/** Standalone "now" boundary line between the future block (above) and past
 *  block (below) — red dot + hairline, mirroring the calendar DayView marker. */
function NowDivider() {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5">
      <div className="w-2 h-2 rounded-full bg-themeredred shrink-0" />
      <div className="flex-1 h-px bg-themeredred" />
    </div>
  )
}

/** Split a row set into future/past blocks (newest-first) around the now-line. */
function arrange(rows: TimelineRowData[]): {
  future: TimelineRowData[]
  past: TimelineRowData[]
} {
  const now = Date.now()
  // Newest-first within each half; future shown above the now-divider.
  const sorted = [...rows].sort((a, b) => {
    if (a.seq != null && b.seq != null) return b.seq - a.seq
    return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  })
  const future = sorted.filter((r) => new Date(r.occurredAt).getTime() > now)
  const past = sorted.filter((r) => new Date(r.occurredAt).getTime() <= now)
  return { future, past }
}

export function UserTimeline({ subjectId, clinicId, seedEvents, calendarEntries, onOpenEvent, title = 'Timeline', previewCount = 5, actions, onViewAll, rows, rowsLoading }: UserTimelineProps) {
  const [showAll, setShowAll] = useState(false)
  // Presentational when `rows` are supplied (host already fetched); otherwise
  // self-fetch. Passing an empty subjectId keeps the hook from fetching.
  const self = useSubjectTimelineRows({ subjectId: rows ? '' : (subjectId ?? ''), clinicId: clinicId ?? '', seedEvents, calendarEntries, onOpenEvent })
  const allRows = rows ?? self.allRows
  const loading = rows ? !!rowsLoading : self.loading

  const total = allRows.length

  // Preview = the events nearest to "now" (a few upcoming + recent past), so the
  // card surfaces what matters rather than the farthest-future scheduled rows.
  const previewRows = useMemo(() => {
    if (allRows.length <= previewCount) return allRows
    const now = Date.now()
    return [...allRows]
      .sort((a, b) => Math.abs(new Date(a.occurredAt).getTime() - now) - Math.abs(new Date(b.occurredAt).getTime() - now))
      .slice(0, previewCount)
  }, [allRows, previewCount])

  const preview = useMemo(() => arrange(previewRows), [previewRows])

  return (
    <div>
      <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
        {title}
      </p>
      {/* relative wraps ONLY the card so the overlay pill rides the card's top
          edge (canonical EmptyState/ActionPill primitive), not the heading. */}
      <div className="relative">
        <div className="relative rounded-2xl bg-themewhite2 overflow-hidden">
          {loading && total === 0 ? (
            <SkeletonRows count={3} />
          ) : total === 0 ? (
            <p className="text-[10pt] text-tertiary px-4 py-4">No timeline events yet</p>
          ) : (
            <div className="divide-y divide-tertiary/8">
              {preview.future.map((r) => (
                <TimelineRow key={r.id} row={r} future />
              ))}
              <NowDivider />
              {preview.past.map((r) => (
                <TimelineRow key={r.id} row={r} future={false} />
              ))}
            </div>
          )}
        </div>

        {/* Action pill — "View all" opens the full searchable timeline; callers
            can fold extra actions (e.g. "View in calendar") into the same pill. */}
        {(total > 0 || actions) && (
          <ActionPill shadow="sm" placement="overlay">
            {total > 0 && (
              <ActionButton icon={History} label="View all" onClick={() => (onViewAll ? onViewAll() : setShowAll(true))} />
            )}
            {actions}
          </ActionPill>
        )}
      </div>

      {/* Mobile / fallback: the full searchable timeline opens in a bottom Sheet.
          A desktop host can pass `onViewAll` to render it in a side pane instead
          (the supervisor three-pane), in which case this Sheet never opens.
          zIndex 1200 clears the host BaseDrawer's z-60 stacking context. */}
      <Sheet isOpen={showAll} onClose={() => setShowAll(false)} title={title} maxHeight={90} zIndex={1200}>
        <TimelineFullView rows={allRows} loading={loading} />
      </Sheet>
    </div>
  )
}

/** Shared data layer — fetch the subject's audit spine (local + server, merged)
 *  and fold in calendar-sourced rows. A falsy `subjectId` skips the fetch, so a
 *  host can call this unconditionally and only "arm" it when its pane is open. */
export function useSubjectTimelineRows({ subjectId, clinicId, seedEvents, calendarEntries, onOpenEvent }: {
  subjectId: string
  clinicId: string
  seedEvents?: AuditEvent[]
  calendarEntries?: TimelineCalendarEntry[]
  onOpenEvent?: (eventId: string) => void
}) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!subjectId) { setEvents([]); setLoading(false); return }
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

  // Merge audit rows with calendar rows, dedupe by id (audit wins on collision).
  const allRows = useMemo(() => {
    const byId = new Map<string, TimelineRowData>()
    for (const c of calendarEntries ?? []) byId.set(c.id, calendarToRow(c, onOpenEvent))
    for (const e of events) byId.set(e.id, auditToRow(e))
    return [...byId.values()]
  }, [events, calendarEntries, onOpenEvent])

  return { allRows, loading }
}

/** The full, searchable timeline body — past/future split around the now-divider.
 *  Presentational: rows are pre-built (see useSubjectTimelineRows). Shared by the
 *  mobile Sheet and the desktop side pane. */
export function TimelineFullView({ rows, loading = false }: { rows: TimelineRowData[]; loading?: boolean }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      r.label.toLowerCase().includes(q) ||
      r.sublabel.toLowerCase().includes(q) ||
      fmtDate(r.occurredAt).toLowerCase().includes(q),
    )
  }, [rows, query])

  const { future, past } = useMemo(() => arrange(filtered), [filtered])

  return (
    <div className="relative min-h-full">
      <div className="px-4 pt-1 pb-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search timeline…" />
      </div>
      {future.length === 0 && past.length === 0 ? (
        <p className="text-[10pt] text-tertiary px-4 py-8 text-center">No matching events</p>
      ) : (
        <div className="divide-y divide-tertiary/8 pb-2">
          {future.map((r) => (
            <TimelineRow key={r.id} row={r} future />
          ))}
          <NowDivider />
          {past.map((r) => (
            <TimelineRow key={r.id} row={r} future={false} />
          ))}
        </div>
      )}
      <LoadingOverlay visible={loading} size={120} />
    </div>
  )
}

/** Build calendar-sourced timeline rows: upcoming events become "scheduled" rows,
 *  logged encounters become "encounter" rows (encounters win id collisions).
 *  Shared by the soldier card preview and the supervisor timeline pane. */
export function buildTimelineCalendarEntries(scheduled: CalendarEvent[], encounters: CalendarEvent[]): TimelineCalendarEntry[] {
  const byId = new Map<string, TimelineCalendarEntry>()
  const now = Date.now()
  for (const e of scheduled) {
    if (new Date(e.end_time).getTime() >= now) {
      byId.set(e.id, { id: e.id, occurredAt: e.start_time, title: e.title, kind: 'scheduled' })
    }
  }
  for (const e of encounters) {
    byId.set(e.id, { id: e.id, occurredAt: e.start_time, title: e.title, kind: 'encounter' })
  }
  return [...byId.values()]
}
