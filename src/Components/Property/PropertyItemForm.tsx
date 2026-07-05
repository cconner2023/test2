import { useState, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { X, Square, CheckSquare, Plus } from 'lucide-react'
import { TextInput, PickerInput, DatePickerInput } from '../FormInputs'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useSubClusters } from '../../Hooks/useSubClusters'
import { useShallow } from 'zustand/react/shallow'
import type { LocalPropertyItem, ItemType, UnitOfIssue } from '../../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'

const ITEM_TYPE_OPTIONS: { value: ItemType; label: string }[] = [
  { value: 'CI', label: 'Consumable' },
  { value: 'DI', label: 'Durable' },
  { value: 'SI', label: 'Sensitive' },
]
const UNIT_OF_ISSUE_OPTIONS: { value: UnitOfIssue; label: string }[] = [
  { value: 'EA', label: 'EA — each' },
  { value: 'SET', label: 'SET' },
  { value: 'PR', label: 'PR — pair' },
  { value: 'BOT', label: 'BOT — bottle' },
  { value: 'PK', label: 'PK — pack' },
  { value: 'TUB', label: 'TUB — tube' },
]

interface PropertyItemFormProps {
  editingItem?: LocalPropertyItem | null
  onClose: () => void
  /** Called after a brand-new item is created so the host can present the
   *  visual-ID enroll step as a modal (shared with the detail-menu enroll). */
  onEnrollNew?: (item: LocalPropertyItem) => void
  /** Reports save-in-flight so the host surface can gate with the HUD loader. */
  onSavingChange?: (saving: boolean) => void
  /** Authorized/BOM context (opened from PropertyAuthorizedPanel): surfaces the
   *  Authorized-qty field and defaults new lines to fungible (non-serialized). An
   *  item already authorization-tracked shows the field regardless. */
  showAuthorized?: boolean
  /** Pre-parent a new line under an SKO (the authorized panel's per-group add). */
  initialParentId?: string | null
}

export interface PropertyItemFormHandle {
  /** Validate + persist. Drives the host header's Save action (calendar EventForm pattern). */
  submit: () => void
}

