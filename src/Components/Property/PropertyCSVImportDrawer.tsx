import { useState, useRef, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Upload, AlertTriangle, CheckCircle2, X, Plus, Download } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Section } from '@/Components/primitives/Section'
import { ActionSheet } from '@/Components/primitives/ActionSheet'
import { PickerInput, DatePickerInput } from '@/Components/primitives/FormInputs'
import { LoadingSpinner } from '@/Components/primitives/LoadingSpinner'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { isLinContainer } from '../../Utilities/propertyAuthorized'
import {
  parsePropertyCSV,
  downloadCSVTemplate,
  reconcileImport,
  type ParsedRow,
  type MergeMode,
} from '../../Utilities/PropertyCSV'
import type { ItemType, UnitOfIssue, LocalPropertyItem } from '../../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'

interface PropertyCSVImportProps {
  /** Bulk manual-entry mode: skip the CSV `pick` step and open straight into the
   *  editable table with one blank row (the "Add multiple items" flow). CSV is still
   *  reachable from the header ellipsis. Default false = the classic CSV-import flow. */
  bulk?: boolean
  /** Bulk mode only — the zone this bulk-add was launched from (New Item form's
   *  defaultLocationId). Rows default their Location to this zone's name so a batch lands
   *  in the targeted zone; still editable per row. applyImport resolves the name → id. */
  defaultLocationId?: string | null
  /** Bulk-EDIT mode — seed the grid from these EXISTING items (zone "Edit items"). Each row
   *  carries its item id, so editing a field updates that item in place (reconcile matches by
   *  id, never forks a duplicate). Presence of a non-empty array = edit mode. */
  editItems?: LocalPropertyItem[]
  /** Close the host surface (right pane / detail sheet). */
  onClose: () => void
  /** Reports whether the host's header check should show — true only when there's a valid,
   *  reviewed import ready to commit. Lets the host drive apply from the standard header check. */
  onReadyChange?: (ready: boolean) => void
  /** Reports whether the review table is showing — the host shows its back `<` + actions ellipsis
   *  only then (in the pick step there's no document to go back from or act on). */
  onInPreviewChange?: (inPreview: boolean) => void
}

export interface PropertyCSVImportHandle {
  /** Commit the reviewed import. Drives the host header's check (mirrors PropertyItemForm.submit). */
  apply: () => void
  /** Header back `<`: from the review table → document pick; from pick → close the surface. */
  back: () => void
  /** Open the header actions ellipsis (Replace file / Download template). */
  openMenu: () => void
}

type Step = 'pick' | 'preview' | 'importing' | 'done'

/** A parsed row plus a stable client id so an edit / delete / add-row survives re-render
 *  without index-key churn. EditableRow extends ParsedRow, so reconcileImport consumes it
 *  as-is and plan.creates holds these same references (used for the per-row status dot). */
type EditableRow = ParsedRow & { _rid: string }

const ITEM_TYPE_OPTIONS: { value: ItemType; label: string }[] = [
  { value: 'CI', label: 'Consumable' },
  { value: 'DI', label: 'Durable' },
  { value: 'SI', label: 'Sensitive' },
]
const UNIT_OF_ISSUE_OPTIONS: { value: UnitOfIssue; label: string }[] = [
  { value: 'EA', label: 'EA — each' },
  { value: 'SET', label: 'SET' },
  { value: 'PR', label: 'PR — pair' },
  { value: 'BOT', label: 'BOT — bottle' },
  { value: 'PK', label: 'PK — pack' },
  { value: 'TUB', label: 'TUB — tube' },
]
const ITEM_TYPE_PICKER = [{ value: '', label: 'Durable' }, ...ITEM_TYPE_OPTIONS]
const UNIT_PICKER = [{ value: '', label: 'EA' }, ...UNIT_OF_ISSUE_OPTIONS]

// Mobile stays 16px (iOS won't zoom on focus); desktop drops to the 10pt grid floor to
// match the header + add-row. The `!` beats the global `input{font-size:16px !important}`.
const CELL_INPUT =
  'w-full bg-transparent text-base md:!text-[10pt] text-primary placeholder:text-tertiary focus:outline-none px-2 py-2 rounded-lg focus:bg-themeblue3/5'

