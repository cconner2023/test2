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
    /** Guided tour anchor */
    'data-tour'?: string
}

export function PillButton({ icon: Icon, onClick, label, variant = 'default', iconSize, compact, disabled, circleBg, 'data-tour': dataTour }: PillButtonProps) {
    const isMobile = useIsMobile()
    const size = compact
        ? (isMobile ? 'w-[2.4375rem] h-[2.4375rem]' : 'w-8 h-8')  // 39px mobile, 32px desktop
        : (isMobile ? 'w-[2.6875rem] h-[2.6875rem]' : 'w-9 h-9')  // 43px mobile, 36px desktop
    const resolvedIconSize = iconSize ?? (compact ? (isMobile ? 20 : 18) : (isMobile ? 22 : 20))

    const color = circleBg
        ? ''
        : variant === 'danger'
            ? 'text-themeredred hover:text-themeredred/80'
            : 'text-tertiary hover:text-primary'

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            data-tour={dataTour}
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
            : 'rounded-full bg-themewhite border border-tertiary/20 flex items-center justify-center p-0.5 aspect-square'
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
