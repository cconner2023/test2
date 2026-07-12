import { StackNavContext, type StackNav, type StackScreen } from '@/Components/stackNav'
import { PreviewOverlay } from '@/Components/PreviewOverlay'
import { useStack } from '@/Components/primitives/useStack'

export type { StackNav, StackScreen } from '@/Components/stackNav'

/**
 * OverlayStack — the PreviewOverlay-shelled drill-down ("morph") overlay.
 *
 * The counterpart to OverlayStackContext's z-STACKING: where that layers separate
 * overlays on top of each other (correct for INTERRUPTS — a confirm over a form,
 * an anchored picker — where the parent must stay visible), OverlayStack models a
 * DRILL-DOWN: one surface whose content morphs as you push/pop deeper. Tap a row
 * → its detail slides in over the same card; back chevron walks out. No dim-on-dim,
 * no nested z-index, no per-level `onBack` recompute.
 *
 * The stack navigation itself lives in the shell-free `useStack` engine; this
 * component is just its PreviewOverlay SHELL — it reuses that card's header (title
 * + back + X), footer/rightFooter pill slots and scroll area, and drops the
 * engine's morphing `body` into it. The bottom-Sheet shell (SheetStack) drives the
 * same engine, so the two surfaces morph identically.
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
  const stack = useStack({ isOpen, initial, screens, navRef })

  // No resolvable screen (bad key + no ad-hoc frame) → render nothing, matching
  // the pre-extraction behavior (the card never mounted in that state).
  if (!stack.hasScreen) return null

  // Searchable screens route through PreviewOverlay's `preview` slot so the card
  // pins its search box above the morphing body and feeds the live filter into
  // render(); plain screens render into `children`.
  const searchable = !!stack.searchPlaceholder

  return (
    <StackNavContext.Provider value={stack.nav}>
      <PreviewOverlay
        isOpen={isOpen}
        onClose={onClose}
        anchorRect={anchorRect}
        containerRef={containerRef}
        title={stack.title}
        onBack={stack.onBack}
        headerActions={stack.headerActions}
        headerLeft={stack.headerLeft}
        footer={stack.footer}
        rightFooter={stack.rightFooter}
        maxWidth={stack.screenMaxWidth ?? maxWidth}
        previewMaxHeight={stack.screenPreviewMaxHeight ?? previewMaxHeight}
        searchPlaceholder={stack.searchPlaceholder}
        zIndex={zIndex}
        loading={loading}
        hudSize={hudSize}
        preview={searchable ? (filter) => stack.body(filter) : undefined}
      >
        {searchable ? null : stack.body('')}
      </PreviewOverlay>
    </StackNavContext.Provider>
  )
}
