import { Check, Eye, ArrowRightLeft, Trash2 } from 'lucide-react'
import { SwipeableCard, type SwipeAction } from '../SwipeableCard'
import type { LocalPropertyItem } from '../../Types/PropertyTypes'

interface PropertyItemRowProps {
  item: LocalPropertyItem
  holderName?: string
  subItemCount?: number
  isSelected?: boolean
  isOpen?: boolean
  multiSelectMode?: boolean
  onOpen?: () => void
  onClose?: () => void
  onTap?: () => void
  onView?: () => void
  onTransfer?: () => void
  onDelete?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onToggleSelect?: () => void
}

const conditionBadge: Record<string, { bg: string; text: string; label: string }> = {
  serviceable: { bg: 'bg-themegreen/10', text: 'text-themegreen', label: 'SVC' },
  unserviceable: { bg: 'bg-themeredred/10', text: 'text-themeredred', label: 'UNSVC' },
  damaged: { bg: 'bg-themeyellow/10', text: 'text-themeyellow', label: 'DMG' },
  missing: { bg: 'bg-themeredred/10', text: 'text-themeredred', label: 'MIS' },
}

export function PropertyItemRow({
  item,
  holderName,
  subItemCount,
  isSelected = false,
  isOpen = false,
  multiSelectMode = false,
  onOpen,
  onClose,
  onTap,
  onView,
  onTransfer,
  onDelete,
  onContextMenu,
  onToggleSelect,
}: PropertyItemRowProps) {
  const badge = conditionBadge[item.condition_code] ?? conditionBadge.serviceable
  const swipeEnabled = !!(onOpen && onClose)

  const actions: SwipeAction[] = (onView && onTransfer && onDelete) ? [
    { key: 'view', label: 'View', icon: Eye, iconBg: 'bg-themegreen/15', iconColor: 'text-themegreen', onAction: onView },
    { key: 'transfer', label: 'Transfer', icon: ArrowRightLeft, iconBg: 'bg-themeblue2/15', iconColor: 'text-themeblue2', onAction: onTransfer },
    { key: 'delete', label: 'Delete', icon: Trash2, iconBg: 'bg-themeredred/15', iconColor: 'text-themeredred', onAction: onDelete },
  ] : []

  const handleTap = () => {
    if (multiSelectMode) { onToggleSelect?.(); return }
    onTap?.()
  }

  const cardContent = (
    <>
      {isSelected && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-themeblue2 shrink-0">
          <Check size={14} className="text-white" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-primary truncate">{item.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {item.nsn && <span className="text-xs text-tertiary">{item.nsn}</span>}
          {holderName && <span className="text-xs text-secondary truncate">{holderName}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {(item.quantity ?? 1) > 1 && (
          <span className="text-[9pt] bg-themeblue3/10 text-themeblue3 px-1.5 py-0.5 rounded-full font-medium">
            x{item.quantity}
          </span>
        )}
        {subItemCount != null && subItemCount > 0 && (
          <span className="text-[9pt] bg-themeblue3/10 text-themeblue3 px-1.5 py-0.5 rounded-full font-medium">
            {subItemCount}
          </span>
        )}
        <span className={`text-[9pt] px-1.5 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>
          {badge.label}
        </span>
      </div>
    </>
  )

  // Simple mode: plain clickable row (no swipe)
  if (!swipeEnabled) {
    return (
      <div
        onClick={() => onTap?.()}
        className={`flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/5 active:bg-secondary/10 transition-colors border-b border-tertiary/10 cursor-pointer
          ${isSelected ? 'ring-1 ring-inset ring-themeblue2/30 bg-themeblue2/5' : ''}`}
      >
        {cardContent}
      </div>
    )
  }

  // Full mode: swipeable card
  return (
    <SwipeableCard
      actions={actions}
      isOpen={isOpen}
      enabled={!multiSelectMode && swipeEnabled}
      onOpen={onOpen!}
      onClose={onClose!}
      onTap={handleTap}
      onContextMenu={onContextMenu}
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-tertiary/10 bg-themewhite3
          ${isSelected ? 'ring-1 ring-inset ring-themeblue2/30 bg-themeblue2/5' : ''}`}
      >
        {cardContent}
      </div>
    </SwipeableCard>
  )
}
