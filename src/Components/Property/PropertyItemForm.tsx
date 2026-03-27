import { useState, useMemo, useCallback } from 'react'
import { X, Check } from 'lucide-react'
import { TextInput, PickerInput } from '../FormInputs'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useShallow } from 'zustand/react/shallow'
import type { LocalPropertyItem } from '../../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'

interface PropertyItemFormProps {
  editingItem?: LocalPropertyItem | null
  onClose: () => void
}

export function PropertyItemForm({ editingItem, onClose }: PropertyItemFormProps) {
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

  const isEdit = !!editingItem

  const [name, setName] = useState(editingItem?.name ?? '')
  const [nomenclature, setNomenclature] = useState(editingItem?.nomenclature ?? '')
  const [nsn, setNsn] = useState(editingItem?.nsn ?? '')
  const [lin, setLin] = useState(editingItem?.lin ?? '')
  const [serialNumber, setSerialNumber] = useState(editingItem?.serial_number ?? '')
  const [quantity, setQuantity] = useState(String(editingItem?.quantity ?? 1))
  const [locationId, setLocationId] = useState(editingItem?.location_id ?? (isEdit ? '' : defaultLocationId ?? ''))
  const [holderId, setHolderId] = useState(editingItem?.current_holder_id ?? '')
  const [parentItemId, setParentItemId] = useState(editingItem?.parent_item_id ?? '')
  const [notes, setNotes] = useState(editingItem?.notes ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const locationOptions = useMemo(
    () =>
      locations
        .filter((l) => l.name !== ROOT_LOCATION_NAME)
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

    try {
      if (isEdit && editingItem) {
        await editItem(editingItem.id, {
          name: name.trim(),
          nomenclature: nomenclature.trim() || null,
          nsn: nsn.trim() || null,
          lin: lin.trim() || null,
          serial_number: serialNumber.trim() || null,
          quantity: Math.max(1, parseInt(quantity) || 1),
          condition_code: 'serviceable',
          location_id: locationId || null,
          current_holder_id: holderId || null,
          parent_item_id: parentItemId || null,
          notes: notes.trim() || null,
        })
      } else {
        await addItem({
          clinic_id: clinicId,
          name: name.trim(),
          nomenclature: nomenclature.trim() || null,
          nsn: nsn.trim() || null,
          lin: lin.trim() || null,
          serial_number: serialNumber.trim() || null,
          quantity: Math.max(1, parseInt(quantity) || 1),
          condition_code: 'serviceable',
          parent_item_id: parentItemId || null,
          location_id: locationId || null,
          current_holder_id: holderId || null,
          location_tag_id: null,
          photo_url: null,
          notes: notes.trim() || null,
        })
      }
      onClose()
    } catch {
      // error handled by service layer
    } finally {
      setIsSaving(false)
    }
  }, [
    name, nomenclature, nsn, lin, serialNumber, quantity,
    locationId, holderId, parentItemId, notes,
    isEdit, editingItem, clinicId, addItem, editItem, onClose,
  ])

  const hasLocations = locationOptions.length > 0
  const hasParentItems = parentItemOptions.length > 0

  return (
    <div className="rounded-xl bg-themewhite2 divide-y divide-tertiary/10">
      {/* Core fields */}
      <div className="px-4 py-3 space-y-3">
        <TextInput value={name} onChange={setName} placeholder="Item name *" required />
        <TextInput value={nomenclature} onChange={setNomenclature} placeholder="Nomenclature" />
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <TextInput value={nsn} onChange={setNsn} placeholder="NSN" />
          </div>
          <div className="flex-1 min-w-0">
            <TextInput value={lin} onChange={setLin} placeholder="LIN" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <TextInput value={serialNumber} onChange={setSerialNumber} placeholder="Serial number" />
          </div>
          <div className="w-24 shrink-0">
            <TextInput type="number" value={quantity} onChange={setQuantity} placeholder="Qty" />
          </div>
        </div>
      </div>

      {/* Assignment fields */}
      {(hasLocations || holderOptions.length > 0 || hasParentItems) && (
        <div className="px-4 py-3 space-y-3">
          {hasLocations && (
            <PickerInput
              label="Location"
              value={locationId}
              onChange={setLocationId}
              options={locationOptions}
              placeholder="Select location"
            />
          )}
          {holderOptions.length > 0 && (
            <PickerInput
              label="Holder"
              value={holderId}
              onChange={setHolderId}
              options={holderOptions}
              placeholder="Unassigned"
            />
          )}
          {hasParentItems && (
            <PickerInput
              label="Parent Item"
              value={parentItemId}
              onChange={setParentItemId}
              options={parentItemOptions}
              placeholder="None (top-level)"
            />
          )}
        </div>
      )}

      {/* Notes */}
      <div className="px-4 py-3">
        <textarea
          className="w-full px-4 py-2.5 rounded-2xl text-primary text-sm border border-themeblue3/10 shadow-xs bg-themewhite dark:bg-themewhite3 focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none transition-all duration-300 placeholder:text-tertiary/30 resize-none"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
        />
      </div>

      {/* Cancel / Save */}
      <div className="flex items-center justify-end gap-1.5 px-4 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
        >
          <X size={18} />
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim() || isSaving}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-40 active:scale-95 transition-all"
        >
          <Check size={18} />
        </button>
      </div>
    </div>
  )
}
