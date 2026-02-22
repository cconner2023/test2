/**
 * Add/edit form for aid bag inventory items.
 * Wraps BaseDrawer, rendered at App level with desktopPosition="left".
 * Includes barcode scanner and item photo capture.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { ScanLine, Camera, ImagePlus, X } from 'lucide-react'
import { BaseDrawer } from '../BaseDrawer'
import { useAidBagStore } from '../../stores/useAidBagStore'
import { aidBagCategories } from '../../Data/AidBagCategories'
import { useBarcodeScanner } from '../../Hooks/useBarcodeScanner'
import { resizeImage } from '../../Utilities/imageUtils'
import type { AidBagItem, AidBagUnit } from '../../Types/AidBagTypes'
import type { NewAidBagItem } from '../../Hooks/useAidBag'

const UNITS: { value: AidBagUnit; label: string }[] = [
  { value: 'ea', label: 'Each' },
  { value: 'pkg', label: 'Package' },
  { value: 'roll', label: 'Roll' },
  { value: 'pair', label: 'Pair' },
  { value: 'set', label: 'Set' },
  { value: 'tube', label: 'Tube' },
  { value: 'vial', label: 'Vial' },
]

const NSN_PATTERN = /^\d{4}-\d{2}-\d{3}-\d{4}$/

interface AidBagItemFormProps {
  onAdd: (data: NewAidBagItem) => Promise<AidBagItem>
  onUpdate: (id: string, updates: Partial<Omit<AidBagItem, 'id' | 'created_at'>>) => Promise<AidBagItem>
  onDelete: (id: string) => Promise<void>
}

export function AidBagItemForm({ onAdd, onUpdate, onDelete }: AidBagItemFormProps) {
  const isFormOpen = useAidBagStore(s => s.isFormOpen)
  const editingItem = useAidBagStore(s => s.editingItem)
  const closeForm = useAidBagStore(s => s.closeForm)

  const isEditing = editingItem !== null

  // Form fields
  const [name, setName] = useState('')
  const [category, setCategory] = useState(aidBagCategories[0].id)
  const [quantity, setQuantity] = useState('1')
  const [parLevel, setParLevel] = useState('1')
  const [unit, setUnit] = useState<AidBagUnit>('ea')
  const [expirationDate, setExpirationDate] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [nsn, setNsn] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [barcodeData, setBarcodeData] = useState<string | null>(null)
  const [itemPhoto, setItemPhoto] = useState<string | null>(null)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Barcode scanner
  const scanner = useBarcodeScanner()
  const videoRef = useRef<HTMLVideoElement>(null)

  // Photo inputs
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Reset form when editingItem changes
  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name)
      setCategory(editingItem.category)
      setQuantity(String(editingItem.quantity))
      setParLevel(String(editingItem.parLevel))
      setUnit(editingItem.unit)
      setExpirationDate(editingItem.expirationDate || '')
      setLotNumber(editingItem.lotNumber || '')
      setNsn(editingItem.nsn || '')
      setLocation(editingItem.location || '')
      setNotes(editingItem.notes || '')
      setBarcodeData(editingItem.barcodeData ?? null)
      setItemPhoto(editingItem.itemPhoto ?? null)
    } else {
      setName('')
      setCategory(aidBagCategories[0].id)
      setQuantity('1')
      setParLevel('1')
      setUnit('ea')
      setExpirationDate('')
      setLotNumber('')
      setNsn('')
      setLocation('')
      setNotes('')
      setBarcodeData(null)
      setItemPhoto(null)
    }
    setIsScannerOpen(false)
  }, [editingItem])

  // Handle barcode scan result
  useEffect(() => {
    if (scanner.result) {
      setBarcodeData(scanner.result)
      setIsScannerOpen(false)
      // Auto-fill NSN if barcode matches pattern
      if (NSN_PATTERN.test(scanner.result) && !nsn) {
        setNsn(scanner.result)
      }
    }
  }, [scanner.result]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenScanner = useCallback(() => {
    setIsScannerOpen(true)
    scanner.clearResult()
    // Start scanning after video element mounts
    requestAnimationFrame(() => {
      if (videoRef.current) {
        scanner.startScanning(videoRef.current)
      }
    })
  }, [scanner])

  const handleCloseScanner = useCallback(() => {
    setIsScannerOpen(false)
    scanner.stopScanning()
  }, [scanner])

  const handleClearBarcode = useCallback(() => {
    setBarcodeData(null)
    scanner.clearResult()
  }, [scanner])

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const resized = await resizeImage(file, 800)
      setItemPhoto(resized)
    } catch {
      // Silently fail — user can retry
    }
    // Reset input so same file can be re-selected
    e.target.value = ''
  }, [])

  const handleSave = useCallback(async (handleClose: () => void) => {
    if (!name.trim() || isSaving) return
    setIsSaving(true)

    try {
      const data = {
        name: name.trim(),
        category,
        quantity: Math.max(0, parseInt(quantity) || 0),
        parLevel: Math.max(0, parseInt(parLevel) || 0),
        unit,
        expirationDate: expirationDate || null,
        lotNumber: lotNumber.trim() || null,
        nsn: nsn.trim() || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        barcodeData,
        itemPhoto,
      }

      if (isEditing && editingItem) {
        await onUpdate(editingItem.id, data)
      } else {
        await onAdd(data)
      }

      handleClose()
    } catch {
      // Error logged by hook
    } finally {
      setIsSaving(false)
    }
  }, [name, category, quantity, parLevel, unit, expirationDate, lotNumber, nsn, location, notes, barcodeData, itemPhoto, isSaving, isEditing, editingItem, onAdd, onUpdate])

  const handleDelete = useCallback(async (handleClose: () => void) => {
    if (!editingItem || isSaving) return
    setIsSaving(true)
    try {
      await onDelete(editingItem.id)
      handleClose()
    } catch {
      // Error logged by hook
    } finally {
      setIsSaving(false)
    }
  }, [editingItem, isSaving, onDelete])

  const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-tertiary/20 bg-themewhite text-primary placeholder:text-tertiary/50 focus:outline-none focus:border-themeblue3/50 focus:ring-1 focus:ring-themeblue3/20 transition-colors'
  const labelClass = 'block text-xs font-medium text-secondary mb-1'

  return (
    <BaseDrawer
      isVisible={isFormOpen}
      onClose={closeForm}
      desktopPosition="left"
      header={{ title: isEditing ? 'Edit Item' : 'Add Item' }}
    >
      {(handleClose: () => void) => (
        <div className="h-full overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Name */}
            <div>
              <label className={labelClass}>Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. NPA 28Fr, Combat Gauze"
                className={inputClass}
                autoFocus
              />
            </div>

            {/* Barcode Scanner */}
            <div>
              <label className={labelClass}>Barcode</label>
              {barcodeData ? (
                <div className="flex items-center gap-2">
                  <span className="flex-1 px-3 py-1.5 text-xs font-mono bg-themewhite2 rounded-lg border border-tertiary/15 truncate">
                    {barcodeData}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearBarcode}
                    className="p-1 rounded-full hover:bg-themewhite2 text-tertiary"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : isScannerOpen ? (
                <div className="space-y-2">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute inset-4 border-2 border-white/30 rounded-lg" />
                      <div className="absolute inset-x-4 top-1/2 h-0.5 bg-themeblue2 animate-pulse" />
                      <ScanLine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 text-white/50" />
                    </div>
                    {scanner.isScanning && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                        Scanning...
                      </div>
                    )}
                  </div>
                  {scanner.error && (
                    <p className="text-xs text-red-500">{scanner.error}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleCloseScanner}
                    className="text-xs text-tertiary hover:text-primary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenScanner}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-tertiary/20 text-secondary hover:bg-themewhite2 transition-colors"
                >
                  <ScanLine size={14} />
                  Scan
                </button>
              )}
            </div>

            {/* Item Photo */}
            <div>
              <label className={labelClass}>Photo</label>
              <div className="flex items-center gap-3">
                {itemPhoto && (
                  <div className="relative shrink-0">
                    <img
                      src={itemPhoto}
                      alt="Item"
                      className="w-16 h-16 rounded-lg object-cover border border-tertiary/15"
                    />
                    <button
                      type="button"
                      onClick={() => setItemPhoto(null)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-tertiary/20 text-secondary hover:bg-themewhite2 transition-colors"
                  >
                    <Camera size={14} />
                    Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-tertiary/20 text-secondary hover:bg-themewhite2 transition-colors"
                  >
                    <ImagePlus size={14} />
                    Choose
                  </button>
                </div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className={labelClass}>Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className={inputClass}
              >
                {aidBagCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity + Par Level + Unit (inline row) */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  min="0"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Par Level</label>
                <input
                  type="number"
                  value={parLevel}
                  onChange={e => setParLevel(e.target.value)}
                  min="0"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Unit</label>
                <select
                  value={unit}
                  onChange={e => setUnit(e.target.value as AidBagUnit)}
                  className={inputClass}
                >
                  {UNITS.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Expiration Date */}
            <div>
              <label className={labelClass}>Expiration Date</label>
              <input
                type="date"
                value={expirationDate}
                onChange={e => setExpirationDate(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Lot Number + NSN (inline row) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Lot Number</label>
                <input
                  type="text"
                  value={lotNumber}
                  onChange={e => setLotNumber(e.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>NSN</label>
                <input
                  type="text"
                  value={nsn}
                  onChange={e => setNsn(e.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className={labelClass}>Location</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Left pouch, Main compartment"
                className={inputClass}
              />
            </div>

            {/* Notes */}
            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes"
                rows={2}
                className={inputClass + ' resize-none'}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 pb-4">
              <button
                onClick={() => handleSave(handleClose)}
                disabled={!name.trim() || isSaving}
                className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-themeblue3 text-white hover:bg-themeblue2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Add Item'}
              </button>

              {isEditing && (
                <button
                  onClick={() => handleDelete(handleClose)}
                  disabled={isSaving}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </BaseDrawer>
  )
}
