import type { LucideIcon } from 'lucide-react'
import { BaseOverlay, Z } from './BaseOverlay'

export interface MenuOption {
  key: string
  label: string
  icon?: LucideIcon
  variant?: 'default' | 'danger'
  onAction: () => void
  /** data-tour anchor on this option's button (used by guided tours) */
  tourTag?: string
}

interface MenuProps {
  isOpen: boolean
  onClose: () => void
  /** Optional uppercase title shown above the option list. */
  title?: string
  options: MenuOption[]
  /** Show a Cancel row at the bottom. Default true. */
  showCancel?: boolean
  cancelLabel?: string
  /** Card max width. Default 260. */
  maxWidth?: number
  zIndex?: number
}

/**
 * Menu — desktop-style dropdown / option list, centered.
 * Card chrome: bg-themewhite rounded-2xl shadow-lg border-primary/10.
 * Each option is a row matching the form-input row pattern (px-4 py-3, border-b last:border-b-0).
 */
export function Menu({
  isOpen,
  onClose,
  title,
  options,
  showCancel = true,
  cancelLabel = 'Cancel',
  maxWidth = 260,
  zIndex = Z.MODAL,
}: MenuProps) {
  const handleOption = (opt: MenuOption) => {
    onClose()
    setTimeout(opt.onAction, 320)
  }

  return (
    <BaseOverlay isOpen={isOpen} onClose={onClose} zIndex={zIndex}>
      {(open) => (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none px-6"
          style={{ zIndex: zIndex + 1 }}
        >
          <div
            className={`pointer-events-auto w-full bg-themewhite rounded-2xl shadow-lg border border-primary/10 overflow-hidden transition-all duration-200 ease-out ${
              open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
            }`}
            style={{ maxWidth }}
            role="menu"
            aria-modal="true"
          >
            {title && (
              <p className="px-4 pt-3 pb-2 text-[9pt] font-semibold text-tertiary uppercase tracking-widest border-b border-primary/6">
                {title}
              </p>
            )}
            {options.map((opt) => {
              const isDanger = opt.variant === 'danger'
              const Icon = opt.icon
              return (
                <button
                  key={opt.key}
                  data-tour={opt.tourTag}
                  onClick={() => handleOption(opt)}
                  role="menuitem"
                  className={`flex items-center gap-3 w-full px-4 py-3 text-base md:text-sm border-b border-primary/6 last:border-b-0 hover:bg-primary/5 active:bg-primary/10 transition-colors ${
                    isDanger ? 'text-themeredred' : 'text-primary'
                  }`}
                >
                  {Icon && <Icon size={16} className={isDanger ? 'text-themeredred/70' : 'text-tertiary'} />}
                  <span className="flex-1 text-left">{opt.label}</span>
                </button>
              )
            })}
            {showCancel && (
              <button
                onClick={onClose}
                className="flex items-center w-full px-4 py-3 text-base md:text-sm text-tertiary border-t border-primary/6 hover:bg-primary/5 transition-colors"
              >
                {cancelLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </BaseOverlay>
  )
}
