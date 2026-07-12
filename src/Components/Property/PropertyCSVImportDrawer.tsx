import { useState, useRef, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Upload, AlertTriangle, CheckCircle2, X, Plus, Download } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Section } from '@/Components/primitives/Section'
import { ActionSheet } from '@/Components/primitives/ActionSheet'
import { PickerInput } from '@/Components/primitives/FormInputs'
import { LoadingSpinner } from '@/Components/primitives/LoadingSpinner'
import { usePropertyStore } from '../../stores/usePropertyStore'
import {
  parsePropertyCSV,
  downloadCSVTemplate,
  reconcileImport,
  type ParsedRow,
  type MergeMode,
} from '../../Utilities/PropertyCSV'
import type { ItemType, UnitOfIssue } from '../../Types/PropertyTypes'

interface PropertyCSVImportProps {
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

const CELL_INPUT =
  'w-full bg-transparent text-[10pt] text-primary placeholder:text-tertiary focus:outline-none px-2 py-2 rounded-lg focus:bg-themeblue3/5'

function blankRow(): EditableRow {
  return {
    _rid: crypto.randomUUID(),
    name: '', nomenclature: '', nsn: '', lin: '',
    quantity: 1, quantityAuthorized: null, serialNumber: '',
    location: '', itemType: null, unitOfIssue: null, packSize: null,
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
  function PropertyCSVImport({ onClose, onReadyChange, onInPreviewChange }, ref) {
  const { items, clinicId, applyImport } = usePropertyStore(
    useShallow(s => ({
      items: s.items,
      clinicId: s.clinicId,
      applyImport: s.applyImport,
    }))
  )

  const [step, setStep] = useState<Step>('pick')
  const [rows, setRows] = useState<EditableRow[]>([])
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
  const totalOps =
    plan.linContainers.length + plan.creates.length + plan.merges.length + plan.deauthorizes.length

  // A row that will create an item needs a name — block commit on any blank-name new row.
  const blankNameCount = useMemo(
    () => plan.creates.filter(r => r.name.trim() === '').length,
    [plan.creates],
  )
  const canApply = totalOps > 0 && blankNameCount === 0
  const ready = step === 'preview' && canApply
  const inPreview = step === 'preview'

  // Lift header state so the host shows/hides its check + back + ellipsis; clear on unmount.
  useEffect(() => { onReadyChange?.(ready) }, [ready, onReadyChange])
  useEffect(() => { onInPreviewChange?.(inPreview) }, [inPreview, onInPreviewChange])
  useEffect(() => () => { onReadyChange?.(false); onInPreviewChange?.(false) }, [onReadyChange, onInPreviewChange])

  const handleClose = useCallback(() => {
    setStep('pick')
    setRows([])
    setParseErrors([])
    setMergeMode('set')
    setAppliedCount(0)
    onClose()
  }, [onClose])

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
    setRows(prev => [...prev, blankRow()])
  }, [])

  // Header back `<`: preview → document pick; pick → exit the surface.
  const handleBack = useCallback(() => {
    if (step === 'preview') setStep('pick')
    else onClose()
  }, [step, onClose])

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
          { key: 'replace', label: 'Replace file', icon: Upload, onAction: () => fileInputRef.current?.click() },
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
              header owns the title, back `<`, and actions ellipsis — no in-body header. */}
          <div>
            <div className="rounded-2xl border border-tertiary/15 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="text-[10pt] border-collapse" style={{ minWidth: 720 }}>
                  <thead>
                    <tr className="border-b border-tertiary/15 bg-themewhite2/50 text-tertiary">
                      <th className="sticky left-0 z-10 bg-themewhite2 w-10" />
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
                          <td className="px-1">
                            <input value={row.nomenclature} onChange={e => updateRow(row._rid, { nomenclature: e.target.value })} placeholder="—" className={CELL_INPUT} />
                          </td>
                          <td className="px-1">
                            <input value={row.nsn} onChange={e => updateRow(row._rid, { nsn: e.target.value })} placeholder="—" className={CELL_INPUT} />
                          </td>
                          <td className="px-1">
                            <input value={row.lin} onChange={e => updateRow(row._rid, { lin: e.target.value })} placeholder="—" className={CELL_INPUT} />
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
                          <td className="px-1">
                            <input value={row.location} onChange={e => updateRow(row._rid, { location: e.target.value })} placeholder="—" className={CELL_INPUT} />
                          </td>
                          <td className="px-1">
                            <PickerInput
                              value={row.itemType ?? ''}
                              onChange={v => updateRow(row._rid, { itemType: (v || null) as ItemType | null })}
                              options={ITEM_TYPE_PICKER}
                              placeholder="Durable"
                            />
                          </td>
                          <td className="px-1">
                            <PickerInput
                              value={row.unitOfIssue ?? ''}
                              onChange={v => updateRow(row._rid, { unitOfIssue: (v || null) as UnitOfIssue | null })}
                              options={UNIT_PICKER}
                              placeholder="EA"
                            />
                          </td>
                        </tr>
                      )
                    })}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={12} className="px-3 py-6 text-center text-tertiary">
                          No rows — add one below or replace the file.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={addRow}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10pt] font-medium text-themeblue3 border-t border-tertiary/15 active:bg-themeblue3/5 transition-colors"
              >
                <Plus size={14} /> Add item
              </button>
            </div>
          </div>

          {/* Reconcile diff — an upload is an upsert, never a wipe. Recomputes live from the table. */}
          <div className="flex flex-col gap-1 text-sm">
            {plan.linContainers.length > 0 && (
              <span className="text-secondary">{plan.linContainers.length} new hand-receipt {plan.linContainers.length === 1 ? 'LIN' : 'LINs'}</span>
            )}
            <span className="text-primary font-medium">{plan.creates.length} new {plan.creates.length === 1 ? 'item' : 'items'}</span>
            <span className="text-secondary">{plan.merges.length} merged into existing {plan.merges.length === 1 ? 'item' : 'items'}</span>
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
