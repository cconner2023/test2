import { useState, useRef, useMemo, useLayoutEffect, type ReactNode } from 'react'
import { StackBody } from './StackBody'
import { StackNavContext, type StackNav, type StackScreen } from './stackNav'

export { StackNavContext } from './stackNav'
export type { StackNav, StackScreen } from './stackNav'

/**
 * useStack — the container-agnostic drill-down ("morph") ENGINE.
 *
 * The stack logic (frame list, push/pop/replace/pushScreen nav, direction-aware
 * body morph, reset-on-open) used to live welded inside OverlayStack, which also
 * owns a PreviewOverlay card shell. That coupling meant only overlay-shaped
 * surfaces could morph; a bottom Sheet couldn't host a drill stack without
 * re-implementing it.
 *
 * This hook is the shell-free half. It owns ONLY the navigation state + the
 * resolved chrome of the current (top) screen, and hands back a `body(filter)`
 * renderer (the StackBody morph layer) plus the live `nav`. Any shell — the
 * PreviewOverlay card (OverlayStack) OR the bottom Sheet (SheetStack) — feeds the
 * returned title / onBack / footer / rightFooter into its own header and renders
 * `body()` where its content goes. Same engine → identical morph in both.
 *
 * Dependency-light on purpose (StackBody + stackNav only, like stackNav.ts) so it
 * can be consumed by leaf-adjacent shells without the FormInputs → OverlayStack →
 * PreviewOverlay → FormInputs cycle.
 *
 * Host contract:
 *  1. Wrap the shell subtree in `<StackNavContext.Provider value={nav}>` so
 *     drill-capable leaves (the FormInputs pickers) morph in place instead of
 *     opening their own nested overlay.
 *  2. At the root (`canBack === false`) the shell may render its OWN chrome (e.g.
 *     a Sheet's mode pills); once drilled (`canBack === true`) it should surface
 *     the stack's `title` + a Back button wired to `onBack`.
 *  3. Render `body(filter)` as the shell's scrollable content.
 */

/** A frame may carry its OWN screen (ad-hoc, via nav.pushScreen) — when present it
 *  wins over the host-declared `screens[key]` lookup so leaves can drill without the
 *  host pre-declaring them. */
interface Frame { key: string; params: unknown; screen?: StackScreen }

export interface StackController {
  /** Live nav — put on StackNavContext AND hand to `navRef` consumers. */
  nav: StackNav
  /** Current depth (1 = root). */
  depth: number
  /** True when deeper than the root. Shells swap their own chrome for the stack's
   *  Back + title here. */
  canBack: boolean
  /** False when the top frame resolved to no screen (bad key + no ad-hoc). Shells
   *  that own their whole surface (OverlayStack) should render nothing then. */
  hasScreen: boolean
  // ── Resolved chrome for the TOP screen (recomputed fresh every render, so
  //    inline-closure screens over host state stay live) ──
  title?: string
  /** Default back = pop when deep (or a screen's own `onBack`); undefined at root. */
  onBack?: () => void
  footer?: ReactNode
  rightFooter?: ReactNode
  headerActions?: ReactNode
  searchPlaceholder?: string
  /** Per-screen width override, if the top screen declared one. */
  screenMaxWidth?: number | string
  /** Per-screen scroll-height override, if the top screen declared one. */
  screenPreviewMaxHeight?: string
  /** The morphing body for the current screen. Pass the live search filter (default '').
   *  UNMOUNT-morph: renders ONLY the top screen (StackBody keys+unmounts on push).
   *  Correct when frame state lives in the host (OverlayStack consumers). */
  body: (filter?: string) => ReactNode
  /** Direction of the last nav (1 = push/right, -1 = pop/left). */
  dir: 1 | -1
  /** Every live frame, top-inclusive, each with its own body renderer. Feeds the
   *  MOUNT-PRESERVING shell (LayeredStackBody): all frames stay mounted so a base
   *  screen with local state (e.g. an edit form) survives a selector drill. */
  frames: { key: string; render: (filter?: string) => ReactNode }[]
}

export function useStack({
  isOpen,
  initial,
  screens,
  navRef,
}: {
  /** Drives the reset-to-root: whenever the shell (re)opens the stack returns to
   *  its entry point. The shell owns lifecycle; the engine just resets. */
  isOpen: boolean
  /** The root screen, restored each time `isOpen` (or the root key) changes. */
  initial: { key: string; params?: unknown }
  /** Declared screens (key → StackScreen). Ad-hoc pushes bypass this map. */
  screens: Record<string, StackScreen>
  /** Populated with the live nav each render — for handler / async-driven nav. */
  navRef?: React.MutableRefObject<StackNav | null>
}): StackController {
  const [stack, setStack] = useState<Frame[]>([{ key: initial.key, params: initial.params }])
  const [dir, setDir] = useState<1 | -1>(1)
  const adHocId = useRef(0)

  // Restore the root screen whenever the shell (re)opens. `initial` is a fresh
  // literal each render, so key the reset on isOpen + the root key (not `initial`).
  const initialKey = initial.key
  useLayoutEffect(() => {
    if (isOpen) { setStack([{ key: initial.key, params: initial.params }]); setDir(1) }
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

  // Expose the live nav for handler / async-driven navigation in the host.
  useLayoutEffect(() => {
    if (navRef) navRef.current = nav
  }, [navRef, nav])

  const top = stack[stack.length - 1]
  const screen: StackScreen | undefined = top.screen ?? screens[top.key]

  const resolve = <T,>(v: T | ((p: any, n: StackNav) => T)): T =>
    (typeof v === 'function' ? (v as (p: any, n: StackNav) => T)(top.params, nav) : v)

  const canBack = stack.length > 1
  const title = screen
    ? (typeof screen.title === 'function' ? screen.title(top.params) : screen.title)
    : undefined
  const footer = screen ? resolve(screen.footer) : undefined
  const rightFooter = screen ? resolve(screen.rightFooter) : undefined
  const headerActions = screen ? resolve(screen.headerActions) : undefined
  const onBack = screen?.onBack
    ? () => screen.onBack!(nav)
    : (canBack ? nav.pop : undefined)

  // Searchable screens feed the live filter into render()'s 3rd arg; plain screens
  // get ''. Either way the same StackBody morph layer keys on the top frame.
  const body = (filter = '') =>
    screen ? (
      <StackBody screenKey={top.key} dir={dir}>
        {screen.render(top.params, nav, filter)}
      </StackBody>
    ) : null

  // Resolved renderer per frame — for the mount-preserving LayeredStackBody. Each
  // frame's render closure runs while it's the base too (it's always mounted), so a
  // base form keeps rendering (hidden) under a drilled selector.
  const frames = stack.map((f) => {
    const s = f.screen ?? screens[f.key]
    return {
      key: f.key,
      render: (filter = '') => (s ? s.render(f.params, nav, filter) : null),
    }
  })

  return {
    nav,
    depth: stack.length,
    canBack,
    hasScreen: !!screen,
    title,
    onBack,
    footer,
    rightFooter,
    headerActions,
    searchPlaceholder: screen?.searchPlaceholder,
    screenMaxWidth: screen?.maxWidth,
    screenPreviewMaxHeight: screen?.previewMaxHeight,
    body,
    dir,
    frames,
  }
}
