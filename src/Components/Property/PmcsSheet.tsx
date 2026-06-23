import { useEffect, useState, type ReactNode } from 'react'
import {
  AlertTriangle, Plus, Check, ClipboardCheck, Loader2, Wrench,
  X, History, Paperclip, FileText,
} from 'lucide-react'
import { getAuditBySubjectLocal, fetchAuditBySubject } from '../../lib/auditService'
import type { AuditEvent } from '../../lib/auditTypes'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { TextInput, PickerInput } from '../FormInputs'
import { PreviewOverlay } from '../PreviewOverlay'
import { RecordPreview } from './RecordPreview'
import { DocScanner } from './DocScanner'
import { ActionButton } from '../ActionButton'
import { PillButton } from '../HeaderPill'
import { SectionCard } from '../Section'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { uploadEncryptedAttachment } from '../../lib/signal'
import type { PmcsDoc } from '../../lib/propertyService'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('PmcsSheet')

/**
 * PmcsSheet — the PMCS (preventive-maintenance checks & services) surface for a
 * property subject (a stock item, or a vehicle location with its own 5988). Its
 * ops twin is the DispatchSheet; both are PreviewOverlays (NOT a mobile Sheet)
 * scoped to the whole property drawer, launched from the host's ellipsis menu.
 * Two views inside one overlay:
 *
 *  - CHECK (default): the standard PMCS intake — mileage + fuel-level readings
 *    (vehicle subjects only), the open faults to Correct or leave, an inline-add
 *    to report a new fault, and an optional 5988E attachment. The footer carries
 *    the "Record PMCS" action (present always; disabled until the intake is
 *    complete). Corrections / new faults emit immediately as their own audit
 *    events; the footer action logs the inspection (with readings in the
 *    pmcs.clear payload).
 *  - HISTORY: every PMCS event as a section card — tap to view its 5988E, with
 *    per-card edit (faults/corrections carry text) and delete. audit_log gained
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
  /** Scopes the PreviewOverlay to the property drawer (desktop). Null on mobile
   *  → the overlay floats fixed, auto-stacked above the detail sheet. */
  containerRef?: React.RefObject<HTMLElement | null>
}

interface OpenFault {
  id: string
  description: string
  occurredAt: string
}

