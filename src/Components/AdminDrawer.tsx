import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Pencil, UserPlus, Building2, Trash2, X, Search, Inbox, Users } from 'lucide-react'
import { useSpring, animated } from '@react-spring/web'
import { BaseDrawer } from './BaseDrawer'
import { HeaderPill, PillButton, VerticalPill } from './HeaderPill'
import { ContentWrapper } from './Settings/ContentWrapper'
import { ConfirmDialog } from './ConfirmDialog'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import { UI_TIMING } from '../Utilities/constants'
import { deleteClinic } from '../lib/adminService'

// Admin sub-components
import { AdminRequestsList } from './Admin/AdminRequestsList'
import { AdminUsersList } from './Admin/AdminUsersList'
import { AdminUserDetail } from './Admin/AdminUserDetail'
import AdminUserForm from './Admin/AdminUserForm'
import { AdminClinicsList } from './Admin/AdminClinicsList'
import AdminClinicDetail from './Admin/AdminClinicDetail'
import AdminClinicForm from './Admin/AdminClinicForm'
import { AdminTree } from './Admin/AdminTree'
import type { AdminUser, AdminClinic } from '../lib/adminService'

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
    const [isEditMode, setIsEditMode] = useState(false)

    // Tree filter state (desktop)
    const [treeFilterClinicId, setTreeFilterClinicId] = useState<string | null>(null)
    const [treeFilterUserId, setTreeFilterUserId] = useState<string | null>(null)

    // Clinic delete confirmation (triggered from header pill)
    const [confirmDeleteClinic, setConfirmDeleteClinic] = useState(false)
    const [deleteClinicProcessing, setDeleteClinicProcessing] = useState(false)

    // Search state
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearchExpanded, setIsSearchExpanded] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)

    const isMobile = useIsMobile()

    // Spring for search expand/collapse
    const searchSpring = useSpring({
        progress: isSearchExpanded ? 1 : 0,
        config: { tension: 260, friction: 26 },
    })

    // Focus input when search expands
    useEffect(() => {
        if (isSearchExpanded && searchInputRef.current) {
            searchInputRef.current.focus()
        }
    }, [isSearchExpanded])

    const collapseSearch = useCallback(() => {
        setSearchQuery('')
        setIsSearchExpanded(false)
    }, [])

    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        setSlideDirection(direction)
        setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION)
    }, [])

    // Navigation handlers
    const handleSelectUser = useCallback((user: AdminUser) => {
        setSelectedUser(user)
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
        handleSlideAnimation('left')
        setView('admin-clinic-detail')
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
        if (view === 'admin-user-form' && selectedUser) {
            handleSlideAnimation('right')
            setView('admin-user-detail')
        } else if (view === 'admin-clinic-form' && selectedClinic) {
            handleSlideAnimation('right')
            setView('admin-clinic-detail')
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
        setSlideDirection('')
        setTreeFilterClinicId(null)
        setTreeFilterUserId(null)
        setConfirmDeleteClinic(false)
        collapseSearch()
        onClose()
    }, [onClose, collapseSearch])

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

    // Swipe back for mobile
    const swipeHandlers = useSwipeBack(
        useMemo(() => {
            if (view === 'admin') return undefined
            return handleBack
        }, [view, handleBack]),
        view !== 'admin',
    )

    // Tree selection handlers
    const handleTreeSelectClinic = useCallback((clinicId: string | null) => {
        setTreeFilterClinicId(clinicId)
        setTreeFilterUserId(null)
        if (clinicId) setActiveTab('clinics')
    }, [])

    const handleTreeSelectUser = useCallback((userId: string) => {
        setTreeFilterUserId(userId)
        setTreeFilterClinicId(null)
        setActiveTab('users')
    }, [])

    const handleTabChange = useCallback((tab: AdminTab) => {
        setActiveTab(tab)
        setTreeFilterClinicId(null)
        setTreeFilterUserId(null)
    }, [])

    // Header actions for main 'admin' view — pill with animated search overlay
    const mainHeaderActions = useMemo(() => {
        if (view !== 'admin') return undefined

        /** Tab-specific action buttons (rendered before Search + Close) */
        const tabButtons = (() => {
            if (activeTab === 'requests') {
                return (
                    <>
                        <PillButton icon={UserPlus} onClick={handleCreateUser} label="New user" iconSize={20} />
                        <PillButton icon={Building2} onClick={handleCreateClinic} label="New clinic" iconSize={20} />
                    </>
                )
            }
            if (activeTab === 'users') {
                return <PillButton icon={UserPlus} onClick={handleCreateUser} label="New user" iconSize={20} />
            }
            if (activeTab === 'clinics') {
                return <PillButton icon={Building2} onClick={handleCreateClinic} label="New clinic" iconSize={20} />
            }
            return null
        })()

        return (
            <div className="relative flex items-center w-full">
                <animated.div
                    style={{
                        opacity: searchSpring.progress.to(p => 1 - p),
                        pointerEvents: isSearchExpanded ? 'none' : 'auto',
                    }}
                >
                    <HeaderPill>
                        {tabButtons}
                        <PillButton icon={Search} onClick={() => setIsSearchExpanded(true)} label="Search" />
                        <PillButton icon={X} onClick={handleClose} label="Close" />
                    </HeaderPill>
                </animated.div>

                {/* Search overlay — fade in when search expands */}
                <animated.div
                    className="absolute inset-0 flex items-center"
                    style={{
                        opacity: searchSpring.progress,
                        transform: searchSpring.progress.to(p => `scale(${0.97 + 0.03 * p})`),
                        pointerEvents: isSearchExpanded ? 'auto' : 'none',
                    }}
                >
                    <div className="flex items-center w-full rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2">
                        <input
                            ref={searchInputRef}
                            type="search"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Escape') collapseSearch() }}
                            className="text-tertiary bg-transparent outline-none text-[16px] w-full px-4 py-2 rounded-l-full min-w-0 [&::-webkit-search-cancel-button]:hidden"
                        />
                        <div
                            className="flex items-center justify-center px-2 py-2 bg-themewhite2 stroke-themeblue3 rounded-r-full cursor-pointer transition-all duration-300 hover:bg-themewhite shrink-0"
                            onClick={collapseSearch}
                        >
                            <X className="w-5 h-5 stroke-themeblue1" />
                        </div>
                    </div>
                </animated.div>
            </div>
        )
    }, [view, activeTab, handleCreateUser, handleCreateClinic, handleClose, isSearchExpanded, searchQuery, searchSpring, collapseSearch])

    // Header actions for detail/form views
    const detailHeaderActions = useMemo(() => {
        if (view === 'admin-user-detail' && selectedUser) {
            return (
                <HeaderPill>
                    <PillButton icon={Pencil} onClick={() => handleEditUser(selectedUser)} label="Edit" />
                    <PillButton icon={X} onClick={handleClose} label="Close" />
                </HeaderPill>
            )
        }
        if (view === 'admin-clinic-detail' && selectedClinic) {
            return (
                <HeaderPill>
                    <PillButton icon={Pencil} onClick={() => handleEditClinic(selectedClinic)} label="Edit" />
                    <PillButton icon={Trash2} onClick={() => setConfirmDeleteClinic(true)} label="Delete" variant="danger" />
                    <PillButton icon={X} onClick={handleClose} label="Close" />
                </HeaderPill>
            )
        }
        return undefined
    }, [view, selectedUser, selectedClinic, handleEditUser, handleEditClinic, handleClose])

    // Header config per view
    const headerConfig = useMemo(() => {
        switch (view) {
            case 'admin':
                return {
                    title: 'Admin Panel',
                    rightContent: mainHeaderActions,
                    hideDefaultClose: !!mainHeaderActions,
                    rightContentFill: isSearchExpanded,
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
            case 'admin-request-detail':
                return { title: 'Request', showBack: true, onBack: handleBack }
        }
    }, [view, selectedUser, selectedClinic, handleBack, detailHeaderActions, mainHeaderActions, isSearchExpanded])

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
                        onEdit={handleEditUser}
                        onBack={handleBack}
                        onUserUpdated={(u) => setSelectedUser(u)}
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

            case 'admin':
            default:
                return renderMainView()
        }
    }

    const renderMainView = () => (
        <div className="relative h-full">
            {/* Vertical tab strip — floating right side */}
            <div className="absolute top-3 right-5 z-20">
                <VerticalPill>
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
                </VerticalPill>
            </div>

            {/* List content — full width */}
            <div className="h-full min-h-0">
                {activeTab === 'requests' && (
                    <AdminRequestsList
                        searchQuery={searchQuery}
                        onUserApproved={(approvedUser) => {
                            // Build a minimal AdminUser so the edit form can pre-fill known fields
                            const newUser: AdminUser = {
                                id: approvedUser.id,
                                email: approvedUser.email,
                                first_name: approvedUser.first_name,
                                last_name: approvedUser.last_name,
                                middle_initial: null,
                                credential: null,
                                component: null,
                                rank: null,
                                uic: null,
                                roles: ['medic'],
                                clinic_id: null,
                                created_at: new Date().toISOString(),
                                last_active_at: null,
                                note_include_hpi: null,
                                note_include_pe: null,
                                pe_depth: null,
                                avatar_id: null,
                            }
                            handleEditUser(newUser)
                        }}
                    />
                )}
                {activeTab === 'users' && (
                    <AdminUsersList
                        onSelectUser={handleSelectUser}
                        onEditUser={handleEditUser}
                        onCreateUser={handleCreateUser}
                        filterUserId={treeFilterUserId}
                        searchQuery={searchQuery}
                    />
                )}
                {activeTab === 'clinics' && (
                    <AdminClinicsList
                        onSelectClinic={handleSelectClinic}
                        onEditClinic={handleEditClinic}
                        onCreateClinic={handleCreateClinic}
                        filterClinicId={treeFilterClinicId}
                        searchQuery={searchQuery}
                    />
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
        >
            <ContentWrapper slideDirection={isMobile ? slideDirection : ''} swipeHandlers={isMobile && view !== 'admin' ? swipeHandlers : undefined}>
                <div className="h-full relative">
                    {/* Desktop: split pane layout */}
                    {!isMobile && view === 'admin' ? (
                        <div className="flex h-full">
                            <div className="w-[260px] shrink-0 border-r border-tertiary/10 flex flex-col bg-themewhite3/50">
                                <div className="shrink-0 px-6 py-3 border-b border-primary/10">
                                    <p className="text-[10pt] font-medium text-tertiary/70 uppercase tracking-wide">Organization</p>
                                </div>
                                <div className="flex-1 overflow-y-auto">
                                    <AdminTree
                                        activeClinicId={treeFilterClinicId}
                                        activeUserId={treeFilterUserId}
                                        onSelectClinic={handleTreeSelectClinic}
                                        onSelectUser={handleTreeSelectUser}
                                        onSelectAll={() => { setTreeFilterClinicId(null); setTreeFilterUserId(null) }}
                                        allSelected={!treeFilterClinicId && !treeFilterUserId}
                                        onMoveUser={(userId, clinicId) => {
                                            // Handled by AdminTree internally
                                        }}
                                        onMoveClinic={(clinicId, parentId) => {
                                            // Handled by AdminTree internally
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0 overflow-y-auto">
                                {renderContent()}
                            </div>
                        </div>
                    ) : (
                        renderContent()
                    )}
                </div>
            </ContentWrapper>
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
        </>
    )
}
