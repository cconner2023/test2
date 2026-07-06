import { forwardRef, type HTMLAttributes } from 'react'

interface ActionPillProps extends HTMLAttributes<HTMLDivElement> {
  /** shadow weight — 'lg' is the default footer/popover style; 'sm' is the embedded/absolute-positioned style */
  shadow?: 'sm' | 'lg'
  /** 'inline' (default) = caller handles positioning; 'overlay' = self-positions absolutely on the top edge of its relative parent (smaller pill, smaller buttons, smaller icons) */
  placement?: 'inline' | 'overlay'
}

/**
 * Canonical action-row container — wraps ActionButton children in a rounded pill.
 * Footer popover/modal action strip = forward actions only (no Cancel — header X handles it).
 *
 * placement="overlay" — absolute-positioned pill riding the top border / divider of its
 * relative parent. Parent must NOT have overflow-hidden at the level that clips the
 * negative translate; if the bordered card has overflow-hidden, lift the pill out as a
 * sibling under a `relative` wrapper.
 */
export const ActionPill = forwardRef<HTMLDivElement, ActionPillProps>(
  function ActionPill({ shadow = 'lg', placement = 'inline', className = '', children, ...rest }, ref) {
    const shadowCx = shadow === 'sm' ? 'shadow-sm' : 'shadow-lg'
    if (placement === 'overlay') {
      return (
        <div
          ref={ref}
          className={`absolute top-0 right-1 -translate-y-1/2 z-10 flex items-center gap-1 p-1 rounded-2xl bg-themewhite ${shadowCx} border border-tertiary/15 [&>button]:w-8 [&>button]:h-8 [&>a]:w-8 [&>a]:h-8 [&_svg]:!w-3.5 [&_svg]:!h-3.5 ${className}`}
          {...rest}
        >
          {children}
        </div>
      )
    }
    return (
      <div
        ref={ref}
        className={`flex items-center gap-1 px-1.5 py-1.5 rounded-2xl bg-themewhite ${shadowCx} border border-tertiary/15 ${className}`}
        {...rest}
      >
        {children}
      </div>
    )
  }
)
