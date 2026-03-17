import { useState, useCallback, useMemo, useRef } from 'react'
import { ChevronLeft, PenLine, X } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { HeaderPill, PillButton } from './HeaderPill'
import { MessagesPanel, type MessagesView, type MessagesPanelHandle } from './Settings/MessagesPanel'
import { useMessagesContext } from '../Hooks/MessagesContext'
import { useAuth } from '../Hooks/useAuth'
import { useUserProfile } from '../Hooks/useUserProfile'
import { useIsMobile } from '../Hooks/useIsMobile'
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
    const messagesCtx = useMessagesContext()
    const { user } = useAuth()
    const { profile } = useUserProfile()
    const panelRef = useRef<MessagesPanelHandle>(null)
    const isMobile = useIsMobile()

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
        if (view === 'messages-chat' || view === 'messages-group-chat') {
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

    const isConversationView = view === 'messages-chat' || view === 'messages-group-chat'
    const isMessagesActive = view === 'messages' || isConversationView

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
        />
    )

    // ── Mobile: full-screen content (animation handled by App.tsx) ────────
    if (isMobile) {
        const mobileHeader = view === 'messages' ? (
            <div className="shrink-0 px-3 py-2 pt-[max(0.5rem,var(--sat,0px))] flex items-center gap-2 backdrop-blur-xs bg-transparent">
                <HeaderPill>
                    <PillButton icon={ChevronLeft} onClick={handleClose} label="Back" />
                </HeaderPill>
                <h2 className="text-[17px] font-semibold text-primary flex-1 truncate">Messages</h2>
                <HeaderPill>
                    <PillButton icon={PenLine} onClick={() => panelRef.current?.createGroup()} label="New message" />
                    <PillButton icon={X} onClick={handleClose} label="Close" />
                </HeaderPill>
            </div>
        ) : null

        return (
            <div className="h-full relative bg-themewhite3">
                {/* Floating header — overlaps content like NavTop */}
                {mobileHeader && (
                    <div className="absolute top-0 left-0 right-0 z-10">
                        {mobileHeader}
                    </div>
                )}
                <div className="h-full overflow-hidden">
                    {panelContent}
                </div>
            </div>
        )
    }

    // ── Desktop: BaseDrawer overlay ───────────────────────────────────────

    const desktopHeaderConfig = useMemo(() => {
        if (isConversationView) {
            return { title: 'Messages', showBack: true, onBack: handleBack }
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
    }, [isConversationView, handleBack, handleClose])

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
        </BaseDrawer>
    )
}
