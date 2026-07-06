import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { Check, CheckCheck, X, Reply, Forward, Trash2, Clock, Play, Pause, Copy, Download, CalendarPlus, Calendar, Map as MapIcon, Package, ChevronRight, MoreHorizontal, ScanLine } from 'lucide-react'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { GESTURE_THRESHOLDS, isInteractiveTarget } from '../../Utilities/GestureUtils'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import { downloadDecryptedAttachment } from '../../lib/signal/attachmentService'
import { ReactionChips, hasReactions, type ReactionCode } from '../Messages/ReactionGlyphs'
import { IntakeRequestCard } from '../Messages/IntakeRequestCard'
import { OncallCallCard } from '../Messages/OncallCallCard'
import { OutsideMessageCard } from '../Messages/OutsideMessageCard'
import { OutsideSessionCard } from '../Messages/OutsideSessionCard'
import { SharedBundleCard } from '../Messages/SharedBundleCard'
import { OverlaySnapshot } from '../MapOverlay/OverlaySnapshot'
import type { LucideIcon } from 'lucide-react'
import { detectFirstDate } from '../../Utilities/dateDetect'
import { detectEncodedNote } from '../../Utilities/noteDecode'
import { relativeShort } from '../../Utilities/conversationActivity'
import { calendarArgsForMessage } from '../../Utilities/messageCalendar'
import { DecodedNotePreview } from '../DecodedNotePreview'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { resolveSwipeActions, type SwipeBinding, type SwipeAction } from '../../Utilities/swipeActions'
export type { SwipeAction }

/** Reveal-icon + tint for each non-disabled swipe binding (mobile swipe affordance). */
const SWIPE_ICON: Record<Exclude<SwipeBinding, 'off'>, { icon: LucideIcon; danger?: boolean }> = {
  reply: { icon: Reply },
  forward: { icon: Forward },
  delete: { icon: Trash2, danger: true },
  menu: { icon: MoreHorizontal },
}

