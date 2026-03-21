import { useCallback } from 'react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useAuthStore } from '../../stores/useAuthStore';
import type { UserTypes, CustomPEBlock } from '../../Data/User';
import { ComprehensiveTemplateEditor } from './ComprehensiveTemplateEditor';
import { CustomPEBlockManager } from './CustomPEBlockManager';

type PEDepth = 'focused' | 'comprehensive' | 'custom';

const PE_DEPTH_OPTIONS: { value: PEDepth; label: string; description: string; providerOnly: boolean }[] = [
    { value: 'focused', label: 'Focused', description: 'Category-specific exam with baseline wrappers', providerOnly: false },
    { value: 'comprehensive', label: 'Comprehensive', description: 'Full system-by-system exam (providers)', providerOnly: true },
    { value: 'custom', label: 'Custom', description: 'Compose exam from block library', providerOnly: false },
];

interface PhysicalExamPanelProps {
    editing?: boolean;
}

export const PhysicalExamPanel = ({ editing = false }: PhysicalExamPanelProps) => {
    const { profile, updateProfile, syncProfileField } = useUserProfile();
    const isProviderRole = useAuthStore((s) => s.isProviderRole);

    const peDepth = profile.peDepth ?? 'focused';
    const customPEBlocks = profile.customPEBlocks ?? [];
    const comprehensivePETemplate = profile.comprehensivePETemplate;

    const depthOptions = PE_DEPTH_OPTIONS.filter(o => !o.providerOnly || isProviderRole);

    const handleUpdate = useCallback((fields: Partial<UserTypes>) => {
        updateProfile(fields);
        const dbFields: Record<string, unknown> = {};
        if (fields.peDepth !== undefined) dbFields.pe_depth = fields.peDepth;
        if (fields.customPEBlocks !== undefined) dbFields.custom_pe_blocks = fields.customPEBlocks;
        if (fields.comprehensivePETemplate !== undefined) dbFields.comprehensive_pe_template = fields.comprehensivePETemplate;
        if (fields.customExamTemplates !== undefined) dbFields.custom_exam_templates = fields.customExamTemplates;
        syncProfileField(dbFields);
    }, [updateProfile, syncProfileField]);

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
                <p className="text-xs text-tertiary leading-relaxed">
                    Configure the physical exam section of your notes.
                </p>

                {/* Exam depth selector */}
                <div>
                    <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">Exam Depth</p>
                    <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                        {depthOptions.map((option, idx) => (
                            <button
                                key={option.value}
                                onClick={() => handleUpdate({ peDepth: option.value })}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 transition-all text-left active:scale-95
                                    ${idx > 0 ? 'border-t border-tertiary/10' : ''}
                                    ${peDepth === option.value ? 'bg-themeblue2/5' : 'hover:bg-themeblue2/5'}`}
                            >
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                                    ${peDepth === option.value ? 'border-themeblue2' : 'border-tertiary/30'}`}
                                >
                                    {peDepth === option.value && (
                                        <div className="w-2 h-2 rounded-full bg-themeblue2" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${peDepth === option.value ? 'text-primary' : 'text-tertiary'}`}>
                                        {option.label}
                                    </p>
                                    <p className="text-[11px] text-tertiary/70 mt-0.5">{option.description}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Comprehensive template — visible when depth is 'comprehensive' */}
                {peDepth === 'comprehensive' && (
                    <ComprehensiveTemplateEditor
                        template={comprehensivePETemplate}
                        onChange={(next) => handleUpdate({ comprehensivePETemplate: next })}
                        editing={editing}
                    />
                )}

                {/* Custom PE blocks — visible when depth is 'custom' */}
                {peDepth === 'custom' && (
                    <CustomPEBlockManager
                        blocks={customPEBlocks}
                        onChange={(next: CustomPEBlock[]) => handleUpdate({ customPEBlocks: next })}
                        editing={editing}
                    />
                )}
            </div>
        </div>
    );
};
