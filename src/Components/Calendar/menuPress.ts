import type { MouseEvent, TouchEvent, MutableRefObject } from 'react'

export interface MenuPressState {
  timer: ReturnType<typeof setTimeout>
  fired: boolean
}

/**
 * Right-click + long-press handlers that resolve the pressed element's DOMRect
 * and fire `onMenu(rect)` — the anchor for the LiftedRowMenu clone/raise peek
 * (the same iOS "lift the row, drop the menu beneath it" gesture used by the
 * messaging conversation rows and map-overlay rows).
 *
 * Loop-safe (a plain factory, not a hook): pass a shared ref bucket owned by the
 * parent. Only one press is active at a time, so a single ref per surface is
 * enough. Check `ref.current?.fired` in your onClick to swallow the tap React
 * fires after a long-press releases. Both paths stopPropagation so a press on a
 * child (e.g. an event pill) does not also trigger its container's menu (the day
 * cell).
 */
export function menuPressHandlers(
  onMenu: ((rect: DOMRect) => void) | undefined,
  ref: MutableRefObject<MenuPressState | null>,
  delay = 500,
) {
  if (!onMenu) return {}
  return {
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onMenu(e.currentTarget.getBoundingClientRect())
    },
    onTouchStart: (e: TouchEvent) => {
      e.stopPropagation()
      const el = e.currentTarget as HTMLElement
      const state: MenuPressState = {
        fired: false,
        timer: setTimeout(() => {
          state.fired = true
          onMenu(el.getBoundingClientRect())
        }, delay),
      }
      ref.current = state
    },
    onTouchMove: () => {
      if (ref.current) {
        clearTimeout(ref.current.timer)
        ref.current = null
      }
    },
    onTouchEnd: () => {
      if (!ref.current) return
      clearTimeout(ref.current.timer)
      // Keep `fired` readable for the click that immediately follows, then clear.
      if (ref.current.fired) setTimeout(() => { ref.current = null }, 50)
      else ref.current = null
    },
  }
}
