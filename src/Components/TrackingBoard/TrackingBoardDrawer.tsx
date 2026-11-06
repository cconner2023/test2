import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Settings, Plus, MoreHorizontal, X, Check } from 'lucide-react'
import { BaseDrawer } from '@/Components/primitives/BaseDrawer'
import { Sheet } from '@/Components/primitives/Sheet'
import { PreviewOverlay } from '../PreviewOverlay'
import { MobileSearchBar } from '@/Components/primitives/MobileSearchBar'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { GlassBand } from '@/Components/primitives/GlassBand'
import { RailSearchRow } from '@/Components/primitives/RailSearchRow'
import { DesktopRail } from '@/Components/primitives/DesktopRail'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { useEscBackout } from '../../Hooks/useEscBackout'
import { useSwipeBack } from '../../Hooks/useSwipeBack'
import { useAuthStore } from '../../stores/useAuthStore'
import { useTrackingBoardData } from '../../Hooks/useTrackingBoardData'
import { useTrackingWrite } from '../../Hooks/useTrackingWrite'
import { useMapOverlayWrite } from '../../Hooks/useMapOverlayWrite'
import {
    TrackingBoardList, TrackingGrid, TrackingBoardDetail, TrackingBoardSettings,
    TrackingCategoryBar, TrackingCardList, filterByCategory, buildTrackingMenuItems,
    filterEntries, type TrackingEntry, type TrackingCategory, type CardOrigin,
    TrackingEditForm, TrackingCheckInFields, draftFromEntry, draftIsValid, emptyDraft, type TrackingEditDraft,
    measureBrnCard, measureRailCard, measureGridRow, TrackingBoardScope,
} from './TrackingBoardPanel'
import {
    boardEntries, moveData, transitData, draftData, newTrackingData, toggledFeature,
    type TrackingTarget,
} from './trackingModel'
import { TrackingCardOverlay } from './TrackingCardOverlay'
import type { LinkedFeatureRef } from '../../Types/MissionTypes'

interface TrackingBoardDrawerProps {
    isVisible: boolean
    onClose: () => void
}

/**
 * Large drawer (desktop) / full-screen right-slide panel (mobile — App.tsx
 * mounts it in the same slide as Messages, via useRightPanelSlide). Mirrors Messaging.
 * Desktop: persistent left rail (search + gear + condensed BRN cards grouped by
 * station) and a main pane that always shows the T2T-style grid. A rail card or
 * grid row opens the same TrackingCardOverlay as mobile, centered (placement
 * 'center'): it grows out of the clicked card / row and collapses back into it.
 * Rail cards right-click / long-press into the same LiftedRowMenu as mobile.
 * Ellipsis + close sit in the card head; Esc / scrim backs out.
 * Mobile: header = back · title · [check in + settings] (Messaging), then
 * search + a horizontal-scroll category strip (All / Pending / stations / Complete)
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
 * Save + Close. Save merges into the shared entry (comments union by id).
 * Check-in: a + in the header (mobile header pill beside the gear; desktop
 * drawer header) opens the standard PreviewOverlay form — self-rowing BRN pin +
 * comment TextArea (TrackingCheckInFields), Check in on the right footer once
 * the BRN is valid. Comments are never written from the detail itself.
 */
