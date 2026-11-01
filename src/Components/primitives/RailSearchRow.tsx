import type { ReactNode } from 'react'
import { Settings } from 'lucide-react'

/**
 * Top row of a desktop split-view left rail: search field + bare settings
 * gear (Messaging, Tracking Board, Calendar, Map). The gear renders only when
 * `onSettings` is given; `active` fills it while its popover is open (Map).
 * `tight` = the pt-2/pb-1 spacing used when the rail stacks more content
 * directly below (Calendar mini-cal, Map recents).
 */
export function RailSearchRow({ search, onSettings, settingsLabel, active = false, tight = false }: {
    search: ReactNode
    onSettings?: () => void
    settingsLabel: string
    active?: boolean
    tight?: boolean
}) {
    return (
        <div className={`shrink-0 flex items-center gap-1.5 px-3 ${tight ? 'pt-2 pb-1' : 'py-2'}`}>
            <div className="flex-1 min-w-0">{search}</div>
            {onSettings && (
                <button
                    type="button"
                    onClick={onSettings}
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
                        active ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
                    }`}
                    aria-label={settingsLabel}
                    title={settingsLabel}
                >
                    <Settings className="w-4 h-4" />
                </button>
            )}
        </div>
    )
}
