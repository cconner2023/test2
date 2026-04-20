import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import { X, Check, List, MapIcon } from 'lucide-react'
import { ConfirmDialog } from '../ConfirmDialog'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useShallow } from 'zustand/react/shallow'
import { PropertyLocationTree } from './PropertyLocationTree'
import { PropertyLocationList } from './PropertyLocationList'
import { PropertyItemForm } from './PropertyItemForm'
import { SearchInput } from '../SearchInput'
import { LoadingSpinner } from '../LoadingSpinner'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { useClinicName } from '../../Hooks/useClinicNameResolver'
import type { LocalPropertyItem, LocalPropertyLocation } from '../../Types/PropertyTypes'
import { fetchLocationTags, upsertLocationTags } from '../../lib/propertyService'
import { PropertyItemDetail } from './PropertyItemDetail'

export type PropertyView = 'property' | 'property-detail' | 'property-form'

interface PropertyPanelProps {
  view: PropertyView
  searchQuery?: string
  selectedItem?: LocalPropertyItem | null
  onSelectItem: (item: LocalPropertyItem) => void
  onEditItem: () => void
  onDeleteItem: (item: LocalPropertyItem) => void
  onAddItem: () => void
  onBack: () => void
  isMobile?: boolean
  editing?: boolean
  onRegisterAddLocation?: (trigger: () => void) => void
  onRegisterAddItem?: (trigger: () => void) => void
  onDrilldownChange?: (path: Array<{ id: string; name: string }>) => void
  locationListRef?: React.Ref<unknown>
  onSearchChange?: (query: string) => void
  mobileLocationView?: boolean
  onMobileLocationViewChange?: (active: boolean) => void
  onEnrollItem?: (item: LocalPropertyItem) => void
}

