import { useState, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { PropertyItemRow } from './PropertyItemRow'
import { useDA2062Export } from '../../Hooks/useDA2062Export'
import type { LocalPropertyItem, HolderInfo } from '../../Types/PropertyTypes'

interface HandReceiptViewProps {
  items: LocalPropertyItem[]
  holders: Map<string, HolderInfo>
  currentUserId: string | null
  onSelectItem: (item: LocalPropertyItem) => void
}

export function HandReceiptView({ items, holders, currentUserId, onSelectItem }: HandReceiptViewProps) {
  const { exportDA2062, status: exportStatus } = useDA2062Export()
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [hrNumber, setHrNumber] = useState('')
  const [exportingHolder, setExportingHolder] = useState<string | null>(null)

  // Group items by current_holder_id
  const grouped = useMemo(() => {
    const groups = new Map<string, LocalPropertyItem[]>()
    for (const item of items) {
      const key = item.current_holder_id || 'unassigned'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    }
    // Sort: current user first, then by holder name, unassigned last
    const entries = Array.from(groups.entries())
    entries.sort(([a], [b]) => {
      if (a === currentUserId) return -1
      if (b === currentUserId) return 1
      if (a === 'unassigned') return 1
      if (b === 'unassigned') return -1
      const nameA = holders.get(a)?.displayName ?? ''
      const nameB = holders.get(b)?.displayName ?? ''
      return nameA.localeCompare(nameB)
    })
    return entries
  }, [items, holders, currentUserId])

  const toggleSection = useCallback((holderId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(holderId)) next.delete(holderId)
      else next.add(holderId)
      return next
    })
  }, [])

  const subItemCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      if (item.parent_item_id) {
        counts.set(item.parent_item_id, (counts.get(item.parent_item_id) ?? 0) + 1)
      }
    }
    return counts
  }, [items])

  const handleExport = useCallback(async (holderId: string, holderItems: LocalPropertyItem[]) => {
    const toHolder = holders.get(holderId)
    if (!toHolder) return

    const fromHolder: HolderInfo = {
      id: 'hrh',
      rank: null,
      firstName: null,
      lastName: null,
      displayName: 'Hand Receipt Holder',
    }

    setExportingHolder(holderId)
    await exportDA2062({
      items: holderItems.filter((i) => !i.parent_item_id), // top-level only
      fromHolder,
      toHolder,
      handReceiptNumber: hrNumber || 'N/A',
      date: new Date().toLocaleDateString(),
    })
    setExportingHolder(null)
  }, [holders, hrNumber, exportDA2062])

  return (
    <div className="flex flex-col">
      {/* HR Number input */}
      <div className="px-4 py-2 flex items-center gap-2">
        <label className="text-xs font-medium text-tertiary shrink-0">HR#</label>
        <input
          type="text"
          value={hrNumber}
          onChange={(e) => setHrNumber(e.target.value)}
          placeholder="Hand receipt number"
          className="flex-1 px-2 py-1 text-sm rounded border border-tertiary/20 bg-themewhite text-primary placeholder:text-tertiary/50 focus:outline-none focus:border-themeblue3/50"
        />
      </div>

      {grouped.map(([holderId, holderItems]) => {
        const holder = holders.get(holderId)
        const holderName = holderId === 'unassigned' ? 'Unassigned' : holder?.displayName ?? 'Unknown'
        const isCollapsed = collapsedSections.has(holderId)
        const topLevelItems = holderItems.filter((i) => !i.parent_item_id)

        return (
          <div key={holderId} className="border-b border-tertiary/10">
            {/* Section header */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/5"
              onClick={() => toggleSection(holderId)}
            >
              {isCollapsed ? <ChevronRight size={16} className="text-tertiary" /> : <ChevronDown size={16} className="text-tertiary" />}
              <span className={`text-sm font-medium ${holderId === currentUserId ? 'text-themeblue3' : 'text-primary'}`}>
                {holderName}
              </span>
              <span className="text-xs text-tertiary ml-auto">{topLevelItems.length} items</span>
              {holderId !== 'unassigned' && (
                <button
                  className="ml-2 p-1 rounded hover:bg-secondary/10 text-tertiary hover:text-themeblue3"
                  onClick={(e) => { e.stopPropagation(); handleExport(holderId, holderItems) }}
                  title="Generate DA 2062"
                >
                  <FileText size={14} />
                </button>
              )}
            </button>

            {/* Items */}
            {!isCollapsed && (
              <div>
                {topLevelItems.map((item) => (
                  <PropertyItemRow
                    key={item.id}
                    item={item}
                    holderName={holderName}
                    subItemCount={subItemCounts.get(item.id)}
                    onTap={onSelectItem}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {grouped.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-tertiary">
          No items in property book
        </div>
      )}
    </div>
  )
}
