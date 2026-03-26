import { useState, useMemo, useCallback } from 'react'
import { TextInput, SelectInput, PickerInput } from '../FormInputs'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useShallow } from 'zustand/react/shallow'
import type { LocalPropertyItem } from '../../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'

interface PropertyItemFormProps {
  editingItem?: LocalPropertyItem | null
  onClose: () => void
}

const CONDITION_OPTIONS = [
  { value: 'serviceable', label: 'Serviceable' },
  { value: 'unserviceable', label: 'Unserviceable' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'missing', label: 'Missing' },
]

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
  const [condition, setCondition] = useState(editingItem?.condition_code ?? 'serviceable')
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
          condition_code: condition,
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
          condition_code: condition,
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
    name, nomenclature, nsn, lin, serialNumber, quantity, condition,
    locationId, holderId, parentItemId, notes,
    isEdit, editingItem, clinicId, addItem, editItem, onClose,
  ])

  return (
    <div className="flex flex-col gap-4 p-4">
      <TextInput label="Name" required value={name} onChange={setName} placeholder="e.g. ACOG Sight" />
      <TextInput label="Nomenclature" value={nomenclature} onChange={setNomenclature} placeholder="Official nomenclature" />
      <TextInput label="NSN" value={nsn} onChange={setNsn} placeholder="XXXX-XX-XXX-XXXX" />
      <TextInput label="LIN" value={lin} onChange={setLin} placeholder="e.g. A12345" />
      <TextInput label="Serial Number" value={serialNumber} onChange={setSerialNumber} placeholder="Serial number" />
      <TextInput label="Quantity" type="number" value={quantity} onChange={setQuantity} />

      <SelectInput
        label="Condition"
        value={condition}
        onChange={setCondition}
        options={CONDITION_OPTIONS}
      />

      <PickerInput
        label="Location"
        value={locationId}
        onChange={setLocationId}
        options={locationOptions}
        placeholder="Select location"
      />

      <PickerInput
        label="Holder"
        value={holderId}
        onChange={setHolderId}
        options={holderOptions}
        placeholder="Unassigned"
      />

      <PickerInput
        label="Parent Item"
        value={parentItemId}
        onChange={setParentItemId}
        options={parentItemOptions}
        placeholder="None (top-level)"
      />

      <div>
        <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Notes</span>
        <textarea
          className="mt-1 w-full px-4 py-2.5 rounded-2xl text-primary text-sm border border-themeblue3/10 shadow-xs bg-themewhite dark:bg-themewhite3 focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none transition-all duration-300 placeholder:text-tertiary/30 resize-none"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes..."
        />
      </div>

      <button
        className="w-full py-3 rounded-full bg-themeblue3 text-white text-sm font-medium active:scale-95 transition-all disabled:opacity-50"
        disabled={!name.trim() || isSaving}
        onClick={handleSave}
      >
        {isSaving ? 'Saving...' : isEdit ? 'Update Item' : 'Add Item'}
      </button>

      <button
        className="w-full py-2 text-sm text-tertiary active:scale-95 transition-all"
        onClick={onClose}
      >
        Cancel
      </button>
    </div>
  )
}
