import type { LucideIcon } from 'lucide-react'
import { Children, type ReactNode } from 'react'
import { useIsMobile } from '../Hooks/useIsMobile'

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

export function PillButton({ icon: Icon, onClick, label, variant = 'default', iconSize, compact, disabled, circleBg }: PillButtonProps) {
    const size = compact ? 'w-8 h-8' : 'w-9 h-9'   // 32px compact, 36px default
    const resolvedIconSize = iconSize ?? (compact ? 18 : 20)

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
                    <Icon style={{ width: resolvedIconSize, height: resolvedIconSize }} />
                </div>
            ) : (
                <Icon style={{ width: resolvedIconSize, height: resolvedIconSize }} />
            )}
        </button>
    )
}

export function HeaderPill({ children, multi }: { children: ReactNode; multi?: boolean }) {
    const isMobile = useIsMobile()
    const isMulti = multi ?? Children.toArray(children).filter(Boolean).length > 1

    if (!isMobile) return <div className="flex items-center gap-0.5">{children}</div>

    return (
        <div className={isMulti
            ? 'rounded-full bg-themewhite border border-tertiary/20 flex items-center px-1 py-0.5 gap-1'
            : 'rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5'
        }>
            {children}
        </div>
    )
}

export function VerticalPill({ children }: { children: ReactNode }) {
    const isMobile = useIsMobile()
    return (
        <div className={isMobile
            ? 'rounded-full bg-themewhite border border-tertiary/20 flex flex-col items-center p-0.5'
            : 'flex flex-col items-center'
        }>
            {children}
        </div>
    )
}
