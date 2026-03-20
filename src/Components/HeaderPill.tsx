import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface PillButtonProps {
    icon: LucideIcon
    onClick: () => void
    label: string
    variant?: 'default' | 'danger'
    iconSize?: number
    compact?: boolean
    disabled?: boolean
    /** Tinted circle behind the icon (e.g. 'bg-themegreen/15 text-themegreen') */
    circleBg?: string
}

export function PillButton({ icon: Icon, onClick, label, variant = 'default', iconSize = 24, compact, disabled, circleBg }: PillButtonProps) {
    const size = compact ? 'w-9 h-9' : 'w-11 h-11'

    const color = circleBg
        ? ''
        : variant === 'danger'
            ? 'text-themeredred hover:text-themeredred/80'
            : 'text-tertiary hover:text-primary'

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${size} rounded-full flex items-center justify-center active:scale-95 transition-all duration-200 ${color} ${disabled ? 'opacity-30 pointer-events-none' : ''} ${circleBg ? '-m-0.5 z-10' : ''}`}
            aria-label={label}
            title={label}
        >
            {circleBg ? (
                <div className={`w-full h-full rounded-full flex items-center justify-center ${circleBg}`}>
                    <Icon style={{ width: iconSize, height: iconSize }} />
                </div>
            ) : (
                <Icon style={{ width: iconSize, height: iconSize }} />
            )}
        </button>
    )
}

export function HeaderPill({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5 gap-0.5">
            {children}
        </div>
    )
}

export function VerticalPill({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-full bg-themewhite border border-tertiary/20 flex flex-col items-center p-0.5">
            {children}
        </div>
    )
}
