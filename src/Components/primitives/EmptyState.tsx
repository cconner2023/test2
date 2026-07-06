/** Shared empty state placeholder. Two variants:
 *  - `card` (default): matches SectionCard chrome (rounded-2xl + border + bg-themewhite2)
 *    sized to a populated card with one item. When `action` is provided, the ActionPill
 *    uses placement="overlay" — riding the top edge of the card / divider — matching
 *    populated-card overlays. The pill is always lifted to a sibling of the bordered
 *    chrome so its negative translate isn't clipped by overflow-hidden.
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
    /** Card variant only — when false, drops the rounded border / bg chrome so it sits inside an existing container. */
    bordered?: boolean
}

export const EmptyState = ({
    variant = 'card',
    icon,
    title,
    subtitle,
    action,
    className = '',
    bordered = true,
}: EmptyStateProps) => {
    const anchorRef = useRef<HTMLDivElement>(null)

    if (variant === 'gate') {
        return (
            <div className={`flex flex-col items-center justify-center px-4 py-8 ${className}`}>
                {icon && <div className="text-tertiary mb-3">{icon}</div>}
                <p className="text-[10pt] font-medium text-secondary mb-1">{title}</p>
                {subtitle && <p className="text-[10pt] text-tertiary text-center">{subtitle}</p>}
            </div>
        )
    }

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
            {action && (
                <ActionPill ref={anchorRef} shadow="sm" placement="overlay">
                    <ActionButton
                        icon={action.icon}
                        label={action.label}
                        onClick={() => anchorRef.current && action.onClick(anchorRef.current)}
                    />
                </ActionPill>
            )}
        </div>
    )
}
