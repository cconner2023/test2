import { createContext, useContext, type RefObject } from 'react'

/**
 * Shared desktop detail-pane wiring for TC3 sub-editors. TC3Drawer provides it;
 * TC3EditorSurface consumes it so any editor can open in the floating detail
 * card over the main column on desktop. Absent (null) on mobile — the surface
 * falls back to a bottom Sheet.
 */
export interface TC3DetailValue {
  /** The lifted card's body slot (flex flex-col, always mounted) an open editor
   *  renders into via createPortal. */
  paneRef: RefObject<HTMLDivElement | null>
  /** Called by an open editor to show / hide the floating card. */
  registerDetail: (open: boolean) => void
}

export const TC3DetailContext = createContext<TC3DetailValue | null>(null)

export const useTC3Detail = () => useContext(TC3DetailContext)
