import { useState, useMemo, useCallback } from 'react'
import { X, Check, Square, CheckSquare, Plus } from 'lucide-react'
import { TextInput, PickerInput, DatePickerInput } from '../FormInputs'
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
  const [conditionCode, setConditionCode] = useState<'serviceable' | 'unserviceable' | 'damaged' | 'missing'>(
    editingItem?.condition_code ?? 'serviceable'
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
      condition_code: conditionCode,
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
    isEdit, editingItem, clinicId, addItem, editItem, onClose, conditionCode,
  ])

  const hasLocations = locationOptions.length > 0
  const hasParentItems = parentItemOptions.length > 0
  const filledSerialCount = serialNumbers.filter(s => s.trim()).length

  if (newItemId) {
    return (
      <div className="px-4 py-4">
        <div className="rounded-2xl overflow-hidden">
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
      </div>
    )
  }

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

      <button
        type="button"
        onClick={() => setIsSerialized((v) => !v)}
        className="w-full flex items-center gap-1.5 px-4 py-3 text-[10pt] text-secondary active:scale-95 transition-all border-b border-primary/6"
      >
        {isSerialized ? <CheckSquare size={14} /> : <Square size={14} />}
        Track individually (serialized)
      </button>

      <div className="px-4 py-3 border-b border-primary/6">
        <div className="flex gap-1.5 flex-wrap">
          {(['serviceable', 'unserviceable', 'damaged', 'missing'] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setConditionCode(code)}
              className={[
                'px-3 py-1.5 rounded-full text-[9pt] font-medium capitalize border transition-all active:scale-95',
                conditionCode === code
                  ? 'bg-themeblue3 text-white border-themeblue1/30'
                  : 'bg-themewhite text-secondary border-tertiary/20',
              ].join(' ')}
              title={`Condition: ${code}`}
            >
              {code}
            </button>
          ))}
        </div>
      </div>

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
        <TextInput type="number" value={quantity} onChange={setQuantity} placeholder="Quantity" />
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

      {/* Cancel / Save */}
      <div className="flex items-center justify-end gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
        >
          <X size={16} />
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={`shrink-0 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white overflow-hidden transition-all duration-300 ease-out active:scale-95 disabled:opacity-40 ${name.trim() ? 'w-9 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
        >
          <Check size={16} />
        </button>
      </div>
      </div>
    </div>
  )
}
