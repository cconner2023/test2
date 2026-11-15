import { useMemo, useState } from 'react';
import { PANEL_TARGET, type SettingsItem } from './SettingsTypes';
import { RailSearchRow } from '@/Components/primitives/RailSearchRow';
import { DesktopRail } from '@/Components/primitives/DesktopRail';
import { useAuth } from '../../Hooks/useAuth';
import type { MainSettingsPanelProps } from './MainSettingsPanel';
import { ListGroupLabel } from '@/Components/primitives/Section';

type Option = Extract<SettingsItem, { type: 'option' }>;

/**
 * Desktop left rail for Settings: DesktopRail + RailSearchRow + text rows, the
 * same shape as every other split view. Shares MainSettingsPanelProps with the
 * mobile menu so Settings.tsx feeds both one prop object.
 *
 * Profile is a plain first row on purpose. It used to be the supervisor's
 * SubjectCard (avatar, readiness and compliance bars, gradient); that drifted
 * too far from the rail primitives and duplicated numbers the profile panel
 * already shows. Decision filed in v2-decisions/settings 2026-11-15.
 */
export function SettingsRail({
    settingsOptions,
    onItemClick,
    onProfileClick,
    isConnected,
    activeId,
}: MainSettingsPanelProps) {
    const { isAuthenticated } = useAuth();
    const [query, setQuery] = useState('');
    const q = query.trim().toLowerCase();

    // Guests have no profile; the row exits guest mode to the login screen.
    const profileLabel = isAuthenticated ? 'Profile' : 'Sign In';

    const { topItems, sections } = useMemo(() => {
        const top: Option[] = [];
        const secs: { label: string; items: Option[] }[] = [];
        let current: { label: string; items: Option[] } | null = null;
        const match = (it: Option) =>
            !q || it.label.toLowerCase().includes(q) || (it.subtitle?.toLowerCase().includes(q) ?? false);
        for (const item of settingsOptions) {
            if (item.type === 'header') {
                current = { label: item.label, items: [] };
                secs.push(current);
            } else if (!item.disabled && match(item)) {
                if (current) current.items.push(item);
                else top.push(item);
            }
        }
        return { topItems: top, sections: secs.filter((s) => s.items.length > 0) };
    }, [settingsOptions, q]);

    const row = (key: string, label: string, active: boolean, onClick: () => void, trailing?: React.ReactNode) => (
        <button
            key={key}
            type="button"
            onClick={onClick}
            className={`flex items-center gap-2 w-full py-2 px-4 text-left transition-all active:scale-[0.98] ${
                active ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3' : 'hover:bg-secondary/5'
            }`}
        >
            <span className="flex-1 min-w-0 text-[10pt] font-medium truncate text-primary">{label}</span>
            {trailing}
        </button>
    );

    const renderOption = (item: Option) => row(
        item.key ?? item.id,
        item.label,
        activeId != null && PANEL_TARGET[item.id] === activeId && (item.activeWhen ?? true),
        () => { item.action(); onItemClick(item.id); },
        <>
            {item.badge != null && item.badge > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-themeblue2 text-white text-[8.5pt] font-semibold flex items-center justify-center shrink-0">
                    {item.badge > 99 ? '99+' : item.badge}
                </span>
            )}
            {item.dot && <span className="w-2 h-2 rounded-full bg-themeredred shrink-0" aria-label="New" />}
        </>,
    );

    const showProfile = !q || profileLabel.toLowerCase().includes(q);
    const noMatches = q && topItems.length === 0 && sections.length === 0 && !showProfile;

    return (
        <DesktopRail>
            <RailSearchRow value={query} onChange={setQuery} placeholder="Search settings…" />
            <div className="flex-1 min-h-0 overflow-y-auto py-1">
                {showProfile && row('profile', profileLabel, activeId === 'user-profile', onProfileClick)}
                {topItems.map(renderOption)}
                {sections.map((section) => (
                    <div key={section.label}>
                        <ListGroupLabel>{section.label}</ListGroupLabel>
                        {section.items.map(renderOption)}
                    </div>
                ))}
                {noMatches && (
                    <p className="px-4 py-6 text-center text-[10pt] text-tertiary">No matches</p>
                )}
            </div>
            <div className="shrink-0 px-4 py-2.5 border-t border-tertiary/10 flex items-center justify-between">
                <span className="text-[9pt] text-tertiary">Version {__APP_VERSION__}</span>
                <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-themegreen' : 'bg-tertiary/40'}`} />
                    <span className={`text-[9pt] font-medium ${isConnected ? 'text-themegreen' : 'text-tertiary'}`}>
                        {isConnected ? 'Connected' : 'Offline'}
                    </span>
                </span>
            </div>
        </DesktopRail>
    );
}
