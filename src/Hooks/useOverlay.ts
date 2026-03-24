import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Shared mount/unmount animation + mobile drag-to-dismiss logic
 * used by PickerInput, DatePickerInput, ConfirmDialog, and MultiPickerInput.
 */
export function useOverlay(visible: boolean, onCloseComplete?: () => void) {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpen(true))
      })
    } else {
      setOpen(false)
      const t = setTimeout(() => {
        setMounted(false)
        setDragY(0)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [visible])

  const close = useCallback(() => {
    setOpen(false)
    setTimeout(() => onCloseComplete?.(), 300)
  }, [onCloseComplete])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-drag-zone]')) return
    dragStartY.current = e.touches[0].clientY
    setIsDragging(true)
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return
    const dy = Math.max(0, e.touches[0].clientY - dragStartY.current)
    setDragY(dy)
  }, [isDragging])

  const onTouchEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragY > 80) close()
    setDragY(0)
  }, [isDragging, dragY, close])

  return {
    mounted,
    open,
    dragY,
    isDragging,
    close,
    touchHandlers: { onTouchStart, onTouchMove, onTouchEnd },
  }
}
