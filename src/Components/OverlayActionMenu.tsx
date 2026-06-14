import { Fragment, forwardRef, useCallback, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { ActionButton } from './ActionButton'
import { ActionPill } from './ActionPill'
import { AnchoredMenu } from './LiftedRowMenu'
import { contextMenuItemVariant, type ContextMenuItem } from './ContextMenu'

interface OverlayActionMenuProps {
  /** Currently-active corner actions. Pass only the items that should render
   *  (filter conditional ones before handing them in). */
  items: ContextMenuItem[]
  shadow?: 'sm' | 'lg'
  className?: string
  /** data-tour anchor placed on the ellipsis trigger (only when collapsed to 3+).
   *  Lets a guided tour `click:` the trigger to reveal the in-menu items. */
  triggerTourTag?: string
}

/**
 * Card corner-action overlay that self-consolidates by count:
 *   - 0 items  → renders nothing
 *   - 1–2 items → inline ActionButton tiles in an overlay ActionPill (the
 *                 long-standing top-edge corner-action pattern)
 *   - 3+ items  → a single MoreHorizontal (ellipsis) button that opens a
 *                 ContextMenu pill with the items
 *
 * The "more than 2 → ellipsis" rule lives here so every card passes the same
 * `items` array and the threshold is enforced in one place. forwardRef exposes
 * the pill node so callers can anchor popovers to the corner (e.g. system-message
 * compose, add-option popover).
 */
export const OverlayActionMenu = forwardRef<HTMLDivElement, OverlayActionMenuProps>(
  function OverlayActionMenu({ items, shadow = 'sm', className = '', triggerTourTag }, ref) {
    const pillRef = useRef<HTMLDivElement | null>(null)
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

    // Keep both the internal ref and any forwarded ref pointing at the live
    // pill node across branch swaps (count can change at runtime).
    const setRefs = useCallback((node: HTMLDivElement | null) => {
      pillRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    }, [ref])

    const openMenu = useCallback(() => {
      setAnchorRect(pillRef.current?.getBoundingClientRect() ?? null)
    }, [])

    if (items.length === 0) return null

    if (items.length <= 2) {
      return (
        <ActionPill ref={setRefs} placement="overlay" shadow={shadow} className={className}>
          {items.map((item) =>
            item.render ? (
              <Fragment key={item.key}>{item.render()}</Fragment>
            ) : (
              <ActionButton
                key={item.key}
                icon={item.icon!}
                label={item.label}
                variant={contextMenuItemVariant(item)}
                onClick={() => item.onAction?.()}
              />
            ),
          )}
        </ActionPill>
      )
    }

    return (
      <>
        <ActionPill ref={setRefs} placement="overlay" shadow={shadow} className={className}>
          <ActionButton icon={MoreHorizontal} label="More actions" onClick={openMenu} dataTour={triggerTourTag} />
        </ActionPill>
        <AnchoredMenu
          isOpen={!!anchorRect}
          anchorRect={anchorRect}
          onClose={() => setAnchorRect(null)}
          layout="list"
          align="right"
          items={items}
        />
      </>
    )
  }
)
