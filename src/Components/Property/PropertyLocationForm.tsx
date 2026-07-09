import { useState, useMemo, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Paperclip } from 'lucide-react'
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
  // A zone can also sign onto the Cluster Hand Receipt as a COMPONENT of a LIN — a vehicle, a
  // med case, an aid bag that is itself accountable property. It attaches UNDER a parent LIN as
  // one counted line (the TCMC box is a component of TCMC, never the whole set). Its identity
  // lives on a SHADOW item marked represents_location_id = this zone; that shadow is a counted
  // component (parent_item_id = the LIN, quantity_authorized 1, on-hand 1), NOT a LIN header.
  const existingShadow = useMemo(
    () =>
      editingLocation
        ? store.items.find((i) => i.represents_location_id === editingLocation.id) ??
          // Legacy rescue: pre-model zones minted their shadow as a top-level LIN header.
          store.items.find((i) => i.location_id === editingLocation.id && isLinContainer(i)) ??
          null
        : null,
    [editingLocation, store.items],
  )
  // A legacy header shadow (the zone as its own top-level LIN) is RESCUED into a component by
  // picking a parent LIN; left untouched it's grandfathered (no-op on save).
  const isLegacyHeader = !!existingShadow && isLinContainer(existingShadow)
  // '' = not on hand receipt (reap any shadow). '__self__' = keep a legacy header as-is.
  // Else = the parent LIN this zone is a component of. Seeds from the existing shadow.
  const [parentLin, setParentLin] = useState<string>(
    existingShadow?.parent_item_id ?? (isLegacyHeader ? '__self__' : ''),
  )
  const [role, setRole] = useState(existingShadow?.nomenclature ?? '')
  const [nsn, setNsn] = useState(existingShadow?.nsn ?? '')
  // The LINs this zone can be a component of — every LIN container except this zone's own shadow.
  const parentLinOptions = useMemo(
    () =>
      store.items
        .filter((i) => isLinContainer(i) && i.id !== existingShadow?.id)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((i) => ({ value: i.id, label: i.lin ? `${i.name} · LIN ${i.lin}` : i.name })),
    [store.items, existingShadow?.id],
  )
  // Authorized component ROLES already under the chosen LIN (distinct nomenclatures). Picking one
  // quick-fills the role and inherits its NSN so this zone counts toward that (LIN + NSN) line.
  const roleOptions = useMemo(() => {
    if (!parentLin || parentLin === '__self__') return [] as { value: string; label: string }[]
    const roles = new Set<string>()
    for (const i of store.items) {
      if (i.parent_item_id === parentLin && i.quantity_authorized != null && i.nomenclature && !i.deleted_at && !i.turned_in_at) {
        roles.add(i.nomenclature)
      }
    }
    return [...roles].sort((a, b) => a.localeCompare(b)).map((r) => ({ value: r, label: r }))
  }, [store.items, parentLin])
  const pickRole = useCallback((r: string) => {
    setRole(r)
    if (!r) return
    const auth = store.items.find(
      (i) => i.parent_item_id === parentLin && i.nomenclature === r && i.quantity_authorized != null && !i.deleted_at && !i.turned_in_at,
    )
    if (auth?.nsn) setNsn(auth.nsn)
  }, [store.items, parentLin])
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

    // Mint / convert / reap this zone's hand-receipt COMPONENT shadow. A zone attaches to the
    // Cluster Hand Receipt as one counted component UNDER a parent LIN (not as its own LIN). The
    // shadow carries represents_location_id = this zone (its identity marker + map/tree pin
    // exclusion) and is a counted component: parent_item_id = the LIN, quantity_authorized 1,
    // quantity 1, located AT the zone so it self-counts present (never a location-less target).
    const syncShadow = async (zoneId: string, zoneName: string) => {
      if (!store.clinicId) return
      const shadow =
        store.items.find((i) => i.represents_location_id === zoneId) ??
        store.items.find((i) => i.location_id === zoneId && isLinContainer(i)) ?? // legacy header
        null
      // Not on the hand receipt → reap any shadow, stranding its authorized BII as loose stock
      // (detach + de-authorize first so removeItem doesn't cascade-delete them).
      if (parentLin === '') {
        if (shadow) {
          for (const comp of store.items.filter((i) => i.parent_item_id === shadow.id)) {
            await store.editItem(comp.id, { parent_item_id: null, quantity_authorized: null })
          }
          await store.removeItem(shadow.id)
        }
        return
      }
      // A legacy header left untouched — grandfather it (no conversion requested).
      if (parentLin === '__self__') return
      // Attach as a component of parentLin. Convert an existing shadow (incl. a legacy header:
      // flatten its BII up to the parent LIN so the box becomes a pure counted leaf), else mint.
      const roleVal = role.trim() || null
      const nsnVal = nsn.trim() || null
      // Don't mint a SECOND authorized line when this role already exists as an authorized
      // component under the LIN — the zone should FILL that component, not duplicate it. An NSN
      // match folds (shared LIN+NSN key), so the shadow rides as physical stock
      // (quantity_authorized null) toward the existing target's on-hand. A brand-new role has no
      // target, so the shadow carries the authorization itself (quantity_authorized 1) and IS the
      // new component line. (No NSN → can't fold reliably → still mint a line rather than vanish.)
      const nsnKey = nsnVal?.toLowerCase()
      const fillsExisting =
        !!nsnKey &&
        store.items.some(
          (i) =>
            i.id !== shadow?.id &&
            i.parent_item_id === parentLin &&
            i.quantity_authorized != null &&
            !i.deleted_at &&
            !i.turned_in_at &&
            (i.nsn ?? '').trim().toLowerCase() === nsnKey,
        )
      const shadowAuthQty = fillsExisting ? null : 1
      if (shadow) {
        for (const comp of store.items.filter((i) => i.parent_item_id === shadow.id)) {
          await store.editItem(comp.id, { parent_item_id: parentLin })
        }
        await store.editItem(shadow.id, {
          name: zoneName,
          nomenclature: roleVal,
          nsn: nsnVal,
          parent_item_id: parentLin,
          quantity_authorized: shadowAuthQty,
          quantity: 1,
          location_id: zoneId,
          represents_location_id: zoneId,
        })
        return
      }
      await store.addItem({
        clinic_id: store.clinicId,
        sub_cluster_id: null,
        name: zoneName,
        nomenclature: roleVal,
        nsn: nsnVal,
        lin: null,
        condition_code: 'serviceable',
        location_id: zoneId,
        current_holder_id: null,
        parent_item_id: parentLin,
        represents_location_id: zoneId,
        expiry_date: null,
        notes: null,
        is_serialized: false,
        item_type: 'DI',
        unit_of_issue: null,
        pack_size: null,
        quantity_authorized: shadowAuthQty,
        serial_number: null,
        quantity: 1,
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
  }, [name, parentId, kind, parentLin, role, nsn, isLevel, photoData, isEdit, editingLocation, pendingTag, store, onClose])

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
        {/* A zone can sign onto the Cluster Hand Receipt as a COMPONENT of a LIN (a vehicle, a
            med case, an aid bag — one counted line under its parent LIN, not its own set). Pick
            the parent LIN, then the component role + NSN. "Not on hand receipt" reaps the shadow. */}
        {!isLevel && (
          <>
            {parentLinOptions.length === 0 && !isLegacyHeader ? (
              <div className="px-4 py-3 text-[11pt] md:text-xs text-tertiary border-b border-primary/6 last:border-b-0">
                Build a LIN in the hand receipt first to sign this zone on as a component.
              </div>
            ) : (
              <PickerInput
                value={parentLin}
                onChange={setParentLin}
                options={[
                  { value: '', label: 'Not on hand receipt' },
                  ...(isLegacyHeader ? [{ value: '__self__', label: 'Its own LIN (legacy — pick a LIN to convert)' }] : []),
                  ...parentLinOptions,
                ]}
                placeholder="Component of LIN (optional)"
                searchable
              />
            )}
            {parentLin && parentLin !== '__self__' && (
              <>
                {roleOptions.length > 0 && (
                  <PickerInput
                    value={roleOptions.some((o) => o.value === role) ? role : ''}
                    onChange={pickRole}
                    options={[{ value: '', label: 'New role…' }, ...roleOptions]}
                    placeholder="Role (authorized component)"
                  />
                )}
                <TextInput value={role} onChange={setRole} placeholder="Role / nomenclature (e.g. Aid Bag)" />
                <TextInput value={nsn} onChange={setNsn} placeholder="NSN (optional)" />
              </>
            )}
          </>
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
            <Paperclip size={16} className="shrink-0 text-tertiary" />
          </button>
        )}
      </div>
    </div>
  )
})
