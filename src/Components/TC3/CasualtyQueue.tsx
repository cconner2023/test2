import { memo } from 'react'
import { Trash2, RotateCcw, UserPlus } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionButton } from '../ActionButton'
import type { TC3Card, TC3QueueEntry } from '../../Types/TC3Types'

const PRIORITY_COLOR: Record<string, string> = {
  Urgent: 'bg-themeredred',
  Priority: 'bg-amber-500',
  Routine: 'bg-themegreen',
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch { return '' }
}

function casualtyName(card: TC3Card): string {
  return [card.casualty.lastName, card.casualty.firstName].filter(Boolean).join(', ') || 'Unknown'
}

/** Active card row — highlighted, discard action to advance/clear */
function ActiveRow({ card, onDiscard }: { card: TC3Card; onDiscard: () => void }) {
  const priority = card.evacuation.priority
  const dotColor = priority ? PRIORITY_COLOR[priority] : 'bg-themeblue2'

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-themeblue2/6 border-b border-tertiary/8">
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-themeblue2/30 ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{casualtyName(card)}</p>
      </div>
      <div
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <ActionButton icon={Trash2} label="Discard active" onClick={onDiscard} variant="danger" />
      </div>
    </div>
  )
}

/** Queued row — tap anywhere to restore */
function QueuedRow({
  entry,
  onRestore,
  onDiscard,
}: {
  entry: TC3QueueEntry
  onRestore: () => void
  onDiscard: () => void
}) {
  const { card, queuedAt } = entry
  const priority = card.evacuation.priority
  const dotColor = priority ? PRIORITY_COLOR[priority] : 'bg-tertiary/30'

  return (
    <button
      type="button"
      onClick={onRestore}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-tertiary/8 last:border-0 hover:bg-themeblue2/4 active:bg-themeblue2/8 transition-colors text-left"
    >
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{casualtyName(card)}</p>
        <p className="text-[9pt] text-secondary mt-0.5">{formatTime(queuedAt)}</p>
      </div>
      <div
        className="flex items-center gap-1.5 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <ActionButton icon={RotateCcw} label="Restore" onClick={onRestore} />
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

  const handleRestore = (cardId: string) => {
    restoreFromQueue(cardId)
    onClose()
  }

  const handleDiscardActive = () => {
    discardActive()
    onClose()
  }

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={null}
      title="Casualty Queue"
      maxWidth={320}
      previewMaxHeight="50dvh"
      actions={[
        { key: 'new', label: 'New Casualty', icon: UserPlus, onAction: pushToQueue, closesOnAction: true },
      ]}
    >
      <ActiveRow card={card} onDiscard={handleDiscardActive} />
      {casualtyQueue.map((entry) => (
        <QueuedRow
          key={entry.card.id}
          entry={entry}
          onRestore={() => handleRestore(entry.card.id)}
          onDiscard={() => discardFromQueue(entry.card.id)}
        />
      ))}
    </PreviewOverlay>
  )
})
