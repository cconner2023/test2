import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Users, Plus, Download, X } from 'lucide-react'
import { BaseDrawer } from '@/Components/primitives/BaseDrawer'
import { Sheet } from '@/Components/primitives/Sheet'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { SlideRevealPane } from '@/Components/primitives/SlideRevealPane'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { useTC3Store } from '../../stores/useTC3Store'
import { TC3CardColumn } from './TC3CardColumn'
import { CasualtyList } from './CasualtyList'
import { CasualtyLevelSlider } from './CasualtyLevelSlider'
import { orderByPriority, buildCasualtyStops } from './casualtyOrder'
import { TC3DetailContext, type TC3DetailValue } from './TC3DetailContext'

interface TC3DrawerProps {
  isVisible: boolean
  onClose: () => void
}

/**
 * TC3 (Tactical Combat Casualty Care) as a large base drawer — a sibling of the
 * calendar / map-overlay / property drawers rather than a global app "mode".
 *
 * Desktop = the three-zone panel primitive:
 *   • LEFT  — roster rail; collapses when a sub-editor opens.
 *   • MAIN  — the selected casualty's DD1380 card as ONE scrollable column.
 *   • RIGHT — docked detail pane. Card sub-editors (TC3EditorSurface) portal in
 *             via `paneRef`; while any is open the rail collapses and the pane
 *             opens (registerDetail ref-count → detailOpen).
 * Mobile: full-screen glass-header drawer — casualties (left) + New / Export All
 *   / close in the top-right pill, matching desktop. The casualties pill opens a
 *   bottom Sheet roster. Body = the same single scrollable card column;
 *   sub-editors open as Sheets.
 */
export const TC3Drawer = memo(function TC3Drawer({ isVisible, onClose }: TC3DrawerProps) {
  const isMobile = useIsMobile()
  const [rosterOpen, setRosterOpen] = useState(false) // mobile roster Sheet

  const card = useTC3Store((s) => s.card)
  const casualtyQueue = useTC3Store((s) => s.casualtyQueue)
  const pushToQueue = useTC3Store((s) => s.pushToQueue)
  const restoreFromQueue = useTC3Store((s) => s.restoreFromQueue)
  const openExportForCards = useTC3Store((s) => s.openExportForCards)

  const rosterCount = casualtyQueue.length + 1
  const isMASCAL = rosterCount > 1

  // Triage-ladder slider: priority-ordered notches (most urgent on top). Tapping
  // or dragging to a notch makes that casualty active (same switch as the roster).
  const sliderStops = useMemo(
    () =>
      buildCasualtyStops(
        orderByPriority([{ card }, ...casualtyQueue.map((e) => ({ card: e.card }))]).map((r) => r.card),
      ),
    [card, casualtyQueue],
  )
  const handleSliderSelect = useCallback(
    (id: string) => {
      if (id !== card.id) restoreFromQueue(id)
    },
    [card.id, restoreFromQueue],
  )

  // Desktop detail pane: sub-editors register while open → rail collapses, pane opens.
  const paneRef = useRef<HTMLDivElement>(null)
  const [detailCount, setDetailCount] = useState(0)
  const registerDetail = useCallback(
    (open: boolean) => setDetailCount((c) => Math.max(0, c + (open ? 1 : -1))),
    [],
  )
  const detailOpen = detailCount > 0
  const detailValue = useMemo<TC3DetailValue>(() => ({ paneRef, registerDetail }), [registerDetail])

  const allCards = useMemo(
    () =>
      [card, ...casualtyQueue.map((e) => e.card)].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [card, casualtyQueue],
  )

  const handleNew = () => {
    pushToQueue()
    if (isMobile) setRosterOpen(false)
  }

  const handleExportAll = () => {
    openExportForCards(allCards)
    if (isMobile) setRosterOpen(false)
  }

  // Roster actions (no-fill pills) shared by both hosts, rendered next to Close.
  const rosterActions = (
    <>
      <PillButton icon={Plus} onClick={handleNew} label="New casualty" />
      {isMASCAL && <PillButton icon={Download} onClick={handleExportAll} label="Export all" />}
    </>
  )

  const header = isMobile
    ? {
        title: 'TC3',
        leftContent: (
          <HeaderPill>
            <PillButton icon={Users} onClick={() => setRosterOpen(true)} label="Casualties" />
          </HeaderPill>
        ),
        // Same top-right cluster as desktop — New (+ Export all when MASCAL)
        // ride the close pill rather than hiding inside the roster sheet.
        hideDefaultClose: true,
        rightContent: (
          <HeaderPill>
            {rosterActions}
            <PillButton icon={X} onClick={onClose} label="Close" />
          </HeaderPill>
        ),
      }
    : {
        title: 'TC3',
        hideDefaultClose: true,
        rightContent: (
          <HeaderPill>
            {rosterActions}
            <PillButton icon={X} onClick={onClose} label="Close" />
          </HeaderPill>
        ),
      }

  return (
    <TC3DetailContext.Provider value={detailValue}>
      <BaseDrawer
        isVisible={isVisible}
        onClose={onClose}
        mobileFullScreen
        fullHeight="95dvh"
        desktopWidth="w-[90%]"
        header={header}
        glassHeader={isMobile}
        scrollDisabled
      >
        {isMobile ? (
          // Single scrollable card column. The glass-header clearance lives INSIDE
          // TC3CardColumn (not here) so the card scrolls UNDER the frosted band —
          // padding the wrapper instead parks the content below the header and the
          // glass has nothing to blur.
          <div className="relative h-full">
            <TC3CardColumn />
            {isMASCAL && (
              <div className="absolute right-3 z-20 top-[calc(var(--drawer-header-h,3.5rem)+1rem)]">
                <CasualtyLevelSlider entries={sliderStops} activeId={card.id} onSelect={handleSliderSelect} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full relative">
            {/* Left — roster rail; collapses (slides out left) when a sub-editor opens the right pane. */}
            <SlideRevealPane
              open={!detailOpen}
              side="left"
              width={288}
              keepMounted
              className="border-r border-primary/10 bg-themewhite"
            >
              <CasualtyList variant="pane" />
            </SlideRevealPane>
            {/* Main — selected casualty's DD1380 card, one scrollable column.
                (No slider here — the left roster rail is the desktop switcher.) */}
            <div className="flex-1 min-w-0 h-full">
              <TC3CardColumn />
            </div>
            {/* Right — docked detail pane; sub-editors render in directly
                (EventDetailPanel-style) via a portal into paneRef. */}
            <SlideRevealPane
              ref={paneRef}
              open={detailOpen}
              side="right"
              width={380}
              className="border-l border-primary/10 bg-themewhite"
            />
          </div>
        )}
      </BaseDrawer>

      {isMobile && (
        <Sheet
          isOpen={rosterOpen}
          onClose={() => setRosterOpen(false)}
          title="Casualties"
          maxHeight={60}
          zIndex={1200}
        >
          <CasualtyList variant="sheet" onAfterSelect={() => setRosterOpen(false)} />
        </Sheet>
      )}
    </TC3DetailContext.Provider>
  )
})
