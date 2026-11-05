/**
 * Shared pieces of the mobile search template (the main ColumnA search):
 *
 *   SearchCancelButton — the round X that ends a focused search. It takes the
 *     place of the row's right-hand icons while focused (header-search drawers
 *     like Map / Property) or slides in beside the pill (MobileSearchBar).
 *   SearchDropdownCard — the lifted results card anchored under the search row.
 *     Results overlay the page; they never replace it with a results screen.
 *     Callers position it (absolute, under the row); this owns only the chrome.
 */
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export function SearchCancelButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            // Keep the input's focus until the click lands, so blur handlers don't race it.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-tertiary/10 active:scale-95 shrink-0"
            aria-label="Cancel search"
        >
            <X size={18} className="text-tertiary" />
        </button>
    )
}

export function SearchDropdownCard({
    children,
    className = '',
    ariaLabel = 'Search results',
    header,
    footer,
    selfScroll = false,
}: {
    children: ReactNode
    className?: string
    ariaLabel?: string
    /** Child owns its own header + scroller (a flex-1 min-h-0 column); the card
     *  then only clamps height instead of wrapping the child in its scroll region. */
    selfScroll?: boolean
    /** Optional pinned header above the scroll region (e.g. a PaneHeader when the
     *  card hosts a detail — map feature card). */
    header?: ReactNode
    /** Optional pinned footer below the scroll region (a detail's action pills). */
    footer?: ReactNode
}) {
    return (
        <div
            className={`flex flex-col max-h-[min(70vh,560px)] rounded-2xl bg-themewhite3 border border-primary/15 shadow-xl overflow-hidden animate-surface-in-down ${className}`}
            aria-label={ariaLabel}
        >
            {header && <div className="shrink-0">{header}</div>}
            {selfScroll
                ? <div className="flex flex-col flex-1 min-h-0">{children}</div>
                : <div className={`min-h-0 overflow-y-auto overscroll-contain ${header ? '' : 'py-1'}`}>{children}</div>}
            {footer && <div className="shrink-0 border-t border-tertiary/10">{footer}</div>}
        </div>
    )
}

/** Group label inside a SearchDropdownCard. */
export function SearchDropdownGroup({ title, trailing, children }: { title: string; trailing?: ReactNode; children: ReactNode }) {
    return (
        <div className="py-1">
            <div className="flex items-center gap-2 px-4 pt-1.5 pb-1">
                <p className="flex-1 text-[9pt] font-semibold text-tertiary uppercase tracking-wider">{title}</p>
                {trailing}
            </div>
            {children}
        </div>
    )
}
