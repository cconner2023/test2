import type { LucideIcon } from 'lucide-react'
import { useIsMobile } from '../Hooks/useIsMobile'
import { BottomSheet } from './BottomSheet'
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
 * ActionSheet — dual-mode option list: BottomSheet on mobile, Menu on desktop.
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
      <BottomSheet isOpen={visible} onClose={onClose} title={title} maxHeight="40dvh" hideClose zIndex={Z.MODAL}>
        <div className="px-5 pb-5 pt-3 flex flex-col gap-2.5">
          {options.map((opt) => {
            const isDanger = opt.variant === 'danger'
            return (
              <button
                key={opt.key}
                data-tour={opt.tourTag}
                onClick={() => handleOption(opt)}
                className={`w-full py-3 rounded-full text-[11pt] font-medium active:scale-95 transition-all ${
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
            onClick={onClose}
            className="w-full py-3 rounded-full text-[11pt] font-medium text-tertiary active:scale-95 transition-all"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>
    )
  }

  return <Menu isOpen={visible} onClose={onClose} title={title} options={options} />
}
