import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { X, Inbox, Network, MapPin, MessageCircleQuestion, type LucideIcon } from 'lucide-react'
import { BaseDrawer, ScrollPane } from '@/Components/primitives/BaseDrawer'
import { BottomIsland } from '@/Components/primitives/BottomIsland'
import { AddFab } from '@/Components/primitives/AddFab'
import { SlideRevealPane } from '@/Components/primitives/SlideRevealPane'
import { PaneHeader } from '@/Components/primitives/PaneHeader'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { ContentWrapper } from '@/Components/primitives/ContentWrapper'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { ActionSheet } from '@/Components/primitives/ActionSheet'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useEscBackout } from '../Hooks/useEscBackout'
import { usePageVisibility } from '../Hooks/usePageVisibility'
import { useAdminInbox } from '../Hooks/useAdminInbox'
import { useAdminSystemConversations } from '../Hooks/useAdminSystemConversations'
import { listClinics, listLocations } from '../lib/adminService'
import { drainSystemInbox } from '../lib/signal/systemIdentity'
import { useAuthStore } from '../stores/useAuthStore'
import { useMessagingStore } from '../stores/useMessagingStore'
import { invalidate } from '../stores/useInvalidationStore'
import { getDisplayName } from '../Utilities/nameUtils'
import { createLogger } from '../Utilities/Logger'
import { AdminDirectory } from './Admin/AdminDirectory'
import { AdminInbox } from './Admin/AdminInbox'
import { AdminLocationsList } from './Admin/AdminLocationsList'
import { AdminFeatureVotesSection } from './Admin/AdminFeatureVotesSection'
import { AdminUserDetail } from './Admin/AdminUserDetail'
import { AdminClinicDetail, type ClusterCreatePrefill } from './Admin/AdminClinicDetail'
import { AdminLocationDetail } from './Admin/AdminLocationDetail'
import { AdminSystemConversationView } from './Admin/AdminSystemConversationView'
import { RequestDetail } from './Admin/RequestDetail'
import { FeedbackDetail } from './Admin/FeedbackDetail'
import { SuggestionDetail } from './Admin/SuggestionDetail'
import { AdminMobileSheet } from './Admin/AdminMobileSheet'
import type { AdminUser, AdminClinic, AdminLocation } from '../lib/adminService'
import type { AccountRequest } from '../lib/accountRequestService'
import type { FeedbackRow } from '../lib/feedbackService'
import type { FeatureVoteSuggestion } from '../lib/featureVotingService'

const logger = createLogger('AdminSystemInbox')

/*
 * Admin panel — ONE model on every surface:
 *
 *   section list (island: Directory · Inbox · Locations · Votes)
 *     └ detail (desktop: right pane · mobile: sheet; a system thread goes full-panel on mobile)
 *         └ lateral hops (user → their cluster → a sibling) push a breadcrumb trail
 *
 * Every detail speaks the same contract — it owns its edit/delete state and
 * publishes header pills (onHeaderActions), dirtiness (onDirtyChange) and
 * completion (onDeleted / onClose / onCreated). The shell only routes.
 */

type Section = 'directory' | 'inbox' | 'locations' | 'votes'

const SECTIONS: { id: Section; title: string; icon: LucideIcon; search?: string }[] = [
    { id: 'directory', title: 'Directory', icon: Network, search: 'Search clusters and users...' },
    { id: 'inbox', title: 'Inbox', icon: Inbox, search: 'Search inbox...' },
    { id: 'locations', title: 'Locations', icon: MapPin, search: 'Search locations...' },
    { id: 'votes', title: 'Votes', icon: MessageCircleQuestion },
]

