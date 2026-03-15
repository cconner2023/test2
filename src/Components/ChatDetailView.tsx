import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { ArrowUp, Trash2, Forward, Reply, X, Plus, ArrowLeft, MessageSquare, Mic } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'
import { MessageBubble } from './Settings/MessageBubble'
import { MessageContextMenu } from './Settings/MessageContextMenu'
import { ContactListItem } from './Settings/ContactListItem'
import { useAuth } from '../Hooks/useAuth'
import { useImagePaste } from '../Hooks/useImagePaste'
import { useIOSKeyboard } from '../Hooks/useIOSKeyboard'
import { useChatInteractions } from '../Hooks/useChatInteractions'
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
  desktopHeader: ReactNode
  children?: ReactNode
}

// ── Forward Contact Picker ────────────────────────────────────────────────

function ForwardPicker({
  conversations,
  currentId,
  medics,
  onSelect,
  onCancel,
}: {
  conversations: Record<string, DecryptedSignalMessage[]>
  currentId: string
  medics: ClinicMedic[]
  onSelect: (medic: ClinicMedic) => void
  onCancel: () => void
}) {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const targets = medics.filter(m => m.id !== currentId && m.id !== userId)
  const sorted = [...targets].sort((a, b) => {
    const aHas = conversations[a.id] ? 1 : 0
    const bHas = conversations[b.id] ? 1 : 0
    if (aHas !== bHas) return bHas - aHas
    return (a.lastName ?? '').localeCompare(b.lastName ?? '')
  })

  return (
    <div className="absolute inset-0 z-10 bg-themewhite3 flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-primary/10 flex items-center justify-between">
        <p className="text-sm font-medium text-primary">Forward to...</p>
        <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-primary/5 active:scale-95 transition-all">
          <X size={18} className="text-tertiary" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sorted.length === 0 ? (
          <p className="text-sm text-tertiary/50 text-center py-8">No contacts to forward to</p>
        ) : (
          sorted.map(medic => (
            <ContactListItem key={medic.id} medic={medic} onClick={() => onSelect(medic)} />
          ))
        )}
      </div>
    </div>
  )
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
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-themeyellow/10">
          <div className="w-2 h-2 rounded-full bg-themeyellow shrink-0" />
          <p className="text-xs text-themeyellow">{message}</p>
        </div>
      </div>
    )
  }

  const names = unavailable.map(p => p.displayName).join(', ')
  return (
    <div className="shrink-0 px-4 py-1.5">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-themeyellow/10">
        <div className="w-2 h-2 rounded-full bg-themeyellow shrink-0" />
        <p className="text-xs text-themeyellow">
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
  medics,
  sendMessage,
  sendImage,
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
  emptyText = 'No messages yet. Say hello!',
  mobileHeader,
  desktopHeader,
  children,
}: ChatDetailViewProps) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { keyboardHeight, isKeyboardOpen } = useIOSKeyboard()

  const messages = conversations[conversationId] ?? []

  const {
    contextMenu, contextMsg,
    handleLongPress, handleCopy, handleStartEdit, handleSaveImage, closeContextMenu,
    editingMessageId, editText, setEditText, handleSaveEdit, handleCancelEdit,
    selectedIds, hasSelection, canDeleteSelection, handleTap, clearSelection,
    showForwardPicker, handleForwardStart, handleForwardSelect, closeForwardPicker,
    replyingTo, setReplyingTo, handleReply,
    activeThreadId, setActiveThreadId, handleOpenThread,
    pendingDelete, handleDelete, handleConfirmDelete, closePendingDelete,
    handleSwipeAction,
    threadReplyCounts, threadMessages, mainViewMessages,
  } = useChatInteractions({
    conversationKey: conversationId,
    userId,
    messages,
    editMessage,
    deleteMessages,
    inputRef,
    sendMessage,
  })

  const {
    isRecording, duration: recDuration, amplitude,
    startRecording, stopRecording, cancelRecording,
  } = useVoiceRecorder()

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [activeThreadId ? messages.length : mainViewMessages.length])

  // Auto-scroll when iOS keyboard opens
  useEffect(() => {
    if (isKeyboardOpen && scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      })
    }
  }, [isKeyboardOpen])

  // Mark as read + fetch history on open
  useEffect(() => {
    markAsRead(conversationId)
    fetchHistory(conversationId)
  }, [conversationId, markAsRead, fetchHistory])

  // Reset interaction state on conversation change
  useEffect(() => {
    clearSelection()
    closeForwardPicker()
    setReplyingTo(null)
    setActiveThreadId(null)
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Image paste
  const handlePastedImage = useCallback(async (file: File) => {
    const success = await sendImage(conversationId, file)
    if (success) playSendSound()
  }, [sendImage, conversationId])
  useImagePaste(!sending, handlePastedImage)

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const threadId = activeThreadId ?? replyingTo?.id ?? undefined
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

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const success = await sendImage(conversationId, file)
      if (success) playSendSound()
    }
    e.target.value = ''
  }, [sendImage, conversationId])

  const handleSendVoice = useCallback(async () => {
    const result = await stopRecording()
    if (result && sendVoice) {
      const success = await sendVoice(conversationId, result)
      if (success) playSendSound()
    }
  }, [stopRecording, sendVoice, conversationId])

  // Availability logic
  const unavailableParticipants = participants.filter(p => !p.available)
  const allUnavailable = participants.length > 0 && unavailableParticipants.length === participants.length
  const someUnavailable = unavailableParticipants.length > 0 && !allUnavailable

  const inputDisabled = sending
    || (requestFlow?.status === 'sent')
    || (allUnavailable && !isSelfChat)

  const canUploadImage = !activeThreadId && (
    !requestFlow || requestFlow.status === 'accepted' || !!isSelfChat
  )

  const canSendVoice = !!sendVoice && !activeThreadId && (
    !requestFlow || requestFlow.status === 'accepted' || !!isSelfChat
  )

  const placeholder = activeThreadId ? 'Reply in thread...'
    : requestFlow?.status === 'sent' ? 'Waiting for response...'
    : 'Type a message...'

  // ── Input area ──────────────────────────────────────────────────────────

  const renderInputArea = () => {
    if (hasSelection) {
      return (
        <div className="shrink-0 px-4 py-3">
          <div className="flex items-center justify-around">
            <button onClick={handleReply} className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl hover:bg-primary/5 active:scale-95 transition-all">
              <Reply size={18} className="text-tertiary" />
              <span className="text-[10px] text-tertiary">Reply</span>
            </button>
            {showForward && (
              <button onClick={handleForwardStart} className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl hover:bg-primary/5 active:scale-95 transition-all">
                <Forward size={18} className="text-tertiary" />
                <span className="text-[10px] text-tertiary">Forward</span>
              </button>
            )}
            {canDeleteSelection && (
              <button onClick={handleDelete} className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl hover:bg-primary/5 active:scale-95 transition-all">
                <Trash2 size={18} className="text-red-400" />
                <span className="text-[10px] text-red-400">Delete</span>
              </button>
            )}
          </div>
        </div>
      )
    }

    if (allUnavailable && !isSelfChat) {
      return <UnavailableBanner participants={participants} peerName={requestFlow?.peerName} />
    }

    if (requestFlow?.status === 'received') {
      return (
        <div className="shrink-0 px-4 py-3">
          <p className="text-sm text-center text-tertiary/70 mb-2">
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
      <div className="shrink-0">
        {someUnavailable && <UnavailableBanner participants={participants} />}

        {replyingTo && !activeThreadId && (
          <div className="px-4 pt-2 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 min-w-0 bg-themewhite2 rounded-lg px-3 py-1.5">
              <div className="w-0.5 self-stretch rounded-full bg-themeblue2 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-themeblue2">Replying to</p>
                <p className="text-[11px] text-tertiary/60 truncate">
                  {(replyingTo.plaintext || 'Photo').slice(0, 60)}
                </p>
              </div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 rounded-full hover:bg-primary/5 active:scale-95 transition-all shrink-0">
              <X size={14} className="text-tertiary/50" />
            </button>
          </div>
        )}

        <div className={`px-4 pt-3 ${isKeyboardOpen ? 'pb-3' : 'pb-8'} md:pb-3`}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

          {isRecording ? (
            /* Recording state: cancel | indicator | send */
            <div className="flex items-center gap-2">
              <button
                onClick={cancelRecording}
                className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center active:scale-95 transition-all shrink-0"
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
            <div className="flex items-center gap-2">
              {canUploadImage && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all shrink-0"
                >
                  <Plus size={18} className="text-tertiary/60" />
                </button>
              )}
              <div className="chat-input-bar relative flex flex-1 items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite
                  focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className="w-full bg-transparent outline-none text-[16px] text-tertiary px-3.5 py-2.5
                      rounded-full min-w-0 placeholder:text-tertiary/30"
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
                  className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all shrink-0"
                >
                  <Mic size={18} className="text-tertiary/60" />
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Message list ────────────────────────────────────────────────────────

  const renderMessageList = (msgs: DecryptedSignalMessage[], emptyLabel: string) => (
    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3" onScroll={closeContextMenu}>
      {msgs.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-tertiary/40">{emptyLabel}</p>
        </div>
      ) : (
        msgs.map((msg, idx) => {
          const own = msg.senderId === userId
          const isThreadRoot = activeThreadId && msg.id === activeThreadId && idx === 0
          return (
            <div key={msg.id}>
              <MessageBubble
                message={msg}
                isOwn={own}
                avatar={resolveAvatar(msg, own)}
                senderName={resolveSenderName?.(msg)}
                selected={selectedIds.has(msg.id)}
                selectionMode={hasSelection}
                onTap={handleTap}
                onLongPress={handleLongPress}
                onSwipeAction={handleSwipeAction}
                isEditing={editingMessageId === msg.id}
                editText={editingMessageId === msg.id ? editText : undefined}
                onEditTextChange={setEditText}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                threadReplyCount={!activeThreadId ? threadReplyCounts[msg.id] : undefined}
                onOpenThread={handleOpenThread}
              />
              {isThreadRoot && msgs.length > 1 && (
                <div className="flex items-center gap-2 my-2 px-2">
                  <div className="flex-1 border-b border-primary/10" />
                  <span className="text-[10px] text-tertiary/40 shrink-0">
                    {msgs.length - 1} {msgs.length - 1 === 1 ? 'reply' : 'replies'}
                  </span>
                  <div className="flex-1 border-b border-primary/10" />
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )

  // ── Thread view ─────────────────────────────────────────────────────────

  if (activeThreadId) {
    return (
      <div className="flex flex-col h-full relative" style={isKeyboardOpen ? { height: `calc(100% - ${keyboardHeight}px)` } : undefined}>
        <div className="sticky top-0 z-10 shrink-0 px-4 py-2.5 flex items-center gap-3 backdrop-blur-xl bg-themewhite3/80 md:backdrop-blur-none md:bg-transparent">
          <button onClick={() => setActiveThreadId(null)} className="p-1 rounded-full hover:bg-primary/5 active:scale-95 transition-all">
            <ArrowLeft size={18} className="text-tertiary" />
          </button>
          <div className="flex items-center gap-1.5">
            <MessageSquare size={14} className="text-themeblue2" />
            <p className="text-sm font-medium text-primary">Thread</p>
          </div>
        </div>
        {renderMessageList(threadMessages, 'No messages in this thread')}
        {contextMenu && contextMsg && (
          <MessageContextMenu
            x={contextMenu.x} y={contextMenu.y}
            isOwn={contextMsg.senderId === userId}
            isImage={contextMsg.content?.type === 'image'}
            isVoice={contextMsg.content?.type === 'voice'}
            onCopy={handleCopy} onEdit={handleStartEdit} onSave={handleSaveImage}
            onClose={closeContextMenu}
          />
        )}
        {renderInputArea()}
      </div>
    )
  }

  // ── Main view ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full relative" style={isKeyboardOpen ? { height: `calc(100% - ${keyboardHeight}px)` } : undefined}>
      {mobileHeader}
      {desktopHeader}
      {renderMessageList(mainViewMessages, emptyText)}
      {contextMenu && contextMsg && (
        <MessageContextMenu
          x={contextMenu.x} y={contextMenu.y}
          isOwn={contextMsg.senderId === userId}
          isImage={contextMsg.content?.type === 'image'}
          isVoice={contextMsg.content?.type === 'voice'}
          onCopy={handleCopy} onEdit={handleStartEdit} onSave={handleSaveImage}
          onClose={closeContextMenu}
        />
      )}
      {renderInputArea()}
      <ConfirmDialog
        visible={!!pendingDelete}
        title="Permanently delete? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={closePendingDelete}
      />
      {showForward && showForwardPicker && (
        <ForwardPicker
          conversations={conversations}
          currentId={conversationId}
          medics={medics}
          onSelect={handleForwardSelect}
          onCancel={closeForwardPicker}
        />
      )}
      {children}
    </div>
  )
}
