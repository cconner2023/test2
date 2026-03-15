import type { LucideIcon } from 'lucide-react'
import { useSwipeGesture } from '../Hooks/useSwipeGesture'

export interface SwipeAction {
  key: string
  label: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  onAction: () => void
}

interface SwipeableCardProps {
  children: React.ReactNode
  actions: SwipeAction[]
  isOpen: boolean
  enabled: boolean
  onOpen: () => void
  onClose: () => void
  onTap?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onLongPress?: (x: number, y: number) => void
}

const ACTION_WIDTHS: Record<number, number> = { 1: 72, 2: 104, 3: 156 }

export function SwipeableCard({
  children,
  actions,
  isOpen,
  enabled,
  onOpen,
  onClose,
  onTap,
  onContextMenu,
  onLongPress,
}: SwipeableCardProps) {
  const actionWidth = ACTION_WIDTHS[actions.length] ?? 156

  // When disabled with no actions, render children directly (simple mode)
  if (!enabled && actions.length === 0) {
    return <>{children}</>
  }

  const swipeEnabled = enabled && actions.length > 0

  const { rowRef, handlers } = useSwipeGesture({
    actionWidth,
    isOpen,
    enabled: swipeEnabled,
    onOpen,
    onClose,
    onTap,
    onLongPress,
  })

  if (!swipeEnabled) {
    return (
      <div onClick={() => onTap?.()} onContextMenu={onContextMenu} style={{ cursor: 'pointer' }}>
        {children}
      </div>
    )
  }

  const handleSwipeAction = (action: () => void) => {
    onClose()
    action()
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe action icons — revealed on drag */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-evenly gap-1 px-2"
        style={{ width: actionWidth }}
      >
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.key}
              onClick={() => handleSwipeAction(action.onAction)}
              className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${action.iconBg}`}>
                <Icon size={18} className={action.iconColor} />
              </div>
              <span className="text-[9pt] font-medium text-tertiary/60">{action.label}</span>
            </button>
          )
        })}
      </div>

      {/* Swipeable card layer */}
      <div
        ref={rowRef}
        {...handlers}
        onContextMenu={onContextMenu}
        className="relative"
        style={{ touchAction: 'pan-y', cursor: 'pointer' }}
      >
        {children}
      </div>
    </div>
  )
}
