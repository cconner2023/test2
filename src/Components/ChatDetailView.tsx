import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { ArrowUp, X, Plus, Mic, Copy, Pencil, Download, Reply, Trash2, Forward, SmilePlus, CalendarPlus, ScanLine, Calendar, Package, Map as MapIcon, Building2 } from 'lucide-react'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { GlassBand } from '@/Components/primitives/GlassBand'
import { MessageBubble } from './Settings/MessageBubble'
import { SharedObjectPicker } from './Messages/SharedObjectPicker'
import { ImageEditor } from './ImageEditor'
import type { MessageContent, SharedBundleContent } from '../lib/signal/messageContent'
import { packBundle, bundleSourceToBundle, type BundleSource } from '../lib/objectBundle'
import { ContextMenu, type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { ReactionGlyph, REACTION_CODES, REACTION_LABELS } from './Messages/ReactionGlyphs'
import { useMessagesContext } from '../Hooks/MessagesContext'
import { RecipientPicker } from './Messages/RecipientPicker'
import { useAuth } from '../Hooks/useAuth'
import { useAuthStore } from '../stores/useAuthStore'
import { useImagePaste } from '../Hooks/useImagePaste'
import { useChatInteractions } from '../Hooks/useChatInteractions'
import { useNavigationStore } from '../stores/useNavigationStore'
import { useSharedObjectActions } from '../Hooks/useSharedObjectActions'
import { detectFirstDate } from '../Utilities/dateDetect'
import { detectEncodedNote } from '../Utilities/noteDecode'
import { calendarArgsForMessage } from '../Utilities/messageCalendar'
import { DecodedNotePreview } from './DecodedNotePreview'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useVoiceRecorder } from '../Hooks/useVoiceRecorder'
import type { VoiceRecordingResult } from '../Hooks/useVoiceRecorder'
import { playSendSound } from '../lib/soundService'
import type { DecryptedSignalMessage } from '../lib/signal/transportTypes'
import type { UnavailableReason } from '../Hooks/usePeerAvailability'
import type { RequestStatus } from '../Hooks/useMessages'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'

export interface ParticipantStatus {
  userId: string
  displayName: string
  available: boolean
  reason?: UnavailableReason
}

export interface ChatDetailViewProps {
  conversationId: string
  conversations: Record<string, DecryptedSignalMessage[]>
  medics: ClinicMedic[]
  sendMessage: (id: string, text: string, threadId?: string) => Promise<boolean>
  sendImage: (id: string, file: File) => Promise<boolean>
  /** Send a structured-content message (e.g. a shared object reference). When
   * supplied, the composer's + button opens an attachment menu (photo + share
   * event / map). When omitted, + falls back to the direct photo picker. */
  sendStructured?: (id: string, content: MessageContent, originId: string, preview: string) => Promise<boolean>
  sendVoice?: (id: string, recording: VoiceRecordingResult) => Promise<boolean>
  editMessage: (id: string, msgId: string, text: string) => void
  deleteMessages: (id: string, msgIds: string[]) => void
  markAsRead: (id: string) => void
  fetchHistory: (id: string) => Promise<void>
  sending: boolean
  onBack?: () => void
  participants: ParticipantStatus[]
  resolveAvatar: (msg: DecryptedSignalMessage, isOwn: boolean) => ReactNode | undefined
  resolveSenderName?: (msg: DecryptedSignalMessage) => string | undefined
  requestFlow?: {
    status: RequestStatus
    peerName?: string
    onAccept: () => void
    onDecline: () => void
  }
  isSelfChat?: boolean
  showForward?: boolean
  emptyText?: string
  mobileHeader: ReactNode
  desktopHeader?: ReactNode
  /** Register a back-interceptor with the owning drawer. When a thread is open
   * the closer pops the thread (returns true); otherwise it returns false so the
   * drawer's back proceeds to leave the conversation. Lets the panel/BaseDrawer
   * back handle thread-close on both mobile and desktop without a separate bar. */
  registerThreadBack?: (closer: (() => boolean) | null) => void
  /** Hide the image upload entry point (+ button). For surfaces whose send
   * path doesn't accept attachments — currently the admin system-conversation
   * view, which v1 routes through `sendSystemMessageToUser` (text only). */
  hideImageUpload?: boolean
  /** When false, embedded intake-request cards render read-only (no
   * Email/Approve/Decline pill). Set by the dev's AdminDrawer system view —
   * intake actions belong to supervisors in the clinic system group. */
  intakeActionable?: boolean
  /** Enable emoji reactions (chip row + React menu item). Default true; the
   *  admin system-conversation view passes false. */
  canReact?: boolean
  /** True when this conversation is a group — lets a detected-date message
   * record the right return target for the calendar round-trip. */
  conversationIsGroup?: boolean
  /** Display name for the conversation, used when returning from calendar. */
  conversationPeerName?: string | null
  /** When set, scroll to and briefly highlight this message on open (e.g.
   * returning from a calendar event opened off a detected date). */
  scrollToMessageId?: string | null
  /** Called once the scroll target has been honored, so the caller can clear it. */
  onScrollConsumed?: () => void
  children?: ReactNode
}

