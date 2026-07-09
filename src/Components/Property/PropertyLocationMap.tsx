/**
 * PropertyLocationMap — Orchestrator for the property canvas.
 * The canvas is a scaled div inside a scrollable container.
 * Zones use 0..1 normalised coords as CSS percentages.
 * "Zooming" changes the canvas scale and scrolls to target.
 *
 * LOD: top-level zones are always visible. Nested zones appear only when their
 * parent fills ≥LOD_FILL_THRESHOLD of the viewport (via canvasScale), or when
 * the parent is selected (direct children) or on the selection's ancestor chain.
 */
import { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle, forwardRef, memo } from 'react'
import { flushSync } from 'react-dom'
import { Pencil, Check, PenTool, Minus, Scissors, Merge, X, Copy, Camera, Trash2, Maximize2, Move, ChevronLeft, ChevronRight, Plus, Package } from 'lucide-react'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { useVehicleDispatches } from '../../Hooks/useVehicleDispatches'
import type { DispatchStatus } from '../../lib/dispatchFold'
import { fetchAllLocationTags, fetchLocationTags, upsertLocationTags } from '../../lib/propertyService'
import { buildTagIndex, findLCA } from '../../lib/tagIndex'
import type { TagIndex } from '../../lib/tagIndex'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { LocationTagPhoto, ItemCallout } from './LocationTagPhoto'
import { CanvasEditOverlay } from './CanvasEditOverlay'
import type { CanvasEditHandle } from './CanvasEditOverlay'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { GlassBand } from '@/Components/primitives/GlassBand'
import { collectSuppressedIds, computeExplodeOffsets, getLevels, nextFloorOrdinal } from './levelUtils'
import type { ExplodeRect } from './levelUtils'
import { createLogger } from '../../Utilities/Logger'
import type { LocalPropertyItem, LocalPropertyLocation, PropertyLocation, LocationTag } from '../../Types/PropertyTypes'

const logger = createLogger('PropertyLocationMap')

// ── EditItemPin — selectable item badge for zone edit mode ─────
// Default: a tap toggles selection (inert to canvas scroll — pins are only
// draggable once selected AND Move mode is on, so a scroll gesture starting on a
// pin just scrolls). Move mode: the single selected pin drags to reposition its
// x/y within the zone (persisted with the zone tags on Save).

interface EditItemPinProps {
  pin: LocationTag
  item: LocalPropertyItem
  containerRef: React.RefObject<HTMLDivElement | null>
  selected: boolean
  /** True only for the lone selected pin while Move mode is active → drag-to-reposition. */
  draggable: boolean
  onMove: (targetId: string, newX: number, newY: number) => void
  onToggleSelect: (item: LocalPropertyItem) => void
}

const EditItemPin = memo(function EditItemPin({ pin, item, containerRef, selected, draggable, onMove, onToggleSelect }: EditItemPinProps) {
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null)
  const dragState = useRef<{ startX: number; startY: number; moved: boolean } | null>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!draggable) return
    e.stopPropagation()
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragState.current = { startX: e.clientX, startY: e.clientY, moved: false }
    setDragOffset({ dx: 0, dy: 0 })
  }, [draggable])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return
    e.stopPropagation()
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragState.current.moved = true
    setDragOffset({ dx, dy })
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return
    e.stopPropagation()
    const wasMoved = dragState.current.moved
    dragState.current = null
    setDragOffset(null)
    if (!wasMoved) return // a stationary tap in Move mode = no-op (pin already selected)

    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const newX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const newY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    onMove(pin.target_id, newX, newY)
  }, [onMove, pin.target_id, containerRef])

  const isDragging = dragOffset !== null && (dragState.current?.moved ?? false)

  // The wrapper's origin sits ON the pin point (no centering translate) — ItemCallout self-anchors
  // its dot there and floats the bubble off it. Drag just nudges the whole wrapper by the offset.
  return (
    <div
      data-item-pin
      className={['absolute z-30 select-none pointer-events-auto', draggable ? 'touch-none' : '', isDragging ? 'cursor-grabbing' : draggable ? 'cursor-grab' : 'cursor-pointer'].join(' ')}
      style={{
        left: `${pin.x * 100}%`,
        top: `${pin.y * 100}%`,
        transform: dragOffset ? `translate(${dragOffset.dx}px, ${dragOffset.dy}px)` : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={draggable ? undefined : (e) => { e.stopPropagation(); onToggleSelect(item) }}
    >
      <ItemCallout item={item} anchorX={pin.x} anchorY={pin.y} selected={selected} dragging={isDragging} />
    </div>
  )
})

// ── LOD helpers (pure functions, no hooks) ────────────────────

/** Exploded-shelf descriptor: on the given container's canvas, each level's stored
 *  full-extent tag is replaced by a staggered fan rect so all floors show at once. */
interface ExplodeSpec {
  containerId: string
  rects: Map<string, ExplodeRect>
}

/** Recursively flatten all nested tags into world-space 0..1 coords. When `explode` is
 *  set, the named container's levels are fanned into a staggered shelf instead of stacked. */
function flattenToWorld(tagIndex: TagIndex, rootId: string, explode?: ExplodeSpec): LocationTag[] {
  const result: LocationTag[] = []

  function recurse(canvasId: string, px: number, py: number, pw: number, ph: number) {
    const tags = tagIndex.byCanvas.get(canvasId)
    if (!tags) return

    // On the exploded container's canvas, paint floors ground-last (frontmost) so the
    // fan reads as a cascade; the offset rects are looked up per tag below.
    const exploding = explode && canvasId === explode.containerId
    const list = exploding
      ? [...tags].sort(
          (a, b) => (explode!.rects.get(a.target_id)?.z ?? -1) - (explode!.rects.get(b.target_id)?.z ?? -1),
        )
      : tags

    for (const tag of list) {
      const tw = tag.width ?? 0
      const th = tag.height ?? 0

      if (tag.target_type === 'item') {
        // Point badge — convert zone-relative coords to world space, no size, no recurse
        result.push({ ...tag, x: px + tag.x * pw, y: py + tag.y * ph })
        continue
      }

      if (tw <= 0 || th <= 0) continue

      // A level on the exploded container gets its fanned rect in place of the stored
      // full-extent (0,0,1,1); its whole subtree then composes off the offset rect.
      const ov = exploding ? explode!.rects.get(tag.target_id) : undefined
      const rx = ov ? ov.x : tag.x
      const ry = ov ? ov.y : tag.y
      const rw = ov ? ov.width : tw
      const rh = ov ? ov.height : th

      const wx = px + rx * pw
      const wy = py + ry * ph
      const ww = rw * pw
      const wh = rh * ph

      result.push({ ...tag, x: wx, y: wy, width: ww, height: wh })

      if (tag.target_type === 'location') {
        recurse(tag.target_id, wx, wy, ww, wh)
      }
    }
  }

  recurse(rootId, 0, 0, 1, 1)
  return result
}

/**
 * Lay out N tag-less child zones in a grid of canvas-relative (0..1) rects.
 * Used both for the view-mode auto-render (converted to world space) and for
 * seeding editable zones in nested edit — so a child location created without
 * drawn geometry still shows up inside its parent and can be dragged to persist.
 */
function layoutChildZones(count: number): { x: number; y: number; width: number; height: number }[] {
  if (count <= 0) return []
  const PAD = 0.06
  const GAP = 0.12
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)
  const cellW = (1 - PAD * 2) / cols
  const cellH = (1 - PAD * 2) / rows
  const rects: { x: number; y: number; width: number; height: number }[] = []
  for (let i = 0; i < count; i++) {
    const cx = i % cols
    const cy = Math.floor(i / cols)
    rects.push({
      x: PAD + cx * cellW + (cellW * GAP) / 2,
      y: PAD + cy * cellH + (cellH * GAP) / 2,
      width: cellW * (1 - GAP),
      height: cellH * (1 - GAP),
    })
  }
  return rects
}


// ── Component ─────────────────────────────────────────────────

/** Drag distance threshold — below this we treat pointerup as a tap, not a pan */
const TAP_THRESHOLD = 8

/** Base canvas multiplier — canvas starts 3× viewport so panning works at zoom=1 */
const BASE_CANVAS_SCALE = 3

/** Sub-zones appear once their parent fills at least this fraction of the viewport. */
const LOD_FILL_THRESHOLD = 0.5

/** Floating map-control button — mirrors MapView's CTRL_BTN (zoom + info chrome). */
const CTRL_BTN = 'w-9 h-9 rounded-lg flex items-center justify-center bg-themewhite2/90 dark:bg-themewhite3/90 text-primary shadow-sm active:scale-95 transition-all backdrop-blur-sm'

export interface MapNavHandle {
  navigateToZone: (targetId: string) => void
  /** Frame the canvas on a single item's pin (item-level zoom) — the external
   *  equivalent of a canvas pin tap. Navigates to the item's zone first when it
   *  isn't the active one, then drills in once the pin renders. Used by the
   *  right-pane / sheet / tree / search item rows so selecting an item zooms to
   *  it, not just to its zone. */
  focusItem: (itemId: string) => void
  resetZoom: () => void
  /** Deselect the active zone without changing zoom (used to close the right pane). */
  clearSelection: () => void
  /** Add the next floor to a building (or bootstrap a structural zone into one),
   *  then activate + zoom to it. Used by the zone/tree "Add level" menu actions. */
  addFloorTo: (containerId: string) => void
  /** Standardized add-zone flow: enter single-rectangle draw mode on `parentId`'s
   *  canvas (root when null). On commit, the map fires onZoneDrawn so the parent
   *  can open the name/parent/type sheet. */
  startDrawZone: (parentId: string | null) => void
}

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
  onCreateItem?: () => void
  /** The item whose detail the parent currently has open (right pane / mobile sheet),
   *  or null when none. Authoritative close signal: when it goes null the map drops the
   *  lit pin and re-frames the still-selected zone. */
  selectedItem?: LocalPropertyItem | null
  /** When provided, the parent owns the selected-zone surface (desktop right pane):
   *  fires on every zone selection change, and the inline canvas popover is suppressed. */
  onSelectZone?: (locationId: string | null) => void
  /** Standardized add-zone flow: a single-draw rectangle was committed. `canvasId`
   *  is the canvas it was drawn on (root → top-level zone); rect is canvas-local
   *  0..1 coords. The parent opens the name/parent/type sheet + persists the tag. */
  onZoneDrawn?: (rect: { x: number; y: number; width: number; height: number }, canvasId: string) => void
  /** Fires when single-draw mode toggles on/off, so the parent can hide its mobile
   *  detail sheet while the user draws on the full-screen canvas. */
  onDrawingChange?: (active: boolean) => void
}

