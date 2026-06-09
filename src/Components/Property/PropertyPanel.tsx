import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { X, MoreHorizontal, Check, ChevronLeft } from 'lucide-react'
import { ConfirmDialog } from '../ConfirmDialog'
import { ContextMenu } from '../ContextMenu'
import { AddFab } from '../AddFab'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useShallow } from 'zustand/react/shallow'
import { PropertyLocationTree } from './PropertyLocationTree'
import { PropertyBreadcrumb } from './PropertyBreadcrumb'
import { PropertySearchOverlay } from './PropertySearchOverlay'
import { PropertyLocationForm, type PropertyLocationFormHandle } from './PropertyLocationForm'
import { PropertyLocationDetail, buildLocationMenuItems, usePropertyPhotoUpload } from './PropertyLocationDetail'
import { PropertyItemForm, type PropertyItemFormHandle } from './PropertyItemForm'
import { PropertyLocationMap, type MapNavHandle } from './PropertyLocationMap'
import { Sheet } from '../Sheet'
import { LoadingSpinner } from '../LoadingSpinner'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { useClinicName } from '../../Hooks/useClinicNameResolver'
import type { LocalPropertyItem, LocalPropertyLocation } from '../../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'
import { PropertyItemDetail, type PropertyItemDetailHandle } from './PropertyItemDetail'
import { HeaderPill, PillButton } from '../HeaderPill'

export type PropertyView = 'property' | 'property-detail' | 'property-form'

