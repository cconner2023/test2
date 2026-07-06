import { ClipboardList, TextCursorInput, ChevronRight, LayoutTemplate, ClipboardCheck, Home, Building2 } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useTemplateSubscription } from '../../Hooks/useTemplateSubscription';
import { SettingsToggleRow } from './SettingsToggleRow';

interface NoteContentPanelProps {
    onNavigate?: (panel: string) => void;
}

export const NoteContentPanel = ({ onNavigate }: NoteContentPanelProps) => {
    const isProviderRole = useAuthStore((s) => s.isProviderRole);
    const isSupervisorRole = useAuthStore((s) => s.isSupervisorRole);
    const isDevRole = useAuthStore((s) => s.isDevRole);
    const canSeeChecklists = isSupervisorRole || isDevRole;
    const { isLoaned, memberships, toggle } = useTemplateSubscription();

    const sections: Array<{
        icon: typeof ClipboardList;
        label: string;
        subtitle: string;
        navigateTo: string;
    }> = [
        {
            icon: ClipboardList,
            label: 'Plan',
            subtitle: 'Order tags and order sets',
            navigateTo: 'plan-settings',
        },
        {
            icon: TextCursorInput,
            label: 'Text Templates',
            subtitle: 'Autotext shortcuts for your notes',
            navigateTo: 'text-templates',
        },
    ];

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 pb-4 space-y-5 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
                <p className="text-[10pt] text-tertiary leading-relaxed">
                    Configure your note sections.
                </p>

                <div className="rounded-2xl bg-themewhite2 overflow-hidden">
                    {sections.map((section) => {
                        const Icon = section.icon;
                        return (
                            <div
                                key={section.label}
                                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
                                onClick={() => onNavigate?.(section.navigateTo)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onNavigate?.(section.navigateTo);
                                    }
                                }}
                            >
                                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeblue2/15">
                                    <Icon size={18} className="text-themeblue2" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-primary">
                                        {section.label}
                                    </p>
                                    <p className="text-[9pt] text-tertiary mt-0.5">{section.subtitle}</p>
                                </div>
                                <ChevronRight size={16} className="text-tertiary shrink-0" />
                            </div>
                        );
                    })}

                    {isProviderRole && (
                        <div
                            className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
                            onClick={() => onNavigate?.('provider-templates')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onNavigate?.('provider-templates');
                                }
                            }}
                        >
                            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeblue2/15">
                                <LayoutTemplate size={18} className="text-themeblue2" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-primary">Provider Templates</p>
                                <p className="text-[9pt] text-tertiary mt-0.5">Note skeletons from your shortcuts</p>
                            </div>
                            <ChevronRight size={16} className="text-tertiary shrink-0" />
                        </div>
                    )}

                    {canSeeChecklists && (
                        <div
                            className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
                            onClick={() => onNavigate?.('checklists')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onNavigate?.('checklists');
                                }
                            }}
                        >
                            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeblue2/15">
                                <ClipboardCheck size={18} className="text-themeblue2" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-primary">Checklists</p>
                                <p className="text-[9pt] text-tertiary mt-0.5">Reusable checks for calendar events</p>
                            </div>
                            <ChevronRight size={16} className="text-tertiary shrink-0" />
                        </div>
                    )}
                </div>

                {isLoaned && (
                    <div className="space-y-2">
                        <div className="px-1">
                            <p className="text-sm font-medium text-primary">Template sources</p>
                            <p className="text-[9pt] text-tertiary mt-0.5">
                                Which clinics' text templates and order sets to mix into your notes. Your personal blocks are always included.
                            </p>
                        </div>
                        <div className="space-y-2">
                            {memberships.map((m) => (
                                <SettingsToggleRow
                                    key={m.id}
                                    icon={m.isHome ? Home : Building2}
                                    label={m.name}
                                    subtitle={m.isHome ? 'Home clinic' : 'Loaned clinic'}
                                    checked={m.subscribed}
                                    onChange={() => toggle(m.id)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
