import { useRef, useState } from 'react'
import { MoreHorizontal, Settings, Plus } from 'lucide-react'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { useCsvActionsItems } from '../Settings/CsvActionsMenu'
import { exportProviderTemplatesCSV } from '../../Utilities/noteBlocksCSV'
import type { ProviderNoteTemplate, PlanOrderSet } from '../../Data/User'

/**
 * Template actions menu — New · Export CSV · Import CSV.
 * One trigger, two skins: a settings gear beside the desktop rail search, or an
 * ellipsis in the mobile Templates sheet header (per the same actions). Replaces
 * the bare circular "+" so New sits alongside the CSV transfer actions in a single
 * menu (mirrors Settings/ProviderTemplatesPanel's OverlayActionMenu). Import/Export
 * reuse the shared useCsvActionsItems (kind: providerTemplates) — CSV is the only
 * file transport for templates (see noteBlocksCSV.ts).
 *
 * `onNew(anchor)` hands the trigger rect back to the host: mobile anchors the
 * ProviderTemplateEditPopover to it; desktop ignores it and opens the right-pane
 * editor (Case A).
 */
export function ProviderTemplateMenu({
  templates,
  orderSets,
  onNew,
  variant,
}: {
  templates: ProviderNoteTemplate[]
  orderSets: PlanOrderSet[]
  onNew: (anchor: DOMRect) => void
  /** gear = desktop rail; ellipsis = mobile sheet header. */
  variant: 'gear' | 'ellipsis'
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null)

  const { items: csvItems, importDrawer } = useCsvActionsItems({
    kind: 'providerTemplates',
    hasData: templates.length > 0,
    onExportCsv: () => exportProviderTemplatesCSV(templates, orderSets),
  })

  const items: ContextMenuItem[] = [
    {
      key: 'new',
      label: 'New template',
      icon: Plus,
      onAction: () => { if (triggerRef.current) onNew(triggerRef.current.getBoundingClientRect()) },
    },
    ...csvItems,
  ]

  const Icon = variant === 'gear' ? Settings : MoreHorizontal

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Template actions"
        onClick={() => setMenuRect(triggerRef.current?.getBoundingClientRect() ?? null)}
        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary hover:bg-tertiary/8 active:scale-95 transition-all"
      >
        <Icon size={18} />
      </button>
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
