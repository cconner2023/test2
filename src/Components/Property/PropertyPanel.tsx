import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Search as SearchIcon, X, Upload, Download, FileSpreadsheet, Eye, ArrowRightLeft, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '../ConfirmDialog'
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

export interface DetailActions {
  onEdit: () => void
  onTransfer: () => void
  onDelete: () => void
}

interface PropertyPanelProps {
  view: PropertyView
  onSelectItem: (item: LocalPropertyItem) => void
  onAddItem: () => void
  onEditItem: (item: LocalPropertyItem) => void
  onTransferItem: () => void
  onBack: () => void
  isMobile?: boolean
  mobileLocationView?: boolean
  onMobileLocationViewChange?: (active: boolean) => void
  onRegisterDetailActions?: (actions: DetailActions | null) => void
  /** Called once on mount with a function the drawer can invoke to open the new-location form */
  onRegisterAddLocation?: (trigger: () => void) => void
}

export function PropertyPanel({ view, onSelectItem, onAddItem, onEditItem, onTransferItem, onBack, isMobile = true, mobileLocationView = false, onMobileLocationViewChange, onRegisterDetailActions, onRegisterAddLocation }: PropertyPanelProps) {
  const { user } = useAuth()
  const property = useProperty()
  const showLoading = useMinLoadTime(property.isLoading)
  const store = usePropertyStore()
  const [holders, setHolders] = useState<Map<string, HolderInfo>>(new Map())
  const [clinicMembers, setClinicMembers] = useState<HolderInfo[]>([])
  const [filterQuery, setFilterQuery] = useState('')
  const [desktopLocationId, setDesktopLocationId] = useState<string | null>(null)
  const [csvImport, setCsvImport] = useState<{ rows: ParsedRow[]; errors: string[] } | null>(null)
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [showNewLocation, setShowNewLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [renamingLocation, setRenamingLocation] = useState<{ id: string; name: string } | null>(null)

  // ── Selection state ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [transferItems, setTransferItems] = useState<LocalPropertyItem[]>([])
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ itemId: string; x: number; y: number } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'single'; item: LocalPropertyItem } | { kind: 'detail' } | { kind: 'batch'; items: LocalPropertyItem[] } | null>(null)
  const hasSelection = selectedIds.size > 0
  const multiSelectMode = hasSelection

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

  const handleDeleteSingle = useCallback((item: LocalPropertyItem) => {
    setOpenCardId(null)
    setPendingDelete({ kind: 'single', item })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  // Navigate to detail from sub-panels (hand-receipt, locations, etc.)
  const handleSelectItem = useCallback((item: LocalPropertyItem) => {
    store.selectItem(item)
    onSelectItem(item)
  }, [store, onSelectItem])

  const handleTreeSelectLocation = useCallback((loc: LocalPropertyLocation) => {
    store.pushLocation(loc)
    if (isMobile) {
      onMobileLocationViewChange?.(true)
    }
  }, [store, isMobile, onMobileLocationViewChange])

  const handleMoveLocation = useCallback(async (locationId: string, newParentId: string | null) => {
    await property.editLocation(locationId, { parent_id: newParentId })
  }, [property])

  const handleMoveItem = useCallback(async (itemId: string, newLocationId: string | null) => {
    await property.editItem(itemId, { location_id: newLocationId })
  }, [property])

  // Register the add-location trigger so the drawer header can invoke it
  useEffect(() => {
    onRegisterAddLocation?.(() => {
      setNewLocationName('')
      setShowNewLocation(true)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterAddLocation])

  const handleCreateLocation = useCallback(async () => {
    const trimmed = newLocationName.trim()
    if (!trimmed || !property.clinicId) return
    await property.addLocation({
      clinic_id: property.clinicId,
      parent_id: null,
      name: trimmed,
      photo_data: null,
      created_by: user?.id || '',
    })
    setNewLocationName('')
    setShowNewLocation(false)
  }, [newLocationName, property, user?.id])

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

  const handleDeleteItem = useCallback(() => {
    if (!store.selectedItem) return
    setPendingDelete({ kind: 'detail' })
  }, [store.selectedItem])

  // Register detail-view actions for the drawer header
  useEffect(() => {
    if (view === 'property-detail' && store.selectedItem) {
      onRegisterDetailActions?.({
        onEdit: () => {
          store.setEditingItem(store.selectedItem!)
          onEditItem(store.selectedItem!)
        },
        onTransfer: () => {
          setTransferItems([store.selectedItem!])
          onTransferItem()
        },
        onDelete: handleDeleteItem,
      })
    } else {
      onRegisterDetailActions?.(null)
    }
  }, [view, store.selectedItem, onRegisterDetailActions, store, onEditItem, onTransferItem, handleDeleteItem])

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

  const handleActionDelete = useCallback(() => {
    if (selectedItems.length === 0) return
    setPendingDelete({ kind: 'batch', items: selectedItems })
  }, [selectedItems])

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    if (pendingDelete.kind === 'single') {
      await property.removeItem(pendingDelete.item.id)
    } else if (pendingDelete.kind === 'detail' && store.selectedItem) {
      await property.removeItem(store.selectedItem.id)
      store.selectItem(null)
      onBack()
    } else if (pendingDelete.kind === 'batch') {
      for (const item of pendingDelete.items) {
        await property.removeItem(item.id)
      }
      clearSelection()
    }
    setPendingDelete(null)
  }, [pendingDelete, property, store, onBack, clearSelection])

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
      <div className="flex flex-col h-full relative">
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
        <button
          className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-themeblue3 text-white shadow-lg flex items-center justify-center hover:bg-themeblue3/90 transition-colors"
          onClick={() => {
            const path = store.locationPath
            store.setDefaultLocationId(path[path.length - 1]?.id ?? null)
            store.setEditingItem(null)
            onAddItem()
          }}
        >
          <Plus size={24} />
        </button>
      </div>
    )
  }

  // Mobile: location map view (back button is in the drawer header)
  if (isMobile && mobileLocationView) {
    return (
      <div className="flex flex-col h-full relative">
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
        <button
          className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-themeblue3 text-white shadow-lg flex items-center justify-center hover:bg-themeblue3/90 transition-colors"
          onClick={() => {
            const path = store.locationPath
            store.setDefaultLocationId(path[path.length - 1]?.id ?? null)
            store.setEditingItem(null)
            onAddItem()
          }}
        >
          <Plus size={24} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search + CSV toolbar */}
      <div className="flex items-center gap-2 px-6 py-3">
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
            <div className="flex items-center gap-2 shrink-0">
              {property.isSyncing && (
                <span className="text-[10pt] text-tertiary animate-pulse mr-1">Syncing...</span>
              )}
              <button
                title="Import CSV"
                className="w-9 h-9 flex items-center justify-center bg-themewhite2 hover:bg-themewhite rounded-full transition-all duration-300"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-5 h-5 stroke-themeblue1" />
              </button>
              <button
                title="Export CSV"
                className="w-9 h-9 flex items-center justify-center bg-themewhite2 hover:bg-themewhite rounded-full transition-all duration-300"
                onClick={() => exportPropertyCSV(property.items, property.locations)}
              >
                <Download className="w-5 h-5 stroke-themeblue1" />
              </button>
              <button
                title="Download Template"
                className="w-9 h-9 flex items-center justify-center bg-themewhite2 hover:bg-themewhite rounded-full transition-all duration-300"
                onClick={downloadCSVTemplate}
              >
                <FileSpreadsheet className="w-5 h-5 stroke-themeblue1" />
              </button>
            </div>
            <div className="flex-1" />
            <button
              title="Search"
              className="w-9 h-9 flex items-center justify-center bg-themewhite2 hover:bg-themewhite rounded-full transition-all duration-300 shrink-0"
              onClick={() => setIsSearchExpanded(true)}
            >
              <SearchIcon className="w-5 h-5 stroke-themeblue1 opacity-50" />
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

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {isMobile ? (
          <>
            {/* Mobile new-location inline form — triggered by header FolderPlus button */}
            {showNewLocation && (
              <div className="px-4 py-3 border-b border-primary/10 bg-themewhite2/50">
                <input
                  type="text"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateLocation()
                    if (e.key === 'Escape') setShowNewLocation(false)
                  }}
                  placeholder="Location name"
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-themewhite2 text-[10pt] text-primary placeholder:text-tertiary/40 outline-none focus:ring-1 focus:ring-themeblue2/40 transition-all"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setShowNewLocation(false)}
                    className="flex-1 py-1.5 rounded-lg text-[10pt] text-tertiary hover:bg-primary/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateLocation}
                    disabled={!newLocationName.trim()}
                    className="flex-1 py-1.5 rounded-lg bg-themeblue2 text-[10pt] text-white disabled:opacity-30 active:scale-[0.98] transition-all"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}
            <PropertyLocationTree
              locations={property.locations}
              items={property.items}
              onSelectLocation={handleTreeSelectLocation}
              onSelectItem={handleSelectItem}
              onMoveLocation={handleMoveLocation}
              onMoveItem={handleMoveItem}
              onEditLocation={(loc) => { setRenamingLocation({ id: loc.id, name: loc.name }) }}
              onDeleteLocation={(locId) => property.removeLocation(locId)}
              onDeleteItem={(item) => setPendingDelete({ kind: 'single', item })}
            />
          </>
        ) : (
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
              <div className="px-6 py-8 text-center text-[10pt] text-tertiary">
                {filterQuery ? 'No items match your filter' : desktopLocationId ? 'No items at this location' : 'No items in property book'}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom action bar — shown when items are selected */}
      {hasSelection && (() => {
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

      {/* FAB for adding items — desktop only; mobile uses the header triple pill */}
      {!isMobile && !hasSelection && (
        <button
          className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-themeblue3 text-white shadow-lg flex items-center justify-center hover:bg-themeblue3/90 transition-colors"
          onClick={() => {
            store.setDefaultLocationId(null)
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

  const deleteDialogTitle = pendingDelete?.kind === 'batch'
    ? `Delete ${pendingDelete.items.length} item${pendingDelete.items.length > 1 ? 's' : ''}? This cannot be undone.`
    : 'Delete this item? This cannot be undone.'

  // Desktop: split layout with locations sidebar
  if (!isMobile) {
    return (
      <>
      <div className="flex h-full">
        <div className="w-[260px] shrink-0 border-r border-tertiary/10 flex flex-col bg-themewhite3/50">
          <div className="shrink-0 px-6 py-3 border-b border-primary/10">
            <div className="flex items-center justify-between">
              <p className="text-[10pt] font-medium text-tertiary/70 uppercase tracking-wide">Locations</p>
              <button
                onClick={() => {
                  setNewLocationName('')
                  setShowNewLocation(true)
                }}
                className="flex items-center gap-1 text-[10pt] text-themeblue2 hover:text-themeblue2/80 active:scale-95 transition-all"
              >
                <Plus size={12} />
                Location
              </button>
            </div>
          </div>
          {showNewLocation && (
            <div className="shrink-0 px-6 py-3 border-b border-primary/10">
              <input
                type="text"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateLocation()
                  if (e.key === 'Escape') setShowNewLocation(false)
                }}
                placeholder="Location name"
                autoFocus
                className="w-full px-3 py-2 rounded-lg bg-themewhite2 text-[10pt] text-primary placeholder:text-tertiary/40 outline-none focus:ring-1 focus:ring-themeblue2/40 transition-all"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => setShowNewLocation(false)}
                  className="flex-1 py-1.5 rounded-lg text-[10pt] text-tertiary hover:bg-primary/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateLocation}
                  disabled={!newLocationName.trim()}
                  className="flex-1 py-1.5 rounded-lg bg-themeblue2 text-[10pt] text-white disabled:opacity-30 active:scale-[0.98] transition-all"
                >
                  Create
                </button>
              </div>
            </div>
          )}
          {renamingLocation && (
            <div className="shrink-0 px-6 py-3 border-b border-primary/10">
              <input
                type="text"
                value={renamingLocation.name}
                onChange={(e) => setRenamingLocation(prev => prev ? { ...prev, name: e.target.value } : null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renamingLocation.name.trim()) {
                    property.editLocation(renamingLocation.id, { name: renamingLocation.name.trim() })
                    setRenamingLocation(null)
                  }
                  if (e.key === 'Escape') setRenamingLocation(null)
                }}
                placeholder="Location name"
                autoFocus
                className="w-full px-3 py-2 rounded-lg bg-themewhite2 text-[10pt] text-primary placeholder:text-tertiary/40 outline-none focus:ring-1 focus:ring-themeblue2/40 transition-all"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => setRenamingLocation(null)}
                  className="flex-1 py-1.5 rounded-lg text-[10pt] text-tertiary hover:bg-primary/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (renamingLocation.name.trim()) {
                      property.editLocation(renamingLocation.id, { name: renamingLocation.name.trim() })
                      setRenamingLocation(null)
                    }
                  }}
                  disabled={!renamingLocation.name.trim()}
                  className="flex-1 py-1.5 rounded-lg bg-themeblue2 text-[10pt] text-white disabled:opacity-30 active:scale-[0.98] transition-all"
                >
                  Rename
                </button>
              </div>
            </div>
          )}
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
              onEditLocation={(loc) => { setRenamingLocation({ id: loc.id, name: loc.name }) }}
              onDeleteLocation={(locId) => property.removeLocation(locId)}
              onDeleteItem={(item) => setPendingDelete({ kind: 'single', item })}
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0 relative">
          <div className="shrink-0 px-6 py-3 border-b border-primary/10">
            <p className="text-[10pt] font-medium text-tertiary/70 uppercase tracking-wide">
              {desktopLocationId ? (property.locations.find(l => l.id === desktopLocationId)?.name ?? 'Items') : 'All Items'}
            </p>
          </div>
          {renderViewContent()}
        </div>
      </div>
      <ConfirmDialog
        visible={!!pendingDelete}
        title={deleteDialogTitle}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      </>
    )
  }

  return (
    <>
      {renderViewContent()}
      <ConfirmDialog
        visible={!!pendingDelete}
        title={deleteDialogTitle}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  )
}

