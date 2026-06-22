import { useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react'
import { TextInput, PickerInput } from '../FormInputs'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useShallow } from 'zustand/react/shallow'
import { fetchLocationTags, upsertLocationTags } from '../../lib/propertyService'
import type { LocalPropertyLocation } from '../../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'

export interface PropertyLocationFormHandle {
  /** Validate + persist. Drives the host header's Save action. */
  submit: () => void
}

/** Geometry the user drew on the canvas before this form opened (draw-first add). */
export interface PendingZoneTag {
  /** Canvas the rect was drawn on (a parent location id, or the root location). */
  canvasId: string
  x: number
  y: number
  width: number
  height: number
}

interface PropertyLocationFormProps {
  /** The location being edited, or null to create a new one. */
  editingLocation?: LocalPropertyLocation | null
  /** Pre-selected parent when creating (e.g. "New area in X"). */
  defaultParentId?: string | null
  /**
   * Standardized draw-first add: the zone rectangle the user just drew. When the
   * chosen parent still matches the canvas it was drawn on, the tag persists at
   * this exact geometry; re-parenting falls back to the default auto-grid placement.
   */
  pendingTag?: PendingZoneTag | null
  onClose: () => void
}

/**
 * PropertyLocationForm — name + parent picker, presented in the right pane
 * (desktop) or the nested sheet (mobile). Save/Cancel live in the host header
 * (forwardRef submit handle), mirroring PropertyItemForm.
 */
export const PropertyLocationForm = forwardRef<PropertyLocationFormHandle, PropertyLocationFormProps>(
  function PropertyLocationForm({ editingLocation, defaultParentId = null, pendingTag = null, onClose }, ref) {
  const store = usePropertyStore(
    useShallow((s) => ({
      locations: s.locations,
      clinicId: s.clinicId,
      rootLocationId: s.rootLocationId,
      addLocation: s.addLocation,
      editLocation: s.editLocation,
      bumpTagVersion: s.bumpTagVersion,
    })),
  )

  const isEdit = !!editingLocation
  const [name, setName] = useState(editingLocation?.name ?? '')
  const [parentId, setParentId] = useState<string>(editingLocation?.parent_id ?? defaultParentId ?? '')
  const [kind, setKind] = useState<'area' | 'vehicle'>(
    editingLocation?.kind === 'vehicle' ? 'vehicle' : 'area',
  )
  const [, setIsSaving] = useState(false)
  // Levels are created/managed via the floor switcher, not this form — don't
  // expose the area/vehicle toggle for them (it would clobber kind='level').
  const isLevel = editingLocation?.kind === 'level'

  // Parent options: real (non-member) locations, excluding self + descendants
  // (can't re-home a location under itself) and the hidden ROOT node.
  const parentOptions = useMemo(() => {
    const excluded = new Set<string>()
    if (editingLocation) {
      excluded.add(editingLocation.id)
      const childrenMap = new Map<string | null, string[]>()
      for (const l of store.locations) {
        const key = l.parent_id ?? null
        const arr = childrenMap.get(key)
        if (arr) arr.push(l.id)
        else childrenMap.set(key, [l.id])
      }
      const queue = [editingLocation.id]
      while (queue.length) {
        const cur = queue.pop()!
        for (const child of childrenMap.get(cur) ?? []) {
          if (!excluded.has(child)) { excluded.add(child); queue.push(child) }
        }
      }
    }
    return store.locations
      .filter((l) => l.name !== ROOT_LOCATION_NAME && !l.holder_user_id && !excluded.has(l.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((l) => ({ value: l.id, label: l.name }))
  }, [store.locations, editingLocation])

  const handleSave = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed || !store.clinicId) return
    setIsSaving(true)
    try {
      if (isEdit && editingLocation) {
        await store.editLocation(editingLocation.id, {
          name: trimmed,
          parent_id: parentId || null,
          ...(isLevel ? {} : { kind }),
        })
        onClose()
        return
      }
      const result = await store.addLocation({
        clinic_id: store.clinicId,
        parent_id: parentId || null,
        name: trimmed,
        kind,
        photo_data: null,
        holder_user_id: null,
        created_by: '',
      })
      if (result?.success && result.location) {
        const canvasId = (parentId || null) ?? store.rootLocationId
        // Draw-first add: persist the rect the user drew, as long as the chosen
        // parent still maps to the canvas it was drawn on. Otherwise (re-parented,
        // or no draw) drop a default auto-grid tag so the zone still appears.
        const useDrawn = !!pendingTag && pendingTag.canvasId === canvasId
        if (canvasId) {
          const existingTags = await fetchLocationTags(canvasId)
          let placement: { x: number; y: number; width: number; height: number }
          if (useDrawn && pendingTag) {
            placement = { x: pendingTag.x, y: pendingTag.y, width: pendingTag.width, height: pendingTag.height }
          } else {
            const zoneCount = existingTags.filter((t) => t.target_type === 'location').length
            const col = zoneCount % 4
            const row = Math.floor(zoneCount / 4)
            placement = { x: 0.05 + col * 0.23, y: 0.05 + row * 0.18, width: 0.2, height: 0.14 }
          }
          await upsertLocationTags(canvasId, [
            ...existingTags,
            {
              id: crypto.randomUUID(),
              location_id: canvasId,
              target_type: 'location' as const,
              target_id: result.location.id,
              ...placement,
              label: trimmed,
            },
          ])
          store.bumpTagVersion()
        }
      }
      onClose()
    } finally {
      setIsSaving(false)
    }
  }, [name, parentId, kind, isLevel, isEdit, editingLocation, pendingTag, store, onClose])

  useImperativeHandle(ref, () => ({ submit: handleSave }), [handleSave])

  return (
    <div className="px-4 py-4">
      <div className="rounded-2xl overflow-hidden">
        <TextInput value={name} onChange={setName} placeholder="Location name *" required />
        {parentOptions.length > 0 && (
          <PickerInput
            value={parentId}
            onChange={setParentId}
            options={parentOptions}
            placeholder="Parent location (top-level)"
          />
        )}
        {!isLevel && (
          <PickerInput
            value={kind}
            onChange={(v) => setKind(v as 'area' | 'vehicle')}
            options={[
              { value: 'area', label: 'Area' },
              { value: 'vehicle', label: 'Vehicle' },
            ]}
            placeholder="Type"
          />
        )}
      </div>
    </div>
  )
})
