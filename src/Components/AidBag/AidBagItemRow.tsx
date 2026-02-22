/**
 * Single item row in the aid bag inventory list.
 * Displays name, quantity+unit, photo thumbnail, and status badges (expired, expiring, low stock).
 */
import { memo } from 'react'
import type { AidBagItem } from '../../Types/AidBagTypes'
import { isExpired, isExpiringSoon, isLowStock } from '../../Types/AidBagTypes'

interface AidBagItemRowProps {
  item: AidBagItem
  onEdit: (item: AidBagItem) => void
}

export const AidBagItemRow = memo(function AidBagItemRow({ item, onEdit }: AidBagItemRowProps) {
  const expired = isExpired(item)
  const expiringSoon = !expired && isExpiringSoon(item)
  const lowStock = isLowStock(item)

  return (
    <button
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-themewhite2/80 active:scale-[0.99] transition-all text-left group"
      onClick={() => onEdit(item)}
    >
      {/* Photo thumbnail */}
      {item.itemPhoto && (
        <img
          src={item.itemPhoto}
          alt=""
          className="w-8 h-8 rounded-md object-cover shrink-0 border border-tertiary/10"
        />
      )}

      {/* Name + location */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-primary truncate">{item.name}</div>
        {item.location && (
          <div className="text-xs text-tertiary truncate">{item.location}</div>
        )}
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-1.5 shrink-0">
        {expired && (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-500/15 text-red-600 dark:text-red-400">
            EXP
          </span>
        )}
        {expiringSoon && (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
            EXP SOON
          </span>
        )}
        {lowStock && (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
            LOW
          </span>
        )}
      </div>

      {/* Quantity */}
      <div className="text-sm font-semibold text-secondary tabular-nums shrink-0">
        {item.quantity}<span className="text-xs text-tertiary font-normal ml-0.5">{item.unit}</span>
      </div>

      {/* Chevron */}
      <svg className="w-4 h-4 text-tertiary/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
})