function blankRow(location = ''): EditableRow {
  return {
    _rid: crypto.randomUUID(),
    name: '', nomenclature: '', nsn: '', lin: '',
    quantity: 1, quantityAuthorized: null, serialNumber: '',
    location, itemType: null, unitOfIssue: null, packSize: null,
    expiryDate: '',
  }
}

/** Parse an integer field, floored at 0; blank / NaN → null. */
function numOrNull(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  return Number.isNaN(n) ? null : Math.max(0, n)
}

/** Surfaceless CSV-import wizard body. Hosted in the Property right pane (desktop)
 *  / detail sheet (mobile) by PropertyPanel — the same surfaces zone/item/sign-out
 *  use. The host owns the header, its Close, and (via the apply() handle) the header check.
 *
 *  Flow: pick a CSV → review it in a scrollable EDITABLE table (every field inline, mirrors
 *  item creation, so any row can be fixed, removed, or hand-added before commit) → the host
 *  header check commits. The reconcile diff recomputes live as rows change. Commit runs through
 *  usePropertyStore.applyImport, which batches the writes (coalesced vault fan-out + one state
 *  update). See reconcileImport for the additive-or-merge semantics. */
export const PropertyCSVImport = forwardRef<PropertyCSVImportHandle, PropertyCSVImportProps>(
  function PropertyCSVImport({ bulk = false, defaultLocationId = null, editItems, onClose, onReadyChange, onInPreviewChange }, ref) {
  const { items, locations, clinicId, applyImport } = usePropertyStore(
    useShallow(s => ({
      items: s.items,
      locations: s.locations,
      clinicId: s.clinicId,
      applyImport: s.applyImport,
    }))
  )

  // Existing zones a row can be reassigned to — same filter as PropertyItemForm's location
  // picker (drop the root and turn-in zones). Value = NAME (not id): applyImport resolves the
  // location by name and auto-creates any it doesn't recognise, so a name keeps that path intact.
  const locationOptions = useMemo(
    () => [
      { value: '', label: 'No location' },
      ...locations
        .filter(l => l.name !== ROOT_LOCATION_NAME && !l.is_turn_in_zone)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(l => ({ value: l.name, label: l.name })),
    ],
    [locations],
  )
  const locationNameSet = useMemo(
    () => new Set(locationOptions.map(o => o.value.toLowerCase()).filter(Boolean)),
    [locationOptions],
  )

  // Zone this bulk-add was launched from (New Item @ zone → multi-add): rows default their
  // Location to its name so a batch lands in the targeted zone. Empty in CSV mode / no zone.
  const seedLocationName = useMemo(
    () => (bulk && defaultLocationId ? (locations.find(l => l.id === defaultLocationId)?.name ?? '') : ''),
    [bulk, defaultLocationId, locations],
  )

  // PHR level 1 — the hand-receipt LINs the cluster is signed for (existing containers a row
  // can link under). VALUE = LIN CODE, not container id: reconcileImport keys a row's scope by
  // its `lin` code text (it auto-creates/parents the container), so the grid links by code to
  // stay on that path. Distinct by code (vehicle shadows can share one). Mirrors the form's
  // authorizedLinOptions, re-keyed to code. New LINs are built in the item form, not here.
  const linOptions = useMemo(() => {
    const byCode = new Map<string, string>()
    for (const i of items) {
      if (isLinContainer(i) && i.lin && !i.deleted_at && !i.turned_in_at) {
        const code = i.lin.trim()
        if (code && !byCode.has(code)) byCode.set(code, `${i.name} · LIN ${code}`)
      }
    }
    return [
      { value: '', label: 'No hand receipt' },
      ...[...byCode.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })),
    ]
  }, [items])
  const linCodeSet = useMemo(
    () => new Set(linOptions.map(o => o.value.toLowerCase()).filter(Boolean)),
    [linOptions],
  )

  // PHR level 2 — authorized component ROLES (nomenclature → its authorized NSN) under each LIN
  // CODE. A row whose LIN has roles picks its nomenclature from them; picking copies the NSN so
  // on-hand keys by (LIN + NSN) and the shortage draws down (mirrors the form's pickRole). Keyed
  // by code so a row resolves roles straight from its `lin` cell.
  const rolesByLinCode = useMemo(() => {
    const codeByContainerId = new Map<string, string>()
    for (const i of items) if (isLinContainer(i) && i.lin) codeByContainerId.set(i.id, i.lin.trim())
    const m = new Map<string, Map<string, string>>()
    for (const i of items) {
      if (i.parent_item_id && i.quantity_authorized != null && i.nomenclature && !i.deleted_at && !i.turned_in_at) {
        const code = codeByContainerId.get(i.parent_item_id)
        if (!code) continue
        if (!m.has(code)) m.set(code, new Map())
        const roles = m.get(code)!
        if (!roles.has(i.nomenclature)) roles.set(i.nomenclature, i.nsn ?? '')
      }
    }
    return m
  }, [items])

  // Context-LIN: pick a hand receipt once (bulk mode) → seeds new rows' LIN and fills any row
  // that has no LIN yet, so a batch lands under one receipt. Still editable per row.
  const [contextLin, setContextLin] = useState('')

  // Bulk-EDIT mode — seed rows FROM existing items (each carrying its id → in-place update). Add
  // mode seeds one blank row (+ zone). CSV mode starts at the pick step with no rows.
  const editMode = !!editItems && editItems.length > 0
  const startInGrid = bulk || editMode
  const locNameById = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations])
  const seedRows = useMemo<EditableRow[]>(() => {
    if (editMode) return editItems!.map(it => ({
      _rid: crypto.randomUUID(),
      itemId: it.id,
      name: it.name ?? '',
      nomenclature: it.nomenclature ?? '',
      nsn: it.nsn ?? '',
      lin: it.lin ?? '',
      quantity: it.quantity ?? 0,
      quantityAuthorized: it.quantity_authorized ?? null,
      serialNumber: it.serial_number ?? '',
      location: it.location_id ? (locNameById.get(it.location_id) ?? '') : '',
      itemType: it.item_type ?? null,
      unitOfIssue: it.unit_of_issue ?? null,
      packSize: it.pack_size ?? null,
      expiryDate: it.expiry_date ?? '',
    }))
    return bulk ? [blankRow(seedLocationName)] : []
  }, [editMode, editItems, bulk, seedLocationName, locNameById])

  const [step, setStep] = useState<Step>(startInGrid ? 'preview' : 'pick')
  const [rows, setRows] = useState<EditableRow[]>(seedRows)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [mergeMode, setMergeMode] = useState<MergeMode>('set')
  const [appliedCount, setAppliedCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const plan = useMemo(
    () => reconcileImport(rows, items, { mergeMode }),
    [rows, items, mergeMode],
  )
  // plan.creates holds the SAME row refs (reconcile pushes `row`) — membership = "will be new".
  const createSet = useMemo(() => new Set<ParsedRow>(plan.creates), [plan])
  // A typed / uploaded location matching no existing zone is CREATED on import — but ONLY for
  // rows that actually create an item (applyImport ignores a merge row's location). Non-blocking.
  const newZoneCount = useMemo(() => {
    const names = new Set<string>()
    for (const r of plan.creates) {
      const n = r.location.trim().toLowerCase()
      if (n && !locationNameSet.has(n)) names.add(n)
    }
    return names.size
  }, [plan.creates, locationNameSet])
  const totalOps =
    plan.linContainers.length + plan.creates.length + plan.merges.length + plan.deauthorizes.length + plan.updates.length

  // A create OR edit row needs a name — block commit on any blank-name row (an edited item
  // can't have its name cleared, a new item can't be nameless).
  const blankNameCount = useMemo(
    () => plan.creates.filter(r => r.name.trim() === '').length + plan.updates.filter(r => r.name.trim() === '').length,
    [plan.creates, plan.updates],
  )
  const canApply = totalOps > 0 && blankNameCount === 0
  const ready = step === 'preview' && canApply
  const inPreview = step === 'preview'

  // Lift header state so the host shows/hides its check + back + ellipsis; clear on unmount.
  useEffect(() => { onReadyChange?.(ready) }, [ready, onReadyChange])
  useEffect(() => { onInPreviewChange?.(inPreview) }, [inPreview, onInPreviewChange])
  useEffect(() => () => { onReadyChange?.(false); onInPreviewChange?.(false) }, [onReadyChange, onInPreviewChange])

  const handleClose = useCallback(() => {
    setStep(startInGrid ? 'preview' : 'pick')
    setRows(seedRows)
    setParseErrors([])
    setMergeMode('set')
    setContextLin('')
    setAppliedCount(0)
    onClose()
  }, [startInGrid, seedRows, onClose])

  const handleFileChange = useCallback(async (file: File | null | undefined) => {
    if (!file) return
    const result = await parsePropertyCSV(file)
    setRows(result.rows.map(r => ({ ...r, _rid: crypto.randomUUID() })))
    setParseErrors(result.errors)
    setStep('preview')
  }, [])

  const updateRow = useCallback((rid: string, patch: Partial<ParsedRow>) => {
    setRows(prev => prev.map(r => (r._rid === rid ? { ...r, ...patch } : r)))
  }, [])

  const deleteRow = useCallback((rid: string) => {
    setRows(prev => prev.filter(r => r._rid !== rid))
  }, [])

  const addRow = useCallback(() => {
    setRows(prev => [...prev, { ...blankRow(seedLocationName), lin: contextLin }])
  }, [seedLocationName, contextLin])

  // Context-LIN change → seed future rows AND fill every row that has no LIN yet (leave rows
  // already linked to a different receipt alone). Clearing it (→ '') leaves existing rows.
  const applyContextLin = useCallback((code: string) => {
    setContextLin(code)
    if (!code) return
    setRows(prev => prev.map(r => (r.lin.trim() === '' ? { ...r, lin: code } : r)))
  }, [])

  // Header back `<`: CSV mode preview → document pick; bulk mode has no pick step, so
  // back exits the surface (as does back from pick).
  const handleBack = useCallback(() => {
    if (!startInGrid && step === 'preview') setStep('pick')
    else onClose()
  }, [startInGrid, step, onClose])

  const handleImport = useCallback(async () => {
    if (!clinicId || !(step === 'preview' && canApply)) return
    setStep('importing')
    try {
      const applied = await applyImport(plan)
      setAppliedCount(applied)
      setStep('done')
    } catch {
      // Writes are IDB-first + queued, so anything applied persists; drop back to the
      // table so the user can retry rather than stranding on the spinner.
      setStep('preview')
    }
  }, [clinicId, step, canApply, plan, applyImport])

  useImperativeHandle(
    ref,
    () => ({ apply: handleImport, back: handleBack, openMenu: () => setMenuOpen(true) }),
    [handleImport, handleBack],
  )

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => handleFileChange(e.target.files?.[0])}
      />

      <ActionSheet
        visible={menuOpen}
        title="Import"
        onClose={() => setMenuOpen(false)}
        zIndex={1500}
        options={[
          // Edit mode has no CSV path (importing would replace the id-carrying edit rows with
          // fresh creates) — only the template stays. Add/CSV modes offer Import/Replace.
          ...(editMode
            ? []
            : [bulk
                ? { key: 'import', label: 'Import CSV', icon: Upload, onAction: () => fileInputRef.current?.click() }
                : { key: 'replace', label: 'Replace file', icon: Upload, onAction: () => fileInputRef.current?.click() }]),
          { key: 'template', label: 'Download template', icon: Download, onAction: downloadCSVTemplate },
        ]}
      />

      {step === 'pick' && (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl border-2 border-dashed border-tertiary/30 flex flex-col items-center justify-center gap-3 py-12 px-6 w-full active:opacity-70 transition-opacity"
          >
            <Upload className="w-8 h-8 text-tertiary" />
            <span className="text-sm text-secondary">Drop a CSV or tap to browse</span>
          </button>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={downloadCSVTemplate}
              className="text-sm text-themeblue3 underline"
            >
              Download template
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="flex flex-col gap-4">
          {parseErrors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl text-[10pt] text-amber-800 p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                {parseErrors.slice(0, 5).map((err, i) => (
                  <span key={i}>{err}</span>
                ))}
                {parseErrors.length > 5 && (
                  <span>+ {parseErrors.length - 5} more</span>
                )}
              </div>
            </div>
          )}

          {/* Context-LIN (bulk only) — link the whole batch to one hand receipt. Seeds new rows
              and fills any row with no LIN yet; each row's LIN stays editable below. Only shown
              when the cluster is signed for at least one LIN. */}
          {bulk && !editMode && linOptions.length > 1 && (
            <Section title="Add under hand receipt (LIN)">
              <div className="[&_button]:!px-3 [&_button]:!py-2.5">
                <PickerInput
                  value={contextLin}
                  onChange={applyContextLin}
                  options={linOptions}
                  placeholder="No hand receipt"
                  searchable
                />
              </div>
            </Section>
          )}

          {/* Merge mode — what a match does to present quantity. Only matters when rows merge. */}
          {plan.merges.length > 0 && (
            <Section title="Quantity for merged items">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMergeMode('set')}
                  className={`rounded-xl px-3 py-2.5 text-[10pt] font-medium border transition-colors ${
                    mergeMode === 'set'
                      ? 'bg-themeblue3 text-white border-themeblue3'
                      : 'bg-themewhite2 text-secondary border-tertiary/20'
                  }`}
                >
                  Inventory count
                  <span className="block text-[9pt] font-normal opacity-80">set to CSV qty</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMergeMode('add')}
                  className={`rounded-xl px-3 py-2.5 text-[10pt] font-medium border transition-colors ${
                    mergeMode === 'add'
                      ? 'bg-themeblue3 text-white border-themeblue3'
                      : 'bg-themewhite2 text-secondary border-tertiary/20'
                  }`}
                >
                  Received
                  <span className="block text-[9pt] font-normal opacity-80">add to on-hand</span>
                </button>
              </div>
            </Section>
          )}

          {/* Editable review table — every field inline, horizontally scrollable. Mirrors item
              creation; fix / remove / add rows before the host header check commits. The host
              header owns the title, back `<`, and actions ellipsis — no in-body header. Not a
              card: no rounding, no outer border — just the grid (header + row lines) with the
              Add-item bar riding underneath as both add-row and empty-state affordance. */}
          <div className="flex flex-col gap-3">
            <div>
              <div className="overflow-x-auto touch-pan-xy x-scrollbar">
                <table className="text-[10pt] border-collapse" style={{ minWidth: 850 }}>
                  <thead>
                    <tr className="border-b border-tertiary/15 bg-themewhite2/50 text-tertiary">
                      <th className="sticky left-0 z-10 bg-themewhite3 w-10" />
                      <th className="text-left px-2 py-2 font-medium" style={{ minWidth: 160 }}>Name</th>
                      <th className="text-left px-2 py-2 font-medium" style={{ minWidth: 130 }}>Nomenclature</th>
                      <th className="text-left px-2 py-2 font-medium" style={{ minWidth: 120 }}>NSN</th>
                      <th className="text-left px-2 py-2 font-medium" style={{ minWidth: 90 }}>LIN</th>
                      <th className="text-left px-2 py-2 font-medium" style={{ minWidth: 110 }}>Serial</th>
                      <th className="text-left px-2 py-2 font-medium" style={{ minWidth: 68 }}>Qty</th>
                      <th className="text-left px-2 py-2 font-medium" style={{ minWidth: 68 }}>Auth</th>
                      <th className="text-left px-2 py-2 font-medium" style={{ minWidth: 68 }}>Pack</th>
                      <th className="text-left px-2 py-2 font-medium" style={{ minWidth: 130 }}>Location</th>
                      <th className="text-left px-2 py-2 font-medium" style={{ minWidth: 120 }}>Type</th>
                      <th className="text-left px-2 py-2 font-medium" style={{ minWidth: 100 }}>Unit</th>
                      <th className="text-left px-2 py-2 font-medium" style={{ minWidth: 130 }}>Expiry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const isNew = createSet.has(row)
                      const blankName = row.name.trim() === ''
                      return (
                        <tr key={row._rid} className="border-b border-tertiary/10 last:border-b-0 align-middle">
                          <td className="sticky left-0 z-10 bg-themewhite3 pl-1 pr-0.5">
                            <button
                              type="button"
                              onClick={() => deleteRow(row._rid)}
                              className="w-8 h-8 flex items-center justify-center rounded-full text-tertiary hover:text-red-500 hover:bg-red-500/10 active:scale-90 transition-all"
                              aria-label="Remove row"
                            >
                              <X size={15} />
                            </button>
                          </td>
                          <td className="px-1">
                            <input
                              value={row.name}
                              onChange={e => updateRow(row._rid, { name: e.target.value })}
                              placeholder="Item name *"
                              className={`${CELL_INPUT} ${blankName && isNew ? 'ring-1 ring-red-400/60' : ''}`}
                            />
                          </td>
                          <td className="px-1 [&_button]:md:!text-[10pt] [&_button]:!px-2 [&_button]:!py-2">
                            {(() => {
                              // When the row's LIN has authorized component roles, pick nomenclature
                              // from them — picking copies that role's NSN so on-hand keys by (LIN +
                              // NSN) and the shortage draws down (mirrors the form's pickRole). A
                              // carried value that's not a known role rides as a synthetic option.
                              // No LIN / no roles → free-text (a fresh receipt has no roles yet).
                              const roles = rolesByLinCode.get(row.lin.trim())
                              if (!roles || roles.size === 0) {
                                return (
                                  <input
                                    value={row.nomenclature}
                                    onChange={e => updateRow(row._rid, { nomenclature: e.target.value })}
                                    placeholder="—"
                                    className={CELL_INPUT}
                                  />
                                )
                              }
                              const nomVal = row.nomenclature.trim()
                              const known = nomVal !== '' && roles.has(row.nomenclature)
                              const opts = [
                                { value: '', label: '—' },
                                ...(nomVal !== '' && !known ? [{ value: row.nomenclature, label: row.nomenclature }] : []),
                                ...[...roles.keys()].sort((a, b) => a.localeCompare(b)).map(r => ({ value: r, label: r })),
                              ]
                              return (
                                <PickerInput
                                  value={row.nomenclature}
                                  onChange={v => {
                                    const nsn = roles.get(v)
                                    updateRow(row._rid, nsn ? { nomenclature: v, nsn } : { nomenclature: v })
                                  }}
                                  options={opts}
                                  placeholder="—"
                                  searchable
                                />
                              )
                            })()}
                          </td>
                          <td className="px-1">
                            <input value={row.nsn} onChange={e => updateRow(row._rid, { nsn: e.target.value })} placeholder="—" className={CELL_INPUT} />
                          </td>
                          <td className="px-1 [&_button]:md:!text-[10pt] [&_button]:!px-2 [&_button]:!py-2">
                            {(() => {
                              // Link under an existing hand-receipt LIN (value = code). A code the
                              // row carries that matches no live LIN is CREATED on import (reconcile
                              // auto-containers it) — inject it as a synthetic option so the picker
                              // still DISPLAYS it; warn only on a CREATE row.
                              const linVal = row.lin.trim()
                              const unmatched = linVal !== '' && !linCodeSet.has(linVal.toLowerCase())
                              const isNewLin = unmatched && isNew
                              const opts = unmatched
                                ? [{ value: row.lin, label: `${row.lin} (new)` }, ...linOptions]
                                : linOptions
                              return (
                                <>
                                  <PickerInput
                                    value={row.lin}
                                    onChange={v => updateRow(row._rid, { lin: v })}
                                    options={opts}
                                    placeholder="—"
                                    searchable
                                  />
                                  {isNewLin && (
                                    <span className="block px-2 pb-1 text-[8pt] leading-tight text-amber-600">
                                      new hand receipt — will be created
                                    </span>
                                  )}
                                </>
                              )
                            })()}
                          </td>
                          <td className="px-1">
                            <input value={row.serialNumber} onChange={e => updateRow(row._rid, { serialNumber: e.target.value })} placeholder="—" className={CELL_INPUT} />
                          </td>
                          <td className="px-1">
                            <input
                              type="number"
                              inputMode="numeric"
                              value={row.quantity}
                              onChange={e => updateRow(row._rid, { quantity: numOrNull(e.target.value) ?? 0 })}
                              className={CELL_INPUT}
                            />
                          </td>
                          <td className="px-1">
                            <input
                              type="number"
                              inputMode="numeric"
                              value={row.quantityAuthorized ?? ''}
                              onChange={e => updateRow(row._rid, { quantityAuthorized: numOrNull(e.target.value) })}
                              placeholder="—"
                              className={CELL_INPUT}
                            />
                          </td>
                          <td className="px-1">
                            <input
                              type="number"
                              inputMode="numeric"
                              value={row.packSize ?? ''}
                              onChange={e => updateRow(row._rid, { packSize: numOrNull(e.target.value) })}
                              placeholder="1"
                              className={CELL_INPUT}
                            />
                          </td>
                          <td className="px-1 [&_button]:md:!text-[10pt] [&_button]:!px-2 [&_button]:!py-2">
                            {(() => {
                              // A location the row carries that no live zone matches will be
                              // auto-created on import — but only for CREATE rows (a merge ignores
                              // its location). Inject it as a synthetic option so the picker still
                              // DISPLAYS the uploaded value; picking an existing zone replaces it.
                              const locVal = row.location.trim()
                              const unmatched = locVal !== '' && !locationNameSet.has(locVal.toLowerCase())
                              // Always show the uploaded value (synthetic option); only warn when
                              // it will actually create a zone — i.e. on a CREATE row.
                              const isNewZone = unmatched && isNew
                              const opts = unmatched
                                ? [{ value: row.location, label: row.location }, ...locationOptions]
                                : locationOptions
                              return (
                                <>
                                  <PickerInput
                                    value={row.location}
                                    onChange={v => updateRow(row._rid, { location: v })}
                                    options={opts}
                                    placeholder="—"
                                    searchable
                                  />
                                  {isNewZone && (
                                    <span className="block px-2 pb-1 text-[8pt] leading-tight text-amber-600">
                                      new zone — will be created
                                    </span>
                                  )}
                                </>
                              )
                            })()}
                          </td>
                          <td className="px-1 [&_button]:md:!text-[10pt] [&_button]:!px-2 [&_button]:!py-2">
                            <PickerInput
                              value={row.itemType ?? ''}
                              onChange={v => updateRow(row._rid, { itemType: (v || null) as ItemType | null })}
                              options={ITEM_TYPE_PICKER}
                              placeholder="Durable"
                            />
                          </td>
                          <td className="px-1 [&_button]:md:!text-[10pt] [&_button]:!px-2 [&_button]:!py-2">
                            <PickerInput
                              value={row.unitOfIssue ?? ''}
                              onChange={v => updateRow(row._rid, { unitOfIssue: (v || null) as UnitOfIssue | null })}
                              options={UNIT_PICKER}
                              placeholder="EA"
                            />
                          </td>
                          <td className="px-1 [&_button]:md:!text-[10pt] [&_button]:!px-2 [&_button]:!py-2">
                            <div className="flex items-center">
                              <div className="flex-1 min-w-0">
                                <DatePickerInput
                                  value={row.expiryDate}
                                  onChange={v => updateRow(row._rid, { expiryDate: v })}
                                  placeholder="—"
                                />
                              </div>
                              {row.expiryDate && (
                                <button
                                  type="button"
                                  onClick={() => updateRow(row._rid, { expiryDate: '' })}
                                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-tertiary hover:text-red-500 active:scale-90 transition-all"
                                  aria-label="Clear expiry"
                                >
                                  <X size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <EmptyState
              title={rows.length ? 'Add item' : 'Add first item'}
              action={{ icon: Plus, label: rows.length ? 'Add item' : 'Add first item', onClick: () => addRow() }}
            />
          </div>

          {/* Reconcile diff — an upload is an upsert, never a wipe. Recomputes live from the table. */}
          <div className="flex flex-col gap-1 text-sm">
            {plan.linContainers.length > 0 && (
              <span className="text-secondary">{plan.linContainers.length} new hand-receipt {plan.linContainers.length === 1 ? 'LIN' : 'LINs'}</span>
            )}
            <span className="text-primary font-medium">{plan.creates.length} new {plan.creates.length === 1 ? 'item' : 'items'}</span>
            {plan.updates.length > 0 && (
              <span className="text-primary font-medium">{plan.updates.length} existing {plan.updates.length === 1 ? 'item' : 'items'} — changes save in place</span>
            )}
            <span className="text-secondary">{plan.merges.length} merged into existing {plan.merges.length === 1 ? 'item' : 'items'}</span>
            {newZoneCount > 0 && (
              <span className="text-amber-600">{newZoneCount} new {newZoneCount === 1 ? 'zone' : 'zones'} will be created</span>
            )}
            {plan.deauthorizes.length > 0 && (
              <span className="text-amber-700">{plan.deauthorizes.length} dropped from BOM — de-authorized, still on hand</span>
            )}
            {blankNameCount > 0 && (
              <span className="text-red-500">{blankNameCount} new {blankNameCount === 1 ? 'row needs' : 'rows need'} a name</span>
            )}
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <LoadingSpinner />
          <p className="text-sm text-secondary">Applying {totalOps} changes…</p>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <CheckCircle2 className="w-12 h-12 text-themegreen" />
          <p className="text-sm text-secondary">{appliedCount} changes applied</p>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full px-6 py-3 text-sm font-medium bg-themeblue3 text-white"
          >
            Done
          </button>
        </div>
      )}
    </>
  )
})
