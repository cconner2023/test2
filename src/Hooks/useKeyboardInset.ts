import { useEffect, type RefObject } from 'react'

/** Writes the iOS soft-keyboard height as `--kb-inset` on the ref'd element.
 * Bottom-pinned UI inside the ref can use `calc(... + var(--kb-inset, 0px))`
 * to ride up with the keyboard.
 *
 * Also pins `window.scrollTo(0, 0)` while a descendant input/textarea is
 * focused, so iOS can't drag the fixed layout off the top of the screen. */
export function useKeyboardInset(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    const vv = window.visualViewport
    if (!root || !vv) return

    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop))
      root.style.setProperty('--kb-inset', `${inset}px`)
    }

    const lockScroll = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0)
    }

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null
      if (!t) return
      const tag = t.tagName
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !t.isContentEditable) return
      window.addEventListener('scroll', lockScroll, { passive: true })
    }
    const onFocusOut = () => {
      window.removeEventListener('scroll', lockScroll)
    }

    vv.addEventListener('resize', updateInset)
    vv.addEventListener('scroll', updateInset)
    root.addEventListener('focusin', onFocusIn)
    root.addEventListener('focusout', onFocusOut)
    updateInset()

    return () => {
      vv.removeEventListener('resize', updateInset)
      vv.removeEventListener('scroll', updateInset)
      root.removeEventListener('focusin', onFocusIn)
      root.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('scroll', lockScroll)
      root.style.removeProperty('--kb-inset')
    }
  }, [rootRef])
}
