import { useMemo, useState, useCallback, useEffect } from 'react'
import { Download } from 'lucide-react'
import { PreviewOverlay } from '../../PreviewOverlay'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { DatePickerInput } from '@/Components/primitives/FormInputs'
import { useIsMobile } from '../../../Hooks/useIsMobile'
import {
  buildTrainingCompletionExportRows,
  shareTrainingCompletionCsv,
  trainingCompletionCsvFilename,
} from '../../../lib/trainingCompletionCsv'
import { createLogger } from '../../../Utilities/Logger'
import type { TrainingCompletionUI } from '../../../lib/trainingService'

const logger = createLogger('TrainingExportOverlay')

interface TrainingExportOverlayProps {
  isOpen: boolean
  onClose: () => void
  anchorRect: DOMRect | null
  /** What the export covers, e.g. a cluster, soldier, or subject-area name. */
  scopeLabel: string
  /** Feeds the filename slug; usually the scope label. */
  filenameStem: string
  /** Completions already narrowed to the scope. Result/type filtering happens here. */
  completions: TrainingCompletionUI[]
  resolveName: (userId: string) => string
  /** Restrict to these training item ids (subject-area exports). */
  taskIds?: ReadonlySet<string>
}

/**
 * Date-bounded Soldier/Task/Date export prompt, shared by the cluster, soldier
 * and subject-area supervisor surfaces.
 *
 * Both dates start empty so the supervisor states the pull window rather than
 * inheriting one; the Export action only exists once the window is valid.
 */
export function TrainingExportOverlay({
  isOpen,
  onClose,
  anchorRect,
  scopeLabel,
  filenameStem,
  completions,
  resolveName,
  taskIds,
}: TrainingExportOverlayProps) {
  const isMobile = useIsMobile()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setStartDate('')
    setEndDate('')
    setExporting(false)
  }, [isOpen])

  const rangeValid = !!startDate && !!endDate && startDate <= endDate

  const rows = useMemo(() => {
    if (!rangeValid) return []
    return buildTrainingCompletionExportRows(completions, {
      resolveName,
      startDate,
      endDate,
      taskIds,
    })
  }, [rangeValid, completions, resolveName, startDate, endDate, taskIds])

  const handleExport = useCallback(async () => {
    if (!rangeValid || rows.length === 0) return
    setExporting(true)
    try {
      await shareTrainingCompletionCsv(rows, trainingCompletionCsvFilename(filenameStem, startDate, endDate))
      onClose()
    } catch (e) {
      // A cancelled Web Share sheet lands here too, so this is not surfaced.
      logger.warn('export failed:', e instanceof Error ? e.message : e)
    } finally {
      setExporting(false)
    }
  }, [rangeValid, rows, filenameStem, startDate, endDate, onClose])

  const rowCx = `flex items-center justify-between border-b border-primary/6 last:border-0 ${
    isMobile ? 'px-4 py-3' : 'px-3 py-2.5'
  }`
  const labelCx = `text-secondary ${isMobile ? 'text-sm' : 'text-[10pt]'}`

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={anchorRect}
      title="Export completions"
      maxWidth={380}
      rightFooter={
        rangeValid && rows.length > 0 ? (
          <FooterPill side="right">
            <ActionButton
              icon={Download}
              label={exporting ? 'Exporting…' : 'Export CSV'}
              variant={exporting ? 'disabled' : 'confirm'}
              onClick={handleExport}
            />
          </FooterPill>
        ) : undefined
      }
    >
      <div>
        <div className={rowCx}>
          <span className={labelCx}>Scope</span>
          <span className={`text-primary text-right truncate ml-3 ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>
            {scopeLabel}
          </span>
        </div>
        <div className={rowCx}>
          <span className={labelCx}>Start date</span>
          <div className="w-40">
            <DatePickerInput
              value={startDate}
              onChange={setStartDate}
              placeholder="Select date"
              maxDate={endDate || undefined}
            />
          </div>
        </div>
        <div className={rowCx}>
          <span className={labelCx}>End date</span>
          <div className="w-40">
            <DatePickerInput
              value={endDate}
              onChange={setEndDate}
              placeholder="Select date"
              minDate={startDate || undefined}
            />
          </div>
        </div>
        <div className={`${rowCx} justify-start`}>
          <p className="text-[10pt] text-tertiary">
            {!startDate || !endDate
              ? 'Pick a start and end date to pull passed evaluations.'
              : startDate > endDate
                ? 'The start date must fall on or before the end date.'
                : rows.length === 0
                  ? 'No passed evaluations in this window.'
                  : `${rows.length} row${rows.length === 1 ? '' : 's'} — Soldier, Task, Date.`}
          </p>
        </div>
      </div>
    </PreviewOverlay>
  )
}
