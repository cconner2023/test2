import { ChevronRight } from 'lucide-react'
import type { LocalPropertyItem } from '../../Types/PropertyTypes'

interface PropertyItemRowProps {
  item: LocalPropertyItem
  holderName?: string
  subItemCount?: number
  onTap: (item: LocalPropertyItem) => void
}

const conditionBadge: Record<string, { bg: string; text: string; label: string }> = {
  serviceable: { bg: 'bg-green-100', text: 'text-green-800', label: 'SVC' },
  unserviceable: { bg: 'bg-red-100', text: 'text-red-800', label: 'UNSVC' },
  damaged: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'DMG' },
  missing: { bg: 'bg-red-100', text: 'text-red-800', label: 'MIS' },
}

export function PropertyItemRow({ item, holderName, subItemCount, onTap }: PropertyItemRowProps) {
  const badge = conditionBadge[item.condition_code] ?? conditionBadge.serviceable

  return (
    <button
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/5 active:bg-secondary/10 transition-colors border-b border-tertiary/10"
      onClick={() => onTap(item)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-primary truncate">{item.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {item.nsn && <span className="text-xs text-tertiary">{item.nsn}</span>}
          {holderName && <span className="text-xs text-secondary truncate">{holderName}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {subItemCount != null && subItemCount > 0 && (
          <span className="text-[10px] bg-themeblue3/10 text-themeblue3 px-1.5 py-0.5 rounded-full font-medium">
            {subItemCount}
          </span>
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>
          {badge.label}
        </span>
        <ChevronRight size={16} className="text-tertiary" />
      </div>
    </button>
  )
}
