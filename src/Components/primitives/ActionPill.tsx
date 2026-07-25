import { forwardRef, type HTMLAttributes } from 'react'

interface ActionPillProps extends HTMLAttributes<HTMLDivElement> {
  shadow?: 'sm' | 'lg'
  /** 'overlay' self-positions on the top edge of its relative parent, and shrinks
   *  the pill, buttons and icons to suit a card corner. */
  placement?: 'inline' | 'overlay'
}

/**
 * Action cluster that sits ON a surface — a card corner, an in-drawer strip.
 * `bg-themewhite` plus a hairline reads as a well cut into the surface.
 *
 * Not for an action footer; those hang on the scrim and take the raised-surface
 * token instead. Use `FooterPill` for the `footer` / `rightFooter` slots.
 *
 * placement="overlay" needs a parent without overflow-hidden at the level that
 * would clip the negative translate. If the bordered card has it, lift the pill
 * out as a sibling under a `relative` wrapper.
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
