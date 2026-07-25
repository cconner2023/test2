import { Children, type ReactNode } from 'react'

/**
 * Fills one slot of an overlay's action footer: `footer` (left) or `rightFooter`
 * (right).
 *
 * Left takes destructive and secondary actions, danger first, capped at two —
 * past that, overflow to the header ellipsis via `buildOverlayActionRail`. Right
 * takes the single non-destructive primary, or the dismiss X.
 *
 * Uses `bg-themewhite3` where the visually similar `ActionPill` uses
 * `bg-themewhite`. The two are not interchangeable: a footer pill hangs on the
 * scrim as a peer of the card, so it takes the raised-surface token and matches
 * it; `ActionPill` sits on a surface and reads as a well. Light themes alias the
 * two tokens, so swapping them only shows up in dark.
 */

interface FooterPillProps {
  side?: 'left' | 'right'
  className?: string
  children: ReactNode
}

export function FooterPill({ side = 'left', className = '', children }: FooterPillProps) {
  if (import.meta.env.DEV && side === 'right') {
    const count = Children.toArray(children).filter(Boolean).length
    if (count > 1) {
      console.warn(
        `[FooterPill] right slot holds one primary action, got ${count}. ` +
        'Move the rest to the left slot or the header ellipsis.',
      )
    }
  }
  return (
    <div
      className={`flex items-center ${side === 'left' ? 'gap-1' : ''} rounded-2xl px-1.5 py-1.5 bg-themewhite3 ${className}`}
    >
      {children}
    </div>
  )
}
