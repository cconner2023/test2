import type { LucideIcon } from 'lucide-react'
import { Children, createContext, useContext, type ReactNode } from 'react'
import { useIsMobile } from '@/Hooks/useIsMobile'

/** When true, PillButton/HeaderPill render their DESKTOP treatment even on a
 *  mobile viewport: no capsule bubble, desktop sizing, and `accent` as a tinted
 *  underline (never a filled circle). The Sheet primitive provides this around
 *  its header so header actions — including consumer-passed ones — un-bubble
 *  without touching every call site. Default false = viewport-driven as before. */
const ForceDesktopChrome = createContext(false)
export function DesktopChrome({ children }: { children: ReactNode }) {
    return <ForceDesktopChrome.Provider value={true}>{children}</ForceDesktopChrome.Provider>
}

type AccentTone = 'success' | 'info' | 'danger'

const ACCENT_CIRCLE: Record<AccentTone, string> = {
    success: 'bg-themegreen text-white',
    info: 'bg-themeblue3 text-white',
    danger: 'bg-themeredred text-white',
}
const ACCENT_TEXT: Record<AccentTone, string> = {
    success: 'text-themegreen',
    info: 'text-themeblue3',
    danger: 'text-themeredred',
}
const ACCENT_UNDERLINE: Record<AccentTone, string> = {
    success: 'bg-themegreen',
    info: 'bg-themeblue3',
    danger: 'bg-themeredred',
}

interface PillButtonProps {
    icon: LucideIcon
    onClick: () => void
    label: string
    variant?: 'default' | 'danger'
    iconSize?: number
    compact?: boolean
    disabled?: boolean
    /** Tinted circle behind the icon (e.g. 'bg-themegreen/15 text-themegreen'). Legacy — prefer `accent`. */
    circleBg?: string
    /** Semantic accent — renders as filled circle on mobile (in-pill), underlined icon on desktop. */
    accent?: AccentTone
}

export function PillButton({ icon: Icon, onClick, label, variant = 'default', iconSize, compact, disabled, circleBg, accent }: PillButtonProps) {
    const forceDesktop = useContext(ForceDesktopChrome)
    const isMobile = useIsMobile() && !forceDesktop
    const size = compact
        ? (isMobile ? 'w-[2.4375rem] h-[2.4375rem]' : 'w-8 h-8')  // 39px mobile, 32px desktop
        : (isMobile ? 'w-[2.6875rem] h-[2.6875rem]' : 'w-9 h-9')  // 43px mobile, 36px desktop
    const resolvedIconSize = iconSize ?? (compact ? (isMobile ? 20 : 18) : (isMobile ? 22 : 20))

    // Accent on desktop = underline treatment (no circle bg). Accent on mobile = filled circle.
    const useUnderline = accent && !isMobile
    const accentCircle = accent && isMobile ? ACCENT_CIRCLE[accent] : ''
    const accentText = useUnderline ? ACCENT_TEXT[accent] : ''

    const color = (circleBg || accent)
        ? accentText
        : variant === 'danger'
            ? 'text-themeredred hover:text-themeredred/80'
            : 'text-tertiary hover:text-primary'

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${size} rounded-full flex items-center justify-center active:scale-95 transition-all duration-200 relative ${color} ${disabled ? 'opacity-30 pointer-events-none' : ''}`}
            aria-label={label}
            title={label}
        >
            {circleBg ? (
                <div className={`w-full h-full rounded-full flex items-center justify-center ${circleBg}`}>
                    <Icon style={{ width: resolvedIconSize, height: resolvedIconSize }} />
                </div>
            ) : accentCircle ? (
                <div className={`w-full h-full rounded-full flex items-center justify-center ${accentCircle}`}>
                    <Icon style={{ width: resolvedIconSize, height: resolvedIconSize }} />
                </div>
            ) : (
                <>
                    <Icon style={{ width: resolvedIconSize, height: resolvedIconSize }} />
                    {useUnderline && (
                        <span className={`absolute left-1/2 -translate-x-1/2 bottom-1 h-[2px] w-5 rounded-full ${ACCENT_UNDERLINE[accent]}`} />
                    )}
                </>
            )}
        </button>
    )
}

export function HeaderPill({ children, multi }: { children: ReactNode; multi?: boolean }) {
    const forceDesktop = useContext(ForceDesktopChrome)
    const isMobile = useIsMobile() && !forceDesktop
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
