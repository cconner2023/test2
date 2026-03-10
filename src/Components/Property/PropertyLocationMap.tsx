import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Camera, Pencil, Check, Trash2, MoreVertical, X, Package, CheckCircle2, CirclePlus, ChevronDown, ChevronUp, RectangleHorizontal, Scissors, Merge, Copy } from 'lucide-react'
import { ConfirmDialog } from '../ConfirmDialog'
import { resizeImage } from '../../Utilities/imageUtils'
import { clamp } from '../../Utilities/GestureUtils'
import { LocationBreadcrumb } from './LocationBreadcrumb'
import { LocationTagPhoto } from './LocationTagPhoto'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { fetchLocationTags, fetchLocationTagsBatch, upsertLocationTags, updateItem } from '../../lib/propertyService'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'
import type { PropertyLocation, LocalPropertyLocation, LocationTag, LocalPropertyItem, ZoneRect } from '../../Types/PropertyTypes'

export interface LocationEditActions {
  onEdit: () => void
  onDelete: () => void
}

interface PropertyLocationMapProps {
  locations: LocalPropertyLocation[]
  items: LocalPropertyItem[]
  clinicId: string
  clinicName: string
  onAddLocation: (data: Omit<PropertyLocation, 'id' | 'created_at' | 'updated_at'>) => Promise<unknown>
  onUpdateLocation: (id: string, updates: Partial<PropertyLocation>) => Promise<unknown>
  onDeleteLocation: (id: string) => Promise<unknown>
  onSelectItem: (item: LocalPropertyItem) => void
  onUnassignItem?: (itemId: string) => void
  userId: string
  /** Called when the user taps the 'Add Item' icon in the canvas toolbar */
  onAddItem?: () => void
  /** Called whenever the active location changes, providing edit/delete actions for the drawer header */
  onRegisterLocationActions?: (actions: LocationEditActions | null) => void
}

