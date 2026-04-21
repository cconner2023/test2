import { useState, useCallback, useMemo, useEffect } from 'react'
import { Pencil, Plus, Building2, Trash2, X, Inbox, Users, Check } from 'lucide-react'
import { BaseDrawer, ScrollPane } from './BaseDrawer'
import { MobileSearchBar } from './MobileSearchBar'
import { HeaderPill, PillButton } from './HeaderPill'
import { ContentWrapper } from './ContentWrapper'
import { ConfirmDialog } from './ConfirmDialog'
import { ActionSheet } from './ActionSheet'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import { UI_TIMING } from '../Utilities/constants'
import { deleteClinic, deleteUser, listAllUsers, listClinics } from '../lib/adminService'
import { useAuthStore } from '../stores/useAuthStore'
import { invalidate } from '../stores/useInvalidationStore'

// Admin sub-components
import { AdminRequestsList } from './Admin/AdminRequestsList'
import { AdminUsersList } from './Admin/AdminUsersList'
import { AdminUserDetail } from './Admin/AdminUserDetail'
import { AdminClinicsList } from './Admin/AdminClinicsList'
import { AdminClinicDetail } from './Admin/AdminClinicDetail'
import { AdminSummary } from './Admin/AdminSummary'
import type { AdminUser, AdminClinic } from '../lib/adminService'
import type { AccountRequest } from '../lib/accountRequestService'

export type AdminView =
    | 'admin'
    | 'admin-user-detail'
    | 'admin-clinic-detail'

const TABS = ['requests', 'users', 'clinics'] as const
type AdminTab = typeof TABS[number]

