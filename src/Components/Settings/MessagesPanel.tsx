import { useState, useRef, useEffect, useCallback, memo, useImperativeHandle, forwardRef, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Trash2, Headset, Play, MessageSquare, Info, ChevronLeft, ChevronRight, ChevronDown, Pin, Users, Check, QrCode, Mail, Send, Plus, Hash, Settings } from 'lucide-react'
import { useSpring, animated } from '@react-spring/web'
import { SearchInput } from '../SearchInput'
import { HeaderPill, PillButton } from '../HeaderPill'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { supabase } from '../../lib/supabase'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { useAuthStore } from '../../stores/useAuthStore'
import type { RequestStatus } from '../../Hooks/useMessages'
import { ContactListItem } from './ContactListItem'
import { GroupListItem } from './GroupListItem'
import { getDisplayName } from '../../Utilities/nameUtils'
import { GroupInfoPanel } from './GroupInfoPanel'
import { UserAvatar } from './UserAvatar'
import { LoadingSpinner } from '../LoadingSpinner'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { ProvisionalDeviceModal } from './ProvisionalDeviceModal'
import { useAuth } from '../../Hooks/useAuth'
import { useCallActions } from '../../Hooks/CallContext'
import { useAvatar } from '../../Utilities/AvatarContext'
import type { ContextMenuItem } from '../ContextMenu'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { TextInput } from '../FormInputs'
import { useClinicGroupedMedics } from '../../Hooks/useClinicGroupedMedics'
import { useSubClusters } from '../../Hooks/useSubClusters'
import { usePeerAvailability, type UnavailableReason } from '../../Hooks/usePeerAvailability'
import { ChatDetailView, type ParticipantStatus } from '../ChatDetailView'
import { OverlayStack, type StackNav } from '../OverlayStack'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import { useLongPress } from '../../Hooks/useLongPress'
import { useIsMobile } from '../../Hooks/useIsMobile'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import type { MessageContent } from '../../lib/signal/messageContent'
import type { GroupInfo, GroupMember } from '../../lib/signal/groupTypes'
import { useBarcodeScanner } from '../../Hooks/useBarcodeScanner'
import { fetchProfileById } from '../../lib/peerLookup'
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
  /** Tour variant — 'mobile' or 'desktop' — determines data-tour attribute prefix. Omit to disable. */
  tourVariant?: 'mobile' | 'desktop'
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
  tourVariant,
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

  // Tour: open self-chat when tour dispatches the event
  useEffect(() => {
    const handler = () => { if (selfMedic) onSelectPeer(selfMedic) }
    window.addEventListener('tour:messaging-open-self-chat', handler)
    return () => window.removeEventListener('tour:messaging-open-self-chat', handler)
  }, [selfMedic, onSelectPeer])

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
                <div data-tour={tourVariant ? 'messages-self-notes' : undefined}>
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

            <div data-tour={tourVariant ? 'messages-roster' : undefined}>
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
      {canCall ? (
        <HeaderPill>
          {onStartVideoCall && (
            <PillButton icon={Play} onClick={onStartVideoCall} label="Video call" />
          )}
          {onStartCall && (
            <PillButton icon={Headset} onClick={onStartCall} label="Voice call" />
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
      scrollToMessageId={scrollToMessageId}
      onScrollConsumed={onScrollConsumed}
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
        <p className="text-sm font-medium text-primary truncate">{group.name}</p>
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
      conversationPeerName={group.name}
      scrollToMessageId={scrollToMessageId}
      onScrollConsumed={onScrollConsumed}
    >
      <GroupInfoPanel
        isOpen={showGroupInfo}
        group={group}
        userId={userId}
        medics={medics}
        onClose={() => onShowGroupInfo(false)}
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
  const [newMsgMode, setNewMsgMode] = useState<'contacts' | 'group'>('contacts')
  const [groupName, setGroupName] = useState('')
  const [groupSelectedIds, setGroupSelectedIds] = useState<Set<string>>(new Set())
  const [groupCreating, setGroupCreating] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [qrScanOpen, setQrScanOpen] = useState(false)
  const [qrLookupError, setQrLookupError] = useState<string | null>(null)
  const qrVideoRef = useRef<HTMLVideoElement>(null)
  const [emailLookupError, setEmailLookupError] = useState<string | null>(null)
  const [emailLookupLoading, setEmailLookupLoading] = useState(false)
  const [emailValue, setEmailValue] = useState('')
  const [codeValue, setCodeValue] = useState('')
  const [codeLookupError, setCodeLookupError] = useState<string | null>(null)
  const [codeLookupLoading, setCodeLookupLoading] = useState(false)
  // Live nav of the new-message morph stack — handlers push/reset screens on it.
  const stackNavRef = useRef<StackNav | null>(null)

  const {
    isScanning: qrIsScanning,
    error: qrScanError,
    result: qrScanResult,
    startScanning: qrStartScanning,
    stopScanning: qrStopScanning,
    clearResult: qrClearResult,
  } = useBarcodeScanner()

  useImperativeHandle(ref, () => ({
    openNew: () => { setShowNewMsg(true); setNewMsgMode('contacts') },
    showGroupInfo: () => setShowGroupInfo(true),
  }), [])

  // Store subscriptions — before early return so hook order is always stable
  const rawConversations = useMessagingStore(s => s.conversations)
  const unreadCounts = useMessagingStore(s => s.unreadCounts)
  const groups = useMessagingStore(s => s.groups)
  const sendingMap = useMessagingStore(s => s.sendingMap)
  const isDevRole = useAuthStore(s => s.isDevRole)

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

  const allMedics = useMemo(() => {
    // The synthetic SYSTEM peer is kept for everyone (devs included): when a dev
    // is the RECIPIENT of System-direct traffic it must resolve to "System" in
    // the conversation list / chat header. The `extras` gate below still only
    // surfaces it when there's an actual System conversation (messages > 0) or
    // it's the open peer, so it never pollutes an empty contact list/autocomplete
    // — outbound operator↔user threads bucket under the USER's id, not SYSTEM.
    const peerList = Object.values(peerProfiles)
    if (peerList.length === 0) return medics
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
    const extras = peerList.filter(m =>
      !have.has(m.id) && (
        hasVisibleMessage(conversations[m.id]) ||
        m.id === selectedPeerId
      ),
    )
    return extras.length === 0 ? medics : [...medics, ...extras]
  }, [medics, peerProfiles, conversations, selectedPeerId])

  // Batch-check which contacts have active devices
  const medicIds = useMemo(() => allMedics.map(m => m.id), [allMedics])
  const unavailableIds = usePeerAvailability(medicIds)

  // Calls lens — call history + tap-to-redial.
  const callHistory = useCallHistory(allMedics)
  const handleRedial = useCallback((entry: CallHistoryEntry) => {
    callActions?.startCall({ userId: entry.peerId, displayName: getDisplayName(entry.peer) })
  }, [callActions])

  const closeEmailLookup = useCallback(() => {
    setEmailValue('')
    setEmailLookupError(null)
    setEmailLookupLoading(false)
  }, [])

  const closeCodeLookup = useCallback(() => {
    setCodeValue('')
    setCodeLookupError(null)
    setCodeLookupLoading(false)
  }, [])

  // Routes a discovered user (from QR / email / code lookup) based on mode:
  // contacts → open the chat; group → add to the in-progress group selection.
  const handlePickedUser = useCallback((medic: ClinicMedic) => {
    useMessagingStore.getState().setPeerProfile(medic)
    if (newMsgMode === 'group') {
      setGroupSelectedIds(prev => {
        const next = new Set(prev)
        next.add(medic.id)
        return next
      })
      // Tear down the lookup sub-flow and morph back to the group builder (root).
      setQrScanOpen(false)
      qrStopScanning()
      qrClearResult()
      closeEmailLookup()
      closeCodeLookup()
      stackNavRef.current?.reset()
    } else {
      setShowNewMsg(false)
      onSelectPeer(medic)
    }
  }, [newMsgMode, onSelectPeer, qrStopScanning, qrClearResult, closeEmailLookup, closeCodeLookup])

  const handleEmailLookup = useCallback(async () => {
    const email = emailValue.trim().toLowerCase()
    setEmailLookupError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailLookupError('Enter a valid email address')
      return
    }
    setEmailLookupLoading(true)
    try {
      const { data, error } = await supabase.rpc('search_users', { query: email })
      if (error || !data) { setEmailLookupError('Lookup failed'); return }
      const match = (data as Array<{ id: string; email?: string | null; first_name: string | null; last_name: string | null; middle_initial: string | null; rank: string | null; credential: string | null; avatar_id: string | null; clinic_id: string | null; clinic_name: string | null }>)
        .find(r => r.email?.toLowerCase() === email)
      if (!match) { setEmailLookupError('No user found with that email'); return }
      const medic: ClinicMedic = {
        id: match.id,
        firstName: match.first_name,
        lastName: match.last_name,
        middleInitial: match.middle_initial,
        rank: match.rank,
        credential: match.credential,
        avatarId: match.avatar_id ?? null,
        clinicId: match.clinic_id ?? undefined,
        clinicName: match.clinic_name ?? undefined,
      }
      setEmailValue('')
      handlePickedUser(medic)
    } catch {
      setEmailLookupError('Lookup failed')
    } finally {
      setEmailLookupLoading(false)
    }
  }, [emailValue, handlePickedUser])

  const handleCodeLookup = useCallback(async () => {
    const code = codeValue.trim()
    setCodeLookupError(null)
    if (!code) {
      setCodeLookupError('Enter a user code')
      return
    }
    setCodeLookupLoading(true)
    try {
      const medic = await fetchProfileById(code)
      if (!medic) {
        setCodeLookupError('No user found with that code')
        return
      }
      handlePickedUser(medic)
    } catch {
      setCodeLookupError('Lookup failed')
    } finally {
      setCodeLookupLoading(false)
    }
  }, [codeValue, handlePickedUser])

  const toggleGroupMember = useCallback((id: string) => {
    setGroupSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleCreateGroup = useCallback(async () => {
    if (!messagesCtx) return
    const trimmed = groupName.trim()
    if (!trimmed || groupSelectedIds.size === 0 || groupCreating) return
    setGroupCreating(true)
    const id = await messagesCtx.createGroup(trimmed, [...groupSelectedIds])
    setGroupCreating(false)
    if (id) setShowNewMsg(false)
  }, [messagesCtx, groupName, groupSelectedIds, groupCreating])

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

  useEffect(() => {
    if (!qrScanResult || !qrScanOpen) return

    const userId = qrScanResult.trim()
    setQrLookupError(null)

    fetchProfileById(userId).then(medic => {
      if (!medic) {
        setQrLookupError('User not found')
        qrClearResult()
        return
      }
      setQrScanOpen(false)
      qrClearResult()
      handlePickedUser(medic)
    })
  }, [qrScanResult, qrScanOpen, qrClearResult, handlePickedUser])

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
    const peer = allMedics.find(m => m.id === selectedPeerId)
    const peerName = peer
      ? [peer.rank, peer.lastName].filter(Boolean).join(' ') || peer.firstName || undefined
      : undefined

    mainContent = (
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
    onCreateGroup: () => { setShowNewMsg(true); setNewMsgMode('group'); setGroupName(''); setGroupSelectedIds(new Set()) },
    deleteConversation,
    loading,
    searchQuery,
    onSearchClear,
  }

  // Chat lens → conversations; Calls lens → call history (tap to redial).
  const renderPane = (tourVariant: 'mobile' | 'desktop') =>
    lens === 'calls'
      ? <CallsPane entries={callHistory} onRedial={handleRedial} searchQuery={searchQuery} />
      : <ConversationPane {...conversationPaneProps} tourVariant={tourVariant} />

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
          {renderPane('mobile')}
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
          {renderPane('desktop')}
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
        onClose={() => { setShowNewMsg(false); setNewMsgMode('contacts'); setQrScanOpen(false); qrStopScanning(); qrClearResult(); closeEmailLookup(); closeCodeLookup() }}
        anchorRect={null}
        initial={{ key: 'main' }}
        navRef={stackNavRef}
        previewMaxHeight="50dvh"
        screens={{
          // Root: the contact list (New Message) or the group builder (New Group).
          // The mode is host state so the two share one root — New Group / back
          // toggle it in place; the Add sub-flow drills on top of whichever is shown.
          main: {
            title: newMsgMode === 'group' ? 'New Group' : 'New Message',
            searchPlaceholder: 'Search contacts...',
            onBack: newMsgMode === 'group'
              ? () => { setNewMsgMode('contacts'); setGroupSelectedIds(new Set()) }
              : undefined,
            footer: (_p, nav) => (
              <ActionPill>
                {newMsgMode === 'contacts' && (
                  <ActionButton
                    icon={Users}
                    label="New Group"
                    onClick={() => { setNewMsgMode('group'); setGroupName(''); setGroupSelectedIds(new Set()) }}
                  />
                )}
                <ActionButton icon={Plus} label="Add" onClick={() => nav.push('addPicker')} />
              </ActionPill>
            ),
            rightFooter: newMsgMode === 'group' ? (
              <ActionPill>
                <ActionButton
                  icon={Check}
                  label="Create Group"
                  variant={(!groupName.trim() || groupSelectedIds.size === 0 || groupCreating) ? 'disabled' : 'success'}
                  onClick={handleCreateGroup}
                />
              </ActionPill>
            ) : undefined,
            render: (_p, _nav, filter) => {
              const q = filter.toLowerCase()
              // System is a synthetic pseudo-user injected into peerProfiles for
              // name/avatar resolution of existing system conversations. It must
              // never appear as a startable contact in the new-conversation picker.
              const rosterMedics = allMedics.filter(m => m.id !== SYSTEM_USER_ID)
              const filtered = q
                ? rosterMedics.filter(m =>
                    m.firstName?.toLowerCase().includes(q) ||
                    m.lastName?.toLowerCase().includes(q) ||
                    m.rank?.toLowerCase().includes(q) ||
                    [m.rank, m.lastName].filter(Boolean).join(' ').toLowerCase().includes(q)
                  )
                : rosterMedics
              return (
                <div className="py-1">
                  {newMsgMode === 'group' && (
                    <div className="px-4 pb-2 pt-1">
                      <input
                        type="text"
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        placeholder="Group name"
                        autoFocus
                        className="w-full px-4 py-2 rounded-full bg-themewhite2 text-sm text-primary
                                   placeholder:text-tertiary outline-none focus:ring-1 focus:ring-themeblue2/40 transition-all"
                      />
                    </div>
                  )}
                  {filtered.map(medic => (
                    newMsgMode === 'group' ? (
                      <button
                        key={medic.id}
                        onClick={() => toggleGroupMember(medic.id)}
                        className="flex items-center w-full px-4 py-2.5 gap-3 text-left hover:bg-themewhite2 active:scale-95 transition-all"
                      >
                        <UserAvatar avatarId={medic.avatarId} avatarBlob={medic.avatarBlob} userId={medic.id} firstName={medic.firstName} lastName={medic.lastName} className="w-8 h-8" />
                        <span className="flex-1 text-sm text-primary truncate">{getDisplayName(medic)}</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                                       ${groupSelectedIds.has(medic.id) ? 'bg-themeblue2 border-themeblue2' : 'border-tertiary/30'}`}>
                          {groupSelectedIds.has(medic.id) && <Check size={12} className="text-white" />}
                        </div>
                      </button>
                    ) : (
                      <button
                        key={medic.id}
                        onClick={() => { setShowNewMsg(false); onSelectPeer(medic) }}
                        className="flex items-center w-full px-4 py-2.5 gap-3 text-left hover:bg-themewhite2 active:scale-95 transition-all"
                      >
                        <UserAvatar avatarId={medic.avatarId} avatarBlob={medic.avatarBlob} userId={medic.id} firstName={medic.firstName} lastName={medic.lastName} className="w-8 h-8" />
                        <span className="flex-1 text-sm text-primary truncate">{getDisplayName(medic)}</span>
                      </button>
                    )
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-[10pt] text-tertiary text-center py-6">No contacts found</p>
                  )}
                </div>
              )
            },
          },
          // Add a contact off-roster: pick a lookup method, then drill into it.
          addPicker: {
            title: 'Add Contact',
            render: (_p, nav) => {
              const pickerRows: Array<{ key: string; label: string; icon: typeof QrCode; onClick: () => void }> = [
                {
                  key: 'scan-qr',
                  label: 'Scan QR Code',
                  icon: QrCode,
                  onClick: () => {
                    setQrScanOpen(true)
                    setQrLookupError(null)
                    nav.push('qrScan')
                    requestAnimationFrame(() => {
                      if (qrVideoRef.current) qrStartScanning(qrVideoRef.current)
                    })
                  },
                },
                {
                  key: 'by-email',
                  label: 'Find by Email',
                  icon: Mail,
                  onClick: () => {
                    setEmailLookupError(null)
                    setEmailValue('')
                    nav.push('emailLookup')
                  },
                },
                {
                  key: 'by-code',
                  label: 'Enter User Code',
                  icon: Hash,
                  onClick: () => {
                    setCodeLookupError(null)
                    setCodeValue('')
                    nav.push('codeLookup')
                  },
                },
              ]
              return (
                <div className="py-1">
                  {pickerRows.map(row => (
                    <button
                      key={row.key}
                      onClick={row.onClick}
                      className="flex items-center w-full px-4 py-2.5 gap-3 text-left hover:bg-themewhite2 active:scale-95 transition-all"
                    >
                      <div className="w-8 h-8 rounded-full bg-themewhite2 flex items-center justify-center shrink-0">
                        <row.icon className="w-4 h-4 text-themeblue2" />
                      </div>
                      <span className="flex-1 text-sm text-primary">{row.label}</span>
                    </button>
                  ))}
                </div>
              )
            },
          },
          qrScan: {
            title: 'Scan QR Code',
            onBack: (nav) => { qrStopScanning(); setQrScanOpen(false); qrClearResult(); setQrLookupError(null); nav.pop() },
            render: () => (
              <div className="px-4 py-3 space-y-2">
                <p className="text-[10pt] text-tertiary">
                  Scan another user's QR code to open a conversation.
                </p>
                <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/5 border border-tertiary/10">
                  <video
                    ref={qrVideoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  {!qrIsScanning && !qrScanError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-[10pt] text-tertiary">Starting camera…</p>
                    </div>
                  )}
                </div>
                {(qrScanError || qrLookupError) && (
                  <p className="text-[10pt] text-themeredred">{qrScanError || qrLookupError}</p>
                )}
              </div>
            ),
          },
          emailLookup: {
            title: 'Find by Email',
            onBack: (nav) => { closeEmailLookup(); nav.pop() },
            rightFooter: (
              <ActionPill>
                <ActionButton
                  icon={Send}
                  label="Find User"
                  variant={(!emailValue.trim() || emailLookupLoading) ? 'disabled' : 'default'}
                  onClick={handleEmailLookup}
                />
              </ActionPill>
            ),
            render: () => (
              <div className="px-1 py-1">
                <TextInput
                  label="Email"
                  value={emailValue}
                  onChange={(v) => { setEmailValue(v); if (emailLookupError) setEmailLookupError(null) }}
                  placeholder="user@example.com"
                  type="email"
                  inputMode="email"
                  hint={emailLookupLoading ? 'Looking up email…' : emailLookupError}
                />
              </div>
            ),
          },
          codeLookup: {
            title: 'Enter User Code',
            onBack: (nav) => { closeCodeLookup(); nav.pop() },
            rightFooter: (
              <ActionPill>
                <ActionButton
                  icon={Send}
                  label="Find User"
                  variant={(!codeValue.trim() || codeLookupLoading) ? 'disabled' : 'default'}
                  onClick={handleCodeLookup}
                />
              </ActionPill>
            ),
            render: () => (
              <div className="px-1 py-1">
                <TextInput
                  label="User Code"
                  value={codeValue}
                  onChange={(v) => { setCodeValue(v); if (codeLookupError) setCodeLookupError(null) }}
                  placeholder="Paste user code"
                  hint={codeLookupLoading ? 'Looking up user…' : codeLookupError}
                />
              </div>
            ),
          },
        }}
      />

      <ProvisionalDeviceModal />
    </div>
  )
}))
