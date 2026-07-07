import { useState, useMemo, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { TextInput, PickerInput } from '@/Components/primitives/FormInputs'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useShallow } from 'zustand/react/shallow'
import { fetchLocationTags, upsertLocationTags } from '../../lib/propertyService'
import { isLinContainer } from '../../Utilities/propertyAuthorized'
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
  /** Reports save-in-flight so the host surface can gate with the HUD loader. */
  onSavingChange?: (saving: boolean) => void
}

/**
 * PropertyLocationForm — name + parent picker, presented in the right pane
 * (desktop) or the nested sheet (mobile). Save/Cancel live in the host header
 * (forwardRef submit handle), mirroring PropertyItemForm.
 */
export const PropertyLocationForm = forwardRef<PropertyLocationFormHandle, PropertyLocationFormProps>(
  function PropertyLocationForm({ editingLocation, defaultParentId = null, pendingTag = null, onClose, onSavingChange }, ref) {
  const store = usePropertyStore(
    useShallow((s) => ({
      locations: s.locations,
      items: s.items,
      clinicId: s.clinicId,
      rootLocationId: s.rootLocationId,
      addLocation: s.addLocation,
      editLocation: s.editLocation,
      addItem: s.addItem,
      editItem: s.editItem,
      removeItem: s.removeItem,
      bumpTagVersion: s.bumpTagVersion,
    })),
  )

  const isEdit = !!editingLocation
  const [name, setName] = useState(editingLocation?.name ?? '')
  const [parentId, setParentId] = useState<string>(editingLocation?.parent_id ?? defaultParentId ?? '')
  const [kind, setKind] = useState<'area' | 'vehicle'>(
    editingLocation?.kind === 'vehicle' ? 'vehicle' : 'area',
  )
  // ANY zone can also BE a LIN (signed for, with authorized BII) — a vehicle, a Pelican case,
  // an aid bag. LIN-ness is orthogonal to `kind`. A zone's PHR identity lives on a SHADOW
  // LIN-item linked by location_id = this zone; the zone's LIN code is stored there (locations
  // have no lin column). Entering a LIN here mints/syncs that shadow on save, so the zone appears
  // in the Cluster Hand Receipt and can carry authorized components. Clearing it reaps the shadow.
  const existingShadow = useMemo(
    () => (editingLocation ? store.items.find((i) => i.location_id === editingLocation.id && isLinContainer(i)) ?? null : null),
    [editingLocation, store.items],
  )
  const [lin, setLin] = useState(existingShadow?.lin ?? '')
  const [isSaving, setIsSaving] = useState(false)
  // Zone photo — the map-tile background. Staged locally (raw resize, NO crop) and
  // committed on Save; create seeds null. resizeImage preserves aspect ratio.
  const [photoData, setPhotoData] = useState<string | null>(editingLocation?.photo_data ?? null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const handlePhotoPick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const { resizeImage } = await import('../../Utilities/imageUtils')
        setPhotoData(await resizeImage(file, 800, 0.7))
      } catch { /* non-fatal */ }
    }
    e.target.value = ''
  }, [])
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
      .filter((l) => l.name !== ROOT_LOCATION_NAME && !l.holder_user_id && !l.is_turn_in_zone && !excluded.has(l.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((l) => ({ value: l.id, label: l.name }))
  }, [store.locations, editingLocation])

    // Mint/sync/reap this zone's shadow LIN-item (its PHR identity) — kind-agnostic. name/LIN
    // edits keep the shadow in step; the shadow is what surfaces the zone in the Cluster Hand
    // Receipt. Clearing the LIN reaps the shadow (same detach-then-remove cascade removeLocation
    // uses, so authorized BII survive as loose stock under this zone rather than being deleted).
    const syncShadow = async (zoneId: string, zoneName: string) => {
      if (!store.clinicId) return
      const linCode = lin.trim()
      const shadow = store.items.find((i) => i.location_id === zoneId && isLinContainer(i))
      if (!linCode) {
        if (shadow) {
          for (const comp of store.items.filter((i) => i.parent_item_id === shadow.id)) {
            await store.editItem(comp.id, { parent_item_id: null, quantity_authorized: null })
          }
          await store.removeItem(shadow.id)
        }
        return
      }
      if (shadow) {
        await store.editItem(shadow.id, { name: zoneName, lin: linCode })
        return
      }
      await store.addItem({
        clinic_id: store.clinicId,
        sub_cluster_id: null,
        name: zoneName,
        nomenclature: null,
        nsn: null,
        lin: linCode,
        condition_code: 'serviceable',
        location_id: zoneId,
        current_holder_id: null,
        parent_item_id: null,
        expiry_date: null,
        notes: null,
        is_serialized: false,
        item_type: 'DI',
        unit_of_issue: null,
        pack_size: null,
        quantity_authorized: null,
        serial_number: null,
        quantity: 0,
        location_tag_id: null,
        photo_url: null,
        visual_fingerprint: null,
      })
    }

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
          photo_data: photoData,
        })
        await syncShadow(editingLocation.id, trimmed)
        onClose()
        return
      }
      const result = await store.addLocation({
        clinic_id: store.clinicId,
        parent_id: parentId || null,
        name: trimmed,
        kind,
        photo_data: photoData,
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
        await syncShadow(result.location.id, trimmed)
      }
      onClose()
    } finally {
      setIsSaving(false)
    }
  }, [name, parentId, kind, lin, isLevel, photoData, isEdit, editingLocation, pendingTag, store, onClose])

  useImperativeHandle(ref, () => ({ submit: handleSave }), [handleSave])

  useEffect(() => { onSavingChange?.(isSaving) }, [isSaving, onSavingChange])
  // Save success calls onClose() (unmount) before the finally resets isSaving, so
  // clear the host's HUD flag on unmount to avoid a stuck loader.
  useEffect(() => () => onSavingChange?.(false), [onSavingChange])

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
        {/* Any zone can also BE a LIN — its LIN code signs it onto the cluster hand receipt and
            lets it carry authorized BII (a vehicle, a med case, an aid bag). Optional: leave blank
            to keep it a plain container zone; clearing an existing code reaps the shadow. */}
        {!isLevel && (
          <TextInput value={lin} onChange={setLin} placeholder="Hand-receipt LIN (optional, e.g. M30499)" />
        )}

        {/* Zone photo — the map-tile background. Raw upload (no crop); staged here
            and committed on Save. Shows as a downloadable file in the zone detail. */}
        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} />
        {photoData ? (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-primary/6 last:border-b-0">
            <img src={photoData} alt="" className="w-11 h-11 rounded-lg object-cover border border-tertiary/15 shrink-0" />
            <span className="flex-1 text-base md:text-sm text-primary truncate">Photo</span>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="text-[10pt] font-medium text-themeblue2 active:scale-95 transition-transform"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => setPhotoData(null)}
              className="text-[10pt] font-medium text-themeredred active:scale-95 transition-transform"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="w-full bg-transparent px-4 py-3 text-left text-base md:text-sm flex items-center justify-between gap-3 focus:outline-none text-tertiary border-b border-primary/6 last:border-b-0"
          >
            <span>Add photo</span>
            <ImageIcon size={16} className="shrink-0 text-tertiary" />
          </button>
        )}
      </div>
    </div>
  )
})