export const PropertyLocationMap = forwardRef<MapNavHandle, PropertyLocationMapProps>(function PropertyLocationMap({ clinicId, locations, items, onCreateLocation, onDeleteLocation, onEditItem, onUpdateLocation, onSelectItem, onCreateItem, onSelectZone, onZoneDrawn, onDrawingChange, selectedItem }, ref) {
  const store = usePropertyStore()
  const isMobile = useIsMobile()
  // Open-dispatch status per vehicle → the zone-tile red-dot (expiring/expired).
  const dispatches = useVehicleDispatches(clinicId)
  const dispatchStatusByLocation = useMemo(() => {
    const m = new Map<string, DispatchStatus>()
    for (const [id, d] of dispatches) m.set(id, d.status)
    return m
  }, [dispatches])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [tagIndex, setTagIndex] = useState<TagIndex | null>(null)
  const [canvasScale, setCanvasScale] = useState(1)
  const [isEditing, setIsEditing] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  // Single-draw add-zone mode (standardized "draw first → sheet" flow): the next
  // drawn rectangle is reported up via onZoneDrawn instead of named inline.
  const [drawOnce, setDrawOnce] = useState(false)
  const [editCanvasId, setEditCanvasId] = useState<string | null>(null)
  const [editCanvasTags, setEditCanvasTags] = useState<LocationTag[]>([])
  const [pendingZoneDelete, setPendingZoneDelete] = useState<{ targetId: string; label: string } | null>(null)
  const editRef = useRef<CanvasEditHandle>(null)
  const [editItemPins, setEditItemPins] = useState<LocationTag[]>([])
  const editItemPinsRef = useRef<LocationTag[]>([])
  editItemPinsRef.current = editItemPins
  // Personnel + Turn-In tiles filtered out of the editable ROOT canvas — hidden from the
  // cluster overview in edit mode, but stashed here and re-merged on save so the
  // full-replace upsertLocationTags doesn't delete them. Empty for a nested-canvas edit.
  const hiddenRootTagsRef = useRef<LocationTag[]>([])
  const editZoneOverlayRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; scrollX: number; scrollY: number; zoneId: string | null; itemId: string | null } | null>(null)
  /** Suppress the click event that follows a drag-to-pan or a handled zone tap */
  const suppressClickRef = useRef(false)
  const lcaCleanupRef = useRef<(() => void) | null>(null)
  // True while a two-finger pinch is manipulating the zoom. Blocks the resize
  // re-fit (below) from firing zoomToTag mid-gesture — iOS Safari's dynamic
  // toolbar toggles the container height during a pinch, which would otherwise
  // trip the ResizeObserver → reFit → smooth-scroll that fights the pinch.
  const isPinchingRef = useRef(false)
  const pinchEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track edit selection count so toolbar re-renders when shift-selection changes
  const [editSelectionCount, setEditSelectionCount] = useState(0)
  // Item selection in edit mode (mutually exclusive with zone selection). Item
  // pins are tap-to-select; Move re-arranges the selected pin's x/y within the
  // zone (gated behind this selection so raw pin-drag stops fighting canvas scroll).
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [itemMoveMode, setItemMoveMode] = useState(false)
  const [pendingItemDelete, setPendingItemDelete] = useState<LocalPropertyItem[] | null>(null)
  // Nested edit: external name prompt state
  const [namingState, setNamingState] = useState<{ index: number; existingLabel: string } | null>(null)
  const [nameInput, setNameInput] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  // The item pin currently focused by a canvas tap. Drives a deliberate zoom-to-item
  // (like zooming a location) and keeps the resize re-fit framed on the item instead
  // of snapping back to the whole zone. Cleared whenever the selected zone changes.
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null)
  const focusedItemIdRef = useRef<string | null>(null)
  focusedItemIdRef.current = focusedItemId

  const rootLocationId = store.rootLocationId

  // ── Viewport size tracking for infinite canvas ──
  const [vpSize, setVpSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      setVpSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Ref for locations — avoids stale async fetches when locations change mid-save
  const locationsRef = useRef(locations)
  locationsRef.current = locations

  const itemsRef = useRef(items)
  itemsRef.current = items

  // ── Cleanup LCA animation listener on unmount ──
  useEffect(() => () => { lcaCleanupRef.current?.() }, [])

  // ── Load tags and build index ──
  // Fires on rootLocationId (initial load) and tagVersion (sync, tree rename).
  // locationsRef reads fresh data; stale guard prevents old fetches from
  // overwriting newer ones.  bumpTagVersion is NOT called from handleEditSave
  // (optimistic setTagIndex handles it) to avoid racing with Supabase push.
  useEffect(() => {
    if (!clinicId || !rootLocationId) return
    let stale = false

    const allIds = [{ id: rootLocationId }, ...locationsRef.current]
    fetchAllLocationTags(clinicId, allIds)
      .then((tagMap) => { if (!stale) setTagIndex(buildTagIndex(tagMap)) })
      .catch(() => { /* non-fatal */ })

    return () => { stale = true }
  }, [clinicId, rootLocationId, store.tagVersion, locations])

  // ── Root canvas tags (for edit mode + empty-state check) ──
  const canvasTags: LocationTag[] = useMemo(() => {
    if (!tagIndex || !rootLocationId) return []
    return tagIndex.byCanvas.get(rootLocationId) ?? []
  }, [tagIndex, rootLocationId])

  // ── Personnel + Turn-In zones hidden from the overview ──
  // Personnel (member) zones AND the system Turn-In staging zone — never tiled on the
  // company overview, in view OR edit. Personnel live in the top carousel; the Turn-In
  // zone lives in the tree/sheet ("if exists" — only when populated). Selecting one
  // navigates (zooms) into it, at which point its tile + contents render. Kept in the
  // tag index (so navigateToZone can frame them and their items pin inside), just
  // filtered out of the overview render + hidden from the editable root canvas.
  const hiddenOverviewZoneIds = useMemo(
    () => new Set(locations.filter(l => !!l.holder_user_id || l.is_turn_in_zone).map(l => l.id)),
    [locations],
  )

  // ── Exploded-shelf state ──
  // The container zone IS floor 1; its levels are upper floors. Selecting a building that
  // has ≥1 upper floor — OR selecting one of its floors — EXPLODES it: the floors fan
  // up-and-right out of the base (see computeExplodeOffsets), all visible at once. The fan
  // STAYS while you move between floors; the selected floor is surfaced (raised + framed).
  // At rest (nothing on the building selected) every floor is hidden — base = floor 1.
  const explodeContainerId = useMemo(() => {
    const sel = store.selectedZoneId
    if (!sel) return null
    // Any selection INSIDE a floor (the floor, or a zone/item nested within it) keeps that
    // floor's BUILDING exploded — so the level stays fanned and a zone within a level renders
    // AND zooms at its offset position. Collapsing here would snap the level back to full
    // extent, leaving the just-computed zoom offset from where the zone lands.
    let cur: string | null = sel
    let guard = 0
    while (cur && guard++ < 64) {
      const loc = locations.find((l) => l.id === cur)
      if (!loc) break
      if (loc.kind === 'level' && loc.parent_id) return loc.parent_id
      cur = loc.parent_id ?? null
    }
    // Otherwise the selection is the building itself → explode if it has any floors.
    return locations.some((l) => l.parent_id === sel && l.kind === 'level') ? sel : null
  }, [store.selectedZoneId, locations])

  // The surfaced floor = the level of the exploded building that the selection sits on
  // (the floor itself, or the floor an inner zone/item belongs to).
  const surfacedLevelId = useMemo(() => {
    const sel = store.selectedZoneId
    if (!sel || !explodeContainerId) return null
    let cur: string | null = sel
    let guard = 0
    while (cur && guard++ < 64) {
      const loc = locations.find((l) => l.id === cur)
      if (!loc) break
      if (loc.kind === 'level' && loc.parent_id === explodeContainerId) return loc.id
      cur = loc.parent_id ?? null
    }
    return null
  }, [store.selectedZoneId, explodeContainerId, locations])

  const explode = useMemo((): ExplodeSpec | undefined => {
    if (!explodeContainerId) return undefined
    const rects = computeExplodeOffsets(getLevels(locations, explodeContainerId), surfacedLevelId)
    return rects.size > 0 ? { containerId: explodeContainerId, rects } : undefined
  }, [explodeContainerId, surfacedLevelId, locations])

  // Fanned floor tiles must render OPAQUE so they clip/occlude the floors beneath (a
  // shelf of drawers, not a translucent stack) — passed to LocationTagPhoto.
  const opaqueZoneIds = useMemo(
    () => (explode ? new Set(explode.rects.keys()) : undefined),
    [explode],
  )
  // Ref so a canvas tap can tell whether a tapped floor belongs to the exploded building.
  const explodeContainerIdRef = useRef(explodeContainerId)
  explodeContainerIdRef.current = explodeContainerId

  const suppressedIds = useMemo(
    () => collectSuppressedIds(locations, rootLocationId, explodeContainerId, store.selectedZoneId, surfacedLevelId),
    [locations, rootLocationId, explodeContainerId, store.selectedZoneId, surfacedLevelId],
  )

  // ── All tags in world coords (for zoom lookup + toolbar label) ──
  // Upper-floor tags are filtered out (by both target and canvas) so a building shows as
  // its floor-1 footprint — UNLESS it's the exploded selection (all floors fan out) or a
  // floor you've drilled into (that one floor shows). Everything downstream (LOD, zoom,
  // edit, auto-pin) then operates as if the hidden floors simply don't exist.
  const allWorldTags: LocationTag[] = useMemo(() => {
    if (!tagIndex || !rootLocationId) return []
    const flat = flattenToWorld(tagIndex, rootLocationId, explode)
    if (suppressedIds.size === 0) return flat
    return flat.filter((t) => !suppressedIds.has(t.target_id) && !suppressedIds.has(t.location_id))
  }, [tagIndex, rootLocationId, suppressedIds, explode])
  const allWorldTagsRef = useRef(allWorldTags)
  allWorldTagsRef.current = allWorldTags

  // ── Parent bounds for nested editing — world-space tag of the zone being edited ──
  const parentBounds = useMemo(() => {
    if (!editCanvasId || editCanvasId === rootLocationId) return null
    return allWorldTags.find((t) => t.target_id === editCanvasId) ?? null
  }, [editCanvasId, rootLocationId, allWorldTags])

  // ── Visible tags — LOD filter with dynamic depth based on selection ──
  const visibleTags = useMemo(() => {
    if (!rootLocationId) return allWorldTags
    const selectedId = store.selectedZoneId

    const byTargetId = new Map<string, LocationTag>()
    for (const t of allWorldTags) byTargetId.set(t.target_id, t)

    // Compute depth of each tag (0 = root canvas children, 1 = first nested, etc.)
    const depthOf = new Map<string, number>()
    for (const tag of allWorldTags) {
      let depth = 0
      let canvasId = tag.location_id
      while (canvasId && canvasId !== rootLocationId) {
        depth++
        const parentTag = byTargetId.get(canvasId)
        if (!parentTag) break
        canvasId = parentTag.location_id
      }
      depthOf.set(tag.target_id, depth)
    }

    // Build ancestor set so the selected zone + its parent chain are always visible
    const ancestorIds = new Set<string>()
    if (selectedId) {
      ancestorIds.add(selectedId)
      let curLocId = allWorldTags.find((t) => t.target_id === selectedId)?.location_id
      while (curLocId && curLocId !== rootLocationId) {
        ancestorIds.add(curLocId)
        const parentTag = byTargetId.get(curLocId)
        curLocId = parentTag?.location_id
      }
    }

    return allWorldTags.filter((tag) => {
      // Personnel + Turn-In zones never tile the overview — shown only once navigated
      // into (via carousel / tree / sheet); their contents then render via LOD/auto-pin.
      if (hiddenOverviewZoneIds.has(tag.target_id) && tag.target_id !== selectedId && !ancestorIds.has(tag.target_id)) return false
      const depth = depthOf.get(tag.target_id) ?? 0
      // Top-level zones (and root-canvas items) always visible
      if (depth === 0) return true
      // Direct children of the selected zone — always visible
      if (tag.location_id === selectedId) return true
      // Selected zone itself + its ancestor chain — always visible
      if (ancestorIds.has(tag.target_id)) return true

      // LOD: nested zone appears once its parent fills ≥ threshold of viewport
      const parent = byTargetId.get(tag.location_id)
      if (!parent) return false
      const parentFill = Math.max((parent.width ?? 0), (parent.height ?? 0)) * canvasScale
      return parentFill >= LOD_FILL_THRESHOLD
    })
  }, [allWorldTags, rootLocationId, canvasScale, store.selectedZoneId, hiddenOverviewZoneIds])

  // ── Auto-rendered child zones (walks the full tag-less ancestry) ──
  // Child locations with NO drawn zone tag get a default grid rectangle laid out inside
  // their parent's world bounds, so a "New area" sub-zone renders + is tappable the instant
  // it's created. Crucially the selected zone — AND any of its ancestors — may be tag-less
  // (deep "New area" chains); flattenToWorld can't anchor those, so they (and any DRAWN zone
  // nested beneath them) are absent from allWorldTags. We therefore WALK UP the ancestry to
  // the nearest zone WITH real geometry, then derive each intervening tag-less level's rect
  // on the way back down — resolving a zone at ANY depth to world coords (so its items can
  // pin + focus), not just one level up. Without the full walk, selecting an item from a
  // distant ancestor/tree framed nothing (the zone had no resolvable geometry). Dragging a
  // zone in nested edit persists a real tag and drops it from this set.
  const childZoneAutoTags: LocationTag[] = useMemo(() => {
    const selectedId = store.selectedZoneId
    if (!selectedId) return []

    // Place every tag-less child of `parentLocId` inside `parentZone` (a world-space rect).
    const placeChildren = (parentZone: LocationTag, parentLocId: string): LocationTag[] => {
      const taggedChildIds = new Set(
        allWorldTags
          .filter((t) => t.location_id === parentLocId && t.target_type === 'location')
          .map((t) => t.target_id),
      )
      const untagged = locations.filter((l) => l.parent_id === parentLocId && !taggedChildIds.has(l.id) && l.kind !== 'level')
      const rects = layoutChildZones(untagged.length)
      const pw = parentZone.width ?? 0
      const ph = parentZone.height ?? 0
      return untagged.map((loc, i) => ({
        id: `autozone-${loc.id}`,
        location_id: parentLocId,
        target_type: 'location' as const,
        target_id: loc.id,
        x: parentZone.x + rects[i].x * pw,
        y: parentZone.y + rects[i].y * ph,
        width: rects[i].width * pw,
        height: rects[i].height * ph,
        label: loc.name,
        rects: null,
      }))
    }

    const realZoneOf = (id: string) =>
      allWorldTags.find((t) => t.target_id === id && (t.width ?? 0) > 0 && (t.height ?? 0) > 0)

    // Selected zone has real geometry → just render its tag-less children inside it.
    const selectedRealZone = realZoneOf(selectedId)
    if (selectedRealZone) return placeChildren(selectedRealZone, selectedId)

    // Selected zone is itself tag-less. Walk up to the nearest ancestor WITH real geometry,
    // recording the tag-less chain [nearest-real-child … selected] top-down. Bail if the
    // walk runs off the tree (no real anchor) — there's nothing to place against.
    const chain: string[] = []
    let anchor: LocationTag | undefined
    let cur: string | null = selectedId
    let guard = 0
    while (cur && guard++ < 64) {
      const real = realZoneOf(cur)
      if (real) { anchor = real; break }
      chain.unshift(cur)
      cur = locations.find((l) => l.id === cur)?.parent_id ?? null
    }
    if (!anchor) return []

    // Walk back down from the real anchor, deriving each tag-less level's rect. Emit every
    // level's siblings (so the whole path renders, not just the selected zone), then finally
    // the selected zone's own children.
    const out: LocationTag[] = []
    let parentZone = anchor
    let parentLocId = anchor.target_id
    let selfZone: LocationTag | undefined
    for (const stepId of chain) {
      const siblings = placeChildren(parentZone, parentLocId)
      out.push(...siblings)
      const stepZone = siblings.find((t) => t.target_id === stepId)
      if (!stepZone) return out // stale data — render what resolved
      parentZone = stepZone
      parentLocId = stepId
      if (stepId === selectedId) selfZone = stepZone
    }
    if (selfZone) out.push(...placeChildren(selfZone, selectedId))
    return out
  }, [store.selectedZoneId, allWorldTags, locations])
  // Ref so handleZoneTap can zoom to an auto-zone (not present in allWorldTags).
  const childZoneAutoTagsRef = useRef<LocationTag[]>([])
  childZoneAutoTagsRef.current = childZoneAutoTags

  // ── Item pins: only for selected zone, deduplicated against stale persisted pins ──
  // Stale pins arise when an item moves zones but its old pin persists in the old zone's
  // canvas — flattenToWorld emits both old + new, causing duplicate badges.
  const visibleTagsWithPins: LocationTag[] = useMemo(() => {
    const selectedId = store.selectedZoneId

    // Build item→currentZone map to detect stale pins
    const itemLocationMap = new Map<string, string>()
    for (const item of items) itemLocationMap.set(item.id, item.location_id ?? '')

    // Strip item pins that are stale (item moved zones) or not in the selected zone
    const baseTags = visibleTags.filter((t) => {
      if (t.target_type !== 'item') return true
      if (t.location_id !== selectedId) return false
      return itemLocationMap.get(t.target_id) === t.location_id
    })

    if (!selectedId || items.length === 0) return baseTags

    // Auto-pin items in the selected zone that have no saved pin
    const taggedIds = new Set(baseTags.filter((t) => t.target_type === 'item').map((t) => t.target_id))
    // The selected zone may be tag-less (absent from baseTags/allWorldTags) yet resolvable
    // via childZoneAutoTags, which walks the tag-less ancestry to synthesize geometry. Fall
    // back to it so a deep-nested zone's items still auto-pin — otherwise an external item
    // select (tree / search / distant ancestor) frames nothing.
    const selectedZone =
      baseTags.find((t) => (t.width ?? 0) > 0 && t.target_id === selectedId) ??
      childZoneAutoTags.find((t) => t.target_id === selectedId && (t.width ?? 0) > 0)
    if (!selectedZone) return baseTags

    const untagged = items.filter((item) => item.location_id === selectedId && !taggedIds.has(item.id))
    if (untagged.length === 0) return baseTags

    const cols = 3
    const rows = Math.ceil(untagged.length / cols)
    const zw = selectedZone.width ?? 0
    const zh = selectedZone.height ?? 0

    const autoPins: LocationTag[] = untagged.map((item, i) => ({
      id: `auto-${item.id}`,
      location_id: selectedId,
      target_type: 'item' as const,
      target_id: item.id,
      x: selectedZone.x + ((i % cols + 0.5) / cols) * zw,
      y: selectedZone.y + ((Math.floor(i / cols) + 0.5) / rows) * zh,
      width: null,
      height: null,
      label: item.name,
    }))

    return [...baseTags, ...autoPins]
  }, [visibleTags, items, store.selectedZoneId, childZoneAutoTags])
  // Ref so the item-focus zoom (and the resize re-fit) can read the live pin set —
  // a tapped pin is always present here, including auto-pins for the selected zone.
  const visibleTagsWithPinsRef = useRef<LocationTag[]>([])
  visibleTagsWithPinsRef.current = visibleTagsWithPins

  // ── Zoom to a world-coord rect { x, y, width, height } ──
  const zoomToRect = useCallback(
    (rect: { x: number; y: number; width: number; height: number }, smooth = true, bottomInset = 0) => {
      const container = scrollRef.current
      if (!container || !rect.width || !rect.height) return

      const PADDING = 10
      const FILL = 0.80

      const vpW = container.clientWidth
      const vpH = container.clientHeight
      // Mobile's glass header floats over the canvas top (content slides behind it),
      // so framing the zone flush to the viewport top tucks it under the header. Push
      // the vertical target down by the header height. Desktop's solid header doesn't
      // publish --drawer-header-h → var unset → 0, so framing stays top-flush there.
      const headerH = parseFloat(getComputedStyle(container).getPropertyValue('--drawer-header-h')) || 0
      const topInset = PADDING + headerH
      // A mobile sheet covering the bottom of the canvas (bottomInset px) shrinks the
      // visible band. Fit the rect into that band (not the full viewport) so the target
      // — e.g. a focused item pin — lands ABOVE the sheet instead of tucked under it.
      // bottomInset defaults to 0, preserving the original full-viewport framing.
      const heightScale = bottomInset > 0
        ? (FILL * Math.max(1, vpH - topInset - bottomInset)) / (vpH * rect.height)
        : FILL / rect.height
      const newScale = Math.min(FILL / rect.width, heightScale, 100)

      setCanvasScale(newScale)

      // Scroll to the target AFTER the new scale commits. The content box is
      // width = vpW*newScale (see contentW = vpSize.w*canvasScale in render) — derive
      // the scroll extent from the KNOWN newScale rather than measuring scrollWidth,
      // which a single rAF can read BEFORE the enlarged canvas commits. For a large
      // zoom jump (root/overview → a nested item, e.g. picking an item from the master
      // tree sheet) that stale, smaller measurement put the target in the padding and
      // blanked the canvas; near-scale jumps (a pin tap inside the zone, or an item from
      // its already-zoomed parent) hid the error. Two rAFs let the DOM grow to the new
      // size so scrollTo doesn't clamp short of the target.
      const contentW = vpW * newScale
      const contentH = vpH * newScale
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = scrollRef.current
        if (!el) return
        el.scrollTo({
          left: vpW + rect.x * contentW - PADDING,
          top: vpH + rect.y * contentH - topInset,
          behavior: smooth ? 'smooth' : 'instant',
        })
      }))
    },
    [],
  )

  /** Convenience — zoom to a LocationTag */
  const zoomToTag = useCallback(
    (tag: LocationTag) => zoomToRect({ x: tag.x, y: tag.y, width: tag.width ?? 0, height: tag.height ?? 0 }),
    [zoomToRect],
  )

  // ── Expand a building's tag to include its fanned floors ──
  // Grow the base tag to also cover its fanned floors (which spill up-and-right past the
  // footprint) so it flows through the SAME zoom path as every other zone (zoomToTag /
  // zoomViaLCA) — just framing a rect that reaches the highest level. Zones with no floors
  // are returned unchanged. Reads live refs, so it needs no deps.
  const expandTagForFan = useCallback((tag: LocationTag): LocationTag => {
    const levels = getLevels(locationsRef.current, tag.target_id)
    if (levels.length === 0) return tag
    const pw = tag.width ?? 0
    const ph = tag.height ?? 0
    let minX = tag.x
    let minY = tag.y
    let maxX = tag.x + pw
    let maxY = tag.y + ph
    for (const r of computeExplodeOffsets(levels).values()) {
      const wx = tag.x + r.x * pw
      const wy = tag.y + r.y * ph
      minX = Math.min(minX, wx)
      minY = Math.min(minY, wy)
      maxX = Math.max(maxX, wx + r.width * pw)
      maxY = Math.max(maxY, wy + r.height * ph)
    }
    return { ...tag, x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }, [])

  // Item focus box = a fraction of its containing zone, sized PER-AXIS (so it matches
  // the zone's aspect ratio) and CLAMPED to stay inside the zone. The item truly lives
  // inside its zone, so its frame must too: a box that's < the zone on both axes always
  // zooms IN past the zone view (drills one level deeper — same felt zoom-in as picking
  // a zone), and clamping-inside means we never frame outside-zone space. The earlier
  // SQUARE box (sized off the zone's longest side) spilled past thin/wide zones — the
  // frame ran outside the container (pill straddling the border) and under-zoomed, which
  // read as a zoom-OUT. All selection paths call this, so the behaviour is uniform.
  const ITEM_ZONE_FRACTION = 0.4 // item frames at 40% of its zone per axis → ~2.5× drill-in
  const ITEM_FOCUS_SPAN_MAX = 0.18 // per-axis cap so an item in a very large zone still frames tight

  /**
   * Zoom in on an item's pin. The pin's stored (x,y) is the pill CENTRE (view/edit
   * pins render with translate(-50%,-50%)), so we centre the box on it, then slide it
   * back inside the zone if the pin sits near an edge. Returns false if the pin isn't
   * currently rendered (so callers can defer/fall back).
   */
  const focusItemPin = useCallback(
    (itemId: string): boolean => {
      const pin = visibleTagsWithPinsRef.current.find(
        (t) => t.target_type === 'item' && t.target_id === itemId,
      )
      if (!pin) return false
      // The item's containing zone in world space — box its frame relative to this.
      const zone =
        allWorldTagsRef.current.find((t) => t.target_id === pin.location_id && (t.width ?? 0) > 0) ??
        childZoneAutoTagsRef.current.find((t) => t.target_id === pin.location_id && (t.width ?? 0) > 0)
      // On mobile the property sheet covers the bottom of the canvas — frame the pin
      // in the band above it (PropertyPanel publishes the covered height on the map's
      // ancestor). Desktop leaves the var unset → 0 → full-viewport framing.
      const container = scrollRef.current
      const bottomInset = container
        ? parseFloat(getComputedStyle(container).getPropertyValue('--property-map-bottom-inset')) || 0
        : 0

      if (zone) {
        const zx = zone.x
        const zy = zone.y
        const zw = zone.width ?? 0
        const zh = zone.height ?? 0
        // Per-axis fraction (matches zone aspect), each capped so a huge zone still
        // frames the item tightly. Both are < the zone on their axis → guaranteed zoom-in.
        const iw = Math.min(zw * ITEM_ZONE_FRACTION, ITEM_FOCUS_SPAN_MAX)
        const ih = Math.min(zh * ITEM_ZONE_FRACTION, ITEM_FOCUS_SPAN_MAX)
        // Centre on the pin, then clamp the whole box within [zone .. zone+dim - box]
        // so we never spill outside the container (which showed as a zoom-out).
        const x = Math.min(Math.max(pin.x - iw / 2, zx), zx + zw - iw)
        const y = Math.min(Math.max(pin.y - ih / 2, zy), zy + zh - ih)
        zoomToRect({ x, y, width: iw, height: ih }, true, bottomInset)
        return true
      }

      // No zone geometry (shouldn't happen for a rendered pin) — small square fallback.
      const half = ITEM_FOCUS_SPAN_MAX / 2
      zoomToRect({
        x: Math.max(0, pin.x - half),
        y: Math.max(0, pin.y - half),
        width: ITEM_FOCUS_SPAN_MAX,
        height: ITEM_FOCUS_SPAN_MAX,
      }, true, bottomInset)
      return true
    },
    [zoomToRect],
  )

  // ── Fit all zones on initial mount — recomputes when tagIndex first populates ──
  const didInitialFitRef = useRef(false)
  useEffect(() => {
    if (didInitialFitRef.current || !rootLocationId || !tagIndex) return
    const rootTags = tagIndex.byCanvas.get(rootLocationId) ?? []
    if (rootTags.length === 0) {
      const el = scrollRef.current
      if (el) {
        requestAnimationFrame(() => {
          const vw = el.clientWidth
          const vh = el.clientHeight
          el.scrollLeft = vw / 2 + (el.scrollWidth - 2 * vw) / 2
          el.scrollTop = vh / 2 + (el.scrollHeight - 2 * vh) / 2
        })
      }
      return
    }
    didInitialFitRef.current = true
    const minX = Math.min(...rootTags.map((t) => t.x))
    const minY = Math.min(...rootTags.map((t) => t.y))
    const maxX = Math.max(...rootTags.map((t) => t.x + (t.width ?? 0)))
    const maxY = Math.max(...rootTags.map((t) => t.y + (t.height ?? 0)))
    const margin = 0.04
    zoomToRect(
      { x: Math.max(0, minX - margin), y: Math.max(0, minY - margin), width: maxX - minX + margin * 2, height: maxY - minY + margin * 2 },
      false,
    )
  }, [rootLocationId, tagIndex, zoomToRect])

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

      // Zoom out to LCA, then zoom in to target — driven by scrollend events
      const container = scrollRef.current
      lcaCleanupRef.current?.()

      if (!container) {
        zoomToTag(lcaTag)
        zoomToTag(toTag)
        return
      }

      store.setTransitionState('zooming-out')
      zoomToTag(lcaTag)

      const onZoomOutEnd = () => {
        container.removeEventListener('scrollend', onZoomOutEnd)
        store.setTransitionState('zooming-in')
        zoomToTag(toTag)

        const onZoomInEnd = () => {
          container.removeEventListener('scrollend', onZoomInEnd)
          lcaCleanupRef.current = null
          store.setTransitionState('idle')
        }
        container.addEventListener('scrollend', onZoomInEnd, { once: true })
        lcaCleanupRef.current = () => {
          container.removeEventListener('scrollend', onZoomInEnd)
        }
      }
      container.addEventListener('scrollend', onZoomOutEnd, { once: true })
      lcaCleanupRef.current = () => {
        container.removeEventListener('scrollend', onZoomOutEnd)
      }
    },
    [tagIndex, rootLocationId, allWorldTags, zoomToTag, store],
  )

  // ── Zone tap → select + zoom ──
  const handleZoneTap = useCallback(
    (targetId: string) => {
      // Tapping already-selected zone → step out one level (inside an exploded building)
      // or deselect. Backing out of a zone-within-a-floor returns to the floor, not overview.
      if (targetId === store.selectedZoneId) {
        if (!stepOutRef.current()) store.selectZone(null)
        return
      }

      // Tapping a floor in the already-exploded fan → SURFACE it: just select it (which
      // lifts it to the top + reveals its contents via the explode/suppression memos). NO
      // camera move — the whole fan is already framed at the right zoom + x/y, so a re-zoom
      // to the floor would only jar; changing the surfaced level is enough.
      const tappedLoc = locationsRef.current.find((l) => l.id === targetId)
      if (tappedLoc?.kind === 'level' && tappedLoc.parent_id === explodeContainerIdRef.current) {
        store.setActiveLevel(tappedLoc.parent_id, targetId)
        store.selectZone(targetId)
        return
      }

      const prevId = store.selectedZoneId
      store.selectZone(targetId)

      const baseTag =
        allWorldTags.find((t) => t.target_id === targetId) ??
        childZoneAutoTagsRef.current.find((t) => t.target_id === targetId)
      if (!baseTag) return
      // A building with floors zooms via the SAME path as any zone — just to a rect grown
      // to include its highest fanned floor (expandTagForFan); plain zones are unchanged.
      const tag = expandTagForFan(baseTag)

      // If navigating between siblings/unrelated zones, use shared-parent animation
      if (prevId && prevId !== targetId) {
        zoomViaLCA(prevId, targetId, tag)
      } else {
        zoomToTag(tag)
      }
    },
    [store, allWorldTags, zoomToTag, zoomViaLCA, expandTagForFan],
  )

  // Canvas zone tap entry point. On desktop, handlePanEnd has already handled the
  // tap (and set suppressClickRef) by the time the zone div's own onClick fires —
  // without this guard that trailing click re-invokes handleZoneTap for the same
  // id and the targetId===selectedZoneId branch deselects it, so the zone never
  // stays targeted. Mobile never sets suppressClickRef in view mode, so the zone
  // onClick drives selection normally.
  const handleCanvasZoneTap = useCallback(
    (targetId: string) => {
      if (suppressClickRef.current) return
      handleZoneTap(targetId)
    },
    [handleZoneTap],
  )

  // ── Item pin tap → focus-zoom the item, then open its detail ──
  // Mirrors zone tap: tapping an item drills the canvas in on it (instead of the
  // old behaviour where the right-pane open just snapped the view back to the zone).
  const handleItemTap = useCallback(
    (item: LocalPropertyItem) => {
      setFocusedItemId(item.id)
      focusItemPin(item.id)
      onSelectItem?.(item)
    },
    [focusItemPin, onSelectItem],
  )

  // ── Reset zoom — fit all top-level zones into view ──
  const handleResetZoom = useCallback(() => {
    store.selectZone(null)

    // Compute bounding box of all depth-0 zones
    const rootTags = allWorldTags.filter((t) => t.location_id === rootLocationId)
    if (rootTags.length > 0) {
      const minX = Math.min(...rootTags.map((t) => t.x))
      const minY = Math.min(...rootTags.map((t) => t.y))
      const maxX = Math.max(...rootTags.map((t) => t.x + (t.width ?? 0)))
      const maxY = Math.max(...rootTags.map((t) => t.y + (t.height ?? 0)))
      // Add margin around the bbox so zones aren't flush against edges
      const margin = 0.04
      zoomToRect({
        x: Math.max(0, minX - margin),
        y: Math.max(0, minY - margin),
        width: maxX - minX + margin * 2,
        height: maxY - minY + margin * 2,
      })
    } else {
      setCanvasScale(1)
      requestAnimationFrame(() => {
        const el = scrollRef.current
        if (!el) return
        const vw = el.clientWidth
        const vh = el.clientHeight
        el.scrollTo({
          left: vw / 2 + (el.scrollWidth - 2 * vw) / 2,
          top: vh / 2 + (el.scrollHeight - 2 * vh) / 2,
          behavior: 'smooth',
        })
      })
    }
  }, [store, allWorldTags, rootLocationId, zoomToRect])

  // ── Re-fit on container resize ──
  // The canvas geometry (contentW/padX) scales off vpSize; a resize (window OR the
  // desktop right-pane open/close animating the center column width) leaves the
  // absolute scroll position pointing into the padding → zones scroll out of view.
  // Re-fit (to the selected zone, else all root zones) once the size settles.
  // Captured in a ref so the effect depends ONLY on vpSize (not on every store/tag change).
  const reFitRef = useRef<() => void>(() => {})
  reFitRef.current = () => {
    // Never re-frame mid-pinch — the user is manually driving the zoom and any
    // programmatic zoomToTag here would fight the gesture (bug: "canvas loses the
    // hold on zoom and wilds out" while pinching inside a selected zone).
    if (isPinchingRef.current) return
    // A focused item wins: keep the view framed on the tapped item (e.g. the desktop
    // right-pane open that animates the center column width fires this re-fit — without
    // this it would snap back to the whole zone and lose the item).
    const focusedItem = focusedItemIdRef.current
    if (focusedItem && focusItemPin(focusedItem)) return
    // A pending external item focus (route/tree/search select whose pin hasn't
    // rendered yet) owns the camera — do NOT fall through to zone framing, or this
    // resize re-fit would zoom out to the whole zone and clobber the incoming item
    // focus. Try to grab it now; otherwise yield and let the deferred effect land it.
    const pendingItem = pendingFocusItemRef.current
    if (pendingItem) { focusItemPin(pendingItem); return }
    const sel = store.selectedZoneId
    // A selected tag-less sub-zone lives in childZoneAutoTags, not allWorldTags. Consult
    // both so the re-fit zooms to it instead of falling through to handleResetZoom — which
    // deselects (selectZone(null)) and would close the right pane the selection just opened.
    // expandTagForFan grows a building's rect to include its fanned floors (no-op for plain
    // zones), so a resize re-frames the whole fan instead of clipping the top floor.
    const selTag = sel
      ? (allWorldTagsRef.current.find((tg) => tg.target_id === sel)
          ?? childZoneAutoTagsRef.current.find((tg) => tg.target_id === sel))
      : null
    if (selTag) zoomToTag(expandTagForFan(selTag))
    // Only re-fit to root when nothing is selected — never deselect on a mere resize.
    else if (!sel) handleResetZoom()
  }
  useEffect(() => {
    if (vpSize.w === 0 || vpSize.h === 0) return
    if (!didInitialFitRef.current) return // let the initial fit run first
    if (isPinchingRef.current) return // don't schedule a re-fit against an active pinch
    const t = setTimeout(() => reFitRef.current(), 160)
    return () => clearTimeout(t)
  }, [vpSize.w, vpSize.h])

  // ── Deferred navigation — handles cases where tags haven't loaded yet ──
  const pendingNavRef = useRef<string | null>(null)
  // ── Deferred item focus — an external item select (right pane / sheet / tree /
  // search) may target an item in a not-yet-selected zone, whose pin only renders
  // after the zone selection commits. Stash the item id; a visibleTagsWithPins
  // effect drills in once the pin is live.
  const pendingFocusItemRef = useRef<string | null>(null)

  // skipZoom: select the zone but move NO camera. Used when the real target is an
  // item inside the zone — the zone-framing zoom here is the "competing fit" that
  // clobbers the deferred per-item focus (same failure mode as the MapOverlay
  // open-from-message bug). With skipZoom the deferred focusItemPin is the ONLY
  // camera op, so a route/tree/search item select lands at item depth, matching a
  // canvas pin tap instead of flashing the whole-zone zoom-out.
  const executeNavigation = useCallback((targetId: string, skipZoom = false) => {
    // Consult childZoneAutoTags too (tag-less sub-zones) so external nav can frame
    // them — same lookup a direct canvas tap (handleZoneTap) uses.
    const tag =
      allWorldTags.find((t) => t.target_id === targetId) ??
      childZoneAutoTagsRef.current.find((t) => t.target_id === targetId)
    if (!tag) return false

    const prevId = store.selectedZoneId
    store.selectZone(targetId)
    if (skipZoom) return true

    // Reuse the SAME zoom-to logic as a direct canvas zone tap (handleZoneTap): travel from
    // the current selection to the target via their lowest common ancestor. A building with
    // floors just frames a rect grown to include its highest fanned floor (expandTagForFan);
    // plain zones are unchanged. This unifies every nav source — rail/sheet tree, detail-pane
    // rows, breadcrumb, search, and the map tap — so they animate the same, down and up.
    const framed = expandTagForFan(tag)
    if (prevId && prevId !== targetId) zoomViaLCA(prevId, targetId, framed)
    else zoomToTag(framed)

    return true
  }, [allWorldTags, store, zoomViaLCA, zoomToTag, expandTagForFan])

  // ── Step out one level — the reverse of drilling in ──
  // Inside an exploded building, "backing out" (tap the selected zone, tap empty canvas)
  // climbs the tree one step instead of dropping straight to the overview: a zone within a
  // floor → the floor (level view), a floor → the whole building fan, the building →
  // overview. Uses the shared zoom (executeNavigation), so each step animates like any nav.
  // Returns false outside the levels mode so callers fall back to the plain deselect.
  const stepOutRef = useRef<() => boolean>(() => false)
  stepOutRef.current = () => {
    const sel = store.selectedZoneId
    if (!sel || !explodeContainerIdRef.current) return false
    const parent = locationsRef.current.find((l) => l.id === sel)?.parent_id ?? null
    if (!parent || parent === rootLocationId) {
      handleResetZoom() // at the building → zoom back out to the overview
      return true
    }
    executeNavigation(parent) // → the level, or the building, framed via the shared zoom
    return true
  }

  // ── External item focus — the imperative equivalent of a canvas pin tap ──
  // Mirrors handleItemTap, but reachable from PropertyPanel for selections that
  // never touch the canvas (right-pane / sheet / tree / search item rows). When
  // the item already lives in the active zone its pin is rendered, so focus
  // straight away; otherwise navigate to its zone and defer the drill-in to the
  // visibleTagsWithPins effect (the zone selection has to render the pin first).
  // Activate the floor(s) on a zone's ancestry so a top-level / search / tree select
  // can reveal a zone that lives on a currently-INACTIVE level — otherwise
  // collectSuppressedIds filters that level's whole subtree out of allWorldTags and
  // the target frames nothing. Walk zone→root; every `level` ancestor is made active
  // in its container. This is what drilling in via the FloorSwitcher does implicitly;
  // the direct path has to do it explicitly. No-op for zones on no floor (normal case).
  const activateAncestorFloors = useCallback((zoneId: string) => {
    const locs = locationsRef.current
    let cur: string | null = zoneId
    let guard = 0
    while (cur && guard++ < 64) {
      const loc = locs.find((l) => l.id === cur)
      if (!loc) break
      if (loc.kind === 'level' && loc.parent_id && store.activeLevelByContainer[loc.parent_id] !== loc.id) {
        store.setActiveLevel(loc.parent_id, loc.id)
      }
      cur = loc.parent_id ?? null
    }
  }, [store])

  const focusItemExternal = useCallback((itemId: string) => {
    const item = itemsRef.current.find((i) => i.id === itemId)
    const zoneId = item?.location_id ?? null
    if (zoneId && zoneId === store.selectedZoneId && focusItemPin(itemId)) {
      setFocusedItemId(itemId)
      return
    }
    pendingFocusItemRef.current = itemId
    if (zoneId && zoneId !== store.selectedZoneId) {
      // Reveal the zone's floor if it sits on an inactive level (else it's suppressed
      // out of the tag set and nothing frames). This recomputes allWorldTags next render.
      activateAncestorFloors(zoneId)
      // Select the zone WITHOUT its framing zoom (skipZoom) — the deferred focusItemPin
      // (fired once the pin renders) is then the SOLE camera op, so this path zooms to
      // the item at item depth exactly like a canvas pin tap, not to the whole zone.
      // executeNavigation returning false (tags still loading, or a floor we just
      // activated whose suppression hasn't recomputed yet) is fine — we still select the
      // zone here; the deferred focus effect (keyed on visibleTagsWithPins) re-fires once
      // the pin renders and drills to the ITEM. Do NOT set pendingNavRef here: that would
      // run a competing whole-zone zoomToTag that clobbers the item focus (the item
      // "flashes then the map pops back out to the zone").
      if (!executeNavigation(zoneId, true)) store.selectZone(zoneId)
    }
  }, [store, focusItemPin, executeNavigation, activateAncestorFloors])

  // ── Imperative handle for external navigation (tree clicks, breadcrumbs) ──
  const handleAddFloor = useCallback(async (containerId: string) => {
    const ord = nextFloorOrdinal(getLevels(locationsRef.current, containerId))
    const created = await store.addLevel(containerId, `Floor ${ord}`, ord)
    if (!created) return
    store.setActiveLevel(containerId, created.id)
    store.selectZone(created.id)
    pendingNavRef.current = created.id
  }, [store])

  // Delegated through a ref so the imperative handle can reach handleStartDrawZone
  // (defined below) without a forward reference / stale-closure dep.
  const startDrawZoneRef = useRef<(parentId: string | null) => void>(() => {})

  useImperativeHandle(ref, () => ({
    navigateToZone(targetId: string) {
      if (!executeNavigation(targetId)) {
        // Tags not loaded yet — defer until they arrive
        pendingNavRef.current = targetId
        store.selectZone(targetId)
      } else {
        pendingNavRef.current = null
      }
    },
    focusItem(itemId: string) {
      focusItemExternal(itemId)
    },
    resetZoom() {
      handleResetZoom()
    },
    clearSelection() {
      store.selectZone(null)
    },
    addFloorTo(containerId: string) {
      void handleAddFloor(containerId)
    },
    startDrawZone(parentId: string | null) {
      startDrawZoneRef.current(parentId)
    },
  }), [executeNavigation, focusItemExternal, store, handleResetZoom, handleAddFloor])

  // Notify the parent of zone-selection changes so it can drive the right-pane
  // location detail. Ref-indirected so the effect only depends on the selection.
  const onSelectZoneRef = useRef(onSelectZone)
  onSelectZoneRef.current = onSelectZone
  const onZoneDrawnRef = useRef(onZoneDrawn)
  onZoneDrawnRef.current = onZoneDrawn
  const onDrawingChangeRef = useRef(onDrawingChange)
  onDrawingChangeRef.current = onDrawingChange
  useEffect(() => {
    onSelectZoneRef.current?.(store.selectedZoneId)
  }, [store.selectedZoneId])

  // A zone change (tap another zone, drill up, deselect on empty canvas) makes any
  // focused item stale → drop it so the re-fit falls back to zone/root framing.
  // Item taps don't change the selected zone (the pin lives in it), so this never
  // clears a focus that handleItemTap just set.
  useEffect(() => {
    setFocusedItemId(null)
  }, [store.selectedZoneId])

  // Process a deferred external item focus once the target zone's pins render.
  // Runs AFTER the zone-change clear above, so the focus it sets isn't clobbered.
  // Keyed on visibleTagsWithPins so it also catches pins that land via async tag
  // load. One-shot: clears the pending ref the moment the pin is framed.
  useEffect(() => {
    const pendingItem = pendingFocusItemRef.current
    if (!pendingItem) return
    if (focusItemPin(pendingItem)) {
      setFocusedItemId(pendingItem)
      pendingFocusItemRef.current = null
    }
  }, [visibleTagsWithPins, focusItemPin])

  // ── Parent-driven item close → drop the lit pin + return to zone framing ──
  // The parent (PropertyPanel) owns the open-item lifecycle: it opens the detail on
  // select and closes it on back-to-zone / empty-canvas / tab switch. `selectedItem` is
  // that authoritative signal. A canvas pin tap sets focusedItemId internally for the
  // immediate zoom, then the parent echoes the SAME item back through this prop in the
  // same batched render (no-op here). But item taps deliberately don't change the
  // selected zone, so the zone-change clear (above) never fires on close — without this,
  // the pin stays highlighted and the resize re-fit keeps pinning a now-closed item
  // ("go back to the zone and the item indicator is still lit"). On close (selectedItem
  // → null) drop the focus and re-fit, which re-frames the still-selected zone.
  const openItemId = selectedItem?.id ?? null
  useEffect(() => {
    if (openItemId) return
    if (!focusedItemIdRef.current && !pendingFocusItemRef.current) return
    setFocusedItemId(null)
    focusedItemIdRef.current = null // sync now so the re-fit below doesn't re-grab the item
    pendingFocusItemRef.current = null
    reFitRef.current()
  }, [openItemId])

  // Process deferred navigation when tags load
  useEffect(() => {
    if (!pendingNavRef.current || !tagIndex) return
    if (executeNavigation(pendingNavRef.current)) {
      pendingNavRef.current = null
    } else {
      logger.warn('Deferred nav target not found in tags:', pendingNavRef.current)
      pendingNavRef.current = null
    }
  }, [allWorldTags, executeNavigation, tagIndex])

  // ── Edit mode ──
  const handleEnterEdit = useCallback(async (startDrawing = false) => {
    if (!rootLocationId) return
    // Edit the selected zone's canvas (nested) or root canvas
    const canvasId = store.selectedZoneId || rootLocationId
    const allTags = await fetchLocationTags(canvasId)

    // Separate zone tags from item pins — CanvasEditOverlay only processes zone tags
    const zoneTags = allTags.filter((t) => t.target_type !== 'item')
    setEditCanvasId(canvasId)
    hiddenRootTagsRef.current = []

    // Seed default rectangles for child locations that have no drawn zone yet, so
    // they appear as editable zones (drag/resize to persist). target_id is the
    // existing location id → handleEditSave won't re-create it, just persists the tag.
    if (canvasId !== rootLocationId) {
      const taggedChildIds = new Set(zoneTags.filter((t) => t.target_type === 'location').map((t) => t.target_id))
      const untaggedChildren = locationsRef.current.filter((l) => l.parent_id === canvasId && !taggedChildIds.has(l.id) && l.kind !== 'level')
      const rects = layoutChildZones(untaggedChildren.length)
      const seededZones: LocationTag[] = untaggedChildren.map((loc, i) => ({
        id: crypto.randomUUID(),
        location_id: canvasId,
        target_type: 'location' as const,
        target_id: loc.id,
        x: rects[i].x,
        y: rects[i].y,
        width: rects[i].width,
        height: rects[i].height,
        label: loc.name,
        rects: null,
      }))
      setEditCanvasTags([...zoneTags, ...seededZones])
    } else {
      // Root canvas: personnel + Turn-In tiles are hidden from the editable overview
      // (they're only rendered/edited once selected → their own nested canvas). Stash
      // them so the full-replace save re-merges them instead of deleting them.
      hiddenRootTagsRef.current = zoneTags.filter((t) => hiddenOverviewZoneIds.has(t.target_id))
      setEditCanvasTags(zoneTags.filter((t) => !hiddenOverviewZoneIds.has(t.target_id)))
    }

    // Load item pins for non-root zone edits; auto-place any items without a saved pin
    if (canvasId !== rootLocationId) {
      const savedPins = allTags.filter((t) => t.target_type === 'item')
      const taggedIds = new Set(savedPins.map((p) => p.target_id))
      const untaggedItems = itemsRef.current.filter((i) => i.location_id === canvasId && !taggedIds.has(i.id))
      const cols = 3
      const rows = Math.max(1, Math.ceil(untaggedItems.length / cols))
      const autoPins: LocationTag[] = untaggedItems.map((item, idx) => ({
        id: crypto.randomUUID(),
        location_id: canvasId,
        target_type: 'item' as const,
        target_id: item.id,
        x: ((idx % cols) + 0.5) / cols,
        y: (Math.floor(idx / cols) + 0.5) / rows,
        width: null,
        height: null,
        label: item.name,
      }))
      setEditItemPins([...savedPins, ...autoPins])
    } else {
      setEditItemPins([])
    }

    setIsDrawing(startDrawing)
    setIsResizing(false)
    setIsMoving(false)
    setIsEditing(true)

    // For nested edit, zoom to parent zone so it's centered/visible
    if (canvasId !== rootLocationId) {
      const parentTag = allWorldTags.find((t) => t.target_id === canvasId)
      if (parentTag) zoomToTag(parentTag)
    }
  }, [rootLocationId, store.selectedZoneId, allWorldTags, zoomToTag, hiddenOverviewZoneIds])

  const handleExitEdit = useCallback(() => {
    setIsEditing(false)
    setIsDrawing(false)
    setIsResizing(false)
    setIsMoving(false)
    setEditCanvasId(null)
    setEditItemPins([])
    setSelectedItemIds(new Set())
    setItemMoveMode(false)
    setNamingState(null)
    setNameInput('')
    if (drawOnce) {
      setDrawOnce(false)
      onDrawingChangeRef.current?.(false)
    }
  }, [drawOnce])

  // ── Item pins in edit mode: select → act (Move / Delete / Merge) ──────────────
  // Selecting an item hands the toolbar context to items and drops any zone
  // selection (mutually exclusive). Move re-arranges x/y (persists on Save);
  // Delete + Merge are immediate store mutations (audit-logged, serialized-guarded)
  // and are NOT rolled back by Cancel — items are their own accountability entity.
  const handleZoneSelectionChange = useCallback((count: number) => {
    setEditSelectionCount(count)
    if (count > 0) { setSelectedItemIds(new Set()); setItemMoveMode(false) }
  }, [])

  const handleToggleItemSelect = useCallback((item: LocalPropertyItem) => {
    editRef.current?.clearSelection()
    setItemMoveMode(false)
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
  }, [])

  const handleDeleteSelectedItems = useCallback(() => {
    const sel = itemsRef.current.filter((i) => selectedItemIds.has(i.id))
    if (sel.length) setPendingItemDelete(sel)
  }, [selectedItemIds])

  const handleConfirmItemDelete = useCallback(async () => {
    const sel = pendingItemDelete
    if (!sel) return
    const ids = new Set(sel.map((i) => i.id))
    for (const it of sel) await store.removeItem(it.id)
    setEditItemPins((prev) => prev.filter((p) => !ids.has(p.target_id)))
    setSelectedItemIds(new Set())
    setItemMoveMode(false)
    setPendingItemDelete(null)
  }, [pendingItemDelete, store])

  const handleMergeSelectedItems = useCallback(async () => {
    const sel = itemsRef.current.filter((i) => selectedItemIds.has(i.id))
    if (sel.length !== 2) return
    // First stays (absorbs), second is the source and ceases.
    const [target, source] = sel
    await store.mergeItems(source.id, target.id)
    setEditItemPins((prev) => prev.filter((p) => p.target_id !== source.id))
    setSelectedItemIds(new Set())
    setItemMoveMode(false)
  }, [selectedItemIds, store])

  // Drop item selection when the edited canvas changes (drilling into a nested zone).
  useEffect(() => { setSelectedItemIds(new Set()); setItemMoveMode(false) }, [editCanvasId])

  // ── Standardized add-zone: enter single-rectangle draw mode on parentId's canvas ──
  // Loads the canvas's existing zones as visual context, then the first drawn rect
  // commits via handleDrawOnceComplete → onZoneDrawn (parent opens the details sheet).
  const handleStartDrawZone = useCallback(async (parentId: string | null) => {
    if (!rootLocationId) return
    const canvasId = parentId ?? rootLocationId
    // Select the parent zone so nested framing (parentBounds) renders; null at root.
    store.selectZone(parentId)
    const allTags = await fetchLocationTags(canvasId)
    setEditCanvasId(canvasId)
    // Personnel + Turn-In tiles stay hidden while drawing too. Draw-once never saves
    // this canvas (it reports the rect up + exits), so no re-merge stash is needed.
    hiddenRootTagsRef.current = []
    setEditCanvasTags(allTags.filter((t) => t.target_type !== 'item' && !hiddenOverviewZoneIds.has(t.target_id)))
    setEditItemPins([])
    setNamingState(null)
    setDrawOnce(true)
    setIsDrawing(true)
    setIsResizing(false)
    setIsMoving(false)
    setIsEditing(true)
    onDrawingChangeRef.current?.(true)
    if (canvasId !== rootLocationId) {
      const parentTag = allWorldTags.find((t) => t.target_id === canvasId)
      if (parentTag) zoomToTag(parentTag)
    }
  }, [rootLocationId, store, allWorldTags, zoomToTag, hiddenOverviewZoneIds])
  startDrawZoneRef.current = handleStartDrawZone

  // Single-draw rect committed → exit edit + report to parent (which opens the sheet).
  const handleDrawOnceComplete = useCallback((rect: { x: number; y: number; width: number; height: number }) => {
    const canvasId = editCanvasId
    handleExitEdit()
    if (canvasId) onZoneDrawnRef.current?.(rect, canvasId)
  }, [editCanvasId, handleExitEdit])

  // ── Nested edit: external name prompt handlers ──
  const handleExternalNameConfirm = useCallback(() => {
    editRef.current?.confirmName(nameInput)
    setNamingState(null)
    setNameInput('')
  }, [nameInput])

  const handleExternalNameCancel = useCallback(() => {
    editRef.current?.cancelName()
    setNamingState(null)
    setNameInput('')
  }, [])

  // Focus external name input when naming state changes
  useEffect(() => {
    if (namingState) {
      setNameInput(namingState.existingLabel)
      setTimeout(() => nameInputRef.current?.focus(), 50)
    }
  }, [namingState])

  const handleEditSave = useCallback(
    async (newTags: (Omit<LocationTag, 'id'> & { id?: string })[], mergedAwayIds: string[]) => {
      const canvasId = editCanvasId || rootLocationId
      if (!canvasId) return

      // Determine parent_id for new locations: if editing a nested canvas, parent is the canvas zone
      const parentId = canvasId !== rootLocationId ? canvasId : null

      const existingIds = new Set(locationsRef.current.map((l) => l.id))
      existingIds.add(rootLocationId!)

      const resolvedTags = [...newTags]
      for (let i = 0; i < resolvedTags.length; i++) {
        const tag = resolvedTags[i]
        if (tag.target_type === 'location' && !existingIds.has(tag.target_id)) {
          const result = await onCreateLocation({
            clinic_id: clinicId,
            parent_id: parentId,
            name: tag.label,
            photo_data: null,
            holder_user_id: null,
            created_by: '',
          })
          if (result?.success && result.location) {
            resolvedTags[i] = { ...tag, target_id: result.location.id }
          }
        }
      }

      // Transfer items from merged-away locations to the surviving merged zone
      if (mergedAwayIds.length > 0 && onEditItem) {
        const survivingTag = resolvedTags.find(
          (t) => t.rects && t.rects.length > 0 && !mergedAwayIds.includes(t.target_id),
        )
        if (survivingTag) {
          const affectedItems = itemsRef.current.filter((i) => i.location_id && mergedAwayIds.includes(i.location_id))
          for (const item of affectedItems) {
            await onEditItem(item.id, { location_id: survivingTag.target_id })
          }
        }
        for (const id of mergedAwayIds) {
          await onDeleteLocation(id)
        }
      }

      // Merge item pins + the hidden personnel/Turn-In root tiles back in so they aren't
      // clobbered by the full-replace zone tag save (they were filtered out of the
      // editable set to declutter the overview, but still live on this canvas).
      const savedTags = await upsertLocationTags(canvasId, [...resolvedTags, ...editItemPinsRef.current, ...hiddenRootTagsRef.current])

      // Optimistic: update tagIndex directly so the new zones show instantly.
      if (savedTags.success && savedTags.tags) {
        setTagIndex((prev) => {
          if (!prev) return prev
          const newByCanvas = new Map(prev.byCanvas)
          newByCanvas.set(canvasId, savedTags.tags!)
          return buildTagIndex(newByCanvas)
        })
      }

      handleExitEdit()

      // onCreateLocation (above) mutated `locations`, which already re-fired the
      // tagIndex effect MID-save with a stale fetch that started before the tags
      // were written — left alone it resolves late and clobbers the optimistic
      // update (the "nested zones never render" bug). The Supabase push in
      // upsertLocationTags is awaited by now, so bumping tagVersion is safe: it
      // invalidates that stale fetch via the effect's `stale` guard and runs one
      // authoritative refetch after the write has landed on both IDB and server.
      store.bumpTagVersion()
    },
    [editCanvasId, rootLocationId, clinicId, onCreateLocation, onDeleteLocation, onEditItem, handleExitEdit, store],
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
  // Desktop: capture pointer for drag-to-pan.
  // Mobile view mode: skip entirely — native scroll handles pan, onClick handles taps.
  const handlePanStart = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    if (e.clientX < 20 || e.clientX > window.innerWidth - 20) return
    // In edit mode, only allow panning when NOT drawing (draw mode captures its own events)
    if (isEditing && isDrawing) return
    if ((e.target as HTMLElement).closest('[data-zoom-controls]')) return
    // In edit mode, don't pan when interacting with a zone or its controls
    if (isEditing && (e.target as HTMLElement).closest('[data-zone]')) return
    // Same for item pins: capturing the pointer here would eat the pin's own onClick
    // (select) / drag (Move), so a pin tap could never select in edit mode.
    if (isEditing && (e.target as HTMLElement).closest('[data-item-pin]')) return

    // Mobile view mode: let native scroll handle everything — zone taps use onClick
    if (isMobile && e.pointerType === 'touch' && !isEditing) return

    const el = scrollRef.current
    if (!el) return

    const zoneEl = (e.target as HTMLElement).closest('[data-zone-target]')
    const zoneId = zoneEl?.getAttribute('data-zone-target') ?? null
    const itemEl = (e.target as HTMLElement).closest('[data-item-target]')
    const itemId = itemEl?.getAttribute('data-item-target') ?? null
    dragRef.current = { startX: e.clientX, startY: e.clientY, scrollX: el.scrollLeft, scrollY: el.scrollTop, zoneId, itemId }

    // Desktop: capture pointer for drag-to-pan (mobile uses native scroll)
    if (!isMobile && e.pointerType === 'mouse') {
      el.setPointerCapture(e.pointerId)
      el.style.cursor = 'grabbing'
    }
  }, [isEditing, isDrawing, isMobile])

  const handlePanMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    // Desktop mouse-drag panning — mobile relies on native scroll
    if (!isMobile && e.pointerType === 'mouse') {
      const dx = Math.abs(e.clientX - dragRef.current.startX)
      const dy = Math.abs(e.clientY - dragRef.current.startY)
      if (dx > TAP_THRESHOLD || dy > TAP_THRESHOLD) {
        suppressClickRef.current = true
      }
      const el = scrollRef.current
      if (!el) return
      el.scrollLeft = dragRef.current.scrollX - (e.clientX - dragRef.current.startX)
      el.scrollTop = dragRef.current.scrollY - (e.clientY - dragRef.current.startY)
    }
  }, [isMobile])

  const handlePanEnd = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null

    // Desktop: release pointer capture and restore cursor
    if (!isMobile && e.pointerType === 'mouse') {
      const el = scrollRef.current
      if (el) {
        try { el.releasePointerCapture(e.pointerId) } catch {}
        el.style.cursor = ''
      }

      // Desktop tap detection — pointer capture prevents zone onClick from firing,
      // so we detect taps here via drag threshold (mobile uses onClick directly)
      if (!isEditing) {
        const dx = Math.abs(e.clientX - d.startX)
        const dy = Math.abs(e.clientY - d.startY)
        if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD) {
          // Suppress the subsequent click so handleCanvasClick doesn't undo the selection
          suppressClickRef.current = true
          if (d.itemId) {
            // Pointer capture ate the pin's own onClick — resolve the item tap here so
            // a pin tap focus-zooms + opens the item instead of deselecting the zone.
            const it = itemsRef.current.find((i) => i.id === d.itemId)
            if (it) handleItemTap(it)
          } else if (d.zoneId) {
            handleZoneTap(d.zoneId)
          } else if (store.selectedZoneId) {
            // Empty-canvas tap → step out one level inside a building, else deselect.
            if (!stepOutRef.current()) store.selectZone(null)
          }
        }
      }
    }
    // Reset suppress flag after click event fires (click comes after pointerup in the same frame)
    setTimeout(() => { suppressClickRef.current = false }, 0)
  }, [isMobile, isEditing, store, handleZoneTap, handleItemTap])

  // Item-pin tap entry point for the pin's own onClick. On desktop the pointer-capture
  // tap detection in handlePanEnd has already fired handleItemTap and set
  // suppressClickRef, so this guard drops the trailing click; on mobile (no capture)
  // it drives the tap normally.
  const handleCanvasItemTap = useCallback(
    (item: LocalPropertyItem) => {
      if (suppressClickRef.current) return
      handleItemTap(item)
    },
    [handleItemTap],
  )

  // ── Canvas click — deselect when tapping empty canvas (mobile uses this + zone onClick) ──
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (isEditing) return
    // Suppress click that follows a drag-to-pan
    if (suppressClickRef.current) return
    // If the click landed on a zone, its onClick already handled it (stopPropagation)
    // This only fires for empty canvas clicks
    if ((e.target as HTMLElement).closest('[data-zone-target]')) return
    if ((e.target as HTMLElement).closest('[data-zoom-controls]')) return
    if (store.selectedZoneId) {
      // Empty-canvas tap → step out one level inside a building, else deselect.
      if (!stepOutRef.current()) store.selectZone(null)
    }
  }, [isEditing, store])

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
    const targetId = pendingZoneDelete.targetId

    // Optimistic: remove tag from index immediately
    setTagIndex((prev) => {
      if (!prev) return prev
      const newByCanvas = new Map<string, LocationTag[]>()
      for (const [cid, tags] of prev.byCanvas) {
        newByCanvas.set(cid, tags.filter((t) => t.target_id !== targetId))
      }
      return buildTagIndex(newByCanvas)
    })

    if (store.selectedZoneId === targetId) {
      store.selectZone(null)
    }
    setPendingZoneDelete(null)

    // Fire actual delete in background
    await onDeleteLocation(targetId)
    store.bumpTagVersion()
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
  const [holderBlockName, setHolderBlockName] = useState<string | null>(null)
  const [inlinePrompt, setInlinePrompt] = useState<{ mode: 'rename'; value: string } | null>(null)
  const inlineInputRef = useRef<HTMLInputElement>(null)

  // Focus inline prompt input when it opens; clear it when zone deselects
  useEffect(() => {
    if (inlinePrompt) setTimeout(() => inlineInputRef.current?.focus(), 50)
  }, [inlinePrompt])
  useEffect(() => {
    if (!store.selectedZoneId) { setInlinePrompt(null) }
  }, [store.selectedZoneId])

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

  const isZoomed = canvasScale > 1 / BASE_CANVAS_SCALE

  // ── Rename selected zone (updates location name + tag label) ──
  const handleRenameZoneConfirm = useCallback(async (newName: string) => {
    if (!store.selectedZoneId || !newName.trim() || !onUpdateLocation) return
    const trimmed = newName.trim()

    await onUpdateLocation(store.selectedZoneId, { name: trimmed })

    // Also update tag label so the canvas reflects the new name immediately
    const tag = allWorldTags.find((t) => t.target_id === store.selectedZoneId)
    if (tag && tagIndex) {
      const parentCanvasTags = tagIndex.byCanvas.get(tag.location_id) ?? []
      const updated = parentCanvasTags.map((t) =>
        t.target_id === store.selectedZoneId ? { ...t, label: trimmed } : t,
      )
      await upsertLocationTags(tag.location_id, updated)
      store.bumpTagVersion()
    }
  }, [store, allWorldTags, tagIndex, onUpdateLocation])

  // ── Inline prompt confirm (rename only) ──
  const handleInlineConfirm = useCallback(async () => {
    if (!inlinePrompt?.value.trim()) return
    const value = inlinePrompt.value.trim()
    setInlinePrompt(null)
    await handleRenameZoneConfirm(value)
  }, [inlinePrompt, handleRenameZoneConfirm])

  /** Zoom anchored to viewport center — adjusts scroll so the same point stays centered. */
  const zoomBy = useCallback((factor: number) => {
    const el = scrollRef.current
    if (!el) return
    const old = canvasScale
    const next = Math.min(Math.max(old * factor, 1 / BASE_CANVAS_SCALE), 100)
    if (next === old) return

    const vpW = el.clientWidth
    const vpH = el.clientHeight
    const oldContentW = el.scrollWidth - 2 * vpW
    const oldContentH = el.scrollHeight - 2 * vpH

    // Point at center of viewport in content-space (0..1)
    const cx = (el.scrollLeft + vpW / 2 - vpW) / (oldContentW || 1)
    const cy = (el.scrollTop + vpH / 2 - vpH) / (oldContentH || 1)

    // Force synchronous DOM commit so scrollWidth/Height reflect new scale
    flushSync(() => setCanvasScale(next))

    const newContentW = el.scrollWidth - 2 * vpW
    const newContentH = el.scrollHeight - 2 * vpH

    el.scrollLeft = vpW + cx * newContentW - vpW / 2
    el.scrollTop = vpH + cy * newContentH - vpH / 2
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

  // ── Multi-touch pinch-to-zoom (real touch devices) ──
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let lastDist = 0
    let lastCenter = { x: 0, y: 0 }

    const getDistance = (t1: Touch, t2: Touch) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)

    const getCenter = (t1: Touch, t2: Touch) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    })

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        isPinchingRef.current = true
        if (pinchEndTimerRef.current) { clearTimeout(pinchEndTimerRef.current); pinchEndTimerRef.current = null }
        lastDist = getDistance(e.touches[0], e.touches[1])
        lastCenter = getCenter(e.touches[0], e.touches[1])
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      e.preventDefault()

      const dist = getDistance(e.touches[0], e.touches[1])
      const center = getCenter(e.touches[0], e.touches[1])

      if (lastDist > 0) {
        const factor = dist / lastDist
        zoomBy(factor)
      }

      lastDist = dist
      lastCenter = center
    }

    const onTouchEnd = (e: TouchEvent) => {
      lastDist = 0
      // Keep the pinch guard up briefly after the fingers lift so the trailing
      // iOS toolbar-driven resize blip doesn't wake the re-fit and snap the zoom.
      if (e.touches.length < 2) {
        if (pinchEndTimerRef.current) clearTimeout(pinchEndTimerRef.current)
        pinchEndTimerRef.current = setTimeout(() => { isPinchingRef.current = false }, 400)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      // NB: do NOT reset isPinchingRef / the end-timer here — this effect re-runs
      // on every zoom step (zoomBy depends on canvasScale), so clearing the flag
      // in cleanup would drop the pinch guard after the first frame. The
      // touchend-scheduled timer is the sole owner of turning the flag back off.
    }
  }, [zoomBy])

  // ── Prevent iOS native scroll during move/resize/item-move gestures ──
  // touch-action:none on the scroll div is not enough on iOS Safari — it still
  // momentum-scrolls a single-finger drag that started on a pin. Actively
  // preventDefault-ing single-touch moves is what actually pins the canvas so the
  // item-reposition drag doesn't fight the scroll.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || (!isMoving && !isResizing && !itemMoveMode)) return

    const prevent = (e: TouchEvent) => {
      // Allow two-finger pinch through
      if (e.touches.length >= 2) return
      e.preventDefault()
    }

    el.addEventListener('touchmove', prevent, { passive: false })
    return () => el.removeEventListener('touchmove', prevent)
  }, [isMoving, isResizing, itemMoveMode])

  // ── Computed canvas dimensions (pixel-based for infinite canvas) ──
  const contentW = vpSize.w * canvasScale
  const contentH = vpSize.h * canvasScale
  const padX = vpSize.w   // 1 viewport width of padding on each side
  const padY = vpSize.h
  const totalW = contentW + padX * 2
  const totalH = contentH + padY * 2

  const hasSelectedPhoto = store.selectedZoneId ? !!(photoMap?.get(store.selectedZoneId)) : false

  const selectedZoneLabel = store.selectedZoneId
    ? allWorldTags.find((t) => t.target_id === store.selectedZoneId)?.label
      ?? locations.find((l) => l.id === store.selectedZoneId)?.name
      ?? 'Canvas'
    : 'All Items'

  // Item-selection toolbar context (edit mode). While items are selected, the zone
  // buttons hide (zoneSel forced to 0) and the item action group takes over. Merge
  // is offered only for two stackable pins: non-serialized, same name + nsn.
  const itemSel = selectedItemIds.size
  const zoneSel = itemSel === 0 ? editSelectionCount : 0
  const selectedItemsList = itemSel > 0 ? items.filter((i) => selectedItemIds.has(i.id)) : []
  const canMergeItems =
    selectedItemsList.length === 2 &&
    selectedItemsList.every((i) => !i.is_serialized) &&
    selectedItemsList[0].name.toLowerCase() === selectedItemsList[1].name.toLowerCase() &&
    (selectedItemsList[0].nsn ?? null) === (selectedItemsList[1].nsn ?? null)

  return (
    <div className="flex flex-col h-full">
      {/* Canvas wrapper — relative so controls float over scroll area. Full-bleed
          (no margin/border/rounded) so the canvas fills the pane like the map. */}
      <div className="flex-1 min-h-[200px] relative">
        {/* Scrollable canvas */}
        <div
          ref={scrollRef}
          className={`absolute inset-0 overflow-auto bg-themewhite2 ${isEditing ? (isDrawing ? 'cursor-crosshair' : isResizing ? 'cursor-nwse-resize' : isMoving ? 'cursor-move' : 'cursor-default') : 'cursor-default'}`}
          style={{ touchAction: (isDrawing || isMoving || isResizing || itemMoveMode) ? 'none' : 'pan-x pan-y' }}
          onPointerDown={handlePanStart}
          onPointerMove={handlePanMove}
          onPointerUp={handlePanEnd}
          onPointerCancel={handlePanEnd}
          onClick={handleCanvasClick}
        >
          {isEditing && parentBounds ? (
            /* ── Nested edit: dimmed background + scoped overlay at parent zone bounds ── */
            <div className="relative" style={{ width: totalW, height: totalH }}>
              <div className="absolute" style={{ left: padX, top: padY, width: contentW, height: contentH }}>
                <div className="relative w-full h-full">
                  {/* Dimmed background showing all zones */}
                  <div className="absolute inset-0 opacity-40 pointer-events-none">
                    <LocationTagPhoto tags={visibleTags} selectedZoneId={null} onZoneTap={() => {}} scale={1} photoMap={photoMap} />
                  </div>
                  <div className="absolute inset-0 bg-black/20 pointer-events-none" />
                  {/* Scoped edit overlay positioned at parent zone's world-space bounds */}
                  <div
                    className="absolute z-10 ring-2 ring-themeblue2 rounded-lg overflow-hidden"
                    style={{
                      left: `${parentBounds.x * 100}%`,
                      top: `${parentBounds.y * 100}%`,
                      width: `${(parentBounds.width ?? 0) * 100}%`,
                      height: `${(parentBounds.height ?? 0) * 100}%`,
                    }}
                  >
                    <CanvasEditOverlay
                      tags={editCanvasTags}
                      canvasId={editCanvasId!}
                      drawMode={isDrawing}
                      resizeMode={isResizing}
                      moveMode={isMoving}
                      scale={1}
                      editRef={editRef}
                      onSave={handleEditSave}
                      onCancel={handleExitEdit}
                      onDeleteZone={(targetId, label) => setPendingZoneDelete({ targetId, label })}
                      onSelectionChange={handleZoneSelectionChange}
                      photoMap={photoMap}
                      externalNamePrompt
                      onNamingChange={setNamingState}
                      onDrawComplete={handleDrawOnceComplete}
                    />
                  </div>
                  {/* Item pin badges — draggable, zone-relative coords, z-index above edit overlay */}
                  {editItemPins.length > 0 && (
                    <div
                      ref={editZoneOverlayRef}
                      className="absolute z-20 pointer-events-none"
                      style={{
                        left: `${parentBounds.x * 100}%`,
                        top: `${parentBounds.y * 100}%`,
                        width: `${(parentBounds.width ?? 0) * 100}%`,
                        height: `${(parentBounds.height ?? 0) * 100}%`,
                      }}
                    >
                      {editItemPins.map((pin) => {
                        const item = itemsRef.current.find((i) => i.id === pin.target_id)
                        if (!item) return null
                        return (
                          <EditItemPin
                            key={pin.target_id}
                            pin={pin}
                            item={item}
                            containerRef={editZoneOverlayRef}
                            selected={selectedItemIds.has(pin.target_id)}
                            draggable={itemMoveMode && selectedItemIds.size === 1 && selectedItemIds.has(pin.target_id)}
                            onMove={(targetId, newX, newY) =>
                              setEditItemPins((prev) =>
                                prev.map((p) => (p.target_id === targetId ? { ...p, x: newX, y: newY } : p)),
                              )
                            }
                            onToggleSelect={handleToggleItemSelect}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : isEditing ? (
            /* ── Root edit: spacer + centered content ── */
            <div className="relative" style={{ width: totalW, height: totalH }}>
              <div className="absolute" style={{ left: padX, top: padY, width: contentW, height: contentH }}>
                <CanvasEditOverlay
                  tags={editCanvasTags}
                  canvasId={editCanvasId || rootLocationId!}
                  drawMode={isDrawing}
                  resizeMode={isResizing}
                  moveMode={isMoving}
                  scale={1}
                  editRef={editRef}
                  onSave={handleEditSave}
                  onCancel={handleExitEdit}
                  onDeleteZone={(targetId, label) => setPendingZoneDelete({ targetId, label })}
                  onSelectionChange={handleZoneSelectionChange}
                  photoMap={photoMap}
                  externalNamePrompt
                  onNamingChange={setNamingState}
                  onDrawComplete={handleDrawOnceComplete}
                />
              </div>
            </div>
          ) : (
            <div className="relative" style={{ width: totalW, height: totalH }}>
              <div className="absolute" style={{ left: padX, top: padY, width: contentW, height: contentH }}>
                <LocationTagPhoto
                  tags={[...visibleTagsWithPins, ...childZoneAutoTags]}
                  selectedZoneId={store.selectedZoneId}
                  onZoneTap={handleCanvasZoneTap}
                  scale={1}
                  photoMap={photoMap}
                  items={items}
                  onItemTap={handleCanvasItemTap}
                  selectedItemId={focusedItemId}
                  dispatchStatusByLocation={dispatchStatusByLocation}
                  opaqueZoneIds={opaqueZoneIds}
                />

                {(!rootLocationId || !tagIndex) && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-[10pt] text-tertiary">Loading canvas...</p>
                  </div>
                )}
                {/* Only after tags have actually loaded — otherwise a remount (e.g. a
                    resize crossing the mobile/desktop breakpoint resets tagIndex while
                    the refetch is in flight) would flash "No zones yet" over real zones. */}
                {rootLocationId && tagIndex && canvasTags.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      onClick={handleEnterEdit}
                      className="text-center space-y-1 active:scale-95 transition-all"
                    >
                      <p className="text-[10pt] text-tertiary">No zones yet</p>
                      <p className="text-[9pt] text-themeblue2">Tap to draw zones</p>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Glass footer — frosted band feathering UP behind the bottom controls
            (zoom + the FAB owned by PropertyPanel), mirroring the glass header so
            canvas content fades out instead of stopping on a hard edge. View mode
            only; edit mode's own chrome takes over. z-10 sits above the scroll
            canvas but below the z-20 controls. */}
        {!isEditing && (
          <div className="absolute bottom-0 inset-x-0 z-10 h-24 pointer-events-none">
            <GlassBand edge="bottom" className="inset-0" />
          </div>
        )}

        {/* Floating zoom controls — bottom-left, mirrors MapView's stacked Plus/Minus */}
        {!isEditing && (
          <div data-zoom-controls className="absolute bottom-3 left-3 z-30 flex flex-col gap-1.5 pb-[max(0rem,var(--sab,0px))]">
            <button onClick={handleZoomIn} className={CTRL_BTN} aria-label="Zoom in" title="Zoom in">
              <Plus size={16} />
            </button>
            <button onClick={handleZoomOut} disabled={!isZoomed} className={`${CTRL_BTN} disabled:opacity-30`} aria-label="Zoom out" title="Zoom out">
              <Minus size={16} />
            </button>
          </div>
        )}

        {/* Top-right control cluster — view mode only. Horizontal row: an optional
            Add-floor ＋ (shown when a structural zone / building is in scope) sits
            left of the Edit ✏ entry. Same chrome/shape/size as the map's info button
            (CTRL_BTN). Mobile clears the floating glass header via --drawer-header-h;
            desktop's solid header needs no offset. */}
        {!isEditing && (
          <div className={`absolute right-3 z-20 flex items-center gap-1.5 ${isMobile ? 'top-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]' : 'top-3'}`}>
            <button
              onClick={() => handleEnterEdit()}
              className={CTRL_BTN}
              title="Edit layout"
              aria-label="Edit layout"
            >
              <Pencil size={16} />
            </button>
          </div>
        )}

        {/* Levels are shown as an exploded fan (computeExplodeOffsets) when the building
            is selected — selecting a floor in the fan drills in. No separate switcher rail. */}

        {/* Edit mode toolbar — only visible when editing. Mobile clears the floating
            glass header via --drawer-header-h (same offset as the view-mode edit
            button); desktop's solid header needs no offset. */}
        {isEditing && (
          <div className={`absolute right-3 z-20 flex flex-col items-end ${isMobile ? 'top-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]' : 'top-3'}`}>
            <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 flex items-center shadow-sm">
              <button
                onClick={() => { setIsDrawing((d) => !d); setIsResizing(false); setIsMoving(false) }}
                className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${isDrawing ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                title="Draw zone"
              >
                <PenTool size={15} />
              </button>
              {zoneSel === 1 && (
                <button
                  onClick={() => { setIsMoving((m) => !m); setIsDrawing(false); setIsResizing(false) }}
                  className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${isMoving ? 'bg-themegreen text-white' : 'text-tertiary hover:text-primary'}`}
                  title="Move"
                >
                  <Move size={15} />
                </button>
              )}
              {zoneSel === 1 && (
                <button
                  onClick={() => { setIsResizing((r) => !r); setIsDrawing(false); setIsMoving(false) }}
                  className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${isResizing ? 'bg-themeyellow text-white' : 'text-tertiary hover:text-primary'}`}
                  title="Resize"
                >
                  <Maximize2 size={15} />
                </button>
              )}
              {zoneSel >= 1 && <div className="h-5 w-px shrink-0 bg-tertiary/15" />}
              {zoneSel >= 1 && (
                <button
                  onClick={() => editRef.current?.deleteSelected()}
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              )}
              {zoneSel >= 1 && <div className="h-5 w-px shrink-0 bg-tertiary/15" />}
              {zoneSel === 1 && (
                <button
                  onClick={() => editRef.current?.duplicate()}
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                  title="Duplicate"
                >
                  <Copy size={15} />
                </button>
              )}
              {zoneSel === 1 && (
                <button
                  onClick={() => editRef.current?.split()}
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                  title="Split"
                >
                  <Scissors size={15} />
                </button>
              )}
              {zoneSel >= 2 && (
                <button
                  onClick={() => editRef.current?.merge()}
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                  title="Merge"
                >
                  <Merge size={15} />
                </button>
              )}
              {/* ── Item action group — mutually exclusive with zone actions. Move
                  re-arranges the selected pin's x/y (persists on Save); Delete +
                  Merge apply immediately (audit-logged, serialized-guarded). ── */}
              {itemSel >= 1 && <div className="h-5 w-px shrink-0 bg-tertiary/15" />}
              {itemSel === 1 && (
                <button
                  onClick={() => setItemMoveMode((m) => !m)}
                  className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${itemMoveMode ? 'bg-themegreen text-white' : 'text-tertiary hover:text-primary'}`}
                  title="Move"
                >
                  <Move size={15} />
                </button>
              )}
              {itemSel >= 1 && (
                <button
                  onClick={handleDeleteSelectedItems}
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              )}
              {canMergeItems && (
                <button
                  onClick={handleMergeSelectedItems}
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                  title="Merge"
                >
                  <Merge size={15} />
                </button>
              )}
              <div className="h-5 w-px shrink-0 bg-tertiary/15" />
              <button
                onClick={handleExitEdit}
                className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all"
                title="Cancel"
              >
                <X size={15} />
              </button>
              <button
                onClick={() => editRef.current?.save()}
                className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
                title="Save"
              >
                <Check size={18} />
              </button>
            </div>

            {/* Single-draw add-zone hint — naming/parent/type are captured in the
                sheet after the rectangle is drawn, so no inline name prompt here. */}
            {drawOnce && !namingState && (
              <div className="mt-1.5 px-4 py-2 rounded-full bg-themewhite2 border border-themeblue3/20 shadow-sm text-[9pt] font-medium text-themeblue2">
                Draw the new zone
              </div>
            )}

            {/* Name input for newly drawn zones — drops below the pill */}
            {namingState && (
              <div className="mt-1.5 flex items-center gap-2 w-[calc(100vw-2rem)] max-w-xs">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleExternalNameConfirm()
                    if (e.key === 'Escape') handleExternalNameCancel()
                  }}
                  placeholder={namingState.existingLabel ? 'Rename zone' : 'Name this zone'}
                  className="flex-1 min-w-0 rounded-full py-2.5 px-4 border border-themeblue1/30 shadow-xs bg-themewhite2 focus:outline-none text-base text-primary placeholder:text-tertiary transition-all duration-300"
                />
                <button
                  onClick={handleExternalNameCancel}
                  className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-themewhite2 border border-themeblue3/10 text-tertiary hover:text-primary active:scale-95 transition-all duration-300"
                >
                  <X size={20} />
                </button>
                <button
                  onClick={handleExternalNameConfirm}
                  disabled={!nameInput.trim()}
                  className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-themeblue3 text-white border border-themeblue1/30 disabled:opacity-30 active:scale-95 transition-all duration-300"
                >
                  <Check size={20} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Floating zone popover — right side, below FAB toolbar, visible when a zone is
            selected. Suppressed when the parent owns the selection surface (desktop right
            pane via onSelectZone); still used on mobile, where there is no right pane. */}
        {store.selectedZoneId && !onSelectZone && (!isEditing || !!inlinePrompt) && (
          <div className="absolute top-[72px] right-3 z-40 w-52 max-h-[60%] flex flex-col rounded-xl border border-tertiary/15 bg-themewhite shadow-md overflow-hidden">
            {/* Header: zone title (tap to rename) + dismiss */}
            <div className="shrink-0 flex items-center gap-1 px-3 py-2 bg-themewhite3/50 border-b border-primary/10">
              {inlinePrompt ? (
                <>
                  <input
                    ref={inlineInputRef}
                    type="text"
                    value={inlinePrompt.value}
                    onChange={(e) => setInlinePrompt((p) => p ? { ...p, value: e.target.value } : p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleInlineConfirm()
                      if (e.key === 'Escape') setInlinePrompt(null)
                    }}
                    onBlur={handleInlineConfirm}
                    className="flex-1 min-w-0 text-[9pt] font-medium text-primary bg-transparent border-b border-themeblue3/50 focus:outline-none"
                  />
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setInlinePrompt(null)}
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                  >
                    <X size={11} />
                  </button>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleInlineConfirm}
                    disabled={!inlinePrompt.value.trim()}
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-themeblue2 active:scale-95 transition-all disabled:opacity-30"
                  >
                    <Check size={11} />
                  </button>
                </>
              ) : (
                <>
                  {locations.find((l) => l.id === store.selectedZoneId)?.parent_id && (
                    <button
                      onClick={drillUp}
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                      aria-label="Back to parent zone"
                    >
                      <ChevronLeft size={12} />
                    </button>
                  )}
                  <span
                    className="text-[9pt] font-medium text-primary truncate flex-1 cursor-text"
                    onClick={() => setInlinePrompt({ mode: 'rename', value: selectedZoneLabel ?? '' })}
                  >
                    {selectedZoneLabel}
                  </span>
                  <button
                    onClick={() => store.selectZone(null)}
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                  >
                    <X size={11} />
                  </button>
                </>
              )}
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {childZoneCards.length === 0 && contextItems.length === 0 ? (
                <p className="text-[9pt] text-tertiary text-center py-4 px-3">Nothing here yet</p>
              ) : (
                <>
                  {/* Child zones — slim rows */}
                  {childZoneCards.map(({ location, tag }) => {
                    const itemCount = items.filter((i) => i.location_id === location.id).length
                    return (
                      <button
                        key={location.id}
                        onClick={() => tag ? handleZoneTap(location.id) : store.selectZone(location.id)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-themeblue3/5 active:bg-themeblue3/10 transition-colors border-b border-primary/5 last:border-b-0"
                      >
                        <div className="w-2 h-2 rounded-sm bg-themeblue3/40 shrink-0" />
                        <span className="text-[9pt] font-medium text-primary truncate flex-1 text-left">{location.name}</span>
                        {itemCount > 0 && <span className="text-[9pt] text-tertiary shrink-0">{itemCount}</span>}
                        <ChevronRight size={12} className="text-tertiary shrink-0" />
                      </button>
                    )
                  })}
                  {/* Divider */}
                  {childZoneCards.length > 0 && contextItems.length > 0 && (
                    <div className="h-px bg-primary/10 mx-3 my-0.5" />
                  )}
                  {/* Items */}
                  {contextItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onSelectItem?.(item)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-tertiary/5 active:bg-tertiary/10 transition-colors border-b border-primary/5 last:border-b-0"
                    >
                      <span className="text-[9pt] text-primary truncate flex-1 text-left">{item.name}</span>
                      <ChevronRight size={12} className="text-tertiary shrink-0" />
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Footer actions */}
            <div className="shrink-0 border-t border-primary/10">
              <div className="flex items-center justify-around px-3 py-2">
                <ActionButton icon={Plus} label="Add child zone" onClick={() => handleEnterEdit(true)} />
                <ActionButton icon={Camera} label={hasSelectedPhoto ? 'Change photo' : 'Add photo'} onClick={() => triggerPhotoUpload(store.selectedZoneId!)} />
                {onCreateItem && <ActionButton icon={Package} label="New item" onClick={onCreateItem} />}
                {hasSelectedPhoto && <ActionButton icon={X} label="Remove photo" onClick={() => onUpdateLocation?.(store.selectedZoneId!, { photo_data: null })} />}
                <ActionButton
                  icon={Trash2}
                  label="Delete zone"
                  onClick={() => {
                    if (!store.selectedZoneId) return
                    const loc = locations.find((l) => l.id === store.selectedZoneId)
                    if (loc?.holder_user_id) { setHolderBlockName(loc.name); return }
                    setPendingZoneDelete({ targetId: store.selectedZoneId, label: selectedZoneLabel })
                  }}
                />
              </div>
            </div>
          </div>
        )}

      </div>

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
        title={`Delete "${pendingZoneDelete?.label}"?`}
        subtitle="Permanent. Removes location, children, and zone tags. Items unassigned."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmZoneDelete}
        onCancel={() => setPendingZoneDelete(null)}
      />

      {/* Item delete (from the edit-mode item selection) — immediate + terminal */}
      <ConfirmDialog
        visible={!!pendingItemDelete}
        title={
          pendingItemDelete && pendingItemDelete.length === 1
            ? `Delete "${pendingItemDelete[0].name}"? This cannot be undone.`
            : `Delete ${pendingItemDelete?.length ?? 0} items? This cannot be undone.`
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmItemDelete}
        onCancel={() => setPendingItemDelete(null)}
      />

      {/* Member location — block delete */}
      <ConfirmDialog
        visible={!!holderBlockName}
        title="Can't delete this location"
        subtitle={`${holderBlockName} is an active cluster member. Remove them from the cluster to delete their location.`}
        confirmLabel="Got it"
        onConfirm={() => setHolderBlockName(null)}
        onCancel={() => setHolderBlockName(null)}
      />
    </div>
  )
})
