import type { LucideIcon } from 'lucide-react'
import { useIsMobile } from '../Hooks/useIsMobile'
import { Sheet } from './Sheet'
import { Z } from './BaseOverlay'
import { Menu } from './Menu'

export interface ActionSheetOption {
  key: string
  label: string
  icon?: LucideIcon
  variant?: 'default' | 'danger'
  onAction: () => void
  /** data-tour anchor on this option's button (used by guided tours) */
  tourTag?: string
}

interface ActionSheetProps {
  visible: boolean
  title: string
  options: ActionSheetOption[]
  onClose: () => void
}

/**
 * ActionSheet — dual-mode option list: Sheet on mobile, Menu on desktop.
 * Wraps the new overlay primitives so consumers don't need to pick.
 */
export function ActionSheet({ visible, title, options, onClose }: ActionSheetProps) {
  const isMobile = useIsMobile()

  const handleOption = (option: ActionSheetOption) => {
    onClose()
    setTimeout(option.onAction, 320)
  }

  if (isMobile) {
    return (
      <Sheet isOpen={visible} onClose={onClose} title={title} hideClose zIndex={Z.MODAL}>
        <div className="px-4 pb-5 pt-2">
          {/* List-style rows — mirrors the calendar filter options (and the
              intake-form channel picker): full-bleed rows in a bordered card,
              icon + left-aligned label, divider between rows. */}
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 divide-y divide-themeblue3/10 overflow-hidden">
            {options.map((opt) => {
              const isDanger = opt.variant === 'danger'
              const Icon = opt.icon
              return (
                <button
                  key={opt.key}
                  data-tour={opt.tourTag}
                  onClick={() => handleOption(opt)}
                  className="w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:scale-95 hover:bg-secondary/5"
                >
                  {Icon && (
                    <Icon size={16} className={`shrink-0 ${isDanger ? 'text-themeredred' : 'text-themeblue2'}`} />
                  )}
                  <span className={`text-[10pt] font-medium truncate flex-1 ${isDanger ? 'text-themeredred' : 'text-primary'}`}>
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 mt-2.5 rounded-2xl text-[10pt] font-medium text-tertiary active:scale-95 transition-all hover:bg-secondary/5"
          >
            Cancel
          </button>
        </div>
      </Sheet>
    )
  }

  return <Menu isOpen={visible} onClose={onClose} title={title} options={options} />
}
