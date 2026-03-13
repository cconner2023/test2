/**
 * CanvasEditOverlay — Draw, move, resize, and delete zones on a canvas.
 * Operates in the canvas's own 0..1 normalised coordinate space.
 * Zones are locations — drawing a zone creates a location with a name.
 */
import { useState, useCallback, useRef, useMemo, useImperativeHandle, useEffect, memo } from 'react'
// Icons removed — delete/duplicate now handled via toolbar
import { traceCompositeOutline } from '../../lib/tagIndex'
import type { LocationTag, ZoneRect } from '../../Types/PropertyTypes'

export interface CanvasEditHandle {
  save: () => void
  canSplit: boolean
  canMerge: boolean
  canDuplicate: boolean
  canDelete: boolean
  canRename: boolean
  split: () => void
  merge: () => void
  duplicate: () => void
  deleteSelected: () => void
  renameSelected: () => void
  selectedCount: number
  confirmName: (name: string) => void
  cancelName: () => void
}

interface CanvasEditOverlayProps {
  tags: LocationTag[]
  canvasId: string
  /** When true, dragging on empty canvas draws a new zone. When false, pointer events are ignored (pan handled by parent). */
  drawMode: boolean
  /** When true, only resize handles are interactive (no move). */
  resizeMode?: boolean
  /** Canvas scale — edit overlay matches the view-mode canvas size */
  scale?: number
  onSave: (tags: (Omit<LocationTag, 'id'> & { id?: string })[], removedTargetIds: string[]) => void
  onCancel: () => void
  /** Called when an existing zone is deleted — triggers cascade delete of the location + children */
  onDeleteZone?: (targetId: string, label: string) => void
  /** Imperative handle for triggering save from parent */
  editRef?: React.Ref<CanvasEditHandle>
  /** Called when shift-selection changes so parent can re-render toolbar */
  onSelectionChange?: (count: number) => void
  /** Map of target_id → photo_data base64 URL for zone background images */
  photoMap?: Map<string, string>
  /** When true, name prompt is rendered externally (by parent) instead of inline */
  externalNamePrompt?: boolean
  /** Called when naming state changes (for external prompt rendering) */
  onNamingChange?: (naming: { index: number; existingLabel: string } | null) => void
}

type DragAction =
  | { type: 'draw'; startX: number; startY: number; currentX: number; currentY: number }
  | { type: 'move'; tagIdx: number; offsetX: number; offsetY: number }
  | { type: 'resize'; tagIdx: number; handle: ResizeHandle; startRect: { x: number; y: number; w: number; h: number } }

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

interface EditableTag {
  /** Preserved from the original LocationTag so IDs survive round-trips. */
  _origId?: string
  target_type: 'location' | 'item'
  target_id: string
  x: number
  y: number
  width: number
  height: number
  label: string
  rects: ZoneRect[] | null
}

const MIN_ZONE_SIZE = 0.03

