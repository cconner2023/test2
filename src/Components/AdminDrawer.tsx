import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react'
import { X, Inbox, ChevronLeft, MessageCircleQuestion, Network, Users, MapPin, Building2, List } from 'lucide-react'
import { BaseDrawer, ScrollPane } from './BaseDrawer'
import { ActionPill } from './ActionPill'
import { Sheet } from './Sheet'
import { BottomIsland, IslandButton } from './BottomIsland'
import { AddFab } from './AddFab'
import { SearchInput } from './SearchInput'
import { HeaderPill, PillButton } from './HeaderPill'
import { DetailHeaderActions } from './Admin/DetailHeaderActions'
import { useDetailEditState } from '../Hooks/useDetailEditState'
import { ContentWrapper } from './ContentWrapper'
import { ConfirmDialog } from './ConfirmDialog'
import { ActionSheet } from './ActionSheet'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import { usePageVisibility } from '../Hooks/usePageVisibility'
import { UI_TIMING } from '../Utilities/constants'
import { deleteClinic, deleteUser, listClinics, listLocations } from '../lib/adminService'
import { useAuthStore } from '../stores/useAuthStore'
import { invalidate } from '../stores/useInvalidationStore'
import { drainSystemInbox } from '../lib/signal/systemIdentity'
import { createLogger } from '../Utilities/Logger'

const systemInboxLogger = createLogger('AdminSystemInbox')

// Admin sub-components
import { AdminRequestsList } from './Admin/AdminRequestsList'
import { AdminUsersList } from './Admin/AdminUsersList'
import { AdminUserDetail } from './Admin/AdminUserDetail'
import { AdminClinicsList } from './Admin/AdminClinicsList'
import { AdminClinicDetail, type ClusterCreatePrefill } from './Admin/AdminClinicDetail'
import { AdminLocationsList } from './Admin/AdminLocationsList'
import { AdminLocationDetail } from './Admin/AdminLocationDetail'
import { AdminSummary } from './Admin/AdminSummary'
import { AdminFeatureVotesSection } from './Admin/AdminFeatureVotesSection'
import { AdminSystemConversationView } from './Admin/AdminSystemConversationView'
import { useMessagingStore } from '../stores/useMessagingStore'
import { getDisplayName } from '../Utilities/nameUtils'
import type { AdminUser, AdminClinic, AdminLocation } from '../lib/adminService'
import type { AccountRequest } from '../lib/accountRequestService'

export type AdminView =
    | 'admin'
    | 'admin-user-detail'
    | 'admin-clinic-detail'
    | 'admin-location-detail'
    | 'admin-system-conversation'

// Island: requests · users · locations · votes. The Users tab hosts both users
// and clusters behind an in-tab type filter (All/Users/Clusters); the cluster
// echelon hierarchy lives in the left pane (desktop) / a Sheet (mobile) via
// AdminSummary. 'feature-votes' keeps its slug (Settings deep-links to it) but
// reads as "Votes" in the island. Locations + votes are dev-only.
const ALL_TABS = ['requests', 'users', 'locations', 'feature-votes'] as const
type AdminTab = typeof ALL_TABS[number]

// In-tab filter for the Users tab — the map-overlay-style "type island".
type UserFilter = 'all' | 'users' | 'clinics'

const TAB_ICONS: Record<AdminTab, typeof Inbox> = {
    requests: Inbox,
    users: Users,
    locations: MapPin,
    'feature-votes': MessageCircleQuestion,
}

const TAB_LABELS: Record<AdminTab, string> = {
    requests: 'Requests',
    users: 'Users',
    locations: 'Locations',
    'feature-votes': 'Votes',
}

interface AdminDrawerProps {
    isVisible: boolean
    onClose: () => void
}