type Detail =
    | { kind: 'user'; user: AdminUser | null; edit?: boolean; prefillClinicId?: string | null }
    | { kind: 'clinic'; clinic: AdminClinic | null; edit?: boolean; prefill?: ClusterCreatePrefill | null }
    | { kind: 'location'; location: AdminLocation | null }
    | { kind: 'request'; request: AccountRequest }
    | { kind: 'feedback'; feedback: FeedbackRow }
    | { kind: 'suggestion'; suggestion: FeatureVoteSuggestion }
    | { kind: 'thread'; peerId: string }

const TRAIL_MAX = 3

/** Entity identity — the React key (a hop remounts the detail fresh), the mobile
 *  sheet's morph key, and (for triage kinds) the inbox's feed key. */
function detailKey(d: Detail): string {
    switch (d.kind) {
        case 'user': return `user:${d.user?.id ?? 'new'}`
        case 'clinic': return `clinic:${d.clinic?.id ?? 'new'}`
        case 'location': return `location:${d.location?.id ?? 'new'}`
        case 'request': return `req-${d.request.id}`
        case 'feedback': return `fb-${d.feedback.id}`
        case 'suggestion': return `sug-${d.suggestion.id}`
        case 'thread': return `sys-${d.peerId}`
    }
}

function detailTitle(d: Detail, peerName: (id: string) => string): string {
    switch (d.kind) {
        case 'user': return d.user ? [d.user.first_name, d.user.last_name].filter(Boolean).join(' ') || 'User' : 'New user'
        case 'clinic': return d.clinic?.name || 'New cluster'
        case 'location': return d.location?.display_name || 'New location'
        case 'request':
            return d.request.request_type === 'support' ? 'Support request'
                : d.request.status === 'pending' ? 'Approve request' : 'Rejected request'
        case 'feedback': return 'User feedback'
        case 'suggestion': return 'Feature suggestion'
        case 'thread': return peerName(d.peerId)
    }
}

/** The rendered detail's React key — `edit` is part of it so the tree's Edit on
 *  the already-open entity remounts it straight into its edit overlay. */
const paneKey = (d: Detail) => detailKey(d) + ((d.kind === 'user' || d.kind === 'clinic') && d.edit ? ':edit' : '')

/** A trail entry re-opens in view mode, never back into an edit overlay. */
const settled = (d: Detail): Detail => (d.kind === 'user' || d.kind === 'clinic' ? { ...d, edit: false } : d)

/** The just-approved account, optimistically shaped so the user detail can open
 *  at once — its own load replaces it with the canonical record. */
function userFromRequest(id: string, r: AccountRequest, roles: string[], clinicId: string | null): AdminUser {
    return {
        id,
        email: r.email,
        first_name: r.first_name,
        last_name: r.last_name,
        middle_initial: r.middle_initial ?? null,
        credential: r.credential ?? null,
        component: r.component ?? null,
        rank: r.rank ?? null,
        uic: r.uic ?? null,
        roles,
        clinic_id: clinicId,
        clinic_name: null,
        sub_cluster_id: null,
        surrogate_clinic_id: null,
        surrogate_clinic_name: null,
        created_at: new Date().toISOString(),
        last_active_at: null,
        avatar_id: null,
        supervisor_created: false,
    }
}

interface AdminDrawerProps {
    isVisible: boolean
    onClose: () => void
}

