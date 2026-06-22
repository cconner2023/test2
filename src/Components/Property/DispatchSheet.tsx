import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Route, RotateCcw, Loader2, FileText, Paperclip, X, Trash2,
  ChevronRight, ChevronLeft, History, CalendarClock,
} from 'lucide-react'
import { getAuditBySubjectLocal, fetchAuditBySubject } from '../../lib/auditService'
import type { AuditEvent } from '../../lib/auditTypes'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { TextInput, DatePickerInput } from '../FormInputs'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionButton } from '../ActionButton'
import { uploadEncryptedAttachment, downloadDecryptedAttachment } from '../../lib/signal'
import type { PmcsDoc } from '../../lib/propertyService'
import { DISPATCH_EVENT_TYPES, foldOpenDispatches, type DispatchStatus } from '../../lib/dispatchFold'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('DispatchSheet')

/**
 * DispatchSheet — the vehicle-dispatch surface (DA 5982/5987 motor-equipment
 * dispatch), the ops twin of PmcsSheet. Launched from the vehicle's header
 * ellipsis (NOT inline). A dispatch is append-only audit_log on the vehicle
 * location (dispatch.opened / dispatch.closed); the CURRENT dispatch is the open
 * dispatch.opened with no close, folded client-side (see lib/dispatchFold). No
 * PHI — exp date / odometer / dispatch form ride in the encrypted payload.
 *
 * Two views inside one PreviewOverlay (close-in-header, primary action in footer):
 *  - CURRENT (default): if on dispatch, the active card (exp date + status +
 *    odometer-out + dispatch doc) and a Return form (return date, odometer-in,
 *    optional return doc); the footer action returns the vehicle. If NOT on
 *    dispatch, the open intake (exp date, odometer-out, attach dispatch doc); the
 *    footer action dispatches it (shown only once an exp date is set).
 *  - HISTORY: every dispatch event newest-first, each deletable; docs viewable.
 */

interface DispatchSheetProps {
  isOpen: boolean
  onClose: () => void
  /** The vehicle location this dispatch is on. */
  subjectId: string
  clinicId: string
  /** Desktop only — scopes the PreviewOverlay to the detail pane. */
  containerRef?: React.RefObject<HTMLElement | null>
}

