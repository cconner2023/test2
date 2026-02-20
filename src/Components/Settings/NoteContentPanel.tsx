import { useCallback } from 'react';
import { FileText, Stethoscope } from 'lucide-react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import type { UserTypes } from '../../Data/User';

type PEDepth = 'minimal' | 'expanded';

const PE_DEPTH_OPTIONS: { value: PEDepth; label: string; description: string }[] = [
    { value: 'minimal', label: 'Minimal', description: 'Vitals + free-text findings only' },
    { value: 'expanded', label: 'Expanded', description: 'Expanded vitals + category-specific items, all normal' },
];

export const NoteContentPanel = () => {
    const { profile, updateProfile, syncProfileField } = useUserProfile();

    const includeHPI = profile.noteIncludeHPI ?? true;
    const includePE = profile.noteIncludePE ?? false;
    const peDepth = profile.peDepth ?? 'minimal';

    /** Update locally (instant) and push to Supabase in the background */
    const handleUpdate = useCallback((fields: Partial<UserTypes>) => {
        updateProfile(fields);

        const dbFields: Record<string, unknown> = {};
        if (fields.noteIncludeHPI !== undefined) dbFields.note_include_hpi = fields.noteIncludeHPI;
        if (fields.noteIncludePE !== undefined) dbFields.note_include_pe = fields.noteIncludePE;
        if (fields.peDepth !== undefined) dbFields.pe_depth = fields.peDepth;

        syncProfileField(dbFields);
    }, [updateProfile, syncProfileField]);

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
                {/* Description */}
                <p className="text-xs text-tertiary leading-relaxed">
                    Choose which sections appear in the note wizard. Enabled sections can still be toggled per note.
                </p>

                {/* HPI Toggle */}
                <div
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer
                        ${includeHPI
                            ? 'border-themeblue2/25 bg-themeblue2/10'
                            : 'border-tertiary/15 bg-themewhite2'
                        }`}
                    onClick={() => handleUpdate({ noteIncludeHPI: !includeHPI })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleUpdate({ noteIncludeHPI: !includeHPI }); } }}
                >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${includeHPI ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                        <FileText size={18} className={includeHPI ? 'text-themeblue2' : 'text-tertiary/50'} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${includeHPI ? 'text-primary' : 'text-tertiary'}`}>HPI</p>
                        <p className="text-[11px] text-tertiary/70 mt-0.5">History of Present Illness</p>
                    </div>
                    <div className={`w-10 h-6 rounded-full relative transition-colors ${includeHPI ? 'bg-themeblue2' : 'bg-tertiary/25'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${includeHPI ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                </div>

                {/* PE Toggle */}
                <div
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer
                        ${includePE
                            ? 'border-themeblue2/25 bg-themeblue2/10'
                            : 'border-tertiary/15 bg-themewhite2'
                        }`}
                    onClick={() => handleUpdate({ noteIncludePE: !includePE })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleUpdate({ noteIncludePE: !includePE }); } }}
                >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${includePE ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                        <Stethoscope size={18} className={includePE ? 'text-themeblue2' : 'text-tertiary/50'} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${includePE ? 'text-primary' : 'text-tertiary'}`}>Physical Exam</p>
                        <p className="text-[11px] text-tertiary/70 mt-0.5">Category-specific physical exam</p>
                    </div>
                    <div className={`w-10 h-6 rounded-full relative transition-colors ${includePE ? 'bg-themeblue2' : 'bg-tertiary/25'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${includePE ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                </div>

                {/* PE Depth Selector — only shown when PE is enabled */}
                {includePE && (
                    <div className="space-y-2 pt-1">
                        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase px-1">PE Depth</p>
                        <div className="space-y-1.5">
                            {PE_DEPTH_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => handleUpdate({ peDepth: option.value })}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left
                                        ${peDepth === option.value
                                            ? 'border-themeblue2/25 bg-themeblue2/10'
                                            : 'border-tertiary/15 bg-themewhite2 hover:bg-themewhite2/80'
                                        }`}
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
                )}
            </div>
        </div>
    );
};
