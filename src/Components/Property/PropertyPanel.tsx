import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { X, MoreHorizontal, Check, ChevronLeft, Map as MapIcon, Camera, ClipboardList, Download } from 'lucide-react'
import { ConfirmDialog } from '../ConfirmDialog'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { AddFab } from '../AddFab'
import { BottomIsland, IslandButton } from '../BottomIsland'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useShallow } from 'zustand/react/shallow'
import { PropertyLocationTree } from './PropertyLocationTree'
import { CustodyPanel } from './CustodyPanel'
import { Da2062PdfView } from './Da2062PdfView'
import { ItemScanner } from './ItemScanner'
import { useHandReceipts, type ReceiptItem } from '../../Hooks/useHandReceipts'
import { buildReprint2062Params } from '../../Hooks/useHandReceiptActions'
import { useDA2062Export } from '../../Hooks/useDA2062Export'
import { PropertyBreadcrumb } from './PropertyBreadcrumb'
import { PropertySearchOverlay } from './PropertySearchOverlay'
import { PropertyLocationForm, type PropertyLocationFormHandle, type PendingZoneTag } from './PropertyLocationForm'
import { PropertyLocationDetail, buildLocationMenuItems, usePropertyPhotoUpload, type PropertyLocationDetailHandle } from './PropertyLocationDetail'
import { PropertyItemForm, type PropertyItemFormHandle } from './PropertyItemForm'
import { PropertyLocationMap, type MapNavHandle } from './PropertyLocationMap'
import { isStructuralZone } from './levelUtils'
import { Sheet } from '../Sheet'
import { LoadingOverlay } from '../LoadingOverlay'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { useClinicName } from '../../Hooks/useClinicNameResolver'
import type { LocalPropertyItem, LocalPropertyLocation, HandReceipt } from '../../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'
import { PropertyItemDetail, type PropertyItemDetailHandle } from './PropertyItemDetail'
import { PropertyCSVImport } from './PropertyCSVImportDrawer'
import { SignOutForm, type SignOutFormHandle } from './SignOutForm'
import { HeaderPill, PillButton } from '../HeaderPill'
import { SearchInput } from '../SearchInput'

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
  /** Mobile only — register a trigger to open the Locations tree sheet (header button). */
  onRegisterOpenLocations?: (trigger: () => void) => void
  onSearchChange?: (query: string) => void
  /** Mobile only — whether the header search is focused (drives the results overlay). */
  searchFocused?: boolean
  /** Mobile only — set search focus (e.g. clear on result tap / back). */
  onSearchFocusChange?: (focused: boolean) => void
  onEnrollItem?: (item: LocalPropertyItem) => void
  /** New-item enroll: routed through a ConfirmDialog before the scan modal. */
  onEnrollNewItem?: (item: LocalPropertyItem) => void
  /** Open the shared add ActionSheet (FAB lives over the center map pane). */
  onOpenAddSheet?: () => void
  /** Register a trigger to open the New DA 2062 sign-out in the detail surface
   *  (right pane on desktop / detail sheet on mobile). Fired from the add ActionSheet. */
  onRegisterNewDA2062?: (trigger: () => void) => void
  /** Register a trigger to open CSV import in the detail surface (right pane on
   *  desktop / detail sheet on mobile). Fired from the add ActionSheet. */
  onRegisterImport?: (trigger: () => void) => void
  /** Register a trigger to navigate the canvas to a zone (global-search deep-link). */
  onRegisterNavigateZone?: (trigger: (zoneId: string) => void) => void
  /** Register a trigger to open the Custody / DA 2062 tab (global-search deep-link). */
  onRegisterOpenCustody?: (trigger: () => void) => void
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
  onRegisterOpenLocations,
  onSearchChange,
  searchFocused = false,
  onSearchFocusChange,
  onEnrollItem,
  onEnrollNewItem,
  onOpenAddSheet,
  onRegisterNewDA2062,
  onRegisterImport,
  onRegisterNavigateZone,
  onRegisterOpenCustody,
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
      expendItem: s.expendItem,
      holders: s.holders,
      clinicMembers: s.clinicMembers,
      rootLocationId: s.rootLocationId,
      bumpTagVersion: s.bumpTagVersion,
    })),
  )

  // DA 2062 hand-receipts tree section is dev-gated, mirroring the Settings surface
  // + the "New DA 2062" FAB action.
  const isDevRole = useAuthStore(s => s.isDevRole)
  const currentUserId = useAuthStore(s => s.user?.id ?? null)
  // "My property" filter — scope the location tree to property the viewer OWNS
  // (owner_user_id) OR HOLDS by custody (current_holder_id). Calendar-style list-item
  // filter panel (see CalendarDrawer category/personnel panels). personal-zone-pcs-rehome.md §8.
  const [mineOnly, setMineOnly] = useState(false)
  const filterRowCls = (active: boolean) =>
    `w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:scale-95 ${
      active ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3' : 'hover:bg-secondary/5'
    }`
  // Section header matching the calendar filter-panel header (uppercase tertiary label).
  const sectionHeader = (label: string) => (
    <div className="shrink-0 px-4 py-2 border-t border-primary/10">
      <p className="text-[10pt] font-medium text-tertiary uppercase tracking-wide">{label}</p>
    </div>
  )
  const mineFilterPanel = currentUserId ? (
    <div className="flex flex-col shrink-0">
      {sectionHeader('Filter')}
      <button className={filterRowCls(!mineOnly)} onClick={() => setMineOnly(false)}>
        <span className="text-[10pt] font-medium text-primary truncate flex-1">All property</span>
      </button>
      <button className={filterRowCls(mineOnly)} onClick={() => setMineOnly(true)}>
        <span className="text-[10pt] font-medium text-primary truncate flex-1">My property</span>
        {mineOnly && <Check size={14} className="text-themeblue2 shrink-0" />}
      </button>
    </div>
  ) : null

  // DA 2062 accountability data — lifted here so BOTH the Custody tab AND the unified
  // search overlay share one fetch (search folds receipts in as a "Sign-outs"
  // section). Dev-gated: passing null when non-dev skips the fetch entirely.
  const {
    receipts,
    itemsById: receiptItemsById,
    locationNameById: receiptLocationNameById,
    membersById: receiptMembersById,
    loading: receiptsLoading,
    refetch: refetchReceipts,
  } = useHandReceipts(isDevRole ? store.clinicId : null)

  // Reprint a hand receipt's DA 2062 INTO this panel's object-view surface (right
  // pane desktop / detail sheet mobile) — CustodyPanel is MAIN-panel content, so its
  // 2062 opens here as a right-pane/sheet, NOT a nested overlay. (Contrast SignOutForm,
  // which is itself hosted in the pane/sheet and so uses the nested Da2062Preview.)
  const { exportDA2062, da2062Preview, downloadDA2062, clearDA2062Preview } = useDA2062Export()
  const handleReprint = useCallback(
    (r: HandReceipt) => { void exportDA2062(buildReprint2062Params(r, receiptItemsById, receiptMembersById)) },
    [exportDA2062, receiptItemsById, receiptMembersById],
  )
  const saveReprint = useCallback(() => { downloadDA2062(); clearDA2062Preview() }, [downloadDA2062, clearDA2062Preview])

  // Hide STORAGE zones: a member-zone anchored to THIS cluster whose holder is no
  // longer on the home roster is a departed soldier's space held in storage (durable,
  // owner-readable, re-homeable) — it must not stack as a stale visible location. Guard
  // on a loaded roster so a transient empty-holders state never hides live zones.
  // See personal-zone-pcs-rehome.md §5a.
  const rosterLoaded = store.holders.size > 0
  const visibleLocations = store.locations.filter(l => {
    if (l.name === ROOT_LOCATION_NAME) return false
    if (rosterLoaded && l.holder_user_id && l.clinic_id === store.clinicId && !store.holders.has(l.holder_user_id)) return false
    return true
  })
  const hasData = visibleLocations.length > 0 || store.items.length > 0
  const showLoading = useMinLoadTime(store.isLoading) && !hasData
  const clinicName = useClinicName(store.clinicId) || 'Cluster'

  const mapRef = useRef<MapNavHandle>(null)
  const itemFormRef = useRef<PropertyItemFormHandle>(null)
  const locationFormRef = useRef<PropertyLocationFormHandle>(null)
  const signOutFormRef = useRef<SignOutFormHandle>(null)
  const itemDetailRef = useRef<PropertyItemDetailHandle>(null)
  const locDetailRef = useRef<PropertyLocationDetailHandle>(null)
  // Desktop right pane — scopes the item's split/merge PreviewOverlay so it dims
  // and centers within the pane rather than spanning the whole viewport.
  const detailPaneRef = useRef<HTMLDivElement>(null)
  // Whole property panel (desktop) — scopes the PMCS / Dispatch overlays so they
  // dim and center over the ENTIRE drawer (rail · map · pane), not just the pane.
  // Null on mobile → those overlays float fixed, auto-stacked above the sheet.
  const panelRef = useRef<HTMLDivElement>(null)
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
    | { kind: 'location'; loc: LocalPropertyLocation | null; parentId: string | null; pendingTag?: PendingZoneTag | null }
    | null
  >(null)
  // True while the canvas is in single-draw add-zone mode — hides the mobile detail
  // sheet so the user has the full canvas to draw on.
  const [drawingZone, setDrawingZone] = useState(false)
  // Desktop: left-rail tree search (mirrors the calendar desktop sidebar's search).
  const [desktopSearch, setDesktopSearch] = useState('')
  // Bottom-island tabs (both platforms): 'map' = the canvas, 'custody' = the
  // DA 2062 sign-outs. Camera is a momentary action (scanner overlay that returns
  // to the map targeting the match), NOT a persistent tab. Desktop center pane and
  // mobile custody sheet both follow this. The location tree is no longer a tab —
  // it's reached via the rail/search on desktop and the header button on mobile.
  const [propertyTab, setPropertyTab] = useState<'map' | 'custody'>('map')
  // Mobile: the Locations tree sheet (opened from the top-left header button),
  // independent of the island tab so it's reachable from map OR sign-outs.
  const [showLocations, setShowLocations] = useState(false)
  // Scan camera overlay (both platforms) — barcode / visual-ID → locate on map.
  const [showScanner, setShowScanner] = useState(false)
  // Desktop: location form shown in the right pane (create or edit). pendingTag
  // carries the rectangle drawn in the standardized draw-first add-zone flow.
  const [editLocationTarget, setEditLocationTarget] = useState<{ loc: LocalPropertyLocation | null; parentId: string | null; pendingTag?: PendingZoneTag | null } | null>(null)
  const [pendingDeleteItem, setPendingDeleteItem] = useState<LocalPropertyItem | null>(null)
  const [pendingDeleteLocId, setPendingDeleteLocId] = useState<string | null>(null)
  // New DA 2062 sign-out, hosted in the detail surface (right pane desktop /
  // detail sheet mobile) — the same primitive item & zone selection use.
  const [signOutOpen, setSignOutOpen] = useState(false)
  // CSV import, hosted in the SAME detail surface (right pane desktop / detail
  // sheet mobile) — mirrors signOutOpen / da2062Preview.
  const [importOpen, setImportOpen] = useState(false)
  // Selected-location action menu (header ellipsis) anchor + photo upload plumbing.
  const [locMenu, setLocMenu] = useState<{ rect: DOMRect } | null>(null)
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
      // Standardized add-zone: draw first, then the sheet (name/parent/type).
      if (isMobile) { setMobileItem(null); setMobileForm(null) }
      mapRef.current?.startDrawZone(null)
    })
  }, [onRegisterAddLocation, isMobile])

  useEffect(() => {
    onRegisterAddItem?.(() => {
      if (isMobile) { openMobileItemForm(null, null); return }
      store.setDefaultLocationId(null)
      store.setEditingItem(null)
      onAddItem()
    })
  }, [onRegisterAddItem])

  useEffect(() => {
    onRegisterOpenLocations?.(() => setShowLocations(true))
  }, [onRegisterOpenLocations])

  // Global-search deep-links: navigate the canvas to a zone, or jump to the
  // Custody tab. Both leave any open mobile sheet/form so the target surfaces.
  useEffect(() => {
    onRegisterNavigateZone?.((zoneId) => {
      setPropertyTab('map')
      if (isMobile) { setMobileItem(null); setMobileForm(null); setShowLocations(false) }
      mapRef.current?.navigateToZone(zoneId)
    })
  }, [onRegisterNavigateZone, isMobile])

  useEffect(() => {
    onRegisterOpenCustody?.(() => {
      if (isMobile) { setMobileItem(null); setMobileForm(null) }
      setPropertyTab('custody')
    })
  }, [onRegisterOpenCustody, isMobile])

  // New DA 2062 opens in the detail surface — clear any open item/zone/form first
  // so the sign-out is the sole occupant of the right pane / detail sheet.
  useEffect(() => {
    onRegisterNewDA2062?.(() => {
      setMobileItem(null)
      setMobileForm(null)
      store.setEditingItem(null)
      setEditLocationTarget(null)
      setSelectedLocationId(null)
      mapRef.current?.clearSelection()
      setSignOutOpen(true)
    })
  }, [onRegisterNewDA2062, store])

  // Import opens as the sole occupant of the detail surface — clear any open
  // item/zone/form/sign-out first (mirrors the New DA 2062 trigger).
  useEffect(() => {
    onRegisterImport?.(() => {
      setMobileItem(null)
      setMobileForm(null)
      store.setEditingItem(null)
      setEditLocationTarget(null)
      setSelectedLocationId(null)
      mapRef.current?.clearSelection()
      setSignOutOpen(false)
      setImportOpen(true)
    })
  }, [onRegisterImport, store])

  // Mobile: focusing the header search opens the results overlay over the canvas
  // (z1020). The Custody sheet sits above it (z1200), so leave that tab first —
  // search and the sign-outs sheet are mutually exclusive surfaces.
  useEffect(() => {
    if (searchFocused) setPropertyTab('map')
  }, [searchFocused])

  const handleSelectItem = useCallback((item: LocalPropertyItem) => {
    // Auto-navigate the canvas to the item's zone so it surfaces "within that
    // location" — the breadcrumb then points to that zone/sub-zone. Flag the
    // programmatic selection so onSelectZone keeps the item open.
    const targetZone = item.location_id ?? null
    if (targetZone) {
      // Flag the programmatic zone change (when the item lives elsewhere) so
      // onSelectZone keeps the item open instead of closing it.
      if (targetZone !== selectedLocationId) {
        pendingItemZoneRef.current = targetZone
        setTimeout(() => { pendingItemZoneRef.current = null }, 0)
      }
      // Drill the canvas in on the item itself (not just its zone) — mirrors a
      // canvas pin tap. focusItem navigates to the zone first when needed.
      mapRef.current?.focusItem(item.id)
    }
    // Mobile: nest the item inside the location sheet (back returns to the zone).
    if (isMobile) { setMobileItem(item); return }
    onSelectItem(item)
  }, [isMobile, onSelectItem, selectedLocationId])

  // Locate a signed-out item from the hand-receipts tree section: surface it on the
  // canvas (navigate + select, like any item tap). On mobile, dismiss the Locations
  // sheet so the map is revealed — "target the signed-out equipment".
  const handleLocateReceiptItem = useCallback((receiptItem: ReceiptItem) => {
    const full = store.items.find(i => i.id === receiptItem.id)
    if (full) handleSelectItem(full)
    else if (receiptItem.location_id) mapRef.current?.navigateToZone(receiptItem.location_id)
    // Leave the sign-outs tab and surface the map (desktop center pane / mobile canvas).
    setPropertyTab('map')
  }, [store.items, handleSelectItem])

  // Scan match → surface the item on the map ("target it"). Camera is momentary:
  // close the overlay and return to the map tab targeting the match (both platforms).
  const handleScanLocate = useCallback((itemId: string) => {
    setShowScanner(false)
    const full = store.items.find(i => i.id === itemId)
    if (full) handleSelectItem(full)
    setPropertyTab('map')
  }, [store.items, handleSelectItem])

  // Scan match → expend (secondary action on the confirmed card).
  const handleScanExpend = useCallback((itemId: string, quantity: number) => {
    setShowScanner(false)
    store.expendItem(itemId, quantity)
  }, [store])

  // Shared camera overlay (fixed inset-0) — rendered in both layouts.
  const scannerEl = showScanner ? (
    <ItemScanner
      items={store.items}
      onLocate={handleScanLocate}
      onMatch={handleScanExpend}
      onClose={() => setShowScanner(false)}
    />
  ) : null

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

  // Add a zone (top-level or child) → standardized draw-first flow: enter canvas
  // draw mode for the parent's canvas; onZoneDrawn then opens the details sheet.
  const handleAddChildLocation = useCallback((parentId: string | null) => {
    if (isMobile) { setMobileItem(null); setMobileForm(null) }
    mapRef.current?.startDrawZone(parentId)
  }, [isMobile])

  // Canvas reported a freshly-drawn zone rectangle → open the name/parent/type sheet
  // (right pane on desktop, nested sheet on mobile) seeded with the drawn geometry.
  const handleZoneDrawn = useCallback((rect: { x: number; y: number; width: number; height: number }, canvasId: string) => {
    const parentId = canvasId === store.rootLocationId ? null : canvasId
    const pendingTag: PendingZoneTag = { canvasId, ...rect }
    if (isMobile) setMobileForm({ kind: 'location', loc: null, parentId, pendingTag })
    else setEditLocationTarget({ loc: null, parentId, pendingTag })
  }, [isMobile, store.rootLocationId])

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
    setLocMenu({ rect: e.currentTarget.getBoundingClientRect() })
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
        // Desktop: the right-pane precedence gates the zone detail on view==='property',
        // so an item detail/form already occupying the pane would otherwise swallow a
        // genuine map navigation (tap another zone while an item is open). Drop it —
        // onBack is a no-op when view is already 'property' — so the freshly-selected
        // zone surfaces in the pane. Mobile drives its sheet off selectedLocation /
        // mobileItem directly (cleared just above), so it needs no view reset.
        if (!isMobile && (view === 'property-detail' || view === 'property-form')) onBack()
      }}
      onZoneDrawn={handleZoneDrawn}
      onDrawingChange={setDrawingZone}
    />
  ) : null

  const selectedLocation = selectedLocationId ? visibleLocations.find(l => l.id === selectedLocationId) ?? null : null

  // Selected-zone action menu items — shared by the desktop pane header + mobile sheet header.
  const locMenuItems = (loc: LocalPropertyLocation) => buildLocationMenuItems({
    location: loc,
    // The default cluster zone (BAS) is a standing concept — never deletable.
    canDelete: !!onDeleteItem && !loc.is_default_zone,
    onEdit: () => handleEditLocation(loc),
    onNewItem: () => handleAddItemAtLocation(loc.id),
    onNewArea: () => handleAddChildLocation(loc.id),
    canAddLevel: isStructuralZone(loc),
    onAddLevel: () => mapRef.current?.addFloorTo(loc.id),
    onPhoto: () => triggerPhoto(loc.id),
    onRemovePhoto: () => store.editLocation(loc.id, { photo_data: null }),
    onDelete: () => setPendingDeleteLocId(loc.id),
    onPmcs: () => locDetailRef.current?.openPmcs(),
    onDispatch: () => locDetailRef.current?.openDispatch(),
  })

  // Trayed FAB in a positioning wrapper — matches Calendar/Admin's add FAB
  // (bordered translucent tray, md size). The SAB padding rides the wrapper.
  const addFab = onOpenAddSheet ? (
    <div className="absolute bottom-4 right-4 z-30 pb-[max(0rem,var(--sab,0px))] pointer-events-none">
      <AddFab
        tour="property-add-fab"
        label="Add"
        onClick={onOpenAddSheet}
      />
    </div>
  ) : null

  // Mobile variant — placed inside BottomIsland's fab slot (the island owns the
  // bottom/safe-area offset, so the fab just needs horizontal placement).
  const islandFab = onOpenAddSheet ? (
    <AddFab tour="property-add-fab" label="Add" onClick={onOpenAddSheet} className="absolute right-4" />
  ) : null

  // The bottom-island tabs (Map · Camera · Sign-outs) — identical on both platforms.
  // Map/Sign-outs are persistent tabs (drive propertyTab); Camera is momentary (opens
  // the scanner overlay, which returns to the map). The location tree is NOT a tab.
  const renderTabs = () => (
    <>
      <IslandButton role="tab" active={propertyTab === 'map'} onClick={() => setPropertyTab('map')} label="Map" tour="property-tab-map">
        <MapIcon className="w-5 h-5" />
      </IslandButton>
      <IslandButton role="tab" onClick={() => setShowScanner(true)} label="Camera" tour="property-tab-scan">
        <Camera className="w-5 h-5" />
      </IslandButton>
      {isDevRole && (
        <IslandButton role="tab" active={propertyTab === 'custody'} onClick={() => { setMobileItem(null); setMobileForm(null); closeLocationDetail(); setPropertyTab('custody') }} label="Sign-outs" tour="property-tab-custody">
          <ClipboardList className="w-5 h-5" />
        </IslandButton>
      )}
    </>
  )

  // Desktop layout — left rail (location tree) · center map · right pane (detail/form),
  // mirroring MapOverlayPanel: the rail collapses while the right pane is open.
  if (!isMobile) {
    const railCollapsed = view === 'property-form' || view === 'property-detail' || !!editLocationTarget || !!selectedLocation || signOutOpen || importOpen || !!da2062Preview
    // When the rail search has a query, the results take over the CENTER pane
    // (mirrors mobile's overlay) instead of filtering the rail tree in place. The
    // rail keeps the full tree for navigation context; results route to the right pane.
    const desktopSearching = desktopSearch.trim().length > 0
    return (
      <>
        <div ref={panelRef} className="flex h-full relative">
          <div data-tour="property-locations" className={`shrink-0 border-r border-tertiary/10 flex flex-col bg-themewhite3/50 transition-all duration-300 ${
            railCollapsed ? 'w-0 opacity-0 overflow-hidden border-r-0' : 'w-[260px] opacity-100'
          }`}>
            {/* Location tree is always present in the rail (reached by search here);
                it is no longer an island tab. */}
            <div className="shrink-0 px-3 pt-2 pb-1">
              <SearchInput
                value={desktopSearch}
                onChange={setDesktopSearch}
                placeholder="Search items, serials, locations"
              />
            </div>
            {mineFilterPanel}
            {sectionHeader('Zones')}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <PropertyLocationTree
                locations={visibleLocations}
                items={store.items}
                clinicName={clinicName}
                holders={store.holders}
                searchQuery=""
                hoverActions
                activeLocationId={selectedLocationId}
                onSelectLocation={handleSelectLocationDesktop}
                onSelectItem={handleSelectItem}
                onSelectAll={() => mapRef.current?.resetZoom()}
                allSelected={!selectedLocationId}
                mineOnly={mineOnly}
                currentUserId={currentUserId}
                onEditLocation={handleEditLocation}
                onEditItem={handleEditItemRow}
                onDeleteLocation={onDeleteItem ? (locId) => setPendingDeleteLocId(locId) : undefined}
                onDeleteItem={onDeleteItem ? (item) => setPendingDeleteItem(item) : undefined}
                onAddChildLocation={handleAddChildLocation}
                onAddLevel={(id) => mapRef.current?.addFloorTo(id)}
                onAddItemAtLocation={handleAddItemAtLocation}
              />
            </div>
          </div>

          <div className="flex-1 min-w-0 relative">
            {/* The island cycles Map (canvas) ↔ Sign-outs (custody); Camera is
                momentary and returns to the map. Search results render as an OVERLAY
                over the live map (below), mirroring the mobile shell. */}
            {propertyTab === 'custody' && store.clinicId ? (
              <CustodyPanel
                clinicId={store.clinicId}
                receipts={receipts}
                itemsById={receiptItemsById}
                locationNameById={receiptLocationNameById}
                membersById={receiptMembersById}
                loading={receiptsLoading}
                refetch={refetchReceipts}
                onLocateItem={handleLocateReceiptItem}
                onReprint={handleReprint}
              />
            ) : (
              <>
                {mapEl}
                {addFab}
                <LoadingOverlay visible={showLoading} />
                {/* Search results overlay the LIVE map (mirrors mobile) — the canvas
                    stays mounted underneath, so a result tap can actually drive it
                    (focusItem / navigateToZone) and clearing the query reveals the
                    navigated map. Previously the map was unmounted while searching, so
                    mapRef was null and result taps opened the right pane but never
                    moved the canvas. */}
                {desktopSearching && (
                  <PropertySearchOverlay
                    isVisible
                    embedded
                    value={desktopSearch}
                    items={store.items}
                    locations={visibleLocations}
                    holders={store.holders}
                    receipts={receipts}
                    receiptItemsById={receiptItemsById}
                    showReceipts={isDevRole}
                    onSelectItem={(item) => { setDesktopSearch(''); handleSelectItem(item) }}
                    onOpenLocation={(loc) => { setDesktopSearch(''); mapRef.current?.navigateToZone(loc.id) }}
                    onSelectReceiptItem={(item) => { setDesktopSearch(''); handleLocateReceiptItem(item) }}
                  />
                )}
              </>
            )}
            {!drawingZone && !desktopSearching && (
              <BottomIsland
                glass
                z="z-20"
                role="tablist"
                ariaLabel="Property views"
                tour="property-view-switcher"
              >
                {renderTabs()}
              </BottomIsland>
            )}
          </div>

          <div ref={detailPaneRef} className={`shrink-0 border-l border-primary/10 flex flex-col bg-themewhite3 transition-all duration-300 relative ${
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
                    pendingTag={editLocationTarget.pendingTag}
                    onClose={() => setEditLocationTarget(null)}
                  />
                </div>
              </>
            )}
            {!editLocationTarget && signOutOpen && (
              <>
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-tertiary/10">
                  <p className="text-sm font-medium text-primary">New DA 2062</p>
                  <HeaderPill>
                    <PillButton icon={X} iconSize={16} onClick={() => setSignOutOpen(false)} label="Close" />
                    <PillButton icon={Check} iconSize={16} accent="success" onClick={() => signOutFormRef.current?.submit()} label="Sign out" />
                  </HeaderPill>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <SignOutForm ref={signOutFormRef} onClose={() => setSignOutOpen(false)} />
                </div>
              </>
            )}
            {!editLocationTarget && !signOutOpen && view === 'property-detail' && selectedItem && (
              <>
                <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-tertiary/10">
                  <div className="flex-1 min-w-0">
                    <PropertyBreadcrumb
                      parentId={selectedItem.location_id ?? null}
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
                    drawerRef={panelRef}
                  />
                </div>
              </>
            )}
            {!editLocationTarget && !signOutOpen && view === 'property-form' && (
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
                    onEnrollNew={onEnrollNewItem}
                  />
                </div>
              </>
            )}
            {!editLocationTarget && !signOutOpen && view === 'property' && selectedLocation && (
              <>
                <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-tertiary/10">
                  <div className="flex-1 min-w-0">
                    <PropertyBreadcrumb
                      parentId={selectedLocation.parent_id ?? null}
                      locations={visibleLocations}
                      rootLabel={clinicName}
                      onNavigate={handleBreadcrumbNavigate}
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
                    ref={locDetailRef}
                    location={selectedLocation}
                    locations={visibleLocations}
                    items={store.items}
                    holders={store.holders}
                    onNavigateZone={(id) => mapRef.current?.navigateToZone(id)}
                    onSelectItem={handleSelectItem}
                    onEditLocation={handleEditLocation}
                    onEditItem={handleEditItemRow}
                    onDeleteLocation={onDeleteItem ? (locId) => setPendingDeleteLocId(locId) : undefined}
                    onDeleteItem={onDeleteItem ? (item) => setPendingDeleteItem(item) : undefined}
                    onAddChildLocation={handleAddChildLocation}
                    onAddItemAtLocation={handleAddItemAtLocation}
                    drawerRef={panelRef}
                  />
                </div>
              </>
            )}
            {/* CSV import — sole occupant of the right pane (rail collapses, pane
                opens), mirroring the sign-out / reprint surfaces. Absolute overlay
                so it covers the pane without entangling the other branches. */}
            {importOpen && (
              <div className="absolute inset-0 z-10 flex flex-col bg-themewhite3">
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-tertiary/10">
                  <p className="text-sm font-medium text-primary truncate">Import Property CSV</p>
                  <HeaderPill>
                    <PillButton icon={X} iconSize={16} onClick={() => setImportOpen(false)} label="Close" />
                  </HeaderPill>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="px-4 py-4 pb-8">
                    <PropertyCSVImport onClose={() => setImportOpen(false)} />
                  </div>
                </div>
              </div>
            )}
            {/* Reprinted DA 2062 — the object-view surface for a Custody-tab reprint.
                Absolute overlay so it covers the pane without entangling the other
                branches' conditions. */}
            {da2062Preview && (
              <div className="absolute inset-0 z-10 flex flex-col bg-themewhite3">
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-tertiary/10">
                  <p className="text-sm font-medium text-primary truncate">{da2062Preview.filename}</p>
                  <HeaderPill>
                    <PillButton icon={Download} iconSize={16} accent="info" onClick={saveReprint} label="Save" />
                    <PillButton icon={X} iconSize={16} onClick={clearDA2062Preview} label="Close" />
                  </HeaderPill>
                </div>
                <div className="flex-1 min-h-0">
                  <Da2062PdfView preview={da2062Preview} />
                </div>
              </div>
            )}
          </div>
        </div>

        {locMenu && selectedLocation && (
          <LiftedRowMenu
            isOpen
            anchorRect={locMenu.rect}
            onClose={() => setLocMenu(null)}
            layout="list"
            align="right"
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
        {scannerEl}
      </>
    )
  }

  // Mobile layout — full-screen canvas; the header "Locations" button opens a Sheet
  // with the location list for selection/navigation. Item detail & forms live in the
  // shared PropertyNavSheet (owned by PropertyDrawer) via the bubbled callbacks.
  return (
    <>
      <div data-tour="property-locations" className="h-full relative">
        {/* The island swaps the MAIN SURFACE (calendar's view-switcher model),
            NOT a sheet over a persistent map: Map (canvas) ↔ Sign-outs (custody),
            mirroring the desktop center pane. Custody clears the floating glass
            header the same way the search overlay does. Camera is momentary. */}
        {propertyTab === 'custody' && store.clinicId ? (
          <div className="absolute inset-0 pt-[calc(var(--drawer-header-h,3.5rem)+0.5rem)]">
            <CustodyPanel
              clinicId={store.clinicId}
              receipts={receipts}
              itemsById={receiptItemsById}
              locationNameById={receiptLocationNameById}
              membersById={receiptMembersById}
              loading={receiptsLoading}
              refetch={refetchReceipts}
              onLocateItem={handleLocateReceiptItem}
              onReprint={handleReprint}
            />
          </div>
        ) : (
          <>
            {mapEl}
            <LoadingOverlay visible={showLoading} />
          </>
        )}
        {/* Search results page — mirrors the map overlay's MapSearchOverlay:
            focusing the header search reveals this over the full-screen canvas. */}
        <PropertySearchOverlay
          isVisible={searchFocused}
          value={searchQuery}
          items={store.items}
          locations={visibleLocations}
          holders={store.holders}
          receipts={receipts}
          receiptItemsById={receiptItemsById}
          showReceipts={isDevRole}
          onSelectItem={(item) => { handleSelectItem(item); onSearchChange?.(''); onSearchFocusChange?.(false) }}
          onOpenLocation={(loc) => { mapRef.current?.navigateToZone(loc.id); onSearchChange?.(''); onSearchFocusChange?.(false) }}
          onSelectReceiptItem={(item) => { handleLocateReceiptItem(item); onSearchChange?.(''); onSearchFocusChange?.(false) }}
        />
        {/* Bottom island (Map · Camera · Sign-outs) + the Add FAB. Hidden while
            searching or drawing a zone (full canvas needed). */}
        {!searchFocused && !drawingZone && (
          <BottomIsland
            glass
            z="z-20"
            fab={propertyTab === 'custody' ? undefined : islandFab}
            role="tablist"
            ariaLabel="Property views"
            tour="property-view-switcher"
          >
            {renderTabs()}
          </BottomIsland>
        )}
      </div>

      {/* Selected zone → detail sheet (mirrors the map overlay's feature sheet):
          fit height capped, no backdrop so the canvas stays interactive. Items AND
          forms NEST in the SAME sheet (height-transition) — back unwinds
          form → item/location → parent zone. No separate sheets. */}
      <Sheet
        isOpen={(!!selectedLocation || !!mobileItem || !!mobileForm || signOutOpen || importOpen || !!da2062Preview) && !drawingZone}
        onClose={() => { closeMobileForm(); setMobileItem(null); closeLocationDetail(); setSignOutOpen(false); setImportOpen(false); clearDA2062Preview() }}
        title={
          da2062Preview
            ? da2062Preview.filename
            : importOpen
            ? 'Import Property CSV'
            : signOutOpen
            ? 'New DA 2062'
            : mobileForm
              ? (mobileForm.kind === 'item'
                  ? (store.editingItem ? 'Edit Item' : 'New Item')
                  : (mobileForm.loc ? 'Edit Location' : 'New Location'))
              : mobileItem ? mobileItem.name : (selectedLocation?.name ?? '')
        }
        titleNode={
          !mobileForm && (mobileItem || selectedLocation) ? (
            <div className="min-w-0">
              <PropertyBreadcrumb
                parentId={mobileItem ? (mobileItem.location_id ?? null) : (selectedLocation?.parent_id ?? null)}
                locations={visibleLocations}
                rootLabel={clinicName}
                onNavigate={handleBreadcrumbNavigate}
                className="mb-0.5"
              />
              <span className="block truncate text-[13pt] font-semibold text-primary">
                {mobileItem ? mobileItem.name : selectedLocation?.name}
              </span>
            </div>
          ) : undefined
        }
        height="fit"
        maxHeight={da2062Preview || signOutOpen || importOpen ? 85 : 60}
        // Detail/form are non-blocking like the map's mobile feature editor: the
        // canvas stays interactive and the body swaps detail↔form in the SAME sheet.
        // Sign-out is a focused task, so dim the canvas (non-dismissing) to block
        // stray taps from selecting items behind it.
        backdrop={da2062Preview || signOutOpen || importOpen ? 'block' : 'none'}
        zIndex={1200}
        leftContent={
          mobileForm ? (
            <button onClick={closeMobileForm} aria-label="Cancel" className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all">
              <ChevronLeft size={20} />
            </button>
          ) : (mobileItem || selectedLocation) ? (
            <HeaderPill>
              <span
                className="inline-flex"
                onClick={mobileItem
                  ? (e) => itemDetailRef.current?.openMenu((e.currentTarget as HTMLElement).getBoundingClientRect())
                  : openLocMenu}
              >
                <PillButton icon={MoreHorizontal} iconSize={18} onClick={() => {}} label="More actions" />
              </span>
            </HeaderPill>
          ) : undefined
        }
        actions={
          da2062Preview ? (
            <PillButton icon={Download} iconSize={18} accent="info" onClick={saveReprint} label="Save" />
          ) : signOutOpen ? (
            <PillButton icon={Check} iconSize={18} accent="success" onClick={() => signOutFormRef.current?.submit()} label="Sign out" />
          ) : mobileForm ? (
            <PillButton
              icon={Check}
              iconSize={18}
              accent="success"
              onClick={() => (mobileForm.kind === 'item' ? itemFormRef.current : locationFormRef.current)?.submit()}
              label="Save"
            />
          ) : undefined
        }
      >
        {da2062Preview ? (
          <div className="h-[70vh]">
            <Da2062PdfView preview={da2062Preview} />
          </div>
        ) : importOpen ? (
          <PropertyCSVImport onClose={() => setImportOpen(false)} />
        ) : signOutOpen ? (
          <SignOutForm ref={signOutFormRef} onClose={() => setSignOutOpen(false)} />
        ) : mobileForm?.kind === 'item' ? (
          <PropertyItemForm
            ref={itemFormRef}
            editingItem={store.editingItem}
            onClose={closeMobileForm}
            onEnrollNew={onEnrollNewItem}
          />
        ) : mobileForm?.kind === 'location' ? (
          <PropertyLocationForm
            ref={locationFormRef}
            editingLocation={mobileForm.loc}
            defaultParentId={mobileForm.parentId}
            pendingTag={mobileForm.pendingTag}
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
            drawerRef={panelRef}
          />
        ) : selectedLocation ? (
          <PropertyLocationDetail
            ref={locDetailRef}
            location={selectedLocation}
            locations={visibleLocations}
            items={store.items}
            holders={store.holders}
            onNavigateZone={(id) => mapRef.current?.navigateToZone(id)}
            onSelectItem={handleSelectItem}
            onEditLocation={handleEditLocation}
            onEditItem={handleEditItemRow}
            onDeleteLocation={onDeleteItem ? (locId) => setPendingDeleteLocId(locId) : undefined}
            onDeleteItem={onDeleteItem ? (item) => setPendingDeleteItem(item) : undefined}
            onAddChildLocation={handleAddChildLocation}
            onAddItemAtLocation={handleAddItemAtLocation}
            drawerRef={panelRef}
          />
        ) : null}
      </Sheet>

      {locMenu && selectedLocation && (
        <LiftedRowMenu
          isOpen
          anchorRect={locMenu.rect}
          onClose={() => setLocMenu(null)}
          layout="list"
          align="right"
          items={locMenuItems(selectedLocation)}
        />
      )}
      {photoInput}

      <Sheet
        isOpen={showLocations}
        onClose={() => setShowLocations(false)}
        title="Locations"
        height="fit"
        maxHeight={70}
        zIndex={1200}
      >
        {/* List view renders the SAME tree as the desktop rail (not cards). Opened
            from the top-left header button, reachable from any tab. */}
        {mineFilterPanel}
        {sectionHeader('Zones')}
        <PropertyLocationTree
          locations={visibleLocations}
          items={store.items}
          clinicName={clinicName}
          activeLocationId={selectedLocationId}
          allSelected={!selectedLocationId}
          mineOnly={mineOnly}
          currentUserId={currentUserId}
          onSelectAll={() => { mapRef.current?.resetZoom(); setShowLocations(false) }}
          onSelectLocation={(loc) => { mapRef.current?.navigateToZone(loc.id); setShowLocations(false) }}
          onSelectItem={(item) => { handleSelectItem(item); setShowLocations(false) }}
          onEditLocation={handleEditLocation}
          onEditItem={handleEditItemRow}
          onDeleteLocation={onDeleteItem ? (locId) => setPendingDeleteLocId(locId) : undefined}
          onDeleteItem={onDeleteItem ? (item) => setPendingDeleteItem(item) : undefined}
          onAddChildLocation={handleAddChildLocation}
          onAddLevel={(id) => mapRef.current?.addFloorTo(id)}
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
      {scannerEl}
    </>
  )
})
