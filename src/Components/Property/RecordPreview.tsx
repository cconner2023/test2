import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pencil, Trash2, X, Check, FileText, Paperclip, AlertTriangle, Wrench, type LucideIcon } from 'lucide-react'
import type { AuditEvent } from '../../lib/auditTypes'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { downloadDecryptedAttachment, uploadEncryptedAttachment } from '../../lib/signal'
import { pmcsOpened, pmcsCorrected } from '../../lib/pmcsFold'
import type { PmcsDoc } from '../../lib/propertyService'
import { PreviewOverlay } from '../PreviewOverlay'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { TextInput, DatePickerInput } from '@/Components/primitives/FormInputs'
import { PartyPicker, partyLabel, type Party } from './PartyPicker'
import { FuelMeter } from '@/Components/DomainInputs'
import { DocScanner } from './DocScanner'
import { ensurePdfFile } from '../../lib/docScan'
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'
import { formatDtg } from '../../Utilities/propertyDates'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('RecordPreview')

/**
 * RecordPreview — the shared "tap a history record → preview, edit or delete it"
 * overlay for property audit rows. Reused by the PMCS history, the Dispatch
 * history and the vehicle/item detail timeline so a tapped row opens ONE
 * consistent surface instead of every list carrying its own inline pencil/trash.
 *
 * A nested PreviewOverlay: opened from inside another PreviewOverlay (PMCS /
 * Dispatch) or from inside the detail Sheet (timeline), it auto-stacks above its
 * host via OverlayStackContext — no explicit zIndex plumbing needed, as long as
 * it renders as a React descendant of that host's children.
 *
 * The three property record types that carry their own intake form — a PMCS check
 * (pmcs.clear) and a dispatch open/close (dispatch.opened / dispatch.closed) — open
 * into the SAME rich REVIEW body the Custody roster shows (RecordReviewBody: a
 * readings/faults "information" section + a prominent Open 5988E / dispatch-form
 * button, with the record and its date carried by the surface's own title rather
 * than a card that repeats it), with Edit + Delete in the footer. Edit flips into the
 * editable form pre-filled from the payload; Save commits a full-payload edit
 * (editPmcsEntry → updateAuditEvent, which preserves occurred_at, so the recorded
 * date never moves). PMCS edit exposes the scalar readings + the 5988E only
 * (mileage, fuel, operator, mechanic, doc); recorded faults carry through unchanged
 * so the cross-check fold still resolves. A lifted-row menu can still route straight
 * to the form via initialAction='edit'. Every other row (transfers, custody, legacy
 * fault text) keeps the view → edit/delete shape: a view card, optional free-text
 * edit for the legacy fault.opened / fault.corrected rows, and a delete. All deletes
 * hard-remove through the store, bumping the `properties` generation so the host
 * list refetches.
 */

