import { useEffect, useState } from 'react'
import { AlertTriangle, Plus, Check, ClipboardCheck, Loader2, Wrench } from 'lucide-react'
import { getAuditBySubjectLocal, fetchAuditBySubject } from '../../lib/auditService'
import type { AuditEvent } from '../../lib/auditTypes'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { TextInput } from '../FormInputs'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('ItemPmcs')

/**
 * ItemPmcs — the PMCS (preventive-maintenance checks & services) surface for a
 * property item. Replaces the old serviceable/damaged condition chips: an item's
 * health IS its open faults. Reads the same append-only audit_log the timeline
 * does and folds it to the currently-open faults (a fault.opened is open unless a
 * fault.corrected points back at it via payload.corrects).
 *
 * Three actions, all routed through the store (which bumps the `properties`
 * generation so this card AND the timeline below refetch in sync):
 *  - Correct an open fault           → fault.corrected
 *  - Report a new fault (inline add) → fault.opened
 *  - No new faults                   → pmcs.clear (logs a clean-check entry, so a
 *                                       PMCS that finds nothing still leaves a trail)
 *
 * The full found→fixed history (incl. corrected faults + clean checks) lives in
 * ItemTimeline; this card is only the actionable now-state.
 *
 * Surfaced as a single "PMCS…" action (ellipsis = opens a flow): the section is
 * collapsed by default — the header carries only the open-fault count (red, at a
 * glance). Tapping "PMCS…" reveals the fault list to correct/leave plus the
 * report-a-fault inline-add and the "No new faults" clean-check. PMCS is never a
 * separate preview-overlay/sheet — the flow is inline, in place.
 */

interface ItemPmcsProps {
  /** What this PMCS is about — a stock item, or a property location (a vehicle
   *  zone carries its own 5988). Defaults to 'item'. */
  subjectType?: 'item' | 'location'
  /** The audit subject id (item id, or vehicle/location id). */
  subjectId: string
  clinicId: string
}

interface OpenFault {
  id: string
  description: string
  occurredAt: string
}

export function ItemPmcs({ subjectType = 'item', subjectId, clinicId }: ItemPmcsProps) {
  const [open, setOpen] = useState<OpenFault[]>([])
  const [loading, setLoading] = useState(true)
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  // Collapsed by default — "PMCS…" opens the inline check (fault list + report + clean).
  const [expanded, setExpanded] = useState(false)
  const raiseFault = usePropertyStore((s) => s.raiseFault)
  const correctFault = usePropertyStore((s) => s.correctFault)
  const recordPmcs = usePropertyStore((s) => s.recordPmcs)
  const propGen = useInvalidation('properties')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const [local, server] = await Promise.all([
        getAuditBySubjectLocal(subjectId).catch((err) => {
          logger.warn('local PMCS read failed:', err); return [] as AuditEvent[]
        }),
        fetchAuditBySubject(subjectId, { clinicId }).catch(() => [] as AuditEvent[]),
      ])
      if (cancelled) return
      const byId = new Map<string, AuditEvent>()
      for (const e of [...local, ...server]) byId.set(e.id, e)
      const events = [...byId.values()]

      const correctedIds = new Set(
        events
          .filter((e) => e.eventType === 'fault.corrected')
          .map((e) => e.payload?.corrects)
          .filter((id): id is string => typeof id === 'string'),
      )
      const openFaults = events
        .filter((e) => e.eventType === 'fault.opened' && !correctedIds.has(e.id))
        .map((e) => ({
          id: e.id,
          description: typeof e.payload?.description === 'string' ? e.payload.description : 'Fault',
          occurredAt: e.occurredAt,
        }))
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())

      setOpen(openFaults)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [subjectId, clinicId, propGen])

  const handleReport = async () => {
    const text = desc.trim()
    if (!text || busy) return
    setBusy(true)
    setDesc('')
    await raiseFault(subjectType, subjectId, text) // store invalidates 'properties' → effect refetches
    setBusy(false)
  }

  const handleCorrect = async (faultId: string) => {
    if (busy) return
    setBusy(true)
    await correctFault(subjectType, subjectId, faultId)
    setBusy(false)
  }

  const handleNoNewFaults = async () => {
    if (busy) return
    setBusy(true)
    await recordPmcs(subjectType, subjectId)
    setBusy(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">PMCS</span>
          {open.length > 0 && (
            <span className="text-[9pt] px-1.5 py-0.5 rounded-full bg-themered/10 text-themered font-semibold">
              {open.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-themeblue3/10 text-themeblue3 text-[9pt] font-semibold active:scale-95 transition-all"
        >
          <Wrench size={12} /> PMCS…
        </button>
      </div>
      {expanded && (
      <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center px-4 py-6">
            <Loader2 size={16} className="animate-spin text-tertiary" />
          </div>
        ) : (
          <div className="divide-y divide-tertiary/8">
            {open.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-themered/10 text-themered">
                  <AlertTriangle size={14} />
                </div>
                <p className="flex-1 min-w-0 text-sm font-medium text-themered truncate">{f.description}</p>
                <button
                  type="button"
                  onClick={() => handleCorrect(f.id)}
                  disabled={busy}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-themegreen/10 text-themegreen text-[9pt] font-semibold active:scale-95 transition-all disabled:opacity-40"
                >
                  <Check size={12} /> Correct
                </button>
              </div>
            ))}
            {/* No new faults — logs a clean PMCS even when nothing is wrong. */}
            <button
              type="button"
              onClick={handleNoNewFaults}
              disabled={busy}
              className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-themegreen/5 transition-colors disabled:opacity-40"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-themegreen/10 text-themegreen">
                <ClipboardCheck size={14} />
              </div>
              <span className="flex-1 min-w-0 text-sm font-medium text-secondary">No new faults</span>
            </button>
            {/* Inline add — report a new fault (TextInput + circular Plus). */}
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="flex-1 min-w-0">
                <TextInput
                  value={desc}
                  onChange={setDesc}
                  placeholder="Report a fault"
                />
              </div>
              <button
                type="button"
                onClick={handleReport}
                disabled={!desc.trim() || busy}
                className="shrink-0 w-9 h-9 rounded-full bg-themeblue3 text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
