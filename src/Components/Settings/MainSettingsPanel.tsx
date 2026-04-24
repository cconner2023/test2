import { ChevronRight } from 'lucide-react';
import { PANEL, type PanelId, type SettingsItem } from './SettingsTypes';
import { useAvatar } from '../../Utilities/AvatarContext';
import { useAuth } from '../../Hooks/useAuth';
import { getInitials } from '../../Utilities/nameUtils';

export interface MainSettingsPanelProps {
    settingsOptions: SettingsItem[];
    onItemClick: (id: PanelId) => void;
    displayName: string;
    displaySub: string;
    onAvatarClick: () => void;
    onProfileClick: () => void;
    isConnected?: boolean;
}

export const MainSettingsPanel = ({
    settingsOptions,
    onItemClick,
    displayName,
    displaySub,
    onAvatarClick,
    onProfileClick,
    isConnected,
}: MainSettingsPanelProps) => {
    const { currentAvatar, customImage, isCustom, isInitials } = useAvatar();
    const { profile } = useAuth();

    const tourTargets: Partial<Record<PanelId, string>> = {
        [PANEL.TOGGLE_THEME]: 'settings-theme',
        [PANEL.PIN_SETUP]: 'settings-pin',
        [PANEL.NOTIFICATION_SETTINGS]: 'settings-notifications',
        [PANEL.NOTE_CONTENT]: 'settings-note-content',
        [PANEL.OVERVIEW_WIDGETS]: 'settings-mission-overview',
        [PANEL.CLINIC]: 'settings-clinic',
        [PANEL.GUIDED_TOURS]: 'settings-guided-tours',
        [PANEL.PROVIDER_TEMPLATES]: 'settings-provider-templates',
        [PANEL.RELEASE_NOTES]: 'settings-release-notes',
        [PANEL.FEEDBACK]: 'settings-feedback',
        [PANEL.PRIVACY_POLICY]: 'settings-privacy',
    };
    // Separate top row items (no header before them) from card sections
    const topItems: Extract<SettingsItem, { type: 'option' }>[] = [];
    const cardSections: { label: string; items: Extract<SettingsItem, { type: 'option' }>[] }[] = [];

    let currentSection: { label: string; items: Extract<SettingsItem, { type: 'option' }>[] } | null = null;
    for (const item of settingsOptions) {
        if (item.type === 'header') {
            currentSection = { label: item.label, items: [] };
            cardSections.push(currentSection);
        } else if (currentSection) {
            currentSection.items.push(item);
        } else {
            topItems.push(item);
        }
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
                {/* Profile card */}
                <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                    <div
                        data-tour="settings-profile"
                        onClick={onProfileClick}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onProfileClick(); } }}
                        className="flex items-center gap-3 w-full px-4 py-3.5 transition-all active:scale-95 hover:bg-themeblue2/5 cursor-pointer"
                    >
                        <button
                            onClick={(e) => { e.stopPropagation(); onAvatarClick(); }}
                            className="w-11 h-11 rounded-full overflow-hidden shrink-0 active:scale-95 transition-transform"
                        >
                            {isCustom && customImage ? (
                                <img src={customImage} alt="Profile" className="w-full h-full object-cover" />
                            ) : isInitials ? (
                                <div className="w-full h-full rounded-full bg-themeblue2/15 flex items-center justify-center">
                                    <span className="text-sm font-semibold text-themeblue2">
                                        {getInitials(profile.firstName, profile.lastName)}
                                    </span>
                                </div>
                            ) : currentAvatar.svg}
                        </button>
                        <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-semibold text-primary">{displayName}</p>
                            <p className="text-[9pt] text-tertiary mt-0.5">{displaySub}</p>
                        </div>
                        <ChevronRight size={16} className="text-tertiary shrink-0" />
                    </div>
                </div>

                {/* Top row items (before first header, if any) */}
                {topItems.length > 0 && (
                    <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                        {topItems.map((item, idx) => (
                            <button
                                key={item.id}
                                data-tour={tourTargets[item.id]}
                                onClick={() => {
                                    item.action();
                                    onItemClick(item.id);
                                }}
                                className={`flex items-center gap-3 w-full px-4 py-3.5 transition-all active:scale-95 hover:bg-themeblue2/5`}
                            >
                                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                                    <div className={item.color}>{item.icon}</div>
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <p className="text-sm font-medium text-primary">{item.label}</p>
                                    {item.subtitle && (
                                        <p className="text-[9pt] text-tertiary mt-0.5">{item.subtitle}</p>
                                    )}
                                </div>
                                {item.badge != null && item.badge > 0 && (
                                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-themeblue2 text-white text-[9pt] font-semibold flex items-center justify-center">
                                        {item.badge > 99 ? '99+' : item.badge}
                                    </span>
                                )}
                                {item.dot && (
                                    <span className="w-2 h-2 rounded-full bg-themeredred shrink-0" aria-label="New" />
                                )}
                                <ChevronRight size={16} className="text-tertiary shrink-0" />
                            </button>
                        ))}
                    </div>
                )}

                {/* Card sections — card header + card body with list rows */}
                {cardSections.map((section) => (
                    <div key={section.label}>
                        <div className="flex items-center gap-2 mb-2">
                            <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">{section.label}</p>
                        </div>
                        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                            {section.items.map((item, idx) => (
                                <button
                                    key={item.id}
                                    data-tour={tourTargets[item.id]}
                                    onClick={() => {
                                        if (item.disabled) return;
                                        item.action();
                                        onItemClick(item.id);
                                    }}
                                    disabled={item.disabled}
                                    className={`flex items-center gap-3 w-full px-4 py-3.5 transition-all ${item.disabled
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'active:scale-95 hover:bg-themeblue2/5'
                                        }`}
                                >
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                                        <div className={`${item.disabled ? 'text-tertiary' : item.color}`}>
                                            {item.icon}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <p className={`text-sm font-medium ${item.disabled ? 'text-tertiary' : 'text-primary'}`}>
                                            {item.label}
                                        </p>
                                        {item.subtitle && (
                                            <p className="text-[9pt] text-tertiary mt-0.5">{item.subtitle}</p>
                                        )}
                                    </div>
                                    {item.badge != null && item.badge > 0 && (
                                        <span className="min-w-5 h-5 px-1.5 rounded-full bg-themeblue2 text-white text-[9pt] font-semibold flex items-center justify-center">
                                            {item.badge > 99 ? '99+' : item.badge}
                                        </span>
                                    )}
                                    {item.dot && !item.disabled && (
                                        <span className="w-2 h-2 rounded-full bg-themeredred shrink-0" aria-label="New" />
                                    )}
                                    {item.disabled ? (
                                        <span className="text-[9pt] md:text-[9pt] text-tertiary font-semibold uppercase tracking-wide">Soon</span>
                                    ) : (
                                        <ChevronRight size={16} className="text-tertiary shrink-0" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}

                <div className="pt-4 border-t border-tertiary/10">
                    <div className="text-center">
                        <p className="text-xs text-tertiary mt-1">Version {__APP_VERSION__}</p>
                        <div className="flex items-center justify-center gap-1.5 mt-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-themegreen' : 'bg-tertiary/40'}`} />
                            <span className={`text-[9pt] font-medium ${isConnected ? 'text-themegreen' : 'text-tertiary'}`}>
                                {isConnected ? 'Connected' : 'Offline'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
