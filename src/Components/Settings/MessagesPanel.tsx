import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Trash2, Forward, Reply, X, ImagePlus } from 'lucide-react'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useMessages, type RequestStatus } from '../../Hooks/useMessages'
import { ContactListItem } from './ContactListItem'
import { MessageBubble, type SwipeAction } from './MessageBubble'
import { MessageContextMenu } from './MessageContextMenu'
import { useAuth } from '../../Hooks/useAuth'
import { useAvatar } from '../../Utilities/AvatarContext'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'

export type MessagesView = 'messages' | 'messages-chat'

interface MessagesPanelProps {
  view: MessagesView
  selectedPeerId: string | null
  onSelectPeer: (medic: ClinicMedic) => void
  onBack?: () => void
}

// ── Conversation List ──────────────────────────────────────────────────────

function ConversationList({
  onSelectPeer,
  conversations,
  unreadCounts,
}: {
  onSelectPeer: (medic: ClinicMedic) => void
  conversations: Record<string, DecryptedSignalMessage[]>
  unreadCounts: Record<string, number>
}) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { medics, loading } = useClinicMedics()
  const { currentAvatar } = useAvatar()

  // Sort medics: those with messages first (by recency), then alphabetical
  const sortedMedics = [...medics].sort((a, b) => {
    const aLast = conversations[a.id]?.at(-1)?.createdAt ?? ''
    const bLast = conversations[b.id]?.at(-1)?.createdAt ?? ''
    if (aLast && bLast) return bLast.localeCompare(aLast)
    if (aLast) return -1
    if (bLast) return 1
    return (a.lastName ?? '').localeCompare(b.lastName ?? '')
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-tertiary/50">Loading contacts...</p>
      </div>
    )
  }

  if (medics.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 px-6">
        <p className="text-sm text-tertiary/50 text-center">
          No clinic members found. Messaging is available between members of the same clinic.
        </p>
      </div>
    )
  }

  // Synthetic medic for self-notes entry
  const selfMedic: ClinicMedic | null = userId
    ? { id: userId, firstName: 'Notes to', lastName: 'Self', middleInitial: null, rank: null, credential: null, avatarId: currentAvatar.id }
    : null

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-2 py-3">
        {selfMedic && (
          <>
            <ContactListItem
              medic={selfMedic}
              lastMessage={conversations[userId!]?.at(-1)?.plaintext}
              unreadCount={0}
              onClick={() => onSelectPeer(selfMedic)}
            />
            <div className="mx-4 my-1 border-b border-primary/10" />
          </>
        )}
        <p className="text-xs text-tertiary/60 px-4 mb-2">Clinic Members</p>
        {sortedMedics.map(medic => {
          const msgs = conversations[medic.id]
          // Filter out request-accepted from preview — it's an invisible signal
          const lastMsg = msgs?.filter(m => m.messageType !== 'request-accepted').at(-1)

          return (
            <ContactListItem
              key={medic.id}
              medic={medic}
              lastMessage={lastMsg?.plaintext}
              unreadCount={unreadCounts[medic.id] ?? 0}
              onClick={() => onSelectPeer(medic)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Forward Contact Picker ────────────────────────────────────────────────

function ForwardPicker({
  conversations,
  currentPeerId,
  onSelect,
  onCancel,
}: {
  conversations: Record<string, DecryptedSignalMessage[]>
  currentPeerId: string
  onSelect: (medic: ClinicMedic) => void
  onCancel: () => void
}) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { medics } = useClinicMedics()

  // Exclude self and the current peer from forward targets
  const targets = medics.filter(m => m.id !== currentPeerId && m.id !== userId)

  // Sort: those with existing conversations first
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
            <ContactListItem
              key={medic.id}
              medic={medic}
              onClick={() => onSelect(medic)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Chat Detail ────────────────────────────────────────────────────────────

function ChatDetail({
  peerId,
  conversations,
  sendMessage,
  sendImage,
  sending,
  markAsRead,
  fetchHistory,
  requestStatus,
  acceptRequest,
  editMessage,
  deleteMessages,
  onBack,
  peerName,
}: {
  peerId: string
  conversations: Record<string, DecryptedSignalMessage[]>
  sendMessage: (peerId: string, text: string) => Promise<boolean>
  sendImage: (peerId: string, file: File) => Promise<boolean>
  sending: boolean
  markAsRead: (peerId: string) => void
  fetchHistory: (peerId: string) => Promise<void>
  requestStatus: RequestStatus
  acceptRequest: (peerId: string) => Promise<void>
  editMessage: (peerId: string, messageId: string, newText: string) => void
  deleteMessages: (peerId: string, messageIds: string[]) => void
  onBack?: () => void
  peerName?: string
}) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null)
  // Edit mode state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // Forward picker
  const [showForwardPicker, setShowForwardPicker] = useState(false)

  const messages = conversations[peerId] ?? []
  const hasSelection = selectedIds.size > 0

  // Find the message being context-menued
  const contextMsg = contextMenu ? messages.find(m => m.id === contextMenu.messageId) : null

  // Auto-scroll to bottom when messages change (scoped to container only)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  // Mark as read when chat opens and fetch history
  useEffect(() => {
    markAsRead(peerId)
    fetchHistory(peerId)
  }, [peerId, markAsRead, fetchHistory])

  // Clear selection when switching peers
  useEffect(() => {
    setSelectedIds(new Set())
    setShowForwardPicker(false)
  }, [peerId])

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setText('')
    const success = await sendMessage(peerId, trimmed)
    if (!success) {
      setText(trimmed)
    }
    inputRef.current?.focus()
  }, [text, sending, sendMessage, peerId])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      sendImage(peerId, file)
    }
    // Reset so the same file can be re-selected
    e.target.value = ''
  }, [sendImage, peerId])

  // ── Context menu handlers ────────────────────────────────────────────

  const handleLongPress = useCallback((message: DecryptedSignalMessage, x: number, y: number) => {
    setContextMenu({ messageId: message.id, x, y })
  }, [])

  const handleCopy = useCallback(() => {
    if (!contextMsg) return
    navigator.clipboard.writeText(contextMsg.plaintext).catch(() => {})
    setContextMenu(null)
  }, [contextMsg])

  const handleStartEdit = useCallback(() => {
    if (!contextMsg) return
    setEditingMessageId(contextMsg.id)
    setEditText(contextMsg.plaintext)
    setContextMenu(null)
  }, [contextMsg])

  const handleSaveImage = useCallback(async () => {
    if (!contextMsg || contextMsg.content?.type !== 'image') return
    setContextMenu(null)
    const { downloadDecryptedAttachment } = await import('../../lib/signal/attachmentService')
    const result = await downloadDecryptedAttachment(contextMsg.content.path, contextMsg.content.key)
    if (!result.ok) return
    const url = URL.createObjectURL(result.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `photo-${Date.now()}.jpg`
    a.click()
    URL.revokeObjectURL(url)
  }, [contextMsg])

  const handleSaveEdit = useCallback(() => {
    if (!editingMessageId) return
    const trimmed = editText.trim()
    if (trimmed) {
      editMessage(peerId, editingMessageId, trimmed)
    }
    setEditingMessageId(null)
    setEditText('')
  }, [editingMessageId, editText, editMessage, peerId])

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null)
    setEditText('')
  }, [])

  // ── Selection handlers ───────────────────────────────────────────────

  const handleTap = useCallback((message: DecryptedSignalMessage) => {
    // Don't select while editing
    if (editingMessageId) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(message.id)) {
        next.delete(message.id)
      } else {
        next.add(message.id)
      }
      return next
    })
  }, [editingMessageId])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // ── Action bar handlers ──────────────────────────────────────────────

  const handleDelete = useCallback(() => {
    deleteMessages(peerId, [...selectedIds])
    setSelectedIds(new Set())
  }, [deleteMessages, peerId, selectedIds])

  const handleReply = useCallback(() => {
    // Quote the first selected message into the input
    const firstSelected = messages.find(m => selectedIds.has(m.id))
    if (firstSelected) {
      const quote = firstSelected.plaintext.split('\n').map(l => `> ${l}`).join('\n')
      setText(quote + '\n')
      setSelectedIds(new Set())
      inputRef.current?.focus()
    }
  }, [messages, selectedIds])

  const handleForwardStart = useCallback(() => {
    setShowForwardPicker(true)
  }, [])

  // ── Swipe action handler ─────────────────────────────────────────────

  const handleSwipeAction = useCallback((msg: DecryptedSignalMessage, action: SwipeAction) => {
    switch (action) {
      case 'copy':
        navigator.clipboard.writeText(msg.plaintext).catch(() => {})
        break
      case 'reply': {
        const quote = msg.plaintext.split('\n').map(l => `> ${l}`).join('\n')
        setText(quote + '\n')
        inputRef.current?.focus()
        break
      }
      case 'edit':
        setEditingMessageId(msg.id)
        setEditText(msg.plaintext)
        break
      case 'delete':
        deleteMessages(peerId, [msg.id])
        break
    }
  }, [deleteMessages, peerId])

  const handleForwardSelect = useCallback(async (medic: ClinicMedic) => {
    // Send each selected message's text to the chosen contact
    const selectedMsgs = messages.filter(m => selectedIds.has(m.id))
    for (const msg of selectedMsgs) {
      await sendMessage(medic.id, msg.plaintext)
    }
    setShowForwardPicker(false)
    setSelectedIds(new Set())
  }, [messages, selectedIds, sendMessage])

  const inputDisabled = sending || requestStatus === 'sent'

  return (
    <div className="flex flex-col h-full relative">
      {/* Selection header bar */}
      {hasSelection && (
        <div className="shrink-0 px-4 py-2.5 border-b border-primary/10 flex items-center justify-between bg-themewhite3">
          <div className="flex items-center gap-2">
            <button onClick={clearSelection} className="p-1.5 rounded-full hover:bg-primary/5 active:scale-95 transition-all">
              <X size={18} className="text-tertiary" />
            </button>
            <p className="text-sm text-primary font-medium">{selectedIds.size} selected</p>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3"
        onScroll={() => setContextMenu(null)}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-tertiary/40">
              {peerId === userId ? 'Write a note...' : 'No messages yet. Say hello!'}
            </p>
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.senderId === userId}
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
            />
          ))
        )}
      </div>

      {/* Context menu popup (rendered via portal) */}
      {contextMenu && contextMsg && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isOwn={contextMsg.senderId === userId}
          isImage={contextMsg.content?.type === 'image'}
          onCopy={handleCopy}
          onEdit={handleStartEdit}
          onSave={handleSaveImage}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Bottom area — action bar when selected, otherwise input or accept/decline */}
      {hasSelection ? (
        <div className="shrink-0 px-4 py-3 border-t border-primary/10">
          <div className="flex items-center justify-around">
            <button onClick={handleReply} className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl hover:bg-primary/5 active:scale-95 transition-all">
              <Reply size={18} className="text-tertiary" />
              <span className="text-[10px] text-tertiary">Reply</span>
            </button>
            <button onClick={handleForwardStart} className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl hover:bg-primary/5 active:scale-95 transition-all">
              <Forward size={18} className="text-tertiary" />
              <span className="text-[10px] text-tertiary">Forward</span>
            </button>
            <button onClick={handleDelete} className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl hover:bg-primary/5 active:scale-95 transition-all">
              <Trash2 size={18} className="text-red-400" />
              <span className="text-[10px] text-red-400">Delete</span>
            </button>
          </div>
        </div>
      ) : requestStatus === 'received' ? (
        // Accept / Decline bar
        <div className="shrink-0 px-4 py-3 border-t border-primary/10">
          <p className="text-sm text-center text-tertiary/70 mb-2">
            {peerName ?? 'This user'} wants to message you
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex-1 py-2.5 rounded-full border border-primary/15 text-sm font-medium
                         text-tertiary active:scale-[0.98] transition-all"
            >
              Decline
            </button>
            <button
              onClick={() => acceptRequest(peerId)}
              className="flex-1 py-2.5 rounded-full bg-themeblue2 text-sm font-medium
                         text-white active:scale-[0.98] transition-all"
            >
              Accept
            </button>
          </div>
        </div>
      ) : (
        // Normal input (disabled when request is pending)
        <div className="shrink-0 px-4 py-3 border-t border-primary/10">
          {/* Hidden file input for image picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            {/* Image picker button — only show when conversation is accepted */}
            {requestStatus === 'accepted' && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                className="w-10 h-10 rounded-full flex items-center justify-center
                           hover:bg-primary/5 active:scale-95 transition-all shrink-0
                           disabled:opacity-30"
              >
                <ImagePlus size={20} className="text-tertiary/60" />
              </button>
            )}
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={requestStatus === 'sent' ? 'Waiting for response...' : 'Type a message...'}
              className="flex-1 px-4 py-2.5 rounded-full bg-themewhite2 text-sm text-primary
                         placeholder:text-tertiary/40 outline-none focus:ring-1 focus:ring-themeblue2/40 transition-all"
              disabled={inputDisabled}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || inputDisabled}
              className="w-10 h-10 rounded-full bg-themeblue2 flex items-center justify-center
                         disabled:opacity-30 active:scale-95 transition-all shrink-0"
            >
              <Send size={16} className="text-white ml-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* Forward contact picker overlay */}
      {showForwardPicker && (
        <ForwardPicker
          conversations={conversations}
          currentPeerId={peerId}
          onSelect={handleForwardSelect}
          onCancel={() => setShowForwardPicker(false)}
        />
      )}
    </div>
  )
}

