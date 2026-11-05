import { create } from 'zustand'

export type DrawerSide = 'left' | 'right'

export interface PushingDrawer {
    id: string
    side: DrawerSide
    /** Panel width as a fraction of the app panel. */
    width: number
    /** Open order. A drawer closing with a higher seq on the stack was replaced. */
    seq: number
}

interface DrawerPushState {
    /** Open desktop drawers, oldest first. */
    stack: PushingDrawer[]
    nextSeq: number
    pushDrawer: (id: string, side: DrawerSide, width: number) => number
    removeDrawer: (id: string) => void
}

/** Signed distance a drawer pushes what's beneath it, in app-panel widths. */
export function drawerShift(drawer: PushingDrawer): number {
    return (drawer.side === 'left' ? 1 : -1) * drawer.width
}

/** Desktop drawers push whatever is beneath them toward the opposite edge. The
 *  app strip and every drawer move as one belt: each layer's offset is the sum
 *  of the shifts of all the drawers above it. */
export const useDrawerPushStore = create<DrawerPushState>((set, get) => ({
    stack: [],
    nextSeq: 1,
    pushDrawer: (id, side, width) => {
        const seq = get().nextSeq
        set((s) => ({
            stack: [...s.stack.filter((d) => d.id !== id), { id, side, width, seq }],
            nextSeq: seq + 1,
        }))
        return seq
    },
    removeDrawer: (id) => set((s) => ({ stack: s.stack.filter((d) => d.id !== id) })),
}))