export function AdminDrawer({ isVisible, onClose }: AdminDrawerProps) {
    const [view, setView] = useState<AdminView>('admin')
    const [activeTab, setActiveTab] = useState<AdminTab>('requests')
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')

    // Selected entity for detail views (null = create mode)
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
    const [selectedClinic, setSelectedClinic] = useState<AdminClinic | null>(null)
    const [selectedLocation, setSelectedLocation] = useState<AdminLocation | null>(null)
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

    // Search state
    const [searchQuery, setSearchQuery] = useState('')

    // FAB action sheet
    const [showAddSheet, setShowAddSheet] = useState(false)

    // Users-tab type filter (All/Users/Clusters). The cluster echelon hierarchy
    // is NOT inline here — it's AdminSummary in the desktop left pane / a mobile
    // Sheet (showTreeSheet, opened by the header Hierarchy pill).
    const [userFilter, setUserFilter] = useState<UserFilter>('all')
    const [showTreeSheet, setShowTreeSheet] = useState(false)

    // Discard pending changes confirmation. The pending action is held in a
    // ref so any nav path (back, tab switch, drawer close, summary jump) can
    // route through the same dialog without each duplicating the guard logic.
    const [confirmDiscard, setConfirmDiscard] = useState(false)
    const pendingActionRef = useRef<(() => void) | null>(null)

    // Clear search when navigating between views (e.g., clicking a search result)
    useEffect(() => { setSearchQuery('') }, [view])

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
    const visibleTabs = useMemo<AdminTab[]>(
        () => isDevRole ? [...ALL_TABS] : ALL_TABS.filter(t => t !== 'feature-votes' && t !== 'locations'),
        [isDevRole]
    )

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
        userEdit.setEditing(editing)
        userEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-user-detail')
    }, [handleSlideAnimation, userEdit])

    const enterClinicDetail = useCallback((clinic: AdminClinic | null, editing: boolean, prefill: ClusterCreatePrefill | null = null) => {
        setSelectedClinic(clinic)
        setClusterCreatePrefill(clinic === null ? prefill : null)
        clinicEdit.setEditing(editing)
        clinicEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-clinic-detail')
    }, [handleSlideAnimation, clinicEdit])

    // Top-level entries (list rows, summary, request approval) — clear any
    // prior lateral trail since the user jumped in from outside the chain.
    const handleSelectUser = useCallback((user: AdminUser) => {
        clearTrail()
        enterUserDetail(user, false)
    }, [enterUserDetail, clearTrail])

    const handleEditUser = useCallback((user: AdminUser) => {
        clearTrail()
        enterUserDetail(user, true)
    }, [enterUserDetail, clearTrail])

    const handleCreateUser = useCallback(() => {
        clearTrail()
        enterUserDetail(null, true)
    }, [enterUserDetail, clearTrail])

    const handleSelectClinic = useCallback((clinic: AdminClinic) => {
        clearTrail()
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
            surrogate_clinic_id: null,
            surrogate_clinic_name: null,
            created_at: new Date().toISOString(),
            last_active_at: null,
            avatar_id: null,
            supervisor_created: false,
        }
        // Partial-failure recovery: if any post-approval step failed, open the
        // user in edit mode so admin can finish configuring the account.
        if (configured.warnings.length > 0) {
            handleEditUser(newUser)
        } else {
            handleSelectUser(newUser)
        }
        invalidate('requests', 'users')
    }, [handleSelectUser, handleEditUser])

    const handleEditClinic = useCallback((clinic: AdminClinic) => {
        clearTrail()
        enterClinicDetail(clinic, true)
    }, [enterClinicDetail, clearTrail])

    const handleCreateClinic = useCallback(() => {
        clearTrail()
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

    const handleSelectSystemPeer = useCallback((peerId: string) => {
        clearTrail()
        setSelectedSystemPeerId(peerId)
        handleSlideAnimation('left')
        setView('admin-system-conversation')
    }, [clearTrail, handleSlideAnimation])

    const handleSelectLocation = useCallback((loc: AdminLocation) => {
        clearTrail()
        setSelectedLocation(loc)
        locationEdit.setEditing(false)
        locationEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-location-detail')
    }, [handleSlideAnimation, locationEdit, clearTrail])

    const handleCreateLocation = useCallback(() => {
        clearTrail()
        setSelectedLocation(null)
        locationEdit.setEditing(true)
        locationEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-location-detail')
    }, [handleSlideAnimation, locationEdit, clearTrail])

    const handleEditLocation = useCallback((loc: AdminLocation) => {
        clearTrail()
        setSelectedLocation(loc)
        locationEdit.setEditing(true)
        locationEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-location-detail')
    }, [handleSlideAnimation, locationEdit, clearTrail])

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

    const handleBack = useCallback(() => {
        guardNav(navigateBack)
    }, [guardNav, navigateBack])

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
        setActiveTab('requests')
        setSelectedUser(null)
        setSelectedClinic(null)
        setSelectedLocation(null)
        setSelectedSystemPeerId(null)
        setClusterCreatePrefill(null)
        setUserCreatePrefillClinicId(null)
        setSlideDirection('')
        setSearchQuery('')
        setShowTreeSheet(false)
        setUserFilter('all')
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

    // Sidebar summary handlers. When the user is mid-edit in a detail pane,
    // jumping to a different tab discards the detail pane — route through the
    // shared discard guard so the work is preserved unless explicitly dropped.
    const handleSummarySwitchTab = useCallback((tab: 'requests' | 'users' | 'clinics') => {
        guardNav(() => {
            // users + clinics share the Users tab, distinguished by the type filter.
            if (tab === 'requests') {
                setActiveTab('requests')
            } else {
                setActiveTab('users')
                setUserFilter(tab === 'clinics' ? 'clinics' : 'users')
            }
            if (view !== 'admin') {
                setView('admin')
                setSelectedUser(null)
                setSelectedClinic(null)
                setSelectedSystemPeerId(null)
                setClusterCreatePrefill(null)
                setUserCreatePrefillClinicId(null)
                clearTrail()
            }
        })
    }, [view, guardNav, clearTrail])

    const handleTabChange = useCallback((tab: AdminTab) => {
        setActiveTab(tab)
    }, [])

    // Header actions for the main list header — the drawer-wide Close. Always
    // present: on mobile the detail views now overlay the list via a Sheet, so
    // the underlying header stays the list header (Close), not a detail header.
    const mainHeaderActions = useMemo(() => (
        <HeaderPill>
            <PillButton icon={X} onClick={handleClose} label="Close" />
        </HeaderPill>
    ), [handleClose])

    // Mobile header-left pill (Users tab only) — opens the cluster-hierarchy Sheet.
    const hierarchyPill = useMemo(() => (
        <HeaderPill>
            <PillButton icon={Network} onClick={() => setShowTreeSheet(true)} label="Hierarchy" />
        </HeaderPill>
    ), [])

    const isUserCreateMode = view === 'admin-user-detail' && selectedUser === null
    const isClinicCreateMode = view === 'admin-clinic-detail' && selectedClinic === null
    const isLocationCreateMode = view === 'admin-location-detail' && selectedLocation === null
    const isDetailView = view === 'admin-user-detail' || view === 'admin-clinic-detail' || view === 'admin-location-detail' || view === 'admin-system-conversation'
    const desktopDetailPaneOpen = !isMobile && isDetailView

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
        if (view === 'admin-system-conversation') {
            return systemPeerProfile ? getDisplayName(systemPeerProfile) : 'System thread'
        }
        return ''
    }, [view, selectedUser, selectedClinic, selectedLocation, systemPeerProfile])

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
        return undefined
    }, [view, selectedUser, userEdit, clinicEdit, locationEdit, isUserCreateMode, isClinicCreateMode, isLocationCreateMode, handleClose, handleBack, currentUserId, isMobile])

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
                return {
                    title: 'Admin Panel',
                    // Hierarchy pill (opens the cluster-tree Sheet) is always present —
                    // the tree spans every tab, so it's not scoped to the Users tab.
                    leftContent: hierarchyPill,
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
    }, [isMobile, view, detailTitle, handleBack, mainHeaderActions, activeTab, hierarchyPill])


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

    // ActionSheet options per tab
    const addSheetOptions = useMemo(() => {
        const options: Array<{ key: string; label: string; onAction: () => void }> = []
        // Users tab → New User + New Cluster; Locations tab (dev) → New Location.
        // Requests = approval workflow, votes = inline mgmt — no FAB.
        if (activeTab === 'users') {
            options.push({ key: 'user', label: 'New User', onAction: () => { setShowAddSheet(false); handleCreateUser() } })
            options.push({ key: 'clinic', label: 'New Cluster', onAction: () => { setShowAddSheet(false); handleCreateClinic() } })
        } else if (activeTab === 'locations' && isDevRole) {
            options.push({ key: 'location', label: 'New Location', onAction: () => { setShowAddSheet(false); handleCreateLocation() } })
        }
        return options
    }, [activeTab, isDevRole, handleCreateUser, handleCreateClinic, handleCreateLocation])

    const detailSheetOpen = isMobile && (
        view === 'admin-user-detail' ||
        view === 'admin-clinic-detail' ||
        view === 'admin-location-detail'
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

    // AdminSummary (the cluster-hierarchy tree) lives in the desktop left pane
    // AND a mobile Sheet. In the sheet, any selection also closes the sheet.
    const closeTreeThen = useCallback(<T,>(fn: (arg: T) => void) => (arg: T) => {
        setShowTreeSheet(false)
        fn(arg)
    }, [])

    // Bottom island — tab switcher (centered) + FAB (right), matching Property/Calendar pattern
    const bottomIsland = (
        <BottomIsland
            role="tablist"
            ariaLabel="Admin sections"
            glass
            fab={
                // FAB — absolute right, aligned to island. Users (user/cluster) +
                // Locations (dev) create entities; requests/votes don't.
                activeTab === 'users' || (activeTab === 'locations' && isDevRole) ? (
                    <AddFab label="Add new" onClick={() => setShowAddSheet(true)} className="absolute right-4" />
                ) : null
            }
        >
            {visibleTabs.map((tab) => {
                const TabIcon = TAB_ICONS[tab]
                const label = TAB_LABELS[tab]
                return (
                    <IslandButton key={tab} active={activeTab === tab} onClick={() => handleTabChange(tab)} label={label} role="tab">
                        <TabIcon size={18} />
                    </IslandButton>
                )
            })}
        </BottomIsland>
    )

    // Users tab — flat lists behind a "type island" filter (All/Users/Clusters).
    // Both AdminUsersList + AdminClinicsList run in embedded mode, so they filter
    // on the shared search query and collapse empty sections. The cluster echelon
    // hierarchy is NOT inline here — it's the AdminSummary sidebar / mobile Sheet.
    const FILTER_OPTS: { key: UserFilter; label: string; icon: typeof Users }[] = [
        { key: 'all', label: 'All', icon: List },
        { key: 'users', label: 'Users', icon: Users },
        { key: 'clinics', label: 'Clusters', icon: Building2 },
    ]

    // Floating secondary island — the All/Users/Clusters type filter, hovering
    // just above the bottom island when the Users tab is selected (mirrors the
    // map overlay's basemap picker floating above its control island). Mobile
    // hides it during universal search (search bypasses the type filter).
    const showFilterIsland = activeTab === 'users' && !(isMobile && searchQuery.trim())
    const userFilterIsland = showFilterIsland ? (
        <div className="absolute bottom-[4.75rem] inset-x-0 flex items-center justify-center z-20 pointer-events-none pb-[max(0rem,var(--sab,0px))]">
            <ActionPill
                role="tablist"
                aria-label="Filter users and clusters"
                className="pointer-events-auto"
            >
                {FILTER_OPTS.map(o => {
                    const Icon = o.icon
                    const active = userFilter === o.key
                    return (
                        <button
                            key={o.key}
                            type="button"
                            role="tab"
                            onClick={() => setUserFilter(o.key)}
                            aria-selected={active}
                            title={o.label}
                            aria-label={o.label}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                                active ? 'bg-themeblue3 text-white' : 'bg-themeblue2/8 text-primary'
                            }`}
                        >
                            <Icon size={16} />
                        </button>
                    )
                })}
            </ActionPill>
        </div>
    ) : null

    const renderUsersTab = () => (
        <div className="px-3 md:px-5 pt-4 pb-24 space-y-5">
            {/* Type filter (All/Users/Clusters) now lives in a floating secondary
                island above the bottom island — see userFilterIsland. */}
            {(userFilter === 'all' || userFilter === 'users') && (
                <AdminUsersList
                    embedded
                    title="Users"
                    onSelectUser={handleSelectUser}
                    onEditUser={handleEditUser}
                    onCreateUser={handleCreateUser}
                    searchQuery={searchQuery}
                />
            )}
            {(userFilter === 'all' || userFilter === 'clinics') && (
                <AdminClinicsList
                    embedded
                    title="Clusters"
                    onSelectClinic={handleSelectClinic}
                    onEditClinic={handleEditClinic}
                    onCreateClinic={handleCreateClinic}
                    searchQuery={searchQuery}
                />
            )}
        </div>
    )

    // Shared: content for the active tab.
    const renderTabLists = () => (
        <>
            {activeTab === 'requests' && (
                <AdminRequestsList
                    searchQuery={searchQuery}
                    onApproved={handleRequestApproved}
                    onSelectSystemPeer={isDevRole ? handleSelectSystemPeer : undefined}
                />
            )}
            {activeTab === 'users' && renderUsersTab()}
            {activeTab === 'locations' && isDevRole && (
                <AdminLocationsList
                    onSelectLocation={handleSelectLocation}
                    onEditLocation={handleEditLocation}
                    onCreateLocation={handleCreateLocation}
                    searchQuery={searchQuery}
                />
            )}
            {activeTab === 'feature-votes' && isDevRole && (
                <AdminFeatureVotesSection />
            )}
        </>
    )

    // Universal search (mobile) — when a query is active, results span EVERY
    // section regardless of the selected bottom island, instead of filtering
    // only the active tab. Each embedded list collapses to null on no match,
    // so only the sections with hits render. The type-island (All/Users/
    // Clusters) is bypassed — users + clusters both show.
    const renderSearchResults = () => (
        <div className="px-3 pt-4 pb-24 space-y-5">
            <AdminRequestsList
                embedded
                title="Requests"
                searchQuery={searchQuery}
                onApproved={handleRequestApproved}
                onSelectSystemPeer={isDevRole ? handleSelectSystemPeer : undefined}
            />
            <AdminUsersList
                embedded
                title="Users"
                onSelectUser={handleSelectUser}
                onEditUser={handleEditUser}
                onCreateUser={handleCreateUser}
                searchQuery={searchQuery}
            />
            <AdminClinicsList
                embedded
                title="Clusters"
                onSelectClinic={handleSelectClinic}
                onEditClinic={handleEditClinic}
                onCreateClinic={handleCreateClinic}
                searchQuery={searchQuery}
            />
            {isDevRole && (
                <AdminLocationsList
                    embedded
                    title="Locations"
                    onSelectLocation={handleSelectLocation}
                    onEditLocation={handleEditLocation}
                    onCreateLocation={handleCreateLocation}
                    searchQuery={searchQuery}
                />
            )}
        </div>
    )

    const renderMainView = () => (
        isMobile ? (
            // Mobile: search bar + list share one scroller whose top sits at the
            // panel top (behind the glass header), so content scrolls UP behind
            // the translucent header. Search bar's top padding clears the header.
            <div className="relative h-full">
                <div className="h-full overflow-y-auto overscroll-y-contain">
                    <div className="px-3 pt-[calc(var(--drawer-header-h,3.5rem)+0.5rem)] pb-2">
                        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search all..." />
                    </div>
                    {searchQuery.trim() ? renderSearchResults() : renderTabLists()}
                </div>
                {!detailSheetOpen && userFilterIsland}
                {!detailSheetOpen && bottomIsland}
            </div>
        ) : (
            // Desktop: scrollable content + absolute-positioned island (like Property)
            <div className="relative h-full">
                <div className="h-full overflow-y-auto">
                    {renderTabLists()}
                </div>
                {!detailSheetOpen && userFilterIsland}
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
                            <div
                                aria-hidden={desktopDetailPaneOpen}
                                className={`shrink-0 overflow-hidden flex flex-col bg-themewhite3/50 transition-all duration-300 ease-out ${
                                    desktopDetailPaneOpen
                                        ? 'w-0 opacity-0 border-r-0'
                                        : 'w-[260px] opacity-100 border-r border-tertiary/10'
                                }`}
                            >
                                <div className="shrink-0 px-3 py-2">
                                    <SearchInput
                                        value={searchQuery}
                                        onChange={setSearchQuery}
                                        placeholder="Search..."
                                    />
                                </div>
                                <div className="flex-1 min-h-0">
                                    <AdminSummary
                                        onSelectClinic={handleSelectClinic}
                                        onSelectUser={handleSelectUser}
                                        onEditClinic={handleEditClinic}
                                        onEditUser={handleEditUser}
                                        onChatUser={isDevRole ? (u) => handleSelectSystemPeer(u.id) : undefined}
                                        onSelectAll={() => { setView('admin'); setSelectedUser(null); setSelectedClinic(null); setSelectedSystemPeerId(null); setClusterCreatePrefill(null); setUserCreatePrefillClinicId(null) }}
                                        onSwitchTab={handleSummarySwitchTab}
                                        activeClinicId={selectedClinic?.id}
                                        activeUserId={selectedUser?.id}
                                        allSelected={view === 'admin'}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                                {renderMainView()}
                            </div>
                            <div
                                aria-hidden={!desktopDetailPaneOpen}
                                className={`shrink-0 overflow-hidden flex flex-col bg-themewhite transition-all duration-300 ease-out ${
                                    desktopDetailPaneOpen
                                        ? 'w-[520px] opacity-100 border-l border-tertiary/10'
                                        : 'w-0 opacity-0 border-l-0'
                                }`}
                            >
                                <div className="flex items-center gap-2 px-3 py-2 border-b border-tertiary/10">
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
                            </div>
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

        {/* Mobile detail Sheet — user/clinic/location detail overlays the list
            instead of switching panels (the desktop R-pane → mobile Sheet). Uses
            the map/property non-blocking primitive (backdrop="none"): close via
            the header Close or drag-down, list underneath stays live. Breadcrumb
            (lateral trail) rides the header above the entity name. Portals to
            body, so it sits outside BaseDrawer in the tree. */}
        {isMobile && (
            <Sheet
                isOpen={detailSheetOpen}
                onClose={handleBack}
                height="fit"
                maxHeight={60}
                backdrop="none"
                title={detailTitle}
                titleNode={sheetTitleNode}
                rightContent={detailHeaderActions}
                hideClose={!!detailHeaderActions}
                // Portals to body — must clear the mobileFullScreen drawer
                // (z-60). Matches the overlay-sheet convention (Property/Map).
                zIndex={1200}
            >
                {renderDetailContent(true)}
            </Sheet>
        )}

        {/* Mobile hierarchy Sheet — the cluster echelon tree (AdminSummary, the
            same component as the desktop left pane), opened by the header pill.
            Selecting a cluster/user navigates to its detail Sheet + closes this
            one (map "Layers" pattern). Fixed-height wrapper so AdminSummary's
            h-full flex layout + internal scroll work inside the fit Sheet. */}
        {isMobile && (
            <Sheet
                isOpen={showTreeSheet}
                onClose={() => setShowTreeSheet(false)}
                height="fit"
                maxHeight={60}
                backdrop="dismiss"
                title="Hierarchy"
                // Same as the detail Sheet — clear the z-60 full-screen drawer.
                zIndex={1200}
            >
                <div style={{ height: '52dvh' }} className="flex flex-col">
                    <AdminSummary
                        treeOnly
                        onSelectClinic={closeTreeThen(handleSelectClinic)}
                        onSelectUser={closeTreeThen(handleSelectUser)}
                        onEditClinic={closeTreeThen(handleEditClinic)}
                        onEditUser={closeTreeThen(handleEditUser)}
                        onChatUser={isDevRole ? closeTreeThen((u: AdminUser) => handleSelectSystemPeer(u.id)) : undefined}
                        onSelectAll={() => setShowTreeSheet(false)}
                        onSwitchTab={closeTreeThen(handleSummarySwitchTab)}
                        activeClinicId={selectedClinic?.id}
                        activeUserId={selectedUser?.id}
                        allSelected={view === 'admin'}
                    />
                </div>
            </Sheet>
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