export function DispatchSheet({ isOpen, onClose, subjectId, clinicId, containerRef }: DispatchSheetProps) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'current' | 'history'>('current')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Open-intake form state.
  const [expDate, setExpDate] = useState('')
  const [odoOut, setOdoOut] = useState('')
  const [openNote, setOpenNote] = useState('')
  const [openDocFile, setOpenDocFile] = useState<File | null>(null)
  // Return form state.
  const [returnDate, setReturnDate] = useState('')
  const [odoIn, setOdoIn] = useState('')
  const [returnNote, setReturnNote] = useState('')
  const [returnDocFile, setReturnDocFile] = useState<File | null>(null)
  const [docError, setDocError] = useState<string | null>(null)

  const userId = useAuthStore((s) => s.user?.id)
  const openDispatch = usePropertyStore((s) => s.openDispatch)
  const closeDispatch = usePropertyStore((s) => s.closeDispatch)
  const deleteEntry = usePropertyStore((s) => s.deletePmcsEntry) // generic audit-row delete
  const propGen = useInvalidation('properties')

  // Reset transient UI when the overlay closes.
  useEffect(() => {
    if (!isOpen) {
      setView('current'); setConfirmDeleteId(null); setDocError(null)
      setExpDate(''); setOdoOut(''); setOpenNote(''); setOpenDocFile(null)
      setReturnDate(''); setOdoIn(''); setReturnNote(''); setReturnDocFile(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const [local, server] = await Promise.all([
        getAuditBySubjectLocal(subjectId).catch((err) => {
          logger.warn('local dispatch read failed:', err); return [] as AuditEvent[]
        }),
        fetchAuditBySubject(subjectId, { clinicId }).catch(() => [] as AuditEvent[]),
      ])
      if (cancelled) return
      const byId = new Map<string, AuditEvent>()
      for (const e of [...local, ...server]) byId.set(e.id, e)
      const rows = [...byId.values()]
        .filter((e) => DISPATCH_EVENT_TYPES.has(e.eventType))
        .sort((a, b) => {
          if (a.seq != null && b.seq != null) return b.seq - a.seq
          return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        })
      setEvents(rows)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [isOpen, subjectId, clinicId, propGen])

  const current = foldOpenDispatches(events, Date.now()).get(subjectId) ?? null

  // Encrypt + upload an attached dispatch form (random AES key → message-attachments
  // bucket; key rides in the encrypted payload). Returns the doc descriptor, or
  // null on failure (caller aborts and shows docError).
  const uploadDoc = async (file: File): Promise<PmcsDoc | null> => {
    if (!userId) return null
    const up = await uploadEncryptedAttachment(userId, file)
    if (!up.ok) {
      logger.warn('dispatch doc upload failed:', up.error)
      setDocError('Could not upload the document — try again.')
      return null
    }
    return { path: up.data.path, key: up.data.key, mime: file.type || undefined, name: file.name }
  }

  const handleOpen = async () => {
    if (!expDate || busy) return
    setBusy(true); setDocError(null)
    let doc: PmcsDoc | undefined
    if (openDocFile) {
      const uploaded = await uploadDoc(openDocFile)
      if (!uploaded) { setBusy(false); return }
      doc = uploaded
    }
    const miles = parseInt(odoOut, 10)
    const id = await openDispatch(subjectId, {
      exp_date: expDate,
      ...(doc ? { doc } : {}),
      ...(openNote.trim() ? { note: openNote.trim() } : {}),
      ...(Number.isFinite(miles) ? { odo_out: miles } : {}),
    })
    setBusy(false)
    if (id) onClose()
  }

  const handleReturn = async () => {
    if (!current || busy) return
    setBusy(true); setDocError(null)
    let doc: PmcsDoc | undefined
    if (returnDocFile) {
      const uploaded = await uploadDoc(returnDocFile)
      if (!uploaded) { setBusy(false); return }
      doc = uploaded
    }
    const miles = parseInt(odoIn, 10)
    const ok = await closeDispatch(subjectId, {
      dispatches: current.dispatchId,
      returned_at: returnDate || new Date().toISOString().slice(0, 10),
      ...(doc ? { doc } : {}),
      ...(returnNote.trim() ? { note: returnNote.trim() } : {}),
      ...(Number.isFinite(miles) ? { odo_in: miles } : {}),
    })
    setBusy(false)
    if (ok) onClose()
  }

  const handleDelete = async (id: string) => {
    if (busy) return
    setBusy(true); setConfirmDeleteId(null)
    await deleteEntry(id)
    setBusy(false)
  }

  const openDoc = async (doc: PmcsDoc) => {
    if (busy) return
    setBusy(true)
    const res = await downloadDecryptedAttachment(doc.path, doc.key)
    setBusy(false)
    if (!res.ok) { logger.warn('dispatch doc download failed:', res.error); return }
    const blob = doc.mime ? new Blob([res.data], { type: doc.mime }) : res.data
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const docOf = (e: AuditEvent): PmcsDoc | null => {
    const d = e.payload?.doc
    return d && typeof d === 'object' && typeof (d as PmcsDoc).path === 'string' ? (d as PmcsDoc) : null
  }

  // ── CURRENT view ────────────────────────────────────────────────────────────
  const currentBody = loading ? (
    <div className="flex items-center justify-center px-4 py-6">
      <Loader2 size={16} className="animate-spin text-tertiary" />
    </div>
  ) : current ? (
    <div className="divide-y divide-tertiary/8">
      {/* Active dispatch — exp date + status. */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${statusBg(current.status)}`}>
          <CalendarClock size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${statusText(current.status)}`}>{statusLabel(current.status)}</p>
          <p className="text-[9pt] text-tertiary">
            Expires {fmtDate(current.expDate)}{current.odoOut != null ? ` · out ${current.odoOut.toLocaleString()} mi` : ''}
          </p>
        </div>
      </div>

      {/* Return form — return date defaults today; odometer-in + return doc optional. */}
      <div className="px-4 pt-2.5 pb-1 text-[8.5pt] font-semibold text-tertiary tracking-widest uppercase">
        Return
      </div>
      <DatePickerInput value={returnDate} onChange={setReturnDate} placeholder="Return date (today)" />
      <TextInput value={odoIn} onChange={(v) => setOdoIn(v.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Odometer in" />
      <AttachRow
        file={returnDocFile}
        onPick={(f) => { setReturnDocFile(f); setDocError(null) }}
        busy={busy}
        label="Attach return form"
      />
      {docError && <p className="px-4 pb-2 text-[9pt] font-medium text-themered">{docError}</p>}

      <HistoryLink count={events.length} onClick={() => setView('history')} />
    </div>
  ) : (
    // No current dispatch — the open intake.
    <div className="divide-y divide-tertiary/8">
      <DatePickerInput value={expDate} onChange={setExpDate} placeholder="Dispatch expires" minDate={new Date().toISOString().slice(0, 10)} />
      <TextInput value={odoOut} onChange={(v) => setOdoOut(v.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Odometer out" />
      <AttachRow
        file={openDocFile}
        onPick={(f) => { setOpenDocFile(f); setDocError(null) }}
        busy={busy}
        label="Attach dispatch form"
      />
      {docError && <p className="px-4 pb-2 text-[9pt] font-medium text-themered">{docError}</p>}

      <HistoryLink count={events.length} onClick={() => setView('history')} />
    </div>
  )

  // ── HISTORY view ────────────────────────────────────────────────────────────
  const historyBody = (
    <div className="divide-y divide-tertiary/8">
      <button
        type="button"
        onClick={() => { setView('current'); setConfirmDeleteId(null) }}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left active:bg-secondary/5 transition-colors"
      >
        <ChevronLeft size={16} className="text-tertiary shrink-0" />
        <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Dispatch</span>
      </button>
      {loading ? (
        <div className="flex items-center justify-center px-4 py-6">
          <Loader2 size={16} className="animate-spin text-tertiary" />
        </div>
      ) : events.length === 0 ? (
        <p className="text-[10pt] text-tertiary px-4 py-4">No dispatch history yet</p>
      ) : (
        events.map((e) => {
          const doc = docOf(e)
          const opened = e.eventType === 'dispatch.opened'
          const Icon = opened ? Route : RotateCcw
          return (
            <div key={e.id} className="px-4 py-3">
              {confirmDeleteId === e.id ? (
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
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${opened ? 'bg-themeblue3/10 text-themeblue2' : 'bg-themegreen/10 text-themegreen'}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{describe(e)}</p>
                    <p className="text-[9pt] text-tertiary">{fmtDate(e.occurredAt)}</p>
                  </div>
                  {doc && (
                    <button
                      type="button"
                      onClick={() => openDoc(doc)}
                      disabled={busy}
                      className="shrink-0 w-8 h-8 rounded-full bg-themeblue3/8 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
                      aria-label="View dispatch form"
                    >
                      <FileText size={13} className="text-themeblue2" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(e.id)}
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

  const body = view === 'history' ? historyBody : currentBody

  // Footer primary action — Return when on dispatch, Dispatch when an exp date is
  // set. Per no-disabled-actions the action simply isn't rendered until usable
  // (no dimmed button); the footer is omitted entirely in history view.
  const primaryAction = view !== 'current' ? null
    : current ? <ActionButton icon={RotateCcw} label="Return" variant="default" onClick={handleReturn} />
    : expDate ? <ActionButton icon={Route} label="Dispatch" variant="default" onClick={handleOpen} />
    : null
  const footer = primaryAction
    ? <div className="bg-themewhite rounded-2xl px-1.5 py-1.5">{primaryAction}</div>
    : undefined

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={null}
      containerRef={containerRef}
      title="Dispatch"
      maxWidth={360}
      previewMaxHeight="60dvh"
      footer={footer}
    >
      {body as ReactNode}
    </PreviewOverlay>
  )
}

/** Attach-a-form row — hidden file input + Paperclip trigger; once picked shows
 *  the filename + X to remove. Shared by the open intake and the return form. */
function AttachRow({ file, onPick, busy, label }: {
  file: File | null
  onPick: (f: File | null) => void
  busy: boolean
  label: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(ev) => { onPick(ev.target.files?.[0] ?? null); ev.target.value = '' }}
      />
      {file ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-themeblue3/10 text-themeblue2">
            <FileText size={14} />
          </div>
          <span className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => onPick(null)}
            disabled={busy}
            className="shrink-0 w-8 h-8 rounded-full bg-tertiary/8 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
            aria-label="Remove document"
          >
            <X size={14} className="text-tertiary" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-secondary/5 transition-colors disabled:opacity-40"
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-themeblue3/10 text-themeblue2">
            <Paperclip size={14} />
          </div>
          <span className="flex-1 min-w-0 text-sm font-medium text-secondary">{label}</span>
        </button>
      )}
    </>
  )
}

function HistoryLink({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-secondary/5 transition-colors"
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-themeblue3/10 text-themeblue2">
        <History size={14} />
      </div>
      <span className="flex-1 min-w-0 text-sm font-medium text-secondary">
        Dispatch history{count > 0 && ` · ${count}`}
      </span>
      <ChevronRight size={16} className="text-tertiary shrink-0" />
    </button>
  )
}

function statusLabel(s: DispatchStatus): string {
  return s === 'expired' ? 'Dispatch expired' : s === 'expiring' ? 'Dispatch expiring' : 'On dispatch'
}
function statusText(s: DispatchStatus): string {
  return s === 'active' ? 'text-themegreen' : 'text-themered'
}
function statusBg(s: DispatchStatus): string {
  return s === 'active' ? 'bg-themegreen/10 text-themegreen' : 'bg-themered/10 text-themered'
}

function describe(e: AuditEvent): string {
  const p = e.payload ?? {}
  if (e.eventType === 'dispatch.opened') {
    const exp = typeof p.exp_date === 'string' ? fmtDate(p.exp_date) : '—'
    const odo = typeof p.odo_out === 'number' ? ` · out ${p.odo_out.toLocaleString()} mi` : ''
    return `Dispatched · exp ${exp}${odo}`
  }
  if (e.eventType === 'dispatch.closed') {
    const ret = typeof p.returned_at === 'string' ? fmtDate(p.returned_at) : fmtDate(e.occurredAt)
    const odo = typeof p.odo_in === 'number' ? ` · in ${p.odo_in.toLocaleString()} mi` : ''
    return `Returned ${ret}${odo}`
  }
  return e.eventType
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }),
  })
}
