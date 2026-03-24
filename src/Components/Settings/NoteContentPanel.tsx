import { useCallback } from 'react';
import { FileText, Stethoscope, ClipboardList, TextCursorInput, ChevronRight, LayoutTemplate } from 'lucide-react';
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

    const includeHPI = profile.noteIncludeHPI ?? true;
    const includePE = profile.noteIncludePE ?? false;
    const includePlan = profile.noteIncludePlan ?? false;
    const textExpanderEnabled = profile.textExpanderEnabled ?? true;

    const handleToggle = useCallback((fields: Partial<UserTypes>) => {
        updateProfile(fields);
        const dbFields: Record<string, unknown> = {};
        if (fields.noteIncludeHPI !== undefined) dbFields.note_include_hpi = fields.noteIncludeHPI;
        if (fields.noteIncludePE !== undefined) dbFields.note_include_pe = fields.noteIncludePE;
        if (fields.noteIncludePlan !== undefined) dbFields.note_include_plan = fields.noteIncludePlan;
        if (fields.textExpanderEnabled !== undefined) dbFields.text_expander_enabled = fields.textExpanderEnabled;
        syncProfileField(dbFields);
    }, [updateProfile, syncProfileField]);

    const sections = [
        {
            icon: FileText,
            label: 'HPI',
            subtitle: 'History of Present Illness',
            checked: includeHPI,
            onToggle: () => handleToggle({ noteIncludeHPI: !includeHPI }),
        },
        {
            icon: Stethoscope,
            label: 'Physical Exam',
            subtitle: 'Exam depth, blocks, and templates',
            checked: includePE,
            onToggle: () => handleToggle({ noteIncludePE: !includePE }),
            navigateTo: 'physical-exam',
        },
        {
            icon: ClipboardList,
            label: 'Plan',
            subtitle: 'Order tags and order sets',
            checked: includePlan,
            onToggle: () => handleToggle({ noteIncludePlan: !includePlan }),
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
                    Customize which sections appear in your notes. Enabled sections can still be toggled per note.
                </p>

                <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                    {sections.map((section, idx) => {
                        const Icon = section.icon;
                        const canNavigate = section.checked && section.navigateTo && onNavigate;

                        return (
                            <div
                                key={section.label}
                                {...(section.navigateTo === 'text-templates' ? { 'data-tour': 'note-content-expanders' } : {})}
                                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
                                onClick={() => canNavigate ? onNavigate!(section.navigateTo!) : section.onToggle()}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        canNavigate ? onNavigate!(section.navigateTo!) : section.onToggle();
                                    }
                                }}
                            >
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                    section.checked ? 'bg-themeblue2/15' : 'bg-tertiary/10'
                                }`}>
                                    <Icon size={18} className={section.checked ? 'text-themeblue2' : 'text-tertiary/50'} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${section.checked ? 'text-primary' : 'text-tertiary'}`}>
                                        {section.label}
                                    </p>
                                    <p className="text-[11px] text-tertiary/70 mt-0.5">{section.subtitle}</p>
                                </div>
                                <div onClick={(e) => { e.stopPropagation(); section.onToggle(); }}>
                                    <ToggleSwitch checked={section.checked} />
                                </div>
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
