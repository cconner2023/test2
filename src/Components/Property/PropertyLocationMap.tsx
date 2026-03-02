import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Camera, Image, Edit3, Check, Trash2, MoreVertical, X, Package, CheckCircle2, CirclePlus, ChevronDown, ChevronUp } from 'lucide-react'
import { clamp } from '../../Utilities/GestureUtils'
import { LocationBreadcrumb } from './LocationBreadcrumb'
import { LocationTagPhoto } from './LocationTagPhoto'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { fetchLocationTags, upsertLocationTags } from '../../lib/propertyService'
import type { PropertyLocation, LocalPropertyLocation, LocationTag, LocalPropertyItem } from '../../Types/PropertyTypes'

interface PropertyLocationMapProps {
  locations: LocalPropertyLocation[]
  items: LocalPropertyItem[]
  clinicId: string
  onAddLocation: (data: Omit<PropertyLocation, 'id' | 'created_at' | 'updated_at'>) => Promise<unknown>
  onUpdateLocation: (id: string, updates: Partial<PropertyLocation>) => Promise<unknown>
  onDeleteLocation: (id: string) => Promise<unknown>
  onSelectItem: (item: LocalPropertyItem) => void
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
  userId,
}: PropertyLocationMapProps) {
  const { locationPath, pushLocation, popLocation, resetLocationPath } = usePropertyStore()
  const currentLocation = locationPath[locationPath.length - 1] ?? null

  const [tags, setTags] = useState<LocationTag[]>([])
  const [isEditMode, setIsEditMode] = useState(false)
  const [isAddingLocation, setIsAddingLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [photoData, setPhotoData] = useState<string | null>(null)

  // Edit/delete state
  const [isEditingCurrent, setIsEditingCurrent] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhotoData, setEditPhotoData] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [overflowMenuId, setOverflowMenuId] = useState<string | null>(null)
  const editPhotoInputRef = useRef<HTMLInputElement>(null)

  // Item tray state
  const [isTrayExpanded, setIsTrayExpanded] = useState(false)

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

  const taggedItemIds = useMemo(() => {
    return new Set(tags.filter((t) => t.target_type === 'item').map((t) => t.target_id))
  }, [tags])

  // Load tags for current location
  useEffect(() => {
    if (!currentLocation?.id) { setTags([]); return }
    setIsTrayExpanded(false)
    fetchLocationTags(currentLocation.id).then(setTags)
  }, [currentLocation?.id])

  const handleBreadcrumbTap = useCallback((index: number) => {
    // Pop back to the tapped segment
    const popsNeeded = locationPath.length - 1 - index
    for (let i = 0; i < popsNeeded; i++) popLocation()
  }, [locationPath, popLocation])

  const handleTagTap = useCallback((tag: LocationTag) => {
    if (tag.target_type === 'location') {
      const loc = locations.find((l) => l.id === tag.target_id)
      if (loc) pushLocation(loc)
    } else {
      const item = items.find((i) => i.id === tag.target_id)
      if (item) onSelectItem(item)
    }
  }, [locations, items, pushLocation, onSelectItem])

  const handleTagDrag = useCallback((tagId: string, x: number, y: number) => {
    setTags((prev) => prev.map((t) => t.id === tagId ? { ...t, x, y } : t))
  }, [])

  const handleSaveTags = useCallback(async () => {
    if (!currentLocation) return
    await upsertLocationTags(
      currentLocation.id,
      tags.map(({ id, ...rest }) => rest),
    )
    setIsEditMode(false)
  }, [currentLocation, tags])

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

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { resizeImage } = await import('../../Hooks/useProfileAvatar')
      const resized = await resizeImage(file, 1200)
      setPhotoData(resized)
    } catch { /* */ }
    e.target.value = ''
  }, [])

  const handleAddLocation = useCallback(async () => {
    if (!newLocationName.trim()) return
    await onAddLocation({
      clinic_id: clinicId,
      parent_id: currentLocation?.id ?? null,
      name: newLocationName.trim(),
      photo_data: photoData,
      created_by: userId,
    })
    setNewLocationName('')
    setPhotoData(null)
    setIsAddingLocation(false)
  }, [newLocationName, photoData, clinicId, currentLocation, onAddLocation, userId])

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
      const { resizeImage } = await import('../../Hooks/useProfileAvatar')
      const resized = await resizeImage(file, 1200)
      setEditPhotoData(resized)
    } catch { /* */ }
    e.target.value = ''
  }, [])

  const handleDeleteLocation = useCallback(async (id: string) => {
    await onDeleteLocation(id)
    setConfirmDeleteId(null)
    setOverflowMenuId(null)
    // If deleting the current location, pop back
    if (currentLocation?.id === id) {
      popLocation()
    }
  }, [onDeleteLocation, currentLocation, popLocation])

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
      />

      {/* Current location photo/canvas with tags */}
      {currentLocation && (
        <div className="px-4 mb-3">
          <div className="relative">
            <LocationTagPhoto
              photoData={currentLocation.photo_data}
              tags={tags}
              isEditMode={isEditMode}
              onTagTap={handleTagTap}
              onTagDrag={handleTagDrag}
            />
            <div className="absolute top-2 right-2 flex gap-1">
              {isEditMode ? (
                <button
                  className="p-1.5 rounded-full bg-green-500 text-white shadow-md"
                  onClick={handleSaveTags}
                >
                  <Check size={14} />
                </button>
              ) : (
                <button
                  className="p-1.5 rounded-full bg-black/50 text-white shadow-md"
                  onClick={() => setIsEditMode(true)}
                >
                  <Edit3 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assigned items tray */}
      {currentLocation && assignedItems.length > 0 && (
        <div className="px-4 mb-3">
          <div className="rounded-lg border border-tertiary/10 overflow-hidden">
            {/* Summary bar */}
            <button
              className="w-full flex items-center justify-between px-3 py-2 bg-secondary/5 hover:bg-secondary/10 transition-colors"
              onClick={() => setIsTrayExpanded((prev) => !prev)}
            >
              <div className="flex items-center gap-2">
                <Package size={14} className="text-tertiary" />
                <span className="text-xs font-medium text-primary">
                  {assignedItems.length} item{assignedItems.length !== 1 ? 's' : ''} assigned
                </span>
                {assignedItems.length - taggedItemIds.size > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                    {assignedItems.length - taggedItemIds.size} not on schematic
                  </span>
                )}
              </div>
              {isTrayExpanded ? <ChevronUp size={14} className="text-tertiary" /> : <ChevronDown size={14} className="text-tertiary" />}
            </button>

            {/* Expanded list */}
            {isTrayExpanded && (
              <div className="max-h-[200px] overflow-y-auto divide-y divide-tertiary/5">
                {assignedItems.map((item) => {
                  const isPlaced = taggedItemIds.has(item.id)
                  return (
                    <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                      {isPlaced ? (
                        <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                      ) : (
                        <CirclePlus size={14} className="text-tertiary shrink-0" />
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
                          >
                            <X size={12} />
                          </button>
                        )
                      ) : (
                        <button
                          className="flex items-center gap-1 px-2 py-1 rounded-full bg-themeblue3/10 text-themeblue3 text-[10px] font-medium hover:bg-themeblue3/20 transition-colors"
                          onClick={() => handleAddItemTag(item)}
                        >
                          <Plus size={10} /> Place
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

      {/* Current location edit/delete actions */}
      {currentLocation && !isEditingCurrent && (
        <div className="flex gap-2 px-4 mb-3">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-tertiary/20 text-xs font-medium text-primary hover:bg-secondary/5 transition-colors"
            onClick={handleStartEditCurrent}
          >
            <Edit3 size={12} /> Edit Location
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            onClick={() => setConfirmDeleteId(currentLocation.id)}
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}

      {/* Inline edit form for current location */}
      {currentLocation && isEditingCurrent && (
        <div className="px-4 mb-3 space-y-2">
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
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <label className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-dashed border-tertiary/30 text-xs text-tertiary cursor-pointer hover:border-themeblue3/40">
              <Camera size={14} /> {editPhotoData ? 'Change' : 'Add'} Photo
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
      {confirmDeleteId && (
        <div className="px-4 mb-3">
          <div className="p-3 rounded-lg border border-red-200 bg-red-50 space-y-2">
            <p className="text-sm text-red-800 font-medium">Delete this location?</p>
            <p className="text-xs text-red-600">Items in this location will be unassigned.</p>
            <div className="flex gap-2">
              <button
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700"
                onClick={() => handleDeleteLocation(confirmDeleteId)}
              >
                Delete
              </button>
              <button
                className="py-2 px-3 rounded-lg border border-tertiary/20 text-xs text-tertiary"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Child locations as cards */}
      {childLocations.length > 0 && (
        <div className="px-4 mb-3">
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
                    <MoreVertical size={12} />
                  </button>
                )}

                {/* Overflow dropdown */}
                {overflowMenuId === loc.id && (
                  <div className="absolute top-7 right-1 z-10 bg-white rounded-lg shadow-lg border border-tertiary/10 overflow-hidden min-w-[100px]">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-secondary/5"
                      onClick={(e) => { e.stopPropagation(); handleStartEditChild(loc) }}
                    >
                      <Edit3 size={11} /> Rename
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(loc.id); setOverflowMenuId(null) }}
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add location */}
      {isAddingLocation ? (
        <div className="px-4 py-3 space-y-2 border-t border-tertiary/10">
          <input
            type="text"
            value={newLocationName}
            onChange={(e) => setNewLocationName(e.target.value)}
            placeholder="Location name..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-tertiary/20 bg-themewhite text-primary placeholder:text-tertiary/50 focus:outline-none focus:border-themeblue3/50"
            autoFocus
          />
          {photoData && (
            <img src={photoData} alt="Preview" className="w-full max-h-32 object-contain rounded-lg" />
          )}
          <div className="flex gap-2">
            <label className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-dashed border-tertiary/30 text-xs text-tertiary cursor-pointer hover:border-themeblue3/40">
              <Camera size={14} /> Photo
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} className="hidden" />
            </label>
            <button
              className="flex-1 py-2 rounded-lg bg-themeblue3 text-white text-xs font-medium disabled:opacity-50"
              disabled={!newLocationName.trim()}
              onClick={handleAddLocation}
            >
              Create
            </button>
            <button
              className="py-2 px-3 rounded-lg border border-tertiary/20 text-xs text-tertiary"
              onClick={() => { setIsAddingLocation(false); setNewLocationName(''); setPhotoData(null) }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="mx-4 mb-3 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-tertiary/20 text-sm text-tertiary hover:border-themeblue3/30 hover:text-themeblue3 transition-colors"
          onClick={() => setIsAddingLocation(true)}
        >
          <Plus size={16} /> New Location
        </button>
      )}

      {childLocations.length === 0 && !currentLocation && !isAddingLocation && (
        <div className="px-4 py-8 text-center text-sm text-tertiary">
          No locations yet. Add your first location above.
        </div>
      )}
    </div>
  )
}
