import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { ArrowUp, X, Plus, Mic, Copy, Pencil, Download, Reply, Trash2, Forward, SmilePlus, CalendarPlus, ScanLine, Calendar, Package, Map as MapIcon, Building2, FileText, type LucideIcon } from 'lucide-react'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { GlassBand } from '@/Components/primitives/GlassBand'
import { MessageBubble } from './Settings/MessageBubble'
import { SharedObjectPicker } from './Messages/SharedObjectPicker'
import { ImageEditor } from './ImageEditor'
import type { MessageContent, SharedBundleContent, SharedRefContent, FileContent, ImageContent } from '../lib/signal/messageContent'
import { resizeAndThumbnail } from '../Hooks/useMessages'
import { dataUrlToBlob } from '../Utilities/imageUtils'
import { uploadEncryptedAttachment, attachmentFailureMessage, deleteAttachments, MAX_ATTACHMENT_BYTES } from '../lib/signal/attachmentService'
import { UploadChip, useUploadTask } from '@/Components/primitives/UploadProgress'
import { emitErrorToast } from '../lib/errorFeedback'
import { ErrorDisplay } from './primitives/ErrorDisplay'
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
import { useDecodeSharedNote } from '../Hooks/useDecodeSharedNote'
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

type StagedSource =
  | { kind: 'file'; file: File; preview?: undefined }
  | { kind: 'image'; file: File; original: boolean; preview: string }
  | { kind: 'ref'; content: SharedRefContent; preview?: undefined }
  | { kind: 'bundle'; source: BundleSource; preview?: undefined }

type StagedContent = FileContent | ImageContent | SharedRefContent | SharedBundleContent

const REF_ICONS: Record<SharedRefContent['refKind'], LucideIcon> = {
  'calendar-event': Calendar,
  'map-overlay': MapIcon,
  'property-item': Package,
}

