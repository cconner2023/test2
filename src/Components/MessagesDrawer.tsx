import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { PenLine, Search, X, CalendarDays, Plus } from 'lucide-react'
import { useSpring, animated } from '@react-spring/web'
import { BaseDrawer } from './BaseDrawer'
import { HeaderPill, PillButton } from './HeaderPill'
import { MessagesPanel, type MessagesView, type MessagesPanelHandle } from './Settings/MessagesPanel'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useMessagesContext } from '../Hooks/MessagesContext'
import { useAuth } from '../Hooks/useAuth'
import { useUserProfile } from '../Hooks/useUserProfile'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'
import type { GroupInfo } from '../lib/signal/groupTypes'

interface MessagesDrawerProps {
    isVisible: boolean
    onClose: () => void
    initialPeerId?: string | null
    initialGroupId?: string | null
    initialPeerName?: string | null
}

export function MessagesDrawer({ isVisible, onClose, initialPeerId, initialGroupId, initialPeerName }: MessagesDrawerProps) {
    const [view, setView] = useState<MessagesView>('messages')
    const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null)
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
    const [selectedPeerName, setSelectedPeerName] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearchExpanded, setIsSearchExpanded] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const messagesCtx = useMessagesContext()
    const { user, isDevRole } = useAuth()
    const { profile } = useUserProfile()
    const panelRef = useRef<MessagesPanelHandle>(null)

    // Spring for search expand/collapse — consistent across mobile + desktop
    const searchSpring = useSpring({
        progress: isSearchExpanded ? 1 : 0,
        config: { tension: 260, friction: 26 },
    })

    // Focus input when search expands
    useEffect(() => {
        if (isSearchExpanded && searchInputRef.current) {
            searchInputRef.current.focus()
        }
    }, [isSearchExpanded])

    const collapseSearch = useCallback(() => {
        setSearchQuery('')
        setIsSearchExpanded(false)
    }, [])

    const handleSearchClear = useCallback(() => {
        setSearchQuery('')
        setIsSearchExpanded(false)
    }, [])

    // Apply deep-link when drawer opens
    const appliedInitialRef = useMemo(() => {
        if (!isVisible) return false
        if (initialGroupId) {
            setSelectedGroupId(initialGroupId)
            setSelectedPeerId(null)
            setSelectedPeerName(initialPeerName ?? 'Group')
            setView('messages-group-chat')
            return true
        }
        if (initialPeerId) {
            setSelectedPeerId(initialPeerId)
            setSelectedGroupId(null)
            setSelectedPeerName(initialPeerName ?? 'Chat')
            setView('messages-chat')
            return true
        }
        return false
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVisible, initialPeerId, initialGroupId, initialPeerName])

    const handleSelectPeer = useCallback((medic: ClinicMedic) => {
        setSelectedPeerId(medic.id)
        setSelectedGroupId(null)
        const isSelf = medic.id === user?.id
        const name = isSelf
            ? [profile.rank, profile.lastName].filter(Boolean).join(' ') || profile.firstName || 'Notes'
            : [medic.rank, medic.lastName].filter(Boolean).join(' ') || medic.firstName || 'Chat'
        setSelectedPeerName(name)
        setView('messages-chat')
    }, [user?.id, profile.rank, profile.lastName, profile.firstName])

    const handleSelectGroup = useCallback((group: GroupInfo) => {
        setSelectedGroupId(group.groupId)
        setSelectedPeerId(null)
        setSelectedPeerName(group.name)
        setView('messages-group-chat')
    }, [])

    const handleBack = useCallback(() => {
        if (view === 'messages-chat' || view === 'messages-group-chat' || view === 'messages-calendar') {
            setView('messages')
            setSelectedPeerId(null)
            setSelectedPeerName(null)
            setSelectedGroupId(null)
            if (messagesCtx) messagesCtx.activePeerRef.current = null
        }
    }, [view, messagesCtx])

    const handleClose = useCallback(() => {
        setView('messages')
        setSelectedPeerId(null)
        setSelectedPeerName(null)
        setSelectedGroupId(null)
        if (messagesCtx) messagesCtx.activePeerRef.current = null
        onClose()
    }, [onClose, messagesCtx])

    const swipeHandlers = useSwipeBack(
        useMemo(() => {
            if (view === 'messages') return undefined
            return handleBack
        }, [view, handleBack]),
        view !== 'messages',
    )

    const isConversationView = view === 'messages-chat' || view === 'messages-group-chat'
    const isCalendarView = view === 'messages-calendar'
    const isMessagesActive = view === 'messages' || isConversationView || isCalendarView

    const headerConfig = useMemo(() => {
        if (view === 'messages-chat' || view === 'messages-group-chat') {
            return { title: 'Messages', showBack: true, onBack: handleBack }
        }
        if (view === 'messages-calendar') {
            return {
                title: 'Calendar',
                showBack: true,
                onBack: handleBack,
                hideDefaultClose: true,
                rightContent: (
                    <HeaderPill>
                        <PillButton icon={Plus} onClick={() => {}} label="New event" />
                        <PillButton icon={X} onClick={handleClose} label="Close" />
                    </HeaderPill>
                ),
            }
        }
        return {
            title: 'Messages',
            hideDefaultClose: true,
            rightContentFill: isSearchExpanded,
            rightContent: (
                <div className="relative flex items-center w-full">
                    <animated.div
                        style={{
                            opacity: searchSpring.progress.to(p => 1 - p),
                            pointerEvents: isSearchExpanded ? 'none' : 'auto',
                        }}
                    >
                        <HeaderPill>
                            {isDevRole && <PillButton icon={CalendarDays} onClick={() => setView('messages-calendar')} label="Calendar" />}
                            <PillButton icon={PenLine} onClick={() => panelRef.current?.createGroup()} label="New message" />
                            <PillButton icon={Search} onClick={() => setIsSearchExpanded(true)} label="Search" />
                            <PillButton icon={X} onClick={handleClose} label="Close" />
                        </HeaderPill>
                    </animated.div>

                    {/* Search overlay — fade in when search expands */}
                    <animated.div
                        className="absolute inset-0 flex items-center"
                        style={{
                            opacity: searchSpring.progress,
                            transform: searchSpring.progress.to(p => `scale(${0.97 + 0.03 * p})`),
                            pointerEvents: isSearchExpanded ? 'auto' : 'none',
                        }}
                    >
                        <div className="flex items-center w-full rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2">
                            <input
                                ref={searchInputRef}
                                type="search"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Escape') collapseSearch() }}
                                className="text-tertiary bg-transparent outline-none text-[16px] w-full px-4 py-2 rounded-l-full min-w-0 [&::-webkit-search-cancel-button]:hidden"
                            />
                            <div
                                className="flex items-center justify-center px-2 py-2 bg-themewhite2 stroke-themeblue3 rounded-r-full cursor-pointer transition-all duration-300 hover:bg-themewhite shrink-0"
                                onClick={collapseSearch}
                            >
                                <X className="w-5 h-5 stroke-themeblue1" />
                            </div>
                        </div>
                    </animated.div>
                </div>
            ),
        }
    }, [view, handleBack, handleClose, isSearchExpanded, searchQuery, searchSpring, collapseSearch, isDevRole])

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            fullHeight="90dvh"
            header={headerConfig}
            mobileFullScreen={isConversationView}
            desktopPosition="right"
            desktopWidth={isMessagesActive ? 'w-[90%]' : undefined}
        >
            <div className="h-full" {...(view !== 'messages' ? swipeHandlers : {})}>
                <MessagesPanel
                    ref={panelRef}
                    view={view}
                    selectedPeerId={selectedPeerId}
                    selectedGroupId={selectedGroupId}
                    onSelectPeer={handleSelectPeer}
                    onSelectGroup={handleSelectGroup}
                    onBack={handleBack}
                    onCloseDrawer={handleClose}
                    searchQuery={searchQuery}
                    onSearchClear={handleSearchClear}
                />
            </div>
        </BaseDrawer>
    )
}
