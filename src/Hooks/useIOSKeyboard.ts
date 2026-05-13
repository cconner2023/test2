import { useState, useEffect, useRef } from 'react'

const isIOS =
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as any).MSStream

export { isIOS }

export function useIOSKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  // iOS Safari scrolls the visualViewport up (offsetTop > 0) when an input is
  // focused with the keyboard open. position:fixed elements stay pinned to the
  // LAYOUT viewport, so without compensating for offsetTop a fixed drawer
  // anchored to the bottom appears to fly below the visible area. Consumers
  // should subtract viewportOffsetTop from any `bottom` offset.
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!isIOS || !window.visualViewport) return

    const vv = window.visualViewport

    const onChange = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const diff = window.innerHeight - vv.height
        // Only treat as keyboard open when > 100px (filters toolbar changes)
        setKeyboardHeight(diff > 100 ? diff : 0)
        setViewportOffsetTop(vv.offsetTop)
      })
    }

    vv.addEventListener('resize', onChange)
    vv.addEventListener('scroll', onChange)

    return () => {
      vv.removeEventListener('resize', onChange)
      vv.removeEventListener('scroll', onChange)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return { keyboardHeight, viewportOffsetTop, isKeyboardOpen: keyboardHeight > 0 }
}
