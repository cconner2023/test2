import { useState, useRef, useEffect, useCallback, memo, useImperativeHandle, forwardRef, useMemo } from 'react'
import { Send, Trash2, Forward, Reply, X, ImagePlus, Phone, Video, ArrowLeft, MessageSquare, Users, Info, ChevronLeft, Pin, PenLine, ChevronDown, ChevronRight } from 'lucide-react'
import { ConfirmDialog } from '../ConfirmDialog'
import { useSpring, animated } from '@react-spring/web'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import type { RequestStatus } from '../../Hooks/useMessages'
import { ContactListItem } from './ContactListItem'
import { GroupListItem } from './GroupListItem'
import { CreateGroupModal } from './CreateGroupModal'
import { GroupInfoPanel } from './GroupInfoPanel'
import { MessageBubble } from './MessageBubble'
import { MessageContextMenu } from './MessageContextMenu'
import { UserAvatar } from './UserAvatar'
import { LoadingSpinner } from '../LoadingSpinner'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { ProvisionalDeviceModal } from './ProvisionalDeviceModal'
import { useAuth } from '../../Hooks/useAuth'
import { useCallActions } from '../../Hooks/CallContext'
import { useAvatar } from '../../Utilities/AvatarContext'
import { useImagePaste } from '../../Hooks/useImagePaste'
import { useIOSKeyboard } from '../../Hooks/useIOSKeyboard'
import { CardContextMenu } from '../CardContextMenu'
import { SwipeableCard, type SwipeAction as SwipeCardAction } from '../SwipeableCard'
import { useClinicGroupedMedics } from '../../Hooks/useClinicGroupedMedics'
import { useChatInteractions } from '../../Hooks/useChatInteractions'
import { usePeerAvailability, type UnavailableReason } from '../../Hooks/usePeerAvailability'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import type { GroupInfo, GroupMember } from '../../lib/signal/groupTypes'
import { playSendSound } from '../../lib/soundService'

export type MessagesView = 'messages' | 'messages-chat' | 'messages-group-chat'

export interface MessagesPanelHandle {
  createGroup: () => void
}

interface MessagesPanelProps {
  view: MessagesView
  selectedPeerId: string | null
  selectedGroupId: string | null
  onSelectPeer: (medic: ClinicMedic) => void
  onSelectGroup: (group: GroupInfo) => void
  onBack?: () => void
  onCloseDrawer?: () => void
  searchQuery: string
  onSearchClear: () => void
}

// ── Conversation Pane (shared across mobile + desktop) ───────────────────

type ConversationEntry = {
  key: string
  type: 'contact' | 'group'
  lastMessageTime: string
  medic?: ClinicMedic
  group?: GroupInfo
}

interface ConversationPaneProps {
  medics: ClinicMedic[]
  groups: Record<string, GroupInfo>
  conversations: Record<string, DecryptedSignalMessage[]>
  unreadCounts: Record<string, number>
  unavailableIds: Map<string, UnavailableReason>
  onSelectPeer: (medic: ClinicMedic) => void
  onSelectGroup: (group: GroupInfo) => void
  onCreateGroup: () => void
  deleteConversation: (conversationKey: string) => void
  loading?: boolean
  searchQuery: string
  onSearchClear: () => void
}

