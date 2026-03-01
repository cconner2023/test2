import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, List, MapPin, AlertTriangle, Search, ArrowLeft } from 'lucide-react'
import { useProperty } from '../../Hooks/useProperty'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuth } from '../../Hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { PropertyItemRow } from './PropertyItemRow'
import { PropertyItemDetail } from './PropertyItemDetail'
import { PropertyItemForm } from './PropertyItemForm'
import { PropertySearch } from './PropertySearch'
import { HandReceiptView } from './HandReceiptView'
import { PropertyLocationMap } from './PropertyLocationMap'
import { CustodyTransferForm } from './CustodyTransferForm'
import { DiscrepancyList } from './DiscrepancyList'
import type { LocalPropertyItem, HolderInfo } from '../../Types/PropertyTypes'

type Tab = 'list' | 'hand-receipt' | 'location-map' | 'discrepancies'

export function PropertyPanel() {
  const { user } = useAuth()
  const property = useProperty()
  const store = usePropertyStore()
  const [activeTab, setActiveTab] = useState<Tab>('list')
  const [holders, setHolders] = useState<Map<string, HolderInfo>>(new Map())
  const [clinicMembers, setClinicMembers] = useState<HolderInfo[]>([])
  const [showSearch, setShowSearch] = useState(false)

  // Load clinic members for holder display names and transfer picker
  useEffect(() => {
    if (!property.clinicId) return
    supabase
      .from('profiles')
      .select('id, rank, first_name, last_name')
      .eq('clinic_id', property.clinicId)
      .then(({ data }) => {
        if (!data) return
        const map = new Map<string, HolderInfo>()
        const members: HolderInfo[] = []
        for (const p of data) {
          const info: HolderInfo = {
            id: p.id,
            rank: p.rank,
            firstName: p.first_name,
            lastName: p.last_name,
            displayName: [p.rank, p.last_name].filter(Boolean).join(' ') || p.first_name || 'Unknown',
          }
          map.set(p.id, info)
          members.push(info)
        }
        setHolders(map)
        setClinicMembers(members)
      })
  }, [property.clinicId])

  // Sub-item counts for list view
  const subItemCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of property.items) {
      if (item.parent_item_id) {
        counts.set(item.parent_item_id, (counts.get(item.parent_item_id) ?? 0) + 1)
      }
    }
    return counts
  }, [property.items])

  // Filtered items for list
  const filteredItems = useMemo(() => {
    let list = property.items.filter((i) => !i.parent_item_id) // top-level only
    if (store.holderFilter) {
      list = list.filter((i) => i.current_holder_id === store.holderFilter)
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [property.items, store.holderFilter])

  // Item names + holder names maps for discrepancy display
  const itemNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of property.items) map.set(item.id, item.name)
    return map
  }, [property.items])

  const holderNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const [id, info] of holders) map.set(id, info.displayName)
    return map
  }, [holders])

  const handleSelectItem = useCallback((item: LocalPropertyItem) => {
    store.selectItem(item)
  }, [store])

  const handleSearchSelectItem = useCallback((id: string) => {
    const item = property.items.find((i) => i.id === id)
    if (item) {
      store.selectItem(item)
      setShowSearch(false)
    }
  }, [property.items, store])

  const handleSearchSelectLocation = useCallback((id: string) => {
    const loc = property.locations.find((l) => l.id === id)
    if (loc) {
      store.pushLocation(loc)
      setActiveTab('location-map')
      setShowSearch(false)
    }
  }, [property.locations, store])

  const handleDeleteItem = useCallback(async () => {
    if (!store.selectedItem) return
    if (!confirm('Delete this item? This cannot be undone.')) return
    await property.removeItem(store.selectedItem.id)
    store.selectItem(null)
  }, [store, property])

  if (property.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-themeblue3 border-t-transparent" />
      </div>
    )
  }

  // Item detail view
  if (store.view === 'item-detail' && store.selectedItem) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <button
          className="flex items-center gap-2 px-4 py-2 text-sm text-themeblue3 hover:text-themeblue3/80"
          onClick={() => store.selectItem(null)}
        >
          <ArrowLeft size={16} /> Back to list
        </button>
        <PropertyItemDetail
          item={store.selectedItem}
          holderName={store.selectedItem.current_holder_id ? holders.get(store.selectedItem.current_holder_id)?.displayName : undefined}
          locationName={store.selectedItem.location_id ? property.locations.find((l) => l.id === store.selectedItem!.location_id)?.name : undefined}
          onEdit={() => store.openEditForm(store.selectedItem!)}
          onTransfer={() => store.openTransfer()}
          onDelete={handleDeleteItem}
          getSubItems={property.getSubItems}
          getLedger={property.getLedger}
          onSelectSubItem={handleSelectItem}
        />

        {/* Transfer overlay */}
        <CustodyTransferForm
          isVisible={store.isTransferOpen}
          onClose={() => store.closeTransfer()}
          item={store.selectedItem}
          clinicMembers={clinicMembers}
          currentHolderName={
            store.selectedItem.current_holder_id
              ? holders.get(store.selectedItem.current_holder_id)?.displayName ?? 'Unknown'
              : 'Unassigned'
          }
          getSubItems={property.getSubItems}
          onTransfer={property.doTransfer}
        />
      </div>
    )
  }

  // Item form — inline panel
  if (store.view === 'item-form') {
    return (
      <PropertyItemForm
        editingItem={store.editingItem}
        parentItems={property.items}
        locations={property.locations}
        onSave={property.addItem}
        onUpdate={property.editItem}
        onClose={() => store.closeForm()}
        clinicId={property.clinicId || ''}
      />
    )
  }

  // Main panel with tabs
  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-tertiary/10 px-2">
        <TabButton icon={<List size={14} />} label="Items" active={activeTab === 'list'} onClick={() => setActiveTab('list')} />
        <TabButton icon={<List size={14} />} label="Hand Receipt" active={activeTab === 'hand-receipt'} onClick={() => setActiveTab('hand-receipt')} />
        <TabButton icon={<MapPin size={14} />} label="Locations" active={activeTab === 'location-map'} onClick={() => setActiveTab('location-map')} />
        <TabButton icon={<AlertTriangle size={14} />} label="Discrepancies" active={activeTab === 'discrepancies'} onClick={() => setActiveTab('discrepancies')} badge={property.discrepancies.filter((d) => d.status === 'open').length || undefined} />
      </div>

      {/* Search toggle */}
      <div className="flex items-center justify-between px-4 py-1.5">
        <button
          className="flex items-center gap-1 text-xs text-themeblue3 hover:text-themeblue3/80"
          onClick={() => setShowSearch(!showSearch)}
        >
          <Search size={12} /> {showSearch ? 'Hide' : 'Search'}
        </button>
        {property.isSyncing && (
          <span className="text-[10px] text-tertiary animate-pulse">Syncing...</span>
        )}
      </div>

      {showSearch && (
        <PropertySearch
          onSearch={property.search}
          onSelectItem={handleSearchSelectItem}
          onSelectLocation={handleSearchSelectLocation}
        />
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'list' && (
          <>
            {filteredItems.map((item) => (
              <PropertyItemRow
                key={item.id}
                item={item}
                holderName={item.current_holder_id ? holders.get(item.current_holder_id)?.displayName : undefined}
                subItemCount={subItemCounts.get(item.id)}
                onTap={handleSelectItem}
              />
            ))}
            {filteredItems.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-tertiary">
                No items in property book
              </div>
            )}
          </>
        )}

        {activeTab === 'hand-receipt' && (
          <HandReceiptView
            items={property.items}
            holders={holders}
            currentUserId={user?.id ?? null}
            onSelectItem={handleSelectItem}
          />
        )}

        {activeTab === 'location-map' && (
          <PropertyLocationMap
            locations={property.locations}
            items={property.items}
            clinicId={property.clinicId || ''}
            onAddLocation={property.addLocation}
            onUpdateLocation={property.editLocation}
            onSelectItem={handleSelectItem}
            userId={user?.id || ''}
          />
        )}

        {activeTab === 'discrepancies' && (
          <DiscrepancyList
            discrepancies={property.discrepancies}
            onRectify={property.doRectifyDiscrepancy}
            itemNames={itemNames}
            holderNames={holderNames}
          />
        )}
      </div>

      {/* FAB for adding items */}
      {(activeTab === 'list' || activeTab === 'hand-receipt') && (
        <button
          className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-themeblue3 text-white shadow-lg flex items-center justify-center hover:bg-themeblue3/90 transition-colors"
          onClick={() => store.openAddForm()}
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  )
}

function TabButton({ icon, label, active, onClick, badge }: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
        active
          ? 'border-themeblue3 text-themeblue3'
          : 'border-transparent text-tertiary hover:text-primary'
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-medium">
          {badge}
        </span>
      )}
    </button>
  )
}
