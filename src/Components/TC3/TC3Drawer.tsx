import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Users, Plus, Download, X } from 'lucide-react'
import { BaseDrawer } from '@/Components/primitives/BaseDrawer'
import { Sheet } from '@/Components/primitives/Sheet'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { DesktopRail } from '@/Components/primitives/DesktopRail'
import { PaneCard } from '@/Components/primitives/PaneCard'
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
 * Desktop = rail + main, no right pane (Calendar / Property / Map idiom):
 *   • LEFT  — roster rail (DesktopRail), always open.
 *   • MAIN  — the selected casualty's DD1380 card as ONE scrollable column.
 *   • CARD  — sub-editors (TC3EditorSurface) portal into a lifted
 *             PaneCard floated top-right over the main column via
 *             `paneRef`; shown while any is open (registerDetail ref-count →
 *             detailOpen).
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

  // Desktop detail card: sub-editors register while open → the floating card shows.
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
            <DesktopRail>
              <CasualtyList variant="pane" />
            </DesktopRail>
            {/* Main — selected casualty's DD1380 card, one scrollable column.
                (No slider here — the left roster rail is the desktop switcher.) */}
            <div className="relative flex-1 min-w-0 h-full">
              <TC3CardColumn />
              {/* Sub-editors float in a PaneCard over the column. keepMounted: editors
                  portal into paneRef, so the target must outlive a close; swapping
                  editors (MARCH add-menu → intervention) keeps the card in place.
                  header={false}: each editor brings its own PaneHeader. Esc is the
                  editor's (TC3EditorSurface). z-40 matches Calendar's card; menus,
                  confirms and pickers portal far above it. */}
              <PaneCard
                isOpen={detailOpen}
                onClose={() => {}}
                title="Casualty editor"
                header={false}
                selfScroll
                keepMounted
                closeOnEsc={false}
                zIndex={40}
              >
                <div ref={paneRef} className="flex flex-col flex-1 min-h-0" />
              </PaneCard>
            </div>
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
