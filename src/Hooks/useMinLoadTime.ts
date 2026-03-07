import { useState, useEffect, useRef } from 'react'

/** Keeps a loading boolean `true` for at least `minMs` after it first flips on. */
export function useMinLoadTime(loading: boolean, minMs = 500): boolean {
  const [held, setHeld] = useState(loading)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (loading) {
      startRef.current = Date.now()
      setHeld(true)
    } else if (startRef.current !== null) {
      const elapsed = Date.now() - startRef.current
      const remaining = minMs - elapsed
      if (remaining > 0) {
        const id = setTimeout(() => setHeld(false), remaining)
        return () => clearTimeout(id)
      }
      setHeld(false)
      startRef.current = null
    }
  }, [loading, minMs])

  return held
}
