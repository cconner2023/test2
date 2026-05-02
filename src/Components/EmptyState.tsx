/** Shared empty state placeholder. Two variants:
 *  - `card` (default): matches SectionCard chrome (rounded-2xl + border + bg-themewhite2)
 *    sized to a populated card with one item. When `action` is provided, the ActionPill
 *    renders centered as the focal element of the empty state. When populated (caller's
 *    own render path), the ActionPill moves to absolute top-2 right-2 overlying the
 *    first item.
 *  - `gate`: centered icon + title + subtitle for access gates (sign-in, role-required).
 */
import type { ReactNode } from 'react'
import { useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ActionPill } from './ActionPill'
import { ActionButton } from './ActionButton'

interface EmptyStateAction {
    icon: LucideIcon
    label: string
    onClick: (anchor: HTMLElement) => void
}

interface EmptyStateProps {
    variant?: 'card' | 'gate'
    /** Gate variant only — ignored on card. */
    icon?: ReactNode
    title: string
    /** Gate variant only — ignored on card. */
    subtitle?: string
    action?: EmptyStateAction
    className?: string
}

export const EmptyState = ({
    variant = 'card',
    icon,
    title,
    subtitle,
    action,
    className = '',
}: EmptyStateProps) => {
    const anchorRef = useRef<HTMLDivElement>(null)

    if (variant === 'gate') {
        return (
            <div className={`flex flex-col items-center justify-center px-4 py-8 ${className}`}>
                {icon && <div className="text-tertiary mb-3">{icon}</div>}
                <p className="text-sm font-medium text-secondary mb-1">{title}</p>
                {subtitle && <p className="text-[10pt] text-tertiary text-center">{subtitle}</p>}
            </div>
        )
    }

    return (
        <div className={`relative rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden ${className}`}>
            <div className="flex items-center gap-3 px-4 py-3 min-h-[3.75rem]">
                <p className={`text-sm text-tertiary ${action ? 'flex-1' : 'flex-1 text-center'}`}>{title}</p>
                {action && (
                    <ActionPill ref={anchorRef} shadow="sm">
                        <ActionButton
                            icon={action.icon}
                            label={action.label}
                            onClick={() => anchorRef.current && action.onClick(anchorRef.current)}
                        />
                    </ActionPill>
                )}
            </div>
        </div>
    )
}
