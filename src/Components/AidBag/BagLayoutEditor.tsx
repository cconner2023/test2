/**
 * Drawer editor for bag layout photos with positioned equipment labels.
 * Flow: capture/pick photo → name layout → add/drag labels → save.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Camera, ImagePlus, Plus, Trash2 } from 'lucide-react'
import { BaseDrawer } from '../BaseDrawer'
import { BagLayoutPhoto } from './BagLayoutPhoto'
import { useAidBagStore } from '../../stores/useAidBagStore'
import { resizeImage, getImageDimensions } from '../../Utilities/imageUtils'
import type { AidBagItem } from '../../Types/AidBagTypes'
import type { BagLayout, BagLabel } from '../../Types/BagLayoutTypes'

interface BagLayoutEditorProps {
  items: AidBagItem[]
  onSave: (data: Omit<BagLayout, 'id' | 'created_at' | 'updated_at'>) => Promise<BagLayout>
  onUpdate: (id: string, updates: Partial<Omit<BagLayout, 'id' | 'created_at'>>) => Promise<BagLayout>
  onDelete: (id: string) => Promise<void>
  onLabelTap?: (label: BagLabel) => void
}

export function BagLayoutEditor({ items, onSave, onUpdate, onDelete, onLabelTap }: BagLayoutEditorProps) {
  const isOpen = useAidBagStore(s => s.isLayoutEditorOpen)
  const editingLayout = useAidBagStore(s => s.editingLayout)
  const closeEditor = useAidBagStore(s => s.closeLayoutEditor)

  const isEditing = editingLayout !== null

  const [name, setName] = useState('')
  const [photoData, setPhotoData] = useState<string | null>(null)
  const [photoWidth, setPhotoWidth] = useState(0)
  const [photoHeight, setPhotoHeight] = useState(0)
  const [labels, setLabels] = useState<BagLabel[]>([])
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Reset form when editing layout changes
  useEffect(() => {
    if (editingLayout) {
      setName(editingLayout.name)
      setPhotoData(editingLayout.photoData)
      setPhotoWidth(editingLayout.photoWidth)
      setPhotoHeight(editingLayout.photoHeight)
      setLabels(editingLayout.labels)
    } else {
      setName('')
      setPhotoData(null)
      setPhotoWidth(0)
      setPhotoHeight(0)
      setLabels([])
    }
    setShowItemPicker(false)
  }, [editingLayout])

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const resized = await resizeImage(file, 1200)
      const dims = await getImageDimensions(resized)
      setPhotoData(resized)
      setPhotoWidth(dims.width)
      setPhotoHeight(dims.height)
    } catch {
      // User can retry
    }
    e.target.value = ''
  }, [])

  const handleAddLabel = useCallback((item: AidBagItem) => {
    const label: BagLabel = {
      id: crypto.randomUUID(),
      itemId: item.id,
      text: item.name,
      x: 0.5,
      y: 0.5,
    }
    setLabels(prev => [...prev, label])
    setShowItemPicker(false)
  }, [])

  const handleLabelDrag = useCallback((labelId: string, x: number, y: number) => {
    setLabels(prev => prev.map(l => l.id === labelId ? { ...l, x, y } : l))
  }, [])

  const handleLabelRemove = useCallback((labelId: string) => {
    setLabels(prev => prev.filter(l => l.id !== labelId))
  }, [])

  const handleSave = useCallback(async (handleClose: () => void) => {
    if (!photoData || !name.trim() || isSaving) return
    setIsSaving(true)

    try {
      const data = { name: name.trim(), photoData, photoWidth, photoHeight, labels }

      if (isEditing && editingLayout) {
        await onUpdate(editingLayout.id, data)
      } else {
        await onSave(data)
      }

      handleClose()
    } catch {
      // Error logged by hook
    } finally {
      setIsSaving(false)
    }
  }, [name, photoData, photoWidth, photoHeight, labels, isSaving, isEditing, editingLayout, onSave, onUpdate])

  const handleDelete = useCallback(async (handleClose: () => void) => {
    if (!editingLayout || isSaving) return
    setIsSaving(true)
    try {
      await onDelete(editingLayout.id)
      handleClose()
    } catch {
      // Error logged by hook
    } finally {
      setIsSaving(false)
    }
  }, [editingLayout, isSaving, onDelete])

  const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-tertiary/20 bg-themewhite text-primary placeholder:text-tertiary/50 focus:outline-none focus:border-themeblue3/50 focus:ring-1 focus:ring-themeblue3/20 transition-colors'

  return (
    <BaseDrawer
      isVisible={isOpen}
      onClose={closeEditor}
      desktopPosition="right"
      header={{ title: isEditing ? 'Edit Layout' : 'New Layout' }}
    >
      {(handleClose: () => void) => (
        <div className="h-full overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Photo capture / display */}
            {!photoData ? (
              <div className="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-tertiary/20 rounded-xl">
                <div className="text-sm text-tertiary mb-1">Take or choose a photo of your aid bag</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-lg bg-themeblue3 text-white hover:bg-themeblue2 active:scale-95 transition-all"
                  >
                    <Camera size={14} />
                    Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-lg border border-tertiary/20 text-secondary hover:bg-themewhite2 transition-colors"
                  >
                    <ImagePlus size={14} />
                    Choose Photo
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
            ) : (
              <>
                {/* Layout name */}
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Layout Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Main Aid Bag, IFAK"
                    className={inputClass}
                    autoFocus
                  />
                </div>

                {/* Photo with labels */}
                <BagLayoutPhoto
                  photoData={photoData}
                  labels={labels}
                  editable
                  onLabelTap={onLabelTap}
                  onLabelDrag={handleLabelDrag}
                  onLabelRemove={handleLabelRemove}
                />

                {/* Add label */}
                {showItemPicker ? (
                  <div className="border border-tertiary/15 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-themewhite2/50 text-xs font-medium text-secondary flex items-center justify-between">
                      <span>Select item to label</span>
                      <button
                        onClick={() => setShowItemPicker(false)}
                        className="text-tertiary hover:text-primary text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {items.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-tertiary text-center">
                          No inventory items yet. Add items first.
                        </div>
                      ) : (
                        items.map(item => (
                          <button
                            key={item.id}
                            onClick={() => handleAddLabel(item)}
                            className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-themewhite2/60 transition-colors"
                          >
                            {item.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowItemPicker(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-tertiary/20 text-secondary hover:bg-themewhite2 transition-colors"
                  >
                    <Plus size={14} />
                    Add Label
                  </button>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2 pb-4">
                  <button
                    onClick={() => handleSave(handleClose)}
                    disabled={!name.trim() || !photoData || isSaving}
                    className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-themeblue3 text-white hover:bg-themeblue2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Save Layout'}
                  </button>

                  {isEditing && (
                    <button
                      onClick={() => handleDelete(handleClose)}
                      disabled={isSaving}
                      className="px-4 py-2.5 text-sm font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </BaseDrawer>
  )
}