export function PmcsSheet({ isOpen, onClose, subjectType = 'item', subjectId, clinicId, containerRef }: PmcsSheetProps) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'check' | 'history'>('check')
  const [previewEvent, setPreviewEvent] = useState<AuditEvent | null>(null)
  const [mileage, setMileage] = useState('')
  const [fuelLevel, setFuelLevel] = useState<number | null>(null)
  const [operator, setOperator] = useState('')
  const [mechanic, setMechanic] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docError, setDocError] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const userId = useAuthStore((s) => s.user?.id)
  const { medics } = useClinicMedics()

  // Operator dropdown options — the clinic roster, "RANK Last, First". value =
  // the display name so the PMCS payload carries a readable name with no later
  // roster lookup (no PHI — operational identity only).
  const operatorOptions = medics
    .map((m) => {
      const name = [m.rank, [m.lastName, m.firstName].filter(Boolean).join(', ')]
        .filter(Boolean).join(' ').trim()
      return name
    })
    .filter((n) => n.length > 0)
    .sort((a, b) => a.localeCompare(b))

  // Mileage + fuel are a vehicle's 5988 intake; a stock item's PMCS is just the
  // fault check + a clean-check log.
  const isVehicle = subjectType === 'location'

  const raiseFault = usePropertyStore((s) => s.raiseFault)
  const correctFault = usePropertyStore((s) => s.correctFault)
  const recordPmcs = usePropertyStore((s) => s.recordPmcs)
  const propGen = useInvalidation('properties')

  // Reset transient UI when the overlay closes.
  useEffect(() => {
    if (!isOpen) {
      setView('check'); setPreviewEvent(null); setDesc('')
      setMileage(''); setFuelLevel(null); setOperator(''); setMechanic('')
      setDocFile(null); setDocError(null); setScannerOpen(false)
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

  // Most recent recorded mileage — shown as the "Current" hint so the inspector
  // updates from the last reading rather than guessing. events are newest-first.
  const lastMileage = (() => {
    for (const e of events) {
      if (e.eventType === 'pmcs.clear' && typeof e.payload?.mileage === 'number') return e.payload.mileage
    }
    return null
  })()

  // A vehicle intake needs both readings; a stock item's PMCS is always submittable
  // (it logs a clean check / the faults reported during it).
  const canSubmit = !isVehicle || (mileage.trim() !== '' && fuelLevel != null)

  const handleRecord = async () => {
    if (!canSubmit || busy) return
    setBusy(true)
    setDocError(null)

    // Encrypt + upload the 5988E first (signal attachment pipeline: random AES key,
    // ciphertext to the message-attachments bucket, key rides in the encrypted
    // payload below). Abort the record if the upload fails so nothing logs without it.
    let doc: PmcsDoc | undefined
    if (docFile && userId) {
      const up = await uploadEncryptedAttachment(userId, docFile)
      if (!up.ok) {
        logger.warn('5988E upload failed:', up.error)
        setDocError('Could not upload the document — try again.')
        setBusy(false)
        return
      }
      doc = { path: up.data.path, key: up.data.key, mime: docFile.type || undefined, name: docFile.name }
    }

    const miles = parseInt(mileage, 10)
    const readings = {
      ...(isVehicle ? {
        mileage: Number.isFinite(miles) ? miles : undefined,
        fuelLevel: fuelLevel ?? undefined,
      } : {}),
      ...(operator.trim() ? { operator: operator.trim() } : {}),
      ...(mechanic.trim() ? { mechanic: mechanic.trim() } : {}),
      ...(doc ? { doc } : {}),
    }
    const ok = await recordPmcs(subjectType, subjectId, Object.keys(readings).length ? readings : undefined)
    setBusy(false)
    if (ok) onClose()
  }

  const docOf = (e: AuditEvent): PmcsDoc | null => {
    const d = e.payload?.doc
    return d && typeof d === 'object' && typeof (d as PmcsDoc).path === 'string'
      ? (d as PmcsDoc)
      : null
  }

  // ── CHECK view body — the standard PMCS intake form ─────────────────────────
  const checkBody = loading ? (
    <div className="flex items-center justify-center px-4 py-6">
      <Loader2 size={16} className="animate-spin text-tertiary" />
    </div>
  ) : (
    <div className="divide-y divide-tertiary/8">
      {/* Vehicle readings — mileage + fuel level. Hidden for non-vehicle items. */}
      {isVehicle && (
        <TextInput
          value={mileage}
          onChange={(v) => setMileage(v.replace(/[^\d]/g, ''))}
          inputMode="numeric"
          placeholder="Mileage"
          currentValue={lastMileage != null ? `${lastMileage.toLocaleString()} mi` : undefined}
        />
      )}
      {isVehicle && <FuelMeter value={fuelLevel} onChange={setFuelLevel} />}

      {/* Who did it — operator picked from the clinic roster, mechanic optional
          free-text (motor-pool / external). Both ride in the encrypted payload. */}
      <PickerInput
        value={operator}
        onChange={setOperator}
        options={operatorOptions}
        placeholder="Operator"
      />
      <TextInput value={mechanic} onChange={setMechanic} placeholder="Mechanic (optional)" />

      {/* Faults — previously-unclosed faults render to Correct or leave; empty if
          none. The inline-add reports a fault found during this check. */}
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

      {/* Attach a 5988E worksheet — the TRIGGER lives in the footer (Scan is a
          footer action) and opens the DocScanner (capture → crop → enhance →
          multi-page PDF); here we only render the picked-file chip (so it stays
          visible/removable). Encrypted client-side into the attachment bucket on
          submit; the key rides in the encrypted PMCS payload. */}
      {docFile && (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-themeblue3/10 text-themeblue2">
            <FileText size={14} />
          </div>
          <span className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{docFile.name}</span>
          <button
            type="button"
            onClick={() => setDocFile(null)}
            disabled={busy}
            className="shrink-0 w-8 h-8 rounded-full bg-tertiary/8 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
            aria-label="Remove document"
          >
            <X size={14} className="text-tertiary" />
          </button>
        </div>
      )}
      {docError && <p className="px-4 pb-2 text-[9pt] font-medium text-themeredred">{docError}</p>}
    </div>
  )

  // ── HISTORY view body — every PMCS event as a section card. The back chevron
  //    lives in the overlay HEADER (onBack), not an in-body row. ───────────────
  const historyBody = (
    <div className="px-3 pt-2 pb-3">
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-tertiary" />
        </div>
      ) : events.length === 0 ? (
        <p className="text-[10pt] text-tertiary px-1 py-4">No PMCS history yet</p>
      ) : (
        <div className="space-y-2">
          {events.map((e) => {
            const open = e.eventType === 'fault.opened' && !correctedIds.has(e.id)
            const doc = docOf(e)
            const Icon = e.eventType === 'fault.opened' ? AlertTriangle
              : e.eventType === 'fault.corrected' ? Wrench : ClipboardCheck
            return (
              <SectionCard key={e.id}>
                {/* Tap the card → RecordPreview (view 5988E / edit / delete). The
                    per-row pencil + trash are gone; the overlay owns those. */}
                <button
                  type="button"
                  onClick={() => setPreviewEvent(e)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:opacity-70 transition-opacity"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${open ? 'bg-themered/10 text-themered' : 'bg-themeblue3/10 text-themeblue2'}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${open ? 'text-themered' : 'text-primary'}`}>{describe(e)}</p>
                    <p className="text-[9pt] text-tertiary">{fmtDate(e.occurredAt)}</p>
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

  const body = view === 'history' ? historyBody : checkBody

  // Icon + tint for the previewed record, mirroring its history-row chip.
  const previewMeta = (() => {
    const e = previewEvent
    const open = e?.eventType === 'fault.opened' && !correctedIds.has(e.id)
    const Icon = e?.eventType === 'fault.opened' ? AlertTriangle
      : e?.eventType === 'fault.corrected' ? Wrench : ClipboardCheck
    return { Icon, tint: open ? 'bg-themered/10 text-themered' : 'bg-themeblue3/10 text-themeblue2' }
  })()

  // Footer actions (check view only) — Attach on the LEFT, the success/confirm
  // (Record PMCS) on the RIGHT (rightFooter). Per the explicit footer-action
  // directive Record is present always but DISABLED until the intake is complete.
  const footer = view === 'check' ? (
    <div className="flex gap-1 bg-themewhite rounded-2xl px-1.5 py-1.5">
      <ActionButton
        icon={docFile ? FileText : Paperclip}
        label={docFile ? 'Replace 5988E' : 'Scan 5988E'}
        variant="default"
        onClick={() => setScannerOpen(true)}
      />
      <ActionButton
        icon={History}
        label={events.length > 0 ? `History · ${events.length}` : 'History'}
        variant="default"
        onClick={() => setView('history')}
      />
    </div>
  ) : undefined
  const rightFooter = view === 'check' ? (
    <div className="bg-themewhite rounded-2xl px-1.5 py-1.5">
      <PillButton icon={Check} iconSize={16} accent="success" disabled={!canSubmit} onClick={handleRecord} label="Record PMCS" />
    </div>
  ) : undefined

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={null}
      containerRef={containerRef}
      title={view === 'history' ? 'PMCS history' : 'PMCS'}
      onBack={view === 'history' ? () => { setView('check'); setPreviewEvent(null) } : undefined}
      maxWidth={360}
      previewMaxHeight="60dvh"
      footer={footer}
      rightFooter={rightFooter}
    >
      <>
        {body as ReactNode}
        <RecordPreview
          event={previewEvent}
          onClose={() => setPreviewEvent(null)}
          label={previewEvent ? describe(previewEvent) : ''}
          Icon={previewMeta.Icon}
          tint={previewMeta.tint}
          containerRef={containerRef}
        />
        <DocScanner
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onComplete={(f) => { setDocFile(f); setDocError(null) }}
          formLabel="5988E"
        />
      </>
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

/**
 * FuelMeter — a fuel-gauge intake: E ▮▮▮▯▯ F. Ten tappable segments set the level
 * in increments of 10 (10–100%); the "E" cap sets empty (0). null = not yet read.
 */
function FuelMeter({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const segments = Array.from({ length: 10 }, (_, i) => (i + 1) * 10)
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-secondary">Fuel level</span>
        <span className="text-sm font-semibold text-primary tabular-nums">
          {value == null ? '—' : `${value}%`}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(0)}
          aria-label="Fuel empty"
          className="w-3.5 shrink-0 text-[9pt] font-bold text-tertiary active:scale-90 transition-transform"
        >
          E
        </button>
        <div className="flex-1 flex items-center gap-1">
          {segments.map((lvl) => {
            const filled = value != null && value >= lvl
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => onChange(lvl)}
                aria-label={`Fuel ${lvl} percent`}
                className={`h-6 flex-1 rounded-md active:scale-95 transition-all ${filled ? 'bg-themeblue3' : 'bg-tertiary/12'}`}
              />
            )
          })}
        </div>
        <span className="w-3.5 shrink-0 text-[9pt] font-bold text-tertiary text-right">F</span>
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
