import { useState, useMemo, useCallback } from 'react'
import { X, Check, Square, CheckSquare, Plus } from 'lucide-react'
import { TextInput, PickerInput } from '../FormInputs'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useShallow } from 'zustand/react/shallow'
import type { LocalPropertyItem } from '../../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'
import { EnrollScanStep } from './EnrollScanStep'

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
    enrollFingerprint,
  } = usePropertyStore(
    useShallow((s) => ({
      locations: s.locations,
      clinicMembers: s.clinicMembers,
      items: s.items,
      clinicId: s.clinicId,
      defaultLocationId: s.defaultLocationId,
      addItem: s.addItem,
      editItem: s.editItem,
      enrollFingerprint: s.enrollFingerprint,
    }))
  )

  const isEdit = !!editingItem

  const [name, setName] = useState(editingItem?.name ?? '')
  const [nomenclature, setNomenclature] = useState(editingItem?.nomenclature ?? '')
  const [nsn, setNsn] = useState(editingItem?.nsn ?? '')
  const [lin, setLin] = useState(editingItem?.lin ?? '')
  // Serialized: one entry per physical item. Starts with one empty row (single-item path = today's behavior).
  const [serialNumbers, setSerialNumbers] = useState<string[]>(
    editingItem ? [editingItem.serial_number ?? ''] : ['']
  )
  const [quantity, setQuantity] = useState(String(editingItem?.quantity ?? 1))
  const [locationId, setLocationId] = useState(editingItem?.location_id ?? (isEdit ? '' : defaultLocationId ?? ''))
  const [holderId, setHolderId] = useState(editingItem?.current_holder_id ?? '')
  const [parentItemId, setParentItemId] = useState(editingItem?.parent_item_id ?? '')
  const [notes, setNotes] = useState(editingItem?.notes ?? '')
  const [expiryDate, setExpiryDate] = useState(editingItem?.expiry_date ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isSerialized, setIsSerialized] = useState(editingItem?.is_serialized ?? true)
  const [newItemId, setNewItemId] = useState<string | null>(null)

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

    const sharedPayload = {
      name: name.trim(),
      nomenclature: nomenclature.trim() || null,
      nsn: nsn.trim() || null,
      lin: lin.trim() || null,
      condition_code: 'serviceable' as const,
      location_id: locationId || null,
      current_holder_id: holderId || null,
      parent_item_id: parentItemId || null,
      expiry_date: expiryDate || null,
      notes: notes.trim() || null,
      is_serialized: isSerialized,
    }

    try {
      if (isEdit && editingItem) {
        await editItem(editingItem.id, {
          ...sharedPayload,
          serial_number: isSerialized ? (serialNumbers[0]?.trim() || null) : null,
          quantity: isSerialized ? 1 : Math.max(1, parseInt(quantity) || 1),
        })
        onClose()
      } else if (!isSerialized) {
        const created = await addItem({
          clinic_id: clinicId,
          ...sharedPayload,
          serial_number: null,
          quantity: Math.max(1, parseInt(quantity) || 1),
          location_tag_id: null,
          photo_url: null,
          visual_fingerprint: null,
        })
        if (created) setNewItemId(created.id)
        else onClose()
      } else {
        const validSerials = serialNumbers.map(s => s.trim()).filter(Boolean)

        if (validSerials.length <= 1) {
          // Single item — preserve enrollment flow
          const created = await addItem({
            clinic_id: clinicId,
            ...sharedPayload,
            serial_number: validSerials[0] ?? null,
            quantity: 1,
            location_tag_id: null,
            photo_url: null,
            visual_fingerprint: null,
          })
          if (created) setNewItemId(created.id)
          else onClose()
        } else {
          // Batch — create one item per serial, skip enrollment
          for (const serial of validSerials) {
            await addItem({
              clinic_id: clinicId,
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
    isEdit, editingItem, clinicId, addItem, editItem, onClose,
  ])

  const hasLocations = locationOptions.length > 0
  const hasParentItems = parentItemOptions.length > 0
  const filledSerialCount = serialNumbers.filter(s => s.trim()).length

  if (newItemId) {
    return (
      <div className="rounded-xl bg-themewhite2">
        <EnrollScanStep
          itemId={newItemId}
          itemName={name.trim()}
          onEnrolled={async (fp) => {
            await enrollFingerprint(newItemId, fp)
            onClose()
          }}
          onSkip={onClose}
        />
      </div>
    )
  }

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

        <button
          type="button"
          onClick={() => setIsSerialized((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-secondary active:scale-95 transition-all"
        >
          {isSerialized ? <CheckSquare size={14} /> : <Square size={14} />}
          Track individually (serialized)
        </button>

        {isSerialized ? (
          <div className="space-y-1.5">
            {serialNumbers.map((sn, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <div className="flex-1 min-w-0">
                  <TextInput
                    value={sn}
                    onChange={(v) => updateSerial(idx, v)}
                    placeholder={serialNumbers.length > 1 ? `Serial ${idx + 1}` : 'Serial number'}
                  />
                </div>
                {!isEdit && idx === serialNumbers.length - 1 ? (
                  <button
                    type="button"
                    onClick={addSerial}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-themeblue3 text-white active:scale-95 transition-all"
                  >
                    <Plus size={14} />
                  </button>
                ) : serialNumbers.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeSerial(idx)}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-tertiary/40 hover:text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                  >
                    <X size={13} />
                  </button>
                ) : null}
              </div>
            ))}
            {filledSerialCount > 1 && (
              <p className="text-[10px] text-tertiary/50 pl-0.5">
                {filledSerialCount} items will be created
              </p>
            )}
          </div>
        ) : (
          <div className="w-24">
            <TextInput type="number" value={quantity} onChange={setQuantity} placeholder="Qty" />
          </div>
        )}
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

      {/* Expiry date */}
      <div className="px-4 py-3 flex items-center gap-3">
        <label className="text-xs text-tertiary/60 shrink-0 w-20">Expiry date</label>
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="flex-1 min-w-0 px-4 py-2.5 rounded-2xl text-primary text-sm border border-themeblue3/10 shadow-xs bg-themewhite dark:bg-themewhite3 focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none transition-all duration-300"
        />
        {expiryDate && (
          <button
            type="button"
            onClick={() => setExpiryDate('')}
            className="shrink-0 text-tertiary/40 hover:text-tertiary active:scale-95 transition-all"
          >
            <X size={14} />
          </button>
        )}
      </div>

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
