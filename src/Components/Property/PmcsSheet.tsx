import { useEffect, useState, type ReactNode } from 'react'
import {
  AlertTriangle, Plus, Check, ClipboardCheck, Loader2, Wrench,
  Pencil, Trash2, X, ChevronRight, ChevronLeft, History,
} from 'lucide-react'
import { getAuditBySubjectLocal, fetchAuditBySubject } from '../../lib/auditService'
import type { AuditEvent } from '../../lib/auditTypes'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { TextInput } from '../FormInputs'
import { Sheet } from '../Sheet'
import { PreviewOverlay } from '../PreviewOverlay'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('PmcsSheet')

/**
 * PmcsSheet — the PMCS (preventive-maintenance checks & services) surface for a
 * property subject (a stock item, or a vehicle location with its own 5988),
 * surfaced as a preview-overlay launched from the host's ellipsis menu (NOT an
 * inline section). Two views inside one overlay:
 *
 *  - CHECK (default): the actionable now-state — open faults to Correct, an
 *    inline-add to report a new fault, and a "No new faults" clean-check.
 *  - HISTORY: every PMCS event (faults, corrections, clean checks) with per-row
 *    edit (faults/corrections carry text) and delete. audit_log gained
 *    UPDATE/DELETE on 2026-06-21 so these are real edits/hard-deletes, routed
 *    through the store (which bumps the `properties` generation so this overlay
 *    AND the inline ItemTimeline refetch in sync).
 *
 * Reads the same append-only-in-spirit audit_log the timeline does and folds it:
 * a fault.opened is OPEN unless a fault.corrected points back at it via
 * payload.corrects.
 */

const PMCS_EVENT_TYPES = new Set(['fault.opened', 'fault.corrected', 'pmcs.clear'])

interface PmcsSheetProps {
  isOpen: boolean
  onClose: () => void
  subjectType?: 'item' | 'location'
  subjectId: string
  clinicId: string
  /** Desktop only — scopes the PreviewOverlay to the detail pane. */
  containerRef?: React.RefObject<HTMLElement | null>
}

interface OpenFault {
  id: string
  description: string
  occurredAt: string
}

