import { Settings } from 'lucide-react'
import { SearchInput } from '@/Components/primitives/SearchInput'

/**
 * THE left-pane search row. Every split-view left rail (Messaging, Tracking
 * Board, Calendar, Map, Property, Settings, Supervisor, Admin, User Guide)
 * renders its search through this — one spacing, one input variant, no
 * per-caller wrappers. Callers pass search props, not a node, so the field
 * can't drift. Sits inside DesktopRail (the shared 280px container). The bare gear renders only when `onSettings` is given;
 * `active` fills it while its popover is open (Map).
 *
 * The other two search styles are NavTop's desktop pill and the mobile
 * collapsing bar (MobileSearchBar / ColumnA) — don't add a fourth.
 */
export function RailSearchRow({
    value,
    onChange,
    onSubmit,
    placeholder,
    onSettings,
    settingsLabel,
    active = false,
}: {
    value: string
    onChange: (value: string) => void
    onSubmit?: () => void
    placeholder?: string
    onSettings?: () => void
    settingsLabel?: string
    active?: boolean
}) {
    return (
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-2">
            <SearchInput
                value={value}
                onChange={onChange}
                onSubmit={onSubmit}
                placeholder={placeholder}
                className="flex-1 min-w-0"
            />
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
