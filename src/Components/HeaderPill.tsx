import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface PillButtonProps {
    icon: LucideIcon
    onClick: () => void
    label: string
    variant?: 'default' | 'danger'
    iconSize?: number
    compact?: boolean
}

export function PillButton({ icon: Icon, onClick, label, variant = 'default', iconSize = 18, compact }: PillButtonProps) {
    return (
        <button
            onClick={onClick}
            className={`${compact ? 'w-9 h-9' : 'w-11 h-11'} rounded-full flex items-center justify-center active:scale-95 transition-all duration-200 ${
                variant === 'danger'
                    ? 'text-themeredred hover:text-themeredred/80'
                    : 'text-tertiary hover:text-primary'
            }`}
            aria-label={label}
            title={label}
        >
            <Icon style={{ width: iconSize, height: iconSize }} />
        </button>
    )
}

export function HeaderPill({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5 shadow-sm">
            {children}
        </div>
    )
}

export function VerticalPill({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-full bg-themewhite border border-tertiary/20 flex flex-col items-center p-0.5 shadow-sm">
            {children}
        </div>
    )
}
