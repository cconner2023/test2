import { forwardRef, useImperativeHandle, useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, Check, MoreHorizontal } from 'lucide-react'
import { Sheet } from '../Sheet'
import { ConfirmDialog } from '../ConfirmDialog'
import { PillButton } from '../HeaderPill'
import { PropertyLocationList } from './PropertyLocationList'
import { PropertyItemDetail, type PropertyItemDetailHandle } from './PropertyItemDetail'
import { PropertyItemForm, type PropertyItemFormHandle } from './PropertyItemForm'
import { PropertyLocationForm, type PropertyLocationFormHandle } from './PropertyLocationForm'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useShallow } from 'zustand/react/shallow'
import { useClinicName } from '../../Hooks/useClinicNameResolver'
import type { LocalPropertyItem, LocalPropertyLocation } from '../../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'

/** A single screen on the nav stack. The sheet swaps content as you drill. */
type NavScreen =
  | { kind: 'location'; id: string; name: string }
  | { kind: 'item'; id: string }
  | { kind: 'item-form'; itemId: string | null }
  | { kind: 'location-form'; locId: string | null; parentId: string | null }

export interface PropertyNavSheetHandle {
  /** Open (push) a location's contents. */
  openLocation: (loc: LocalPropertyLocation) => void
  /** Open (push) an item's detail. */
  openItem: (item: LocalPropertyItem) => void
  /** Open the add-item form, optionally pre-scoped to a location. */
  openForm: (locationId?: string | null) => void
  /** Open the edit-item form for an existing item. */
  openItemForm: (item: LocalPropertyItem) => void
  /** Open the location form — edit (loc) or create (loc=null, optional parent). */
  openLocationForm: (loc?: LocalPropertyLocation | null, parentId?: string | null) => void
}

interface PropertyNavSheetProps {
  /** Supervisor-gated: when false, delete actions are hidden. */
  canDelete?: boolean
  /** Forwarded to PropertyItemDetail (enroll fingerprint flow). */
  onEnrollItem?: (item: LocalPropertyItem) => void
  /** New-item enroll: routed through a ConfirmDialog before the scan modal. */
  onEnrollNewItem?: (item: LocalPropertyItem) => void
}

/**
 * PropertyNavSheet — the single mobile navigation surface for property.
 *
 * One non-expanding `Sheet` (fit height + max cap, scrolls) driven by an internal
 * nav stack: location → sub-location → item detail → add/edit forms. Shared by the
 * list view (PropertyPanel) and the map view (PropertyLocationMap) via the
 * imperative ref handle. All create/edit happens here in a form (no inline UI).
 */
