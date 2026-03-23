import { useState, useRef, useEffect, useCallback, memo, useImperativeHandle, forwardRef, useMemo } from 'react'
import { Trash2, Phone, Video, MessageSquare, Info, ChevronLeft, Pin } from 'lucide-react'
import { useSpring, animated, type SpringValue } from '@react-spring/web'
import { MobileSearchBar } from '../MobileSearchBar'
import { HeaderPill, PillButton } from '../HeaderPill'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { useMessagingStore } from '../../stores/useMessagingStore'
import type { RequestStatus } from '../../Hooks/useMessages'
import { ContactListItem } from './ContactListItem'
import { GroupListItem } from './GroupListItem'
import { CreateGroupModal } from './CreateGroupModal'
import { GroupInfoPanel } from './GroupInfoPanel'
import { UserAvatar } from './UserAvatar'
import { LoadingSpinner } from '../LoadingSpinner'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { ProvisionalDeviceModal } from './ProvisionalDeviceModal'
import { useAuth } from '../../Hooks/useAuth'
import { useCallActions } from '../../Hooks/CallContext'
import { useAvatar } from '../../Utilities/AvatarContext'
import { CardContextMenu } from '../CardContextMenu'
import { SwipeableCard, type SwipeAction as SwipeCardAction } from '../SwipeableCard'
import { useClinicGroupedMedics } from '../../Hooks/useClinicGroupedMedics'
import { usePeerAvailability, type UnavailableReason } from '../../Hooks/usePeerAvailability'
import { ChatDetailView, type ParticipantStatus } from '../ChatDetailView'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import type { GroupInfo, GroupMember } from '../../lib/signal/groupTypes'

export type MessagesView = 'messages' | 'messages-chat' | 'messages-group-chat'

