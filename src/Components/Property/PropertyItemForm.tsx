import { useState, useCallback, useRef, useMemo } from 'react'
import { Camera, Image, X } from 'lucide-react'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { TextInput, PickerInput } from '../FormInputs'
import type { PropertyItem, LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'

interface PropertyItemFormProps {
  editingItem?: LocalPropertyItem | null
  parentItems: LocalPropertyItem[]
  locations: LocalPropertyLocation[]
  clinicMembers: HolderInfo[]
  onSave: (data: Omit<PropertyItem, 'id' | 'created_at' | 'updated_at'>) => Promise<unknown>
  onUpdate: (id: string, updates: Partial<PropertyItem>) => Promise<unknown>
  onClose: () => void
  clinicId: string
}

/** Placement value encodes type + id, e.g. "location:uuid" or "item:uuid" */
function encodePlacement(item: LocalPropertyItem | null): string {
  if (!item) return ''
  if (item.location_id) return `location:${item.location_id}`
  if (item.parent_item_id) return `item:${item.parent_item_id}`
  return ''
}

function decodePlacement(value: string): { parentItemId: string | null; locationId: string | null } {
  if (!value) return { parentItemId: null, locationId: null }
  const [type, id] = value.split(':')
  if (type === 'location') return { parentItemId: null, locationId: id }
  if (type === 'item') return { parentItemId: id, locationId: null }
  return { parentItemId: null, locationId: null }
}

export function PropertyItemForm({
  editingItem,
  parentItems,
  locations,
  clinicMembers,
  onSave,
  onUpdate,
  onClose,
  clinicId,
}: PropertyItemFormProps) {
  const isEdit = !!editingItem
  const { defaultLocationId } = usePropertyStore()

  const [name, setName] = useState(editingItem?.name ?? '')
  const [nomenclature, setNomenclature] = useState(editingItem?.nomenclature ?? '')
  const [nsn, setNsn] = useState(editingItem?.nsn ?? '')
  const [lin, setLin] = useState(editingItem?.lin ?? '')
  const [serialNumber, setSerialNumber] = useState(editingItem?.serial_number ?? '')
  const [quantity, setQuantity] = useState(editingItem?.quantity ?? 1)
  const [placement, setPlacement] = useState(
    editingItem ? encodePlacement(editingItem) : defaultLocationId ? `location:${defaultLocationId}` : ''
  )
  const [holderId, setHolderId] = useState(editingItem?.current_holder_id ?? '')
  const [photoUrl, setPhotoUrl] = useState<string | null>(editingItem?.photo_url ?? null)
  const [notes, setNotes] = useState(editingItem?.notes ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const placementOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = []

    // Build sorted location tree (indented by depth)
    const childrenOf = new Map<string | null, LocalPropertyLocation[]>()
    for (const loc of locations) {
      const key = loc.parent_id ?? null
      if (!childrenOf.has(key)) childrenOf.set(key, [])
      childrenOf.get(key)!.push(loc)
    }
    function walk(parentId: string | null, depth: number) {
      const children = childrenOf.get(parentId) ?? []
      for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
        opts.push({ value: `location:${child.id}`, label: '\u00A0\u00A0'.repeat(depth) + child.name })
        walk(child.id, depth + 1)
      }
    }
    walk(null, 0)

    // Parent items
    for (const p of parentItems
      .filter((p) => p.id !== editingItem?.id)
      .sort((a, b) => a.name.localeCompare(b.name))
    ) {
      opts.push({ value: `item:${p.id}`, label: p.name })
    }

    return opts
  }, [locations, parentItems, editingItem?.id])

  const holderOptions = useMemo(
    () =>
      clinicMembers
        .slice()
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map((m) => ({ value: m.id, label: m.displayName })),
    [clinicMembers]
  )

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { resizeImage } = await import('../../Hooks/useProfileAvatar')
      const resized = await resizeImage(file, 800)
      setPhotoUrl(resized)
    } catch {
      // silently fail
    }
    e.target.value = ''
  }, [])

  const handleSave = useCallback(async () => {
    if (!name.trim()) return
    setIsSaving(true)

    const { parentItemId, locationId } = decodePlacement(placement)

    try {
      if (isEdit && editingItem) {
        await onUpdate(editingItem.id, {
          name: name.trim(),
          nomenclature: nomenclature.trim() || null,
          nsn: nsn.trim() || null,
          lin: lin.trim() || null,
          serial_number: serialNumber.trim() || null,
          quantity,
          parent_item_id: parentItemId,
          location_id: locationId,
          current_holder_id: holderId || null,
          photo_url: photoUrl,
          notes: notes.trim() || null,
        })
      } else {
        await onSave({
          clinic_id: clinicId,
          name: name.trim(),
          nomenclature: nomenclature.trim() || null,
          nsn: nsn.trim() || null,
          lin: lin.trim() || null,
          serial_number: serialNumber.trim() || null,
          quantity,
          condition_code: 'serviceable',
          parent_item_id: parentItemId,
          location_id: locationId,
          current_holder_id: holderId || null,
          location_tag_id: null,
          photo_url: photoUrl,
          notes: notes.trim() || null,
        })
      }
      onClose()
    } catch {
      // error handled by service
    } finally {
      setIsSaving(false)
    }
  }, [name, nomenclature, nsn, lin, serialNumber, quantity, placement, holderId, photoUrl, notes, isEdit, editingItem, onSave, onUpdate, onClose, clinicId])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 px-4 py-3">
          <TextInput
            label="Item Name"
            required
            value={name}
            onChange={setName}
            placeholder="e.g. ACOG Sight"
          />

          <TextInput
            label="Nomenclature"
            value={nomenclature}
            onChange={setNomenclature}
            placeholder="Official nomenclature"
          />

          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="NSN"
              value={nsn}
              onChange={setNsn}
              placeholder="XXXX-XX-XXX-XXXX"
            />
            <TextInput
              label="LIN"
              value={lin}
              onChange={setLin}
              placeholder="e.g. A12345"
            />
          </div>

          <TextInput
            label="Serial Number"
            value={serialNumber}
            onChange={setSerialNumber}
            placeholder="Serial number"
          />

          <TextInput
            label="Quantity"
            type="number"
            value={String(quantity)}
            onChange={(v) => setQuantity(Math.max(1, parseInt(v) || 1))}
          />

          <PickerInput
            label="Location / Parent Item"
            value={placement}
            onChange={setPlacement}
            options={placementOptions}
            placeholder="Select location"
          />

          <PickerInput
            label="Assigned To"
            value={holderId}
            onChange={setHolderId}
            options={holderOptions}
            placeholder="Unassigned"
          />

          {/* Photo */}
          <div>
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Photo</span>
            {photoUrl ? (
              <div className="relative mt-1">
                <img src={photoUrl} alt="Item" className="w-full max-h-40 object-contain rounded-lg bg-secondary/5" />
                <button
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white active:scale-95 transition-transform"
                  onClick={() => setPhotoUrl(null)}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2 mt-1">
                <button
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-tertiary/30 text-sm text-tertiary hover:border-themeblue3/40 hover:text-themeblue3 transition-colors active:scale-95"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera size={16} /> Camera
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-tertiary/30 text-sm text-tertiary hover:border-themeblue3/40 hover:text-themeblue3 transition-colors active:scale-95"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <Image size={16} /> Gallery
                </button>
              </div>
            )}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} className="hidden" />
            <input ref={galleryInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
          </div>

          {/* Notes */}
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
            className="w-full py-3 rounded-full bg-themeblue3 text-white text-sm font-medium hover:bg-themeblue3/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 mb-4"
            disabled={!name.trim() || isSaving}
            onClick={handleSave}
          >
            {isSaving ? 'Saving...' : isEdit ? 'Update Item' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  )
}
