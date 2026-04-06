import { useState, useRef, useEffect } from 'react';
import { Check, X, Trash2, UserPlus, Pill, ScanLine, FlaskConical, CalendarCheck, ClipboardList, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PlanOrderTags, PlanOrderCategory, PlanBlockKey } from '../../Data/User';
import { PLAN_ORDER_CATEGORIES, PLAN_ORDER_LABELS } from '../../Data/User';

const ALL_KEYS: PlanBlockKey[] = [...PLAN_ORDER_CATEGORIES, 'instructions'];

export const CATEGORY_META: Record<PlanBlockKey, { label: string; icon: LucideIcon; color: string; bg: string }> = {
    referral:     { label: 'Referral',      icon: UserPlus,      color: 'text-themeblue2',    bg: 'bg-themeblue2/15' },
    meds:         { label: 'Medications',   icon: Pill,          color: 'text-themepurple',   bg: 'bg-themepurple/15' },
    radiology:    { label: 'Radiology',     icon: ScanLine,      color: 'text-themeyellow',   bg: 'bg-themeyellow/15' },
    lab:          { label: 'Lab',           icon: FlaskConical,  color: 'text-themegreen',    bg: 'bg-themegreen/15' },
    followUp:     { label: 'Follow-Up',     icon: CalendarCheck, color: 'text-themeorange',   bg: 'bg-themeorange/15' },
    instructions: { label: 'Instructions',  icon: ClipboardList, color: 'text-tertiary',      bg: 'bg-tertiary/15' },
};

/** Tags staged for deletion — key → set of tag strings */
export type StagedTagDeletes = Partial<Record<PlanBlockKey, Set<string>>>;
/** Tags staged to be added — key → array of tag strings */
export type StagedTagAdds = Partial<Record<PlanBlockKey, string[]>>;
/** Tags staged for rename — key → Map<originalTag, newTag> */
export type StagedTagEdits = Partial<Record<PlanBlockKey, Map<string, string>>>;

interface PlanTagManagerProps {
    orderTags: PlanOrderTags;
    instructionTags: string[];
    editing?: boolean;
    /** When true, rows show selection for order set composition */
    selectMode?: boolean;
    selectedPresets?: Partial<Record<PlanBlockKey, string[]>>;
    onTogglePreset?: (key: PlanBlockKey, tag: string) => void;
    /** Staging props */
    stagedTagDeletes?: StagedTagDeletes;
    stagedTagAdds?: StagedTagAdds;
    stagedTagEdits?: StagedTagEdits;
    onToggleTagDelete?: (key: PlanBlockKey, tag: string) => void;
    onStageTagAdd?: (key: PlanBlockKey, tag: string) => void;
    onUnstageTagAdd?: (key: PlanBlockKey, tag: string) => void;
    onStageTagEdit?: (key: PlanBlockKey, original: string, next: string) => void;
    clinicTagSets?: Record<string, Set<string>>;
    isSupervisorRole?: boolean;
    scope?: 'personal' | 'clinic';
    onScopeChange?: (scope: 'personal' | 'clinic') => void;
}

