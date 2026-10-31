import { useMemo, useState } from 'react'
import { X, Settings } from 'lucide-react'
import { BaseDrawer, ScrollPane } from '@/Components/primitives/BaseDrawer'
import { SlideRevealPane } from '@/Components/primitives/SlideRevealPane'
import { PaneHeader } from '@/Components/primitives/PaneHeader'
import { Sheet } from '@/Components/primitives/Sheet'
import { PreviewOverlay } from '../PreviewOverlay'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { useEscBackout } from '../../Hooks/useEscBackout'
import {
    TrackingBoardList, TrackingGrid, LocationFilterRows, TrackingBoardDetail, TrackingBoardSettings,
    buildMockEntries, filterEntries, filterByLocation, type MockEntry, type LocationFilter,
} from './TrackingBoardPanel'

interface TrackingBoardDrawerProps {
    isVisible: boolean
    onClose: () => void
}


/**
 * Large drawer (desktop) / full-screen drawer (mobile).
 * Desktop: left rail (search + settings + counts) · center T2T-style grid ·
 * right detail pane; the rail collapses while the right pane is open (Calendar/
 * Map/Property split). Mobile: header = settings · search · close; one grouped
 * list; selection opens a fit sheet. Settings mirror Messaging: bottom Sheet on
 * mobile, PreviewOverlay popover on desktop.
 */
export function TrackingBoardDrawer({ isVisible, onClose }: TrackingBoardDrawerProps) {
    const isMobile = useIsMobile()
    const now = useMemo(() => Date.now(), [isVisible]) // eslint-disable-line react-hooks/exhaustive-deps
    const allEntries = useMemo(() => buildMockEntries(now), [now])
    const [query, setQuery] = useState('')
    const [location, setLocation] = useState<LocationFilter>('all')
    const searched = useMemo(() => filterEntries(allEntries, query), [allEntries, query])
    const entries = useMemo(() => filterByLocation(searched, location), [searched, location])
    const [selected, setSelected] = useState<MockEntry | null>(null)
    const [showSettings, setShowSettings] = useState(false)

    const clear = () => setSelected(null)
    const handleClose = () => { clear(); setShowSettings(false); onClose() }
    const openSettings = () => setShowSettings(true)
    useEscBackout(!isMobile && !!selected && !showSettings, clear)

    const listProps = { entries, now, activeId: selected?.id ?? null, onSelect: setSelected }
    const detail = selected && <TrackingBoardDetail entry={selected} now={now} />

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

    const searchInput = <SearchInput value={query} onChange={setQuery} placeholder="Search..." />

    const header = isMobile
        ? {
            title: '',
            rightContentFill: true,
            rightContent: (
                <div className="flex items-center w-full gap-2">
                    <HeaderPill>
                        <PillButton icon={Settings} onClick={openSettings} label="Settings" />
                    </HeaderPill>
                    <div className="flex-1 min-w-0">{searchInput}</div>
                    <HeaderPill>
                        <PillButton icon={X} onClick={handleClose} label="Close" />
                    </HeaderPill>
                </div>
            ),
            hideDefaultClose: true,
        }
        : { title: 'Tracking Board' }

    return (
        <>
            <BaseDrawer
                isVisible={isVisible}
                onClose={handleClose}
                mobileFullScreen
                desktopWidth="w-[90%]"
                header={header}
                scrollDisabled
            >
                {!isMobile ? (
                    <div className="relative h-full">
                        <div className="flex absolute inset-0 overflow-hidden">
                            <SlideRevealPane open={!selected} side="left" width={320} keepMounted className="border-r border-primary/10">
                                {/* Mirrors the Messaging left pane: search + bare gear, then lens-style filter rows */}
                                <div className="shrink-0 flex items-center gap-1.5 px-3 py-2">
                                    <div className="flex-1 min-w-0">{searchInput}</div>
                                    <button
                                        onClick={openSettings}
                                        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 text-tertiary hover:text-primary"
                                        aria-label="Tracking board settings"
                                        title="Tracking board settings"
                                    >
                                        <Settings className="w-4 h-4" />
                                    </button>
                                </div>
                                <LocationFilterRows value={location} onChange={setLocation} />
                            </SlideRevealPane>

                            <div className="flex-1 min-w-0">
                                <TrackingGrid {...listProps} />
                            </div>

                            <SlideRevealPane open={!!selected} side="right" width={420} className="border-l border-primary/10 bg-themewhite">
                                {selected && (
                                    <>
                                        <PaneHeader onBack={clear} backLabel="Close detail" title={selected.brn} />
                                        <div className="flex-1 min-h-0 overflow-hidden">
                                            <ScrollPane key={selected.id}>{detail}</ScrollPane>
                                        </div>
                                    </>
                                )}
                            </SlideRevealPane>
                        </div>
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto overscroll-y-contain">
                        <TrackingBoardList {...listProps} />
                    </div>
                )}
                {settingsSurface}
            </BaseDrawer>

            {isMobile && (
                <Sheet
                    isOpen={!!selected}
                    onClose={clear}
                    height="fit"
                    backdrop="dismiss"
                    title={selected?.brn ?? ''}
                    zIndex={1200}
                >
                    {detail && <div className="px-4 pt-1 pb-8">{detail}</div>}
                </Sheet>
            )}
        </>
    )
}