export function PmcsSheet({ isOpen, onClose, subjectType = 'item', subjectId, clinicId, containerRef }: PmcsSheetProps) {
  const isMobile = useIsMobile()
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'check' | 'history'>('check')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const raiseFault = usePropertyStore((s) => s.raiseFault)
  const correctFault = usePropertyStore((s) => s.correctFault)
  const recordPmcs = usePropertyStore((s) => s.recordPmcs)
  const editPmcsEntry = usePropertyStore((s) => s.editPmcsEntry)
  const deletePmcsEntry = usePropertyStore((s) => s.deletePmcsEntry)
  const propGen = useInvalidation('properties')

  // Reset transient UI when the overlay closes.
  useEffect(() => {
    if (!isOpen) {
      setView('check'); setEditingId(null); setConfirmDeleteId(null); setDesc('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
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
      const pmcs = [...byId.values()]
        .filter((e) => PMCS_EVENT_TYPES.has(e.eventType))
        .sort((a, b) => {
          if (a.seq != null && b.seq != null) return b.seq - a.seq
          return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        })
      setEvents(pmcs)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [isOpen, subjectId, clinicId, propGen])

  const correctedIds = new Set(
    events
      .filter((e) => e.eventType === 'fault.corrected')
      .map((e) => e.payload?.corrects)
      .filter((id): id is string => typeof id === 'string'),
  )
  const openFaults: OpenFault[] = events
    .filter((e) => e.eventType === 'fault.opened' && !correctedIds.has(e.id))
    .map((e) => ({
      id: e.id,
      description: typeof e.payload?.description === 'string' ? e.payload.description : 'Fault',
      occurredAt: e.occurredAt,
    }))

  const handleReport = async () => {
    const text = desc.trim()
    if (!text || busy) return
    setBusy(true)
    setDesc('')
    await raiseFault(subjectType, subjectId, text)
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

  const beginEdit = (e: AuditEvent) => {
    setConfirmDeleteId(null)
    setEditingId(e.id)
    setEditText(
      e.eventType === 'fault.opened'
        ? (typeof e.payload?.description === 'string' ? e.payload.description : '')
        : (typeof e.payload?.note === 'string' ? e.payload.note : ''),
    )
  }

  const saveEdit = async (e: AuditEvent) => {
    const text = editText.trim()
    if (busy) return
    // Empty edit on a fault description is meaningless — keep the row unchanged.
    if (e.eventType === 'fault.opened' && !text) { setEditingId(null); return }
    setBusy(true)
    const payload = e.eventType === 'fault.opened'
      ? { description: text }
      : { corrects: e.payload?.corrects, note: text }
    await editPmcsEntry(e.id, payload)
    setEditingId(null)
    setBusy(false)
  }

  const handleDelete = async (id: string) => {
    if (busy) return
    setBusy(true)
    setConfirmDeleteId(null)
    await deletePmcsEntry(id)
    setBusy(false)
  }

  // ── CHECK view body ─────────────────────────────────────────────────────────
  const checkBody = loading ? (
    <div className="flex items-center justify-center px-4 py-6">
      <Loader2 size={16} className="animate-spin text-tertiary" />
    </div>
  ) : (
    <div className="divide-y divide-tertiary/8">
      {openFaults.map((f) => (
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
          <TextInput value={desc} onChange={setDesc} placeholder="Report a fault" />
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
      {/* Switch to the full PMCS history (edit / delete past entries). */}
      <button
        type="button"
        onClick={() => setView('history')}
        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-secondary/5 transition-colors"
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-themeblue3/10 text-themeblue2">
          <History size={14} />
        </div>
        <span className="flex-1 min-w-0 text-sm font-medium text-secondary">
          PMCS history{events.length > 0 && ` · ${events.length}`}
        </span>
        <ChevronRight size={16} className="text-tertiary shrink-0" />
      </button>
    </div>
  )

  // ── HISTORY view body — every PMCS event, editable/deletable per row ─────────
  const historyBody = (
    <div className="divide-y divide-tertiary/8">
      <button
        type="button"
        onClick={() => { setView('check'); setEditingId(null); setConfirmDeleteId(null) }}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left active:bg-secondary/5 transition-colors"
      >
        <ChevronLeft size={16} className="text-tertiary shrink-0" />
        <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">PMCS check</span>
      </button>
      {loading ? (
        <div className="flex items-center justify-center px-4 py-6">
          <Loader2 size={16} className="animate-spin text-tertiary" />
        </div>
      ) : events.length === 0 ? (
        <p className="text-[10pt] text-tertiary px-4 py-4">No PMCS history yet</p>
      ) : (
        events.map((e) => {
          const open = e.eventType === 'fault.opened' && !correctedIds.has(e.id)
          const editable = e.eventType === 'fault.opened' || e.eventType === 'fault.corrected'
          const Icon = e.eventType === 'fault.opened' ? AlertTriangle
            : e.eventType === 'fault.corrected' ? Wrench : ClipboardCheck
          return (
            <div key={e.id} className="px-4 py-3">
              {editingId === e.id ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <TextInput value={editText} onChange={setEditText} placeholder="Entry text" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="shrink-0 w-8 h-8 rounded-full bg-tertiary/8 flex items-center justify-center active:scale-95 transition-all"
                  >
                    <X size={14} className="text-tertiary" />
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEdit(e)}
                    disabled={busy}
                    className="shrink-0 w-8 h-8 rounded-full bg-themegreen/15 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
                  >
                    <Check size={14} className="text-themegreen" />
                  </button>
                </div>
              ) : confirmDeleteId === e.id ? (
                <div className="flex items-center gap-3">
                  <p className="flex-1 min-w-0 text-sm font-medium text-themered">Delete this entry?</p>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="shrink-0 px-2.5 py-1 rounded-full bg-tertiary/8 text-tertiary text-[9pt] font-semibold active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(e.id)}
                    disabled={busy}
                    className="shrink-0 px-2.5 py-1 rounded-full bg-themered/10 text-themered text-[9pt] font-semibold active:scale-95 transition-all disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${open ? 'bg-themered/10 text-themered' : 'bg-themeblue3/10 text-themeblue2'}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${open ? 'text-themered' : 'text-primary'}`}>{describe(e)}</p>
                    <p className="text-[9pt] text-tertiary">{fmtDate(e.occurredAt)}</p>
                  </div>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => beginEdit(e)}
                      className="shrink-0 w-8 h-8 rounded-full bg-themeblue3/8 flex items-center justify-center active:scale-95 transition-all"
                      aria-label="Edit entry"
                    >
                      <Pencil size={13} className="text-themeblue2" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); setConfirmDeleteId(e.id) }}
                    className="shrink-0 w-8 h-8 rounded-full bg-themered/8 flex items-center justify-center active:scale-95 transition-all"
                    aria-label="Delete entry"
                  >
                    <Trash2 size={13} className="text-themered" />
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )

  const body = view === 'history' ? historyBody : checkBody

  if (isMobile) {
    return (
      <Sheet isOpen={isOpen} onClose={onClose} title="PMCS" height="fit" maxHeight={80} zIndex={1450}>
        <div className="px-4 pt-1 pb-5">
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            {body}
          </div>
        </div>
      </Sheet>
    )
  }

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={null}
      containerRef={containerRef}
      title="PMCS"
      maxWidth={360}
      previewMaxHeight="60dvh"
    >
      {body as ReactNode}
    </PreviewOverlay>
  )
}

function describe(e: AuditEvent): string {
  const p = e.payload ?? {}
  switch (e.eventType) {
    case 'fault.opened':
      return typeof p.description === 'string' && p.description ? p.description : 'Fault reported'
    case 'fault.corrected':
      return typeof p.note === 'string' && p.note ? `Corrected — ${p.note}` : 'Fault corrected'
    case 'pmcs.clear':
      return 'PMCS — no new faults'
    default:
      return e.eventType
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
