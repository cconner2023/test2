import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react'
import { X, Inbox, ChevronLeft, MessageCircleQuestion, Network } from 'lucide-react'
import { BaseDrawer, ScrollPane } from '@/Components/primitives/BaseDrawer'
import { BottomIsland } from '@/Components/primitives/BottomIsland'
import { AddFab } from '@/Components/primitives/AddFab'
import { SlideRevealPane } from '@/Components/primitives/SlideRevealPane'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { DetailHeaderActions } from './Admin/DetailHeaderActions'
import { useDetailEditState } from '../Hooks/useDetailEditState'
import { ContentWrapper } from '@/Components/primitives/ContentWrapper'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { ActionSheet } from '@/Components/primitives/ActionSheet'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useEscBackout } from '../Hooks/useEscBackout'
import { usePageVisibility } from '../Hooks/usePageVisibility'
import { UI_TIMING } from '../Utilities/constants'
import { deleteClinic, deleteUser, listClinics, listLocations } from '../lib/adminService'
import { useAuthStore } from '../stores/useAuthStore'
import { invalidate } from '../stores/useInvalidationStore'
import { drainSystemInbox } from '../lib/signal/systemIdentity'
import { createLogger } from '../Utilities/Logger'

const systemInboxLogger = createLogger('AdminSystemInbox')

// Admin sub-components
import { AdminUserDetail } from './Admin/AdminUserDetail'
import { AdminClinicDetail, type ClusterCreatePrefill } from './Admin/AdminClinicDetail'
import { AdminLocationDetail } from './Admin/AdminLocationDetail'
import { AdminSummary } from './Admin/AdminSummary'
import { AdminSortRail } from './Admin/AdminSortRail'
import { AdminMobileSheet } from './Admin/AdminMobileSheet'
import { AdminFeatureVotesSection } from './Admin/AdminFeatureVotesSection'
import { AdminSettingsContent } from './Admin/AdminSettingsContent'
import { AdminSystemConversationView } from './Admin/AdminSystemConversationView'
import { RequestDetail } from './Admin/RequestDetail'
import { FeedbackDetail } from './Admin/FeedbackDetail'
import { SuggestionDetail } from './Admin/SuggestionDetail'
import { useMessagingStore } from '../stores/useMessagingStore'
import { getDisplayName } from '../Utilities/nameUtils'
import type { AdminUser, AdminClinic, AdminLocation } from '../lib/adminService'
import type { AccountRequest } from '../lib/accountRequestService'
import type { FeedbackRow } from '../lib/feedbackService'
import type { FeatureVoteSuggestion } from '../lib/featureVotingService'

export type AdminView =
    | 'admin'
    | 'admin-user-detail'
    | 'admin-clinic-detail'
    | 'admin-location-detail'
    | 'admin-settings'
    | 'admin-system-conversation'
    | 'admin-request-detail'
    | 'admin-feedback-detail'
    | 'admin-suggestion-detail'

// Island: directory · votes. The Directory tab IS the main content list — an
// org-rooted cluster ⊃ sub-cluster ⊃ user tree (AdminSummary) with location
// shown as a per-cluster chip (locations themselves are managed in the Settings
// sheet). Tap a node to open its detail. Requests/feedback/messages moved to rail
// (AdminSortRail), so the island narrows to two: Directory + the feature-vote
// cycle manager. On desktop the left pane is the rail (settings + triage
// queues), PINNED so triage survives opening an item; the right pane is detail.
// On mobile the tree is full-screen and the rail lives in a nav sheet.
// 'feature-votes' keeps its slug (Settings deep-links to it) but reads as
// "Votes". Whole drawer is dev-gated, so every tab is always visible.
const ALL_TABS = ['directory', 'feature-votes'] as const
type AdminTab = typeof ALL_TABS[number]

const TAB_ICONS: Record<AdminTab, typeof Inbox> = {
    directory: Network,
    'feature-votes': MessageCircleQuestion,
}

const TAB_LABELS: Record<AdminTab, string> = {
    directory: 'Directory',
    'feature-votes': 'Votes',
}

interface AdminDrawerProps {
    isVisible: boolean
    onClose: () => void
}

