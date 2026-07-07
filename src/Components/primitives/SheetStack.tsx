import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Sheet } from '@/Components/primitives/Sheet'
import { useStack } from '@/Components/primitives/useStack'
import { StackBody } from '@/Components/primitives/StackBody'
import { LayeredStackBody } from '@/Components/primitives/LayeredStackBody'
import { StackNavContext, type StackNav, type StackScreen } from '@/Components/stackNav'

export type { StackNav, StackScreen } from '@/Components/stackNav'

/**
 * SheetStack — the bottom-Sheet shell over the shared `useStack` drill-down engine.
 * The Sheet-side sibling of OverlayStack (which shells the SAME engine in a
 * PreviewOverlay card), so a sheet and a popover morph identically. This is the
 * primitive that used to be hand-wired inline in CalendarPanel — the day-drawer
 * Sheet whose EventForm selectors drill in place. New sheet-drill hosts reach for
 * this instead of re-wiring useStack + a body layer by hand.
 *
 * BODY LAYER — `preserveFrames` (default TRUE):
 *  - true  → LayeredStackBody: every frame stays MOUNTED, so a ROOT screen that owns
 *            local useState (an edit form's draft) survives a selector drill. This is
 *            the common sheet case (drilling a picker out of a form). Morph = height +
 *            opacity only (no horizontal translate — safe full-bleed in a Sheet).
 *  - false → StackBody: unmount-morph (top frame only, key-unmount). Use when screen
 *            state lives in the host and each screen is disposable.
 *
 * CHROME — at the ROOT (`canBack === false`) the Sheet shows the host's own chrome
 * (`rootTitle` / `rootLeftContent` / `rootRightContent`). Once drilled the header
 * swaps to the stack's screen title, a Back chevron that POPS one level (left), and
 * the screen's `rightFooter` (right). The Sheet's built-in X still dismisses the
 * WHOLE sheet at any depth. Drag-to-dismiss is auto-disabled while drilled so a stray
 * drag can't discard an in-flight selection.
 *
 * See the OVERLAY PRIMITIVE / STACK PRIMITIVE drawers in v2/conventions for the
 * engine (useStack), the two body layers, and the drill-vs-interrupt rule.
 */

interface SheetStackProps {
  isOpen: boolean
  onClose: () => void
  /** The root screen, restored each time the sheet (re)opens. */
  initial: { key: string; params?: unknown }
  screens: Record<string, StackScreen>
  /** Populated with the live nav each render — for handler/async-driven navigation. */
  navRef?: React.MutableRefObject<StackNav | null>

  /** Keep every frame mounted (LayeredStackBody) so a stateful root survives a drill.
   *  Default true — the common sheet case. False = unmount-morph (StackBody). */
  preserveFrames?: boolean

  // ── Root-level chrome (shown only when NOT drilled) ──
  rootTitle?: string
  rootLeftContent?: ReactNode
  rootRightContent?: ReactNode

  // ── Forwarded Sheet props ──
  height?: 'fit' | 'snap'
  maxHeight?: number
  backdrop?: 'dismiss' | 'block' | 'none'
  zIndex?: number
  draggable?: boolean
  /** OPT-IN loading morph (forwarded to the Sheet). */
  loading?: boolean
  hudSize?: number
}

export function SheetStack({
  isOpen,
  onClose,
  initial,
  screens,
  navRef,
  preserveFrames = true,
  rootTitle,
  rootLeftContent,
  rootRightContent,
  height = 'fit',
  maxHeight,
  backdrop,
  zIndex,
  draggable = true,
  loading,
  hudSize,
}: SheetStackProps) {
  const stack = useStack({ isOpen, initial, screens, navRef })
  const drilled = stack.canBack

  const back = (
    <button
      type="button"
      onClick={stack.onBack}
      aria-label="Back"
      className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
    >
      <ChevronLeft size={20} />
    </button>
  )

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      height={height}
      maxHeight={maxHeight}
      backdrop={backdrop}
      zIndex={zIndex}
      // A drag mid-drill shouldn't dismiss the sheet (and pop-in translate would clip);
      // let the Back chevron own reversal while drilled.
      draggable={draggable && !drilled}
      loading={loading}
      hudSize={hudSize}
      title={drilled ? stack.title : rootTitle}
      leftContent={drilled ? back : rootLeftContent}
      rightContent={drilled ? (stack.rightFooter ?? undefined) : rootRightContent}
      actions={drilled ? stack.headerActions : undefined}
    >
      <StackNavContext.Provider value={stack.nav}>
        {preserveFrames ? (
          <LayeredStackBody frames={stack.frames} searchPlaceholder={stack.searchPlaceholder} />
        ) : (
          stack.body('')
        )}
      </StackNavContext.Provider>
    </Sheet>
  )
}
