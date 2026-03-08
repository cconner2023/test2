/**
 * Shared chat interaction state and handlers.
 *
 * Extracted from MessagesPanel.tsx where the identical state management
 * logic was duplicated in both ChatDetail and GroupChatDetail.
 *
 * Manages:
 * - Context menu (long press position + target message)
 * - Edit mode (editing message id + edit text)
 * - Selection state (selected message ids + multi-select)
 * - Forward picker visibility
 * - Reply-to banner
 * - Thread view (active thread id)
 * - Delete confirmation pending state
 *
 * Also provides computed derived values:
 * - threadReplyCounts: how many replies each message root has
 * - threadMessages: messages in the active thread view
 * - mainViewMessages: messages excluding thread replies
 * - contextMsg: the message being context-menued
 * - hasSelection, canDeleteSelection: selection state helpers
 */

import { useState, useCallback, useMemo } from 'react'
import type { DecryptedSignalMessage } from '../lib/signal/transportTypes'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'
import type { SwipeAction } from '../Components/Settings/MessageBubble'

export interface PendingDelete {
  peerId: string
  messageIds: string[]
}

export interface ChatInteractionsOptions {
  /** The conversation key (peerId or groupId) — used in delete/swipe handlers. */
  conversationKey: string
  /** The current user's id — used for "can delete" checks. */
  userId: string
  /** All messages in this conversation. */
  messages: DecryptedSignalMessage[]
  /** Called when a message edit should be saved. */
  editMessage: (conversationKey: string, messageId: string, newText: string) => void
  /** Called when messages should be permanently deleted. */
  deleteMessages: (conversationKey: string, messageIds: string[]) => void
  /** Ref to the input element (for focus management after reply/forward). */
  inputRef: React.RefObject<HTMLInputElement | null>
  /** Called to send a message to a specific peer (for forward flow). */
  sendMessage: (peerId: string, text: string) => Promise<boolean>
}

export interface ChatInteractionsResult {
  // ── Context menu ──
  contextMenu: { messageId: string; x: number; y: number } | null
  contextMsg: DecryptedSignalMessage | null
  handleLongPress: (message: DecryptedSignalMessage, x: number, y: number) => void
  handleCopy: () => void
  handleStartEdit: () => void
  handleSaveImage: () => Promise<void>
  closeContextMenu: () => void

  // ── Edit mode ──
  editingMessageId: string | null
  editText: string
  setEditText: (text: string) => void
  handleSaveEdit: () => void
  handleCancelEdit: () => void

  // ── Selection ──
  selectedIds: Set<string>
  hasSelection: boolean
  canDeleteSelection: boolean
  handleTap: (message: DecryptedSignalMessage) => void
  clearSelection: () => void

  // ── Forward ──
  showForwardPicker: boolean
  handleForwardStart: () => void
  handleForwardSelect: (medic: ClinicMedic) => Promise<void>
  closeForwardPicker: () => void

  // ── Reply ──
  replyingTo: DecryptedSignalMessage | null
  setReplyingTo: (msg: DecryptedSignalMessage | null) => void
  handleReply: () => void

  // ── Thread ──
  activeThreadId: string | null
  setActiveThreadId: (id: string | null) => void
  handleOpenThread: (rootMessageId: string) => void

  // ── Delete confirmation ──
  pendingDelete: PendingDelete | null
  handleDelete: () => void
  handleConfirmDelete: () => void
  closePendingDelete: () => void

  // ── Swipe action ──
  handleSwipeAction: (msg: DecryptedSignalMessage, action: SwipeAction) => void

  // ── Derived values ──
  threadReplyCounts: Record<string, number>
  threadMessages: DecryptedSignalMessage[]
  mainViewMessages: DecryptedSignalMessage[]
}

