import { useState, useCallback, useRef, useMemo } from 'react'
import { Camera, Image, X } from 'lucide-react'
import { usePropertyStore } from '../../stores/usePropertyStore'
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

const inputClass = 'w-full px-3 py-2 text-base rounded-lg border border-tertiary/20 bg-themewhite text-primary placeholder:text-tertiary/50 focus:outline-none focus:border-themeblue2 transition-colors'
const labelClass = 'block text-xs font-medium text-secondary mb-1'

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

  // Build sorted location tree for picker (indented by depth)
  const locationOptions = useMemo(() => {
    const result: { id: string; name: string; depth: number }[] = []
    const childrenOf = new Map<string | null, LocalPropertyLocation[]>()
    for (const loc of locations) {
      const key = loc.parent_id ?? null
      if (!childrenOf.has(key)) childrenOf.set(key, [])
      childrenOf.get(key)!.push(loc)
    }
    function walk(parentId: string | null, depth: number) {
      const children = childrenOf.get(parentId) ?? []
      for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
        result.push({ id: child.id, name: child.name, depth })
        walk(child.id, depth + 1)
      }
    }
    walk(null, 0)
    return result
  }, [locations])

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
          {/* Name */}
          <div>
            <label className={labelClass}>Item Name *</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ACOG Sight" autoFocus />
          </div>

          {/* Nomenclature */}
          <div>
            <label className={labelClass}>Nomenclature</label>
            <input className={inputClass} value={nomenclature} onChange={(e) => setNomenclature(e.target.value)} placeholder="Official nomenclature" />
          </div>

          {/* NSN + LIN */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>NSN</label>
              <input className={inputClass} value={nsn} onChange={(e) => setNsn(e.target.value)} placeholder="XXXX-XX-XXX-XXXX" />
            </div>
            <div>
              <label className={labelClass}>LIN</label>
              <input className={inputClass} value={lin} onChange={(e) => setLin(e.target.value)} placeholder="e.g. A12345" />
            </div>
          </div>

          {/* Serial Number */}
          <div>
            <label className={labelClass}>Serial Number</label>
            <input className={inputClass} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="Serial number" />
          </div>

          {/* Quantity */}
          <div>
            <label className={labelClass}>Quantity</label>
            <input className={inputClass} type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>

          {/* Placement — combined location + parent item picker */}
          <div>
            <label className={labelClass}>Location / Parent Item</label>
            <select className={inputClass} value={placement} onChange={(e) => setPlacement(e.target.value)}>
              <option value="">None</option>
              {locationOptions.length > 0 && (
                <optgroup label="Locations">
                  {locationOptions.map((loc) => (
                    <option key={`loc-${loc.id}`} value={`location:${loc.id}`}>
                      {'\u00A0\u00A0'.repeat(loc.depth)}{loc.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {parentItems.length > 0 && (
                <optgroup label="Items">
                  {parentItems
                    .filter((p) => p.id !== editingItem?.id)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((p) => (
                      <option key={`item-${p.id}`} value={`item:${p.id}`}>{p.name}</option>
                    ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Assigned To */}
          <div>
            <label className={labelClass}>Assigned To</label>
            <select className={inputClass} value={holderId} onChange={(e) => setHolderId(e.target.value)}>
              <option value="">Unassigned</option>
              {clinicMembers
                .sort((a, b) => a.displayName.localeCompare(b.displayName))
                .map((m) => (
                  <option key={m.id} value={m.id}>{m.displayName}</option>
                ))}
            </select>
          </div>

          {/* Photo */}
          <div>
            <label className={labelClass}>Photo</label>
            {photoUrl ? (
              <div className="relative">
                <img src={photoUrl} alt="Item" className="w-full max-h-40 object-contain rounded-lg bg-secondary/5" />
                <button
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white"
                  onClick={() => setPhotoUrl(null)}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-tertiary/30 text-sm text-tertiary hover:border-themeblue3/40 hover:text-themeblue3 transition-colors"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera size={16} /> Camera
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-tertiary/30 text-sm text-tertiary hover:border-themeblue3/40 hover:text-themeblue3 transition-colors"
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
            <label className={labelClass}>Notes</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>

          {/* Save */}
          <button
            className="w-full py-3 rounded-lg bg-themeblue3 text-white text-sm font-medium hover:bg-themeblue3/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
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
