import { useState, useEffect, useCallback, useRef, useMemo, memo, type CSSProperties } from 'react'
import { X, MoreHorizontal, Check, ChevronLeft, Map as MapIcon, Camera, ClipboardList, Download, Plus, Pencil } from 'lucide-react'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { AddFab } from '@/Components/primitives/AddFab'
import { BottomIsland, IslandButton } from '@/Components/primitives/BottomIsland'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useShallow } from 'zustand/react/shallow'
import { PropertyLocationTree } from './PropertyLocationTree'
import { CustodyPanel } from './CustodyPanel'
import { Da2062PdfView } from './Da2062PdfView'
import { ItemScanner } from './ItemScanner'
import { useHandReceipts, type ReceiptItem } from '../../Hooks/useHandReceipts'
import { buildReprint2062Params, useHandReceiptActions } from '../../Hooks/useHandReceiptActions'
import type { AuditEvent } from '../../lib/auditTypes'
import { useFeatureGate } from '../../lib/featureGate'
import { useDA2062Export } from '../../Hooks/useDA2062Export'
import { useDA3161Export } from '../../Hooks/useDA3161Export'
import type { TurnInDoc } from '../../Types/PropertyTypes'
import { PropertyBreadcrumb } from './PropertyBreadcrumb'
import { PropertySearchOverlay } from './PropertySearchOverlay'
import { PropertyLocationForm, type PropertyLocationFormHandle, type PendingZoneTag } from './PropertyLocationForm'
import { PropertyLocationDetail, buildLocationMenuItems, type PropertyLocationDetailHandle } from './PropertyLocationDetail'
import { PropertyItemForm, type PropertyItemFormHandle } from './PropertyItemForm'
import { PropertyLocationMap, type MapNavHandle } from './PropertyLocationMap'
import { isStructuralZone } from './levelUtils'
import { Sheet } from '@/Components/primitives/Sheet'
import { useStack } from '@/Components/primitives/useStack'
import { LayeredStackBody } from '@/Components/primitives/LayeredStackBody'
import { StackNavContext } from '@/Components/stackNav'
import { LoadingOverlay } from '@/Components/primitives/LoadingOverlay'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { useClinicName } from '../../Hooks/useClinicNameResolver'
import type { LocalPropertyItem, LocalPropertyLocation, HandReceipt } from '../../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'
import { PropertyItemDetail } from './PropertyItemDetail'
import { ItemActionMenu, type ItemActionMenuHandle } from './ItemActionMenu'
import { Da2062Detail, da2062DetailSubtitle, type Da2062DetailHandle } from './Da2062Detail'
import { PropertyRecordDetail, type PropertyRecordDetailHandle, type SelectedRecord } from './PropertyRecordDetail'
import { PropertyTurnInDetail, type PropertyTurnInDetailHandle, type PendingTurnIn } from './PropertyTurnInDetail'
import { PropertyCSVImport } from './PropertyCSVImportDrawer'
import { PropertyShortagePanel, type PropertyShortageHandle } from './PropertyShortagePanel'
import { PropertyAuthorizedPanel } from './PropertyAuthorizedPanel'
import { isLinContainer, isAuthTarget, isZoneShadow } from '../../Utilities/propertyAuthorized'
import { SignOutForm, type SignOutFormHandle } from './SignOutForm'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { SearchInput } from '@/Components/primitives/SearchInput'

export type PropertyView = 'property' | 'property-detail' | 'property-form'

interface PropertyPanelProps {
  view: PropertyView
  searchQuery?: string
  selectedItem?: LocalPropertyItem | null
  onSelectItem: (item: LocalPropertyItem) => void
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
  /** Register a trigger to focus a specific item on the canvas by id (global-search /
   *  cross-domain deep-link). Routes through the same path as an in-drawer search tap. */
  onRegisterFocusItem?: (trigger: (itemId: string) => void) => void
}

