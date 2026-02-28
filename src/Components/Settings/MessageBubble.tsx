import { useRef, useCallback, useState, useEffect } from 'react'
import { Check, X, Loader2, CheckCircle2, Circle, Copy, Pencil, Reply, Trash2 } from 'lucide-react'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import { downloadDecryptedAttachment } from '../../lib/signal/attachmentService'

export type SwipeAction = 'copy' | 'reply' | 'delete' | 'edit'

interface MessageBubbleProps {
  message: DecryptedSignalMessage
  isOwn: boolean
  selected?: boolean
  selectionMode?: boolean
  onTap?: (message: DecryptedSignalMessage) => void
  onLongPress?: (message: DecryptedSignalMessage, x: number, y: number) => void
  onSwipeAction?: (message: DecryptedSignalMessage, action: SwipeAction) => void
  isEditing?: boolean
  editText?: string
  onEditTextChange?: (text: string) => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const LONG_PRESS_MS = 500
const SWIPE_DEAD_ZONE = 10
const SNAP_THRESHOLD = 40
const BUTTON_SLOT = 44

/** Lazy-load and decrypt an image attachment, caching the object URL. */
function useDecryptedImage(path: string | undefined, key: string | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!path || !key) return

    let revoked = false
    setLoading(true)

    downloadDecryptedAttachment(path, key).then(result => {
      if (revoked) return
      if (result.ok) {
        const objectUrl = URL.createObjectURL(result.data)
        setUrl(objectUrl)
      }
    }).catch(() => {}).finally(() => {
      if (!revoked) setLoading(false)
    })

    return () => {
      revoked = true
      setUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    }
  }, [path, key])

  return { url, loading }
}

