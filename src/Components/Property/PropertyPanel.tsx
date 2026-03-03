import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, List, MapPin, AlertTriangle, Search as SearchIcon, X, Upload, Download, FileSpreadsheet } from 'lucide-react'
import { useProperty } from '../../Hooks/useProperty'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuth } from '../../Hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { PropertyItemRow } from './PropertyItemRow'
import { PropertyItemDetail } from './PropertyItemDetail'
import { PropertyItemForm } from './PropertyItemForm'
import { HandReceiptView } from './HandReceiptView'
import { PropertyLocationMap } from './PropertyLocationMap'
import { PropertyLocationTree } from './PropertyLocationTree'
import { CustodyTransferForm } from './CustodyTransferForm'
import { DiscrepancyList } from './DiscrepancyList'
import { PropertyCSVImport } from './PropertyCSVImport'
import { exportPropertyCSV, parsePropertyCSV, downloadCSVTemplate } from '../../Utilities/PropertyCSV'
import type { ParsedRow } from '../../Utilities/PropertyCSV'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'

export type PropertyView = 'property' | 'property-detail' | 'property-form'

type Tab = 'list' | 'hand-receipt' | 'location-map' | 'discrepancies'

interface PropertyPanelProps {
  view: PropertyView
  onSelectItem: (item: LocalPropertyItem) => void
  onAddItem: () => void
  onEditItem: (item: LocalPropertyItem) => void
  onBack: () => void
}

export function PropertyPanel({ view, onSelectItem, onAddItem, onEditItem, onBack }: PropertyPanelProps) {
  const { user } = useAuth()
  const property = useProperty()
  const store = usePropertyStore()
  const [activeTab, setActiveTab] = useState<Tab>('list')
  const [holders, setHolders] = useState<Map<string, HolderInfo>>(new Map())
  const [clinicMembers, setClinicMembers] = useState<HolderInfo[]>([])
  const [filterQuery, setFilterQuery] = useState('')
  const [locationViewMode, setLocationViewMode] = useState<'map' | 'tree'>('map')
  const [csvImport, setCsvImport] = useState<{ rows: ParsedRow[]; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase()
      list = list.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        i.nomenclature?.toLowerCase().includes(q) ||
        i.nsn?.toLowerCase().includes(q) ||
        i.serial_number?.toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [property.items, store.holderFilter, filterQuery])

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
    onSelectItem(item)
  }, [store, onSelectItem])

  const handleTreeSelectLocation = useCallback((loc: LocalPropertyLocation) => {
    store.pushLocation(loc)
    setLocationViewMode('map')
  }, [store])

  const handleMoveLocation = useCallback(async (locationId: string, newParentId: string | null) => {
    await property.editLocation(locationId, { parent_id: newParentId })
  }, [property])

  const handleMoveItem = useCallback(async (itemId: string, newLocationId: string | null) => {
    await property.editItem(itemId, { location_id: newLocationId })
  }, [property])

  const handleDeleteItem = useCallback(async () => {
    if (!store.selectedItem) return
    if (!confirm('Delete this item? This cannot be undone.')) return
    await property.removeItem(store.selectedItem.id)
    store.selectItem(null)
    onBack()
  }, [store, property, onBack])

  const handleCSVFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const result = await parsePropertyCSV(file)
    setCsvImport(result)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  if (property.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-themeblue3 border-t-transparent" />
      </div>
    )
  }

  // Item detail view
  if (view === 'property-detail' && store.selectedItem) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <PropertyItemDetail
          item={store.selectedItem}
          holderName={store.selectedItem.current_holder_id ? holders.get(store.selectedItem.current_holder_id)?.displayName : undefined}
          locationName={store.selectedItem.location_id ? property.locations.find((l) => l.id === store.selectedItem!.location_id)?.name : undefined}
          onEdit={() => {
            store.setEditingItem(store.selectedItem!)
            onEditItem(store.selectedItem!)
          }}
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

  // Item form
  if (view === 'property-form') {
    return (
      <PropertyItemForm
        editingItem={store.editingItem}
        parentItems={property.items}
        locations={property.locations}
        clinicMembers={clinicMembers}
        onSave={property.addItem}
        onUpdate={property.editItem}
        onClose={() => {
          store.setEditingItem(null)
          onBack()
        }}
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

      {/* Search + CSV toolbar */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex items-center flex-1 min-w-0 bg-themewhite text-tertiary rounded-full border border-themeblue3/10 shadow-xs focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
          <input
            type="search"
            placeholder="search"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="text-tertiary bg-transparent outline-none text-[16px] w-full px-4 py-2 rounded-l-full min-w-0 [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            type="button"
            className="flex items-center justify-center px-2 py-2 bg-themewhite2 stroke-themeblue3 rounded-r-full transition-all duration-300 hover:bg-themewhite shrink-0"
            onClick={filterQuery ? () => setFilterQuery('') : undefined}
          >
            {filterQuery ? (
              <X className="w-5 h-5 stroke-themeblue1" />
            ) : (
              <SearchIcon className="w-5 h-5 stroke-themeblue1 opacity-50" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {property.isSyncing && (
            <span className="text-[10px] text-tertiary animate-pulse mr-1">Syncing...</span>
          )}
          <button
            title="Import CSV"
            className="p-1 text-tertiary hover:text-themeblue3 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} />
          </button>
          <button
            title="Export CSV"
            className="p-1 text-tertiary hover:text-themeblue3 transition-colors"
            onClick={() => exportPropertyCSV(property.items, property.locations)}
          >
            <Download size={14} />
          </button>
          <button
            title="Download Template"
            className="p-1 text-tertiary hover:text-themeblue3 transition-colors"
            onClick={downloadCSVTemplate}
          >
            <FileSpreadsheet size={14} />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleCSVFile}
        />
      </div>

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
                {filterQuery ? 'No items match your filter' : 'No items in property book'}
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
          <div className="flex flex-col">
            {/* Map / Tree toggle */}
            <div className="flex gap-1 px-4 py-2">
              <button
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  locationViewMode === 'map'
                    ? 'bg-themeblue3 text-white'
                    : 'bg-secondary/10 text-tertiary hover:text-primary'
                }`}
                onClick={() => setLocationViewMode('map')}
              >
                Map
              </button>
              <button
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  locationViewMode === 'tree'
                    ? 'bg-themeblue3 text-white'
                    : 'bg-secondary/10 text-tertiary hover:text-primary'
                }`}
                onClick={() => setLocationViewMode('tree')}
              >
                Tree
              </button>
            </div>

            {locationViewMode === 'map' ? (
              <PropertyLocationMap
                locations={property.locations}
                items={property.items}
                clinicId={property.clinicId || ''}
                onAddLocation={property.addLocation}
                onUpdateLocation={property.editLocation}
                onDeleteLocation={property.removeLocation}
                onSelectItem={handleSelectItem}
                userId={user?.id || ''}
              />
            ) : (
              <PropertyLocationTree
                locations={property.locations}
                items={property.items}
                onSelectLocation={handleTreeSelectLocation}
                onSelectItem={handleSelectItem}
                onMoveLocation={handleMoveLocation}
                onMoveItem={handleMoveItem}
              />
            )}
          </div>
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
          onClick={() => {
            store.setEditingItem(null)
            onAddItem()
          }}
        >
          <Plus size={24} />
        </button>
      )}

      {/* CSV Import modal */}
      {csvImport && (
        <PropertyCSVImport
          rows={csvImport.rows}
          errors={csvImport.errors}
          locations={property.locations}
          clinicId={property.clinicId || ''}
          onImport={property.addItem}
          onClose={() => setCsvImport(null)}
        />
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
