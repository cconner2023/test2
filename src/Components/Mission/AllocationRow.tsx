import { X } from 'lucide-react'
import type { ResourceAllocation } from '../../Types/MissionTypes'
import { ALLOCATION_ROLE_LABELS } from '../../Types/MissionTypes'
import type { PropertyItem } from '../../Types/PropertyTypes'

interface AllocationRowProps {
  allocation: ResourceAllocation & { resolvedItem?: PropertyItem }
  waypointLabel?: string
  personnelName?: string
  onRemove: (itemId: string) => void
  onEdit: (itemId: string) => void
}

export function AllocationRow({
  allocation,
  waypointLabel,
  personnelName,
  onRemove,
  onEdit,
}: AllocationRowProps) {
  const itemName =
    allocation.resolvedItem?.name ??
    allocation.resolvedItem?.nomenclature ??
    allocation.item_id

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-themeblue3/10 bg-themewhite dark:bg-themewhite3 group">
      {/* Item name */}
      <button
        type="button"
        onClick={() => onEdit(allocation.item_id)}
        className="flex-1 min-w-0 text-left"
      >
        <span className="text-[10pt] font-semibold text-primary truncate block">
          {itemName}
        </span>
        {personnelName && (
          <span className="text-[9pt] text-tertiary truncate block mt-0.5">
            {personnelName}
          </span>
        )}
      </button>

      {/* Chips */}
      <div className="flex items-center gap-1 shrink-0">
        {waypointLabel && (
          <span className="px-2 py-0.5 rounded-full bg-themeblue3/10 text-[9pt] font-medium text-themeblue2 uppercase tracking-widest whitespace-nowrap">
            {waypointLabel}
          </span>
        )}
        <span className="px-2 py-0.5 rounded-full bg-themegreen/10 text-[9pt] font-medium text-themegreen uppercase tracking-widest whitespace-nowrap">
          {ALLOCATION_ROLE_LABELS[allocation.role]}
        </span>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(allocation.item_id)}
        className="shrink-0 p-1 rounded-full text-tertiary hover:text-themeredred hover:bg-themeredred/10 transition-colors"
        aria-label="Remove allocation"
      >
        <X size={12} />
      </button>
    </div>
  )
}
