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
import { MoreHorizontal } from 'lucide-react'

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
      data-list-row
      className={`flex items-center w-full gap-3 text-left ${className}`}
    >
      {left}
      <div className="flex-1 min-w-0">{center}</div>
      {right}
    </Element>
  )
}

/**
 * Row-menu ellipsis for the `right` slot — opens the row's context menu (same
 * as long-press / right-click) with the row's rect. Swallows touch/click so the
 * host row's tap and long-press never fire from it. Host must render `as="div"`
 * (no button-in-button).
 */
export function RowMoreButton({ onMore }: { onMore: (rect: DOMRect) => void }) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label="More actions"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        const host = (e.currentTarget.closest('[data-list-row]') ?? e.currentTarget) as HTMLElement
        onMore(host.getBoundingClientRect())
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        e.stopPropagation()
        const host = (e.currentTarget.closest('[data-list-row]') ?? e.currentTarget) as HTMLElement
        onMore(host.getBoundingClientRect())
      }}
      className="w-8 h-8 -mr-2 shrink-0 rounded-full flex items-center justify-center text-tertiary active:bg-primary/10 cursor-pointer"
    >
      <MoreHorizontal size={18} />
    </span>
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
