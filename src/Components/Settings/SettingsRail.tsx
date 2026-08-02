import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { PANEL_TARGET, type SettingsItem } from './SettingsTypes';
import { SearchInput } from '@/Components/primitives/SearchInput';
import { useAvatar } from '../../Utilities/AvatarContext';
import { useAuth } from '../../Hooks/useAuth';
import { useCertifications } from '../../Hooks/useCertifications';
import { useSelfReadiness } from '../../Hooks/useSelfReadiness';
import { getInitials } from '../../Utilities/nameUtils';
import { SubjectCard } from './SubjectCard';
import type { MainSettingsPanelProps } from './MainSettingsPanel';
import { ListGroupLabel } from '@/Components/primitives/Section';
import { MetaBadge } from '@/Components/primitives/MetaBadge';

/**
 * Desktop LEFT-PANE variant of the settings menu. Where MainSettingsPanel (mobile)
 * renders full-width rounded cards with icons, this condenses the same `settingsOptions`
 * into a text tree — no icons — fronted by a primitive SearchInput, matching the
 * AdminSummary / SupervisorTree rail conventions (uppercase section labels, `text-[10pt]`
 * rows, `bg-themeblue3/8 + border-l-themeblue3` active node). All rows sit flush at `pl-4` —
 * uppercase section headers alone separate the groups, no indentation.
 *
 * Shares MainSettingsPanelProps so Settings.tsx feeds both surfaces one prop object.
 *
 * THE PINNED CARD IS THE SUPERVISOR'S CARD. Search, one pinned context object, then
 * the list — the same three-part rail SupervisorRail builds, and literally the same
 * SubjectCard with the same two FillBars. It used to be a plain list row with a
 * chevron, which made "you" read as one menu entry among twenty rather than as the
 * subject the whole drawer is about. The numbers come from useSelfReadiness, the
 * hook the profile's Readiness section reads, so the card cannot disagree with the
 * section it opens onto.
 *
 * The avatar is no longer separately tappable here. It was a nested click target
 * inside the row's button — the supervisor card has one activation, and photo
 * changing lives in the profile the card opens.
 */

export function SettingsRail({
    settingsOptions,
    onItemClick,
    displayName,
    displaySub,
    onProfileClick,
    isConnected,
    activeId,
}: MainSettingsPanelProps) {
    const { currentAvatar, customImage, isCustom, isInitials } = useAvatar();
    const { profile, isAuthenticated } = useAuth();
    const { certs } = useCertifications();
    const { readinessPercent, compliancePercent } = useSelfReadiness(certs);
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

    const renderRow = (item: Extract<SettingsItem, { type: 'option' }>) => {
        const active = activeId != null && PANEL_TARGET[item.id] === activeId && (item.activeWhen ?? true);
        return (
            <button
                key={item.key ?? item.id}
                disabled={item.disabled}
                onClick={() => { if (item.disabled) return; item.action(); onItemClick(item.id); }}
                className={`flex items-center gap-2 w-full py-2 pr-4 pl-4 text-left transition-all active:scale-[0.98] ${
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
                    <MetaBadge>Soon</MetaBadge>
                )}
            </button>
        );
    };

    const showProfile = !q || displayName.toLowerCase().includes(q);
    const noMatches = q && topItems.length === 0 && sections.length === 0 && !showProfile;

    return (
        <div className="h-full flex flex-col">
            {/* Search header — matches the SupervisorDrawer rail. Carries no
                hairline: search and the pinned card are ONE head block, and the
                rule belongs under them (see the scroller below). */}
            <div className="shrink-0 px-3 py-2">
                <SearchInput value={query} onChange={setQuery} placeholder="Search settings…" />
            </div>

            {/* Pinned subject — you. Sits above the scroll with the search, the way
                SupervisorRail pins the selected soldier or cluster. */}
            {showProfile && (
                <div className="shrink-0">
                    <SubjectCard
                        icon={
                            <span className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center shrink-0">
                                {isCustom && customImage ? (
                                    <img src={customImage} alt="Profile" className="w-full h-full object-cover" />
                                ) : isInitials ? (
                                    <span className="w-full h-full rounded-full bg-themeblue2/15 flex items-center justify-center">
                                        <span className="text-sm font-semibold text-themeblue2">
                                            {getInitials(profile.firstName, profile.lastName)}
                                        </span>
                                    </span>
                                ) : currentAvatar.svg}
                            </span>
                        }
                        title={displayName}
                        subtitle={displaySub}
                        readinessPercent={isAuthenticated ? readinessPercent : undefined}
                        compliancePercent={isAuthenticated ? compliancePercent : undefined}
                        active={activeId === 'user-profile'}
                        onActivate={onProfileClick}
                        // Opens the profile panel rather than an inline editor,
                        // so the affordance is "go there", not "change this".
                        actionIcon={ChevronRight}
                        actionLabel="Open profile"
                    />
                </div>
            )}

            {/* No rule under the head block. The pinned card's gradient deepens
                toward its bottom edge and IS the separation; a hairline on top of
                it would redraw the hard edge the wash replaced. */}
            <div className="flex-1 min-h-0 overflow-y-auto py-1">
                {/* Top items (before the first section header) — flush, no label above. */}
                {topItems.map((item) => renderRow(item))}

                {/* Labelled sections — items indent under their label. */}
                {sections.map((section) => (
                    <div key={section.label}>
                        <ListGroupLabel>{section.label}</ListGroupLabel>
                        {section.items.map((item) => renderRow(item))}
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