export function MessageBubble({
  message,
  isOwn,
  selected,
  selectionMode,
  onTap,
  onLongPress,
  onSwipeAction,
  isEditing,
  editText,
  onEditTextChange,
  onSaveEdit,
  onCancelEdit,
}: MessageBubbleProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressedRef = useRef(false)
  const touchedRef = useRef(false)
  const [showFullImage, setShowFullImage] = useState(false)

  // Swipe state
  const swipeRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const swipingRef = useRef(false)
  const directionDecidedRef = useRef(false)
  const swipeOffsetRef = useRef(0)
  const [swipeOpen, setSwipeOpen] = useState(false)

  // How many action buttons to show
  const actionCount = isOwn ? 4 : 3 // own: Reply, Copy, Edit, Delete  |  other: Reply, Copy, Delete
  const maxSwipe = actionCount * BUTTON_SLOT

  // Close swipe when entering selection mode
  useEffect(() => {
    if (selectionMode && swipeOpen) {
      if (swipeRef.current) {
        swipeRef.current.style.transition = 'transform 0.2s ease-out'
        swipeRef.current.style.transform = 'translateX(0)'
      }
      swipeOffsetRef.current = 0
      setSwipeOpen(false)
    }
  }, [selectionMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // request-accepted is an invisible signal — don't render
  if (message.messageType === 'request-accepted') return null

  const isImage = message.content?.type === 'image'
  const imageContent = isImage ? message.content : null

  // Lazy-load the full decrypted image
  const { url: fullImageUrl, loading: imageLoading } = useDecryptedImage(
    imageContent?.path,
    imageContent?.key,
  )

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onLongPress?.(message, e.clientX, e.clientY)
  }, [message, onLongPress])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // ── Touch interaction state machine ──────────────────────────────────

  const swipeEnabled = !isEditing && !selectionMode

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    longPressedRef.current = false
    swipingRef.current = false
    directionDecidedRef.current = false
    touchedRef.current = true

    const touch = e.touches[0]
    const x = touch.clientX
    const y = touch.clientY
    touchStartRef.current = { x, y }

    timerRef.current = setTimeout(() => {
      longPressedRef.current = true
      onLongPress?.(message, x, y)
    }, LONG_PRESS_MS)
  }, [message, onLongPress])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y

    // Decide direction once past dead zone
    if (!directionDecidedRef.current) {
      if (Math.abs(dx) < SWIPE_DEAD_ZONE && Math.abs(dy) < SWIPE_DEAD_ZONE) return

      directionDecidedRef.current = true
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical — let scroll happen, cancel everything
        clearTimer()
        touchStartRef.current = null
        return
      }
      // Horizontal — this is a swipe
      if (swipeEnabled) {
        swipingRef.current = true
        clearTimer()
      } else {
        clearTimer()
        touchStartRef.current = null
        return
      }
    }

    if (!swipingRef.current) return

    // Calculate offset from the starting position, accounting for already-open state
    const base = swipeOpen ? -maxSwipe : 0
    let offset = base + dx
    // Clamp: can't swipe right past 0, can't swipe left past maxSwipe
    offset = Math.max(-maxSwipe, Math.min(0, offset))

    swipeOffsetRef.current = offset
    if (swipeRef.current) {
      swipeRef.current.style.transition = 'none'
      swipeRef.current.style.transform = `translateX(${offset}px)`
    }
  }, [clearTimer, swipeEnabled, swipeOpen, maxSwipe])

  const handleTouchEnd = useCallback(() => {
    clearTimer()

    if (swipingRef.current) {
      // Snap open or closed
      const shouldOpen = Math.abs(swipeOffsetRef.current) > SNAP_THRESHOLD
      if (swipeRef.current) {
        swipeRef.current.style.transition = 'transform 0.2s ease-out'
        swipeRef.current.style.transform = shouldOpen ? `translateX(${-maxSwipe}px)` : 'translateX(0)'
      }
      swipeOffsetRef.current = shouldOpen ? -maxSwipe : 0
      setSwipeOpen(shouldOpen)
      touchStartRef.current = null
      return
    }

    // If swipe is open and user taps the bubble, close it
    if (swipeOpen) {
      if (swipeRef.current) {
        swipeRef.current.style.transition = 'transform 0.2s ease-out'
        swipeRef.current.style.transform = 'translateX(0)'
      }
      swipeOffsetRef.current = 0
      setSwipeOpen(false)
      touchStartRef.current = null
      return
    }

    // Short tap (not long-press) → toggle selection
    if (!longPressedRef.current) {
      onTap?.(message)
    }
    touchStartRef.current = null
  }, [clearTimer, onTap, message, swipeOpen, maxSwipe])

  const handleTouchCancel = useCallback(() => {
    clearTimer()
    // Restore to pre-gesture state
    if (swipeRef.current) {
      const restoreOffset = swipeOpen ? -maxSwipe : 0
      swipeRef.current.style.transition = 'transform 0.2s ease-out'
      swipeRef.current.style.transform = `translateX(${restoreOffset}px)`
      swipeOffsetRef.current = restoreOffset
    }
    touchStartRef.current = null
  }, [clearTimer, swipeOpen, maxSwipe])

  const handleClick = useCallback(() => {
    // Skip if a touch event just fired (prevents double-toggle on mobile)
    if (touchedRef.current) {
      touchedRef.current = false
      return
    }
    // Desktop click → toggle selection
    onTap?.(message)
  }, [onTap, message])

  const handleImageTap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (fullImageUrl) setShowFullImage(true)
  }, [fullImageUrl])

  // ── Swipe action button handler ─────────────────────────────────────

  const handleSwipeBtn = useCallback((action: SwipeAction) => {
    // Close swipe
    if (swipeRef.current) {
      swipeRef.current.style.transition = 'transform 0.2s ease-out'
      swipeRef.current.style.transform = 'translateX(0)'
    }
    swipeOffsetRef.current = 0
    setSwipeOpen(false)
    onSwipeAction?.(message, action)
  }, [message, onSwipeAction])

  // ── Render image content ──────────────────────────────────────────

  const renderContent = () => {
    if (isEditing && !isImage) {
      return (
        <div className="flex flex-col gap-1.5">
          <input
            type="text"
            value={editText ?? ''}
            onChange={e => onEditTextChange?.(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onSaveEdit?.()
              if (e.key === 'Escape') onCancelEdit?.()
            }}
            onClick={e => e.stopPropagation()}
            autoFocus
            className="w-full bg-white/20 rounded-lg px-2 py-1 text-sm outline-none
                       placeholder:text-white/40"
          />
          <div className="flex items-center gap-1.5 justify-end">
            <button
              onClick={e => { e.stopPropagation(); onCancelEdit?.() }}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <X size={14} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onSaveEdit?.() }}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <Check size={14} />
            </button>
          </div>
        </div>
      )
    }

    if (isImage && imageContent) {
      const maxW = 240
      const scale = Math.min(1, maxW / imageContent.width)
      const displayW = Math.round(imageContent.width * scale)
      const displayH = Math.round(imageContent.height * scale)

      return (
        <div
          className="relative overflow-hidden rounded-xl cursor-pointer"
          style={{ width: displayW, height: displayH }}
          onClick={handleImageTap}
        >
          {imageContent.thumbnail && !fullImageUrl && (
            <img
              src={imageContent.thumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-sm"
            />
          )}

          {fullImageUrl ? (
            <img
              src={fullImageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : imageLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <Loader2 size={20} className="animate-spin text-white/70" />
            </div>
          ) : null}
        </div>
      )
    }

    return <p className="text-sm whitespace-pre-wrap break-words">{message.plaintext}</p>
  }

  // ── Swipe action buttons (rendered behind the bubble) ────────────────

  const renderSwipeActions = () => {
    const buttons: { action: SwipeAction; icon: typeof Reply; label: string; color: string }[] = [
      { action: 'reply', icon: Reply, label: 'Reply', color: 'text-themeblue2' },
      { action: 'copy', icon: Copy, label: 'Copy', color: 'text-tertiary' },
    ]
    if (isOwn) {
      buttons.push({ action: 'edit', icon: Pencil, label: 'Edit', color: 'text-tertiary' })
    }
    buttons.push({ action: 'delete', icon: Trash2, label: 'Delete', color: 'text-red-400' })

    return (
      <div
        className="absolute top-0 bottom-0 right-0 flex items-center gap-0.5 pr-1"
        style={{ width: maxSwipe }}
      >
        {buttons.map(({ action, icon: Icon, color }) => (
          <button
            key={action}
            onClick={(e) => { e.stopPropagation(); handleSwipeBtn(action) }}
            className={`w-10 h-10 rounded-full flex items-center justify-center
                       bg-primary/5 active:scale-90 transition-transform ${color}`}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5 items-center`}>
        {/* Selection checkmark indicator */}
        {selectionMode && (
          <div className="w-8 flex items-center justify-center shrink-0">
            {selected ? (
              <CheckCircle2 size={20} className="text-themeblue2" />
            ) : (
              <Circle size={20} className="text-tertiary/30" />
            )}
          </div>
        )}

        {/* Swipe container — positions action buttons behind the bubble row */}
        <div className={`relative overflow-hidden ${selectionMode ? 'flex-1 min-w-0' : 'max-w-[80%]'}
                        ${isOwn ? (selectionMode ? 'flex justify-end' : 'ml-auto') : ''}`}>
          {/* Action buttons (behind) */}
          {swipeEnabled && renderSwipeActions()}

          {/* Slidable bubble row */}
          <div
            ref={swipeRef}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            className={`relative z-[1] rounded-2xl ${isImage ? 'p-1.5' : 'px-3.5 py-2'} select-none cursor-pointer transition-colors touch-pan-y
                       ${isOwn ? 'bg-themeblue2 text-white rounded-br-md' : 'bg-themewhite2 text-primary rounded-bl-md'}
                       ${selected ? (isOwn ? 'ring-2 ring-white/50' : 'ring-2 ring-themeblue2/50') : ''}
                       ${selectionMode ? (isOwn ? 'ml-auto' : '') : ''}`}
            style={selectionMode ? { maxWidth: '80%' } : undefined}
          >
            {renderContent()}
            <div className={`flex items-center gap-1 mt-0.5 ${isImage ? 'px-1.5' : ''} ${isOwn ? 'text-white/60' : 'text-tertiary/40'}`}>
              <p className="text-[9px]">{formatTime(message.createdAt)}</p>
              {message.messageType === 'request' && isOwn && (
                <span className="text-[9px] italic">Pending</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-size image overlay */}
      {showFullImage && fullImageUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
          onClick={() => setShowFullImage(false)}
        >
          <button
            onClick={() => setShowFullImage(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X size={24} className="text-white" />
          </button>
          <img
            src={fullImageUrl}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
