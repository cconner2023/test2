import type { LucideIcon } from 'lucide-react'

export interface ActionBarAction {
  key: string
  label: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  onAction: () => void
}

interface CardActionBarProps {
  selectedCount: number
  onClear: () => void
  actions: ActionBarAction[]
}

export function CardActionBar({ selectedCount, onClear, actions }: CardActionBarProps) {
  return (
    <div className="sticky bottom-0 shrink-0 px-4 py-3 border-t border-primary/10 bg-themewhite">
      <div className="flex items-center justify-between">
        <button
          onClick={onClear}
          className="text-xs text-tertiary hover:text-primary transition-colors"
        >
          {selectedCount} selected — Clear
        </button>
        <div className="flex items-center gap-4">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.key}
                onClick={action.onAction}
                className="flex flex-col items-center gap-0.5 active:scale-95 transition-all"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${action.iconBg}`}>
                  <Icon size={18} className={action.iconColor} />
                </div>
                <span className="text-[9pt] font-medium text-tertiary">{action.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
