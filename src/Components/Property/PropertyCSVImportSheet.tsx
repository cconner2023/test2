import { useState, useRef, useCallback } from 'react'
import { Upload, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { BaseDrawer } from '../BaseDrawer'
import { HeaderPill, PillButton } from '../HeaderPill'
import { Section, SectionCard } from '../Section'
import { LoadingSpinner } from '../LoadingSpinner'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { parsePropertyCSV, downloadCSVTemplate, type ParsedRow } from '../../Utilities/PropertyCSV'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'

interface PropertyCSVImportSheetProps {
  visible: boolean
  onClose: () => void
}

type Step = 'pick' | 'preview' | 'importing' | 'done'

export function PropertyCSVImportSheet({ visible, onClose }: PropertyCSVImportSheetProps) {
  const { locations, clinicId, addItem, addLocation } = usePropertyStore(
    useShallow(s => ({
      locations: s.locations,
      clinicId: s.clinicId,
      addItem: s.addItem,
      addLocation: s.addLocation,
    }))
  )

  const [step, setStep] = useState<Step>('pick')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [importedCount, setImportedCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClose = useCallback(() => {
    setStep('pick')
    setParsedRows([])
    setParseErrors([])
    setImportedCount(0)
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
    if (!clinicId || parsedRows.length === 0) return
    setStep('importing')

    const visibleLocs = locations.filter(l => l.name !== ROOT_LOCATION_NAME)
    const locMap = new Map<string, string>()
    for (const l of visibleLocs) locMap.set(l.name.toLowerCase(), l.id)

    const neededNames = [...new Set(
      parsedRows
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

    for (const row of parsedRows) {
      const locationId = row.location.trim()
        ? locMap.get(row.location.trim().toLowerCase()) ?? null
        : null
      await addItem({
        clinic_id: clinicId,
        name: row.name,
        nomenclature: row.nomenclature || null,
        nsn: row.nsn || null,
        lin: row.lin || null,
        quantity: row.quantity,
        location_id: locationId,
        serial_number: null,
        photo_data: null,
        parent_item_id: null,
        holder_user_id: null,
        barcode_fingerprint: null,
      })
    }

    setImportedCount(parsedRows.length)
    setStep('done')
  }

  const previewRows = parsedRows.slice(0, 20)
  const extraRows = parsedRows.length - 20

  const headerTitle =
    step === 'pick' ? 'Import Property CSV'
    : step === 'preview' ? 'Preview'
    : step === 'importing' ? 'Importing…'
    : 'Import Complete'

  const headerRightContent =
    step === 'pick' || step === 'preview' ? (
      <HeaderPill>
        <PillButton icon={X} iconSize={18} onClick={handleClose} label="Close" />
      </HeaderPill>
    ) : undefined

  return (
    <BaseDrawer
      isVisible={visible}
      onClose={handleClose}
      fullHeight="85dvh"
      header={{
        title: headerTitle,
        rightContent: headerRightContent,
        hideDefaultClose: true,
      }}
      contentPadding="standard"
    >
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
            <div className="bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 p-3 flex gap-2">
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

          <p className="text-sm text-secondary">{parsedRows.length} items to import</p>

          <Section title="Preview">
            <SectionCard>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-themeblue3/10">
                    <th className="text-left px-3 py-2 text-tertiary font-medium">Name</th>
                    <th className="text-left px-3 py-2 text-tertiary font-medium">Qty</th>
                    <th className="text-left px-3 py-2 text-tertiary font-medium">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-themeblue3/10 last:border-b-0">
                      <td className="px-3 py-2 text-primary truncate max-w-[140px]">{row.name}</td>
                      <td className="px-3 py-2 text-secondary">{row.quantity}</td>
                      <td className="px-3 py-2 text-secondary truncate max-w-[100px]">{row.location || '—'}</td>
                    </tr>
                  ))}
                  {extraRows > 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-tertiary text-center">
                        + {extraRows} more items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </SectionCard>
          </Section>

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
              disabled={parsedRows.length === 0}
              className="flex-1 rounded-full px-6 py-3 text-sm font-medium bg-themeblue3 text-white disabled:opacity-40"
            >
              Import {parsedRows.length} items
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <LoadingSpinner />
          <p className="text-sm text-secondary">Importing {parsedRows.length} items…</p>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <CheckCircle2 className="w-12 h-12 text-themegreen" />
          <p className="text-sm text-secondary">{importedCount} items imported</p>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full px-6 py-3 text-sm font-medium bg-themeblue3 text-white"
          >
            Done
          </button>
        </div>
      )}
    </BaseDrawer>
  )
}
