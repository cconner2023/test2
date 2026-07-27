import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { ChevronLeft, Plus, X, Play, Headset, Info, Settings, MessageSquare } from 'lucide-react'
import { BaseDrawer } from '@/Components/primitives/BaseDrawer'
import { BottomIsland } from '@/Components/primitives/BottomIsland'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { PreviewOverlay } from './PreviewOverlay'
import { Sheet } from '@/Components/primitives/Sheet'
import { VoicemailGreetingSection } from './Settings/VoicemailGreetingSection'
import { IncomingCallsSection } from './Settings/IncomingCallsSection'
import { MessagingOncallSettings } from './Settings/MessagingOncallSettings'
import { SwipeActionsSection } from './Settings/SwipeActionsSection'
import { MessagesPanel, type MessagesView, type MessagesPanelHandle, type MessagingLens } from './Settings/MessagesPanel'
import { useMessagesContext } from '../Hooks/MessagesContext'
import { useMessagingStore } from '../stores/useMessagingStore'
import { useAuth } from '../Hooks/useAuth'
import { useBetaBypass } from '../lib/betaFeatures'
import { prewarmMessagingSettings } from '../lib/messagingSettingsWarm'
import { useUserProfile } from '../Hooks/useUserProfile'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useCallActions } from '../Hooks/CallContext'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'
import { displayGroupName, type GroupInfo } from '../lib/signal/groupTypes'

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
    const { user, clinicId: assignedClinicId, supervisingClinicId, isSupervisorRole } = useAuth()
    const outsideCallBeta = useBetaBypass('outsideCall')
    const settingsClinicId = supervisingClinicId ?? assignedClinicId
    const { profile } = useUserProfile()

    // Pre-warm the settings popover's reads (outside-contact status, on-call
    // roster, and — for supervisors — the intake credential) the moment the
    // drawer mounts, so the gear opens to a fully-painted card instead of a
    // blank frame while those fetches resolve. See messagingSettingsWarm.ts.
    useEffect(() => {
        if (!isVisible || !settingsClinicId) return
        void prewarmMessagingSettings(settingsClinicId, isSupervisorRole || outsideCallBeta)
    }, [isVisible, settingsClinicId, isSupervisorRole, outsideCallBeta])
    // Outbound outside-contact (email) channels are not callable — the peer id is a
    // synthetic entity, not a device owner — so the desktop header drops the call
    // pills. Read off the peer profile (not the selection handler) so a deep link
    // into one of these conversations is judged the same way.
    const selectedPeerIsOutside = useMessagingStore(
        s => !!(selectedPeerId && s.peerProfiles[selectedPeerId]?.outsideFromLabel),
    )
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
        // Outbound outside-contact channels title the conversation with the cluster
        // name (what the recipient sees as the sender); the list row stays the email.
        const name = medic.outsideFromLabel
            ? medic.outsideFromLabel
            : isSelf
            ? [profile.rank, profile.lastName].filter(Boolean).join(' ') || profile.firstName || 'Notes'
            : [medic.rank, medic.lastName].filter(Boolean).join(' ') || medic.firstName || 'Chat'
        setSelectedPeerName(name)
        setView('messages-chat')
    }, [user?.id, profile.rank, profile.lastName, profile.firstName])

    const handleSelectGroup = useCallback((group: GroupInfo) => {
        setSelectedGroupId(group.groupId)
        setSelectedPeerId(null)
        setPendingScrollMsgId(null)
        setSelectedPeerName(displayGroupName(group.name))
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
                rightContent: selectedPeerIsOutside ? (
                    <HeaderPill>
                        <PillButton icon={Info} onClick={() => panelRef.current?.showOutsideInfo()} label="Conversation info" compact />
                    </HeaderPill>
                ) : callActions ? (
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
    }, [view, selectedPeerId, selectedGroupId, selectedPeerName, selectedPeerIsOutside, handleBack, handleClose, callActions])

    // Messaging settings — mobile Sheet + desktop PreviewOverlay, both share
    // content (mirrors the map-settings standard for mobile settings icons:
    // settings icon → bottom Sheet on mobile, popover on desktop). Layout matches
    // Calendar Settings: text-tertiary section headers + themewhite2 cards.
    // On-call roster is open to all cluster members; the Outside-contact card
    // self-gates to supervisor/dev inside MessagingOncallSettings.
    const settingsContent = (
        <div className="px-5 py-4 space-y-6">
            <MessagingOncallSettings />
            <SwipeActionsSection />
            <IncomingCallsSection />
            <VoicemailGreetingSection />
        </div>
    )
    const settingsSurface = isMobile ? (
        <Sheet
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            title="Messaging settings"
            height="fit"
            maxHeight={60}
            zIndex={1200}
        >
            {settingsContent}
        </Sheet>
    ) : (
        <PreviewOverlay
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            anchorRect={null}
            title="Messaging settings"
            maxWidth={360}
            previewMaxHeight="70dvh"
        >
            {settingsContent}
        </PreviewOverlay>
    )

    // Mobile bypasses BaseDrawer: App.tsx owns the horizontal slide-in
    // transition for the conversation pane. BaseDrawer's vertical drawer
    // animation model would fight that animation. Intentional exception.
    // ── Mobile: full-screen content (animation handled by App.tsx) ────────
    if (isMobile) {
        return (
            <div className="h-full relative bg-themewhite" {...contactsSwipeBack}>
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
                    <div className="shrink-0 px-3 py-3 pt-[max(0.75rem,var(--sat,0px))] flex items-center gap-2 backdrop-blur-[2px] bg-themewhite/15">
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
                    <BottomIsland
                        ariaLabel="Message view"
                        glass
                        activeId={lens}
                        onSelect={(id) => setLens(id as typeof lens)}
                        stops={[
                            { id: 'chat', title: 'Chat', icon: <MessageSquare className="w-5 h-5" /> },
                            { id: 'calls', title: 'Calls', icon: <Headset className="w-5 h-5" /> },
                        ]}
                    />
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
