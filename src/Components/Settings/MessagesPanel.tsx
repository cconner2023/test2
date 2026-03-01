import { useState, useRef, useEffect, useCallback } from 'react'
import { useMemo } from 'react'
import { Send, Trash2, Forward, Reply, X, ImagePlus, Phone, ArrowLeft, MessageSquare, Users, Plus, Info, ChevronLeft } from 'lucide-react'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import type { RequestStatus } from '../../Hooks/useMessages'
import { ContactListItem } from './ContactListItem'
import { GroupListItem } from './GroupListItem'
import { CreateGroupModal } from './CreateGroupModal'
import { GroupInfoPanel } from './GroupInfoPanel'
import { MessageBubble, type SwipeAction } from './MessageBubble'
import { MessageContextMenu } from './MessageContextMenu'
import { UserAvatar } from './UserAvatar'
import { ProvisionalDeviceModal } from './ProvisionalDeviceModal'
import { useAuth } from '../../Hooks/useAuth'
import { useCallActions } from '../../Hooks/CallContext'
import { useAvatar } from '../../Utilities/AvatarContext'
import { useImagePaste } from '../../Hooks/useImagePaste'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import type { GroupInfo, GroupMember } from '../../lib/signal/groupTypes'

export type MessagesView = 'messages' | 'messages-chat' | 'messages-group-chat'

interface MessagesPanelProps {
  view: MessagesView
  selectedPeerId: string | null
  selectedGroupId: string | null
  onSelectPeer: (medic: ClinicMedic) => void
  onSelectGroup: (group: GroupInfo) => void
  onBack?: () => void
}

// ── Conversation List ──────────────────────────────────────────────────────

