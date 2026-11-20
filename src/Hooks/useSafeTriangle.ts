import { useCallback, useEffect, useRef, type RefObject } from 'react'

type Pt = { x: number; y: number }

const inRect = (p: Pt, r: DOMRect) => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
const cross = (p: Pt, a: Pt, b: Pt) => (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y)
function inTriangle(p: Pt, a: Pt, b: Pt, c: Pt) {
  const d1 = cross(p, a, b), d2 = cross(p, b, c), d3 = cross(p, c, a)
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}

/**
 * Safe-triangle hover intent for an interactive hover card beside its trigger
 * (the collapsed rail's note card). After the pointer leaves the trigger, the
 * card stays open while the pointer travels inside the triangle from the exit
 * point to the card's near edge, or rests on the card or trigger. Leaving that
 * area, leaving the card, or stalling short of it closes the card.
 *
 * `track` goes on the trigger's mouseleave; `holds(point)` tells other triggers
 * the pointer is mid-aim so they don't steal the card; `cancel` on reopen/close.
 */
export function useSafeTriangle(cardRef: RefObject<HTMLElement | null>, onClose: () => void, stallMs = 300) {
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  const stopRef = useRef<(() => void) | null>(null)
  const holdsRef = useRef<((p: Pt) => boolean) | null>(null)

  const cancel = useCallback(() => {
    stopRef.current?.()
    stopRef.current = null
    holdsRef.current = null
  }, [])
  useEffect(() => cancel, [cancel])

  const track = useCallback((e: { clientX: number; clientY: number; currentTarget: Element }) => {
    cancel()
    const trigger = e.currentTarget.getBoundingClientRect()
    let apex: Pt = { x: e.clientX, y: e.clientY }
    let onCard = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const close = () => { cancel(); closeRef.current() }

    const holds = (p: Pt) => {
      const card = cardRef.current?.getBoundingClientRect()
      if (!card) return false
      if (inRect(p, card) || inRect(p, trigger)) return true
      if (onCard) return false
      // Near edge = whichever vertical edge faces the trigger.
      const x = card.left >= trigger.right ? card.left : card.right
      return inTriangle(p, apex, { x, y: card.top }, { x, y: card.bottom })
    }

    const move = (ev: PointerEvent) => {
      const p = { x: ev.clientX, y: ev.clientY }
      const card = cardRef.current?.getBoundingClientRect()
      if (!card) return close()
      if (inRect(p, card)) { onCard = true; clearTimeout(timer); return }
      if (inRect(p, trigger)) { onCard = false; apex = p; clearTimeout(timer); return }
      if (!holds(p)) return close()
      clearTimeout(timer)
      timer = setTimeout(close, stallMs)
    }

    timer = setTimeout(close, stallMs)
    document.addEventListener('pointermove', move, { passive: true })
    stopRef.current = () => { clearTimeout(timer); document.removeEventListener('pointermove', move) }
    holdsRef.current = holds
  }, [cancel, cardRef, stallMs])

  const holds = useCallback((p: Pt) => holdsRef.current?.(p) ?? false, [])
  const active = useCallback(() => !!stopRef.current, [])

  return { track, holds, cancel, active }
}
