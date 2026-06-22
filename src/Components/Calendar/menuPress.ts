import type { MouseEvent, TouchEvent, MutableRefObject } from 'react'

export interface MenuPressState {
  timer: ReturnType<typeof setTimeout>
  fired: boolean
  moved: boolean
  startX: number
  startY: number
}

export interface MenuPressOptions {
  /** Tap-to-open handler. Fired on a genuine short tap (touch) or click (mouse).
   *  REQUIRED for any surface living under the home column carousel: that
   *  carousel binds an @use-gesture touch drag which swallows the synthesized
   *  `click` on child buttons, so the long-press menu works but a plain tap
   *  never fires onClick. Driving the tap from touchend dodges that entirely.
   *  Omit it where the element keeps its own onClick (e.g. the calendar-drawer
   *  views, which are NOT under the carousel and tap fine via native click). */
  onTap?: () => void
  /** Long-press threshold in ms. */
  delay?: number
}

/** Movement (px) past which a press is treated as a scroll/drag, not a tap —
 *  cancels both the long-press timer and the tap-to-open. */
const TAP_SLOP = 10

/**
 * Right-click + long-press handlers that resolve the pressed element's DOMRect
 * and fire `onMenu(rect)` — the anchor for the LiftedRowMenu clone/raise peek
 * (the same iOS "lift the row, drop the menu beneath it" gesture used by the
 * messaging conversation rows and map-overlay rows).
 *
 * Loop-safe (a plain factory, not a hook): pass a shared ref bucket owned by the
 * parent. Only one press is active at a time, so a single ref per surface is
 * enough. Both touch paths stopPropagation so a press on a child (e.g. an event
 * pill) does not also trigger its container's menu (the day cell).
 *
 * TAP HANDLING: pass `options.onTap` and the factory wires both the touch tap
 * (via touchend) and the desktop click for you — do NOT add your own onClick.
 * The touchend path exists because a parent @use-gesture touch drag (the home
 * carousel) eats the synthesized click; the onClick path covers desktop mouse.
 * The ref guard dedupes so only one of the two fires per interaction.
 */
export function menuPressHandlers(
  onMenu: ((rect: DOMRect) => void) | undefined,
  ref: MutableRefObject<MenuPressState | null>,
  options: MenuPressOptions = {},
) {
  const { onTap, delay = 500 } = options
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
      const t = e.touches[0]
      const state: MenuPressState = {
        fired: false,
        moved: false,
        startX: t?.clientX ?? 0,
        startY: t?.clientY ?? 0,
        timer: setTimeout(() => {
          state.fired = true
          onMenu(el.getBoundingClientRect())
        }, delay),
      }
      ref.current = state
    },
    onTouchMove: (e: TouchEvent) => {
      const s = ref.current
      if (!s) return
      const t = e.touches[0]
      if (!t) return
      if (Math.abs(t.clientX - s.startX) > TAP_SLOP || Math.abs(t.clientY - s.startY) > TAP_SLOP) {
        clearTimeout(s.timer)
        s.moved = true
      }
    },
    onTouchEnd: () => {
      const s = ref.current
      if (!s) return
      clearTimeout(s.timer)
      // Genuine short tap: not a long-press, finger didn't travel. Open here —
      // the synthesized click is unreliable under the carousel's touch drag.
      if (!s.fired && !s.moved) onTap?.()
      // Keep state readable for ~50ms so the click React may still fire after
      // release is swallowed (avoids a double-open or menu-then-open).
      setTimeout(() => { ref.current = null }, 50)
    },
    // Desktop mouse: no touch sequence ran → ref is null → open. After any touch
    // (tap or long-press) ref is non-null for ~50ms → swallow the trailing click.
    ...(onTap ? { onClick: () => { if (ref.current) return; onTap() } } : {}),
  }
}
