import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Camera, Image, Edit3, Check } from 'lucide-react'
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
  onSelectItem: (item: LocalPropertyItem) => void
  userId: string
}

export function PropertyLocationMap({
  locations,
  items,
  clinicId,
  onAddLocation,
  onUpdateLocation,
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

  // Child locations of current level
  const childLocations = useMemo(() => {
    const parentId = currentLocation?.id ?? null
    return locations.filter((l) => l.parent_id === parentId)
  }, [locations, currentLocation])

  // Load tags for current location
  useEffect(() => {
    if (!currentLocation?.id) { setTags([]); return }
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

  return (
    <div className="flex flex-col">
      {/* Breadcrumb */}
      <LocationBreadcrumb
        path={locationPath}
        onTapSegment={handleBreadcrumbTap}
        onTapRoot={resetLocationPath}
      />

      {/* Current location photo with tags */}
      {currentLocation?.photo_data && (
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

      {/* Child locations as cards */}
      {childLocations.length > 0 && (
        <div className="px-4 mb-3">
          <h3 className="text-xs font-medium text-tertiary uppercase tracking-wide mb-2">
            {currentLocation ? 'Sub-locations' : 'Locations'}
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {childLocations.map((loc) => (
              <button
                key={loc.id}
                className="shrink-0 w-28 rounded-lg border border-tertiary/10 overflow-hidden hover:border-themeblue3/30 transition-colors"
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
