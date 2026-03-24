import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Clock, Package, CalendarDays, Camera, Image, X } from 'lucide-react'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { getCategoryMeta } from '../../Types/CalendarTypes'
import type {
  LocalPropertyItem,
  CustodyLedgerEntry,
  PropertyItem,
  LocalPropertyLocation,
  HolderInfo,
} from '../../Types/PropertyTypes'
import { TextInput, PickerInput } from '../FormInputs'

interface PropertyItemDetailProps {
  item: LocalPropertyItem
  holderName?: string
  locationName?: string
  getSubItems: (parentId: string) => Promise<LocalPropertyItem[]>
  getLedger: (itemId: string) => Promise<CustodyLedgerEntry[]>
  onSelectSubItem: (item: LocalPropertyItem) => void
  editing?: boolean
  locations?: LocalPropertyLocation[]
  parentItems?: LocalPropertyItem[]
  clinicMembers?: HolderInfo[]
  onUpdate?: (id: string, updates: Partial<PropertyItem>) => Promise<unknown>
  inlinePickers?: boolean
  saveRequested?: boolean
  onSaveComplete?: () => void
}

const actionLabel: Record<string, string> = {
  sign_down: 'Signed Down',
  sign_up: 'Signed Up',
  lateral: 'Lateral Transfer',
  initial_issue: 'Initial Issue',
  turn_in: 'Turned In',
}

function encodePlacement(item: LocalPropertyItem): string {
  if (item.location_id) return `location:${item.location_id}`
  if (item.parent_item_id) return `item:${item.parent_item_id}`
  return ''
}

function decodePlacement(value: string) {
  if (!value) return { parentItemId: null, locationId: null }
  const [type, id] = value.split(':')
  if (type === 'location') return { parentItemId: null, locationId: id }
  if (type === 'item') return { parentItemId: id, locationId: null }
  return { parentItemId: null, locationId: null }
}