export const PropertyNavSheet = forwardRef<PropertyNavSheetHandle, PropertyNavSheetProps>(
  function PropertyNavSheet({ canDelete = false, onEnrollItem, onEnrollNewItem }, ref) {
    const store = usePropertyStore(
      useShallow((s) => ({
        items: s.items,
        locations: s.locations,
        holders: s.holders,
        editingItem: s.editingItem,
        removeLocation: s.removeLocation,
        removeItem: s.removeItem,
        setEditingItem: s.setEditingItem,
        setDefaultLocationId: s.setDefaultLocationId,
      })),
    )
    const visibleLocations = store.locations.filter((l) => l.name !== ROOT_LOCATION_NAME)
    const clinicName = useClinicName(usePropertyStore((s) => s.clinicId)) || 'Cluster'

    const itemFormRef = useRef<PropertyItemFormHandle>(null)
    const locationFormRef = useRef<PropertyLocationFormHandle>(null)
    const itemDetailRef = useRef<PropertyItemDetailHandle>(null)
    const [stack, setStack] = useState<NavScreen[]>([])
    const [pendingDeleteItem, setPendingDeleteItem] = useState<LocalPropertyItem | null>(null)
    const [pendingDeleteLocId, setPendingDeleteLocId] = useState<string | null>(null)

    const top = stack[stack.length - 1] ?? null
    const pushScreen = useCallback((s: NavScreen) => setStack((st) => [...st, s]), [])
    const popScreen = useCallback(() => setStack((st) => st.slice(0, -1)), [])
    const closeAll = useCallback(() => {
      setStack([])
      store.setEditingItem(null)
    }, [store])

    // ── Imperative open API (called from PropertyPanel list + PropertyLocationMap) ──
    const openLocation = useCallback((loc: LocalPropertyLocation) => {
      pushScreen({ kind: 'location', id: loc.id, name: loc.name })
    }, [pushScreen])
    const openItem = useCallback((item: LocalPropertyItem) => {
      pushScreen({ kind: 'item', id: item.id })
    }, [pushScreen])
    const openForm = useCallback((locationId?: string | null) => {
      store.setDefaultLocationId(locationId ?? null)
      store.setEditingItem(null)
      pushScreen({ kind: 'item-form', itemId: null })
    }, [store, pushScreen])
    const openItemForm = useCallback((item: LocalPropertyItem) => {
      store.setEditingItem(item)
      store.setDefaultLocationId(item.location_id ?? null)
      pushScreen({ kind: 'item-form', itemId: item.id })
    }, [store, pushScreen])
    const openLocationForm = useCallback((loc?: LocalPropertyLocation | null, parentId?: string | null) => {
      pushScreen({ kind: 'location-form', locId: loc?.id ?? null, parentId: parentId ?? null })
    }, [pushScreen])
    useImperativeHandle(ref, () => ({ openLocation, openItem, openForm, openItemForm, openLocationForm }),
      [openLocation, openItem, openForm, openItemForm, openLocationForm])

    // Keep the item screen live as the store mutates; pop it if the item vanishes.
    const itemScreenId = top?.kind === 'item' ? top.id : null
    const liveItem = itemScreenId ? store.items.find((i) => i.id === itemScreenId) ?? null : null
    useEffect(() => {
      if (itemScreenId && !liveItem) popScreen()
    }, [itemScreenId, liveItem, popScreen])

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

    // ── Sheet chrome ──
    const editingLoc = top?.kind === 'location-form' && top.locId
      ? store.locations.find((l) => l.id === top.locId) ?? null
      : null
    const title = top
      ? top.kind === 'location'
        ? top.name
        : top.kind === 'item'
          ? (liveItem?.name ?? 'Item')
          : top.kind === 'item-form'
            ? (store.editingItem ? 'Edit Item' : 'New Item')
            : (editingLoc ? 'Edit Location' : 'New Location')
      : ''

    const back = stack.length > 1 ? (
      <button
        onClick={() => { if (top?.kind === 'item-form') store.setEditingItem(null); popScreen() }}
        aria-label="Back"
        className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
      >
        <ChevronLeft size={20} />
      </button>
    ) : undefined

    const itemActions = top?.kind === 'item' && liveItem ? (
      <span className="inline-flex" onClick={(e) => itemDetailRef.current?.openMenu((e.currentTarget as HTMLElement).getBoundingClientRect())}>
        <PillButton icon={MoreHorizontal} iconSize={16} onClick={() => {}} label="More actions" />
      </span>
    ) : top?.kind === 'item-form' ? (
      <PillButton icon={Check} iconSize={16} accent="success" onClick={() => itemFormRef.current?.submit()} label="Save" />
    ) : top?.kind === 'location-form' ? (
      <PillButton icon={Check} iconSize={16} accent="success" onClick={() => locationFormRef.current?.submit()} label="Save" />
    ) : undefined

    return (
      <>
        <Sheet
          isOpen={stack.length > 0}
          onClose={closeAll}
          height="fit"
          maxHeight={top?.kind === 'item-form' || top?.kind === 'location-form' ? 85 : 60}
          zIndex={1200}
          title={title}
          leftContent={back}
          actions={itemActions}
        >
          {top?.kind === 'location' && (
            <PropertyLocationList
              rootId={top.id}
              locations={visibleLocations}
              items={store.items}
              holders={store.holders}
              clinicName={clinicName}
              onOpenLocation={openLocation}
              onSelectItem={openItem}
              onEditLocation={(loc) => openLocationForm(loc)}
              onEditItem={openItemForm}
              onDeleteLocation={canDelete ? (locId) => setPendingDeleteLocId(locId) : undefined}
              onDeleteItem={canDelete ? (item) => setPendingDeleteItem(item) : undefined}
              onAddChildLocation={(parentId) => openLocationForm(null, parentId)}
              onAddItemAtLocation={(locId) => openForm(locId)}
            />
          )}

          {top?.kind === 'item' && liveItem && (
            <PropertyItemDetail
              ref={itemDetailRef}
              item={liveItem}
              locations={visibleLocations}
              holders={store.holders}
              items={store.items}
              onEnroll={() => onEnrollItem?.(liveItem)}
              onEdit={() => openItemForm(liveItem)}
              onDelete={() => setPendingDeleteItem(liveItem)}
              canDelete={canDelete}
            />
          )}

          {top?.kind === 'item-form' && (
            <PropertyItemForm
              ref={itemFormRef}
              editingItem={store.editingItem}
              onClose={() => { store.setEditingItem(null); popScreen() }}
              onEnrollNew={onEnrollNewItem}
            />
          )}

          {top?.kind === 'location-form' && (
            <PropertyLocationForm
              ref={locationFormRef}
              editingLocation={editingLoc}
              defaultParentId={top.parentId}
              onClose={popScreen}
            />
          )}
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
  },
)
