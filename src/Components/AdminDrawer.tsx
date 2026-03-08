import { useState, useCallback, useMemo, useEffect } from 'react'
import { Edit3, UserPlus, Building2, Plus, Trash2, X } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { ContentWrapper } from './Settings/ContentWrapper'
import { ConfirmDialog } from './ConfirmDialog'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { UI_TIMING } from '../Utilities/constants'
import { deleteClinic } from '../lib/adminService'

// Admin sub-components (Step 2+ will populate these)
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

interface AdminDrawerProps {
    isVisible: boolean
    onClose: () => void
}

export function AdminDrawer({ isVisible, onClose }: AdminDrawerProps) {
    const [view, setView] = useState<AdminView>('admin')
    const [activeTab, setActiveTab] = useState<'requests' | 'users' | 'clinics'>('requests')
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

    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    )
    useEffect(() => {
        const mql = window.matchMedia('(max-width: 767px)')
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
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

    // Header actions for main 'admin' view — tab-aware pill buttons
    const mainHeaderActions = useMemo(() => {
        if (view !== 'admin') return undefined
        if (isMobile) {
            // Mobile: icon pill containers — always include close in the pill
            if (activeTab === 'users') {
                // Double pill: new user + close
                return (
                    <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5">
                        <button onClick={handleCreateUser} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="New user">
                            <UserPlus className="w-5 h-5 stroke-current" />
                        </button>
                        <div className="w-px h-5 bg-tertiary/15" />
                        <button onClick={handleClose} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="Close">
                            <X className="w-[18px] h-[18px]" />
                        </button>
                    </div>
                )
            }
            if (activeTab === 'clinics') {
                // Double pill: new clinic + close
                return (
                    <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5">
                        <button onClick={handleCreateClinic} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="New clinic">
                            <Building2 className="w-5 h-5 stroke-current" />
                        </button>
                        <div className="w-px h-5 bg-tertiary/15" />
                        <button onClick={handleClose} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="Close">
                            <X className="w-[18px] h-[18px]" />
                        </button>
                    </div>
                )
            }
            if (activeTab === 'requests') {
                // Triple pill: new user + new clinic + close
                return (
                    <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5">
                        <button onClick={handleCreateUser} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="New user">
                            <UserPlus className="w-5 h-5 stroke-current" />
                        </button>
                        <div className="w-px h-5 bg-tertiary/15" />
                        <button onClick={handleCreateClinic} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="New clinic">
                            <Building2 className="w-5 h-5 stroke-current" />
                        </button>
                        <div className="w-px h-5 bg-tertiary/15" />
                        <button onClick={handleClose} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="Close">
                            <X className="w-[18px] h-[18px]" />
                        </button>
                    </div>
                )
            }
        } else {
            // Desktop: text pill buttons
            if (activeTab === 'users') {
                return (
                    <button onClick={handleCreateUser} className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-themegreen text-white text-xs font-medium hover:bg-themegreen/90 transition-colors">
                        <UserPlus size={14} /> New User
                    </button>
                )
            }
            if (activeTab === 'clinics') {
                return (
                    <button onClick={handleCreateClinic} className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-themegreen text-white text-xs font-medium hover:bg-themegreen/90 transition-colors">
                        <Plus size={14} /> New Clinic
                    </button>
                )
            }
            if (activeTab === 'requests') {
                return (
                    <div className="flex items-center gap-1.5">
                        <button onClick={handleCreateUser} className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-tertiary/20 text-xs font-medium text-primary hover:bg-secondary/5 transition-colors">
                            <UserPlus size={14} /> New User
                        </button>
                        <button onClick={handleCreateClinic} className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-tertiary/20 text-xs font-medium text-primary hover:bg-secondary/5 transition-colors">
                            <Plus size={14} /> New Clinic
                        </button>
                    </div>
                )
            }
        }
        return undefined
    }, [view, activeTab, isMobile, handleCreateUser, handleCreateClinic, handleClose])

    // Header actions for detail/form views
    const detailHeaderActions = useMemo(() => {
        if (view === 'admin-user-detail' && selectedUser) {
            if (isMobile) {
                // Double pill: edit + close
                return (
                    <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5">
                        <button onClick={() => handleEditUser(selectedUser)} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="Edit">
                            <Edit3 className="w-[18px] h-[18px]" />
                        </button>
                        <div className="w-px h-5 bg-tertiary/15" />
                        <button onClick={handleClose} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="Close">
                            <X className="w-[18px] h-[18px]" />
                        </button>
                    </div>
                )
            }
            return (
                <button onClick={() => handleEditUser(selectedUser)} className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-tertiary/20 text-xs font-medium text-primary hover:bg-secondary/5 transition-colors">
                    <Edit3 size={16} /> Edit
                </button>
            )
        }
        if (view === 'admin-clinic-detail' && selectedClinic) {
            if (isMobile) {
                // Triple pill: edit + delete + close
                return (
                    <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5">
                        <button onClick={() => handleEditClinic(selectedClinic)} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="Edit">
                            <Edit3 className="w-[18px] h-[18px]" />
                        </button>
                        <div className="w-px h-5 bg-tertiary/15" />
                        <button onClick={() => setConfirmDeleteClinic(true)} className="w-11 h-11 rounded-full flex items-center justify-center text-themeredred hover:text-themeredred/80 active:scale-95 transition-all duration-200" aria-label="Delete">
                            <Trash2 className="w-[18px] h-[18px]" />
                        </button>
                        <div className="w-px h-5 bg-tertiary/15" />
                        <button onClick={handleClose} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="Close">
                            <X className="w-[18px] h-[18px]" />
                        </button>
                    </div>
                )
            }
            return (
                <div className="flex items-center gap-1.5">
                    <button onClick={() => handleEditClinic(selectedClinic)} className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-tertiary/20 text-xs font-medium text-primary hover:bg-secondary/5 transition-colors">
                        <Edit3 size={16} /> Edit
                    </button>
                    <button onClick={() => setConfirmDeleteClinic(true)} className="flex items-center justify-center h-8 w-8 rounded-full border border-themeredred/20 text-themeredred hover:bg-themeredred/10 transition-colors">
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
        return undefined
    }, [view, selectedUser, selectedClinic, isMobile, handleEditUser, handleEditClinic, handleClose])

    // Header config per view
    const headerConfig = useMemo(() => {
        switch (view) {
            case 'admin':
                return { title: 'Admin Panel', rightContent: mainHeaderActions, hideDefaultClose: !!(isMobile && mainHeaderActions) }
            case 'admin-user-detail':
                return {
                    title: selectedUser
                        ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || 'User'
                        : 'User',
                    showBack: true,
                    onBack: handleBack,
                    rightContent: detailHeaderActions,
                    hideDefaultClose: !!(isMobile && detailHeaderActions),
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
                    hideDefaultClose: !!(isMobile && detailHeaderActions),
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
    }, [view, selectedUser, selectedClinic, handleBack, detailHeaderActions, mainHeaderActions, isMobile])

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
        <div className="h-full flex flex-col">
            {/* Tab bar — pinned at top */}
            <div className="shrink-0 px-4 pt-3 pb-2 md:px-5 md:pt-5 md:pb-3">
                <div className="flex gap-1 p-0.5 bg-themewhite2 rounded-lg">
                    {(['requests', 'users', 'clinics'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setTreeFilterClinicId(null); setTreeFilterUserId(null) }}
                            className={`flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                                ${activeTab === tab ? 'bg-themeblue2 text-white shadow-sm' : 'text-tertiary/70 hover:text-primary'}`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* List content — fills remaining height; each list manages its own scroll */}
            <div className="flex-1 min-h-0">
                {activeTab === 'requests' && (
                    <AdminRequestsList />
                )}
                {activeTab === 'users' && (
                    <AdminUsersList
                        onSelectUser={handleSelectUser}
                        onEditUser={handleEditUser}
                        onCreateUser={handleCreateUser}
                        filterUserId={treeFilterUserId}
                    />
                )}
                {activeTab === 'clinics' && (
                    <AdminClinicsList
                        onSelectClinic={handleSelectClinic}
                        onEditClinic={handleEditClinic}
                        onCreateClinic={handleCreateClinic}
                        filterClinicId={treeFilterClinicId}
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
