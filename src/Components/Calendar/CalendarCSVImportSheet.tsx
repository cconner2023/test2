import { useState, useRef } from 'react'
import { Upload, X, CheckCircle2 } from 'lucide-react'
import { BaseDrawer } from '../BaseDrawer'
import { HeaderPill, PillButton } from '../HeaderPill'
import { LoadingSpinner } from '../LoadingSpinner'
import { Section, SectionCard } from '../Section'
import { useCalendarVault } from '../../Hooks/useCalendarVault'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { generateId } from '../../Types/CalendarTypes'
import { parseCalendarCSV, downloadCalendarCSVTemplate } from '../../lib/calendarCSV'
import type { ParsedCalendarRow } from '../../lib/calendarCSV'

interface CalendarCSVImportSheetProps {
  visible: boolean
  onClose: () => void
  clinicId: string
  userId: string
}

type Step = 'pick' | 'preview' | 'importing' | 'done'

export function CalendarCSVImportSheet({ visible, onClose, clinicId, userId }: CalendarCSVImportSheetProps) {
  const [step, setStep] = useState<Step>('pick')
  const [parsedRows, setParsedRows] = useState<ParsedCalendarRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [importedCount, setImportedCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { sendEvent } = useCalendarVault()

  function handleClose() {
    setStep('pick')
    setParsedRows([])
    setParseErrors([])
    setImportedCount(0)
    onClose()
  }

  async function handleFile(file: File) {
    const result = await parseCalendarCSV(file)
    setParsedRows(result.rows)
    setParseErrors(result.errors)
    setStep('preview')
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  async function handleImport() {
    setStep('importing')
    const now = new Date().toISOString()
    const store = useCalendarStore.getState()

    const events = parsedRows.map(row => ({
      id: generateId(),
      clinic_id: clinicId,
      title: row.title,
      description: row.description || null,
      category: row.category,
      status: 'pending' as const,
      start_time: row.all_day ? row.start_date + 'T00:00' : row.start_date + 'T' + row.start_time,
      end_time: row.all_day ? row.end_date + 'T23:59' : row.end_date + 'T' + row.end_time,
      all_day: row.all_day,
      location: row.location || null,
      opord_notes: null,
      uniform: null,
      report_time: null,
      assigned_to: [],
      property_item_ids: [],
      structured_location: null,
      created_by: userId,
      created_at: now,
      updated_at: now,
    }))

    for (const ev of events) store.addEvent(ev)

    for (const ev of events) {
      sendEvent('c', ev).then(originId => {
        if (originId) useCalendarStore.getState().updateEvent(ev.id, { originId })
      }).catch(() => {})
    }

    setImportedCount(events.length)
    setStep('done')
  }

  const headerTitle =
    step === 'pick' ? 'Import Calendar CSV'
    : step === 'preview' ? 'Preview'
    : step === 'importing' ? 'Importing…'
    : 'Import Complete'

  const showClose = step === 'pick' || step === 'preview'

  const previewRows = parsedRows.slice(0, 20)
  const extraRows = parsedRows.length - 20
  const visibleErrors = parseErrors.slice(0, 5)
  const extraErrors = parseErrors.length - 5

  return (
    <BaseDrawer
      isVisible={visible}
      onClose={handleClose}
      fullHeight="85dvh"
      header={{
        title: headerTitle,
        rightContent: showClose ? (
          <HeaderPill>
            <PillButton icon={X} iconSize={18} onClick={handleClose} label="Close" />
          </HeaderPill>
        ) : undefined,
        hideDefaultClose: true,
      }}
    >
      <div className="flex flex-col h-full px-5 pb-6">

        {step === 'pick' && (
          <div className="flex flex-col gap-4 pt-4">
            <div
              className="border-2 border-dashed border-tertiary/30 rounded-2xl flex flex-col items-center justify-center gap-3 py-12 px-6 cursor-pointer active:bg-primary/5 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              <Upload className="w-8 h-8 text-tertiary" />
              <p className="text-sm text-secondary text-center">Drop a CSV or tap to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleInputChange}
              />
            </div>
            <button
              className="text-sm text-themeblue3 underline underline-offset-2 self-start"
              onClick={downloadCalendarCSVTemplate}
            >
              Download template
            </button>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex flex-col gap-4 pt-4 min-h-0 flex-1">
            {parseErrors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl text-[10pt] text-amber-800 p-3">
                <p className="font-semibold mb-1">Warning — some rows were skipped:</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  {visibleErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
                {extraErrors > 0 && (
                  <p className="mt-1 text-amber-700">+ {extraErrors} more</p>
                )}
              </div>
            )}

            <p className="text-sm text-secondary">
              <span className="font-semibold text-primary">{parsedRows.length}</span> event{parsedRows.length !== 1 ? 's' : ''} to import
            </p>

            {parsedRows.length > 0 && (
              <Section title="Preview" className="flex-1 min-h-0 mb-0">
                <SectionCard>
                  <div className="overflow-y-auto max-h-[30dvh]">
                    <table className="w-full text-[10pt]">
                      <thead className="sticky top-0 bg-themewhite2 border-b border-tertiary/10">
                        <tr>
                          <th className="text-left px-3 py-2 text-tertiary font-medium">Title</th>
                          <th className="text-left px-3 py-2 text-tertiary font-medium">Date</th>
                          <th className="text-left px-3 py-2 text-tertiary font-medium">Time</th>
                          <th className="text-left px-3 py-2 text-tertiary font-medium">Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i} className="border-t border-tertiary/5">
                            <td className="px-3 py-2 text-primary truncate max-w-[120px]">{row.title}</td>
                            <td className="px-3 py-2 text-secondary whitespace-nowrap">{row.start_date}</td>
                            <td className="px-3 py-2 text-secondary whitespace-nowrap">
                              {row.all_day ? 'All day' : row.start_time}
                            </td>
                            <td className="px-3 py-2 text-secondary capitalize">{row.category}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {extraRows > 0 && (
                      <p className="px-3 py-2 text-[10pt] text-tertiary border-t border-tertiary/5">
                        + {extraRows} more
                      </p>
                    )}
                  </div>
                </SectionCard>
              </Section>
            )}

            <div className="flex gap-3 pt-2 mt-auto">
              <button
                onClick={() => { setParsedRows([]); setParseErrors([]); setStep('pick') }}
                className="flex-1 rounded-full px-6 py-3 text-sm font-medium bg-themewhite2 border border-tertiary/20 text-primary active:scale-95 transition-all"
              >
                Back
              </button>
              {parsedRows.length > 0 && (
                <button
                  onClick={handleImport}
                  className="flex-1 rounded-full px-6 py-3 text-sm font-medium bg-themeblue3 text-white active:scale-95 transition-all"
                >
                  Import {parsedRows.length} event{parsedRows.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4">
            <LoadingSpinner size="md" />
            <p className="text-sm text-secondary">Importing {parsedRows.length} event{parsedRows.length !== 1 ? 's' : ''}…</p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4">
            <CheckCircle2 className="w-12 h-12 text-themegreen" />
            <p className="text-sm text-primary font-medium">{importedCount} event{importedCount !== 1 ? 's' : ''} imported</p>
            <button
              onClick={handleClose}
              className="rounded-full px-8 py-3 text-sm font-medium bg-themeblue3 text-white active:scale-95 transition-all"
            >
              Done
            </button>
          </div>
        )}

      </div>
    </BaseDrawer>
  )
}
