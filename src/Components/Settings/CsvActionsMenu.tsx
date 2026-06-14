import { useRef, useState } from 'react'
import { MoreHorizontal, FileSpreadsheet, FileDown } from 'lucide-react'
import { ActionButton } from '../ActionButton'
import { AnchoredMenu } from '../LiftedRowMenu'
import type { ContextMenuItem } from '../ContextMenu'
import { NoteBlocksCSVImportDrawer } from './NoteBlocksCSVImportDrawer'
import { downloadNoteBlocksTemplate, type NoteBlocksCSVKind } from '../../Utilities/noteBlocksCSV'

interface Props {
  kind: NoteBlocksCSVKind
  /** Trigger a CSV export of the current rows (caller owns the data + resolution). */
  onExportCsv: () => void
  /** Whether there is anything to export. */
  hasData: boolean
}

/**
 * CSV-only transfer menu for app-content kinds that don't ride the cross-cluster
 * JSON bundle (provider templates, checklists). Just Import / Export / template —
 * the bundle-based Share-to-chat lives in NoteBlocksTransferMenu instead.
 */
export function CsvActionsMenu({ kind, onExportCsv, hasData }: Props) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const options: ContextMenuItem[] = [
    ...(hasData ? [{ key: 'export-csv', label: 'Export CSV', icon: FileSpreadsheet, onAction: onExportCsv }] : []),
    { key: 'import-csv', label: 'Import CSV', icon: FileSpreadsheet, onAction: () => setImportOpen(true) },
    { key: 'csv-template', label: 'Download CSV template', icon: FileDown, onAction: () => downloadNoteBlocksTemplate(kind) },
  ]

  return (
    <>
      <span ref={triggerRef} className="inline-flex">
        <ActionButton
          icon={MoreHorizontal}
          label="Import or export CSV"
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
      <NoteBlocksCSVImportDrawer visible={importOpen} onClose={() => setImportOpen(false)} kind={kind} />
    </>
  )
}
