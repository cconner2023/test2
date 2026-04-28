import { createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode, RefObject } from 'react'
import { useOverlay } from '../Hooks/useOverlay'

/**
 * z-index tier tokens. Higher = renders on top.
 * These are FLOORS — when an overlay opens inside another overlay, BaseOverlay
 * reads its parent's published ceiling from context and bumps the floor up,
 * so a Modal launched from inside a PreviewOverlay always renders above the
 * popover's content without any consumer-side `zIndex` plumbing.
 */
export const Z = {
  AUTH: 30,     // full-screen auth shells (login, lock, ack) — base layer; pickers opened from within must render above
  TOAST: 40,    // notifications, banners
  SHEET: 50,    // bottom drawer / action sheet
  MODAL: 70,    // centered card modals
  POPOVER: 80,  // anchor-based pickers (above modals so they nest)
  TOUR: 90,     // tour spotlight, top-most
} as const

/** Headroom an overlay reserves above its backdrop z for its own card content.
 *  Covers PreviewOverlay's +15 inline content offset with margin.
 *  Used both as the per-depth bump and as the safety gap a child overlay clears. */
const STACK_BUMP = 30

/** Published by every open BaseOverlay = the z ceiling descendants must clear.
 *  Default 0 means "no ancestor overlay" — root tier behavior. */
const OverlayStackContext = createContext(0)

interface BaseOverlayProps {
  isOpen: boolean
  onClose: () => void
  zIndex?: number
  /** When provided, portals into this element (absolute positioning) instead of document.body (fixed). */
  containerRef?: RefObject<HTMLElement | null>
  /** Render prop — receives current visible state and the EFFECTIVE backdrop z (after any depth bump).
   *  Consumers compute their content z relative to this (e.g. Modal: effectiveZ + 1, PreviewOverlay: effectiveZ + 15). */
  children: (visible: boolean, effectiveZIndex: number) => ReactNode
}

export function BaseOverlay({
  isOpen,
  onClose,
  zIndex = Z.MODAL,
  containerRef,
  children,
}: BaseOverlayProps) {
  const { mounted, open } = useOverlay(isOpen)
  const parentCeiling = useContext(OverlayStackContext)

  if (!mounted) return null

  // Floor the requested zIndex above any ancestor overlay's published ceiling
  // so dim and content stack correctly under arbitrary nesting depth.
  const effectiveZ = Math.max(zIndex, parentCeiling)
  // Publish our own ceiling so nested overlays clear our card content.
  const childCeiling = effectiveZ + STACK_BUMP

  const scoped = !!containerRef?.current
  const target = scoped ? containerRef!.current! : document.body
  const posClass = scoped ? 'absolute' : 'fixed'

  return createPortal(
    <OverlayStackContext.Provider value={childCeiling}>
      <div
        className={`${posClass} inset-0 bg-black transition-opacity duration-300 ${open ? 'opacity-80' : 'opacity-0'}`}
        style={{ zIndex: effectiveZ, pointerEvents: open ? 'auto' : 'none' }}
        onClick={onClose}
      />
      {children(open, effectiveZ)}
    </OverlayStackContext.Provider>,
    target,
  )
}
