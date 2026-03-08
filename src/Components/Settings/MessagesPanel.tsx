import { useState, useRef, useEffect, useCallback } from 'react'
import { useMemo } from 'react'
import { Send, Trash2, Forward, Reply, X, ImagePlus, Phone, Video, ArrowLeft, MessageSquare, Users, Plus, Info, ChevronLeft, UserPlus, Pin, PenLine } from 'lucide-react'
import { ConfirmDialog } from '../ConfirmDialog'
import { useSpring, animated } from '@react-spring/web'
import { SPRING_CONFIGS } from '../../Utilities/GestureUtils'
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
import { CardContextMenu } from '../CardContextMenu'
import { SwipeableCard, type SwipeAction as SwipeCardAction } from '../SwipeableCard'
import { useClinicGroupedMedics } from '../../Hooks/useClinicGroupedMedics'
import { useChatInteractions } from '../../Hooks/useChatInteractions'
import { usePeerAvailability } from '../../Hooks/usePeerAvailability'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import type { GroupInfo, GroupMember } from '../../lib/signal/groupTypes'
import { playSendSound } from '../../lib/soundService'

export type MessagesView = 'messages' | 'messages-chat' | 'messages-group-chat'

interface MessagesPanelProps {
  view: MessagesView
  selectedPeerId: string | null
  selectedGroupId: string | null
  onSelectPeer: (medic: ClinicMedic) => void
  onSelectGroup: (group: GroupInfo) => void
  onBack?: () => void
}

// ── Contacts Panel (overlay) ──────────────────────────────────────────────

