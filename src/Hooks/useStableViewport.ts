import { useState, useEffect } from 'react'

/**
 * Returns a stable viewport height that doesn't shrink when the iOS keyboard opens.
 * Updates only when the viewport grows (orientation change, toolbar collapse) —
 * never when it shrinks (keyboard appearance).
 */
export function useStableViewport(): number {
  const [height, setHeight] = useState(() => window.innerHeight)

  useEffect(() => {
    let stable = window.innerHeight

    const onResize = () => {
      const h = window.innerHeight
      if (h > stable) {
        stable = h
        setHeight(h)
      }
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', () => setTimeout(onResize, 150))

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  return height
}
