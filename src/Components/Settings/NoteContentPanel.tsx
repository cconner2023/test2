import { useCallback } from 'react';
import { Stethoscope, ClipboardList, TextCursorInput, ChevronRight, LayoutTemplate } from 'lucide-react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useAuthStore } from '../../stores/useAuthStore';
import type { UserTypes } from '../../Data/User';
import { ToggleSwitch } from './ToggleSwitch';

interface NoteContentPanelProps {
    onNavigate?: (panel: string) => void;
}

export const NoteContentPanel = ({ onNavigate }: NoteContentPanelProps) => {
    const { profile, updateProfile, syncProfileField } = useUserProfile();
    const isProviderRole = useAuthStore((s) => s.isProviderRole);

    const textExpanderEnabled = profile.textExpanderEnabled ?? true;

    const handleToggle = useCallback((fields: Partial<UserTypes>) => {
        updateProfile(fields);
        const dbFields: Record<string, unknown> = {};
        if (fields.textExpanderEnabled !== undefined) dbFields.text_expander_enabled = fields.textExpanderEnabled;
        syncProfileField(dbFields);
    }, [updateProfile, syncProfileField]);

    const sections: Array<{
        icon: typeof Stethoscope;
        label: string;
        subtitle: string;
        checked?: boolean;
        onToggle?: () => void;
        navigateTo?: string;
    }> = [
        {
            icon: Stethoscope,
            label: 'Physical Exam',
            subtitle: 'Exam depth, blocks, and templates',
            navigateTo: 'physical-exam',
        },
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
            checked: textExpanderEnabled,
            onToggle: () => handleToggle({ textExpanderEnabled: !textExpanderEnabled }),
            navigateTo: 'text-templates',
        },
    ];

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
                <p className="text-xs text-tertiary leading-relaxed">
                    Configure your note sections.
                </p>

                <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                    {sections.map((section, idx) => {
                        const Icon = section.icon;
                        const canNavigate = section.navigateTo && onNavigate;
                        const isEnabled = section.checked !== undefined ? section.checked : true;

                        return (
                            <div
                                key={section.label}
                                {...(section.navigateTo === 'text-templates' ? { 'data-tour': 'note-content-expanders' } : {})}
                                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
                                onClick={() => canNavigate ? onNavigate!(section.navigateTo!) : section.onToggle?.()}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        canNavigate ? onNavigate!(section.navigateTo!) : section.onToggle?.();
                                    }
                                }}
                            >
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                    isEnabled ? 'bg-themeblue2/15' : 'bg-tertiary/10'
                                }`}>
                                    <Icon size={18} className={isEnabled ? 'text-themeblue2' : 'text-tertiary/50'} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${isEnabled ? 'text-primary' : 'text-tertiary'}`}>
                                        {section.label}
                                    </p>
                                    <p className="text-[11px] text-tertiary/70 mt-0.5">{section.subtitle}</p>
                                </div>
                                {section.onToggle && (
                                    <div onClick={(e) => { e.stopPropagation(); section.onToggle!(); }}>
                                        <ToggleSwitch checked={section.checked} />
                                    </div>
                                )}
                                {canNavigate && (
                                    <ChevronRight size={16} className="text-tertiary/40 shrink-0" />
                                )}
                            </div>
                        );
                    })}
                </div>

                {isProviderRole && (
                    <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
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
                    </div>
                )}
            </div>
        </div>
    );
};
