/* Modal tokens: bg-themewhite rounded-2xl shadow-2xl border-tertiary/10 z-70. Ref: ProvisionalDeviceModal */
import { useIsMobile } from '../Hooks/useIsMobile'
import { useOverlay } from '../Hooks/useOverlay'
import type { LucideIcon } from 'lucide-react'

export interface ActionSheetOption {
  key: string
  label: string
  icon?: LucideIcon
  variant?: 'default' | 'danger'
  onAction: () => void
}

interface ActionSheetProps {
  visible: boolean
  title: string
  options: ActionSheetOption[]
  onClose: () => void
}

export function ActionSheet({ visible, title, options, onClose }: ActionSheetProps) {
  const isMobile = useIsMobile()
  const { mounted, open, dragY, isDragging, close, touchHandlers } = useOverlay(visible, onClose)

  if (!mounted) return null

  const handleOption = (option: ActionSheetOption) => {
    close()
    setTimeout(option.onAction, 320)
  }

  if (isMobile) {
    return (
      <>
        <div
          className={`fixed inset-0 z-50 bg-black transition-opacity duration-300 ${open ? 'opacity-40' : 'opacity-0'}`}
          style={{ pointerEvents: open ? 'auto' : 'none' }}
          onClick={close}
        />
        <div
          className={`fixed left-0 right-0 bottom-0 z-50 bg-themewhite3 rounded-t-[1.25rem] ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
          style={{
            transform: open ? `translateY(${dragY}px)` : 'translateY(100%)',
            maxHeight: '40dvh',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="action-sheet-title"
          {...touchHandlers}
        >
          <div className="flex justify-center pt-2 pb-1" data-drag-zone style={{ touchAction: 'none' }}>
            <div className="w-9 h-1 rounded-full bg-tertiary/25" />
          </div>

          <div className="px-5 pb-5 flex flex-col">
            <h2 id="action-sheet-title" className="text-lg font-medium text-primary mb-4">
              {title}
            </h2>

            <div className="flex flex-col gap-2.5">
              {options.map((opt) => {
                const isDanger = opt.variant === 'danger'
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleOption(opt)}
                    className={`w-full py-3 rounded-lg text-[11pt] font-medium active:scale-95 transition-all ${
                      isDanger
                        ? 'bg-themeredred/10 text-themeredred'
                        : 'bg-themeblue3 text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
              <button
                onClick={close}
                className="w-full py-3 rounded-lg text-[11pt] font-medium text-tertiary active:scale-95 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  /* Desktop: dropdown-style menu */
  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black transition-opacity duration-300 ${open ? 'opacity-15' : 'opacity-0'}`}
        style={{ pointerEvents: open ? 'auto' : 'none' }}
        onClick={close}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className={`bg-themewhite2 rounded-xl shadow-lg border border-primary/10 py-1.5 min-w-[200px] max-w-[260px] w-full pointer-events-auto transition-all duration-200 ease-out ${open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="action-sheet-title"
        >
          <p id="action-sheet-title" className="px-3.5 py-1.5 text-[10pt] font-medium text-tertiary uppercase tracking-wider">
            {title}
          </p>

          {options.map((opt) => {
            const isDanger = opt.variant === 'danger'
            const Icon = opt.icon
            return (
              <button
                key={opt.key}
                onClick={() => handleOption(opt)}
                className={`flex items-center gap-2.5 w-full px-3.5 py-2 text-sm hover:bg-primary/5 active:bg-primary/10 transition-colors ${
                  isDanger ? 'text-themeredred' : 'text-primary'
                }`}
              >
                {Icon && (
                  <Icon size={14} className={isDanger ? 'text-themeredred/60' : 'text-tertiary'} />
                )}
                {opt.label}
              </button>
            )
          })}
          <div className="h-px bg-tertiary/10 mx-2.5 my-1" />
          <button
            onClick={close}
            className="flex items-center w-full px-3.5 py-2 text-sm text-tertiary hover:bg-primary/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
