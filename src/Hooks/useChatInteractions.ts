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

  // ── Forward ──
  showForwardPicker: boolean
  forwardingMessage: DecryptedSignalMessage | null
  handleContextForward: () => void
  handleForwardSelect: (medic: ClinicMedic) => Promise<void>
  closeForwardPicker: () => void

  // ── Reply ──
  replyingTo: DecryptedSignalMessage | null
  setReplyingTo: (msg: DecryptedSignalMessage | null) => void
  handleContextReply: () => void

  // ── Thread ──
  activeThreadId: string | null
  setActiveThreadId: (id: string | null) => void
  handleOpenThread: (rootMessageId: string) => void

  // ── Delete confirmation ──
  pendingDelete: PendingDelete | null
  handleContextDelete: () => void
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

  // ── Forward ──
  const [showForwardPicker, setShowForwardPicker] = useState(false)
  const [forwardingMessage, setForwardingMessage] = useState<DecryptedSignalMessage | null>(null)

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
    return messages.filter(m => m.id === activeThreadId || m.originId === activeThreadId || m.threadId === activeThreadId)
  }, [activeThreadId, messages])

  const mainViewMessages = useMemo(() => messages.filter(m => !m.threadId), [messages])

  const contextMsg = contextMenu ? messages.find(m => m.id === contextMenu.messageId) ?? null : null

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

  // ── Context menu reply ──
  const handleContextReply = useCallback(() => {
    if (!contextMsg) return
    setReplyingTo(contextMsg)
    setContextMenu(null)
    inputRef.current?.focus()
  }, [contextMsg, inputRef])

  // ── Context menu forward ──
  const handleContextForward = useCallback(() => {
    if (!contextMsg) return
    setForwardingMessage(contextMsg)
    setShowForwardPicker(true)
    setContextMenu(null)
  }, [contextMsg])

  const handleForwardSelect = useCallback(async (medic: ClinicMedic) => {
    if (forwardingMessage) {
      await sendMessage(medic.id, forwardingMessage.plaintext)
    }
    setShowForwardPicker(false)
    setForwardingMessage(null)
  }, [forwardingMessage, sendMessage])

  const closeForwardPicker = useCallback(() => {
    setShowForwardPicker(false)
    setForwardingMessage(null)
  }, [])

  // ── Thread handlers ──
  const handleOpenThread = useCallback((rootMessageId: string) => {
    setActiveThreadId(rootMessageId)
    setReplyingTo(null)
  }, [])

  // ── Context menu delete ──
  const handleContextDelete = useCallback(() => {
    if (!contextMsg || contextMsg.senderId !== userId) return
    setPendingDelete({ peerId: conversationKey, messageIds: [contextMsg.id] })
    setContextMenu(null)
  }, [contextMsg, conversationKey, userId])

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDelete) return
    deleteMessages(pendingDelete.peerId, pendingDelete.messageIds)
    setPendingDelete(null)
  }, [deleteMessages, pendingDelete])

  const closePendingDelete = useCallback(() => setPendingDelete(null), [])

  // ── Swipe action handler (Gmail-style: right=reply, left=delete) ──
  const handleSwipeAction = useCallback((msg: DecryptedSignalMessage, action: SwipeAction) => {
    switch (action) {
      case 'reply':
        setReplyingTo(msg)
        inputRef.current?.focus()
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
    // Forward
    showForwardPicker,
    forwardingMessage,
    handleContextForward,
    handleForwardSelect,
    closeForwardPicker,
    // Reply
    replyingTo,
    setReplyingTo,
    handleContextReply,
    // Thread
    activeThreadId,
    setActiveThreadId,
    handleOpenThread,
    // Delete confirmation
    pendingDelete,
    handleContextDelete,
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
