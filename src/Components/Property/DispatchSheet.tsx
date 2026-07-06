import { useEffect, useState, useRef } from 'react'
import {
  Route, RotateCcw, FileText, Paperclip, X,
  History, CalendarClock, Check,
} from 'lucide-react'
import { getAuditBySubjectLocal, fetchAuditBySubject } from '../../lib/auditService'
import type { AuditEvent } from '../../lib/auditTypes'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { TextInput, DatePickerInput } from '@/Components/primitives/FormInputs'
import { OverlayStack, type StackNav } from '@/Components/primitives/OverlayStack'
import { useRecordPreview } from './RecordPreview'
import { DocScanner } from './DocScanner'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { SectionCard } from '@/Components/primitives/Section'
import { uploadEncryptedAttachment } from '../../lib/signal'
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
 * An OverlayStack (the drill-down/morph primitive) — one card whose body morphs
 * across three screens instead of toggling a `view` flag + z-stacking a nested
 * RecordPreview. The same shape as PmcsSheet, scoped to the property drawer:
 *  - CURRENT (root): if on dispatch, the active card (exp date + status +
 *    odometer-out + dispatch doc) and a Return form (return date, odometer-in,
 *    optional return doc); the footer action returns the vehicle. If NOT on
 *    dispatch, the open intake (exp date, odometer-out, attach dispatch doc); the
 *    footer Dispatch action is present always but DISABLED until an exp date is set.
 *    The Scan action opens DocScanner as a nested overlay on top.
 *  - HISTORY: every dispatch event as a section card — tap one to drill into…
 *  - RECORD: the tapped event's detail (view dispatch form / delete), shared with
 *    the timeline via the headless useRecordPreview hook; its delete confirm is a
 *    z-stacked interrupt. Back pops history → current.
 *
 * Deleting the open dispatch.opened event removes the vehicle from the open-dispatch
 * fold, so its derived (render-only) calendar exp-date entry disappears too — the
 * store delete bumps the `properties` generation that useVehicleDispatches /
 * useDispatchCalendarEvents fold off (no real calendar row exists to delete).
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
  const [previewEvent, setPreviewEvent] = useState<AuditEvent | null>(null)
  // Live stack nav (history → record drill-down is async from row taps).
  const navRef = useRef<StackNav | null>(null)

  // Open-intake form state.
  const [expDate, setExpDate] = useState('')
  const [odoOut, setOdoOut] = useState('')
  const [operator, setOperator] = useState('')
  const [tc, setTc] = useState('')
  const [openNote, setOpenNote] = useState('')
  const [openDocFile, setOpenDocFile] = useState<File | null>(null)
  // Return form state.
  const [returnDate, setReturnDate] = useState('')
  const [odoIn, setOdoIn] = useState('')
  const [returnNote, setReturnNote] = useState('')
  const [returnDocFile, setReturnDocFile] = useState<File | null>(null)
  const [docError, setDocError] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const userId = useAuthStore((s) => s.user?.id)
  const openDispatch = usePropertyStore((s) => s.openDispatch)
  const closeDispatch = usePropertyStore((s) => s.closeDispatch)
  const propGen = useInvalidation('properties')

  // Reset transient UI when the overlay closes.
  useEffect(() => {
    if (!isOpen) {
      setPreviewEvent(null); setDocError(null)
      setExpDate(''); setOdoOut(''); setOperator(''); setTc(''); setOpenNote(''); setOpenDocFile(null)
      setReturnDate(''); setOdoIn(''); setReturnNote(''); setReturnDocFile(null)
      setScannerOpen(false)
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
      ...(operator.trim() ? { operator: operator.trim() } : {}),
      ...(tc.trim() ? { tc: tc.trim() } : {}),
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

  const docOf = (e: AuditEvent): PmcsDoc | null => {
    const d = e.payload?.doc
    return d && typeof d === 'object' && typeof (d as PmcsDoc).path === 'string' ? (d as PmcsDoc) : null
  }

  // ── CURRENT view ────────────────────────────────────────────────────────────
  const currentBody = (
    current ? (
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
      {returnDocFile && <FileChip file={returnDocFile} onRemove={() => setReturnDocFile(null)} busy={busy} />}
      {docError && <p className="px-4 pb-2 text-[9pt] font-medium text-themered">{docError}</p>}
    </div>
  ) : (
    // No current dispatch — the open intake.
    <div className="divide-y divide-tertiary/8">
      <DatePickerInput value={expDate} onChange={setExpDate} placeholder="Dispatch expires" minDate={new Date().toISOString().slice(0, 10)} />
      <TextInput value={odoOut} onChange={(v) => setOdoOut(v.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Odometer out" />
      {/* Who took it out — operator (driver) + TC (track commander), free-text so
          either can be from another unit. Ride in the encrypted payload, no PHI. */}
      <TextInput value={operator} onChange={setOperator} placeholder="Operator" />
      <TextInput value={tc} onChange={setTc} placeholder="TC" />
      {openDocFile && <FileChip file={openDocFile} onRemove={() => setOpenDocFile(null)} busy={busy} />}
      {docError && <p className="px-4 pb-2 text-[9pt] font-medium text-themered">{docError}</p>}
    </div>
    )
  )

  // ── HISTORY view — every dispatch event as a section card. The back chevron
  //    lives in the overlay HEADER (onBack), not an in-body row. ───────────────
  const historyBody = (
    <div className="px-3 pt-2 pb-3">
      {events.length === 0 ? (
        <p className="text-[10pt] text-tertiary px-1 py-4">No dispatch history yet</p>
      ) : (
        <div className="space-y-2">
          {events.map((e) => {
            const doc = docOf(e)
            const opened = e.eventType === 'dispatch.opened'
            const Icon = opened ? Route : RotateCcw
            const parts = dispatchParts(e)
            const sub = [parts.detail, fmtDate(e.occurredAt)].filter(Boolean).join(' · ')
            return (
              <SectionCard key={e.id}>
                {/* Tap the card → RecordPreview (view dispatch form / delete). The
                    per-row trash is gone; the overlay owns it. */}
                <button
                  type="button"
                  onClick={() => { setPreviewEvent(e); navRef.current?.push('record') }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:opacity-70 transition-opacity"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${opened ? 'bg-themeblue3/10 text-themeblue2' : 'bg-themegreen/10 text-themegreen'}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{parts.label}</p>
                    <p className="text-[9pt] text-tertiary truncate">{sub}</p>
                  </div>
                  {doc && <FileText size={14} className="text-themeblue2 shrink-0" />}
                </button>
              </SectionCard>
            )
          })}
        </div>
      )}
    </div>
  )

  // The footer Scan action opens the DocScanner; its finished PDF routes to the
  // active doc (the return doc when on dispatch, else the open doc).
  const activeDoc = current ? returnDocFile : openDocFile

  // The history → record drill-down screen, shared with the timeline via the
  // headless hook. Closing (back, or after edit/delete) pops to history.
  const recordParts = previewEvent ? dispatchParts(previewEvent) : null
  const recordView = useRecordPreview({
    event: previewEvent,
    onClose: () => { navRef.current?.pop(); setPreviewEvent(null) },
    label: recordParts?.label ?? '',
    detail: recordParts?.detail,
    Icon: previewEvent?.eventType === 'dispatch.opened' ? Route : RotateCcw,
    tint: previewEvent?.eventType === 'dispatch.opened' ? 'bg-themeblue3/10 text-themeblue2' : 'bg-themegreen/10 text-themegreen',
    containerRef,
  })

  // Three morph screens (current ⇄ history → record) — one card whose body morphs
  // instead of toggling a `view` flag + z-stacking a nested RecordPreview. The
  // stack owns the back chevron; DocScanner stays a nested overlay launched on top
  // (its own self-contained capture flow), and the delete ConfirmDialog stays a
  // z-stacked INTERRUPT inside the record screen.
  const screens = {
    current: {
      title: 'Dispatch',
      // Scan options LEFT, the success/confirm (Return / Dispatch) RIGHT. The
      // confirm is present always but DISABLED until usable (Dispatch needs an exp
      // date; Return defaults today so it's always ready).
      footer: (_: unknown, nav: StackNav) => (
        <div className="flex gap-1 bg-themewhite rounded-2xl px-1.5 py-1.5">
          <ActionButton
            icon={activeDoc ? FileText : Paperclip}
            label={activeDoc ? 'Replace form' : (current ? 'Scan return form' : 'Scan dispatch form')}
            variant="default"
            onClick={() => setScannerOpen(true)}
          />
          <ActionButton
            icon={History}
            label={events.length > 0 ? `History · ${events.length}` : 'History'}
            variant="default"
            onClick={() => nav.push('history')}
          />
        </div>
      ),
      rightFooter: (
        <div className="bg-themewhite rounded-2xl px-1.5 py-1.5">
          {current
            ? <PillButton icon={Check} iconSize={16} accent="success" onClick={handleReturn} label="Return" />
            : <PillButton icon={Check} iconSize={16} accent="success" disabled={!expDate} onClick={handleOpen} label="Dispatch" />}
        </div>
      ),
      render: () => (
        <>
          {currentBody}
          {/* Nested capture overlay — auto-stacks above this card via context. */}
          <DocScanner
            isOpen={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onComplete={(f) => { if (current) setReturnDocFile(f); else setOpenDocFile(f); setDocError(null) }}
            formLabel={current ? 'return form' : 'dispatch form'}
            containerRef={containerRef}
          />
        </>
      ),
    },
    history: {
      title: 'Dispatch history',
      render: () => historyBody,
    },
    record: {
      // The tapped dispatch opens directly in its editable form ("Dispatch" title);
      // the back chevron + X ride the header.
      title: recordView.title ?? undefined,
      onBack: (nav: StackNav) => { nav.pop(); setPreviewEvent(null) },
      footer: recordView.footer,
      rightFooter: recordView.rightFooter,
      render: () => <>{recordView.body}{recordView.confirm}</>,
    },
  }

  return (
    <OverlayStack
      isOpen={isOpen}
      onClose={onClose}
      containerRef={containerRef}
      navRef={navRef}
      initial={{ key: 'current' }}
      screens={screens}
      maxWidth={360}
      previewMaxHeight="60dvh"
      loading={loading || busy || recordView.saving}
    />
  )
}

/** Picked-file chip — filename + X to remove. The attach TRIGGER lives in the
 *  footer; this only displays/clears the doc once one is attached. */
function FileChip({ file, onRemove, busy }: { file: File; onRemove: () => void; busy: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-themeblue3/10 text-themeblue2">
        <FileText size={14} />
      </div>
      <span className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{file.name}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        className="shrink-0 w-8 h-8 rounded-full bg-tertiary/8 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
        aria-label="Remove document"
      >
        <X size={14} className="text-tertiary" />
      </button>
    </div>
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

/** A dispatch event split into a card headline + meta line (mirrors PMCS's
 *  summarizePmcs split): label = "Dispatched"/"Returned", detail = the readings. */
function dispatchParts(e: AuditEvent): { label: string; detail: string } {
  const p = e.payload ?? {}
  if (e.eventType === 'dispatch.opened') {
    const bits: string[] = []
    if (typeof p.exp_date === 'string') bits.push(`exp ${fmtDate(p.exp_date)}`)
    if (typeof p.odo_out === 'number') bits.push(`out ${p.odo_out.toLocaleString()} mi`)
    if (typeof p.operator === 'string' && p.operator) bits.push(p.operator)
    if (typeof p.tc === 'string' && p.tc) bits.push(`TC ${p.tc}`)
    return { label: 'Dispatched', detail: bits.join(' · ') }
  }
  if (e.eventType === 'dispatch.closed') {
    const bits: string[] = [typeof p.returned_at === 'string' ? fmtDate(p.returned_at) : fmtDate(e.occurredAt)]
    if (typeof p.odo_in === 'number') bits.push(`in ${p.odo_in.toLocaleString()} mi`)
    return { label: 'Returned', detail: bits.join(' · ') }
  }
  return { label: e.eventType, detail: '' }
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
