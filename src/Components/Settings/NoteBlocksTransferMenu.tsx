import { useRef, useState } from 'react'
import { MoreHorizontal, MessageSquare, Download, Upload, FileSpreadsheet, FileDown } from 'lucide-react'
import { ActionButton } from '../ActionButton'
import { AnchoredMenu } from '../LiftedRowMenu'
import type { ContextMenuItem } from '../ContextMenu'
import { useNoteBlocksTransfer } from '../../Hooks/useNoteBlocksTransfer'
import { NoteBlocksCSVImportDrawer } from './NoteBlocksCSVImportDrawer'
import { exportTemplatesCSV, exportOrderSetsCSV, downloadNoteBlocksTemplate, type NoteBlocksCSVKind } from '../../Utilities/noteBlocksCSV'
import type { NoteBlocksData } from '../../lib/objectBundle'

interface Props {
  /** The blocks to share / export (the user's own — personal scope). */
  data: NoteBlocksData
  /** File name base + share label, e.g. "text templates" / "order sets". */
  baseName: string
  /** Whether `data` actually holds anything to send. */
  hasData: boolean
  /** Which CSV schema this panel imports/exports. */
  kind: NoteBlocksCSVKind
}

/**
 * Panel-wide Share / Export / Import control. Renders just the ellipsis trigger
 * (+ its overlays) so it nests inside a manager's corner ActionPill alongside the
 * cluster picker and the New button — one consolidated action menu instead of a
 * separate floating ellipsis. Per-item Share/Export lives in the edit popovers via
 * the same `useNoteBlocksTransfer` hook.
 *
 * Two transport flavors: the frozen `.json` bundle (cross-cluster, lossless) and a
 * human-authorable `.csv` (the CSV mirrors property import — see noteBlocksCSV.ts).
 */
export function NoteBlocksTransferMenu({ data, baseName, hasData, kind }: Props) {
  const { share, exportFile, pickImport, picker, importOverlays } = useNoteBlocksTransfer()
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null)
  const [csvImportOpen, setCsvImportOpen] = useState(false)

  const exportCSV = () => {
    if (kind === 'templates') exportTemplatesCSV(data.textExpanders ?? [])
    else exportOrderSetsCSV(data.planOrderSets ?? [])
  }

  const options: ContextMenuItem[] = [
    ...(hasData ? [
      { key: 'share', label: 'Share to chat', icon: MessageSquare, onAction: () => share(data, `my ${baseName}`) },
      { key: 'export', label: 'Export to file', icon: Download, onAction: () => exportFile(data, baseName) },
      { key: 'export-csv', label: 'Export CSV', icon: FileSpreadsheet, onAction: exportCSV },
    ] : []),
    { key: 'import', label: 'Import from file', icon: Upload, onAction: pickImport },
    { key: 'import-csv', label: 'Import CSV', icon: FileSpreadsheet, onAction: () => setCsvImportOpen(true) },
    { key: 'csv-template', label: 'Download CSV template', icon: FileDown, onAction: () => downloadNoteBlocksTemplate(kind) },
  ]

  return (
    <>
      <span ref={triggerRef} className="inline-flex">
        <ActionButton
          icon={MoreHorizontal}
          label="Share, export or import"
          onClick={() => setMenuRect(triggerRef.current?.getBoundingClientRect() ?? null)}
        />
      </span>

      <AnchoredMenu
        isOpen={!!menuRect}
        anchorRect={menuRect}
        onClose={() => setMenuRect(null)}
        layout="list"
        align="right"
        items={options}
      />

      <NoteBlocksCSVImportDrawer visible={csvImportOpen} onClose={() => setCsvImportOpen(false)} kind={kind} />

      {importOverlays}
      {picker}
    </>
  )
}
