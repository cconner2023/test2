import { useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal, FileSpreadsheet } from 'lucide-react'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { NoteBlocksCSVImportDrawer } from './NoteBlocksCSVImportDrawer'
import type { NoteBlocksCSVKind } from '../../Utilities/noteBlocksCSV'

interface Props {
  kind: NoteBlocksCSVKind
  /** Trigger a CSV export of the current rows (caller owns the data + resolution). */
  onExportCsv: () => void
  /** Whether there is anything to export. */
  hasData: boolean
}

/**
 * CSV-only transfer actions for app-content kinds that don't ride the cross-cluster
 * JSON bundle (provider templates). Returns the menu items plus the
 * import drawer so callers can fold the items into a consolidated corner ⋯
 * (OverlayActionMenu) and render the drawer once. Bundle-based Share-to-chat lives
 * in NoteBlocksTransferMenu instead.
 */
export function useCsvActionsItems({ kind, onExportCsv, hasData }: Props): { items: ContextMenuItem[]; importDrawer: ReactNode } {
  const [importOpen, setImportOpen] = useState(false)

  const items: ContextMenuItem[] = [
    ...(hasData ? [{ key: 'export-csv', label: 'Export CSV', icon: FileSpreadsheet, onAction: onExportCsv }] : []),
    // Template download lives inside the import drawer itself — no separate item (mirrors NoteBlocksTransferMenu).
    { key: 'import-csv', label: 'Import CSV', icon: FileSpreadsheet, onAction: () => setImportOpen(true) },
  ]

  const importDrawer = <NoteBlocksCSVImportDrawer visible={importOpen} onClose={() => setImportOpen(false)} kind={kind} />

  return { items, importDrawer }
}

/**
 * Standalone CSV ⋯ trigger (its own ellipsis + overlay). Used where the CSV actions
 * stand alone in a corner pill. Where they share a pill with other actions, use
 * `useCsvActionsItems` and fold the items into one OverlayActionMenu.
 */
export function CsvActionsMenu(props: Props) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null)
  const { items, importDrawer } = useCsvActionsItems(props)

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
        items={items}
      />
      {importDrawer}
    </>
  )
}
