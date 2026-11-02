import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Settings, Plus, MoreHorizontal, X, Check } from 'lucide-react'
import { BaseDrawer } from '@/Components/primitives/BaseDrawer'
import { Sheet } from '@/Components/primitives/Sheet'
import { PreviewOverlay } from '../PreviewOverlay'
import { MobileSearchBar } from '@/Components/primitives/MobileSearchBar'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { GlassBand } from '@/Components/primitives/GlassBand'
import { RailSearchRow } from '@/Components/primitives/RailSearchRow'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { useEscBackout } from '../../Hooks/useEscBackout'
import { useSwipeBack } from '../../Hooks/useSwipeBack'
import { useAuthStore } from '../../stores/useAuthStore'
import {
    TrackingBoardList, TrackingGrid, TrackingBoardDetail, TrackingBoardSettings,
    TrackingCategoryBar, TrackingCardList, filterByCategory, buildTrackingMenuItems,
    buildMockEntries, filterEntries, type MockEntry, type TrackingCategory, type CardOrigin,
    TrackingEditForm, draftFromEntry, draftIsValid, applyDraft, emptyDraft, type TrackingEditDraft,
    measureBrnCard, measureRailCard, measureGridRow, TrackingBoardScope,
} from './TrackingBoardPanel'
import {
    MOCK_CLUSTERS, MOCK_OVERLAYS, DEFAULT_VIEWER_ID, derivePlaces, togglePlace,
    boardEntries, applyMove, applyTransit, clearTransit, subtree,
    type TrackingPosition, type MockOverlay,
} from './trackingModel'
import { TrackingCardOverlay } from './TrackingCardOverlay'
import type { LinkedFeatureRef } from '../../Types/MissionTypes'

interface TrackingBoardDrawerProps {
    isVisible: boolean
    onClose: () => void
}

/** SKELETON stand-in for the vault write, so final actions visibly run the
 *  LoadingOverlay over the card overlay. */
const MOCK_WRITE_MS = 600

/**
 * Large drawer (desktop) / full-screen right-slide panel (mobile — App.tsx
 * mounts it in the same slide as Messages, via useRightPanelSlide). Mirrors Messaging.
 * Desktop: persistent left rail (search + gear + condensed BRN cards grouped by
 * station) and a main pane that always shows the T2T-style grid. A rail card or
 * grid row opens the same TrackingCardOverlay as mobile, centered (placement
 * 'center'): it grows out of the clicked card / row and collapses back into it.
 * Ellipsis + close sit in the card head; Esc / scrim backs out.
 * Mobile: header = back · title · [check in + settings] (Messaging), then
 * search + a horizontal-scroll category strip (All / Unassigned / stations)
 * over BRN cards; cards swipe (user bindings) / long-press (LiftedRowMenu) /
 * tap (open), like chat. Card → lifted row → overlay are one object: tap (or
 * Open/Edit from the long-press menu) container-transforms the card itself
 * into TrackingCardOverlay — it grows in place (from the lifted clone when
 * opened from the menu) and collapses back into the card on close. Ellipsis +
 * close fade in at the card head's top-right.
 * Left-edge swipe closes the panel. Settings mirror Messaging: bottom Sheet on
 * mobile, PreviewOverlay popover on desktop.
 * Final actions from an open BRN run a LoadingOverlay over the card overlay
 * (Delete closes it — the card is gone, so it fades instead of collapsing).
 * Edit (ellipsis / card long-press → Edit): Calendar idiom — the detail swaps
 * to TrackingEditForm (BRN + existing comments); card head = Back (→ detail),
 * Save + Close. Save is last-write-wins over the entry.
 * Check-in: a + in the header (mobile header pill beside the gear; desktop
 * drawer header) opens a PreviewOverlay with the same TrackingEditForm (BRN +
 * comment) and a Save pill in its header — the create half of the Calendar
 * EventForm idiom. Comments are never written from the detail itself.
 */