export const PlanTagManager = ({
    orderTags, instructionTags,
    editing = true, selectMode = false, selectedPresets, onTogglePreset,
    stagedTagDeletes, stagedTagAdds, stagedTagEdits,
    onToggleTagDelete, onStageTagAdd, onUnstageTagAdd, onStageTagEdit,
    clinicTagSets, isSupervisorRole, scope, onScopeChange,
}: PlanTagManagerProps) => {
    const [input, setInput] = useState('');
    const [activeCategory, setActiveCategory] = useState<PlanBlockKey>('referral');
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    // Inline rename state
    const [editingTag, setEditingTag] = useState<{ key: PlanBlockKey; original: string } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editError, setEditError] = useState('');

    // Reset inline editor when leaving edit mode or changing scope/select mode
    useEffect(() => {
        setEditingTag(null);
        setEditValue('');
        setEditError('');
    }, [editing, scope, selectMode]);

    // Close dropdown on outside tap
    useEffect(() => {
        if (!showCategoryPicker) return;
        const handleDown = (e: PointerEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setShowCategoryPicker(false);
            }
        };
        document.addEventListener('pointerdown', handleDown);
        return () => document.removeEventListener('pointerdown', handleDown);
    }, [showCategoryPicker]);

    const getTagsForKey = (key: PlanBlockKey): string[] => {
        if (key === 'instructions') return instructionTags;
        return orderTags[key] ?? [];
    };

    const startInlineEdit = (key: PlanBlockKey, original: string) => {
        const current = stagedTagEdits?.[key]?.get(original) ?? original;
        setEditingTag({ key, original });
        setEditValue(current);
        setEditError('');
    };

    const cancelInlineEdit = () => {
        setEditingTag(null);
        setEditValue('');
        setEditError('');
    };

    const commitInlineEdit = () => {
        if (!editingTag) return;
        const trimmed = editValue.trim();
        if (!trimmed) { setEditError('Cannot be empty'); return; }
        const { key, original } = editingTag;
        if (trimmed !== original) {
            const otherExisting = getTagsForKey(key).filter(t => t !== original);
            const stagedAddsForKey = stagedTagAdds?.[key] ?? [];
            const otherEditTargets = Array.from(stagedTagEdits?.[key]?.entries() ?? [])
                .filter(([orig]) => orig !== original)
                .map(([, next]) => next);
            const taken = new Set([...otherExisting, ...stagedAddsForKey, ...otherEditTargets]);
            if (taken.has(trimmed)) { setEditError('Already exists'); return; }
        }
        onStageTagEdit?.(key, original, trimmed);
        cancelInlineEdit();
    };

    const deleteFromInlineEdit = () => {
        if (!editingTag) return;
        onToggleTagDelete?.(editingTag.key, editingTag.original);
        cancelInlineEdit();
    };

    const addTag = () => {
        const trimmed = input.trim();
        const current = getTagsForKey(activeCategory);
        const stagedAddsForKey = stagedTagAdds?.[activeCategory] ?? [];
        if (!trimmed || current.includes(trimmed) || stagedAddsForKey.includes(trimmed)) { setInput(''); return; }
        onStageTagAdd?.(activeCategory, trimmed);
        setInput('');
    };

    const visibleCategories = ALL_KEYS.filter(key => {
        const existing = getTagsForKey(key).length > 0;
        const hasAdds = (stagedTagAdds?.[key]?.length ?? 0) > 0;
        return existing || hasAdds;
    });

    const totalExisting = ALL_KEYS.reduce((sum, key) => sum + getTagsForKey(key).length, 0);
    const totalAdds = ALL_KEYS.reduce((sum, key) => sum + (stagedTagAdds?.[key]?.length ?? 0), 0);
    const totalDeletes = ALL_KEYS.reduce((sum, key) => sum + (stagedTagDeletes?.[key]?.size ?? 0), 0);
    const totalCount = totalExisting + totalAdds - totalDeletes;
    const activeMeta = CATEGORY_META[activeCategory];

    return (
        <section data-tour="plan-tag-section">
            <div className="pb-2 flex items-center gap-2">
                <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Plan Tags</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/50 font-medium">
                    {totalCount}
                </span>
                {selectMode && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-themeblue2/15 text-themeblue2 font-medium">
                        Selecting for order set
                    </span>
                )}
            </div>

            <div className={`rounded-xl bg-themewhite2 transition-colors ${
                showCategoryPicker ? 'overflow-visible' : 'overflow-hidden'
            } ${
                selectMode ? 'ring-2 ring-themeblue2/20' : ''
            }`}>
                <div className="px-4 py-3">
                    {/* Add input with category picker — edit-gated, hidden during selectMode */}
                    <div data-tour="plan-tag-input" className={`transition-all duration-300 ease-out ${
                        editing && !selectMode ? 'max-h-32 opacity-100 mb-2' : 'max-h-0 opacity-0'
                    } ${showCategoryPicker ? 'overflow-visible' : 'overflow-hidden'}`}>
                        <div className="flex items-center gap-1.5">
                            <div className="relative" ref={pickerRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                                    className={`flex items-center gap-1 px-3 py-2.5 rounded-full border border-themeblue3/10 shadow-xs bg-themewhite text-sm font-medium transition-all active:scale-95 ${activeMeta.color}`}
                                >
                                    <activeMeta.icon size={14} />
                                    <span className="hidden sm:inline">{activeMeta.label}</span>
                                    <ChevronDown size={12} className="text-tertiary/40" />
                                </button>

                                {showCategoryPicker && (
                                    <div className="absolute z-50 left-0 top-full mt-1 min-w-40 rounded-xl border border-themeblue3/10 bg-themewhite shadow-lg overflow-hidden">
                                        {ALL_KEYS.map(key => {
                                            const meta = CATEGORY_META[key];
                                            const CatIcon = meta.icon;
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => { setActiveCategory(key); setShowCategoryPicker(false); }}
                                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors active:scale-95 ${
                                                        key === activeCategory ? `${meta.color} font-medium bg-tertiary/5` : 'text-primary hover:bg-tertiary/5'
                                                    }`}
                                                >
                                                    <CatIcon size={14} className={meta.color} />
                                                    {meta.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {isSupervisorRole && (
                                <button
                                    type="button"
                                    onClick={() => onScopeChange?.(scope === 'personal' ? 'clinic' : 'personal')}
                                    className={`shrink-0 px-2.5 py-2.5 rounded-full text-[10px] font-semibold tracking-wide transition-all active:scale-95 ${
                                        scope === 'clinic'
                                            ? 'bg-tertiary/10 text-tertiary border border-tertiary/20'
                                            : 'bg-themeblue2/10 text-themeblue2/70 border border-themeblue2/15'
                                    }`}
                                >
                                    {scope === 'clinic' ? 'Clinic' : 'Personal'}
                                </button>
                            )}

                            <div className="relative flex flex-1 items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                                    onFocus={() => setShowCategoryPicker(false)}
                                    placeholder="Add tag..."
                                    className="w-full bg-transparent outline-none text-sm text-primary px-3.5 py-2.5 rounded-full min-w-0 placeholder:text-tertiary/30"
                                />
                            </div>

                            {input.trim() && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setInput('')}
                                        className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={addTag}
                                        className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
                                    >
                                        <Check size={18} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Tag rows */}
                    {visibleCategories.length > 0 ? (
                        <div className="space-y-3">
                            {visibleCategories.map(key => {
                                const meta = CATEGORY_META[key];
                                const CatIcon = meta.icon;
                                const existingTags = getTagsForKey(key);
                                const addedTags = stagedTagAdds?.[key] ?? [];
                                const deletedSet = stagedTagDeletes?.[key];

                                return (
                                    <div key={key} data-tour={`plan-tag-${key}`}>
                                        <p className="text-[10px] font-semibold text-tertiary/40 tracking-widest uppercase mb-0.5 px-2">
                                            {meta.label}
                                        </p>
                                        <div className="space-y-0.5">
                                            {/* Existing tags */}
                                            {existingTags.map((tag, i) => {
                                                if (selectMode) {
                                                    const isSelected = selectedPresets?.[key]?.includes(tag) ?? false;
                                                    return (
                                                        <div
                                                            key={i}
                                                            onClick={() => onTogglePreset?.(key, tag)}
                                                            className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg cursor-pointer active:scale-95 transition-colors ${
                                                                isSelected
                                                                    ? 'ring-1 ring-inset ring-themeblue2/30 bg-themeblue2/5'
                                                                    : 'hover:bg-tertiary/5'
                                                            }`}
                                                        >
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                                                                <CatIcon size={11} className={meta.color} />
                                                            </div>
                                                            <p className={`text-sm ${isSelected ? 'text-primary font-medium' : 'text-primary'}`}>{tag}</p>
                                                        </div>
                                                    );
                                                }

                                                const isMarkedDelete = deletedSet?.has(tag) ?? false;
                                                const isClinicTag = clinicTagSets?.[key]?.has(tag) ?? false;
                                                const canEdit = !isClinicTag || (isSupervisorRole ?? false);
                                                const stagedNewValue = stagedTagEdits?.[key]?.get(tag);
                                                const isMarkedEdit = stagedNewValue !== undefined;
                                                const isOpenInEditor = editingTag?.key === key && editingTag.original === tag;
                                                const displayValue = isMarkedEdit ? stagedNewValue! : tag;

                                                if (isOpenInEditor) {
                                                    return (
                                                        <div
                                                            key={i}
                                                            className="relative flex items-center gap-1.5 py-1.5 px-2 rounded-lg ring-1 ring-inset ring-themeblue3/40 bg-themeblue3/5"
                                                        >
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                                                                <CatIcon size={11} className={meta.color} />
                                                            </div>
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                value={editValue}
                                                                onChange={(e) => { setEditValue(e.target.value); setEditError(''); }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') { e.preventDefault(); commitInlineEdit(); }
                                                                    else if (e.key === 'Escape') { e.preventDefault(); cancelInlineEdit(); }
                                                                }}
                                                                className="flex-1 min-w-0 bg-transparent outline-none text-sm text-primary placeholder:text-tertiary/30"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={deleteFromInlineEdit}
                                                                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-themeredred hover:bg-themeredred/10 active:scale-95 transition-all"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={cancelInlineEdit}
                                                                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={commitInlineEdit}
                                                                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
                                                            >
                                                                <Check size={14} />
                                                            </button>
                                                            {editError && (
                                                                <div className="absolute left-0 right-0 top-full mt-1 z-10">
                                                                    <p className="text-[11px] font-medium text-themeredred bg-themeredred/5 rounded-full px-3 py-1 text-center">
                                                                        {editError}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                const handleRowClick = editing && canEdit
                                                    ? isMarkedDelete
                                                        ? () => onToggleTagDelete?.(key, tag)
                                                        : () => startInlineEdit(key, tag)
                                                    : undefined;

                                                return (
                                                    <div
                                                        key={i}
                                                        onClick={handleRowClick}
                                                        className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg transition-colors ${
                                                            isMarkedDelete
                                                                ? 'ring-1 ring-inset ring-themeredred/30 bg-themeredred/5 cursor-pointer active:scale-95'
                                                                : isMarkedEdit
                                                                    ? 'ring-1 ring-inset ring-themeblue2/30 bg-themeblue2/5 cursor-pointer active:scale-95'
                                                                    : editing && canEdit
                                                                        ? 'cursor-pointer active:scale-95 hover:bg-themeblue3/5'
                                                                        : ''
                                                        }`}
                                                    >
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                                                            <CatIcon size={11} className={meta.color} />
                                                        </div>
                                                        <p className={`text-sm ${
                                                            isMarkedDelete ? 'text-themeredred/60 line-through' : 'text-primary'
                                                        }`}>
                                                            {displayValue}
                                                            {isClinicTag && (
                                                                <span className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/60 ml-1.5">
                                                                    Clinic
                                                                </span>
                                                            )}
                                                            {isMarkedEdit && !isMarkedDelete && (
                                                                <span className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-themeblue2/15 text-themeblue2 ml-1.5">
                                                                    Edited
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                );
                                            })}

                                            {/* Staged adds — selectable in compose mode, removable in edit mode */}
                                            {addedTags.map((tag, i) => {
                                                if (selectMode) {
                                                    const isSelected = selectedPresets?.[key]?.includes(tag) ?? false;
                                                    return (
                                                        <div
                                                            key={`add-${i}`}
                                                            onClick={() => onTogglePreset?.(key, tag)}
                                                            className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg border border-dashed cursor-pointer active:scale-95 transition-colors ${
                                                                isSelected
                                                                    ? 'border-themeblue2/30 ring-1 ring-inset ring-themeblue2/30 bg-themeblue2/5'
                                                                    : 'border-themeblue2/20 hover:bg-tertiary/5'
                                                            }`}
                                                        >
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                                                                <CatIcon size={11} className={meta.color} />
                                                            </div>
                                                            <p className={`text-sm ${isSelected ? 'text-primary font-medium' : 'text-primary'}`}>{tag}</p>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div
                                                        key={`add-${i}`}
                                                        onClick={editing ? () => onUnstageTagAdd?.(key, tag) : undefined}
                                                        className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg border border-dashed border-themeblue2/30 bg-themeblue2/5 cursor-pointer active:scale-95 transition-all"
                                                    >
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                                                            <CatIcon size={11} className={meta.color} />
                                                        </div>
                                                        <p className="text-sm text-primary">{tag}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-tertiary/50 py-2 text-center">
                            {editing ? 'Add your first tag' : 'No tags configured'}
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
};
