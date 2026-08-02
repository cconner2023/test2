import { ChevronRight } from 'lucide-react';
import { PANEL, PANEL_TARGET, type PanelId, type SettingsItem } from './SettingsTypes';
import { useAvatar } from '../../Utilities/AvatarContext';
import { useAuth } from '../../Hooks/useAuth';
import { getInitials } from '../../Utilities/nameUtils';
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'
import { MetaBadge } from '@/Components/primitives/MetaBadge'

export interface MainSettingsPanelProps {
    settingsOptions: SettingsItem[];
    onItemClick: (id: PanelId) => void;
    displayName: string;
    displaySub: string;
    onAvatarClick: () => void;
    onProfileClick: () => void;
    isConnected?: boolean;
    /** Desktop rail: the currently-selected center panel slug — highlights the
     *  matching menu row. Undefined on mobile (no persistent selection). */
    activeId?: string;
}

export const MainSettingsPanel = ({
    settingsOptions,
    onItemClick,
    displayName,
    displaySub,
    onAvatarClick,
    onProfileClick,
    isConnected,
    activeId,
}: MainSettingsPanelProps) => {
    const { currentAvatar, customImage, isCustom, isInitials } = useAvatar();
    const { profile } = useAuth();

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
            <div className="px-5 pb-4 space-y-5 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
                {/* Profile card */}
                <SectionCard>
                    <div
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
                </SectionCard>

                {/* Top row items (before first header, if any) */}
                {topItems.length > 0 && (
                    <SectionCard>
                        {topItems.map((item) => (
                            <button
                                key={item.key ?? item.id}
                                onClick={() => {
                                    item.action();
                                    onItemClick(item.id);
                                }}
                                className={`flex items-center gap-3 w-full px-4 py-3.5 transition-all active:scale-95 hover:bg-themeblue2/5 ${
                                    activeId != null && PANEL_TARGET[item.id] === activeId && (item.activeWhen ?? true) ? 'bg-themeblue3/8' : ''
                                }`}
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
                    </SectionCard>
                )}

                {/* Card sections — card header + card body with list rows */}
                {cardSections.map((section) => (
                    <div key={section.label}>
                        <SectionHeader>{section.label}</SectionHeader>
                        <SectionCard>
                            {section.items.map((item) => (
                                <button
                                    key={item.key ?? item.id}
                                    onClick={() => {
                                        if (item.disabled) return;
                                        item.action();
                                        onItemClick(item.id);
                                    }}
                                    disabled={item.disabled}
                                    className={`flex items-center gap-3 w-full px-4 py-3.5 transition-all ${item.disabled
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'active:scale-95 hover:bg-themeblue2/5'
                                        } ${activeId != null && !item.disabled && PANEL_TARGET[item.id] === activeId && (item.activeWhen ?? true) ? 'bg-themeblue3/8' : ''}`}
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
                                        <MetaBadge>Soon</MetaBadge>
                                    ) : (
                                        <ChevronRight size={16} className="text-tertiary shrink-0" />
                                    )}
                                </button>
                            ))}
                        </SectionCard>
                    </div>
                ))}

                <div className="pt-4 border-t border-tertiary/10">
                    <div className="text-center">
                        <p className="text-[10pt] text-tertiary mt-1">Version {__APP_VERSION__}</p>
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
