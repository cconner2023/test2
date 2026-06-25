import { useEffect, useState } from 'react'
import { Plus, ArrowRightLeft, UserCheck, Pencil, Minus, AlertTriangle, Wrench, ClipboardCheck, Loader2, type LucideIcon } from 'lucide-react'
import { getAuditBySubjectLocal, fetchAuditBySubject } from '../../lib/auditService'
import { useInvalidation } from '../../stores/useInvalidationStore'
import type { AuditEvent } from '../../lib/auditTypes'
import type { LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
import { RecordPreview } from '../Property/RecordPreview'
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
  const [previewEvent, setPreviewEvent] = useState<AuditEvent | null>(null)
  const propGen = useInvalidation('properties')

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
      case 'fault.opened':
        return typeof p.description === 'string' && p.description
          ? `Fault: ${p.description}` : 'Fault reported'
      case 'fault.corrected':
        return typeof p.note === 'string' && p.note
          ? `Fault corrected — ${p.note}` : 'Fault corrected'
      case 'pmcs.clear': {
        const parts: string[] = []
        if (typeof p.mileage === 'number') parts.push(`${p.mileage.toLocaleString()} mi`)
        if (typeof p.fuelLevel === 'number') parts.push(`Fuel ${p.fuelLevel}%`)
        if (typeof p.operator === 'string' && p.operator) parts.push(p.operator)
        if (typeof p.mechanic === 'string' && p.mechanic) parts.push(`Mech ${p.mechanic}`)
        return parts.length ? `PMCS · ${parts.join(' · ')}` : 'PMCS — no new faults'
      }
      default:
        return e.eventType
    }
  }

  // Fold faults: a fault.opened is still OPEN unless some fault.corrected points
  // back at it via payload.corrects. Open faults get a red accent in the list.
  const correctedFaultIds = new Set(
    events
      .filter((e) => e.eventType === 'fault.corrected')
      .map((e) => e.payload?.corrects)
      .filter((id): id is string => typeof id === 'string'),
  )
  const isOpenFault = (e: AuditEvent) =>
    e.eventType === 'fault.opened' && !correctedFaultIds.has(e.id)

  return (
    <div>
      <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase mb-2">
        {title}{events.length > 0 && ` · ${events.length}`}
      </p>
      <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center px-4 py-6">
            <Loader2 size={16} className="animate-spin text-tertiary" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-[10pt] text-tertiary px-4 py-4">No history yet</p>
        ) : (
          <div className="divide-y divide-tertiary/8">
            {events.map((e) => {
              const Icon = EVENT_ICON[e.eventType] ?? Pencil
              const open = isOpenFault(e)
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setPreviewEvent(e)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 active:opacity-70 transition-opacity"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${open ? 'bg-themered/10 text-themered' : 'bg-themeblue3/10 text-themeblue2'}`}>
                    <Icon size={14} />
                  </div>
                  <p className={`flex-1 min-w-0 text-sm font-medium truncate ${open ? 'text-themered' : 'text-primary'}`}>{describe(e)}</p>
                  <span className="text-[9pt] text-tertiary shrink-0">{fmtDate(e.occurredAt)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Tap a row → RecordPreview: view its attached form (PMCS/dispatch),
          edit fault text, or delete the record. The store delete bumps the
          `properties` generation so this list refetches. */}
      <RecordPreview
        event={previewEvent}
        onClose={() => setPreviewEvent(null)}
        label={previewEvent ? describe(previewEvent) : ''}
        Icon={previewEvent ? (EVENT_ICON[previewEvent.eventType] ?? Pencil) : Pencil}
        tint={previewEvent && isOpenFault(previewEvent) ? 'bg-themered/10 text-themered' : 'bg-themeblue3/10 text-themeblue2'}
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
