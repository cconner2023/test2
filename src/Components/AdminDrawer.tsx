import { useState, useCallback, useMemo, useEffect } from 'react'
import { Pencil, Plus, Building2, Trash2, X, Inbox, Users, Check } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { MobileSearchBar } from './MobileSearchBar'
import { HeaderPill, PillButton } from './HeaderPill'
import { ContentWrapper } from './Settings/ContentWrapper'
import { ConfirmDialog } from './ConfirmDialog'
import { ActionSheet } from './ActionSheet'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import { UI_TIMING } from '../Utilities/constants'
import { deleteClinic, deleteUser } from '../lib/adminService'
import { useAuthStore } from '../stores/useAuthStore'

// Admin sub-components
import { AdminRequestsList } from './Admin/AdminRequestsList'
import { AdminRequestDetail } from './Admin/AdminRequestDetail'
import { AdminUsersList } from './Admin/AdminUsersList'
import { AdminUserDetail } from './Admin/AdminUserDetail'
import AdminUserForm from './Admin/AdminUserForm'
import { AdminClinicsList } from './Admin/AdminClinicsList'
import AdminClinicDetail from './Admin/AdminClinicDetail'
import AdminClinicForm from './Admin/AdminClinicForm'
import { AdminTree } from './Admin/AdminTree'
import type { AdminUser, AdminClinic } from '../lib/adminService'
import type { AccountRequest } from '../lib/accountRequestService'