interface RecordPreviewProps {
  /** The record to preview — null closes the overlay. */
  event: AuditEvent | null
  onClose: () => void
  /** Caller-supplied one-liner (each surface keeps its own phrasing). */
  label: string
  /** Optional meta line under the label (readings / exp date) — renders as
   *  "{detail} · {date}" in the summary card, matching the host list row. */
  detail?: string
  Icon: LucideIcon
  /** Icon chip classes (bg + text), matching the host list row. */
  tint: string
  /** Scopes the overlay to a container (the property drawer). Null → floats fixed. */
  containerRef?: React.RefObject<HTMLElement | null>
  /** Which mode to open in — a lifted-row menu routes straight to 'edit' or
   *  'delete' (confirm), skipping the view→footer hop. Defaults to 'view'. */
  initialAction?: 'view' | 'edit' | 'delete'
  /** Render the attach/replace trigger as a ROW INSIDE the edit form instead of a
   *  footer action. For hosts with no footer — a pane whose header owns Save and
   *  whose Delete lives in the read-mode ellipsis (the calendar dispatch detail),
   *  where the document is just another field of the record being edited. */
  attachInBody?: boolean
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function docOf(e: AuditEvent | null): PmcsDoc | null {
  const d = e?.payload?.doc
  return d && typeof d === 'object' && typeof (d as PmcsDoc).path === 'string' ? (d as PmcsDoc) : null
}

/**
 * Headless core — all the view/edit/delete state + handlers, returning the body,
 * footer and the delete ConfirmDialog as ready-to-place nodes. Consumed two ways:
 *  - the standalone `RecordPreview` overlay below (timeline + lifted-row menus), and
 *  - an OverlayStack `record` drill-down screen (PMCS / Dispatch history → detail),
 *    where the host spreads {body, footer, confirm} into the screen descriptor.
 * Keeping it headless means the morph-stack screen and the standalone overlay share
 * one implementation instead of forking. The ConfirmDialog stays an INTERRUPT —
 * placed inside the host overlay's children it auto-stacks above via
 * OverlayStackContext (the z-stacking sibling of the morph stack).
 */
export function useRecordPreview({ event, onClose, label, detail, Icon, tint, initialAction = 'view', attachInBody, containerRef }: RecordPreviewProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editText, setEditText] = useState('')
  const [busy, setBusy] = useState(false)
  // Save-only in-flight flag (distinct from `busy`, which also covers delete and
  // doc-open). Drives the overlay HUD morph on save; delete stays modal-only.
  const [saving, setSaving] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)

  // Structured-edit form fields (PMCS check / dispatch open / dispatch close). One
  // flat set of fields, shared across the three kinds — each form renders only the
  // subset it owns. Seeded from the event payload when a record opens.
  const [mileage, setMileage] = useState('')
  const [fuelLevel, setFuelLevel] = useState<number | null>(null)
  // Operator / mechanic / TC are PARTIES (cluster member or off-roster entity), the
  // same shape the PMCS + dispatch intakes collect. The payload only ever stored the
  // display name, so a recorded name re-hydrates to its roster member when it still
  // matches one and to an external party otherwise.
  const [operator, setOperator] = useState<Party | null>(null)
  const [mechanic, setMechanic] = useState<Party | null>(null)
  const [expDate, setExpDate] = useState('')
  const [odoOut, setOdoOut] = useState('')
  const [tc, setTc] = useState<Party | null>(null)
  const [returnDate, setReturnDate] = useState('')
  const [odoIn, setOdoIn] = useState('')
  const [note, setNote] = useState('')
  // 5988E / dispatch-form edits — `docRemoved` detaches the existing doc; a picked
  // `newDocFile` replaces it (uploaded on Save, so a cancelled edit leaves no orphan).
  const [docRemoved, setDocRemoved] = useState(false)
  const [newDocFile, setNewDocFile] = useState<File | null>(null)
  const [docError, setDocError] = useState<string | null>(null)

  const editPmcsEntry = usePropertyStore((s) => s.editPmcsEntry)
  const deletePmcsEntry = usePropertyStore((s) => s.deletePmcsEntry)
  const userId = useAuthStore((s) => s.user?.id)
  const { medics } = useClinicMedics()

  const isOpen = !!event
  const editable = event?.eventType === 'fault.opened' || event?.eventType === 'fault.corrected'
  const doc = docOf(event)

  // Which intake form (if any) this record opens directly into for editing. The
  // other event types keep the read-only view → edit/delete shape below.
  const formKind: 'pmcs' | 'dispatch-open' | 'dispatch-close' | null =
    event?.eventType === 'pmcs.clear' ? 'pmcs'
      : event?.eventType === 'dispatch.opened' ? 'dispatch-open'
        : event?.eventType === 'dispatch.closed' ? 'dispatch-close'
          : null
  // PMCS readings (mileage + fuel) are vehicle-only; a vehicle is a `location` subject.
  const isVehicle = event?.subjectType === 'location'

  // Cluster roster for the party pickers — { id, "RANK Last First" }, byte-identical
  // to what PmcsSheet / DispatchSheet build, so a name recorded by an intake re-hydrates
  // to the same member here.
  const members = useMemo(
    () => medics
      .map((m) => ({ id: m.id, displayName: [m.rank, m.lastName, m.firstName].filter(Boolean).join(' ').trim() }))
      .filter((m) => m.displayName.length > 0)
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [medics],
  )
  // The seeding effect reads the roster through a ref, NOT as a dependency: the roster
  // arrives asynchronously, and a mid-edit load must not re-seed the form and discard
  // typed values. A name that matches no member re-hydrates as an external party.
  const membersRef = useRef(members)
  membersRef.current = members

  // Seed every field each time a record opens. A lifted-row menu can route straight
  // to edit/delete via initialAction; the legacy text-edit mode is honored only for
  // the free-text fault rows (the structured forms always open editable).
  useEffect(() => {
    if (!event) return
    const p = event.payload ?? {}
    const et = event.eventType
    const isForm = et === 'pmcs.clear' || et === 'dispatch.opened' || et === 'dispatch.closed'
    const canEditText = et === 'fault.opened' || et === 'fault.corrected'
    // A form-carrying record opens in the REVIEW card by default; only an explicit
    // initialAction='edit' (a lifted-row Edit) jumps straight into its form. Legacy
    // fault rows still honor edit for their free-text field.
    const party = (name: string): Party | null => {
      if (!name) return null
      const m = membersRef.current.find((x) => x.displayName === name)
      return m ? { kind: 'member', id: m.id, displayName: m.displayName } : { kind: 'external', name }
    }
    setMode(initialAction === 'edit' && (isForm || canEditText) ? 'edit' : 'view')
    setConfirmOpen(initialAction === 'delete')
    setBusy(false)
    setEditText(event.eventType === 'fault.opened' ? str(p.description) : str(p.note))
    setMileage(typeof p.mileage === 'number' ? String(p.mileage) : '')
    setFuelLevel(typeof p.fuelLevel === 'number' ? p.fuelLevel : null)
    setOperator(party(str(p.operator)))
    setMechanic(party(str(p.mechanic)))
    setExpDate(str(p.exp_date))
    setOdoOut(typeof p.odo_out === 'number' ? String(p.odo_out) : '')
    setTc(party(str(p.tc)))
    setReturnDate(str(p.returned_at))
    setOdoIn(typeof p.odo_in === 'number' ? String(p.odo_in) : '')
    setNote(str(p.note))
    setNewDocFile(null)
    setDocRemoved(false)
    setDocError(null)
    setScannerOpen(false)
  }, [event, initialAction])

  const saveEdit = async () => {
    if (!event || busy) return
    const text = editText.trim()
    // An empty fault description is meaningless — just back out.
    if (event.eventType === 'fault.opened' && !text) { setMode('view'); return }
    setBusy(true)
    const payload = event.eventType === 'fault.opened'
      ? { description: text }
      : { corrects: event.payload?.corrects, note: text }
    await editPmcsEntry(event.id, payload)
    setBusy(false)
    onClose()
  }

  // Required-field gate per form (mirrors each intake's submit gate). PMCS vehicle
  // checks need mileage + fuel; a dispatch needs an exp date; a return defaults to
  // its recorded date so it's always saveable.
  const canSave =
    formKind === 'pmcs' ? (!isVehicle || (mileage.trim() !== '' && fuelLevel != null))
      : formKind === 'dispatch-open' ? expDate.trim() !== ''
        : formKind === 'dispatch-close' ? (returnDate.trim() !== '' || str(event?.payload?.returned_at) !== '')
          : false

  // Commit a structured edit — rebuild the FULL payload from the edited fields,
  // carrying through the keys this form doesn't expose (recorded faults; the
  // dispatch→opened linkage) so the fold still resolves. editPmcsEntry →
  // updateAuditEvent preserves occurred_at, so the recorded date never moves.
  const saveForm = async () => {
    if (!event || busy || !canSave) return
    setBusy(true)
    setSaving(true)
    setDocError(null)
    try {

    // Resolve the attachment: a freshly picked file uploads now (encrypted, same
    // pipeline as the intake); else keep the existing doc unless it was removed.
    let resolvedDoc: PmcsDoc | undefined
    if (newDocFile) {
      if (!userId) { setDocError('Could not upload the document — try again.'); setBusy(false); return }
      const pdf = await ensurePdfFile(newDocFile)
      const up = await uploadEncryptedAttachment(userId, pdf)
      if (!up.ok) {
        logger.warn('record doc upload failed:', up.error)
        setDocError('Could not upload the document — try again.')
        setBusy(false)
        return
      }
      resolvedDoc = { path: up.data.path, key: up.data.key, mime: pdf.type || undefined, name: pdf.name }
    } else if (doc && !docRemoved) {
      resolvedDoc = doc
    }

    const orig = event.payload ?? {}
    const payload: Record<string, unknown> = {}
    // Parties persist as their display name only (no PHI, no profile id) — the same
    // shape the intakes write, so the fold and the read-out stay unchanged.
    const operatorName = partyLabel(operator).trim()
    const mechanicName = partyLabel(mechanic).trim()
    const tcName = partyLabel(tc).trim()
    if (formKind === 'pmcs') {
      const miles = parseInt(mileage, 10)
      if (isVehicle && Number.isFinite(miles)) payload.mileage = miles
      if (isVehicle && fuelLevel != null) payload.fuelLevel = fuelLevel
      if (operatorName) payload.operator = operatorName
      if (mechanicName) payload.mechanic = mechanicName
      if (resolvedDoc) payload.doc = resolvedDoc
      // Faults are owned by the check that found/corrected them — carry them through
      // untouched (this form edits readings + 5988E only).
      if (Array.isArray(orig.faultsOpened) && orig.faultsOpened.length) payload.faultsOpened = orig.faultsOpened
      if (Array.isArray(orig.faultsCorrected) && orig.faultsCorrected.length) payload.faultsCorrected = orig.faultsCorrected
    } else if (formKind === 'dispatch-open') {
      payload.exp_date = expDate
      const miles = parseInt(odoOut, 10)
      if (Number.isFinite(miles)) payload.odo_out = miles
      if (operatorName) payload.operator = operatorName
      if (tcName) payload.tc = tcName
      if (note.trim()) payload.note = note.trim()
      if (resolvedDoc) payload.doc = resolvedDoc
    } else if (formKind === 'dispatch-close') {
      // Preserve the link back to the dispatch.opened this return closes.
      if (typeof orig.dispatches === 'string') payload.dispatches = orig.dispatches
      payload.returned_at = returnDate || str(orig.returned_at)
      const miles = parseInt(odoIn, 10)
      if (Number.isFinite(miles)) payload.odo_in = miles
      if (note.trim()) payload.note = note.trim()
      if (resolvedDoc) payload.doc = resolvedDoc
    }

    await editPmcsEntry(event.id, payload)
    setBusy(false)
    onClose()
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!event || busy) return
    setBusy(true)
    await deletePmcsEntry(event.id)
    setBusy(false)
    onClose()
  }

  // Decrypt + open an attached 5988E / dispatch form in a new tab.
  const openDoc = async () => {
    if (!doc || busy) return
    setBusy(true)
    const res = await downloadDecryptedAttachment(doc.path, doc.key)
    setBusy(false)
    if (!res.ok) { logger.warn('document download failed:', res.error); return }
    const blob = doc.mime ? new Blob([res.data], { type: doc.mime }) : res.data
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  // ── Structured-edit form body (PMCS / dispatch) ─────────────────────────────
  // The attached 5988E / dispatch-form chip — mirrors the intake: an attached doc
  // shows its name (+ tap-to-View when it's the kept original) and an X to detach.
  // The attach/replace TRIGGER lives in the footer (the familiar Scan action) and
  // opens the DocScanner; a captured/picked file replaces the doc on Save.
  const docName = newDocFile?.name ?? (doc && !docRemoved ? (doc.name || 'Document') : null)
  const docViewable = !newDocFile && !!doc && !docRemoved
  const removeDoc = () => { if (newDocFile) setNewDocFile(null); else setDocRemoved(true) }
  const docFormLabel = formKind === 'pmcs' ? '5988E' : formKind === 'dispatch-close' ? 'return form' : 'dispatch form'

  const formBody = formKind ? (
    <>
      <div className="divide-y divide-tertiary/8">
        {formKind === 'pmcs' && (
          <>
            {isVehicle && (
              <TextInput value={mileage} onChange={(v) => setMileage(v.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Mileage" />
            )}
            {isVehicle && <FuelMeter value={fuelLevel} onChange={setFuelLevel} />}
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
          </>
        )}
        {/* Field-for-field the dispatch intake (DispatchSheet): the same date picker,
            the same numeric odometer, and the SAME PartyPicker for operator + TC —
            editing a record must not degrade its fields to bare text boxes. */}
        {formKind === 'dispatch-open' && (
          <>
            <DatePickerInput value={expDate} onChange={setExpDate} placeholder="Dispatch expires" />
            <TextInput value={odoOut} onChange={(v) => setOdoOut(v.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Odometer out" />
            <PartyPicker
              members={members}
              value={operator}
              onChange={setOperator}
              placeholder="Operator"
              externalPlaceholder="Off-roster operator…"
            />
            <PartyPicker
              members={members}
              value={tc}
              onChange={setTc}
              placeholder="TC"
              externalPlaceholder="Off-roster TC…"
            />
          </>
        )}
        {formKind === 'dispatch-close' && (
          <>
            <DatePickerInput value={returnDate} onChange={setReturnDate} placeholder="Return date" />
            <TextInput value={odoIn} onChange={(v) => setOdoIn(v.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Odometer in" />
          </>
        )}
        {/* Picked-file / existing-doc chip (the attach trigger rides the footer, or
            the row below it when the host asked for attachInBody). */}
        {docName && (
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={docViewable ? openDoc : undefined}
              disabled={busy || !docViewable}
              className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-themeblue3/10 text-themeblue2">
                <FileText size={14} />
              </div>
              <span className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{docName}</span>
            </button>
            <button
              type="button"
              onClick={removeDoc}
              disabled={busy}
              className="shrink-0 w-8 h-8 rounded-full bg-tertiary/8 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
              aria-label="Remove document"
            >
              <X size={14} className="text-tertiary" />
            </button>
          </div>
        )}
        {/* Attach/replace as a FIELD of the form (attachInBody hosts) — the document
            belongs to the record being edited, so a footer-less host keeps it in the
            card rather than stranding it in chrome. */}
        {attachInBody && (
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            disabled={busy}
            className="w-full flex items-center gap-3 px-4 py-3 text-left active:opacity-70 transition-opacity disabled:opacity-40"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-themeblue3/10 text-themeblue2">
              {docName ? <FileText size={14} /> : <Paperclip size={14} />}
            </div>
            <span className="flex-1 min-w-0 text-sm font-medium text-themeblue2 truncate">
              {docName ? `Replace ${docFormLabel}` : `Scan ${docFormLabel}`}
            </span>
          </button>
        )}
      </div>
      {docError && <p className="px-4 pt-1 pb-2 text-[9pt] font-medium text-themered">{docError}</p>}
      {/* Nested capture overlay — auto-stacks above this card via OverlayStackContext. */}
      <DocScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onComplete={(f) => { setNewDocFile(f); setDocError(null) }}
        formLabel={docFormLabel}
        containerRef={containerRef}
      />
    </>
  ) : null

  let body: ReactNode
  if (formKind && mode === 'edit') {
    // Editing a form-carrying record — its pre-filled intake form.
    body = formBody
  } else if (formKind) {
    // Default: the shared rich REVIEW card (summary + readings/faults info section +
    // Open 5988E/dispatch-form button), identical to the Custody-roster detail. Edit
    // (footer) flips to the form above.
    body = event ? (
      <div className="px-3 py-3 space-y-3">
        <RecordReviewBody event={event} />
      </div>
    ) : null
  } else if (mode === 'edit') {
    body = (
      <div className="flex items-center gap-2 px-3 py-3">
        <div className="flex-1 min-w-0">
          <TextInput value={editText} onChange={setEditText} placeholder="Entry text" />
        </div>
        <button
          type="button"
          onClick={() => setMode('view')}
          className="shrink-0 w-8 h-8 rounded-full bg-tertiary/8 flex items-center justify-center active:scale-95 transition-all"
          aria-label="Cancel"
        >
          <X size={14} className="text-tertiary" />
        </button>
        <button
          type="button"
          onClick={saveEdit}
          disabled={busy}
          className="shrink-0 w-8 h-8 rounded-full bg-themegreen/15 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
          aria-label="Save"
        >
          <Check size={14} className="text-themegreen" />
        </button>
      </div>
    )
  } else {
    // The shared "historical record" card — same summary card the Custody roster
    // (PropertyRecordDetail) shows, so a tapped history row drills into ONE
    // consistent card across every surface. Edit/Delete live in the footer.
    body = (
      <div className="px-3 py-3 space-y-3">
        {event && <RecordSummaryCard Icon={Icon} tint={tint} label={label} detail={detail} occurredAt={event.occurredAt} />}
        {doc && (
          <button
            type="button"
            onClick={openDoc}
            disabled={busy}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-themeblue3/8 text-themeblue2 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            <FileText size={15} className="shrink-0" />
            <span className="flex-1 min-w-0 text-left text-sm font-medium truncate">
              {doc.name || 'View document'}
            </span>
          </button>
        )}
      </div>
    )
  }

  // Footer. The structured forms mirror the intake's split footer: secondary actions
  // LEFT (Scan/Replace the doc + Delete), the success Save PillButton RIGHT — same
  // primitives the Record/Dispatch intake uses. Other rows keep the legacy left pill
  // (Edit when free-text + Delete) in view mode only; the dismiss X rides the right.
  const footer = formKind && mode === 'edit' ? (
    <FooterPill>
      {!attachInBody && (
        <ActionButton
          icon={docName ? FileText : Paperclip}
          label={docName ? `Replace ${docFormLabel}` : `Scan ${docFormLabel}`}
          variant="default"
          onClick={() => setScannerOpen(true)}
        />
      )}
      <ActionButton icon={Trash2} label="Delete" variant="danger" onClick={() => setConfirmOpen(true)} />
    </FooterPill>
  ) : formKind ? (
    // Review mode for a form-carrying record: Edit flips into the form, Delete removes.
    <FooterPill>
      <ActionButton icon={Pencil} label="Edit" variant="default" onClick={() => setMode('edit')} />
      <ActionButton icon={Trash2} label="Delete" variant="danger" onClick={() => setConfirmOpen(true)} />
    </FooterPill>
  ) : mode === 'view' ? (
    <FooterPill>
      {editable && (
        <ActionButton icon={Pencil} label="Edit" variant="default" onClick={() => setMode('edit')} />
      )}
      <ActionButton icon={Trash2} label="Delete" variant="danger" onClick={() => setConfirmOpen(true)} />
    </FooterPill>
  ) : undefined

  // Right footer — the familiar success PillButton (mirrors "Record PMCS" / "Dispatch"
  // / "Return"), disabled until the required fields are set. Only while editing a form.
  const rightFooter = formKind && mode === 'edit' ? (
    <FooterPill side="right">
      <PillButton icon={Check} iconSize={16} accent="success" disabled={!canSave || busy} onClick={saveForm} label="Save" />
    </FooterPill>
  ) : undefined

  // Canonical destructive-confirm primitive. Placed INSIDE the host overlay's
  // children so OverlayStackContext floors it above this (already-nested) record
  // card — no explicit zIndex needed. An INTERRUPT (parent must stay visible), so
  // it z-stacks rather than morphs.
  const confirm = (
    <ConfirmDialog
      visible={confirmOpen}
      title="Delete this record?"
      subtitle="This can't be undone."
      confirmLabel="Delete"
      variant="danger"
      processing={busy}
      onConfirm={confirmDelete}
      onCancel={() => setConfirmOpen(false)}
    />
  )

  // Overlay title for the structured-edit forms — what the record is and when, since
  // the review body no longer repeats either. Null for the other rows, which carry
  // their label in the summary card instead.
  const title = !formKind || !event
    ? null
    : `${formKind === 'pmcs' ? 'PMCS' : formKind === 'dispatch-close' ? 'Return' : 'Dispatch'} ${formatDtg(event.occurredAt)}`

  // `body`/`footer`/`confirm` are the ready-made parts; the raw actions below let a
  // host whose HEADER owns the verbs (Save in the pill row, Delete in the read-mode
  // ellipsis — the calendar pane convention) drive the same surface without a footer.
  return {
    isOpen, title, body, footer, rightFooter, confirm, saving,
    mode,
    setMode,
    busy,
    canSave,
    save: formKind ? saveForm : saveEdit,
    requestDelete: () => setConfirmOpen(true),
  }
}

/**
 * RecordPreview — the standalone overlay form of the record preview, used where a
 * tapped row opens its own surface (the item/vehicle timeline + lifted-row menus).
 * A thin PreviewOverlay wrapper over `useRecordPreview`; PMCS/Dispatch instead host
 * the hook directly inside their OverlayStack history→detail drill-down screen.
 */
export function RecordPreview({ containerRef, ...props }: RecordPreviewProps) {
  const { isOpen, title, body, footer, rightFooter, confirm, saving } = useRecordPreview({ ...props, containerRef })
  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={props.onClose}
      anchorRect={null}
      containerRef={containerRef}
      maxWidth={320}
      title={title ?? undefined}
      footer={footer}
      rightFooter={rightFooter}
      loading={saving}
    >
      <>
        {body}
        {confirm}
      </>
    </PreviewOverlay>
  )
}

/**
 * RecordSummaryCard — the canonical "one historical record" card: an icon chip +
 * label + "{detail} · {date}" meta line in a SectionCard. Shared by the record
 * drill-down step (useRecordPreview, PMCS/Dispatch/timeline) AND the Custody-roster
 * pane detail (PropertyRecordDetail) so a tapped record looks identical everywhere.
 */
export function RecordSummaryCard({ Icon, tint, label, detail, occurredAt }: {
  Icon: LucideIcon
  /** Icon chip classes (bg + text). */
  tint: string
  label: string
  /** Optional meta prefix (readings / exp date) before the date. */
  detail?: string
  occurredAt: string
}) {
  const meta = [detail, formatDtg(occurredAt)].filter(Boolean).join(' · ')
  return (
    <SectionCard>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tint}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary truncate">{label}</p>
          <p className="text-[9pt] text-tertiary mt-0.5 truncate">{meta}</p>
        </div>
      </div>
    </SectionCard>
  )
}

/** The structured readings the summary line collapses — one label/value row each,
 *  built from the record's payload per kind (PMCS readings / dispatch open / close). */
function infoRows(event: AuditEvent): { label: string; value: string }[] {
  const p = event.payload ?? {}
  const rows: { label: string; value: string }[] = []
  const push = (label: string, value: string | null) => {
    if (value) rows.push({ label, value })
  }
  const num = (v: unknown, suffix = ''): string | null =>
    typeof v === 'number' ? `${v.toLocaleString()}${suffix}` : null
  const text = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

  switch (event.eventType) {
    case 'pmcs.clear':
      push('Mileage', num(p.mileage, ' mi'))
      push('Fuel', num(p.fuelLevel, '%'))
      push('Operator', text(p.operator))
      push('Mechanic', text(p.mechanic))
      break
    case 'dispatch.opened':
      push('Status', 'On dispatch')
      push('Expires', typeof p.exp_date === 'string' && p.exp_date ? formatDtg(p.exp_date) : null)
      push('Odometer out', num(p.odo_out, ' mi'))
      push('Operator', text(p.operator))
      push('TC', text(p.tc))
      push('Note', text(p.note))
      break
    case 'dispatch.closed':
      push('Status', 'Returned')
      push('Returned', typeof p.returned_at === 'string' && p.returned_at ? formatDtg(p.returned_at) : null)
      push('Odometer in', num(p.odo_in, ' mi'))
      push('Note', text(p.note))
      break
  }
  return rows
}

/**
 * RecordReviewBody — the canonical READ view of a PMCS / dispatch record: an
 * "information" section listing every reading (plus the PMCS faults this check found
 * / corrected), and the attached 5988E / dispatch form as an openable button. Shared
 * by BOTH the record-preview overlay (PMCS/Dispatch history + item/vehicle timeline
 * via useRecordPreview) AND the Custody-roster pane detail (PropertyRecordDetail) so
 * a reviewed record looks identical everywhere. Emits a bare card stack — the host
 * wraps it in its own padded/scrolling container.
 *
 * There is deliberately NO summary card here: every value it carried (label, the
 * readings meta line, the date) is either an information row below or the host
 * surface's own title — an overlay title / pane header. One record, one statement of
 * each fact.
 */
export function RecordReviewBody({ event }: { event: AuditEvent }) {
  const [busy, setBusy] = useState(false)
  const doc = docOf(event)
  const isDispatch = event.eventType.startsWith('dispatch')
  const rows = useMemo(() => infoRows(event), [event])
  const faultsOpened = useMemo(() => (event.eventType === 'pmcs.clear' ? pmcsOpened(event) : []), [event])
  const faultsCorrected = useMemo(() => (event.eventType === 'pmcs.clear' ? pmcsCorrected(event) : []), [event])

  // Decrypt + open an attached 5988E / dispatch form in a new tab.
  const openDoc = async () => {
    if (!doc || busy) return
    setBusy(true)
    const res = await downloadDecryptedAttachment(doc.path, doc.key)
    setBusy(false)
    if (!res.ok) { logger.warn('document download failed:', res.error); return }
    const blob = doc.mime ? new Blob([res.data], { type: doc.mime }) : res.data
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <>
      {/* Information — the readings the roster line collapses, one row each, plus the
          PMCS faults this check found / corrected (red for a new fault). */}
      {(rows.length > 0 || faultsOpened.length > 0 || faultsCorrected.length > 0) && (
        <div>
          <SectionHeader>{isDispatch ? 'Dispatch information' : 'PMCS information'}</SectionHeader>
          <SectionCard className="divide-y divide-tertiary/8 mt-2">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-[10pt] text-tertiary shrink-0">{r.label}</span>
                <span className="text-[10pt] text-primary text-right min-w-0 truncate">{r.value}</span>
              </div>
            ))}
            {faultsCorrected.map((f) => (
              <div key={`c-${f.id}`} className="flex items-start gap-2.5 px-4 py-2.5">
                <Wrench size={14} className="text-themeblue2 shrink-0 mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10pt] text-primary">{f.description}</span>
                  <span className="block text-[9pt] text-tertiary">Corrected{f.note ? ` · ${f.note}` : ''}</span>
                </span>
              </div>
            ))}
            {faultsOpened.map((f) => (
              <div key={`o-${f.id}`} className="flex items-start gap-2.5 px-4 py-2.5">
                <AlertTriangle size={14} className="text-themered shrink-0 mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10pt] text-primary">{f.description}</span>
                  <span className="block text-[9pt] text-themered">New fault</span>
                </span>
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {doc && (
        <button
          type="button"
          onClick={openDoc}
          disabled={busy}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-themeblue3/8 text-themeblue2 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          <FileText size={15} className="shrink-0" />
          <span className="flex-1 min-w-0 text-left text-sm font-medium truncate">
            {doc.name || (isDispatch ? 'Open dispatch form' : 'Open 5988E')}
          </span>
        </button>
      )}
    </>
  )
}