function ContactsPanel({
  medics,
  groups,
  conversations,
  unreadCounts,
  unavailableIds,
  onSelectPeer,
  onSelectGroup,
  onCreateGroup,
  onClose,
}: {
  medics: ClinicMedic[]
  groups: Record<string, GroupInfo>
  conversations: Record<string, DecryptedSignalMessage[]>
  unreadCounts: Record<string, number>
  unavailableIds: Set<string>
  onSelectPeer: (medic: ClinicMedic) => void
  onSelectGroup: (group: GroupInfo) => void
  onCreateGroup: () => void
  onClose: () => void
}) {
  const { ownClinicMedics, nearbyByClinic, nearbyClinicNames } = useClinicGroupedMedics(medics)
  const [closing, setClosing] = useState(false)

  const sortedGroups = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name))

  // Spring animation: slide up from bottom + backdrop fade
  const [panelSpring] = useSpring(() => ({
    from: { y: 100, opacity: 0 },
    to: { y: 0, opacity: 1 },
    config: { tension: 320, friction: 28 },
  }), [])

  const [backdropSpring] = useSpring(() => ({
    from: { opacity: 0 },
    to: { opacity: 1 },
    config: { tension: 200, friction: 26 },
  }), [])

  const handleClose = useCallback(() => {
    setClosing(true)
    // Allow spring-out to play before unmounting
    setTimeout(onClose, 200)
  }, [onClose])

  // Closing animation
  const [closePanelSpring] = useSpring(() => ({
    y: closing ? 100 : 0,
    opacity: closing ? 0 : 1,
    config: { tension: 380, friction: 26 },
  }), [closing])

  const [closeBackdropSpring] = useSpring(() => ({
    opacity: closing ? 0 : 1,
    config: { tension: 300, friction: 30 },
  }), [closing])

  const handleSelectPeer = useCallback((medic: ClinicMedic) => {
    setClosing(true)
    setTimeout(() => {
      onClose()
      onSelectPeer(medic)
    }, 150)
  }, [onClose, onSelectPeer])

  const handleSelectGroup = useCallback((group: GroupInfo) => {
    setClosing(true)
    setTimeout(() => {
      onClose()
      onSelectGroup(group)
    }, 150)
  }, [onClose, onSelectGroup])

  return (
    <div className="absolute inset-0 z-10 flex flex-col">
      {/* Backdrop */}
      <animated.div
        className="absolute inset-0 bg-black/20"
        style={{ opacity: closing ? closeBackdropSpring.opacity : backdropSpring.opacity }}
        onClick={handleClose}
      />

      {/* Panel - slides up from bottom */}
      <animated.div
        className="absolute inset-x-0 bottom-0 top-0 bg-themewhite3 flex flex-col rounded-t-2xl shadow-lg"
        style={{
          transform: (closing ? closePanelSpring.y : panelSpring.y).to(v => `translateY(${v}%)`),
          opacity: closing ? closePanelSpring.opacity : panelSpring.opacity,
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-8 h-1 rounded-full bg-tertiary/20" />
        </div>

        <div className="shrink-0 px-4 py-2 border-b border-primary/10 flex items-center justify-between">
          <p className="text-sm font-medium text-primary">Contacts</p>
          <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-primary/5 active:scale-95 transition-all">
            <X size={18} className="text-tertiary" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {/* Groups */}
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
            const lastMsg = msgs?.filter(m => m.messageType !== 'request-accepted' && !m.threadId).at(-1)
            return (
              <GroupListItem
                key={group.groupId}
                group={group}
                lastMessage={lastMsg?.plaintext}
                unreadCount={unreadCounts[group.groupId] ?? 0}
                onClick={() => handleSelectGroup(group)}
              />
            )
          })}
          {sortedGroups.length === 0 && (
            <p className="text-xs text-tertiary/30 px-4 mb-2">No groups yet</p>
          )}
          <div className="mx-4 my-1 border-b border-primary/10" />

          {/* Own clinic members */}
          <p className="text-xs text-tertiary/60 px-4 mb-2">Clinic Members</p>
          {ownClinicMedics.length > 0
            ? ownClinicMedics.map(medic => (
              <ContactListItem
                key={medic.id}
                medic={medic}
                unavailable={unavailableIds.has(medic.id)}
                onClick={() => handleSelectPeer(medic)}
              />
            ))
            : <p className="text-xs text-tertiary/30 px-4 mb-2">No clinic members</p>
          }

          {/* Nearby clinics */}
          {nearbyClinicNames.map(clinicName => (
            <div key={clinicName}>
              <div className="mx-4 my-1 border-b border-primary/10" />
              <p className="text-xs text-tertiary/60 px-4 mb-2 mt-2">{clinicName}</p>
              {nearbyByClinic[clinicName].map(medic => (
                <ContactListItem
                  key={medic.id}
                  medic={medic}
                  unavailable={unavailableIds.has(medic.id)}
                  onClick={() => handleSelectPeer(medic)}
                />
              ))}
            </div>
          ))}
        </div>
      </animated.div>
    </div>
  )
}

// ── Contacts Sidebar (desktop persistent) ─────────────────────────────────

