import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { ChevronLeft, Plus, X, Play, Headset, Info, Settings, MessageSquare } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { BottomIsland, IslandButton } from './BottomIsland'
import { HeaderPill, PillButton } from './HeaderPill'
import { PreviewOverlay } from './PreviewOverlay'
import { VoicemailGreetingSection } from './Settings/VoicemailGreetingSection'
import { MessagingOncallSettings } from './Settings/MessagingOncallSettings'
import { MessagesPanel, type MessagesView, type MessagesPanelHandle, type MessagingLens } from './Settings/MessagesPanel'
import { useMessagesContext } from '../Hooks/MessagesContext'
import { useAuth } from '../Hooks/useAuth'
import { useUserProfile } from '../Hooks/useUserProfile'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useCallActions } from '../Hooks/CallContext'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useTourContext } from './Tour/TourProvider'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'
import type { GroupInfo } from '../lib/signal/groupTypes'

interface MessagesDrawerProps {
    isVisible: boolean
    onClose: () => void
    initialPeerId?: string | null
    initialGroupId?: string | null
    initialPeerName?: string | null
    initialMessageId?: string | null
}

export function MessagesDrawer({ isVisible, onClose, initialPeerId, initialGroupId, initialPeerName, initialMessageId }: MessagesDrawerProps) {
    const [view, setView] = useState<MessagesView>('messages')
    const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null)
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
    const [selectedPeerName, setSelectedPeerName] = useState<string | null>(null)
    const [pendingScrollMsgId, setPendingScrollMsgId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [lens, setLens] = useState<MessagingLens>('chat')
    const [showSettings, setShowSettings] = useState(false)
    const openSettings = useCallback(() => setShowSettings(true), [])
    const handleScrollConsumed = useCallback(() => setPendingScrollMsgId(null), [])

    // Clear search when navigating between views (e.g., clicking a search result)
    useEffect(() => { setSearchQuery('') }, [view])

    const messagesCtx = useMessagesContext()
    const activePeerRef = messagesCtx?.activePeerRef ?? null
    const { user } = useAuth()
    const { profile } = useUserProfile()
    const panelRef = useRef<MessagesPanelHandle>(null)
    const isMobile = useIsMobile()
    const tourCtx = useTourContext()
    const isTourActive = tourCtx?.isActive ?? false
    const callActions = useCallActions()
    // Apply deep-link when drawer opens
    useMemo(() => {
        if (!isVisible) return false
        if (initialGroupId) {
            setSelectedGroupId(initialGroupId)
            setSelectedPeerId(null)
            setSelectedPeerName(initialPeerName ?? 'Group')
            setPendingScrollMsgId(initialMessageId ?? null)
            setView('messages-group-chat')
            return true
        }
        if (initialPeerId) {
            setSelectedPeerId(initialPeerId)
            setSelectedGroupId(null)
            setSelectedPeerName(initialPeerName ?? 'Chat')
            setPendingScrollMsgId(initialMessageId ?? null)
            setView('messages-chat')
            return true
        }
        return false
    }, [isVisible, initialPeerId, initialGroupId, initialPeerName, initialMessageId])

    const handleSelectPeer = useCallback((medic: ClinicMedic) => {
        setSelectedPeerId(medic.id)
        setSelectedGroupId(null)
        setPendingScrollMsgId(null)
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
        setPendingScrollMsgId(null)
        setSelectedPeerName(group.name)
        setView('messages-group-chat')
    }, [])

    // ChatDetailView registers a closer here while a thread is open. Back (both
    // the mobile conversation header and the desktop BaseDrawer header route
    // through handleBack) pops the thread first, then leaves the conversation.
    const threadBackRef = useRef<(() => boolean) | null>(null)
    const registerThreadBack = useCallback((closer: (() => boolean) | null) => {
        // eslint-disable-next-line react-hooks/immutability
        threadBackRef.current = closer
    }, [])

    const handleBack = useCallback(() => {
        if (threadBackRef.current?.()) return
        if (view === 'messages-chat' || view === 'messages-group-chat') {
            setView('messages')
            setSelectedPeerId(null)
            setSelectedPeerName(null)
            setSelectedGroupId(null)
            setPendingScrollMsgId(null)
            // eslint-disable-next-line react-hooks/immutability
            if (activePeerRef) activePeerRef.current = null
        }
    }, [view, activePeerRef])

    const handleClose = useCallback(() => {
        setView('messages')
        setSelectedPeerId(null)
        setSelectedPeerName(null)
        setSelectedGroupId(null)
        setPendingScrollMsgId(null)
        // eslint-disable-next-line react-hooks/immutability
        if (activePeerRef) activePeerRef.current = null
        onClose()
    }, [onClose, activePeerRef])

    // Left-edge swipe-back to close messages panel (contacts list view only)
    const contactsSwipeBack = useSwipeBack(view === 'messages' ? handleClose : undefined, isMobile)

    const isConversationView = view === 'messages-chat' || view === 'messages-group-chat'
    const isMessagesActive = view === 'messages' || isConversationView

    // ── Header collapse spring (mirrors NavTop pattern in App.tsx) ─────
    // Collapses when entering a conversation view
    const headerCollapseSpring = useSpring({
        collapse: isConversationView ? 1 : 0,
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
            onOpenSettings={openSettings}
            registerThreadBack={registerThreadBack}
            lens={lens}
            onLensChange={setLens}
            tourVariant={isTourActive ? (isMobile ? 'mobile' : 'desktop') : undefined}
            scrollToMessageId={pendingScrollMsgId}
            onScrollConsumed={handleScrollConsumed}
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
                        <PillButton icon={Play} onClick={() => callActions.startVideoCall({ userId: selectedPeerId, displayName: selectedPeerName ?? 'Unknown' })} label="Video call" compact />
                        <PillButton icon={Headset} onClick={() => callActions.startCall({ userId: selectedPeerId, displayName: selectedPeerName ?? 'Unknown' })} label="Voice call" compact />
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
                    <PillButton icon={Plus} onClick={() => panelRef.current?.openNew()} label="New" />
                    <PillButton icon={X} onClick={handleClose} label="Close" />
                </HeaderPill>
            ),
        }
    }, [view, selectedPeerId, selectedGroupId, selectedPeerName, handleBack, handleClose, callActions])

    // Messaging settings — PreviewOverlay popover on both mobile + desktop
    // (mirrors MapSettingsDrawer, which is overlay-only). Layout matches Calendar
    // Settings: text-tertiary section headers + themewhite2 cards. On-call roster
    // is open to all cluster members; the Outside-contact card self-gates to
    // supervisor/dev inside MessagingOncallSettings.
    const settingsSurface = (
        <PreviewOverlay
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            anchorRect={null}
            title="Messaging settings"
            maxWidth={360}
        >
            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto space-y-6">
                <MessagingOncallSettings />
                <VoicemailGreetingSection />
            </div>
        </PreviewOverlay>
    )

    // Mobile bypasses BaseDrawer: App.tsx owns the horizontal slide-in
    // transition for the conversation pane. BaseDrawer's vertical drawer
    // animation model would fight that animation. Intentional exception.
    // ── Mobile: full-screen content (animation handled by App.tsx) ────────
    if (isMobile) {
        return (
            <div className="h-full relative bg-themewhite3" {...contactsSwipeBack}>
                {/* Floating header — collapses on search focus and when entering a conversation */}
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
                    <div className="shrink-0 px-3 py-3 pt-[max(0.75rem,var(--sat,0px))] flex items-center gap-2 backdrop-blur-[2px] bg-themewhite3/15">
                        <HeaderPill>
                            <PillButton icon={ChevronLeft} onClick={handleClose} label="Back" />
                        </HeaderPill>
                        <h2 className="text-[13pt] font-semibold text-primary flex-1 truncate">Messages</h2>
                        <HeaderPill>
                            <PillButton icon={Plus} onClick={() => panelRef.current?.openNew()} label="New" />
                            <PillButton icon={Settings} onClick={openSettings} label="Settings" />
                        </HeaderPill>
                    </div>
                </animated.div>
                <div className="h-full overflow-hidden">
                    {panelContent}
                </div>
                {/* Bottom-center island: Chat | Calls lens toggle (list view only) */}
                {view === 'messages' && (
                    <BottomIsland role="tablist" ariaLabel="Message view">
                        {([['chat', MessageSquare, 'Chat'], ['calls', Headset, 'Calls']] as const).map(([l, Icon, label]) => (
                            <IslandButton key={l} active={lens === l} onClick={() => setLens(l)} label={label} role="tab">
                                <Icon className="w-5 h-5" />
                            </IslandButton>
                        ))}
                    </BottomIsland>
                )}
                {settingsSurface}
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
        >
            <div className="h-full">
                {panelContent}
            </div>
            {settingsSurface}
        </BaseDrawer>
    )
}
