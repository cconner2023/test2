import { useRef, useCallback, useState, useEffect } from 'react'
import { Check, X, Reply, Trash2, Clock, MessageSquare, Play, Pause } from 'lucide-react'
import { GESTURE_THRESHOLDS, isInteractiveTarget } from '../../Utilities/GestureUtils'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import { downloadDecryptedAttachment } from '../../lib/signal/attachmentService'

export type SwipeAction = 'reply' | 'delete'

interface MessageBubbleProps {
  message: DecryptedSignalMessage
  isOwn: boolean
  avatar?: React.ReactNode
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

/** Lazy-load and decrypt an audio attachment, caching the object URL. */
function useDecryptedAudio(path: string | undefined, key: string | undefined) {
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

/** Format seconds to m:ss display. */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const SWIPE_THRESHOLD = 80
const SWIPE_MAX = 120

export function MessageBubble({
  message,
  isOwn,
  avatar,
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
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const replyIconRef = useRef<HTMLDivElement>(null)
  const deleteIconRef = useRef<HTMLDivElement>(null)
  const [showFullImage, setShowFullImage] = useState(false)
  const [tapped, setTapped] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playProgress, setPlayProgress] = useState(0)

  const swipeEnabled = !isEditing

  // request-accepted is an invisible signal — don't render
  if (message.messageType === 'request-accepted') return null

  const imageContent = message.content?.type === 'image' ? message.content : null
  const isImage = !!imageContent
  const voiceContent = message.content?.type === 'voice' ? message.content : null
  const isVoice = !!voiceContent

  const { url: fullImageUrl, loading: imageLoading } = useDecryptedImage(
    imageContent?.path,
    imageContent?.key,
  )
  const { url: audioUrl, loading: audioLoading } = useDecryptedAudio(
    voiceContent?.path,
    voiceContent?.key,
  )

  // ── Direct DOM touch handling ──

  const snapTo = useCallback((x: number) => {
    const el = rowRef.current
    if (!el) return
    el.style.transition = 'transform 200ms ease-out'
    el.style.transform = `translateX(${x}px)`
  }, [])

  const updateIcons = useCallback((dx: number) => {
    if (replyIconRef.current) {
      const progress = Math.min(1, Math.max(0, dx) / SWIPE_THRESHOLD)
      replyIconRef.current.style.opacity = String(progress)
      replyIconRef.current.style.transform = `translateY(-50%) scale(${progress})`
    }
    if (deleteIconRef.current) {
      const progress = Math.min(1, Math.max(0, -dx) / SWIPE_THRESHOLD)
      deleteIconRef.current.style.opacity = String(progress)
      deleteIconRef.current.style.transform = `translateY(-50%) scale(${progress})`
    }
  }, [])

  const resetIcons = useCallback(() => {
    const reset = (ref: React.RefObject<HTMLDivElement | null>) => {
      if (!ref.current) return
      ref.current.style.transition = 'opacity 200ms ease-out, transform 200ms ease-out'
      ref.current.style.opacity = '0'
      ref.current.style.transform = 'translateY(-50%) scale(0)'
      setTimeout(() => { if (ref.current) ref.current.style.transition = 'none' }, 200)
    }
    reset(replyIconRef)
    reset(deleteIconRef)
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]

    // Yield to swipe-back: don't capture touches starting in the left edge zone
    if (t.clientX < GESTURE_THRESHOLDS.EDGE_ZONE) return

    touchRef.current = { startX: t.clientX, startY: t.clientY, swiping: false, dirDecided: false }
    longPressFiredRef.current = false
    setTapped(true)

    // Start long-press timer for context menu
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      setTapped(false)
      onLongPress?.(message, t.clientX, t.clientY)
    }, 500)
  }, [message, onLongPress])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const state = touchRef.current
    if (!state) return
    const t = e.touches[0]
    const dx = t.clientX - state.startX
    const dy = t.clientY - state.startY

    // Cancel long-press if finger moves beyond threshold
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }

    if (!state.dirDecided) {
      if (Math.abs(dx) < GESTURE_THRESHOLDS.DIRECTION_LOCK && Math.abs(dy) < GESTURE_THRESHOLDS.DIRECTION_LOCK) return
      state.dirDecided = true
      if (Math.abs(dy) > Math.abs(dx)) { touchRef.current = null; return }
      if (!swipeEnabled) { touchRef.current = null; return }
      state.swiping = true
    }
    if (!state.swiping) return

    let offset: number
    if (dx > 0) {
      offset = Math.min(SWIPE_MAX, dx)
    } else {
      offset = isOwn ? Math.max(-SWIPE_MAX, dx) : Math.max(-12, dx * 0.1)
    }

    const el = rowRef.current
    if (el) {
      el.style.transition = 'none'
      el.style.transform = `translateX(${offset}px)`
    }
    updateIcons(offset)
  }, [swipeEnabled, isOwn, updateIcons])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    setTapped(false)
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    // If long-press already fired, skip swipe handling
    if (longPressFiredRef.current) { touchRef.current = null; return }

    const state = touchRef.current
    if (!state || !state.swiping) { touchRef.current = null; return }
    touchRef.current = null

    const dx = e.changedTouches[0].clientX - state.startX

    if (dx > SWIPE_THRESHOLD) {
      onSwipeAction?.(message, 'reply')
    } else if (dx < -SWIPE_THRESHOLD && isOwn) {
      onSwipeAction?.(message, 'delete')
    }

    snapTo(0)
    resetIcons()
  }, [snapTo, resetIcons, onSwipeAction, message, isOwn])

  const handleTouchCancel = useCallback(() => {
    setTapped(false)
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    touchRef.current = null
    snapTo(0)
    resetIcons()
  }, [snapTo, resetIcons])

  // Desktop right-click + mobile long-press
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onLongPress?.(message, e.clientX, e.clientY)
  }, [message, onLongPress])

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
      const maxW = 180
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
              <svg className="w-5 h-5 animate-spin text-white/70" style={{ animationDuration: '2s' }} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(20,20)">
                  <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill="currentColor" />
                  <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill="currentColor" transform="rotate(60)" />
                  <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill="currentColor" transform="rotate(120)" />
                </g>
              </svg>
            </div>
          ) : null}
        </div>
      )
    }

    if (isVoice && voiceContent) {
      const waveform = voiceContent.waveform ?? []
      const totalBars = waveform.length || 48

      const handlePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation()
        const audio = audioRef.current
        if (!audio) return
        if (isPlaying) {
          audio.pause()
        } else {
          audio.play()
        }
      }

      return (
        <div className="flex items-center gap-2.5 min-w-[200px]" onClick={e => e.stopPropagation()}>
          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => { setIsPlaying(false); setPlayProgress(0) }}
              onTimeUpdate={() => {
                const audio = audioRef.current
                if (audio && audio.duration) {
                  setPlayProgress(audio.currentTime / audio.duration)
                }
              }}
            />
          )}

          <button
            onClick={handlePlayPause}
            disabled={!audioUrl}
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all
                       ${isOwn ? 'bg-white/20' : 'bg-themeblue2/10'}
                       ${!audioUrl ? 'opacity-40' : ''}`}
          >
            {audioLoading ? (
              <div className={`w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin
                             ${isOwn ? 'border-white/60' : 'border-themeblue2/60'}`} />
            ) : isPlaying ? (
              <Pause size={14} className={isOwn ? 'text-white' : 'text-themeblue2'} />
            ) : (
              <Play size={14} className={`${isOwn ? 'text-white' : 'text-themeblue2'} ml-0.5`} />
            )}
          </button>

          <div className="flex-1 flex items-center gap-px h-6">
            {waveform.map((amp, i) => {
              const filled = i / totalBars < playProgress
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-colors duration-150
                             ${filled
                               ? (isOwn ? 'bg-white' : 'bg-themeblue2')
                               : (isOwn ? 'bg-white/30' : 'bg-primary/15')
                             }`}
                  style={{ height: `${Math.max(12, amp * 100)}%` }}
                />
              )
            })}
          </div>

          <span className={`text-[9pt] tabular-nums shrink-0 ${isOwn ? 'text-white/70' : 'text-tertiary'}`}>
            {formatDuration(isPlaying && audioRef.current ? audioRef.current.currentTime : voiceContent.duration)}
          </span>
        </div>
      )
    }

    return <p className="text-sm whitespace-pre-wrap break-words">{message.plaintext}</p>
  }

  return (
    <>
      {/* Full-width layout container */}
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-end px-1 mb-1.5`}>
        {/* Avatar for received messages */}
        {!isOwn && avatar && (
          <div className="shrink-0 mb-0.5 mr-1.5">{avatar}</div>
        )}

        {/* Bubble wrapper — icons sit behind, bubble slides over them */}
        <div className="relative max-w-[75%]" style={{ touchAction: 'pan-y' }}>
          {/* Reply icon — starts at left edge behind bubble, parallaxes outward on swipe right */}
          {swipeEnabled && (
            <div
              ref={replyIconRef}
              className="absolute left-0 top-1/2 z-0
                         w-7 h-7 rounded-full bg-themeblue2/15 flex items-center justify-center md:hidden pointer-events-none"
              style={{ opacity: 0, transform: 'translateY(-50%) scale(0)', transition: 'none' }}
            >
              <Reply size={14} className="text-themeblue2" />
            </div>
          )}
          {/* Delete icon — starts at right edge behind bubble, scales in on swipe left */}
          {swipeEnabled && isOwn && (
            <div
              ref={deleteIconRef}
              className="absolute right-0 top-1/2 z-0
                         w-7 h-7 rounded-full bg-themeredred/15 flex items-center justify-center md:hidden pointer-events-none"
              style={{ opacity: 0, transform: 'translateY(-50%) scale(0)', transition: 'none' }}
            >
              <Trash2 size={14} className="text-themeredred" />
            </div>
          )}

          {/* Slidable bubble — translates on swipe, sits above icons */}
          <div
            ref={rowRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            onContextMenu={handleContextMenu}
            className="relative z-[1] select-none"
          >
            <div
              className={`rounded-2xl ${isImage && !isVoice ? 'p-1.5' : 'px-3.5 py-2'}
                         ${isOwn ? 'bg-themeblue2 text-white rounded-br-md' : 'bg-themewhite2 text-primary rounded-bl-md'}
                         ${tapped ? 'scale-[0.97]' : ''} transition-transform duration-150`}
            >
              {/* Sender name label (group chats) */}
              {senderName && !isOwn && (
                <p className="text-[9pt] font-semibold text-themeblue2 mb-0.5">{senderName}</p>
              )}
              {renderContent()}
              <div className={`flex items-center gap-1 mt-0.5 ${isImage && !isVoice ? 'px-1.5' : ''} ${isOwn ? 'text-white/60' : 'text-tertiary'}`}>
                <p className="text-[9pt] md:text-[9pt]">{formatTime(message.createdAt)}</p>
                {isOwn && message.messageType === 'request' && (
                  <span className="text-[9pt] md:text-[9pt] italic">Pending</span>
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
                data-tour="messages-thread-badge"
                onClick={e => { e.stopPropagation(); onOpenThread?.(message.originId ?? message.id) }}
                className={`flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[9pt] font-medium
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

      {/* Full-size image overlay */}
      {showFullImage && fullImageUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
          onClick={() => setShowFullImage(false)}
        >
          <button
            onClick={() => setShowFullImage(false)}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-primary/5 active:scale-95 transition-all"
          >
            <X size={18} className="text-themewhite" />
          </button>
          <img
            src={fullImageUrl}
            alt=""
            className="max-w-full max-h-[85vh] object-contain rounded-lg px-4"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
