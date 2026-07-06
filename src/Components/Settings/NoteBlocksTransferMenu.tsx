import { useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal, MessageSquare, FileSpreadsheet, FileDown } from 'lucide-react'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
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
 * Panel-wide Share / CSV actions. Returns the menu items plus all the overlays
 * (CSV import drawer + share picker) so a manager can fold the items into one
 * consolidated corner ⋯ (OverlayActionMenu) alongside the cluster picker and New —
 * a single action menu, not a separate floating ellipsis. Per-item Share lives in
 * the manager lifted-row menus via the same `useNoteBlocksTransfer` hook.
 *
 * Two transports, two jobs: the JSON `note-blocks` bundle is app-internal and rides
 * chat only (Share to chat → received via the chat bundle card; never a file), while
 * the human-authorable `.csv` is the only file in/out (mirrors property import — see
 * noteBlocksCSV.ts).
 */
export function useNoteBlocksTransferItems({ data, baseName, hasData, kind }: Props): { items: ContextMenuItem[]; overlays: ReactNode } {
  const { share, picker } = useNoteBlocksTransfer()
  const [csvImportOpen, setCsvImportOpen] = useState(false)

  const exportCSV = () => {
    if (kind === 'templates') exportTemplatesCSV(data.textExpanders ?? [])
    else exportOrderSetsCSV(data.planOrderSets ?? [])
  }

  const items: ContextMenuItem[] = [
    ...(hasData ? [
      { key: 'share', label: 'Share to chat', icon: MessageSquare, onAction: () => share(data, `my ${baseName}`) },
      { key: 'export-csv', label: 'Export CSV', icon: FileSpreadsheet, onAction: exportCSV },
    ] : []),
    { key: 'import-csv', label: 'Import CSV', icon: FileSpreadsheet, onAction: () => setCsvImportOpen(true) },
    { key: 'csv-template', label: 'Download CSV template', icon: FileDown, onAction: () => downloadNoteBlocksTemplate(kind) },
  ]

  const overlays = (
    <>
      <NoteBlocksCSVImportDrawer visible={csvImportOpen} onClose={() => setCsvImportOpen(false)} kind={kind} />
      {picker}
    </>
  )

  return { items, overlays }
}

/**
 * Standalone Share/CSV ⋯ trigger (its own ellipsis + overlays). Where these actions
 * share a pill with the cluster picker and New, use `useNoteBlocksTransferItems` and
 * fold the items into one OverlayActionMenu instead.
 */
export function NoteBlocksTransferMenu(props: Props) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null)
  const { items, overlays } = useNoteBlocksTransferItems(props)

  return (
    <>
      <span ref={triggerRef} className="inline-flex">
        <ActionButton
          icon={MoreHorizontal}
          label="Share or transfer CSV"
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

      {overlays}
    </>
  )
}
