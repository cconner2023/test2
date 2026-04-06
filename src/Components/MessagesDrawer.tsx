import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { ChevronLeft, PenLine, X, Video, Phone, Info } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { HeaderPill, PillButton } from './HeaderPill'
import { MessagesPanel, type MessagesView, type MessagesPanelHandle } from './Settings/MessagesPanel'
import { useMessagesContext } from '../Hooks/MessagesContext'
import { useAuth } from '../Hooks/useAuth'
import { useUserProfile } from '../Hooks/useUserProfile'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useCallActions } from '../Hooks/CallContext'
import { useSwipeBack } from '../Hooks/useSwipeBack'
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
    const [searchFocused, setSearchFocused] = useState(false)

    // Clear search when navigating between views (e.g., clicking a search result)
    useEffect(() => { setSearchQuery(''); setSearchFocused(false) }, [view])

    const messagesCtx = useMessagesContext()
    const activePeerRef = messagesCtx?.activePeerRef ?? null
    const { user } = useAuth()
    const { profile } = useUserProfile()
    const panelRef = useRef<MessagesPanelHandle>(null)
    const isMobile = useIsMobile()
    const callActions = useCallActions()
    // Apply deep-link when drawer opens
    useMemo(() => {
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
        if (view === 'messages-chat' || view === 'messages-group-chat') {
            setView('messages')
            setSelectedPeerId(null)
            setSelectedPeerName(null)
            setSelectedGroupId(null)
            // eslint-disable-next-line react-hooks/immutability
            if (activePeerRef) activePeerRef.current = null
        }
    }, [view, activePeerRef])

    const handleClose = useCallback(() => {
        setView('messages')
        setSelectedPeerId(null)
        setSelectedPeerName(null)
        setSelectedGroupId(null)
        // eslint-disable-next-line react-hooks/immutability
        if (activePeerRef) activePeerRef.current = null
        onClose()
    }, [onClose, activePeerRef])

    // Left-edge swipe-back to close messages panel (contacts list view only)
    const contactsSwipeBack = useSwipeBack(view === 'messages' ? handleClose : undefined, isMobile)

    const isConversationView = view === 'messages-chat' || view === 'messages-group-chat'
    const isMessagesActive = view === 'messages' || isConversationView

    // ── Header collapse spring (mirrors NavTop pattern in App.tsx) ─────
    const headerCollapseSpring = useSpring({
        collapse: searchFocused && view === 'messages' ? 1 : 0,
        config: { tension: 280, friction: 28 },
    })

    // ── Shared panel content ──────────────────────────────────────────────
    const panelContent = (
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
            onSearchClear={() => setSearchQuery('')}
            onSearchChange={setSearchQuery}
            onSearchFocusChange={setSearchFocused}
            headerCollapse={headerCollapseSpring.collapse}
        />
    )

    // ── Desktop header config (must be before any conditional returns) ──────
    const desktopHeaderConfig = useMemo(() => {
        if (view === 'messages-chat' && selectedPeerId) {
            return {
                title: selectedPeerName ?? 'Chat',
                showBack: true,
                onBack: handleBack,
                rightContent: callActions ? (
                    <HeaderPill>
                        <PillButton icon={Video} onClick={() => callActions.startVideoCall({ userId: selectedPeerId, displayName: selectedPeerName ?? 'Unknown' })} label="Video call" compact />
                        <PillButton icon={Phone} onClick={() => callActions.startCall({ userId: selectedPeerId, displayName: selectedPeerName ?? 'Unknown' })} label="Voice call" compact />
                    </HeaderPill>
                ) : undefined,
            }
        }
        if (view === 'messages-group-chat' && selectedGroupId) {
            return {
                title: selectedPeerName ?? 'Group',
                showBack: true,
                onBack: handleBack,
                rightContent: (
                    <HeaderPill>
                        <PillButton icon={Info} onClick={() => panelRef.current?.showGroupInfo()} label="Group info" compact />
                    </HeaderPill>
                ),
            }
        }
        return {
            title: 'Messages',
            hideDefaultClose: true,
            rightContent: (
                <HeaderPill>
                    <PillButton icon={PenLine} onClick={() => panelRef.current?.createGroup()} label="New message" />
                    <PillButton icon={X} onClick={handleClose} label="Close" />
                </HeaderPill>
            ),
        }
    }, [view, selectedPeerId, selectedGroupId, selectedPeerName, handleBack, handleClose, callActions])

    // ── Mobile: full-screen content (animation handled by App.tsx) ────────
    if (isMobile) {
        const mobileHeader = view === 'messages' ? (
            <div className="shrink-0 px-3 py-3 pt-[max(0.75rem,var(--sat,0px))] flex items-center gap-2 backdrop-blur-xs bg-themewhite3/80">
                <HeaderPill>
                    <PillButton icon={ChevronLeft} onClick={handleClose} label="Back" />
                </HeaderPill>
                <h2 className="text-[17px] font-semibold text-primary flex-1 truncate">Messages</h2>
                <HeaderPill>
                    <PillButton icon={PenLine} onClick={() => panelRef.current?.createGroup()} label="New message" />
                </HeaderPill>
            </div>
        ) : null

        return (
            <div className="h-full relative bg-themewhite3" {...contactsSwipeBack}>
                {/* Floating header — collapses on search focus like NavTop */}
                {mobileHeader && (
                    <animated.div
                        className="absolute top-0 left-0 right-0 z-10 overflow-hidden"
                        style={{
                            height: headerCollapseSpring.collapse.to(
                                (c: number) => `calc((var(--sat, 0px) + 4.375rem) * ${1 - c})`
                            ),
                            opacity: headerCollapseSpring.collapse.to((c: number) => 1 - c),
                            transform: headerCollapseSpring.collapse.to(
                                (c: number) => `scale(${1 - c * 0.03})`
                            ),
                        }}
                    >
                        {mobileHeader}
                    </animated.div>
                )}
                <div className="h-full overflow-hidden">
                    {panelContent}
                </div>
            </div>
        )
    }

    // ── Desktop: BaseDrawer overlay ───────────────────────────────────────

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            fullHeight="90dvh"
            header={desktopHeaderConfig}
            mobileFullScreen={isConversationView}
            desktopPosition="right"
            desktopWidth={isMessagesActive ? 'w-[90%]' : undefined}
            headerFaded={searchFocused}
        >
            <div className="h-full">
                {panelContent}
            </div>
        </BaseDrawer>
    )
}