export interface ChatDetailViewProps {
  conversationId: string
  conversations: Record<string, DecryptedSignalMessage[]>
  medics: ClinicMedic[]
  sendMessage: (id: string, text: string, threadId?: string) => Promise<boolean>
  /** `original` skips the 800px downscale (still re-encoded, so metadata is stripped). */
  sendImage: (id: string, file: File, opts?: { original?: boolean }) => Promise<boolean>
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
  /** Who-this-is card above the first loaded message (main view only). Request
   *  Accept/Decline never moves here: it stays pinned in the composer slot so it
   *  is reachable however far the history scrolls. */
  introCard?: ReactNode
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
  /** Attach menu offers photo and file only (no shared refs or bundles). */
  mediaOnlyAttach?: boolean
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
  /** Replaces the composer with a centered notice. For conversations that can
   * close for a reason the participant list can't express — currently an
   * outbound outside-contact channel whose invite expired or was revoked. */
  composerBlockedReason?: string
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
        <ErrorDisplay type="warning" message={message} />
      </div>
    )
  }

  const names = unavailable.map(p => p.displayName).join(', ')
  return (
    <div className="shrink-0 px-4 py-1.5">
      <ErrorDisplay type="warning" message={`${names} can't receive messages`} />
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
  introCard,
  mobileHeader,
  desktopHeader,
  registerThreadBack,
  hideImageUpload,
  mediaOnlyAttach,
  intakeActionable = true,
  canReact = true,
  conversationIsGroup = false,
  conversationPeerName,
  scrollToMessageId,
  onScrollConsumed,
  composerBlockedReason,
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
  const docInputRef = useRef<HTMLInputElement>(null)
  // Anything from the + menu (photo, file, event, map, property, template) waits
  // above the composer until the user sends, so it can go out with a message.
  // Uploads start on pick. The source is kept for Retry; the ref mirrors
  // stagedContent so clearing can delete the object without a side effect inside a
  // state updater.
  const fileUpload = useUploadTask<StagedContent>()
  const [stagedSource, setStagedSource] = useState<StagedSource | null>(null)
  const [stagedContent, setStagedContentState] = useState<StagedContent | null>(null)
  const stagedContentRef = useRef<StagedContent | null>(null)
  const stagedSourceRef = useRef<StagedSource | null>(null)
  const setStagedContent = useCallback((c: StagedContent | null) => {
    stagedContentRef.current = c
    setStagedContentState(c)
  }, [])
  const setStaged = useCallback((s: StagedSource | null) => {
    stagedSourceRef.current = s
    setStagedSource(s)
  }, [])
  // deleteObject: true when the user removed it (or left the chat) before sending,
  // so the object goes now rather than at the m/ lifecycle. A cancel that races a
  // finished PUT still orphans one object; the lifecycle covers that.
  const releaseStaged = useCallback((deleteObject: boolean) => {
    fileUpload.clear()
    const content = stagedContentRef.current
    // shared_ref carries no object; it resolves against the receiver's vault.
    if (deleteObject && content && content.type !== 'shared_ref') void deleteAttachments([content.path])
    const preview = stagedSourceRef.current?.preview
    if (preview) URL.revokeObjectURL(preview)
    setStaged(null)
    setStagedContent(null)
  }, [fileUpload.clear, setStaged, setStagedContent])
  // A picked/pasted image awaiting the zoom/crop review step before it's sent.
  const [editFile, setEditFile] = useState<File | null>(null)
  const conversationRef = useRef<HTMLDivElement>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  // The share menu anchors to this live button ref (not a captured rect) so an iOS
  // keyboard collapse — the input was focused when + was tapped — re-pins it.
  const attachBtnRef = useRef<HTMLButtonElement>(null)

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
  const decodeSharedNote = useDecodeSharedNote()

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
    closeContextMenu()
    decodeSharedNote(hit.token)
  }, [contextMsg, closeContextMenu, decodeSharedNote])

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

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (sending) return
    // A staged item that is still uploading (or failed) blocks the send so the
    // text can't go out ahead of, or without, the item it was written for.
    if (fileUpload.task && !stagedContent) return
    if (!trimmed && !stagedContent) return
    const threadId = activeThreadId ?? replyingTo?.originId ?? replyingTo?.id ?? undefined

    if (stagedContent && sendStructured) {
      const content = stagedContent
      const preview = content.type === 'image' ? 'Photo'
        : content.type === 'file' ? `File: ${content.name}`
        : content.label
      const sent = await sendStructured(conversationId, content, crypto.randomUUID(), preview)
      if (!sent) {
        emitErrorToast('Couldn’t send', 'The message did not send. Try again.')
        return
      }
      // Sent: the object now belongs to the message, so release without deleting.
      releaseStaged(false)
      if (!trimmed) {
        playSendSound()
        return
      }
    }

    setText('')
    setReplyingTo(null)
    const success = await sendMessage(conversationId, trimmed, threadId)
    if (success) {
      playSendSound()
    } else {
      setText(trimmed)
    }
    inputRef.current?.focus()
  }, [text, sending, sendMessage, conversationId, activeThreadId, replyingTo, fileUpload.task, releaseStaged, stagedContent, sendStructured])

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

  // Uploads on pick and stages; handleSend sends via sendStructured, which covers
  // 1:1, self-note and group.
  //   file    any type, byte-for-byte (no metadata stripping, by decision).
  //   image   resized + re-encoded as sendImage does (strips metadata), then the
  //           same ImageContent sendImage would have built.
  //   ref     event / map feature / property item: nothing to upload, ready at once.
  //   bundle  text templates / order sets have no live shared_ref (objectBundle.ts),
  //           so a frozen note-blocks bundle is packed and uploaded.
  const uploadStaged = useCallback(async (source: StagedSource) => {
    setStagedContent(null)
    const meta = source.kind === 'image' ? { name: 'Photo', size: source.file.size, preview: source.preview }
      : source.kind === 'file' ? { name: source.file.name, size: source.file.size }
      : source.kind === 'ref' ? { name: source.content.label, size: 0, icon: REF_ICONS[source.content.refKind], detail: source.content.subLabel }
      : { name: source.source.kind === 'note-blocks' ? source.source.label : 'Shared item', size: 0, icon: FileText,
          detail: source.source.kind === 'note-blocks' ? source.source.subLabel : undefined }
    const content = await fileUpload.start(meta, async ({ onProgress, signal }) => {
      if (source.kind === 'ref') return { ok: true, data: source.content }
      if (source.kind === 'bundle') {
        const bundle = bundleSourceToBundle(source.source, user?.clinicName ?? 'another cluster', new Date().toISOString())
        const packed = await packBundle(userId, bundle, { onProgress, signal })
        if (!packed.ok) return { ok: false, error: attachmentFailureMessage(packed.error) }
        return {
          ok: true,
          data: {
            type: 'shared_bundle',
            bundleKind: packed.data.kind,
            path: packed.data.path,
            key: packed.data.key,
            ...(packed.data.store ? { store: packed.data.store } : {}),
            contentHash: packed.data.contentHash,
            label: packed.data.label,
            ...(packed.data.subLabel ? { subLabel: packed.data.subLabel } : {}),
            sourceCluster: packed.data.sourceCluster,
          },
        }
      }
      const { file } = source
      if (source.kind === 'file') {
        const up = await uploadEncryptedAttachment(userId, file, { class: 'm', onProgress, signal })
        if (!up.ok) return { ok: false, error: attachmentFailureMessage(up.error) }
        return {
          ok: true,
          data: {
            type: 'file', store: 'r2', path: up.data.path, key: up.data.key,
            mime: file.type || 'application/octet-stream', name: file.name, size: file.size,
          },
        }
      }
      let resized: Awaited<ReturnType<typeof resizeAndThumbnail>>
      try {
        resized = await resizeAndThumbnail(file, source.original)
      } catch {
        return { ok: false, error: 'That image could not be read.' }
      }
      const { resizedDataUrl, width, height, thumbnail } = resized
      const up = await uploadEncryptedAttachment(userId, dataUrlToBlob(resizedDataUrl), { class: 'm', onProgress, signal })
      if (!up.ok) return { ok: false, error: attachmentFailureMessage(up.error) }
      return {
        ok: true,
        data: {
          type: 'image', mime: 'image/jpeg', key: up.data.key, path: up.data.path, store: up.data.store,
          width, height, thumbnail,
        },
      }
    })
    if (content) setStagedContent(content)
  }, [fileUpload.start, userId, user?.clinicName, setStagedContent])

  const stage = useCallback((source: StagedSource) => {
    releaseStaged(true)
    setStaged(source)
    void uploadStaged(source)
    inputRef.current?.focus()
  }, [releaseStaged, setStaged, uploadStaged])

  const clearStaged = useCallback(() => releaseStaged(true), [releaseStaged])

  // Review step confirmed. Without sendStructured (admin system threads) there is no staging path, so the photo sends at once as before.
  const handleEditedImage = useCallback(async (edited: File, original: boolean) => {
    setEditFile(null)
    if (sendStructured && userId) {
      stage({ kind: 'image', file: edited, original, preview: URL.createObjectURL(edited) })
      return
    }
    const success = await sendImage(conversationId, edited, original ? { original: true } : undefined)
    if (success) playSendSound()
  }, [sendStructured, userId, stage, sendImage, conversationId])

  const handleDocChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !sendStructured || !userId) return
    if (file.size > MAX_ATTACHMENT_BYTES) {
      emitErrorToast('File too large', 'Files must be 25 MB or smaller.')
      return
    }
    stage({ kind: 'file', file })
  }, [sendStructured, userId, stage])

  const handleShareObject = useCallback((content: SharedRefContent) => {
    if (!sendStructured) return
    stage({ kind: 'ref', content })
  }, [sendStructured, stage])

  const handleShareBundle = useCallback((source: BundleSource) => {
    if (!sendStructured || !userId) return
    stage({ kind: 'bundle', source })
  }, [sendStructured, userId, stage])

  useEffect(() => clearStaged, [conversationId, clearStaged])

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

  // Fully blocking the composer is only correct for 1:1 chats, where an
  // unavailable peer means the message has literally nowhere to go. In a GROUP
  // we never block: the send skips members whose vault isn't provisioned yet and
  // still delivers to everyone reachable, so keep the composer live and only warn.
  const blockOnUnavailable = allUnavailable && !isSelfChat && !conversationIsGroup
  // Show the warning banner whenever anyone is unreachable but we're still able
  // to send (i.e. not fully blocked) — covers "some" in 1:1 and "some or all" in groups.
  const showUnavailableBanner = unavailableParticipants.length > 0 && !blockOnUnavailable

  const inputDisabled = sending
    || !signalReady
    || blockOnUnavailable

  const canUploadImage = !hideImageUpload && (!requestFlow || requestFlow.status === 'accepted' || requestFlow.status === 'none' || !!isSelfChat)

  const canSendVoice = !!sendVoice && (
    !requestFlow || requestFlow.status === 'accepted' || requestFlow.status === 'none' || !!isSelfChat
  )

  const placeholder = fileUpload.task ? 'Add a message...'
    : activeThreadId ? 'Reply in thread...' : 'Type a message...'

  const blockedReason: string | null = (() => {
    if (composerBlockedReason) return composerBlockedReason
    if (requestFlow?.status === 'sent') {
      return `Waiting for ${requestFlow.peerName ?? 'this user'} to accept your request`
    }
    if (blockOnUnavailable) {
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
      // Overlay the composer on top of the conversation (both breakpoints) so
      // messages scroll under the glass footer; on iOS this also lets the
      // keyboard float the input up without resizing the message list.
      <div className="absolute inset-x-0 bottom-0 z-10 pb-[max(0rem,var(--sab,0px))]">
        {/* Frosted footer band on its own layer so it feathers into nothing at
            the top edge (no hard CSS line) without masking the composer
            content above it. */}
        <GlassBand edge="bottom" className="inset-0" />
        {showUnavailableBanner && <UnavailableBanner participants={participants} />}

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
          <input ref={docInputRef} type="file" onChange={handleDocChange} className="hidden" />
          <UploadChip
            task={fileUpload.task}
            onDismiss={clearStaged}
            onRetry={stagedSource ? () => void uploadStaged(stagedSource) : undefined}
          />

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
              {/* Same shape and focus border as NavTop's desktop search. 22px is half the
                  one-line height, so a single line is a full pill; rounded-full would
                  stretch into a stadium once the textarea grows. TrackingBoardPanel mirrors this. */}
              <div className="chat-input-bar relative flex flex-1 items-center rounded-[22px] border border-themeblue3/20 shadow-xs bg-themewhite
                  focus-within:border-themeblue1/40 focus-within:bg-themewhite2 transition-all duration-300">
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
                      rounded-[22px] min-w-0 placeholder:text-tertiary resize-none leading-snug"
                  disabled={inputDisabled}
                />
              </div>
              {stagedContent || (text.trim() && !fileUpload.task) ? (
                <button
                  onClick={handleSend}
                  aria-label="Send"
                  disabled={inputDisabled}
                  className="animate-spring-in w-10 h-10 rounded-full bg-themeblue3 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all shrink-0"
                >
                  <ArrowUp size={18} className="text-white" />
                </button>
              ) : canSendVoice && !fileUpload.task ? (
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
              className="absolute inset-0 -z-10 bg-themewhite/15"
              style={{
                maskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
              }}
            />
            {headerOverride ?? (<>{mobileHeader}{desktopHeader}</>)}
            {rootMsg && (
              <div className="px-2 pt-1 pb-1.5 border-b border-primary/10 bg-themewhite/85">
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
        <div className="px-4 pt-3 pb-28">
          {!pinnedRoot && introCard}
          {listMsgs.length === 0 ? (
            pinnedRoot || introCard ? null : (
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
          onPickFile={() => docInputRef.current?.click()}
          onPick={mediaOnlyAttach ? undefined : handleShareObject}
          onPickBundle={mediaOnlyAttach ? undefined : handleShareBundle}
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
        const isMedia = contextMsg.content?.type === 'image' || contextMsg.content?.type === 'voice' || contextMsg.content?.type === 'file'
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
          } else if (bundle.bundleKind === 'property-item') {
            sharedItems.push({ key: 'add-item', label: 'Add to my property', icon: Package, onAction: () => void sharedActions.addBundle(bundle) })
          } else {
            sharedItems.push({ key: 'add-overlay', label: 'Add to my map', icon: Plus, onAction: () => void sharedActions.addBundle(bundle) })
          }
        }
        const actionItems: ContextMenuItem[] = [
          ...sharedItems,
          { key: 'reply', label: 'Reply', icon: Reply, onAction: handleContextReply },
          ...(!isMedia ? [{ key: 'copy', label: 'Copy', icon: Copy, onAction: handleCopy }] : []),
          // handleSaveImage only handles photos; files save from their bubble, voice has no save.
          ...(contextMsg.content?.type === 'image' && handleSaveImage ? [{ key: 'save', label: 'Save', icon: Download, onAction: handleSaveImage }] : []),
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
          className={`absolute inset-0 z-20 flex flex-col bg-themewhite transition-opacity duration-200 ${threadClosing ? 'opacity-0' : 'animate-fadeIn'}`}
          {...threadSwipeBack}
        >
          {/* Reuse the conversation header (mobile). On desktop the BaseDrawer
              header sits above this overlay and handles back. Both route through
              the panel's back handler, which pops the thread first. */}
          {renderMessageList(threadMessages, 'No messages', true, undefined, true)}
          {renderInputArea()}
        </div>
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
