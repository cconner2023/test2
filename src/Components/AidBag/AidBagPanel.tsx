/**
 * Main inventory panel. Displays a layouts section, summary bar, category groups
 * with collapsible sections, item rows, empty state, and a FAB add button.
 */
import { memo, useMemo } from 'react'
import { Package, Plus, MapPin } from 'lucide-react'
import type { AidBagItem } from '../../Types/AidBagTypes'
import type { BagLayout } from '../../Types/BagLayoutTypes'
import { isExpired, isExpiringSoon, isLowStock } from '../../Types/AidBagTypes'
import { aidBagCategories } from '../../Data/AidBagCategories'
import { useAidBagStore } from '../../stores/useAidBagStore'
import { AidBagCategoryGroup } from './AidBagCategoryGroup'

interface AidBagPanelProps {
  items: AidBagItem[]
  isLoading: boolean
  bagLayouts: BagLayout[]
  bagLayoutsLoading: boolean
}

export const AidBagPanel = memo(function AidBagPanel({ items, isLoading, bagLayouts, bagLayoutsLoading }: AidBagPanelProps) {
  const openAddForm = useAidBagStore(s => s.openAddForm)
  const openEditForm = useAidBagStore(s => s.openEditForm)
  const collapsedCategories = useAidBagStore(s => s.collapsedCategories)
  const toggleCategory = useAidBagStore(s => s.toggleCategory)
  const categoryFilter = useAidBagStore(s => s.categoryFilter)
  const setCategoryFilter = useAidBagStore(s => s.setCategoryFilter)
  const openLayoutEditor = useAidBagStore(s => s.openLayoutEditor)

  // Summary stats
  const stats = useMemo(() => {
    const total = items.length
    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0)
    const expiredCount = items.filter(isExpired).length
    const expiringCount = items.filter(i => isExpiringSoon(i)).length
    const lowStockCount = items.filter(isLowStock).length
    const alertCount = expiredCount + expiringCount + lowStockCount
    return { total, totalQty, expiredCount, expiringCount, lowStockCount, alertCount }
  }, [items])

  // Group items by category
  const groupedItems = useMemo(() => {
    const filtered = categoryFilter
      ? items.filter(i => i.category === categoryFilter)
      : items
    const map = new Map<string, AidBagItem[]>()
    for (const item of filtered) {
      const existing = map.get(item.category) || []
      existing.push(item)
      map.set(item.category, existing)
    }
    // Sort items within each group alphabetically
    for (const [key, val] of map) {
      map.set(key, val.sort((a, b) => a.name.localeCompare(b.name)))
    }
    return map
  }, [items, categoryFilter])

  // Show layouts section when there are layouts, or when there are items (potential to create layouts)
  const showLayouts = bagLayouts.length > 0 || items.length > 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-tertiary text-sm">
        Loading inventory...
      </div>
    )
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <Package size={32} className="text-tertiary/40 mb-3" />
        <div className="text-sm font-medium text-secondary mb-1">No items in inventory</div>
        <div className="text-xs text-tertiary mb-4">
          Track your medical supplies, medications, and equipment
        </div>
        <button
          onClick={openAddForm}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-themeblue3 text-white hover:bg-themeblue2 active:scale-95 transition-all"
        >
          Add First Item
        </button>
      </div>
    )
  }

  return (
    <div className="relative pb-16">
      {/* Layouts horizontal scroll */}
      {showLayouts && (
        <div className="px-3 pt-2 pb-1">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
            {bagLayouts.map(layout => (
              <button
                key={layout.id}
                onClick={() => openLayoutEditor(layout)}
                className="relative shrink-0 w-20 h-14 rounded-lg overflow-hidden border border-tertiary/15 hover:border-themeblue3/30 transition-colors group"
              >
                <img
                  src={layout.photoData}
                  alt={layout.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-1 pb-0.5">
                  <div className="text-[8px] text-white font-medium truncate">{layout.name}</div>
                </div>
                {layout.labels.length > 0 && (
                  <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-black/50 text-white text-[8px]">
                    <MapPin size={6} />
                    {layout.labels.length}
                  </div>
                )}
              </button>
            ))}
            {/* Add layout card */}
            <button
              onClick={() => openLayoutEditor()}
              className="shrink-0 w-20 h-14 rounded-lg border-2 border-dashed border-tertiary/20 flex flex-col items-center justify-center gap-0.5 text-tertiary hover:border-themeblue3/30 hover:text-themeblue3 transition-colors"
            >
              <Plus size={14} />
              <span className="text-[8px] font-medium">Layout</span>
            </button>
          </div>
        </div>
      )}

      {/* Summary bar */}
      <div className="flex items-center gap-2 px-3 py-2 mb-1">
        <span className="text-xs text-tertiary">
          <span className="font-semibold text-secondary tabular-nums">{stats.total}</span> items
          <span className="mx-1.5 text-tertiary/30">|</span>
          <span className="font-semibold text-secondary tabular-nums">{stats.totalQty}</span> total qty
        </span>
        {stats.alertCount > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
            {stats.alertCount} alert{stats.alertCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Category filter chips */}
      <div className="flex items-center gap-1 px-3 pb-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setCategoryFilter(null)}
          className={`px-2 py-1 text-[10px] font-medium rounded-md whitespace-nowrap transition-all ${
            categoryFilter === null
              ? 'bg-themeblue3/15 text-themeblue1 border border-themeblue3/30'
              : 'text-tertiary hover:text-secondary hover:bg-themewhite2/60 border border-transparent'
          }`}
        >
          All
        </button>
        {aidBagCategories.map(cat => {
          const count = items.filter(i => i.category === cat.id).length
          if (count === 0) return null
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id === categoryFilter ? null : cat.id)}
              className={`px-2 py-1 text-[10px] font-medium rounded-md whitespace-nowrap transition-all ${
                categoryFilter === cat.id
                  ? 'bg-themeblue3/15 text-themeblue1 border border-themeblue3/30'
                  : 'text-tertiary hover:text-secondary hover:bg-themewhite2/60 border border-transparent'
              }`}
            >
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* Category groups */}
      <div className="px-1">
        {aidBagCategories.map(cat => {
          const catItems = groupedItems.get(cat.id)
          if (!catItems || catItems.length === 0) return null
          return (
            <AidBagCategoryGroup
              key={cat.id}
              category={cat}
              items={catItems}
              isCollapsed={collapsedCategories.has(cat.id)}
              onToggle={() => toggleCategory(cat.id)}
              onEditItem={openEditForm}
            />
          )
        })}
      </div>

      {/* FAB add button */}
      <button
        onClick={openAddForm}
        className="fixed bottom-6 right-6 md:absolute md:bottom-4 md:right-4 w-12 h-12 rounded-full bg-themeblue3 text-white shadow-lg hover:bg-themeblue2 active:scale-90 transition-all flex items-center justify-center z-10"
        aria-label="Add item"
      >
        <Plus size={24} />
      </button>
    </div>
  )
})