function ContactsSidebar({
  medics,
  groups,
  unavailableIds,
  onSelectPeer,
  onSelectGroup,
  onCreateGroup,
}: {
  medics: ClinicMedic[]
  groups: Record<string, GroupInfo>
  unavailableIds: Set<string>
  onSelectPeer: (medic: ClinicMedic) => void
  onSelectGroup: (group: GroupInfo) => void
  onCreateGroup: () => void
}) {
  const { ownClinicMedics, nearbyByClinic, nearbyClinicNames } = useClinicGroupedMedics(medics)

  const sortedGroups = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 h-10 flex items-center border-b border-primary/10">
        <div className="flex items-center justify-between w-full">
          <p className="text-xs font-medium text-tertiary/70 uppercase tracking-wide">Contacts</p>
          <button
            onClick={onCreateGroup}
            className="flex items-center gap-1 text-xs text-themeblue2 hover:text-themeblue2/80 active:scale-95 transition-all"
          >
            <Plus size={12} />
            Group
          </button>
        </div>
      </div>

      {/* Scrollable contact list */}
      <div className="flex-1 overflow-y-auto px-1 py-2">
        {/* Groups */}
        {sortedGroups.length > 0 && (
          <>
            <p className="text-[10px] text-tertiary/50 px-3 mb-1 uppercase tracking-wide">Groups</p>
            {sortedGroups.map(group => (
              <button
                key={group.groupId}
                onClick={() => onSelectGroup(group)}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-left
                           hover:bg-themewhite2 active:scale-[0.98] transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
                  <Users size={14} className="text-themeblue2" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-primary truncate">{group.name}</p>
                  <p className="text-[9px] text-tertiary/40">{group.memberCount} members</p>
                </div>
              </button>
            ))}
            <div className="mx-3 my-1.5 border-b border-primary/10" />
          </>
        )}

        {/* Own clinic */}
        <p className="text-[10px] text-tertiary/50 px-3 mb-1 uppercase tracking-wide">My Clinic</p>
        {ownClinicMedics.map(medic => {
          const isUnavailable = unavailableIds.has(medic.id)
          return (
            <button
              key={medic.id}
              onClick={() => onSelectPeer(medic)}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-left
                         hover:bg-themewhite2 active:scale-[0.98] transition-all${isUnavailable ? ' opacity-50' : ''}`}
            >
              <UserAvatar avatarId={medic.avatarId} firstName={medic.firstName} lastName={medic.lastName} className="w-8 h-8" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-primary truncate">
                  {[medic.rank, medic.lastName].filter(Boolean).join(' ') || medic.firstName || 'Unknown'}
                </p>
                {isUnavailable ? (
                  <p className="text-[9px] text-amber-500/80">No active device</p>
                ) : medic.credential ? (
                  <p className="text-[9px] text-tertiary/40">{medic.credential}</p>
                ) : null}
              </div>
            </button>
          )
        })}

        {/* Nearby clinics */}
        {nearbyClinicNames.map(clinicName => (
          <div key={clinicName}>
            <div className="mx-3 my-1.5 border-b border-primary/10" />
            <p className="text-[10px] text-tertiary/50 px-3 mb-1 uppercase tracking-wide">{clinicName}</p>
            {nearbyByClinic[clinicName].map(medic => {
              const isUnavailable = unavailableIds.has(medic.id)
              return (
                <button
                  key={medic.id}
                  onClick={() => onSelectPeer(medic)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-left
                             hover:bg-themewhite2 active:scale-[0.98] transition-all${isUnavailable ? ' opacity-50' : ''}`}
                >
                  <UserAvatar avatarId={medic.avatarId} firstName={medic.firstName} lastName={medic.lastName} className="w-8 h-8" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-primary truncate">
                      {[medic.rank, medic.lastName].filter(Boolean).join(' ') || medic.firstName || 'Unknown'}
                    </p>
                    {isUnavailable ? (
                      <p className="text-[9px] text-amber-500/80">No active device</p>
                    ) : medic.credential ? (
                      <p className="text-[9px] text-tertiary/40">{medic.credential}</p>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Conversation List ──────────────────────────────────────────────────────

type ConversationEntry = {
  key: string
  type: 'contact' | 'group'
  lastMessageTime: string
  medic?: ClinicMedic
  group?: GroupInfo
}

function ConversationList({
  onSelectPeer,
  onSelectGroup,
  conversations,
  unreadCounts,
  unavailableIds,
  medics,
  groups,
  loading,
  onCreateGroup,
  deleteConversation,
}: {
  onSelectPeer: (medic: ClinicMedic) => void
  onSelectGroup: (group: GroupInfo) => void
  conversations: Record<string, DecryptedSignalMessage[]>
  unreadCounts: Record<string, number>
  unavailableIds: Set<string>
  medics: ClinicMedic[]
  groups: Record<string, GroupInfo>
  loading: boolean
  onCreateGroup: () => void
  deleteConversation: (conversationKey: string) => void
}) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { currentAvatar } = useAvatar()
  const showLoading = useMinLoadTime(loading)
  const [showContacts, setShowContacts] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ conversationKey: string; x: number; y: number } | null>(null)
  const [pinnedKeys, setPinnedKeys] = useState<Set<string>>(new Set())
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)

  // Build a unified flat list of conversations sorted by last message time
  const recentEntries = useMemo(() => {
    const entries: ConversationEntry[] = []
    const medicMap = new Map(medics.map(m => [m.id, m]))

    for (const [key, msgs] of Object.entries(conversations)) {
      // Skip self-notes (shown separately)
      if (key === userId) continue
      // Skip empty conversations
      const visibleMsgs = msgs.filter(m => m.messageType !== 'request-accepted' && !m.threadId)
      if (visibleMsgs.length === 0) continue

      const lastTime = visibleMsgs.at(-1)?.createdAt ?? ''

      if (groups[key]) {
        entries.push({ key, type: 'group', lastMessageTime: lastTime, group: groups[key] })
      } else {
        const medic = medicMap.get(key)
        if (medic) {
          entries.push({ key, type: 'contact', lastMessageTime: lastTime, medic })
        }
      }
    }

    // Sort: pinned first, then most recent
    entries.sort((a, b) => {
      const aPin = pinnedKeys.has(a.key) ? 1 : 0
      const bPin = pinnedKeys.has(b.key) ? 1 : 0
      if (aPin !== bPin) return bPin - aPin
      return b.lastMessageTime.localeCompare(a.lastMessageTime)
    })
    return entries
  }, [conversations, medics, groups, userId, pinnedKeys])

  // Synthetic medic for self-notes entry
  const selfMedic: ClinicMedic | null = userId
    ? { id: userId, firstName: null, lastName: 'Notes', middleInitial: null, rank: null, credential: null, avatarId: currentAvatar.id }
    : null

  if (showLoading) {
    return (
      <LoadingSpinner label="Loading contacts..." className="py-12 text-tertiary" />
    )
  }

  return (
    <div className="h-full overflow-y-auto relative">
      <div className="px-2 py-3">
        {/* Header row (mobile only — desktop has the sidebar) */}
        <div className="flex items-center justify-between px-4 mb-3 md:hidden">
          <p className="text-sm font-medium text-primary">Messages</p>
          {/* Double-icon pill — matches NavTop pattern */}
          <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5">
            <button
              onClick={() => setShowContacts(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center
                         text-tertiary hover:text-primary active:scale-95 transition-all"
              aria-label="New message"
              title="New message"
            >
              <PenLine className="w-[18px] h-[18px]" />
            </button>
            <div className="w-px h-5 bg-tertiary/15" />
            <button
              onClick={onCreateGroup}
              className="w-10 h-10 rounded-full flex items-center justify-center
                         text-tertiary hover:text-primary active:scale-95 transition-all"
              aria-label="New group"
              title="New group"
            >
              <Users className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* Notes entry */}
        {selfMedic && (
          <>
            <ContactListItem
              medic={selfMedic}
              lastMessage={conversations[userId!]?.filter(m => !m.threadId).at(-1)?.plaintext}
              unreadCount={0}
              onClick={() => onSelectPeer(selfMedic)}
            />
            <div className="mx-4 my-1 border-b border-primary/10" />
          </>
        )}

        {/* Recent section */}
        {recentEntries.length > 0 && (
          <p className="text-xs text-tertiary/60 px-4 mb-2">Recent</p>
        )}
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

          if (entry.type === 'group' && entry.group) {
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
                  <GroupListItem
                    group={entry.group}
                    lastMessage={lastMsg?.plaintext}
                    unreadCount={unreadCounts[entry.key] ?? 0}
                    onClick={() => {}}
                  />
                </div>
              </SwipeableCard>
            )
          }

          if (entry.type === 'contact' && entry.medic) {
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
                  <ContactListItem
                    medic={entry.medic}
                    lastMessage={lastMsg?.plaintext}
                    unreadCount={unreadCounts[entry.key] ?? 0}
                    unavailable={unavailableIds.has(entry.key)}
                    onClick={() => {}}
                  />
                </div>
              </SwipeableCard>
            )
          }

          return null
        })}

        {recentEntries.length === 0 && (
          <p className="text-xs text-tertiary/30 px-4 py-8 text-center">
            No conversations yet. Tap the contacts button to start one.
          </p>
        )}
      </div>

      {/* Contacts overlay */}
      {showContacts && (
        <ContactsPanel
          medics={medics}
          groups={groups}
          conversations={conversations}
          unreadCounts={unreadCounts}
          unavailableIds={unavailableIds}
          onSelectPeer={onSelectPeer}
          onSelectGroup={onSelectGroup}
          onCreateGroup={onCreateGroup}
          onClose={() => setShowContacts(false)}
        />
      )}

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
}) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      return (
        <div className="shrink-0 px-4 py-3 border-t border-primary/10">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10">
            <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {peerName ?? 'This user'} hasn't set up a device yet. Messages can't be delivered until they log in.
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
        <div className="px-4 pt-3 pb-8 md:pb-3">
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
      <div className="flex flex-col h-full relative">
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
    <div className="flex flex-col h-full relative">
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
      <div className="flex flex-col h-full relative">
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
    <div className="flex flex-col h-full relative">
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

export function MessagesPanel({ view, selectedPeerId, selectedGroupId, onSelectPeer, onSelectGroup, onBack }: MessagesPanelProps) {
  const messagesCtx = useMessagesContext()
  const { medics, loading } = useClinicMedics()
  const callActions = useCallActions()
  const [showCreateGroup, setShowCreateGroup] = useState(false)

  // Batch-check which contacts have active devices
  const medicIds = useMemo(() => medics.map(m => m.id), [medics])
  const unavailableIds = usePeerAvailability(medicIds)

  // Spring-animated slide for the right content area (sidebar stays put).
  // x=0 is the resting position. We kick it off-screen then spring back to 0.
  const prevViewRef = useRef(view)
  const [contentSpring, contentApi] = useSpring(() => ({ x: 0, config: SPRING_CONFIGS.page }))

  useEffect(() => {
    const prev = prevViewRef.current
    prevViewRef.current = view
    if (prev === view) return

    const goingDeeper = view === 'messages-chat' || view === 'messages-group-chat'
    const goingBack = view === 'messages' && (prev === 'messages-chat' || prev === 'messages-group-chat')

    if (goingDeeper) {
      // Start from right, spring to center
      contentApi.start({ x: 0, from: { x: 100 }, config: SPRING_CONFIGS.page })
    } else if (goingBack) {
      // Start from left, spring to center
      contentApi.start({ x: 0, from: { x: -100 }, config: SPRING_CONFIGS.page })
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
      />
    )
  } else {
    mainContent = (
      <ConversationList
        onSelectPeer={onSelectPeer}
        onSelectGroup={onSelectGroup}
        conversations={conversations}
        unreadCounts={unreadCounts}
        unavailableIds={unavailableIds}
        medics={medics}
        groups={groups}
        loading={loading}
        onCreateGroup={() => setShowCreateGroup(true)}
        deleteConversation={deleteConversation}
      />
    )
  }

  return (
    <div className="flex h-full relative">
      {/* Desktop contacts sidebar */}
      <div className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-primary/10 overflow-hidden">
        <ContactsSidebar
          medics={medics}
          groups={groups}
          unavailableIds={unavailableIds}
          onSelectPeer={onSelectPeer}
          onSelectGroup={onSelectGroup}
          onCreateGroup={() => setShowCreateGroup(true)}
        />
      </div>

      {/* Main content area — outer div clips, inner animated.div slides */}
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        <animated.div
          className="h-full w-full"
          style={{ x: contentSpring.x.to(v => `${v}%`) }}
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
}
