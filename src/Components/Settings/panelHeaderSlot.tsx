import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { OverlayHeaderMenu } from '@/Components/primitives/OverlayHeaderMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'

/**
 * Header actions published UP from a panel to its container header (the mobile
 * Settings drawer header, or the desktop App Content subpage card). The panel owns
 * the state its Add / ⋯ menus close over; the container owns the header. Same
 * external-store shape as paneHost: the publisher republishes every render, and
 * only the outlet subscribes, so there is no state ping-pong.
 *
 * The ⋯ publishes as items, not a node, so the host renders it. Container-level
 * menus sit right; only a specific item's header ⋯ goes left.
 */
interface HeaderSlotView {
  node: ReactNode
  menu: ContextMenuItem[]
}

export interface HeaderSlotStore {
  get: () => HeaderSlotView
  set: (view: HeaderSlotView) => void
  subscribe: (fn: () => void) => () => void
}

const EMPTY: HeaderSlotView = { node: null, menu: [] }

export function createHeaderSlotStore(): HeaderSlotStore {
  let view = EMPTY
  const subs = new Set<() => void>()
  return {
    get: () => view,
    set: (next) => { view = next; subs.forEach((fn) => fn()) },
    subscribe: (fn) => { subs.add(fn); return () => { subs.delete(fn) } },
  }
}

export function useHeaderSlotStore(): HeaderSlotStore {
  const [store] = useState(createHeaderSlotStore)
  return store
}

export const HeaderSlotContext = createContext<HeaderSlotStore | null>(null)

/** Publish `node` and the ⋯ `menu` into the container header while mounted. No-op without a host. */
export function usePublishHeaderActions(node: ReactNode, menu: ContextMenuItem[] = []) {
  const store = useContext(HeaderSlotContext)
  useLayoutEffect(() => {
    if (!store) return
    return () => store.set(EMPTY)
  }, [store])
  // Every render on purpose: the node closes over the panel's live state.
  useLayoutEffect(() => { store?.set({ node, menu }) })
}

export function HeaderSlotOutlet({ store }: { store: HeaderSlotStore }) {
  const { node } = useSyncExternalStore(store.subscribe, store.get)
  return <>{node}</>
}

export function HeaderSlotMenu({ store, align }: { store: HeaderSlotStore; align: 'left' | 'right' }) {
  const { menu } = useSyncExternalStore(store.subscribe, store.get)
  return <OverlayHeaderMenu items={menu} align={align} />
}
