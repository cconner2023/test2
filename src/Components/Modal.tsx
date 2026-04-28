import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { BaseOverlay, Z } from './BaseOverlay'
import { useIsMobile } from '../Hooks/useIsMobile'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  /** Optional title rendered in the header row alongside the close X. */
  title?: string
  /** Card max width on desktop (number = px, string = CSS value). Default 400. */
  maxWidth?: number | string
  /** Card max height on mobile bottom-sheet variant. Default '60dvh'. */
  mobileMaxHeight?: string
  /** Hide the header X button when the consumer renders its own close affordance. */
  hideClose?: boolean
  zIndex?: number
  children: ReactNode
}

/**
 * Modal — centered card on desktop, bottom-sheet on mobile.
 * Card chrome: bg-themewhite rounded-2xl shadow-2xl border-tertiary/10.
 * Replaces ad-hoc dual-mode patterns in ConfirmDialog, ProvisionalDeviceModal, etc.
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

  return (
    <BaseOverlay isOpen={isOpen} onClose={onClose} zIndex={zIndex}>
      {(open, baseZ) => {
        if (isMobile) {
          return (
            <div
              className={`fixed left-0 right-0 bottom-0 bg-themewhite rounded-t-2xl shadow-xl flex flex-col transition-transform duration-300 ease-out`}
              style={{
                zIndex: baseZ + 1,
                maxHeight: mobileMaxHeight,
                transform: open ? 'translateY(0)' : 'translateY(100%)',
              }}
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
          )
        }

        return (
          <div
            className="fixed inset-0 flex items-center justify-center pointer-events-none px-6"
            style={{ zIndex: baseZ + 1 }}
          >
            <div
              className={`pointer-events-auto w-full bg-themewhite rounded-2xl shadow-2xl border border-tertiary/10 flex flex-col transition-all duration-300 ease-out ${
                open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
              style={{ maxWidth: typeof maxWidth === 'number' ? maxWidth : maxWidth, maxHeight: '85dvh' }}
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
        )
      }}
    </BaseOverlay>
  )
}
