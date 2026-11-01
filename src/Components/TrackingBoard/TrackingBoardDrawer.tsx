import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Settings, Plus, MoreHorizontal, X } from 'lucide-react'
import { BaseDrawer, ScrollPane } from '@/Components/primitives/BaseDrawer'
import { Sheet } from '@/Components/primitives/Sheet'
import { PreviewOverlay } from '../PreviewOverlay'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { RailSearchRow } from '@/Components/primitives/RailSearchRow'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { LoadingOverlay } from '@/Components/primitives/LoadingOverlay'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { useEscBackout } from '../../Hooks/useEscBackout'
import { useSwipeBack } from '../../Hooks/useSwipeBack'
import { useAuthStore } from '../../stores/useAuthStore'
import {
    TrackingBoardList, TrackingGrid, TrackingBoardDetail, TrackingBoardSettings, TrackingCheckIn,
    TrackingCategoryBar, TrackingCardList, filterByCategory, buildTrackingMenuItems,
    buildMockEntries, filterEntries, type MockEntry, type TrackingCategory,
} from './TrackingBoardPanel'

interface TrackingBoardDrawerProps {
    isVisible: boolean
    onClose: () => void
}

/** SKELETON stand-in for the vault write, so final actions visibly run the
 *  loading morph (mobile Sheet) / LoadingOverlay (desktop pane). */
const MOCK_WRITE_MS = 600

/**
 * Large drawer (desktop) / full-screen right-slide panel (mobile — App.tsx
 * mounts it in the same slide as Messages, via useRightPanelSlide). Mirrors Messaging.
 * Desktop: persistent left rail (search + gear + list grouped by station) and
 * a main pane that shows the T2T-style grid as the overview until a BRN is
 * selected, then the detail. While a BRN is open the drawer header carries its
 * title + back arrow, and an ellipsis beside the close (Move to / Forward /
 * Delete) — Esc also backs out.
 * Mobile: header = back · title · [check in + settings] (Messaging), then
 * search + a horizontal-scroll category strip (All / Unassigned / stations)
 * over BRN cards; cards swipe (user bindings) / long-press (LiftedRowMenu) /
 * tap (open), like chat. Tap opens the BRN in a bottom Sheet (Calendar event
 * detail idiom): BRN title, ellipsis in the Sheet header LEFT, close RIGHT.
 * Left-edge swipe closes the panel. Settings mirror Messaging: bottom Sheet on
 * mobile, PreviewOverlay popover on desktop.
 * Final actions from an open BRN run the Sheet's loading morph on mobile (puck
 * holds through the write, expands back into the updated detail; Delete closes
 * the sheet instead) and a LoadingOverlay over the desktop detail pane.
 * Check-in: a + in the header (mobile header pill beside the gear; desktop
 * drawer header) opens a PreviewOverlay with the BRN pin input — same
 * header-control → popover pattern as the Calendar's month/date picker.
 */