interface MessageBubbleProps {
  message: DecryptedSignalMessage
  isOwn: boolean
  avatar?: React.ReactNode
  onLongPress?: (message: DecryptedSignalMessage, x: number, y: number, rect?: DOMRect, cloneHtml?: string) => void
  onSwipeAction?: (message: DecryptedSignalMessage, action: SwipeAction) => void
  isEditing?: boolean
  editText?: string
  onEditTextChange?: (text: string) => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
  /** Number of thread replies if this message is a thread root. */
  threadReplyCount?: number
  /** ISO timestamp of the most recent reply in this thread (for the "last reply Xm" label). */
  threadLastReplyAt?: string
  /** Callback when user taps to open a thread (reply header or reply count badge). */
  onOpenThread?: (rootMessageId: string) => void
  /** Sender name to display above non-own bubbles in group chats. */
  senderName?: string
  /** When false, embedded action cards (intake request) render read-only.
   * Set by the dev's AdminDrawer system view. */
  intakeActionable?: boolean
  /** Conversation key (peer or group id) — lets the detected-date affordance
   * record where to return after the calendar event is saved/cancelled. */
  conversationId?: string
  /** True when conversationId is a group id. */
  conversationIsGroup?: boolean
  /** Conversation display name, for the header when we hop back. */
  conversationPeerName?: string | null
  /** Briefly ring this bubble — set when we return the user to it from calendar. */
  highlighted?: boolean
  /** Toggle an emoji reaction on this message. When set, the reaction chip row renders. */
  onReact?: (message: DecryptedSignalMessage, emoji: ReactionCode) => void
  /** Current user id — highlights the user's own reaction chips. */
  myUserId?: string
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
const TRUNCATE_THRESHOLD = 280

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
  threadLastReplyAt,
  onOpenThread,
  senderName,
  intakeActionable = true,
  conversationId,
  conversationIsGroup = false,
  conversationPeerName,
  highlighted = false,
  onReact,
  myUserId,
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
  // Bubble snapshot (rect + static HTML clone) captured at touch-start, so a
  // swipe bound to `menu` can lift the same pixel-perfect clone the long-press
  // path uses, even though the live bubble is mid-translate when the swipe ends.
  const snapRef = useRef<{ rect?: DOMRect; html?: string }>({})
  const leftIconRef = useRef<HTMLDivElement>(null)
  const rightIconRef = useRef<HTMLDivElement>(null)
  const [showFullImage, setShowFullImage] = useState(false)
  const [decodeOpen, setDecodeOpen] = useState(false)
  const decodeAnchorRef = useRef<DOMRect | null>(null)
  const [tapped, setTapped] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playProgress, setPlayProgress] = useState(0)

  const requestNewCalendarEvent = useNavigationStore(s => s.requestNewCalendarEvent)
  const openCalendarEvent = useNavigationStore(s => s.openCalendarEvent)
  const setShowMapOverlayDrawer = useNavigationStore(s => s.setShowMapOverlayDrawer)
  const setShowPropertyDrawer = useNavigationStore(s => s.setShowPropertyDrawer)
  const isDevRole = useAuthStore(s => s.isDevRole)

  const sharedRef = message.content?.type === 'shared_ref' ? message.content : null

  const handleOpenRef = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!sharedRef) return
    if (sharedRef.refKind === 'calendar-event') {
      openCalendarEvent(sharedRef.refId)
    } else if (sharedRef.refKind === 'property-item') {
      setShowPropertyDrawer(true, sharedRef.refId)
    } else {
      setShowMapOverlayDrawer(true, sharedRef.refId, sharedRef.featureId ?? null)
    }
  }, [sharedRef, openCalendarEvent, setShowMapOverlayDrawer, setShowPropertyDrawer])

  // Detect a schedulable date in text content — drives the floating "add to
  // calendar" affordance. Dev-gated for now. Runs on already-decrypted local
  // plaintext only.
  const detectedDate = useMemo(() => {
    if (!isDevRole) return null
    if (message.content && message.content.type !== 'text') return null
    return detectFirstDate(message.plaintext ?? '')
  }, [isDevRole, message.content, message.plaintext])

  const handleAddToCalendar = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!detectedDate) return
    requestNewCalendarEvent(
      ...calendarArgsForMessage(message.plaintext ?? '', detectedDate, {
        conversationId,
        conversationIsGroup,
        conversationPeerName,
        messageId: message.id,
      }),
    )
  }, [detectedDate, message.plaintext, message.id, requestNewCalendarEvent, conversationId, conversationIsGroup, conversationPeerName])

  // Detect a shared encoded note (enc:/9L:/TC3|/plain) in the message text —
  // drives the "decode" affordance. Cheap sync scan; the actual decrypt+parse
  // happens on tap in DecodedNotePreview, on-device only (no wire/PHI exposure).
  const decodedNote = useMemo(() => {
    if (message.content && message.content.type !== 'text') return null
    return detectEncodedNote(message.plaintext ?? '')
  }, [message.content, message.plaintext])

  const handleDecode = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    decodeAnchorRef.current = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDecodeOpen(true)
  }, [])

  // Inline message affordances (add-to-calendar, decode-note) — share one color
  // and slot. Rendered as a single cluster on the ellipsis side of the bubble.
  const affordances: { key: string; icon: LucideIcon; title: string; onClick: (e: React.MouseEvent) => void }[] = []
  if (detectedDate && !isEditing) {
    affordances.push({ key: 'calendar', icon: CalendarPlus, title: `Add to calendar — ${detectedDate.date.toLocaleDateString()}`, onClick: handleAddToCalendar })
  }
  if (decodedNote && !isEditing) {
    affordances.push({ key: 'decode', icon: ScanLine, title: 'Decode note', onClick: handleDecode })
  }

  const renderAffordances = (side: 'left' | 'right') =>
    affordances.length > 0 ? (
      <div className={`shrink-0 self-center flex items-center gap-1 ${side === 'left' ? 'mr-1.5' : 'ml-1.5'}`}>
        {affordances.map(a => {
          const Icon = a.icon
          return (
            <button
              key={a.key}
              onClick={a.onClick}
              title={a.title}
              aria-label={a.title}
              className="w-7 h-7 rounded-full bg-themeblue3 text-white shadow-sm
                         flex items-center justify-center active:scale-95 transition-all"
            >
              <Icon size={14} />
            </button>
          )
        })}
      </div>
    ) : null

  const swipeEnabled = !isEditing

  // ── Per-direction swipe bindings (user preference, cross-device) ──
  // ltr = "swipe right" (dx > 0); rtl = "swipe left" (dx < 0). A `delete` binding
  // is only meaningful on a message the user can actually delete (own message);
  // on any other bubble it degrades to disabled so the swipe just rubber-bands.
  const swipePrefs = useAuthStore(s => s.profile?.swipeActions)
  const resolved = resolveSwipeActions(swipePrefs)
  const gate = (b: SwipeBinding): SwipeBinding => (b === 'delete' && !isOwn ? 'off' : b)
  const ltrBinding = gate(resolved.ltr)
  const rtlBinding = gate(resolved.rtl)
  const ltrEnabled = swipeEnabled && ltrBinding !== 'off'
  const rtlEnabled = swipeEnabled && rtlBinding !== 'off'

  // request-accepted is an invisible signal — don't render
  if (message.messageType === 'request-accepted') return null

  // Outside event-intake: the anon-authored intake-request lands as a system
  // message with structured IntakeRequestContent. Render the dedicated card —
  // visible to all supervisors-of-clinic; mint/rotate/kill UI stays dev-gated.
  if (message.content?.type === 'intake_request') {
    return (
      <IntakeRequestCard
        message={message}
        content={message.content}
        isOwn={isOwn}
        avatar={avatar}
        senderName={senderName}
        actionable={intakeActionable}
      />
    )
  }

  // Resolved outside→on-call card: connected / missed / declined / voicemail.
  if (message.content?.type === 'oncall_call') {
    return (
      <OncallCallCard
        content={message.content}
        createdAt={message.createdAt}
        onLongPress={(x, y, rect, html) => onLongPress?.(message, x, y, rect, html)}
        messageId={message.id}
      />
    )
  }

  // Cross-cluster shared object bundle: a frozen calendar event / map overlay
  // from another cluster, rendered as an "Add to my cluster" card. The dedicated
  // card mounts the calendar/overlay write hooks itself (only for bundle
  // messages) so the main bubble path stays light.
  if (message.content?.type === 'shared_bundle') {
    return (
      <SharedBundleCard
        content={message.content}
        isOwn={isOwn}
        senderName={senderName}
        messageId={message.id}
        onLongPress={(x, y, rect, html) => onLongPress?.(message, x, y, rect, html)}
      />
    )
  }

  // Outside→cluster one-way message card: sealed text note from an outside party.
  if (message.content?.type === 'outside_message') {
    return (
      <OutsideMessageCard
        content={message.content}
        createdAt={message.createdAt}
        onLongPress={(x, y, rect, html) => onLongPress?.(message, x, y, rect, html)}
        messageId={message.id}
      />
    )
  }

  // Outside-session reply-lane card: live status + reply history + composer.
  if (message.content?.type === 'outside_session') {
    return (
      <OutsideSessionCard
        content={message.content}
        createdAt={message.createdAt}
        onLongPress={(x, y, rect, html) => onLongPress?.(message, x, y, rect, html)}
        messageId={message.id}
      />
    )
  }
  // Out-of-band session updates fold onto the card — never a standalone bubble.
  if (message.content?.type === 'outside_session_update') return null

  // System text notices (operator → user / clinic broadcasts) render as normal
  // chat bubbles — sender-name header (group) or conversation chrome name (1:1)
  // plus the message body — so they read like any other message. The dedicated
  // intake / outside-message / on-call cards are handled by the content-type
  // branches above; only plain `text` system messages reach the normal path here.

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
    if (leftIconRef.current) {
      const progress = Math.min(1, Math.max(0, dx) / SWIPE_THRESHOLD)
      leftIconRef.current.style.opacity = String(progress)
      leftIconRef.current.style.transform = `translateY(-50%) scale(${progress})`
    }
    if (rightIconRef.current) {
      const progress = Math.min(1, Math.max(0, -dx) / SWIPE_THRESHOLD)
      rightIconRef.current.style.opacity = String(progress)
      rightIconRef.current.style.transform = `translateY(-50%) scale(${progress})`
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
    reset(leftIconRef)
    reset(rightIconRef)
  }, [])

  // Snapshot the bubble's rect + a static HTML clone so the context menu can lift
  // a pixel-perfect copy of it. Capture BEFORE the press-scale is applied so the
  // rect and markup are at rest. Strip the tapped classes defensively.
  const captureBubble = useCallback((): { rect?: DOMRect; html?: string } => {
    const el = rowRef.current
    if (!el) return {}
    return {
      rect: el.getBoundingClientRect(),
      html: el.outerHTML.replace('scale-[0.92] brightness-90', ''),
    }
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]

    // Yield to swipe-back: don't capture touches starting in the left edge zone
    if (t.clientX < GESTURE_THRESHOLDS.EDGE_ZONE) return

    const snap = captureBubble()
    snapRef.current = snap
    touchRef.current = { startX: t.clientX, startY: t.clientY, swiping: false, dirDecided: false }
    longPressFiredRef.current = false
    setTapped(true)

    // Start long-press timer for context menu
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      setTapped(false)
      onLongPress?.(message, t.clientX, t.clientY, snap.rect, snap.html)
    }, 500)
  }, [message, onLongPress, captureBubble])

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

    // Full swipe only in an enabled direction; a disabled direction rubber-bands.
    let offset: number
    if (dx > 0) {
      offset = ltrEnabled ? Math.min(SWIPE_MAX, dx) : Math.min(12, dx * 0.1)
    } else {
      offset = rtlEnabled ? Math.max(-SWIPE_MAX, dx) : Math.max(-12, dx * 0.1)
    }

    const el = rowRef.current
    if (el) {
      el.style.transition = 'none'
      el.style.transform = `translateX(${offset}px)`
    }
    updateIcons(offset)
  }, [swipeEnabled, ltrEnabled, rtlEnabled, updateIcons])

  // Run a resolved swipe binding. Immediate actions (reply/forward/delete) fire
  // through onSwipeAction; `menu` lifts the captured clone into the context menu
  // (reusing the long-press pipeline); `off` is a no-op.
  const fireSwipe = useCallback((binding: SwipeBinding) => {
    if (binding === 'off') return
    if (binding === 'menu') {
      const { rect, html } = snapRef.current
      const cx = rect ? rect.left + rect.width / 2 : 0
      const cy = rect ? rect.top + rect.height / 2 : 0
      onLongPress?.(message, cx, cy, rect, html)
      return
    }
    onSwipeAction?.(message, binding)
  }, [message, onLongPress, onSwipeAction])

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

    if (dx > SWIPE_THRESHOLD && ltrEnabled) fireSwipe(ltrBinding)
    else if (dx < -SWIPE_THRESHOLD && rtlEnabled) fireSwipe(rtlBinding)

    snapTo(0)
    resetIcons()
  }, [snapTo, resetIcons, fireSwipe, ltrEnabled, rtlEnabled, ltrBinding, rtlBinding])

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
    const snap = captureBubble()
    onLongPress?.(message, e.clientX, e.clientY, snap.rect, snap.html)
  }, [message, onLongPress, captureBubble])

  // Hover-only ellipses (desktop) — anchors the context menu to its own rect
  // so the menu lands beside the message even without a pointer event.
  const handleEllipsesClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const snap = captureBubble()
    const r = snap.rect ?? (e.currentTarget as HTMLElement).getBoundingClientRect()
    onLongPress?.(message, r.left + r.width / 2, r.top + r.height / 2, snap.rect, snap.html)
  }, [message, onLongPress, captureBubble])

  const handleImageTap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (fullImageUrl) setShowFullImage(true)
  }, [fullImageUrl])

  // ── Render content ────────────────────────────────────────────────────

  const renderContent = () => {
    if (sharedRef) {
      const RefIcon = sharedRef.refKind === 'calendar-event' ? Calendar : sharedRef.refKind === 'property-item' ? Package : MapIcon
      const refRow = (
        <button
          onClick={handleOpenRef}
          className={`flex items-center gap-2.5 min-w-[180px] max-w-[240px] -mx-1 px-2 py-1 rounded-lg active:scale-[0.98] transition-all text-left
                     ${isOwn ? 'hover:bg-white/10' : 'hover:bg-primary/5'}`}
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isOwn ? 'bg-white/20' : 'bg-themeblue3/10'}`}>
            <RefIcon size={17} className={isOwn ? 'text-white' : 'text-themeblue3'} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium truncate ${isOwn ? 'text-white' : 'text-primary'}`}>{sharedRef.label}</p>
            {sharedRef.subLabel && (
              <p className={`text-[9pt] truncate ${isOwn ? 'text-white/70' : 'text-tertiary'}`}>{sharedRef.subLabel}</p>
            )}
          </div>
          <ChevronRight size={16} className={`shrink-0 ${isOwn ? 'text-white/60' : 'text-tertiary'}`} />
        </button>
      )
      // A shared map overlay shows a static thumbnail of its features above the
      // row. Resolves from the local overlays cache; falls back to a map-icon
      // placeholder when the overlay hasn't synced in yet.
      if (sharedRef.refKind === 'map-overlay') {
        return (
          <div className="flex flex-col gap-1.5">
            <OverlaySnapshot
              overlayId={sharedRef.refId}
              width={240}
              height={120}
              onClick={handleOpenRef}
              className="rounded-lg"
            />
            {refRow}
          </div>
        )
      }
      return refRow
    }

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

    const fullText = message.plaintext ?? ''
    const shouldTruncate = fullText.length > TRUNCATE_THRESHOLD
    const displayText = !expanded && shouldTruncate
      ? fullText.slice(0, TRUNCATE_THRESHOLD).trimEnd() + '…'
      : fullText
    return (
      <>
        <p className="text-sm whitespace-pre-wrap break-words">{displayText}</p>
        {shouldTruncate && (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
            className={`text-[9pt] font-semibold mt-1 ${isOwn ? 'text-white/85 hover:text-white' : 'text-themeblue2 hover:text-themeblue3'} transition-colors`}
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </>
    )
  }

  return (
    <>
      {/* Full-width layout container — group enables hover-only ellipsis on desktop.
          Extra bottom room when reaction badges overhang the bubble's bottom edge. */}
      <div className={`group flex ${isOwn ? 'justify-end' : 'justify-start'} items-center px-1 ${onReact && hasReactions(message.reactions) ? 'mt-4 mb-1.5' : 'mb-1.5'}`}>
        {/* Hover ellipses (desktop only) — left of own bubble */}
        {isOwn && onLongPress && (
          <button
            onClick={handleEllipsesClick}
            aria-label="Message actions"
            className="hidden md:flex shrink-0 mr-1.5 w-7 h-7 rounded-full hover:bg-primary/10
                       items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal size={14} className="text-tertiary" />
          </button>
        )}

        {/* Inline affordances (calendar / decode) — ride on the ellipsis side
            (own → left). Calendar surfaces on a schedulable date (dev-gated);
            decode on a shared encoded note. */}
        {isOwn && renderAffordances('left')}

        {/* Bubble wrapper — icons sit behind, bubble slides over them. */}
        <div
          className="relative max-w-[65%]"
          style={{ touchAction: 'pan-y' }}
        >
          {/* Left reveal icon — behind the bubble's left edge, parallaxes out on a
              swipe-right (dx>0). Shows the ltr ("swipe right") binding's icon. */}
          {ltrEnabled && ltrBinding !== 'off' && (() => {
            const meta = SWIPE_ICON[ltrBinding]
            const Icon = meta.icon
            return (
              <div
                ref={leftIconRef}
                className={`absolute left-0 top-1/2 z-0 w-7 h-7 rounded-full flex items-center justify-center md:hidden pointer-events-none ${meta.danger ? 'bg-themeredred/15' : 'bg-themeblue2/15'}`}
                style={{ opacity: 0, transform: 'translateY(-50%) scale(0)', transition: 'none' }}
              >
                <Icon size={14} className={meta.danger ? 'text-themeredred' : 'text-themeblue2'} />
              </div>
            )
          })()}
          {/* Right reveal icon — behind the bubble's right edge, scales in on a
              swipe-left (dx<0). Shows the rtl ("swipe left") binding's icon. */}
          {rtlEnabled && rtlBinding !== 'off' && (() => {
            const meta = SWIPE_ICON[rtlBinding]
            const Icon = meta.icon
            return (
              <div
                ref={rightIconRef}
                className={`absolute right-0 top-1/2 z-0 w-7 h-7 rounded-full flex items-center justify-center md:hidden pointer-events-none ${meta.danger ? 'bg-themeredred/15' : 'bg-themeblue2/15'}`}
                style={{ opacity: 0, transform: 'translateY(-50%) scale(0)', transition: 'none' }}
              >
                <Icon size={14} className={meta.danger ? 'text-themeredred' : 'text-themeblue2'} />
              </div>
            )
          })()}

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
              className={`relative rounded-2xl ${isImage && !isVoice ? 'p-1.5' : 'px-3.5 py-2'}
                         ${isOwn ? 'bg-themeblue3 text-white rounded-br-md' : 'bg-themewhite2 text-primary rounded-bl-md'}
                         ${highlighted ? 'ring-2 ring-themeblue3/60 ring-offset-1' : ''}
                         ${tapped ? 'scale-[0.92] brightness-90' : ''} transition-all duration-150 ease-out`}
            >
              {/* In-bubble header — avatar + sender name, separator line, then body.
                  Group chats only (senderName present); 1:1 conversations skip the header
                  since the peer is already identified by the conversation chrome. */}
              {!isOwn && senderName && (
                <div className={`flex items-center gap-1.5 ${isImage && !isVoice ? 'px-1 pt-1' : ''} pb-1.5 mb-1.5 border-b border-current/10`}>
                  {avatar && <div className="shrink-0">{avatar}</div>}
                  <span className="text-[9pt] font-semibold text-themeblue2 truncate">{senderName}</span>
                </div>
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
                {isOwn && message.messageType !== 'request' && message.status === 'delivered' && (
                  <CheckCheck size={10} className="opacity-60" />
                )}
                {isOwn && message.messageType !== 'request' && message.status !== 'sending' && message.status !== 'delivered' && (
                  <Check size={10} className="opacity-60" />
                )}
              </div>

              {/* Circular emoji reaction badges — straddle the bubble's bottom corner. */}
              {onReact && (
                <ReactionChips
                  reactions={message.reactions}
                  myUserId={myUserId}
                  onToggle={code => onReact(message, code)}
                />
              )}
            </div>

            {/* Thread affordance — Slack-style flush link row (NOT a pill): branch
                icon + blue "N replies" link + muted last-reply time + trailing
                chevron. Replies are hidden from the main view, so this is the only
                in-conversation entry point to the thread. Chevron is always shown
                (not hover-gated) — iOS Safari has no hover. */}
            {!!threadReplyCount && threadReplyCount > 0 && (
              <button
                onClick={e => { e.stopPropagation(); onOpenThread?.(message.originId ?? message.id) }}
                className={`flex items-center gap-1.5 mt-1 -ml-1 pl-1 pr-1.5 py-0.5 rounded-md max-w-full
                           hover:bg-themeblue3/8 active:scale-[0.98] transition-colors
                           ${isOwn ? 'ml-auto -mr-1' : ''}`}
              >
                <Reply size={13} className="shrink-0 text-themeblue2" />
                <span className="text-[9.5pt] font-semibold text-themeblue2 shrink-0">
                  {threadReplyCount} {threadReplyCount === 1 ? 'reply' : 'replies'}
                </span>
                {threadLastReplyAt && (
                  <span className="text-[9pt] text-tertiary truncate">
                    Last reply {relativeShort(threadLastReplyAt)}
                  </span>
                )}
                <ChevronRight size={13} className="shrink-0 text-tertiary/60 ml-auto" />
              </button>
            )}
          </div>
        </div>

        {/* Inline affordances for peer bubbles — right side, beside the ellipses. */}
        {!isOwn && renderAffordances('right')}

        {/* Hover ellipses (desktop only) — right of peer bubble */}
        {!isOwn && onLongPress && (
          <button
            onClick={handleEllipsesClick}
            aria-label="Message actions"
            className="hidden md:flex shrink-0 ml-1.5 w-7 h-7 rounded-full hover:bg-primary/10
                       items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal size={14} className="text-tertiary" />
          </button>
        )}
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
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-themewhite/95 rounded-full px-3 py-1.5 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <ActionButton
              icon={Copy}
              label="Copy image"
              onClick={async () => {
                try {
                  const blob = await (await fetch(fullImageUrl)).blob()
                  const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png'
                  const item = new ClipboardItem({ [type]: type === blob.type ? blob : new Blob([blob], { type }) })
                  await navigator.clipboard.write([item])
                } catch {}
              }}
            />
            <ActionButton
              icon={Download}
              label="Save image"
              onClick={async () => {
                try {
                  const blob = await (await fetch(fullImageUrl)).blob()
                  const ext = (blob.type.split('/')[1] || 'png').split('+')[0]
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `image-${Date.now()}.${ext}`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  setTimeout(() => URL.revokeObjectURL(url), 1000)
                } catch {}
              }}
            />
          </div>
        </div>
      )}

      {/* Decoded-note preview — reuses the barcode-import overlay. */}
      {decodedNote && (
        <DecodedNotePreview
          token={decodedNote.token}
          isOpen={decodeOpen}
          anchorRect={decodeAnchorRef.current}
          onClose={() => setDecodeOpen(false)}
        />
      )}
    </>
  )
}
