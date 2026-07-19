import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { PANEL_TARGET, type SettingsItem } from './SettingsTypes';
import { SearchInput } from '@/Components/primitives/SearchInput';
import { useAvatar } from '../../Utilities/AvatarContext';
import { useAuth } from '../../Hooks/useAuth';
import { getInitials } from '../../Utilities/nameUtils';
import type { MainSettingsPanelProps } from './MainSettingsPanel';

/**
 * Desktop LEFT-PANE variant of the settings menu. Where MainSettingsPanel (mobile)
 * renders full-width rounded cards with icons, this condenses the same `settingsOptions`
 * into a text tree — no icons — fronted by a primitive SearchInput, matching the
 * AdminSummary / SupervisorTree rail conventions (uppercase section labels, `text-[10pt]`
 * rows, `bg-themeblue3/8 + border-l-themeblue3` active node). Section items indent under
 * their label; base-level items (profile, header-less rows) sit flush.
 *
 * Shares MainSettingsPanelProps so Settings.tsx feeds both surfaces one prop object.
 */

export function SettingsRail({
    settingsOptions,
    onItemClick,
    displayName,
    displaySub,
    onAvatarClick,
    onProfileClick,
    isConnected,
    activeId,
}: MainSettingsPanelProps) {
    const { currentAvatar, customImage, isCustom, isInitials } = useAvatar();
    const { profile } = useAuth();
    const [query, setQuery] = useState('');
    const q = query.trim().toLowerCase();

    // Split the flat option list into (optional) top items + labelled sections,
    // exactly as MainSettingsPanel does, then filter by the search query.
    const { topItems, sections } = useMemo(() => {
        const top: Extract<SettingsItem, { type: 'option' }>[] = [];
        const secs: { label: string; items: Extract<SettingsItem, { type: 'option' }>[] }[] = [];
        let current: { label: string; items: Extract<SettingsItem, { type: 'option' }>[] } | null = null;
        const match = (it: Extract<SettingsItem, { type: 'option' }>) =>
            !q || it.label.toLowerCase().includes(q) || (it.subtitle?.toLowerCase().includes(q) ?? false);
        for (const item of settingsOptions) {
            if (item.type === 'header') {
                current = { label: item.label, items: [] };
                secs.push(current);
            } else if (match(item)) {
                if (current) current.items.push(item);
                else top.push(item);
            }
        }
        return { topItems: top, sections: secs.filter((s) => s.items.length > 0) };
    }, [settingsOptions, q]);

    const renderRow = (item: Extract<SettingsItem, { type: 'option' }>, indent: boolean) => {
        const active = activeId != null && PANEL_TARGET[item.id] === activeId;
        return (
            <button
                key={item.id}
                disabled={item.disabled}
                onClick={() => { if (item.disabled) return; item.action(); onItemClick(item.id); }}
                className={`flex items-center gap-2 w-full py-2 pr-4 text-left transition-all active:scale-[0.98] ${
                    indent ? 'pl-8' : 'pl-4'
                } ${
                    item.disabled
                        ? 'opacity-50 cursor-not-allowed'
                        : active
                            ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
                            : 'hover:bg-secondary/5'
                }`}
            >
                <span className={`flex-1 min-w-0 text-[10pt] font-medium truncate ${item.disabled ? 'text-tertiary' : 'text-primary'}`}>
                    {item.label}
                </span>
                {item.badge != null && item.badge > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-themeblue2 text-white text-[8.5pt] font-semibold flex items-center justify-center shrink-0">
                        {item.badge > 99 ? '99+' : item.badge}
                    </span>
                )}
                {item.dot && !item.disabled && (
                    <span className="w-2 h-2 rounded-full bg-themeredred shrink-0" aria-label="New" />
                )}
                {item.disabled && (
                    <span className="text-[8.5pt] font-semibold uppercase tracking-wide text-tertiary shrink-0">Soon</span>
                )}
            </button>
        );
    };

    const showProfile = !q || displayName.toLowerCase().includes(q);
    const noMatches = q && topItems.length === 0 && sections.length === 0 && !showProfile;

    return (
        <div className="h-full flex flex-col">
            {/* Search header — matches the SupervisorDrawer rail. */}
            <div className="shrink-0 px-3 py-2 border-b border-primary/10">
                <SearchInput value={query} onChange={setQuery} placeholder="Search settings…" />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto py-1">
                {/* Profile leaf */}
                {showProfile && (
                    <button
                        onClick={onProfileClick}
                        className="flex items-center gap-2.5 w-full py-2 px-4 text-left transition-all active:scale-[0.98] hover:bg-secondary/5"
                    >
                        <span
                            onClick={(e) => { e.stopPropagation(); onAvatarClick(); }}
                            className="w-7 h-7 rounded-full overflow-hidden shrink-0"
                        >
                            {isCustom && customImage ? (
                                <img src={customImage} alt="Profile" className="w-full h-full object-cover" />
                            ) : isInitials ? (
                                <span className="w-full h-full rounded-full bg-themeblue2/15 flex items-center justify-center">
                                    <span className="text-[8.5pt] font-semibold text-themeblue2">
                                        {getInitials(profile.firstName, profile.lastName)}
                                    </span>
                                </span>
                            ) : currentAvatar.svg}
                        </span>
                        <span className="flex-1 min-w-0">
                            <span className="block text-[10pt] font-medium text-primary truncate">{displayName}</span>
                            <span className="block text-[8.5pt] text-tertiary truncate">{displaySub}</span>
                        </span>
                        <ChevronRight size={14} className="text-tertiary shrink-0" />
                    </button>
                )}

                {/* Top items (before the first section header) — flush, no label above. */}
                {topItems.map((item) => renderRow(item, false))}

                {/* Labelled sections — items indent under their label. */}
                {sections.map((section) => (
                    <div key={section.label}>
                        <p className="px-4 pt-3 pb-1 text-[9pt] font-semibold uppercase tracking-wider text-tertiary">
                            {section.label}
                        </p>
                        {section.items.map((item) => renderRow(item, true))}
                    </div>
                ))}

                {noMatches && (
                    <p className="px-4 py-6 text-center text-[10pt] text-tertiary">No matches</p>
                )}
            </div>

            {/* Footer — version + connection */}
            <div className="shrink-0 px-4 py-2.5 border-t border-tertiary/10 flex items-center justify-between">
                <span className="text-[9pt] text-tertiary">Version {__APP_VERSION__}</span>
                <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-themegreen' : 'bg-tertiary/40'}`} />
                    <span className={`text-[9pt] font-medium ${isConnected ? 'text-themegreen' : 'text-tertiary'}`}>
                        {isConnected ? 'Connected' : 'Offline'}
                    </span>
                </span>
            </div>
        </div>
    );
}
