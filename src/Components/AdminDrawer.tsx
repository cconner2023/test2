import { useState, useCallback, useMemo, useEffect } from 'react'
import { Plus, Building2, X, Inbox, Users, ChevronLeft, MessageCircleQuestion, MapPin } from 'lucide-react'
import { BaseDrawer, ScrollPane } from './BaseDrawer'
import { MobileSearchBar } from './MobileSearchBar'
import { HeaderPill, PillButton } from './HeaderPill'
import { DetailHeaderActions } from './Admin/DetailHeaderActions'
import { useDetailEditState } from '../Hooks/useDetailEditState'
import { ContentWrapper } from './ContentWrapper'
import { ConfirmDialog } from './ConfirmDialog'
import { Z } from './BaseOverlay'
import { ActionSheet } from './ActionSheet'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import { UI_TIMING } from '../Utilities/constants'
import { deleteClinic, deleteUser, listAllUsers, listClinics, listLocations } from '../lib/adminService'
import { useAuthStore } from '../stores/useAuthStore'
import { invalidate } from '../stores/useInvalidationStore'

// Admin sub-components
import { AdminRequestsList } from './Admin/AdminRequestsList'
import { AdminUsersList } from './Admin/AdminUsersList'
import { AdminUserDetail } from './Admin/AdminUserDetail'
import { AdminClinicsList } from './Admin/AdminClinicsList'
import { AdminClinicDetail } from './Admin/AdminClinicDetail'
import { AdminLocationsList } from './Admin/AdminLocationsList'
import { AdminLocationDetail } from './Admin/AdminLocationDetail'
import { AdminSummary } from './Admin/AdminSummary'
import { AdminFeatureVotesSection } from './Admin/AdminFeatureVotesSection'
import type { AdminUser, AdminClinic, AdminLocation } from '../lib/adminService'
import type { AccountRequest } from '../lib/accountRequestService'

export type AdminView =
    | 'admin'
    | 'admin-user-detail'
    | 'admin-clinic-detail'
    | 'admin-location-detail'

const ALL_TABS = ['requests', 'users', 'clinics', 'locations', 'feature-votes'] as const
type AdminTab = typeof ALL_TABS[number]

const TAB_ICONS: Record<AdminTab, typeof Inbox> = {
    requests: Inbox,
    users: Users,
    clinics: Building2,
    locations: MapPin,
    'feature-votes': MessageCircleQuestion,
}

