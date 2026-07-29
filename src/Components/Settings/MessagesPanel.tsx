import { useState, useRef, useEffect, useCallback, memo, useImperativeHandle, forwardRef, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Trash2, Headset, Play, MessageSquare, Info, ChevronLeft, ChevronRight, ChevronDown, Pin, Check, Settings, Send } from 'lucide-react'
import { useSpring, animated } from '@react-spring/web'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { useAuthStore } from '../../stores/useAuthStore'
import type { RequestStatus } from '../../Hooks/useMessages'
import { ContactListItem } from './ContactListItem'
import { GroupListItem } from './GroupListItem'
import { getDisplayName } from '../../Utilities/nameUtils'
import { ConversationInfoPanel } from './ConversationInfoPanel'
import { UserAvatar } from './UserAvatar'
import { LoadingSpinner } from '@/Components/primitives/LoadingSpinner'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { ProvisionalDeviceModal } from './ProvisionalDeviceModal'
import { useAuth } from '../../Hooks/useAuth'
import { useCallActions } from '../../Hooks/CallContext'
import { useAvatar } from '../../Utilities/AvatarContext'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { useClinicGroupedMedics } from '../../Hooks/useClinicGroupedMedics'
import { useSubClusters } from '../../Hooks/useSubClusters'
import { usePeerAvailability, type UnavailableReason } from '../../Hooks/usePeerAvailability'
import { ChatDetailView, type ParticipantStatus } from '../ChatDetailView'
import { OutsideEntityConversation } from '../Messages/OutsideEntityConversation'
import { OverlayStack, type StackNav } from '@/Components/primitives/OverlayStack'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { useLongPress } from '../../Hooks/useLongPress'
import { useIsMobile } from '../../Hooks/useIsMobile'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import type { MessageContent } from '../../lib/signal/messageContent'
import { displayGroupName, type GroupInfo, type GroupMember } from '../../lib/signal/groupTypes'
import { useContactPicker, type ContactPickerTarget } from '../Messages/useContactPicker'
import { TextInput } from '@/Components/primitives/FormInputs'
import { ExpandableInput } from '@/Components/primitives/ExpandableInput'
import { useMergedNoteContent } from '../../Hooks/useMergedNoteContent'
import { getEventIntakeCredential } from '../../lib/eventIntakeService'
import { getWarmCredential, setWarmCredential } from '../../lib/messagingSettingsWarm'
import { createOutboundOutsideEntity, sendOutsideEntityReply, isMilEmail, MIL_UNSUPPORTED_MESSAGE } from '../../lib/outsideEntityService'
import { getAllOutsideEntityChannels, migrateLegacyChannelKeys, type OutsideEntityChannel } from '../../lib/outsideEntityChannelStore'
import { saveMessage } from '../../lib/signal/messageStore'
import { SYSTEM_USER_ID } from '../../lib/signal/systemIdentity'
import { isSystemMessage, isOutsideOriginCard } from '../../Hooks/useAdminSystemConversations'
import { lastActivityMessage, activityPreview } from '../../Utilities/conversationActivity'
import { CallsPane } from './CallsPane'
import { useCallHistory, type CallHistoryEntry } from '../../Hooks/useCallHistory'

export type MessagesView = 'messages' | 'messages-chat' | 'messages-group-chat'

/** Messaging surface lens — conversations (Chat) vs call history (Calls). */
export type MessagingLens = 'chat' | 'calls'

const HQ_GROUP_ID = '__hq__'

export interface MessagesPanelHandle {
  openNew: () => void
  showGroupInfo: () => void
  /** Open the 1:1 info card for an outbound outside-contact conversation. The
   *  desktop drawer header has no other route to it — a signal 1:1 reaches its
   *  info card from the mobile header only. */
  showOutsideInfo: () => void
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
  onOpenSettings?: () => void
  /** Active lens — 'chat' (conversations) or 'calls' (call history). */
  lens?: MessagingLens
  /** Switch the active lens (desktop sidebar toggle). */
  onLensChange?: (lens: MessagingLens) => void
  /** Scroll to + highlight this message in the open conversation (calendar round-trip). */
  scrollToMessageId?: string | null
  /** Called once the scroll target has landed, so the drawer can clear it. */
  onScrollConsumed?: () => void
  /** Register a thread-back closer with the owning drawer so its back handler
   * pops an open thread before leaving the conversation. */
  registerThreadBack?: (closer: (() => boolean) | null) => void
}

// ── Long-press preview types + wrapper ────────────────────────────────────

type PreviewTarget = {
  key: string
  type: 'contact' | 'group'
  medic?: ClinicMedic
  group?: GroupInfo
  hasConversation: boolean
  isPinned: boolean
}

