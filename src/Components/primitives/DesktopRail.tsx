import type { ReactNode } from 'react'

/** The one desktop left-rail width. Every split view uses it. */
export const DESKTOP_RAIL_W = 280

/**
 * THE desktop left rail container (Calendar, Map, Property, Tracking Board,
 * Messaging, User Guide). One width, one hairline, one surface. Callers compose
 * the contents: RailSearchRow on top, then their own list/scroller.
 *
 * `mdOnly` hides the rail below md for callers that render it unconditionally
 * and rely on CSS breakpoints (Messaging) rather than an isMobile branch.
 */
export function DesktopRail({
    children,
    mdOnly = false,
    className = '',
}: {
    children: ReactNode
    mdOnly?: boolean
    className?: string
}) {
    return (
        <aside
            style={{ width: DESKTOP_RAIL_W }}
            className={`${mdOnly ? 'hidden md:flex' : 'flex'} flex-col shrink-0 min-h-0 border-r border-primary/10 bg-themewhite ${className}`}
        >
            {children}
        </aside>
    )
}
