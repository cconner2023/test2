import { useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { StackNavContext, type StackNav, type StackScreen } from '@/Components/stackNav'
import { PreviewOverlay } from '@/Components/PreviewOverlay'
import { useStack, type StackController } from '@/Components/primitives/useStack'
import { LayeredStackBody } from '@/Components/primitives/LayeredStackBody'
import { SearchDropdownCard } from '@/Components/primitives/SearchDropdown'
import { LoadingOverlay } from '@/Components/primitives/LoadingOverlay'
import { PaneHeader } from '@/Components/primitives/PaneHeader'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { useEscBackout } from '../../Hooks/useEscBackout'

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

/** A lifted detail card that a stack can morph into instead of opening an overlay.
 *  The host owns the slot and hides its own card while `onActiveChange(true)` holds. */
export interface CardMorphHost {
  el: HTMLElement | null
  onActiveChange: (active: boolean) => void
}

/** The lifted-card shell for useStack: same engine and screens as the overlay, but
 *  rendered into the host's card slot, with no scrim so the canvas stays live. */
function CardStackShell({ stack, host, onClose, loading }: {
  stack: StackController
  host: CardMorphHost
  onClose: () => void
  loading?: boolean
}) {
  const { onActiveChange } = host
  useLayoutEffect(() => {
    onActiveChange(true)
    return () => onActiveChange(false)
  }, [onActiveChange])
  useEscBackout(true, () => (stack.onBack ?? onClose)())

  if (!host.el) return null
  const hasFooter = !!(stack.footer || stack.rightFooter)
  return createPortal(
    <StackNavContext.Provider value={stack.nav}>
      <SearchDropdownCard
        className="pointer-events-auto relative"
        ariaLabel={stack.title}
        header={
          <PaneHeader
            onBack={stack.onBack}
            leading={stack.headerLeft}
            title={stack.title}
            actions={
              <HeaderPill>
                {stack.headerActions}
                <PillButton icon={X} iconSize={18} onClick={onClose} label="Close" />
              </HeaderPill>
            }
          />
        }
        footer={hasFooter ? (
          <div className="flex items-center justify-between px-2 py-2">
            {stack.footer ?? <div />}
            {stack.rightFooter}
          </div>
        ) : undefined}
      >
        <LoadingOverlay visible={!!loading} />
        <LayeredStackBody frames={stack.frames} searchPlaceholder={stack.searchPlaceholder} />
      </SearchDropdownCard>
    </StackNavContext.Provider>,
    host.el,
  )
}

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
  /** Morph into this lifted card instead of opening an overlay. */
  cardHost?: CardMorphHost
}

export function OverlayStack({
  isOpen, onClose, initial, screens, containerRef, anchorRect = null, navRef, maxWidth, previewMaxHeight, zIndex, loading, hudSize, cardHost,
}: OverlayStackProps) {
  const stack = useStack({ isOpen, initial, screens, navRef })

  // No resolvable screen (bad key + no ad-hoc frame) → render nothing, matching
  // the pre-extraction behavior (the card never mounted in that state).
  if (!stack.hasScreen) return null

  if (cardHost) {
    return isOpen ? <CardStackShell stack={stack} host={cardHost} onClose={onClose} loading={loading} /> : null
  }

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
