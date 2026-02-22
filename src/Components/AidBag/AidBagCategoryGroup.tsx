/**
 * Collapsible category group in the inventory.
 * Shows category icon + label + item count badge, with chevron toggle.
 */
import { memo } from 'react'
import {
  Wind, Activity, Heart, Pill, Cross, Wrench, Syringe,
  MonitorCheck, Thermometer, Package, HelpCircle,
} from 'lucide-react'
import type { AidBagCategory, AidBagItem } from '../../Types/AidBagTypes'
import { AidBagItemRow } from './AidBagItemRow'

/** Map category icon names to lucide components */
const categoryIconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Wind, Activity, Heart, Pill, Cross, Wrench, Syringe,
  MonitorCheck, Thermometer, Package,
}

interface AidBagCategoryGroupProps {
  category: AidBagCategory
  items: AidBagItem[]
  isCollapsed: boolean
  onToggle: () => void
  onEditItem: (item: AidBagItem) => void
}

export const AidBagCategoryGroup = memo(function AidBagCategoryGroup({
  category,
  items,
  isCollapsed,
  onToggle,
  onEditItem,
}: AidBagCategoryGroupProps) {
  if (items.length === 0) return null

  const IconComponent = categoryIconMap[category.icon] || HelpCircle

  return (
    <div className="mb-1">
      {/* Group header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-themewhite2/60 active:scale-[0.99] transition-all"
        onClick={onToggle}
      >
        <IconComponent size={14} className="text-tertiary shrink-0" />
        <span className="text-xs font-semibold text-secondary uppercase tracking-wide flex-1 text-left">
          {category.label}
        </span>
        <span className="text-[10px] font-semibold text-tertiary bg-themewhite2 rounded-full px-1.5 py-0.5 tabular-nums">
          {items.length}
        </span>
        <svg
          className={`w-4 h-4 text-tertiary transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Items list */}
      {!isCollapsed && (
        <div className="ml-2 border-l border-tertiary/10 pl-1">
          {items.map(item => (
            <AidBagItemRow key={item.id} item={item} onEdit={onEditItem} />
          ))}
        </div>
      )}
    </div>
  )
})
