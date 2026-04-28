import { useState, useRef, useEffect, useCallback, memo, useImperativeHandle, forwardRef, useMemo } from 'react'
import { Trash2, Headset, Play, MessageSquare, Info, ChevronLeft, Pin, Search, Users, Check, QrCode } from 'lucide-react'
import { useSpring, animated, type SpringValue } from '@react-spring/web'
import { MobileSearchBar } from '../MobileSearchBar'
import { HeaderPill, PillButton } from '../HeaderPill'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useOrphanedProfiles } from '../../Hooks/useOrphanedProfiles'
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
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { SwipeableCard, type SwipeAction as SwipeCardAction } from '../SwipeableCard'
import { useClinicGroupedMedics } from '../../Hooks/useClinicGroupedMedics'
import { usePeerAvailability, type UnavailableReason } from '../../Hooks/usePeerAvailability'
import { ChatDetailView, type ParticipantStatus } from '../ChatDetailView'
import { PreviewOverlay } from '../PreviewOverlay'
import type { ContextMenuAction } from '../PreviewOverlay'
import { ConversationPreview } from '../ConversationPreview'
import { useLongPress } from '../../Hooks/useLongPress'
import { useIsMobile } from '../../Hooks/useIsMobile'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import type { GroupInfo, GroupMember } from '../../lib/signal/groupTypes'
import { useBarcodeScanner } from '../../Hooks/useBarcodeScanner'
import { getMemberProfile } from '../../lib/supervisorService'

export type MessagesView = 'messages' | 'messages-chat' | 'messages-group-chat'

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
  onSearchFocusChange?: (focused: boolean) => void
  headerCollapse?: SpringValue<number>
}

/** Extends ClinicMedic with email for global search display. */
type GlobalContactResult = ClinicMedic & { email?: string }

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
      onContextMenu={e => e.preventDefault()}
      className={`transition-opacity duration-100 ${isPressing ? 'opacity-60' : ''}`}
    >
      {children}
    </div>
  )
}

