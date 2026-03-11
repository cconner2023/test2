/**
 * PropertyLocationMap — Orchestrator for the property canvas.
 * The canvas is a scaled div inside a scrollable container.
 * Zones use 0..1 normalised coords as CSS percentages.
 * "Zooming" changes the canvas scale and scrolls to target.
 *
 * LOD: nested zones become visible when their parent zone fills ≥80%
 * of the viewport (via canvasScale), or when the parent is selected.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Pencil, Check, PenTool, ZoomIn, ZoomOut, Scissors, Merge, X, Copy, Camera } from 'lucide-react'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { fetchAllLocationTags, fetchLocationTags, upsertLocationTags } from '../../lib/propertyService'
import { buildTagIndex, findLCA } from '../../lib/tagIndex'
import type { TagIndex } from '../../lib/tagIndex'
import { LocationTagPhoto } from './LocationTagPhoto'
import { CanvasEditOverlay } from './CanvasEditOverlay'
import type { CanvasEditHandle } from './CanvasEditOverlay'
import { ConfirmDialog } from '../ConfirmDialog'
import type { LocalPropertyItem, LocalPropertyLocation, PropertyLocation, LocationTag } from '../../Types/PropertyTypes'

// ── LOD helpers (pure functions, no hooks) ────────────────────

/** Recursively flatten all nested tags into world-space 0..1 coords. */
function flattenToWorld(tagIndex: TagIndex, rootId: string): LocationTag[] {
  const result: LocationTag[] = []

  function recurse(canvasId: string, px: number, py: number, pw: number, ph: number) {
    const tags = tagIndex.byCanvas.get(canvasId)
    if (!tags) return

    for (const tag of tags) {
      const tw = tag.width ?? 0
      const th = tag.height ?? 0
      if (tw <= 0 || th <= 0) continue

      const wx = px + tag.x * pw
      const wy = py + tag.y * ph
      const ww = tw * pw
      const wh = th * ph

      result.push({ ...tag, x: wx, y: wy, width: ww, height: wh })

      if (tag.target_type === 'location') {
        recurse(tag.target_id, wx, wy, ww, wh)
      }
    }
  }

  recurse(rootId, 0, 0, 1, 1)
  return result
}


// ── Component ─────────────────────────────────────────────────

/** Drag distance threshold — below this we treat pointerup as a tap, not a pan */
const TAP_THRESHOLD = 8

interface PropertyLocationMapProps {
  clinicId: string
  clinicName: string
  locations: LocalPropertyLocation[]
  items: LocalPropertyItem[]
  onCreateLocation: (data: Omit<PropertyLocation, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; location?: LocalPropertyLocation } | undefined>
  onDeleteLocation: (id: string) => Promise<unknown>
  onEditItem?: (id: string, updates: { location_id?: string | null }) => Promise<unknown>
  onUpdateLocation?: (id: string, updates: Partial<PropertyLocation>) => Promise<unknown>
  onSelectItem?: (item: LocalPropertyItem) => void
}

