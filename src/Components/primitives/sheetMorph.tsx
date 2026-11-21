import { useSyncExternalStore, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

/**
 * The mobile counterpart of OverlayStack's lifted-card morph: instead of floating a
 * PreviewOverlay above the host's bottom Sheet, the stack hands its chrome and body to
 * that Sheet, which swaps them in place.
 *
 * The view goes through an external store rather than host state on purpose. The stack
 * republishes every render (its screens close over live state); if the host held the
 * view in useState, each publish would re-render the host, which re-renders the stack,
 * which publishes again. Only the SheetMorphSlot parts subscribe, and they sit under the
 * Sheet, not above the stack, so the cycle can't form.
 */

export interface SheetMorphView {
  title?: string
  /** Back at any depth: pops a level, or closes the morph at the root (returning the
   *  sheet to whatever it showed before). */
  onBack: () => void
  /** Closes just the morph. The host's X calls this and then dismisses the sheet. */
  onClose: () => void
  headerActions?: ReactNode
  headerLeft?: ReactNode
  rightFooter?: ReactNode
  body: ReactNode
}

export interface SheetMorphStore {
  get: () => SheetMorphView | null
  set: (view: SheetMorphView | null) => void
  subscribe: (fn: () => void) => () => void
}

export function createSheetMorphStore(): SheetMorphStore {
  let view: SheetMorphView | null = null
  const subs = new Set<() => void>()
  return {
    get: () => view,
    set: (next) => { view = next; subs.forEach((fn) => fn()) },
    subscribe: (fn) => { subs.add(fn); return () => { subs.delete(fn) } },
  }
}

type Part = 'back' | 'title' | 'actions' | 'right' | 'body'

/** One piece of the published view, dropped into the matching Sheet prop. */
export function SheetMorphSlot({ store, part }: { store: SheetMorphStore; part: Part }) {
  const view = useSyncExternalStore(store.subscribe, store.get)
  if (!view) return null
  switch (part) {
    case 'back':
      return (
        <div className="flex items-center gap-2">
          <button onClick={view.onBack} aria-label="Back" className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all">
            <ChevronLeft size={20} />
          </button>
          {view.headerLeft}
        </div>
      )
    case 'title':
      return <span className="block truncate text-[13pt] font-semibold text-primary">{view.title}</span>
    case 'actions':
      return <>{view.headerActions}</>
    case 'right':
      return <>{view.rightFooter}</>
    case 'body':
      return <>{view.body}</>
  }
}
