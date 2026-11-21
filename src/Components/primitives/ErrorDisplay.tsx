/** Inline notice: error/success/warning/info/sync. Card or edge-to-edge strip. */
import type { ReactNode } from 'react'
import { ShieldX, ShieldCheck, AlertTriangle, Info, X, type LucideIcon } from 'lucide-react'

export type NoticeType = 'error' | 'success' | 'warning' | 'info' | 'sync'

interface ErrorDisplayProps {
    type?: NoticeType
    message: ReactNode | null
    title?: ReactNode
    /** null hides the icon. */
    icon?: LucideIcon | null
    action?: ReactNode
    onDismiss?: () => void
    strip?: boolean
    /** Filled alarm fill, for time-critical clinical alerts. */
    solid?: boolean
    className?: string
    centered?: boolean
}

const SOLID: Record<NoticeType, string> = {
    error: 'bg-themeredred', success: 'bg-themegreen', warning: 'bg-themeyellow', info: 'bg-themeblue2', sync: 'bg-themeblue2',
}

const CONFIG: Record<NoticeType, { icon: LucideIcon | null; bg: string; border: string; text: string }> = {
    error:   { icon: ShieldX,       bg: 'bg-themeredred/10',  border: 'border-themeredred/20',  text: 'text-themeredred' },
    success: { icon: ShieldCheck,   bg: 'bg-themegreen/10',   border: 'border-themegreen/20',   text: 'text-themegreen' },
    warning: { icon: AlertTriangle, bg: 'bg-themeyellow/10',  border: 'border-themeyellow/20',  text: 'text-themeyellow' },
    info:    { icon: Info,          bg: 'bg-themeblue2/10',   border: 'border-themeblue2/20',   text: 'text-themeblue2' },
    sync:    { icon: null,          bg: 'bg-themeblue2/10',   border: 'border-themeblue2/20',   text: 'text-themeblue2' },
}

export const ErrorDisplay = ({
    type = 'error',
    message,
    title,
    icon,
    action,
    onDismiss,
    strip = false,
    solid = false,
    className = '',
    centered = false,
}: ErrorDisplayProps) => {
    if (!message && !title) return null

    const cfg = solid
        ? { icon: CONFIG[type].icon, bg: SOLID[type], border: 'border-transparent', text: 'text-white' }
        : CONFIG[type]
    const Icon = icon === undefined ? cfg.icon : icon
    const shape = strip
        ? `px-3 py-2 border-b text-[10pt]`
        : `px-3 py-2.5 rounded-lg border text-sm`

    return (
        <div
            role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
            className={`flex ${title ? 'items-start' : 'items-center'} gap-2 ${solid ? 'font-semibold' : 'font-medium'} ${shape}
                ${cfg.bg} ${cfg.border} ${cfg.text} ${centered ? 'justify-center' : ''} ${className}`}
        >
            {type === 'sync'
                ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                : Icon && <Icon size={16} className={`${cfg.text} shrink-0 ${title ? 'mt-0.5' : ''}`} />}
            <div className={`min-w-0 ${centered ? '' : 'flex-1'}`}>
                {title && <p className="font-semibold">{title}</p>}
                {message && <div className={title ? 'text-[10pt] font-normal text-secondary mt-0.5' : ''}>{message}</div>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
            {onDismiss && (
                <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 p-1 -m-1 rounded-full hover:bg-tertiary/10 transition-colors">
                    <X size={14} />
                </button>
            )}
        </div>
    )
}
