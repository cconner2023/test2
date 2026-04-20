import { LayoutDashboard, ListTodo, Map, BarChart2, CalendarDays, MessageSquare } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useUserProfile } from '../../Hooks/useUserProfile'
import type { OverviewWidgetId } from '../../Data/User'
import { OVERVIEW_WIDGET_META } from '../../Data/User'
import { ToggleSwitch } from './ToggleSwitch'
import { SettingsToggleRow } from './SettingsToggleRow'

const WIDGET_ICONS: Record<OverviewWidgetId, LucideIcon> = {
    'task-list':   ListTodo,
    'map-overlay': Map,
    'gantt':       BarChart2,
    'week-view':   CalendarDays,
    'messages':    MessageSquare,
}

const WIDGET_ORDER: OverviewWidgetId[] = ['task-list', 'map-overlay', 'gantt', 'week-view', 'messages']

const DEFAULT_WIDGETS: OverviewWidgetId[] = ['task-list', 'map-overlay']

export function OverviewWidgetsPanel() {
    const { profile, updateProfile, syncProfileField } = useUserProfile()

    const isVisible = profile.overviewWidgets !== null
    const active: OverviewWidgetId[] = profile.overviewWidgets ?? DEFAULT_WIDGETS

    const save = (widgets: OverviewWidgetId[] | null) => {
        updateProfile({ overviewWidgets: widgets })
        syncProfileField({ overview_widgets: widgets })
    }

    const toggleVisible = () => {
        save(isVisible ? null : DEFAULT_WIDGETS)
    }

    const toggleWidget = (id: OverviewWidgetId) => {
        const isOn = active.includes(id)
        if (isOn) {
            save(active.filter(w => w !== id))
        } else {
            if (active.length >= 3) return
            save([...active, id])
        }
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
                <p className="text-xs text-tertiary leading-relaxed">
                    Choose up to 3 widgets shown in the mission overview. Hiding it removes the panel from the home screen.
                </p>

                <div className="rounded-2xl border border-themeblue3/10 overflow-hidden">
                    <SettingsToggleRow
                        icon={LayoutDashboard}
                        label="Show Mission Overview"
                        subtitle="Display the overview panel on the home screen"
                        checked={isVisible}
                        onChange={toggleVisible}
                    />
                </div>

                {isVisible && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Widgets</p>
                            <p className="text-[9pt] text-tertiary/50">{active.length} / 3</p>
                        </div>
                        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                            {WIDGET_ORDER.map((id, idx) => {
                                const meta = OVERVIEW_WIDGET_META[id]
                                const Icon = WIDGET_ICONS[id]
                                const isOn = active.includes(id)
                                const atLimit = active.length >= 3
                                const isDisabled = !!meta.disabled || (!isOn && atLimit)

                                return (
                                    <button
                                        key={id}
                                        onClick={() => !meta.disabled && toggleWidget(id)}
                                        disabled={isDisabled && !isOn}
                                        className={`flex items-center gap-3 w-full px-4 py-3.5 transition-all ${
                                            isDisabled && !isOn
                                                ? 'opacity-40 cursor-not-allowed'
                                                : 'active:scale-95 hover:bg-themeblue2/5'
                                        } ${idx > 0 ? 'border-t border-themeblue3/8' : ''}`}
                                    >
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isOn ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                                            <Icon size={18} className={isOn ? 'text-themeblue2' : 'text-tertiary/50'} />
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className={`text-sm font-medium ${isOn ? 'text-primary' : 'text-tertiary'}`}>{meta.label}</p>
                                            <p className="text-[11px] text-tertiary/70 mt-0.5">{meta.subtitle}</p>
                                        </div>
                                        {meta.disabled ? (
                                            <span className="text-[9px] text-tertiary/40 font-semibold uppercase tracking-wide">Soon</span>
                                        ) : (
                                            <ToggleSwitch checked={isOn} />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
