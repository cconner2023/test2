import { useState, useCallback, useMemo } from 'react'
import { PenLine, Users, X } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { MessagesPanel, type MessagesView } from './Settings/MessagesPanel'
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
    const messagesCtx = useMessagesContext()
    const { user } = useAuth()
    const { profile } = useUserProfile()

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
        if (view === 'messages-chat' || view === 'messages-group-chat' || view === 'messages-contacts') {
            setView('messages')
            setSelectedPeerId(null)
            setSelectedPeerName(null)
            setSelectedGroupId(null)
            if (messagesCtx) messagesCtx.activePeerRef.current = null
        }
    }, [view, messagesCtx])

    const handleShowContacts = useCallback(() => {
        setView('messages-contacts')
    }, [])

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

    const isConversationView = view === 'messages-chat' || view === 'messages-group-chat' || view === 'messages-contacts'
    const isMessagesActive = view === 'messages' || isConversationView

    const headerConfig = useMemo(() => {
        if (view === 'messages-chat' || view === 'messages-group-chat') {
            return { title: 'Messages', showBack: true, onBack: handleBack }
        }
        return {
            title: 'Messages',
            hideDefaultClose: true,
            rightContent: (
                <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5">
                    <button
                        onClick={handleShowContacts}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                        aria-label="New message"
                        title="New message"
                    >
                        <PenLine className="w-[18px] h-[18px]" />
                    </button>
                    <div className="w-px h-5 bg-tertiary/15" />
                    <button
                        onClick={handleShowContacts}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                        aria-label="New group"
                        title="New group"
                    >
                        <Users className="w-[18px] h-[18px]" />
                    </button>
                    <div className="w-px h-5 bg-tertiary/15" />
                    <button
                        onClick={handleClose}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                        aria-label="Close"
                        title="Close"
                    >
                        <X className="w-[18px] h-[18px]" />
                    </button>
                </div>
            ),
        }
    }, [view, handleBack, handleShowContacts, handleClose])

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
                    view={view}
                    selectedPeerId={selectedPeerId}
                    selectedGroupId={selectedGroupId}
                    onSelectPeer={handleSelectPeer}
                    onSelectGroup={handleSelectGroup}
                    onBack={handleBack}
                    onCloseDrawer={handleClose}
                />
            </div>
        </BaseDrawer>
    )
}