export const PropertyItemForm = forwardRef<PropertyItemFormHandle, PropertyItemFormProps>(
  function PropertyItemForm({ editingItem, onClose, onEnrollNew, onSavingChange, showAuthorized, initialParentId }, ref) {
  const {
    locations,
    clinicMembers,
    items,
    clinicId,
    defaultLocationId,
    addItem,
    editItem,
  } = usePropertyStore(
    useShallow((s) => ({
      locations: s.locations,
      clinicMembers: s.clinicMembers,
      items: s.items,
      clinicId: s.clinicId,
      defaultLocationId: s.defaultLocationId,
      addItem: s.addItem,
      editItem: s.editItem,
    }))
  )

  // Author's sub-cluster (platoon/squad) — new items default into this squad's
  // lens. HQ authors (null) → common/HQ item. Render-only; see v2/supervisor.
  const authorSubClusterId = useAuthStore(s => s.profile.subClusterId ?? null)
  // Sub-clusters are primary-clinic-scoped; only offer the picker when the
  // property panel is on the user's primary clinic.
  const primaryClinicId = useAuthStore(s => s.clinicId)
  const { subClusters } = useSubClusters()
  const sectionApplicable = clinicId === primaryClinicId && subClusters.length > 0

  const isEdit = !!editingItem

  const [name, setName] = useState(editingItem?.name ?? '')
  const [nomenclature, setNomenclature] = useState(editingItem?.nomenclature ?? '')
  const [nsn, setNsn] = useState(editingItem?.nsn ?? '')
  const [lin, setLin] = useState(editingItem?.lin ?? '')
  // Serialized: one entry per physical item. Starts with one empty row (single-item path = today's behavior).
  const [serialNumbers, setSerialNumbers] = useState<string[]>(
    editingItem ? [editingItem.serial_number ?? ''] : ['']
  )
  // Authorized/BOM lines default to on-hand 0 — a BOM records what you SHOULD have, and
  // you often haven't received it yet. Normal new items default to 1. An edit keeps its own.
  const [quantity, setQuantity] = useState(String(editingItem?.quantity ?? (showAuthorized ? 0 : 1)))
  const [locationId, setLocationId] = useState(editingItem?.location_id ?? (isEdit ? '' : defaultLocationId ?? ''))
  const [holderId, setHolderId] = useState(editingItem?.current_holder_id ?? '')
  const [parentItemId, setParentItemId] = useState(editingItem?.parent_item_id ?? initialParentId ?? '')
  const [notes, setNotes] = useState(editingItem?.notes ?? '')
  const [expiryDate, setExpiryDate] = useState(editingItem?.expiry_date ?? '')
  const [isSaving, setIsSaving] = useState(false)
  // Authorized/BOM lines are fungible by default (unit/pack + auth qty apply); normal
  // new items default to serialized. An edit always preserves the item's own flag.
  const [isSerialized, setIsSerialized] = useState(editingItem?.is_serialized ?? (showAuthorized ? false : true))
  // Authorized (BOM) quantity — issue-unit value, converts to base via pack_size. Shown
  // only in authorized context or when the item is already authorization-tracked.
  const authActive = !!showAuthorized || editingItem?.quantity_authorized != null
  const [quantityAuthorized, setQuantityAuthorized] = useState(
    editingItem?.quantity_authorized != null ? String(editingItem.quantity_authorized) : ''
  )
  // Accountability class. New items default DI. SI forces serialized (see effect below).
  const [itemType, setItemType] = useState<ItemType>(editingItem?.item_type ?? 'DI')
  // Unit of issue + base-per-issue pack size — fungible (non-serialized) lines only.
  const [unitOfIssue, setUnitOfIssue] = useState<string>(editingItem?.unit_of_issue ?? '')
  const [packSize, setPackSize] = useState(editingItem?.pack_size != null ? String(editingItem.pack_size) : '')
  // SI is serialized by definition — selecting it locks the individual-tracking flag on.
  useEffect(() => { if (itemType === 'SI') setIsSerialized(true) }, [itemType])
  // Health/serviceability is expressed by PMCS faults now (no manual chips). The
  // value still round-trips: 'serviceable' default on create, and an edit preserves
  // whatever's there (e.g. 'missing' set by the transfer accountability check).
  const [conditionCode] = useState<'serviceable' | 'unserviceable' | 'damaged' | 'missing'>(
    editingItem?.condition_code ?? 'serviceable'
  )
  // Sub-unit (platoon/squad) section. '' = HQ / common. New items default to the
  // author's squad; edits preserve the item's current section. Render-only.
  const [sectionId, setSectionId] = useState(
    isEdit ? (editingItem?.sub_cluster_id ?? '') : (authorSubClusterId ?? '')
  )

  const updateSerial = useCallback((idx: number, value: string) => {
    setSerialNumbers(prev => {
      const next = [...prev]
      next[idx] = value
      return next
    })
  }, [])

  const addSerial = useCallback(() => {
    setSerialNumbers(prev => [...prev, ''])
  }, [])

  const removeSerial = useCallback((idx: number) => {
    setSerialNumbers(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const locationOptions = useMemo(
    () =>
      locations
        .filter((l) => l.name !== ROOT_LOCATION_NAME && !l.is_turn_in_zone)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((l) => ({ value: l.id, label: l.name })),
    [locations]
  )

  const holderOptions = useMemo(
    () =>
      clinicMembers
        .slice()
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map((m) => ({ value: m.id, label: m.displayName })),
    [clinicMembers]
  )

  const parentItemOptions = useMemo(
    () =>
      items
        .filter((i) => i.id !== editingItem?.id)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((i) => ({ value: i.id, label: i.name })),
    [items, editingItem?.id]
  )

  const handleSave = useCallback(async () => {
    if (!name.trim() || !clinicId) return
    setIsSaving(true)

    // Authorized (BOM) context allows on-hand 0 — an authorized-but-unreceived line is a
    // real state (surfaces DEPLETED + feeds the shortage fold). Elsewhere on-hand floors at 1.
    const minQuantity = authActive ? 0 : 1

    const sharedPayload = {
      name: name.trim(),
      nomenclature: nomenclature.trim() || null,
      nsn: nsn.trim() || null,
      lin: lin.trim() || null,
      condition_code: conditionCode,
      location_id: locationId || null,
      current_holder_id: holderId || null,
      parent_item_id: parentItemId || null,
      expiry_date: expiryDate || null,
      notes: notes.trim() || null,
      is_serialized: isSerialized,
      item_type: itemType,
      // Unit/pack describe fungible issue lines; a serialized item is 1:1 (unit irrelevant).
      unit_of_issue: isSerialized ? null : ((unitOfIssue || null) as UnitOfIssue | null),
      pack_size: isSerialized ? null : (packSize.trim() ? Math.max(1, parseInt(packSize) || 1) : null),
      // Only write quantity_authorized in authorized context — a normal edit must never
      // clear an item's BOM authorization by omission.
      ...(authActive
        ? { quantity_authorized: quantityAuthorized.trim() ? Math.max(0, parseInt(quantityAuthorized) || 0) : null }
        : {}),
    }

    try {
      if (isEdit && editingItem) {
        await editItem(editingItem.id, {
          ...sharedPayload,
          sub_cluster_id: sectionApplicable ? (sectionId || null) : (editingItem.sub_cluster_id ?? null),
          serial_number: isSerialized ? (serialNumbers[0]?.trim() || null) : null,
          quantity: isSerialized ? 1 : Math.max(minQuantity, parseInt(quantity) || 0),
        })
        onClose()
      } else if (!isSerialized) {
        const created = await addItem({
          clinic_id: clinicId,
          sub_cluster_id: sectionApplicable ? (sectionId || null) : null,
          ...sharedPayload,
          serial_number: null,
          quantity: Math.max(minQuantity, parseInt(quantity) || 0),
          location_tag_id: null,
          photo_url: null,
          visual_fingerprint: null,
        })
        if (created) onEnrollNew?.(created)
        onClose()
      } else {
        const validSerials = serialNumbers.map(s => s.trim()).filter(Boolean)

        if (validSerials.length <= 1) {
          // Single item — preserve enrollment flow
          const created = await addItem({
            clinic_id: clinicId,
            sub_cluster_id: sectionApplicable ? (sectionId || null) : null,
            ...sharedPayload,
            serial_number: validSerials[0] ?? null,
            quantity: 1,
            location_tag_id: null,
            photo_url: null,
            visual_fingerprint: null,
          })
          if (created) onEnrollNew?.(created)
          onClose()
        } else {
          // Batch — create one item per serial, skip enrollment
          for (const serial of validSerials) {
            await addItem({
              clinic_id: clinicId,
              sub_cluster_id: sectionApplicable ? (sectionId || null) : null,
              ...sharedPayload,
              serial_number: serial,
              quantity: 1,
              location_tag_id: null,
              photo_url: null,
              visual_fingerprint: null,
            })
          }
          onClose()
        }
      }
    } catch {
      // error handled by service layer
    } finally {
      setIsSaving(false)
    }
  }, [
    name, nomenclature, nsn, lin, serialNumbers, quantity,
    locationId, holderId, parentItemId, notes, expiryDate, isSerialized,
    itemType, unitOfIssue, packSize, authActive, quantityAuthorized,
    isEdit, editingItem, clinicId, addItem, editItem, onClose, onEnrollNew, conditionCode,
    sectionId, sectionApplicable,
  ])

  useImperativeHandle(ref, () => ({ submit: handleSave }), [handleSave])

  useEffect(() => { onSavingChange?.(isSaving) }, [isSaving, onSavingChange])
  // Save success calls onClose() (unmount) before the finally resets isSaving, so
  // clear the host's HUD flag on unmount to avoid a stuck loader.
  useEffect(() => () => onSavingChange?.(false), [onSavingChange])

  const hasLocations = locationOptions.length > 0
  const hasParentItems = parentItemOptions.length > 0
  const filledSerialCount = serialNumbers.filter(s => s.trim()).length

  return (
    <div className="px-4 py-4">
      <div className="rounded-2xl overflow-hidden">
      <TextInput value={name} onChange={setName} placeholder="Item name *" required />
      <TextInput value={nomenclature} onChange={setNomenclature} placeholder="Nomenclature" />
      <div className="flex items-stretch border-b border-primary/6">
        <div className="flex-1 min-w-0">
          <TextInput value={nsn} onChange={setNsn} placeholder="NSN" />
        </div>
        <div className="flex-1 min-w-0 border-l border-primary/6">
          <TextInput value={lin} onChange={setLin} placeholder="LIN" />
        </div>
      </div>

      {authActive && (
        <TextInput
          type="number"
          inputMode="numeric"
          value={quantityAuthorized}
          onChange={setQuantityAuthorized}
          placeholder="Authorized qty (BOM)"
        />
      )}

      {/* Accountability class — true segmented selector (CI/DI/SI). SI locks serialized on. */}
      <div className="flex items-stretch border-b border-primary/6">
        {ITEM_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setItemType(opt.value)}
            className={`flex-1 min-w-0 px-2 py-3 text-[10pt] transition-all active:scale-95 border-l first:border-l-0 border-primary/6 ${
              itemType === opt.value ? 'bg-themeblue3 text-white' : 'text-secondary'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => itemType !== 'SI' && setIsSerialized((v) => !v)}
        className="w-full flex items-center gap-1.5 px-4 py-3 text-[10pt] text-secondary active:scale-95 transition-all border-b border-primary/6"
      >
        {isSerialized ? <CheckSquare size={14} /> : <Square size={14} />}
        Track individually (serialized)
      </button>


      {isSerialized ? (
        <div>
          {serialNumbers.map((sn, idx) => {
            const isLast = idx === serialNumbers.length - 1
            return (
              <div key={idx} className="flex items-center border-b border-primary/6 last:border-b-0">
                <div className="flex-1 min-w-0">
                  <TextInput
                    value={sn}
                    onChange={(v) => updateSerial(idx, v)}
                    placeholder={serialNumbers.length > 1 ? `Serial ${idx + 1}` : 'Serial number'}
                  />
                </div>
                {!isEdit && isLast ? (
                  <button
                    type="button"
                    onClick={addSerial}
                    className="shrink-0 w-8 h-8 mr-2 flex items-center justify-center rounded-full bg-themeblue3 text-white active:scale-95 transition-all"
                  >
                    <Plus size={14} />
                  </button>
                ) : serialNumbers.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeSerial(idx)}
                    className="shrink-0 w-8 h-8 mr-2 flex items-center justify-center rounded-full text-tertiary hover:text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                  >
                    <X size={13} />
                  </button>
                ) : null}
              </div>
            )
          })}
          {filledSerialCount > 1 && (
            <p className="px-4 py-2 text-[9pt] text-tertiary border-b border-primary/6">
              {filledSerialCount} items will be created
            </p>
          )}
        </div>
      ) : (
        <>
          <TextInput type="number" value={quantity} onChange={setQuantity} placeholder="Quantity" />
          <div className="flex items-stretch border-b border-primary/6">
            <div className="flex-1 min-w-0">
              <PickerInput
                value={unitOfIssue}
                onChange={setUnitOfIssue}
                options={[{ value: '', label: 'Unit of issue (EA)' }, ...UNIT_OF_ISSUE_OPTIONS]}
                placeholder="Unit of issue (EA)"
              />
            </div>
            <div className="flex-1 min-w-0 border-l border-primary/6">
              <TextInput type="number" value={packSize} onChange={setPackSize} placeholder="Per issue (e.g. PR = 2)" />
            </div>
          </div>
        </>
      )}

      {hasLocations && (
        <PickerInput
          value={locationId}
          onChange={setLocationId}
          options={locationOptions}
          placeholder="Location"
        />
      )}
      {holderOptions.length > 0 && (
        <PickerInput
          value={holderId}
          onChange={setHolderId}
          options={holderOptions}
          placeholder="Holder (unassigned)"
        />
      )}
      {hasParentItems && (
        <PickerInput
          value={parentItemId}
          onChange={setParentItemId}
          options={parentItemOptions}
          placeholder="Parent item (top-level)"
        />
      )}
      {/* Sub-unit (platoon/squad) section — '' = HQ / common. Primary-clinic-scoped. */}
      {sectionApplicable && (
        <PickerInput
          value={sectionId}
          onChange={setSectionId}
          options={[{ value: '', label: 'HQ / Common' }, ...subClusters.map(s => ({ value: s.id, label: s.name }))]}
          placeholder="Sub-unit"
        />
      )}

      <div className="flex items-center border-b border-primary/6">
        <div className="flex-1 min-w-0">
          <DatePickerInput
            value={expiryDate}
            onChange={setExpiryDate}
            placeholder="Expiry date"
          />
        </div>
        {expiryDate && (
          <button
            type="button"
            onClick={() => setExpiryDate('')}
            className="shrink-0 w-8 h-8 mr-2 flex items-center justify-center rounded-full text-tertiary hover:text-tertiary active:scale-95 transition-all"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <label className="block border-b border-primary/6">
        <textarea
          className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
        />
      </label>
      </div>
    </div>
  )
})
