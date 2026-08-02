import { LayoutDashboard, ListTodo, Map, CalendarDays, Package, MessageSquare, Thermometer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useUserProfile } from '../../Hooks/useUserProfile'
import { useFeatureGate } from '../../lib/featureGate'
import type { OverviewWidgetId } from '../../Data/User'
import { OVERVIEW_WIDGET_META } from '../../Data/User'
import { ToggleSwitch } from './ToggleSwitch'
import { SettingsRow, SettingsToggleRow } from './SettingsToggleRow'
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'
import { MetaBadge } from '@/Components/primitives/MetaBadge'

const WIDGET_ICONS: Record<OverviewWidgetId, LucideIcon> = {
    'task-list':   ListTodo,
    'map-overlay': Map,
    'week-view':   CalendarDays,
    'property':    Package,
    'messages':    MessageSquare,
    'weather':     Thermometer,
}

const WIDGET_ORDER: OverviewWidgetId[] = ['task-list', 'map-overlay', 'week-view', 'property', 'messages', 'weather']

const DEFAULT_WIDGETS: OverviewWidgetId[] = ['task-list', 'messages']

export function OverviewWidgetsPanel() {
    const { profile, updateProfile, syncProfileField } = useUserProfile()
    // Property widget surfaces shortages + dispatch — both propertyAccountability
    // staged-rollout features, so it's only offered where that gate is on.
    const showProperty = useFeatureGate('propertyAccountability')
    const widgetOrder = WIDGET_ORDER.filter(id => id !== 'property' || showProperty)

    const isVisible = profile.overviewWidgets !== null
    const VALID_IDS = new Set<string>(widgetOrder)
    const active: OverviewWidgetId[] = Array.from(new Set(
        (profile.overviewWidgets ?? DEFAULT_WIDGETS)
            .map(id => (id as string) === 'gantt' || (id as string) === 'kanban' ? 'week-view' : id)
            .filter((id): id is OverviewWidgetId => VALID_IDS.has(id))
    ))

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
            <div className="px-5 pb-4 space-y-5 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
                <p className="text-[10pt] text-tertiary leading-relaxed">
                    Choose up to 3 widgets shown in the mission overview. Hiding it removes the panel from the home screen.
                </p>

                <div className="rounded-2xl overflow-hidden">
                    <SettingsToggleRow
                        icon={LayoutDashboard}
                        label="Show Mission Overview"
                        subtitle="Display the overview panel on the home screen"
                        checked={isVisible}
                        onChange={toggleVisible}
                        card
                    />
                </div>

                {isVisible && (
                    <div>
                        <SectionHeader trailing={<p className="text-[9pt] text-tertiary">{active.length} / 3</p>}>
                            Widgets
                        </SectionHeader>
                        <SectionCard>
                            {widgetOrder.map((id, idx) => {
                                const meta = OVERVIEW_WIDGET_META[id]
                                const isOn = active.includes(id)
                                const atLimit = active.length >= 3
                                const isDisabled = !!meta.disabled || (!isOn && atLimit)

                                return (
                                    <SettingsRow
                                        key={id}
                                        icon={WIDGET_ICONS[id]}
                                        label={meta.label}
                                        subtitle={meta.subtitle}
                                        on={isOn}
                                        onClick={() => { if (!meta.disabled) toggleWidget(id) }}
                                        disabled={isDisabled && !isOn}
                                        divided={idx > 0}
                                        trailing={meta.disabled
                                            ? <MetaBadge>Soon</MetaBadge>
                                            : <ToggleSwitch checked={isOn} />}
                                    />
                                )
                            })}
                        </SectionCard>
                    </div>
                )}
            </div>
        </div>
    )
}
