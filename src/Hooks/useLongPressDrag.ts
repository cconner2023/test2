import { useCallback, useRef, useState } from 'react'

export interface DragState {
  isDragging: boolean
  draggedEventId: string | null
  ghostX: number
  ghostY: number
  dropTargetDate: string | null
}

interface UseLongPressDragOptions {
  onDragStart?: (eventId: string) => void
  onDrop: (eventId: string, targetDateKey: string) => void
  onDragCancel?: () => void
  longPressThreshold?: number
}

interface DragHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  onPointerDown: (e: React.PointerEvent) => void
}

const INITIAL_DRAG_STATE: DragState = {
  isDragging: false,
  draggedEventId: null,
  ghostX: 0,
  ghostY: 0,
  dropTargetDate: null,
}

export function useLongPressDrag({
  onDragStart,
  onDrop,
  onDragCancel,
  longPressThreshold = 300,
}: UseLongPressDragOptions) {
  const [dragState, setDragState] = useState<DragState>(INITIAL_DRAG_STATE)

  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeEventIdRef = useRef<string | null>(null)
  const isDraggingRef = useRef(false)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)

  const clearPressTimer = useCallback(() => {
    if (pressTimerRef.current !== null) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }, [])

  const getDropTarget = useCallback((x: number, y: number): string | null => {
    const elements = document.elementsFromPoint(x, y)
    for (const el of elements) {
      const date = (el as HTMLElement).dataset?.dropDate
      if (date) return date
    }
    return null
  }, [])

  const cancelDrag = useCallback(() => {
    clearPressTimer()
    isDraggingRef.current = false
    activeEventIdRef.current = null
    startPointRef.current = null
    setDragState(INITIAL_DRAG_STATE)
    onDragCancel?.()
  }, [clearPressTimer, onDragCancel])

  const getDragHandlers = useCallback((eventId: string): DragHandlers => {
    const handleDragMove = (x: number, y: number) => {
      if (!isDraggingRef.current) return
      const dropTargetDate = getDropTarget(x, y)
      setDragState((prev) => ({
        ...prev,
        ghostX: x,
        ghostY: y,
        dropTargetDate,
      }))
    }

    const handleDragEnd = (x: number, y: number) => {
      if (!isDraggingRef.current) {
        clearPressTimer()
        return
      }

      const dropTargetDate = getDropTarget(x, y)
      isDraggingRef.current = false
      activeEventIdRef.current = null
      startPointRef.current = null
      setDragState(INITIAL_DRAG_STATE)

      if (dropTargetDate) {
        onDrop(eventId, dropTargetDate)
      } else {
        onDragCancel?.()
      }
    }

    const onTouchStart = (e: React.TouchEvent) => {
      const touch = e.touches[0]
      startPointRef.current = { x: touch.clientX, y: touch.clientY }
      activeEventIdRef.current = eventId

      pressTimerRef.current = setTimeout(() => {
        if (!activeEventIdRef.current) return
        isDraggingRef.current = true
        ;(e.target as HTMLElement).style.touchAction = 'none'
        setDragState({
          isDragging: true,
          draggedEventId: eventId,
          ghostX: touch.clientX,
          ghostY: touch.clientY,
          dropTargetDate: getDropTarget(touch.clientX, touch.clientY),
        })
        onDragStart?.(eventId)
      }, longPressThreshold)
    }

    const onTouchMove = (e: React.TouchEvent) => {
      const touch = e.touches[0]
      if (isDraggingRef.current) {
        e.preventDefault()
        handleDragMove(touch.clientX, touch.clientY)
      } else if (startPointRef.current) {
        const dx = Math.abs(touch.clientX - startPointRef.current.x)
        const dy = Math.abs(touch.clientY - startPointRef.current.y)
        if (dx > 8 || dy > 8) {
          clearPressTimer()
          activeEventIdRef.current = null
        }
      }
    }

    const onTouchEnd = (e: React.TouchEvent) => {
      const touch = e.changedTouches[0]
      ;(e.target as HTMLElement).style.touchAction = ''
      clearPressTimer()
      handleDragEnd(touch.clientX, touch.clientY)
    }

    const onPointerDown = (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return
      startPointRef.current = { x: e.clientX, y: e.clientY }
      activeEventIdRef.current = eventId

      const onPointerMove = (ev: PointerEvent) => {
        if (isDraggingRef.current) {
          handleDragMove(ev.clientX, ev.clientY)
        } else if (startPointRef.current) {
          const dx = Math.abs(ev.clientX - startPointRef.current.x)
          const dy = Math.abs(ev.clientY - startPointRef.current.y)
          if (dx > 8 || dy > 8) {
            clearPressTimer()
            activeEventIdRef.current = null
            document.removeEventListener('pointermove', onPointerMove)
            document.removeEventListener('pointerup', onPointerUp)
          }
        }
      }

      const onPointerUp = (ev: PointerEvent) => {
        clearPressTimer()
        handleDragEnd(ev.clientX, ev.clientY)
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)
      }

      pressTimerRef.current = setTimeout(() => {
        if (!activeEventIdRef.current) return
        isDraggingRef.current = true
        setDragState({
          isDragging: true,
          draggedEventId: eventId,
          ghostX: e.clientX,
          ghostY: e.clientY,
          dropTargetDate: getDropTarget(e.clientX, e.clientY),
        })
        onDragStart?.(eventId)
      }, longPressThreshold)

      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp, { once: true })
    }

    return { onTouchStart, onTouchMove, onTouchEnd, onPointerDown }
  }, [clearPressTimer, getDropTarget, longPressThreshold, onDragCancel, onDragStart, onDrop])

  return { dragState, getDragHandlers, cancelDrag }
}
