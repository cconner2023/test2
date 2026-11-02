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
}: {
    children: ReactNode
    className?: string
    ariaLabel?: string
}) {
    return (
        <div
            className={`flex flex-col max-h-[min(70vh,560px)] rounded-2xl bg-themewhite border border-primary/6 shadow-lg overflow-hidden animate-surface-in-down ${className}`}
            aria-label={ariaLabel}
        >
            <div className="min-h-0 overflow-y-auto overscroll-contain py-1">{children}</div>
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
