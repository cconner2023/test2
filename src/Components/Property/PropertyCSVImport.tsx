import { useState } from 'react'
import { X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import type { ParsedRow } from '../../Utilities/PropertyCSV'
import type { LocalPropertyLocation, PropertyItem } from '../../Types/PropertyTypes'

interface Props {
  rows: ParsedRow[]
  errors: string[]
  locations: LocalPropertyLocation[]
  clinicId: string
  onImport: (data: Omit<PropertyItem, 'id' | 'created_at' | 'updated_at'>) => Promise<unknown>
  onClose: () => void
}

export function PropertyCSVImport({ rows, errors, locations, clinicId, onImport, onClose }: Props) {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)

  const locationMap = new Map<string, string>()
  for (const loc of locations) {
    locationMap.set(loc.name.toLowerCase(), loc.id)
  }

  function resolveLocationId(name: string): string | null {
    if (!name) return null
    return locationMap.get(name.toLowerCase()) ?? null
  }

  async function handleImport() {
    setImporting(true)
    let imported = 0
    let skipped = 0

    for (const row of rows) {
      try {
        await onImport({
          clinic_id: clinicId,
          name: row.name,
          nomenclature: row.nomenclature || null,
          nsn: row.nsn || null,
          lin: row.lin || null,
          serial_number: null,
          quantity: row.quantity,
          condition_code: 'serviceable',
          parent_item_id: null,
          location_id: resolveLocationId(row.location),
          current_holder_id: null,
          location_tag_id: null,
          photo_url: null,
          notes: null,
        })
        imported++
      } catch {
        skipped++
      }
    }

    setResult({ imported, skipped })
    setImporting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-primary rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-tertiary/10">
          <h3 className="text-sm font-semibold text-primary">Import CSV Preview</h3>
          <button onClick={onClose} className="text-tertiary hover:text-primary">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Parse errors */}
          {errors.length > 0 && (
            <div className="rounded-md bg-red-500/10 p-3 space-y-1">
              <p className="text-xs font-medium text-red-400 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.length} row{errors.length > 1 ? 's' : ''} skipped
              </p>
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-300">{e}</p>
              ))}
            </div>
          )}

          {/* Result summary */}
          {result && (
            <div className="rounded-md bg-green-500/10 p-3">
              <p className="text-xs font-medium text-green-400 flex items-center gap-1">
                <CheckCircle size={12} /> {result.imported} item{result.imported !== 1 ? 's' : ''} imported
                {result.skipped > 0 && `, ${result.skipped} skipped`}
              </p>
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && !result && (
            <>
              <p className="text-xs text-tertiary">{rows.length} valid row{rows.length !== 1 ? 's' : ''} ready to import</p>
              <div className="overflow-x-auto rounded border border-tertiary/10">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/10 text-tertiary">
                      <th className="text-left px-2 py-1.5 font-medium">Name</th>
                      <th className="text-left px-2 py-1.5 font-medium">Nomenclature</th>
                      <th className="text-left px-2 py-1.5 font-medium">NSN</th>
                      <th className="text-left px-2 py-1.5 font-medium">LIN</th>
                      <th className="text-right px-2 py-1.5 font-medium">Qty</th>
                      <th className="text-left px-2 py-1.5 font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const locResolved = row.location ? resolveLocationId(row.location) !== null : true
                      return (
                        <tr key={i} className="border-t border-tertiary/5">
                          <td className="px-2 py-1.5 text-primary">{row.name}</td>
                          <td className="px-2 py-1.5 text-tertiary">{row.nomenclature || '—'}</td>
                          <td className="px-2 py-1.5 text-tertiary font-mono">{row.nsn || '—'}</td>
                          <td className="px-2 py-1.5 text-tertiary font-mono">{row.lin || '—'}</td>
                          <td className="px-2 py-1.5 text-right text-primary">{row.quantity}</td>
                          <td className="px-2 py-1.5">
                            {row.location ? (
                              <span className={locResolved ? 'text-tertiary' : 'text-amber-400'}>
                                {row.location}
                                {!locResolved && ' (no match)'}
                              </span>
                            ) : (
                              <span className="text-tertiary">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {rows.length === 0 && errors.length === 0 && (
            <p className="text-xs text-tertiary text-center py-4">No data rows found in file</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-tertiary/10">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-md text-tertiary hover:text-primary transition-colors"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && rows.length > 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-themeblue3 text-white hover:bg-themeblue3/90 disabled:opacity-50 transition-colors"
            >
              {importing && <Loader2 size={12} className="animate-spin" />}
              {importing ? 'Importing...' : `Import ${rows.length} Item${rows.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