export function AdminDrawer({ isVisible, onClose }: AdminDrawerProps) {
    const isMobile = useIsMobile()
    const isPageVisible = usePageVisibility()
    const isDevRole = useAuthStore(s => s.isDevRole)
    const peerProfiles = useMessagingStore(s => s.peerProfiles)

    const [section, setSection] = useState<Section>('directory')
    const [queries, setQueries] = useState<Partial<Record<Section, string>>>({})
    const [detail, setDetail] = useState<Detail | null>(null)
    const [trail, setTrail] = useState<Detail[]>([])
    const [headerActions, setHeaderActions] = useState<ReactNode>(null)
    const [dirty, setDirty] = useState(false)
    const [confirmDiscard, setConfirmDiscard] = useState(false)
    const pendingNav = useRef<(() => void) | null>(null)
    const [showAddSheet, setShowAddSheet] = useState(false)

    // The drawer is mounted for everyone — only read the triage feed while a dev has it open.
    const inbox = useAdminInbox(isVisible && isDevRole)
    const threads = useAdminSystemConversations()

    // System-inbox drain while the panel is open, so user → SYSTEM replies surface
    // in their threads without polling the rest of the app.
    useEffect(() => {
        if (!isVisible || !isDevRole || !isPageVisible) return
        drainSystemInbox().catch(e => logger.warn('admin drawer drain failed:', e instanceof Error ? e.message : e))
    }, [isVisible, isDevRole, isPageVisible])

    // ── Navigation ───────────────────────────────────────────────────────────
    /** Run `action` now, or behind the discard confirm while a detail has unsaved edits. */
    const guard = useCallback((action: () => void) => {
        if (!dirty) { action(); return }
        pendingNav.current = action
        setConfirmDiscard(true)
    }, [dirty])

    /** Swap the detail. `lateral` (a hop from inside a detail) pushes the current
     *  one onto the trail; anything opened from a list starts a fresh trail. */
    const show = useCallback((next: Detail | null, lateral = false) => {
        // A hop to the entity already shown doesn't add a crumb.
        if (!lateral) setTrail([])
        else if (detail && (!next || detailKey(next) !== detailKey(detail))) setTrail(t => [...t, settled(detail)].slice(-TRAIL_MAX))
        setDetail(next)
        setDirty(false)
    }, [detail])

    const open = useCallback((next: Detail) => guard(() => show(next)), [guard, show])
    const hop = useCallback((next: Detail) => guard(() => show(next, true)), [guard, show])

    /** One level up: back along the trail, else close the detail. Unguarded — for completions. */
    const pop = useCallback(() => {
        setDetail(trail[trail.length - 1] ?? null)
        setTrail(t => t.slice(0, -1))
        setDirty(false)
    }, [trail])
    const back = useCallback(() => guard(pop), [guard, pop])
    const dismiss = useCallback(() => guard(() => show(null)), [guard, show])
    const toCrumb = useCallback((i: number) => guard(() => {
        setDetail(trail[i])
        setTrail(trail.slice(0, i))
        setDirty(false)
    }), [guard, trail])

    const switchSection = useCallback((id: string) => guard(() => {
        setSection(id as Section)
        show(null)
    }), [guard, show])

    const handleClose = useCallback(() => guard(() => {
        show(null)
        setSection('directory')
        setQueries({})
        onClose()
    }), [guard, show, onClose])

    useEscBackout(!isMobile && !!detail, back)
    const isMobileThread = isMobile && detail?.kind === 'thread'
    const swipeHandlers = useSwipeBack(isMobileThread ? back : undefined, isMobileThread)

    // ── Detail callbacks ─────────────────────────────────────────────────────
    // A detail refreshes its record in place. Matched on id so a late load from
    // the detail we just hopped away from can't overwrite the new one.
    const patchUser = useCallback((u: AdminUser) =>
        setDetail(d => (d?.kind === 'user' && d.user?.id === u.id ? { ...d, user: u } : d)), [])
    const patchClinic = useCallback((c: AdminClinic) =>
        setDetail(d => (d?.kind === 'clinic' && d.clinic?.id === c.id ? { ...d, clinic: c } : d)), [])
    const patchLocation = useCallback((l: AdminLocation) =>
        setDetail(d => (d?.kind === 'location' && d.location?.id === l.id ? { ...d, location: l } : d)), [])

    const onUserCreated = useCallback((u: AdminUser) => {
        setDetail({ kind: 'user', user: u })
        setDirty(false)
        invalidate('users')
    }, [])

    // Invalidate BEFORE listing — listClinics is memoized on the clinics generation.
    const onClinicCreated = useCallback(async (id: string) => {
        invalidate('clinics')
        const clinic = (await listClinics()).find(c => c.id === id)
        setDirty(false)
        if (clinic) setDetail({ kind: 'clinic', clinic })
        else pop()
    }, [pop])

    const onLocationCreated = useCallback(async (id: string) => {
        const location = (await listLocations()).find(l => l.id === id)
        setDirty(false)
        if (location) setDetail({ kind: 'location', location })
        else pop()
    }, [pop])

    // Approval lands on the new user — in edit mode if any post-approval step
    // needs finishing by hand.
    const onRequestApproved = useCallback((
        userId: string,
        request: AccountRequest,
        configured: { roles: string[]; clinicId: string | null; warnings: string[] },
    ) => {
        show({ kind: 'user', user: userFromRequest(userId, request, configured.roles, configured.clinicId), edit: configured.warnings.length > 0 })
        invalidate('requests', 'users')
    }, [show])

    // Stable: details memoize their header actions on this callback.
    const hopToThread = useCallback((peerId: string) => hop({ kind: 'thread', peerId }), [hop])
    const openThread = isDevRole ? hopToThread : undefined
    const peerName = (id: string) => (peerProfiles[id] ? getDisplayName(peerProfiles[id]) : 'System thread')

    const renderDetail = (d: Detail) => {
        const host = { onHeaderActions: setHeaderActions }
        switch (d.kind) {
            case 'user':
                return (
                    <AdminUserDetail
                        {...host}
                        user={d.user}
                        startEditing={d.edit}
                        prefillClinicId={d.prefillClinicId}
                        onUserUpdated={patchUser}
                        onCreated={onUserCreated}
                        onSelectClinic={clinic => hop({ kind: 'clinic', clinic })}
                        onDirtyChange={setDirty}
                        onDeleted={pop}
                        onOpenConversation={openThread}
                    />
                )
            case 'clinic':
                return (
                    <AdminClinicDetail
                        {...host}
                        clinic={d.clinic}
                        startEditing={d.edit}
                        createPrefill={d.prefill}
                        onClinicUpdated={patchClinic}
                        onSelectUser={user => hop({ kind: 'user', user })}
                        onSelectClinic={clinic => hop({ kind: 'clinic', clinic })}
                        onSelectRequest={request => hop({ kind: 'request', request })}
                        onCreateRelatedCluster={prefill => hop({ kind: 'clinic', clinic: null, prefill })}
                        onCreateUserInCluster={clinicId => hop({ kind: 'user', user: null, prefillClinicId: clinicId })}
                        onCreated={onClinicCreated}
                        onDirtyChange={setDirty}
                        onDeleted={pop}
                    />
                )
            case 'location':
                return (
                    <AdminLocationDetail
                        {...host}
                        location={d.location}
                        onLocationUpdated={patchLocation}
                        onSelectClinic={clinic => hop({ kind: 'clinic', clinic })}
                        onCreated={onLocationCreated}
                        onDirtyChange={setDirty}
                        onArchived={pop}
                    />
                )
            case 'request':
                return <RequestDetail {...host} request={d.request} onApproved={onRequestApproved} onClose={pop} />
            case 'feedback':
                return <FeedbackDetail {...host} feedback={d.feedback} onClose={pop} onOpenConversation={openThread} />
            case 'suggestion':
                return <SuggestionDetail {...host} suggestion={d.suggestion} onClose={pop} />
            case 'thread':
                return <AdminSystemConversationView {...host} peerId={d.peerId} onBack={isMobile ? back : undefined} onDeleted={pop} />
        }
    }

    // ── Section list ─────────────────────────────────────────────────────────
    const query = queries[section] ?? ''
    const activeKey = detail ? detailKey(detail) : null

    const renderList = () => {
        switch (section) {
            case 'directory':
                return (
                    <AdminDirectory
                        searchQuery={query}
                        activeClinicId={detail?.kind === 'clinic' ? detail.clinic?.id : null}
                        activeUserId={detail?.kind === 'user' ? detail.user?.id : null}
                        onSelectClinic={clinic => open({ kind: 'clinic', clinic })}
                        onSelectUser={user => open({ kind: 'user', user })}
                        onEditClinic={clinic => open({ kind: 'clinic', clinic, edit: true })}
                        onEditUser={user => open({ kind: 'user', user, edit: true })}
                        onChatUser={isDevRole ? user => open({ kind: 'thread', peerId: user.id }) : undefined}
                        onCreateClinic={() => open({ kind: 'clinic', clinic: null })}
                    />
                )
            case 'inbox':
                return (
                    <AdminInbox
                        inbox={inbox}
                        threads={threads}
                        searchQuery={query}
                        activeKey={activeKey}
                        onOpenRequest={request => open({ kind: 'request', request })}
                        onOpenFeedback={feedback => open({ kind: 'feedback', feedback })}
                        onOpenSuggestion={suggestion => open({ kind: 'suggestion', suggestion })}
                        onOpenThread={peerId => open({ kind: 'thread', peerId })}
                    />
                )
            case 'locations':
                return (
                    <AdminLocationsList
                        searchQuery={query}
                        activeId={detail?.kind === 'location' ? detail.location?.id : null}
                        onSelect={location => open({ kind: 'location', location })}
                        onCreate={() => open({ kind: 'location', location: null })}
                    />
                )
            case 'votes':
                return <AdminFeatureVotesSection />
        }
    }

    // A dot, not a count: something is waiting on an admin (a pending account or an unread reply).
    const inboxNeedsAttention = inbox.items.some(i => i.kind === 'request' && i.data.status === 'pending')
        || threads.some(t => t.unreadCount > 0)

    const fab =
        section === 'directory' ? <AddFab label="Add new" onClick={() => setShowAddSheet(true)} className="absolute right-4" />
        : section === 'locations' ? <AddFab label="New location" onClick={() => open({ kind: 'location', location: null })} className="absolute right-4" />
        : null

    const island = (
        <BottomIsland
            ariaLabel="Admin sections"
            glass
            activeId={section}
            onSelect={switchSection}
            fab={fab}
            stops={SECTIONS.map(({ id, title, icon: Icon }) => ({
                id,
                title,
                icon: id === 'inbox' && inboxNeedsAttention ? (
                    <span className="relative">
                        <Icon size={18} />
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-themeredred" />
                    </span>
                ) : <Icon size={18} />,
            }))}
        />
    )

    const searchPlaceholder = SECTIONS.find(s => s.id === section)?.search
    const listPane = (
        <div className={`relative h-full flex flex-col ${isMobile ? 'pt-[calc(var(--drawer-header-h,3.5rem)+0.5rem)]' : 'pt-3'}`}>
            {searchPlaceholder && (
                <div className="shrink-0 px-3 pb-2">
                    <SearchInput
                        value={query}
                        onChange={q => setQueries(prev => ({ ...prev, [section]: q }))}
                        placeholder={searchPlaceholder}
                    />
                </div>
            )}
            {/* pb clears the floating island. */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-24">{renderList()}</div>
            {!(isMobile && detail) && island}
        </div>
    )

    // ── Detail chrome ────────────────────────────────────────────────────────
    const title = detail ? detailTitle(detail, peerName) : ''
    const crumbs = trail.length > 0 ? (
        <span className="flex items-center gap-1 min-w-0 overflow-hidden">
            {trail.map((entry, i) => (
                <span key={i} className="flex items-center gap-1 min-w-0 shrink">
                    <button
                        type="button"
                        onClick={() => toCrumb(i)}
                        className="truncate max-w-[120px] hover:text-primary active:scale-95 transition-transform"
                    >
                        {detailTitle(entry, peerName)}
                    </button>
                    <span aria-hidden className="shrink-0 text-tertiary/50">›</span>
                </span>
            ))}
        </span>
    ) : undefined

    const header = isMobileThread
        ? { title, showBack: true, onBack: back, rightContent: headerActions }
        : {
            title: 'Admin Panel',
            rightContent: (
                <HeaderPill>
                    <PillButton icon={X} onClick={handleClose} label="Close" />
                </HeaderPill>
            ),
            hideDefaultClose: true,
        }

    return (
        <>
            <BaseDrawer
                isVisible={isVisible}
                onClose={handleClose}
                fullHeight="95dvh"
                mobileFullScreen
                desktopPosition="left"
                desktopWidth="w-[90%]"
                header={header}
                scrollDisabled
                glassHeader={isMobile}
            >
                {!isMobile ? (
                    <div className="flex h-full">
                        <div className="flex-1 min-w-0">{listPane}</div>
                        <SlideRevealPane open={!!detail} side="right" width={480} className="border-l border-primary/10 bg-themewhite">
                            {detail && (
                                <>
                                    <PaneHeader
                                        onBack={back}
                                        backLabel={trail.length > 0 ? 'Back' : 'Close detail'}
                                        eyebrow={crumbs}
                                        title={title}
                                        actions={headerActions}
                                    />
                                    <div className="flex-1 min-h-0 overflow-hidden">
                                        {detail.kind === 'thread'
                                            ? <div key={paneKey(detail)} className="h-full">{renderDetail(detail)}</div>
                                            : <ScrollPane key={paneKey(detail)} className="px-4 py-3 md:p-5 pb-8">{renderDetail(detail)}</ScrollPane>}
                                    </div>
                                </>
                            )}
                        </SlideRevealPane>
                    </div>
                ) : detail?.kind === 'thread' ? (
                    // Chat owns its scroll — a fit-height sheet would fight it, so a
                    // thread is a full-panel push on mobile.
                    <ContentWrapper slideDirection="left" swipeHandlers={swipeHandlers}>
                        <div key={paneKey(detail)} className="h-full pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
                            {renderDetail(detail)}
                        </div>
                    </ContentWrapper>
                ) : listPane}

                <ActionSheet
                    visible={showAddSheet}
                    title="Add New"
                    options={[
                        { key: 'user', label: 'New User', onAction: () => { setShowAddSheet(false); open({ kind: 'user', user: null }) } },
                        { key: 'clinic', label: 'New Cluster', onAction: () => { setShowAddSheet(false); open({ kind: 'clinic', clinic: null }) } },
                    ]}
                    onClose={() => setShowAddSheet(false)}
                />
            </BaseDrawer>

            {isMobile && (
                <AdminMobileSheet
                    isOpen={!!detail && !isMobileThread}
                    screenId={detail && !isMobileThread ? detailKey(detail) : null}
                    title={title}
                    titleNode={
                        <div className="min-w-0">
                            {crumbs && <div className="text-[9pt] text-tertiary mb-0.5">{crumbs}</div>}
                            <div className="truncate text-[13pt] font-semibold text-primary leading-tight">{title}</div>
                        </div>
                    }
                    actions={headerActions}
                    onClose={dismiss}
                >
                    {detail && !isMobileThread && (
                        <div key={paneKey(detail)} className="px-4 pt-1 pb-8">{renderDetail(detail)}</div>
                    )}
                </AdminMobileSheet>
            )}

            <ConfirmDialog
                visible={confirmDiscard}
                title="Discard changes?"
                subtitle="Your unsaved changes will be lost."
                confirmLabel="Discard"
                variant="danger"
                onConfirm={() => {
                    setConfirmDiscard(false)
                    setDirty(false)
                    pendingNav.current?.()
                    pendingNav.current = null
                }}
                onCancel={() => {
                    setConfirmDiscard(false)
                    pendingNav.current = null
                }}
                zIndex={1300}
            />
        </>
    )
}
