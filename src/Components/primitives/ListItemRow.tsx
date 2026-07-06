/**
 * Shared list item row layout component.
 *
 * Provides the common flex row structure used by contact lists, group lists,
 * and similar list items: left icon/avatar + center title/subtitle + right badge.
 *
 * Extracted from ContactListItem.tsx, GroupListItem.tsx (and structurally
 * similar to AidBagItemRow.tsx and PropertyItemRow.tsx).
 */
import type { ReactNode } from 'react'

interface ListItemRowProps {
  /** Left slot — typically an avatar, icon, or checkbox. */
  left?: ReactNode
  /** Center slot — typically stacked title + subtitle text. Required. */
  center: ReactNode
  /** Right slot — typically badges, counts, or a chevron. */
  right?: ReactNode
  /** Click handler for the row. */
  onClick?: () => void
  /** Additional className appended to the row container. */
  className?: string
  /** HTML element to render as. Defaults to 'button'. */
  as?: 'button' | 'div'
}

/**
 * Renders a standard flex row with consistent spacing:
 *   [left] [center (flex-1)] [right]
 *
 * Clicking the row calls onClick. By default renders as a <button>.
 */
export function ListItemRow({
  left,
  center,
  right,
  onClick,
  className = '',
  as: Element = 'button',
}: ListItemRowProps) {
  return (
    <Element
      onClick={onClick}
      className={`flex items-center w-full gap-3 text-left ${className}`}
    >
      {left}
      <div className="flex-1 min-w-0">{center}</div>
      {right}
    </Element>
  )
}

/**
 * Standard unread message count badge.
 * Displays a circular badge with the count, capped at "9+".
 */
export function UnreadBadge({ count }: { count: number }) {
  if (!count || count <= 0) return null
  return (
    <div className="w-5 h-5 rounded-full bg-themeblue2 flex items-center justify-center shrink-0">
      <span className="text-[9pt] font-bold text-white">{count > 9 ? '9+' : count}</span>
    </div>
  )
}
