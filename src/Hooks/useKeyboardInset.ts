import { useEffect, useState } from 'react'

/** Returns the height (px) the soft keyboard currently occludes at the bottom
 *  of the layout viewport, 0 when closed.
 *
 *  iOS Safari does not shrink the layout viewport for the keyboard (and ignores
 *  the `interactive-widget` meta directive), so a `position:fixed; bottom:0`
 *  element stays pinned underneath the keyboard. The visual viewport DOES
 *  shrink — the gap between it and the layout viewport is the keyboard. Apply
 *  the returned inset to a fixed drawer's `bottom` to lift it clear.
 *
 *  Pair with a window-scroll lock (see useFocusKeepInView) so `offsetTop`
 *  stays ~0 and the inset reflects keyboard height alone, not page scroll. */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    let rafId = 0
    const update = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const gap = window.innerHeight - vv.height - vv.offsetTop
        setInset(gap > 1 ? Math.round(gap) : 0)
      })
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return inset
}