/** Wraps a list item with long-press detection for non-swipeable rows (mobile). */
function LongPressRow({ children, onLongPress: onLongPressCb, onClick }: {
  children: React.ReactNode
  onLongPress: (rect: DOMRect) => void
  onClick: () => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const firedRef = useRef(false)

  const handleLongPress = useCallback(() => {
    firedRef.current = true
    if (rowRef.current) onLongPressCb(rowRef.current.getBoundingClientRect())
  }, [onLongPressCb])

  const { isPressing, ...longPressHandlers } = useLongPress(handleLongPress, { delay: 400 })

  const handleClick = useCallback(() => {
    if (firedRef.current) { firedRef.current = false; return }
    onClick()
  }, [onClick])

  return (
    <div
      ref={rowRef}
      {...longPressHandlers}
      onClick={handleClick}
      // Right-click also opens the menu (matches the chat-bubble + desktop path).
      // Without this, narrow/touch-emulated desktop viewports — which render this
      // mobile branch — have no way to open the menu with a mouse.
      onContextMenu={e => { e.preventDefault(); if (rowRef.current) onLongPressCb(rowRef.current.getBoundingClientRect()) }}
      // iOS Safari: suppress the native long-press selection/callout that fires a
      // touchcancel and kills the long-press timer. touch-action keeps scroll.
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', touchAction: 'manipulation' }}
      className={`select-none transition-opacity duration-100 ${isPressing ? 'opacity-60' : ''}`}
    >
      {children}
    </div>
  )
}

/** Build the lifted-row context-menu items — varies by whether a conversation exists. */
function buildMenuItems(
  target: PreviewTarget,
  handlers: { onOpen: () => void; onTogglePin: () => void; onDelete: () => void },
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    { key: 'open', label: target.hasConversation ? 'Open' : 'Message', icon: MessageSquare, onAction: handlers.onOpen },
  ]
  if (target.hasConversation) {
    items.push(
      { key: 'pin', label: target.isPinned ? 'Unpin' : 'Pin', icon: Pin, onAction: handlers.onTogglePin },
      { key: 'delete', label: 'Delete', icon: Trash2, onAction: handlers.onDelete, destructive: true },
    )
  }
  return items
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
  onSelectNewPeer,
  loading,
  searchQuery,
  onSearchClear,
}: ConversationPaneProps) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const signalReady = useAuthStore(s => s.signalReady)
  const { currentAvatar } = useAvatar()
  const { ownClinicMedics, nearbyByClinic, nearbyClinicNames } = useClinicGroupedMedics(medics)
  const { subClusters } = useSubClusters()
  const isMobile = useIsMobile()
  const pinnedKeysArr = useMessagingStore(s => s.pinnedConversationKeys)
  const pinnedKeys = useMemo(() => new Set(pinnedKeysArr), [pinnedKeysArr])
  const togglePinConversation = useMessagingStore(s => s.togglePinConversation)
  const [liftedMenu, setLiftedMenu] = useState<{ rect: DOMRect; row: ReactNode; items: ContextMenuItem[] } | null>(null)
  // Collapsed roster groups (sub-cluster ids / HQ bucket / `clinic:<name>`).
  // Own-cluster sub-groups default expanded; nearby clinics default collapsed
  // (seeded once below) to keep the list quiet when there are many associations.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const toggleGroupCollapse = useCallback((id: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  // Seed each nearby clinic collapsed the first time it appears. Tracked via a
  // ref so a user's later expand isn't undone when the clinic list re-emits.
  const seededCollapseRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const unseeded = nearbyClinicNames
      .map(name => `clinic:${name}`)
      .filter(id => !seededCollapseRef.current.has(id))
    if (unseeded.length === 0) return
    unseeded.forEach(id => seededCollapseRef.current.add(id))
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      unseeded.forEach(id => next.add(id))
      return next
    })
  }, [nearbyClinicNames])
  const [pendingDelete, setPendingDelete] = useState<PreviewTarget | null>(null)
  const showLoading = useMinLoadTime(loading ?? false)

  const closeMenu = useCallback(() => setLiftedMenu(null), [])

  // Build the menu items for a target, wired to this pane's open/pin/delete handlers.
  const menuItemsFor = useCallback((target: PreviewTarget): ContextMenuItem[] => buildMenuItems(target, {
    onOpen: () => {
      if (target.type === 'group' && target.group) onSelectGroup(target.group)
      else if (target.type === 'contact' && target.medic) onSelectPeer(target.medic)
    },
    onTogglePin: () => togglePinConversation(target.key),
    onDelete: () => setPendingDelete(target),
  }), [onSelectGroup, onSelectPeer, togglePinConversation])

  // Open the lifted-row context menu, cloning the pressed row for the float.
  const openMenu = useCallback((rect: DOMRect, row: ReactNode, target: PreviewTarget) => {
    setLiftedMenu({ rect, row, items: menuItemsFor(target) })
  }, [menuItemsFor])

  // A start-new contact row (no conversation yet). Mobile gets long-press → the
  // lifted-row menu; desktop opens the chat on click. Shared by every roster group.
  const renderContactRow = useCallback((medic: ClinicMedic) => {
    const item = <ContactListItem medic={medic} unreadCount={0} unavailable={unavailableIds.has(medic.id)} unavailableReason={unavailableIds.get(medic.id)} onClick={() => {}} />
    const target: PreviewTarget = { key: medic.id, type: 'contact', medic, hasConversation: false, isPinned: false }
    return isMobile ? (
      <LongPressRow
        key={medic.id}
        onClick={() => onSelectPeer(medic)}
        onLongPress={(rect) => openMenu(rect, item, target)}
      >
        {item}
      </LongPressRow>
    ) : (
      <ContactListItem
        key={medic.id}
        medic={medic}
        unreadCount={0}
        unavailable={unavailableIds.has(medic.id)}
        unavailableReason={unavailableIds.get(medic.id)}
        onClick={() => onSelectPeer(medic)}
      />
    )
  }, [isMobile, unavailableIds, onSelectPeer, openMenu])

  // A collapsible roster group — header (chevron + name + count) that toggles
  // collapse, with the contact rows beneath. Mirrors the calendar cluster tree.
  const renderRosterGroup = useCallback((id: string, name: string, groupMedics: ClinicMedic[]) => {
    if (groupMedics.length === 0) return null
    const collapsed = collapsedGroups.has(id)
    return (
      <div key={id}>
        <button
          onClick={() => toggleGroupCollapse(id)}
          className="w-full flex items-center gap-2 py-2 px-4 bg-secondary/5 border-y border-primary/5 text-left active:scale-[0.99] transition-transform"
          aria-label={collapsed ? `Expand ${name}` : `Collapse ${name}`}
        >
          {collapsed ? <ChevronRight size={14} className="text-tertiary shrink-0" /> : <ChevronDown size={14} className="text-tertiary shrink-0" />}
          <span className="text-[9pt] font-medium text-tertiary uppercase tracking-wide truncate flex-1">{name}</span>
        </button>
        {!collapsed && groupMedics.map(renderContactRow)}
      </div>
    )
  }, [collapsedGroups, toggleGroupCollapse, renderContactRow])

  // Self-notes entry
  const selfMedic: ClinicMedic | null = userId
    ? { id: userId, firstName: null, lastName: 'Notes', middleInitial: null, rank: null, credential: null, avatarId: currentAvatar.id }
    : null

  const sortedGroups = Object.values(groups).filter(g => !g.systemType)
    .sort((a, b) => displayGroupName(a.name).localeCompare(displayGroupName(b.name)))

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
      // Thread replies count as activity for sort/preview (a fresh reply bumps the
      // conversation up the list), even though they stay hidden in the main view.
      const lastMsg = lastActivityMessage(msgs)
      if (!lastMsg) continue
      const lastTime = lastMsg.createdAt
      if (groups[key]) {
        entries.push({ key, type: 'group', lastMessageTime: lastTime, group: groups[key] })
      } else {
        const medic = medicMap.get(key) ?? {
          id: key, firstName: null, lastName: 'Unknown', middleInitial: null,
          rank: null, credential: null, avatarId: null,
        }
        entries.push({ key, type: 'contact', lastMessageTime: lastTime, medic })
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

  // Own-clinic roster grouped by sub-cluster (platoon/squad) — mirrors the
  // calendar/supervisor cluster tree. Start-new contacts only (exclude self +
  // anyone already in Recent). Null/stale sub-cluster ids fall to HQ/Unassigned.
  // Flat list when the clinic defines no sub-clusters.
  const ownFiltered = useMemo(
    () => ownClinicMedics.filter(m => m.id !== userId && !activeConversationIds.has(m.id)),
    [ownClinicMedics, userId, activeConversationIds],
  )
  const ownGroups = useMemo(() => {
    const knownSubIds = new Set(subClusters.map(s => s.id))
    const order: { id: string; name: string }[] = [
      { id: HQ_GROUP_ID, name: 'HQ / Unassigned' },
      ...subClusters.map(s => ({ id: s.id, name: s.name })),
    ]
    const buckets = new Map<string, ClinicMedic[]>(order.map(g => [g.id, []]))
    for (const m of ownFiltered) {
      const key = m.subClusterId && knownSubIds.has(m.subClusterId) ? m.subClusterId : HQ_GROUP_ID
      buckets.get(key)!.push(m)
    }
    return order.map(g => ({ ...g, medics: buckets.get(g.id)! })).filter(g => g.medics.length > 0)
  }, [ownFiltered, subClusters])
  const ownGrouped = subClusters.length > 0

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
    const matchedGroups = Object.values(groups).filter(g => !g.systemType && displayGroupName(g.name).toLowerCase().includes(q))

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
    <div className="flex flex-col">
      {!signalReady && (
        <div className="flex items-center gap-2 px-3 py-2 bg-themeblue2/10 border-b border-themeblue2/20">
          <div className="w-3 h-3 border-2 border-themeblue2 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10pt] text-themeblue2 font-medium">Setting up encryption…</span>
        </div>
      )}
      <div className="pt-1 pb-28 md:pb-10">
        {/* Search results */}
        {searchResults ? (
          <div>
            {searchResults.groups.length > 0 && (
              <>
                <p className="text-[10pt] text-tertiary px-3 mb-1 uppercase tracking-wider font-semibold">Groups</p>
                {searchResults.groups.map(group => (
                  <GroupListItem
                    key={group.groupId}
                    group={group}
                    lastMessage={activityPreview(lastActivityMessage(conversations[group.groupId]))}
                    unreadCount={unreadCounts[group.groupId] ?? 0}
                    onClick={() => { onSearchClear(); onSelectGroup(group) }}
                  />
                ))}
              </>
            )}
            {searchResults.medics.length > 0 && (
              <>
                <p className="text-[10pt] text-tertiary px-3 mb-1 mt-2 uppercase tracking-wider font-semibold">Contacts</p>
                {searchResults.medics.map(medic => (
                  <ContactListItem
                    key={medic.id}
                    medic={medic}
                    lastMessage={activityPreview(lastActivityMessage(conversations[medic.id]))}
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
                <p className="text-[10pt] text-tertiary px-3 mb-1 mt-2 uppercase tracking-wider font-semibold">Messages</p>
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
            {searchResults.groups.length === 0
             && searchResults.medics.length === 0
             && searchResults.messages.length === 0 && (
              <p className="text-[10pt] text-tertiary px-3 py-4 text-center">
                No results in your conversations. Use New Message to find anyone on the Medical Operations app.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Conversations section */}
            {selfMedic && (() => {
              const selfTarget: PreviewTarget = { key: userId!, type: 'contact', medic: selfMedic, hasConversation: !!conversations[userId!]?.length, isPinned: false }
              const selfItem = <ContactListItem medic={selfMedic} lastMessage={activityPreview(lastActivityMessage(conversations[userId!]))} unreadCount={0} onClick={() => {}} />
              return (
                <div>
                  {isMobile ? (
                    <LongPressRow
                      onClick={() => onSelectPeer(selfMedic)}
                      onLongPress={(rect) => openMenu(rect, selfItem, selfTarget)}
                    >
                      {selfItem}
                    </LongPressRow>
                  ) : (
                    <div
                      onClick={() => onSelectPeer(selfMedic)}
                      onContextMenu={(e) => { e.preventDefault(); openMenu(e.currentTarget.getBoundingClientRect(), selfItem, selfTarget) }}
                      style={{ cursor: 'pointer' }}
                    >
                      {selfItem}
                    </div>
                  )}
                </div>
              )
            })()}
            {recentEntries.length > 0 && (
              <>
                <p className="text-[10pt] text-tertiary px-3 mb-1 mt-1 uppercase tracking-wider font-semibold">Recent</p>
                {recentEntries.map(entry => {
                  const msgs = conversations[entry.key]
                  const lastMsg = lastActivityMessage(msgs)
                  const isPinned = pinnedKeys.has(entry.key)

                  const handleTap = () => {
                    if (entry.type === 'group' && entry.group) onSelectGroup(entry.group)
                    else if (entry.type === 'contact' && entry.medic) onSelectPeer(entry.medic)
                  }

                  const listItem = entry.type === 'group' && entry.group ? (
                    <GroupListItem
                      group={entry.group}
                      lastMessage={activityPreview(lastMsg)}
                      unreadCount={unreadCounts[entry.key] ?? 0}
                      onClick={() => {}}
                    />
                  ) : entry.type === 'contact' && entry.medic ? (
                    <ContactListItem
                      medic={entry.medic}
                      lastMessage={activityPreview(lastMsg)}
                      unreadCount={unreadCounts[entry.key] ?? 0}
                      unavailable={unavailableIds.has(entry.key)}
                      unavailableReason={unavailableIds.get(entry.key)}
                      onClick={() => {}}
                    />
                  ) : null

                  if (!listItem) return null

                  const entryTarget: PreviewTarget = { key: entry.key, type: entry.type, medic: entry.medic, group: entry.group, hasConversation: true, isPinned }

                  return isMobile ? (
                    <LongPressRow
                      key={entry.key}
                      onClick={handleTap}
                      onLongPress={(rect) => openMenu(rect, listItem, entryTarget)}
                    >
                      {listItem}
                    </LongPressRow>
                  ) : (
                    <div
                      key={entry.key}
                      onClick={handleTap}
                      onContextMenu={(e) => { e.preventDefault(); openMenu(e.currentTarget.getBoundingClientRect(), listItem, entryTarget) }}
                      style={{ cursor: 'pointer' }}
                    >
                      {listItem}
                    </div>
                  )
                })}
              </>
            )}

            <div>
              <div className="mx-3 my-2 border-b border-primary/10" />

              {/* My Cluster — own clinic, grouped by sub-cluster into collapsible
                  groups (HQ/Unassigned bucket for null/stale sub-cluster ids).
                  Flat list when the clinic defines no sub-clusters. */}
              {ownFiltered.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 px-3 py-1.5">
                    <p className="text-[10pt] text-tertiary uppercase tracking-wider font-semibold">My Cluster</p>
                  </div>
                  {ownGrouped
                    ? ownGroups.map(g => renderRosterGroup(g.id, g.name, g.medics))
                    : ownFiltered.map(renderContactRow)}
                </>
              )}

              {/* Nearby clinics — each cluster a collapsible group. */}
              {nearbyClinicNames.map(clinicName => {
                const filtered = nearbyByClinic[clinicName].filter(m => !activeConversationIds.has(m.id))
                if (filtered.length === 0) return null
                return renderRosterGroup(`clinic:${clinicName}`, clinicName, filtered)
              })}
            </div>

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
                  <p className="text-[10pt] text-tertiary px-3 mb-1 uppercase tracking-wider font-semibold">Groups</p>
                  {filtered.map(group => {
                    const item = <GroupListItem group={group} unreadCount={0} onClick={() => {}} />
                    const target: PreviewTarget = { key: group.groupId, type: 'group', group, hasConversation: false, isPinned: false }
                    return isMobile ? (
                      <LongPressRow
                        key={group.groupId}
                        onClick={() => onSelectGroup(group)}
                        onLongPress={(rect) => openMenu(rect, item, target)}
                      >
                        {item}
                      </LongPressRow>
                    ) : (
                      <GroupListItem
                        key={group.groupId}
                        group={group}
                        unreadCount={0}
                        onClick={() => onSelectGroup(group)}
                      />
                    )
                  })}
                </>
              ) : null
            })()}
          </>
        )}
      </div>

      {/* iOS-style lifted-row context menu (long-press on mobile, right-click on desktop) */}
      <LiftedRowMenu
        isOpen={!!liftedMenu}
        anchorRect={liftedMenu?.rect ?? null}
        row={liftedMenu?.row}
        items={liftedMenu?.items ?? []}
        onClose={closeMenu}
        layout="list"
      />

      <ConfirmDialog
        visible={!!pendingDelete}
        title="Delete this conversation?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (pendingDelete) deleteConversation(pendingDelete.key)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

// ── (Recipient selection lives in the shared RecipientPicker / useMessageRoster) ──

// ── Chat Detail (1:1) — thin wrapper over ChatDetailView ──────────────────

function ChatDetail({
  peerId,
  conversations,
  medics,
  sendMessage,
  sendImage,
  sendStructured,
  sendVoice,
  sending,
  markAsRead,
  fetchHistory,
  requestStatus,
  acceptRequest,
  editMessage,
  deleteMessages,
  deleteConversation,
  onBack,
  onStartCall,
  onStartVideoCall,
  peerName,
  peerAvatarId,
  peerFirstName,
  peerLastName,
  unavailableIds,
  scrollToMessageId,
  onScrollConsumed,
  registerThreadBack,
}: {
  peerId: string
  conversations: Record<string, DecryptedSignalMessage[]>
  medics: ClinicMedic[]
  sendMessage: (peerId: string, text: string, threadId?: string) => Promise<boolean>
  sendImage: (peerId: string, file: File) => Promise<boolean>
  sendStructured: (peerId: string, content: MessageContent, originId: string, preview: string) => Promise<boolean>
  sendVoice: (peerId: string, recording: any) => Promise<boolean>
  sending: boolean
  markAsRead: (peerId: string) => void
  fetchHistory: (peerId: string) => Promise<void>
  requestStatus: RequestStatus
  acceptRequest: (peerId: string) => Promise<void>
  editMessage: (peerId: string, messageId: string, newText: string) => void
  deleteMessages: (peerId: string, messageIds: string[]) => void
  deleteConversation: (conversationKey: string) => void
  onBack?: () => void
  onStartCall?: () => void
  onStartVideoCall?: () => void
  peerName?: string
  peerAvatarId?: string | null
  peerFirstName?: string | null
  peerLastName?: string | null
  unavailableIds: Map<string, UnavailableReason>
  scrollToMessageId?: string | null
  onScrollConsumed?: () => void
  registerThreadBack?: (closer: (() => boolean) | null) => void
}) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const isSelf = peerId === userId
  const isDevRole = useAuthStore(s => s.isDevRole)
  // Conversation info + shared-media browsing is a dev-only surface for now.
  const showInfoButton = isDevRole && !isSelf
  const [showInfo, setShowInfo] = useState(false)
  const [mediaJumpId, setMediaJumpId] = useState<string | null>(null)

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

  const backButton = (
    <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 overflow-hidden shrink-0">
      <button onClick={onBack} className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform">
        <ChevronLeft className="w-6 h-6 text-tertiary" />
      </button>
    </div>
  )

  const mobileHeader = (
    <div className="md:hidden shrink-0 px-3 py-2 pt-[max(0.5rem,var(--sat,0px))] flex items-center">
      {backButton}
      <p className="flex-1 text-sm font-medium text-primary truncate mx-3">
        {peerName ?? (isSelf ? 'Notes' : 'Chat')}
      </p>
      {canCall || showInfoButton ? (
        <HeaderPill>
          {canCall && onStartVideoCall && (
            <PillButton icon={Play} onClick={onStartVideoCall} label="Video call" />
          )}
          {canCall && onStartCall && (
            <PillButton icon={Headset} onClick={onStartCall} label="Voice call" />
          )}
          {showInfoButton && (
            <PillButton icon={Info} onClick={() => setShowInfo(true)} label="Conversation info" />
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
      sendStructured={sendStructured}
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
        // Decline silently tears down the conversation on our side: writes a
        // conversation tombstone, hard-deletes server rows, fans a sync to our
        // own devices, and (via per-originId tombstones) prevents backup or
        // realtime echoes from resurrecting the request. Peer is not notified
        // at the conversation level — matches Discord "ignore request" semantics.
        onDecline: () => {
          deleteConversation(peerId)
          onBack?.()
        },
      }}
      isSelfChat={isSelf}
      showForward
      emptyText={isSelf ? 'Write a note...' : 'No messages'}
      mobileHeader={mobileHeader}
      desktopHeader={null}
      registerThreadBack={registerThreadBack}
      conversationIsGroup={false}
      conversationPeerName={peerName}
      scrollToMessageId={mediaJumpId ?? scrollToMessageId}
      onScrollConsumed={() => { setMediaJumpId(null); onScrollConsumed?.() }}
    >
      {showInfoButton && (
        <ConversationInfoPanel
          isOpen={showInfo}
          onClose={() => setShowInfo(false)}
          messages={conversations[peerId] ?? []}
          isDevRole={isDevRole}
          onJumpToMessage={setMediaJumpId}
          peer={{
            userId: peerId,
            name: peerName ?? 'Chat',
            avatarId: peerAvatarId,
            firstName: peerFirstName,
            lastName: peerLastName,
          }}
        />
      )}
    </ChatDetailView>
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
  sendGroupStructured,
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
  promoteGroupMember,
  demoteGroupMember,
  purgeGroup,
  fetchGroupMembers,
  unavailableIds,
  showGroupInfo,
  onShowGroupInfo,
  scrollToMessageId,
  onScrollConsumed,
  registerThreadBack,
}: {
  groupId: string
  group: GroupInfo
  conversations: Record<string, DecryptedSignalMessage[]>
  medics: ClinicMedic[]
  sendGroupMessage: (groupId: string, text: string, threadId?: string) => Promise<boolean>
  sendGroupImage: (groupId: string, file: File) => Promise<boolean>
  sendGroupStructured: (groupId: string, content: MessageContent, originId: string, preview: string) => Promise<boolean>
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
  promoteGroupMember: (groupId: string, userId: string) => Promise<{ ok: boolean; error?: string }>
  demoteGroupMember: (groupId: string, userId: string) => Promise<{ ok: boolean; error?: string }>
  purgeGroup: (groupId: string) => Promise<{ ok: boolean; error?: string }>
  fetchGroupMembers: (groupId: string) => Promise<GroupMember[]>
  unavailableIds: Map<string, UnavailableReason>
  showGroupInfo: boolean
  onShowGroupInfo: (show: boolean) => void
  scrollToMessageId?: string | null
  onScrollConsumed?: () => void
  registerThreadBack?: (closer: (() => boolean) | null) => void
}) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const isDevRole = useAuthStore(s => s.isDevRole)
  const [membersCache, setMembersCache] = useState<GroupMember[]>([])
  // Local scroll target so the info panel can jump the thread to a media message.
  const [mediaJumpId, setMediaJumpId] = useState<string | null>(null)

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

  const handlePurge = useCallback(async (gid: string) => {
    const res = await purgeGroup(gid)
    if (res.ok) onBack?.()
    return res
  }, [purgeGroup, onBack])

  const backButton = (
    <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 overflow-hidden shrink-0">
      <button onClick={onBack} className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform">
        <ChevronLeft className="w-6 h-6 text-tertiary" />
      </button>
    </div>
  )

  const mobileHeader = (
    <div className="md:hidden shrink-0 px-3 py-2 pt-[max(0.5rem,var(--sat,0px))] flex items-center">
      {backButton}
      <div className="flex-1 min-w-0 text-center mx-3">
        <p className="text-sm font-medium text-primary truncate">{displayGroupName(group.name)}</p>
        <p className="text-[9pt] text-tertiary">{group.memberCount} members</p>
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
      sendStructured={sendGroupStructured}
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
      emptyText="No messages"
      mobileHeader={mobileHeader}
      desktopHeader={null}
      registerThreadBack={registerThreadBack}
      conversationIsGroup={true}
      conversationPeerName={displayGroupName(group.name)}
      scrollToMessageId={mediaJumpId ?? scrollToMessageId}
      onScrollConsumed={() => { setMediaJumpId(null); onScrollConsumed?.() }}
    >
      <ConversationInfoPanel
        isOpen={showGroupInfo}
        onClose={() => onShowGroupInfo(false)}
        messages={conversations[groupId] ?? []}
        isDevRole={isDevRole}
        onJumpToMessage={setMediaJumpId}
        group={group}
        userId={userId}
        medics={medics}
        onLeave={handleLeave}
        onRename={renameGroup}
        onAddMember={addGroupMember}
        onRemoveMember={removeGroupMember}
        onPromoteMember={promoteGroupMember}
        onDemoteMember={demoteGroupMember}
        onPurge={handlePurge}
        fetchMembers={fetchGroupMembers}
      />
    </ChatDetailView>
  )
}

// ── Exported Panel ─────────────────────────────────────────────────────────

export const MessagesPanel = memo(forwardRef<MessagesPanelHandle, MessagesPanelProps>(function MessagesPanel({ view, selectedPeerId, selectedGroupId, onSelectPeer, onSelectGroup, onBack, onCloseDrawer, searchQuery, onSearchClear, onSearchChange, onOpenSettings, lens = 'chat', onLensChange, scrollToMessageId, onScrollConsumed, registerThreadBack }, ref) {
  const messagesCtx = useMessagesContext()
  const { medics, loading } = useClinicMedics()
  const callActions = useCallActions()
  const [showNewMsg, setShowNewMsg] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [showOutsideInfo, setShowOutsideInfo] = useState(false)
  // Leaving the conversation (including the delete that navigates away while the
  // card is open) must not leave the next one opening straight into its info card.
  useEffect(() => { setShowOutsideInfo(false) }, [selectedPeerId])
  // Outbound outside-contact compose — email a secure 1:1 invite.
  const outboundClinicId = useAuthStore(s => s.clinicId)
  // The recipient always sees the cluster name as the sender ("from"). We no longer
  // let the medic type a free label — from_label is always the clinic/cluster name.
  const clusterName = ((useAuthStore(s => s.profile.clinicName) ?? '').trim()) || 'Medical section'
  const [outEmail, setOutEmail] = useState('')
  const [outMsg, setOutMsg] = useState('')
  // Personal + subscribed-clinic expanders, same corpus the note editors use — the
  // outbound body is free text a medic types by hand, so it gets the same shortcuts.
  const { expanders } = useMergedNoteContent()
  const [outBusy, setOutBusy] = useState(false)
  const [outError, setOutError] = useState<string | null>(null)
  const resetOutbound = useCallback(() => { setOutEmail(''); setOutMsg(''); setOutError(null); setOutBusy(false) }, [])
  // Military recipients are refused outright — flagged as the medic types so Send
  // never arms on an address the service and the edge fn will both reject.
  const outMil = isMilEmail(outEmail)
  // The cluster's "Allow outbound contact" master (credential.outbound_enabled)
  // is the sole gate on the compose entry point — it must hold before the entry
  // point renders, otherwise the send fails server-side. Seeded from the
  // messaging-settings warm cache and re-read each time the composer opens, so a
  // supervisor flipping the toggle takes effect on the next open.
  const [outboundAllowed, setOutboundAllowed] = useState(
    () => getWarmCredential(outboundClinicId)?.outbound_enabled === true,
  )
  useEffect(() => {
    if (!showNewMsg || !outboundClinicId) return
    const warm = getWarmCredential(outboundClinicId)
    if (warm !== undefined) { setOutboundAllowed(warm?.outbound_enabled === true); return }
    let alive = true
    void getEventIntakeCredential(outboundClinicId).then(res => {
      if (!alive || !res.ok) return
      setWarmCredential(outboundClinicId, res.data)
      setOutboundAllowed(res.data?.outbound_enabled === true)
    })
    return () => { alive = false }
  }, [showNewMsg, outboundClinicId])
  // Live nav of the new-message morph stack — handlers push/reset screens on it.
  const stackNavRef = useRef<StackNav | null>(null)

  useImperativeHandle(ref, () => ({
    // The card resets to contacts mode on close, so opening it is just the flag.
    openNew: () => setShowNewMsg(true),
    showGroupInfo: () => setShowGroupInfo(true),
    showOutsideInfo: () => setShowOutsideInfo(true),
  }), [])

  // Store subscriptions — before early return so hook order is always stable
  const rawConversations = useMessagingStore(s => s.conversations)
  const unreadCounts = useMessagingStore(s => s.unreadCounts)
  const groups = useMessagingStore(s => s.groups)
  const sendingMap = useMessagingStore(s => s.sendingMap)
  const isDevRole = useAuthStore(s => s.isDevRole)
  const currentUserId = useAuthStore(s => s.user?.id ?? null)

  // Dev users see system traffic in the AdminDrawer, never in personal
  // Messages — strip it here so the conversation list, search, and any
  // ChatDetailView path consuming `conversations` are all consistent. Non-devs
  // never receive `messageType='system'` (the trigger blocks them from
  // authoring it), but they can have the synthetic SYSTEM peer as a chat — for
  // them, leave the data untouched.
  const conversations = useMemo(() => {
    if (!isDevRole) return rawConversations
    const out: Record<string, typeof rawConversations[string]> = {}
    for (const [key, msgs] of Object.entries(rawConversations)) {
      // The dev's own conversation WITH System (key === SYSTEM_USER_ID) is
      // personal, not operator-console traffic: System-direct notices the dev
      // RECEIVES, outside-origin cards, and the dev's own replies all bucket
      // here. It is already excluded from the admin console
      // (useAdminSystemConversations skips the SYSTEM peer), so keep it whole —
      // otherwise it renders nowhere for a dev.
      if (key === SYSTEM_USER_ID) { out[key] = msgs; continue }
      // Strip operator↔user system traffic (it lives in the AdminDrawer), but
      // KEEP outside-origin cards (intake requests, outside→cluster chat, on-call
      // call records): a dev triages their own cluster's intake/chat/call traffic
      // here in normal Messages (they arrive in the cluster on-call/system group).
      const filtered = msgs.filter(m => !isSystemMessage(m) || isOutsideOriginCard(m))
      if (filtered.length > 0) out[key] = filtered
    }
    return out
  }, [rawConversations, isDevRole])

  // peerProfiles is the cluster-agnostic profile cache: hydrated from IDB,
  // populated by email-lookup/QR success and by MessagesContext's reactive
  // sender-resolver effect on inbound envelopes. Cluster medics + peerProfiles
  // together cover every user we can name. Replaces the older extraMedics +
  // useOrphanedProfiles dance.
  const peerProfiles = useMessagingStore(s => s.peerProfiles)

  // Peer profiles that earned a row: everyone outside the cluster roster we can
  // both name and have actual traffic with. Split out of allMedics because the
  // recipient picker feeds them to useMessageRoster as extraPeers.
  const peerExtras = useMemo(() => {
    // The synthetic SYSTEM peer is kept for everyone (devs included): when a dev
    // is the RECIPIENT of System-direct traffic it must resolve to "System" in
    // the conversation list / chat header. The `extras` gate below still only
    // surfaces it when there's an actual System conversation (messages > 0) or
    // it's the open peer, so it never pollutes an empty contact list/autocomplete
    // — outbound operator↔user threads bucket under the USER's id, not SYSTEM.
    const peerList = Object.values(peerProfiles)
    if (peerList.length === 0) return []
    const have = new Set(medics.map(m => m.id))
    // Outside-cluster peer profiles haunt the contact list forever otherwise:
    // email/QR/code lookup writes the profile to IDB (so name/avatar can
    // resolve later), but with zero messages we should hide the row from
    // contact + conversation lists. Keep the profile in IDB — cheap, and lets
    // it resurface instantly if a message arrives. Exception: the currently
    // selected peer must remain in allMedics so name resolution works for a
    // freshly-added contact whose chat is open but has no messages yet.
    //
    // Gate on a VISIBLE message, not raw length: a deleted conversation can
    // leave behind only a `request-accepted` marker (or threaded replies),
    // which is invisible in Recent (recentEntries/activeConversationIds use the
    // same filter). Keying extras on raw length re-admitted such a peer into
    // allMedics, where it rendered as a bare "My Cluster" contact (foreign/null
    // clinicId, useClinicGroupedMedics) with NO delete affordance (contact rows
    // build hasConversation:false) — an un-removable phantom. Mirror the visible
    // filter so a marker-only conversation drops the peer entirely.
    const hasVisibleMessage = (msgs: DecryptedSignalMessage[] | undefined) =>
      !!msgs?.some(m => m.messageType !== 'request-accepted' && !m.threadId)
    return peerList.filter(m =>
      !have.has(m.id) && (
        hasVisibleMessage(conversations[m.id]) ||
        m.id === selectedPeerId
      ),
    )
  }, [medics, peerProfiles, conversations, selectedPeerId])

  const allMedics = useMemo(
    () => (peerExtras.length === 0 ? medics : [...medics, ...peerExtras]),
    [medics, peerExtras],
  )

  // Batch-check which contacts have active devices
  const medicIds = useMemo(() => allMedics.map(m => m.id), [allMedics])
  const unavailableIds = usePeerAvailability(medicIds)

  // Calls lens — call history + tap-to-redial.
  const callHistory = useCallHistory(allMedics)
  const handleRedial = useCallback((entry: CallHistoryEntry) => {
    callActions?.startCall({ userId: entry.peerId, displayName: getDisplayName(entry.peer) })
  }, [callActions])

  // New Message / New Group IS the shared recipient card (useContactPicker) —
  // the same roster, rows, group builder and off-roster drill the share-to-chat
  // picker renders. This host only decides what a pick MEANS (open the
  // conversation) and adds the one screen that is its own: outbound email.
  const handlePick = useCallback((target: ContactPickerTarget) => {
    setShowNewMsg(false)
    if (target.kind === 'group') onSelectGroup(target.group)
    else onSelectPeer(target.medic)
  }, [onSelectGroup, onSelectPeer])

  const picker = useContactPicker({
    navRef: stackNavRef,
    title: 'New Message',
    extraPeers: peerExtras,
    includeGroups: true,
    allowCreateGroup: true,
    onPick: handlePick,
    onGroupCreated: () => setShowNewMsg(false),
    ...(outboundAllowed
      ? {
          extraFooter: (nav: StackNav) => (
            <ActionButton icon={Send} label="Email" onClick={() => { resetOutbound(); nav.push('outbound') }} />
          ),
        }
      : {}),
  })

  // Outbound outside-contact CHANNEL RECORDS, keyed by entity_id. These carry the
  // channel key and drive routing. They deliberately outlive their messages — an
  // emptied thread is still a live channel — so they cannot be derived from
  // `conversations` and are read from their own store instead.
  const [outsideChannels, setOutsideChannels] = useState<Record<string, OutsideEntityChannel>>({})
  const refreshOutsideChannels = useCallback(async () => {
    const list = await getAllOutsideEntityChannels().catch(() => [])
    setOutsideChannels(Object.fromEntries(list.map(c => [c.entity_id, c])))
  }, [])
  // One-shot on mount: lift keys out of any pre-migration card, THEN read the store,
  // so a channel opened before the upgrade doesn't go dark mid-life.
  useEffect(() => {
    void migrateLegacyChannelKeys(useMessagingStore.getState().conversations)
      .catch(() => 0)
      .then(refreshOutsideChannels)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshOutsideChannels])

  // Kill switch wrapper: re-read the store afterwards rather than optimistically
  // dropping the record, because deleteConversation ABORTS when the server revoke
  // fails — in that case the channel is still live and must stay in the list.
  const ctxDeleteConversation = messagesCtx?.deleteConversation
  const deleteOutsideConversation = useCallback((key: string) => {
    if (!ctxDeleteConversation) return
    void Promise.resolve(ctxDeleteConversation(key)).then(refreshOutsideChannels)
  }, [ctxDeleteConversation, refreshOutsideChannels])

  // Mint an outbound outside-contact channel + email the invite, then file the
  // local anchor card and open it. The channel KEY goes to outsideEntityChannelStore,
  // not the card. The card buckets under recipientId=entity_id; a peerProfile gives
  // it a real title.
  const handleCreateOutbound = useCallback(async () => {
    const email = outEmail.trim()
    if (!outboundClinicId || !currentUserId || !email.includes('@') || outBusy) return
    if (isMilEmail(email)) { setOutError(MIL_UNSUPPORTED_MESSAGE); return }
    setOutBusy(true)
    setOutError(null)
    const res = await createOutboundOutsideEntity({ clinicId: outboundClinicId, recipientEmail: email, fromLabel: clusterName })
    if (!res.ok) { setOutBusy(false); setOutError(res.error); return }
    const { content, channel } = res.data
    setOutsideChannels(prev => ({ ...prev, [channel.entity_id]: channel }))

    const now = new Date().toISOString()
    const store = useMessagingStore.getState()

    // Anchor card — channel metadata only, no key. It exists so a brand-new channel
    // has something in its conversation; deleting it blanks the thread and leaves the
    // channel live, which is the whole point of moving the key out.
    const msg: DecryptedSignalMessage = {
      id: crypto.randomUUID(),
      senderId: currentUserId,
      recipientId: content.entity_id,
      plaintext: 'Secure email sent',
      content,
      messageType: 'message',
      createdAt: now,
      readAt: now,
      status: 'sent',
      originId: crypto.randomUUID(),
    }
    store.addMessage(msg)
    void saveMessage(msg, currentUserId).catch(() => {})

    // First message (optional) is an ORDINARY message, like every later one.
    const first = outMsg.trim()
    if (first) {
      const sent = await sendOutsideEntityReply(channel, first)
      if (sent.ok) {
        const firstMsg: DecryptedSignalMessage = {
          id: sent.data.id,
          senderId: currentUserId,
          recipientId: channel.entity_id,
          plaintext: first,
          content: { type: 'text', text: first },
          messageType: 'message',
          createdAt: sent.data.created_at || now,
          readAt: now,
          status: 'sent',
          originId: sent.data.id,
        }
        store.addMessage(firstMsg)
        void saveMessage(firstMsg, currentUserId).catch(() => {})
      }
    }
    // Title the synthetic peer. The conversation LIST row shows the recipient email
    // (who the medic is talking to); the conversation HEADER shows the cluster name
    // (what the recipient sees as the sender), carried on outsideFromLabel. Its
    // presence also routes this conversation to OutsideEntityConversation.
    const profile: ClinicMedic = {
      id: content.entity_id,
      firstName: content.recipient_email || content.from_label || 'Outside contact',
      lastName: null, middleInitial: null, rank: null, credential: null, avatarId: null,
      outsideFromLabel: content.from_label || clusterName,
    }
    store.setPeerProfile(profile)
    setOutBusy(false)
    resetOutbound()
    setShowNewMsg(false)
    setNewMsgMode('contacts')
    onSelectPeer(profile)
  }, [outEmail, outMsg, outBusy, outboundClinicId, currentUserId, clusterName, resetOutbound, onSelectPeer])

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
        <p className="text-sm text-tertiary">Sign in to use messages.</p>
      </div>
    )
  }

  const {
    sendMessage, sendImage, sendStructured, sendVoice,
    markAsRead, fetchHistory, acceptRequest, editMessage, deleteMessages,
    deleteConversation,
    getRequestStatusForPeer, sendGroupMessage, sendGroupImage, sendGroupStructured, sendGroupVoice,
    createGroup, leaveGroup, renameGroup, addGroupMember, removeGroupMember,
    promoteGroupMember, demoteGroupMember, purgeGroup,
    fetchGroupMembers, fetchGroupHistory,
  } = messagesCtx

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
        medics={allMedics}
        sendGroupMessage={sendGroupMessage}
        sendGroupImage={sendGroupImage}
        sendGroupStructured={sendGroupStructured}
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
        promoteGroupMember={promoteGroupMember}
        demoteGroupMember={demoteGroupMember}
        purgeGroup={purgeGroup}
        fetchGroupMembers={fetchGroupMembers}
        unavailableIds={unavailableIds}
        showGroupInfo={showGroupInfo}
        onShowGroupInfo={setShowGroupInfo}
        scrollToMessageId={scrollToMessageId}
        onScrollConsumed={onScrollConsumed}
        registerThreadBack={registerThreadBack}
      />
    )
  } else if (view === 'messages-chat' && selectedPeerId) {
    // Outbound outside-contact (email) channels render as an ordinary conversation
    // — same ChatDetailView, only the composer's transport is swapped, because the
    // channel isn't a Signal peer. Detected by the CHANNEL RECORD, not by a control
    // message: messages are deletable and the channel must survive an emptied
    // thread, so a message can no longer be the routing signal.
    const outsideChannel = outsideChannels[selectedPeerId]
    const peer = allMedics.find(m => m.id === selectedPeerId)
    const peerName = peer
      ? [peer.rank, peer.lastName].filter(Boolean).join(' ') || peer.firstName || undefined
      : undefined

    mainContent = outsideChannel ? (
      <OutsideEntityConversation
        channel={outsideChannel}
        clusterName={outsideChannel.from_label || peer?.outsideFromLabel || clusterName}
        conversations={conversations}
        medics={allMedics}
        sendMessage={sendMessage}
        editMessage={editMessage}
        deleteMessages={deleteMessages}
        fetchHistory={fetchHistory}
        deleteConversation={deleteOutsideConversation}
        markAsRead={markAsRead}
        showInfo={showOutsideInfo}
        onShowInfo={setShowOutsideInfo}
        scrollToMessageId={scrollToMessageId}
        onScrollConsumed={onScrollConsumed}
        registerThreadBack={registerThreadBack}
        onBack={onBack}
      />
    ) : (
      <ChatDetail
        peerId={selectedPeerId}
        conversations={conversations}
        medics={allMedics}
        sendMessage={sendMessage}
        sendImage={sendImage}
        sendStructured={sendStructured}
        sendVoice={sendVoice}
        sending={activeSending}
        markAsRead={markAsRead}
        fetchHistory={fetchHistory}
        requestStatus={getRequestStatusForPeer(selectedPeerId)}
        acceptRequest={acceptRequest}
        editMessage={editMessage}
        deleteMessages={deleteMessages}
        deleteConversation={deleteConversation}
        onBack={onBack}
        onStartCall={callActions ? () => callActions.startCall({ userId: selectedPeerId, displayName: peerName ?? 'Unknown' }) : undefined}
        onStartVideoCall={callActions ? () => callActions.startVideoCall({ userId: selectedPeerId, displayName: peerName ?? 'Unknown' }) : undefined}
        peerName={peerName}
        peerAvatarId={peer?.avatarId}
        peerFirstName={peer?.firstName}
        peerLastName={peer?.lastName}
        unavailableIds={unavailableIds}
        scrollToMessageId={scrollToMessageId}
        onScrollConsumed={onScrollConsumed}
        registerThreadBack={registerThreadBack}
      />
    )
  } else {
    // Default: desktop shows empty state (pane is the sidebar), mobile shows pane as main content
    mainContent = (
      <div className="hidden md:flex items-center justify-center h-full">
        <div className="text-center">
          <MessageSquare className="w-10 h-10 text-tertiary mx-auto mb-3" />
          <p className="text-sm text-tertiary">Select a conversation to start chatting</p>
        </div>
      </div>
    )
  }

  const conversationPaneProps: ConversationPaneProps = {
    medics: allMedics,
    groups,
    conversations,
    unreadCounts,
    unavailableIds,
    onSelectPeer,
    onSelectGroup,
    onCreateGroup: () => { setShowNewMsg(true); picker.openGroupMode() },
    deleteConversation,
    loading,
    searchQuery,
    onSearchClear,
  }

  // Chat lens → conversations; Calls lens → call history (tap to redial).
  const renderPane = () =>
    lens === 'calls'
      ? <CallsPane entries={callHistory} onRedial={handleRedial} searchQuery={searchQuery} />
      : <ConversationPane {...conversationPaneProps} />

  return (
    <div className="flex h-full relative">
      {/* Conversation pane: full-width on mobile default view, w-80 sidebar on desktop */}
      {view === 'messages' && (
        <div className="md:hidden w-full h-full overflow-y-auto overscroll-y-contain">
          {/* iOS large-title glass: one full-height scroller. Search is the first
              item — padded to clear the floating glass header (var(--sat)+4.375rem)
              — so it and the list rows scroll UP behind the frosted header. */}
          <div className="px-3 pt-[calc(var(--sat,0px)+4.375rem+0.5rem)] pb-2">
            <SearchInput value={searchQuery} onChange={onSearchChange} placeholder="Search..." />
          </div>
          {renderPane()}
        </div>
      )}
      <div className="hidden md:flex md:flex-col w-80 shrink-0 border-r border-primary/10 overflow-hidden">
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-2">
          <div className="flex-1 min-w-0">
            <SearchInput value={searchQuery} onChange={onSearchChange} placeholder="Search..." />
          </div>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 text-tertiary hover:text-primary"
              aria-label="Messaging settings"
              title="Messaging settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
        {onLensChange && (
          <div className="shrink-0 border-b border-primary/10 pb-1">
            {(['chat', 'calls'] as const).map(l => (
              <button
                key={l}
                onClick={() => onLensChange(l)}
                className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:scale-95 ${
                  lens === l
                    ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
                    : 'hover:bg-secondary/5'
                }`}
              >
                <span className="text-[10pt] font-medium text-primary truncate flex-1">{l === 'chat' ? 'Chat' : 'Calls'}</span>
                {lens === l && <Check size={14} className="text-themeblue2 shrink-0" />}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {renderPane()}
        </div>
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

      {/* New Message / New Group / Add-contact — one card that morphs between
          screens (drill-down primitive) instead of a boolean/ternary machine. */}
      <OverlayStack
        isOpen={showNewMsg}
        onClose={() => { setShowNewMsg(false); picker.reset(); resetOutbound() }}
        anchorRect={null}
        initial={{ key: 'main' }}
        navRef={stackNavRef}
        previewMaxHeight="50dvh"
        // Invite mint + email is the one blocking step in this card, so it collapses
        // to the HUD puck like every other saving surface rather than narrating
        // itself in the email field's hint slot.
        loading={outBusy}
        screens={{
          // Root (contact/group list + the New Group builder) and the off-roster
          // add drill both come from the shared recipient card.
          ...picker.screens,

          // Outbound outside-contact compose (dev-gated) — email a secure 1:1 invite.
          outbound: {
            title: 'Outbound Message',
            onBack: (nav) => { resetOutbound(); nav.pop() },
            rightFooter: (
              <FooterPill side="right">
                <ActionButton
                  icon={Send}
                  label="Send"
                  variant={(!outEmail.trim().includes('@') || outMil || outBusy) ? 'disabled' : 'confirm'}
                  onClick={() => void handleCreateOutbound()}
                />
              </FooterPill>
            ),
            render: () => (
              <div className="px-1 py-1 space-y-2">
                <p className="px-2 pb-1 text-[10pt] text-tertiary leading-relaxed">
                  Send secure messaging to users outside of the application. Military (.mil) addresses are not supported.
                </p>
                <TextInput
                  label="Recipient email"
                  value={outEmail}
                  onChange={(v) => { setOutEmail(v); if (outError) setOutError(null) }}
                  placeholder="name@example.com"
                  type="email"
                  inputMode="email"
                  hint={outMil ? MIL_UNSUPPORTED_MESSAGE : outError}
                />
                {/* ExpandableInput rather than TextArea so abbreviations and
                    templates expand here too; it owns no row chrome, so the
                    surrounding label reproduces the TextArea row. */}
                <label className="block border-b border-primary/6 last:border-b-0">
                  <ExpandableInput
                    value={outMsg}
                    onChange={(v) => setOutMsg(v.slice(0, 2000))}
                    expanders={expanders}
                    multiline
                    hideClear
                    placeholder="Message"
                    className="w-full min-h-[5rem] bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none leading-6"
                  />
                </label>
              </div>
            ),
          },
        }}
      />

      <ProvisionalDeviceModal />
    </div>
  )
}))
