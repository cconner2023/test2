import { forwardRef, type HTMLAttributes } from 'react'

interface ActionPillProps extends HTMLAttributes<HTMLDivElement> {
  /** shadow weight — 'lg' is the default footer/popover style; 'sm' is the embedded/absolute-positioned style */
  shadow?: 'sm' | 'lg'
}

/**
 * Canonical action-row container — wraps ActionButton children in a rounded pill.
 * Footer popover/modal action strip = forward actions only (no Cancel — header X handles it).
 */
export const ActionPill = forwardRef<HTMLDivElement, ActionPillProps>(
  function ActionPill({ shadow = 'lg', className = '', children, ...rest }, ref) {
    const shadowCx = shadow === 'sm' ? 'shadow-sm' : 'shadow-lg'
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
