import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import { Plus, Upload, Download, FileSpreadsheet, Eye, ArrowRightLeft, Trash2, AlertTriangle, X, Check } from 'lucide-react'
import { ActionSheet } from '../ActionSheet'
import { EmptyState } from '../EmptyState'
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
import { PropertyLocationTree } from './PropertyLocationTree'
import { PropertyLocationList } from './PropertyLocationList'
import { SearchInput } from '../SearchInput'
import type { PropertyLocationListHandle } from './PropertyLocationList'
import { CustodyTransferForm } from './CustodyTransferForm'
import { LoadingSpinner } from '../LoadingSpinner'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { PropertyCSVImport } from './PropertyCSVImport'
import { exportPropertyCSV, parsePropertyCSV, downloadCSVTemplate } from '../../Utilities/PropertyCSV'
import { ensureRootLocation, fetchLocationTags, upsertLocationTags } from '../../lib/propertyService'
import { PropertyLocationMap } from './PropertyLocationMap'
import type { MapNavHandle } from './PropertyLocationMap'
import { useClinicName } from '../../Hooks/useClinicNameResolver'
import type { ParsedRow } from '../../Utilities/PropertyCSV'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('PropertyPanel')

export interface LocationEditActions {
  onEdit: () => void
  onDelete: () => void
}

export type PropertyView = 'property' | 'property-detail' | 'property-form' | 'property-transfer'

export interface DetailActions {
  onEdit: () => void
  onTransfer: () => void
  onDelete: () => void
}

interface PropertyPanelProps {
  view: PropertyView
  searchQuery?: string
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
  /** Called whenever the active canvas location changes with edit/delete handlers for the drawer header */
  onRegisterLocationActions?: (actions: LocationEditActions | null) => void
  /** Called when drill-down path changes so PropertyDrawer can update header */
  onDrilldownChange?: (path: Array<{ id: string; name: string }>) => void
  /** Ref to the PropertyLocationList so drawer can call popPath() imperatively */
  locationListRef?: React.Ref<PropertyLocationListHandle>
  /** Desktop: callback to update search query (search input lives in the sidebar) */
  onSearchChange?: (query: string) => void
}

