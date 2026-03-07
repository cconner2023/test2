import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, List, MapPin, Search as SearchIcon, X, Upload, Download, FileSpreadsheet, Eye, ArrowRightLeft, Trash2 } from 'lucide-react'
import { useProperty } from '../../Hooks/useProperty'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuth } from '../../Hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { CardContextMenu } from '../CardContextMenu'
import { CardActionBar, type ActionBarAction } from '../CardActionBar'
import { PropertyItemRow } from './PropertyItemRow'
import { PropertyItemDetail } from './PropertyItemDetail'
import { PropertyItemForm } from './PropertyItemForm'
import { PropertyLocationMap } from './PropertyLocationMap'
import { PropertyLocationTree } from './PropertyLocationTree'
import { CustodyTransferForm } from './CustodyTransferForm'
import { LoadingSpinner } from '../LoadingSpinner'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { PropertyCSVImport } from './PropertyCSVImport'
import { exportPropertyCSV, parsePropertyCSV, downloadCSVTemplate } from '../../Utilities/PropertyCSV'
import type { ParsedRow } from '../../Utilities/PropertyCSV'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'

export type PropertyView = 'property' | 'property-detail' | 'property-form' | 'property-transfer'

type MobileTab = 'list' | 'location-map'

interface PropertyPanelProps {
  view: PropertyView
  onSelectItem: (item: LocalPropertyItem) => void
  onAddItem: () => void
  onEditItem: (item: LocalPropertyItem) => void
  onTransferItem: () => void
  onBack: () => void
  isMobile?: boolean
}