interface PropertyPanelProps {
  view: PropertyView
  searchQuery?: string
  selectedItem?: LocalPropertyItem | null
  onSelectItem: (item: LocalPropertyItem) => void
  onEditItem: () => void
  onDeleteItem?: (item: LocalPropertyItem) => void
  onAddItem: () => void
  onBack: () => void
  isMobile?: boolean
  onRegisterAddLocation?: (trigger: () => void) => void
  onRegisterAddItem?: (trigger: () => void) => void
  onSearchChange?: (query: string) => void
  /** Mobile only — whether the header search is focused (drives the results overlay). */
  searchFocused?: boolean
  /** Mobile only — set search focus (e.g. clear on result tap / back). */
  onSearchFocusChange?: (focused: boolean) => void
  onEnrollItem?: (item: LocalPropertyItem) => void
  /** Open the shared add ActionSheet (FAB lives over the center map pane). */
  onOpenAddSheet?: () => void
  /** Mobile only — whether the location-select sheet is open (driven by the drawer header). */
  showLocationSheet?: boolean
  /** Mobile only — close the location-select sheet. */
  onCloseLocationSheet?: () => void
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
  onRegisterAddLocation,
  onRegisterAddItem,
  searchFocused = false,
  onSearchFocusChange,
  onEnrollItem,
  onOpenAddSheet,
  showLocationSheet,
  onCloseLocationSheet,
}: PropertyPanelProps) {
  const store = usePropertyStore(
    useShallow((s) => ({
      items: s.items,
      isLoading: s.isLoading,
      clinicId: s.clinicId,
      editingItem: s.editingItem,
      setEditingItem: s.setEditingItem,
      setDefaultLocationId: s.setDefaultLocationId,
      locations: s.locations,
      addLocation: s.addLocation,
      editLocation: s.editLocation,
      removeLocation: s.removeLocation,
      editItem: s.editItem,
      removeItem: s.removeItem,
      holders: s.holders,
      clinicMembers: s.clinicMembers,
      rootLocationId: s.rootLocationId,
      bumpTagVersion: s.bumpTagVersion,
    })),
  )

  const visibleLocations = store.locations.filter(l => l.name !== ROOT_LOCATION_NAME)
  const hasData = visibleLocations.length > 0 || store.items.length > 0
  const showLoading = useMinLoadTime(store.isLoading) && !hasData
  const clinicName = useClinicName(store.clinicId) || 'Cluster'

  const mapRef = useRef<MapNavHandle>(null)
  const itemFormRef = useRef<PropertyItemFormHandle>(null)
  const locationFormRef = useRef<PropertyLocationFormHandle>(null)
  const itemDetailRef = useRef<PropertyItemDetailHandle>(null)
  // Set when we programmatically navigate the canvas to an item's zone (item
  // select), so the resulting onSelectZone doesn't close the item we just opened.
  const pendingItemZoneRef = useRef<string | null>(null)
  // The zone selected on the canvas (or tree) drives the right-pane detail (desktop)
  // / detail sheet (mobile).
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  // Mobile: an item opened from the location sheet nests INSIDE it (back → its zone),
  // rather than opening a separate sheet.
  const [mobileItem, setMobileItem] = useState<LocalPropertyItem | null>(null)
  // Mobile: item/location FORMS also nest in the same sheet (height-transition), on
  // top of the item/location detail. Back unwinds form → item/location → zone.
  const [mobileForm, setMobileForm] = useState<
    | { kind: 'item'; item: LocalPropertyItem | null; locationId: string | null }
    | { kind: 'location'; loc: LocalPropertyLocation | null; parentId: string | null }
    | null
  >(null)
  // Desktop: location form shown in the right pane (create or edit).
  const [editLocationTarget, setEditLocationTarget] = useState<{ loc: LocalPropertyLocation | null; parentId: string | null } | null>(null)
  const [pendingDeleteItem, setPendingDeleteItem] = useState<LocalPropertyItem | null>(null)
  const [pendingDeleteLocId, setPendingDeleteLocId] = useState<string | null>(null)
  // Selected-location action menu (header ellipsis) anchor + photo upload plumbing.
  const [locMenu, setLocMenu] = useState<{ x: number; y: number } | null>(null)
  const { trigger: triggerPhoto, input: photoInput } = usePropertyPhotoUpload(
    (id, dataUrl) => store.editLocation(id, { photo_data: dataUrl }),
  )

  // Mobile: open a nested form in the location sheet (seeds the store the form reads).
  const openMobileItemForm = useCallback((item: LocalPropertyItem | null, locationId: string | null) => {
    store.setEditingItem(item)
    store.setDefaultLocationId(locationId)
    setMobileForm({ kind: 'item', item, locationId })
  }, [store])
  const openMobileLocationForm = useCallback((loc: LocalPropertyLocation | null, parentId: string | null) => {
    setMobileForm({ kind: 'location', loc, parentId })
  }, [])
  const closeMobileForm = useCallback(() => { store.setEditingItem(null); setMobileForm(null) }, [store])

  useEffect(() => {
    onRegisterAddLocation?.(() => {
      if (isMobile) { openMobileLocationForm(null, null); return }
      setEditLocationTarget({ loc: null, parentId: null })
    })
  }, [onRegisterAddLocation])

  useEffect(() => {
    onRegisterAddItem?.(() => {
      if (isMobile) { openMobileItemForm(null, null); return }
      store.setDefaultLocationId(null)
      store.setEditingItem(null)
      onAddItem()
    })
  }, [onRegisterAddItem])

  const handleSelectItem = useCallback((item: LocalPropertyItem) => {
    // Auto-navigate the canvas to the item's zone so it surfaces "within that
    // location" — the breadcrumb then points to that zone/sub-zone. Flag the
    // programmatic selection so onSelectZone keeps the item open.
    const targetZone = item.location_id ?? null
    if (targetZone && targetZone !== selectedLocationId) {
      pendingItemZoneRef.current = targetZone
      mapRef.current?.navigateToZone(targetZone)
      setTimeout(() => { pendingItemZoneRef.current = null }, 0)
    }
    // Mobile: nest the item inside the location sheet (back returns to the zone).
    if (isMobile) { setMobileItem(item); return }
    onSelectItem(item)
  }, [isMobile, onSelectItem, selectedLocationId])

  // Keep the nested mobile item fresh as the store mutates; drop it if it vanishes.
  useEffect(() => {
    if (!mobileItem) return
    const fresh = store.items.find(i => i.id === mobileItem.id)
    if (fresh && fresh !== mobileItem) setMobileItem(fresh)
    else if (!fresh) setMobileItem(null)
  }, [store.items, mobileItem])

  // Edit/create a location → form in the right pane (desktop) or nested sheet (mobile).
  const handleEditLocation = useCallback((loc: LocalPropertyLocation) => {
    if (isMobile) { openMobileLocationForm(loc, null); return }
    setEditLocationTarget({ loc, parentId: null })
  }, [isMobile, openMobileLocationForm])

  const handleAddChildLocation = useCallback((parentId: string | null) => {
    if (isMobile) { openMobileLocationForm(null, parentId); return }
    setEditLocationTarget({ loc: null, parentId })
  }, [isMobile, openMobileLocationForm])

  // Edit an item from a row ellipsis → item form in the right pane / nested sheet.
  const handleEditItemRow = useCallback((item: LocalPropertyItem) => {
    if (isMobile) { openMobileItemForm(item, item.location_id ?? null); return }
    store.setEditingItem(item)
    store.setDefaultLocationId(item.location_id ?? null)
    onAddItem()
  }, [isMobile, openMobileItemForm, store, onAddItem])

  const handleAddItemAtLocation = useCallback((locationId: string | null) => {
    if (isMobile) { openMobileItemForm(null, locationId); return }
    store.setDefaultLocationId(locationId)
    store.setEditingItem(null)
    onAddItem()
  }, [store, isMobile, onAddItem, openMobileItemForm])

  // Tree location tap (desktop) → navigate the canvas to that zone; re-tap clears.
  // Selection state itself flows back from the canvas via onSelectZone → selectedLocationId.
  const handleSelectLocationDesktop = useCallback((loc: LocalPropertyLocation) => {
    if (selectedLocationId === loc.id) mapRef.current?.resetZoom()
    else mapRef.current?.navigateToZone(loc.id)
  }, [selectedLocationId])

  const openLocMenu = useCallback((e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    setLocMenu({ x: r.left, y: r.bottom + 6 })
  }, [])

  const closeLocationDetail = useCallback(() => {
    setSelectedLocationId(null)
    mapRef.current?.clearSelection()
  }, [])

  // Breadcrumb (in the detail header) → navigate the canvas to an ancestor zone,
  // or to root. Leaving any open item/form first so the target zone surfaces.
  const handleBreadcrumbNavigate = useCallback((id: string | null) => {
    if (isMobile) { setMobileItem(null); closeMobileForm() }
    else if (view === 'property-detail' || view === 'property-form') { onBack() }
    if (id) mapRef.current?.navigateToZone(id)
    else mapRef.current?.resetZoom()
  }, [isMobile, view, onBack, closeMobileForm])

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
    if (pendingDeleteLocId === selectedLocationId) {
      setSelectedLocationId(null)
      mapRef.current?.clearSelection()
    }
    setPendingDeleteLocId(null)
  }, [pendingDeleteLocId, store, selectedLocationId])

  if (showLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner className="text-tertiary" />
      </div>
    )
  }

  // The canvas/zone "map" — the single navigation surface, mirrored from the map
  // overlay shell. Center pane on desktop, full-screen on mobile. onSelectZone is
  // wired on BOTH platforms so the inline canvas popover is always suppressed; the
  // selected zone surfaces in the right pane (desktop) / detail sheet (mobile).
  const mapEl = store.clinicId ? (
    <PropertyLocationMap
      ref={mapRef}
      clinicId={store.clinicId}
      clinicName={clinicName}
      locations={visibleLocations}
      items={store.items}
      onCreateLocation={store.addLocation}
      onDeleteLocation={store.removeLocation}
      onEditItem={(id, updates) => store.editItem(id, updates)}
      onUpdateLocation={(id, updates) => store.editLocation(id, updates)}
      onSelectItem={handleSelectItem}
      onCreateItem={() => handleAddItemAtLocation(null)}
      onSelectZone={(id) => {
        setSelectedLocationId(id)
        // Keep the item open when this zone change was the auto-navigation that
        // revealed it; otherwise a real zone change closes the open item/form.
        if (id && id === pendingItemZoneRef.current) return
        setMobileItem(null); setMobileForm(null)
      }}
    />
  ) : null

  const selectedLocation = selectedLocationId ? visibleLocations.find(l => l.id === selectedLocationId) ?? null : null

  // Selected-zone action menu items — shared by the desktop pane header + mobile sheet header.
  const locMenuItems = (loc: LocalPropertyLocation) => buildLocationMenuItems({
    location: loc,
    canDelete: !!onDeleteItem,
    onRename: () => handleEditLocation(loc),
    onNewItem: () => handleAddItemAtLocation(loc.id),
    onNewArea: () => handleAddChildLocation(loc.id),
    onPhoto: () => triggerPhoto(loc.id),
    onRemovePhoto: () => store.editLocation(loc.id, { photo_data: null }),
    onDelete: () => setPendingDeleteLocId(loc.id),
  })

  // Bare lg FAB in a positioning wrapper — mirrors MapOverlayPanel's add FAB.
  // The SAB padding rides the wrapper (not a tray), so the button stays a clean
  // circle instead of the old tray stretching vertically.
  const addFab = onOpenAddSheet ? (
    <div className="absolute bottom-4 right-4 z-30 pb-[max(0rem,var(--sab,0px))] pointer-events-none">
      <AddFab
        tour="property-add-fab"
        label="Add"
        size="lg"
        tray={false}
        onClick={onOpenAddSheet}
      />
    </div>
  ) : null

  // Desktop layout — left rail (location tree) · center map · right pane (detail/form),
  // mirroring MapOverlayPanel: the rail collapses while the right pane is open.
  if (!isMobile) {
    const railCollapsed = view === 'property-form' || view === 'property-detail' || !!editLocationTarget || !!selectedLocation
    return (
      <>
        <div className="flex h-full">
          <div data-tour="property-locations" className={`shrink-0 border-r border-tertiary/10 flex flex-col bg-themewhite3/50 transition-all duration-300 ${
            railCollapsed ? 'w-0 opacity-0 overflow-hidden border-r-0' : 'w-[260px] opacity-100'
          }`}>
            <div className="shrink-0 px-4 py-3 border-b border-primary/10">
              <p className="text-[10pt] font-medium text-tertiary uppercase tracking-wide px-2">Locations</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PropertyLocationTree
                locations={visibleLocations}
                items={store.items}
                clinicName={clinicName}
                activeLocationId={selectedLocationId}
                onSelectLocation={handleSelectLocationDesktop}
                onSelectItem={handleSelectItem}
                onMoveLocation={handleMoveLocation}
                onMoveItem={handleMoveItem}
                onSelectAll={() => mapRef.current?.resetZoom()}
                allSelected={!selectedLocationId}
                onEditLocation={handleEditLocation}
                onEditItem={handleEditItemRow}
                onDeleteLocation={onDeleteItem ? (locId) => setPendingDeleteLocId(locId) : undefined}
                onDeleteItem={onDeleteItem ? (item) => setPendingDeleteItem(item) : undefined}
                onAddChildLocation={handleAddChildLocation}
                onAddItemAtLocation={handleAddItemAtLocation}
              />
            </div>
          </div>

          <div className="flex-1 min-w-0 relative">
            {mapEl}
            {addFab}
          </div>

          <div className={`shrink-0 border-l border-primary/10 flex flex-col bg-themewhite3 transition-all duration-300 relative ${
            railCollapsed ? 'w-[380px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'
          }`}>
            {editLocationTarget && (
              <>
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-tertiary/10">
                  <p className="text-sm font-medium text-primary">
                    {editLocationTarget.loc ? 'Edit Location' : 'New Location'}
                  </p>
                  <HeaderPill>
                    <PillButton icon={X} iconSize={16} onClick={() => setEditLocationTarget(null)} label="Cancel" />
                    <PillButton icon={Check} iconSize={16} accent="success" onClick={() => locationFormRef.current?.submit()} label="Save" />
                  </HeaderPill>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <PropertyLocationForm
                    ref={locationFormRef}
                    editingLocation={editLocationTarget.loc}
                    defaultParentId={editLocationTarget.parentId}
                    onClose={() => setEditLocationTarget(null)}
                  />
                </div>
              </>
            )}
            {!editLocationTarget && view === 'property-detail' && selectedItem && (
              <>
                <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-tertiary/10">
                  {selectedItem.location_id && (
                    <button
                      onClick={() => { setSelectedLocationId(selectedItem.location_id); onBack() }}
                      aria-label="Back to location"
                      className="w-7 h-7 -ml-1 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all shrink-0"
                    >
                      <ChevronLeft size={18} />
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <PropertyBreadcrumb
                      locationId={selectedItem.location_id ?? null}
                      locations={visibleLocations}
                      rootLabel={clinicName}
                      onNavigate={handleBreadcrumbNavigate}
                      className="mb-0.5"
                    />
                    <p className="truncate text-sm font-medium text-primary">{selectedItem.name}</p>
                  </div>
                  <HeaderPill>
                    <span className="inline-flex" onClick={(e) => itemDetailRef.current?.openMenu((e.currentTarget as HTMLElement).getBoundingClientRect())}>
                      <PillButton icon={MoreHorizontal} iconSize={16} onClick={() => {}} label="More actions" />
                    </span>
                    <PillButton icon={X} iconSize={16} onClick={() => { onBack(); closeLocationDetail() }} label="Close" />
                  </HeaderPill>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <PropertyItemDetail
                    ref={itemDetailRef}
                    item={selectedItem}
                    locations={visibleLocations}
                    holders={store.holders}
                    items={store.items}
                    onEnroll={() => onEnrollItem?.(selectedItem)}
                    onEdit={onEditItem}
                    onDelete={onDeleteItem ? () => onDeleteItem(selectedItem) : undefined}
                    canDelete={!!onDeleteItem}
                  />
                </div>
              </>
            )}
            {!editLocationTarget && view === 'property-form' && (
              <>
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-tertiary/10">
                  <p className="text-sm font-medium text-primary">
                    {store.editingItem ? 'Edit Item' : 'New Item'}
                  </p>
                  <HeaderPill>
                    <PillButton icon={X} iconSize={16} onClick={() => { store.setEditingItem(null); onBack() }} label="Cancel" />
                    <PillButton icon={Check} iconSize={16} accent="success" onClick={() => itemFormRef.current?.submit()} label="Save" />
                  </HeaderPill>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <PropertyItemForm
                    ref={itemFormRef}
                    editingItem={store.editingItem}
                    onClose={() => { store.setEditingItem(null); onBack() }}
                  />
                </div>
              </>
            )}
            {!editLocationTarget && view === 'property' && selectedLocation && (
              <>
                <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-tertiary/10">
                  {selectedLocation.parent_id && (
                    <button
                      onClick={() => mapRef.current?.navigateToZone(selectedLocation.parent_id!)}
                      aria-label="Back to parent location"
                      className="w-7 h-7 -ml-1 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all shrink-0"
                    >
                      <ChevronLeft size={18} />
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <PropertyBreadcrumb
                      locationId={selectedLocation.id}
                      locations={visibleLocations}
                      rootLabel={clinicName}
                      onNavigate={handleBreadcrumbNavigate}
                      excludeLeaf
                      className="mb-0.5"
                    />
                    <p className="truncate text-sm font-medium text-primary">{selectedLocation.name}</p>
                  </div>
                  <HeaderPill>
                    <span className="inline-flex" onClick={openLocMenu}>
                      <PillButton icon={MoreHorizontal} iconSize={16} onClick={() => {}} label="More actions" />
                    </span>
                    <PillButton icon={X} iconSize={16} onClick={closeLocationDetail} label="Close" />
                  </HeaderPill>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <PropertyLocationDetail
                    location={selectedLocation}
                    locations={visibleLocations}
                    items={store.items}
                    onNavigateZone={(id) => mapRef.current?.navigateToZone(id)}
                    onSelectItem={handleSelectItem}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {locMenu && selectedLocation && (
          <ContextMenu
            x={locMenu.x}
            y={locMenu.y}
            onClose={() => setLocMenu(null)}
            items={locMenuItems(selectedLocation)}
          />
        )}
        {photoInput}

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

  // Mobile layout — full-screen canvas; the header "Locations" button opens a Sheet
  // with the location list for selection/navigation. Item detail & forms live in the
  // shared PropertyNavSheet (owned by PropertyDrawer) via the bubbled callbacks.
  return (
    <>
      <div data-tour="property-locations" className="h-full relative">
        {mapEl}
        {addFab}
        {/* Search results page — mirrors the map overlay's MapSearchOverlay:
            focusing the header search reveals this over the full-screen canvas. */}
        <PropertySearchOverlay
          isVisible={searchFocused}
          value={searchQuery}
          items={store.items}
          locations={visibleLocations}
          holders={store.holders}
          onSelectItem={(item) => { handleSelectItem(item); onSearchFocusChange?.(false) }}
          onOpenLocation={(loc) => { mapRef.current?.navigateToZone(loc.id); onSearchFocusChange?.(false) }}
        />
      </div>

      {/* Selected zone → detail sheet (mirrors the map overlay's feature sheet):
          fit height capped, no backdrop so the canvas stays interactive. Items AND
          forms NEST in the SAME sheet (height-transition) — back unwinds
          form → item/location → parent zone. No separate sheets. */}
      <Sheet
        isOpen={!!selectedLocation || !!mobileItem || !!mobileForm}
        onClose={() => { closeMobileForm(); setMobileItem(null); closeLocationDetail() }}
        title={
          mobileForm
            ? (mobileForm.kind === 'item'
                ? (store.editingItem ? 'Edit Item' : 'New Item')
                : (mobileForm.loc ? 'Edit Location' : 'New Location'))
            : mobileItem ? mobileItem.name : (selectedLocation?.name ?? '')
        }
        titleNode={
          !mobileForm && (mobileItem || selectedLocation) ? (
            <div className="min-w-0">
              <PropertyBreadcrumb
                locationId={mobileItem ? (mobileItem.location_id ?? null) : (selectedLocation?.id ?? null)}
                locations={visibleLocations}
                rootLabel={clinicName}
                onNavigate={handleBreadcrumbNavigate}
                excludeLeaf={!mobileItem}
                className="mb-0.5"
              />
              <span className="block truncate text-[13pt] font-semibold text-primary">
                {mobileItem ? mobileItem.name : selectedLocation?.name}
              </span>
            </div>
          ) : undefined
        }
        height="fit"
        maxHeight={60}
        // Always non-blocking, like the map's mobile feature editor: the canvas stays
        // visible/interactive and the body swaps detail↔form in the SAME sheet (no
        // separate modal). Close via the header Cancel/Save/X, not a trapping backdrop.
        backdrop="none"
        zIndex={1200}
        leftContent={
          mobileForm ? (
            <button onClick={closeMobileForm} aria-label="Cancel" className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all">
              <ChevronLeft size={20} />
            </button>
          ) : mobileItem ? (
            <button onClick={() => setMobileItem(null)} aria-label="Back to location" className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all">
              <ChevronLeft size={20} />
            </button>
          ) : selectedLocation?.parent_id ? (
            <button onClick={() => mapRef.current?.navigateToZone(selectedLocation.parent_id!)} aria-label="Back to parent location" className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all">
              <ChevronLeft size={20} />
            </button>
          ) : undefined
        }
        actions={
          mobileForm ? (
            <PillButton
              icon={Check}
              iconSize={18}
              accent="success"
              onClick={() => (mobileForm.kind === 'item' ? itemFormRef.current : locationFormRef.current)?.submit()}
              label="Save"
            />
          ) : (mobileItem || selectedLocation) ? (
            <span
              className="inline-flex"
              onClick={mobileItem
                ? (e) => itemDetailRef.current?.openMenu((e.currentTarget as HTMLElement).getBoundingClientRect())
                : openLocMenu}
            >
              <PillButton icon={MoreHorizontal} iconSize={18} onClick={() => {}} label="More actions" />
            </span>
          ) : undefined
        }
      >
        {mobileForm?.kind === 'item' ? (
          <PropertyItemForm
            ref={itemFormRef}
            editingItem={store.editingItem}
            onClose={closeMobileForm}
          />
        ) : mobileForm?.kind === 'location' ? (
          <PropertyLocationForm
            ref={locationFormRef}
            editingLocation={mobileForm.loc}
            defaultParentId={mobileForm.parentId}
            onClose={() => setMobileForm(null)}
          />
        ) : mobileItem ? (
          <PropertyItemDetail
            ref={itemDetailRef}
            item={mobileItem}
            locations={visibleLocations}
            holders={store.holders}
            items={store.items}
            onEnroll={() => onEnrollItem?.(mobileItem)}
            onEdit={() => openMobileItemForm(mobileItem, mobileItem.location_id ?? null)}
            onDelete={onDeleteItem ? () => setPendingDeleteItem(mobileItem) : undefined}
            canDelete={!!onDeleteItem}
          />
        ) : selectedLocation ? (
          <PropertyLocationDetail
            location={selectedLocation}
            locations={visibleLocations}
            items={store.items}
            onNavigateZone={(id) => mapRef.current?.navigateToZone(id)}
            onSelectItem={handleSelectItem}
          />
        ) : null}
      </Sheet>

      {locMenu && selectedLocation && (
        <ContextMenu
          x={locMenu.x}
          y={locMenu.y}
          onClose={() => setLocMenu(null)}
          items={locMenuItems(selectedLocation)}
        />
      )}
      {photoInput}

      <Sheet
        isOpen={!!showLocationSheet}
        onClose={() => onCloseLocationSheet?.()}
        title="Locations"
        height="fit"
        maxHeight={70}
        zIndex={1200}
      >
        {/* List view renders the SAME tree as the desktop rail (not cards). */}
        <PropertyLocationTree
          locations={visibleLocations}
          items={store.items}
          clinicName={clinicName}
          activeLocationId={selectedLocationId}
          allSelected={!selectedLocationId}
          onSelectAll={() => { mapRef.current?.resetZoom(); onCloseLocationSheet?.() }}
          onSelectLocation={(loc) => { mapRef.current?.navigateToZone(loc.id); onCloseLocationSheet?.() }}
          onSelectItem={(item) => { handleSelectItem(item); onCloseLocationSheet?.() }}
          onMoveLocation={handleMoveLocation}
          onMoveItem={handleMoveItem}
          onEditLocation={handleEditLocation}
          onEditItem={handleEditItemRow}
          onDeleteLocation={onDeleteItem ? (locId) => setPendingDeleteLocId(locId) : undefined}
          onDeleteItem={onDeleteItem ? (item) => setPendingDeleteItem(item) : undefined}
          onAddChildLocation={handleAddChildLocation}
          onAddItemAtLocation={handleAddItemAtLocation}
        />
      </Sheet>

      <ConfirmDialog
        visible={!!pendingDeleteItem}
        title="Delete this item? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        zIndex={1500}
        onConfirm={handleConfirmDeleteItem}
        onCancel={() => setPendingDeleteItem(null)}
      />
      <ConfirmDialog
        visible={!!pendingDeleteLocId}
        title="Delete this location and reassign its items? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        zIndex={1500}
        onConfirm={handleConfirmDeleteLocation}
        onCancel={() => setPendingDeleteLocId(null)}
      />
    </>
  )
})