export function PropertyLocationMap({
  locations,
  items,
  clinicId,
  clinicName,
  onAddLocation,
  onUpdateLocation,
  onDeleteLocation,
  onSelectItem,
  onUnassignItem,
  userId,
  onAddItem,
  onRegisterLocationActions,
}: PropertyLocationMapProps) {
  const { selectedZoneId, selectZone, rootLocationId, canvasStack, navigateInto, navigateBack, navigateToPath, transitionState, setTransitionState, pendingNavTarget, setPendingNavTarget } = usePropertyStore()

  // Canvas shows the current drill-down location, or root if at top level
  const canvasLocationId = selectedZoneId ?? rootLocationId

  // Derive the selected zone location from the store
  const selectedZone = selectedZoneId
    ? locations.find((l) => l.id === selectedZoneId) ?? null
    : null

  // Canvas photo — look up the active location's photo
  const canvasPhoto = selectedZone?.photo_data ?? null

  const [tags, setTags] = useState<LocationTag[]>([])
  const [isEditMode, setIsEditMode] = useState(false)
  const [isDrawMode, setIsDrawMode] = useState(false)

  // Suppress the next locations.length-triggered refetch when we've already persisted tags locally
  const suppressRefetchRef = useRef(false)

  // Zone creation state: after drawing a rectangle, prompt for a name
  const [pendingZone, setPendingZone] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [zoneName, setZoneName] = useState('')
  // When drawing a zone for a specific existing sub-location
  const [drawForLocationId, setDrawForLocationId] = useState<string | null>(null)
  // When splitting a zone, track the original location id so the new zone gets the same parent_id
  const [splitOriginLocationId, setSplitOriginLocationId] = useState<string | null>(null)

  // Edit/delete state for selected zone
  const [isEditingCurrent, setIsEditingCurrent] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhotoData, setEditPhotoData] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [overflowMenuId, setOverflowMenuId] = useState<string | null>(null)
  const editPhotoInputRef = useRef<HTMLInputElement>(null)

  // Zone selection state (split/merge)
  const [selectedZoneIds, setSelectedZoneIds] = useState<Set<string>>(new Set())
  const [mergeConfirm, setMergeConfirm] = useState<{ tagA: LocationTag; tagB: LocationTag } | null>(null)

  // Zoom-then-navigate state (Google Maps-style drill-down)
  const [pendingNavId, setPendingNavId] = useState<string | null>(null)
  const [navZoomTarget, setNavZoomTarget] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  // Layer stack — cached tags for background (parent) layers so they persist after navigation
  const [layerTagsMap, setLayerTagsMap] = useState<Map<string, LocationTag[]>>(new Map())
  const canvasWrapperRef = useRef<HTMLDivElement>(null)

  // Item tray state
  const [isTrayExpanded, setIsTrayExpanded] = useState(true)

  // Items assigned to the selected zone
  const assignedItems = useMemo(() => {
    if (!selectedZoneId) return []
    return items.filter((i) => i.location_id === selectedZoneId)
  }, [items, selectedZoneId])

  // All non-root locations (for cards + zone density display)
  const allLocations = useMemo(() => {
    return locations.filter((l) => l.name !== ROOT_LOCATION_NAME)
  }, [locations])

  // Visible location cards — scoped to current selection level
  const visibleLocations = useMemo(() => {
    if (selectedZoneId) {
      // Show children of the selected zone
      return allLocations.filter((l) => l.parent_id === selectedZoneId)
    }
    // No selection — show root-level zones
    return allLocations.filter((l) => l.parent_id === null)
  }, [allLocations, selectedZoneId])

  const childLocationItems = useMemo(() => {
    const allIds = new Set(allLocations.map((l) => l.id))
    return items.filter((i) => i.location_id && allIds.has(i.location_id))
  }, [items, allLocations])

  const taggedItemIds = useMemo(() => {
    return new Set(tags.filter((t) => t.target_type === 'item').map((t) => t.target_id))
  }, [tags])

  const taggedLocationIds = useMemo(() => {
    return new Set(tags.filter((t) => t.target_type === 'location').map((t) => t.target_id))
  }, [tags])

  // Items assigned to selected zone but NOT placed on the canvas
  const unplacedItems = useMemo(() => {
    return assignedItems.filter((i) => !taggedItemIds.has(i.id))
  }, [assignedItems, taggedItemIds])

  // Load tags for current canvas
  useEffect(() => {
    if (!canvasLocationId) { setTags([]); return }
    if (suppressRefetchRef.current) {
      suppressRefetchRef.current = false
      return
    }
    fetchLocationTags(canvasLocationId).then((fetched) => {
      setTags(fetched)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasLocationId, locations.length])

  // Fetch sub-zone tags for child locations (used for mini-map previews in zones without photos)
  const [childTagsMap, setChildTagsMap] = useState<Map<string, LocationTag[]>>(new Map())
  useEffect(() => {
    // Get location IDs referenced by zone tags on the current canvas
    const childLocIds = tags
      .filter(t => t.target_type === 'location' && t.width && t.height)
      .map(t => t.target_id)
    if (childLocIds.length === 0) { setChildTagsMap(new Map()); return }
    fetchLocationTagsBatch(childLocIds).then(setChildTagsMap)
  }, [tags])

  // Reset edit state when navigating to a different canvas
  useEffect(() => {
    setIsEditMode(false)
    setIsDrawMode(false)
    setPendingZone(null)
    setSelectedZoneIds(new Set())
  }, [canvasLocationId])

  // Exit draw mode and clear selection when edit mode is turned off
  useEffect(() => {
    if (!isEditMode) {
      setIsDrawMode(false)
      setPendingZone(null)
      setDrawForLocationId(null)
      setSelectedZoneIds(new Set())
    }
  }, [isEditMode])

  const handleTagTap = useCallback((tag: LocationTag) => {
    if (transitionState !== 'idle') return // prevent double-tap during animation
    if (tag.target_type === 'location') {
      if (tag.width && tag.height) {
        // Zoom into the zone first, then navigate after spring rest
        setTransitionState('zooming-in')
        setNavZoomTarget({ x: tag.x, y: tag.y, w: tag.width, h: tag.height })
        setPendingNavId(tag.target_id)
      } else {
        // Point badge — no zone to zoom into, navigate immediately
        navigateInto(tag.target_id)
      }
    } else {
      const item = items.find((i) => i.id === tag.target_id)
      if (item) onSelectItem(item)
    }
  }, [items, navigateInto, onSelectItem, transitionState, setTransitionState])

  // Called by LocationTagPhoto when the zoom spring rests (zone fully framed).
  // Cache current tags for the layer that's about to become a background layer,
  // then push the stack so a new top layer appears.
  const handleZoomComplete = useCallback(() => {
    if (!pendingNavId || transitionState !== 'zooming-in') return

    // Cache the current top layer's tags so the background layer can render them
    if (canvasLocationId) {
      setLayerTagsMap(prev => {
        const next = new Map(prev)
        next.set(canvasLocationId, [...tags])
        return next
      })
    }

    // Navigate — pushes canvasStack, new top layer renders at scale=1
    navigateInto(pendingNavId)
    setPendingNavId(null)
    // Don't clear navZoomTarget — the old top layer (now background) keeps its zoom.
    // The new top layer doesn't receive navZoomTarget (it gets null via the zoomTarget prop).
    setNavZoomTarget(null)
    setTransitionState('idle')
  }, [pendingNavId, transitionState, navigateInto, setTransitionState, canvasLocationId, tags])

  // Process pending navigation target from tree/external nav
  // If the target has a zone on the current canvas, zoom to it first.
  // If the target is deeper (not on current canvas), navigate directly.
  useEffect(() => {
    if (!pendingNavTarget || transitionState !== 'idle') return
    setPendingNavTarget(null)

    // Check if the target is a zone on the current canvas
    const matchingTag = tags.find(
      (t) => t.target_type === 'location' && t.target_id === pendingNavTarget && t.width && t.height,
    )
    if (matchingTag) {
      // Zoom into the zone, then navigate (same flow as zone tap)
      setTransitionState('zooming-in')
      setNavZoomTarget({ x: matchingTag.x, y: matchingTag.y, w: matchingTag.width!, h: matchingTag.height! })
      setPendingNavId(pendingNavTarget)
    } else {
      // Target not on current canvas — build full path and navigate directly
      const path: string[] = []
      let cur = locations.find((l) => l.id === pendingNavTarget)
      while (cur && cur.name !== ROOT_LOCATION_NAME) {
        path.unshift(cur.id)
        cur = locations.find((l) => l.id === cur!.parent_id)
      }
      navigateToPath(path)
    }
  }, [pendingNavTarget, transitionState, tags, locations, navigateToPath, setPendingNavTarget, setTransitionState])

  const handleTagDrag = useCallback((tagId: string, x: number, y: number) => {
    setTags((prev) => prev.map((t) => t.id === tagId ? { ...t, x, y } : t))
  }, [])

  // Zone move/resize handlers
  const handleZoneMove = useCallback((tagId: string, x: number, y: number) => {
    setTags((prev) => prev.map((t) => t.id === tagId ? { ...t, x, y } : t))
  }, [])

  const handleZoneResize = useCallback((tagId: string, w: number, h: number) => {
    setTags((prev) => prev.map((t) => t.id === tagId ? { ...t, width: w, height: h } : t))
  }, [])

  const handleTagRemove = useCallback((tagId: string) => {
    setTags((prev) => prev.filter((t) => t.id !== tagId))
    if (!isEditMode) setIsEditMode(true)
  }, [isEditMode])

  const handleSaveTags = useCallback(async () => {
    if (!canvasLocationId) return
    await upsertLocationTags(
      canvasLocationId,
      tags.map(({ id, ...rest }) => rest),
    )
    setIsEditMode(false)
    setIsDrawMode(false)
    setSelectedZoneIds(new Set())
  }, [canvasLocationId, tags])

  // ── Zone drawing ──────────────────────────────────────────

  const handleZoneDrawn = useCallback(async (x: number, y: number, w: number, h: number) => {
    if (!canvasLocationId) return
    if (drawForLocationId) {
      // Drawing a zone for an existing sub-location
      const loc = locations.find((l) => l.id === drawForLocationId)
      if (loc) {
        const newTag: LocationTag = {
          id: crypto.randomUUID(),
          location_id: canvasLocationId,
          target_type: 'location',
          target_id: loc.id,
          x, y,
          width: w,
          height: h,
          label: loc.name,
        }
        const updatedTags = [...tags, newTag]
        setTags(updatedTags)
        // Persist immediately
        await upsertLocationTags(
          canvasLocationId,
          updatedTags.map(({ id: _id, ...rest }) => rest),
        )
      }
      setDrawForLocationId(null)
      setIsDrawMode(false)
    } else {
      // New zone — prompt for name to create a sub-location
      setPendingZone({ x, y, w, h })
      setZoneName('')
      setIsDrawMode(false)
    }
  }, [drawForLocationId, locations, canvasLocationId, tags])

  const handleConfirmZoneName = useCallback(async () => {
    if (!pendingZone || !canvasLocationId || !zoneName.trim()) return
    // When splitting, the new zone should be at the same hierarchy level as the original
    let parentId: string | null
    if (splitOriginLocationId) {
      const originLoc = locations.find((l) => l.id === splitOriginLocationId)
      parentId = originLoc?.parent_id ?? null
    } else {
      parentId = selectedZoneId ?? null
    }
    // Suppress the tag refetch that fires when locations.length changes — we persist tags ourselves
    suppressRefetchRef.current = true
    // Create the sub-location
    const result = await onAddLocation({
      clinic_id: clinicId,
      parent_id: parentId,
      name: zoneName.trim(),
      photo_data: null,
      created_by: userId,
    })
    // Extract the new location id — onAddLocation returns the service result
    const newLoc = result as { location?: { id: string } }
    const newLocId = newLoc?.location?.id
    if (newLocId) {
      const newTag: LocationTag = {
        id: crypto.randomUUID(),
        location_id: canvasLocationId,
        target_type: 'location',
        target_id: newLocId,
        x: pendingZone.x,
        y: pendingZone.y,
        width: pendingZone.w,
        height: pendingZone.h,
        label: zoneName.trim(),
      }
      const updatedTags = [...tags, newTag]
      setTags(updatedTags)
      // Persist immediately so tags survive the locations.length refetch
      await upsertLocationTags(
        canvasLocationId,
        updatedTags.map(({ id: _id, ...rest }) => rest),
      )
    }
    setPendingZone(null)
    setZoneName('')
    setSplitOriginLocationId(null)
    if (!isEditMode) setIsEditMode(true)
  }, [pendingZone, canvasLocationId, selectedZoneId, splitOriginLocationId, locations, zoneName, clinicId, userId, onAddLocation, isEditMode, tags])

  const handleCancelZone = useCallback(() => {
    setPendingZone(null)
    setZoneName('')
    setDrawForLocationId(null)
    setSplitOriginLocationId(null)
  }, [])

  // Start drawing a zone for a specific existing sub-location
  const handleDrawZoneForLocation = useCallback((loc: LocalPropertyLocation) => {
    setDrawForLocationId(loc.id)
    setIsDrawMode(true)
    if (!isEditMode) setIsEditMode(true)
  }, [isEditMode])

  // ── Zone selection (split/merge) ─────────────────────────

  const handleZoneSelect = useCallback((tagId: string) => {
    if (!isEditMode) return
    setSelectedZoneIds((prev) => {
      const next = new Set(prev)
      if (next.has(tagId)) {
        next.delete(tagId)
      } else {
        if (next.size >= 2) {
          // Replace oldest (first) entry
          const first = next.values().next().value!
          next.delete(first)
        }
        next.add(tagId)
      }
      return next
    })
  }, [isEditMode])

  const handleSplit = useCallback(async () => {
    const selectedId = [...selectedZoneIds][0]
    if (!selectedId || !canvasLocationId) return
    const tag = tags.find((t) => t.id === selectedId)
    if (!tag || !tag.width || !tag.height) return

    const halfW = tag.width / 2
    const simpleRect: ZoneRect[] = [{ x: 0, y: 0, w: 1, h: 1 }]
    // Shrink the original zone to the left half, reset to simple rectangle
    const shrunkTags = tags.map((t) => t.id === tag.id ? { ...t, width: halfW, rects: simpleRect } : t)
    setTags(shrunkTags)
    // Persist the shrunk original immediately so it survives any refetch
    await upsertLocationTags(
      canvasLocationId,
      shrunkTags.map(({ id: _id, ...rest }) => rest),
    )
    // Track the original zone's location so the new split zone gets the same parent_id
    setSplitOriginLocationId(tag.target_id)
    // Set up pending zone for the right half
    setPendingZone({
      x: tag.x + halfW,
      y: tag.y,
      w: halfW,
      h: tag.height,
    })
    setZoneName('')
    setSelectedZoneIds(new Set())
    if (!isEditMode) setIsEditMode(true)
  }, [selectedZoneIds, tags, canvasLocationId, isEditMode])

  const handleMergeRequest = useCallback(() => {
    const ids = [...selectedZoneIds]
    if (ids.length !== 2) return
    const tagA = tags.find((t) => t.id === ids[0])
    const tagB = tags.find((t) => t.id === ids[1])
    if (!tagA || !tagB) return
    setMergeConfirm({ tagA, tagB })
  }, [selectedZoneIds, tags])

  const handleMergeConfirm = useCallback(async () => {
    if (!mergeConfirm || !canvasLocationId) return
    const { tagA, tagB } = mergeConfirm

    const aW = tagA.width ?? 0
    const aH = tagA.height ?? 0
    const bW = tagB.width ?? 0
    const bH = tagB.height ?? 0

    // Compute new bounding box encompassing both zones
    const newX = Math.min(tagA.x, tagB.x)
    const newY = Math.min(tagA.y, tagB.y)
    const newW = Math.max(tagA.x + aW, tagB.x + bW) - newX
    const newH = Math.max(tagA.y + aH, tagB.y + bH) - newY

    // Rescale each zone's rects into the new bounding-box coordinate space
    const rectsA = tagA.rects?.length ? tagA.rects : [{ x: 0, y: 0, w: 1, h: 1 }]
    const rectsB = tagB.rects?.length ? tagB.rects : [{ x: 0, y: 0, w: 1, h: 1 }]

    const rescale = (rects: ZoneRect[], tagX: number, tagY: number, tagW: number, tagH: number): ZoneRect[] =>
      rects.map((r) => ({
        x: newW > 0 ? ((tagX + r.x * tagW) - newX) / newW : 0,
        y: newH > 0 ? ((tagY + r.y * tagH) - newY) / newH : 0,
        w: newW > 0 ? (r.w * tagW) / newW : 1,
        h: newH > 0 ? (r.h * tagH) / newH : 1,
      }))

    const compositeRects = [
      ...rescale(rectsA, tagA.x, tagA.y, aW, aH),
      ...rescale(rectsB, tagB.x, tagB.y, bW, bH),
    ]

    // Build the merged tags array: expand tag A with composite shape, remove tag B
    const mergedTags = tags
      .map((t) => t.id === tagA.id ? { ...t, x: newX, y: newY, width: newW, height: newH, rects: compositeRects } : t)
      .filter((t) => t.id !== tagB.id)

    // Update local state AND persist to DB so the merge survives refetches
    setTags(mergedTags)
    await upsertLocationTags(
      canvasLocationId,
      mergedTags.map(({ id: _id, ...rest }) => rest),
    )

    // Suppress the tag refetch that fires when locations.length changes — tags are already persisted
    suppressRefetchRef.current = true

    // Reassign items and sub-locations from B's location to A's location,
    // then delete B's location to remove it from the roster/grid entirely.
    if (tagB.target_id && tagA.target_id && tagB.target_id !== tagA.target_id) {
      // Move all items assigned to B's location into A's location
      const itemsToMove = items.filter((i) => i.location_id === tagB.target_id)
      for (const item of itemsToMove) {
        await updateItem(item.id, { location_id: tagA.target_id }, userId)
      }
      // Reparent any child locations of B to A
      const childrenOfB = locations.filter((l) => l.parent_id === tagB.target_id)
      for (const child of childrenOfB) {
        await onUpdateLocation(child.id, { parent_id: tagA.target_id })
      }
      // Delete the merged location so it is removed from the grid/roster
      if (tagB.target_type === 'location') {
        await onDeleteLocation(tagB.target_id)
      }
    }

    setMergeConfirm(null)
    setSelectedZoneIds(new Set())
  }, [mergeConfirm, canvasLocationId, tags, items, locations, userId, onUpdateLocation, onDeleteLocation])

  const handleDuplicate = useCallback(() => {
    const selectedId = [...selectedZoneIds][0]
    if (!selectedId) return
    const tag = tags.find((t) => t.id === selectedId)
    if (!tag || !tag.width || !tag.height) return

    // Set up pending zone at the same position/size — user names the new sub-location
    setPendingZone({
      x: tag.x,
      y: tag.y,
      w: tag.width,
      h: tag.height,
    })
    setZoneName('')
    setSelectedZoneIds(new Set())
    if (!isEditMode) setIsEditMode(true)
  }, [selectedZoneIds, tags, isEditMode])

  // ── Existing tag management ───────────────────────────────

  const handleAddItemTag = useCallback((item: LocalPropertyItem) => {
    if (!canvasLocationId || tags.some((t) => t.target_type === 'item' && t.target_id === item.id)) return
    const existingCount = tags.length
    const col = existingCount % 3
    const row = Math.floor(existingCount / 3)
    const newTag: LocationTag = {
      id: crypto.randomUUID(),
      location_id: canvasLocationId,
      target_type: 'item',
      target_id: item.id,
      x: clamp(0.2 + col * 0.3, 0, 0.85),
      y: clamp(0.2 + row * 0.15, 0, 0.85),
      label: item.name,
    }
    setTags((prev) => [...prev, newTag])
    if (!isEditMode) setIsEditMode(true)
  }, [tags, canvasLocationId, isEditMode])

  const handleRemoveItemTag = useCallback((itemId: string) => {
    setTags((prev) => prev.filter((t) => !(t.target_type === 'item' && t.target_id === itemId)))
    if (!isEditMode) setIsEditMode(true)
  }, [isEditMode])

  const handleStartEditCurrent = useCallback(() => {
    if (!selectedZone) return
    setEditName(selectedZone.name)
    setEditPhotoData(selectedZone.photo_data ?? null)
    setIsEditingCurrent(true)
  }, [selectedZone])

  // Register location edit/delete actions for the drawer header whenever selected zone changes.
  useEffect(() => {
    if (!onRegisterLocationActions) return
    if (selectedZone && !isEditingCurrent) {
      onRegisterLocationActions({
        onEdit: handleStartEditCurrent,
        onDelete: () => setConfirmDeleteId(selectedZone.id),
      })
    } else {
      onRegisterLocationActions(null)
    }
  }, [selectedZone?.id, isEditingCurrent, onRegisterLocationActions, handleStartEditCurrent])

  const handleSaveEditCurrent = useCallback(async () => {
    if (!selectedZone || !editName.trim()) return
    await onUpdateLocation(selectedZone.id, {
      name: editName.trim(),
      photo_data: editPhotoData,
    })
    setIsEditingCurrent(false)
  }, [selectedZone, editName, editPhotoData, onUpdateLocation])

  const handleEditPhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const resized = await resizeImage(file, 1200)
      setEditPhotoData(resized)
    } catch { /* */ }
    e.target.value = ''
  }, [])

  const handleDeleteLocation = useCallback(async (id: string) => {
    // Remove tags referencing this location from the current canvas
    const updatedTags = tags.filter(t => !(t.target_type === 'location' && t.target_id === id))
    if (updatedTags.length !== tags.length && canvasLocationId) {
      setTags(updatedTags)
      await upsertLocationTags(
        canvasLocationId,
        updatedTags.map(({ id: _id, ...rest }) => rest),
      )
    }
    // Suppress the tag refetch — tags are already persisted above
    suppressRefetchRef.current = true
    await onDeleteLocation(id)
    setConfirmDeleteId(null)
    setOverflowMenuId(null)
    if (selectedZoneId === id) {
      navigateBack()
    }
  }, [onDeleteLocation, selectedZoneId, canvasLocationId, navigateBack, tags])

  // Build breadcrumb path from canvasStack
  const breadcrumbPath = useMemo(() =>
    canvasStack.map(id => ({
      id,
      name: locations.find(l => l.id === id)?.name ?? '...',
    })),
    [canvasStack, locations]
  )

  // Build background layer stack — one per ancestor level (root + all but the last canvasStack entry).
  // Each background layer shows its photo + zones, zoomed into the zone that leads to the next level.
  const backgroundLayers = useMemo(() => {
    if (canvasStack.length === 0) return []
    const layerIds = [rootLocationId, ...canvasStack.slice(0, -1)].filter(Boolean) as string[]
    return layerIds.map((locId, i) => {
      const nextLocId = i < layerIds.length - 1 ? layerIds[i + 1] : canvasStack[canvasStack.length - 1]
      const layerTags = layerTagsMap.get(locId) ?? []
      const loc = locations.find(l => l.id === locId)
      const photo = loc?.photo_data ?? null
      // Find the zone tag that points to the next level
      const zoneTag = layerTags.find(
        t => t.target_type === 'location' && t.target_id === nextLocId && t.width && t.height,
      )
      // Compute the spring transform matching zoomToRect math
      let transform: { x: number; y: number; scale: number } | undefined
      if (zoneTag) {
        const vpW = canvasWrapperRef.current?.clientWidth ?? 300
        const vpH = Math.min(canvasWrapperRef.current?.clientHeight ?? vpW, window.innerHeight * 0.4)
        const scaleX = 0.9 / zoneTag.width!
        const scaleY = 0.9 / zoneTag.height!
        const scale = Math.min(scaleX, scaleY, 10)
        const x = 10 - zoneTag.x * vpW * scale
        const y = 10 - zoneTag.y * vpH * scale
        transform = { x, y, scale }
      }
      return { locId, photo, tags: layerTags, transform, zIndex: i }
    })
  }, [canvasStack, rootLocationId, layerTagsMap, locations])

  return (
    <div className="flex flex-col">
      {/* Breadcrumb */}
      <LocationBreadcrumb
        clinicName={clinicName}
        path={breadcrumbPath}
        onTapRoot={() => navigateToPath([])}
        onTapLevel={(id) => {
          const idx = canvasStack.indexOf(id)
          if (idx >= 0) navigateToPath(canvasStack.slice(0, idx + 1))
        }}
      />

      {/* Canvas with tags — always shows root canvas */}
      {canvasLocationId && (
        <div className="px-6 mb-3">
          <div className="relative" ref={canvasWrapperRef}>
            {/* Background layers — zoomed-in parent canvases, non-interactive */}
            {backgroundLayers.map(({ locId, photo, tags: layerTags, transform, zIndex }) => (
              <div
                key={locId}
                className="absolute inset-0"
                style={{ zIndex }}
              >
                <LocationTagPhoto
                  photoData={photo}
                  tags={layerTags}
                  isEditMode={false}
                  frozen
                  initialTransform={transform}
                  locations={locations}
                  childTagsMap={childTagsMap}
                />
              </div>
            ))}

            {/* Active (top) layer — fully interactive */}
            <div style={{ position: 'relative', zIndex: backgroundLayers.length + 1 }}>
              <LocationTagPhoto
                photoData={canvasPhoto}
                tags={tags}
                isEditMode={isEditMode && !isDrawMode}
                onTagTap={handleTagTap}
                onTagDrag={handleTagDrag}
                items={[...assignedItems, ...childLocationItems]}
                drawMode={isDrawMode}
                onZoneDrawn={handleZoneDrawn}
                onZoneMove={handleZoneMove}
                onZoneResize={handleZoneResize}
                onTagRemove={handleTagRemove}
                pendingZone={pendingZone}
                pendingZoneName={zoneName}
                onPendingZoneNameChange={setZoneName}
                onPendingZoneConfirm={handleConfirmZoneName}
                onPendingZoneCancel={handleCancelZone}
                selectedZoneIds={selectedZoneIds}
                onZoneSelect={handleZoneSelect}
                highlightedZoneId={null}
                zoomTarget={navZoomTarget}
                onZoomComplete={handleZoomComplete}
                locations={locations}
                childTagsMap={childTagsMap}
              />
            </div>
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              {/* Add item icon — visible when a zone is selected */}
              {onAddItem && selectedZoneId && (
                <button
                  className="p-1.5 rounded-full bg-black/50 text-white shadow-md hover:bg-themeblue3/90 transition-colors"
                  onClick={onAddItem}
                  title="Add item to this location"
                >
                  <Plus size={16} />
                </button>
              )}
              {/* Zone action icons (shown when zones are selected in edit mode) */}
              {isEditMode && selectedZoneIds.size > 0 && (
                <>
                  {selectedZoneIds.size === 1 && (
                    <>
                      <button
                        className="p-1.5 rounded-full bg-themeblue3 text-white shadow-md hover:bg-themeblue3/90 transition-colors"
                        onClick={handleSplit}
                        title="Split zone"
                      >
                        <Scissors size={16} />
                      </button>
                      <button
                        className="p-1.5 rounded-full bg-themeblue3 text-white shadow-md hover:bg-themeblue3/90 transition-colors"
                        onClick={handleDuplicate}
                        title="Duplicate zone"
                      >
                        <Copy size={16} />
                      </button>
                    </>
                  )}
                  {selectedZoneIds.size === 2 && (
                    <button
                      className="p-1.5 rounded-full bg-themeblue3 text-white shadow-md hover:bg-themeblue3/90 transition-colors"
                      onClick={handleMergeRequest}
                      title="Merge zones"
                    >
                      <Merge size={16} />
                    </button>
                  )}
                  <button
                    className="p-1.5 rounded-full bg-black/50 text-white shadow-md hover:bg-black/60 transition-colors"
                    onClick={() => setSelectedZoneIds(new Set())}
                    title="Clear selection"
                  >
                    <X size={16} />
                  </button>
                </>
              )}
              {isEditMode && (
                <button
                  className={`p-1.5 rounded-full shadow-md transition-colors ${
                    isDrawMode
                      ? 'bg-themeblue3 text-white'
                      : 'bg-black/50 text-white hover:bg-black/60'
                  }`}
                  onClick={() => { setIsDrawMode((d) => !d); setSelectedZoneIds(new Set()) }}
                  title={isDrawMode ? 'Exit draw mode' : 'Draw zone'}
                >
                  <RectangleHorizontal size={16} />
                </button>
              )}
              {isEditMode ? (
                <button
                  className="p-1.5 rounded-full bg-green-500 text-white shadow-md"
                  onClick={handleSaveTags}
                >
                  <Check size={16} />
                </button>
              ) : (
                <button
                  className="p-1.5 rounded-full bg-black/50 text-white shadow-md"
                  onClick={() => setIsEditMode(true)}
                >
                  <Pencil size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assigned items tray — shown when a zone is selected */}
      {selectedZoneId && assignedItems.length > 0 && (
        <div className="px-6 mb-3">
          <div className="rounded-lg border border-tertiary/10 overflow-hidden">
            {/* Summary bar */}
            <button
              className="w-full flex items-center justify-between px-3 py-2 bg-secondary/5 hover:bg-secondary/10 transition-colors"
              onClick={() => setIsTrayExpanded((prev) => !prev)}
            >
              <div className="flex items-center gap-2">
                <Package size={16} className="text-tertiary" />
                <span className="text-xs font-medium text-primary">
                  {assignedItems.length} item{assignedItems.length !== 1 ? 's' : ''} assigned
                </span>
                {assignedItems.length - taggedItemIds.size > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-themeyellow/15 text-themeyellow font-medium">
                    {assignedItems.length - taggedItemIds.size} not on schematic
                  </span>
                )}
              </div>
              {isTrayExpanded ? <ChevronUp size={16} className="text-tertiary" /> : <ChevronDown size={16} className="text-tertiary" />}
            </button>

            {/* Expanded list */}
            {isTrayExpanded && (
              <div className="max-h-[200px] overflow-y-auto divide-y divide-tertiary/5">
                {assignedItems.map((item) => {
                  const isPlaced = taggedItemIds.has(item.id)
                  return (
                    <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                      {isPlaced ? (
                        <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                      ) : (
                        <CirclePlus size={16} className="text-tertiary shrink-0" />
                      )}
                      <button
                        className="flex-1 text-left text-xs text-primary truncate hover:text-themeblue3"
                        onClick={() => onSelectItem(item)}
                      >
                        {item.name}
                      </button>
                      {isPlaced ? (
                        isEditMode && (
                          <button
                            className="p-1 rounded-full hover:bg-themeredred/10 text-tertiary hover:text-red-500 transition-colors"
                            onClick={() => handleRemoveItemTag(item.id)}
                            title="Remove from schematic"
                          >
                            <X size={16} />
                          </button>
                        )
                      ) : (
                        <button
                          className="flex items-center gap-1 px-2 py-1 rounded-full bg-themeblue3/10 text-themeblue3 text-[10px] font-medium hover:bg-themeblue3/20 transition-colors"
                          onClick={() => handleAddItemTag(item)}
                        >
                          <Plus size={14} /> Place
                        </button>
                      )}
                      {onUnassignItem && (
                        <button
                          className="p-1 rounded-full hover:bg-themeredred/10 text-tertiary/40 hover:text-red-500 transition-colors"
                          onClick={() => { handleRemoveItemTag(item.id); onUnassignItem(item.id) }}
                          title="Unassign from location"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inline edit form for selected zone */}
      {selectedZone && isEditingCurrent && (
        <div className="px-6 mb-3 space-y-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Location name..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-tertiary/20 bg-themewhite text-primary placeholder:text-tertiary/50 focus:outline-none focus:border-themeblue2"
            autoFocus
          />
          {editPhotoData && (
            <div className="relative">
              <img src={editPhotoData} alt="Preview" className="w-full max-h-32 object-contain rounded-lg" />
              <button
                className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white"
                onClick={() => setEditPhotoData(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <label className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-dashed border-tertiary/30 text-xs text-tertiary cursor-pointer hover:border-themeblue3/40">
              <Camera size={16} /> {editPhotoData ? 'Change' : 'Add'} Photo
              <input ref={editPhotoInputRef} type="file" accept="image/*" capture="environment" onChange={handleEditPhotoSelect} className="hidden" />
            </label>
            <button
              className="flex-1 py-2 rounded-lg bg-themeblue3 text-white text-xs font-medium disabled:opacity-50"
              disabled={!editName.trim()}
              onClick={handleSaveEditCurrent}
            >
              Save
            </button>
            <button
              className="py-2 px-3 rounded-lg border border-tertiary/20 text-xs text-tertiary"
              onClick={() => setIsEditingCurrent(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmDialog
        visible={!!confirmDeleteId}
        title="Delete this location?"
        subtitle="Items in this location will be unassigned."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (confirmDeleteId) handleDeleteLocation(confirmDeleteId) }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* Merge confirmation modal */}
      <ConfirmDialog
        visible={!!mergeConfirm}
        title="Merge these zones?"
        subtitle={mergeConfirm ? `Items from "${mergeConfirm.tagB.label}" will move to "${mergeConfirm.tagA.label}".` : ''}
        confirmLabel="Merge"
        variant="warning"
        onConfirm={handleMergeConfirm}
        onCancel={() => setMergeConfirm(null)}
      />

      {/* Child locations as cards */}
      {visibleLocations.length > 0 && (
        <div className="px-6 mb-3">
          <h3 className="text-xs font-medium text-tertiary uppercase tracking-wide mb-2">
            {selectedZone ? 'Sub-locations' : 'Locations'}
          </h3>
          <div className="flex flex-wrap gap-2 max-h-[280px] overflow-y-auto pb-2">
            {visibleLocations.map((loc) => {
                const isOnCanvas = taggedLocationIds.has(loc.id)
                const locItems = items.filter((i) => i.location_id === loc.id)
                const isActive = selectedZoneId === loc.id
                return (
                  <div key={loc.id} className="shrink-0 w-28 relative">
                    <button
                      className={`w-full rounded-lg border overflow-hidden transition-colors ${
                        isActive
                          ? 'border-themeblue3/50 bg-themeblue3/5 ring-1 ring-themeblue3/30'
                          : isOnCanvas
                            ? 'border-tertiary/10 hover:border-themeblue3/30'
                            : 'border-themeyellow/30 bg-themeyellow/10 hover:border-themeyellow/40'
                      }`}
                      onClick={() => {
                        if (transitionState !== 'idle') return
                        // If this location has a zone on the canvas, zoom into it first
                        const matchingTag = tags.find(t => t.target_type === 'location' && t.target_id === loc.id && t.width && t.height)
                        if (matchingTag) {
                          setTransitionState('zooming-in')
                          setNavZoomTarget({ x: matchingTag.x, y: matchingTag.y, w: matchingTag.width!, h: matchingTag.height! })
                          setPendingNavId(loc.id)
                        } else {
                          navigateInto(loc.id)
                        }
                      }}
                    >
                      {loc.photo_data ? (
                        <img src={loc.photo_data} alt={loc.name} className="w-full h-20 object-cover" />
                      ) : (
                        <div className={`w-full h-20 flex items-center justify-center ${isOnCanvas ? 'bg-secondary/5' : 'bg-themeyellow/10'}`}>
                          <Camera size={20} className={isOnCanvas ? 'text-tertiary' : 'text-themeyellow/70'} />
                        </div>
                      )}
                      <div className="px-2 py-1.5">
                        <span className="text-xs font-medium text-primary truncate block">{loc.name}</span>
                        {locItems.length > 0 && (
                          <span className="inline-block text-[9px] px-1 py-0.5 rounded bg-tertiary/10 text-tertiary font-medium mt-0.5">
                            {locItems.length} item{locItems.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {!isOnCanvas && (
                          <span className="inline-block text-[9px] px-1 py-0.5 rounded bg-themeyellow/15 text-themeyellow font-medium mt-0.5">
                            no zone
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Overflow menu trigger */}
                    <button
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                      onClick={(e) => { e.stopPropagation(); setOverflowMenuId(overflowMenuId === loc.id ? null : loc.id) }}
                    >
                      <MoreVertical size={16} />
                    </button>

                    {/* Place on canvas button for zoneless sub-locations */}
                    {!isOnCanvas && isEditMode && (
                      <button
                        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-themeblue3 text-white text-[9px] font-medium shadow hover:bg-themeblue3/90 transition-colors whitespace-nowrap"
                        onClick={(e) => { e.stopPropagation(); handleDrawZoneForLocation(loc) }}
                        title="Draw zone on canvas"
                      >
                        <Plus size={10} /> Zone
                      </button>
                    )}

                    {/* Overflow dropdown */}
                    {overflowMenuId === loc.id && (
                      <div className="absolute top-7 right-1 z-10 bg-themewhite2 rounded-lg shadow-lg border border-tertiary/10 overflow-hidden min-w-[100px]">
                        {!isOnCanvas && (
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-themeblue3 hover:bg-themeblue3/5"
                            onClick={(e) => { e.stopPropagation(); handleDrawZoneForLocation(loc); setOverflowMenuId(null) }}
                          >
                            <Plus size={16} /> Draw Zone
                          </button>
                        )}
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-themeredred/10"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(loc.id); setOverflowMenuId(null) }}
                        >
                          <Trash2 size={16} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Unplaced items as cards */}
      {selectedZoneId && unplacedItems.length > 0 && (
        <div className="px-6 mb-3">
          <h3 className="text-xs font-medium text-tertiary uppercase tracking-wide mb-2">
            Unplaced Items
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {unplacedItems.map((item) => (
              <button
                key={item.id}
                className="shrink-0 w-28 rounded-lg border border-tertiary/10 overflow-hidden hover:border-themeblue3/30 transition-colors text-left"
                onClick={() => onSelectItem(item)}
              >
                <div className="w-full h-20 bg-secondary/5 flex items-center justify-center">
                  <Package size={20} className="text-tertiary" />
                </div>
                <div className="px-2 py-1.5 space-y-1">
                  <span className="text-xs font-medium text-primary truncate block">{item.name}</span>
                  <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-themeyellow/15 text-themeyellow font-medium">
                    unassigned
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {allLocations.length === 0 && !canvasLocationId && (
        <div className="px-6 py-8 text-center text-sm text-tertiary">
          No locations yet. Add your first location above.
        </div>
      )}
    </div>
  )
}
