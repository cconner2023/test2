import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { BaseOverlay } from './BaseOverlay'

interface PopoverProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  footer?: ReactNode
  maxWidth?: number
  className?: string
}

export function PopoverHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-5">
      <span className="text-sm font-medium text-primary">{title}</span>
      <button
        onClick={onClose}
        className="text-tertiary/50 hover:text-tertiary transition-colors p-0.5"
        aria-label="Close"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export function Popover({ isOpen, onClose, children, title, footer, maxWidth = 320, className }: PopoverProps) {
  return (
    <BaseOverlay isOpen={isOpen} onClose={onClose} backdrop="subtle" zIndex={60}>
      {(visible) => (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none px-6">
          <div
            className={`w-full flex flex-col items-start gap-2 pointer-events-auto transition-all duration-300 ${
              visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
            style={{
              maxWidth,
              transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            {/* Card */}
            <div className={`w-full bg-themewhite rounded-2xl shadow-2xl overflow-hidden ${className ?? ''}`}>
              {title && <PopoverHeader title={title} onClose={onClose} />}
              {children}
            </div>

            {/* Footer — separate from card, same as CMP action pill */}
            {footer && (
              <div className="flex items-center gap-1 px-1.5 py-2 bg-themewhite rounded-2xl shadow-lg">
                {footer}
              </div>
            )}
          </div>
        </div>
      )}
    </BaseOverlay>
  )
}