// ── Exported Panel ─────────────────────────────────────────────────────────

export function MessagesPanel({ view, selectedPeerId, onSelectPeer, onBack }: MessagesPanelProps) {
  const { conversations, unreadCounts, sendMessage, sendImage, sending, markAsRead, fetchHistory, acceptRequest, editMessage, deleteMessages, getRequestStatusForPeer } = useMessages()
  const { medics } = useClinicMedics()

  if (view === 'messages-chat' && selectedPeerId) {
    const peer = medics.find(m => m.id === selectedPeerId)
    const peerName = peer
      ? [peer.rank, peer.lastName].filter(Boolean).join(' ') || peer.firstName || undefined
      : undefined

    return (
      <ChatDetail
        peerId={selectedPeerId}
        conversations={conversations}
        sendMessage={sendMessage}
        sendImage={sendImage}
        sending={sending}
        markAsRead={markAsRead}
        fetchHistory={fetchHistory}
        requestStatus={getRequestStatusForPeer(selectedPeerId)}
        acceptRequest={acceptRequest}
        editMessage={editMessage}
        deleteMessages={deleteMessages}
        onBack={onBack}
        peerName={peerName}
      />
    )
  }

  return (
    <ConversationList
      onSelectPeer={onSelectPeer}
      conversations={conversations}
      unreadCounts={unreadCounts}
    />
  )
}
