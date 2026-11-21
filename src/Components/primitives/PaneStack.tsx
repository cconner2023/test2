import { ChevronLeft } from 'lucide-react'
import { Sheet } from '@/Components/primitives/Sheet'
import { PaneCard } from '@/Components/primitives/PaneCard'
import { useStack, type StackController } from '@/Components/primitives/useStack'
import { LayeredStackBody } from '@/Components/primitives/LayeredStackBody'
import { SkeletonRows } from '@/Components/primitives/Skeleton'
import { usePaneHost, usePublishToPaneHost, type PaneHost } from '@/Components/primitives/paneHost'
import { StackNavContext, type StackNav, type StackScreen } from '@/Components/stackNav'
import { useEscBackout } from '../../Hooks/useEscBackout'
import { useIsMobile } from '../../Hooks/useIsMobile'

export type { StackNav, StackScreen } from '@/Components/stackNav'

/**
 * PaneStack — the ADAPTIVE drill-down ("morph") surface: a fit bottom Sheet on
 * mobile, a PaneCard over the host's `relative` main pane on desktop. Same useStack
 * engine and same `screens` map as OverlayStack, so a form that used to be an
 * anchored PreviewOverlay swaps shells without touching its screens.
 *
 * Desktop inside a PaneHostContext: publishes into the host's one card (last opened
 * wins — no second card stacked over a sibling detail). Without a host: its own
 * PaneCard.
 *
 * Chrome is uniform at every depth (unlike SheetStack's root* props): title,
 * headerLeft (or a Back chevron once drilled), headerActions folded into the close
 * pill, and the screen's footer / rightFooter. On the Sheet the rightFooter (the
 * screen's one primary action) rides the header and the left footer pins under the
 * body; on the PaneCard both sit in the footer row.
 *
 * LOADING — a skeleton over the body, never the HUD puck / LoadingOverlay (the
 * surface stays live; 2026-11-20). Covers the first fetch and in-flight writes. The
 * body stays mounted (invisible) underneath, so form state and card height hold.
 */

interface PaneStackProps {
  isOpen: boolean
  onClose: () => void
  initial: { key: string; params?: unknown }
  screens: Record<string, StackScreen>
  navRef?: React.MutableRefObject<StackNav | null>
  /** Skeleton over the body (first fetch or a write in flight). */
  loading?: boolean
  /** Mobile Sheet max height (dvh %). Default 70. */
  maxHeight?: number
  /** Mobile Sheet z-index. Default 1250 (above a BaseDrawer page). */
  zIndex?: number
  /** Desktop PaneCard width. */
  width?: number
}

function paneFooter(stack: StackController) {
  return stack.footer || stack.rightFooter ? (
    <div className="flex items-center justify-between px-2 py-2">
      {stack.footer ?? <div />}
      {stack.rightFooter}
    </div>
  ) : undefined
}

function stackBody(stack: StackController, loading?: boolean) {
  return (
    <StackNavContext.Provider value={stack.nav}>
      <div className="relative" style={loading ? { minHeight: 200 } : undefined}>
        <div className={loading ? 'invisible' : undefined} aria-hidden={loading || undefined}>
          <LayeredStackBody frames={stack.frames} searchPlaceholder={stack.searchPlaceholder} />
        </div>
        {loading && (
          <div className="absolute inset-0 overflow-hidden">
            <SkeletonRows count={5} variant="text" delay={0} />
          </div>
        )}
      </div>
    </StackNavContext.Provider>
  )
}

function PaneStackPublisher({ host, onClose, stack, loading }: {
  host: PaneHost
  onClose: () => void
  stack: StackController
  loading?: boolean
}) {
  useEscBackout(!loading, () => (stack.onBack ?? onClose)())
  usePublishToPaneHost(host, {
    title: stack.title ?? '',
    onBack: stack.onBack,
    leading: stack.headerLeft,
    actions: stack.headerActions,
    footer: paneFooter(stack),
    onClose,
    body: stackBody(stack, loading),
  })
  return null
}

export function PaneStack({
  isOpen, onClose, initial, screens, navRef, loading, maxHeight = 70, zIndex = 1250, width,
}: PaneStackProps) {
  const isMobile = useIsMobile()
  const host = usePaneHost()
  const stack = useStack({ isOpen, initial, screens, navRef })
  useEscBackout(!isMobile && !host && isOpen && !loading, () => (stack.onBack ?? onClose)())

  if (!stack.hasScreen) return null

  if (isMobile) {
    // A screen's own onBack (e.g. a form stage at the root) also earns the chevron.
    const drilled = !!stack.onBack
    return (
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        height="fit"
        maxHeight={maxHeight}
        zIndex={zIndex}
        // A drag mid-drill shouldn't dismiss an in-flight form; Back owns reversal.
        draggable={!drilled}
        title={stack.title}
        leftContent={drilled ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={stack.onBack}
              aria-label="Back"
              className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            {stack.headerLeft}
          </div>
        ) : stack.headerLeft}
        rightContent={stack.rightFooter ?? undefined}
        actions={stack.headerActions}
      >
        {stackBody(stack, loading)}
        {stack.footer && (
          <div className="sticky bottom-0 bg-themewhite3 border-t border-tertiary/10 flex items-center px-2 py-2">
            {stack.footer}
          </div>
        )}
      </Sheet>
    )
  }

  if (host) {
    return isOpen ? <PaneStackPublisher host={host} onClose={onClose} stack={stack} loading={loading} /> : null
  }

  return (
    <PaneCard
      isOpen={isOpen}
      onClose={onClose}
      closeOnEsc={false}
      title={stack.title ?? ''}
      onBack={stack.onBack}
      leading={stack.headerLeft}
      actions={stack.headerActions}
      footer={paneFooter(stack)}
      width={width}
    >
      {stackBody(stack, loading)}
    </PaneCard>
  )
}