export const PropertyPanel = memo(function PropertyPanel({
  view,
  searchQuery = '',
  selectedItem = null,
  onSelectItem,
  onEditItem,
  onDeleteItem,
  onAddItem,
  onBack,
  isMobile = true,
  editing = false,
  onRegisterAddLocation,
  onRegisterAddItem,
  onDrilldownChange,
  locationListRef,
  onSearchChange,
  mobileLocationView = false,
  onMobileLocationViewChange,
  onEnrollItem,
}: PropertyPanelProps) {
  const store = usePropertyStore(
    useShallow((s) => ({
      items: s.items,
      isLoading: s.isLoading,
      clinicId: s.clinicId,
      editingItem: s.editingItem,
      setEditingItem: s.setEditingItem,
      setDefaultLocationId: s.setDefaultLocationId,
      visibleLocations: s.visibleLocations,
      addLocation: s.addLocation,
      editLocation: s.editLocation,
      removeLocation: s.removeLocation,
      editItem: s.editItem,
      removeItem: s.removeItem,
      holders: s.holders,
      rootLocationId: s.rootLocationId,
      bumpTagVersion: s.bumpTagVersion,
    })),
  )

  const visibleLocations = store.visibleLocations()
  const showLoading = useMinLoadTime(store.isLoading)
  const clinicName = useClinicName(store.clinicId) || 'Clinic'

  const [desktopLocationId, setDesktopLocationId] = useState<string | null>(null)
  const [showNewLocation, setShowNewLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [newLocationParentId, setNewLocationParentId] = useState<string | null>(null)
  const [renamingLocation, setRenamingLocation] = useState<{ id: string; name: string } | null>(null)
  const [showInlineForm, setShowInlineForm] = useState(false)
  const [pendingDeleteItem, setPendingDeleteItem] = useState<LocalPropertyItem | null>(null)
  const [pendingDeleteLocId, setPendingDeleteLocId] = useState<string | null>(null)

  useEffect(() => {
    onRegisterAddLocation?.(() => {
      setNewLocationName('')
      setNewLocationParentId(null)
      setShowNewLocation(true)
    })
  }, [onRegisterAddLocation])

  useEffect(() => {
    onRegisterAddItem?.(() => {
      store.setDefaultLocationId(null)
      store.setEditingItem(null)
      if (isMobile) setShowInlineForm(true)
      else onAddItem()
    })
  }, [onRegisterAddItem])

  const handleSelectItem = useCallback((item: LocalPropertyItem) => {
    onSelectItem(item)
  }, [onSelectItem])

  const handleCreateLocation = useCallback(async () => {
    const trimmed = newLocationName.trim()
    if (!trimmed || !store.clinicId) return
    const parentId = newLocationParentId
    const result = await store.addLocation({
      clinic_id: store.clinicId,
      parent_id: parentId,
      name: trimmed,
      photo_data: null,
      created_by: '',
    })
    if (result?.success && result.location) {
      const canvasId = parentId ?? store.rootLocationId
      if (canvasId) {
        const existingTags = await fetchLocationTags(canvasId)
        const zoneCount = existingTags.filter(t => t.target_type === 'location').length
        const col = zoneCount % 4
        const row = Math.floor(zoneCount / 4)
        await upsertLocationTags(canvasId, [
          ...existingTags,
          {
            id: crypto.randomUUID(),
            location_id: canvasId,
            target_type: 'location' as const,
            target_id: result.location.id,
            x: 0.05 + col * 0.23,
            y: 0.05 + row * 0.18,
            width: 0.2,
            height: 0.14,
            label: trimmed,
          },
        ])
        store.bumpTagVersion()
      }
    }
    setNewLocationParentId(null)
    setNewLocationName('')
    setShowNewLocation(false)
  }, [newLocationName, newLocationParentId, store])

  const handleAddChildLocation = useCallback((parentId: string | null) => {
    setNewLocationParentId(parentId)
    setNewLocationName('')
    setShowNewLocation(true)
  }, [])

  const handleAddItemAtLocation = useCallback((locationId: string | null) => {
    store.setDefaultLocationId(locationId)
    store.setEditingItem(null)
    if (isMobile) {
      setShowInlineForm(true)
    } else {
      onAddItem()
    }
  }, [store, isMobile, onAddItem])

  const handleMoveLocation = useCallback(async (locationId: string, newParentId: string | null) => {
    await store.editLocation(locationId, { parent_id: newParentId })
  }, [store])

  const handleMoveItem = useCallback(async (itemId: string, newLocationId: string | null) => {
    await store.editItem(itemId, { location_id: newLocationId })
  }, [store])

  const handleConfirmDeleteItem = useCallback(async () => {
    if (!pendingDeleteItem) return
    await store.removeItem(pendingDeleteItem.id)
    setPendingDeleteItem(null)
  }, [pendingDeleteItem, store])

  const handleConfirmDeleteLocation = useCallback(async () => {
    if (!pendingDeleteLocId) return
    await store.removeLocation(pendingDeleteLocId)
    setPendingDeleteLocId(null)
  }, [pendingDeleteLocId, store])

  if (showLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner className="text-tertiary" />
      </div>
    )
  }

  const renderNewLocationForm = () => {
    if (!showNewLocation) return null
    const cancelForm = () => { setShowNewLocation(false); setNewLocationParentId(null) }
    const parentName = newLocationParentId ? visibleLocations.find(l => l.id === newLocationParentId)?.name : null
    return (
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-primary/10">
        <input
          type="text"
          value={newLocationName}
          onChange={(e) => setNewLocationName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreateLocation()
            if (e.key === 'Escape') cancelForm()
          }}
          placeholder={parentName ? `New area in ${parentName}…` : 'Location name'}
          autoFocus
          className="flex-1 min-w-0 rounded-full py-2.5 px-4 border border-themeblue1/30 shadow-xs bg-themewhite2 focus:outline-none text-base text-primary placeholder:text-tertiary/30 transition-all duration-300"
        />
        <button
          onClick={cancelForm}
          className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-themewhite2 border border-themeblue3/10 text-tertiary hover:text-primary active:scale-95 transition-all duration-300"
        >
          <X size={20} />
        </button>
        <button
          onClick={handleCreateLocation}
          disabled={!newLocationName.trim()}
          className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-themeblue3 text-white border border-themeblue1/30 disabled:opacity-30 active:scale-95 transition-all duration-300"
        >
          <Check size={20} />
        </button>
      </div>
    )
  }

  const renderRenameForm = () => {
    if (!renamingLocation) return null
    return (
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-primary/10">
        <input
          type="text"
          value={renamingLocation.name}
          onChange={(e) => setRenamingLocation((prev) => prev ? { ...prev, name: e.target.value } : null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && renamingLocation.name.trim()) {
              store.editLocation(renamingLocation.id, { name: renamingLocation.name.trim() })
              setRenamingLocation(null)
            }
            if (e.key === 'Escape') setRenamingLocation(null)
          }}
          placeholder="Rename location"
          autoFocus
          className="flex-1 min-w-0 rounded-full py-2.5 px-4 border border-themeblue1/30 shadow-xs bg-themewhite2 focus:outline-none text-base text-primary placeholder:text-tertiary/30 transition-all duration-300"
        />
        <button
          onClick={() => setRenamingLocation(null)}
          className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-themewhite2 border border-themeblue3/10 text-tertiary hover:text-primary active:scale-95 transition-all duration-300"
        >
          <X size={20} />
        </button>
        <button
          onClick={() => {
            if (renamingLocation.name.trim()) {
              store.editLocation(renamingLocation.id, { name: renamingLocation.name.trim() })
              setRenamingLocation(null)
            }
          }}
          disabled={!renamingLocation.name.trim()}
          className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-themeblue3 text-white border border-themeblue1/30 disabled:opacity-30 active:scale-95 transition-all duration-300"
        >
          <Check size={20} />
        </button>
      </div>
    )
  }

  // Mobile: detail view
  if (view === 'property-detail' && isMobile && selectedItem) {
    return (
      <PropertyItemDetail
        item={selectedItem}
        locations={visibleLocations}
        holders={store.holders}
        items={store.items}
        onEdit={onEditItem}
        onDelete={() => onDeleteItem(selectedItem)}
        onEnroll={() => onEnrollItem?.(selectedItem)}
      />
    )
  }

  // Desktop layout
  if (!isMobile) {
    return (
      <>
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
            {renderNewLocationForm()}
            {renderRenameForm()}
            <div className="flex-1 overflow-y-auto">
              <PropertyLocationTree
                locations={visibleLocations}
                items={store.items}
                clinicName={clinicName}
                activeLocationId={desktopLocationId}
                onSelectLocation={(loc) => setDesktopLocationId(desktopLocationId === loc.id ? null : loc.id)}
                onSelectItem={handleSelectItem}
                onMoveLocation={handleMoveLocation}
                onMoveItem={handleMoveItem}
                onSelectAll={() => setDesktopLocationId(null)}
                allSelected={!desktopLocationId}
                onEditLocation={(loc) => setRenamingLocation({ id: loc.id, name: loc.name })}
                onDeleteLocation={(locId) => setPendingDeleteLocId(locId)}
                onDeleteItem={(item) => setPendingDeleteItem(item)}
                onAddChildLocation={handleAddChildLocation}
                onAddItemAtLocation={handleAddItemAtLocation}
                editing={editing}
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0 relative">
            <div className="flex-1 overflow-y-auto">
              {store.items
                .filter((i) => !i.parent_item_id)
                .filter((i) => !desktopLocationId || i.location_id === desktopLocationId)
                .filter((i) => {
                  if (!searchQuery.trim()) return true
                  const q = searchQuery.toLowerCase()
                  return (
                    i.name.toLowerCase().includes(q) ||
                    i.nomenclature?.toLowerCase().includes(q) ||
                    i.nsn?.toLowerCase().includes(q) ||
                    i.serial_number?.toLowerCase().includes(q)
                  )
                })
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className="w-full flex items-center gap-3 px-6 py-3.5 border-b border-tertiary/10 text-left active:bg-secondary/5 transition-colors active:scale-[0.98]"
                  >
                    <span className="flex-1 text-[10pt] text-primary truncate">{item.name}</span>
                    {item.serial_number && (
                      <span className="text-[9pt] text-tertiary/60 truncate max-w-[120px]">{item.serial_number}</span>
                    )}
                    {item.quantity > 1 && (
                      <span className="text-[10pt] px-2 py-0.5 rounded-full font-medium shrink-0 bg-themeblue3/10 text-themeblue3">
                        {item.quantity}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </div>

          <div className={`shrink-0 border-l border-primary/10 flex flex-col bg-themewhite3 transition-all duration-300 relative ${
            (view === 'property-form' || view === 'property-detail') ? 'w-[380px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'
          }`}>
            {view === 'property-detail' && selectedItem && (
              <>
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-tertiary/10">
                  <p className="text-sm font-medium text-primary">Item Details</p>
                  <button
                    onClick={onBack}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <PropertyItemDetail
                    item={selectedItem}
                    locations={visibleLocations}
                    holders={store.holders}
                    items={store.items}
                    onEdit={onEditItem}
                    onDelete={() => onDeleteItem(selectedItem)}
                    onEnroll={() => onEnrollItem?.(selectedItem)}
                  />
                </div>
              </>
            )}
            {view === 'property-form' && (
              <>
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-tertiary/10">
                  <p className="text-sm font-medium text-primary">
                    {store.editingItem ? 'Edit Item' : 'New Item'}
                  </p>
                  <button
                    onClick={() => { store.setEditingItem(null); onBack() }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <PropertyItemForm
                    editingItem={store.editingItem}
                    onClose={() => { store.setEditingItem(null); onBack() }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <ConfirmDialog
          visible={!!pendingDeleteItem}
          title="Delete this item? This cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleConfirmDeleteItem}
          onCancel={() => setPendingDeleteItem(null)}
        />
        <ConfirmDialog
          visible={!!pendingDeleteLocId}
          title="Delete this location and reassign its items? This cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleConfirmDeleteLocation}
          onCancel={() => setPendingDeleteLocId(null)}
        />
      </>
    )
  }

  // Mobile layout
  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {renderNewLocationForm()}

        <div className="flex-1 overflow-y-auto">
          <PropertyLocationList
            ref={locationListRef as React.Ref<import('./PropertyLocationList').PropertyLocationListHandle>}
            locations={visibleLocations}
            items={store.items}
            holders={store.holders}
            clinicName={clinicName}
            searchQuery={searchQuery}
            onSelectItem={handleSelectItem}
            onEditLocation={(loc) => setRenamingLocation({ id: loc.id, name: loc.name })}
            onDeleteLocation={(locId) => setPendingDeleteLocId(locId)}
            onDeleteItem={(item) => setPendingDeleteItem(item)}
            onAddChildLocation={handleAddChildLocation}
            onAddItemAtLocation={handleAddItemAtLocation}
            onDrilldownChange={onDrilldownChange}
            showInlineForm={showInlineForm}
            inlineEditItem={store.editingItem}
            onInlineFormClose={() => { setShowInlineForm(false); store.setEditingItem(null) }}
            editing={editing}
          />
        </div>

      </div>

      <ConfirmDialog
        visible={!!pendingDeleteItem}
        title="Delete this item? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDeleteItem}
        onCancel={() => setPendingDeleteItem(null)}
      />
      <ConfirmDialog
        visible={!!pendingDeleteLocId}
        title="Delete this location and reassign its items? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDeleteLocation}
        onCancel={() => setPendingDeleteLocId(null)}
      />
    </>
  )
})