export const CanvasEditOverlay = memo(function CanvasEditOverlay({
  tags,
  canvasId,
  drawMode,
  resizeMode = false,
  scale = 1,
  onSave,
  onCancel,
  onDeleteZone,
  editRef,
  onSelectionChange,
  photoMap,
  externalNamePrompt = false,
  onNamingChange,
}: CanvasEditOverlayProps) {
  const [editTags, setEditTags] = useState<EditableTag[]>(() =>
    tags
      .filter((t) => (t.width ?? 0) > 0 && (t.height ?? 0) > 0)
      .map((t) => ({
        _origId: t.id,
        target_type: t.target_type,
        target_id: t.target_id,
        x: t.x,
        y: t.y,
        width: t.width ?? 0.2,
        height: t.height ?? 0.2,
        label: t.label,
        rects: t.rects ?? null,
      })),
  )

  const [dragAction, setDragAction] = useState<DragAction | null>(null)
  // Name prompt shown after drawing a new zone
  const [namingIndex, setNamingIndex] = useState<number | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  // Track target_ids removed by merge (so save handler can transfer items)
  const [mergedAwayIds, setMergedAwayIds] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const toNorm = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return { nx: 0, ny: 0 }
      return {
        nx: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
        ny: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
      }
    },
    [],
  )

  const handleToggleSelect = useCallback((idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      // Defer parent notification to avoid setState-during-render
      queueMicrotask(() => onSelectionChange?.(next.size))
      return next
    })
  }, [onSelectionChange])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || namingIndex !== null) return
      const target = e.target as HTMLElement
      if (target.closest('[data-zone]') || target.closest('[data-handle]')) return

      // Only draw when drawMode is active — otherwise let parent handle panning
      if (!drawMode) return

      const { nx, ny } = toNorm(e.clientX, e.clientY)
      setDragAction({ type: 'draw', startX: nx, startY: ny, currentX: nx, currentY: ny })
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [toNorm, namingIndex, drawMode],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragAction) return
      const { nx, ny } = toNorm(e.clientX, e.clientY)

      if (dragAction.type === 'draw') {
        setDragAction({ ...dragAction, currentX: nx, currentY: ny })
      } else if (dragAction.type === 'move') {
        setEditTags((prev) => {
          const next = [...prev]
          const tag = { ...next[dragAction.tagIdx] }
          tag.x = Math.max(0, Math.min(1 - tag.width, nx - dragAction.offsetX))
          tag.y = Math.max(0, Math.min(1 - tag.height, ny - dragAction.offsetY))
          next[dragAction.tagIdx] = tag
          return next
        })
      } else if (dragAction.type === 'resize') {
        setEditTags((prev) => {
          const next = [...prev]
          const sr = dragAction.startRect
          let { x, y, w, h } = sr

          switch (dragAction.handle) {
            case 'se':
              w = Math.max(MIN_ZONE_SIZE, nx - sr.x)
              h = Math.max(MIN_ZONE_SIZE, ny - sr.y)
              break
            case 'sw':
              w = Math.max(MIN_ZONE_SIZE, sr.x + sr.w - nx)
              h = Math.max(MIN_ZONE_SIZE, ny - sr.y)
              x = Math.min(nx, sr.x + sr.w - MIN_ZONE_SIZE)
              break
            case 'ne':
              w = Math.max(MIN_ZONE_SIZE, nx - sr.x)
              h = Math.max(MIN_ZONE_SIZE, sr.y + sr.h - ny)
              y = Math.min(ny, sr.y + sr.h - MIN_ZONE_SIZE)
              break
            case 'nw':
              w = Math.max(MIN_ZONE_SIZE, sr.x + sr.w - nx)
              h = Math.max(MIN_ZONE_SIZE, sr.y + sr.h - ny)
              x = Math.min(nx, sr.x + sr.w - MIN_ZONE_SIZE)
              y = Math.min(ny, sr.y + sr.h - MIN_ZONE_SIZE)
              break
          }

          x = Math.max(0, x)
          y = Math.max(0, y)
          w = Math.min(w, 1 - x)
          h = Math.min(h, 1 - y)

          next[dragAction.tagIdx] = { ...next[dragAction.tagIdx], x, y, width: w, height: h }
          return next
        })
      }
    },
    [dragAction, toNorm],
  )

  const handlePointerUp = useCallback(() => {
    if (!dragAction) return

    if (dragAction.type === 'draw') {
      const x = Math.min(dragAction.startX, dragAction.currentX)
      const y = Math.min(dragAction.startY, dragAction.currentY)
      const w = Math.abs(dragAction.currentX - dragAction.startX)
      const h = Math.abs(dragAction.currentY - dragAction.startY)

      if (w >= MIN_ZONE_SIZE && h >= MIN_ZONE_SIZE) {
        const newTag: EditableTag = {
          target_type: 'location',
          target_id: crypto.randomUUID(),
          x,
          y,
          width: w,
          height: h,
          label: '',
          rects: null,
        }
        setEditTags((prev) => [...prev, newTag])
        setNameInput('')
        setNamingIndex(editTags.length)
        setTimeout(() => nameInputRef.current?.focus(), 50)
      }
    }

    setDragAction(null)
  }, [dragAction, editTags.length])

  const handleNameConfirm = useCallback(() => {
    if (namingIndex === null) return
    const trimmed = nameInput.trim()
    const existingLabel = editTags[namingIndex]?.label
    if (!trimmed) {
      // New zone with no name → remove; rename with no name → keep original
      if (!existingLabel) {
        setEditTags((prev) => prev.filter((_, i) => i !== namingIndex))
      }
    } else {
      setEditTags((prev) => {
        const next = [...prev]
        next[namingIndex] = { ...next[namingIndex], label: trimmed }
        return next
      })
    }
    setNamingIndex(null)
    setNameInput('')
  }, [namingIndex, nameInput, editTags])

  // Track zone pointer-down to distinguish tap (select) from drag (move)
  const zoneDownRef = useRef<{ idx: number; x: number; y: number; nx: number; ny: number } | null>(null)

  const handleZonePointerDown = useCallback(
    (e: React.PointerEvent, idx: number) => {
      e.stopPropagation()
      if (e.button !== 0 || namingIndex !== null) return

      const { nx, ny } = toNorm(e.clientX, e.clientY)
      zoneDownRef.current = { idx, x: e.clientX, y: e.clientY, nx, ny }
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [toNorm, namingIndex],
  )

  const handleZonePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const down = zoneDownRef.current
      if (!down) return

      // If we haven't started a drag yet, check threshold
      if (!dragAction) {
        const dx = Math.abs(e.clientX - down.x)
        const dy = Math.abs(e.clientY - down.y)
        if (dx > 4 || dy > 4) {
          // In resize mode, suppress move — only handles resize
          if (resizeMode) return
          // Start move drag
          const tag = editTags[down.idx]
          setDragAction({
            type: 'move',
            tagIdx: down.idx,
            offsetX: down.nx - tag.x,
            offsetY: down.ny - tag.y,
          })
        }
      }
    },
    [dragAction, editTags, resizeMode],
  )

  const handleZonePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const down = zoneDownRef.current
      if (!down) return
      zoneDownRef.current = null

      // If no drag was started, treat as a tap → toggle selection
      if (!dragAction) {
        const dx = Math.abs(e.clientX - down.x)
        const dy = Math.abs(e.clientY - down.y)
        if (dx < 8 && dy < 8) {
          handleToggleSelect(down.idx)
        }
      }
    },
    [dragAction, handleToggleSelect],
  )

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, idx: number, handle: ResizeHandle) => {
      e.stopPropagation()
      if (e.button !== 0) return
      const tag = editTags[idx]
      setDragAction({
        type: 'resize',
        tagIdx: idx,
        handle,
        startRect: { x: tag.x, y: tag.y, w: tag.width, h: tag.height },
      })
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [editTags],
  )

  // Track which target_ids existed before editing (for cascade delete)
  const existingTargetIds = useMemo(
    () => new Set(tags.map((t) => t.target_id)),
    [tags],
  )

  const handleDelete = useCallback((idx: number) => {
    const tag = editTags[idx]
    if (tag && existingTargetIds.has(tag.target_id) && onDeleteZone) {
      // Existing zone — trigger cascade delete confirmation
      onDeleteZone(tag.target_id, tag.label || 'Unnamed')
    }
    setEditTags((prev) => prev.filter((_, i) => i !== idx))
  }, [editTags, existingTargetIds, onDeleteZone])

  const handleDuplicate = useCallback((idx: number) => {
    setEditTags((prev) => {
      const original = prev[idx]
      const duplicate: EditableTag = {
        target_type: 'location',
        target_id: crypto.randomUUID(),
        x: Math.min(1 - original.width, original.x + 0.02),
        y: Math.min(1 - original.height, original.y + 0.02),
        width: original.width,
        height: original.height,
        label: `Copy of ${original.label}`,
        rects: null,
      }
      const next = [...prev]
      next.splice(idx + 1, 0, duplicate)
      return next
    })
  }, [])

  const handleSplit = useCallback(() => {
    if (selectedIndices.size !== 1) return
    const idx = [...selectedIndices][0]

    setEditTags((prev) => {
      const original = prev[idx]
      const halfW = original.width / 2

      // Left half keeps original target_id + name so items stay assigned
      const left: EditableTag = {
        target_type: 'location',
        target_id: original.target_id,
        x: original.x,
        y: original.y,
        width: halfW,
        height: original.height,
        label: original.label,
        rects: null,
      }
      // Right half gets a new id — will create a new location on save
      const right: EditableTag = {
        target_type: 'location',
        target_id: crypto.randomUUID(),
        x: original.x + halfW,
        y: original.y,
        width: halfW,
        height: original.height,
        label: `${original.label} (2)`,
        rects: null,
      }

      const next = [...prev]
      next.splice(idx, 1, left, right)
      return next
    })
    setSelectedIndices(new Set())
    onSelectionChange?.(0)
  }, [selectedIndices, onSelectionChange])

  const handleMerge = useCallback(() => {
    if (selectedIndices.size < 2) return
    const sortedAsc = [...selectedIndices].sort((a, b) => a - b)
    const sortedDesc = [...sortedAsc].reverse()

    setEditTags((prev) => {
      const selected = sortedAsc.map((i) => prev[i])
      const survivor = selected[0] // lowest index keeps identity

      // Track merged-away IDs for item transfer on save
      const awayIds = selected.slice(1)
        .filter((z) => existingTargetIds.has(z.target_id))
        .map((z) => z.target_id)
      if (awayIds.length > 0) setMergedAwayIds((ids) => [...ids, ...awayIds])

      // Compute bounding box across all N zones
      const bbX = Math.min(...selected.map((z) => z.x))
      const bbY = Math.min(...selected.map((z) => z.y))
      const bbX2 = Math.max(...selected.map((z) => z.x + z.width))
      const bbY2 = Math.max(...selected.map((z) => z.y + z.height))
      const bbW = bbX2 - bbX
      const bbH = bbY2 - bbY

      // Build rects array — composite-aware
      const rects: ZoneRect[] = []
      for (const zone of selected) {
        if (zone.rects && zone.rects.length > 0) {
          // Existing composite: convert each sub-rect from local → canvas → new bounding box
          for (const r of zone.rects) {
            const cx = zone.x + r.x * zone.width
            const cy = zone.y + r.y * zone.height
            const cw = r.w * zone.width
            const ch = r.h * zone.height
            rects.push({ x: (cx - bbX) / bbW, y: (cy - bbY) / bbH, w: cw / bbW, h: ch / bbH })
          }
        } else {
          // Simple zone: one rect from its bounding box
          rects.push({ x: (zone.x - bbX) / bbW, y: (zone.y - bbY) / bbH, w: zone.width / bbW, h: zone.height / bbH })
        }
      }

      const merged: EditableTag = {
        target_type: 'location',
        target_id: survivor.target_id,
        x: bbX,
        y: bbY,
        width: bbW,
        height: bbH,
        label: survivor.label,
        rects,
      }

      // Remove all selected (descending order to preserve indices)
      const next = [...prev]
      for (const idx of sortedDesc) next.splice(idx, 1)
      next.push(merged)
      return next
    })
    setSelectedIndices(new Set())
    onSelectionChange?.(0)
  }, [selectedIndices, onSelectionChange, existingTargetIds])

  const handleSave = useCallback(() => {
    const validTags = editTags.filter((t) => t.label.trim() !== '')
    onSave(
      validTags.map((t) => ({
        ...(t._origId ? { id: t._origId } : {}),
        location_id: canvasId,
        target_type: t.target_type,
        target_id: t.target_id,
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
        label: t.label,
        rects: t.rects,
      })),
      mergedAwayIds,
    )
  }, [editTags, canvasId, onSave, mergedAwayIds])

  const handleDuplicateSelected = useCallback(() => {
    if (selectedIndices.size !== 1) return
    const idx = [...selectedIndices][0]
    handleDuplicate(idx)
    setSelectedIndices(new Set())
    onSelectionChange?.(0)
  }, [selectedIndices, handleDuplicate, onSelectionChange])

  const handleDeleteSelected = useCallback(() => {
    if (selectedIndices.size === 0) return
    // Delete in reverse order to preserve indices
    const sorted = [...selectedIndices].sort((a, b) => b - a)
    for (const idx of sorted) {
      const tag = editTags[idx]
      if (tag && existingTargetIds.has(tag.target_id) && onDeleteZone) {
        onDeleteZone(tag.target_id, tag.label || 'Unnamed')
      }
    }
    setEditTags((prev) => prev.filter((_, i) => !selectedIndices.has(i)))
    setSelectedIndices(new Set())
    onSelectionChange?.(0)
  }, [selectedIndices, editTags, existingTargetIds, onDeleteZone, onSelectionChange])

  const handleRenameSelected = useCallback(() => {
    if (selectedIndices.size !== 1) return
    const idx = [...selectedIndices][0]
    const tag = editTags[idx]
    if (!tag) return
    setNameInput(tag.label)
    setNamingIndex(idx)
    setTimeout(() => nameInputRef.current?.focus(), 50)
  }, [selectedIndices, editTags])

  // External name prompt: notify parent when naming state changes
  useEffect(() => {
    if (!externalNamePrompt || !onNamingChange) return
    if (namingIndex !== null) {
      onNamingChange({ index: namingIndex, existingLabel: editTags[namingIndex]?.label || '' })
    } else {
      onNamingChange(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namingIndex, externalNamePrompt])

  const confirmNameExternal = useCallback((name: string) => {
    if (namingIndex === null) return
    const trimmed = name.trim()
    if (!trimmed) {
      if (!editTags[namingIndex]?.label) {
        setEditTags((prev) => prev.filter((_, i) => i !== namingIndex))
      }
    } else {
      setEditTags((prev) => {
        const next = [...prev]
        next[namingIndex] = { ...next[namingIndex], label: trimmed }
        return next
      })
    }
    setNamingIndex(null)
    setNameInput('')
  }, [namingIndex, editTags])

  const cancelNameExternal = useCallback(() => {
    if (namingIndex === null) return
    if (!editTags[namingIndex]?.label) {
      setEditTags((prev) => prev.filter((_, i) => i !== namingIndex))
    }
    setNamingIndex(null)
    setNameInput('')
  }, [namingIndex, editTags])

  // Expose save + split/merge/duplicate/delete/rename to parent via imperative handle
  const canSplit = selectedIndices.size === 1
  const canMerge = selectedIndices.size >= 2
  const canDuplicate = selectedIndices.size === 1
  const canDelete = selectedIndices.size >= 1
  const canRename = selectedIndices.size === 1
  useImperativeHandle(editRef, () => ({
    save: handleSave,
    canSplit,
    canMerge,
    canDuplicate,
    canDelete,
    canRename,
    split: handleSplit,
    merge: handleMerge,
    duplicate: handleDuplicateSelected,
    deleteSelected: handleDeleteSelected,
    renameSelected: handleRenameSelected,
    selectedCount: selectedIndices.size,
    confirmName: confirmNameExternal,
    cancelName: cancelNameExternal,
  }), [handleSave, canSplit, canMerge, canDuplicate, canDelete, canRename, handleSplit, handleMerge, handleDuplicateSelected, handleDeleteSelected, handleRenameSelected, selectedIndices.size, confirmNameExternal, cancelNameExternal])

  const drawPreview =
    dragAction?.type === 'draw'
      ? {
          x: Math.min(dragAction.startX, dragAction.currentX),
          y: Math.min(dragAction.startY, dragAction.currentY),
          w: Math.abs(dragAction.currentX - dragAction.startX),
          h: Math.abs(dragAction.currentY - dragAction.startY),
        }
      : null

  return (
    <div
      ref={containerRef}
      className={`relative select-none touch-none origin-top-left ${drawMode ? 'cursor-crosshair' : 'cursor-default'}`}
      style={{
        width: `${scale * 100}%`,
        height: `${scale * 100}%`,
        minHeight: '100%',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          {[0.25, 0.5, 0.75].map((p) => (
            <g key={p}>
              <line
                x1={`${p * 100}%`} y1="0" x2={`${p * 100}%`} y2="100%"
                stroke="currentColor" strokeWidth="1" className="text-tertiary/10"
                strokeDasharray="4 4"
              />
              <line
                x1="0" y1={`${p * 100}%`} x2="100%" y2={`${p * 100}%`}
                stroke="currentColor" strokeWidth="1" className="text-tertiary/10"
                strokeDasharray="4 4"
              />
            </g>
          ))}
        </svg>

        {/* SVG defs for composite zone clip paths */}
        {editTags.some((t) => t.rects && t.rects.length > 0) && (
          <svg className="absolute" width="0" height="0">
            <defs>
              {editTags.map((tag, idx) =>
                tag.rects && tag.rects.length > 0 ? (
                  <clipPath key={idx} id={`ebb-${idx}`} clipPathUnits="objectBoundingBox">
                    {tag.rects.map((r, i) => (
                      <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />
                    ))}
                  </clipPath>
                ) : null,
              )}
            </defs>
          </svg>
        )}

        {/* Zones */}
        {editTags.map((tag, idx) => {
          const isComposite = tag.rects && tag.rects.length > 0
          const isSel = selectedIndices.has(idx)
          const photo = photoMap?.get(tag.target_id)

          return (
          <div
            key={idx}
            data-zone
            className={[
              'absolute overflow-hidden',
              drawMode ? 'pointer-events-none' : 'cursor-move',
              isComposite
                ? ''
                : [
                    'rounded-lg border-2',
                    isSel
                      ? 'border-themeyellow ring-2 ring-themeyellow'
                      : 'border-themeblue3/40',
                    !photo && (isSel ? 'bg-themeyellow/20' : 'bg-themeblue3/15'),
                  ].filter(Boolean).join(' '),
            ].join(' ')}
            style={{
              left: `${tag.x * 100}%`,
              top: `${tag.y * 100}%`,
              width: `${tag.width * 100}%`,
              height: `${tag.height * 100}%`,
              ...(isComposite ? { clipPath: `url(#ebb-${idx})` } : {}),
            }}
            onPointerDown={(e) => handleZonePointerDown(e, idx)}
            onPointerMove={handleZonePointerMove}
            onPointerUp={handleZonePointerUp}
          >
            {/* Zone background image */}
            {photo && !isComposite && (
              <img src={photo} alt={tag.label} className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />
            )}
            {/* Composite SVG for merged zones */}
            {isComposite && (() => {
              const outline = traceCompositeOutline(tag.rects!)
              const clipId = `eclip-${idx}`
              return (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
                  <defs>
                    <clipPath id={clipId}>
                      {tag.rects!.map((r, i) => (
                        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />
                      ))}
                    </clipPath>
                  </defs>
                  <rect x="0" y="0" width="1" height="1" clipPath={`url(#${clipId})`}
                    className={isSel ? 'fill-themeyellow/20' : 'fill-themeblue3/15'} />
                  {outline && (
                    <path d={outline} fill="none"
                      className={isSel ? 'stroke-themeyellow/50' : 'stroke-themeblue3/40'}
                      strokeWidth={isSel ? 2.5 : 2} vectorEffect="non-scaling-stroke" />
                  )}
                </svg>
              )
            })()}

            {/* Label */}
            <div className="absolute inset-0 flex items-center justify-center p-1 overflow-hidden pointer-events-none">
              <span className="text-[10pt] font-medium text-themeblue1 text-center leading-tight line-clamp-2">
                {tag.label || 'Unnamed'}
              </span>
            </div>

            {/* Resize handles — only on selected zones */}
            {isSel && (['nw', 'ne', 'sw', 'se'] as ResizeHandle[]).map((handle) => (
              <div
                key={handle}
                data-handle
                className={[
                  'absolute w-3.5 h-3.5 rounded-full bg-white border-2 z-10',
                  resizeMode ? 'border-themeyellow shadow-md' : 'border-themeblue3',
                  handle === 'nw' ? '-top-1.5 -left-1.5 cursor-nw-resize' : '',
                  handle === 'ne' ? '-top-1.5 -right-1.5 cursor-ne-resize' : '',
                  handle === 'sw' ? '-bottom-1.5 -left-1.5 cursor-sw-resize' : '',
                  handle === 'se' ? '-bottom-1.5 -right-1.5 cursor-se-resize' : '',
                ].join(' ')}
                onPointerDown={(e) => handleResizePointerDown(e, idx, handle)}
              />
            ))}
          </div>
          )
        })}

        {/* Draw preview */}
        {drawPreview && drawPreview.w >= MIN_ZONE_SIZE && drawPreview.h >= MIN_ZONE_SIZE && (
          <div
            className="absolute rounded-lg border-2 border-dashed border-themeblue3/60 bg-themeblue3/10 pointer-events-none"
            style={{
              left: `${drawPreview.x * 100}%`,
              top: `${drawPreview.y * 100}%`,
              width: `${drawPreview.w * 100}%`,
              height: `${drawPreview.h * 100}%`,
            }}
          />
        )}

        {/* Name prompt — fixed position within canvas so it stays visible (skipped when parent renders it) */}
        {namingIndex !== null && !externalNamePrompt && (
          <div className="sticky bottom-4 left-0 right-0 z-20 flex justify-center pointer-events-none">
            <div className="pointer-events-auto bg-themewhite rounded-xl shadow-lg w-72 p-4 border border-primary/10">
              <p className="text-[10pt] font-medium text-primary mb-2">
                {editTags[namingIndex!]?.label ? 'Rename zone' : 'Name this zone'}
              </p>
              <input
                ref={nameInputRef}
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameConfirm()
                  if (e.key === 'Escape') {
                    // New zone (no label) → remove; rename → keep original
                    if (!editTags[namingIndex!]?.label) {
                      setEditTags((prev) => prev.filter((_, i) => i !== namingIndex))
                    }
                    setNamingIndex(null)
                    setNameInput('')
                  }
                }}
                placeholder="e.g. Arms Room, Supply Closet"
                className="w-full px-3 py-2 rounded-lg bg-themewhite2 text-[10pt] text-primary placeholder:text-tertiary/40 outline-none focus:border-themeblue2 focus:outline-none border border-tertiary/20 transition-all"
              />
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => {
                    // New zone (no label) → remove; rename → keep original
                    if (!editTags[namingIndex!]?.label) {
                      setEditTags((prev) => prev.filter((_, i) => i !== namingIndex))
                    }
                    setNamingIndex(null)
                    setNameInput('')
                  }}
                  className="flex-1 py-1.5 rounded-lg text-[10pt] text-tertiary hover:bg-primary/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNameConfirm}
                  disabled={!nameInput.trim()}
                  className="flex-1 py-1.5 rounded-lg bg-themeblue3 text-[10pt] text-white disabled:opacity-30 active:scale-95 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
})
