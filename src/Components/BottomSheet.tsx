import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { BaseOverlay, Z } from './BaseOverlay'
import { useOverlay } from '../Hooks/useOverlay'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  /** Optional title rendered in the header row. */
  title?: string
  /** Max height of the sheet. Default '60dvh'. */
  maxHeight?: string
  /** Show the drag handle at top + enable drag-to-dismiss. Default true. */
  draggable?: boolean
  /** Hide the header X button when the consumer renders its own close affordance. */
  hideClose?: boolean
  zIndex?: number
  children: ReactNode
}

/**
 * BottomSheet — slides up from the bottom of the viewport.
 * Card chrome: bg-themewhite rounded-t-2xl shadow-xl.
 * Replaces ad-hoc bottom-drawer patterns in KBOverlay, mobile ActionSheet, etc.
 */
export function BottomSheet({
  isOpen,
  onClose,
  title,
  maxHeight = '60dvh',
  draggable = true,
  hideClose,
  zIndex = Z.SHEET,
  children,
}: BottomSheetProps) {
  const { dragY, isDragging, touchHandlers } = useOverlay(isOpen, onClose)

  return (
    <BaseOverlay isOpen={isOpen} onClose={onClose} zIndex={zIndex}>
      {(open) => (
        <div
          className={`fixed left-0 right-0 bottom-0 bg-themewhite rounded-t-2xl shadow-xl flex flex-col ${
            isDragging ? '' : 'transition-transform duration-300 ease-out'
          }`}
          style={{
            zIndex: zIndex + 1,
            maxHeight,
            transform: open ? `translateY(${draggable ? dragY : 0}px)` : 'translateY(100%)',
          }}
          role="dialog"
          aria-modal="true"
          {...(draggable ? touchHandlers : {})}
        >
          {draggable && (
            <div className="flex justify-center pt-2 pb-1" data-drag-zone style={{ touchAction: 'none' }}>
              <div className="w-9 h-1 rounded-full bg-tertiary/25" />
            </div>
          )}
          {(title || !hideClose) && (
            <div className="flex items-center justify-between px-4 pt-1 pb-2 border-b border-primary/6">
              <span className="text-sm font-medium text-primary">{title}</span>
              {!hideClose && (
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}
          <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
        </div>
      )}
    </BaseOverlay>
  )
}