export interface MessagesPanelHandle {
  createGroup: () => void
  showGroupInfo: () => void
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
  onSearchChange: (value: string) => void
  onSearchFocusChange?: (focused: boolean) => void
  headerCollapse?: SpringValue<number>
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
  const [pinnedKeys, setPinnedKeys] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ conversationKey: string; x: number; y: number } | null>(null)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const showLoading = useMinLoadTime(loading ?? false)

  const sortedGroups = Object.values(groups).filter(g => !g.systemType).sort((a, b) => a.name.localeCompare(b.name))

  // IDs of contacts that have an active conversation (shown in Recent) — hide from Contacts
  const activeConversationIds = useMemo(() => {
    const ids = new Set<string>()
    for (const [key, msgs] of Object.entries(conversations)) {
      if (key === userId || groups[key]) continue // skip self-notes and groups
      const hasVisible = msgs.some(m => m.messageType !== 'request-accepted' && !m.threadId)
      if (hasVisible) ids.add(key)
    }
    return ids
  }, [conversations, userId, groups])

  // Build recent conversations list
  const recentEntries = useMemo(() => {
    const entries: ConversationEntry[] = []
    const medicMap = new Map(medics.map(m => [m.id, m]))
    for (const [key, msgs] of Object.entries(conversations)) {
      if (key === userId) continue
      // Skip system groups (e.g. calendar) — they are not user-facing chats
      if (groups[key]?.systemType) continue
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
    const matchedGroups = Object.values(groups).filter(g => !g.systemType && g.name.toLowerCase().includes(q))

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
      if (groups[key]?.systemType) continue
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
    <div className="flex flex-col">
      <div className="py-1">
        {/* Search results */}
        {searchResults ? (
          <div>
            {searchResults.groups.length === 0 && searchResults.medics.length === 0 && searchResults.messages.length === 0 && (
              <p className="text-xs text-tertiary/30 px-3 py-4 text-center">No results for &ldquo;{searchQuery}&rdquo;</p>
            )}
            {searchResults.groups.length > 0 && (
              <>
                <p className="text-xs text-tertiary/50 px-3 mb-1 uppercase tracking-wider font-semibold">Groups</p>
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
                <p className="text-xs text-tertiary/50 px-3 mb-1 mt-2 uppercase tracking-wider font-semibold">Contacts</p>
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
                <p className="text-xs text-tertiary/50 px-3 mb-1 mt-2 uppercase tracking-wider font-semibold">Messages</p>
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
                <p className="text-xs text-tertiary/50 px-3 mb-1 mt-1 uppercase tracking-wider font-semibold">Recent</p>
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

            <div className="mx-3 my-2 border-b border-primary/10" />

            {/* Contacts: My Clinic (exclude those already in Recent conversations) */}
            {(() => {
              const filtered = ownClinicMedics.filter(m => m.id !== userId && !activeConversationIds.has(m.id))
              return filtered.length > 0 ? (
                <>
                  <div className="flex items-center gap-1.5 px-3 py-1.5">
                    <p className="text-xs text-tertiary/50 uppercase tracking-wider font-semibold">My Clinic</p>
                    <span className="text-[9px] text-tertiary/30 ml-auto">{filtered.length}</span>
                  </div>
                  {filtered.map(medic => (
                    <ContactListItem
                      key={medic.id}
                      medic={medic}
                      unreadCount={0}
                      unavailable={unavailableIds.has(medic.id)}
                      unavailableReason={unavailableIds.get(medic.id)}
                      onClick={() => onSelectPeer(medic)}
                    />
                  ))}
                </>
              ) : null
            })()}

            {/* Contacts: Nearby clinics (exclude those already in Recent conversations) */}
            {nearbyClinicNames.map(clinicName => {
              const filtered = nearbyByClinic[clinicName].filter(m => !activeConversationIds.has(m.id))
              if (filtered.length === 0) return null
              return (
                <div key={clinicName}>
                  <div className="flex items-center gap-1.5 px-3 py-1.5">
                    <p className="text-xs text-tertiary/50 uppercase tracking-wider font-semibold">{clinicName}</p>
                    <span className="text-[9px] text-tertiary/30 ml-auto">{filtered.length}</span>
                  </div>
                  {filtered.map(medic => (
                    <ContactListItem
                      key={medic.id}
                      medic={medic}
                      unreadCount={0}
                      unavailable={unavailableIds.has(medic.id)}
                      unavailableReason={unavailableIds.get(medic.id)}
                      onClick={() => onSelectPeer(medic)}
                    />
                  ))}
                </div>
              )
            })}

            {/* Groups section (exclude those already in Recent conversations) */}
            {(() => {
              const filtered = sortedGroups.filter(g => {
                const msgs = conversations[g.groupId]
                const hasVisible = msgs?.some(m => m.messageType !== 'request-accepted' && !m.threadId)
                return !hasVisible
              })
              return filtered.length > 0 ? (
                <>
                  <div className="mx-3 my-2 border-b border-primary/10" />
                  <p className="text-xs text-tertiary/50 px-3 mb-1 uppercase tracking-wider font-semibold">Groups</p>
                  {filtered.map(group => (
                    <GroupListItem
                      key={group.groupId}
                      group={group}
                      unreadCount={0}
                      onClick={() => onSelectGroup(group)}
                    />
                  ))}
                </>
              ) : null
            })()}
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

// ── (ForwardPicker moved to ChatDetailView.tsx) ──

// ── Chat Detail (1:1) — thin wrapper over ChatDetailView ──────────────────

function ChatDetail({
  peerId,
  conversations,
  medics,
  sendMessage,
  sendImage,
  sendVoice,
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
  unavailableIds,
}: {
  peerId: string
  conversations: Record<string, DecryptedSignalMessage[]>
  medics: ClinicMedic[]
  sendMessage: (peerId: string, text: string, threadId?: string) => Promise<boolean>
  sendImage: (peerId: string, file: File) => Promise<boolean>
  sendVoice: (peerId: string, recording: any) => Promise<boolean>
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
  unavailableIds: Map<string, UnavailableReason>
}) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const isSelf = peerId === userId

  const participants = useMemo<ParticipantStatus[]>(() => {
    if (isSelf) return []
    return [{
      userId: peerId,
      displayName: peerName ?? 'Unknown',
      available: !unavailableIds.has(peerId),
      reason: unavailableIds.get(peerId),
    }]
  }, [peerId, peerName, unavailableIds, isSelf])

  const resolveAvatar = useCallback((msg: DecryptedSignalMessage, isOwn: boolean) => {
    if (isOwn) return undefined
    return <UserAvatar avatarId={peerAvatarId} firstName={peerFirstName} lastName={peerLastName} className="w-7 h-7" />
  }, [peerAvatarId, peerFirstName, peerLastName])

  const canCall = !isSelf && (requestStatus === 'accepted' || requestStatus === 'none') && (onStartCall || onStartVideoCall)

  const mobileHeader = (
    <div className="md:hidden shrink-0 px-3 py-2 pt-[max(0.5rem,var(--sat,0px))] flex items-center">
      <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 overflow-hidden shrink-0">
        <button onClick={onBack} className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6 text-tertiary" />
        </button>
      </div>
      <p className="flex-1 text-sm font-medium text-primary truncate mx-3">
        {peerName ?? (isSelf ? 'Notes' : 'Chat')}
      </p>
      {canCall ? (
        <HeaderPill>
          {onStartVideoCall && (
            <PillButton icon={Video} onClick={onStartVideoCall} label="Video call" />
          )}
          {onStartCall && (
            <PillButton icon={Phone} onClick={onStartCall} label="Voice call" />
          )}
        </HeaderPill>
      ) : (
        <div className="w-12 shrink-0" />
      )}
    </div>
  )

  return (
    <ChatDetailView
      conversationId={peerId}
      conversations={conversations}
      medics={medics}
      sendMessage={sendMessage}
      sendImage={sendImage}
      sendVoice={sendVoice}
      editMessage={editMessage}
      deleteMessages={deleteMessages}
      markAsRead={markAsRead}
      fetchHistory={fetchHistory}
      sending={sending}
      onBack={onBack}
      participants={participants}
      resolveAvatar={resolveAvatar}
      requestFlow={isSelf ? undefined : {
        status: requestStatus,
        peerName,
        onAccept: () => acceptRequest(peerId),
        onDecline: () => onBack?.(),
      }}
      isSelfChat={isSelf}
      showForward
      emptyText={isSelf ? 'Write a note...' : 'No messages yet. Say hello!'}
      mobileHeader={mobileHeader}
      desktopHeader={null}
    />
  )
}

// ── Group Chat Detail — thin wrapper over ChatDetailView ──────────────────

function GroupChatDetail({
  groupId,
  group,
  conversations,
  medics,
  sendGroupMessage,
  sendGroupImage,
  sendGroupVoice,
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
  unavailableIds,
}: {
  groupId: string
  group: GroupInfo
  conversations: Record<string, DecryptedSignalMessage[]>
  medics: ClinicMedic[]
  sendGroupMessage: (groupId: string, text: string, threadId?: string) => Promise<boolean>
  sendGroupImage: (groupId: string, file: File) => Promise<boolean>
  sendGroupVoice: (groupId: string, recording: any) => Promise<boolean>
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
  unavailableIds: Map<string, UnavailableReason>
  showGroupInfo: boolean
  onShowGroupInfo: (show: boolean) => void
}) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [membersCache, setMembersCache] = useState<GroupMember[]>([])

  useEffect(() => {
    fetchGroupMembers(groupId).then(setMembersCache)
  }, [groupId, fetchGroupMembers])

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

  const participants = useMemo<ParticipantStatus[]>(() => {
    return membersCache
      .filter(m => m.userId !== userId)
      .map(m => ({
        userId: m.userId,
        displayName: senderNameMap[m.userId] ?? 'Unknown',
        available: !unavailableIds.has(m.userId),
        reason: unavailableIds.get(m.userId),
      }))
  }, [membersCache, userId, senderNameMap, unavailableIds])

  const resolveAvatar = useCallback((msg: DecryptedSignalMessage, isOwn: boolean) => {
    if (isOwn) return undefined
    const senderMedic = medics.find(m => m.id === msg.senderId)
    const senderMember = membersCache.find(m => m.userId === msg.senderId)
    return (
      <UserAvatar
        avatarId={senderMedic?.avatarId ?? senderMember?.avatarId}
        firstName={senderMedic?.firstName ?? senderMember?.firstName}
        lastName={senderMedic?.lastName ?? senderMember?.lastName}
        className="w-7 h-7"
      />
    )
  }, [medics, membersCache])

  const resolveSenderName = useCallback((msg: DecryptedSignalMessage) => {
    if (msg.senderId === userId) return undefined
    return senderNameMap[msg.senderId]
  }, [senderNameMap, userId])

  const handleLeave = useCallback(async (gid: string) => {
    await leaveGroup(gid)
    onBack?.()
  }, [leaveGroup, onBack])

  const mobileHeader = (
    <div className="md:hidden shrink-0 px-3 py-2 pt-[max(0.5rem,var(--sat,0px))] flex items-center">
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
        <button onClick={() => onShowGroupInfo(true)} className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform">
          <Info className="w-5 h-5 text-tertiary" />
        </button>
      </div>
    </div>
  )

  return (
    <ChatDetailView
      conversationId={groupId}
      conversations={conversations}
      medics={medics}
      sendMessage={sendGroupMessage}
      sendImage={sendGroupImage}
      sendVoice={sendGroupVoice}
      editMessage={editMessage}
      deleteMessages={deleteMessages}
      markAsRead={markAsRead}
      fetchHistory={fetchGroupHistory}
      sending={sending}
      onBack={onBack}
      participants={participants}
      resolveAvatar={resolveAvatar}
      resolveSenderName={resolveSenderName}
      emptyText="No messages yet. Start the conversation!"
      mobileHeader={mobileHeader}
      desktopHeader={null}
    >
      {showGroupInfo && (
        <GroupInfoPanel
          group={group}
          userId={userId}
          medics={medics}
          onClose={() => onShowGroupInfo(false)}
          onLeave={handleLeave}
          onRename={renameGroup}
          onAddMember={addGroupMember}
          onRemoveMember={removeGroupMember}
          fetchMembers={fetchGroupMembers}
        />
      )}
    </ChatDetailView>
  )
}

// ── Exported Panel ─────────────────────────────────────────────────────────

export const MessagesPanel = memo(forwardRef<MessagesPanelHandle, MessagesPanelProps>(function MessagesPanel({ view, selectedPeerId, selectedGroupId, onSelectPeer, onSelectGroup, onBack, onCloseDrawer, searchQuery, onSearchClear, onSearchChange, onSearchFocusChange, headerCollapse }, ref) {
  const messagesCtx = useMessagesContext()
  const { medics, loading } = useClinicMedics()
  const callActions = useCallActions()
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)

  useImperativeHandle(ref, () => ({
    createGroup: () => setShowCreateGroup(true),
    showGroupInfo: () => setShowGroupInfo(true),
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
    sendMessage, sendImage, sendVoice,
    markAsRead, fetchHistory, acceptRequest, editMessage, deleteMessages,
    deleteConversation,
    getRequestStatusForPeer, sendGroupMessage, sendGroupImage, sendGroupVoice,
    createGroup, leaveGroup, renameGroup, addGroupMember, removeGroupMember,
    fetchGroupMembers, fetchGroupHistory,
  } = messagesCtx

  // Read state from store — granular subscriptions, no re-render on unrelated state
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const conversations = useMessagingStore(s => s.conversations)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const unreadCounts = useMessagingStore(s => s.unreadCounts)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const groups = useMessagingStore(s => s.groups)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const sendingMap = useMessagingStore(s => s.sendingMap)

  const activeSending = selectedPeerId
    ? (sendingMap[selectedPeerId] ?? false)
    : selectedGroupId
      ? (sendingMap[selectedGroupId] ?? false)
      : false

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
        sendGroupVoice={sendGroupVoice}
        sending={activeSending}
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
        unavailableIds={unavailableIds}
        showGroupInfo={showGroupInfo}
        onShowGroupInfo={setShowGroupInfo}
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
        sendVoice={sendVoice}
        sending={activeSending}
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
        unavailableIds={unavailableIds}
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
    <animated.div
      className="flex h-full relative"
      style={headerCollapse ? { '--msg-header-collapse': headerCollapse } as React.CSSProperties : undefined}
    >
      {/* Conversation pane: full-width on mobile default view, w-80 sidebar on desktop */}
      {view === 'messages' && (
        <div className="md:hidden flex flex-col w-full h-full overflow-hidden">
          <MobileSearchBar
            variant="messages"
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search..."
            onFocusChange={onSearchFocusChange}
            style={{ paddingTop: 'calc(var(--sat, 0px) + 4rem * (1 - var(--msg-header-collapse, 0)))' }}
          >
            <ConversationPane {...conversationPaneProps} />
          </MobileSearchBar>
        </div>
      )}
      <div className="hidden md:flex md:flex-col w-80 shrink-0 border-r border-primary/10 overflow-hidden">
        <MobileSearchBar variant="messages" value={searchQuery} onChange={onSearchChange} placeholder="Search..." onFocusChange={onSearchFocusChange}>
          <ConversationPane {...conversationPaneProps} />
        </MobileSearchBar>
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
    </animated.div>
  )
}))