export const PropertyPanel = memo(function PropertyPanel({
  view,
  searchQuery = '',
  selectedItem = null,
  onSelectItem,
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
  onRegisterFocusItem,
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
      deletePmcsEntry: s.deletePmcsEntry,
      stageTurnIn: s.stageTurnIn,
      verifyTurnIn: s.verifyTurnIn,
      unstageTurnInItem: s.unstageTurnInItem,
      holders: s.holders,
      clinicMembers: s.clinicMembers,
      rootLocationId: s.rootLocationId,
      bumpTagVersion: s.bumpTagVersion,
    })),
  )

  // The property accountability suite (DA 2062 hand receipts, DA 3161 turn-in, shortage
  // annex) rides the staged rollout gate: dev → single-cluster pilot → release. Gates
  // the custody tab, the Turn-In tree node, the hand-receipt fetch, and the search
  // sign-outs section together. PropertyDrawer's "New DA 2062"/"Shortages" FAB use the
  // same gate. See src/lib/featureGate.ts.
  const showAccountability = useFeatureGate('propertyAccountability')
  const currentUserId = useAuthStore(s => s.user?.id ?? null)
  // Property FILTER — one entry point at the top of the Locations sheet / desktop rail,
  // above the tree. "My property" narrows the canvas + tree to what the viewer owns/holds.
  // (Sub-cluster scoping removed — the collapsible Personnel group handles roster scale.)
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
  // The property filter panel — the calendar list-item filter primitive (All/My property
  // rows + sub-unit rows). Lives at the top of the Locations sheet (mobile) / rail
  // (desktop), above the tree — one entry point shares the filter + the tree.
  const propertyFilterPanel = (
    <div className="flex flex-col">
      {sectionHeader('My property')}
      <button className={filterRowCls(!mineOnly)} onClick={() => setMineOnly(false)}>
        <span className="text-[10pt] font-medium text-primary truncate flex-1">All property</span>
      </button>
      <button className={filterRowCls(mineOnly)} onClick={() => setMineOnly(true)}>
        <span className="text-[10pt] font-medium text-primary truncate flex-1">My property only</span>
        {mineOnly && <Check size={14} className="text-themeblue2 shrink-0" />}
      </button>
    </div>
  )

  // DA 2062 accountability data — lifted here so BOTH the Custody tab AND the unified
  // search overlay share one fetch (search folds receipts in as a "Sign-outs"
  // section). Dev-gated: passing null when non-dev skips the fetch entirely.
  const {
    receipts,
    turnIns,
    itemsById: receiptItemsById,
    locationNameById: receiptLocationNameById,
    membersById: receiptMembersById,
    loading: receiptsLoading,
    refetch: refetchReceipts,
  } = useHandReceipts(showAccountability ? store.clinicId : null)

  // Item ids staged/pending DA 3161 turn-in — the tree pulls these out of their
  // physical zone and re-homes them under the Turn-In node.
  const turnInItemIds = useMemo(() => new Set(turnIns.pending.map((e) => e.item_id)), [turnIns.pending])

  // DA 3161 turn-in: stage an item (+ its SKO subtree) into the rolling pending bucket,
  // verify a staged doc (depot accepted), or unstage a pending line.
  const handleStageTurnIn = useCallback((item: LocalPropertyItem) => { void store.stageTurnIn([item.id]) }, [store])
  const handleVerifyTurnIn = useCallback((docId: string, itemIds?: string[]) => { void store.verifyTurnIn(docId, itemIds) }, [store])
  const handleUnstageTurnInItem = useCallback((docId: string, itemId: string) => { void store.unstageTurnInItem(docId, itemId) }, [store])

  // Open / print the DA 3161 for a completed turn-in doc (Beacon emits the document to
  // hand-jam into the SoR; it is not the SoR). Items/holder resolve from the lifted maps.
  const { exportDA3161 } = useDA3161Export()
  const handleViewTurnIn = useCallback((doc: TurnInDoc) => {
    const d = new Date(doc.recordedAt)
    const ymd = Number.isNaN(d.getTime())
      ? ''
      : `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    const fromHolder = receiptMembersById.get(doc.recordedBy) ?? {
      id: doc.recordedBy, rank: null, firstName: null, lastName: null, displayName: 'Turn-In',
    }
    const items = doc.entries.map((e) => {
      const it = receiptItemsById.get(e.item_id)
      return {
        name: it?.name ?? 'Item',
        nomenclature: it?.nomenclature ?? null,
        nsn: it?.nsn ?? null,
        serial_number: it?.serial_number ?? null,
        quantity: Math.max(1, e.quantity_delta ?? 1),
      }
    })
    void exportDA3161({ items, fromHolder, requestNo: `TI-${doc.turnInDocId.slice(0, 8).toUpperCase()}`, date: ymd })
  }, [exportDA3161, receiptMembersById, receiptItemsById])

  // Receipt mutate-actions hosted here too (alongside Da2062Detail's own copy) so the
  // Custody card context menu can delete a hand receipt directly — same delete →
  // invalidate → refetch path, confirmed via the ConfirmDialog wired below.
  const { pendingDelete: pendingDeleteReceipt, setPendingDelete: setPendingDeleteReceipt, confirmDelete: confirmDeleteReceipt } =
    useHandReceiptActions({ clinicId: store.clinicId, itemsById: receiptItemsById, membersById: receiptMembersById, refetch: refetchReceipts })

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

  // The TREE (rail/sheet) lists physical/shared zones PLUS the filtered personnel zones.
  // The MAP still receives the full location/item set (member zones stay in its tag index
  // so navigateToZone can zoom INTO a personnel zone and pin its items); the map itself
  // hides personnel tiles at the overview (see PropertyLocationMap memberZoneIds) until one
  // is selected. Store keeps full data for writes.
  const physicalLocations = useMemo(() => visibleLocations.filter(l => !l.holder_user_id), [visibleLocations])

  // Personnel zones for the tree — all member (root) zones, sorted by holder name.
  // Roster scale is handled by the collapsible Personnel group in the tree, not a filter.
  const personnelZones = useMemo(() => {
    return visibleLocations
      .filter(l => !!l.holder_user_id)
      .slice()
      .sort((a, b) => {
        const an = store.holders.get(a.holder_user_id!)?.displayName || a.name
        const bn = store.holders.get(b.holder_user_id!)?.displayName || b.name
        return an.localeCompare(bn)
      })
  }, [visibleLocations, store.holders])

  // Item scope for the canvas + tree — the SINGLE source both surfaces read, so map
  // and tree can't drift. One render-only narrowing:
  //   • "My property" → viewer-owned (owner_user_id) or held (current_holder_id)
  // Off → the full set (turn-in / LIN-container exclusions still apply below).
  const displayItems = useMemo(() => {
    // Turned-in items (turned_in_at set) have left the books — they drop out of the
    // active book (canvas + tree) and live only in the Turn-In history. LIN containers are
    // PHR headers, not discrete property — they never render on the canvas or in the tree
    // (only their component items, which are real placeable items, do).
    let items = store.items.filter(i => !i.turned_in_at && !isLinContainer(i) && !isAuthTarget(i) && !isZoneShadow(i))
    // Staged turn-in stock is a clinic-wide operational state, NOT squad property: it
    // must stay visible at the (system) Pending Turn-In zone regardless of the squad
    // lens / "My property" filter — otherwise the zone empties and the tree hides it
    // (PropertyLocationTree roots filter), while the ledger-driven turn-in list still
    // shows it. The authorized-split clone in particular loses its owner_user_id bypass
    // (createItem nulls it), so without this exemption the lens would drop it. Mirrors
    // the unfiltered turn-in list so the two surfaces can't drift.
    const turnInZoneIds = new Set(store.locations.filter(l => l.is_turn_in_zone).map(l => l.id))
    const atTurnIn = (i: LocalPropertyItem) => i.location_id != null && turnInZoneIds.has(i.location_id)
    if (mineOnly && currentUserId)
      items = items.filter(i => atTurnIn(i) || i.owner_user_id === currentUserId || i.current_holder_id === currentUserId)
    return items
  }, [mineOnly, currentUserId, store.items, store.locations])

  // The TREE (rail + Locations sheet) lists physical/shared zones PLUS the personnel
  // zones (the tree groups the latter under a collapsible "Personnel" node) — so the one
  // Locations entry point covers both. (The MAP overview hides personnel tiles until one
  // is selected, then un-hides and pins its items — so tapping one from the tree renders it.)
  const treeLocations = useMemo(() => [...physicalLocations, ...personnelZones], [physicalLocations, personnelZones])
  const clinicName = useClinicName(store.clinicId) || 'Cluster'

  const mapRef = useRef<MapNavHandle>(null)
  const itemFormRef = useRef<PropertyItemFormHandle>(null)
  const locationFormRef = useRef<PropertyLocationFormHandle>(null)
  const signOutFormRef = useRef<SignOutFormHandle>(null)
  const itemActionRef = useRef<ItemActionMenuHandle>(null)
  const locDetailRef = useRef<PropertyLocationDetailHandle>(null)
  const da2062DetailRef = useRef<Da2062DetailHandle>(null)
  const recordDetailRef = useRef<PropertyRecordDetailHandle>(null)
  const turnInDetailRef = useRef<PropertyTurnInDetailHandle>(null)
  const shortageRef = useRef<PropertyShortageHandle>(null)
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
  const [pendingDeleteTurnIn, setPendingDeleteTurnIn] = useState<TurnInDoc | null>(null)
  // New DA 2062 sign-out, hosted in the detail surface (right pane desktop /
  // detail sheet mobile) — the same primitive item & zone selection use.
  const [signOutOpen, setSignOutOpen] = useState(false)
  // Save-in-flight for any hosted form (item / location / sign-out) — drives the
  // HUD loader (pane LoadingOverlay desktop / Sheet loading morph mobile). Delete
  // is the ConfirmDialog; save is the HUD (consistent across all 4 domains).
  const [formSaving, setFormSaving] = useState(false)
  // CSV import, hosted in the SAME detail surface (right pane desktop / detail
  // sheet mobile) — mirrors signOutOpen / da2062Preview.
  const [importOpen, setImportOpen] = useState(false)
  const [shortageOpen, setShortageOpen] = useState(false)
  const [authorizedOpen, setAuthorizedOpen] = useState(false)
  // Authorized surface MORPH: the add/edit item form, the read-only item detail, OR the
  // CSV import wizard that temporarily REPLACES the authorized list in the same right pane
  // (desktop) / sheet (mobile). Not a nested overlay — the surface swaps list ↔ form/view/
  // import and back on save/close. Import has no ActionSheet: the header pill morphs
  // straight to it (its only action), with a back button returning to the list.
  const [authForm, setAuthForm] = useState<{ item: LocalPropertyItem | null; parentId: string | null } | null>(null)
  const [authView, setAuthView] = useState<LocalPropertyItem | null>(null)
  const [authImport, setAuthImport] = useState(false)
  const authFormRef = useRef<PropertyItemFormHandle>(null)
  const openAuthAdd = useCallback(() => { setAuthImport(false); setAuthView(null); setAuthForm({ item: null, parentId: null }) }, [])
  const openAuthEdit = useCallback((item: LocalPropertyItem) => { setAuthImport(false); setAuthView(null); setAuthForm({ item, parentId: item.parent_item_id ?? null }) }, [])
  const openAuthView = useCallback((item: LocalPropertyItem) => { setAuthImport(false); setAuthForm(null); setAuthView(item) }, [])
  // Add a component parented to a LIN (from the LIN detail's Components "+"): open the auth form
  // pre-parented so the two-pick flow lands under this LIN.
  const openAuthAddChild = useCallback((linId: string) => { setAuthImport(false); setAuthView(null); setAuthForm({ item: null, parentId: linId }) }, [])
  // Component "Delete" from the LIN detail = DE-AUTHORIZE (stays on-hand as excess), never a
  // hard delete — mirrors PropertyAuthorizedPanel component-delete semantics.
  const deauthorizeComponent = useCallback((item: LocalPropertyItem) => { void store.editItem(item.id, { quantity_authorized: null }) }, [store])
  // Auth-view header ellipsis anchor. Menu contents depend on what's being viewed: a LIN →
  // "Add item" (to the LIN) + "Edit LIN"; a component/item → "Edit".
  const [authViewMenu, setAuthViewMenu] = useState<{ rect: DOMRect } | null>(null)
  const openAuthImport = useCallback(() => { setAuthForm(null); setAuthView(null); setAuthImport(true) }, [])
  const closeAuthMorph = useCallback(() => { setAuthForm(null); setAuthView(null); setAuthImport(false) }, [])
  // Closing the authorized surface (or opening another) always drops any open morph.
  useEffect(() => { if (!authorizedOpen) { setAuthForm(null); setAuthView(null); setAuthImport(false) } }, [authorizedOpen])
  // A Custody-roster card opened into the detail surface (right pane desktop /
  // sheet mobile): a DA 2062 hand receipt OR a PMCS/dispatch record. Same "main-
  // content card → pane/sheet detail" primitive the item/zone rows use; mutually
  // exclusive (selecting one clears the other).
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<SelectedRecord | null>(null)
  // A pending DA 3161 turn-in opened into the same detail surface — tracked by doc id
  // so it re-derives live from the pending fold (curating an item shrinks it; the pane
  // auto-closes when the turn-in empties / completes).
  const [selectedTurnInId, setSelectedTurnInId] = useState<string | null>(null)
  // Selected-location action menu (header ellipsis) anchor. Photo add/change/remove
  // now lives in the zone Edit form (PropertyLocationForm), not this menu.
  const [locMenu, setLocMenu] = useState<{ rect: DOMRect } | null>(null)

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
    // Header "Locations" pill → always land on the tree step: drop any active
    // zone/item selection + frame the overview so the merged sheet shows the tree.
    onRegisterOpenLocations?.(() => {
      setMobileItem(null); setMobileForm(null)
      setSelectedLocationId(null); mapRef.current?.clearSelection(); mapRef.current?.resetZoom()
      setShowLocations(true)
    })
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
      setShortageOpen(false)
      setAuthorizedOpen(false)
      setImportOpen(true)
    })
  }, [onRegisterImport, store])

  // Cluster Hand Receipt (authorized/BOM) + Cluster Shortages open as the sole occupant of
  // the detail surface (right pane desktop / sheet mobile), mirroring Import. Driven from the
  // left-pane "Cluster" nav rows (accountabilityNav) — the FAB is create-only now.
  const openShortages = useCallback(() => {
    setMobileItem(null)
    setMobileForm(null)
    store.setEditingItem(null)
    setEditLocationTarget(null)
    setSelectedLocationId(null)
    mapRef.current?.clearSelection()
    setSignOutOpen(false)
    setImportOpen(false)
    setAuthorizedOpen(false)
    setShortageOpen(true)
  }, [store])
  const openAuthorized = useCallback(() => {
    setMobileItem(null)
    setMobileForm(null)
    store.setEditingItem(null)
    setEditLocationTarget(null)
    setSelectedLocationId(null)
    mapRef.current?.clearSelection()
    setSignOutOpen(false)
    setImportOpen(false)
    setShortageOpen(false)
    setAuthorizedOpen(true)
  }, [store])

  // Left-pane "Cluster" access section — the cluster's book views (Hand Receipt = the
  // authorized/PHR list, Shortages = the requisition report). Sits ABOVE "My property".
  // These are ACCESS points (open a right-pane/sheet morph), not creates — the FAB stays
  // create-only. Dev-gated like the rest of accountability. Row highlights when its pane is open.
  const accountabilityNav = showAccountability ? (
    <div className="flex flex-col">
      <button className={filterRowCls(authorizedOpen)} onClick={openAuthorized}>
        <span className="text-[10pt] font-medium text-primary truncate flex-1">Cluster Hand Receipt</span>
      </button>
      <button className={filterRowCls(shortageOpen)} onClick={openShortages}>
        <span className="text-[10pt] font-medium text-primary truncate flex-1">Cluster Shortages</span>
      </button>
    </div>
  ) : null

  // Mobile: focusing the header search opens the results overlay over the canvas
  // (z1020). The Custody sheet sits above it (z1200), so leave that tab first —
  // search and the sign-outs sheet are mutually exclusive surfaces.
  useEffect(() => {
    if (searchFocused) setPropertyTab('map')
  }, [searchFocused])

  // The map canvas is UNMOUNTED while the Custody tab / a roster detail shows (both
  // platforms), so mapRef is null at tap time. `cameraTo` runs the focus/navigate NOW
  // when the map is mounted (map tab), else it flips to the map tab and DEFERS the op
  // to the effect below — fired once the map remounts. Every camera-moving path (tree
  // select, search result, custody card) routes through this, so selecting from the
  // Sign-outs tab actually zooms instead of just opening the detail.
  type CameraOp = { kind: 'item' | 'zone'; id: string } | { kind: 'reset' }
  const pendingCameraRef = useRef<CameraOp | null>(null)
  const runCamera = useCallback((c: CameraOp) => {
    if (c.kind === 'item') mapRef.current?.focusItem(c.id)
    else if (c.kind === 'zone') mapRef.current?.navigateToZone(c.id)
    else mapRef.current?.resetZoom()
  }, [])
  const cameraTo = useCallback((c: CameraOp) => {
    if (propertyTab === 'map' && mapRef.current) { runCamera(c); return }
    pendingCameraRef.current = c
    setPropertyTab('map')
  }, [propertyTab, runCamera])
  useEffect(() => {
    if (propertyTab === 'map' && pendingCameraRef.current) {
      const c = pendingCameraRef.current
      pendingCameraRef.current = null
      runCamera(c)
    }
  }, [propertyTab, runCamera])

  const handleSelectItem = useCallback((item: LocalPropertyItem) => {
    // Selecting an item ALWAYS surfaces it on the canvas: drop any full-pane book view
    // (Cluster Hand Receipt / Shortages) sitting over the map, and leave the Sign-outs
    // tab — so "View" on a sign-out card (like a canvas pin tap) lands on the item on the
    // map, not behind the overlay / on the custody tab.
    setAuthorizedOpen(false)
    setShortageOpen(false)
    setPropertyTab('map')
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
      // Drill the canvas in on the item itself (not just its zone) — mirrors a canvas
      // pin tap. Deferred through cameraTo so it still fires when the item was picked
      // from the Sign-outs tab / tree while the map was unmounted.
      cameraTo({ kind: 'item', id: item.id })
    }
    // Mobile: nest the item inside the location sheet (back returns to the zone).
    if (isMobile) { setMobileItem(item); return }
    onSelectItem(item)
  }, [isMobile, onSelectItem, selectedLocationId, cameraTo])

  // Global-search / cross-domain deep-link: focus a specific item on the canvas by id.
  // Routes through handleSelectItem so the canvas navigates to the item's PARENT ZONE
  // first (breadcrumb points at the zone) and, on mobile, nests it in the location sheet
  // with a real Back target — matching an in-drawer search-result tap. Without this the
  // item deep-link opened the detail surface with no parent zone established.
  useEffect(() => {
    onRegisterFocusItem?.((itemId) => {
      const it = store.items.find((i) => i.id === itemId)
      if (it) handleSelectItem(it)
    })
  }, [onRegisterFocusItem, store.items, handleSelectItem])

  // Locate a signed-out / used / expiring item from a Custody card: clear the roster
  // panes, then surface it on the canvas (select + zoom, like any item tap).
  // handleSelectItem/cameraTo defer the camera op when the map is unmounted (custody
  // tab), so this fires correctly from the Sign-outs tab on both platforms.
  const handleLocateReceiptItem = useCallback((receiptItem: ReceiptItem) => {
    setSelectedReceiptId(null)
    setSelectedRecord(null)
    setSelectedTurnInId(null)
    const full = store.items.find(i => i.id === receiptItem.id)
    if (full) handleSelectItem(full)
    else if (receiptItem.location_id) cameraTo({ kind: 'zone', id: receiptItem.location_id })
  }, [store.items, handleSelectItem, cameraTo])

  // Locate a PMCS / dispatch record's SUBJECT from its detail's item card: a vehicle
  // record (subjectType 'location') flies to + selects the vehicle zone; a stock-item
  // PMCS focuses + selects the item.
  const handleLocateSubject = useCallback((rec: SelectedRecord) => {
    setSelectedReceiptId(null)
    setSelectedRecord(null)
    setSelectedTurnInId(null)
    if (rec.event.subjectType === 'location') { cameraTo({ kind: 'zone', id: rec.event.subjectId }); return }
    const full = store.items.find(i => i.id === rec.event.subjectId)
    if (full) handleSelectItem(full)
  }, [store.items, handleSelectItem, cameraTo])

  // Open a Custody-roster card's detail in the host surface (right pane desktop /
  // sheet mobile). Clears the other card kind + any open item/zone/form so the detail
  // is the sole occupant (mirrors the map's onSelectZone view reset on desktop).
  const closeLocationDetail = useCallback(() => {
    setSelectedLocationId(null)
    mapRef.current?.clearSelection()
  }, [])

  const handleSelectReceipt = useCallback((r: HandReceipt) => {
    setSelectedRecord(null)
    setMobileItem(null); setMobileForm(null)
    if (!isMobile && (view === 'property-detail' || view === 'property-form')) onBack()
    closeLocationDetail()
    setSelectedReceiptId(r.handReceiptId)
  }, [isMobile, view, onBack, closeLocationDetail])

  const handleSelectRecord = useCallback((record: SelectedRecord) => {
    setSelectedReceiptId(null)
    setSelectedTurnInId(null)
    setMobileItem(null); setMobileForm(null)
    if (!isMobile && (view === 'property-detail' || view === 'property-form')) onBack()
    closeLocationDetail()
    setSelectedRecord(record)
  }, [isMobile, view, onBack, closeLocationDetail])

  // Open a PENDING turn-in's detail in the host surface AND surface its first item on
  // the map + switch to the map view (per USR: tapping the card does both). focusItem
  // navigates the canvas; the turn-in pane takes render precedence over the zone detail
  // that the resulting onSelectZone sets underneath (closeRosterDetail clears it).
  const handleSelectTurnIn = useCallback((turnIn: PendingTurnIn) => {
    setSelectedReceiptId(null)
    setSelectedRecord(null)
    setMobileItem(null); setMobileForm(null)
    if (!isMobile && (view === 'property-detail' || view === 'property-form')) onBack()
    setSelectedTurnInId(turnIn.turnInDocId)
    const first = turnIn.entries[0]
    const full = first ? store.items.find((i) => i.id === first.item_id) : null
    if (full?.location_id) mapRef.current?.focusItem(full.id)
    setPropertyTab('map')
  }, [isMobile, view, onBack, store.items])

  const closeRosterDetail = useCallback(() => {
    setSelectedReceiptId(null)
    setSelectedRecord(null)
    setSelectedTurnInId(null)
    // A turn-in tap navigated the canvas (setting a zone selection underneath); clear it
    // so closing the pane returns to a clean map rather than popping the zone detail.
    // No-op for receipt/record details (they open with the zone selection already cleared).
    setSelectedLocationId(null)
    mapRef.current?.clearSelection()
  }, [])

  // Drop the open receipt when it's deleted (vanishes from the refetched list); a
  // sign-in keeps it (still present, now 'returned' → moves to the History group).
  useEffect(() => {
    if (selectedReceiptId && !receipts.some(r => r.handReceiptId === selectedReceiptId)) {
      setSelectedReceiptId(null)
    }
  }, [receipts, selectedReceiptId])

  const selectedReceipt = selectedReceiptId
    ? receipts.find(r => r.handReceiptId === selectedReceiptId) ?? null
    : null

  // The open pending turn-in, re-derived live from the pending fold so curating an
  // item shrinks it in place. Null (→ pane auto-closes) once its rows are all
  // un-staged or verified (depot completed) and leave the pending set.
  const selectedTurnIn = useMemo<PendingTurnIn | null>(() => {
    if (!selectedTurnInId) return null
    const entries = turnIns.pending.filter(e => e.hand_receipt_id === selectedTurnInId)
    return entries.length ? { turnInDocId: selectedTurnInId, entries } : null
  }, [selectedTurnInId, turnIns.pending])
  useEffect(() => {
    if (selectedTurnInId && !turnIns.pending.some(e => e.hand_receipt_id === selectedTurnInId)) {
      setSelectedTurnInId(null)
    }
  }, [turnIns.pending, selectedTurnInId])

  // Drop the WHOLE pending turn-in back onto the books — un-stage every staged item.
  const handleRemoveTurnIn = useCallback((turnIn: PendingTurnIn) => {
    for (const e of turnIn.entries) void store.unstageTurnInItem(turnIn.turnInDocId, e.item_id)
  }, [store])

  // Host-header label for an open turn-in — mirrors the card's "first item (+N more)".
  const turnInLabel = useCallback((t: PendingTurnIn) => {
    const first = t.entries[0]
    const name = first ? receiptItemsById.get(first.item_id)?.name ?? 'Item' : 'Item'
    const more = t.entries.length - 1
    return more > 0 ? `${name} · +${more} more` : name
  }, [receiptItemsById])

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

  // Scanned ZONE label (BCN-ZONE) → close the scanner + navigate the canvas to the
  // zone; navigateToZone fires onSelectZone → selectedLocationId → the zone detail
  // (where DD 1750 / Print label live). The zone sibling of handleScanLocate.
  const handleScanLocateZone = useCallback((zoneId: string) => {
    setShowScanner(false)
    // Route through cameraTo: if the scan was launched from the Sign-outs tab the map is
    // unmounted, so setPropertyTab('map') + an immediate navigateToZone races the remount
    // (mapRef still null) and no-ops. cameraTo defers the nav to the remount instead.
    cameraTo({ kind: 'zone', id: zoneId })
  }, [cameraTo])

  // Shared camera overlay (fixed inset-0) — rendered in both layouts.
  const scannerEl = showScanner ? (
    <ItemScanner
      items={store.items}
      locations={visibleLocations}
      onLocate={handleScanLocate}
      onLocateZone={handleScanLocateZone}
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
    // Route through cameraTo so a tree tap works even when the Sign-outs (custody) tab
    // is showing — the map is unmounted then (mapRef null), so a direct navigateToZone
    // is a silent no-op. cameraTo flips to the map tab and defers the nav to the remount.
    // Re-tap-to-reset only applies when the map is already the live surface.
    if (propertyTab === 'map' && selectedLocationId === loc.id) mapRef.current?.resetZoom()
    else cameraTo({ kind: 'zone', id: loc.id })
  }, [propertyTab, selectedLocationId, cameraTo])

  const openLocMenu = useCallback((e: React.MouseEvent) => {
    setLocMenu({ rect: e.currentTarget.getBoundingClientRect() })
  }, [])

  // Breadcrumb (in the detail header) → navigate the canvas to an ancestor zone,
  // or to root. Leaving any open item/form first so the target zone surfaces.
  const handleBreadcrumbNavigate = useCallback((id: string | null) => {
    if (isMobile) {
      setMobileItem(null); closeMobileForm()
      if (id) {
        // Parent crumb → morph the sheet into the parent zone's detail.
        mapRef.current?.navigateToZone(id)
      } else {
        // Root crumb lands back on the TREE step (step 0), not bare map: clear the
        // selection + frame the overview so the merged sheet re-shows the tree.
        closeLocationDetail(); mapRef.current?.resetZoom(); setShowLocations(true)
      }
      return
    }
    if (view === 'property-detail' || view === 'property-form') onBack()
    if (id) mapRef.current?.navigateToZone(id)
    else mapRef.current?.resetZoom()
  }, [isMobile, view, onBack, closeMobileForm, closeLocationDetail])

  const handleConfirmDeleteItem = useCallback(async () => {
    if (!pendingDeleteItem) return
    await store.removeItem(pendingDeleteItem.id)
    setPendingDeleteItem(null)
  }, [pendingDeleteItem, store])

  const handleConfirmDeleteTurnIn = useCallback(async () => {
    if (!pendingDeleteTurnIn) return
    await store.deleteTurnInDoc(pendingDeleteTurnIn.turnInDocId)
    setPendingDeleteTurnIn(null)
  }, [pendingDeleteTurnIn, store])

  // ── Shared item action menu ──
  // The single item context menu (View · Edit · Split/Merge · Expend · PMCS · Visual
  // ID · Share · Stage turn-in · Delete) + its co-located sheets live in ItemActionMenu,
  // mounted once per layout below and opened imperatively from every surface (tree rows,
  // Custody item cards, item detail header). `view` gates the leading "View" row — on
  // for surfaces not already showing the item, off on the item detail itself.
  const openItemMenu = useCallback(
    (item: LocalPropertyItem, rect: DOMRect, opts?: { view?: boolean }) =>
      itemActionRef.current?.openMenu(item, rect, opts),
    [],
  )
  // Custody cards carry the lean ReceiptItem; resolve the full store item before
  // opening the shared menu (which operates on LocalPropertyItem).
  const resolveStoreItem = useCallback(
    (ri: ReceiptItem) => store.items.find((i) => i.id === ri.id) ?? null,
    [store.items],
  )
  const openReceiptItemMenu = useCallback((ri: ReceiptItem, rect: DOMRect) => {
    const full = resolveStoreItem(ri)
    if (full) openItemMenu(full, rect, { view: true })
  }, [resolveStoreItem, openItemMenu])

  // Delete a PMCS/dispatch audit record — hard-removes the row through the store
  // (same path as PropertyRecordDetail), confirmed via the ConfirmDialog below.
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState<AuditEvent | null>(null)
  const handleConfirmDeleteRecord = useCallback(async () => {
    const ev = pendingDeleteRecord
    setPendingDeleteRecord(null)
    if (!ev) return
    await store.deletePmcsEntry(ev.id)
    if (selectedRecord?.event.id === ev.id) closeRosterDetail()
  }, [pendingDeleteRecord, store, selectedRecord, closeRosterDetail])

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
      items={displayItems}
      onCreateLocation={store.addLocation}
      onDeleteLocation={store.removeLocation}
      onEditItem={(id, updates) => store.editItem(id, updates)}
      onUpdateLocation={(id, updates) => store.editLocation(id, updates)}
      onSelectItem={handleSelectItem}
      // Authoritative "open item" signal for the map: whichever item detail is
      // currently showing (mobile sheet or desktop pane). When it closes (back-to-zone,
      // empty-canvas, tab switch) this goes null and the map drops its lit pin + returns
      // to zone framing — otherwise the item indicator lingers after you leave it.
      selectedItem={isMobile ? mobileItem : ((view === 'property-detail' || view === 'property-form') ? selectedItem : null)}
      onCreateItem={() => handleAddItemAtLocation(null)}
      onSelectZone={(id) => {
        setSelectedLocationId(id)
        // Selecting a zone on the canvas takes over the right pane — drop any full-pane
        // book view (Cluster Hand Receipt / Shortages) sitting over the map so the zone
        // detail surfaces instead of staying hidden behind that overlay.
        if (id) { setAuthorizedOpen(false); setShortageOpen(false) }
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
    onDelete: () => setPendingDeleteLocId(loc.id),
    onPmcs: () => locDetailRef.current?.openPmcs(),
    onDispatch: () => locDetailRef.current?.openDispatch(),
    onDD1750: () => locDetailRef.current?.openDD1750(),
    onPrintLabel: () => locDetailRef.current?.openPrintLabel(),
  })

  // Trayed FAB in a positioning wrapper — matches Calendar/Admin's add FAB
  // (bordered translucent tray, md size). The SAB padding rides the wrapper.
  const addFab = onOpenAddSheet ? (
    <div className="absolute bottom-4 right-4 z-30 pb-[max(0rem,var(--sab,0px))] pointer-events-none">
      <AddFab
        label="Add"
        onClick={onOpenAddSheet}
      />
    </div>
  ) : null

  // Mobile variant — placed inside BottomIsland's fab slot (the island owns the
  // bottom/safe-area offset, so the fab just needs horizontal placement).
  const islandFab = onOpenAddSheet ? (
    <AddFab label="Add" onClick={onOpenAddSheet} className="absolute right-4" />
  ) : null

  // The one shared item action menu + its co-located sheets — mounted once per layout
  // (desktop / mobile) below and opened from the tree, Custody item cards, and the item
  // detail header via openItemMenu. Host actions reuse the existing item flows; the
  // self-contained actions (mark-as-mine, split/merge, expend, PMCS, share) live inside.
  const itemActionMenuEl = (
    <>
      <ItemActionMenu
        ref={itemActionRef}
        items={store.items}
        locations={visibleLocations}
        containerRef={panelRef}
        onView={handleSelectItem}
        onEdit={handleEditItemRow}
        onDelete={onDeleteItem ? (it) => setPendingDeleteItem(it) : undefined}
        canDelete={!!onDeleteItem}
        onEnroll={onEnrollItem ? (it) => onEnrollItem(it) : undefined}
        onStageTurnIn={onDeleteItem ? (it) => handleStageTurnIn(it) : undefined}
      />
    </>
  )

  // The bottom-island tabs (Map · Camera · Sign-outs) — identical on both platforms.
  // Map/Sign-outs are persistent tabs (drive propertyTab); Camera is momentary (opens
  // the scanner overlay, which returns to the map). The location tree is NOT a tab.
  const renderTabs = () => (
    <>
      <IslandButton role="tab" active={propertyTab === 'map'} onClick={() => { closeRosterDetail(); setPropertyTab('map') }} label="Map">
        <MapIcon className="w-5 h-5" />
      </IslandButton>
      <IslandButton role="tab" onClick={() => setShowScanner(true)} label="Camera">
        <Camera className="w-5 h-5" />
      </IslandButton>
      {showAccountability && (
        <IslandButton role="tab" active={propertyTab === 'custody'} onClick={() => { setMobileItem(null); setMobileForm(null); closeLocationDetail(); closeRosterDetail(); setPropertyTab('custody') }} label="Sign-outs">
          <ClipboardList className="w-5 h-5" />
        </IslandButton>
      )}
    </>
  )

  // ── Mobile form MORPH stack ──────────────────────────────────────────────
  // The one mobile property Sheet has no StackNavContext of its own, so a form's
  // pickers used to fall back to a centered nested PreviewOverlay. Host the ACTIVE
  // form as the root frame of the shared drill engine (useStack): its PickerInputs /
  // DatePickerInputs (and SignOutForm's stack-aware pickers) morph the SAME sheet in
  // place. One scoped stack for whichever form is open — the sheet still owns the
  // tree/detail/task surfaces. Hook runs unconditionally (before the desktop return);
  // idle on desktop, where the forms render in the right pane with popover pickers.
  const activeForm =
    authorizedOpen && authForm ? (
      <PropertyItemForm
        ref={authFormRef}
        editingItem={authForm.item}
        showAuthorized
        initialParentId={authForm.parentId}
        onClose={closeAuthMorph}
        onSavingChange={setFormSaving}
      />
    ) : signOutOpen ? (
      <SignOutForm ref={signOutFormRef} onClose={() => setSignOutOpen(false)} onSavingChange={setFormSaving} />
    ) : mobileForm?.kind === 'item' ? (
      <PropertyItemForm
        ref={itemFormRef}
        editingItem={store.editingItem}
        onClose={closeMobileForm}
        onEnrollNew={onEnrollNewItem}
        onSavingChange={setFormSaving}
      />
    ) : mobileForm?.kind === 'location' ? (
      <PropertyLocationForm
        ref={locationFormRef}
        editingLocation={mobileForm.loc}
        defaultParentId={mobileForm.parentId}
        pendingTag={mobileForm.pendingTag}
        onClose={() => setMobileForm(null)}
        onSavingChange={setFormSaving}
      />
    ) : null
  // Re-root the stack whenever the active form identity changes (useStack resets on
  // isOpen OR initial.key change), so switching between forms starts fresh.
  const formKey =
    authorizedOpen && authForm ? `auth:${authForm.item?.id ?? 'new'}:${authForm.parentId ?? ''}`
    : signOutOpen ? 'signout'
    : mobileForm?.kind === 'item' ? `item:${store.editingItem?.id ?? 'new'}`
    : mobileForm?.kind === 'location' ? `location:${mobileForm.loc?.id ?? 'new'}`
    : 'none'
  const formStack = useStack({
    isOpen: activeForm != null,
    initial: { key: formKey },
    screens: { [formKey]: { render: () => activeForm } },
  })
  // Drilled = a picker pushed a screen over the form root; the sheet header swaps to
  // Back + the picker title while drilled.
  const formDrilled = activeForm != null && formStack.canBack
  const formBody = (
    <StackNavContext.Provider value={formStack.nav}>
      <LayeredStackBody frames={formStack.frames} searchPlaceholder={formStack.searchPlaceholder} />
    </StackNavContext.Provider>
  )

  // Desktop layout — left rail (location tree) · center map · right pane (detail/form),
  // mirroring MapOverlayPanel: the rail collapses while the right pane is open.
  if (!isMobile) {
    const railCollapsed = view === 'property-form' || view === 'property-detail' || !!editLocationTarget || !!selectedLocation || signOutOpen || importOpen || shortageOpen || authorizedOpen || !!da2062Preview || !!selectedReceipt || !!selectedRecord || !!selectedTurnIn
    // When the rail search has a query, the results take over the CENTER pane
    // (mirrors mobile's overlay) instead of filtering the rail tree in place. The
    // rail keeps the full tree for navigation context; results route to the right pane.
    const desktopSearching = desktopSearch.trim().length > 0
    return (
      <>
        <div ref={panelRef} className="flex h-full relative">
          <div className={`shrink-0 border-r border-tertiary/10 flex flex-col bg-themewhite3/50 transition-all duration-300 ${
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
            {/* Filter + tree share this rail (the desktop equivalent of the mobile
                Locations sheet) — one entry point for both. Both live in ONE scroll
                region (mirrors the calendar sidebar: only search + picker stay pinned),
                so the filter rows scroll WITH the tree instead of pinning the rail and
                starving the tree's scroll window. */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {accountabilityNav}
              {propertyFilterPanel}
              {sectionHeader('Zones')}
              <PropertyLocationTree
                locations={treeLocations}
                items={displayItems}
                clinicName={clinicName}
                holders={store.holders}
                searchQuery=""
                hoverActions
                activeLocationId={selectedLocationId}
                onSelectLocation={handleSelectLocationDesktop}
                onSelectItem={handleSelectItem}
                onSelectAll={() => cameraTo({ kind: 'reset' })}
                allSelected={!selectedLocationId}
                onEditLocation={handleEditLocation}
                onOpenItemMenu={(item, rect) => openItemMenu(item, rect, { view: true })}
                onDeleteLocation={onDeleteItem ? (locId) => setPendingDeleteLocId(locId) : undefined}
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
                onLocateItem={handleLocateReceiptItem}
                onSelectReceipt={handleSelectReceipt}
                onSelectRecord={handleSelectRecord}
                onOpenItemMenu={openReceiptItemMenu}
                onDeleteReceipt={onDeleteItem ? setPendingDeleteReceipt : undefined}
                onDeleteRecord={onDeleteItem ? setPendingDeleteRecord : undefined}
                turnIns={turnIns}
                onSelectTurnIn={onDeleteItem ? handleSelectTurnIn : undefined}
                onViewTurnIn={handleViewTurnIn}
                onDeleteTurnIn={onDeleteItem ? setPendingDeleteTurnIn : undefined}
                selectedTurnInId={selectedTurnInId}
                selectedReceiptId={selectedReceiptId}
                selectedRecordId={selectedRecord?.event.id ?? null}
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
                    showReceipts={showAccountability}
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
              >
                {renderTabs()}
              </BottomIsland>
            )}
          </div>

          <div ref={detailPaneRef} className={`shrink-0 border-l border-primary/10 flex flex-col bg-themewhite3 transition-all duration-300 relative ${
            railCollapsed ? 'w-[380px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'
          }`}>
            <LoadingOverlay visible={formSaving} />
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
                    onSavingChange={setFormSaving}
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
                  <SignOutForm ref={signOutFormRef} onClose={() => setSignOutOpen(false)} onSavingChange={setFormSaving} />
                </div>
              </>
            )}
            {!editLocationTarget && !signOutOpen && !selectedReceipt && !selectedRecord && !selectedTurnIn && view === 'property-detail' && selectedItem && (
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
                    <span className="inline-flex" onClick={(e) => openItemMenu(selectedItem, (e.currentTarget as HTMLElement).getBoundingClientRect())}>
                      <PillButton icon={MoreHorizontal} iconSize={16} onClick={() => {}} label="More actions" />
                    </span>
                    <PillButton icon={X} iconSize={16} onClick={() => { onBack(); closeLocationDetail() }} label="Close" />
                  </HeaderPill>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <PropertyItemDetail
                    item={selectedItem}
                    locations={visibleLocations}
                    holders={store.holders}
                    items={store.items}
                    onLocateFiller={handleSelectItem}
                  />
                </div>
              </>
            )}
            {!editLocationTarget && !signOutOpen && !selectedReceipt && !selectedRecord && !selectedTurnIn && view === 'property-form' && (
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
                    onSavingChange={setFormSaving}
                  />
                </div>
              </>
            )}
            {!editLocationTarget && !signOutOpen && !selectedReceipt && !selectedRecord && !selectedTurnIn && view === 'property' && selectedLocation && (
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
                    onOpenItemMenu={(item, rect) => openItemMenu(item, rect, { view: true })}
                    onDeleteLocation={onDeleteItem ? (locId) => setPendingDeleteLocId(locId) : undefined}
                    onAddChildLocation={handleAddChildLocation}
                    onAddItemAtLocation={handleAddItemAtLocation}
                    drawerRef={panelRef}
                  />
                </div>
              </>
            )}
            {/* DA 2062 hand receipt — opened from a Custody-roster card. Header
                mirrors the item detail (recipient + status·date, More menu, Close);
                body is the receipt's item rows. */}
            {!editLocationTarget && !signOutOpen && selectedReceipt && (
              <>
                <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-tertiary/10">
                  <div className="flex-1 min-w-0">
                    <p className="text-[9pt] text-tertiary mb-0.5">{da2062DetailSubtitle(selectedReceipt)}</p>
                    <p className="truncate text-sm font-medium text-primary">{selectedReceipt.recipientLabel}</p>
                  </div>
                  <HeaderPill>
                    <span className="inline-flex" onClick={(e) => da2062DetailRef.current?.openMenu((e.currentTarget as HTMLElement).getBoundingClientRect())}>
                      <PillButton icon={MoreHorizontal} iconSize={16} onClick={() => {}} label="More actions" />
                    </span>
                    <PillButton icon={X} iconSize={16} onClick={closeRosterDetail} label="Close" />
                  </HeaderPill>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <Da2062Detail
                    ref={da2062DetailRef}
                    receipt={selectedReceipt}
                    clinicId={store.clinicId!}
                    itemsById={receiptItemsById}
                    locationNameById={receiptLocationNameById}
                    membersById={receiptMembersById}
                    refetch={refetchReceipts}
                    receipts={receipts}
                    onLocateItem={handleLocateReceiptItem}
                    onReprint={handleReprint}
                    drawerRef={panelRef}
                  />
                </div>
              </>
            )}
            {/* PMCS / dispatch record — opened from a Custody-roster card. */}
            {!editLocationTarget && !signOutOpen && !selectedReceipt && selectedRecord && (
              <>
                <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-tertiary/10">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-primary">{selectedRecord.label}</p>
                    <p className="truncate text-[9pt] text-tertiary mt-0.5">{selectedRecord.detail}</p>
                  </div>
                  <HeaderPill>
                    <span className="inline-flex" onClick={(e) => recordDetailRef.current?.openMenu((e.currentTarget as HTMLElement).getBoundingClientRect())}>
                      <PillButton icon={MoreHorizontal} iconSize={16} onClick={() => {}} label="More actions" />
                    </span>
                    <PillButton icon={X} iconSize={16} onClick={closeRosterDetail} label="Close" />
                  </HeaderPill>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <PropertyRecordDetail
                    ref={recordDetailRef}
                    record={selectedRecord}
                    onDeleted={closeRosterDetail}
                    onLocateSubject={() => handleLocateSubject(selectedRecord)}
                  />
                </div>
              </>
            )}
            {/* Pending DA 3161 turn-in — opened from a Custody-roster Turn-In card. Header
                mirrors the record detail (first item + "Pending turn-in", More menu, Close);
                body is the turn-in's item rows with curate / complete / remove. */}
            {!editLocationTarget && !signOutOpen && !selectedReceipt && !selectedRecord && selectedTurnIn && (
              <>
                <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-tertiary/10">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-primary">{turnInLabel(selectedTurnIn)}</p>
                    <p className="truncate text-[9pt] text-tertiary mt-0.5">Pending turn-in</p>
                  </div>
                  <HeaderPill>
                    <span className="inline-flex" onClick={(e) => turnInDetailRef.current?.openMenu((e.currentTarget as HTMLElement).getBoundingClientRect())}>
                      <PillButton icon={MoreHorizontal} iconSize={16} onClick={() => {}} label="More actions" />
                    </span>
                    <PillButton icon={X} iconSize={16} onClick={closeRosterDetail} label="Close" />
                  </HeaderPill>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <PropertyTurnInDetail
                    ref={turnInDetailRef}
                    turnIn={selectedTurnIn}
                    itemsById={receiptItemsById}
                    onUnstageItem={(itemId) => handleUnstageTurnInItem(selectedTurnIn.turnInDocId, itemId)}
                    onComplete={() => handleVerifyTurnIn(selectedTurnIn.turnInDocId)}
                    onRemove={() => handleRemoveTurnIn(selectedTurnIn)}
                    onClose={closeRosterDetail}
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
            {/* Shortages / requisition report — sole occupant of the right pane, same
                overlay treatment as CSV import. */}
            {shortageOpen && (
              <div className="absolute inset-0 z-10 flex flex-col bg-themewhite3">
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-tertiary/10">
                  <p className="text-sm font-medium text-primary truncate">Shortages</p>
                  <HeaderPill>
                    <span className="inline-flex" onClick={(e) => shortageRef.current?.openMenu((e.currentTarget as HTMLElement).getBoundingClientRect())}>
                      <PillButton icon={MoreHorizontal} iconSize={16} onClick={() => {}} label="More actions" />
                    </span>
                    <PillButton icon={X} iconSize={16} onClick={() => setShortageOpen(false)} label="Close" />
                  </HeaderPill>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="px-4 py-4 pb-8">
                    <PropertyShortagePanel ref={shortageRef} onClose={() => setShortageOpen(false)} stagedTurnInIds={turnInItemIds} onLocate={handleSelectItem} />
                  </div>
                </div>
              </div>
            )}
            {/* Authorized items (BOM) manager — sole occupant of the right pane, same
                overlay treatment as CSV import / Shortages. */}
            {authorizedOpen && (
              <div className="absolute inset-0 z-10 flex flex-col bg-themewhite3">
                <LoadingOverlay visible={formSaving} />
                <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-tertiary/10">
                  {authForm || authView || authImport ? (
                    // Morph header — back returns to the list; Save persists a form.
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <button onClick={closeAuthMorph} aria-label="Back" className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all shrink-0">
                          <ChevronLeft size={20} />
                        </button>
                        <p className="text-sm font-medium text-primary truncate">
                          {authForm ? (authForm.item ? 'Edit authorized item' : 'Add authorized item') : authView ? authView.name : 'Import Property CSV'}
                        </p>
                      </div>
                      <HeaderPill>
                        {authForm && <PillButton icon={Check} iconSize={16} accent="success" onClick={() => authFormRef.current?.submit()} label="Save" />}
                        {authView && (
                          <span className="inline-flex" onClick={(e) => setAuthViewMenu({ rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}>
                            <PillButton icon={MoreHorizontal} iconSize={16} onClick={() => {}} label="More actions" />
                          </span>
                        )}
                        <PillButton icon={X} iconSize={16} onClick={() => setAuthorizedOpen(false)} label="Close" />
                      </HeaderPill>
                    </>
                  ) : (
                    // List header — Import (its only "more action", morphs in place) left;
                    // add + close right.
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <PillButton icon={Download} iconSize={16} onClick={openAuthImport} label="Import from CSV" />
                        <p className="text-sm font-medium text-primary truncate">Authorized items</p>
                      </div>
                      <HeaderPill>
                        <PillButton icon={Plus} iconSize={16} onClick={openAuthAdd} label="Add authorized item" />
                        <PillButton icon={X} iconSize={16} onClick={() => setAuthorizedOpen(false)} label="Close" />
                      </HeaderPill>
                    </>
                  )}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="px-4 py-4 pb-8">
                    {authForm ? (
                      <PropertyItemForm
                        ref={authFormRef}
                        editingItem={authForm.item}
                        showAuthorized
                        initialParentId={authForm.parentId}
                        onClose={closeAuthMorph}
                        onSavingChange={setFormSaving}
                      />
                    ) : authView ? (
                      <PropertyItemDetail
                        item={authView}
                        locations={visibleLocations}
                        holders={store.holders}
                        items={store.items}
                        onViewComponent={openAuthView}
                        onEditComponent={openAuthEdit}
                        onDeleteComponent={deauthorizeComponent}
                        onLocateFiller={handleSelectItem}
                      />
                    ) : authImport ? (
                      <PropertyCSVImport onClose={closeAuthMorph} />
                    ) : (
                      <PropertyAuthorizedPanel
                        onClose={() => setAuthorizedOpen(false)}
                        onEdit={openAuthEdit}
                        onView={openAuthView}
                      />
                    )}
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
        {/* Auth-view header ellipsis — LIN: Add item (to LIN) + Edit LIN; component/item: Edit. */}
        {authViewMenu && authView && (
          <LiftedRowMenu
            isOpen
            anchorRect={authViewMenu.rect}
            onClose={() => setAuthViewMenu(null)}
            layout="list"
            align="right"
            items={
              isLinContainer(authView)
                ? [
                    { key: 'add', label: 'Add item', icon: Plus, onAction: () => openAuthAddChild(authView.id) },
                    { key: 'edit', label: 'Edit LIN', icon: Pencil, onAction: () => openAuthEdit(authView) },
                  ]
                : [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => openAuthEdit(authView) }]
            }
          />
        )}
        {itemActionMenuEl}

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
        <ConfirmDialog
          visible={!!pendingDeleteReceipt}
          title="Delete this hand receipt? The items return to the property book."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={confirmDeleteReceipt}
          onCancel={() => setPendingDeleteReceipt(null)}
        />
        <ConfirmDialog
          visible={!!pendingDeleteTurnIn}
          title="Delete this DA 3161? The record is removed; the turned-in equipment is not restored."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleConfirmDeleteTurnIn}
          onCancel={() => setPendingDeleteTurnIn(null)}
        />
        <ConfirmDialog
          visible={!!pendingDeleteRecord}
          title="Delete this record? This cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleConfirmDeleteRecord}
          onCancel={() => setPendingDeleteRecord(null)}
        />
        {scannerEl}
      </>
    )
  }

  // Mobile layout — full-screen canvas; the header "Locations" button opens the
  // ONE morphing detail Sheet at its tree step. Selecting a zone/item MORPHS the
  // same sheet into that node's detail (the breadcrumb walks the hierarchy back
  // up; the root crumb lands back on the tree). The tree is step 0, not a separate
  // sheet — so there is no "which sheet is open" ambiguity.
  // `detailOpen` = any zone/item/task surface is active; `treeStep` = the sheet is
  // open but nothing is selected → show the tree.
  const detailOpen =
    !!selectedLocation || !!mobileItem || !!mobileForm || !!selectedReceipt ||
    !!selectedRecord || !!selectedTurnIn || signOutOpen || importOpen ||
    shortageOpen || authorizedOpen || !!da2062Preview
  const treeStep = showLocations && !detailOpen
  // The non-blocking mobile sheet covers the bottom of the canvas. Publish its covered
  // height (px) as a CSS var on the map's ancestor so the canvas frames a focused item
  // pin in the VISIBLE band above the sheet (else zoom-to-item centres it in the full
  // viewport → tucked under the sheet). Blocking task sheets (PDF/sign-out/import/
  // shortage) dim the whole canvas, so no inset there. Mirrors the Sheet's maxHeight.
  const sheetOverMap = (showLocations || detailOpen) && !drawingZone
    && !(da2062Preview || signOutOpen || importOpen || shortageOpen || authorizedOpen)
  const mobileSheetMaxVh = treeStep ? 70 : mobileForm ? 60 : 50
  const mapBottomInsetPx = sheetOverMap
    ? Math.min((mobileSheetMaxVh / 100) * window.innerHeight, window.innerHeight - 24)
    : 0
  return (
    <>
      <div
        className="h-full relative"
        style={{ '--property-map-bottom-inset': `${mapBottomInsetPx}px` } as CSSProperties}
      >
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
              onLocateItem={handleLocateReceiptItem}
              onSelectReceipt={handleSelectReceipt}
              onSelectRecord={handleSelectRecord}
              onOpenItemMenu={openReceiptItemMenu}
              onDeleteReceipt={onDeleteItem ? setPendingDeleteReceipt : undefined}
              onDeleteRecord={onDeleteItem ? setPendingDeleteRecord : undefined}
              turnIns={turnIns}
              onSelectTurnIn={onDeleteItem ? handleSelectTurnIn : undefined}
              onViewTurnIn={handleViewTurnIn}
              onDeleteTurnIn={onDeleteItem ? setPendingDeleteTurnIn : undefined}
              selectedTurnInId={selectedTurnInId}
              selectedReceiptId={selectedReceiptId}
              selectedRecordId={selectedRecord?.event.id ?? null}
            />
          </div>
        ) : (
          <>
            {mapEl}
            <LoadingOverlay visible={showLoading} />
          </>
        )}
        {/* Personnel carousel — only at the ROOT overview; collapses on zone select.
            Offset below the floating drawer header (rides the canvas top). */}
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
          showReceipts={showAccountability}
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
          >
            {renderTabs()}
          </BottomIsland>
        )}
      </div>

      {/* THE morphing property sheet (mirrors the map overlay's feature sheet):
          fit height capped, no backdrop so the canvas stays interactive. Step 0 is
          the location TREE (treeStep); selecting a zone/item morphs this SAME sheet
          into that node's detail (height-transition), and the breadcrumb walks the
          hierarchy back up — parent → root crumb lands back on the tree. Forms/tasks
          nest as leaf steps whose back = close. One sheet, no separate tree sheet. */}
      <Sheet
        loading={formSaving}
        isOpen={(showLocations || detailOpen) && !drawingZone}
        onClose={() => { closeMobileForm(); setMobileItem(null); closeLocationDetail(); closeRosterDetail(); setSignOutOpen(false); setImportOpen(false); setShortageOpen(false); setAuthorizedOpen(false); clearDA2062Preview(); setShowLocations(false) }}
        title={
          formDrilled
            ? formStack.title
            : treeStep
            ? 'Locations'
            : da2062Preview
            ? da2062Preview.filename
            : importOpen
            ? 'Import Property CSV'
            : shortageOpen
            ? 'Shortages'
            : authorizedOpen
            ? (authForm ? (authForm.item ? 'Edit authorized item' : 'Add authorized item') : authView ? authView.name : authImport ? 'Import Property CSV' : 'Authorized items')
            : signOutOpen
            ? 'New DA 2062'
            : selectedReceipt
            ? selectedReceipt.recipientLabel
            : selectedRecord
            ? selectedRecord.label
            : selectedTurnIn
            ? turnInLabel(selectedTurnIn)
            : mobileForm
              ? (mobileForm.kind === 'item'
                  ? (store.editingItem ? 'Edit Item' : 'New Item')
                  : (mobileForm.loc ? 'Edit Location' : 'New Location'))
              : mobileItem ? mobileItem.name : (selectedLocation?.name ?? '')
        }
        titleNode={
          formDrilled ? undefined :
          selectedReceipt ? (
            <div className="min-w-0">
              <span className="block text-[9pt] text-tertiary mb-0.5">{da2062DetailSubtitle(selectedReceipt)}</span>
              <span className="block truncate text-[13pt] font-semibold text-primary">{selectedReceipt.recipientLabel}</span>
            </div>
          ) : selectedRecord ? (
            <div className="min-w-0">
              <span className="block truncate text-[13pt] font-semibold text-primary">{selectedRecord.label}</span>
              <span className="block truncate text-[9pt] text-tertiary mt-0.5">{selectedRecord.detail}</span>
            </div>
          ) : selectedTurnIn ? (
            <div className="min-w-0">
              <span className="block truncate text-[13pt] font-semibold text-primary">{turnInLabel(selectedTurnIn)}</span>
              <span className="block truncate text-[9pt] text-tertiary mt-0.5">Pending turn-in</span>
            </div>
          ) : !mobileForm && (mobileItem || selectedLocation) ? (
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
        // Detail views (item / zone / receipt / record / turn-in) stay compact so
        // the sheet doesn't dominate the map — the timeline-heavy item view no longer
        // balloons to fill the cap. Editing (forms) + focused tasks expand to 85.
        // Tree 70 · big task surfaces (PDF/sign-out/import/shortage) 85 · edit form
        // just above the 50 detail view (fields scroll internally, sheet doesn't
        // balloon) · detail 50.
        // Authorized morph mirrors the standalone item surfaces: its edit/add FORM caps
        // at 60 (like mobileForm) and its read-only VIEW at 50 (like the item detail); only
        // the authorized LIST itself is a big task surface at 85.
        maxHeight={formDrilled ? 85 : treeStep ? 70 : authorizedOpen ? (authForm ? 60 : authView ? 50 : 60) : shortageOpen ? 60 : da2062Preview || signOutOpen || importOpen ? 85 : mobileForm ? 60 : 50}
        // Detail/form are non-blocking like the map's mobile feature editor: the
        // canvas stays interactive and the body swaps detail↔form in the SAME sheet.
        // Sign-out is a focused task, so dim the canvas (non-dismissing) to block
        // stray taps from selecting items behind it.
        backdrop={da2062Preview || signOutOpen || importOpen || shortageOpen || authorizedOpen ? 'block' : 'none'}
        zIndex={1200}
        // While a picker is drilled the Back chevron owns reversal; a stray drag must
        // not dismiss the whole sheet mid-selection (matches SheetStack).
        draggable={!formDrilled}
        leftContent={
          formDrilled ? (
            <button onClick={formStack.onBack} aria-label="Back" className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all">
              <ChevronLeft size={20} />
            </button>
          ) : mobileForm ? (
            <button onClick={closeMobileForm} aria-label="Cancel" className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all">
              <ChevronLeft size={20} />
            </button>
          ) : authorizedOpen ? (
            (authForm || authView || authImport) ? (
              <button onClick={closeAuthMorph} aria-label="Back" className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all">
                <ChevronLeft size={20} />
              </button>
            ) : (
              <HeaderPill>
                <PillButton icon={Download} iconSize={18} onClick={openAuthImport} label="Import from CSV" />
              </HeaderPill>
            )
          ) : (mobileItem || selectedLocation || selectedReceipt || selectedRecord || selectedTurnIn) ? (
            <HeaderPill>
              <span
                className="inline-flex"
                onClick={
                  selectedReceipt
                    ? (e) => da2062DetailRef.current?.openMenu((e.currentTarget as HTMLElement).getBoundingClientRect())
                    : selectedRecord
                    ? (e) => recordDetailRef.current?.openMenu((e.currentTarget as HTMLElement).getBoundingClientRect())
                    : selectedTurnIn
                    ? (e) => turnInDetailRef.current?.openMenu((e.currentTarget as HTMLElement).getBoundingClientRect())
                    : mobileItem
                    ? (e) => openItemMenu(mobileItem, (e.currentTarget as HTMLElement).getBoundingClientRect())
                    : openLocMenu
                }
              >
                <PillButton icon={MoreHorizontal} iconSize={18} onClick={() => {}} label="More actions" />
              </span>
            </HeaderPill>
          ) : undefined
        }
        actions={
          formDrilled ? (
            formStack.rightFooter ?? undefined
          ) : da2062Preview ? (
            <PillButton icon={Download} iconSize={18} accent="info" onClick={saveReprint} label="Save" />
          ) : shortageOpen ? (
            <span className="inline-flex" onClick={(e) => shortageRef.current?.openMenu((e.currentTarget as HTMLElement).getBoundingClientRect())}>
              <PillButton icon={MoreHorizontal} iconSize={18} onClick={() => {}} label="More actions" />
            </span>
          ) : signOutOpen ? (
            <PillButton icon={Check} iconSize={18} accent="success" onClick={() => signOutFormRef.current?.submit()} label="Sign out" />
          ) : authorizedOpen ? (
            // + folds before the sheet's built-in Close → "+ · close" on the right;
            // Save while a form is morphed in; nothing while viewing or importing.
            authForm ? (
              <PillButton icon={Check} iconSize={18} accent="success" onClick={() => authFormRef.current?.submit()} label="Save" />
            ) : authImport ? undefined : authView ? (
              <span className="inline-flex" onClick={(e) => setAuthViewMenu({ rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}>
                <PillButton icon={MoreHorizontal} iconSize={18} onClick={() => {}} label="More actions" />
              </span>
            ) : (
              <PillButton icon={Plus} iconSize={18} onClick={openAuthAdd} label="Add authorized item" />
            )
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
        {treeStep ? (
          // Step 0 — the location tree. Selecting a zone/item morphs THIS sheet into
          // that node's detail; the breadcrumb walks back up to here. The filter +
          // tree share this step (same set the personnel carousel shows).
          <>
            {accountabilityNav}
            {propertyFilterPanel}
            {sectionHeader('Zones')}
            <PropertyLocationTree
              locations={treeLocations}
              items={displayItems}
              clinicName={clinicName}
              activeLocationId={selectedLocationId}
              allSelected={!selectedLocationId}
              onSelectAll={() => cameraTo({ kind: 'reset' })}
              onSelectLocation={(loc) => cameraTo({ kind: 'zone', id: loc.id })}
              onSelectItem={(item) => handleSelectItem(item)}
              onEditLocation={handleEditLocation}
              onOpenItemMenu={(item, rect) => openItemMenu(item, rect, { view: true })}
              onDeleteLocation={onDeleteItem ? (locId) => setPendingDeleteLocId(locId) : undefined}
              onAddChildLocation={handleAddChildLocation}
              onAddLevel={(id) => mapRef.current?.addFloorTo(id)}
              onAddItemAtLocation={handleAddItemAtLocation}
            />
          </>
        ) : da2062Preview ? (
          <div className="h-[70vh]">
            <Da2062PdfView preview={da2062Preview} />
          </div>
        ) : importOpen ? (
          <PropertyCSVImport onClose={() => setImportOpen(false)} />
        ) : shortageOpen ? (
          <PropertyShortagePanel ref={shortageRef} onClose={() => setShortageOpen(false)} stagedTurnInIds={turnInItemIds} onLocate={handleSelectItem} />
        ) : authorizedOpen ? (
          authForm ? (
            formBody
          ) : authView ? (
            <PropertyItemDetail
              item={authView}
              locations={visibleLocations}
              holders={store.holders}
              items={store.items}
              onViewComponent={openAuthView}
              onEditComponent={openAuthEdit}
              onDeleteComponent={deauthorizeComponent}
              onLocateFiller={handleSelectItem}
            />
          ) : authImport ? (
            <PropertyCSVImport onClose={closeAuthMorph} />
          ) : (
            <PropertyAuthorizedPanel
              onClose={() => setAuthorizedOpen(false)}
              onEdit={openAuthEdit}
              onView={openAuthView}
            />
          )
        ) : signOutOpen ? (
          formBody
        ) : selectedReceipt ? (
          <Da2062Detail
            ref={da2062DetailRef}
            receipt={selectedReceipt}
            clinicId={store.clinicId!}
            itemsById={receiptItemsById}
            locationNameById={receiptLocationNameById}
            membersById={receiptMembersById}
            refetch={refetchReceipts}
            receipts={receipts}
            onLocateItem={handleLocateReceiptItem}
            onReprint={handleReprint}
            drawerRef={panelRef}
          />
        ) : selectedRecord ? (
          <PropertyRecordDetail
            ref={recordDetailRef}
            record={selectedRecord}
            onDeleted={closeRosterDetail}
            onLocateSubject={() => handleLocateSubject(selectedRecord)}
          />
        ) : selectedTurnIn ? (
          <PropertyTurnInDetail
            ref={turnInDetailRef}
            turnIn={selectedTurnIn}
            itemsById={receiptItemsById}
            onUnstageItem={(itemId) => handleUnstageTurnInItem(selectedTurnIn.turnInDocId, itemId)}
            onComplete={() => handleVerifyTurnIn(selectedTurnIn.turnInDocId)}
            onRemove={() => handleRemoveTurnIn(selectedTurnIn)}
            onClose={closeRosterDetail}
          />
        ) : mobileForm?.kind === 'item' ? (
          formBody
        ) : mobileForm?.kind === 'location' ? (
          formBody
        ) : mobileItem ? (
          <PropertyItemDetail
            item={mobileItem}
            locations={visibleLocations}
            holders={store.holders}
            items={store.items}
            onLocateFiller={handleSelectItem}
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
            onOpenItemMenu={(item, rect) => openItemMenu(item, rect, { view: true })}
            onDeleteLocation={onDeleteItem ? (locId) => setPendingDeleteLocId(locId) : undefined}
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
      {/* Auth-view header ellipsis — LIN: Add item (to LIN) + Edit LIN; component/item: Edit. */}
      {authViewMenu && authView && (
        <LiftedRowMenu
          isOpen
          anchorRect={authViewMenu.rect}
          onClose={() => setAuthViewMenu(null)}
          layout="list"
          align="right"
          items={
            isLinContainer(authView)
              ? [
                  { key: 'add', label: 'Add item', icon: Plus, onAction: () => openAuthAddChild(authView.id) },
                  { key: 'edit', label: 'Edit LIN', icon: Pencil, onAction: () => openAuthEdit(authView) },
                ]
              : [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => openAuthEdit(authView) }]
          }
        />
      )}
      {itemActionMenuEl}

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
      <ConfirmDialog
        visible={!!pendingDeleteReceipt}
        title="Delete this hand receipt? The items return to the property book."
        confirmLabel="Delete"
        variant="danger"
        zIndex={1500}
        onConfirm={confirmDeleteReceipt}
        onCancel={() => setPendingDeleteReceipt(null)}
      />
      <ConfirmDialog
        visible={!!pendingDeleteTurnIn}
        title="Delete this DA 3161? The record is removed; the turned-in equipment is not restored."
        confirmLabel="Delete"
        variant="danger"
        zIndex={1500}
        onConfirm={handleConfirmDeleteTurnIn}
        onCancel={() => setPendingDeleteTurnIn(null)}
      />
      <ConfirmDialog
        visible={!!pendingDeleteRecord}
        title="Delete this record? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        zIndex={1500}
        onConfirm={handleConfirmDeleteRecord}
        onCancel={() => setPendingDeleteRecord(null)}
      />
      {scannerEl}
    </>
  )
})
