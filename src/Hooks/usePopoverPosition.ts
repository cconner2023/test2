import { useState, useEffect, useCallback } from 'react'
import type { RefObject } from 'react'

interface PopoverPositionOptions {
  preferredSide?: 'bottom' | 'top'
  align?: 'center' | 'start' | 'end'
  viewportPadding?: number
}

export interface PopoverPosition {
  top: number
  left: number
  placement: 'bottom' | 'top'
}

export function usePopoverPosition(
  anchorRef: RefObject<HTMLElement | null>,
  popoverRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  options: PopoverPositionOptions = {}
): PopoverPosition {
  const { preferredSide = 'bottom', align = 'center', viewportPadding = 8 } = options

  const [pos, setPos] = useState<PopoverPosition>({ top: 0, left: 0, placement: preferredSide })

  const compute = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    const aRect = anchor.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.visualViewport?.height ?? window.innerHeight
    const gap = 8
    const popW = popoverRef.current?.offsetWidth ?? 320
    const popH = popoverRef.current?.offsetHeight ?? 300

    let left: number
    if (align === 'center') {
      left = aRect.left + aRect.width / 2 - popW / 2
    } else if (align === 'start') {
      left = aRect.left
    } else {
      left = aRect.right - popW
    }
    left = Math.max(viewportPadding, Math.min(left, vw - popW - viewportPadding))

    let placement: 'bottom' | 'top' = preferredSide
    const spaceBelow = vh - aRect.bottom - gap
    const spaceAbove = aRect.top - gap
    if (preferredSide === 'bottom' && spaceBelow < popH && spaceAbove > spaceBelow) {
      placement = 'top'
    } else if (preferredSide === 'top' && spaceAbove < popH && spaceBelow > spaceAbove) {
      placement = 'bottom'
    }

    const top = placement === 'bottom' ? aRect.bottom + gap : aRect.top - popH - gap

    setPos({ top, left, placement })
  }, [anchorRef, popoverRef, preferredSide, align, viewportPadding])

  useEffect(() => {
    if (!isOpen) return
    compute()
    window.addEventListener('resize', compute, { passive: true })
    window.addEventListener('scroll', compute, { passive: true, capture: true })
    const vvp = window.visualViewport
    vvp?.addEventListener('resize', compute)
    vvp?.addEventListener('scroll', compute)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
      vvp?.removeEventListener('resize', compute)
      vvp?.removeEventListener('scroll', compute)
    }
  }, [isOpen, compute])

  return pos
}
