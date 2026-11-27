import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Settings, Plus, MoreHorizontal, X, Check } from 'lucide-react'
import { BaseDrawer } from '@/Components/primitives/BaseDrawer'
import { PaneSurface, PaneCard } from '@/Components/primitives/PaneCard'
import { MobileSearchBar } from '@/Components/primitives/MobileSearchBar'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { GlassBand } from '@/Components/primitives/GlassBand'
import { AddFab } from '@/Components/primitives/AddFab'
import { RailSearchRow } from '@/Components/primitives/RailSearchRow'
import { DesktopRail } from '@/Components/primitives/DesktopRail'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { useEscBackout } from '../../Hooks/useEscBackout'
import { useSwipeBack } from '../../Hooks/useSwipeBack'
import { useAuthStore } from '../../stores/useAuthStore'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { SupervisorClinicFilterPanel, ClusterFilterPanel } from '../SupervisorClinicSwitcher'
import { useTrackingBoardData } from '../../Hooks/useTrackingBoardData'
import { useTrackingWrite } from '../../Hooks/useTrackingWrite'
import { useMapOverlayWrite } from '../../Hooks/useMapOverlayWrite'
import {
    TrackingBoardList, TrackingGrid, TrackingBoardSettings,
    TrackingCategoryBar, TrackingCardList, filterByCategory, buildTrackingMenuItems,
    filterEntries, type TrackingEntry, type TrackingCategory,
    TrackingEditForm, TrackingCheckInFields, TrackingSheetForm, CommentComposer,
    draftFromEntry, draftIsValid, draftIsDirty, emptyDraft, type TrackingEditDraft, TrackingBoardScope,
} from './TrackingBoardPanel'
import {
    boardEntries, moveData, transitData, draftData, newTrackingData, originUic,
    type TrackingTarget,
} from './trackingModel'
import { TrackingCardSheet } from './TrackingCardSheet'
import type { LinkedFeatureRef } from '../../Types/MissionTypes'

interface TrackingBoardDrawerProps {
    isVisible: boolean
    onClose: () => void
}

