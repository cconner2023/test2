import { createContext, useContext, useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react'
import { PaneCard, type PaneCardProps } from '@/Components/primitives/PaneCard'

/**
 * One desktop PaneCard shared by every card a split panel can open, so selecting
 * a second card swaps the content of the open one instead of stacking a second
 * card or replaying the exit/enter motion.
 *
 * The host owns the card and its own content (`fallback`). A descendant deep in
 * the tree (conversation info inside ChatDetailView) publishes a view through
 * PaneHostContext and the host shows it in place of the fallback. Last opened
 * wins: the host closes its own content when a view arrives (onActiveChange),
 * and calls the view's onClose before opening its own.
 *
 * The view goes through an external store, not host state, for the same reason
 * as sheetMorph: the publisher republishes every render (its content closes over
 * live state), and host state would re-render the publisher, which publishes
 * again. Only HostedPaneCard subscribes, and it is not an ancestor of a publisher.
 */

export interface PaneHostView {
  title: string
  /** Present only when there is somewhere to go back to (drilled). */
  onBack?: () => void
  leading?: ReactNode
  /** Folded into the close pill. */
  actions?: ReactNode
  footer?: ReactNode
  body: ReactNode
  onClose: () => void
}

export interface PaneHostStore {
  get: () => PaneHostView | null
  set: (view: PaneHostView | null) => void
  subscribe: (fn: () => void) => () => void
}

export function createPaneHostStore(): PaneHostStore {
  let view: PaneHostView | null = null
  const subs = new Set<() => void>()
  return {
    get: () => view,
    set: (next) => { view = next; subs.forEach((fn) => fn()) },
    subscribe: (fn) => { subs.add(fn); return () => { subs.delete(fn) } },
  }
}

export interface PaneHost {
  store: PaneHostStore
  /** True when a publisher mounts, false when it unmounts. */
  onActiveChange: (active: boolean) => void
}

export const PaneHostContext = createContext<PaneHost | null>(null)
export const usePaneHost = () => useContext(PaneHostContext)

/** Publish `view` into the host while mounted. Mount it only while the view is
 *  open; unmounting is what clears the card. */
export function usePublishToPaneHost(host: PaneHost, view: PaneHostView) {
  const { store, onActiveChange } = host
  useLayoutEffect(() => {
    onActiveChange(true)
    return () => { onActiveChange(false); store.set(null) }
  }, [store, onActiveChange])
  // Every render on purpose: the view closes over the publisher's live state.
  useLayoutEffect(() => { store.set(view) })
}

type FallbackCard = Pick<PaneCardProps, 'title' | 'onClose' | 'actions' | 'children'> & { isOpen: boolean }

/** The single card. A published view wins over the host's own `fallback`. Esc is
 *  the publisher's while it holds the card (it may drill back first). */
export function HostedPaneCard({ store, fallback, zIndex, hidden }: { store: PaneHostStore; fallback: FallbackCard; zIndex?: number; hidden?: boolean }) {
  const view = useSyncExternalStore(store.subscribe, store.get)
  if (view) {
    return (
      <PaneCard
        isOpen
        onClose={view.onClose}
        closeOnEsc={false}
        title={view.title}
        onBack={view.onBack}
        leading={view.leading}
        actions={view.actions}
        footer={view.footer}
        zIndex={zIndex}
        hidden={hidden}
      >
        {view.body}
      </PaneCard>
    )
  }
  return (
    <PaneCard
      isOpen={fallback.isOpen}
      onClose={fallback.onClose}
      title={fallback.title}
      actions={fallback.actions}
      zIndex={zIndex}
      hidden={hidden}
    >
      {fallback.children}
    </PaneCard>
  )
}