export function PropertyItemDetail({
  item,
  holderName,
  locationName,
  getSubItems,
  getLedger,
  onSelectSubItem,
  editing,
  locations,
  parentItems,
  clinicMembers,
  onUpdate,
  inlinePickers,
  saveRequested,
  onSaveComplete,
}: PropertyItemDetailProps) {
  const [subItems, setSubItems] = useState<LocalPropertyItem[]>([])
  const [ledger, setLedger] = useState<CustodyLedgerEntry[]>([])
  const [showLedger, setShowLedger] = useState(false)

  // Edit state
  const [editName, setEditName] = useState(item.name)
  const [editNomenclature, setEditNomenclature] = useState(item.nomenclature ?? '')
  const [editNsn, setEditNsn] = useState(item.nsn ?? '')
  const [editLin, setEditLin] = useState(item.lin ?? '')
  const [editSerialNumber, setEditSerialNumber] = useState(item.serial_number ?? '')
  const [editQuantity, setEditQuantity] = useState(item.quantity ?? 1)
  const [editPlacement, setEditPlacement] = useState(() => encodePlacement(item))
  const [editHolderId, setEditHolderId] = useState(item.current_holder_id ?? '')
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(item.photo_url ?? null)
  const [editNotes, setEditNotes] = useState(item.notes ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const calendarEvents = useCalendarStore(s => s.events)
  const linkedEvents = useMemo(() =>
    calendarEvents.filter(e => e.property_item_ids?.includes(item.id)),
    [calendarEvents, item.id]
  )

  useEffect(() => {
    getSubItems(item.id).then(setSubItems)
    getLedger(item.id).then(setLedger)
  }, [item.id, getSubItems, getLedger])

  useEffect(() => {
    if (editing) {
      setEditName(item.name)
      setEditNomenclature(item.nomenclature ?? '')
      setEditNsn(item.nsn ?? '')
      setEditLin(item.lin ?? '')
      setEditSerialNumber(item.serial_number ?? '')
      setEditQuantity(item.quantity ?? 1)
      setEditPlacement(encodePlacement(item))
      setEditHolderId(item.current_holder_id ?? '')
      setEditPhotoUrl(item.photo_url ?? null)
      setEditNotes(item.notes ?? '')
    }
  }, [editing, item.id])

  const placementOptions = useMemo(() => {
    if (!locations) return []
    const opts: { value: string; label: string }[] = []
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
    if (parentItems) {
      for (const p of parentItems.filter(p => p.id !== item.id).sort((a, b) => a.name.localeCompare(b.name))) {
        opts.push({ value: `item:${p.id}`, label: p.name })
      }
    }
    return opts
  }, [locations, parentItems, item.id])

  const holderOptions = useMemo(
    () => (clinicMembers ?? []).slice().sort((a, b) => a.displayName.localeCompare(b.displayName)).map(m => ({ value: m.id, label: m.displayName })),
    [clinicMembers]
  )

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { resizeImage } = await import('../../Hooks/useProfileAvatar')
      const resized = await resizeImage(file, 800)
      setEditPhotoUrl(resized)
    } catch { /* silently fail */ }
    e.target.value = ''
  }, [])

  const handleSave = useCallback(async () => {
    if (!editName.trim() || !onUpdate) return
    setIsSaving(true)
    const { parentItemId, locationId } = decodePlacement(editPlacement)
    try {
      await onUpdate(item.id, {
        name: editName.trim(),
        nomenclature: editNomenclature.trim() || null,
        nsn: editNsn.trim() || null,
        lin: editLin.trim() || null,
        serial_number: editSerialNumber.trim() || null,
        quantity: editQuantity,
        parent_item_id: parentItemId,
        location_id: locationId,
        current_holder_id: editHolderId || null,
        photo_url: editPhotoUrl,
        notes: editNotes.trim() || null,
      })
    } catch { /* error handled by service */ }
    finally { setIsSaving(false) }
    onSaveComplete?.()
  }, [editName, editNomenclature, editNsn, editLin, editSerialNumber, editQuantity, editPlacement, editHolderId, editPhotoUrl, editNotes, onUpdate, item.id, onSaveComplete])

  useEffect(() => {
    if (saveRequested) handleSave()
  }, [saveRequested, handleSave])

  return (
    <div className="flex flex-col gap-2 px-6 py-2">
      {/* Header nomenclature — hidden while editing (it moves into the form) */}
      {!editing && item.nomenclature && (
        <p className="text-[10pt] text-secondary">{item.nomenclature}</p>
      )}

      {/* Photo */}
      {editing ? (
        <div>
          <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Photo</span>
          {editPhotoUrl ? (
            <div className="relative mt-1">
              <img src={editPhotoUrl} alt="Item" className="w-full max-h-40 object-contain rounded-lg bg-secondary/5" />
              <button
                className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white active:scale-95 transition-transform"
                onClick={() => setEditPhotoUrl(null)}
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
      ) : item.photo_url ? (
        <img
          src={item.photo_url}
          alt={item.name}
          className="w-full max-h-48 object-contain rounded-lg bg-secondary/5"
        />
      ) : null}

      {/* Fields */}
      <div className="grid grid-cols-2 gap-2">
        {editing ? (
          <>
            <TextInput label="Item Name" required value={editName} onChange={setEditName} placeholder="e.g. ACOG Sight" />
            <TextInput label="Nomenclature" value={editNomenclature} onChange={setEditNomenclature} placeholder="Official nomenclature" />
            <TextInput label="NSN" value={editNsn} onChange={setEditNsn} placeholder="XXXX-XX-XXX-XXXX" />
            <TextInput label="LIN" value={editLin} onChange={setEditLin} placeholder="e.g. A12345" />
            <TextInput label="Serial #" value={editSerialNumber} onChange={setEditSerialNumber} placeholder="Serial number" />
            <TextInput label="Quantity" type="number" value={String(editQuantity)} onChange={(v) => setEditQuantity(Math.max(1, parseInt(v) || 1))} />
          </>
        ) : (
          <>
            <Field label="NSN" value={item.nsn} />
            <Field label="LIN" value={item.lin} />
            <Field label="Serial #" value={item.serial_number} />
            <Field label="Quantity" value={String(item.quantity ?? 1)} />
            <Field label="Location" value={locationName} />
            <Field label="Holder" value={holderName || 'Unassigned'} />
          </>
        )}
      </div>

      {/* Placement + Holder pickers — edit mode only */}
      {editing && (
        <div className="space-y-3">
          <PickerInput
            label="Location / Parent Item"
            value={editPlacement}
            onChange={setEditPlacement}
            options={placementOptions}
            placeholder="Select location"
            inline={inlinePickers}
          />
          <PickerInput
            label="Assigned To"
            value={editHolderId}
            onChange={setEditHolderId}
            options={holderOptions}
            placeholder="Unassigned"
            inline={inlinePickers}
          />
        </div>
      )}

      {/* Notes */}
      {editing ? (
        <div>
          <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Notes</span>
          <textarea
            className="mt-1 w-full px-4 py-2.5 rounded-2xl text-primary text-sm border border-themeblue3/10 shadow-xs bg-themewhite dark:bg-themewhite3 focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none transition-all duration-300 placeholder:text-tertiary/30 resize-none"
            rows={3}
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Additional notes..."
          />
        </div>
      ) : item.notes ? (
        <div>
          <span className="text-xs font-medium text-tertiary">Notes</span>
          <p className="text-[10pt] text-secondary mt-0.5">{item.notes}</p>
        </div>
      ) : null}

      {/* Sub-items — always read-only */}
      {subItems.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-tertiary uppercase tracking-wide mb-1">
            Components ({subItems.length})
          </h3>
          <div className="rounded-lg border border-tertiary/10 overflow-hidden">
            {subItems.map((sub) => (
              <button
                key={sub.id}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-secondary/5 border-b border-tertiary/5 last:border-b-0 active:scale-95 transition-transform"
                onClick={() => onSelectSubItem(sub)}
              >
                <Package size={16} className="text-tertiary shrink-0" />
                <span className="text-[10pt] text-primary truncate flex-1">{sub.name}</span>
                {sub.quantity > 0 && (
                  <span className="text-[10pt] px-2 py-0.5 rounded-full font-medium shrink-0 bg-themeblue3/10 text-themeblue3">
                    {sub.quantity}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Linked Calendar Events — always read-only */}
      {linkedEvents.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-tertiary uppercase tracking-wide mb-1">
            Scheduled Events ({linkedEvents.length})
          </h3>
          <div className="space-y-1.5">
            {linkedEvents.map((evt) => {
              const cat = getCategoryMeta(evt.category)
              const dateStr = new Date(evt.start_time).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric',
              })
              return (
                <div key={evt.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/5">
                  <CalendarDays size={16} className="text-tertiary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary truncate">{evt.title}</p>
                    <p className="text-[10px] text-tertiary">{dateStr}</p>
                  </div>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${cat.color}`} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Custody Ledger — always read-only */}
      <div>
        <button
          className="flex items-center gap-2 text-xs font-medium text-tertiary uppercase tracking-wide mb-1 active:scale-95 transition-transform"
          onClick={() => setShowLedger(!showLedger)}
        >
          <Clock size={16} />
          Custody History ({ledger.length})
        </button>

        {showLedger && ledger.length > 0 && (
          <div className="space-y-1">
            {ledger.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 text-xs p-2 rounded bg-secondary/5">
                <div className="w-1.5 h-1.5 rounded-full bg-themeblue3 mt-1.5 shrink-0" />
                <div>
                  <span className="font-medium text-primary">{actionLabel[entry.action] || entry.action}</span>
                  <span className="text-tertiary ml-1">
                    {new Date(entry.recorded_at).toLocaleDateString()}
                  </span>
                  {entry.notes && <p className="text-secondary mt-0.5">{entry.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Saving overlay — invisible but blocks double-save */}
      {isSaving && <div className="absolute inset-0 pointer-events-auto" />}
    </div>
  )
}

function Field({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-tertiary">{label}</span>
      <p className={`text-sm mt-0.5 ${className || 'text-primary'}`}>{value || '\u2014'}</p>
    </div>
  )
}