export function TrackingBoardDrawer({ isVisible, onClose }: TrackingBoardDrawerProps) {
    const isMobile = useIsMobile()
    const { viewerId, viewerIds, originFilter, net, events, links, setLink, relatedIds } = useTrackingBoardData(isVisible)
    const trackingClusterFilter = useCalendarStore(s => s.trackingClusterFilter)
    const setTrackingClusterFilter = useCalendarStore(s => s.setTrackingClusterFilter)
    // Re-read on every board change so expiry / dwell track the data.
    const now = useMemo(() => Date.now(), [isVisible, events]) // eslint-disable-line react-hooks/exhaustive-deps
    const { checkIn, updateEntry, deleteEntry: removeEntry } = useTrackingWrite()
    const { reconcileTargets } = useMapOverlayWrite()
    const canManageSharing = useAuthStore(s => s.isSupervisorRole || s.isDevRole)
    // Link changes reach this cluster's stations here. Compares locally first, so
    // an unchanged set sends nothing.
    useEffect(() => {
        if (relatedIds && viewerId) void reconcileTargets(viewerId, relatedIds)
    }, [relatedIds, viewerId, reconcileTargets])
    const scope = useMemo(() => ({ net, viewerId }), [net, viewerId])
    // Board = fanned to any of my clusters (origin + ancestors), narrowed by
    // check-in origin, unexpired, newest-per-BRN, capped.
    const board = useMemo(() => boardEntries(events, net, viewerIds, now, originFilter), [events, net, viewerIds, now, originFilter])
    const [query, setQuery] = useState('')
    const entries = useMemo(() => filterEntries(board, query), [board, query])
    // By id, so the open detail reflects moves made from its own menu.
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const selected = useMemo(() => board.find(e => e.id === selectedId) ?? null, [board, selectedId])
    const lastSelected = useRef<TrackingEntry | null>(null)
    if (selected) lastSelected.current = selected
    const [showSettings, setShowSettings] = useState(false)
    // Non-null = check-in popover open (create draft; Save in its header).
    const [checkInDraft, setCheckInDraft] = useState<TrackingEditDraft | null>(null)
    const [checkInBusy, setCheckInBusy] = useState(false)
    const showCheckIn = !!checkInDraft
    const [category, setCategory] = useState<TrackingCategory>('all')
    const cards = useMemo(() => filterByCategory(entries, category, net, viewerId), [entries, category, net, viewerId])
    // Open-BRN ellipsis menu (anchor rect) + its delete confirm + in-flight write.
    const [moreRect, setMoreRect] = useState<DOMRect | null>(null)
    const moreBtnRef = useRef<HTMLDivElement>(null)
    const [pendingDelete, setPendingDelete] = useState<TrackingEntry | null>(null)
    const [busy, setBusy] = useState(false)
    const [editDraft, setEditDraft] = useState<TrackingEditDraft | null>(null)
    const [confirmDiscard, setConfirmDiscard] = useState(false)

    // Card Delete, after ConfirmDialog — 'd' to every board in the chain.
    const deleteEntry = (entry: TrackingEntry) => removeEntry(entry.id)

    // Move to any station in the origin's chain. Moving up an echelon is just a
    // move into a station the parent cluster uses.
    const moveEntry = (entry: TrackingEntry, to: TrackingTarget) =>
        updateEntry(entry.id, d => moveData(d, to, Date.now()))
    // Transit marker: "leaving → destination" (null clears). The patient stays put.
    const transitEntry = (entry: TrackingEntry, to: LinkedFeatureRef | null) =>
        updateEntry(entry.id, d => transitData(d, to, me, Date.now()))

    // Final action on the OPEN BRN: hold the loading morph / overlay through the
    // write. closeAfter = the entry is gone → close the detail.
    const runAction = async (apply: () => Promise<void> | void, closeAfter = false) => {
        setBusy(true)
        try { await apply() } finally {
            if (closeAfter) { setSelectedId(null); setEditDraft(null) }
            setBusy(false)
        }
    }

    const openEntry = (e: TrackingEntry) => {
        setSelectedId(e.id)
        setEditDraft(null)
        setMoreRect(null)
        // One card at a time: a BRN takes the slot from settings / check-in.
        setShowSettings(false)
        if (!checkInBusy) setCheckInDraft(null)
    }
    const detailMenuItems = selected ? buildTrackingMenuItems(selected, {
        onMove: (e, to) => { void runAction(() => moveEntry(e, to)) },
        onTransit: (e, to) => { void runAction(() => transitEntry(e, to)) },
        onDelete: setPendingDelete,
        net,
        viewerId,
    }) : []
    const openMore = () => {
        const rect = moreBtnRef.current?.getBoundingClientRect()
        if (rect) setMoreRect(rect)
    }
    const moreButton = (
        <div ref={moreBtnRef}>
            <PillButton icon={MoreHorizontal} iconSize={18} onClick={openMore} label="More actions" />
        </div>
    )

    // Stamped with the checking-in member's cluster (origin → drives visibility).
    const ownRank = useAuthStore(s => s.profile?.rank) ?? ''
    const ownLast = useAuthStore(s => s.profile?.lastName) ?? ''
    const me = [ownRank, ownLast].filter(Boolean).join(' ') || 'Member'
    // Edit Save — loading morph / overlay through the write, then back to the
    // detail. Comments union-merge across clusters; removed = soft-deleted.
    const saveEdit = () => {
        const d = editDraft
        if (!d || !selected || !draftIsValid(d)) return
        const id = selected.id
        void runAction(async () => {
            await updateEntry(id, td => draftData(td, d, me, Date.now()))
            setEditDraft(null)
        })
    }
    // Check-in Save — popover loading morph through the write. Origin = the
    // checker's operating cluster (drives visibility up the chain).
    const userId = useAuthStore(s => s.user?.id) ?? ''
    const saveCheckIn = async () => {
        const d = checkInDraft
        if (!d || !draftIsValid(d) || !viewerId) return
        setCheckInBusy(true)
        try {
            const at = Date.now()
            await checkIn(viewerId, draftData(newTrackingData(d.brn, at), { ...d, comments: [] }, me, at), userId)
            setCheckInDraft(null)
        } finally {
            setCheckInBusy(false)
        }
    }

    const clear = () => { setSelectedId(null); setMoreRect(null); setEditDraft(null) }
    const handleClose = () => { clear(); setShowSettings(false); setCheckInDraft(null); onClose() }
    const openSettings = () => { clear(); setCheckInDraft(null); setShowSettings(true) }
    const sheetDirty = !!selected && !!editDraft && draftIsDirty(editDraft, selected)
    const requestClose = () => {
        if (busy) return
        if (sheetDirty) setConfirmDiscard(true)
        else clear()
    }
    useEscBackout(!isMobile && !!selected && !showSettings && !showCheckIn && !moreRect && !pendingDelete && !confirmDiscard && !busy, requestClose)
    const swipeBack = useSwipeBack(selected ? requestClose : handleClose, isMobile)

    // Mobile panel stays mounted (App slide), and a backdrop tap closes it
    // without going through handleClose — reset so it reopens on the list.
    useEffect(() => {
        if (!isVisible) { setSelectedId(null); setShowSettings(false); setCheckInDraft(null); setMoreRect(null); setPendingDelete(null); setEditDraft(null); setConfirmDiscard(false) }
    }, [isVisible])

    // Deep link (mission overview widget): open that BRN — or its Edit — once
    // the board has it. Waits while the entry is still hydrating.
    const pendingEntry = useNavigationStore(s => s.trackingDrawerEntry)
    const clearPendingEntry = useNavigationStore(s => s.clearTrackingDrawerEntry)
    useEffect(() => {
        if (!isVisible || !pendingEntry) return
        const e = board.find(x => x.id === pendingEntry.id)
        if (!e) return
        clearPendingEntry()
        openEntry(e)
    }, [isVisible, pendingEntry, board]) // eslint-disable-line react-hooks/exhaustive-deps

    // Deep link (mission overview add button): straight into check-in.
    const pendingCheckIn = useNavigationStore(s => s.trackingDrawerCheckIn)
    const clearPendingCheckIn = useNavigationStore(s => s.clearTrackingDrawerCheckIn)
    useEffect(() => {
        if (!isVisible || !pendingCheckIn) return
        clearPendingCheckIn()
        setCheckInDraft(emptyDraft())
    }, [isVisible, pendingCheckIn, clearPendingCheckIn])

    const activeId = selected?.id ?? null

    const moreMenu = moreRect && selected && (
        <AnchoredMenu
            isOpen
            anchorRect={moreRect}
            onClose={() => setMoreRect(null)}
            layout="list"
            align={isMobile ? 'right' : 'left'}
            items={detailMenuItems}
        />
    )

    // Must be a CHILD of the card overlay to stack above it (it publishes the z ceiling).
    const deleteConfirm = (
        <ConfirmDialog
            visible={!!pendingDelete}
            title={`Remove ${pendingDelete?.brnLabel ?? ''} from the board?`}
            confirmLabel="Delete"
            variant="danger"
            onConfirm={() => {
                const e = pendingDelete
                setPendingDelete(null)
                if (e) void runAction(() => deleteEntry(e), true)
            }}
            onCancel={() => setPendingDelete(null)}
        />
    )

    const discardConfirm = (
        <ConfirmDialog
            visible={confirmDiscard}
            title="Discard unsaved changes?"
            confirmLabel="Discard"
            cancelLabel="Keep editing"
            variant="danger"
            onConfirm={() => { setConfirmDiscard(false); clear() }}
            onCancel={() => setConfirmDiscard(false)}
        />
    )

    // Settings + check-in share the board's one card slot (PaneSurface: lifted
    // card over the grid pane on desktop, fit Sheet on mobile). Opening one
    // closes the other and any open BRN.
    const clusterFilterPanel = <ClusterFilterPanel value={trackingClusterFilter} onChange={setTrackingClusterFilter} allowedIds={viewerIds} />
    const settingsSurface = (
        <PaneSurface
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            title="Tracking board settings"
        >
            <TrackingBoardSettings links={canManageSharing ? links : null} onSetLink={(id, next) => { void setLink(id, next) }} />
            {/* Calendar idiom: scope panels ride the settings sheet on mobile;
                desktop has them in the rail. Both render null without a loan. */}
            {isMobile && (
                <div className="pb-4">
                    <SupervisorClinicFilterPanel />
                    {clusterFilterPanel}
                </div>
            )}
        </PaneSurface>
    )

    const closeCheckIn = () => { if (!checkInBusy) setCheckInDraft(null) }
    const checkInSurface = (
        <PaneSurface
            isOpen={showCheckIn}
            onClose={closeCheckIn}
            title="Check in"
            loading={checkInBusy}
            actions={checkInDraft && draftIsValid(checkInDraft) ? (
                <PillButton icon={Check} iconSize={18} accent="success" onClick={() => { void saveCheckIn() }} label="Check in" />
            ) : undefined}
        >
            <div className="px-4 pt-1 pb-6">
                {checkInDraft && <TrackingCheckInFields draft={checkInDraft} onChange={setCheckInDraft} />}
            </div>
        </PaneSurface>
    )

    const openCheckIn = () => { clear(); setShowSettings(false); setCheckInDraft(emptyDraft()) }

    // Mobile bypasses BaseDrawer, same as MessagesDrawer: App.tsx owns the
    // horizontal slide-in, which BaseDrawer's vertical drawer model would fight.
    const cardEntry = selected ?? lastSelected.current
    const liveDraft = editDraft ?? (selected ? draftFromEntry(selected) : null)
    const lastDraft = useRef<TrackingEditDraft | null>(null)
    if (liveDraft) lastDraft.current = liveDraft
    const sheetDraft = liveDraft ?? lastDraft.current
    const sheetCanSave = sheetDirty && !!editDraft && draftIsValid(editDraft)
    // A decoded note (MessageBubble's decode affordance) opens the app-level
    // ImportedNoteDrawer (z-60), far under this overlay (z 1200+). Rather than
    // re-stack app surfaces, the card collapses back into its list card while
    // the note is up and grows out again once it closes.
    // Selection and any edit draft are kept throughout.
    const noteOpen = useNavigationStore(s => !!s.importPreview) && isMobile
    const cardSheet = (
        <TrackingCardSheet
            entry={cardEntry}
            open={!!selected && !noteOpen}
            onClose={requestClose}
            loading={busy}
            headRight={busy || !selected ? undefined : (
                <HeaderPill>
                    {sheetCanSave && <PillButton icon={Check} iconSize={18} accent="success" onClick={saveEdit} label="Save" />}
                    {moreButton}
                    <PillButton icon={X} iconSize={18} onClick={requestClose} label="Close" />
                </HeaderPill>
            )}
            footer={cardEntry && sheetDraft && <CommentComposer draft={sheetDraft} onChange={setEditDraft} />}
            overlays={<>{deleteConfirm}{discardConfirm}</>}
        >
            {cardEntry && sheetDraft && <TrackingSheetForm entry={cardEntry} draft={sheetDraft} onChange={setEditDraft} />}
        </TrackingCardSheet>
    )

    // Desktop BRN detail. Esc stays with the drawer's useEscBackout (edit → detail
    // before close), so the card's own Esc is off.
    const paneCard = (
        <PaneCard
            isOpen={!!selected}
            onClose={requestClose}
            title={selected ? [selected.brnLabel, originUic(scope.net.clusters, selected)].filter(Boolean).join(' · ') : ''}
            closeOnEsc={false}
            loading={busy}
            leading={!busy && selected ? <HeaderPill>{moreButton}</HeaderPill> : undefined}
            actions={sheetCanSave ? <PillButton icon={Check} iconSize={18} accent="success" onClick={saveEdit} label="Save" /> : undefined}
        >
            {selected && liveDraft && (
                <div className="px-4 pt-1 pb-5">
                    <TrackingEditForm entry={selected} draft={liveDraft} onChange={setEditDraft} />
                </div>
            )}
        </PaneCard>
    )

    if (isMobile) {
        return (
            <TrackingBoardScope value={scope}>
            <div className="h-full relative bg-themewhite" {...swipeBack}>
                <div className="h-full relative">
                    {/* Glass header — floats over the list; content scrolls up behind it. */}
                    <div className="absolute top-0 inset-x-0 z-10 px-3 pb-4 pt-[max(0.75rem,var(--sat,0px))] flex items-center gap-2">
                        <GlassBand edge="top" className="inset-0" />
                        <HeaderPill>
                            <PillButton icon={ChevronLeft} onClick={handleClose} label="Back" />
                        </HeaderPill>
                        <h2 className="text-[13pt] font-semibold text-primary flex-1 truncate">Tracking Board</h2>
                        <HeaderPill>
                            <PillButton icon={Settings} onClick={openSettings} label="Settings" />
                        </HeaderPill>
                    </div>
                    {/* Mobile search template (main search): the bar collapses with
                        scroll, expands on focus, and its cancel X slides in beside it.
                        The query filters the card list in place. */}
                    {/* paddingTop clears the floating header: safe-area top + pb-4 + mobile
                        HeaderPill (43px button + 2×2px pad + 2×1px border = 49px). */}
                    <div className="h-full isolate">
                        <MobileSearchBar
                            value={query}
                            onChange={setQuery}
                            placeholder="Search..."
                            className="overscroll-y-contain"
                            style={{ paddingTop: 'calc(max(0.75rem, var(--sat, 0px)) + 1rem + 49px)', paddingBottom: 'calc(1rem + var(--sab,0px))' }}
                        >
                            <div className="px-3 pb-3">
                                <TrackingCategoryBar entries={entries} value={category} onChange={setCategory} />
                            </div>
                            <TrackingCardList entries={cards} onSelect={openEntry} onMove={moveEntry} onTransit={transitEntry} onDelete={deleteEntry} />
                        </MobileSearchBar>
                    </div>
                    {/* Glass footer — feathered band so cards scroll under the home indicator. */}
                    <div className="absolute bottom-0 inset-x-0 z-10 h-[calc(2rem+var(--sab,0px))] pointer-events-none">
                        <GlassBand edge="bottom" className="inset-0" />
                    </div>
                    <div className="absolute bottom-4 right-4 z-20 pb-[max(0rem,var(--sab,0px))] pointer-events-none">
                        <AddFab label="Check in" onClick={openCheckIn} />
                    </div>
                </div>

                {cardSheet}
                {moreMenu}
                {settingsSurface}
                {checkInSurface}
            </div>
            </TrackingBoardScope>
        )
    }

    // ── Desktop: BaseDrawer overlay ──
    return (
        <TrackingBoardScope value={scope}>
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            header={{
                title: 'Tracking Board',
                rightContent: (
                    <HeaderPill>
                        <PillButton icon={Plus} onClick={openCheckIn} label="Check in" />
                    </HeaderPill>
                ),
            }}
            scrollDisabled
        >
            <div className="relative h-full">
                <div className="flex absolute inset-0 overflow-hidden">
                    {/* Left rail — mirrors the Messaging left pane: search + bare gear, then the grouped list */}
                    <DesktopRail>
                        <RailSearchRow value={query} onChange={setQuery} placeholder="Search..." onSettings={openSettings} settingsLabel="Tracking board settings" />
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
                            <SupervisorClinicFilterPanel />
                            {clusterFilterPanel}
                            <TrackingBoardList
                                entries={entries}
                                now={now}
                                activeId={activeId}
                                onSelect={openEntry}
                                onMove={moveEntry}
                                onTransit={transitEntry}
                                onDelete={deleteEntry}
                            />
                        </div>
                    </DesktopRail>

                    {/* Main pane — the grid, always; a row opens the centered card overlay */}
                    <div className="relative flex-1 min-w-0 bg-themewhite">
                        <TrackingGrid entries={entries} now={now} activeId={activeId} onSelect={openEntry} />
                        {paneCard}
                        {checkInSurface}
                        {settingsSurface}
                    </div>
                </div>
            </div>
            {moreMenu}
            {deleteConfirm}
            {discardConfirm}
        </BaseDrawer>
        </TrackingBoardScope>
    )
}
