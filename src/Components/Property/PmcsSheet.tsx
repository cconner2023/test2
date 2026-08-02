import { useEffect, useState, useRef } from 'react'
import {
  AlertTriangle, Plus, Check, ClipboardCheck, Wrench,
  X, History, Paperclip, FileText,
} from 'lucide-react'
import { loadAuditBySubject } from '../../lib/auditService'
import type { AuditEvent } from '../../lib/auditTypes'
import { PMCS_EVENT_TYPES, foldOpenFaults, summarizePmcs } from '../../lib/pmcsFold'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { TextInput } from '@/Components/primitives/FormInputs'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { PartyPicker, partyLabel, type Party } from './PartyPicker'
import { FuelMeter } from '@/Components/DomainInputs'
import { OverlayStack, type StackNav } from '@/Components/primitives/OverlayStack'
import { useRecordPreview } from './RecordPreview'
import { DocScanner } from './DocScanner'
import { ensurePdfFile } from '../../lib/docScan'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { SectionCard } from '@/Components/primitives/Section'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { uploadEncryptedAttachment } from '../../lib/signal'
import type { PmcsDoc } from '../../lib/propertyService'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('PmcsSheet')

/**
 * PmcsSheet — the PMCS (preventive-maintenance checks & services) surface for a
 * property subject (a stock item, or a vehicle location with its own 5988). Its
 * ops twin is the DispatchSheet; both are OverlayStacks (the drill-down/morph
 * primitive, NOT a mobile Sheet) scoped to the whole property drawer, launched
 * from the host's ellipsis menu. One card whose body morphs across three screens:
 *
 *  - CHECK (root): the standard PMCS intake — mileage + fuel-level readings
 *    (vehicle subjects only), who did it, the open faults to Correct or leave, an
 *    inline-add to report a new fault, and an optional 5988E attachment. THE WHOLE
 *    CHECK COMMITS AS ONE EVENT: marking a correction or reporting a fault is local
 *    UI state until the footer's "Record PMCS" fires — that single pmcs.clear event
 *    carries the readings AND the faults found/corrected (see lib/pmcsFold). One
 *    PMCS = one history row that states its own outcome; faults are NOT separate
 *    fault.opened/fault.corrected rows. The Scan action opens DocScanner nested.
 *  - HISTORY: every PMCS as a section card stating its outcome (no new faults / new
 *    fault: X / corrected: Y) + readings — tap one to drill into…
 *  - RECORD: the tapped event's detail (view 5988E / delete), shared with the
 *    timeline via the headless useRecordPreview hook; its delete confirm is a
 *    z-stacked interrupt. Back pops record → history → check.
 *
 * Open faults fold across checks (foldOpenFaults): a fault opened by one PMCS stays
 * OPEN until a later PMCS lists its id in faultsCorrected. Legacy standalone fault
 * events (pre-bundle) still fold for open-state, so an old open fault can be
 * corrected by a new check.
 */

interface PmcsSheetProps {
  isOpen: boolean
  onClose: () => void
  subjectType?: 'item' | 'location'
  subjectId: string
  clinicId: string
  /** Scopes the PreviewOverlay to the property drawer (desktop). Null on mobile
   *  → the overlay floats fixed, auto-stacked above the detail sheet. */
  containerRef?: React.RefObject<HTMLElement | null>
  /** Explicit z-tier — needed when this is launched from the shared ItemActionMenu,
   *  which mounts OUTSIDE any sheet (so there's no sheet context to inherit a ceiling
   *  from). Pass a value above the host sheet on mobile; omit when scoped (desktop). */
  zIndex?: number
}

