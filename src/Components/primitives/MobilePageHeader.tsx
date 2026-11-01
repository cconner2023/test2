import type { ReactNode } from 'react'
import { ChevronLeft, type LucideIcon } from 'lucide-react'

/**
 * Header row for a mobile full page that owns its own chrome — the Messaging
 * conversation pattern (1:1, group, outside contact) and anything mirroring it
 * (Tracking Board BRN page). Bordered circular back button · title · actions.
 *
 * Mobile counterpart of PaneHeader: PaneHeader is the desktop detail-pane row;
 * this is the page-level row that clears the safe area (`--sat`).
 */

/** The bordered circular icon button used in this header (back, group info). */
export function PageCircleButton({ icon: Icon, onClick, label, iconClassName = 'w-6 h-6' }: {
    icon: LucideIcon
    onClick?: () => void
    label: string
    iconClassName?: string
}) {
    return (
        <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 overflow-hidden shrink-0">
            <button
                onClick={onClick}
                className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                aria-label={label}
            >
                <Icon className={`${iconClassName} text-tertiary`} />
            </button>
        </div>
    )
}

interface MobilePageHeaderProps {
    onBack?: () => void
    /** A string renders the standard truncated title; pass a node for custom
     *  layouts (e.g. a group's centered name + member count). */
    title: ReactNode
    /** Right edge — a `<HeaderPill>` or `<PageCircleButton>`. Omitted → a
     *  spacer so the title stays balanced against the back button. */
    actions?: ReactNode
    className?: string
}

export function MobilePageHeader({ onBack, title, actions, className = '' }: MobilePageHeaderProps) {
    return (
        <div className={`shrink-0 px-3 py-2 pt-[max(0.5rem,var(--sat,0px))] flex items-center ${className}`}>
            <PageCircleButton icon={ChevronLeft} onClick={onBack} label="Back" />
            {typeof title === 'string'
                ? <p className="flex-1 text-sm font-medium text-primary truncate mx-3">{title}</p>
                : <div className="flex-1 min-w-0 mx-3">{title}</div>}
            {actions ?? <div className="w-12 shrink-0" />}
        </div>
    )
}