const TAB_LABELS: Record<AdminTab, string> = {
    requests: 'Requests',
    users: 'Users',
    clinics: 'Clinics',
    locations: 'Locations',
    'feature-votes': 'Feature Votes',
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

    // User & clinic detail edit/delete state — symmetric, see useDetailEditState
    const userEdit = useDetailEditState()
    const clinicEdit = useDetailEditState()
    const locationEdit = useDetailEditState()

    // Search state
    const [searchQuery, setSearchQuery] = useState('')
    const [searchFocused, setSearchFocused] = useState(false)

    // FAB action sheet
    const [showAddSheet, setShowAddSheet] = useState(false)

    // Discard pending changes confirmation
    const [confirmDiscard, setConfirmDiscard] = useState(false)

    // Clear search when navigating between views (e.g., clicking a search result)
    useEffect(() => { setSearchQuery(''); setSearchFocused(false) }, [view])

    const isMobile = useIsMobile()
    const currentUserId = useAuthStore(s => s.user?.id ?? null)
    const isDevRole = useAuthStore(s => s.isDevRole)
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

    // Navigation handlers
    const handleSelectUser = useCallback((user: AdminUser) => {
        setSelectedUser(user)
        userEdit.setEditing(false)
        userEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-user-detail')
    }, [handleSlideAnimation, userEdit])

    const handleEditUser = useCallback((user: AdminUser) => {
        setSelectedUser(user)
        userEdit.setEditing(true)
        userEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-user-detail')
    }, [handleSlideAnimation, userEdit])

    const handleCreateUser = useCallback(() => {
        setSelectedUser(null)
        userEdit.setEditing(true)
        userEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-user-detail')
    }, [handleSlideAnimation, userEdit])

    const handleSelectClinic = useCallback((clinic: AdminClinic) => {
        setSelectedClinic(clinic)
        clinicEdit.setEditing(false)
        clinicEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-clinic-detail')
    }, [handleSlideAnimation, clinicEdit])

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
        setSelectedClinic(clinic)
        clinicEdit.setEditing(true)
        clinicEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-clinic-detail')
    }, [handleSlideAnimation, clinicEdit])

    const handleCreateClinic = useCallback(() => {
        setSelectedClinic(null)
        clinicEdit.setEditing(true)
        clinicEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-clinic-detail')
    }, [handleSlideAnimation, clinicEdit])

    const handleSelectLocation = useCallback((loc: AdminLocation) => {
        setSelectedLocation(loc)
        locationEdit.setEditing(false)
        locationEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-location-detail')
    }, [handleSlideAnimation, locationEdit])

    const handleCreateLocation = useCallback(() => {
        setSelectedLocation(null)
        locationEdit.setEditing(true)
        locationEdit.setHasPending(false)
        handleSlideAnimation('left')
        setView('admin-location-detail')
    }, [handleSlideAnimation, locationEdit])

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
        }
    }, [view, handleSlideAnimation, clinicEdit, userEdit, locationEdit])

    const handleBack = useCallback(() => {
        if (userEdit.hasPending || clinicEdit.hasPending || locationEdit.hasPending) {
            setConfirmDiscard(true)
            return
        }
        navigateBack()
    }, [userEdit.hasPending, clinicEdit.hasPending, locationEdit.hasPending, navigateBack])

    const handleDiscardConfirmed = useCallback(() => {
        setConfirmDiscard(false)
        navigateBack()
    }, [navigateBack])

    const handleClose = useCallback(() => {
        setView('admin')
        setActiveTab('requests')
        setSelectedUser(null)
        setSelectedClinic(null)
        setSelectedLocation(null)
        setSlideDirection('')
        setSearchQuery('')
        clinicEdit.reset()
        userEdit.reset()
        locationEdit.reset()
        onClose()
    }, [onClose, clinicEdit, userEdit, locationEdit])

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

    // Sidebar summary handlers
    const handleSummarySwitchTab = useCallback((tab: 'requests' | 'users' | 'clinics') => {
        setActiveTab(tab)
        if (view !== 'admin') {
            setView('admin')
            setSelectedUser(null)
            setSelectedClinic(null)
        }
    }, [view])

    const handleTabChange = useCallback((tab: AdminTab) => {
        setActiveTab(tab)
    }, [])

    // Header actions for main 'admin' view
    const mainHeaderActions = useMemo(() => {
        if (view !== 'admin') return undefined
        return (
            <HeaderPill>
                <PillButton icon={X} onClick={handleClose} label="Close" />
            </HeaderPill>
        )
    }, [view, handleClose])

    const isUserCreateMode = view === 'admin-user-detail' && selectedUser === null
    const isClinicCreateMode = view === 'admin-clinic-detail' && selectedClinic === null
    const isLocationCreateMode = view === 'admin-location-detail' && selectedLocation === null
    const isDetailView = view === 'admin-user-detail' || view === 'admin-clinic-detail' || view === 'admin-location-detail'
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
        return ''
    }, [view, selectedUser, selectedClinic, selectedLocation])

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
                    onClose={handleClose}
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
                    onClose={handleClose}
                    showCloseWhenIdle={isMobile}
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
                    onClose={handleClose}
                    showCloseWhenIdle={isMobile}
                />
            )
        }
        return undefined
    }, [view, selectedUser, userEdit, clinicEdit, locationEdit, isUserCreateMode, isClinicCreateMode, isLocationCreateMode, handleClose, currentUserId, isMobile])

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
            case 'admin':
                return {
                    title: 'Admin Panel',
                    rightContent: mainHeaderActions,
                    hideDefaultClose: !!mainHeaderActions,
                }
            case 'admin-user-detail':
                return {
                    title: detailTitle,
                    showBack: true,
                    onBack: handleBack,
                    rightContent: detailHeaderActions,
                    hideDefaultClose: !!detailHeaderActions,
                }
            case 'admin-clinic-detail':
                return {
                    title: detailTitle,
                    showBack: true,
                    onBack: handleBack,
                    rightContent: detailHeaderActions,
                    hideDefaultClose: !!detailHeaderActions,
                }
            case 'admin-location-detail':
                return {
                    title: detailTitle,
                    showBack: true,
                    onBack: handleBack,
                    rightContent: detailHeaderActions,
                    hideDefaultClose: !!detailHeaderActions,
                }
        }
    }, [isMobile, view, detailTitle, handleBack, detailHeaderActions, mainHeaderActions])


    // After creating a user, load full user and switch to view mode
    const handleUserCreated = useCallback(async (userId: string) => {
        const users = await listAllUsers()
        const newUser = users.find(u => u.id === userId)
        if (newUser) {
            setSelectedUser(newUser)
            userEdit.setEditing(false)
        } else {
            handleBack()
        }
        invalidate('users')
    }, [handleBack, userEdit])

    // After creating a clinic, load full clinic and switch to view mode
    const handleClinicCreated = useCallback(async (clinicId: string) => {
        const clinics = await listClinics()
        const newClinic = clinics.find(c => c.id === clinicId)
        if (newClinic) {
            setSelectedClinic(newClinic)
            clinicEdit.setEditing(false)
        } else {
            handleBack()
        }
        invalidate('clinics')
    }, [handleBack, clinicEdit])

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
    const renderDetailContent = () => {
        if (view === 'admin-user-detail') {
            return (
                <ScrollPane>
                    <AdminUserDetail
                        user={selectedUser}
                        onUserUpdated={(u) => setSelectedUser(u)}
                        onCreated={handleUserCreated}
                        onSelectClinic={handleSelectClinic}
                        editing={userEdit.editing}
                        onEditingChange={userEdit.setEditing}
                        saveRequested={userEdit.saveRequested}
                        onSaveComplete={userEdit.completeSave}
                        onPendingChangesChange={userEdit.setHasPending}
                        onRequestDelete={selectedUser && currentUserId !== selectedUser.id ? userEdit.requestDelete : undefined}
                    />
                </ScrollPane>
            )
        }
        if (view === 'admin-clinic-detail') {
            return (
                <ScrollPane>
                    <AdminClinicDetail
                        clinic={selectedClinic}
                        onClinicUpdated={(c) => setSelectedClinic(c)}
                        onSelectUser={handleSelectUser}
                        onSelectClinic={handleSelectClinic}
                        onCreated={handleClinicCreated}
                        editing={clinicEdit.editing}
                        onEditingChange={clinicEdit.setEditing}
                        saveRequested={clinicEdit.saveRequested}
                        onSaveComplete={clinicEdit.completeSave}
                        onPendingChangesChange={clinicEdit.setHasPending}
                    />
                </ScrollPane>
            )
        }
        if (view === 'admin-location-detail') {
            return (
                <ScrollPane>
                    <div className="px-5 pt-4 pb-8">
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
                        />
                    </div>
                </ScrollPane>
            )
        }
        return null
    }

    // Render active content — mobile slides between main and detail via `view`.
    const renderContent = () => {
        if (view === 'admin-user-detail' || view === 'admin-clinic-detail' || view === 'admin-location-detail') {
            return renderDetailContent()
        }
        return renderMainView()
    }

    // ActionSheet options per tab
    const addSheetOptions = useMemo(() => {
        const options: Array<{ key: string; label: string; onAction: () => void }> = []
        if (activeTab === 'feature-votes') return options
        if (activeTab === 'locations') {
            options.push({ key: 'location', label: 'New Location', onAction: () => { setShowAddSheet(false); handleCreateLocation() } })
            return options
        }
        if (activeTab !== 'clinics') {
            options.push({ key: 'user', label: 'New User', onAction: () => { setShowAddSheet(false); handleCreateUser() } })
        }
        if (activeTab !== 'users') {
            options.push({ key: 'clinic', label: 'New Cluster', onAction: () => { setShowAddSheet(false); handleCreateClinic() } })
        }
        return options
    }, [activeTab, handleCreateUser, handleCreateClinic, handleCreateLocation])

    // Bottom island — tab switcher (centered) + FAB (right), matching Property/Calendar pattern
    const bottomIsland = (
        <div className="absolute bottom-4 inset-x-0 flex items-center justify-center z-20 pointer-events-none pb-[max(0rem,var(--sab,0px))]">
            {/* Centered tab switcher */}
            <div
                role="tablist"
                aria-label="Admin sections"
                className="bg-themewhite2/90 dark:bg-themewhite3/90 backdrop-blur-sm rounded-full shadow-sm border border-tertiary/10 flex items-center p-1 gap-1 pointer-events-auto"
            >
                {visibleTabs.map((tab) => {
                    const TabIcon = TAB_ICONS[tab]
                    const label = TAB_LABELS[tab]
                    const selected = activeTab === tab
                    return (
                        <button
                            key={tab}
                            role="tab"
                            aria-selected={selected}
                            onClick={() => handleTabChange(tab)}
                            aria-label={label}
                            title={label}
                            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
                                selected
                                    ? 'bg-themeblue2 text-white shadow-sm'
                                    : 'text-tertiary hover:text-primary'
                            }`}
                        >
                            <TabIcon size={18} />
                        </button>
                    )
                })}
            </div>

            {/* FAB — absolute right, aligned to island. Hidden on tabs that don't create entities (requests = approval workflow, feature-votes = inline mgmt). */}
            {activeTab !== 'feature-votes' && activeTab !== 'requests' && !(activeTab === 'locations' && !isDevRole) && (
                <div className="absolute right-4 rounded-full border border-tertiary/20 p-0.5 bg-themewhite shadow-lg pointer-events-auto">
                    <button
                        onClick={() => setShowAddSheet(true)}
                        className="w-11 h-11 rounded-full bg-themeblue3 text-white flex items-center justify-center active:scale-95 transition-all duration-200"
                        title="Add new"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    )

    // Shared: list content for active tab (no search wrapper)
    const renderTabLists = () => (
        <>
            {activeTab === 'requests' && (
                <AdminRequestsList
                    searchQuery={searchQuery}
                    onApproved={handleRequestApproved}
                />
            )}
            {activeTab === 'users' && (
                <AdminUsersList
                    onSelectUser={handleSelectUser}
                    onEditUser={handleEditUser}
                    onCreateUser={handleCreateUser}
                    searchQuery={searchQuery}
                />
            )}
            {activeTab === 'clinics' && (
                <AdminClinicsList
                    onSelectClinic={handleSelectClinic}
                    onEditClinic={handleEditClinic}
                    onCreateClinic={handleCreateClinic}
                    searchQuery={searchQuery}
                />
            )}
            {activeTab === 'locations' && isDevRole && (
                <AdminLocationsList
                    onSelectLocation={handleSelectLocation}
                    onCreateLocation={handleCreateLocation}
                    searchQuery={searchQuery}
                />
            )}
            {activeTab === 'feature-votes' && isDevRole && (
                <AdminFeatureVotesSection />
            )}
        </>
    )

    // Shared: unified search results across all tabs
    const renderSearchResults = () => (
        <div className="px-5 pt-4 pb-4">
            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-themeblue3/10">
                <AdminRequestsList
                    searchQuery={searchQuery}
                    bare
                    onApproved={handleRequestApproved}
                />
                <AdminUsersList
                    onSelectUser={handleSelectUser}
                    onEditUser={handleEditUser}
                    onCreateUser={handleCreateUser}
                    searchQuery={searchQuery}
                    bare
                />
                <AdminClinicsList
                    onSelectClinic={handleSelectClinic}
                    onEditClinic={handleEditClinic}
                    onCreateClinic={handleCreateClinic}
                    searchQuery={searchQuery}
                    bare
                />
            </div>
        </div>
    )

    const renderMainView = () => (
        isMobile ? (
            // Mobile: MobileSearchBar wraps content, island absolute over it
            <div className="relative h-full">
                <MobileSearchBar variant="admin" value={searchQuery} onChange={setSearchQuery} onFocusChange={setSearchFocused}>
                    {searchQuery.trim() ? renderSearchResults() : renderTabLists()}
                </MobileSearchBar>
                {bottomIsland}
            </div>
        ) : (
            // Desktop: scrollable content + absolute-positioned island (like Property)
            <div className="relative h-full">
                <div className="h-full overflow-y-auto">
                    {searchQuery.trim() ? renderSearchResults() : renderTabLists()}
                </div>
                {bottomIsland}
            </div>
        )
    )

    return (
        <>
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            fullHeight="90dvh"
            desktopPosition="left"
            desktopWidth="w-[90%]"
            header={headerConfig}
            headerFaded={searchFocused}
            scrollDisabled
        >
            <ContentWrapper slideDirection={isMobile ? slideDirection : ''} swipeHandlers={isMobile && view !== 'admin' ? swipeHandlers : undefined}>
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
                                <MobileSearchBar
                                    variant="admin"
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                    placeholder="Search..."
                                    onFocusChange={setSearchFocused}
                                >
                                    <AdminSummary
                                        onSelectClinic={handleSelectClinic}
                                        onSelectUser={handleSelectUser}
                                        onSelectAll={() => { setView('admin'); setSelectedUser(null); setSelectedClinic(null) }}
                                        onSwitchTab={handleSummarySwitchTab}
                                        activeClinicId={selectedClinic?.id}
                                        activeUserId={selectedUser?.id}
                                        allSelected={view === 'admin'}
                                    />
                                </MobileSearchBar>
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
                                    <h2 className="flex-1 min-w-0 truncate text-[11pt] font-semibold text-primary">
                                        {detailTitle}
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

        {/* Discard unsaved changes confirmation */}
        <ConfirmDialog
            visible={confirmDiscard}
            title="Discard changes?"
            subtitle="Your unsaved changes will be lost."
            confirmLabel="Discard"
            variant="danger"
            onConfirm={handleDiscardConfirmed}
            onCancel={() => setConfirmDiscard(false)}
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
            zIndex={Z.POPOVER + 30}
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
            zIndex={Z.POPOVER + 30}
        />
        </>
    )
}