export function TrackingBoardDrawer({ isVisible, onClose }: TrackingBoardDrawerProps) {
    const isMobile = useIsMobile()
    const { viewerId, net, events, overlays, sharing, setSharing, relatedIds } = useTrackingBoardData(isVisible)
    // Re-read on every board change so expiry / dwell track the data.
    const now = useMemo(() => Date.now(), [isVisible, events]) // eslint-disable-line react-hooks/exhaustive-deps
    const { checkIn, updateEntry, deleteEntry: removeEntry } = useTrackingWrite()
    const { upsertFeature, reconcileTargets } = useMapOverlayWrite()
    const canManageSharing = useAuthStore(s => s.isSupervisorRole || s.isDevRole)
    // Link changes reach this cluster's stations here. Compares locally first, so
    // an unchanged set sends nothing.
    useEffect(() => {
        if (relatedIds && viewerId) void reconcileTargets(viewerId, relatedIds)
    }, [relatedIds, viewerId, reconcileTargets])
    const scope = useMemo(() => ({ net, viewerId }), [net, viewerId])
    // Board = fanned to the viewer (origin + ancestors), unexpired, newest-per-BRN, capped.
    const board = useMemo(() => boardEntries(events, net, viewerId, now), [events, net, viewerId, now])
    const [query, setQuery] = useState('')
    const entries = useMemo(() => filterEntries(board, query), [board, query])
    // By id, so the open detail reflects moves made from its own menu.
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const selected = useMemo(() => board.find(e => e.id === selectedId) ?? null, [board, selectedId])
    // Last open entry — keeps the mobile overlay populated through its collapse.
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
    // Non-null = the open BRN is in edit mode (draft owned here; Save in header).
    const [editDraft, setEditDraft] = useState<TrackingEditDraft | null>(null)
    const editing = !!editDraft && !!selected
    // Card overlay: where it grows from, which list card it IS (held invisible
    // until the collapse settles), and which surface to collapse back into.
    const [origin, setOrigin] = useState<CardOrigin | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [originSrc, setOriginSrc] = useState<'card' | 'rail' | 'grid'>('card')

    // Card Delete, after ConfirmDialog — 'd' to every board in the chain.
    const deleteEntry = (entry: TrackingEntry) => removeEntry(entry.id)

    // Move to any station in the origin's chain. Moving up an echelon is just a
    // move into a station the parent cluster uses.
    const moveEntry = (entry: TrackingEntry, to: TrackingTarget) =>
        updateEntry(entry.id, d => moveData(d, to, me, Date.now()))
    // Transit marker: "leaving → destination" (null clears). The patient stays put.
    const transitEntry = (entry: TrackingEntry, to: LinkedFeatureRef | null) =>
        updateEntry(entry.id, d => transitData(d, to, me, Date.now()))

    // Final action on the OPEN BRN: hold the loading morph / overlay through the
    // write. closeAfter = the entry is gone → close the detail.
    const runAction = async (apply: () => Promise<void> | void, closeAfter = false) => {
        setBusy(true)
        try { await apply() } finally {
            if (closeAfter) setSelectedId(null)
            setBusy(false)
        }
    }

    const openEntry = (e: TrackingEntry, from?: CardOrigin, src: 'card' | 'rail' | 'grid' = 'card') => {
        setOrigin(from ?? null)
        // Grid rows stay visible (a hole in the grid reads worse than the overlap).
        setExpandedId(from && src !== 'grid' ? e.id : null)
        setOriginSrc(src)
        setSelectedId(e.id)
    }
    // From the open card's ellipsis the overlay is already up — keep its origin.
    const startEdit = (e: TrackingEntry, from?: CardOrigin, src: 'card' | 'rail' = 'card') => {
        if (selectedId !== e.id) openEntry(e, from, src)
        setEditDraft(draftFromEntry(e)); setMoreRect(null)
    }
    const cancelEdit = () => setEditDraft(null)
    const canSave = !!editDraft && draftIsValid(editDraft)

    const detailMenuItems = selected ? buildTrackingMenuItems(selected, {
        onEdit: startEdit,
        onMove: (e, to) => { void runAction(() => moveEntry(e, to)) },
        onTransit: (e, to) => { void runAction(() => transitEntry(e, to)) },
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

    // Board settings toggle — edits the pin's tracking_clinic_ids on its overlay
    // (fans to the overlay's targets like any pin edit).
    const togglePlace = (ref: LinkedFeatureRef) => {
        const o = overlays.find(x => x.id === ref.overlay_id)
        const f = o?.features.find(x => x.id === ref.feature_id)
        if (!o || !f || !viewerId) return
        void upsertFeature({ overlayId: o.id, clinicId: o.clinic_id, feature: toggledFeature(f, o.clinic_id, viewerId) })
    }

    const select = (e: TrackingEntry, from?: CardOrigin) => openEntry(e, from)
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

    const settingsSurface = isMobile ? (
        <Sheet
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            title="Tracking board settings"
            height="fit"
            maxHeight={60}
            zIndex={1200}
        >
            <TrackingBoardSettings onTogglePlace={togglePlace} sharing={canManageSharing ? sharing : null} onSetSharing={setSharing} />
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
            <TrackingBoardSettings onTogglePlace={togglePlace} sharing={canManageSharing ? sharing : null} onSetSharing={setSharing} />
        </PreviewOverlay>
    )

    const checkInSurface = (
        <PreviewOverlay
            isOpen={showCheckIn}
            onClose={() => { if (!checkInBusy) setCheckInDraft(null) }}
            anchorRect={null}
            title="Check in"
            maxWidth={360}
            previewMaxHeight="60dvh"
            loading={checkInBusy}
            rightFooter={checkInDraft && draftIsValid(checkInDraft) ? (
                <FooterPill side="right">
                    <ActionButton icon={Check} label="Check in" variant="confirm" onClick={() => { void saveCheckIn() }} />
                </FooterPill>
            ) : undefined}
        >
            {checkInDraft && <TrackingCheckInFields draft={checkInDraft} onChange={setCheckInDraft} />}
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
            {cardEntry && (editing ? editForm : <TrackingBoardDetail entry={cardEntry} />)}
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
                            <TrackingCardList entries={cards} onSelect={select} onEdit={startEdit} onMove={moveEntry} onTransit={transitEntry} onDelete={deleteEntry} expandedId={expandedId} />
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
                            <TrackingBoardList
                                entries={entries}
                                now={now}
                                activeId={activeId}
                                expandedId={expandedId}
                                onSelect={(e, from) => openEntry(e, from, 'rail')}
                                onEdit={(e, from) => startEdit(e, from, 'rail')}
                                onMove={moveEntry}
                                onTransit={transitEntry}
                                onDelete={deleteEntry}
                            />
                        </div>
                    </DesktopRail>

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
