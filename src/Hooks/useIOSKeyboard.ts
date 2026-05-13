import { useState, useEffect, useRef } from 'react'

const isIOS =
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as any).MSStream

/** Tracks the iOS soft keyboard via `visualViewport`.
 *
 * Returns zeros unless ALL of these hold:
 *   1. running on iOS Safari,
 *   2. visualViewport height is shrunk by > 100px vs. the layout viewport,
 *   3. an input/textarea/contentEditable is currently focused.
 *
 * Condition 3 guards against stale state — iOS occasionally leaves
 * `visualViewport.height` shorter than `innerHeight` after rotation, URL-bar
 * collapse, or PWA quirks. A keyboard can only be open while something is
 * focused, so gating on focus makes a stuck "keyboard is open" snap back to
 * zero the moment focus leaves rather than leaving consumers with a phantom
 * gap.
 *
 * `viewportOffsetTop` mirrors `vv.offsetTop` — iOS pins `position:fixed` to
 * the layout viewport, so consumers anchored to the visual bottom must
 * subtract this from their `bottom` offset (see BaseDrawer). */
export function useIOSKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!isIOS || !window.visualViewport) return

    const vv = window.visualViewport

    const hasFocusedInput = (): boolean => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      if (tag === 'INPUT') {
        const type = (el as HTMLInputElement).type
        return type !== 'button' && type !== 'submit' && type !== 'checkbox' && type !== 'radio'
      }
      if (tag === 'TEXTAREA' || tag === 'SELECT') return true
      return el.isContentEditable
    }

    const recompute = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        if (!hasFocusedInput()) {
          setKeyboardHeight(0)
          setViewportOffsetTop(0)
          return
        }
        const diff = window.innerHeight - vv.height
        // Only treat as keyboard open when > 100px (filters toolbar changes)
        setKeyboardHeight(diff > 100 ? diff : 0)
        setViewportOffsetTop(vv.offsetTop)
      })
    }

    vv.addEventListener('resize', recompute)
    vv.addEventListener('scroll', recompute)
    // Focus changes can happen without a vv event (tap an input while keyboard
    // is already up) — recompute so stuck state resets the moment focus leaves.
    document.addEventListener('focusin', recompute)
    document.addEventListener('focusout', recompute)

    return () => {
      vv.removeEventListener('resize', recompute)
      vv.removeEventListener('scroll', recompute)
      document.removeEventListener('focusin', recompute)
      document.removeEventListener('focusout', recompute)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return { keyboardHeight, viewportOffsetTop, isKeyboardOpen: keyboardHeight > 0 }
}