export function PropertyLocationMap({ clinicId, clinicName, locations, items, onCreateLocation, onDeleteLocation, onEditItem, onUpdateLocation, onSelectItem }: PropertyLocationMapProps) {
  const store = usePropertyStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [tagIndex, setTagIndex] = useState<TagIndex | null>(null)
  const [canvasScale, setCanvasScale] = useState(1)
  const [isEditing, setIsEditing] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [editCanvasTags, setEditCanvasTags] = useState<LocationTag[]>([])
  const [pendingZoneDelete, setPendingZoneDelete] = useState<{ targetId: string; label: string } | null>(null)
  const editRef = useRef<CanvasEditHandle>(null)
  const dragRef = useRef<{ startX: number; startY: number; scrollX: number; scrollY: number } | null>(null)
  const lcaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track edit selection count so toolbar re-renders when shift-selection changes
  const [editSelectionCount, setEditSelectionCount] = useState(0)

  const rootLocationId = store.rootLocationId

  // ── Cleanup LCA animation timer on unmount ──
  useEffect(() => () => { if (lcaTimerRef.current) clearTimeout(lcaTimerRef.current) }, [])

  // ── Load tags and build index ──
  useEffect(() => {
    if (!clinicId || !rootLocationId) return

    const allIds = [{ id: rootLocationId }, ...locations]
    fetchAllLocationTags(clinicId, allIds)
      .then((tagMap) => setTagIndex(buildTagIndex(tagMap)))
      .catch(() => { /* non-fatal */ })
  }, [clinicId, rootLocationId, locations, store.tagVersion])

  // ── Root canvas tags (for edit mode + empty-state check) ──
  const canvasTags: LocationTag[] = useMemo(() => {
    if (!tagIndex || !rootLocationId) return []
    return tagIndex.byCanvas.get(rootLocationId) ?? []
  }, [tagIndex, rootLocationId])

  // ── All tags in world coords (for zoom lookup + toolbar label) ──
  const allWorldTags: LocationTag[] = useMemo(() => {
    if (!tagIndex || !rootLocationId) return []
    return flattenToWorld(tagIndex, rootLocationId)
  }, [tagIndex, rootLocationId])

  // ── Visible tags — always show all zones so the user can pan and tap any ──
  const visibleTags = allWorldTags

  // ── Zoom to a world-coord tag ──
  const zoomToTag = useCallback(
    (tag: LocationTag) => {
      const container = scrollRef.current
      if (!container || !tag.width || !tag.height) return

      const vpW = container.clientWidth
      const vpH = container.clientHeight
      const scaleX = (vpW * 0.8) / (tag.width * vpW)
      const scaleY = (vpH * 0.8) / (tag.height * vpH)
      const newScale = Math.min(scaleX, scaleY, 5)

      setCanvasScale(newScale)

      requestAnimationFrame(() => {
        const scrollX = tag.x * newScale * vpW - vpW * 0.1
        const scrollY = tag.y * newScale * vpH - vpH * 0.1
        container.scrollTo({ left: scrollX, top: scrollY, behavior: 'smooth' })
      })
    },
    [],
  )

  // ── Shared-parent zoom: zoom out to LCA, pause, then zoom in to target ──
  const zoomViaLCA = useCallback(
    (fromId: string, toId: string, toTag: LocationTag) => {
      if (!tagIndex || !rootLocationId) {
        zoomToTag(toTag)
        return
      }

      const lca = findLCA(tagIndex, fromId, toId)
      if (!lca || lca === fromId || lca === toId) {
        // Direct ancestor — just zoom straight
        zoomToTag(toTag)
        return
      }

      // Find LCA tag to zoom out to first
      const lcaTag = allWorldTags.find((t) => t.target_id === lca)
      if (!lcaTag) {
        zoomToTag(toTag)
        return
      }

      // Zoom out to LCA, wait, then zoom in to target
      store.setTransitionState('zooming-out')
      zoomToTag(lcaTag)
      if (lcaTimerRef.current) clearTimeout(lcaTimerRef.current)
      lcaTimerRef.current = setTimeout(() => {
        store.setTransitionState('zooming-in')
        zoomToTag(toTag)
        lcaTimerRef.current = setTimeout(() => store.setTransitionState('idle'), 400)
      }, 450)
    },
    [tagIndex, rootLocationId, allWorldTags, zoomToTag, store],
  )

  // ── Zone tap → select + zoom ──
  const handleZoneTap = useCallback(
    (targetId: string) => {
      const prevId = store.selectedZoneId
      store.selectZone(targetId)
      const tag = allWorldTags.find((t) => t.target_id === targetId)
      if (!tag) return

      // If navigating between siblings/unrelated zones, use shared-parent animation
      if (prevId && prevId !== targetId) {
        zoomViaLCA(prevId, targetId, tag)
      } else {
        zoomToTag(tag)
      }
    },
    [store, allWorldTags, zoomToTag, zoomViaLCA],
  )

  // ── Reset zoom ──
  const handleResetZoom = useCallback(() => {
    store.selectZone(null)
    setCanvasScale(1)
    scrollRef.current?.scrollTo({ left: 0, top: 0, behavior: 'smooth' })
  }, [store])

  // ── Handle pending nav target from tree ──
  useEffect(() => {
    const target = store.pendingNavTarget
    if (!target) return

    store.setPendingNavTarget(null)

    if (target === '__reset__') {
      handleResetZoom()
      return
    }

    const tag = allWorldTags.find((t) => t.target_id === target)
    if (!tag) return

    const prevId = store.selectedZoneId
    store.selectZone(target)

    if (prevId && prevId !== target) {
      zoomViaLCA(prevId, target, tag)
    } else {
      zoomToTag(tag)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.pendingNavTarget, allWorldTags, zoomToTag, zoomViaLCA, handleResetZoom])

  // ── Edit mode ──
  const handleEnterEdit = useCallback(async () => {
    if (!rootLocationId) return
    const tags = await fetchLocationTags(rootLocationId)
    setEditCanvasTags(tags)
    setIsDrawing(false)
    setIsEditing(true)
  }, [rootLocationId])

  const handleExitEdit = useCallback(() => {
    setIsEditing(false)
    setIsDrawing(false)
  }, [])

  const handleEditSave = useCallback(
    async (newTags: Omit<LocationTag, 'id'>[], mergedAwayIds: string[]) => {
      if (!rootLocationId) return

      const existingIds = new Set(locations.map((l) => l.id))
      existingIds.add(rootLocationId)

      const resolvedTags = [...newTags]
      for (let i = 0; i < resolvedTags.length; i++) {
        const tag = resolvedTags[i]
        if (tag.target_type === 'location' && !existingIds.has(tag.target_id)) {
          const result = await onCreateLocation({
            clinic_id: clinicId,
            parent_id: null,
            name: tag.label,
            photo_data: null,
            created_by: '',
          })
          if (result?.success && result.location) {
            resolvedTags[i] = { ...tag, target_id: result.location.id }
          }
        }
      }

      // Transfer items from merged-away locations to the surviving merged zone
      if (mergedAwayIds.length > 0 && onEditItem) {
        // The surviving zone's target_id is the one that has rects and is NOT in mergedAwayIds
        const survivingTag = resolvedTags.find(
          (t) => t.rects && t.rects.length > 0 && !mergedAwayIds.includes(t.target_id),
        )
        if (survivingTag) {
          const affectedItems = items.filter((i) => i.location_id && mergedAwayIds.includes(i.location_id))
          for (const item of affectedItems) {
            await onEditItem(item.id, { location_id: survivingTag.target_id })
          }
        }
        // Delete the merged-away locations from the tree
        for (const id of mergedAwayIds) {
          await onDeleteLocation(id)
        }
      }

      await upsertLocationTags(rootLocationId, resolvedTags)
      store.bumpTagVersion()
      handleExitEdit()
    },
    [rootLocationId, store, locations, items, clinicId, onCreateLocation, onDeleteLocation, onEditItem, handleExitEdit],
  )

  // ── Drill up one level in the zone hierarchy ──
  const drillUp = useCallback(() => {
    if (!store.selectedZoneId) return // already at root

    // Find the parent of the currently selected zone via location tree
    const currentLoc = locations.find((l) => l.id === store.selectedZoneId)
    const parentId = currentLoc?.parent_id ?? null

    if (parentId) {
      // Go to parent zone
      store.selectZone(parentId)
      const parentTag = allWorldTags.find((t) => t.target_id === parentId)
      if (parentTag) zoomToTag(parentTag)
    } else {
      // At top level — reset to root
      handleResetZoom()
    }
  }, [store, locations, allWorldTags, zoomToTag, handleResetZoom])

  // ── Click-drag panning ──
  // Do NOT capture the pointer when the target is a zone — let zone
  // pointer events fire so taps/re-selection work while zoomed.
  const handlePanStart = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    // In edit mode, only allow panning when NOT drawing (draw mode captures its own events)
    if (isEditing && isDrawing) return
    if ((e.target as HTMLElement).closest('[data-zoom-controls]')) return
    // In edit mode, don't pan when interacting with a zone or its controls
    if (isEditing && (e.target as HTMLElement).closest('[data-zone]')) return
    const el = scrollRef.current
    if (!el) return

    const onZone = !!(e.target as HTMLElement).closest('[data-zone-target]')
    dragRef.current = { startX: e.clientX, startY: e.clientY, scrollX: el.scrollLeft, scrollY: el.scrollTop }

    // Only capture when NOT on a zone — capture steals pointer events
    if (!onZone) {
      el.setPointerCapture(e.pointerId)
    }
    el.style.cursor = 'grabbing'
  }, [isEditing])

  const handlePanMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = d.scrollX - (e.clientX - d.startX)
    el.scrollTop = d.scrollY - (e.clientY - d.startY)
  }, [])

  const handlePanEnd = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    const el = scrollRef.current
    if (el) {
      try { el.releasePointerCapture(e.pointerId) } catch { /* not captured */ }
      el.style.cursor = ''
    }

    // If the pointer barely moved and NOT on a zone, drill up one level (view mode only)
    if (!isEditing) {
      const dx = Math.abs(e.clientX - d.startX)
      const dy = Math.abs(e.clientY - d.startY)
      if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD) {
        if (!(e.target as HTMLElement).closest('[data-zone-target]')) {
          drillUp()
        }
      }
    }
  }, [drillUp, isEditing])

  // ── One-level-deep content for the bottom panel ──
  // Context = selected zone, or null (root) if nothing selected
  const contextId = store.selectedZoneId

  // Child locations via parent_id tree (one level)
  // At root: top-level locations (parent_id === null)
  // Zone selected: locations with parent_id === selectedZoneId
  const childLocations: LocalPropertyLocation[] = useMemo(() => {
    return locations.filter((l) => (contextId ? l.parent_id === contextId : !l.parent_id))
  }, [locations, contextId])

  // For each child location, find its world-space tag (if it has a zone drawn)
  const childZoneCards = useMemo(() => {
    return childLocations.map((loc) => {
      const tag = allWorldTags.find((t) => t.target_id === loc.id)
      return { location: loc, tag }
    })
  }, [childLocations, allWorldTags])

  // Items: at root show ALL items, when zone selected show items at that location
  const contextItems: LocalPropertyItem[] = useMemo(() => {
    if (!contextId) return items
    return items.filter((i) => i.location_id === contextId)
  }, [contextId, items])

  // ── Cascade delete a zone's location ──
  const handleConfirmZoneDelete = useCallback(async () => {
    if (!pendingZoneDelete || !clinicId) return
    await onDeleteLocation(pendingZoneDelete.targetId)
    store.bumpTagVersion()
    if (store.selectedZoneId === pendingZoneDelete.targetId) {
      store.selectZone(null)
    }
    setPendingZoneDelete(null)
  }, [pendingZoneDelete, clinicId, onDeleteLocation, store])

  // ── Photo map: location_id → photo_data for zone background images ──
  const photoMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const loc of locations) {
      if (loc.photo_data) m.set(loc.id, loc.photo_data)
    }
    return m
  }, [locations])

  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoTargetId, setPhotoTargetId] = useState<string | null>(null)

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !photoTargetId || !onUpdateLocation) return
    try {
      const { resizeImage } = await import('../../Utilities/imageUtils')
      const resized = await resizeImage(file, 800, 0.7)
      await onUpdateLocation(photoTargetId, { photo_data: resized })
    } catch { /* non-fatal */ }
    e.target.value = ''
    setPhotoTargetId(null)
  }, [photoTargetId, onUpdateLocation])

  const triggerPhotoUpload = useCallback((locationId: string) => {
    setPhotoTargetId(locationId)
    photoInputRef.current?.click()
  }, [])

  const isZoomed = canvasScale > 1

  /** Zoom anchored to viewport center — adjusts scroll so the same point stays centered. */
  const zoomBy = useCallback((factor: number) => {
    const el = scrollRef.current
    if (!el) return
    const old = canvasScale
    const next = Math.min(Math.max(old * factor, 1), 10)
    if (next === old) return

    // Point at center of viewport in canvas-space (0..1)
    const cx = (el.scrollLeft + el.clientWidth / 2) / (old * el.clientWidth)
    const cy = (el.scrollTop + el.clientHeight / 2) / (old * el.clientHeight)

    setCanvasScale(next)

    requestAnimationFrame(() => {
      el.scrollLeft = cx * next * el.clientWidth - el.clientWidth / 2
      el.scrollTop = cy * next * el.clientHeight - el.clientHeight / 2
    })
  }, [canvasScale])

  const handleZoomIn = useCallback(() => zoomBy(1.5), [zoomBy])
  const handleZoomOut = useCallback(() => zoomBy(1 / 1.5), [zoomBy])

  // ── Pinch-to-zoom via wheel (ctrlKey = pinch gesture on trackpad/mobile) ──
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return // only intercept pinch gestures
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
      zoomBy(factor)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomBy])

  const selectedZoneLabel = store.selectedZoneId
    ? allWorldTags.find((t) => t.target_id === store.selectedZoneId)?.label
      ?? locations.find((l) => l.id === store.selectedZoneId)?.name
      ?? 'Canvas'
    : 'All Items'

  return (
    <div className="flex flex-col h-full">
      {/* Canvas wrapper — relative so controls float over scroll area */}
      <div className="flex-1 min-h-[200px] relative m-2">
        {/* Scrollable canvas */}
        <div
          ref={scrollRef}
          className={`absolute inset-0 overflow-auto bg-themewhite2 border border-tertiary/15 rounded-lg ${isEditing && !isDrawing ? 'cursor-default' : isDrawing ? 'cursor-crosshair' : 'cursor-grab'}`}
          onPointerDown={handlePanStart}
          onPointerMove={handlePanMove}
          onPointerUp={handlePanEnd}
          onPointerCancel={handlePanEnd}
        >
          {isEditing ? (
            <CanvasEditOverlay
              tags={editCanvasTags}
              canvasId={rootLocationId!}
              drawMode={isDrawing}
              scale={canvasScale}
              editRef={editRef}
              onSave={handleEditSave}
              onCancel={handleExitEdit}
              onDeleteZone={(targetId, label) => setPendingZoneDelete({ targetId, label })}
              onSelectionChange={setEditSelectionCount}
              photoMap={photoMap}
            />
          ) : (
            <>
              <LocationTagPhoto
                tags={visibleTags}
                selectedZoneId={store.selectedZoneId}
                onZoneTap={handleZoneTap}
                scale={canvasScale}
                photoMap={photoMap}
              />

              {!rootLocationId && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-[10pt] text-tertiary/50">Loading canvas...</p>
                </div>
              )}
              {rootLocationId && canvasTags.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center space-y-1">
                    <p className="text-[10pt] text-tertiary/60">No zones yet</p>
                    <p className="text-[9pt] text-tertiary/40">Tap Edit to draw zones</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Floating zoom controls — bottom-left vertical pill */}
        {!isEditing && (
          <div data-zoom-controls className="absolute bottom-3 left-3 z-10 rounded-full border border-tertiary/20 bg-themewhite p-0.5 flex flex-col items-center shadow-sm">
            <button
              onClick={handleZoomIn}
              className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-primary hover:bg-primary/5 active:scale-95 transition-all"
            >
              <ZoomIn size={14} />
            </button>
            <div className="w-5 h-px bg-tertiary/15" />
            <button
              onClick={handleZoomOut}
              disabled={!isZoomed}
              className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-primary hover:bg-primary/5 active:scale-95 transition-all disabled:opacity-30"
            >
              <ZoomOut size={14} />
            </button>
          </div>
        )}

        {/* Floating toolbar — top-right horizontal pill */}
        <div className="absolute top-3 right-3 z-10 rounded-full border border-tertiary/20 bg-themewhite p-0.5 flex items-center shadow-sm">
          {!isEditing ? (
            <button
              onClick={handleEnterEdit}
              className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
            >
              <Pencil size={15} />
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsDrawing((d) => !d)}
                className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all ${isDrawing ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                title="Draw zone"
              >
                <PenTool size={15} />
              </button>
              <div className="h-5 w-px bg-tertiary/15" />
              <button
                onClick={() => editRef.current?.duplicate()}
                disabled={editSelectionCount !== 1}
                className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all disabled:opacity-25 disabled:pointer-events-none"
                title="Duplicate zone (select 1)"
              >
                <Copy size={15} />
              </button>
              <button
                onClick={() => editRef.current?.split()}
                disabled={editSelectionCount !== 1}
                className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all disabled:opacity-25 disabled:pointer-events-none"
                title="Split zone (select 1)"
              >
                <Scissors size={15} />
              </button>
              <button
                onClick={() => editRef.current?.merge()}
                disabled={editSelectionCount !== 2}
                className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all disabled:opacity-25 disabled:pointer-events-none"
                title="Merge zones (select 2)"
              >
                <Merge size={15} />
              </button>
              <div className="h-5 w-px bg-tertiary/15" />
              <button
                onClick={handleExitEdit}
                className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all"
                title="Cancel"
              >
                <X size={15} />
              </button>
              <button
                onClick={() => editRef.current?.save()}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
                title="Save"
              >
                <Check size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bottom panel — always visible, card grid of one-level-deep sub-zones + items */}
      {!isEditing && (
        <div className="shrink-0 border-t border-primary/10 max-h-[45%] flex flex-col">
          <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-themewhite3/50">
            {store.selectedZoneId && (
              <>
                <button
                  onClick={handleResetZoom}
                  className="text-[9pt] text-themeblue2 hover:text-themeblue2/80 active:scale-95 transition-all"
                >
                  {clinicName}
                </button>
                <span className="text-[9pt] text-tertiary/30">/</span>
              </>
            )}
            <span className="text-[9pt] font-medium text-primary truncate">{selectedZoneLabel}</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {childZoneCards.length === 0 && contextItems.length === 0 ? (
              <p className="text-[9pt] text-tertiary/40 text-center py-6">
                {store.selectedZoneId ? 'Nothing here yet' : 'Tap Edit to draw zones'}
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2 pt-1">
                {/* Child location cards */}
                {childZoneCards.map(({ location, tag }) => (
                  <button
                    key={location.id}
                    onClick={() => tag ? handleZoneTap(location.id) : store.selectZone(location.id)}
                    className="rounded-lg border border-themeblue3/20 bg-themeblue3/5 overflow-hidden active:scale-[0.97] transition-all group relative"
                  >
                    {location.photo_data ? (
                      <img src={location.photo_data} alt={location.name} className="w-full h-16 object-cover" draggable={false} />
                    ) : (
                      <div className="w-full h-16 bg-themeblue3/10" />
                    )}
                    {onUpdateLocation && (
                      <div
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); triggerPhotoUpload(location.id) }}
                      >
                        <Camera size={12} className="text-white" />
                      </div>
                    )}
                    <div className="px-2 py-1.5">
                      <p className="text-[9pt] font-medium text-primary truncate">{location.name}</p>
                    </div>
                  </button>
                ))}
                {/* Item cards */}
                {contextItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelectItem?.(item)}
                    className="rounded-lg border border-tertiary/15 bg-themewhite2 overflow-hidden active:scale-[0.97] transition-all"
                  >
                    {item.photo_url ? (
                      <img src={item.photo_url} alt={item.name} className="w-full h-16 object-cover" draggable={false} />
                    ) : (
                      <div className="w-full h-16 bg-tertiary/5" />
                    )}
                    <div className="px-2 py-1.5">
                      <p className="text-[9pt] font-medium text-primary truncate">{item.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input for zone photo uploads */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoUpload}
      />

      {/* Cascade delete confirmation */}
      <ConfirmDialog
        visible={!!pendingZoneDelete}
        title={`Delete "${pendingZoneDelete?.label}"? This will remove the location, its children, and all zone tags. Items will be unassigned.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmZoneDelete}
        onCancel={() => setPendingZoneDelete(null)}
      />
    </div>
  )
}
