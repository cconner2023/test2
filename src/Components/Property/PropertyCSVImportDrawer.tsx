import { useState, useRef, useMemo, useCallback } from 'react'
import { Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Section, SectionCard } from '../Section'
import { LoadingSpinner } from '../LoadingSpinner'
import { usePropertyStore } from '../../stores/usePropertyStore'
import {
  parsePropertyCSV,
  downloadCSVTemplate,
  reconcileImport,
  type ParsedRow,
  type MergeMode,
} from '../../Utilities/PropertyCSV'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'

interface PropertyCSVImportProps {
  /** Close the host surface (right pane / detail sheet). */
  onClose: () => void
}

type Step = 'pick' | 'preview' | 'importing' | 'done'

/** Surfaceless CSV-import wizard body. Hosted in the Property right pane (desktop)
 *  / detail sheet (mobile) by PropertyPanel — the same surfaces zone/item/sign-out
 *  use. The host owns the header + close affordance.
 *
 *  An upload is additive-or-merge: a row with no existing match adds a new item; a row
 *  matching an existing item (serial when present, else NSN → LIN → name) MERGES into it.
 *  Merge mode decides present qty — 'set' (inventory snapshot, idempotent) or 'add'
 *  (received stock). Authorized qty always tracks the CSV; items dropped from the BOM are
 *  de-authorized (kept on hand), never deleted. See reconcileImport. */
export function PropertyCSVImport({ onClose }: PropertyCSVImportProps) {
  const { locations, items, clinicId, addItem, editItem, addLocation } = usePropertyStore(
    useShallow(s => ({
      locations: s.locations,
      items: s.items,
      clinicId: s.clinicId,
      addItem: s.addItem,
      editItem: s.editItem,
      addLocation: s.addLocation,
    }))
  )

  const [step, setStep] = useState<Step>('pick')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [mergeMode, setMergeMode] = useState<MergeMode>('set')
  const [appliedCount, setAppliedCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const plan = useMemo(
    () => reconcileImport(parsedRows, items, { mergeMode }),
    [parsedRows, items, mergeMode],
  )
  const totalOps = plan.creates.length + plan.merges.length + plan.deauthorizes.length

  const handleClose = useCallback(() => {
    setStep('pick')
    setParsedRows([])
    setParseErrors([])
    setMergeMode('set')
    setAppliedCount(0)
    onClose()
  }, [onClose])

  const handleFileChange = useCallback(async (file: File | null | undefined) => {
    if (!file) return
    const result = await parsePropertyCSV(file)
    setParsedRows(result.rows)
    setParseErrors(result.errors)
    setStep('preview')
  }, [])

  async function handleImport() {
    if (!clinicId || totalOps === 0) return
    setStep('importing')

    // Locations are only needed for the rows we're creating.
    const visibleLocs = locations.filter(l => l.name !== ROOT_LOCATION_NAME)
    const locMap = new Map<string, string>()
    for (const l of visibleLocs) locMap.set(l.name.toLowerCase(), l.id)

    const neededNames = [...new Set(
      plan.creates
        .map(r => r.location.trim())
        .filter(n => n !== '' && !locMap.has(n.toLowerCase()))
    )]

    for (const name of neededNames) {
      const result = await addLocation({
        clinic_id: clinicId,
        parent_id: null,
        name,
        photo_data: null,
        holder_user_id: null,
        created_by: '',
      })
      if (result.success && result.location) {
        locMap.set(name.toLowerCase(), result.location.id)
      }
    }

    // New items: present qty + authorized in one create.
    for (const row of plan.creates) {
      const locationId = row.location.trim()
        ? locMap.get(row.location.trim().toLowerCase()) ?? null
        : null
      await addItem({
        clinic_id: clinicId,
        name: row.name,
        nomenclature: row.nomenclature || null,
        nsn: row.nsn || null,
        lin: row.lin || null,
        condition_code: 'serviceable',
        location_id: locationId,
        current_holder_id: null,
        parent_item_id: null,
        expiry_date: null,
        notes: null,
        is_serialized: false,
        serial_number: row.serialNumber || null,
        quantity: row.quantity,
        location_tag_id: null,
        photo_url: null,
        visual_fingerprint: null,
        sub_cluster_id: null,
        quantity_authorized: row.quantityAuthorized,
      })
    }

    // Merges: write only what changed (present qty per merge mode, authorized always tracks CSV).
    for (const m of plan.merges) {
      await editItem(m.itemId, {
        ...(m.qtyChanged ? { quantity: m.newQty } : {}),
        ...(m.authChanged ? { quantity_authorized: m.newAuth } : {}),
      })
    }
    // De-authorize dropped-from-BOM items; present stock untouched.
    for (const d of plan.deauthorizes) {
      await editItem(d.itemId, { quantity_authorized: null })
    }

    setAppliedCount(totalOps)
    setStep('done')
  }

  const previewCreates = plan.creates.slice(0, 20)
  const extraCreates = plan.creates.length - previewCreates.length

  return (
    <>
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => handleFileChange(e.target.files?.[0])}
          />
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

          {/* Reconcile diff — an upload is an upsert, never a wipe. */}
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-primary font-medium">{plan.creates.length} new {plan.creates.length === 1 ? 'item' : 'items'}</span>
            <span className="text-secondary">{plan.merges.length} merged into existing {plan.merges.length === 1 ? 'item' : 'items'}</span>
            {plan.deauthorizes.length > 0 && (
              <span className="text-amber-700">{plan.deauthorizes.length} dropped from BOM — de-authorized, still on hand</span>
            )}
          </div>

          {plan.creates.length > 0 && (
            <Section title="New items">
              <SectionCard>
                <table className="w-full text-[10pt]">
                  <thead>
                    <tr className="border-b border-themeblue3/10">
                      <th className="text-left px-3 py-2 text-tertiary font-medium">Name</th>
                      <th className="text-left px-3 py-2 text-tertiary font-medium">Qty</th>
                      <th className="text-left px-3 py-2 text-tertiary font-medium">Auth</th>
                      <th className="text-left px-3 py-2 text-tertiary font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewCreates.map((row, i) => (
                      <tr key={i} className="border-b border-themeblue3/10 last:border-b-0">
                        <td className="px-3 py-2 text-primary truncate max-w-[140px]">{row.name}</td>
                        <td className="px-3 py-2 text-secondary">{row.quantity}</td>
                        <td className="px-3 py-2 text-secondary">{row.quantityAuthorized ?? '—'}</td>
                        <td className="px-3 py-2 text-secondary truncate max-w-[100px]">{row.location || '—'}</td>
                      </tr>
                    ))}
                    {extraCreates > 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-tertiary text-center">
                          + {extraCreates} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </SectionCard>
            </Section>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('pick')}
              className="flex-1 rounded-full px-6 py-3 text-sm font-medium bg-themewhite2 border border-tertiary/20 text-primary"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={totalOps === 0}
              className="flex-1 rounded-full px-6 py-3 text-sm font-medium bg-themeblue3 text-white disabled:opacity-40"
            >
              Apply {totalOps} {totalOps === 1 ? 'change' : 'changes'}
            </button>
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
}
