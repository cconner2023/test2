import { memo } from 'react'
import { Trash2, UserPlus, RotateCcw, FileText, Download } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionButton } from '../ActionButton'
import type { TC3Card } from '../../Types/TC3Types'

const PRIORITY_COLOR: Record<string, string> = {
  Urgent: 'bg-themeredred',
  Priority: 'bg-amber-500',
  Routine: 'bg-themegreen',
}

function casualtyName(card: TC3Card): string {
  return [card.casualty.lastName, card.casualty.firstName].filter(Boolean).join(', ') || 'Unknown'
}

interface CasualtyRowProps {
  card: TC3Card
  number: number
  isActive: boolean
  onSelect: () => void
  onReset: () => void
  onDiscard: () => void
  onViewNote: () => void
}

function CasualtyRow({ card, number, isActive, onSelect, onReset, onDiscard, onViewNote }: CasualtyRowProps) {
  const priority = card.evacuation.priority
  const dotColor = priority
    ? PRIORITY_COLOR[priority]
    : isActive ? 'bg-themeblue2' : 'bg-tertiary/30'

  return (
    <button
      type="button"
      onClick={isActive ? undefined : onSelect}
      disabled={isActive}
      className={`w-full flex items-center gap-3 px-4 py-3 border-b border-tertiary/8 last:border-0 text-left transition-colors ${
        isActive
          ? 'bg-themeblue2/8 cursor-default'
          : 'hover:bg-themeblue2/4 active:bg-themeblue2/8'
      }`}
    >
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isActive ? 'ring-2 ring-themeblue2/30' : ''} ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">Casualty #{number}</p>
        <p className="text-[9pt] text-secondary mt-0.5 truncate">{casualtyName(card)}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <ActionButton icon={FileText} label="View note" onClick={onViewNote} />
        <ActionButton icon={RotateCcw} label="Reset" onClick={onReset} />
        <ActionButton icon={Trash2} label="Discard" onClick={onDiscard} variant="danger" />
      </div>
    </button>
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

  // Stable order: sort all casualties by creation time
  const all = [
    { card, isActive: true },
    ...casualtyQueue.map((e) => ({ card: e.card, isActive: false })),
  ].sort((a, b) => a.card.createdAt.localeCompare(b.card.createdAt))

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
      {all.map(({ card: c, isActive }, i) => (
        <CasualtyRow
          key={c.id}
          card={c}
          number={i + 1}
          isActive={isActive}
          onSelect={() => handleSelect(c.id)}
          onReset={isActive ? resetCard : () => handleSelect(c.id)}
          onDiscard={() => handleDiscard(c.id, isActive)}
          onViewNote={() => { onClose(); openExportForCard(c) }}
        />
      ))}
    </PreviewOverlay>
  )
})
