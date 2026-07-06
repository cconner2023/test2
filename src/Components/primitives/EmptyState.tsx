/** Shared empty state placeholder. Variants:
 *  - `card` (default) WITH an `action`: no card chrome. The add-affordance branches
 *    by `surface` (the container it lives in) — see SURFACE below. The `title`
 *    rides as the button's aria-label (the section label above the slot carries the
 *    visible meaning). This is the consolidated add-empty-state.
 *  - `card` WITHOUT an `action`: informational text (optionally in bordered chrome).
 *  - `gate`: centered icon + title + subtitle for access gates (sign-in, role-required).
 *
 * SURFACE (add-empty-state only): the empty-state treatment differs by the
 * container it sits in. `drawer` (default) = variant A, a full-width dashed
 * add-row (icon + label). `sheet` and `overlay` will branch to their own
 * treatments — for now they fall through to the drawer row.
 */
import type { ReactNode } from 'react'
import { useRef } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateAction {
    icon: LucideIcon
    label: string
    onClick: (anchor: HTMLElement) => void
}

interface EmptyStateProps {
    variant?: 'card' | 'gate'
    /** Add-empty-state only — the container the empty state lives in. Branches the
     *  add-affordance treatment. Default 'drawer' (variant A dashed add-row). */
    surface?: 'drawer' | 'sheet' | 'overlay'
    /** Gate variant only — ignored on card. */
    icon?: ReactNode
    title: string
    /** Gate variant only — ignored on card. */
    subtitle?: string
    action?: EmptyStateAction
    className?: string
    /** Card variant, no-action only — when false, drops the rounded border / bg chrome so it sits inside an existing container. */
    bordered?: boolean
}

export const EmptyState = ({
    variant = 'card',
    surface = 'drawer',
    icon,
    title,
    subtitle,
    action,
    className = '',
    bordered = true,
}: EmptyStateProps) => {
    const anchorRef = useRef<HTMLButtonElement>(null)

    if (variant === 'gate') {
        return (
            <div className={`flex flex-col items-center justify-center px-4 py-8 ${className}`}>
                {icon && <div className="text-tertiary mb-3">{icon}</div>}
                <p className="text-[10pt] font-medium text-secondary mb-1">{title}</p>
                {subtitle && <p className="text-[10pt] text-tertiary text-center">{subtitle}</p>}
            </div>
        )
    }

    // Add-empty-state — no card. Treatment branches by SURFACE.
    if (action) {
        const Glyph = action.icon

        // Sheet: the sheet HEADER owns the add affordance (its + or ellipsis), so the
        // empty body is just the message text — no in-body add row.
        if (surface === 'sheet') {
            return (
                <div className={`px-4 py-8 text-center text-[10pt] text-tertiary ${className}`}>
                    {title}
                </div>
            )
        }

        // Variant A (drawer; overlay falls through for now): a full-width dashed
        // add-row — icon only, ghosted, lifting to full opacity on hover. No card.
        return (
            <button
                ref={anchorRef}
                onClick={() => anchorRef.current && action.onClick(anchorRef.current)}
                aria-label={action.label}
                className={`flex items-center justify-center gap-1.5 w-full py-3 rounded-2xl border border-dashed border-themeblue2/25 text-themeblue2 text-[10pt] font-medium opacity-50 hover:opacity-100 hover:bg-themeblue2/5 active:scale-[0.98] transition-all ${className}`}
            >
                <Glyph className="w-4 h-4" />
            </button>
        )
    }

    // Informational (no action) — plain text, optionally in bordered card chrome.
    const row = (
        <div className="flex items-center gap-3 px-4 py-3 min-h-[3.75rem]">
            <p className="text-[10pt] text-tertiary flex-1 text-center">{title}</p>
        </div>
    )
    return (
        <div className={`relative ${className}`}>
            {bordered ? (
                <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                    {row}
                </div>
            ) : row}
        </div>
    )
}