// ── Unavailability Banner ─────────────────────────────────────────────────

function UnavailableBanner({ participants, peerName }: { participants: ParticipantStatus[]; peerName?: string }) {
  const unavailable = participants.filter(p => !p.available)
  if (unavailable.length === 0) return null

  const allUnavailable = unavailable.length === participants.length

  if (allUnavailable && participants.length === 1) {
    const p = unavailable[0]
    const message = p.reason === 'no_keys'
      ? `${peerName ?? p.displayName} hasn't set up messaging keys yet. Messages can't be delivered until they log in.`
      : `${peerName ?? p.displayName} hasn't set up a device yet. Messages can't be delivered until they log in.`
    return (
      <div className="shrink-0 px-4 py-3 border-t border-primary/10">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="w-2 h-2 bg-transparent shrink-0" />
          <p className="text-[10pt] text-secondary">{message}</p>
        </div>
      </div>
    )
  }

  const names = unavailable.map(p => p.displayName).join(', ')
  return (
    <div className="shrink-0 px-4 py-1.5">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-themeyellow/10">
        <div className="w-2 h-2 rounded-full bg-themeyellow shrink-0" />
        <p className="text-[10pt] text-themeyellow">
          {names} can't receive messages
        </p>
      </div>
    </div>
  )
}

// ── Chat Detail View (shared between 1:1 and group chats) ─────────────────

