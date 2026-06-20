import { useEffect, useState } from 'react'
import { Plus, ArrowRightLeft, UserCheck, Pencil, Minus, Loader2, type LucideIcon } from 'lucide-react'
import { getAuditBySubjectLocal, fetchAuditBySubject } from '../../lib/auditService'
import type { AuditEvent } from '../../lib/auditTypes'
import type { LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
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
  /** The property item this timeline is about. */
  itemId: string
  /** Item's clinic — scopes the server read + payload decryption. */
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

export function ItemTimeline({ itemId, clinicId, locations, holders, title = 'History' }: ItemTimelineProps) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const [local, server] = await Promise.all([
        getAuditBySubjectLocal(itemId).catch((err) => {
          logger.warn('local item timeline read failed:', err); return [] as AuditEvent[]
        }),
        fetchAuditBySubject(itemId, { clinicId }).catch(() => [] as AuditEvent[]),
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
  }, [itemId, clinicId])

  const locName = (id: unknown) =>
    typeof id === 'string' ? (locations.find((l) => l.id === id)?.name ?? 'a location') : 'unassigned'
  const holderName = (id: unknown) =>
    typeof id === 'string' ? (holders.get(id)?.displayName ?? 'someone') : 'no one'

  const describe = (e: AuditEvent): string => {
    const p = e.payload ?? {}
    switch (e.eventType) {
      case 'item.created':
        return p.location_id ? `Created in ${locName(p.location_id)}` : 'Created'
      case 'item.moved':
        return `Moved to ${locName(p.to_location_id)}`
      case 'item.assigned':
        return p.to_holder_id ? `Assigned to ${holderName(p.to_holder_id)}` : 'Custody cleared'
      case 'item.transferred': {
        const action = (p.action as string) || 'transferred'
        const verb = action === 'sign_down' ? 'Signed down' : action === 'sign_up' ? 'Signed up' : 'Custody transferred'
        return p.to_holder_id ? `${verb} to ${holderName(p.to_holder_id)}` : verb
      }
      case 'item.edited': {
        const changed = Array.isArray(p.changed) ? (p.changed as string[]) : []
        if (changed.length === 0) return 'Edited'
        const labels = changed.map((f) => FIELD_LABELS[f] ?? f)
        return `Updated ${labels.join(', ')}`
      }
      case 'item.expended':
        return `Expended${p.quantity_delta ? ` ×${p.quantity_delta}` : ''}`
      default:
        return e.eventType
    }
  }

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
              return (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-themeblue3/10 text-themeblue2">
                    <Icon size={14} />
                  </div>
                  <p className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{describe(e)}</p>
                  <span className="text-[9pt] text-tertiary shrink-0">{fmtDate(e.occurredAt)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
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
