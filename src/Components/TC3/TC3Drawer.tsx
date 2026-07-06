import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Users, Plus, Download, X } from 'lucide-react'
import { BaseDrawer } from '@/Components/primitives/BaseDrawer'
import { Sheet } from '@/Components/primitives/Sheet'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { useTC3Store } from '../../stores/useTC3Store'
import { TC3CardColumn } from './TC3CardColumn'
import { CasualtyList } from './CasualtyList'
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
 * Mobile: full-screen glass-header drawer — casualties (left) + close (right);
 *   the casualties pill opens a bottom Sheet roster (New / Export All ride its
 *   header as no-fill pills). Body = the same single scrollable card column;
 *   sub-editors open as Sheets.
 */
export const TC3Drawer = memo(function TC3Drawer({ isVisible, onClose }: TC3DrawerProps) {
  const isMobile = useIsMobile()
  const [rosterOpen, setRosterOpen] = useState(false) // mobile roster Sheet

  const card = useTC3Store((s) => s.card)
  const casualtyQueue = useTC3Store((s) => s.casualtyQueue)
  const pushToQueue = useTC3Store((s) => s.pushToQueue)
  const openExportForCards = useTC3Store((s) => s.openExportForCards)

  const rosterCount = casualtyQueue.length + 1
  const isMASCAL = rosterCount > 1

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
          // Single scrollable card column, cleared below the floating glass header.
          <div className="h-full" style={{ paddingTop: 'var(--drawer-header-h, 0px)' }}>
            <TC3CardColumn />
          </div>
        ) : (
          <div className="flex h-full relative">
            {/* Left — roster rail; collapses when a sub-editor opens the right pane. */}
            <div
              className={`shrink-0 border-r border-primary/10 bg-themewhite3 flex flex-col transition-all duration-300 ${
                detailOpen ? 'w-0 opacity-0 overflow-hidden border-r-0' : 'w-72 opacity-100'
              }`}
            >
              <CasualtyList variant="pane" />
            </div>
            {/* Main — selected casualty's DD1380 card, one scrollable column. */}
            <div className="flex-1 min-w-0 h-full">
              <TC3CardColumn />
            </div>
            {/* Right — docked detail pane; sub-editors render in directly
                (EventDetailPanel-style) via a portal into paneRef. */}
            <div
              ref={paneRef}
              className={`shrink-0 border-l border-primary/10 bg-themewhite3 flex flex-col transition-all duration-300 ${
                detailOpen ? 'w-[380px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'
              }`}
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
          actions={rosterActions}
        >
          <CasualtyList variant="sheet" onAfterSelect={() => setRosterOpen(false)} />
        </Sheet>
      )}
    </TC3DetailContext.Provider>
  )
})
