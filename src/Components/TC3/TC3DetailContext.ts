import { createContext, useContext, type RefObject } from 'react'

/**
 * Shared desktop detail-pane wiring for TC3 sub-editors. TC3Drawer provides it;
 * TC3EditorSurface consumes it so any editor can open in the docked right pane
 * (collapsing the roster rail) on desktop. Absent (null) on mobile — the surface
 * falls back to a bottom Sheet.
 */
export interface TC3DetailValue {
  /** The docked right-pane element PreviewOverlay portals into (position: relative). */
  paneRef: RefObject<HTMLDivElement | null>
  /** Called by an open editor to drive the rail-collapse / pane-open transition. */
  registerDetail: (open: boolean) => void
}

export const TC3DetailContext = createContext<TC3DetailValue | null>(null)

export const useTC3Detail = () => useContext(TC3DetailContext)
