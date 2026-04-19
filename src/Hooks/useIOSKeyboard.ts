import { useState, useEffect, useRef } from 'react'

const isIOS =
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as any).MSStream

export { isIOS }

export function useIOSKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!isIOS || !window.visualViewport) return

    const vv = window.visualViewport

    const onResize = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const diff = window.innerHeight - vv.height
        // Only treat as keyboard open when > 100px (filters toolbar changes)
        setKeyboardHeight(diff > 100 ? diff : 0)
      })
    }

    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)

    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return { keyboardHeight, isKeyboardOpen: keyboardHeight > 0 }
}
