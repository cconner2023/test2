import { useRef } from 'react'

/** The last value seen while `isOpen`, replayed while the surface animates out,
 *  so a host can null its state on close and the surface still leaves with its
 *  content. The render-time ref is deliberate: the exit frame needs the PREVIOUS
 *  render's value, which state can't hold without a render loop (children are
 *  new each render). Centralised here so hosts stop hand-rolling `lastXRef`. */
export function useHeldWhileOpen<T>(isOpen: boolean, live: T): T {
    const held = useRef(live)
    // eslint-disable-next-line react-hooks/refs
    if (isOpen) held.current = live
    // eslint-disable-next-line react-hooks/refs
    return isOpen ? live : held.current
}
