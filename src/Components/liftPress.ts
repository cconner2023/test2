import type { MouseEvent, TouchEvent, MutableRefObject } from 'react'

/** A snapshot of the pressed row: its viewport rect plus a markup clone. Feeds
 *  the LiftedRowMenu twin-lift (the iOS "lift the row, drop the menu beneath it"
 *  peek shared by messaging rows, map-overlay rows, and the KB category grid). */
export interface LiftSnapshot {
  rect: DOMRect
  html: string
}

export interface LiftPressState {
  timer: ReturnType<typeof setTimeout>
  fired: boolean
}

/** Strip inter-row separators so a cloned single row reads clean on its white
 *  card (e.g. `border-t border-tertiary/8`, `border-b border-primary/6`). */
function snapshot(el: HTMLElement): LiftSnapshot {
  return {
    rect: el.getBoundingClientRect(),
    html: el.outerHTML.replace(/border-[tb] border-[a-z]+\/\d+/g, ''),
  }
}

/**
 * Right-click + long-press handlers that snapshot the pressed element (rect +
 * outerHTML) and fire `onLift(snapshot)` — the anchor + clone for a
 * LiftedRowMenu. Loop-safe (a plain factory, not a hook): pass a shared ref
 * bucket owned by the parent surface. Only one press is active at a time, so one
 * ref per surface is enough. Check `ref.current?.fired` in your onClick to
 * swallow the tap React fires after a long-press releases.
 */
export function liftPressHandlers(
  onLift: ((snap: LiftSnapshot) => void) | undefined,
  ref: MutableRefObject<LiftPressState | null>,
  delay = 500,
) {
  if (!onLift) return {}
  return {
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onLift(snapshot(e.currentTarget as HTMLElement))
    },
    onTouchStart: (e: TouchEvent) => {
      const el = e.currentTarget as HTMLElement
      const state: LiftPressState = {
        fired: false,
        timer: setTimeout(() => {
          state.fired = true
          onLift(snapshot(el))
        }, delay),
      }
      ref.current = state
    },
    onTouchMove: () => {
      if (ref.current) { clearTimeout(ref.current.timer); ref.current = null }
    },
    onTouchEnd: () => {
      if (!ref.current) return
      clearTimeout(ref.current.timer)
      // Keep `fired` readable for the click that immediately follows, then clear.
      if (ref.current.fired) setTimeout(() => { ref.current = null }, 50)
      else ref.current = null
    },
    onTouchCancel: () => {
      if (ref.current) { clearTimeout(ref.current.timer); ref.current = null }
    },
  }
}