export type AdminView =
    | 'admin'
    | 'admin-user-detail'
    | 'admin-user-form'
    | 'admin-clinic-detail'
    | 'admin-clinic-form'
    | 'admin-request-detail'

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

    // Selected entity for detail/form views
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
    const [selectedClinic, setSelectedClinic] = useState<AdminClinic | null>(null)
    const [selectedRequest, setSelectedRequest] = useState<AccountRequest | null>(null)
    const [isEditMode, setIsEditMode] = useState(false)

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

    // Clear search when navigating between views (e.g., clicking a search result)
    useEffect(() => { setSearchQuery(''); setSearchFocused(false) }, [view])

    const isMobile = useIsMobile()

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
        setIsEditMode(true)
        handleSlideAnimation('left')
        setView('admin-user-form')
    }, [handleSlideAnimation])

    const handleCreateUser = useCallback(() => {
        setSelectedUser(null)
        setIsEditMode(false)
        handleSlideAnimation('left')
        setView('admin-user-form')
    }, [handleSlideAnimation])

    const handleSelectClinic = useCallback((clinic: AdminClinic) => {
        setSelectedClinic(clinic)
        setClinicEditing(false)
        setClinicHasPending(false)
        handleSlideAnimation('left')
        setView('admin-clinic-detail')
    }, [handleSlideAnimation])

    const handleSelectRequest = useCallback((request: AccountRequest) => {
        setSelectedRequest(request)
        handleSlideAnimation('left')
        setView('admin-request-detail')
    }, [handleSlideAnimation])

    const handleEditClinic = useCallback((clinic: AdminClinic) => {
        setSelectedClinic(clinic)
        setIsEditMode(true)
        handleSlideAnimation('left')
        setView('admin-clinic-form')
    }, [handleSlideAnimation])

    const handleCreateClinic = useCallback(() => {
        setSelectedClinic(null)
        setIsEditMode(false)
        handleSlideAnimation('left')
        setView('admin-clinic-form')
    }, [handleSlideAnimation])

    const handleBack = useCallback(() => {
        // Reset editing state
        setClinicEditing(false); setClinicSaveRequested(false); setClinicHasPending(false)
        setUserEditing(false); setUserSaveRequested(false); setUserHasPending(false)

        if (view === 'admin-user-form' && selectedUser) {
            handleSlideAnimation('right')
            setView('admin-user-detail')
        } else if (view === 'admin-clinic-form' && selectedClinic) {
            handleSlideAnimation('right')
            setView('admin-clinic-detail')
        } else if (view === 'admin-request-detail') {
            handleSlideAnimation('right')
            setView('admin')
            setSelectedRequest(null)
        } else if (view !== 'admin') {
            handleSlideAnimation('right')
            setView('admin')
            setSelectedUser(null)
            setSelectedClinic(null)
        }
    }, [view, selectedUser, selectedClinic, handleSlideAnimation])

    const handleClose = useCallback(() => {
        setView('admin')
        setActiveTab('requests')
        setSelectedUser(null)
        setSelectedClinic(null)
        setSelectedRequest(null)
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
            handleBack()
        }
    }, [selectedClinic, handleBack])

    const handleDeleteUser = useCallback(async () => {
        if (!selectedUser) return
        setDeleteUserProcessing(true)
        const result = await deleteUser(selectedUser.id)
        setDeleteUserProcessing(false)
        setConfirmDeleteUser(false)
        if (result.success) {
            handleBack()
        }
    }, [selectedUser, handleBack])

    // Swipe back for mobile
    const swipeHandlers = useSwipeBack(
        useMemo(() => {
            if (view === 'admin') return undefined
            return handleBack
        }, [view, handleBack]),
        view !== 'admin',
    )

    // Tree selection handlers
    const handleTreeSelectClinic = useCallback((clinic: AdminClinic | null) => {
        if (clinic) {
            handleSelectClinic(clinic)
        }
    }, [handleSelectClinic])

    const handleTreeSelectUser = useCallback((user: AdminUser) => {
        handleSelectUser(user)
    }, [handleSelectUser])

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

    // Header actions for detail/form views
    const detailHeaderActions = useMemo(() => {
        if (view === 'admin-user-detail' && selectedUser) {
            const currentUserId = useAuthStore.getState().user?.id ?? null
            return (
                <HeaderPill>
                    {/* Cancel — visible when editing */}
                    <div className={'flex items-center overflow-hidden transition-all duration-200 ease-out ' + (userEditing ? 'max-w-16 opacity-100' : 'max-w-0 opacity-0')}>
                        <PillButton
                            icon={X}
                            iconSize={18}
                            onClick={() => setUserEditing(false)}
                            label="Cancel"
                        />
                    </div>

                    {/* Edit — visible when NOT editing */}
                    <div className={'flex items-center overflow-hidden transition-all duration-200 ease-out ' + (!userEditing ? 'max-w-12 opacity-100' : 'max-w-0 opacity-0')}>
                        <PillButton
                            icon={Pencil}
                            iconSize={18}
                            onClick={() => setUserEditing(true)}
                            label="Edit"
                        />
                    </div>

                    {/* Delete — visible when editing, only for non-self */}
                    {userEditing && currentUserId !== selectedUser.id && (
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

        if (view === 'admin-clinic-detail' && selectedClinic) {
            return (
                <HeaderPill>
                    {/* Cancel — visible when editing */}
                    <div className={'flex items-center overflow-hidden transition-all duration-200 ease-out ' + (clinicEditing ? 'max-w-16 opacity-100' : 'max-w-0 opacity-0')}>
                        <PillButton
                            icon={X}
                            iconSize={18}
                            onClick={() => setClinicEditing(false)}
                            label="Cancel"
                        />
                    </div>

                    {/* Edit — visible when NOT editing */}
                    <div className={'flex items-center overflow-hidden transition-all duration-200 ease-out ' + (!clinicEditing ? 'max-w-12 opacity-100' : 'max-w-0 opacity-0')}>
                        <PillButton
                            icon={Pencil}
                            iconSize={18}
                            onClick={() => setClinicEditing(true)}
                            label="Edit"
                        />
                    </div>

                    {/* Delete — visible when editing */}
                    {clinicEditing && (
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
    }, [view, selectedUser, selectedClinic, userEditing, clinicEditing, handleClose])

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
                        : 'User',
                    showBack: true,
                    onBack: handleBack,
                    rightContent: detailHeaderActions,
                    hideDefaultClose: !!detailHeaderActions,
                }
            case 'admin-user-form':
                return {
                    title: selectedUser ? 'Edit User' : 'Create User',
                    showBack: true,
                    onBack: handleBack,
                }
            case 'admin-clinic-detail':
                return {
                    title: selectedClinic?.name || 'Clinic',
                    showBack: true,
                    onBack: handleBack,
                    rightContent: detailHeaderActions,
                    hideDefaultClose: !!detailHeaderActions,
                }
            case 'admin-clinic-form':
                return {
                    title: selectedClinic ? 'Edit Clinic' : 'Create Clinic',
                    showBack: true,
                    onBack: handleBack,
                }
            case 'admin-request-detail': {
                const reqName = selectedRequest
                    ? `${selectedRequest.first_name || ''} ${selectedRequest.last_name || ''}`.trim() || 'Request'
                    : 'Request'
                return { title: reqName, showBack: true, onBack: handleBack }
            }
        }
    }, [view, selectedUser, selectedClinic, selectedRequest, handleBack, detailHeaderActions, mainHeaderActions])

    // Scrollable padded wrapper for sub-views (detail/form)
    const subViewWrapper = (children: React.ReactNode) => (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5 pb-8">
                {children}
            </div>
        </div>
    )

    // Render active content
    const renderContent = () => {
        switch (view) {
            case 'admin-user-detail':
                return selectedUser ? subViewWrapper(
                    <AdminUserDetail
                        user={selectedUser}
                        onBack={handleBack}
                        onUserUpdated={(u) => setSelectedUser(u)}
                        editing={userEditing}
                        onEditingChange={setUserEditing}
                        saveRequested={userSaveRequested}
                        onSaveComplete={() => setUserSaveRequested(false)}
                        onPendingChangesChange={setUserHasPending}
                    />
                ) : null

            case 'admin-user-form':
                return subViewWrapper(
                    <AdminUserForm
                        user={selectedUser}
                        onBack={handleBack}
                        onSaved={() => {
                            handleBack()
                        }}
                    />
                )

            case 'admin-clinic-detail':
                return selectedClinic ? subViewWrapper(
                    <AdminClinicDetail
                        clinic={selectedClinic}
                        onClinicUpdated={(c) => setSelectedClinic(c)}
                        onSelectUser={handleSelectUser}
                        editing={clinicEditing}
                        onEditingChange={setClinicEditing}
                        saveRequested={clinicSaveRequested}
                        onSaveComplete={() => setClinicSaveRequested(false)}
                        onPendingChangesChange={setClinicHasPending}
                    />
                ) : null

            case 'admin-clinic-form':
                return subViewWrapper(
                    <AdminClinicForm
                        clinic={selectedClinic}
                        onBack={handleBack}
                        onSaved={() => {
                            handleBack()
                        }}
                    />
                )

            case 'admin-request-detail':
                return selectedRequest ? subViewWrapper(
                    <AdminRequestDetail
                        request={selectedRequest}
                        onApproved={(userId) => {
                            const newUser: AdminUser = {
                                id: userId,
                                email: selectedRequest.email,
                                first_name: selectedRequest.first_name,
                                last_name: selectedRequest.last_name,
                                middle_initial: selectedRequest.middle_initial ?? null,
                                credential: selectedRequest.credential ?? null,
                                component: selectedRequest.component ?? null,
                                rank: selectedRequest.rank ?? null,
                                uic: selectedRequest.uic ?? null,
                                roles: ['medic'],
                                clinic_id: null,
                                created_at: new Date().toISOString(),
                                last_active_at: null,
                                note_include_hpi: true,
                                note_include_pe: false,
                                pe_depth: 'standard',
                                avatar_id: null,
                            }
                            setSelectedRequest(null)
                            handleSelectUser(newUser)
                        }}
                        onRejected={() => {
                            setSelectedRequest(null)
                            setView('admin')
                        }}
                        onReopened={() => {
                            setSelectedRequest(null)
                            setView('admin')
                        }}
                    />
                ) : null

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
                                    : 'text-tertiary/70 hover:text-primary'
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
                    onSelectRequest={handleSelectRequest}
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
        <div className="px-5 pb-4">
            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-themeblue3/10">
                <AdminRequestsList
                    searchQuery={searchQuery}
                    bare
                    onSelectRequest={handleSelectRequest}
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
        <div className="relative h-full">
            {/* List content */}
            <div className="h-full min-h-0">
                {isMobile ? (
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
                )}
            </div>
        </div>
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
                                    <div className="shrink-0 px-4 py-3 border-b border-primary/10">
                                        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider px-2">Organization</p>
                                    </div>
                                    <div className="flex-1 overflow-y-auto">
                                        <AdminTree
                                            activeClinicId={null}
                                            activeUserId={null}
                                            onSelectClinic={handleTreeSelectClinic}
                                            onSelectUser={handleTreeSelectUser}
                                            onSelectAll={() => setView('admin')}
                                            allSelected={view === 'admin'}
                                            onMoveUser={(_userId, _clinicId) => {}}
                                            onMoveClinic={(_clinicId, _parentId) => {}}
                                        />
                                    </div>
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

        {/* Clinic delete confirmation — triggered from header pill */}
        <ConfirmDialog
            visible={confirmDeleteClinic}
            title={`Delete ${selectedClinic?.name ?? 'clinic'}?`}
            subtitle="This will permanently remove the clinic and all associated data. This action cannot be undone."
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
            subtitle="This will permanently delete this user and all associated data (notes, training, sync queue). This action cannot be undone."
            confirmLabel="Delete"
            variant="danger"
            processing={deleteUserProcessing}
            onConfirm={handleDeleteUser}
            onCancel={() => setConfirmDeleteUser(false)}
        />
        </>
    )
}
