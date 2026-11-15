import type { ReactNode } from 'react'

/**
 * Layout primitives for a settings panel that uses desktop width instead of
 * sitting in a phone-width column.
 *
 * Breakpoints are CONTAINER queries on the page (`@container/page`), not viewport
 * ones. The same panel renders full-screen on mobile, beside the 280px rail in a
 * 90% drawer on desktop, and under a PaneCard; viewport `lg` says nothing about
 * how wide any of those actually is.
 *
 * A panel opts in by rendering SettingsPage and adding its id to WIDE_PANELS in
 * Settings.tsx (which lifts the max-w-3xl cap the unconverted panels still need).
 */

/** Scroll root + page padding. Children stack with one gap on narrow widths.
 *  `split` (default true) makes it two columns when wide; pass false when the
 *  main column would be empty (a role sees only the aside's sections), or the
 *  grid keeps an empty 3fr track. */
export function SettingsPage({ children, className = '', split = true }: { children: ReactNode; className?: string; split?: boolean }) {
    return (
        <div className={`overflow-y-auto @container/page ${className}`}>
            <div className={`flex flex-col gap-6 px-5 pb-4 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)] @4xl/page:px-8 @4xl/page:pb-8 ${
                split ? '@4xl/page:grid @4xl/page:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @4xl/page:items-start @4xl/page:gap-8' : ''
            }`}>
                {children}
            </div>
        </div>
    )
}

/**
 * One column of a two-column SettingsPage (aside first, main second). Below the
 * breakpoint the column dissolves (`display: contents`) so its sections join the
 * page's single stack; give each section an `order-*` class to set the phone
 * sequence, which can differ from the column grouping. Orders must ascend within
 * a column, since a column stacks in DOM order.
 */
export function SettingsColumn({ children }: { children: ReactNode }) {
    return <div className="contents @4xl/page:flex @4xl/page:flex-col @4xl/page:gap-6 @4xl/page:min-w-0">{children}</div>
}

/** Full-width row spanning both columns (errors, banners). */
export function SettingsSpan({ children }: { children: ReactNode }) {
    return <div className="@4xl/page:col-span-2">{children}</div>
}

/**
 * Cards or rows that wrap horizontally as their own box widens: one column,
 * two from 32rem, three from 48rem. Measured on this box (`@container/tiles`), so
 * it behaves the same in either page column. `spacing`: 'rows' (gap-1) for rows
 * that sat in one list, 'cards' (gap-2) for standalone cards.
 */
export function TileGrid({ children, className = '', spacing = 'rows' }: { children: ReactNode; className?: string; spacing?: 'rows' | 'cards' }) {
    const gap = spacing === 'cards' ? 'gap-2' : 'gap-1 @lg/tiles:gap-x-2'
    return (
        <div className="@container/tiles">
            <div className={`grid ${gap} @lg/tiles:grid-cols-2 @3xl/tiles:grid-cols-3 ${className}`}>
                {children}
            </div>
        </div>
    )
}
