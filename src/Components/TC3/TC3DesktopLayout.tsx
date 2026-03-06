import { memo } from 'react'
import { TC3FrontColumn } from './TC3FrontColumn'
import { TC3BackColumn } from './TC3BackColumn'

/**
 * Desktop TC3 layout — mirrors the physical DD1380 form.
 * Left column = front of card, right column = back of card.
 * Both columns scroll independently.
 */
export const TC3DesktopLayout = memo(function TC3DesktopLayout() {
  return (
    <div className="h-full grid grid-cols-2 gap-1">
      <TC3FrontColumn />
      <TC3BackColumn />
    </div>
  )
})