/** Build action tiles for the conversation preview — varies by whether a conversation exists. */
function buildPreviewActions(
  target: PreviewTarget,
  handlers: { onOpen: () => void; onTogglePin: () => void; onDelete: () => void },
): ContextMenuAction[] {
  const actions: ContextMenuAction[] = [
    { key: 'open', label: target.hasConversation ? 'Open' : 'Message', icon: MessageSquare, onAction: handlers.onOpen },
  ]
  if (target.hasConversation) {
    actions.push(
      { key: 'pin', label: target.isPinned ? 'Unpin' : 'Pin', icon: Pin, onAction: handlers.onTogglePin },
      { key: 'delete', label: 'Delete', icon: Trash2, onAction: handlers.onDelete, variant: 'danger' },
    )
  }
  return actions
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
  onSelectNewPeer: (medic: ClinicMedic) => void
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
  const isMobile = useIsMobile()
  const pinnedKeysArr = useMessagingStore(s => s.pinnedConversationKeys)
  const pinnedKeys = useMemo(() => new Set(pinnedKeysArr), [pinnedKeysArr])
  const togglePinConversation = useMessagingStore(s => s.togglePinConversation)
  const [contextMenu, setContextMenu] = useState<{ conversationKey: string; x: number; y: number } | null>(null)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null)
  const [previewAnchorRect, setPreviewAnchorRect] = useState<DOMRect | null>(null)
  const showLoading = useMinLoadTime(loading ?? false)

  // Global user search state
  const [globalResults, setGlobalResults] = useState<GlobalContactResult[] | null>(null)
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false)
  const globalSearchQRef = useRef<string>('')

  const runGlobalSearch = useCallback(async (q: string) => {
    setGlobalSearchLoading(true)
    try {
      const { data, error } = await supabase.rpc('search_users', { query: q })
      if (error || !data) { setGlobalResults([]); return }
      const knownIds = new Set([...medics.map(m => m.id), userId ?? ''])
      setGlobalResults(
        (data as any[])
          .filter(r => !knownIds.has(r.id))
          .map(r => ({
            id: r.id, firstName: r.first_name, lastName: r.last_name,
            middleInitial: r.middle_initial, rank: r.rank, credential: r.credential,
            avatarId: r.avatar_id ?? null, clinicId: r.clinic_id, clinicName: r.clinic_name,
            email: r.email,
          }))
      )
    } catch {
      setGlobalResults([])
    } finally {
      setGlobalSearchLoading(false)
    }
  }, [medics, userId])

  // Auto-fire global search for email queries; reset when query changes
  useEffect(() => {
    globalSearchQRef.current = ''
    setGlobalResults(null)
    const q = searchQuery.trim()
    if (!q.includes('@') || q.length < 3) return
    const timer = setTimeout(() => {
      if (globalSearchQRef.current === q) return
      globalSearchQRef.current = q
      runGlobalSearch(q)
    }, 600)
    return () => clearTimeout(timer)
  }, [searchQuery, runGlobalSearch])

  const handleGlobalSearchClick = useCallback(() => {
    const q = searchQuery.trim()
    if (q.length < 3 || globalSearchQRef.current === q) return
    globalSearchQRef.current = q
    runGlobalSearch(q)
  }, [searchQuery, runGlobalSearch])

  const handlePreview = useCallback((target: PreviewTarget, rect: DOMRect) => {
    setPreviewTarget(target)
    setPreviewAnchorRect(rect)
  }, [])

  const handleClosePreview = useCallback(() => {
    setPreviewTarget(null)
    setPreviewAnchorRect(null)
  }, [])

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
      {!signalReady && (
        <div className="flex items-center gap-2 px-3 py-2 bg-themeblue2/10 border-b border-themeblue2/20">
          <div className="w-3 h-3 border-2 border-themeblue2 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10pt] text-themeblue2 font-medium">Setting up encryption…</span>
        </div>
      )}
      <div className="pt-1 pb-10">
        {/* Search results */}
        {searchResults ? (
          <div>
            {searchResults.groups.length === 0 && searchResults.medics.length === 0 && searchResults.messages.length === 0 && globalResults !== null && !globalSearchLoading && globalResults.length === 0 && (
              <p className="text-[10pt] text-tertiary px-3 py-4 text-center">No results for &ldquo;{searchQuery}&rdquo;</p>
            )}
            {searchResults.groups.length > 0 && (
              <>
                <p className="text-[10pt] text-tertiary px-3 mb-1 uppercase tracking-wider font-semibold">Groups</p>
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
                <p className="text-[10pt] text-tertiary px-3 mb-1 mt-2 uppercase tracking-wider font-semibold">Contacts</p>
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
            {/* Global user search */}
            {searchQuery.trim().length >= 3 && (
              globalSearchLoading ? (
                <LoadingSpinner label="Searching all users..." className="py-3 text-tertiary" />
              ) : globalResults !== null ? (
                globalResults.length > 0 ? (
                  <>
                    <p className="text-[10pt] text-tertiary px-3 mb-1 mt-2 uppercase tracking-wider font-semibold">All Users</p>
                    {globalResults.map(result => (
                      <ContactListItem
                        key={result.id}
                        medic={result}
                        lastMessage={result.email}
                        unreadCount={0}
                        onClick={() => { onSearchClear(); onSelectNewPeer(result) }}
                      />
                    ))}
                  </>
                ) : null
              ) : (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-primary/5 active:bg-primary/10 transition-colors"
                  onClick={handleGlobalSearchClick}
                >
                  <Search className="w-4 h-4 text-tertiary shrink-0" />
                  <span className="text-[10pt] text-tertiary">Search all users for &ldquo;{searchQuery}&rdquo;</span>
                </button>
              )
            )}
          </div>
        ) : (
          <>
            {/* Conversations section */}
            {selfMedic && (
              <div data-tour={tourVariant ? 'messages-self-notes' : undefined}>
                {isMobile ? (
                  <LongPressRow
                    onClick={() => onSelectPeer(selfMedic)}
                    onLongPress={(rect) => handlePreview(
                      { key: userId!, type: 'contact', medic: selfMedic, hasConversation: !!conversations[userId!]?.length, isPinned: false },
                      rect,
                    )}
                  >
                    <ContactListItem medic={selfMedic} lastMessage={conversations[userId!]?.filter(m => !m.threadId).at(-1)?.plaintext} unreadCount={0} onClick={() => {}} />
                  </LongPressRow>
                ) : (
                  <ContactListItem
                    medic={selfMedic}
                    lastMessage={conversations[userId!]?.filter(m => !m.threadId).at(-1)?.plaintext}
                    unreadCount={0}
                    onClick={() => onSelectPeer(selfMedic)}
                  />
                )}
              </div>
            )}
            {recentEntries.length > 0 && (
              <>
                <p className="text-[10pt] text-tertiary px-3 mb-1 mt-1 uppercase tracking-wider font-semibold">Recent</p>
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
                      onAction: () => togglePinConversation(entry.key),
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
                      onLongPress={isMobile ? (x, y) => {
                        handlePreview(
                          { key: entry.key, type: entry.type, medic: entry.medic, group: entry.group, hasConversation: true, isPinned },
                          new DOMRect(x - 20, y - 20, 40, 40),
                        )
                      } : undefined}
                    >
                      <div className="bg-themewhite3">
                        {listItem}
                      </div>
                    </SwipeableCard>
                  )
                })}
              </>
            )}

            <div data-tour={tourVariant ? 'messages-roster' : undefined}>
              <div className="mx-3 my-2 border-b border-primary/10" />

              {/* Contacts: My Clinic (exclude those already in Recent conversations) */}
              {(() => {
                const filtered = ownClinicMedics.filter(m => m.id !== userId && !activeConversationIds.has(m.id))
                return filtered.length > 0 ? (
                  <>
                    <div className="flex items-center gap-1.5 px-3 py-1.5">
                      <p className="text-[10pt] text-tertiary uppercase tracking-wider font-semibold">My Clinic</p>
                    </div>
                    {filtered.map(medic => isMobile ? (
                      <LongPressRow
                        key={medic.id}
                        onClick={() => onSelectPeer(medic)}
                        onLongPress={(rect) => handlePreview(
                          { key: medic.id, type: 'contact', medic, hasConversation: false, isPinned: false },
                          rect,
                        )}
                      >
                        <ContactListItem medic={medic} unreadCount={0} unavailable={unavailableIds.has(medic.id)} unavailableReason={unavailableIds.get(medic.id)} onClick={() => {}} />
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
                      <p className="text-[10pt] text-tertiary uppercase tracking-wider font-semibold">{clinicName}</p>
                    </div>
                    {filtered.map(medic => isMobile ? (
                      <LongPressRow
                        key={medic.id}
                        onClick={() => onSelectPeer(medic)}
                        onLongPress={(rect) => handlePreview(
                          { key: medic.id, type: 'contact', medic, hasConversation: false, isPinned: false },
                          rect,
                        )}
                      >
                        <ContactListItem medic={medic} unreadCount={0} unavailable={unavailableIds.has(medic.id)} unavailableReason={unavailableIds.get(medic.id)} onClick={() => {}} />
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
                    ))}
                  </div>
                )
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
                  {filtered.map(group => isMobile ? (
                    <LongPressRow
                      key={group.groupId}
                      onClick={() => onSelectGroup(group)}
                      onLongPress={(rect) => handlePreview(
                        { key: group.groupId, type: 'group', group, hasConversation: false, isPinned: false },
                        rect,
                      )}
                    >
                      <GroupListItem group={group} unreadCount={0} onClick={() => {}} />
                    </LongPressRow>
                  ) : (
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
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              key: 'pin',
              label: pinnedKeys.has(contextMenu.conversationKey) ? 'Unpin' : 'Pin',
              icon: Pin,
              onAction: () => togglePinConversation(contextMenu.conversationKey),
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

      {/* Long-press preview (mobile) */}
      {isMobile && (
        <PreviewOverlay
          isOpen={!!previewTarget}
          onClose={handleClosePreview}
          anchorRect={previewAnchorRect}
          preview={
            previewTarget && (
              <ConversationPreview
                conversationKey={previewTarget.key}
                type={previewTarget.type}
                medic={previewTarget.medic}
                group={previewTarget.group}
                conversations={conversations}
                userId={userId}
                unavailableReason={unavailableIds.get(previewTarget.key)}
              />
            )
          }
          actions={previewTarget ? buildPreviewActions(previewTarget, {
            onOpen: () => {
              if (previewTarget.type === 'group' && previewTarget.group) onSelectGroup(previewTarget.group)
              else if (previewTarget.type === 'contact' && previewTarget.medic) onSelectPeer(previewTarget.medic)
            },
            onTogglePin: () => togglePinConversation(previewTarget.key),
            onDelete: () => deleteConversation(previewTarget.key),
          }) : []}
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
  const [showNewMsg, setShowNewMsg] = useState(false)
  const [newMsgMode, setNewMsgMode] = useState<'contacts' | 'group'>('contacts')
  const [groupName, setGroupName] = useState('')
  const [groupSelectedIds, setGroupSelectedIds] = useState<Set<string>>(new Set())
  const [groupCreating, setGroupCreating] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [extraMedics, setExtraMedics] = useState<ClinicMedic[]>([])
  const [qrScanOpen, setQrScanOpen] = useState(false)
  const [qrLookupError, setQrLookupError] = useState<string | null>(null)
  const qrVideoRef = useRef<HTMLVideoElement>(null)

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
  const conversations = useMessagingStore(s => s.conversations)
  const unreadCounts = useMessagingStore(s => s.unreadCounts)
  const groups = useMessagingStore(s => s.groups)
  const sendingMap = useMessagingStore(s => s.sendingMap)

  // Orphaned profiles: conversation peers no longer visible in the clinic roster
  const orphanedIds = useMemo(() => {
    const selfId = useAuthStore.getState().user?.id ?? ''
    const medicIdSet = new Set(medics.map(m => m.id))
    return Object.keys(conversations).filter(
      key => key !== selfId && !groups[key] && !medicIdSet.has(key)
    )
  }, [conversations, groups, medics])
  const orphanedProfiles = useOrphanedProfiles(orphanedIds)

  // Merge clinic roster + orphaned + search-discovered contacts
  const allMedics = useMemo(() => {
    if (orphanedProfiles.size === 0 && extraMedics.length === 0) return medics
    const extraFromOrphan = [...orphanedProfiles.values()]
    const extraFromSearch = extraMedics.filter(m => !orphanedProfiles.has(m.id))
    return [...medics, ...extraFromOrphan, ...extraFromSearch]
  }, [medics, orphanedProfiles, extraMedics])

  // Batch-check which contacts have active devices (includes orphaned + search-found)
  const medicIds = useMemo(() => allMedics.map(m => m.id), [allMedics])
  const unavailableIds = usePeerAvailability(medicIds)

  // Add a globally-discovered contact to extraMedics before navigating to their chat
  const handleSelectNewPeer = useCallback((medic: ClinicMedic) => {
    setExtraMedics(prev => prev.some(m => m.id === medic.id) ? prev : [...prev, medic])
    onSelectPeer(medic)
  }, [onSelectPeer])

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

    getMemberProfile(userId).then(result => {
      if (!result.ok) {
        setQrLookupError('User not found')
        qrClearResult()
        return
      }
      const medic: ClinicMedic = {
        id: userId,
        firstName: result.data.firstName,
        lastName: result.data.lastName,
        middleInitial: result.data.middleInitial,
        rank: result.data.rank,
        credential: result.data.credential,
        avatarId: null,
      }
      setQrScanOpen(false)
      setShowNewMsg(false)
      qrClearResult()
      onSelectPeer(medic)
    })
  }, [qrScanResult, qrScanOpen, qrClearResult, onSelectPeer])

  if (!messagesCtx) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-tertiary">Sign in to use messages.</p>
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
    onSelectNewPeer: handleSelectNewPeer,
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
            <ConversationPane {...conversationPaneProps} tourVariant="mobile" />
          </MobileSearchBar>
        </div>
      )}
      <div className="hidden md:flex md:flex-col w-80 shrink-0 border-r border-primary/10 overflow-hidden">
        <MobileSearchBar variant="messages" value={searchQuery} onChange={onSearchChange} placeholder="Search..." onFocusChange={onSearchFocusChange}>
          <ConversationPane {...conversationPaneProps} tourVariant="desktop" />
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

      {/* New Message / New Group overlay */}
      <PreviewOverlay
        isOpen={showNewMsg}
        onClose={() => { setShowNewMsg(false); setNewMsgMode('contacts'); setQrScanOpen(false); qrStopScanning(); qrClearResult() }}
        anchorRect={null}
        title={newMsgMode === 'contacts' ? 'New Message' : 'New Group'}
        onBack={newMsgMode === 'group' ? () => { setNewMsgMode('contacts'); setGroupSelectedIds(new Set()) } : undefined}
        searchPlaceholder="Search contacts..."
        previewMaxHeight="50dvh"
        preview={(filter: string) => {
          const q = filter.toLowerCase()
          const filtered = q
            ? allMedics.filter(m =>
                m.firstName?.toLowerCase().includes(q) ||
                m.lastName?.toLowerCase().includes(q) ||
                m.rank?.toLowerCase().includes(q) ||
                [m.rank, m.lastName].filter(Boolean).join(' ').toLowerCase().includes(q)
              )
            : allMedics
          if (qrScanOpen) {
            return (
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
                <button
                  onClick={() => { qrStopScanning(); setQrScanOpen(false); qrClearResult(); setQrLookupError(null) }}
                  className="w-full py-2 text-[10pt] text-tertiary active:opacity-70 transition-opacity"
                >
                  Cancel
                </button>
              </div>
            )
          }
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
                    <UserAvatar avatarId={medic.avatarId} firstName={medic.firstName} lastName={medic.lastName} className="w-8 h-8" />
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
                    <UserAvatar avatarId={medic.avatarId} firstName={medic.firstName} lastName={medic.lastName} className="w-8 h-8" />
                    <span className="flex-1 text-sm text-primary truncate">{getDisplayName(medic)}</span>
                  </button>
                )
              ))}
              {filtered.length === 0 && (
                <p className="text-[10pt] text-tertiary text-center py-6">No contacts found</p>
              )}
            </div>
          )
        }}
        actions={
          newMsgMode === 'group' ? [{
            key: 'create-group',
            label: 'Create Group',
            icon: Check,
            onAction: handleCreateGroup,
            closesOnAction: false,
            variant: (!groupName.trim() || groupSelectedIds.size === 0 || groupCreating) ? 'disabled' : 'default',
          }] :
          newMsgMode === 'contacts' && !qrScanOpen ? [
            {
              key: 'new-group',
              label: 'New Group',
              icon: Users,
              closesOnAction: false,
              onAction: () => { setNewMsgMode('group'); setGroupName(''); setGroupSelectedIds(new Set()) },
            },
            {
              key: 'scan-qr',
              label: 'Scan QR',
              icon: QrCode,
              closesOnAction: false,
              onAction: () => {
                setQrScanOpen(true)
                setQrLookupError(null)
                requestAnimationFrame(() => {
                  if (qrVideoRef.current) qrStartScanning(qrVideoRef.current)
                })
              },
            },
          ] : []
        }
      />
      <ProvisionalDeviceModal />
    </animated.div>
  )
}))