export function TrackingBoardDrawer({ isVisible, onClose }: TrackingBoardDrawerProps) {
    const isMobile = useIsMobile()
    const now = useMemo(() => Date.now(), [isVisible]) // eslint-disable-line react-hooks/exhaustive-deps
    // Local state over the mock seed so check-in works in the skeleton.
    const [allEntries, setAllEntries] = useState<MockEntry[]>(() => buildMockEntries(now))
    useEffect(() => { setAllEntries(buildMockEntries(now)) }, [now])
    const [query, setQuery] = useState('')
    const entries = useMemo(() => filterEntries(allEntries, query), [allEntries, query])
    // By id, so the open detail reflects moves made from its own menu.
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const selected = useMemo(() => allEntries.find(e => e.id === selectedId) ?? null, [allEntries, selectedId])
    // Last open entry — keeps the mobile Sheet body populated through its slide-down.
    const lastSelected = useRef<MockEntry | null>(null)
    if (selected) lastSelected.current = selected
    const [showSettings, setShowSettings] = useState(false)
    const [showCheckIn, setShowCheckIn] = useState(false)
    const [category, setCategory] = useState<TrackingCategory>('all')
    const cards = useMemo(() => filterByCategory(entries, category), [entries, category])
    // Open-BRN ellipsis menu (anchor rect) + its delete confirm + in-flight write.
    const [moreRect, setMoreRect] = useState<DOMRect | null>(null)
    const moreBtnRef = useRef<HTMLDivElement>(null)
    const [pendingDelete, setPendingDelete] = useState<MockEntry | null>(null)
    const [busy, setBusy] = useState(false)

    // Mock remove (card Delete, after ConfirmDialog).
    const deleteEntry = (entry: MockEntry) => {
        setAllEntries(prev => prev.filter(e => e.id !== entry.id))
    }
    // Forward: hand-off target/transport TBD. BRN is PHI, so it cannot ride a
    // plain message (no BAA); needs the E2E calendar/tracking pipeline. No-op for now.
    const forwardEntry = (_entry: MockEntry) => {}

    // Mock move (card Move to): append a move, or clear moves for Unassigned.
    const moveEntry = (entry: MockEntry, stationId: string | null) => {
        const at = Date.now()
        setAllEntries(prev => prev.map(e => e.id !== entry.id ? e : {
            ...e,
            moves: stationId ? [...e.moves, { to: stationId, at }] : [],
        }))
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

    const detailMenuItems = selected ? buildTrackingMenuItems(selected, {
        onMove: (e, stationId) => { void runAction(() => moveEntry(e, stationId)) },
        onForward: (e) => { void runAction(() => forwardEntry(e)) },
        onDelete: setPendingDelete,
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

    // Stamped with the checking-in member's cluster UIC (same battalion in the
    // normal case; cross-unit edge cases TBD).
    const ownUic = useAuthStore(s => s.profile?.uic) ?? ''
    const checkIn = (brn: string) => {
        const at = Date.now()
        setAllEntries(prev => [{ id: `e-${at}`, brn, uic: ownUic.toUpperCase(), checkedInAt: at, moves: [] }, ...prev])
        setShowCheckIn(false)
    }

    const select = (e: MockEntry) => setSelectedId(e.id)
    const clear = () => { setSelectedId(null); setMoreRect(null) }
    const handleClose = () => { clear(); setShowSettings(false); setShowCheckIn(false); onClose() }
    const openSettings = () => setShowSettings(true)
    useEscBackout(!isMobile && !!selected && !showSettings && !showCheckIn && !moreRect && !pendingDelete && !busy, clear)
    // Mobile left-edge swipe closes the panel (the BRN detail is a Sheet, not a page).
    const swipeBack = useSwipeBack(handleClose, isMobile)

    // Mobile panel stays mounted (App slide), and a backdrop tap closes it
    // without going through handleClose — reset so it reopens on the list.
    useEffect(() => {
        if (!isVisible) { setSelectedId(null); setShowSettings(false); setShowCheckIn(false); setMoreRect(null); setPendingDelete(null) }
    }, [isVisible])

    const listProps = { entries, now, activeId: selected?.id ?? null, onSelect: select }

    const moreMenu = moreRect && selected && (
        <AnchoredMenu
            isOpen
            anchorRect={moreRect}
            onClose={() => setMoreRect(null)}
            layout="list"
            align={isMobile ? 'left' : 'right'}
            items={detailMenuItems}
        />
    )

    // Mobile: must be a CHILD of the detail Sheet to stack above it (Calendar note).
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

    const settingsSurface = isMobile ? (
        <Sheet
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            title="Tracking board settings"
            height="fit"
            maxHeight={60}
            zIndex={1200}
        >
            <TrackingBoardSettings />
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
            <TrackingBoardSettings />
        </PreviewOverlay>
    )

    const checkInSurface = (
        <PreviewOverlay
            isOpen={showCheckIn}
            onClose={() => setShowCheckIn(false)}
            anchorRect={null}
            title="Check in"
            maxWidth={340}
        >
            <TrackingCheckIn onCheckIn={checkIn} />
        </PreviewOverlay>
    )

    const openCheckIn = () => setShowCheckIn(true)

    const searchInput = <SearchInput value={query} onChange={setQuery} placeholder="Search..." />

    // Mobile bypasses BaseDrawer, same as MessagesDrawer: App.tsx owns the
    // horizontal slide-in, which BaseDrawer's vertical drawer model would fight.
    if (isMobile) {
        const sheetEntry = selected ?? lastSelected.current
        return (
            <div className="h-full relative bg-themewhite" {...swipeBack}>
                <div className="h-full flex flex-col">
                    <div className="shrink-0 px-3 py-3 pt-[max(0.75rem,var(--sat,0px))] flex items-center gap-2">
                        <HeaderPill>
                            <PillButton icon={ChevronLeft} onClick={handleClose} label="Back" />
                        </HeaderPill>
                        <h2 className="text-[13pt] font-semibold text-primary flex-1 truncate">Tracking Board</h2>
                        <HeaderPill>
                            <PillButton icon={Plus} onClick={openCheckIn} label="Check in" />
                            <PillButton icon={Settings} onClick={openSettings} label="Settings" />
                        </HeaderPill>
                    </div>
                    {/* Search + category strip pinned under the header; cards scroll. */}
                    <div className="shrink-0 px-3 pb-3 space-y-2">
                        {searchInput}
                        <TrackingCategoryBar value={category} onChange={setCategory} />
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
                        <TrackingCardList entries={cards} onSelect={select} onMove={moveEntry} onForward={forwardEntry} onDelete={deleteEntry} />
                    </div>
                </div>

                {/* BRN detail — bottom Sheet; ellipsis LEFT, close RIGHT (Calendar event detail). */}
                <Sheet
                    isOpen={!!selected}
                    onClose={clear}
                    title={sheetEntry?.brn ?? ''}
                    height="fit"
                    maxHeight={85}
                    zIndex={1200}
                    loading={busy}
                    draggable={!busy}
                    leftContent={selected && !busy ? <HeaderPill>{moreButton}</HeaderPill> : undefined}
                >
                    {sheetEntry && (
                        <div className="px-4 pt-1 pb-6">
                            <TrackingBoardDetail entry={sheetEntry} now={now} />
                        </div>
                    )}
                    {deleteConfirm}
                </Sheet>
                {moreMenu}
                {settingsSurface}
                {checkInSurface}
            </div>
        )
    }

    // ── Desktop: BaseDrawer overlay ──
    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            desktopWidth="w-[90%]"
            header={selected
                ? {
                    title: selected.brn,
                    showBack: true,
                    onBack: clear,
                    // Ellipsis folded into the close pill (EventDetailPanel header idiom).
                    hideDefaultClose: true,
                    rightContent: (
                        <HeaderPill>
                            {moreButton}
                            <PillButton icon={X} onClick={handleClose} label="Close" />
                        </HeaderPill>
                    ),
                }
                : {
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
                        <RailSearchRow search={searchInput} onSettings={openSettings} settingsLabel="Tracking board settings" />
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
                            <TrackingBoardList {...listProps} />
                        </div>
                    </div>

                    {/* Main pane — grid overview until a BRN is selected, then its detail */}
                    <div className="relative flex-1 min-w-0 bg-themewhite">
                        {selected ? (
                            <ScrollPane key={selected.id}>
                                <div className="max-w-2xl mx-auto">
                                    <TrackingBoardDetail entry={selected} now={now} />
                                </div>
                            </ScrollPane>
                        ) : (
                            <TrackingGrid {...listProps} />
                        )}
                        <LoadingOverlay visible={busy} />
                    </div>
                </div>
            </div>
            {moreMenu}
            {deleteConfirm}
            {settingsSurface}
            {checkInSurface}
        </BaseDrawer>
    )
}
