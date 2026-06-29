import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, ArrowRightLeft, UserCheck, Pencil, Minus, AlertTriangle, Wrench, ClipboardCheck, Eye, Trash2, type LucideIcon } from 'lucide-react'
import { SkeletonRows } from '../Skeleton'
import { getAuditBySubjectLocal, fetchAuditBySubject } from '../../lib/auditService'
import { useInvalidation } from '../../stores/useInvalidationStore'
import type { AuditEvent } from '../../lib/auditTypes'
import { foldOpenFaults, pmcsOpened, summarizePmcs } from '../../lib/pmcsFold'
import type { LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
import { RecordPreview } from '../Property/RecordPreview'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { liftPressHandlers, type LiftPressState } from '../liftPress'
import type { ContextMenuItem } from '../ContextMenu'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('ItemTimeline')

/**
 * ItemTimeline — the per-item lifecycle spine read from the unified audit_log
 * (subject = property item). Renders creation, moves, custody assigns/transfers,
 * field edits and expends in reverse-chronological order. Offline-first: local
 * (IDB) pending events merged with the server read_audit pull, deduped by id.
 *
 * Item events are all past-facing (no scheduled future), so unlike UserTimeline
 * there is no now-divider — just a flat newest-first list.
 */

interface ItemTimelineProps {
  /** The audit subject this timeline is about — a property item, or a property
   *  location (a kind='vehicle' zone with its own 5988 paper trail). */
  subjectId: string
  /** Subject's clinic — scopes the server read + payload decryption. */
  clinicId: string
  /** For resolving location ids in move events to names. */
  locations: LocalPropertyLocation[]
  /** For resolving holder ids in assign/transfer events to names. */
  holders: Map<string, HolderInfo>
  title?: string
}

const EVENT_ICON: Record<string, LucideIcon> = {
  'item.created': Plus,
  'item.moved': ArrowRightLeft,
  'item.assigned': UserCheck,
  'item.transferred': UserCheck,
  'item.edited': Pencil,
  'item.expended': Minus,
  'fault.opened': AlertTriangle,
  'fault.corrected': Wrench,
  'pmcs.clear': ClipboardCheck,
}

/** Human labels for the field keys carried in an item.edited payload. */
const FIELD_LABELS: Record<string, string> = {
  name: 'name',
  nomenclature: 'nomenclature',
  nsn: 'NSN',
  lin: 'LIN',
  serial_number: 'serial',
  condition_code: 'condition',
  quantity: 'quantity',
  expiry_date: 'expiry',
  notes: 'notes',
  parent_item_id: 'parent',
}

export function ItemTimeline({ subjectId, clinicId, locations, holders, title = 'History' }: ItemTimelineProps) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<{ event: AuditEvent; action: 'view' | 'edit' | 'delete' } | null>(null)
  const [lifted, setLifted] = useState<{ event: AuditEvent; rect: DOMRect; html: string } | null>(null)
  const pressRef = useRef<LiftPressState | null>(null)
  const propGen = useInvalidation('properties')

  // Long-press / right-click a history row → lift it and drop a View/Edit/Delete
  // menu beneath (the shared LiftedRowMenu peek). A plain factory, loop-safe in
  // the .map; the parent owns one press-ref. Tap still opens the view preview.
  const makeHandlers = useCallback(
    (e: AuditEvent) => liftPressHandlers((snap) => setLifted({ event: e, ...snap }), pressRef),
    [],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const [local, server] = await Promise.all([
        getAuditBySubjectLocal(subjectId).catch((err) => {
          logger.warn('local item timeline read failed:', err); return [] as AuditEvent[]
        }),
        fetchAuditBySubject(subjectId, { clinicId }).catch(() => [] as AuditEvent[]),
      ])
      if (cancelled) return
      const byId = new Map<string, AuditEvent>()
      for (const e of [...local, ...server]) byId.set(e.id, e)
      const merged = [...byId.values()].sort((a, b) => {
        if (a.seq != null && b.seq != null) return b.seq - a.seq
        return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      })
      setEvents(merged)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [subjectId, clinicId, propGen])

  const locName = (id: unknown) =>
    typeof id === 'string' ? (locations.find((l) => l.id === id)?.name ?? 'a location') : 'unassigned'
  const holderName = (id: unknown) =>
    typeof id === 'string' ? (holders.get(id)?.displayName ?? 'someone') : 'no one'

  const describe = (e: AuditEvent): string => {
    const p = e.payload ?? {}
    switch (e.eventType) {
      case 'item.created': {
        const qty = typeof p.quantity === 'number' && p.quantity > 1 ? ` ×${p.quantity}` : ''
        return p.location_id ? `Added${qty} to ${locName(p.location_id)}` : `Added${qty}`
      }
      case 'item.moved':
        return `Moved to ${locName(p.to_location_id)}`
      case 'item.assigned':
        return p.to_holder_id ? `Assigned to ${holderName(p.to_holder_id)}` : 'Custody cleared'
      case 'item.transferred': {
        const action = (p.action as string) || 'transferred'
        const qty = typeof p.quantity_delta === 'number' && p.quantity_delta > 1 ? ` ×${p.quantity_delta}` : ''
        // sign_up returns custody (from_holder → stock); sign_down hands it out.
        if (action === 'sign_up') {
          return p.from_holder_id ? `Returned${qty} from ${holderName(p.from_holder_id)}` : `Returned${qty}`
        }
        if (action === 'sign_down') {
          return p.to_holder_id ? `Transferred${qty} to ${holderName(p.to_holder_id)}` : `Transferred${qty}`
        }
        if (action === 'turn_in') {
          return `Pending Turn-In${qty}`
        }
        return p.to_holder_id ? `Custody transferred to ${holderName(p.to_holder_id)}` : 'Custody transferred'
      }
      case 'item.edited': {
        const changed = Array.isArray(p.changed) ? (p.changed as string[]) : []
        if (changed.length === 0) return 'Edited'
        const labels = changed.map((f) => FIELD_LABELS[f] ?? f)
        return `Updated ${labels.join(', ')}`
      }
      case 'item.expended':
        return `Expended${p.quantity_delta ? ` ×${p.quantity_delta}` : ''}`
      // Legacy standalone fault rows (pre-bundle data); new faults ride inside the
      // pmcs.clear that found/corrected them, so no new rows of these types appear.
      case 'fault.opened':
        return typeof p.description === 'string' && p.description
          ? `Fault: ${p.description}` : 'Fault reported'
      case 'fault.corrected':
        return typeof p.note === 'string' && p.note
          ? `Fault corrected — ${p.note}` : 'Fault corrected'
      case 'pmcs.clear':
        return summarizePmcs(e).title
      default:
        return e.eventType
    }
  }

  // Fold open faults (bundled pmcs.clear payloads + any legacy fault events): a row
  // that holds a still-open fault gets the red "unresolved" accent.
  const openIds = new Set(foldOpenFaults(events).map((f) => f.id))
  const isOpenFault = (e: AuditEvent) => {
    if (e.eventType === 'fault.opened') return openIds.has(e.id)
    if (e.eventType === 'pmcs.clear') return pmcsOpened(e).some((o) => openIds.has(o.id))
    return false
  }

  return (
    <div>
      <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase mb-2">
        {title}
      </p>
      <div className="relative rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
        {loading && events.length === 0 ? (
          <SkeletonRows count={3} />
        ) : events.length === 0 ? (
          <p className="text-[10pt] text-tertiary px-4 py-4">No history yet</p>
        ) : (
          <div className="divide-y divide-tertiary/8">
            {events.map((e) => {
              const open = isOpenFault(e)
              return (
                <button
                  key={e.id}
                  type="button"
                  {...makeHandlers(e)}
                  onClick={() => { if (pressRef.current?.fired) return; setPreview({ event: e, action: 'view' }) }}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 active:opacity-70 transition-opacity"
                >
                  <p className={`flex-1 min-w-0 text-sm font-medium truncate ${open ? 'text-themered' : 'text-primary'}`}>{describe(e)}</p>
                  <span className="text-[9pt] text-tertiary shrink-0">{fmtDate(e.occurredAt)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Lifted-row menu — long-press/right-click a history row peeks it up and
          drops its actions beneath. A PMCS check / dispatch opens straight into its
          editable form (Edit + Delete); other rows view, with Edit offered only for
          the legacy text-carrying fault rows. */}
      {lifted && (() => {
        const e = lifted.event
        const isForm = e.eventType === 'pmcs.clear' || e.eventType === 'dispatch.opened' || e.eventType === 'dispatch.closed'
        const editableText = e.eventType === 'fault.opened' || e.eventType === 'fault.corrected'
        const items: ContextMenuItem[] = isForm
          ? [
              { key: 'edit', label: 'Edit', icon: Pencil, onAction: () => setPreview({ event: e, action: 'edit' }) },
              { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setPreview({ event: e, action: 'delete' }) },
            ]
          : [
              { key: 'view', label: 'View', icon: Eye, onAction: () => setPreview({ event: e, action: 'view' }) },
              ...(editableText ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => setPreview({ event: e, action: 'edit' }) }] : []),
              { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setPreview({ event: e, action: 'delete' }) },
            ]
        return (
          <LiftedRowMenu
            isOpen
            layout="list"
            anchorRect={lifted.rect}
            onClose={() => setLifted(null)}
            items={items}
            row={<div dangerouslySetInnerHTML={{ __html: lifted.html }} />}
          />
        )
      })()}

      {/* Tap a row → RecordPreview: view its attached form (PMCS/dispatch),
          edit fault text, or delete the record. The store delete bumps the
          `properties` generation so this list refetches. */}
      <RecordPreview
        event={preview?.event ?? null}
        initialAction={preview?.action}
        onClose={() => setPreview(null)}
        label={preview ? describe(preview.event) : ''}
        Icon={preview ? (EVENT_ICON[preview.event.eventType] ?? Pencil) : Pencil}
        tint={preview && isOpenFault(preview.event) ? 'bg-themered/10 text-themered' : 'bg-themeblue3/10 text-themeblue2'}
      />
    </div>
  )
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }),
  })
}
