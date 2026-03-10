/** Shared empty state placeholder for lists and views with no content. */
import type { ReactNode } from 'react'

interface EmptyStateProps {
    icon?: ReactNode
    title: string
    subtitle?: string
    action?: { label: string; onClick: () => void }
    className?: string
}

export const EmptyState = ({
    icon,
    title,
    subtitle,
    action,
    className = '',
}: EmptyStateProps) => (
    <div className={`flex flex-col items-center justify-center px-4 py-8 ${className}`}>
        {icon && <div className="text-tertiary/30 mb-3">{icon}</div>}
        <p className="text-sm font-medium text-secondary mb-1">{title}</p>
        {subtitle && <p className="text-xs text-tertiary/50 mb-4 text-center">{subtitle}</p>}
        {action && (
            <button
                type="button"
                onClick={action.onClick}
                className="px-4 py-2 rounded-lg bg-themeblue3 text-white text-sm font-medium
                    transition-all duration-300 hover:opacity-90"
            >
                {action.label}
            </button>
        )}
    </div>
)