export function PropertyPanel({ view, onSelectItem, onAddItem, onEditItem, onTransferItem, onBack, isMobile = true }: PropertyPanelProps) {
  const { user } = useAuth()
  const property = useProperty()
  const showLoading = useMinLoadTime(property.isLoading)
  const store = usePropertyStore()
  const [activeTab, setActiveTab] = useState<MobileTab>('list')
  const [holders, setHolders] = useState<Map<string, HolderInfo>>(new Map())
  const [clinicMembers, setClinicMembers] = useState<HolderInfo[]>([])
  const [filterQuery, setFilterQuery] = useState('')
  const [locationViewMode, setLocationViewMode] = useState<'map' | 'tree'>('map')
  const [desktopLocationId, setDesktopLocationId] = useState<string | null>(null)
  const [csvImport, setCsvImport] = useState<{ rows: ParsedRow[]; errors: string[] } | null>(null)
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── Selection state ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [transferItems, setTransferItems] = useState<LocalPropertyItem[]>([])
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ itemId: string; x: number; y: number } | null>(null)
  const hasSelection = selectedIds.size > 0
  const multiSelectMode = hasSelection

  // Clear selection when switching tabs
  useEffect(() => { setSelectedIds(new Set()); setOpenCardId(null); setContextMenu(null) }, [activeTab])

  // Reset to list tab if on Locations tab when switching to desktop (sidebar replaces tab)
  useEffect(() => {
    if (!isMobile && activeTab === 'location-map') setActiveTab('list')
  }, [isMobile, activeTab])

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
    if (!isMobile && desktopLocationId) {
      list = list.filter((i) => i.location_id === desktopLocationId)
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
  }, [property.items, store.holderFilter, filterQuery, isMobile, desktopLocationId])

  // ── Selection handlers ──

  const handleToggleSelect = useCallback((item: LocalPropertyItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
  }, [])

  const handleViewItem = useCallback((item: LocalPropertyItem) => {
    setOpenCardId(null)
    store.selectItem(item)
    onSelectItem(item)
  }, [store, onSelectItem])

  const handleTransferSingle = useCallback((item: LocalPropertyItem) => {
    setOpenCardId(null)
    setTransferItems([item])
    onTransferItem()
  }, [onTransferItem])

  const handleDeleteSingle = useCallback(async (item: LocalPropertyItem) => {
    setOpenCardId(null)
    if (!confirm('Delete this item? This cannot be undone.')) return
    await property.removeItem(item.id)
  }, [property])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  // Navigate to detail from sub-panels (hand-receipt, locations, etc.)
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

  const handleDesktopLocationSelect = useCallback((loc: LocalPropertyLocation) => {
    if (desktopLocationId === loc.id) {
      setDesktopLocationId(null)
      store.resetLocationPath()
    } else {
      setDesktopLocationId(loc.id)
      store.resetLocationPath()
      store.pushLocation(loc)
    }
  }, [desktopLocationId, store])

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

  // ── Action bar handlers ──

  const selectedItems = useMemo(() => {
    return filteredItems.filter((i) => selectedIds.has(i.id))
  }, [filteredItems, selectedIds])

  const handleActionTransfer = useCallback(() => {
    if (selectedItems.length === 0) return
    setTransferItems(selectedItems)
    clearSelection()
    onTransferItem()
  }, [selectedItems, clearSelection, onTransferItem])

  const handleActionDelete = useCallback(async () => {
    if (selectedItems.length === 0) return
    const count = selectedItems.length
    if (!confirm(`Delete ${count} item${count > 1 ? 's' : ''}? This cannot be undone.`)) return
    for (const item of selectedItems) {
      await property.removeItem(item.id)
    }
    clearSelection()
  }, [selectedItems, property, clearSelection])

  if (showLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner className="text-tertiary" />
      </div>
    )
  }

  const renderViewContent = () => {
  // Transfer custody view
  if (view === 'property-transfer' && transferItems.length > 0) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <CustodyTransferForm
          items={transferItems}
          clinicMembers={clinicMembers}
          holders={holders}
          getSubItems={property.getSubItems}
          onTransfer={property.doTransfer}
          onBack={() => { setTransferItems([]); onBack() }}
        />
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
          onTransfer={() => {
            setTransferItems([store.selectedItem!])
            onTransferItem()
          }}
          onDelete={handleDeleteItem}
          getSubItems={property.getSubItems}
          getLedger={property.getLedger}
          onSelectSubItem={handleSelectItem}
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

  // Desktop: show location map when a location is selected in sidebar
  if (!isMobile && desktopLocationId) {
    return (
      <div className="flex flex-col h-full">
        <PropertyLocationMap
          locations={property.locations}
          items={property.items}
          clinicId={property.clinicId || ''}
          onAddLocation={property.addLocation}
          onUpdateLocation={property.editLocation}
          onDeleteLocation={property.removeLocation}
          onSelectItem={handleSelectItem}
          onUnassignItem={(id) => property.editItem(id, { location_id: null })}
          userId={user?.id || ''}
        />
      </div>
    )
  }

  // Main panel with tabs
  return (
    <div className="flex flex-col h-full">
      {/* Mobile segmented toggle */}
      {isMobile && (
        <div className="flex gap-1 px-3 py-2 border-b border-tertiary/10">
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'list'
                ? 'bg-themeblue3 text-white'
                : 'bg-secondary/10 text-tertiary hover:text-primary'
            }`}
            onClick={() => setActiveTab('list')}
          >
            <List size={14} />
            Items
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'location-map'
                ? 'bg-themeblue3 text-white'
                : 'bg-secondary/10 text-tertiary hover:text-primary'
            }`}
            onClick={() => setActiveTab('location-map')}
          >
            <MapPin size={14} />
            Locations
          </button>
        </div>
      )}

      {/* Search + CSV toolbar */}
      <div className="flex items-center gap-2 px-3 py-2">
        {isSearchExpanded ? (
          <div className="flex items-center flex-1 min-w-0 bg-themewhite text-tertiary rounded-full border border-themeblue3/10 shadow-xs focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
            <input
              ref={searchInputRef}
              autoFocus
              type="search"
              placeholder="search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              onBlur={() => { if (!filterQuery) setIsSearchExpanded(false) }}
              className="text-tertiary bg-transparent outline-none text-[16px] w-full px-4 py-2 rounded-l-full min-w-0 [&::-webkit-search-cancel-button]:hidden"
            />
            <button
              type="button"
              className="flex items-center justify-center px-2 py-2 bg-themewhite2 stroke-themeblue3 rounded-r-full transition-all duration-300 hover:bg-themewhite shrink-0"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (filterQuery) {
                  setFilterQuery('')
                  searchInputRef.current?.focus()
                } else {
                  setIsSearchExpanded(false)
                }
              }}
            >
              <X className="w-5 h-5 stroke-themeblue1" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 shrink-0">
              {property.isSyncing && (
                <span className="text-[10px] text-tertiary animate-pulse mr-1">Syncing...</span>
              )}
              <button
                title="Import CSV"
                className="h-8 flex items-center justify-center px-3 py-1.5 bg-themewhite2 hover:bg-themewhite rounded-full transition-all duration-300"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 stroke-themeblue1" />
              </button>
              <button
                title="Export CSV"
                className="h-8 flex items-center justify-center px-3 py-1.5 bg-themewhite2 hover:bg-themewhite rounded-full transition-all duration-300"
                onClick={() => exportPropertyCSV(property.items, property.locations)}
              >
                <Download className="w-4 h-4 stroke-themeblue1" />
              </button>
              <button
                title="Download Template"
                className="h-8 flex items-center justify-center px-3 py-1.5 bg-themewhite2 hover:bg-themewhite rounded-full transition-all duration-300"
                onClick={downloadCSVTemplate}
              >
                <FileSpreadsheet className="w-4 h-4 stroke-themeblue1" />
              </button>
            </div>
            <div className="flex-1" />
            <button
              title="Search"
              className="h-8 w-8 flex items-center justify-center bg-themewhite2 hover:bg-themewhite rounded-full transition-all duration-300 shrink-0"
              onClick={() => setIsSearchExpanded(true)}
            >
              <SearchIcon className="w-4 h-4 stroke-themeblue1 opacity-50" />
            </button>
          </>
        )}
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
                isSelected={selectedIds.has(item.id)}
                isOpen={openCardId === item.id}
                multiSelectMode={multiSelectMode}
                onOpen={() => { setOpenCardId(item.id) }}
                onClose={() => setOpenCardId(prev => prev === item.id ? null : prev)}
                onTap={() => {
                  setOpenCardId(null)
                  // Single-tap selects (shows bottom bar)
                  if (!multiSelectMode) {
                    const isTogglingOff = selectedIds.has(item.id)
                    setSelectedIds(isTogglingOff ? new Set() : new Set([item.id]))
                  }
                }}
                onView={() => handleViewItem(item)}
                onTransfer={() => handleTransferSingle(item)}
                onDelete={() => handleDeleteSingle(item)}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ itemId: item.id, x: e.clientX, y: e.clientY }) }}
                onToggleSelect={() => handleToggleSelect(item)}
              />
            ))}
            {filteredItems.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-tertiary">
                {filterQuery ? 'No items match your filter' : !isMobile && desktopLocationId ? 'No items at this location' : 'No items in property book'}
              </div>
            )}
          </>
        )}

        {activeTab === 'location-map' && isMobile && (
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
                onUnassignItem={(id) => property.editItem(id, { location_id: null })}
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

      </div>

      {/* Bottom action bar — shown when items are selected */}
      {hasSelection && activeTab === 'list' && (() => {
        const singleSelected = selectedIds.size === 1
        const barActions: ActionBarAction[] = []
        if (singleSelected) {
          const item = filteredItems.find(i => selectedIds.has(i.id))
          if (item) {
            barActions.push(
              { key: 'view', label: 'View', icon: Eye, iconBg: 'bg-themegreen/15', iconColor: 'text-themegreen', onAction: () => handleViewItem(item) },
              { key: 'transfer', label: 'Transfer', icon: ArrowRightLeft, iconBg: 'bg-themeblue2/15', iconColor: 'text-themeblue2', onAction: () => handleTransferSingle(item) },
              { key: 'delete', label: 'Delete', icon: Trash2, iconBg: 'bg-themeredred/15', iconColor: 'text-themeredred', onAction: () => handleDeleteSingle(item) },
            )
          }
        } else {
          barActions.push(
            { key: 'transfer', label: 'Transfer', icon: ArrowRightLeft, iconBg: 'bg-themeblue2/15', iconColor: 'text-themeblue2', onAction: handleActionTransfer },
            { key: 'delete', label: 'Delete', icon: Trash2, iconBg: 'bg-themeredred/15', iconColor: 'text-themeredred', onAction: handleActionDelete },
          )
        }
        return (
          <CardActionBar
            selectedCount={selectedIds.size}
            onClear={clearSelection}
            actions={barActions}
          />
        )
      })()}

      {/* Right-click context menu */}
      {contextMenu && (() => {
        const item = filteredItems.find(i => i.id === contextMenu.itemId)
        if (!item) return null
        return (
          <CardContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={[
              {
                key: 'view',
                label: 'View',
                icon: Eye,
                onAction: () => handleViewItem(item),
              },
              {
                key: 'transfer',
                label: 'Transfer',
                icon: ArrowRightLeft,
                onAction: () => handleTransferSingle(item),
              },
              {
                key: 'delete',
                label: 'Delete',
                icon: Trash2,
                destructive: true,
                onAction: () => handleDeleteSingle(item),
              },
            ]}
          />
        )
      })()}

      {/* FAB for adding items — hidden when selection active */}
      {!hasSelection && activeTab === 'list' && (
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

  // Desktop: split layout with locations sidebar
  if (!isMobile) {
    return (
      <div className="flex h-full">
        <div className="w-[260px] shrink-0 border-r border-tertiary/10 flex flex-col bg-themewhite3/50">
          <div className="shrink-0 px-4 py-3 border-b border-primary/10">
            <p className="text-xs font-medium text-tertiary/70 uppercase tracking-wide">Locations</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <PropertyLocationTree
              locations={property.locations}
              items={property.items}
              activeLocationId={desktopLocationId}
              onSelectLocation={handleDesktopLocationSelect}
              onSelectItem={handleSelectItem}
              onMoveLocation={handleMoveLocation}
              onMoveItem={handleMoveItem}
              onSelectAll={() => { setDesktopLocationId(null); store.resetLocationPath() }}
              allSelected={!desktopLocationId}
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0 relative">
          {renderViewContent()}
        </div>
      </div>
    )
  }

  return renderViewContent()
}