export function useChatInteractions({
  conversationKey,
  userId,
  messages,
  editMessage,
  deleteMessages,
  inputRef,
  sendMessage,
}: ChatInteractionsOptions): ChatInteractionsResult {
  // ── Context menu ──
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null)

  // ── Edit mode ──
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  // ── Selection ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ── Forward ──
  const [showForwardPicker, setShowForwardPicker] = useState(false)

  // ── Reply ──
  const [replyingTo, setReplyingTo] = useState<DecryptedSignalMessage | null>(null)

  // ── Thread ──
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  // ── Delete confirmation ──
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

  // ── Derived values ──
  const threadReplyCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of messages) {
      if (m.threadId) {
        counts[m.threadId] = (counts[m.threadId] ?? 0) + 1
      }
    }
    return counts
  }, [messages])

  const threadMessages = useMemo(() => {
    if (!activeThreadId) return []
    return messages.filter(m => m.id === activeThreadId || m.threadId === activeThreadId)
  }, [activeThreadId, messages])

  const mainViewMessages = useMemo(() => messages.filter(m => !m.threadId), [messages])

  const contextMsg = contextMenu ? messages.find(m => m.id === contextMenu.messageId) ?? null : null

  const hasSelection = selectedIds.size > 0

  const canDeleteSelection = hasSelection && [...selectedIds].every(id => {
    const m = messages.find(msg => msg.id === id)
    return m && m.senderId === userId
  })

  // ── Context menu handlers ──
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
    const { downloadDecryptedAttachment } = await import('../lib/signal/attachmentService')
    const result = await downloadDecryptedAttachment(contextMsg.content.path, contextMsg.content.key)
    if (!result.ok) return
    const url = URL.createObjectURL(result.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `photo-${Date.now()}.jpg`
    a.click()
    URL.revokeObjectURL(url)
  }, [contextMsg])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  // ── Edit handlers ──
  const handleSaveEdit = useCallback(() => {
    if (!editingMessageId) return
    const trimmed = editText.trim()
    if (trimmed) {
      editMessage(conversationKey, editingMessageId, trimmed)
    }
    setEditingMessageId(null)
    setEditText('')
  }, [editingMessageId, editText, editMessage, conversationKey])

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null)
    setEditText('')
  }, [])

  // ── Selection handlers ──
  const handleTap = useCallback((message: DecryptedSignalMessage) => {
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

  // ── Forward handlers ──
  const handleForwardStart = useCallback(() => {
    setShowForwardPicker(true)
  }, [])

  const handleForwardSelect = useCallback(async (medic: ClinicMedic) => {
    const selectedMsgs = messages.filter(m => selectedIds.has(m.id))
    for (const msg of selectedMsgs) {
      await sendMessage(medic.id, msg.plaintext)
    }
    setShowForwardPicker(false)
    setSelectedIds(new Set())
  }, [messages, selectedIds, sendMessage])

  const closeForwardPicker = useCallback(() => setShowForwardPicker(false), [])

  // ── Reply handlers ──
  const handleReply = useCallback(() => {
    const firstSelected = messages.find(m => selectedIds.has(m.id))
    if (firstSelected) {
      setReplyingTo(firstSelected)
      setSelectedIds(new Set())
      inputRef.current?.focus()
    }
  }, [messages, selectedIds, inputRef])

  // ── Thread handlers ──
  const handleOpenThread = useCallback((rootMessageId: string) => {
    setActiveThreadId(rootMessageId)
    setReplyingTo(null)
  }, [])

  // ── Delete confirmation handlers ──
  const handleDelete = useCallback(() => {
    setPendingDelete({ peerId: conversationKey, messageIds: [...selectedIds] })
  }, [conversationKey, selectedIds])

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDelete) return
    deleteMessages(pendingDelete.peerId, pendingDelete.messageIds)
    setPendingDelete(null)
    setSelectedIds(new Set())
  }, [deleteMessages, pendingDelete])

  const closePendingDelete = useCallback(() => setPendingDelete(null), [])

  // ── Swipe action handler ──
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
        if (msg.senderId === userId) {
          setPendingDelete({ peerId: conversationKey, messageIds: [msg.id] })
        }
        break
    }
  }, [conversationKey, userId, inputRef])

  return {
    // Context menu
    contextMenu,
    contextMsg,
    handleLongPress,
    handleCopy,
    handleStartEdit,
    handleSaveImage,
    closeContextMenu,
    // Edit mode
    editingMessageId,
    editText,
    setEditText,
    handleSaveEdit,
    handleCancelEdit,
    // Selection
    selectedIds,
    hasSelection,
    canDeleteSelection,
    handleTap,
    clearSelection,
    // Forward
    showForwardPicker,
    handleForwardStart,
    handleForwardSelect,
    closeForwardPicker,
    // Reply
    replyingTo,
    setReplyingTo,
    handleReply,
    // Thread
    activeThreadId,
    setActiveThreadId,
    handleOpenThread,
    // Delete confirmation
    pendingDelete,
    handleDelete,
    handleConfirmDelete,
    closePendingDelete,
    // Swipe action
    handleSwipeAction,
    // Derived values
    threadReplyCounts,
    threadMessages,
    mainViewMessages,
  }
}
