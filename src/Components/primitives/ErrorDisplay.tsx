/** Unified error/success/warning display merging ErrorMessage and StatusBanner patterns. */
import { ShieldX, ShieldCheck, AlertTriangle } from 'lucide-react'

interface ErrorDisplayProps {
    type?: 'error' | 'success' | 'warning'
    message: string | null
    className?: string
    centered?: boolean
}

const CONFIG = {
    error:   { icon: ShieldX,       bg: 'bg-themeredred/10',  border: 'border-themeredred/20',  text: 'text-themeredred' },
    success: { icon: ShieldCheck,    bg: 'bg-themegreen/10',   border: 'border-themegreen/20',   text: 'text-themegreen' },
    warning: { icon: AlertTriangle,  bg: 'bg-themeyellow/10',  border: 'border-themeyellow/20',  text: 'text-themeyellow' },
} as const

export const ErrorDisplay = ({
    type = 'error',
    message,
    className = '',
    centered = false,
}: ErrorDisplayProps) => {
    if (!message) return null

    const { icon: Icon, bg, border, text } = CONFIG[type]

    return (
        <div
            role="alert"
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium
                ${bg} ${border} ${text} ${centered ? 'justify-center' : ''} ${className}`}
        >
            <Icon size={16} className={`${text} shrink-0`} />
            <span>{message}</span>
        </div>
    )
}
