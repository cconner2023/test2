/**
 * PropertyLocationMap — Orchestrator for the property canvas.
 * The canvas is a scaled div inside a scrollable container.
 * Zones use 0..1 normalised coords as CSS percentages.
 * "Zooming" changes the canvas scale and scrolls to target.
 *
 * LOD: nested zones become visible when their parent zone fills ≥80%
 * of the viewport (via canvasScale), or when the parent is selected.
 */
import { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react'
import { flushSync } from 'react-dom'
import { useSpring, animated } from '@react-spring/web'
import { Pencil, Check, PenTool, ZoomIn, ZoomOut, Scissors, Merge, X, Copy, Camera, Trash2, Maximize2, Move } from 'lucide-react'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { fetchAllLocationTags, fetchLocationTags, upsertLocationTags } from '../../lib/propertyService'
import { buildTagIndex, findLCA } from '../../lib/tagIndex'
import type { TagIndex } from '../../lib/tagIndex'
import { LocationTagPhoto } from './LocationTagPhoto'
import { CanvasEditOverlay } from './CanvasEditOverlay'
import type { CanvasEditHandle } from './CanvasEditOverlay'
import { ConfirmDialog } from '../ConfirmDialog'
import { CardContextMenu } from '../CardContextMenu'
import type { CardContextMenuItem } from '../CardContextMenu'
import { createLogger } from '../../Utilities/Logger'
import type { LocalPropertyItem, LocalPropertyLocation, PropertyLocation, LocationTag } from '../../Types/PropertyTypes'

const logger = createLogger('PropertyLocationMap')

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

/** Base canvas multiplier — canvas starts 3× viewport so panning works at zoom=1 */
const BASE_CANVAS_SCALE = 3

export interface MapNavHandle {
  navigateToZone: (targetId: string) => void
  resetZoom: () => void
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
}

export const PropertyLocationMap = forwardRef<MapNavHandle, PropertyLocationMapProps>(function PropertyLocationMap({ clinicId, clinicName, locations, items, onCreateLocation, onDeleteLocation, onEditItem, onUpdateLocation, onSelectItem }, ref) {
  const store = usePropertyStore()
  const isMobile = useIsMobile()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [tagIndex, setTagIndex] = useState<TagIndex | null>(null)
  const [canvasScale, setCanvasScale] = useState(1)
  const [isEditing, setIsEditing] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [editCanvasId, setEditCanvasId] = useState<string | null>(null)
  const [editCanvasTags, setEditCanvasTags] = useState<LocationTag[]>([])
  const [pendingZoneDelete, setPendingZoneDelete] = useState<{ targetId: string; label: string } | null>(null)
  const editRef = useRef<CanvasEditHandle>(null)
  const dragRef = useRef<{ startX: number; startY: number; scrollX: number; scrollY: number; zoneId: string | null } | null>(null)
  /** Suppress the click event that follows a drag-to-pan or a handled zone tap */
  const suppressClickRef = useRef(false)
  const lcaCleanupRef = useRef<(() => void) | null>(null)
  // Track edit selection count so toolbar re-renders when shift-selection changes
  const [editSelectionCount, setEditSelectionCount] = useState(0)
  // Nested edit: external name prompt state
  const [namingState, setNamingState] = useState<{ index: number; existingLabel: string } | null>(null)
  const [nameInput, setNameInput] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

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

  // ── All tags in world coords (for zoom lookup + toolbar label) ──
  const allWorldTags: LocationTag[] = useMemo(() => {
    if (!tagIndex || !rootLocationId) return []
    return flattenToWorld(tagIndex, rootLocationId)
  }, [tagIndex, rootLocationId])

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

    // Dynamic visible depth: always show depth 0+1, expand when navigated deeper
    const selectedDepth = selectedId ? (depthOf.get(selectedId) ?? 0) : 0
    const visibleDepth = Math.max(1, selectedDepth + 1)

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
      const depth = depthOf.get(tag.target_id) ?? 0
      // Show all zones up to the dynamic depth threshold
      if (depth <= visibleDepth) return true
      // Selected zone's children + ancestor chain (catches edges beyond threshold)
      if (tag.location_id === selectedId) return true
      if (ancestorIds.has(tag.target_id)) return true

      const parent = byTargetId.get(tag.location_id)
      if (!parent) return false
      const fill = Math.max((parent.width ?? 0), (parent.height ?? 0)) * canvasScale
      return fill >= 0.8
    })
  }, [allWorldTags, rootLocationId, canvasScale, store.selectedZoneId])

  // ── Item pins: combine persisted item tags with auto-generated pins for untagged items ──
  const visibleTagsWithPins: LocationTag[] = useMemo(() => {
    if (!items || items.length === 0) return visibleTags

    // Collect persisted item tags already in visibleTags
    const taggedItemIds = new Set<string>()
    for (const t of visibleTags) {
      if (t.target_type === 'item') taggedItemIds.add(t.target_id)
    }

    // For each zone in visibleTags, find items assigned there but without a pin
    const zoneTags = visibleTags.filter((t) => (t.width ?? 0) > 0 && (t.height ?? 0) > 0)
    const autoPins: LocationTag[] = []

    for (const zone of zoneTags) {
      const untagged = items.filter(
        (item) => item.location_id === zone.target_id && !taggedItemIds.has(item.id),
      )
      if (untagged.length === 0) continue

      const cols = 3
      const rows = Math.ceil(untagged.length / cols)
      const zw = zone.width ?? 0
      const zh = zone.height ?? 0

      untagged.forEach((item, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const pinX = zone.x + ((col + 0.5) / cols) * zw
        const pinY = zone.y + ((row + 0.5) / rows) * zh
        autoPins.push({
          id: `auto-${item.id}`,
          location_id: zone.target_id,
          target_type: 'item',
          target_id: item.id,
          x: pinX,
          y: pinY,
          width: null,
          height: null,
          label: item.name,
        })
      })
    }

    if (autoPins.length === 0) return visibleTags
    return [...visibleTags, ...autoPins]
  }, [visibleTags, items])

  // ── Zoom to a world-coord rect { x, y, width, height } ──
  const zoomToRect = useCallback(
    (rect: { x: number; y: number; width: number; height: number }, smooth = true) => {
      const container = scrollRef.current
      if (!container || !rect.width || !rect.height) return

      const PADDING = 10
      const FILL = 0.80

      const vpW = container.clientWidth
      const vpH = container.clientHeight
      const newScale = Math.min(FILL / rect.width, FILL / rect.height, 100)

      flushSync(() => setCanvasScale(newScale))

      const contentW = container.scrollWidth - 2 * vpW
      const contentH = container.scrollHeight - 2 * vpH

      container.scrollTo({
        left: vpW + rect.x * contentW - PADDING,
        top: vpH + rect.y * contentH - PADDING,
        behavior: smooth ? 'smooth' : 'instant',
      })
    },
    [],
  )

  /** Convenience — zoom to a LocationTag */
  const zoomToTag = useCallback(
    (tag: LocationTag) => zoomToRect({ x: tag.x, y: tag.y, width: tag.width ?? 0, height: tag.height ?? 0 }),
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
      // Tapping already-selected zone → deselect only, no zoom change
      if (targetId === store.selectedZoneId) {
        store.selectZone(null)
        return
      }

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

  // ── Deferred navigation — handles cases where tags haven't loaded yet ──
  const pendingNavRef = useRef<string | null>(null)

  const executeNavigation = useCallback((targetId: string) => {
    const tag = allWorldTags.find((t) => t.target_id === targetId)
    if (!tag) return false

    store.selectZone(targetId)

    if (tag.location_id === rootLocationId) {
      zoomToTag(tag)
      return true
    }

    // Nested zone — zoom to parent for context, then scrollend-driven zoom to target
    const parentTag = allWorldTags.find((t) => t.target_id === tag.location_id)
    if (!parentTag) {
      zoomToTag(tag)
      return true
    }

    const container = scrollRef.current
    lcaCleanupRef.current?.()

    if (!container) {
      zoomToTag(tag)
      return true
    }

    store.setTransitionState('zooming-out')
    zoomToTag(parentTag)

    const onParentEnd = () => {
      container.removeEventListener('scrollend', onParentEnd)
      store.setTransitionState('zooming-in')
      zoomToTag(tag)

      const onTargetEnd = () => {
        container.removeEventListener('scrollend', onTargetEnd)
        lcaCleanupRef.current = null
        store.setTransitionState('idle')
      }
      container.addEventListener('scrollend', onTargetEnd, { once: true })
      lcaCleanupRef.current = () => {
        container.removeEventListener('scrollend', onTargetEnd)
      }
    }
    container.addEventListener('scrollend', onParentEnd, { once: true })
    lcaCleanupRef.current = () => {
      container.removeEventListener('scrollend', onParentEnd)
    }

    return true
  }, [allWorldTags, rootLocationId, store, zoomToTag])

  // ── Imperative handle for external navigation (tree clicks, breadcrumbs) ──
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
    resetZoom() {
      handleResetZoom()
    },
  }), [executeNavigation, store, handleResetZoom])

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
  const handleEnterEdit = useCallback(async () => {
    if (!rootLocationId) return
    // Edit the selected zone's canvas (nested) or root canvas
    const canvasId = store.selectedZoneId || rootLocationId
    const tags = await fetchLocationTags(canvasId)
    setEditCanvasId(canvasId)
    setEditCanvasTags(tags)
    setIsDrawing(false)
    setIsResizing(false)
    setIsMoving(false)
    setIsEditing(true)

    // For nested edit, zoom to parent zone so it's centered/visible
    if (canvasId !== rootLocationId) {
      const parentTag = allWorldTags.find((t) => t.target_id === canvasId)
      if (parentTag) zoomToTag(parentTag)
    }
  }, [rootLocationId, store.selectedZoneId, allWorldTags, zoomToTag])

  const handleExitEdit = useCallback(() => {
    setIsEditing(false)
    setIsDrawing(false)
    setIsResizing(false)
    setIsMoving(false)
    setEditCanvasId(null)
    setNamingState(null)
    setNameInput('')
  }, [])

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

      const savedTags = await upsertLocationTags(canvasId, resolvedTags)

      // Optimistic: update tagIndex directly — no bumpTagVersion() here to avoid
      // racing reconcileLocationTagsWithServer with the Supabase push in upsertLocationTags
      if (savedTags.success && savedTags.tags) {
        setTagIndex((prev) => {
          if (!prev) return prev
          const newByCanvas = new Map(prev.byCanvas)
          newByCanvas.set(canvasId, savedTags.tags!)
          return buildTagIndex(newByCanvas)
        })
      }

      handleExitEdit()
    },
    [editCanvasId, rootLocationId, clinicId, onCreateLocation, onDeleteLocation, onEditItem, handleExitEdit],
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

    // Mobile view mode: let native scroll handle everything — zone taps use onClick
    if (isMobile && e.pointerType === 'touch' && !isEditing) return

    const el = scrollRef.current
    if (!el) return

    const zoneEl = (e.target as HTMLElement).closest('[data-zone-target]')
    const zoneId = zoneEl?.getAttribute('data-zone-target') ?? null
    dragRef.current = { startX: e.clientX, startY: e.clientY, scrollX: el.scrollLeft, scrollY: el.scrollTop, zoneId }

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
          if (d.zoneId) {
            handleZoneTap(d.zoneId)
          } else if (store.selectedZoneId) {
            store.selectZone(null)
          }
        }
      }
    }
    // Reset suppress flag after click event fires (click comes after pointerup in the same frame)
    setTimeout(() => { suppressClickRef.current = false }, 0)
  }, [isMobile, isEditing, store, handleZoneTap])

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
      store.selectZone(null)
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

  // ── Item pin move: persist new position for a dragged item pin ──
  const handleItemPinMove = useCallback(
    async (targetId: string, canvasId: string, newX: number, newY: number) => {
      if (!tagIndex) return

      // Find existing tag for this item in the canvas
      const canvasPins = tagIndex.byCanvas.get(canvasId) ?? []
      const existing = canvasPins.find((t) => t.target_type === 'item' && t.target_id === targetId)

      const item = itemsRef.current.find((i) => i.id === targetId)
      const updatedPin: LocationTag = existing
        ? { ...existing, x: newX, y: newY }
        : {
            id: `item-pin-${targetId}`,
            location_id: canvasId,
            target_type: 'item',
            target_id: targetId,
            x: newX,
            y: newY,
            width: null,
            height: null,
            label: item?.name ?? targetId,
          }

      // Optimistic update
      setTagIndex((prev) => {
        if (!prev) return prev
        const newByCanvas = new Map(prev.byCanvas)
        const current = newByCanvas.get(canvasId) ?? []
        const filtered = current.filter((t) => !(t.target_type === 'item' && t.target_id === targetId))
        newByCanvas.set(canvasId, [...filtered, updatedPin])
        return buildTagIndex(newByCanvas)
      })

      // All location tags for this canvas (zones + other item pins + updated pin)
      const otherPins = canvasPins.filter((t) => !(t.target_type === 'item' && t.target_id === targetId))
      await upsertLocationTags(canvasId, [...otherPins, updatedPin])
    },
    [tagIndex],
  )

  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoTargetId, setPhotoTargetId] = useState<string | null>(null)
  const [zoneMenu, setZoneMenu] = useState<{ targetId: string; x: number; y: number } | null>(null)

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

  // ── Toolbar expand/collapse spring (NavTop-style) ──
  const toolbarSpring = useSpring({
    progress: isEditing ? 1 : 0,
    config: { tension: 260, friction: 26 },
  })

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

    const onTouchEnd = () => {
      lastDist = 0
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [zoomBy])

  // ── Prevent iOS native scroll during move/resize gestures ──
  useEffect(() => {
    const el = scrollRef.current
    if (!el || (!isMoving && !isResizing)) return

    const prevent = (e: TouchEvent) => {
      // Allow two-finger pinch through
      if (e.touches.length >= 2) return
      e.preventDefault()
    }

    el.addEventListener('touchmove', prevent, { passive: false })
    return () => el.removeEventListener('touchmove', prevent)
  }, [isMoving, isResizing])

  // ── Computed canvas dimensions (pixel-based for infinite canvas) ──
  const contentW = vpSize.w * canvasScale
  const contentH = vpSize.h * canvasScale
  const padX = vpSize.w   // 1 viewport width of padding on each side
  const padY = vpSize.h
  const totalW = contentW + padX * 2
  const totalH = contentH + padY * 2

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
          className={`absolute inset-0 overflow-auto bg-themewhite2 border border-tertiary/15 rounded-lg ${isEditing ? (isDrawing ? 'cursor-crosshair' : isResizing ? 'cursor-nwse-resize' : isMoving ? 'cursor-move' : 'cursor-default') : 'cursor-default'}`}
          style={{ touchAction: (isDrawing || isMoving || isResizing) ? 'none' : 'pan-x pan-y' }}
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
                      onSelectionChange={setEditSelectionCount}
                      photoMap={photoMap}
                      externalNamePrompt
                      onNamingChange={setNamingState}
                    />
                  </div>
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
                  onSelectionChange={setEditSelectionCount}
                  photoMap={photoMap}
                  externalNamePrompt
                  onNamingChange={setNamingState}
                />
              </div>
            </div>
          ) : (
            <div className="relative" style={{ width: totalW, height: totalH }}>
              <div className="absolute" style={{ left: padX, top: padY, width: contentW, height: contentH }}>
                <LocationTagPhoto
                  tags={visibleTagsWithPins}
                  selectedZoneId={store.selectedZoneId}
                  onZoneTap={handleZoneTap}
                  scale={1}
                  photoMap={photoMap}
                  items={items}
                  onItemTap={onSelectItem}
                  onZoneMenu={onUpdateLocation ? (targetId, x, y) => setZoneMenu({ targetId, x, y }) : undefined}
                  onItemPinMove={handleItemPinMove}
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
              </div>
            </div>
          )}
        </div>

        {/* Floating zoom controls — bottom-left vertical pill */}
        {!isEditing && (
          <div data-zoom-controls className="absolute bottom-3 left-3 z-20 rounded-full border border-tertiary/20 bg-themewhite p-0.5 flex flex-col items-center shadow-sm">
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

        {/* Floating toolbar — top-right, expanding pill + rename dropdown */}
        <div className="absolute top-3 right-3 z-20 flex flex-col items-end">
          {/* Toolbar pill */}
          <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 flex items-center shadow-sm">
            <animated.div
              className="flex items-center overflow-hidden"
              style={{
                maxWidth: toolbarSpring.progress.to(p => `${p * 400}px`),
                opacity: toolbarSpring.progress,
              }}
            >
              <button
                onClick={() => { setIsDrawing((d) => !d); setIsResizing(false); setIsMoving(false) }}
                className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${isDrawing ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
                title="Draw zone"
              >
                <PenTool size={15} />
              </button>
              {editSelectionCount === 1 && (
                <button
                  onClick={() => { setIsMoving((m) => !m); setIsDrawing(false); setIsResizing(false) }}
                  className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${isMoving ? 'bg-themegreen text-white' : 'text-tertiary hover:text-primary'}`}
                  title="Move"
                >
                  <Move size={15} />
                </button>
              )}
              {editSelectionCount === 1 && (
                <button
                  onClick={() => { setIsResizing((r) => !r); setIsDrawing(false); setIsMoving(false) }}
                  className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-all ${isResizing ? 'bg-themeyellow text-white' : 'text-tertiary hover:text-primary'}`}
                  title="Resize"
                >
                  <Maximize2 size={15} />
                </button>
              )}
              {editSelectionCount >= 1 && <div className="h-5 w-px shrink-0 bg-tertiary/15" />}
              {editSelectionCount >= 1 && (
                <button
                  onClick={() => editRef.current?.deleteSelected()}
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              )}
              {editSelectionCount === 1 && (
                <button
                  onClick={() => editRef.current?.renameSelected()}
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                  title="Rename"
                >
                  <Pencil size={15} />
                </button>
              )}
              {editSelectionCount >= 1 && <div className="h-5 w-px shrink-0 bg-tertiary/15" />}
              {editSelectionCount === 1 && (
                <button
                  onClick={() => editRef.current?.duplicate()}
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                  title="Duplicate"
                >
                  <Copy size={15} />
                </button>
              )}
              {editSelectionCount === 1 && (
                <button
                  onClick={() => editRef.current?.split()}
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                  title="Split"
                >
                  <Scissors size={15} />
                </button>
              )}
              {editSelectionCount >= 2 && (
                <button
                  onClick={() => editRef.current?.merge()}
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
            </animated.div>

            {/* Anchored edit/save button — stays in place, icon morphs */}
            <button
              onClick={isEditing ? () => editRef.current?.save() : handleEnterEdit}
              className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all ${isEditing ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'}`}
              title={isEditing ? 'Save' : 'Edit'}
            >
              {isEditing ? <Check size={18} /> : <Pencil size={18} />}
            </button>
          </div>

          {/* Rename dropdown — expands below the toolbar pill */}
          {namingState && (
            <div className="mt-1.5 bg-themewhite rounded-xl shadow-lg p-2 border border-primary/10 w-[calc(100vw-2rem)] max-w-xs">
              <div className="flex items-center gap-2">
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
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-lg text-primary text-base border border-tertiary/10 focus-within:border-themeblue1/30 focus-within:bg-themewhite2 bg-themewhite dark:bg-themewhite3 focus:outline-none transition-all placeholder:text-tertiary/30"
                />
                <button
                  onClick={handleExternalNameCancel}
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                >
                  <X size={18} />
                </button>
                <button
                  onClick={handleExternalNameConfirm}
                  disabled={!nameInput.trim()}
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
                >
                  <Check size={18} />
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Bottom panel — always visible, card grid of one-level-deep sub-zones + items */}
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
                  className="rounded-lg border border-themeblue3/20 bg-themeblue3/5 overflow-hidden active:scale-95 transition-all group relative"
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
                  className="rounded-lg border border-tertiary/15 bg-themewhite2 overflow-hidden active:scale-95 transition-all"
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

      {/* Hidden file input for zone photo uploads */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoUpload}
      />

      {/* Zone ellipsis context menu */}
      {zoneMenu && (() => {
        const hasPhoto = !!photoMap?.get(zoneMenu.targetId)
        const menuItems: CardContextMenuItem[] = [
          {
            key: 'photo',
            label: hasPhoto ? 'Change Photo' : 'Add Photo',
            icon: Camera,
            onAction: () => { triggerPhotoUpload(zoneMenu.targetId); setZoneMenu(null) },
          },
          ...(hasPhoto ? [{
            key: 'remove-photo',
            label: 'Remove Photo',
            icon: Trash2,
            destructive: true,
            onAction: () => { onUpdateLocation?.(zoneMenu.targetId, { photo_data: null }); setZoneMenu(null) },
          }] : []),
        ]
        return (
          <CardContextMenu
            x={zoneMenu.x}
            y={zoneMenu.y}
            items={menuItems}
            onClose={() => setZoneMenu(null)}
          />
        )
      })()}

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
    </div>
  )
})
