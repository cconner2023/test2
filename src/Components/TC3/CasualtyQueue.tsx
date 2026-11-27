import { memo, useState } from 'react'
import { Trash2, UserPlus, RotateCcw, FileText, Download } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { PreviewOverlay } from '../PreviewOverlay'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import { ListItemRow, RowMoreButton } from '@/Components/primitives/ListItemRow'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import type { TC3Card } from '../../Types/TC3Types'
import { orderByPriority, buildCasualtyStops, bandOf, BAND_META } from './casualtyOrder'

function casualtyName(card: TC3Card): string {
  return [card.casualty.lastName, card.casualty.firstName].filter(Boolean).join(', ') || 'Unknown'
}

interface CasualtyRowProps {
  card: TC3Card
  label: string
  isActive: boolean
  onSelect: () => void
  onMore: (rect: DOMRect) => void
}

function CasualtyRow({ card, label, isActive, onSelect, onMore }: CasualtyRowProps) {
  const band = bandOf(card)
  const dotColor = band
    ? BAND_META[band]?.color ?? 'bg-tertiary/30'
    : isActive ? 'bg-themeblue2' : 'bg-tertiary/30'

  return (
    <ListItemRow
      as="div"
      onClick={isActive ? undefined : onSelect}
      className={`px-4 py-3 border-b border-tertiary/8 last:border-0 transition-colors ${
        isActive
          ? 'bg-themeblue2/8 cursor-default'
          : 'cursor-pointer hover:bg-themeblue2/4 active:bg-themeblue2/8'
      }`}
      left={<div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isActive ? 'ring-2 ring-themeblue2/30' : ''} ${dotColor}`} />}
      center={
        <>
          <p className="text-sm font-medium text-primary truncate">{label}</p>
          <p className="text-[9pt] text-secondary mt-0.5 truncate">{casualtyName(card)}</p>
        </>
      }
      right={<RowMoreButton onMore={onMore} />}
    />
  )
}

interface CasualtyQueueProps {
  isOpen: boolean
  onClose: () => void
}

export const CasualtyQueue = memo(function CasualtyQueue({ isOpen, onClose }: CasualtyQueueProps) {
  const card = useTC3Store((s) => s.card)
  const casualtyQueue = useTC3Store((s) => s.casualtyQueue)
  const pushToQueue = useTC3Store((s) => s.pushToQueue)
  const restoreFromQueue = useTC3Store((s) => s.restoreFromQueue)
  const discardFromQueue = useTC3Store((s) => s.discardFromQueue)
  const discardActive = useTC3Store((s) => s.discardActive)
  const resetCard = useTC3Store((s) => s.resetCard)
  const openExportForCard = useTC3Store((s) => s.openExportForCard)
  const openExportForCards = useTC3Store((s) => s.openExportForCards)
  const [menu, setMenu] = useState<{ cardId: string; rect: DOMRect } | null>(null)

  // Triage order: sort by evac-priority band, then creation time within a band.
  const all = orderByPriority([
    { card, isActive: true },
    ...casualtyQueue.map((e) => ({ card: e.card, isActive: false })),
  ])
  // Evac-priority label (U1, P1, R2, …) per casualty — same convention as the slider.
  const labelById = new Map(buildCasualtyStops(all.map(({ card: c }) => c)).map((s) => [s.id, s.label]))

  const handleSelect = (cardId: string) => {
    restoreFromQueue(cardId)
    onClose()
  }

  const handleDiscard = (cardId: string, isActive: boolean) => {
    if (isActive) {
      discardActive()
      onClose()
    } else {
      discardFromQueue(cardId)
    }
  }

  const menuEntry = menu ? all.find((a) => a.card.id === menu.cardId) : null
  const menuItems: ContextMenuItem[] = menuEntry
    ? [
        { key: 'view', label: 'View note', icon: FileText, onAction: () => { onClose(); openExportForCard(menuEntry.card) } },
        { key: 'reset', label: 'Reset', icon: RotateCcw, onAction: menuEntry.isActive ? resetCard : () => handleSelect(menuEntry.card.id) },
        { key: 'discard', label: 'Discard', icon: Trash2, destructive: true, onAction: () => handleDiscard(menuEntry.card.id, menuEntry.isActive) },
      ]
    : []

  const actions = [
    ...(all.length > 1 ? [{ key: 'export-all', label: 'Export All', icon: Download, onAction: () => openExportForCards(all.map(({ card: c }) => c)), closesOnAction: true as const }] : []),
    { key: 'new', label: 'New Casualty', icon: UserPlus, onAction: pushToQueue, closesOnAction: true as const },
  ]

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={null}
      title="Casualties"
      maxWidth={320}
      previewMaxHeight="50dvh"
      actions={actions}
    >
      {all.map(({ card: c, isActive }) => (
        <CasualtyRow
          key={c.id}
          card={c}
          label={labelById.get(c.id) ?? ''}
          isActive={isActive}
          onSelect={() => handleSelect(c.id)}
          onMore={(rect) => setMenu({ cardId: c.id, rect })}
        />
      ))}
      {menu && menuEntry && (
        <AnchoredMenu
          isOpen
          layout="list"
          align="right"
          anchorRect={menu.rect}
          onClose={() => setMenu(null)}
          items={menuItems}
        />
      )}
    </PreviewOverlay>
  )
})
