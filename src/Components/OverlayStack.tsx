import { useState, useRef, useMemo, useLayoutEffect } from 'react'
import { PreviewOverlay } from './PreviewOverlay'
import { StackBody } from './StackBody'
import { StackNavContext, type StackNav, type StackScreen } from './stackNav'

export type { StackNav, StackScreen } from './stackNav'

/**
 * OverlayStack — a navigation-stack ("morph") overlay primitive.
 *
 * The counterpart to OverlayStackContext's z-STACKING: where that layers separate
 * overlays on top of each other (correct for INTERRUPTS — a confirm over a form,
 * an anchored picker — where the parent must stay visible), OverlayStack models a
 * DRILL-DOWN: one surface whose content morphs as you push/pop deeper. Tap a row
 * → its detail slides in over the same card; back chevron walks out. No dim-on-dim,
 * no nested z-index, no per-level `onBack` recompute.
 *
 * Built ON TOP of PreviewOverlay — it reuses that card's header (title + back + X),
 * footer/rightFooter pill slots and scroll area, and only swaps the body content
 * with a direction-aware slide + height morph (transform/opacity + height — the
 * iOS-Safari-safe set; WAAPI, no global keyframes).
 *
 * Screens are declared as a `key → StackScreen` map. Each screen's chrome
 * (title/footer/rightFooter/headerActions) is read fresh every render, so screens
 * defined inline as closures over the host component's state stay live without any
 * imperative `setChrome` plumbing. For async/handler-driven navigation, grab the
 * nav via `navRef`.
 *
 * Back behaviour: hidden at the root, otherwise pops one level. A screen can
 * override with `onBack` (e.g. drop an in-flight draft before popping).
 *
 * See the OVERLAY PRIMITIVE / OVERLAY STACKING drawers in v2/conventions for the
 * z-stacking sibling and the drill-down-vs-interrupt rule. Consumers: DocScanner,
 * DispatchSheet, PmcsSheet, and TemplateBuilder (recursive — screens keyed by a
 * path into the node tree).
 */

/** A frame may carry its OWN screen (ad-hoc, via nav.pushScreen) — when present it
 *  wins over the host-declared `screens[key]` lookup so leaves can drill without the
 *  host pre-declaring them. */
interface Frame { key: string; params: unknown; screen?: StackScreen }

interface OverlayStackProps {
  isOpen: boolean
  onClose: () => void
  /** The root screen, restored each time the overlay (re)opens. */
  initial: { key: string; params?: unknown }
  screens: Record<string, StackScreen>
  /** Scopes the card to a container (matches PreviewOverlay.containerRef). */
  containerRef?: React.RefObject<HTMLElement | null>
  anchorRect?: DOMRect | null
  /** Populated with the live nav each render — for handler/async-driven navigation. */
  navRef?: React.MutableRefObject<StackNav | null>
  /** Default card width / scroll height (a screen may override). */
  maxWidth?: number | string
  previewMaxHeight?: string
  /** Override the z-tier (forwarded to the underlying PreviewOverlay) — bump above
   *  a host Sheet/portal when the stack is launched from inside one. */
  zIndex?: number
  /** OPT-IN loading morph (forwarded to PreviewOverlay) — HUD puck grows into the
   *  shell while the root screen's data loads. */
  loading?: boolean
  hudSize?: number
}

export function OverlayStack({
  isOpen, onClose, initial, screens, containerRef, anchorRect = null, navRef, maxWidth, previewMaxHeight, zIndex, loading, hudSize,
}: OverlayStackProps) {
  const [stack, setStack] = useState<Frame[]>([{ key: initial.key, params: initial.params }])
  const [dir, setDir] = useState<1 | -1>(1)
  const adHocId = useRef(0)

  // Restore the root screen whenever the overlay (re)opens — the host's own
  // open/close state owns lifecycle, the stack just resets to its entry point.
  const initialKey = initial.key
  useLayoutEffect(() => {
    if (isOpen) { setStack([{ key: initial.key, params: initial.params }]); setDir(1) }
    // initial is a fresh literal each render; key the reset on isOpen + the root key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialKey])

  const nav: StackNav = useMemo(() => ({
    push: (key, params) => { setDir(1); setStack(s => [...s, { key, params }]) },
    replace: (key, params) => { setDir(1); setStack(s => [...s.slice(0, -1), { key, params }]) },
    pushScreen: (screen, params) => {
      const key = `__adhoc_${++adHocId.current}`
      setDir(1); setStack(s => [...s, { key, params, screen }])
    },
    pop: () => { setDir(-1); setStack(s => (s.length > 1 ? s.slice(0, -1) : s)) },
    reset: () => { setDir(-1); setStack(s => (s.length > 1 ? [s[0]] : s)) },
    depth: stack.length,
  }), [stack.length])

  // Expose the live nav for handler/async-driven navigation in the host.
  useLayoutEffect(() => {
    if (navRef) navRef.current = nav
  }, [navRef, nav])

  const top = stack[stack.length - 1]
  const screen = top.screen ?? screens[top.key]
  if (!screen) return null

  const resolve = <T,>(v: T | ((p: any, n: StackNav) => T)): T =>
    (typeof v === 'function' ? (v as (p: any, n: StackNav) => T)(top.params, nav) : v)

  const title = typeof screen.title === 'function' ? screen.title(top.params) : screen.title
  const footer = resolve(screen.footer)
  const rightFooter = resolve(screen.rightFooter)
  const headerActions = resolve(screen.headerActions)

  const canBack = stack.length > 1
  const onBack = screen.onBack
    ? () => screen.onBack!(nav)
    : (canBack ? nav.pop : undefined)

  return (
    <StackNavContext.Provider value={nav}>
      <PreviewOverlay
        isOpen={isOpen}
        onClose={onClose}
        anchorRect={anchorRect}
        containerRef={containerRef}
        title={title}
        onBack={onBack}
        headerActions={headerActions}
        footer={footer}
        rightFooter={rightFooter}
        maxWidth={screen.maxWidth ?? maxWidth}
        previewMaxHeight={screen.previewMaxHeight ?? previewMaxHeight}
        zIndex={zIndex}
        loading={loading}
        hudSize={hudSize}
      >
        <StackBody screenKey={top.key} dir={dir}>
          {screen.render(top.params, nav)}
        </StackBody>
      </PreviewOverlay>
    </StackNavContext.Provider>
  )
}
