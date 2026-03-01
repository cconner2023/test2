import { useRef, useCallback, useState, useEffect } from 'react'
import { Check, X, Loader2, CheckCircle2, Circle, Copy, Pencil, Reply, Trash2, Clock, MessageSquare } from 'lucide-react'
import { GESTURE_THRESHOLDS } from '../../Utilities/GestureUtils'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import { downloadDecryptedAttachment } from '../../lib/signal/attachmentService'

export type SwipeAction = 'copy' | 'reply' | 'delete' | 'edit'

interface MessageBubbleProps {
  message: DecryptedSignalMessage
  isOwn: boolean
  avatar?: React.ReactNode
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
  /** Number of thread replies if this message is a thread root. */
  threadReplyCount?: number
  /** Callback when user taps to open a thread (reply header or reply count badge). */
  onOpenThread?: (rootMessageId: string) => void
  /** Sender name to display above non-own bubbles in group chats. */
  senderName?: string
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

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
  avatar,
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
  threadReplyCount,
  onOpenThread,
  senderName,
}: MessageBubbleProps) {
  const touchRef = useRef<{
    startX: number
    startY: number
    swiping: boolean
    dirDecided: boolean
  } | null>(null)
  const touchedRef = useRef(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const [showFullImage, setShowFullImage] = useState(false)
  const [swipeOpen, setSwipeOpen] = useState(false)

  const ACTION_WIDTH = 192
  const swipeEnabled = !isEditing && !selectionMode

  // Close swipe when entering selection mode
  useEffect(() => {
    if (selectionMode && swipeOpen) {
      const el = rowRef.current
      if (el) {
        el.style.transition = 'transform 200ms ease-out'
        el.style.transform = 'translateX(0px)'
      }
      setSwipeOpen(false)
    }
  }, [selectionMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // request-accepted is an invisible signal — don't render
  if (message.messageType === 'request-accepted') return null

  const imageContent = message.content?.type === 'image' ? message.content : null
  const isImage = !!imageContent

  const { url: fullImageUrl, loading: imageLoading } = useDecryptedImage(
    imageContent?.path,
    imageContent?.key,
  )

  // ── Direct DOM touch handling ──

  const snapTo = useCallback((x: number) => {
    const el = rowRef.current
    if (!el) return
    el.style.transition = 'transform 200ms ease-out'
    el.style.transform = `translateX(${x}px)`
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchedRef.current = true
    const t = e.touches[0]
    touchRef.current = { startX: t.clientX, startY: t.clientY, swiping: false, dirDecided: false }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const state = touchRef.current
    if (!state) return
    const t = e.touches[0]
    const dx = t.clientX - state.startX
    const dy = t.clientY - state.startY

    if (!state.dirDecided) {
      if (Math.abs(dx) < GESTURE_THRESHOLDS.DIRECTION_LOCK && Math.abs(dy) < GESTURE_THRESHOLDS.DIRECTION_LOCK) return
      state.dirDecided = true
      if (Math.abs(dy) > Math.abs(dx)) { touchRef.current = null; return }
      if (!swipeEnabled) { touchRef.current = null; return }
      state.swiping = true
    }
    if (!state.swiping) return

    const base = swipeOpen ? -ACTION_WIDTH : 0
    const offset = Math.max(-ACTION_WIDTH, Math.min(0, base + dx))
    const el = rowRef.current
    if (el) {
      el.style.transition = 'none'
      el.style.transform = `translateX(${offset}px)`
    }
  }, [swipeEnabled, swipeOpen, ACTION_WIDTH])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const state = touchRef.current
    if (!state) return
    touchRef.current = null

    if (state.swiping) {
      const dx = e.changedTouches[0].clientX - state.startX
      const base = swipeOpen ? -ACTION_WIDTH : 0
      const shouldOpen = Math.abs(base + dx) > ACTION_WIDTH * 0.3
      snapTo(shouldOpen ? -ACTION_WIDTH : 0)
      setSwipeOpen(shouldOpen)
      return
    }

    if (!state.dirDecided) {
      if (swipeOpen) { snapTo(0); setSwipeOpen(false) }
      else onTap?.(message)
    }
  }, [swipeOpen, ACTION_WIDTH, snapTo, onTap, message])

  const handleTouchCancel = useCallback(() => {
    touchRef.current = null
    snapTo(swipeOpen ? -ACTION_WIDTH : 0)
  }, [swipeOpen, ACTION_WIDTH, snapTo])

  // Desktop click → tap (skip if touch just fired)
  const handleClick = useCallback(() => {
    if (touchedRef.current) { touchedRef.current = false; return }
    if (swipeOpen) { snapTo(0); setSwipeOpen(false); return }
    onTap?.(message)
  }, [swipeOpen, snapTo, onTap, message])

  // Desktop right-click + mobile long-press
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onLongPress?.(message, e.clientX, e.clientY)
  }, [message, onLongPress])

  // ── Swipe action handler ─────────────────────────────────────────────

  const handleSwipeAction = useCallback((action: SwipeAction) => {
    snapTo(0)
    setSwipeOpen(false)
    onSwipeAction?.(message, action)
  }, [message, onSwipeAction, snapTo])

  const handleImageTap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (fullImageUrl) setShowFullImage(true)
  }, [fullImageUrl])

  // ── Render content ────────────────────────────────────────────────────

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

  return (
    <>
      {/* Full-width container with overflow-hidden (same layout as SwipeableRosterCard) */}
      <div className="relative overflow-hidden mb-1.5">
        {/* Swipe action buttons — revealed on drag */}
        {swipeEnabled && (
          <div
            className="absolute inset-y-0 right-0 flex items-center justify-evenly px-2"
            style={{ width: ACTION_WIDTH }}
          >
            <button onClick={() => handleSwipeAction('reply')} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-themeblue2/15">
                <Reply size={16} className="text-themeblue2" />
              </div>
              <span className="text-[8px] font-medium text-tertiary/60">Reply</span>
            </button>
            <button onClick={() => handleSwipeAction('copy')} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/5">
                <Copy size={16} className="text-tertiary" />
              </div>
              <span className="text-[8px] font-medium text-tertiary/60">Copy</span>
            </button>
            {isOwn && (
              <button onClick={() => handleSwipeAction('edit')} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/5">
                  <Pencil size={16} className="text-tertiary" />
                </div>
                <span className="text-[8px] font-medium text-tertiary/60">Edit</span>
              </button>
            )}
            <button onClick={() => handleSwipeAction('delete')} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-themeredred/10">
                <Trash2 size={16} className="text-red-400" />
              </div>
              <span className="text-[8px] font-medium text-tertiary/60">Delete</span>
            </button>
          </div>
        )}

        {/* Slidable message row — direct DOM touch handling */}
        <div
          ref={rowRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          style={{ touchAction: 'pan-y' }}
          className="relative bg-themewhite3 select-none cursor-pointer"
        >
          <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-end`}>
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

            {/* Avatar for received messages */}
            {!isOwn && avatar && (
              <div className="shrink-0 mb-0.5 mr-1.5">{avatar}</div>
            )}

            {/* Visual bubble */}
            <div className={`${selectionMode ? 'max-w-[80%]' : 'max-w-[75%]'}`}>
              <div
                className={`rounded-2xl ${isImage ? 'p-1.5' : 'px-3.5 py-2'}
                           ${isOwn ? 'bg-themeblue2 text-white rounded-br-md' : 'bg-themewhite2 text-primary rounded-bl-md'}
                           ${selected ? (isOwn ? 'ring-2 ring-white/50' : 'ring-2 ring-themeblue2/50') : ''}`}
              >
                {/* Sender name label (group chats) */}
                {senderName && !isOwn && (
                  <p className="text-[10px] font-semibold text-themeblue2 mb-0.5">{senderName}</p>
                )}
                {/* Reply-to header */}
                {message.threadId && message.replyPreview && (
                  <div
                    className={`flex items-start gap-1.5 mb-1.5 pb-1.5 border-b cursor-pointer
                               ${isOwn ? 'border-white/20' : 'border-primary/10'}`}
                    onClick={e => { e.stopPropagation(); onOpenThread?.(message.threadId!) }}
                  >
                    <div className={`w-0.5 self-stretch rounded-full shrink-0 ${isOwn ? 'bg-white/40' : 'bg-themeblue2/40'}`} />
                    <div className="min-w-0">
                      <p className={`text-[10px] font-medium ${isOwn ? 'text-white/70' : 'text-themeblue2/70'}`}>
                        Replying to
                      </p>
                      <p className={`text-[11px] truncate ${isOwn ? 'text-white/50' : 'text-tertiary/50'}`}>
                        {message.replyPreview}
                      </p>
                    </div>
                  </div>
                )}
                {renderContent()}
                <div className={`flex items-center gap-1 mt-0.5 ${isImage ? 'px-1.5' : ''} ${isOwn ? 'text-white/60' : 'text-tertiary/40'}`}>
                  <p className="text-[9px]">{formatTime(message.createdAt)}</p>
                  {isOwn && message.messageType === 'request' && (
                    <span className="text-[9px] italic">Pending</span>
                  )}
                  {isOwn && message.messageType !== 'request' && message.status === 'sending' && (
                    <Clock size={10} className="opacity-60" />
                  )}
                  {isOwn && message.messageType !== 'request' && message.status !== 'sending' && (
                    <Check size={10} className="opacity-60" />
                  )}
                </div>
              </div>

              {/* Thread reply count badge */}
              {!!threadReplyCount && threadReplyCount > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); onOpenThread?.(message.id) }}
                  className={`flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium
                             text-themeblue2 hover:bg-themeblue2/10 active:scale-95 transition-all
                             ${isOwn ? 'ml-auto' : ''}`}
                >
                  <MessageSquare size={10} />
                  {threadReplyCount} {threadReplyCount === 1 ? 'reply' : 'replies'}
                </button>
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
