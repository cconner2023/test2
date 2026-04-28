/** Shared empty state placeholder. Two variants:
 *  - `card` (default): rounded-xl bg-themewhite2 card with centered tertiary text and an
 *    optional ActionPill at absolute top-2 right-2 (canonical exemplar: OrderSetManager,
 *    PlanTagManager). The ActionPill is the canonical actionItem container — rendered
 *    identically on populated cards, overlaid on the first item. Use bottom-2 right-2
 *    only when the top-right is occupied (e.g., a QR code pinned there).
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
        <div className={`relative rounded-xl bg-themewhite2 overflow-hidden ${className}`}>
            <div className="px-4 py-3">
                <p className="text-sm text-tertiary py-4 text-center">{title}</p>
            </div>
            {action && (
                <ActionPill ref={anchorRef} shadow="sm" className="absolute top-2 right-2">
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