function ConversationList({
  onSelectPeer,
  onSelectGroup,
  conversations,
  unreadCounts,
  medics,
  groups,
  loading,
  onCreateGroup,
}: {
  onSelectPeer: (medic: ClinicMedic) => void
  onSelectGroup: (group: GroupInfo) => void
  conversations: Record<string, DecryptedSignalMessage[]>
  unreadCounts: Record<string, number>
  medics: ClinicMedic[]
  groups: Record<string, GroupInfo>
  loading: boolean
  onCreateGroup: () => void
}) {
  const { user } = useAuth()
  const userId = user?.id ?? null
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

  // Sort groups by recency of last message
  const sortedGroups = Object.values(groups).sort((a, b) => {
    const aLast = conversations[a.groupId]?.at(-1)?.createdAt ?? ''
    const bLast = conversations[b.groupId]?.at(-1)?.createdAt ?? ''
    if (aLast && bLast) return bLast.localeCompare(aLast)
    if (aLast) return -1
    if (bLast) return 1
    return a.name.localeCompare(b.name)
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
    ? { id: userId, firstName: null, lastName: 'Notes', middleInitial: null, rank: null, credential: null, avatarId: currentAvatar.id }
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

        {/* Groups section */}
        {(sortedGroups.length > 0 || medics.length > 0) && (
          <>
            <div className="flex items-center justify-between px-4 mb-2">
              <p className="text-xs text-tertiary/60">Groups</p>
              <button
                onClick={onCreateGroup}
                className="flex items-center gap-1 text-xs text-themeblue2 hover:text-themeblue2/80 active:scale-95 transition-all"
              >
                <Plus size={12} />
                New
              </button>
            </div>
            {sortedGroups.map(group => {
              const msgs = conversations[group.groupId]
              const lastMsg = msgs?.filter(m => m.messageType !== 'request-accepted').at(-1)
              return (
                <GroupListItem
                  key={group.groupId}
                  group={group}
                  lastMessage={lastMsg?.plaintext}
                  unreadCount={unreadCounts[group.groupId] ?? 0}
                  onClick={() => onSelectGroup(group)}
                />
              )
            })}
            {sortedGroups.length === 0 && (
              <p className="text-xs text-tertiary/30 px-4 mb-2">No groups yet</p>
            )}
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
  medics,
  onSelect,
  onCancel,
}: {
  conversations: Record<string, DecryptedSignalMessage[]>
  currentPeerId: string
  medics: ClinicMedic[]
  onSelect: (medic: ClinicMedic) => void
  onCancel: () => void
}) {
  const { user } = useAuth()
  const userId = user?.id ?? null

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

// ── Chat Detail (1:1) ────────────────────────────────────────────────────────────

function ChatDetail({
  peerId,
  conversations,
  medics,
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
  onStartCall,
  peerName,
  peerAvatarId,
  peerFirstName,
  peerLastName,
}: {
  peerId: string
  conversations: Record<string, DecryptedSignalMessage[]>
  medics: ClinicMedic[]
  sendMessage: (peerId: string, text: string, threadId?: string) => Promise<boolean>
  sendImage: (peerId: string, file: File) => Promise<boolean>
  sending: boolean
  markAsRead: (peerId: string) => void
  fetchHistory: (peerId: string) => Promise<void>
  requestStatus: RequestStatus
  acceptRequest: (peerId: string) => Promise<void>
  editMessage: (peerId: string, messageId: string, newText: string) => void
  deleteMessages: (peerId: string, messageIds: string[]) => void
  onBack?: () => void
  onStartCall?: () => void
  peerName?: string
  peerAvatarId?: string | null
  peerFirstName?: string | null
  peerLastName?: string | null
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
  // Threading state
  const [replyingTo, setReplyingTo] = useState<DecryptedSignalMessage | null>(null)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  const messages = conversations[peerId] ?? []
  const hasSelection = selectedIds.size > 0
  // Delete is only allowed for sent messages
  const canDeleteSelection = hasSelection && [...selectedIds].every(id => {
    const m = messages.find(msg => msg.id === id)
    return m && m.senderId === userId
  })

  // Compute thread reply counts: how many messages reference each root
  const threadReplyCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of messages) {
      if (m.threadId) {
        counts[m.threadId] = (counts[m.threadId] ?? 0) + 1
      }
    }
    return counts
  }, [messages])

  // Thread view messages: root + all replies
  const threadMessages = useMemo(() => {
    if (!activeThreadId) return []
    return messages.filter(m => m.id === activeThreadId || m.threadId === activeThreadId)
  }, [activeThreadId, messages])

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

  // Clear selection and threading state when switching peers
  useEffect(() => {
    setSelectedIds(new Set())
    setShowForwardPicker(false)
    setReplyingTo(null)
    setActiveThreadId(null)
  }, [peerId])

  // Accept pasted images (disabled while a send is in progress)
  const handlePastedImage = useCallback((file: File) => {
    sendImage(peerId, file)
  }, [sendImage, peerId])
  useImagePaste(!sending, handlePastedImage)

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    // Determine threadId: explicit thread view or reply-to banner
    const threadId = activeThreadId ?? replyingTo?.id ?? undefined

    setText('')
    setReplyingTo(null)
    const success = await sendMessage(peerId, trimmed, threadId)
    if (!success) {
      setText(trimmed)
    }
    inputRef.current?.focus()
  }, [text, sending, sendMessage, peerId, activeThreadId, replyingTo])

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
    const firstSelected = messages.find(m => selectedIds.has(m.id))
    if (firstSelected) {
      setReplyingTo(firstSelected)
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
      case 'reply':
        setReplyingTo(msg)
        inputRef.current?.focus()
        break
      case 'edit':
        setEditingMessageId(msg.id)
        setEditText(msg.plaintext)
        break
      case 'delete':
        // Only allow deleting own sent messages
        if (msg.senderId === userId) {
          deleteMessages(peerId, [msg.id])
        }
        break
    }
  }, [deleteMessages, peerId, userId])

  const handleOpenThread = useCallback((rootMessageId: string) => {
    setActiveThreadId(rootMessageId)
    setReplyingTo(null)
  }, [])

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

  const isSelf = peerId === userId
  const canCall = !isSelf && requestStatus === 'accepted' && onStartCall

  // Shared input area renderer (used in both main view and thread view)
  const renderInputArea = () => {
    if (hasSelection) {
      return (
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

    if (requestStatus === 'received') {
      return (
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
      )
    }

    return (
      <div className="shrink-0 border-t border-primary/10">
        {/* Replying-to banner */}
        {replyingTo && !activeThreadId && (
          <div className="px-4 pt-2 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 min-w-0 bg-themewhite2 rounded-lg px-3 py-1.5">
              <div className="w-0.5 self-stretch rounded-full bg-themeblue2 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-themeblue2">Replying to</p>
                <p className="text-[11px] text-tertiary/60 truncate">
                  {(replyingTo.plaintext || '\u{1F4F7} Photo').slice(0, 60)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded-full hover:bg-primary/5 active:scale-95 transition-all shrink-0"
            >
              <X size={14} className="text-tertiary/50" />
            </button>
          </div>
        )}

        {/* Input row — extra bottom padding on mobile */}
        <div className="px-4 pt-3 pb-8 md:pb-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            {requestStatus === 'accepted' && !activeThreadId && (
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
              placeholder={
                activeThreadId ? 'Reply in thread...'
                  : requestStatus === 'sent' ? 'Waiting for response...'
                  : 'Type a message...'
              }
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
      </div>
    )
  }

  // Render message list (shared between main and thread views)
  const renderMessageList = (msgs: DecryptedSignalMessage[], emptyText: string) => (
    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3"
      onScroll={() => setContextMenu(null)}
    >
      {msgs.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-tertiary/40">{emptyText}</p>
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
                avatar={!own ? <UserAvatar avatarId={peerAvatarId} firstName={peerFirstName} lastName={peerLastName} className="w-7 h-7" /> : undefined}
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
              {/* Separator after thread root in thread view */}
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

  // ── Thread view ──────────────────────────────────────────────────────
  if (activeThreadId) {
    return (
      <div className="flex flex-col h-full relative">
        {/* Thread header */}
        <div className="shrink-0 px-4 py-2.5 border-b border-primary/10 flex items-center gap-3 bg-themewhite3">
          <button
            onClick={() => setActiveThreadId(null)}
            className="p-1 rounded-full hover:bg-primary/5 active:scale-95 transition-all"
          >
            <ArrowLeft size={18} className="text-tertiary" />
          </button>
          <div className="flex items-center gap-1.5">
            <MessageSquare size={14} className="text-themeblue2" />
            <p className="text-sm font-medium text-primary">Thread</p>
          </div>
        </div>

        {renderMessageList(threadMessages, 'No messages in this thread')}

        {/* Context menu popup */}
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

        {renderInputArea()}
      </div>
    )
  }

  // ── Main view ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full relative">
      {/* Mobile conversation header — circle buttons matching NavTop */}
      <div className="md:hidden shrink-0 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] border-b border-primary/10 flex items-center bg-themewhite3">
        <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 overflow-hidden shrink-0">
          <button onClick={onBack} className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <ChevronLeft className="w-6 h-6 text-tertiary" />
          </button>
        </div>
        <p className="flex-1 text-sm font-medium text-primary truncate text-center mx-3">
          {peerName ?? (isSelf ? 'Notes' : 'Chat')}
        </p>
        {canCall ? (
          <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 overflow-hidden shrink-0">
            <button onClick={onStartCall} className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform">
              <Phone className="w-5 h-5 text-themeblue2" />
            </button>
          </div>
        ) : (
          <div className="w-12 shrink-0" />
        )}
      </div>

      {/* Desktop header — unchanged */}
      <div className="hidden md:flex shrink-0 px-4 py-2.5 border-b border-primary/10 items-center justify-between bg-themewhite3">
        <p className="text-sm font-medium text-primary truncate">
          {peerName ?? (isSelf ? 'Notes' : 'Chat')}
        </p>
        {canCall && (
          <button
            onClick={onStartCall}
            className="p-2 rounded-full hover:bg-primary/5 active:scale-95 transition-all"
          >
            <Phone size={18} className="text-themeblue2" />
          </button>
        )}
      </div>

      {renderMessageList(
        messages,
        peerId === userId ? 'Write a note...' : 'No messages yet. Say hello!',
      )}

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

      {renderInputArea()}

      {/* Forward contact picker overlay */}
      {showForwardPicker && (
        <ForwardPicker
          conversations={conversations}
          currentPeerId={peerId}
          medics={medics}
          onSelect={handleForwardSelect}
          onCancel={() => setShowForwardPicker(false)}
        />
      )}
    </div>
  )
}

// ── Group Chat Detail ──────────────────────────────────────────────────────

function GroupChatDetail({
  groupId,
  group,
  conversations,
  medics,
  sendGroupMessage,
  sendGroupImage,
  sending,
  markAsRead,
  fetchGroupHistory,
  editMessage,
  deleteMessages,
  onBack,
  leaveGroup,
  renameGroup,
  addGroupMember,
  removeGroupMember,
  fetchGroupMembers,
}: {
  groupId: string
  group: GroupInfo
  conversations: Record<string, DecryptedSignalMessage[]>
  medics: ClinicMedic[]
  sendGroupMessage: (groupId: string, text: string, threadId?: string) => Promise<boolean>
  sendGroupImage: (groupId: string, file: File) => Promise<boolean>
  sending: boolean
  markAsRead: (peerId: string) => void
  fetchGroupHistory: (groupId: string) => Promise<void>
  editMessage: (peerId: string, messageId: string, newText: string) => void
  deleteMessages: (peerId: string, messageIds: string[]) => void
  onBack?: () => void
  leaveGroup: (groupId: string) => Promise<void>
  renameGroup: (groupId: string, name: string) => Promise<void>
  addGroupMember: (groupId: string, userId: string) => Promise<void>
  removeGroupMember: (groupId: string, userId: string) => Promise<void>
  fetchGroupMembers: (groupId: string) => Promise<GroupMember[]>
}) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showGroupInfo, setShowGroupInfo] = useState(false)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [replyingTo, setReplyingTo] = useState<DecryptedSignalMessage | null>(null)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  // Cache members for sender name resolution
  const [membersCache, setMembersCache] = useState<GroupMember[]>([])

  const messages = conversations[groupId] ?? []
  const hasSelection = selectedIds.size > 0
  const canDeleteSelection = hasSelection && [...selectedIds].every(id => {
    const m = messages.find(msg => msg.id === id)
    return m && m.senderId === userId
  })

  const threadReplyCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of messages) {
      if (m.threadId) counts[m.threadId] = (counts[m.threadId] ?? 0) + 1
    }
    return counts
  }, [messages])

  const threadMessages = useMemo(() => {
    if (!activeThreadId) return []
    return messages.filter(m => m.id === activeThreadId || m.threadId === activeThreadId)
  }, [activeThreadId, messages])

  const contextMsg = contextMenu ? messages.find(m => m.id === contextMenu.messageId) : null

  // Build sender name lookup from cached members
  const senderNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const m of membersCache) {
      const parts: string[] = []
      if (m.rank) parts.push(m.rank)
      if (m.lastName) parts.push(m.lastName)
      map[m.userId] = parts.join(' ') || m.firstName || 'Unknown'
    }
    return map
  }, [membersCache])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    markAsRead(groupId)
    fetchGroupHistory(groupId)
    // Load members for sender name display
    fetchGroupMembers(groupId).then(setMembersCache)
  }, [groupId, markAsRead, fetchGroupHistory, fetchGroupMembers])

  useEffect(() => {
    setSelectedIds(new Set())
    setReplyingTo(null)
    setActiveThreadId(null)
  }, [groupId])

  const handlePastedImage = useCallback((file: File) => {
    sendGroupImage(groupId, file)
  }, [sendGroupImage, groupId])
  useImagePaste(!sending, handlePastedImage)

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const threadId = activeThreadId ?? replyingTo?.id ?? undefined
    setText('')
    setReplyingTo(null)
    const success = await sendGroupMessage(groupId, trimmed, threadId)
    if (!success) setText(trimmed)
    inputRef.current?.focus()
  }, [text, sending, sendGroupMessage, groupId, activeThreadId, replyingTo])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }, [handleSend])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) sendGroupImage(groupId, file)
    e.target.value = ''
  }, [sendGroupImage, groupId])

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
    if (trimmed) editMessage(groupId, editingMessageId, trimmed)
    setEditingMessageId(null)
    setEditText('')
  }, [editingMessageId, editText, editMessage, groupId])

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null)
    setEditText('')
  }, [])

  const handleTap = useCallback((message: DecryptedSignalMessage) => {
    if (editingMessageId) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(message.id)) next.delete(message.id)
      else next.add(message.id)
      return next
    })
  }, [editingMessageId])

  const handleDelete = useCallback(() => {
    deleteMessages(groupId, [...selectedIds])
    setSelectedIds(new Set())
  }, [deleteMessages, groupId, selectedIds])

  const handleReply = useCallback(() => {
    const firstSelected = messages.find(m => selectedIds.has(m.id))
    if (firstSelected) {
      setReplyingTo(firstSelected)
      setSelectedIds(new Set())
      inputRef.current?.focus()
    }
  }, [messages, selectedIds])

  const handleSwipeAction = useCallback((msg: DecryptedSignalMessage, action: SwipeAction) => {
    switch (action) {
      case 'copy': navigator.clipboard.writeText(msg.plaintext).catch(() => {}); break
      case 'reply': setReplyingTo(msg); inputRef.current?.focus(); break
      case 'edit': setEditingMessageId(msg.id); setEditText(msg.plaintext); break
      case 'delete':
        if (msg.senderId === userId) {
          deleteMessages(groupId, [msg.id])
        }
        break
    }
  }, [deleteMessages, groupId, userId])

  const handleOpenThread = useCallback((rootMessageId: string) => {
    setActiveThreadId(rootMessageId)
    setReplyingTo(null)
  }, [])

  const handleLeave = useCallback(async (gid: string) => {
    await leaveGroup(gid)
    onBack?.()
  }, [leaveGroup, onBack])

  // Render group input area (no request flow)
  const renderInputArea = () => {
    if (hasSelection) {
      return (
        <div className="shrink-0 px-4 py-3 border-t border-primary/10">
          <div className="flex items-center justify-around">
            <button onClick={handleReply} className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl hover:bg-primary/5 active:scale-95 transition-all">
              <Reply size={18} className="text-tertiary" />
              <span className="text-[10px] text-tertiary">Reply</span>
            </button>
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

    return (
      <div className="shrink-0 border-t border-primary/10">
        {replyingTo && !activeThreadId && (
          <div className="px-4 pt-2 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 min-w-0 bg-themewhite2 rounded-lg px-3 py-1.5">
              <div className="w-0.5 self-stretch rounded-full bg-themeblue2 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-themeblue2">Replying to</p>
                <p className="text-[11px] text-tertiary/60 truncate">
                  {(replyingTo.plaintext || '\u{1F4F7} Photo').slice(0, 60)}
                </p>
              </div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 rounded-full hover:bg-primary/5 active:scale-95 transition-all shrink-0">
              <X size={14} className="text-tertiary/50" />
            </button>
          </div>
        )}
        <div className="px-4 pt-3 pb-8 md:pb-3">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          <div className="flex items-center gap-2">
            {!activeThreadId && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-primary/5 active:scale-95 transition-all shrink-0 disabled:opacity-30"
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
              placeholder={activeThreadId ? 'Reply in thread...' : 'Type a message...'}
              className="flex-1 px-4 py-2.5 rounded-full bg-themewhite2 text-sm text-primary placeholder:text-tertiary/40 outline-none focus:ring-1 focus:ring-themeblue2/40 transition-all"
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="w-10 h-10 rounded-full bg-themeblue2 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all shrink-0"
            >
              <Send size={16} className="text-white ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderMessageList = (msgs: DecryptedSignalMessage[], emptyText: string) => (
    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3" onScroll={() => setContextMenu(null)}>
      {msgs.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-tertiary/40">{emptyText}</p>
        </div>
      ) : (
        msgs.map((msg, idx) => {
          const own = msg.senderId === userId
          const isThreadRoot = activeThreadId && msg.id === activeThreadId && idx === 0
          // Resolve sender avatar info from medics or cached members
          const senderMedic = !own ? medics.find(m => m.id === msg.senderId) : null
          const senderMember = !own ? membersCache.find(m => m.userId === msg.senderId) : null
          return (
            <div key={msg.id}>
              <MessageBubble
                message={msg}
                isOwn={own}
                avatar={!own ? (
                  <UserAvatar
                    avatarId={senderMedic?.avatarId ?? senderMember?.avatarId}
                    firstName={senderMedic?.firstName ?? senderMember?.firstName}
                    lastName={senderMedic?.lastName ?? senderMember?.lastName}
                    className="w-7 h-7"
                  />
                ) : undefined}
                senderName={!own ? senderNameMap[msg.senderId] : undefined}
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

  // Thread view
  if (activeThreadId) {
    return (
      <div className="flex flex-col h-full relative">
        <div className="shrink-0 px-4 py-2.5 border-b border-primary/10 flex items-center gap-3 bg-themewhite3">
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
            onCopy={handleCopy} onEdit={handleStartEdit} onSave={handleSaveImage}
            onClose={() => setContextMenu(null)}
          />
        )}
        {renderInputArea()}
      </div>
    )
  }

  // Main group chat view
  return (
    <div className="flex flex-col h-full relative">
      {/* Mobile group header — circle buttons matching NavTop */}
      <div className="md:hidden shrink-0 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] border-b border-primary/10 flex items-center bg-themewhite3">
        <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 overflow-hidden shrink-0">
          <button onClick={onBack} className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <ChevronLeft className="w-6 h-6 text-tertiary" />
          </button>
        </div>
        <div className="flex-1 min-w-0 text-center mx-3">
          <p className="text-sm font-medium text-primary truncate">{group.name}</p>
          <p className="text-[10px] text-tertiary/40">{group.memberCount} members</p>
        </div>
        <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 overflow-hidden shrink-0">
          <button onClick={() => setShowGroupInfo(true)} className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <Info className="w-5 h-5 text-tertiary" />
          </button>
        </div>
      </div>

      {/* Desktop group header — unchanged */}
      <div className="hidden md:flex shrink-0 px-4 py-2.5 border-b border-primary/10 items-center justify-between bg-themewhite3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
            <Users size={14} className="text-themeblue2" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary truncate">{group.name}</p>
            <p className="text-[10px] text-tertiary/40">{group.memberCount} members</p>
          </div>
        </div>
        <button
          onClick={() => setShowGroupInfo(true)}
          className="p-2 rounded-full hover:bg-primary/5 active:scale-95 transition-all"
        >
          <Info size={18} className="text-tertiary" />
        </button>
      </div>

      {renderMessageList(messages, 'No messages yet. Start the conversation!')}

      {contextMenu && contextMsg && (
        <MessageContextMenu
          x={contextMenu.x} y={contextMenu.y}
          isOwn={contextMsg.senderId === userId}
          isImage={contextMsg.content?.type === 'image'}
          onCopy={handleCopy} onEdit={handleStartEdit} onSave={handleSaveImage}
          onClose={() => setContextMenu(null)}
        />
      )}

      {renderInputArea()}

      {/* Group info overlay */}
      {showGroupInfo && (
        <GroupInfoPanel
          group={group}
          userId={userId}
          medics={medics}
          onClose={() => setShowGroupInfo(false)}
          onLeave={handleLeave}
          onRename={renameGroup}
          onAddMember={addGroupMember}
          onRemoveMember={removeGroupMember}
          fetchMembers={fetchGroupMembers}
        />
      )}
    </div>
  )
}

// ── Exported Panel ─────────────────────────────────────────────────────────

export function MessagesPanel({ view, selectedPeerId, selectedGroupId, onSelectPeer, onSelectGroup, onBack }: MessagesPanelProps) {
  const messagesCtx = useMessagesContext()
  const { medics, loading } = useClinicMedics()
  const callActions = useCallActions()
  const [showCreateGroup, setShowCreateGroup] = useState(false)

  if (!messagesCtx) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-tertiary/50">Sign in to use messages.</p>
      </div>
    )
  }

  const {
    conversations, unreadCounts, sendMessage, sendImage, sending,
    markAsRead, fetchHistory, acceptRequest, editMessage, deleteMessages,
    getRequestStatusForPeer, groups, sendGroupMessage, sendGroupImage,
    createGroup, leaveGroup, renameGroup, addGroupMember, removeGroupMember,
    fetchGroupMembers, fetchGroupHistory,
  } = messagesCtx

  // Group chat view
  if (view === 'messages-group-chat' && selectedGroupId && groups[selectedGroupId]) {
    return (
      <GroupChatDetail
        groupId={selectedGroupId}
        group={groups[selectedGroupId]}
        conversations={conversations}
        medics={medics}
        sendGroupMessage={sendGroupMessage}
        sendGroupImage={sendGroupImage}
        sending={sending}
        markAsRead={markAsRead}
        fetchGroupHistory={fetchGroupHistory}
        editMessage={editMessage}
        deleteMessages={deleteMessages}
        onBack={onBack}
        leaveGroup={leaveGroup}
        renameGroup={renameGroup}
        addGroupMember={addGroupMember}
        removeGroupMember={removeGroupMember}
        fetchGroupMembers={fetchGroupMembers}
      />
    )
  }

  // 1:1 chat view
  if (view === 'messages-chat' && selectedPeerId) {
    const peer = medics.find(m => m.id === selectedPeerId)
    const peerName = peer
      ? [peer.rank, peer.lastName].filter(Boolean).join(' ') || peer.firstName || undefined
      : undefined

    return (
      <ChatDetail
        peerId={selectedPeerId}
        conversations={conversations}
        medics={medics}
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
        onStartCall={callActions ? () => callActions.startCall({ userId: selectedPeerId, displayName: peerName ?? 'Unknown' }) : undefined}
        peerName={peerName}
        peerAvatarId={peer?.avatarId}
        peerFirstName={peer?.firstName}
        peerLastName={peer?.lastName}
      />
    )
  }

  return (
    <>
      <ConversationList
        onSelectPeer={onSelectPeer}
        onSelectGroup={onSelectGroup}
        conversations={conversations}
        unreadCounts={unreadCounts}
        medics={medics}
        groups={groups}
        loading={loading}
        onCreateGroup={() => setShowCreateGroup(true)}
      />
      {showCreateGroup && (
        <CreateGroupModal
          medics={medics}
          onClose={() => setShowCreateGroup(false)}
          onCreate={createGroup}
        />
      )}
      <ProvisionalDeviceModal />
    </>
  )
}