export function ChatDetailView({
  conversationId,
  conversations,
  sendMessage,
  sendImage,
  sendStructured,
  sendVoice,
  editMessage,
  deleteMessages,
  markAsRead,
  fetchHistory,
  sending,
  onBack,
  participants,
  resolveAvatar,
  resolveSenderName,
  requestFlow,
  isSelfChat,
  showForward,
  emptyText = 'No messages',
  mobileHeader,
  desktopHeader,
  registerThreadBack,
  hideImageUpload,
  intakeActionable = true,
  canReact = true,
  conversationIsGroup = false,
  conversationPeerName,
  scrollToMessageId,
  onScrollConsumed,
  children,
}: ChatDetailViewProps) {
  const { user, clinicId } = useAuth()
  const userId = user?.id ?? ''
  const reactToMessage = useMessagesContext()?.reactToMessage
  const handleReact = useCallback((message: DecryptedSignalMessage, emoji: string) => {
    reactToMessage?.(conversationId, message, emoji)
  }, [reactToMessage, conversationId])
  const reactionsEnabled = canReact && !!reactToMessage
  const signalReady = useAuthStore(s => s.signalReady)
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // A picked/pasted image awaiting the zoom/crop review step before it's sent.
  const [editFile, setEditFile] = useState<File | null>(null)
  const conversationRef = useRef<HTMLDivElement>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  // The share menu anchors to this live button ref (not a captured rect) so an iOS
  // keyboard collapse — the input was focused when + was tapped — re-pins it.
  const attachBtnRef = useRef<HTMLButtonElement>(null)

  const handleShareObject = useCallback((content: MessageContent) => {
    if (!sendStructured) return
    const originId = crypto.randomUUID()
    const preview = content.type === 'shared_ref' || content.type === 'shared_bundle' ? content.label : 'Shared item'
    void sendStructured(conversationId, content, originId, preview)
  }, [sendStructured, conversationId])

  // Text templates / order sets have no live shared_ref (objectBundle.ts) — pack
  // a frozen note-blocks bundle and send it as shared_bundle into this chat.
  const handleShareBundle = useCallback(async (source: BundleSource) => {
    if (!sendStructured || !userId) return
    const bundle = bundleSourceToBundle(source, user?.clinicName ?? 'another cluster', new Date().toISOString())
    const packed = await packBundle(userId, bundle)
    if (!packed.ok) return
    const content: SharedBundleContent = {
      type: 'shared_bundle',
      bundleKind: packed.data.kind,
      path: packed.data.path,
      key: packed.data.key,
      contentHash: packed.data.contentHash,
      label: packed.data.label,
      ...(packed.data.subLabel ? { subLabel: packed.data.subLabel } : {}),
      sourceCluster: packed.data.sourceCluster,
    }
    void sendStructured(conversationId, content, crypto.randomUUID(), content.label)
  }, [sendStructured, userId, user?.clinicName, conversationId])

  const [threadClosing, setThreadClosing] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const messages = conversations[conversationId] ?? []

  const {
    contextMenu, contextMsg,
    handleLongPress, handleCopy, handleStartEdit, handleSaveImage, closeContextMenu,
    editingMessageId, editText, setEditText, handleSaveEdit, handleCancelEdit,
    showForwardPicker, forwardingMessage, handleContextForward, handleForwardSelect, closeForwardPicker,
    replyingTo, setReplyingTo, handleContextReply,
    activeThreadId, setActiveThreadId, handleOpenThread,
    pendingDelete, handleContextDelete, handleConfirmDelete, closePendingDelete,
    handleSwipeAction,
    threadReplyCounts, threadLastReply, threadMessages, mainViewMessages,
  } = useChatInteractions({
    conversationKey: conversationId,
    userId,
    messages,
    editMessage,
    deleteMessages,
    inputRef,
    sendMessage,
  })

  // Lifted-menu affordances mirroring the inline bubble icons: add-to-calendar
  // (dev-gated) and decode-note. Both act on contextMsg.
  const requestNewCalendarEvent = useNavigationStore(s => s.requestNewCalendarEvent)
  const isDevRole = useAuthStore(s => s.isDevRole)
  // Open / Add actions for shared-object messages — folded into the lifted menu.
  const sharedActions = useSharedObjectActions()
  const [decodeMenu, setDecodeMenu] = useState<{ token: string; rect: DOMRect | null } | null>(null)

  const handleMenuAddToCalendar = useCallback(() => {
    if (!contextMsg) return
    const detected = detectFirstDate(contextMsg.plaintext ?? '')
    if (!detected) return
    requestNewCalendarEvent(
      ...calendarArgsForMessage(contextMsg.plaintext ?? '', detected, {
        conversationId,
        conversationIsGroup,
        conversationPeerName,
        messageId: contextMsg.id,
      }),
    )
    closeContextMenu()
  }, [contextMsg, requestNewCalendarEvent, conversationId, conversationIsGroup, conversationPeerName, closeContextMenu])

  const handleMenuDecode = useCallback(() => {
    if (!contextMsg) return
    const hit = detectEncodedNote(contextMsg.plaintext ?? '')
    if (!hit) return
    setDecodeMenu({ token: hit.token, rect: contextMenu?.rect ?? null })
    closeContextMenu()
  }, [contextMsg, contextMenu, closeContextMenu])

  const {
    isRecording, duration: recDuration, amplitude,
    startRecording, stopRecording, cancelRecording,
  } = useVoiceRecorder()

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    }
  }, [text])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [activeThreadId ? messages.length : mainViewMessages.length])

  // Scroll to and highlight a specific message — used when returning from a
  // calendar event that was opened off a detected date. Retries on message
  // arrival (history may still be loading); consumes only once it lands.
  useEffect(() => {
    if (!scrollToMessageId) return
    const container = scrollRef.current
    if (!container) return
    const el = container.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(scrollToMessageId)}"]`)
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    setHighlightId(scrollToMessageId)
    onScrollConsumed?.()
    const timer = setTimeout(() => setHighlightId(null), 1600)
    return () => clearTimeout(timer)
  }, [scrollToMessageId, mainViewMessages.length, onScrollConsumed])

  // Mark as read + fetch history on open
  useEffect(() => {
    markAsRead(conversationId)
    fetchHistory(conversationId)
  }, [conversationId, markAsRead, fetchHistory])

  // Reset interaction state on conversation change
  useEffect(() => {
    closeForwardPicker()
    setReplyingTo(null)
    setActiveThreadId(null)
    setThreadClosing(false)
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCloseThread = useCallback(() => {
    setThreadClosing(true)
    setTimeout(() => {
      setActiveThreadId(null)
      setThreadClosing(false)
    }, 200)
  }, [setActiveThreadId])

  // The thread overlay reuses the conversation header (no separate thread bar) on
  // mobile, and the BaseDrawer header on desktop — both route through the panel's
  // single back handler. Register a closer so that back pops the thread first
  // (returns true) and only leaves the conversation when no thread is open.
  useEffect(() => {
    if (!registerThreadBack) return
    registerThreadBack(activeThreadId
      ? () => { handleCloseThread(); return true }
      : () => false)
    return () => registerThreadBack(null)
  }, [registerThreadBack, activeThreadId, handleCloseThread])

  // Image paste — route into the zoom/crop review step (not an immediate send).
  const handlePastedImage = useCallback((file: File) => {
    setEditFile(file)
  }, [])
  useImagePaste(!sending && !hideImageUpload, handlePastedImage)

  // Review step confirmed: send the cropped image through the unchanged pipeline.
  const handleEditedImage = useCallback(async (edited: File) => {
    setEditFile(null)
    const success = await sendImage(conversationId, edited)
    if (success) playSendSound()
  }, [sendImage, conversationId])

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const threadId = activeThreadId ?? replyingTo?.originId ?? replyingTo?.id ?? undefined
    setText('')
    setReplyingTo(null)
    const success = await sendMessage(conversationId, trimmed, threadId)
    if (success) {
      playSendSound()
    } else {
      setText(trimmed)
    }
    inputRef.current?.focus()
  }, [text, sending, sendMessage, conversationId, activeThreadId, replyingTo])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }, [handleSend])

  // Force the text/plain clipboard flavor on paste. iOS Safari otherwise picks
  // the text/html flavor (e.g. from WriteNote's copyWithHtml dual-flavor copy)
  // and mangles block boundaries — line breaks come through as %20 artifacts.
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const plain = e.clipboardData.getData('text/plain')
    if (!plain) return // image / no-text paste — let useImagePaste handle it
    e.preventDefault()
    const el = e.currentTarget
    const start = el.selectionStart ?? text.length
    const end = el.selectionEnd ?? text.length
    const next = text.slice(0, start) + plain + text.slice(end)
    setText(next)
    requestAnimationFrame(() => {
      const pos = start + plain.length
      el.setSelectionRange(pos, pos)
    })
  }, [text])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setEditFile(file)
    e.target.value = ''
  }, [])

  const handleSendVoice = useCallback(async () => {
    const result = await stopRecording()
    if (result && sendVoice) {
      const success = await sendVoice(conversationId, result)
      if (success) playSendSound()
    }
  }, [stopRecording, sendVoice, conversationId])

  // Swipe-back gestures for mobile navigation
  const mainSwipeBack = useSwipeBack(onBack)
  const threadSwipeBack = useSwipeBack(activeThreadId ? handleCloseThread : undefined)

  // Availability logic
  const unavailableParticipants = participants.filter(p => !p.available)
  const allUnavailable = participants.length > 0 && unavailableParticipants.length === participants.length
  const someUnavailable = unavailableParticipants.length > 0 && !allUnavailable

  const inputDisabled = sending
    || !signalReady
    || (allUnavailable && !isSelfChat)

  const canUploadImage = !hideImageUpload && (!requestFlow || requestFlow.status === 'accepted' || requestFlow.status === 'none' || !!isSelfChat)

  const canSendVoice = !!sendVoice && (
    !requestFlow || requestFlow.status === 'accepted' || requestFlow.status === 'none' || !!isSelfChat
  )

  const placeholder = activeThreadId ? 'Reply in thread...' : 'Type a message...'

  const blockedReason: string | null = (() => {
    if (requestFlow?.status === 'sent') {
      return `Waiting for ${requestFlow.peerName ?? 'this user'} to accept your request`
    }
    if (allUnavailable && !isSelfChat) {
      if (unavailableParticipants.length === 1 && participants.length === 1) {
        const p = unavailableParticipants[0]
        const name = requestFlow?.peerName ?? p.displayName
        return p.reason === 'no_keys'
          ? `${name} hasn't set up messaging keys yet. Messages can't be delivered until they log in.`
          : `${name} hasn't set up a device yet. Messages can't be delivered until they log in.`
      }
      const names = unavailableParticipants.map(p => p.displayName).join(', ')
      return `${names} can't receive messages`
    }
    return null
  })()

  // ── Input area ──────────────────────────────────────────────────────────

  const renderInputArea = () => {
    if (blockedReason) return null

    if (requestFlow?.status === 'received') {
      return (
        <div className="shrink-0 px-4 py-3">
          <p className="text-sm text-center text-tertiary mb-2">
            {requestFlow.peerName ?? 'This user'} wants to message you
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={requestFlow.onDecline}
              className="flex-1 py-2.5 rounded-full border border-primary/15 text-sm font-medium text-tertiary active:scale-95 transition-all"
            >
              Decline
            </button>
            <button
              onClick={requestFlow.onAccept}
              className="flex-1 py-2.5 rounded-full bg-themeblue3 text-sm font-medium text-white active:scale-95 transition-all"
            >
              Accept
            </button>
          </div>
        </div>
      )
    }

    return (
      // Mobile: overlay the composer on top of the conversation so the iOS
      // keyboard floats the input up without resizing the message list.
      // Desktop: normal flex child below the scroll area.
      <div className="absolute inset-x-0 bottom-0 z-10 pb-[max(0rem,var(--sab,0px))] md:static md:inset-auto md:bottom-auto md:shrink-0 md:pb-0">
        {/* Mobile-only frosted footer band on its own layer so it feathers into
            nothing at the top edge (no hard CSS line) without masking the
            composer content above it. Desktop renders a plain flex child. */}
        <GlassBand edge="bottom" className="inset-0 md:hidden" />
        {someUnavailable && <UnavailableBanner participants={participants} />}

        {replyingTo && !activeThreadId && (
          <div className="px-4 pt-2 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 min-w-0 bg-themewhite2 rounded-lg px-3 py-1.5">
              <div className="w-0.5 self-stretch rounded-full bg-themeblue2 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9pt] font-medium text-themeblue2">Replying to</p>
                <p className="text-[9pt] text-tertiary truncate">
                  {(replyingTo.plaintext || 'Photo').slice(0, 60)}
                </p>
              </div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 rounded-full hover:bg-primary/5 active:scale-95 transition-all shrink-0">
              <X size={14} className="text-tertiary" />
            </button>
          </div>
        )}

        <div
          className="px-4 pt-3 pb-3"
        >
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

          {isRecording ? (
            /* Recording state: cancel | indicator | send */
            <div className="flex items-center gap-2">
              <button
                onClick={cancelRecording}
                className="w-10 h-10 rounded-full bg-themewhite2/90 dark:bg-themewhite3/90 flex items-center justify-center active:scale-95 transition-all shrink-0"
              >
                <X size={18} className="text-tertiary" />
              </button>

              <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-full border border-themeredred/20 bg-themeredred/5">
                <div className="w-2 h-2 rounded-full bg-themeredred animate-pulse shrink-0" />
                <span className="text-sm font-medium text-themeredred tabular-nums">
                  {Math.floor(recDuration / 60)}:{String(Math.floor(recDuration % 60)).padStart(2, '0')}
                </span>
                <div className="flex-1 flex items-center gap-px h-4">
                  {Array.from({ length: 24 }, (_, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-full bg-themeredred/40 transition-all duration-75"
                      style={{ height: `${Math.max(8, (i < 12 ? amplitude : amplitude * 0.6) * 100)}%` }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleSendVoice}
                className="animate-spring-in w-10 h-10 rounded-full bg-themeredred flex items-center justify-center active:scale-95 transition-all shrink-0"
              >
                <ArrowUp size={18} className="text-white" />
              </button>
            </div>
          ) : (
            /* Normal state: image | input | mic/send */
            <div className="flex items-end gap-2">
              {canUploadImage && (
                <button
                  ref={attachBtnRef}
                  onClick={() => sendStructured ? setAttachOpen(true) : fileInputRef.current?.click()}
                  disabled={sending}
                  className={`w-10 h-10 rounded-full bg-themewhite2/90 dark:bg-themewhite3/90 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all shrink-0
                              ${attachOpen ? 'rotate-45' : ''}`}
                >
                  <Plus size={18} className="text-tertiary" />
                </button>
              )}
              <div className="chat-input-bar relative flex flex-1 items-center rounded-2xl border border-themeblue3/10 shadow-xs bg-themewhite
                  focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={handleKeyDown}
                  onFocus={() => requestAnimationFrame(() => {
                    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
                  })}
                  placeholder={placeholder}
                  className="w-full bg-transparent outline-none text-[12pt] text-tertiary px-3.5 py-2.5
                      rounded-2xl min-w-0 placeholder:text-tertiary resize-none leading-snug"
                  disabled={inputDisabled}
                />
              </div>
              {text.trim() ? (
                <button
                  onClick={handleSend}
                  disabled={inputDisabled}
                  className="animate-spring-in w-10 h-10 rounded-full bg-themeblue3 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all shrink-0"
                >
                  <ArrowUp size={18} className="text-white" />
                </button>
              ) : canSendVoice ? (
                <button
                  onClick={startRecording}
                  disabled={inputDisabled}
                  className="w-10 h-10 rounded-full bg-themewhite2/90 dark:bg-themewhite3/90 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all shrink-0"
                >
                  <Mic size={18} className="text-tertiary" />
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Message list ────────────────────────────────────────────────────────

  // When pinnedRoot is set (thread view), the first message is the thread root:
  // it rides pinned + highlighted in the sticky header region so context stays
  // visible while scrolling, and the remaining replies render below a separator.
  const renderMessageList = (msgs: DecryptedSignalMessage[], emptyLabel: string, showHeaders = false, headerOverride?: ReactNode, pinnedRoot = false) => {
    const rootMsg = pinnedRoot && msgs.length > 0 ? msgs[0] : null
    const listMsgs = pinnedRoot ? msgs.slice(1) : msgs

    const bubbleRow = (msg: DecryptedSignalMessage, idx: number) => {
      const own = msg.senderId === userId

      // Date separator: show when the day changes between messages
      let dateSeparator: ReactNode = null
      const msgDate = new Date(msg.createdAt)
      const prevDate = idx > 0 ? new Date(listMsgs[idx - 1].createdAt) : null
      const showDate = idx === 0 || !prevDate
        || msgDate.getFullYear() !== prevDate.getFullYear()
        || msgDate.getMonth() !== prevDate.getMonth()
        || msgDate.getDate() !== prevDate.getDate()
      if (showDate) {
        const today = new Date()
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const isToday = msgDate.toDateString() === today.toDateString()
        const isYesterday = msgDate.toDateString() === yesterday.toDateString()
        const label = isToday ? 'Today'
          : isYesterday ? 'Yesterday'
          : msgDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
        dateSeparator = (
          <div className="flex justify-center my-2">
            <span className="text-[9pt] font-medium text-tertiary px-2.5 py-0.5 rounded-full bg-themewhite/70 backdrop-blur-sm">
              {label}
            </span>
          </div>
        )
      }

      return (
        <div key={msg.id} data-message-id={msg.id}>
          {dateSeparator}
          <MessageBubble
            message={msg}
            isOwn={own}
            avatar={resolveAvatar(msg, own)}
            senderName={resolveSenderName?.(msg)}
            onLongPress={handleLongPress}
            onSwipeAction={handleSwipeAction}
            isEditing={editingMessageId === msg.id}
            editText={editingMessageId === msg.id ? editText : undefined}
            onEditTextChange={setEditText}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            threadReplyCount={!activeThreadId ? (threadReplyCounts[msg.originId ?? ''] ?? threadReplyCounts[msg.id]) : undefined}
            threadLastReplyAt={!activeThreadId ? (threadLastReply[msg.originId ?? ''] ?? threadLastReply[msg.id]) : undefined}
            onOpenThread={handleOpenThread}
            intakeActionable={intakeActionable}
            conversationId={conversationId}
            conversationIsGroup={conversationIsGroup}
            conversationPeerName={conversationPeerName}
            highlighted={highlightId === msg.id}
            onReact={reactionsEnabled ? handleReact : undefined}
            myUserId={userId}
          />
        </div>
      )
    }

    return (
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden" onScroll={closeContextMenu}>
        {showHeaders && (
          <div className="sticky top-0 z-10 backdrop-blur-[2px] animate-fadeIn">
            {/* Blur lives on the sticky element itself — backdrop-filter on a
                -z-10 descendant of a sticky parent fails to sample on iOS Safari.
                This layer carries only the masked tint so the COLOR feathers to
                nothing at the bottom; the 2px blur edge is imperceptible. */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-themewhite3/15"
              style={{
                maskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
              }}
            />
            {headerOverride ?? (<>{mobileHeader}{desktopHeader}</>)}
            {rootMsg && (
              <div className="px-2 pt-1 pb-1.5 border-b border-primary/10 bg-themewhite3/85">
                <div data-message-id={rootMsg.id}>
                  <MessageBubble
                    message={rootMsg}
                    isOwn={rootMsg.senderId === userId}
                    avatar={resolveAvatar(rootMsg, rootMsg.senderId === userId)}
                    senderName={resolveSenderName?.(rootMsg)}
                    onLongPress={handleLongPress}
                    onSwipeAction={handleSwipeAction}
                    intakeActionable={intakeActionable}
                    conversationId={conversationId}
                    conversationIsGroup={conversationIsGroup}
                    conversationPeerName={conversationPeerName}
                    highlighted
                    onReact={reactionsEnabled ? handleReact : undefined}
                    myUserId={userId}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        <div className="px-4 pt-3 pb-28 md:pb-3">
          {listMsgs.length === 0 ? (
            pinnedRoot ? null : (
              <div className="flex items-center justify-center h-full">
                <p className="text-[10pt] text-tertiary">{emptyLabel}</p>
              </div>
            )
          ) : (
            listMsgs.map((msg, idx) => bubbleRow(msg, idx))
          )}
        </div>
      </div>
    )
  }

  // ── Main view ───────────────────────────────────────────────────────────

  const showThread = !!activeThreadId

  return (
    <div ref={conversationRef} className="flex flex-col h-full relative" {...mainSwipeBack}>
      {renderMessageList(mainViewMessages, emptyText, true)}

      {sendStructured && (
        <SharedObjectPicker
          isOpen={attachOpen}
          anchorRef={attachBtnRef}
          clinicId={clinicId ?? null}
          onClose={() => setAttachOpen(false)}
          onPickPhoto={() => fileInputRef.current?.click()}
          onPick={handleShareObject}
          onPickBundle={handleShareBundle}
        />
      )}
      {/* Zoom/crop review step between picking an image and sending it. */}
      <ImageEditor
        file={editFile}
        onCancel={() => setEditFile(null)}
        onConfirm={handleEditedImage}
        containerRef={conversationRef}
      />
      {!showThread && blockedReason && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center px-6 pointer-events-none">
          <p className="text-[10pt] text-tertiary text-center max-w-[90%]">
            {blockedReason}
          </p>
        </div>
      )}
      {/* Message context menu — portals to body, so a single render covers both
          the main list and the thread overlay. Lifts a clone of the bubble with
          the menu beneath it (iOS peek) when we captured a rect; falls back to a
          cursor-anchored pill for cards that didn't supply one. */}
      {contextMenu && contextMsg && (() => {
        const isOwn = contextMsg.senderId === userId
        const isMedia = contextMsg.content?.type === 'image' || contextMsg.content?.type === 'voice'
        const cardType = contextMsg.content?.type
        const isClearableCard = cardType === 'outside_message' || cardType === 'oncall_call' || cardType === 'outside_session'
        // Dedicated cards render without a chip row, so skip the React action there.
        const isCard = cardType === 'intake_request' || cardType === 'oncall_call' || cardType === 'outside_message' || cardType === 'outside_session'
        // Reaction glyphs — the horizontal icon strip in the lifted menu; folded
        // into a React submenu for the cursor-pill fallback.
        const reactionItems: ContextMenuItem[] = reactionsEnabled && !isCard
          ? REACTION_CODES.map(code => ({
              key: `react-${code}`,
              label: REACTION_LABELS[code],
              node: <ReactionGlyph code={code} size={20} />,
              onAction: () => handleReact(contextMsg, code),
            }))
          : []
        // Inline-affordance parity: surface add-to-calendar (dev-gated) and
        // decode-note on the lifted menu when the message text supports them.
        const isTextMsg = !contextMsg.content || contextMsg.content.type === 'text'
        const menuDetectedDate = isTextMsg && isDevRole ? detectFirstDate(contextMsg.plaintext ?? '') : null
        const menuDecoded = isTextMsg ? detectEncodedNote(contextMsg.plaintext ?? '') : null
        // Shared-object primary actions ride the top of the menu: a live
        // deep-link opens its object; a frozen bundle Adds into the receiver's
        // own data (hidden once this device has already ingested it).
        const cardContent = contextMsg.content
        const sharedItems: ContextMenuItem[] = []
        if (cardContent?.type === 'shared_ref') {
          const ref = cardContent
          const openLabel = ref.refKind === 'calendar-event' ? 'Open event' : ref.refKind === 'property-item' ? 'Open item' : 'Open on map'
          const OpenIcon = ref.refKind === 'calendar-event' ? Calendar : ref.refKind === 'property-item' ? Package : MapIcon
          sharedItems.push({ key: 'open-ref', label: openLabel, icon: OpenIcon, onAction: () => sharedActions.openRef(ref) })
        } else if (cardContent?.type === 'shared_bundle' && !sharedActions.isAdded(cardContent.contentHash)) {
          const bundle = cardContent
          if (bundle.bundleKind === 'note-blocks') {
            sharedItems.push({ key: 'add-blocks', label: 'Add to my blocks', icon: Plus, onAction: () => void sharedActions.addBundle(bundle, 'personal') })
            if (sharedActions.canIngestToClinic) {
              sharedItems.push({ key: 'add-cluster', label: 'Add to cluster', icon: Building2, onAction: () => void sharedActions.addBundle(bundle, 'clinic') })
            }
          } else if (bundle.bundleKind === 'calendar-event') {
            sharedItems.push({ key: 'add-event', label: 'Add to my calendar', icon: CalendarPlus, onAction: () => void sharedActions.addBundle(bundle) })
          } else {
            sharedItems.push({ key: 'add-overlay', label: 'Add to my map', icon: Plus, onAction: () => void sharedActions.addBundle(bundle) })
          }
        }
        const actionItems: ContextMenuItem[] = [
          ...sharedItems,
          { key: 'reply', label: 'Reply', icon: Reply, onAction: handleContextReply },
          ...(!isMedia ? [{ key: 'copy', label: 'Copy', icon: Copy, onAction: handleCopy }] : []),
          ...(isMedia && handleSaveImage ? [{ key: 'save', label: 'Save', icon: Download, onAction: handleSaveImage }] : []),
          ...(menuDetectedDate ? [{ key: 'calendar', label: 'Add to calendar', icon: CalendarPlus, onAction: handleMenuAddToCalendar }] : []),
          ...(menuDecoded ? [{ key: 'decode', label: 'Decode note', icon: ScanLine, onAction: handleMenuDecode }] : []),
          ...(isOwn && !isMedia ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: handleStartEdit }] : []),
          { key: 'forward', label: 'Forward', icon: Forward, onAction: handleContextForward },
          ...(isOwn || isClearableCard ? [{ key: 'delete', label: 'Delete', icon: Trash2, onAction: handleContextDelete, destructive: true }] : []),
        ]
        return contextMenu.rect && contextMenu.cloneHtml ? (
          <LiftedRowMenu
            isOpen
            anchorRect={contextMenu.rect}
            row={<div dangerouslySetInnerHTML={{ __html: contextMenu.cloneHtml }} />}
            items={actionItems}
            reactions={reactionItems.length ? reactionItems : undefined}
            onClose={closeContextMenu}
            bare
            align={isOwn ? 'right' : 'left'}
            layout="list"
          />
        ) : (
          <ContextMenu
            x={contextMenu.x} y={contextMenu.y}
            onClose={closeContextMenu}
            items={reactionItems.length
              ? [{ key: 'react', label: 'React', icon: SmilePlus, submenu: reactionItems }, ...actionItems]
              : actionItems}
          />
        )
      })()}
      {!showThread && renderInputArea()}

      {/* Thread overlay */}
      {showThread && (
        <div
          className={`absolute inset-0 z-20 flex flex-col bg-themewhite3 transition-opacity duration-200 ${threadClosing ? 'opacity-0' : 'animate-fadeIn'}`}
          {...threadSwipeBack}
        >
          {/* Reuse the conversation header (mobile). On desktop the BaseDrawer
              header sits above this overlay and handles back. Both route through
              the panel's back handler, which pops the thread first. */}
          {renderMessageList(threadMessages, 'No messages', true, undefined, true)}
          {renderInputArea()}
        </div>
      )}

      {/* Decode overlay for the lifted-menu "Decode note" action. */}
      {decodeMenu && (
        <DecodedNotePreview
          token={decodeMenu.token}
          isOpen={!!decodeMenu}
          anchorRect={decodeMenu.rect}
          onClose={() => setDecodeMenu(null)}
        />
      )}

      <ConfirmDialog
        visible={!!pendingDelete}
        title="Permanently delete this message for everyone?."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={closePendingDelete}
      />
      {showForward && (
        <RecipientPicker
          isOpen={showForwardPicker}
          title="Forward to..."
          excludeIds={[conversationId]}
          conversations={conversations}
          onSelect={handleForwardSelect}
          onClose={closeForwardPicker}
        />
      )}
      {children}
    </div>
  )
}
