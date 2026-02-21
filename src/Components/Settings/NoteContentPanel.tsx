import { useCallback } from 'react';
import { FileText, Stethoscope, TextCursorInput } from 'lucide-react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import type { UserTypes, TextExpander } from '../../Data/User';
import { ToggleSwitch } from './ToggleSwitch';
import { TextExpanderManager } from './TextExpanderManager';

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
    const textExpanderEnabled = profile.textExpanderEnabled ?? true;
    const textExpanders = profile.textExpanders ?? [];

    /** Update locally (instant) and push to Supabase in the background */
    const handleUpdate = useCallback((fields: Partial<UserTypes>) => {
        updateProfile(fields);

        const dbFields: Record<string, unknown> = {};
        if (fields.noteIncludeHPI !== undefined) dbFields.note_include_hpi = fields.noteIncludeHPI;
        if (fields.noteIncludePE !== undefined) dbFields.note_include_pe = fields.noteIncludePE;
        if (fields.peDepth !== undefined) dbFields.pe_depth = fields.peDepth;
        if (fields.textExpanderEnabled !== undefined) dbFields.text_expander_enabled = fields.textExpanderEnabled;
        if (fields.textExpanders !== undefined) dbFields.text_expanders = fields.textExpanders;

        syncProfileField(dbFields);
    }, [updateProfile, syncProfileField]);

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
                {/* Description */}
                <p className="text-xs text-tertiary leading-relaxed">
                    Customize how you write your notes. Enabled sections can still be toggled per note.
                </p>

                {/* HPI */}
                <div
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-tertiary/15 bg-themewhite2 cursor-pointer"
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
                    <ToggleSwitch checked={includeHPI} />
                </div>

                {/* Physical Exam */}
                <div className="rounded-xl border border-tertiary/15 bg-themewhite2 overflow-hidden">
                    <div
                        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
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
                        <ToggleSwitch checked={includePE} />
                    </div>

                    {/* PE Depth — nested, shown when enabled */}
                    {includePE && (
                        <div className="border-t border-tertiary/10 px-4 py-3 space-y-1.5">
                            <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">PE Depth</p>
                            {PE_DEPTH_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => handleUpdate({ peDepth: option.value })}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left
                                        ${peDepth === option.value
                                            ? 'border-themeblue2/25 bg-themeblue2/10'
                                            : 'border-tertiary/15 bg-themewhite hover:bg-themewhite/80'
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
                    )}
                </div>

                {/* Text Expander */}
                <div className="rounded-xl border border-tertiary/15 bg-themewhite2 overflow-hidden">
                    <div
                        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
                        onClick={() => handleUpdate({ textExpanderEnabled: !textExpanderEnabled })}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleUpdate({ textExpanderEnabled: !textExpanderEnabled }); } }}
                    >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${textExpanderEnabled ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                            <TextCursorInput size={18} className={textExpanderEnabled ? 'text-themeblue2' : 'text-tertiary/50'} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${textExpanderEnabled ? 'text-primary' : 'text-tertiary'}`}>Text Templates</p>
                            <p className="text-[11px] text-tertiary/70 mt-0.5">Think autotext or asutype, but specific to your user account. You don't have to filter through 10,000 Genesis options</p>
                        </div>
                        <ToggleSwitch checked={textExpanderEnabled} />
                    </div>

                    {/* Abbreviations — nested, shown when enabled */}
                    {textExpanderEnabled && (
                        <div className="border-t border-tertiary/10 px-4 py-3">
                            <TextExpanderManager
                                expanders={textExpanders}
                                onChange={(next: TextExpander[]) => handleUpdate({ textExpanders: next })}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
