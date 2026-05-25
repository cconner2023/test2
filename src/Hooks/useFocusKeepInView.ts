import { useEffect, type RefObject } from 'react'

/** Keeps the focused input visible above the iOS soft keyboard.
 *
 * iOS auto-scrolls the document viewport to a focused input, but it will NOT
 * scroll a custom overflow-y container inside a position:fixed parent (drawers,
 * side panels). Mount this hook on the scroll container — it listens to
 * focusin from inputs/textareas/contentEditable descendants and scrolls them
 * into view, both immediately and again once the visualViewport resizes (which
 * is when the keyboard actually opens). */
export function useFocusKeepInView(
  scrollRef: RefObject<HTMLElement | null>,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return
    const container = scrollRef.current
    if (!container) return

    let pendingTarget: HTMLElement | null = null
    let rafId = 0

    // iOS scrolls the document to "reveal" a focused input inside a
    // position:fixed drawer — which actually drags the drawer off the top
    // of the viewport. Force the document back to 0 while focus is inside us.
    const lockWindowScroll = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0)
      }
    }

    const scrollPendingIntoView = () => {
      lockWindowScroll()
      const target = pendingTarget
      if (!target || !container || !document.contains(target)) return

      // Scroll the CONTAINER's own scrollTop — never call target.scrollIntoView.
      // scrollIntoView walks up and scrolls every scrollable ancestor including
      // the document; for an input inside a position:fixed drawer that does NOT
      // reveal the input (the drawer is fixed) but DOES drag the drawer off the
      // top of the viewport. Moving scrollTop here keeps the drawer chrome put.
      const vv = window.visualViewport
      const keyboardTop = vv ? vv.offsetTop + vv.height : window.innerHeight
      const containerRect = container.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const PAD = 24

      // Visible band available to the scroller: its own top down to whichever is
      // higher — its own bottom or the top of the soft keyboard.
      const visibleTop = containerRect.top
      const visibleBottom = Math.min(containerRect.bottom, keyboardTop)

      if (targetRect.bottom > visibleBottom - PAD) {
        container.scrollTop += targetRect.bottom - (visibleBottom - PAD)
      } else if (targetRect.top < visibleTop + PAD) {
        container.scrollTop -= (visibleTop + PAD) - targetRect.top
      }
    }

    const scheduleScroll = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(scrollPendingIntoView)
    }

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null
      if (!t || !isFocusableInput(t)) return
      pendingTarget = t
      scheduleScroll()
      window.addEventListener('scroll', lockWindowScroll, { passive: true })
    }

    const onFocusOut = () => {
      pendingTarget = null
      window.removeEventListener('scroll', lockWindowScroll)
    }

    container.addEventListener('focusin', onFocusIn)
    container.addEventListener('focusout', onFocusOut)
    window.visualViewport?.addEventListener('resize', scheduleScroll)
    window.visualViewport?.addEventListener('scroll', scheduleScroll)

    return () => {
      container.removeEventListener('focusin', onFocusIn)
      container.removeEventListener('focusout', onFocusOut)
      window.visualViewport?.removeEventListener('resize', scheduleScroll)
      window.visualViewport?.removeEventListener('scroll', scheduleScroll)
      window.removeEventListener('scroll', lockWindowScroll)
      cancelAnimationFrame(rafId)
    }
  }, [scrollRef, enabled])
}

function isFocusableInput(el: HTMLElement): boolean {
  const tag = el.tagName
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type
    // Skip buttons/checkbox/radio — they don't summon the keyboard.
    return type !== 'button' && type !== 'submit' && type !== 'checkbox' && type !== 'radio'
  }
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}