export function PmcsSheet({ isOpen, onClose, subjectType = 'item', subjectId, clinicId, containerRef, zIndex }: PmcsSheetProps) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewEvent, setPreviewEvent] = useState<AuditEvent | null>(null)
  // Live stack nav (history → record drill-down is async from row taps).
  const navRef = useRef<StackNav | null>(null)
  const [mileage, setMileage] = useState('')
  const [fuelLevel, setFuelLevel] = useState<number | null>(null)
  // Operator + mechanic are each a party (cluster member or off-roster free-text) —
  // only their display name persists into the encrypted PMCS payload.
  const [operator, setOperator] = useState<Party | null>(null)
  const [mechanic, setMechanic] = useState<Party | null>(null)
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docError, setDocError] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  // Faults staged on THIS check — committed into the pmcs.clear event on Record,
  // not emitted live. `newFaults` = faults found now; `markedCorrect` = prior open
  // faults this check is closing (toggleable until Record).
  const [newFaults, setNewFaults] = useState<{ id: string; description: string }[]>([])
  const [markedCorrect, setMarkedCorrect] = useState<Set<string>>(new Set())
  // The open fault awaiting a "mark corrected?" confirm (null = none).
  const [confirmCorrectId, setConfirmCorrectId] = useState<string | null>(null)

  const userId = useAuthStore((s) => s.user?.id)
  const { medics } = useClinicMedics()

  // Cluster roster for the party pickers — { id, "RANK Last First" }. The PMCS payload
  // only stores the picked display name (no PHI — operational identity only), so the
  // id is just for the picker's single-select checkmark.
  const members = medics
    .map((m) => ({
      id: m.id,
      displayName: [m.rank, m.lastName, m.firstName].filter(Boolean).join(' ').trim(),
    }))
    .filter((m) => m.displayName.length > 0)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))

  // Mileage + fuel are a vehicle's 5988 intake; a stock item's PMCS is just the
  // fault check + a clean-check log.
  const isVehicle = subjectType === 'location'

  const recordPmcs = usePropertyStore((s) => s.recordPmcs)
  const propGen = useInvalidation('properties')

  // Reset transient UI when the overlay closes.
  useEffect(() => {
    if (!isOpen) {
      setPreviewEvent(null); setDesc('')
      setMileage(''); setFuelLevel(null); setOperator(null); setMechanic(null)
      setDocFile(null); setDocError(null); setScannerOpen(false)
      setNewFaults([]); setMarkedCorrect(new Set()); setConfirmCorrectId(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const loaded = await loadAuditBySubject(subjectId, clinicId ?? '').catch((err) => {
        logger.warn('PMCS read failed:', err); return [] as AuditEvent[]
      })
      if (cancelled) return
      const pmcs = loaded
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

  // Open faults carried from prior checks (folds both bundled + legacy events).
  const openFaults = foldOpenFaults(events)
  // History list — one card per PMCS (faults are folded INTO these, not separate).
  const pmcsEvents = events.filter((e) => e.eventType === 'pmcs.clear')

  const addFault = () => {
    const text = desc.trim()
    if (!text) return
    setNewFaults((prev) => [...prev, { id: crypto.randomUUID(), description: text }])
    setDesc('')
  }

  const removeNewFault = (id: string) =>
    setNewFaults((prev) => prev.filter((f) => f.id !== id))

  const toggleCorrect = (faultId: string) =>
    setMarkedCorrect((prev) => {
      const next = new Set(prev)
      if (next.has(faultId)) next.delete(faultId)
      else next.add(faultId)
      return next
    })

  // Most recent recorded mileage — shown as the "Current" hint so the inspector
  // updates from the last reading rather than guessing. events are newest-first.
  const lastMileage = (() => {
    for (const e of events) {
      if (e.eventType === 'pmcs.clear' && typeof e.payload?.mileage === 'number') return e.payload.mileage
    }
    return null
  })()

  // A vehicle intake needs both readings; a stock item's PMCS is always submittable
  // (it logs a clean check / the faults found-or-corrected during it).
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
      const pdf = await ensurePdfFile(docFile)
      const up = await uploadEncryptedAttachment(userId, pdf)
      if (!up.ok) {
        logger.warn('5988E upload failed:', up.error)
        setDocError('Could not upload the document — try again.')
        setBusy(false)
        return
      }
      doc = { path: up.data.path, key: up.data.key, mime: pdf.type || undefined, name: pdf.name }
    }

    const miles = parseInt(mileage, 10)
    // Corrections committed this check — denormalize the description so the history
    // row reads "Corrected: X" without resolving the originating check.
    const correctedList = openFaults
      .filter((f) => markedCorrect.has(f.id))
      .map((f) => ({ id: f.id, description: f.description }))
    const readings = {
      ...(isVehicle ? {
        mileage: Number.isFinite(miles) ? miles : undefined,
        fuelLevel: fuelLevel ?? undefined,
      } : {}),
      ...(partyLabel(operator) ? { operator: partyLabel(operator) } : {}),
      ...(partyLabel(mechanic) ? { mechanic: partyLabel(mechanic) } : {}),
      ...(doc ? { doc } : {}),
      ...(newFaults.length ? { faultsOpened: newFaults } : {}),
      ...(correctedList.length ? { faultsCorrected: correctedList } : {}),
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
  const checkBody = (
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

      {/* Who did it — operator + mechanic each a cluster member OR an off-roster
          (motor-pool / external) party via the shared PartyPicker. Both ride in the
          encrypted payload as a display name only. */}
      <PartyPicker
        members={members}
        value={operator}
        onChange={setOperator}
        placeholder="Operator"
        externalPlaceholder="Off-roster operator…"
      />
      <PartyPicker
        members={members}
        value={mechanic}
        onChange={setMechanic}
        placeholder="Mechanic (optional)"
        title="Mechanic"
        externalPlaceholder="Off-roster mechanic…"
      />

      {/* Inline add — report a new fault (TextInput + circular Plus). */}
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex-1 min-w-0">
          <TextInput value={desc} onChange={setDesc} placeholder="Report a fault" />
        </div>
        <button
          type="button"
          onClick={addFault}
          disabled={!desc.trim()}
          className="shrink-0 w-9 h-9 rounded-full bg-themeblue3 text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* New faults found on THIS check (commit on Record; removable until then).
          No icon chip — just the text + a remove X. */}
      {newFaults.map((f) => (
        <div key={f.id} className="flex items-center gap-3 px-4 py-3">
          <p className="flex-1 min-w-0 text-sm font-medium text-themered truncate">{f.description}</p>
          <button
            type="button"
            onClick={() => removeNewFault(f.id)}
            className="shrink-0 w-8 h-8 rounded-full bg-tertiary/8 flex items-center justify-center active:scale-95 transition-all"
            aria-label="Remove fault"
          >
            <X size={14} className="text-tertiary" />
          </button>
        </div>
      ))}

      {/* Current (open) faults from prior checks, listed BELOW the report input. No
          icon chip; the close (X) corrects one — it asks to confirm first, then
          stages it (green + struck). A corrected row's X reverts the staged fix. */}
      {openFaults.map((f) => {
        const marked = markedCorrect.has(f.id)
        return (
          <div key={f.id} className="flex items-center gap-3 px-4 py-3">
            <p className={`flex-1 min-w-0 text-sm font-medium truncate ${marked ? 'text-themegreen line-through' : 'text-themered'}`}>{f.description}</p>
            <button
              type="button"
              onClick={() => (marked ? toggleCorrect(f.id) : setConfirmCorrectId(f.id))}
              className="shrink-0 w-8 h-8 rounded-full bg-tertiary/8 flex items-center justify-center active:scale-95 transition-all"
              aria-label={marked ? 'Undo correction' : 'Correct fault'}
            >
              <X size={14} className={marked ? 'text-themegreen' : 'text-tertiary'} />
            </button>
          </div>
        )
      })}

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

  // ── HISTORY view body — every PMCS as a section card stating its outcome. The
  //    back chevron lives in the overlay HEADER (onBack), not an in-body row. ──
  const historyBody = (
    <div className="px-3 pt-2 pb-3">
      {pmcsEvents.length === 0 ? (
        <p className="text-[10pt] text-tertiary px-1 py-4">No PMCS history yet</p>
      ) : (
        <div className="space-y-2">
          {pmcsEvents.map((e) => {
            const s = summarizePmcs(e)
            const doc = docOf(e)
            const Icon = s.foundFault ? AlertTriangle : s.correctedFault ? Wrench : ClipboardCheck
            const tint = s.foundFault ? 'bg-themered/10 text-themered' : 'bg-themeblue3/10 text-themeblue2'
            const sub = [s.readings, fmtDate(e.occurredAt)].filter(Boolean).join(' · ')
            return (
              <SectionCard key={e.id}>
                {/* Tap the card → RecordPreview (view 5988E / delete). */}
                <button
                  type="button"
                  onClick={() => { setPreviewEvent(e); navRef.current?.push('record') }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:opacity-70 transition-opacity"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tint}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${s.foundFault ? 'text-themered' : 'text-primary'}`}>{s.title}</p>
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

  // Icon + tint for the previewed record, mirroring its history-row chip.
  const previewMeta = (() => {
    if (!previewEvent) return { Icon: ClipboardCheck, tint: 'bg-themeblue3/10 text-themeblue2' }
    const s = summarizePmcs(previewEvent)
    const Icon = s.foundFault ? AlertTriangle : s.correctedFault ? Wrench : ClipboardCheck
    return { Icon, tint: s.foundFault ? 'bg-themered/10 text-themered' : 'bg-themeblue3/10 text-themeblue2' }
  })()

  // The history → record drill-down screen, shared with the timeline via the
  // headless hook. Closing (back, or after delete) pops to history.
  const recordView = useRecordPreview({
    event: previewEvent,
    onClose: () => { navRef.current?.pop(); setPreviewEvent(null) },
    label: previewEvent ? summarizePmcs(previewEvent).title : '',
    detail: previewEvent ? summarizePmcs(previewEvent).readings : undefined,
    Icon: previewMeta.Icon,
    tint: previewMeta.tint,
    containerRef,
  })

  // Three morph screens (check ⇄ history → record) — one card whose body morphs
  // instead of toggling a `view` flag + z-stacking a nested RecordPreview. The
  // stack owns the back chevron; DocScanner stays a nested overlay launched on top
  // (its own self-contained capture flow), and the delete ConfirmDialog stays a
  // z-stacked INTERRUPT inside the record screen.
  const screens = {
    check: {
      title: 'PMCS',
      // Scan/Attach + History LEFT, the success/confirm (Record PMCS) RIGHT —
      // present always but DISABLED until the intake is complete.
      footer: (_: unknown, nav: StackNav) => (
        <FooterPill>
          <ActionButton
            icon={docFile ? FileText : Paperclip}
            label={docFile ? 'Replace 5988E' : 'Scan 5988E'}
            variant="default"
            onClick={() => setScannerOpen(true)}
          />
          <ActionButton
            icon={History}
            label={pmcsEvents.length > 0 ? `History · ${pmcsEvents.length}` : 'History'}
            variant="default"
            onClick={() => nav.push('history')}
          />
        </FooterPill>
      ),
      rightFooter: (
        <FooterPill side="right">
          <PillButton icon={Check} iconSize={16} accent="success" disabled={!canSubmit} onClick={handleRecord} label="Record PMCS" />
        </FooterPill>
      ),
      render: () => (
        <>
          {checkBody}
          {/* Nested capture overlay — auto-stacks above this card via context. */}
          <DocScanner
            isOpen={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onComplete={(f) => { setDocFile(f); setDocError(null) }}
            formLabel="5988E"
            containerRef={containerRef}
          />
          {/* Correct-a-fault confirm — staged (commits with the check), z-stacked
              INTERRUPT like the record-screen delete. */}
          <ConfirmDialog
            visible={!!confirmCorrectId}
            title="Mark this fault corrected?"
            subtitle={openFaults.find((f) => f.id === confirmCorrectId)?.description}
            confirmLabel="Correct"
            variant="success"
            onConfirm={() => { if (confirmCorrectId) toggleCorrect(confirmCorrectId); setConfirmCorrectId(null) }}
            onCancel={() => setConfirmCorrectId(null)}
          />
        </>
      ),
    },
    history: {
      title: 'PMCS history',
      render: () => historyBody,
    },
    record: {
      // The tapped check opens in its review card ("PMCS" title) — summary + readings
      // + Open 5988E; Edit (footer) flips to the form. Back chevron + X ride the header.
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
      zIndex={zIndex}
      navRef={navRef}
      initial={{ key: 'check' }}
      screens={screens}
      maxWidth={360}
      previewMaxHeight="60dvh"
      loading={loading || busy || recordView.saving}
    />
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