function ConversationPane({
  medics,
  groups,
  conversations,
  unreadCounts,
  unavailableIds,
  onSelectPeer,
  onSelectGroup,
  onCreateGroup,
  deleteConversation,
  loading,
  searchQuery,
  onSearchClear,
}: ConversationPaneProps) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { currentAvatar } = useAvatar()
  const { ownClinicMedics, nearbyByClinic, nearbyClinicNames } = useClinicGroupedMedics(medics)
  const [expandedClinics, setExpandedClinics] = useState<Record<string, boolean>>({ __own__: true })
  const [pinnedKeys, setPinnedKeys] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ conversationKey: string; x: number; y: number } | null>(null)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const showLoading = useMinLoadTime(loading ?? false)

  const sortedGroups = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name))

  const toggleClinic = (key: string) => {
    setExpandedClinics(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Build recent conversations list
  const recentEntries = useMemo(() => {
    const entries: ConversationEntry[] = []
    const medicMap = new Map(medics.map(m => [m.id, m]))
    for (const [key, msgs] of Object.entries(conversations)) {
      if (key === userId) continue
      const visibleMsgs = msgs.filter(m => m.messageType !== 'request-accepted' && !m.threadId)
      if (visibleMsgs.length === 0) continue
      const lastTime = visibleMsgs.at(-1)?.createdAt ?? ''
      if (groups[key]) {
        entries.push({ key, type: 'group', lastMessageTime: lastTime, group: groups[key] })
      } else {
        const medic = medicMap.get(key)
        if (medic) entries.push({ key, type: 'contact', lastMessageTime: lastTime, medic })
      }
    }
    entries.sort((a, b) => {
      const aPin = pinnedKeys.has(a.key) ? 1 : 0
      const bPin = pinnedKeys.has(b.key) ? 1 : 0
      if (aPin !== bPin) return bPin - aPin
      return b.lastMessageTime.localeCompare(a.lastMessageTime)
    })
    return entries
  }, [conversations, medics, groups, userId, pinnedKeys])

  // Self-notes entry
  const selfMedic: ClinicMedic | null = userId
    ? { id: userId, firstName: null, lastName: 'Notes', middleInitial: null, rank: null, credential: null, avatarId: currentAvatar.id }
    : null

  // Search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.toLowerCase()
    const allMedics = selfMedic ? [selfMedic as typeof medics[0], ...medics] : medics
    const matchedMedics = allMedics.filter(m =>
      m.firstName?.toLowerCase().includes(q) ||
      m.lastName?.toLowerCase().includes(q) ||
      m.rank?.toLowerCase().includes(q) ||
      m.credential?.toLowerCase().includes(q) ||
      m.clinicName?.toLowerCase().includes(q) ||
      [m.rank, m.lastName].filter(Boolean).join(' ').toLowerCase().includes(q)
    )
    const matchedGroups = Object.values(groups).filter(g => g.name.toLowerCase().includes(q))

    // Message content search — deduplicate against name matches
    const alreadyMatched = new Set<string>([
      ...matchedMedics.map(m => m.id),
      ...matchedGroups.map(g => g.groupId),
    ])
    const medicMap = new Map(medics.map(m => [m.id, m]))
    if (selfMedic) medicMap.set(selfMedic.id, selfMedic as typeof medics[0])
    const messageMatches: { conversationKey: string; type: 'contact' | 'group'; medic?: typeof medics[0]; group?: typeof groups[string]; matchedText: string }[] = []
    for (const [key, msgs] of Object.entries(conversations)) {
      if (alreadyMatched.has(key)) continue
      for (const msg of msgs) {
        if (msg.threadId || msg.messageType === 'request-accepted') continue
        if (msg.plaintext?.toLowerCase().includes(q)) {
          messageMatches.push({
            conversationKey: key,
            type: groups[key] ? 'group' : 'contact',
            medic: medicMap.get(key),
            group: groups[key],
            matchedText: msg.plaintext,
          })
          break // first match per conversation
        }
      }
    }
    return { medics: matchedMedics, groups: matchedGroups, messages: messageMatches }
  }, [searchQuery, medics, groups, conversations, selfMedic])

  if (showLoading) {
    return (
      <LoadingSpinner label="Loading contacts..." className="py-12 text-tertiary" />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {/* Search results */}
        {searchResults ? (
          <div className="px-1">
            {searchResults.groups.length === 0 && searchResults.medics.length === 0 && searchResults.messages.length === 0 && (
              <p className="text-xs text-tertiary/30 px-3 py-4 text-center">No results for &ldquo;{searchQuery}&rdquo;</p>
            )}
            {searchResults.groups.length > 0 && (
              <>
                <p className="text-[10px] text-tertiary/50 px-3 mb-1 uppercase tracking-wide">Groups</p>
                {searchResults.groups.map(group => (
                  <GroupListItem
                    key={group.groupId}
                    group={group}
                    lastMessage={conversations[group.groupId]?.filter(m => !m.threadId).at(-1)?.plaintext}
                    unreadCount={unreadCounts[group.groupId] ?? 0}
                    onClick={() => { onSearchClear(); onSelectGroup(group) }}
                  />
                ))}
              </>
            )}
            {searchResults.medics.length > 0 && (
              <>
                <p className="text-[10px] text-tertiary/50 px-3 mb-1 mt-2 uppercase tracking-wide">Contacts</p>
                {searchResults.medics.map(medic => (
                  <ContactListItem
                    key={medic.id}
                    medic={medic}
                    lastMessage={conversations[medic.id]?.filter(m => !m.threadId).at(-1)?.plaintext}
                    unreadCount={unreadCounts[medic.id] ?? 0}
                    unavailable={unavailableIds.has(medic.id)}
                    unavailableReason={unavailableIds.get(medic.id)}
                    onClick={() => { onSearchClear(); onSelectPeer(medic) }}
                  />
                ))}
              </>
            )}
            {searchResults.messages.length > 0 && (
              <>
                <p className="text-[10px] text-tertiary/50 px-3 mb-1 mt-2 uppercase tracking-wide">Messages</p>
                {searchResults.messages.map(match => {
                  if (match.type === 'group' && match.group) {
                    return (
                      <GroupListItem
                        key={match.conversationKey}
                        group={match.group}
                        lastMessage={match.matchedText}
                        unreadCount={unreadCounts[match.conversationKey] ?? 0}
                        onClick={() => { onSearchClear(); onSelectGroup(match.group!) }}
                      />
                    )
                  }
                  if (match.medic) {
                    return (
                      <ContactListItem
                        key={match.conversationKey}
                        medic={match.medic}
                        lastMessage={match.matchedText}
                        unreadCount={unreadCounts[match.conversationKey] ?? 0}
                        unavailable={unavailableIds.has(match.conversationKey)}
                        unavailableReason={unavailableIds.get(match.conversationKey)}
                        onClick={() => { onSearchClear(); onSelectPeer(match.medic!) }}
                      />
                    )
                  }
                  return null
                })}
              </>
            )}
          </div>
        ) : (
          <>
            {/* Conversations section */}
            {selfMedic && (
              <ContactListItem
                medic={selfMedic}
                lastMessage={conversations[userId!]?.filter(m => !m.threadId).at(-1)?.plaintext}
                unreadCount={0}
                onClick={() => onSelectPeer(selfMedic)}
              />
            )}
            {recentEntries.length > 0 && (
              <>
                <p className="text-[10px] text-tertiary/50 px-3 mb-1 mt-1 uppercase tracking-wide">Recent</p>
                {recentEntries.map(entry => {
                  const msgs = conversations[entry.key]
                  const lastMsg = msgs?.filter(m => m.messageType !== 'request-accepted' && !m.threadId).at(-1)
                  const isPinned = pinnedKeys.has(entry.key)

                  const swipeActions: SwipeCardAction[] = [
                    {
                      key: 'pin',
                      label: isPinned ? 'Unpin' : 'Pin',
                      icon: Pin,
                      iconBg: 'bg-themeblue2/15',
                      iconColor: 'text-themeblue2',
                      onAction: () => {
                        setPinnedKeys(prev => {
                          const next = new Set(prev)
                          if (next.has(entry.key)) next.delete(entry.key)
                          else next.add(entry.key)
                          return next
                        })
                      },
                    },
                    {
                      key: 'delete',
                      label: 'Delete',
                      icon: Trash2,
                      iconBg: 'bg-themeredred/15',
                      iconColor: 'text-themeredred',
                      onAction: () => deleteConversation(entry.key),
                    },
                  ]

                  const handleTap = () => {
                    if (entry.type === 'group' && entry.group) onSelectGroup(entry.group)
                    else if (entry.type === 'contact' && entry.medic) onSelectPeer(entry.medic)
                  }

                  const listItem = entry.type === 'group' && entry.group ? (
                    <GroupListItem
                      group={entry.group}
                      lastMessage={lastMsg?.plaintext}
                      unreadCount={unreadCounts[entry.key] ?? 0}
                      onClick={() => {}}
                    />
                  ) : entry.type === 'contact' && entry.medic ? (
                    <ContactListItem
                      medic={entry.medic}
                      lastMessage={lastMsg?.plaintext}
                      unreadCount={unreadCounts[entry.key] ?? 0}
                      unavailable={unavailableIds.has(entry.key)}
                      unavailableReason={unavailableIds.get(entry.key)}
                      onClick={() => {}}
                    />
                  ) : null

                  if (!listItem) return null

                  return (
                    <SwipeableCard
                      key={entry.key}
                      actions={swipeActions}
                      isOpen={openSwipeId === entry.key}
                      enabled
                      onOpen={() => setOpenSwipeId(entry.key)}
                      onClose={() => setOpenSwipeId(prev => prev === entry.key ? null : prev)}
                      onTap={handleTap}
                      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ conversationKey: entry.key, x: e.clientX, y: e.clientY }) }}
                    >
                      <div className="bg-themewhite3">
                        {listItem}
                      </div>
                    </SwipeableCard>
                  )
                })}
              </>
            )}
            {recentEntries.length === 0 && (
              <p className="text-xs text-tertiary/30 px-4 py-8 text-center">
                No conversations yet. Tap <PenLine className="w-3.5 h-3.5 inline" /> to start one.
              </p>
            )}

            <div className="mx-3 my-2 border-b border-primary/10" />

            {/* Contacts: My Clinic (expanded by default) */}
            <button
              onClick={() => toggleClinic('__own__')}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-left hover:bg-themewhite2 rounded-lg transition-all"
            >
              {expandedClinics['__own__'] ? <ChevronDown className="w-3 h-3 text-tertiary/50" /> : <ChevronRight className="w-3 h-3 text-tertiary/50" />}
              <p className="text-[10px] text-tertiary/50 uppercase tracking-wide">My Clinic</p>
              <span className="text-[9px] text-tertiary/30 ml-auto">{ownClinicMedics.length}</span>
            </button>
            {expandedClinics['__own__'] && ownClinicMedics.map(medic => (
              <ContactListItem
                key={medic.id}
                medic={medic}
                lastMessage={conversations[medic.id]?.filter(m => !m.threadId).at(-1)?.plaintext}
                unreadCount={unreadCounts[medic.id] ?? 0}
                unavailable={unavailableIds.has(medic.id)}
                unavailableReason={unavailableIds.get(medic.id)}
                onClick={() => onSelectPeer(medic)}
              />
            ))}

            {/* Contacts: Nearby clinics (collapsed by default) */}
            {nearbyClinicNames.map(clinicName => (
              <div key={clinicName}>
                <button
                  onClick={() => toggleClinic(clinicName)}
                  className="flex items-center gap-1.5 w-full px-3 py-1.5 text-left hover:bg-themewhite2 rounded-lg transition-all"
                >
                  {expandedClinics[clinicName] ? <ChevronDown className="w-3 h-3 text-tertiary/50" /> : <ChevronRight className="w-3 h-3 text-tertiary/50" />}
                  <p className="text-[10px] text-tertiary/50 uppercase tracking-wide">{clinicName}</p>
                  <span className="text-[9px] text-tertiary/30 ml-auto">{nearbyByClinic[clinicName].length}</span>
                </button>
                {expandedClinics[clinicName] && nearbyByClinic[clinicName].map(medic => (
                  <ContactListItem
                    key={medic.id}
                    medic={medic}
                    lastMessage={conversations[medic.id]?.filter(m => !m.threadId).at(-1)?.plaintext}
                    unreadCount={unreadCounts[medic.id] ?? 0}
                    unavailable={unavailableIds.has(medic.id)}
                    unavailableReason={unavailableIds.get(medic.id)}
                    onClick={() => onSelectPeer(medic)}
                  />
                ))}
              </div>
            ))}

            {/* Groups section */}
            {sortedGroups.length > 0 && (
              <>
                <div className="mx-3 my-2 border-b border-primary/10" />
                <p className="text-[10px] text-tertiary/50 px-3 mb-1 uppercase tracking-wide">Groups</p>
                {sortedGroups.map(group => (
                  <GroupListItem
                    key={group.groupId}
                    group={group}
                    lastMessage={conversations[group.groupId]?.filter(m => !m.threadId).at(-1)?.plaintext}
                    unreadCount={unreadCounts[group.groupId] ?? 0}
                    onClick={() => onSelectGroup(group)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <CardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              key: 'pin',
              label: pinnedKeys.has(contextMenu.conversationKey) ? 'Unpin' : 'Pin',
              icon: Pin,
              onAction: () => {
                const key = contextMenu.conversationKey
                setPinnedKeys(prev => {
                  const next = new Set(prev)
                  if (next.has(key)) next.delete(key)
                  else next.add(key)
                  return next
                })
              },
            },
            {
              key: 'delete',
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              onAction: () => deleteConversation(contextMenu.conversationKey),
            },
          ]}
        />
      )}
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
  onStartVideoCall,
  peerName,
  peerAvatarId,
  peerFirstName,
  peerLastName,
  peerUnavailable,
  peerUnavailableReason,
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
  onStartVideoCall?: () => void
  peerName?: string
  peerAvatarId?: string | null
  peerFirstName?: string | null
  peerLastName?: string | null
  peerUnavailable?: boolean
  peerUnavailableReason?: UnavailableReason
}) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { keyboardHeight, isKeyboardOpen } = useIOSKeyboard()

  const messages = conversations[peerId] ?? []

  const {
    contextMenu,
    contextMsg,
    handleLongPress,
    handleCopy,
    handleStartEdit,
    handleSaveImage,
    closeContextMenu,
    editingMessageId,
    editText,
    setEditText,
    handleSaveEdit,
    handleCancelEdit,
    selectedIds,
    hasSelection,
    canDeleteSelection,
    handleTap,
    clearSelection,
    showForwardPicker,
    handleForwardStart,
    handleForwardSelect,
    closeForwardPicker,
    replyingTo,
    setReplyingTo,
    handleReply,
    activeThreadId,
    setActiveThreadId,
    handleOpenThread,
    pendingDelete,
    handleDelete,
    handleConfirmDelete,
    closePendingDelete,
    handleSwipeAction,
    threadReplyCounts,
    threadMessages,
    mainViewMessages,
  } = useChatInteractions({
    conversationKey: peerId,
    userId,
    messages,
    editMessage,
    deleteMessages,
    inputRef,
    sendMessage,
  })

  // Auto-scroll to bottom when messages change (scoped to container only)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [activeThreadId ? messages.length : mainViewMessages.length])

  // Auto-scroll to bottom when iOS keyboard opens
  useEffect(() => {
    if (isKeyboardOpen && scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      })
    }
  }, [isKeyboardOpen])

  // Mark as read when chat opens and fetch history
  useEffect(() => {
    markAsRead(peerId)
    fetchHistory(peerId)
  }, [peerId, markAsRead, fetchHistory])

  // Clear selection and threading state when switching peers
  useEffect(() => {
    clearSelection()
    closeForwardPicker()
    setReplyingTo(null)
    setActiveThreadId(null)
  }, [peerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Accept pasted images (disabled while a send is in progress)
  const handlePastedImage = useCallback(async (file: File) => {
    const success = await sendImage(peerId, file)
    if (success) playSendSound()
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
    if (success) {
      playSendSound()
    } else {
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

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const success = await sendImage(peerId, file)
      if (success) playSendSound()
    }
    // Reset so the same file can be re-selected
    e.target.value = ''
  }, [sendImage, peerId])

  const isSelf = peerId === userId
  const inputDisabled = sending || requestStatus === 'sent' || (!!peerUnavailable && !isSelf)
  const canCall = !isSelf && requestStatus === 'accepted' && (onStartCall || onStartVideoCall)

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

    if (peerUnavailable && !isSelf) {
      const unavailableMessage = peerUnavailableReason === 'no_keys'
        ? `${peerName ?? 'This user'} hasn't set up messaging keys yet. Messages can't be delivered until they log in.`
        : `${peerName ?? 'This user'} hasn't set up a device yet. Messages can't be delivered until they log in.`
      return (
        <div className="shrink-0 px-4 py-3 border-t border-primary/10">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-themeyellow/10">
            <div className="w-2 h-2 rounded-full bg-themeyellow shrink-0" />
            <p className="text-xs text-themeyellow">
              {unavailableMessage}
            </p>
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
                         text-tertiary active:scale-95 transition-all"
            >
              Decline
            </button>
            <button
              onClick={() => acceptRequest(peerId)}
              className="flex-1 py-2.5 rounded-full bg-themeblue3 text-sm font-medium
                         text-white active:scale-95 transition-all"
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
                  {(replyingTo.plaintext || 'Photo').slice(0, 60)}
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
        <div className={`px-4 pt-3 ${isKeyboardOpen ? 'pb-3' : 'pb-8'} md:pb-3`}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            {(requestStatus === 'accepted' || isSelf) && !activeThreadId && (
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
      onScroll={closeContextMenu}
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
      <div className="flex flex-col h-full relative" style={isKeyboardOpen ? { height: `calc(100% - ${keyboardHeight}px)` } : undefined}>
        {/* Thread header */}
        <div className="sticky top-0 z-10 shrink-0 px-4 py-2.5 border-b border-primary/10 flex items-center gap-3 backdrop-blur-xl bg-themewhite3/80 md:backdrop-blur-none md:bg-transparent">
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
            onClose={closeContextMenu}
          />
        )}

        {renderInputArea()}
      </div>
    )
  }

  // ── Main view ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full relative" style={isKeyboardOpen ? { height: `calc(100% - ${keyboardHeight}px)` } : undefined}>
      {/* Mobile conversation header — circle buttons matching NavTop */}
      <div className="md:hidden sticky top-0 z-10 shrink-0 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] border-b border-primary/10 flex items-center backdrop-blur-xl bg-themewhite3/80">
        <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 overflow-hidden shrink-0">
          <button onClick={onBack} className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <ChevronLeft className="w-6 h-6 text-tertiary" />
          </button>
        </div>
        <p className="flex-1 text-sm font-medium text-primary truncate text-center mx-3">
          {peerName ?? (isSelf ? 'Notes' : 'Chat')}
        </p>
        {canCall ? (
          <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5 shrink-0">
            {onStartVideoCall && (
              <>
                <button
                  onClick={onStartVideoCall}
                  className="w-10 h-10 rounded-full flex items-center justify-center
                             text-themeblue2 hover:text-themeblue2/80 active:scale-95 transition-all"
                  aria-label="Video call"
                  title="Video call"
                >
                  <Video className="w-[18px] h-[18px]" />
                </button>
                {onStartCall && <div className="w-px h-5 bg-tertiary/15" />}
              </>
            )}
            {onStartCall && (
              <button
                onClick={onStartCall}
                className="w-10 h-10 rounded-full flex items-center justify-center
                           text-themeblue2 hover:text-themeblue2/80 active:scale-95 transition-all"
                aria-label="Voice call"
                title="Voice call"
              >
                <Phone className="w-[18px] h-[18px]" />
              </button>
            )}
          </div>
        ) : (
          <div className="w-12 shrink-0" />
        )}
      </div>

      {/* Desktop header */}
      <div className="hidden md:flex shrink-0 px-4 h-10 border-b border-primary/10 items-center justify-between">
        <p className="text-sm font-medium text-primary truncate">
          {peerName ?? (isSelf ? 'Notes' : 'Chat')}
        </p>
        {canCall && (
          <div className="flex items-center gap-1">
            {onStartVideoCall && (
              <button
                onClick={onStartVideoCall}
                className="p-1.5 rounded-full hover:bg-primary/5 active:scale-95 transition-all"
                title="Video call"
              >
                <Video size={16} className="text-themeblue2" />
              </button>
            )}
            {onStartCall && (
              <button
                onClick={onStartCall}
                className="p-1.5 rounded-full hover:bg-primary/5 active:scale-95 transition-all"
                title="Voice call"
              >
                <Phone size={16} className="text-themeblue2" />
              </button>
            )}
          </div>
        )}
      </div>

      {renderMessageList(
        mainViewMessages,
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
          onClose={closeContextMenu}
        />
      )}

      {renderInputArea()}

      {/* Delete confirmation popup */}
      <ConfirmDialog
        visible={!!pendingDelete}
        title="Permanently delete? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={closePendingDelete}
      />

      {/* Forward contact picker overlay */}
      {showForwardPicker && (
        <ForwardPicker
          conversations={conversations}
          currentPeerId={peerId}
          medics={medics}
          onSelect={handleForwardSelect}
          onCancel={closeForwardPicker}
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
  const { keyboardHeight, isKeyboardOpen } = useIOSKeyboard()

  // Cache members for sender name resolution
  const [membersCache, setMembersCache] = useState<GroupMember[]>([])

  const messages = conversations[groupId] ?? []

  const {
    contextMenu,
    contextMsg,
    handleLongPress,
    handleCopy,
    handleStartEdit,
    handleSaveImage,
    closeContextMenu,
    editingMessageId,
    editText,
    setEditText,
    handleSaveEdit,
    handleCancelEdit,
    selectedIds,
    hasSelection,
    canDeleteSelection,
    handleTap,
    clearSelection,
    replyingTo,
    setReplyingTo,
    handleReply,
    activeThreadId,
    setActiveThreadId,
    handleOpenThread,
    pendingDelete,
    handleDelete,
    handleConfirmDelete,
    closePendingDelete,
    handleSwipeAction,
    threadReplyCounts,
    threadMessages,
    mainViewMessages,
  } = useChatInteractions({
    conversationKey: groupId,
    userId,
    messages,
    editMessage,
    deleteMessages,
    inputRef,
    sendMessage: async (peerId, text) => sendGroupMessage(peerId, text),
  })

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
  }, [activeThreadId ? messages.length : mainViewMessages.length])

  // Auto-scroll to bottom when iOS keyboard opens
  useEffect(() => {
    if (isKeyboardOpen && scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      })
    }
  }, [isKeyboardOpen])

  useEffect(() => {
    markAsRead(groupId)
    fetchGroupHistory(groupId)
    // Load members for sender name display
    fetchGroupMembers(groupId).then(setMembersCache)
  }, [groupId, markAsRead, fetchGroupHistory, fetchGroupMembers])

  useEffect(() => {
    clearSelection()
    setReplyingTo(null)
    setActiveThreadId(null)
  }, [groupId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePastedImage = useCallback(async (file: File) => {
    const success = await sendGroupImage(groupId, file)
    if (success) playSendSound()
  }, [sendGroupImage, groupId])
  useImagePaste(!sending, handlePastedImage)

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const threadId = activeThreadId ?? replyingTo?.id ?? undefined
    setText('')
    setReplyingTo(null)
    const success = await sendGroupMessage(groupId, trimmed, threadId)
    if (success) {
      playSendSound()
    } else {
      setText(trimmed)
    }
    inputRef.current?.focus()
  }, [text, sending, sendGroupMessage, groupId, activeThreadId, replyingTo])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }, [handleSend])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const success = await sendGroupImage(groupId, file)
      if (success) playSendSound()
    }
    e.target.value = ''
  }, [sendGroupImage, groupId])

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
    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3" onScroll={closeContextMenu}>
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
      <div className="flex flex-col h-full relative" style={isKeyboardOpen ? { height: `calc(100% - ${keyboardHeight}px)` } : undefined}>
        <div className="sticky top-0 z-10 shrink-0 px-4 py-2.5 border-b border-primary/10 flex items-center gap-3 backdrop-blur-xl bg-themewhite3/80 md:backdrop-blur-none md:bg-transparent">
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
            onClose={closeContextMenu}
          />
        )}
        {renderInputArea()}
      </div>
    )
  }

  // Main group chat view
  return (
    <div className="flex flex-col h-full relative" style={isKeyboardOpen ? { height: `calc(100% - ${keyboardHeight}px)` } : undefined}>
      {/* Mobile group header — circle buttons matching NavTop */}
      <div className="md:hidden sticky top-0 z-10 shrink-0 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] border-b border-primary/10 flex items-center backdrop-blur-xl bg-themewhite3/80">
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

      {/* Desktop group header */}
      <div className="hidden md:flex shrink-0 px-4 h-10 border-b border-primary/10 items-center justify-between">
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

      {renderMessageList(mainViewMessages, 'No messages yet. Start the conversation!')}

      {contextMenu && contextMsg && (
        <MessageContextMenu
          x={contextMenu.x} y={contextMenu.y}
          isOwn={contextMsg.senderId === userId}
          isImage={contextMsg.content?.type === 'image'}
          onCopy={handleCopy} onEdit={handleStartEdit} onSave={handleSaveImage}
          onClose={closeContextMenu}
        />
      )}

      {renderInputArea()}

      {/* Delete confirmation popup */}
      <ConfirmDialog
        visible={!!pendingDelete}
        title="Permanently delete? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={closePendingDelete}
      />

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

export const MessagesPanel = memo(forwardRef<MessagesPanelHandle, MessagesPanelProps>(function MessagesPanel({ view, selectedPeerId, selectedGroupId, onSelectPeer, onSelectGroup, onBack, onCloseDrawer, searchQuery, onSearchClear }, ref) {
  const messagesCtx = useMessagesContext()
  const { medics, loading } = useClinicMedics()
  const callActions = useCallActions()
  const [showCreateGroup, setShowCreateGroup] = useState(false)

  useImperativeHandle(ref, () => ({
    createGroup: () => setShowCreateGroup(true),
  }), [])

  // Batch-check which contacts have active devices
  const medicIds = useMemo(() => medics.map(m => m.id), [medics])
  const unavailableIds = usePeerAvailability(medicIds)

  // Fade transition for the right content area when view changes.
  const prevViewRef = useRef(view)
  const [contentSpring, contentApi] = useSpring(() => ({ opacity: 1, config: { tension: 300, friction: 26 } }))

  useEffect(() => {
    const prev = prevViewRef.current
    prevViewRef.current = view
    if (prev === view) return

    const changed = prev !== view
    if (changed) {
      contentApi.start({ opacity: 1, from: { opacity: 0 }, config: { tension: 300, friction: 26 } })
    }
  }, [view, contentApi])

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
    deleteConversation,
    getRequestStatusForPeer, groups, sendGroupMessage, sendGroupImage,
    createGroup, leaveGroup, renameGroup, addGroupMember, removeGroupMember,
    fetchGroupMembers, fetchGroupHistory,
  } = messagesCtx

  // Determine main content based on view
  let mainContent: React.ReactNode

  if (view === 'messages-group-chat' && selectedGroupId && groups[selectedGroupId]) {
    mainContent = (
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
  } else if (view === 'messages-chat' && selectedPeerId) {
    const peer = medics.find(m => m.id === selectedPeerId)
    const peerName = peer
      ? [peer.rank, peer.lastName].filter(Boolean).join(' ') || peer.firstName || undefined
      : undefined

    mainContent = (
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
        onStartVideoCall={callActions ? () => callActions.startVideoCall({ userId: selectedPeerId, displayName: peerName ?? 'Unknown' }) : undefined}
        peerName={peerName}
        peerAvatarId={peer?.avatarId}
        peerFirstName={peer?.firstName}
        peerLastName={peer?.lastName}
        peerUnavailable={unavailableIds.has(selectedPeerId)}
        peerUnavailableReason={unavailableIds.get(selectedPeerId)}
      />
    )
  } else {
    // Default: desktop shows empty state (pane is the sidebar), mobile shows pane as main content
    mainContent = (
      <div className="hidden md:flex items-center justify-center h-full">
        <div className="text-center">
          <MessageSquare className="w-10 h-10 text-tertiary/20 mx-auto mb-3" />
          <p className="text-sm text-tertiary/40">Select a conversation to start chatting</p>
        </div>
      </div>
    )
  }

  const conversationPaneProps: ConversationPaneProps = {
    medics,
    groups,
    conversations,
    unreadCounts,
    unavailableIds,
    onSelectPeer,
    onSelectGroup,
    onCreateGroup: () => setShowCreateGroup(true),
    deleteConversation,
    loading,
    searchQuery,
    onSearchClear,
  }

  return (
    <div className="flex h-full relative">
      {/* Conversation pane: full-width on mobile default view, w-80 sidebar on desktop */}
      {view === 'messages' && (
        <div className="md:hidden flex flex-col w-full h-full overflow-hidden">
          <ConversationPane {...conversationPaneProps} />
        </div>
      )}
      <div className="hidden md:flex md:flex-col w-80 shrink-0 border-r border-primary/10 overflow-hidden">
        <ConversationPane {...conversationPaneProps} />
      </div>

      {/* Main content area (chat detail on both, empty state on desktop) */}
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        <animated.div
          className="h-full w-full"
          style={{ opacity: contentSpring.opacity }}
        >
          {mainContent}
        </animated.div>
      </div>

      {/* Modals */}
      {showCreateGroup && (
        <CreateGroupModal
          medics={medics}
          onClose={() => setShowCreateGroup(false)}
          onCreate={createGroup}
        />
      )}
      <ProvisionalDeviceModal />
    </div>
  )
}))