export function TrackingBoardDrawer({ isVisible, onClose }: TrackingBoardDrawerProps) {
    const isMobile = useIsMobile()
    const now = useMemo(() => Date.now(), [isVisible]) // eslint-disable-line react-hooks/exhaustive-deps
    // Local state over the mock seed so check-in works in the skeleton.
    const [allEntries, setAllEntries] = useState<MockEntry[]>(() => buildMockEntries(now))
    useEffect(() => { setAllEntries(buildMockEntries(now)) }, [now])
    // SKELETON: viewing cluster (settings switch). Real path: the member's own cluster.
    const [viewerId, setViewerId] = useState(DEFAULT_VIEWER_ID)
    const clusters = MOCK_CLUSTERS
    // Stations = map pins marked "Add to tracking board" (AXPs included). Real
    // path: useMapOverlaysStore — overlays fanned E2E across related clusters.
    const [overlays, setOverlays] = useState<MockOverlay[]>(MOCK_OVERLAYS)
    const net = useMemo(() => ({ clusters, places: derivePlaces(overlays) }), [clusters, overlays])
    const scope = useMemo(() => ({ net, viewerId }), [net, viewerId])
    // Board = origin in the viewer's subtree, unexpired, newest-per-BRN, capped.
    const board = useMemo(() => boardEntries(allEntries, net, viewerId, now), [allEntries, net, viewerId, now])
    const [query, setQuery] = useState('')
    const entries = useMemo(() => filterEntries(board, query), [board, query])
    // By id, so the open detail reflects moves made from its own menu.
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const selected = useMemo(() => board.find(e => e.id === selectedId) ?? null, [board, selectedId])
    // Last open entry — keeps the mobile overlay populated through its collapse.
    const lastSelected = useRef<MockEntry | null>(null)
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
    const [pendingDelete, setPendingDelete] = useState<MockEntry | null>(null)
    const [busy, setBusy] = useState(false)
    // Non-null = the open BRN is in edit mode (draft owned here; Save in header).
    const [editDraft, setEditDraft] = useState<TrackingEditDraft | null>(null)
    const editing = !!editDraft && !!selected
    // Card overlay: where it grows from, which list card it IS (held invisible
    // until the collapse settles), and which surface to collapse back into.
    const [origin, setOrigin] = useState<CardOrigin | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [originSrc, setOriginSrc] = useState<'card' | 'rail' | 'grid'>('card')

    // Mock remove (card Delete, after ConfirmDialog).
    const deleteEntry = (entry: MockEntry) => {
        setAllEntries(prev => prev.filter(e => e.id !== entry.id))
    }
    // Forward: hand-off target/transport TBD. BRN is PHI, so it cannot ride a
    // plain message (no BAA); needs the E2E calendar/tracking pipeline. No-op for now.
    const forwardEntry = (_entry: MockEntry) => {}

    // Mock move (card Move to): append a move to any place in the origin's chain.
    // Moving up an echelon is just a move into a place the parent cluster uses.
    const moveEntry = (entry: MockEntry, to: TrackingPosition) => {
        const at = Date.now()
        setAllEntries(prev => prev.map(e => e.id !== entry.id ? e : applyMove(e, to, at)))
    }
    // Transit marker: "leaving → destination" (null clears). The patient stays put.
    const transitEntry = (entry: MockEntry, to: LinkedFeatureRef | null) => {
        const at = Date.now()
        setAllEntries(prev => prev.map(e => e.id !== entry.id ? e : to ? applyTransit(e, to, me, at) : clearTransit(e)))
    }

    // Final action on the OPEN BRN: hold the loading morph / overlay through the
    // (mock) write, then apply. closeAfter = the entry is gone → close the detail.
    const runAction = async (apply: () => void, closeAfter = false) => {
        setBusy(true)
        await new Promise(r => setTimeout(r, MOCK_WRITE_MS))
        apply()
        if (closeAfter) setSelectedId(null)
        setBusy(false)
    }

    const openEntry = (e: MockEntry, from?: CardOrigin, src: 'card' | 'rail' | 'grid' = 'card') => {
        setOrigin(from ?? null)
        // Grid rows stay visible (a hole in the grid reads worse than the overlap).
        setExpandedId(from && src !== 'grid' ? e.id : null)
        setOriginSrc(src)
        setSelectedId(e.id)
    }
    // From the open card's ellipsis the overlay is already up — keep its origin.
    const startEdit = (e: MockEntry, from?: CardOrigin) => {
        if (selectedId !== e.id) openEntry(e, from)
        setEditDraft(draftFromEntry(e)); setMoreRect(null)
    }
    const cancelEdit = () => setEditDraft(null)
    const canSave = !!editDraft && draftIsValid(editDraft)

    const detailMenuItems = selected ? buildTrackingMenuItems(selected, {
        onEdit: startEdit,
        onMove: (e, to) => { void runAction(() => moveEntry(e, to)) },
        onTransit: (e, to) => { void runAction(() => transitEntry(e, to)) },
        onForward: (e) => { void runAction(() => forwardEntry(e)) },
        onDelete: setPendingDelete,
        net,
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
    // Edit Save — loading morph / overlay through the (mock) write, then back to
    // the detail. Real path: whole tracking_data re-sent, last-write-wins.
    const saveEdit = () => {
        const d = editDraft
        if (!d || !selected || !draftIsValid(d)) return
        const id = selected.id
        void runAction(() => {
            const at = Date.now()
            setAllEntries(prev => prev.map(e => e.id !== id ? e : applyDraft(e, d, me, at)))
            setEditDraft(null)
        })
    }
    // Check-in Save — popover loading morph through the (mock) write.
    const saveCheckIn = async () => {
        const d = checkInDraft
        if (!d || !draftIsValid(d)) return
        setCheckInBusy(true)
        await new Promise(r => setTimeout(r, MOCK_WRITE_MS))
        const at = Date.now()
        const blank: MockEntry = { id: `e-${at}`, brn: d.brn, originClinicId: viewerId, checkedInAt: at, moves: [], comments: [] }
        // Duplicate BRN → newest injury wins: reset (drop) any older visit the
        // checker can see. Visits outside their view collapse at render
        // (boardEntries dedupe) on any board that holds both.
        const mine = subtree(clusters, viewerId)
        setAllEntries(prev => [applyDraft(blank, d, me, at), ...prev.filter(e => !(e.brn === d.brn && mine.has(e.originClinicId)))])
        setCheckInDraft(null)
        setCheckInBusy(false)
    }

    const select = (e: MockEntry, from?: CardOrigin) => openEntry(e, from)
    const clear = () => { setSelectedId(null); setMoreRect(null); setEditDraft(null) }
    const handleClose = () => { clear(); setShowSettings(false); setCheckInDraft(null); onClose() }
    const openSettings = () => setShowSettings(true)
    useEscBackout(!isMobile && !!selected && !showSettings && !showCheckIn && !moreRect && !pendingDelete && !busy, editing ? cancelEdit : clear)
    const measureRest = originSrc === 'rail' ? measureRailCard : originSrc === 'grid' ? measureGridRow : measureBrnCard
    // Mobile left-edge swipe closes the panel (the BRN detail is an overlay, not a page).
    const swipeBack = useSwipeBack(handleClose, isMobile)

    // Mobile panel stays mounted (App slide), and a backdrop tap closes it
    // without going through handleClose — reset so it reopens on the list.
    useEffect(() => {
        if (!isVisible) { setSelectedId(null); setShowSettings(false); setCheckInDraft(null); setMoreRect(null); setPendingDelete(null); setEditDraft(null) }
    }, [isVisible])

    const activeId = selected?.id ?? null

    const editForm = editing && (
        <TrackingEditForm entry={selected} draft={editDraft} onChange={setEditDraft} />
    )

    const moreMenu = moreRect && selected && (
        <AnchoredMenu
            isOpen
            anchorRect={moreRect}
            onClose={() => setMoreRect(null)}
            layout="list"
            align="right"
            items={detailMenuItems}
        />
    )

    // Must be a CHILD of the card overlay to stack above it (it publishes the z ceiling).
    const deleteConfirm = (
        <ConfirmDialog
            visible={!!pendingDelete}
            title={`Remove ${pendingDelete?.brn ?? ''} from the board?`}
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

    const changeViewer = (id: string) => { setViewerId(id); setCategory('all'); clear() }

    const settingsSurface = isMobile ? (
        <Sheet
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            title="Tracking board settings"
            height="fit"
            maxHeight={60}
            zIndex={1200}
        >
            <TrackingBoardSettings
                onViewerChange={changeViewer}
                onTogglePlace={ref => setOverlays(prev => togglePlace(prev, ref, viewerId))}
            />
        </Sheet>
    ) : (
        <PreviewOverlay
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            anchorRect={null}
            title="Tracking board settings"
            maxWidth={360}
            previewMaxHeight="70dvh"
        >
            <TrackingBoardSettings
                onViewerChange={changeViewer}
                onTogglePlace={ref => setOverlays(prev => togglePlace(prev, ref, viewerId))}
            />
        </PreviewOverlay>
    )

    const checkInSurface = (
        <PreviewOverlay
            isOpen={showCheckIn}
            onClose={() => { if (!checkInBusy) setCheckInDraft(null) }}
            anchorRect={null}
            title="Check in"
            maxWidth={380}
            previewMaxHeight="70dvh"
            loading={checkInBusy}
            headerActions={checkInDraft && draftIsValid(checkInDraft) ? (
                <PillButton icon={Check} iconSize={18} accent="success" onClick={() => { void saveCheckIn() }} label="Save" />
            ) : undefined}
        >
            {checkInDraft && (
                <div className="px-4 py-4">
                    <TrackingEditForm draft={checkInDraft} onChange={setCheckInDraft} />
                </div>
            )}
        </PreviewOverlay>
    )

    const openCheckIn = () => setCheckInDraft(emptyDraft())

    // Mobile bypasses BaseDrawer, same as MessagesDrawer: App.tsx owns the
    // horizontal slide-in, which BaseDrawer's vertical drawer model would fight.
    // BRN detail — the card itself, expanded (card → lifted → overlay). Mobile:
    // in the card's column; desktop: centered. Edit mode (Calendar idiom): Back
    // → detail, Save once valid, Close.
    const cardEntry = selected ?? lastSelected.current
    const cardOverlay = (
        <TrackingCardOverlay
            entry={cardEntry}
            open={!!selected}
            origin={origin}
            placement={isMobile ? 'column' : 'center'}
            measureRest={measureRest}
            onClose={() => { if (!busy) clear() }}
            onSettled={() => setExpandedId(null)}
            loading={busy}
            headRight={busy || !selected ? undefined : (
                <HeaderPill>
                    {editing ? (
                        <>
                            <PillButton icon={ChevronLeft} iconSize={18} onClick={cancelEdit} label="Back" />
                            {canSave && <PillButton icon={Check} iconSize={18} accent="success" onClick={saveEdit} label="Save" />}
                        </>
                    ) : moreButton}
                    <PillButton icon={X} iconSize={18} onClick={clear} label="Close" />
                </HeaderPill>
            )}
        >
            {cardEntry && (editing ? editForm : <TrackingBoardDetail entry={cardEntry} now={now} />)}
            {/* Child of the overlay so it stacks above it (overlay publishes the z ceiling). */}
            {deleteConfirm}
        </TrackingCardOverlay>
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
                            <PillButton icon={Plus} onClick={openCheckIn} label="Check in" />
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
                            <TrackingCardList entries={cards} onSelect={select} onEdit={startEdit} onMove={moveEntry} onTransit={transitEntry} onForward={forwardEntry} onDelete={deleteEntry} expandedId={expandedId} />
                        </MobileSearchBar>
                    </div>
                    {/* Glass footer — feathered band so cards scroll under the home indicator. */}
                    <div className="absolute bottom-0 inset-x-0 z-10 h-[calc(2rem+var(--sab,0px))] pointer-events-none">
                        <GlassBand edge="bottom" className="inset-0" />
                    </div>
                </div>

                {cardOverlay}
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
            desktopWidth="w-[90%]"
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
                    <div className="w-[320px] shrink-0 flex flex-col border-r border-primary/10">
                        <RailSearchRow value={query} onChange={setQuery} placeholder="Search..." onSettings={openSettings} settingsLabel="Tracking board settings" />
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
                            <TrackingBoardList entries={entries} now={now} activeId={activeId} expandedId={expandedId} onSelect={(e, from) => openEntry(e, from, 'rail')} />
                        </div>
                    </div>

                    {/* Main pane — the grid, always; a row opens the centered card overlay */}
                    <div className="relative flex-1 min-w-0 bg-themewhite">
                        <TrackingGrid entries={entries} now={now} activeId={activeId} onSelect={(e, from) => openEntry(e, from, 'grid')} />
                    </div>
                </div>
            </div>
            {cardOverlay}
            {moreMenu}
            {settingsSurface}
            {checkInSurface}
        </BaseDrawer>
        </TrackingBoardScope>
    )
}
