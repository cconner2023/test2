import { ClipboardList, TextCursorInput, ChevronRight, LayoutTemplate, LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';

interface NoteContentPanelProps {
    onNavigate?: (panel: string) => void;
}

export const NoteContentPanel = ({ onNavigate }: NoteContentPanelProps) => {
    const isProviderRole = useAuthStore((s) => s.isProviderRole);

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
        {
            icon: LayoutDashboard,
            label: 'Mission Overview',
            subtitle: 'Widgets shown on the home screen',
            navigateTo: 'overview-widgets',
        },
    ];

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
                <p className="text-xs text-tertiary leading-relaxed">
                    Configure your note sections.
                </p>

                <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                    {sections.map((section) => {
                        const Icon = section.icon;
                        return (
                            <div
                                key={section.label}
                                {...(section.navigateTo === 'text-templates' ? { 'data-tour': 'note-content-expanders' } : {})}
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
                                    <p className="text-[11px] text-tertiary/70 mt-0.5">{section.subtitle}</p>
                                </div>
                                <ChevronRight size={16} className="text-tertiary/40 shrink-0" />
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
                                <p className="text-[11px] text-tertiary/70 mt-0.5">Note skeletons from your shortcuts</p>
                            </div>
                            <ChevronRight size={16} className="text-tertiary/40 shrink-0" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
