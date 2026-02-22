import { ChevronUp, ChevronRight, LogOut } from 'lucide-react';
import type { PanelId, SettingsItem } from './SettingsTypes';

export interface MainSettingsPanelProps {
    settingsOptions: SettingsItem[];
    onItemClick: (id: PanelId) => void;
    avatarSvg: React.ReactNode;
    customImage: string | null;
    isCustom: boolean;
    displayName: string;
    displaySub: string;
    displayClinic?: string;
    onAvatarClick: () => void;
    onProfileClick: () => void;
    onSignOut?: () => void;
    isAuthenticated?: boolean;
    isConnected?: boolean;
}

export const MainSettingsPanel = ({
    settingsOptions,
    onItemClick,
    avatarSvg,
    customImage,
    isCustom,
    displayName,
    displaySub,
    displayClinic,
    onAvatarClick,
    onProfileClick,
    onSignOut,
    isAuthenticated,
    isConnected,
}: MainSettingsPanelProps) => {
    // Separate top row items (no header before them) from grid sections
    const topItems: Extract<SettingsItem, { type: 'option' }>[] = [];
    const gridSections: { label: string; items: Extract<SettingsItem, { type: 'option' }>[] }[] = [];

    let currentSection: { label: string; items: Extract<SettingsItem, { type: 'option' }>[] } | null = null;
    for (const item of settingsOptions) {
        if (item.type === 'header') {
            currentSection = { label: item.label, items: [] };
            gridSections.push(currentSection);
        } else if (currentSection) {
            currentSection.items.push(item);
        } else {
            topItems.push(item);
        }
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <div className="mb-4 pb-4 border-b border-tertiary/10">
                    <div className="flex items-center w-full px-4 py-3.5 md:px-5 md:py-3.5">
                        <button
                            onClick={onAvatarClick}
                            className="mr-4 w-12 h-12 rounded-full overflow-hidden shrink-0
                                       active:scale-95 transition-transform"
                        >
                            {isCustom && customImage ? (
                                <img src={customImage} alt="Profile" className="w-full h-full object-cover" />
                            ) : avatarSvg}
                        </button>
                        <button
                            onClick={onProfileClick}
                            className="flex-1 min-w-0 text-left hover:bg-themewhite2/10 active:scale-[1]
                                       transition-all rounded-lg -my-2 py-2 px-2 -mx-2"
                        >
                            <p className="text-base font-semibold text-primary md:text-[12pt]">{displayName}</p>
                            <p className="text-xs text-tertiary md:text-sm">{displaySub}</p>
                            {displayClinic && (
                                <p className="text-xs text-tertiary md:text-sm mt-0.5">{displayClinic}</p>
                            )}
                        </button>
                        {isAuthenticated ? (
                            <button
                                onClick={(e) => { e.stopPropagation(); onSignOut?.(); }}
                                className="shrink-0 ml-2 p-1.5 rounded-full hover:bg-tertiary/10 active:scale-90 transition-all"
                                aria-label="Sign out"
                            >
                                <LogOut size={18} className="text-themeredred" />
                            </button>
                        ) : (
                            <ChevronRight size={20} className="text-tertiary/40 shrink-0 ml-2" />
                        )}
                    </div>
                </div>

                {/* Top row items */}
                <div className="space-y-1 md:space-y-3">
                    {topItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                item.action();
                                onItemClick(item.id);
                            }}
                            className="flex items-center w-full px-6 py-3.5 hover:bg-themewhite2 active:scale-[0.98]
                                         transition-all rounded-xl group
                                         md:px-6 md:py-3"
                        >
                            <div className={`mr-4 ${item.color} md:group-hover:scale-110 md:transition-transform`}>
                                {item.icon}
                            </div>
                            <span className="flex-1 text-left text-base text-primary font-medium md:font-[11pt]">
                                {item.label}
                            </span>
                            <ChevronUp size={16} className="text-tertiary/40 rotate-90 md:hidden" />
                        </button>
                    ))}
                </div>

                {/* Grid sections — Roles, Preferences, About as box cards */}
                {gridSections.map((section) => (
                    <div key={section.label} className="mt-4 px-6 md:px-6">
                        <div className="pb-2">
                            <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">{section.label}</p>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {section.items.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        if (item.disabled) return;
                                        item.action();
                                        onItemClick(item.id);
                                    }}
                                    disabled={item.disabled}
                                    className={`relative flex flex-col items-center justify-center gap-1
                                               rounded-lg px-2 py-2 border transition-all
                                               ${item.disabled
                                            ? 'border-tertiary/10 bg-themewhite2/50 opacity-50 cursor-not-allowed'
                                            : 'border-tertiary/15 bg-themewhite2 hover:bg-themeblue2/10 hover:border-themeblue2/25 active:scale-[0.97] group'
                                        }`}
                                >
                                    <div className={`relative ${item.disabled ? 'text-tertiary/40' : item.color} ${!item.disabled ? 'group-hover:scale-110' : ''} transition-transform`}>
                                        {item.icon}
                                        {item.disabled && (
                                            <span className="absolute -top-1.5 -right-4 text-[7px] text-tertiary/40 font-semibold uppercase tracking-wide">Soon</span>
                                        )}
                                    </div>
                                    <span className={`text-[11px] font-medium text-center leading-tight ${item.disabled ? 'text-tertiary/40' : 'text-primary'}`}>
                                        {item.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}

                <div className="mt-8 pt-6 border-t border-tertiary/10 md:mt-10">
                    <div className="text-center">
                        <p className="text-sm text-tertiary/60 font-medium md:text-base">ADTMC MEDCOM PAM 40-7-21</p>
                        <p className="text-xs text-tertiary/40 mt-1 md:text-sm">Version {__APP_VERSION__}</p>
                        <div className="flex items-center justify-center gap-1.5 mt-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-themegreen' : 'bg-tertiary/40'}`} />
                            <span className={`text-[11px] font-medium ${isConnected ? 'text-themegreen' : 'text-tertiary/60'}`}>
                                {isConnected ? 'Connected' : 'Offline'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