export function AdminDrawer({ isVisible, onClose }: AdminDrawerProps) {
    const [view, setView] = useState<AdminView>('admin')
    const [activeTab, setActiveTab] = useState<AdminTab>('directory')
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')

    // Selected entity for detail views (null = create mode)
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
    const [selectedClinic, setSelectedClinic] = useState<AdminClinic | null>(null)
    const [selectedLocation, setSelectedLocation] = useState<AdminLocation | null>(null)
    // Triage detail selection — request / feedback / suggestion opened from the
    // inbox rail. Each rides the same responsive detail pane / Sheet as the
    // entity details. The active detail publishes its header actions (primary
    // commit + ellipsis extras) via onHeaderActions → feedHeaderActions.
    const [selectedRequest, setSelectedRequest] = useState<AccountRequest | null>(null)
    const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRow | null>(null)
    const [selectedSuggestion, setSelectedSuggestion] = useState<FeatureVoteSuggestion | null>(null)
    const [feedHeaderActions, setFeedHeaderActions] = useState<ReactNode>(null)
    // Active system-conversation peer when view === 'admin-system-conversation'.
    const [selectedSystemPeerId, setSelectedSystemPeerId] = useState<string | null>(null)
    const systemPeerProfile = useMessagingStore(s =>
        selectedSystemPeerId ? s.peerProfiles[selectedSystemPeerId] ?? null : null,
    )
    // Cluster create-mode prefill — set when create is launched from another
    // cluster's relationship picker so the new cluster lands already linked.
    const [clusterCreatePrefill, setClusterCreatePrefill] = useState<ClusterCreatePrefill | null>(null)
    // User create-mode prefill — when create is launched from a cluster's
    // Assigned Users FAB, the new user lands assigned to that cluster.
    const [userCreatePrefillClinicId, setUserCreatePrefillClinicId] = useState<string | null>(null)

    // Where the open detail was launched from. The shell used to infer this from
    // the view TYPE ("a request detail must have come from the inbox"), which
    // meant every new detail kind needed its own back path. Recording the origin
    // at open time collapses all of them into one back.
    const [detailOrigin, setDetailOrigin] = useState<'inbox' | 'directory'>('directory')

    // Lateral nav trail: entities the user hopped *from* via in-detail links
    // (CPT Conner → his cluster → sister cluster). Cleared whenever navigation
    // originates from a list/summary, so the crumb never claims a hierarchy
    // that wasn't actually traversed. Cap depth so it doesn't grow unbounded.
    type TrailEntry =
        | { kind: 'user'; user: AdminUser; label: string }
        | { kind: 'clinic'; clinic: AdminClinic; label: string }
    const TRAIL_MAX = 3
    const [trail, setTrail] = useState<TrailEntry[]>([])
    const clearTrail = useCallback(() => setTrail([]), [])

    // User & clinic detail edit/delete state — symmetric, see useDetailEditState
    const userEdit = useDetailEditState()
    const clinicEdit = useDetailEditState()
    const locationEdit = useDetailEditState()

    // Search state — one query per surface, NOT one shared query. The inbox and
    // the directory are visible at the same time on desktop, so a single query
    // meant typing a name into one silently filtered the other behind it.
    const [inboxQuery, setInboxQuery] = useState('')
    const [directoryQuery, setDirectoryQuery] = useState('')

    // FAB action sheet
    const [showAddSheet, setShowAddSheet] = useState(false)

    // Mobile nav sheet — the slide-out mirror of the desktop left pane (search +
    // triage queues). Summoned from any tab via the header rail button.
    const [showNavSheet, setShowNavSheet] = useState(false)

    // Discard pending changes confirmation. The pending action is held in a
    // ref so any nav path (back, tab switch, drawer close, summary jump) can
    // route through the same dialog without each duplicating the guard logic.
    const [confirmDiscard, setConfirmDiscard] = useState(false)
    const pendingActionRef = useRef<(() => void) | null>(null)

    const isMobile = useIsMobile()
    const isPageVisible = usePageVisibility()
    const currentUserId = useAuthStore(s => s.user?.id ?? null)
    const isDevRole = useAuthStore(s => s.isDevRole)

    // Dev-only system-inbox drain. Scoped to the admin surface — fires when
    // the drawer is open and the tab is visible, so user → SYSTEM replies
    // surface in the per-user/per-clinic threads without polling the rest
    // of the app. Sign-in already kicks an initial drain (useAuthStore).
    useEffect(() => {
        if (!isVisible || !isDevRole || !isPageVisible) return
        drainSystemInbox().catch(e =>
            systemInboxLogger.warn('admin drawer drain failed:', e instanceof Error ? e.message : e)
        )
    }, [isVisible, isDevRole, isPageVisible])
    // Whole drawer is dev-gated upstream, so every tab is always shown.
    const visibleTabs = useMemo<AdminTab[]>(() => [...ALL_TABS], [])

    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        // Desktop is split-pane, not sliding — skip the animation state churn.
        if (!isMobile) return
        setSlideDirection(direction)
        setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION)
    }, [isMobile])

    // Internal entity-swap helpers. Do NOT touch trail — callers decide whether
    // the navigation is top-level (clear) or lateral (push).
    const enterUserDetail = useCallback((user: AdminUser | null, editing: boolean, prefillClinicId: string | null = null) => {
        setSelectedUser(user)
        setUserCreatePrefillClinicId(user === null ? prefillClinicId : null)
        setFeedHeaderActions(null)
        userEdit.setEditing(editing)
        userEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-user-detail')
    }, [handleSlideAnimation, userEdit])

    const enterClinicDetail = useCallback((clinic: AdminClinic | null, editing: boolean, prefill: ClusterCreatePrefill | null = null) => {
        setSelectedClinic(clinic)
        setClusterCreatePrefill(clinic === null ? prefill : null)
        setFeedHeaderActions(null)
        clinicEdit.setEditing(editing)
        clinicEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-clinic-detail')
    }, [handleSlideAnimation, clinicEdit])

    // Top-level entries from the Directory tree — clear any prior lateral trail
    // since the user jumped in from outside the chain, and mark the origin so
    // back returns to the tree.
    const handleSelectUser = useCallback((user: AdminUser) => {
        clearTrail()
        setDetailOrigin('directory')
        enterUserDetail(user, false)
    }, [enterUserDetail, clearTrail])

    const handleEditUser = useCallback((user: AdminUser) => {
        clearTrail()
        setDetailOrigin('directory')
        enterUserDetail(user, true)
    }, [enterUserDetail, clearTrail])

    const handleCreateUser = useCallback(() => {
        clearTrail()
        setDetailOrigin('directory')
        enterUserDetail(null, true)
    }, [enterUserDetail, clearTrail])

    const handleSelectClinic = useCallback((clinic: AdminClinic) => {
        clearTrail()
        setDetailOrigin('directory')
        enterClinicDetail(clinic, false)
    }, [enterClinicDetail, clearTrail])

    // Lateral hops from inside a detail view (clinic row inside a user card,
    // member row inside a clinic card, sister cluster row, etc.). Push the
    // current detail entity onto the trail so the breadcrumb can walk back.
    const userLabel = (u: AdminUser) =>
        `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'User'
    const handleSelectClinicFromDetail = useCallback((clinic: AdminClinic) => {
        setTrail(prev => {
            let next = prev
            if (view === 'admin-user-detail' && selectedUser) {
                next = [...prev, { kind: 'user', user: selectedUser, label: userLabel(selectedUser) }]
            } else if (view === 'admin-clinic-detail' && selectedClinic && selectedClinic.id !== clinic.id) {
                next = [...prev, { kind: 'clinic', clinic: selectedClinic, label: selectedClinic.name || 'Cluster' }]
            }
            return next.slice(-TRAIL_MAX)
        })
        enterClinicDetail(clinic, false)
    }, [view, selectedUser, selectedClinic, enterClinicDetail])

    const handleSelectUserFromDetail = useCallback((user: AdminUser) => {
        setTrail(prev => {
            let next = prev
            if (view === 'admin-clinic-detail' && selectedClinic) {
                next = [...prev, { kind: 'clinic', clinic: selectedClinic, label: selectedClinic.name || 'Cluster' }]
            } else if (view === 'admin-user-detail' && selectedUser && selectedUser.id !== user.id) {
                next = [...prev, { kind: 'user', user: selectedUser, label: userLabel(selectedUser) }]
            }
            return next.slice(-TRAIL_MAX)
        })
        enterUserDetail(user, false)
    }, [view, selectedClinic, selectedUser, enterUserDetail])

    const handleRequestApproved = useCallback((
        userId: string,
        request: AccountRequest,
        configured: { roles: string[]; clinicId: string | null; warnings: string[] },
    ) => {
        const newUser: AdminUser = {
            id: userId,
            email: request.email,
            first_name: request.first_name,
            last_name: request.last_name,
            middle_initial: request.middle_initial ?? null,
            credential: request.credential ?? null,
            component: request.component ?? null,
            rank: request.rank ?? null,
            uic: request.uic ?? null,
            roles: configured.roles,
            clinic_id: configured.clinicId,
            clinic_name: null,
            sub_cluster_id: null,
            surrogate_clinic_id: null,
            surrogate_clinic_name: null,
            created_at: new Date().toISOString(),
            last_active_at: null,
            avatar_id: null,
            supervisor_created: false,
        }
        // Partial-failure recovery: if any post-approval step failed, open the
        // user in edit mode so admin can finish configuring the account.
        // Deliberately NOT via handleSelectUser/handleEditUser: those re-origin
        // to 'directory', and approval is a triage step — backing out of the new
        // user should land back in the queue for the next request.
        clearTrail()
        enterUserDetail(newUser, configured.warnings.length > 0)
        invalidate('requests', 'users')
    }, [clearTrail, enterUserDetail])

    const handleEditClinic = useCallback((clinic: AdminClinic) => {
        clearTrail()
        setDetailOrigin('directory')
        enterClinicDetail(clinic, true)
    }, [enterClinicDetail, clearTrail])

    const handleCreateClinic = useCallback(() => {
        clearTrail()
        setDetailOrigin('directory')
        enterClinicDetail(null, true)
    }, [enterClinicDetail, clearTrail])

    // Lateral create — launched from a relationship picker inside another
    // cluster's detail. Push the current cluster onto the trail so the new
    // cluster's breadcrumb walks back to it, then open create mode with the
    // prefill so the new cluster lands already-linked on save.
    const handleCreateRelatedCluster = useCallback((prefill: ClusterCreatePrefill) => {
        setTrail(prev => {
            if (view === 'admin-clinic-detail' && selectedClinic) {
                return [...prev, { kind: 'clinic', clinic: selectedClinic, label: selectedClinic.name || 'Cluster' }].slice(-TRAIL_MAX)
            }
            return prev
        })
        enterClinicDetail(null, true, prefill)
    }, [enterClinicDetail, view, selectedClinic])

    // Lateral create — launched from a cluster's Assigned Users FAB. Pushes
    // the originating cluster onto the trail so the new user's breadcrumb
    // walks back, then opens user create mode with clinic_id prefilled.
    const handleCreateUserInCluster = useCallback((clinicId: string) => {
        setTrail(prev => {
            if (view === 'admin-clinic-detail' && selectedClinic && selectedClinic.id === clinicId) {
                return [...prev, { kind: 'clinic', clinic: selectedClinic, label: selectedClinic.name || 'Cluster' }].slice(-TRAIL_MAX)
            }
            return prev
        })
        enterUserDetail(null, true, clinicId)
    }, [enterUserDetail, view, selectedClinic])

    // Lateral open — from a cluster's UIC-matched pending-requests list. Opens
    // the account request in the approve flow, pushing the originating cluster
    // onto the trail so approving (or backing out) returns to it. Mirrors
    // handleOpenRequest but preserves the trail instead of clearing it.
    const handleOpenRequestFromCluster = useCallback((request: AccountRequest) => {
        setTrail(prev => {
            if (view === 'admin-clinic-detail' && selectedClinic) {
                return [...prev, { kind: 'clinic', clinic: selectedClinic, label: selectedClinic.name || 'Cluster' }].slice(-TRAIL_MAX)
            }
            return prev
        })
        setSelectedRequest(request)
        setSelectedFeedback(null)
        setSelectedSuggestion(null)
        setSelectedUser(null)
        setSelectedClinic(null)
        setSelectedLocation(null)
        setSelectedSystemPeerId(null)
        setFeedHeaderActions(null)
        handleSlideAnimation('left')
        setView('admin-request-detail')
    }, [view, selectedClinic, handleSlideAnimation])

    const handleSelectSystemPeer = useCallback((peerId: string) => {
        clearTrail()
        setDetailOrigin('inbox')
        setSelectedSystemPeerId(peerId)
        handleSlideAnimation('left')
        setView('admin-system-conversation')
    }, [clearTrail, handleSlideAnimation])

    // Locations are reached through the inbox rail's Settings row, so backing
    // out of one returns to the inbox, not the tree.
    const handleSelectLocation = useCallback((loc: AdminLocation) => {
        clearTrail()
        setDetailOrigin('inbox')
        setSelectedLocation(loc)
        locationEdit.setEditing(false)
        locationEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-location-detail')
    }, [handleSlideAnimation, locationEdit, clearTrail])

    const handleCreateLocation = useCallback(() => {
        clearTrail()
        setDetailOrigin('inbox')
        setSelectedLocation(null)
        locationEdit.setEditing(true)
        locationEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-location-detail')
    }, [handleSlideAnimation, locationEdit, clearTrail])

    // Triage detail opens — request / feedback / suggestion from the inbox rail.
    // Top-level entries (clear the lateral trail), riding the responsive detail
    // pane / Sheet. Each detail publishes its own header actions on mount.
    const openFeedDetail = useCallback((v: AdminView) => {
        clearTrail()
        setDetailOrigin('inbox')
        setSelectedUser(null)
        setSelectedClinic(null)
        setSelectedLocation(null)
        setSelectedSystemPeerId(null)
        setFeedHeaderActions(null)
        handleSlideAnimation('left')
        setView(v)
    }, [clearTrail, handleSlideAnimation])

    const handleOpenRequest = useCallback((request: AccountRequest) => {
        setSelectedRequest(request)
        setSelectedFeedback(null)
        setSelectedSuggestion(null)
        openFeedDetail('admin-request-detail')
    }, [openFeedDetail])

    const handleOpenFeedback = useCallback((feedback: FeedbackRow) => {
        setSelectedFeedback(feedback)
        setSelectedRequest(null)
        setSelectedSuggestion(null)
        openFeedDetail('admin-feedback-detail')
    }, [openFeedDetail])

    const handleOpenSuggestion = useCallback((suggestion: FeatureVoteSuggestion) => {
        setSelectedSuggestion(suggestion)
        setSelectedRequest(null)
        setSelectedFeedback(null)
        openFeedDetail('admin-suggestion-detail')
    }, [openFeedDetail])

    const navigateBack = useCallback(() => {
        clinicEdit.reset()
        userEdit.reset()
        locationEdit.reset()
        if (view !== 'admin') {
            handleSlideAnimation('right')
            setView('admin')
            setSelectedUser(null)
            setSelectedClinic(null)
            setSelectedLocation(null)
            setSelectedSystemPeerId(null)
            setSelectedRequest(null)
            setSelectedFeedback(null)
            setSelectedSuggestion(null)
            setFeedHeaderActions(null)
            setClusterCreatePrefill(null)
            setUserCreatePrefillClinicId(null)
            clearTrail()
        }
    }, [view, handleSlideAnimation, clinicEdit, userEdit, locationEdit, clearTrail])

    const hasPendingEdits = userEdit.hasPending || clinicEdit.hasPending || locationEdit.hasPending

    /**
     * Run `action` immediately, or — if the user has unsaved edits — defer it
     * behind the discard confirmation. Confirming runs the action; cancelling
     * clears it. Use for any nav path that would destroy detail-pane state.
     */
    const guardNav = useCallback((action: () => void) => {
        if (hasPendingEdits) {
            pendingActionRef.current = action
            setConfirmDiscard(true)
            return
        }
        action()
    }, [hasPendingEdits])

    // The ONE back path. Where it lands is decided by where the detail was
    // opened from, not by what kind of detail it is. On desktop this is always
    // just navigateBack — the rail is pinned, so an inbox-origin detail already
    // has its queue on screen; only mobile has to re-summon the nav sheet.
    const handleBack = useCallback(() => {
        guardNav(() => {
            navigateBack()
            if (isMobile && detailOrigin === 'inbox') setShowNavSheet(true)
        })
    }, [guardNav, navigateBack, isMobile, detailOrigin])

    // Open the settings surface (locations management) — a detail view, so it
    // rides the responsive detail pane (desktop) / sheet (mobile) like the
    // entity details. Guarded so an in-progress edit isn't silently dropped.
    const handleOpenSettings = useCallback(() => {
        guardNav(() => {
            clearTrail()
            setDetailOrigin('inbox')
            setSelectedUser(null)
            setSelectedClinic(null)
            setSelectedLocation(null)
            setSelectedSystemPeerId(null)
            handleSlideAnimation('left')
            setView('admin-settings')
        })
    }, [guardNav, clearTrail, handleSlideAnimation])

    const handleDiscardConfirmed = useCallback(() => {
        setConfirmDiscard(false)
        const action = pendingActionRef.current ?? navigateBack
        pendingActionRef.current = null
        action()
    }, [navigateBack])

    const handleDiscardCancelled = useCallback(() => {
        setConfirmDiscard(false)
        pendingActionRef.current = null
    }, [])

    const doClose = useCallback(() => {
        setView('admin')
        setActiveTab('directory')
        setSelectedUser(null)
        setSelectedClinic(null)
        setSelectedLocation(null)
        setSelectedSystemPeerId(null)
        setSelectedRequest(null)
        setSelectedFeedback(null)
        setSelectedSuggestion(null)
        setFeedHeaderActions(null)
        setClusterCreatePrefill(null)
        setUserCreatePrefillClinicId(null)
        setSlideDirection('')
        setInboxQuery('')
        setDirectoryQuery('')
        setShowNavSheet(false)
        clearTrail()
        clinicEdit.reset()
        userEdit.reset()
        locationEdit.reset()
        onClose()
    }, [onClose, clinicEdit, userEdit, locationEdit, clearTrail])

    const handleClose = useCallback(() => {
        guardNav(doClose)
    }, [guardNav, doClose])

    const handleDeleteClinic = useCallback(async () => {
        if (!selectedClinic) return
        const success = await clinicEdit.performDelete(() => deleteClinic(selectedClinic.id))
        if (success) {
            invalidate('clinics', 'users')
            navigateBack()
        }
    }, [selectedClinic, navigateBack, clinicEdit])

    const handleDeleteUser = useCallback(async () => {
        if (!selectedUser) return
        const success = await userEdit.performDelete(() => deleteUser(selectedUser.id))
        if (success) {
            invalidate('users', 'clinics', 'requests')
            navigateBack()
        }
    }, [selectedUser, navigateBack, userEdit])

    // Swipe back for mobile
    const swipeHandlers = useSwipeBack(
        useMemo(() => {
            if (view === 'admin') return undefined
            return handleBack
        }, [view, handleBack]),
        view !== 'admin',
    )

    // Leaving the Directory tab drops its query; the inbox query is independent
    // of the tab and survives.
    const handleTabChange = useCallback((tab: AdminTab) => {
        setActiveTab(tab)
        setDirectoryQuery('')
    }, [])

    // Header actions for the main list header — the drawer-wide Close. Always
    // present: on mobile the detail views now overlay the list via a Sheet, so
    // the underlying header stays the list header (Close), not a detail header.
    const mainHeaderActions = useMemo(() => (
        <HeaderPill>
            <PillButton icon={X} onClick={handleClose} label="Close" />
        </HeaderPill>
    ), [handleClose])

    // Mobile header rail — opens the nav sheet (the inbox) from any tab. The
    // desktop equivalent is the pinned left pane.
    const navRailButton = useMemo(() => (
        <HeaderPill>
            <PillButton icon={Network} onClick={() => setShowNavSheet(true)} label="Open inbox" />
        </HeaderPill>
    ), [])

    // Back affordance for the mobile detail Sheet. Needed only when the detail
    // publishes its own header actions, which hides the Sheet's Close and would
    // otherwise leave no visible return path.
    const sheetBackButton = useMemo(() => (
        <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center hover:bg-tertiary/10 text-tertiary active:scale-95 shrink-0"
        >
            <ChevronLeft size={18} />
        </button>
    ), [handleBack])

    const isUserCreateMode = view === 'admin-user-detail' && selectedUser === null
    const isClinicCreateMode = view === 'admin-clinic-detail' && selectedClinic === null
    const isLocationCreateMode = view === 'admin-location-detail' && selectedLocation === null
    const isDetailView = view === 'admin-user-detail' || view === 'admin-clinic-detail' || view === 'admin-location-detail' || view === 'admin-settings' || view === 'admin-system-conversation' || view === 'admin-request-detail' || view === 'admin-feedback-detail' || view === 'admin-suggestion-detail'
    // Triage details publish their own header actions in place of a Close, so on
    // mobile the Sheet has to supply a back arrow instead. This is a HEADER
    // COMPOSITION fact, not a navigation one — back itself is origin-driven and
    // identical for every view.
    const detailOwnsHeaderActions = view === 'admin-request-detail' || view === 'admin-feedback-detail' || view === 'admin-suggestion-detail'
    const desktopDetailPaneOpen = !isMobile && isDetailView
    // Desktop Esc: close the detail pane (triage → inbox, else back one level)
    // before the drawer itself closes. Mirrors the pane's own back button.
    // Desktop-only, and the rail is pinned there, so every view backs out the
    // same way — no triage fork needed.
    useEscBackout(desktopDetailPaneOpen, handleBack)

    const detailTitle = useMemo(() => {
        if (view === 'admin-user-detail') {
            return selectedUser
                ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || 'User'
                : 'New User'
        }
        if (view === 'admin-clinic-detail') {
            return selectedClinic?.name || 'New Clinic'
        }
        if (view === 'admin-location-detail') {
            return selectedLocation?.display_name || 'New Location'
        }
        if (view === 'admin-settings') {
            return 'Locations'
        }
        if (view === 'admin-system-conversation') {
            return systemPeerProfile ? getDisplayName(systemPeerProfile) : 'System thread'
        }
        if (view === 'admin-request-detail') {
            if (!selectedRequest) return 'Request'
            return selectedRequest.request_type === 'support'
                ? 'Support request'
                : selectedRequest.status === 'pending'
                    ? 'Approve request'
                    : 'Rejected request'
        }
        if (view === 'admin-feedback-detail') return 'User feedback'
        if (view === 'admin-suggestion-detail') return 'Feature suggestion'
        return ''
    }, [view, selectedUser, selectedClinic, selectedLocation, systemPeerProfile, selectedRequest])

    /** Breadcrumb crumb in the desktop detail header. When the user reached
     * this detail by hopping from another detail (CPT Conner → his cluster →
     * sister cluster), surface the previously-viewed entity so they can walk
     * back. Falls back to null when there's no trail — the back chevron
     * already covers "return to list". */
    const detailCrumb = useMemo(() => {
        const prev = trail[trail.length - 1]
        if (!prev) return null
        return {
            label: prev.label,
            onClick: () => {
                setTrail(t => t.slice(0, -1))
                if (prev.kind === 'user') enterUserDetail(prev.user, false)
                else enterClinicDetail(prev.clinic, false)
            },
        }
    }, [trail, enterUserDetail, enterClinicDetail])

    // Walk the lateral trail back to crumb `index` — used by the mobile detail
    // Sheet's breadcrumb, which surfaces the whole trail (vs the desktop header's
    // single immediate-parent crumb). Truncates the trail to everything before
    // the target, then re-enters that entity's detail. Guarded for pending edits.
    const navigateToCrumb = useCallback((index: number) => {
        guardNav(() => {
            const entry = trail[index]
            if (!entry) return
            setTrail(t => t.slice(0, index))
            if (entry.kind === 'user') enterUserDetail(entry.user, false)
            else enterClinicDetail(entry.clinic, false)
        })
    }, [trail, enterUserDetail, enterClinicDetail, guardNav])

    // Header actions for detail views — user/clinic share DetailHeaderActions.
    const detailHeaderActions = useMemo(() => {
        if (view === 'admin-user-detail') {
            return (
                <DetailHeaderActions
                    editing={userEdit.editing}
                    isCreate={isUserCreateMode}
                    canDelete={!!selectedUser && currentUserId !== selectedUser.id}
                    onCancelEdit={() => userEdit.setEditing(false)}
                    onStartEdit={() => userEdit.setEditing(true)}
                    onRequestDelete={userEdit.requestDelete}
                    onRequestSave={userEdit.requestSave}
                    onClose={isMobile ? handleBack : handleClose}
                    showCloseWhenIdle={isMobile}
                    // Tap-to-edit-overlay pattern owns edit entry + save + delete;
                    // header keeps only Close. Create flow still flows through here
                    // until Phase 3, but in create mode DetailHeaderActions already
                    // hides Edit/Cancel via isCreate.
                    hideEdit
                />
            )
        }
        if (view === 'admin-clinic-detail') {
            return (
                <DetailHeaderActions
                    editing={clinicEdit.editing}
                    isCreate={isClinicCreateMode}
                    onCancelEdit={() => clinicEdit.setEditing(false)}
                    onStartEdit={() => clinicEdit.setEditing(true)}
                    onRequestDelete={clinicEdit.requestDelete}
                    onRequestSave={clinicEdit.requestSave}
                    onClose={isMobile ? handleBack : handleClose}
                    showCloseWhenIdle={isMobile}
                    // Tap-to-edit-overlay pattern owns edit entry + save + delete;
                    // header keeps only Close. Mirrors AdminUserDetail.
                    hideEdit
                />
            )
        }
        if (view === 'admin-location-detail') {
            return (
                <DetailHeaderActions
                    editing={locationEdit.editing}
                    isCreate={isLocationCreateMode}
                    onCancelEdit={() => locationEdit.setEditing(false)}
                    onStartEdit={() => locationEdit.setEditing(true)}
                    onRequestSave={locationEdit.requestSave}
                    onClose={isMobile ? handleBack : handleClose}
                    showCloseWhenIdle={isMobile}
                />
            )
        }
        // Triage details publish their own header actions (primary commit +
        // ellipsis extras) via onHeaderActions → feedHeaderActions.
        if (view === 'admin-request-detail' || view === 'admin-feedback-detail' || view === 'admin-suggestion-detail') {
            return feedHeaderActions
        }
        return undefined
    }, [view, selectedUser, userEdit, clinicEdit, locationEdit, isUserCreateMode, isClinicCreateMode, isLocationCreateMode, handleClose, handleBack, currentUserId, isMobile, feedHeaderActions])

    // Header config per view
    // Desktop always shows the "Admin Panel" header — detail views get their own
    // sub-header inside the right pane. Mobile keeps the push-navigation pattern.
    const headerConfig = useMemo(() => {
        if (!isMobile) {
            return {
                title: 'Admin Panel',
                rightContent: mainHeaderActions,
                hideDefaultClose: !!mainHeaderActions,
            }
        }
        switch (view) {
            // User/clinic/location detail overlay the list via a Sheet, so the
            // underlying drawer header stays the list header (title + Close).
            case 'admin':
            case 'admin-user-detail':
            case 'admin-clinic-detail':
            case 'admin-location-detail':
            case 'admin-settings':
            case 'admin-request-detail':
            case 'admin-feedback-detail':
            case 'admin-suggestion-detail':
                return {
                    title: 'Admin Panel',
                    // Rail button summons the inbox from every tab — the tree is
                    // the Directory tab's main view, the rail its companion sheet.
                    leftContent: navRailButton,
                    rightContent: mainHeaderActions,
                    hideDefaultClose: !!mainHeaderActions,
                }
            // System conversation remains a full-panel push (chat owns its scroll;
            // a fit-Sheet would fight it) — keep the back-chevron detail header.
            case 'admin-system-conversation':
                return {
                    title: detailTitle,
                    showBack: true,
                    onBack: handleBack,
                }
        }
    }, [isMobile, view, activeTab, detailTitle, handleBack, mainHeaderActions, navRailButton])


    // After creating a user, switch to view mode immediately using the
    // optimistic AdminUser built by the create form. AdminUserDetail.loadData
    // overwrites the placeholder with the canonical record on its next refresh.
    const handleUserCreated = useCallback((user: AdminUser) => {
        setSelectedUser(user)
        setUserCreatePrefillClinicId(null)
        userEdit.setEditing(false)
        invalidate('users')
    }, [userEdit])

    // After creating a clinic, load full clinic and switch to view mode.
    // Invalidate BEFORE listing — listClinics is memoized on the clinics
    // generation, so without bumping it first we'd read the pre-create cache,
    // miss the new clinic, and fall back to navigateBack with stale pending-
    // edit state still captured upstream (firing the discard dialog).
    const handleClinicCreated = useCallback(async (clinicId: string) => {
        invalidate('clinics')
        const clinics = await listClinics()
        const newClinic = clinics.find(c => c.id === clinicId)
        setClusterCreatePrefill(null)
        if (newClinic) {
            setSelectedClinic(newClinic)
            clinicEdit.setEditing(false)
        } else {
            // Save already succeeded — no edits to guard. Skip guardNav.
            navigateBack()
        }
    }, [navigateBack, clinicEdit])

    // After creating a location, load full location and switch to view mode
    const handleLocationCreated = useCallback(async (locationId: string) => {
        const locs = await listLocations()
        const newLoc = locs.find(l => l.id === locationId)
        if (newLoc) {
            setSelectedLocation(newLoc)
            locationEdit.setEditing(false)
        } else {
            handleBack()
        }
        invalidate('locations')
    }, [handleBack, locationEdit])

    const handleLocationArchived = useCallback(() => {
        navigateBack()
    }, [navigateBack])

    // Render detail content (user/clinic) — shared by mobile (full-width) and
    // desktop (right pane).
    // Glass-header offset for mobile detail panes (var published by BaseDrawer).
    // Desktop detail renders in the right pane below an in-flow sub-header, so
    // no offset — falls back to the prior default className.
    const detailScrollCls = isMobile
        ? 'px-4 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)] pb-8'
        : 'px-4 py-3 md:p-5 pb-8'

    // Mobile detail (user/clinic/location) renders inside a Sheet whose body
    // already scrolls + clears its own header — so it gets bare content (no
    // ScrollPane, no glass-header offset). Desktop right-pane + the mobile
    // system-conversation push keep the ScrollPane wrapper.
    const renderDetailContent = (inSheet = false) => {
        const wrap = (node: ReactNode, innerCls = 'px-4 pt-1 pb-8') =>
            inSheet
                ? <div className={innerCls}>{node}</div>
                : <ScrollPane className={detailScrollCls}>{node}</ScrollPane>
        if (view === 'admin-user-detail') {
            return wrap(
                    <AdminUserDetail
                        user={selectedUser}
                        onUserUpdated={(u) => setSelectedUser(u)}
                        onCreated={handleUserCreated}
                        onSelectClinic={handleSelectClinicFromDetail}
                        editing={userEdit.editing}
                        onEditingChange={userEdit.setEditing}
                        saveRequested={userEdit.saveRequested}
                        onSaveComplete={userEdit.completeSave}
                        onPendingChangesChange={userEdit.setHasPending}
                        onRequestDelete={selectedUser && currentUserId !== selectedUser.id ? userEdit.requestDelete : undefined}
                        prefillClinicId={userCreatePrefillClinicId}
                        onOpenConversation={isDevRole ? handleSelectSystemPeer : undefined}
                    />
            )
        }
        if (view === 'admin-clinic-detail') {
            return wrap(
                    <AdminClinicDetail
                        clinic={selectedClinic}
                        onClinicUpdated={(c) => setSelectedClinic(c)}
                        onSelectUser={handleSelectUserFromDetail}
                        onSelectClinic={handleSelectClinicFromDetail}
                        onCreated={handleClinicCreated}
                        editing={clinicEdit.editing}
                        onEditingChange={clinicEdit.setEditing}
                        saveRequested={clinicEdit.saveRequested}
                        onSaveComplete={clinicEdit.completeSave}
                        onPendingChangesChange={clinicEdit.setHasPending}
                        onRequestDelete={selectedClinic ? clinicEdit.requestDelete : undefined}
                        createPrefill={clusterCreatePrefill}
                        onCreateRelatedCluster={handleCreateRelatedCluster}
                        onCreateUserInCluster={handleCreateUserInCluster}
                        onSelectRequest={handleOpenRequestFromCluster}
                    />
            )
        }
        if (view === 'admin-location-detail') {
            return wrap(
                    <AdminLocationDetail
                        location={selectedLocation}
                        onLocationUpdated={(l) => setSelectedLocation(l)}
                        onCreated={handleLocationCreated}
                        onArchived={handleLocationArchived}
                        editing={locationEdit.editing}
                        onEditingChange={locationEdit.setEditing}
                        saveRequested={locationEdit.saveRequested}
                        onSaveComplete={locationEdit.completeSave}
                        onPendingChangesChange={locationEdit.setHasPending}
                    />,
                    inSheet ? 'px-4 pt-1 pb-8' : 'px-5 pb-8',
            )
        }
        if (view === 'admin-settings') {
            const settings = (
                <AdminSettingsContent
                    onSelectLocation={handleSelectLocation}
                    onCreateLocation={handleCreateLocation}
                />
            )
            return inSheet
                ? <div className="pt-1 pb-8">{settings}</div>
                : <ScrollPane className="py-3 pb-8">{settings}</ScrollPane>
        }
        if (view === 'admin-request-detail' && selectedRequest) {
            return wrap(
                <RequestDetail
                    request={selectedRequest}
                    onApproved={handleRequestApproved}
                    onClose={handleBack}
                    onHeaderActions={setFeedHeaderActions}
                />
            )
        }
        if (view === 'admin-feedback-detail' && selectedFeedback) {
            return wrap(
                <FeedbackDetail
                    feedback={selectedFeedback}
                    onClose={handleBack}
                    onOpenConversation={isDevRole ? handleSelectSystemPeer : undefined}
                    onHeaderActions={setFeedHeaderActions}
                />
            )
        }
        if (view === 'admin-suggestion-detail' && selectedSuggestion) {
            return wrap(
                <SuggestionDetail
                    suggestion={selectedSuggestion}
                    onClose={handleBack}
                    onHeaderActions={setFeedHeaderActions}
                />
            )
        }
        if (view === 'admin-system-conversation' && selectedSystemPeerId) {
            // ChatDetailView owns its own scroll; do NOT wrap in ScrollPane.
            // On mobile the glass header floats over the top — offset the chat
            // surface so its composer/messages clear the translucent header.
            return (
                <div className={isMobile ? 'h-full pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]' : 'h-full'}>
                    <AdminSystemConversationView
                        peerId={selectedSystemPeerId}
                        onBack={isMobile ? handleBack : undefined}
                    />
                </div>
            )
        }
        return null
    }

    // Mobile content. User/clinic/location detail now overlay the list via a
    // Sheet (rendered below), so the base layer is always the list — only the
    // system-conversation chat keeps the full-panel push.
    const renderContent = () => {
        if (view === 'admin-system-conversation') {
            return renderDetailContent()
        }
        return renderMainView()
    }

    // ActionSheet options per tab. Directory creates users + clusters (the org-
    // rooted tree's two entity types). Locations are created from the Settings
    // sheet now, not here. Votes = inline mgmt — no FAB.
    const addSheetOptions = useMemo(() => {
        const options: Array<{ key: string; label: string; onAction: () => void }> = []
        if (activeTab === 'directory') {
            options.push({ key: 'user', label: 'New User', onAction: () => { setShowAddSheet(false); handleCreateUser() } })
            options.push({ key: 'clinic', label: 'New Cluster', onAction: () => { setShowAddSheet(false); handleCreateClinic() } })
        }
        return options
    }, [activeTab, handleCreateUser, handleCreateClinic])

    const detailSheetOpen = isMobile && (
        view === 'admin-user-detail' ||
        view === 'admin-clinic-detail' ||
        view === 'admin-location-detail' ||
        view === 'admin-settings' ||
        view === 'admin-request-detail' ||
        view === 'admin-feedback-detail' ||
        view === 'admin-suggestion-detail'
    )

    // Mobile detail-Sheet breadcrumb: the lateral trail as clickable crumbs
    // stacked above the current entity name. Replaces the panel-push back
    // chevron — crumbs walk laterally, dismissing the sheet returns to the list.
    const sheetTitleNode = (
        <div className="min-w-0">
            {trail.length > 0 && (
                <div className="flex items-center gap-1 overflow-hidden text-[9pt] text-tertiary mb-0.5">
                    {trail.map((entry, i) => (
                        <div key={i} className="flex items-center gap-1 min-w-0 shrink">
                            <button
                                type="button"
                                onClick={() => navigateToCrumb(i)}
                                className="truncate max-w-[120px] hover:text-primary active:scale-95 transition-transform"
                            >
                                {entry.label}
                            </button>
                            <span aria-hidden className="shrink-0 text-tertiary/50">›</span>
                        </div>
                    ))}
                </div>
            )}
            <div className="truncate text-[13pt] font-semibold text-primary leading-tight">{detailTitle}</div>
        </div>
    )

    // The mobile sheet's active screen — null means the inbox is showing. Carries
    // the entity id so a same-type hop (user A → user B) still reads as a screen
    // change and crossfades. One derivation: it doubles as "is a detail open".
    const mobileScreenId =
        view === 'admin-user-detail' ? `user:${selectedUser?.id ?? 'new'}`
        : view === 'admin-clinic-detail' ? `clinic:${selectedClinic?.id ?? 'new'}`
        : view === 'admin-location-detail' ? `location:${selectedLocation?.id ?? 'new'}`
        : view === 'admin-settings' ? 'settings'
        : view === 'admin-request-detail' ? `request:${selectedRequest?.id ?? ''}`
        : view === 'admin-feedback-detail' ? `feedback:${selectedFeedback?.id ?? ''}`
        : view === 'admin-suggestion-detail' ? `suggestion:${selectedSuggestion?.id ?? ''}`
        : null
    const sheetShowsInbox = mobileScreenId === null && showNavSheet
    const mobileSheetOpen = isMobile && (mobileScreenId !== null || showNavSheet)

    // Sheet-level dismiss (drag handle / backdrop tap). Inbox → close it; any
    // detail → back, which already lands on whichever surface opened it.
    const sheetOnClose = sheetShowsInbox
        ? () => setShowNavSheet(false)
        : handleBack

    // Inbox body (the sort rail) — the Sheet chrome supplies the header, so this
    // is bare content. Selecting a triage/settings row keeps the sheet up and
    // morphs to that detail (no setShowNavSheet(false), so back returns here); a
    // system peer opens the full-panel chat, so it closes the inbox first.
    // NOTE: no fixed height here. This body must HUG — the Sheet's own fit cap
    // (maxHeight) bounds it and the Sheet's content region owns the scroll. A
    // hardcoded dvh here made the "fit" sheet a fixed slab AND reintroduced the
    // iOS-keyboard collapse that Sheet's svh caps exist to prevent (the search
    // input below opens the keyboard). Search stays put via sticky, not flex.
    const inboxBody = (
        <div className="flex flex-col">
            <div className="sticky top-0 z-10 px-3 pt-2 pb-2 bg-themewhite">
                <SearchInput value={inboxQuery} onChange={setInboxQuery} placeholder="Search inbox..." />
            </div>
            <div>
                <AdminSortRail
                    scroll={false}
                    onOpenSettings={handleOpenSettings}
                    onSelectSystemPeer={(peerId) => { setShowNavSheet(false); handleSelectSystemPeer(peerId) }}
                    onOpenRequest={handleOpenRequest}
                    onOpenFeedback={handleOpenFeedback}
                    onOpenSuggestion={handleOpenSuggestion}
                    searchQuery={inboxQuery}
                    activeSystemPeerId={selectedSystemPeerId}
                />
            </div>
        </div>
    )

    // Bottom island — tab switcher (centered) + FAB (right), matching Property/Calendar pattern
    const bottomIsland = (
        <BottomIsland
            ariaLabel="Admin sections"
            glass
            activeId={activeTab}
            onSelect={(id) => handleTabChange(id as AdminTab)}
            stops={visibleTabs.map((tab) => {
                const TabIcon = TAB_ICONS[tab]
                return { id: tab, title: TAB_LABELS[tab], icon: <TabIcon size={18} /> }
            })}
            fab={
                // FAB — absolute right, aligned to island. Directory creates
                // users/clusters/locations; requests/votes don't.
                activeTab === 'directory' ? (
                    <AddFab label="Add new" onClick={() => setShowAddSheet(true)} className="absolute right-4" />
                ) : null
            }
        />
    )

    // Votes tab — the feature-vote cycle manager. Requests/feedback/messages now
    // live in the left-pane rail, so this is the only non-directory tab.
    const renderQueueTab = () => (
        <>
            {activeTab === 'feature-votes' && isDevRole && (
                <AdminFeatureVotesSection />
            )}
        </>
    )

    // The Directory tree — the main content list. Tapping a node opens its
    // detail (desktop right pane / mobile Sheet); search filters it. Shared by
    // the desktop center pane and the mobile full-screen view.
    const renderDirectoryTree = () => (
        <AdminSummary
            searchQuery={directoryQuery}
            onSelectClinic={handleSelectClinic}
            onSelectUser={handleSelectUser}
            onEditClinic={handleEditClinic}
            onEditUser={handleEditUser}
            onChatUser={isDevRole ? (u) => handleSelectSystemPeer(u.id) : undefined}
            onCreateClinic={handleCreateClinic}
            activeClinicId={selectedClinic?.id}
            activeUserId={selectedUser?.id}
        />
    )

    // Directory search bar — its own query, shared by the mobile full-screen
    // directory and the desktop center pane so both filter the same tree.
    const directorySearch = (
        <SearchInput value={directoryQuery} onChange={setDirectoryQuery} placeholder="Search directory..." />
    )

    // Mobile Directory — the tree IS the main view (the sort rail lives in the
    // nav sheet). A search bar rides the top; the tree fills the rest.
    const renderMobileDirectory = () => (
        <div className="h-full flex flex-col pt-[calc(var(--drawer-header-h,3.5rem)+0.5rem)]">
            <div className="px-3 pb-2 shrink-0">
                {directorySearch}
            </div>
            <div className="flex-1 min-h-0">
                {renderDirectoryTree()}
            </div>
        </div>
    )

    const renderMainView = () => (
        isMobile ? (
            <div className="relative h-full">
                {activeTab === 'directory' ? (
                    renderMobileDirectory()
                ) : (
                    // Votes owns its own filtering — no search bar here. The one
                    // that used to ride this scroller was bound to the shared
                    // query and never reached AdminFeatureVotesSection, so it
                    // filtered nothing.
                    <div className="h-full overflow-y-auto overscroll-y-contain pt-[calc(var(--drawer-header-h,3.5rem)+0.5rem)]">
                        {renderQueueTab()}
                    </div>
                )}
                {!detailSheetOpen && bottomIsland}
            </div>
        ) : (
            // Desktop center: the active tab's main content. Directory = search
            // bar + the tree (which manages its own scroll); the Votes tab shares
            // a single scroller. The inbox rail lives in the pinned left pane.
            <div className="relative h-full">
                {activeTab === 'directory' ? (
                    <div className="h-full flex flex-col">
                        <div className="shrink-0 px-3 pt-3 pb-2">
                            {directorySearch}
                        </div>
                        <div className="flex-1 min-h-0">
                            {renderDirectoryTree()}
                        </div>
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto">
                        {renderQueueTab()}
                    </div>
                )}
                {!detailSheetOpen && bottomIsland}
            </div>
        )
    )

    return (
        <>
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            fullHeight="95dvh"
            mobileFullScreen
            desktopPosition="left"
            desktopWidth="w-[90%]"
            header={headerConfig}
            scrollDisabled
            glassHeader={isMobile}
        >
            <ContentWrapper
                slideDirection={isMobile && view === 'admin-system-conversation' ? slideDirection : ''}
                swipeHandlers={isMobile && view === 'admin-system-conversation' ? swipeHandlers : undefined}
            >
                <div className="h-full relative">
                    {/* Desktop: three-pane (summary | list | detail). Opening detail
                        collapses the summary sidebar and slides the detail pane in —
                        mirrors the CalendarDrawer rightPanelOpen pattern. */}
                    {!isMobile ? (
                        <div className="flex h-full">
                            {/* Left pane — the inbox rail + its own search. PINNED:
                                triage is batch work (approve, next, next), so the
                                queue must survive opening an item. It used to slide
                                out whenever a detail opened, which is what forced
                                the separate back-to-inbox path. */}
                            <div className="shrink-0 flex flex-col w-[240px] border-r border-primary/10 bg-themewhite">
                                <div className="shrink-0 px-3 pt-3 pb-2">
                                    <SearchInput value={inboxQuery} onChange={setInboxQuery} placeholder="Search inbox..." />
                                </div>
                                <div className="flex-1 min-h-0">
                                    <AdminSortRail
                                        onOpenSettings={handleOpenSettings}
                                        onSelectSystemPeer={handleSelectSystemPeer}
                                        onOpenRequest={handleOpenRequest}
                                        onOpenFeedback={handleOpenFeedback}
                                        onOpenSuggestion={handleOpenSuggestion}
                                        searchQuery={inboxQuery}
                                        activeSystemPeerId={selectedSystemPeerId}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                                {renderMainView()}
                            </div>
                            {/* Detail pane — the surface being READ or EDITED, so it
                                gets real width rather than the narrowest column. */}
                            <SlideRevealPane
                                open={desktopDetailPaneOpen}
                                side="right"
                                width={480}
                                className="border-l border-primary/10 bg-themewhite relative"
                            >
                                <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/10">
                                    <button
                                        type="button"
                                        onClick={handleBack}
                                        aria-label="Close detail"
                                        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-tertiary/10 text-tertiary active:scale-95 shrink-0"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <h2 className="flex-1 min-w-0 flex items-center gap-1.5 text-[11pt] font-semibold text-primary">
                                        {detailCrumb && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => guardNav(detailCrumb.onClick)}
                                                    className="shrink-0 text-tertiary hover:text-primary active:scale-95 transition-all font-normal max-w-[160px] truncate"
                                                >
                                                    {detailCrumb.label}
                                                </button>
                                                <span aria-hidden className="shrink-0 text-tertiary/60">›</span>
                                            </>
                                        )}
                                        <span className="min-w-0 truncate">{detailTitle}</span>
                                    </h2>
                                    {detailHeaderActions}
                                </div>
                                <div className="flex-1 min-h-0 overflow-hidden">
                                    {renderDetailContent()}
                                </div>
                            </SlideRevealPane>
                        </div>
                    ) : (
                        renderContent()
                    )}
                </div>
            </ContentWrapper>

            {/* FAB action sheet — inside BaseDrawer so it's within the z-60 stacking context */}
            <ActionSheet
                visible={showAddSheet}
                title="Add New"
                options={addSheetOptions}
                onClose={() => setShowAddSheet(false)}
            />
        </BaseDrawer>

        {isMobile && (
            <AdminMobileSheet
                isOpen={mobileSheetOpen}
                screenId={mobileScreenId}
                detailTitle={detailTitle}
                titleNode={sheetTitleNode}
                detailActions={detailHeaderActions}
                detailOwnsHeaderActions={detailOwnsHeaderActions}
                backButton={sheetBackButton}
                onClose={sheetOnClose}
            >
                {sheetShowsInbox ? inboxBody : renderDetailContent(true)}
            </AdminMobileSheet>
        )}

        {/* Discard unsaved changes confirmation */}
        <ConfirmDialog
            visible={confirmDiscard}
            title="Discard changes?"
            subtitle="Your unsaved changes will be lost."
            confirmLabel="Discard"
            variant="danger"
            onConfirm={handleDiscardConfirmed}
            onCancel={handleDiscardCancelled}
            zIndex={1300}
        />

        {/* Clinic delete confirmation — triggered from header pill */}
        <ConfirmDialog
            visible={clinicEdit.confirmingDelete}
            title={`Delete ${selectedClinic?.name ?? 'cluster'}?`}
            subtitle="Permanent. All associated data removed."
            confirmLabel="Delete"
            variant="danger"
            processing={clinicEdit.deleteProcessing}
            onConfirm={handleDeleteClinic}
            onCancel={clinicEdit.cancelDelete}
            zIndex={1300}
        />

        {/* User delete confirmation — triggered from header pill */}
        <ConfirmDialog
            visible={userEdit.confirmingDelete}
            title={`Delete ${[selectedUser?.first_name, selectedUser?.last_name].filter(Boolean).join(' ') || 'user'}?`}
            subtitle="Permanent. All data removed — notes, training, sync queue."
            confirmLabel="Delete"
            variant="danger"
            processing={userEdit.deleteProcessing}
            onConfirm={handleDeleteUser}
            onCancel={userEdit.cancelDelete}
            zIndex={1300}
        />
        </>
    )
}
