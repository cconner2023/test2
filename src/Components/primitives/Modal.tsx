import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { BaseOverlay, Z } from '@/Components/primitives/BaseOverlay'
import { Sheet } from '@/Components/primitives/Sheet'
import { useIsMobile } from '@/Hooks/useIsMobile'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  /** Optional title rendered in the header row alongside the close X. */
  title?: string
  /** Card max width on desktop (number = px, string = CSS value). Default 400. */
  maxWidth?: number | string
  /** Card max height on the mobile sheet. Accepts 'auto' (hug content up to the
   *  Sheet's own cap) or a viewport-unit string like '60dvh'. Default '60dvh'. */
  mobileMaxHeight?: string
  /** Hide the header X button when the consumer renders its own close affordance. */
  hideClose?: boolean
  zIndex?: number
  children: ReactNode
}

/** Sheet takes a NUMBER of svh; Modal's legacy prop is a CSS string. 'auto' means
 *  "hug the content", which is exactly the Sheet's default 90 cap. Anything
 *  unparseable falls back to that same cap rather than collapsing the card. */
function toSheetMaxHeight(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 90
}

/**
 * Modal — centered card on desktop, Sheet on mobile.
 *
 * There is ONE bottom-sheet surface in this app and it is `Sheet`. Modal used to
 * hand-roll its own mobile branch, which drifted: no drag-to-dismiss, dvh instead
 * of svh (so the iOS keyboard collapsed it on input focus), no bottom safe area,
 * and a flex-shrink scroll body under a max-height-only parent — the exact pattern
 * iOS Safari refuses to make scrollable, so long content got clipped. Delegating
 * fixed all four at once. Do not reintroduce a second mobile card here.
 *
 * Desktop card chrome: bg-themewhite3 rounded-2xl surface-shadow, borderless —
 * separation is bg-vs-scrim contrast, not an outline (see App.css ELEVATION).
 */
export function Modal({
  isOpen,
  onClose,
  title,
  maxWidth = 400,
  mobileMaxHeight = '60dvh',
  hideClose,
  zIndex = Z.MODAL,
  children,
}: ModalProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        hideClose={hideClose}
        maxHeight={toSheetMaxHeight(mobileMaxHeight)}
        zIndex={zIndex}
      >
        {children}
      </Sheet>
    )
  }

  return (
    <BaseOverlay isOpen={isOpen} onClose={onClose} zIndex={zIndex}>
      {(open, baseZ) => (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none px-6"
          style={{ zIndex: baseZ + 1 }}
        >
          <div
            className={`pointer-events-auto w-full bg-themewhite3 rounded-2xl surface-shadow flex flex-col transition-all duration-300 ease-out ${
              open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
            style={{ maxWidth, maxHeight: '85dvh' }}
            role="dialog"
            aria-modal="true"
          >
            {(title || !hideClose) && (
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-primary/6">
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
        </div>
      )}
    </BaseOverlay>
  )
}
