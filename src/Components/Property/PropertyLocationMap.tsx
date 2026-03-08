import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Camera, Edit3, Check, Trash2, MoreVertical, X, Package, CheckCircle2, CirclePlus, ChevronDown, ChevronUp, RectangleHorizontal, Scissors, Merge, Copy } from 'lucide-react'
import { ConfirmDialog } from '../ConfirmDialog'
import { resizeImage } from '../../Utilities/imageUtils'
import { clamp } from '../../Utilities/GestureUtils'
import { LocationBreadcrumb } from './LocationBreadcrumb'
import { LocationTagPhoto } from './LocationTagPhoto'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { fetchLocationTags, upsertLocationTags, updateItem } from '../../lib/propertyService'
import type { PropertyLocation, LocalPropertyLocation, LocationTag, LocalPropertyItem } from '../../Types/PropertyTypes'

interface PropertyLocationMapProps {
  locations: LocalPropertyLocation[]
  items: LocalPropertyItem[]
  clinicId: string
  onAddLocation: (data: Omit<PropertyLocation, 'id' | 'created_at' | 'updated_at'>) => Promise<unknown>
  onUpdateLocation: (id: string, updates: Partial<PropertyLocation>) => Promise<unknown>
  onDeleteLocation: (id: string) => Promise<unknown>
  onSelectItem: (item: LocalPropertyItem) => void
  onUnassignItem?: (itemId: string) => void
  userId: string
}