const TAB_ICONS: Record<AdminTab, typeof Inbox> = {
    requests: Inbox,
    users: Users,
    clinics: Building2,
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

    // Clinic delete confirmation (triggered from header pill)
    const [confirmDeleteClinic, setConfirmDeleteClinic] = useState(false)
    const [deleteClinicProcessing, setDeleteClinicProcessing] = useState(false)

    // Clinic edit state (Settings toolbar pattern)
    const [clinicEditing, setClinicEditing] = useState(false)
    const [clinicSaveRequested, setClinicSaveRequested] = useState(false)
    const [clinicHasPending, setClinicHasPending] = useState(false)

    // User edit state (Settings toolbar pattern)
    const [userEditing, setUserEditing] = useState(false)
    const [userSaveRequested, setUserSaveRequested] = useState(false)
    const [userHasPending, setUserHasPending] = useState(false)

    // User delete confirmation (moved from AdminUserDetail to header)
    const [confirmDeleteUser, setConfirmDeleteUser] = useState(false)
    const [deleteUserProcessing, setDeleteUserProcessing] = useState(false)

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

    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        setSlideDirection(direction)
        setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION)
    }, [])

    // Navigation handlers
    const handleSelectUser = useCallback((user: AdminUser) => {
        setSelectedUser(user)
        setUserEditing(false)
        setUserHasPending(false)
        handleSlideAnimation('left')
        setView('admin-user-detail')
    }, [handleSlideAnimation])

    const handleEditUser = useCallback((user: AdminUser) => {
        setSelectedUser(user)
        setUserEditing(true)
        setUserHasPending(false)
        handleSlideAnimation('left')
        setView('admin-user-detail')
    }, [handleSlideAnimation])

    const handleCreateUser = useCallback(() => {
        setSelectedUser(null)
        setUserEditing(true)
        setUserHasPending(false)
        handleSlideAnimation('left')
        setView('admin-user-detail')
    }, [handleSlideAnimation])

    const handleSelectClinic = useCallback((clinic: AdminClinic) => {
        setSelectedClinic(clinic)
        setClinicEditing(false)
        setClinicHasPending(false)
        handleSlideAnimation('left')
        setView('admin-clinic-detail')
    }, [handleSlideAnimation])

    const handleRequestApproved = useCallback((
        userId: string,
        request: AccountRequest,
        configured: { roles: string[]; clinicId: string | null },
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
            created_at: new Date().toISOString(),
            last_active_at: null,
            avatar_id: null,
        }
        handleSelectUser(newUser)
        invalidate('requests', 'users')
    }, [handleSelectUser])

    const handleEditClinic = useCallback((clinic: AdminClinic) => {
        setSelectedClinic(clinic)
        setClinicEditing(true)
        setClinicHasPending(false)
        handleSlideAnimation('left')
        setView('admin-clinic-detail')
    }, [handleSlideAnimation])

    const handleCreateClinic = useCallback(() => {
        setSelectedClinic(null)
        setClinicEditing(true)
        setClinicHasPending(false)
        handleSlideAnimation('left')
        setView('admin-clinic-detail')
    }, [handleSlideAnimation])

    const navigateBack = useCallback(() => {
        setClinicEditing(false); setClinicSaveRequested(false); setClinicHasPending(false)
        setUserEditing(false); setUserSaveRequested(false); setUserHasPending(false)
        if (view !== 'admin') {
            handleSlideAnimation('right')
            setView('admin')
            setSelectedUser(null)
            setSelectedClinic(null)
        }
    }, [view, handleSlideAnimation])

    const handleBack = useCallback(() => {
        if (userHasPending || clinicHasPending) {
            setConfirmDiscard(true)
            return
        }
        navigateBack()
    }, [userHasPending, clinicHasPending, navigateBack])

    const handleDiscardConfirmed = useCallback(() => {
        setConfirmDiscard(false)
        navigateBack()
    }, [navigateBack])

    const handleClose = useCallback(() => {
        setView('admin')
        setActiveTab('requests')
        setSelectedUser(null)
        setSelectedClinic(null)
        setSlideDirection('')
        setConfirmDeleteClinic(false)
        setConfirmDeleteUser(false)
        setSearchQuery('')
        // Reset editing state
        setClinicEditing(false); setClinicSaveRequested(false); setClinicHasPending(false)
        setUserEditing(false); setUserSaveRequested(false); setUserHasPending(false)
        onClose()
    }, [onClose])

    const handleDeleteClinic = useCallback(async () => {
        if (!selectedClinic) return
        setDeleteClinicProcessing(true)
        const result = await deleteClinic(selectedClinic.id)
        setDeleteClinicProcessing(false)
        setConfirmDeleteClinic(false)
        if (result.success) {
            invalidate('clinics', 'users')
            navigateBack()
        }
    }, [selectedClinic, navigateBack])

    const handleDeleteUser = useCallback(async () => {
        if (!selectedUser) return
        setDeleteUserProcessing(true)
        const result = await deleteUser(selectedUser.id)
        setDeleteUserProcessing(false)
        setConfirmDeleteUser(false)
        if (result.success) {
            invalidate('users', 'clinics', 'requests')
            navigateBack()
        }
    }, [selectedUser, navigateBack])

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

    // Header actions for detail views (handles both view/edit and create modes)
    const detailHeaderActions = useMemo(() => {
        if (view === 'admin-user-detail') {
            return (
                <HeaderPill>
                    {/* Cancel — visible when editing (in create mode, back button handles cancel) */}
                    {!isUserCreateMode && (
                        <div className={'flex items-center overflow-hidden transition-all duration-200 ease-out ' + (userEditing ? 'max-w-16 opacity-100' : 'max-w-0 opacity-0')}>
                            <PillButton
                                icon={X}
                                iconSize={18}
                                onClick={() => setUserEditing(false)}
                                label="Cancel"
                            />
                        </div>
                    )}

                    {/* Edit — visible when NOT editing, hidden in create mode */}
                    {!isUserCreateMode && (
                        <div className={'flex items-center overflow-hidden transition-all duration-200 ease-out ' + (!userEditing ? 'max-w-12 opacity-100' : 'max-w-0 opacity-0')}>
                            <PillButton
                                icon={Pencil}
                                iconSize={18}
                                onClick={() => setUserEditing(true)}
                                label="Edit"
                            />
                        </div>
                    )}

                    {/* Delete — visible when editing existing user, only for non-self */}
                    {userEditing && !isUserCreateMode && selectedUser && currentUserId !== selectedUser.id && (
                        <PillButton
                            icon={Trash2}
                            iconSize={18}
                            onClick={() => setConfirmDeleteUser(true)}
                            label="Delete"
                        />
                    )}

                    {/* Save / Close */}
                    {userEditing ? (
                        <PillButton
                            icon={Check}
                            iconSize={18}
                            circleBg="bg-themegreen text-white"
                            onClick={() => setUserSaveRequested(true)}
                            label="Save"
                        />
                    ) : (
                        <PillButton icon={X} onClick={handleClose} label="Close" />
                    )}
                </HeaderPill>
            )
        }

        if (view === 'admin-clinic-detail') {
            return (
                <HeaderPill>
                    {/* Cancel — visible when editing, hidden in create mode */}
                    {!isClinicCreateMode && (
                        <div className={'flex items-center overflow-hidden transition-all duration-200 ease-out ' + (clinicEditing ? 'max-w-16 opacity-100' : 'max-w-0 opacity-0')}>
                            <PillButton
                                icon={X}
                                iconSize={18}
                                onClick={() => setClinicEditing(false)}
                                label="Cancel"
                            />
                        </div>
                    )}

                    {/* Edit — visible when NOT editing, hidden in create mode */}
                    {!isClinicCreateMode && (
                        <div className={'flex items-center overflow-hidden transition-all duration-200 ease-out ' + (!clinicEditing ? 'max-w-12 opacity-100' : 'max-w-0 opacity-0')}>
                            <PillButton
                                icon={Pencil}
                                iconSize={18}
                                onClick={() => setClinicEditing(true)}
                                label="Edit"
                            />
                        </div>
                    )}

                    {/* Delete — visible when editing existing clinic */}
                    {clinicEditing && !isClinicCreateMode && (
                        <PillButton
                            icon={Trash2}
                            iconSize={18}
                            onClick={() => setConfirmDeleteClinic(true)}
                            label="Delete"
                        />
                    )}

                    {/* Save / Close */}
                    {clinicEditing ? (
                        <PillButton
                            icon={Check}
                            iconSize={18}
                            circleBg="bg-themegreen text-white"
                            onClick={() => setClinicSaveRequested(true)}
                            label="Save"
                        />
                    ) : (
                        <PillButton icon={X} onClick={handleClose} label="Close" />
                    )}
                </HeaderPill>
            )
        }

        return undefined
    }, [view, selectedUser, selectedClinic, userEditing, clinicEditing, isUserCreateMode, isClinicCreateMode, handleClose, currentUserId])

    // Header config per view
    const headerConfig = useMemo(() => {
        switch (view) {
            case 'admin':
                return {
                    title: 'Admin Panel',
                    rightContent: mainHeaderActions,
                    hideDefaultClose: !!mainHeaderActions,
                }
            case 'admin-user-detail':
                return {
                    title: selectedUser
                        ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || 'User'
                        : 'New User',
                    showBack: true,
                    onBack: handleBack,
                    rightContent: detailHeaderActions,
                    hideDefaultClose: !!detailHeaderActions,
                }
            case 'admin-clinic-detail':
                return {
                    title: selectedClinic?.name || 'New Clinic',
                    showBack: true,
                    onBack: handleBack,
                    rightContent: detailHeaderActions,
                    hideDefaultClose: !!detailHeaderActions,
                }
        }
    }, [view, selectedUser, selectedClinic, handleBack, detailHeaderActions, mainHeaderActions])


    // After creating a user, load full user and switch to view mode
    const handleUserCreated = useCallback(async (userId: string) => {
        const users = await listAllUsers()
        const newUser = users.find(u => u.id === userId)
        if (newUser) {
            setSelectedUser(newUser)
            setUserEditing(false)
        } else {
            handleBack()
        }
        invalidate('users')
    }, [handleBack])

    // After creating a clinic, load full clinic and switch to view mode
    const handleClinicCreated = useCallback(async (clinicId: string) => {
        const clinics = await listClinics()
        const newClinic = clinics.find(c => c.id === clinicId)
        if (newClinic) {
            setSelectedClinic(newClinic)
            setClinicEditing(false)
        } else {
            handleBack()
        }
        invalidate('clinics')
    }, [handleBack])

    // Render active content
    const renderContent = () => {
        switch (view) {
            case 'admin-user-detail':
                return (
                    <ScrollPane>
                        <AdminUserDetail
                            user={selectedUser}
                            onUserUpdated={(u) => setSelectedUser(u)}
                            onCreated={handleUserCreated}
                            onSelectClinic={handleSelectClinic}
                            editing={userEditing}
                            onEditingChange={setUserEditing}
                            saveRequested={userSaveRequested}
                            onSaveComplete={() => setUserSaveRequested(false)}
                            onPendingChangesChange={setUserHasPending}
                        />
                    </ScrollPane>
                )

            case 'admin-clinic-detail':
                return (
                    <ScrollPane>
                        <AdminClinicDetail
                            clinic={selectedClinic}
                            onClinicUpdated={(c) => setSelectedClinic(c)}
                            onSelectUser={handleSelectUser}
                            onCreated={handleClinicCreated}
                            editing={clinicEditing}
                            onEditingChange={setClinicEditing}
                            saveRequested={clinicSaveRequested}
                            onSaveComplete={() => setClinicSaveRequested(false)}
                            onPendingChangesChange={setClinicHasPending}
                        />
                    </ScrollPane>
                )

            case 'admin':
            default:
                return renderMainView()
        }
    }

    // ActionSheet options per tab
    const addSheetOptions = useMemo(() => {
        const options = []
        if (activeTab !== 'clinics') {
            options.push({ key: 'user', label: 'New User', onAction: () => { setShowAddSheet(false); handleCreateUser() } })
        }
        if (activeTab !== 'users') {
            options.push({ key: 'clinic', label: 'New Clinic', onAction: () => { setShowAddSheet(false); handleCreateClinic() } })
        }
        return options
    }, [activeTab, handleCreateUser, handleCreateClinic])

    // Bottom island — tab switcher (centered) + FAB (right), matching Property/Calendar pattern
    const bottomIsland = (
        <div className="absolute bottom-4 inset-x-0 flex items-center justify-center z-20 pointer-events-none pb-[max(0rem,var(--sab,0px))]">
            {/* Centered tab switcher */}
            <div className="bg-themewhite2/90 dark:bg-themewhite3/90 backdrop-blur-sm rounded-full shadow-sm border border-tertiary/10 flex items-center p-1 gap-1 pointer-events-auto">
                {TABS.map((tab) => {
                    const TabIcon = TAB_ICONS[tab]
                    const label = tab.charAt(0).toUpperCase() + tab.slice(1)
                    return (
                        <button
                            key={tab}
                            onClick={() => handleTabChange(tab)}
                            aria-label={label}
                            title={label}
                            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
                                activeTab === tab
                                    ? 'bg-themeblue2 text-white shadow-sm'
                                    : 'text-tertiary hover:text-primary'
                            }`}
                        >
                            <TabIcon size={18} />
                        </button>
                    )
                })}
            </div>

            {/* FAB — absolute right, aligned to island */}
            <div className="absolute right-4 rounded-full border border-tertiary/20 p-0.5 bg-themewhite shadow-lg pointer-events-auto">
                <button
                    onClick={() => setShowAddSheet(true)}
                    className="w-11 h-11 rounded-full bg-themeblue3 text-white flex items-center justify-center active:scale-95 transition-all duration-200"
                    title="Add new"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>
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
                    {/* Desktop: split pane layout */}
                    {!isMobile ? (
                        <div className="flex h-full">
                            <div className="w-[260px] shrink-0 border-r border-tertiary/10 flex flex-col bg-themewhite3/50">
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
                                {renderContent()}
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
            visible={confirmDeleteClinic}
            title={`Delete ${selectedClinic?.name ?? 'clinic'}?`}
            subtitle="Permanent. All associated data removed."
            confirmLabel="Delete"
            variant="danger"
            processing={deleteClinicProcessing}
            onConfirm={handleDeleteClinic}
            onCancel={() => setConfirmDeleteClinic(false)}
        />

        {/* User delete confirmation — triggered from header pill */}
        <ConfirmDialog
            visible={confirmDeleteUser}
            title={`Delete ${selectedUser?.first_name ?? ''} ${selectedUser?.last_name ?? 'user'}?`}
            subtitle="Permanent. All data removed — notes, training, sync queue."
            confirmLabel="Delete"
            variant="danger"
            processing={deleteUserProcessing}
            onConfirm={handleDeleteUser}
            onCancel={() => setConfirmDeleteUser(false)}
        />
        </>
    )
}