export const PropertyPanel = memo(function PropertyPanel({ view, searchQuery = '', onSelectItem, onAddItem, onEditItem, onTransferItem, onBack, isMobile = true, mobileLocationView = false, onMobileLocationViewChange, onRegisterDetailActions, onRegisterAddLocation, onRegisterLocationActions, onDrilldownChange, locationListRef, onSearchChange }: PropertyPanelProps) {
  const { user } = useAuth()
  const property = useProperty()
  const showLoading = useMinLoadTime(property.isLoading)
  const store = usePropertyStore()
  const clinicName = useClinicName(property.clinicId) || 'Clinic'
  const [holders, setHolders] = useState<Map<string, HolderInfo>>(new Map())
  const [clinicMembers, setClinicMembers] = useState<HolderInfo[]>([])
  const [desktopLocationId, setDesktopLocationId] = useState<string | null>(null)
  const [csvImport, setCsvImport] = useState<{ rows: ParsedRow[]; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mapRef = useRef<MapNavHandle>(null)
  const [showNewLocation, setShowNewLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [rootError, setRootError] = useState(false)
  const [renamingLocation, setRenamingLocation] = useState<{ id: string; name: string } | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)

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

  // Ensure root location exists for top-level canvas
  useEffect(() => {
    if (!property.clinicId || !user?.id) return
    setRootError(false)
    ensureRootLocation(property.clinicId, user.id)
      .then((root) => store.setRootLocationId(root.id))
      .catch((err) => {
        logger.error('ensureRootLocation failed:', err)
        setRootError(true)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property.clinicId, user?.id])

  // Locations visible to the user (hides the invisible root)
  const visibleLocations = useMemo(
    () => property.locations.filter((l) => l.name !== ROOT_LOCATION_NAME),
    [property.locations],
  )

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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        i.nomenclature?.toLowerCase().includes(q) ||
        i.nsn?.toLowerCase().includes(q) ||
        i.serial_number?.toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [property.items, store.holderFilter, searchQuery, isMobile, desktopLocationId])

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
    if (isMobile) {
      // Switch to canvas view first, then navigate — map handles deferred nav if tags aren't loaded
      onMobileLocationViewChange?.(true)
      setTimeout(() => mapRef.current?.navigateToZone(loc.id), 60)
    } else {
      mapRef.current?.navigateToZone(loc.id)
    }
  }, [isMobile, onMobileLocationViewChange])

  // Clinic name tap → zoom canvas back to root
  const handleSelectAllLocations = useCallback(() => {
    store.selectZone(null)
    if (isMobile) {
      onMobileLocationViewChange?.(true)
      setTimeout(() => mapRef.current?.resetZoom(), 60)
    } else {
      mapRef.current?.resetZoom()
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
    const result = await property.addLocation({
      clinic_id: property.clinicId,
      parent_id: null,
      name: trimmed,
      photo_data: null,
      created_by: user?.id || '',
    })
    setNewLocationName('')
    setShowNewLocation(false)

    // Auto-create a zone tag on the root canvas for this new location
    const newLoc = result as { success?: boolean; location?: { id: string } } | undefined
    const newLocId = newLoc?.location?.id
    const canvasId = store.rootLocationId
    if (newLocId && canvasId) {
      try {
        const existing = await fetchLocationTags(canvasId)
        // Grid placement: 3 columns, ~30% wide, ~30% tall
        const zoneCount = existing.filter(
          (t) => t.width != null && t.height != null && t.width > 0 && t.height > 0,
        ).length
        const col = zoneCount % 3
        const row = Math.floor(zoneCount / 3)
        const zoneW = 0.28
        const zoneH = 0.28
        const zoneX = 0.04 + col * 0.32
        const zoneY = 0.04 + row * 0.32
        const newTag = {
          location_id: canvasId,
          target_type: 'location' as const,
          target_id: newLocId,
          x: zoneX,
          y: zoneY,
          width: zoneW,
          height: zoneH,
          label: trimmed,
          rects: null,
        }
        await upsertLocationTags(canvasId, [
          ...existing,
          newTag,
        ])
        store.bumpTagVersion()
      } catch { /* non-fatal */ }
    }
  }, [newLocationName, property, user?.id, store.rootLocationId])

  const handleDesktopLocationSelect = useCallback((loc: LocalPropertyLocation) => {
    if (desktopLocationId === loc.id) {
      setDesktopLocationId(null)
      store.navigateToPath([])
    } else {
      setDesktopLocationId(loc.id)
      mapRef.current?.navigateToZone(loc.id)
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

  if (rootError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 gap-4">
        <AlertTriangle size={32} className="text-themeyellow" />
        <p className="text-[10pt] text-secondary text-center">Unable to initialize property canvas. Local storage may not be available.</p>
        <button
          onClick={() => {
            if (!property.clinicId || !user?.id) return
            setRootError(false)
            ensureRootLocation(property.clinicId, user.id)
              .then((root) => store.setRootLocationId(root.id))
              .catch((err) => {
                logger.error('ensureRootLocation retry failed:', err)
                setRootError(true)
              })
          }}
          className="px-4 py-2 rounded-lg bg-themeblue3 text-white text-[10pt] active:scale-95 transition-all"
        >
          Retry
        </button>
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
        locations={visibleLocations}
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

  // Desktop: always show canvas (with zone highlighted if selected)
  if (!isMobile) {
    return (
      <PropertyLocationMap
        ref={mapRef}
        clinicId={property.clinicId!}
        clinicName={clinicName}
        locations={visibleLocations}
        items={property.items}
        onCreateLocation={property.addLocation}
        onDeleteLocation={property.removeLocation}
        onEditItem={property.editItem}
        onUpdateLocation={property.editLocation}
        onSelectItem={handleSelectItem}
      />
    )
  }

  // Mobile: location map view (back button is in the drawer header)
  if (isMobile && mobileLocationView) {
    return (
      <div className="flex flex-col h-full relative">
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVFile} />
        <PropertyLocationMap
          ref={mapRef}
          clinicId={property.clinicId!}
          clinicName={clinicName}
          locations={visibleLocations}
          items={property.items}
          onCreateLocation={property.addLocation}
          onDeleteLocation={property.removeLocation}
          onEditItem={property.editItem}
          onUpdateLocation={property.editLocation}
          onSelectItem={handleSelectItem}
        />
        {/* Bottom island — CSV actions + Add FAB */}
        <div className="sticky bottom-4 inset-x-0 flex items-center justify-center z-20 pointer-events-none pb-[max(0rem,var(--sab,0px))]">
          <div className="flex items-center gap-1.5 rounded-full bg-themewhite border border-tertiary/20 px-0.5 py-0.5 shadow-lg pointer-events-auto">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary transition-all duration-200 active:scale-95"
              title="Import CSV"
            >
              <Upload className="w-5 h-5" />
            </button>
            <button
              onClick={() => exportPropertyCSV(property.items, visibleLocations)}
              className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary transition-all duration-200 active:scale-95"
              title="Export CSV"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={downloadCSVTemplate}
              className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary transition-all duration-200 active:scale-95"
              title="Download Template"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </button>
          </div>
          <div className="absolute right-4 rounded-full border border-tertiary/20 p-0.5 bg-themewhite shadow-lg pointer-events-auto">
            <button
              onClick={() => setShowAddSheet(true)}
              className="w-11 h-11 rounded-full bg-themeblue3 text-white flex items-center justify-center active:scale-95 transition-all duration-200"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
        {csvImport && (
          <PropertyCSVImport
            rows={csvImport.rows}
            errors={csvImport.errors}
            locations={visibleLocations}
            clinicId={property.clinicId || ''}
            onImport={property.addItem}
            onClose={() => setCsvImport(null)}
          />
        )}
        <ActionSheet
          visible={showAddSheet}
          title="Add to Property Book"
          options={[
            { key: 'item', label: 'New Item', onAction: onAddItem },
            { key: 'location', label: 'New Location', onAction: () => { setNewLocationName(''); setShowNewLocation(true) } },
          ]}
          onClose={() => setShowAddSheet(false)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleCSVFile}
      />

      {property.isSyncing && (
        <div className="px-6 py-1">
          <span className="text-[10pt] text-tertiary animate-pulse">Syncing...</span>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0">
        {isMobile ? (
          <>
            {/* Mobile new-location inline form — triggered by header FolderPlus button */}
            {showNewLocation && (
              <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/10 bg-themewhite2/50">
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
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-lg text-primary text-base border border-tertiary/10 focus-within:border-themeblue1/30 focus-within:bg-themewhite2 bg-themewhite dark:bg-themewhite3 focus:outline-none transition-all placeholder:text-tertiary/30"
                />
                <button
                  onClick={() => setShowNewLocation(false)}
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                >
                  <X size={18} />
                </button>
                <button
                  onClick={handleCreateLocation}
                  disabled={!newLocationName.trim()}
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
                >
                  <Check size={18} />
                </button>
              </div>
            )}
            <PropertyLocationList
              ref={locationListRef}
              locations={visibleLocations}
              items={property.items}
              clinicName={clinicName}
              searchQuery={searchQuery}
              onSelectItem={handleSelectItem}
              onEditLocation={(loc) => { setRenamingLocation({ id: loc.id, name: loc.name }) }}
              onDeleteLocation={(locId) => property.removeLocation(locId)}
              onDeleteItem={(item) => setPendingDelete({ kind: 'single', item })}
              onViewOnMap={(locationId) => {
                onMobileLocationViewChange?.(true)
                setTimeout(() => mapRef.current?.navigateToZone(locationId), 60)
              }}
              onDrilldownChange={onDrilldownChange}
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
              <EmptyState
                title={searchQuery ? 'No items match your search' : desktopLocationId ? 'No items at this location' : 'No items in property book'}
              />
            )}
          </>
        )}
        </div>
      </div>

      {/* Bottom island — CSV actions + Add FAB */}
      {!hasSelection && (
        <div className="sticky bottom-4 inset-x-0 flex items-center justify-center z-20 pointer-events-none pb-[max(0rem,var(--sab,0px))]">
          <div className="flex items-center gap-1.5 rounded-full bg-themewhite border border-tertiary/20 px-0.5 py-0.5 shadow-lg pointer-events-auto">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary transition-all duration-200 active:scale-95"
              title="Import CSV"
            >
              <Upload className="w-5 h-5" />
            </button>
            <button
              onClick={() => exportPropertyCSV(property.items, visibleLocations)}
              className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary transition-all duration-200 active:scale-95"
              title="Export CSV"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={downloadCSVTemplate}
              className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary transition-all duration-200 active:scale-95"
              title="Download Template"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </button>
          </div>
          <div className="absolute right-4 rounded-full border border-tertiary/20 p-0.5 bg-themewhite shadow-lg pointer-events-auto">
            <button
              onClick={() => setShowAddSheet(true)}
              className="w-11 h-11 rounded-full bg-themeblue3 text-white flex items-center justify-center active:scale-95 transition-all duration-200"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <ActionSheet
        visible={showAddSheet}
        title="Add to Property Book"
        options={[
          { key: 'item', label: 'New Item', onAction: onAddItem },
          { key: 'location', label: 'New Location', onAction: () => { setNewLocationName(''); setShowNewLocation(true) } },
        ]}
        onClose={() => setShowAddSheet(false)}
      />

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


      {/* CSV Import modal */}
      {csvImport && (
        <PropertyCSVImport
          rows={csvImport.rows}
          errors={csvImport.errors}
          locations={visibleLocations}
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleCSVFile}
      />
      <div className="flex h-full">
        <div className="w-[260px] shrink-0 border-r border-tertiary/10 flex flex-col bg-themewhite3/50">
          <div className="shrink-0 px-4 py-3 border-b border-primary/10 flex flex-col gap-2">
            <p className="text-[10pt] font-medium text-tertiary/70 uppercase tracking-wide px-2">Locations</p>
            {onSearchChange && (
              <SearchInput
                value={searchQuery}
                onChange={onSearchChange}
                placeholder="Search items..."
              />
            )}
          </div>
          {showNewLocation && (
            <div className="shrink-0 flex items-center gap-2 px-6 py-3 border-b border-primary/10">
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
                className="flex-1 min-w-0 px-3 py-2.5 rounded-lg text-primary text-base border border-tertiary/10 focus-within:border-themeblue1/30 focus-within:bg-themewhite2 bg-themewhite dark:bg-themewhite3 focus:outline-none transition-all placeholder:text-tertiary/30"
              />
              <button
                onClick={() => setShowNewLocation(false)}
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
              >
                <X size={18} />
              </button>
              <button
                onClick={handleCreateLocation}
                disabled={!newLocationName.trim()}
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
              >
                <Check size={18} />
              </button>
            </div>
          )}
          {renamingLocation && (
            <div className="shrink-0 flex items-center gap-2 px-6 py-3 border-b border-primary/10">
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
                placeholder="Rename location"
                autoFocus
                className="flex-1 min-w-0 px-3 py-2.5 rounded-lg text-primary text-base border border-tertiary/10 focus-within:border-themeblue1/30 focus-within:bg-themewhite2 bg-themewhite dark:bg-themewhite3 focus:outline-none transition-all placeholder:text-tertiary/30"
              />
              <button
                onClick={() => setRenamingLocation(null)}
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
              >
                <X size={18} />
              </button>
              <button
                onClick={() => {
                  if (renamingLocation.name.trim()) {
                    property.editLocation(renamingLocation.id, { name: renamingLocation.name.trim() })
                    setRenamingLocation(null)
                  }
                }}
                disabled={!renamingLocation.name.trim()}
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
              >
                <Check size={18} />
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            <PropertyLocationTree
              locations={visibleLocations}
              items={property.items}
              clinicName={clinicName}
              activeLocationId={desktopLocationId}
              onSelectLocation={handleDesktopLocationSelect}
              onSelectItem={handleSelectItem}
              onMoveLocation={handleMoveLocation}
              onMoveItem={handleMoveItem}
              onSelectAll={() => { setDesktopLocationId(null); store.navigateToPath([]); store.selectZone(null); mapRef.current?.resetZoom() }}
              allSelected={!desktopLocationId}
              onEditLocation={(loc) => { setRenamingLocation({ id: loc.id, name: loc.name }) }}
              onDeleteLocation={(locId) => property.removeLocation(locId)}
              onDeleteItem={(item) => setPendingDelete({ kind: 'single', item })}
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0 relative">
          {renderViewContent()}
          {/* Bottom island — CSV actions + Add FAB */}
          <div className="absolute bottom-4 inset-x-0 flex items-center justify-center z-20 pointer-events-none pb-[max(0rem,var(--sab,0px))]">
            <div className="flex items-center gap-1.5 rounded-full bg-themewhite border border-tertiary/20 px-0.5 py-0.5 shadow-lg pointer-events-auto">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary transition-all duration-200 active:scale-95"
                title="Import CSV"
              >
                <Upload className="w-5 h-5" />
              </button>
              <button
                onClick={() => exportPropertyCSV(property.items, visibleLocations)}
                className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary transition-all duration-200 active:scale-95"
                title="Export CSV"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={downloadCSVTemplate}
                className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary transition-all duration-200 active:scale-95"
                title="Download Template"
              >
                <FileSpreadsheet className="w-5 h-5" />
              </button>
            </div>
            <div className="absolute right-4 rounded-full border border-tertiary/20 p-0.5 bg-themewhite shadow-lg pointer-events-auto">
              <button
                onClick={() => setShowAddSheet(true)}
                className="w-11 h-11 rounded-full bg-themeblue3 text-white flex items-center justify-center active:scale-95 transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <ActionSheet
        visible={showAddSheet}
        title="Add to Property Book"
        options={[
          { key: 'item', label: 'New Item', onAction: () => { store.setDefaultLocationId(null); store.setEditingItem(null); onAddItem() } },
          { key: 'location', label: 'New Location', onAction: () => { setNewLocationName(''); setShowNewLocation(true) } },
        ]}
        onClose={() => setShowAddSheet(false)}
      />
      {csvImport && (
        <PropertyCSVImport
          rows={csvImport.rows}
          errors={csvImport.errors}
          locations={visibleLocations}
          clinicId={property.clinicId || ''}
          onImport={property.addItem}
          onClose={() => setCsvImport(null)}
        />
      )}
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
})