export function PropertyLocationMap({
  locations,
  items,
  clinicId,
  onAddLocation,
  onUpdateLocation,
  onDeleteLocation,
  onSelectItem,
  onUnassignItem,
  userId,
}: PropertyLocationMapProps) {
  const { locationPath, pushLocation, popLocation, resetLocationPath } = usePropertyStore()
  // Derive currentLocation from the fresh locations prop (not the stale store snapshot)
  // so edits are reflected immediately after save + refresh
  const currentLocationId = locationPath[locationPath.length - 1]?.id ?? null
  const currentLocation = currentLocationId
    ? locations.find((l) => l.id === currentLocationId) ?? null
    : null

  const [tags, setTags] = useState<LocationTag[]>([])
  const [isEditMode, setIsEditMode] = useState(false)
  const [isDrawMode, setIsDrawMode] = useState(false)

  // Zone creation state: after drawing a rectangle, prompt for a name
  const [pendingZone, setPendingZone] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [zoneName, setZoneName] = useState('')
  // When drawing a zone for a specific existing sub-location
  const [drawForLocationId, setDrawForLocationId] = useState<string | null>(null)

  // Edit/delete state
  const [isEditingCurrent, setIsEditingCurrent] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhotoData, setEditPhotoData] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [overflowMenuId, setOverflowMenuId] = useState<string | null>(null)
  const editPhotoInputRef = useRef<HTMLInputElement>(null)

  // Zone selection state (split/merge)
  const [selectedZoneIds, setSelectedZoneIds] = useState<Set<string>>(new Set())
  const [mergeConfirm, setMergeConfirm] = useState<{ tagA: LocationTag; tagB: LocationTag } | null>(null)

  // Item tray state
  const [isTrayExpanded, setIsTrayExpanded] = useState(true)

  // Child locations of current level
  const childLocations = useMemo(() => {
    const parentId = currentLocation?.id ?? null
    return locations.filter((l) => l.parent_id === parentId)
  }, [locations, currentLocation])

  // Items assigned to this location and which ones are already tagged on canvas
  const assignedItems = useMemo(() => {
    if (!currentLocation) return []
    return items.filter((i) => i.location_id === currentLocation.id)
  }, [items, currentLocation])

  // Items for all child sub-locations (for zone density display)
  const childLocationItems = useMemo(() => {
    const childIds = new Set(childLocations.map((l) => l.id))
    return items.filter((i) => i.location_id && childIds.has(i.location_id))
  }, [items, childLocations])

  const taggedItemIds = useMemo(() => {
    return new Set(tags.filter((t) => t.target_type === 'item').map((t) => t.target_id))
  }, [tags])

  const taggedLocationIds = useMemo(() => {
    return new Set(tags.filter((t) => t.target_type === 'location').map((t) => t.target_id))
  }, [tags])

  // Items assigned to this location but NOT placed on the canvas
  const unplacedItems = useMemo(() => {
    return assignedItems.filter((i) => !taggedItemIds.has(i.id))
  }, [assignedItems, taggedItemIds])

  // Load tags for current location; auto-create baseline self-zone if none exist
  useEffect(() => {
    if (!currentLocation?.id) { setTags([]); return }
    setIsTrayExpanded(false)
    fetchLocationTags(currentLocation.id).then((fetched) => {
      const hasZones = fetched.some(
        (t) => t.width != null && t.height != null && t.width > 0 && t.height > 0,
      )
      if (!hasZones) {
        // Baseline self-zone: 90% of canvas, centered
        const selfZone: LocationTag = {
          id: crypto.randomUUID(),
          location_id: currentLocation.id,
          target_type: 'location',
          target_id: currentLocation.id,
          x: 0.05,
          y: 0.05,
          width: 0.9,
          height: 0.9,
          label: currentLocation.name,
        }
        setTags([...fetched, selfZone])
      } else {
        setTags(fetched)
      }
    })
  }, [currentLocation?.id, currentLocation?.name])

  // Exit draw mode and clear selection when edit mode is turned off
  useEffect(() => {
    if (!isEditMode) {
      setIsDrawMode(false)
      setPendingZone(null)
      setDrawForLocationId(null)
      setSelectedZoneIds(new Set())
    }
  }, [isEditMode])

  const handleBreadcrumbTap = useCallback((index: number) => {
    const popsNeeded = locationPath.length - 1 - index
    for (let i = 0; i < popsNeeded; i++) popLocation()
  }, [locationPath, popLocation])

  const handleTagTap = useCallback((tag: LocationTag) => {
    if (tag.target_type === 'location') {
      // Self-zone: target_id === currentLocation — don't navigate
      if (tag.target_id === currentLocation?.id) return
      const loc = locations.find((l) => l.id === tag.target_id)
      if (loc) pushLocation(loc)
    } else {
      const item = items.find((i) => i.id === tag.target_id)
      if (item) onSelectItem(item)
    }
  }, [locations, items, pushLocation, onSelectItem, currentLocation])

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
    if (!currentLocation) return
    await upsertLocationTags(
      currentLocation.id,
      tags.map(({ id, ...rest }) => rest),
    )
    setIsEditMode(false)
    setIsDrawMode(false)
    setSelectedZoneIds(new Set())
  }, [currentLocation, tags])

  // ── Zone drawing ──────────────────────────────────────────

  const handleZoneDrawn = useCallback((x: number, y: number, w: number, h: number) => {
    if (drawForLocationId) {
      // Drawing a zone for an existing sub-location
      const loc = locations.find((l) => l.id === drawForLocationId)
      if (loc) {
        const newTag: LocationTag = {
          id: crypto.randomUUID(),
          location_id: currentLocation!.id,
          target_type: 'location',
          target_id: loc.id,
          x, y,
          width: w,
          height: h,
          label: loc.name,
        }
        setTags((prev) => [...prev, newTag])
      }
      setDrawForLocationId(null)
      setIsDrawMode(false)
    } else {
      // New zone — prompt for name to create a sub-location
      setPendingZone({ x, y, w, h })
      setZoneName('')
      setIsDrawMode(false)
    }
  }, [drawForLocationId, locations, currentLocation])

  const handleConfirmZoneName = useCallback(async () => {
    if (!pendingZone || !currentLocation || !zoneName.trim()) return
    // Create the sub-location
    const result = await onAddLocation({
      clinic_id: clinicId,
      parent_id: currentLocation.id,
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
        location_id: currentLocation.id,
        target_type: 'location',
        target_id: newLocId,
        x: pendingZone.x,
        y: pendingZone.y,
        width: pendingZone.w,
        height: pendingZone.h,
        label: zoneName.trim(),
      }
      setTags((prev) => [...prev, newTag])
    }
    setPendingZone(null)
    setZoneName('')
    if (!isEditMode) setIsEditMode(true)
  }, [pendingZone, currentLocation, zoneName, clinicId, userId, onAddLocation, isEditMode])

  const handleCancelZone = useCallback(() => {
    setPendingZone(null)
    setZoneName('')
    setDrawForLocationId(null)
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

  const handleSplit = useCallback(() => {
    const selectedId = [...selectedZoneIds][0]
    if (!selectedId || !currentLocation) return
    const tag = tags.find((t) => t.id === selectedId)
    if (!tag || !tag.width || !tag.height) return

    const halfW = tag.width / 2
    // Shrink the original zone to the left half
    setTags((prev) =>
      prev.map((t) => t.id === tag.id ? { ...t, width: halfW } : t),
    )
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
  }, [selectedZoneIds, tags, currentLocation, isEditMode])

  const handleMergeRequest = useCallback(() => {
    const ids = [...selectedZoneIds]
    if (ids.length !== 2) return
    const tagA = tags.find((t) => t.id === ids[0])
    const tagB = tags.find((t) => t.id === ids[1])
    if (!tagA || !tagB) return
    setMergeConfirm({ tagA, tagB })
  }, [selectedZoneIds, tags])

  const handleMergeConfirm = useCallback(async () => {
    if (!mergeConfirm) return
    const { tagA, tagB } = mergeConfirm
    const aW = tagA.width ?? 0
    const aH = tagA.height ?? 0
    const bW = tagB.width ?? 0
    const bH = tagB.height ?? 0

    // Compute bounding box
    const x = Math.min(tagA.x, tagB.x)
    const y = Math.min(tagA.y, tagB.y)
    const w = Math.max(tagA.x + aW, tagB.x + bW) - x
    const h = Math.max(tagA.y + aH, tagB.y + bH) - y

    // Update tag A with bounding box, remove tag B
    setTags((prev) =>
      prev
        .map((t) => t.id === tagA.id ? { ...t, x, y, width: w, height: h } : t)
        .filter((t) => t.id !== tagB.id),
    )

    // Reassign items from B's location to A's location
    if (tagB.target_id && tagA.target_id && tagB.target_id !== tagA.target_id) {
      const itemsToMove = items.filter((i) => i.location_id === tagB.target_id)
      for (const item of itemsToMove) {
        await updateItem(item.id, { location_id: tagA.target_id }, userId)
      }
    }

    setMergeConfirm(null)
    setSelectedZoneIds(new Set())
  }, [mergeConfirm, items, userId])

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
    if (tags.some((t) => t.target_type === 'item' && t.target_id === item.id)) return
    const existingCount = tags.length
    const col = existingCount % 3
    const row = Math.floor(existingCount / 3)
    const newTag: LocationTag = {
      id: crypto.randomUUID(),
      location_id: currentLocation!.id,
      target_type: 'item',
      target_id: item.id,
      x: clamp(0.2 + col * 0.3, 0, 0.85),
      y: clamp(0.2 + row * 0.15, 0, 0.85),
      label: item.name,
    }
    setTags((prev) => [...prev, newTag])
    if (!isEditMode) setIsEditMode(true)
  }, [tags, currentLocation, isEditMode])

  const handleRemoveItemTag = useCallback((itemId: string) => {
    setTags((prev) => prev.filter((t) => !(t.target_type === 'item' && t.target_id === itemId)))
    if (!isEditMode) setIsEditMode(true)
  }, [isEditMode])

  const handleAddLocationTag = useCallback((loc: LocalPropertyLocation) => {
    if (tags.some((t) => t.target_type === 'location' && t.target_id === loc.id)) return
    const existingCount = tags.length
    const col = existingCount % 3
    const row = Math.floor(existingCount / 3)
    const newTag: LocationTag = {
      id: crypto.randomUUID(),
      location_id: currentLocation!.id,
      target_type: 'location',
      target_id: loc.id,
      x: clamp(0.2 + col * 0.3, 0, 0.85),
      y: clamp(0.2 + row * 0.15, 0, 0.85),
      label: loc.name,
    }
    setTags((prev) => [...prev, newTag])
    if (!isEditMode) setIsEditMode(true)
  }, [tags, currentLocation, isEditMode])

  const handleRemoveLocationTag = useCallback((locId: string) => {
    setTags((prev) => prev.filter((t) => !(t.target_type === 'location' && t.target_id === locId)))
    if (!isEditMode) setIsEditMode(true)
  }, [isEditMode])


  const handleStartEditCurrent = useCallback(() => {
    if (!currentLocation) return
    setEditName(currentLocation.name)
    setEditPhotoData(currentLocation.photo_data ?? null)
    setIsEditingCurrent(true)
  }, [currentLocation])

  const handleSaveEditCurrent = useCallback(async () => {
    if (!currentLocation || !editName.trim()) return
    await onUpdateLocation(currentLocation.id, {
      name: editName.trim(),
      photo_data: editPhotoData,
    })
    setIsEditingCurrent(false)
  }, [currentLocation, editName, editPhotoData, onUpdateLocation])

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
    if (updatedTags.length !== tags.length && currentLocation) {
      setTags(updatedTags)
      await upsertLocationTags(
        currentLocation.id,
        updatedTags.map(({ id: _id, ...rest }) => rest),
      )
    }
    await onDeleteLocation(id)
    setConfirmDeleteId(null)
    setOverflowMenuId(null)
    if (currentLocation?.id === id) {
      popLocation()
    }
  }, [onDeleteLocation, currentLocation, popLocation, tags])

  // Edit a child location (inline rename via overflow menu)
  const [editingChildId, setEditingChildId] = useState<string | null>(null)
  const [editingChildName, setEditingChildName] = useState('')

  const handleStartEditChild = useCallback((loc: LocalPropertyLocation) => {
    setEditingChildId(loc.id)
    setEditingChildName(loc.name)
    setOverflowMenuId(null)
  }, [])

  const handleSaveEditChild = useCallback(async () => {
    if (!editingChildId || !editingChildName.trim()) return
    await onUpdateLocation(editingChildId, { name: editingChildName.trim() })
    setEditingChildId(null)
    setEditingChildName('')
  }, [editingChildId, editingChildName, onUpdateLocation])

  return (
    <div className="flex flex-col">
      {/* Breadcrumb */}
      <LocationBreadcrumb
        path={locationPath}
        onTapSegment={handleBreadcrumbTap}
        onTapRoot={resetLocationPath}
        rightContent={currentLocation && !isEditingCurrent ? (
          <div className="rounded-full border border-tertiary/20 flex items-center p-0.5 bg-themewhite">
            <button
              className="w-11 h-11 rounded-full flex items-center justify-center text-primary hover:bg-secondary/10 transition-colors"
              onClick={handleStartEditCurrent}
            >
              <Edit3 size={16} />
            </button>
            <button
              className="w-11 h-11 rounded-full flex items-center justify-center text-themeredred hover:bg-red-50 transition-colors"
              onClick={() => setConfirmDeleteId(currentLocation.id)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : undefined}
      />

      {/* Current location photo/canvas with tags */}
      {currentLocation && (
        <div className="px-6 mb-3">
          <div className="relative">
            <LocationTagPhoto
              photoData={currentLocation.photo_data}
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
            />
            <div className="absolute top-2 right-2 flex gap-1 z-10">
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
                  <Edit3 size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assigned items tray */}
      {currentLocation && assignedItems.length > 0 && (
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
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
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
                            className="p-1 rounded-full hover:bg-red-50 text-tertiary hover:text-red-500 transition-colors"
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
                          className="p-1 rounded-full hover:bg-red-50 text-tertiary/40 hover:text-red-500 transition-colors"
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

      {/* Inline edit form for current location */}
      {currentLocation && isEditingCurrent && (
        <div className="px-6 mb-3 space-y-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Location name..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-tertiary/20 bg-themewhite text-primary placeholder:text-tertiary/50 focus:outline-none focus:border-themeblue3/50"
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
      {childLocations.length > 0 && (
        <div className="px-6 mb-3">
          <h3 className="text-xs font-medium text-tertiary uppercase tracking-wide mb-2">
            {currentLocation ? 'Sub-locations' : 'Locations'}
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {childLocations.map((loc) => (
              <div key={loc.id} className="shrink-0 w-28 relative">
                {/* Inline rename for child */}
                {editingChildId === loc.id ? (
                  <div className="rounded-lg border border-themeblue3/30 overflow-hidden p-1.5 space-y-1">
                    <input
                      type="text"
                      value={editingChildName}
                      onChange={(e) => setEditingChildName(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-tertiary/20 bg-themewhite text-primary focus:outline-none focus:border-themeblue3/50"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditChild(); if (e.key === 'Escape') setEditingChildId(null) }}
                    />
                    <div className="flex gap-1">
                      <button className="flex-1 py-1 rounded bg-themeblue3 text-white text-[10px] font-medium" onClick={handleSaveEditChild}>Save</button>
                      <button className="py-1 px-2 rounded border border-tertiary/20 text-[10px] text-tertiary" onClick={() => setEditingChildId(null)}>X</button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="w-full rounded-lg border border-tertiary/10 overflow-hidden hover:border-themeblue3/30 transition-colors"
                    onClick={() => pushLocation(loc)}
                  >
                    {loc.photo_data ? (
                      <img src={loc.photo_data} alt={loc.name} className="w-full h-20 object-cover" />
                    ) : (
                      <div className="w-full h-20 bg-secondary/5 flex items-center justify-center">
                        <Camera size={20} className="text-tertiary" />
                      </div>
                    )}
                    <div className="px-2 py-1.5">
                      <span className="text-xs font-medium text-primary truncate block">{loc.name}</span>
                    </div>
                  </button>
                )}

                {/* Overflow menu trigger */}
                {editingChildId !== loc.id && (
                  <button
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setOverflowMenuId(overflowMenuId === loc.id ? null : loc.id) }}
                  >
                    <MoreVertical size={16} />
                  </button>
                )}

                {/* Overflow dropdown */}
                {overflowMenuId === loc.id && (
                  <div className="absolute top-7 right-1 z-10 bg-themewhite2 rounded-lg shadow-lg border border-tertiary/10 overflow-hidden min-w-[100px]">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-secondary/5"
                      onClick={(e) => { e.stopPropagation(); handleStartEditChild(loc) }}
                    >
                      <Edit3 size={16} /> Rename
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(loc.id); setOverflowMenuId(null) }}
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Unplaced items as cards */}
      {currentLocation && unplacedItems.length > 0 && (
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
                  <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                    unassigned
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {childLocations.length === 0 && !currentLocation && (
        <div className="px-6 py-8 text-center text-sm text-tertiary">
          No locations yet. Add your first location above.
        </div>
      )}
    </div>
  )
}
