import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react'

/**
 * Header actions published UP from a panel to its container header (the mobile
 * Settings drawer header, or the desktop App Content subpage card). The panel owns
 * the state its Add / ⋯ menus close over; the container owns the header. Same
 * external-store shape as paneHost: the publisher republishes every render, and
 * only the outlet subscribes, so there is no state ping-pong.
 */
export interface HeaderSlotStore {
  get: () => ReactNode
  set: (node: ReactNode) => void
  subscribe: (fn: () => void) => () => void
}

export function createHeaderSlotStore(): HeaderSlotStore {
  let node: ReactNode = null
  const subs = new Set<() => void>()
  return {
    get: () => node,
    set: (next) => { node = next; subs.forEach((fn) => fn()) },
    subscribe: (fn) => { subs.add(fn); return () => { subs.delete(fn) } },
  }
}

export function useHeaderSlotStore(): HeaderSlotStore {
  const [store] = useState(createHeaderSlotStore)
  return store
}

export const HeaderSlotContext = createContext<HeaderSlotStore | null>(null)

/** Publish `node` into the container header while mounted. No-op without a host. */
export function usePublishHeaderActions(node: ReactNode) {
  const store = useContext(HeaderSlotContext)
  useLayoutEffect(() => {
    if (!store) return
    return () => store.set(null)
  }, [store])
  // Every render on purpose: the node closes over the panel's live state.
  useLayoutEffect(() => { store?.set(node) })
}

export function HeaderSlotOutlet({ store }: { store: HeaderSlotStore }) {
  const node = useSyncExternalStore(store.subscribe, store.get)
  return <>{node}</>
}
