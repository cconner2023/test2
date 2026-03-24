import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Check, X, Trash2 } from 'lucide-react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { COMPREHENSIVE_DEFAULT_BLOCK_IDS, getBlockByKey } from '../../Data/PhysicalExamData';
import type { UserTypes, ProviderNoteTemplate, TextExpander } from '../../Data/User';
import { PROVIDER_TOUR_TEMPLATE_PREFIX } from '../../Data/GuidedTourData';

const TEXTAREA_CLASS =
    'w-full min-h-[80px] rounded-xl border border-themeblue3/10 shadow-xs bg-themewhite p-3 text-sm text-primary ' +
    'placeholder:text-tertiary/30 focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none resize-none transition-all duration-300';

interface EditCardState {
    id: string;
    name: string;
    isNew: boolean;
    hpiText: string;
    peText: string;
    peBlockKeys: string[];
    assessText: string;
    planSetId: string;
    planText: string;
}

function TemplateFieldInput({
    value,
    onChange,
    expanders,
    placeholder,
}: {
    value: string;
    onChange: (value: string) => void;
    expanders: TextExpander[];
    placeholder?: string;
}) {
    const [cursorPosition, setCursorPosition] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const detectedAbbrs = useMemo(() => {
        if (!value.trim()) return [];
        const tokens = value.split(/\s+/).filter(Boolean);
        const seen = new Set<string>();
        return expanders.filter(e => {
            if (seen.has(e.abbr)) return false;
            const found = tokens.some(t => t === e.abbr);
            if (found) seen.add(e.abbr);
            return found;
        });
    }, [value, expanders]);

    const currentWord = useMemo(() => {
        if (cursorPosition <= 0 || cursorPosition > value.length) return '';
        let start = cursorPosition;
        while (start > 0 && !/\s/.test(value[start - 1])) start--;
        return value.slice(start, cursorPosition);
    }, [value, cursorPosition]);

    const suggestions = useMemo(() => {
        if (!currentWord || currentWord.length < 2) return [];
        const lc = currentWord.toLowerCase();
        return expanders.filter(e => {
            const abbrLc = e.abbr.toLowerCase();
            return abbrLc.startsWith(lc) && abbrLc !== lc;
        }).slice(0, 5);
    }, [currentWord, expanders]);

    const handleAcceptSuggestion = (expander: TextExpander) => {
        const start = cursorPosition - currentWord.length;
        const newText = value.slice(0, start) + expander.abbr + ' ' + value.slice(cursorPosition);
        const newCursor = start + expander.abbr.length + 1;
        onChange(newText);
        setCursorPosition(newCursor);
        requestAnimationFrame(() => {
            inputRef.current?.setSelectionRange(newCursor, newCursor);
        });
    };

    const handleRemoveAbbr = (abbr: string) => {
        const tokens = value.split(/(\s+)/);
        const filtered = tokens.filter(t => t.trim() !== abbr);
        onChange(filtered.join('').trim());
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (suggestions.length > 0 && e.key === 'Enter') {
            e.preventDefault();
            handleAcceptSuggestion(suggestions[0]);
        }
    };

    useEffect(() => {
        const el = inputRef.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        }
    }, [value]);

    return (
        <div>
            {detectedAbbrs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {detectedAbbrs.map(e => (
                        <span
                            key={e.abbr}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-themeblue2/15 text-themeblue2 ring-1 ring-inset ring-themeblue2/20"
                        >
                            {e.abbr}
                            <button
                                type="button"
                                onClick={() => handleRemoveAbbr(e.abbr)}
                                className="ml-0.5 hover:text-themeredred transition-colors active:scale-95"
                            >
                                <X size={10} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <div className="relative">
                <textarea
                    ref={inputRef}
                    value={value}
                    onChange={(e) => { onChange(e.target.value); setCursorPosition(e.target.selectionStart ?? 0); }}
                    onSelect={(e) => setCursorPosition(e.currentTarget.selectionStart ?? 0)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className={TEXTAREA_CLASS}
                />
                {suggestions.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-themewhite rounded-xl border border-tertiary/10 shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                        {suggestions.map((e, i) => (
                            <button
                                key={e.abbr}
                                type="button"
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => handleAcceptSuggestion(e)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-themeblue2/8 active:scale-[0.98] transition-all ${
                                    i === 0 ? 'bg-themeblue2/5' : ''
                                }`}
                            >
                                <span className="font-medium text-themeblue2">{e.abbr}</span>
                                <span className="text-tertiary/50 ml-2 text-xs truncate">
                                    {e.template?.length ? 'Template' : e.expansion.length > 60 ? e.expansion.slice(0, 57) + '...' : e.expansion}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

interface ProviderTemplatesPanelProps {
    editing?: boolean;
    saveRequested?: boolean;
    onSaveComplete?: () => void;
    onPendingChangesChange?: (hasPending: boolean) => void;
}

export const ProviderTemplatesPanel = ({
    editing = false, saveRequested, onSaveComplete, onPendingChangesChange,
}: ProviderTemplatesPanelProps) => {
    const { profile, updateProfile, syncProfileField } = useUserProfile();

    const templates = profile.providerNoteTemplates ?? [];
    const expanders = profile.textExpanders ?? [];
    const orderSets = profile.planOrderSets ?? [];

    // Staging
    const [stagedDeletes, setStagedDeletes] = useState<Set<string>>(new Set());
    const [stagedAdds, setStagedAdds] = useState<ProviderNoteTemplate[]>([]);

    // Input bar
    const [inputName, setInputName] = useState('');
    const [inputError, setInputError] = useState('');

    // Inline edit card
    const [editCard, setEditCard] = useState<EditCardState | null>(null);

    const hasPending = stagedDeletes.size > 0 || stagedAdds.length > 0;

    useEffect(() => {
        onPendingChangesChange?.(hasPending);
    }, [hasPending, onPendingChangesChange]);

    const handleUpdate = useCallback((fields: Partial<UserTypes>) => {
        updateProfile(fields);
        const dbFields: Record<string, unknown> = {};
        if (fields.providerNoteTemplates !== undefined) dbFields.provider_note_templates = fields.providerNoteTemplates;
        syncProfileField(dbFields);
    }, [updateProfile, syncProfileField]);

    // Commit staged changes
    useEffect(() => {
        if (!saveRequested) return;
        let next = [...templates].filter(t => !stagedDeletes.has(t.id));
        if (stagedAdds.length > 0) next = [...next, ...stagedAdds];
        if (hasPending) handleUpdate({ providerNoteTemplates: next });
        setStagedDeletes(new Set());
        setStagedAdds([]);
        setInputName('');
        setInputError('');
        setEditCard(null);
        onSaveComplete?.();
    }, [saveRequested]); // eslint-disable-line react-hooks/exhaustive-deps

    // Clear on cancel
    useEffect(() => {
        if (!editing) {
            setStagedDeletes(new Set());
            setStagedAdds([]);
            setInputName('');
            setInputError('');
            setEditCard(null);
        }
    }, [editing]);

    const handleToggleDelete = useCallback((id: string) => {
        setStagedDeletes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleUnstageAdd = useCallback((id: string) => {
        setStagedAdds(prev => prev.filter(t => t.id !== id));
    }, []);

    // Input submit — open inline edit card for the new template
    const handleInputSubmit = useCallback(() => {
        const trimmed = inputName.trim();
        if (!trimmed) return;
        const allNames = [
            ...templates.map(t => t.name.toLowerCase()),
            ...stagedAdds.map(t => t.name.toLowerCase()),
        ];
        if (allNames.includes(trimmed.toLowerCase())) {
            setInputError('Name already exists');
            return;
        }
        setEditCard({
            id: crypto.randomUUID(),
            name: trimmed,
            isNew: true,
            hpiText: '',
            peText: '', peBlockKeys: [],
            assessText: '',
            planSetId: '', planText: '',
        });
        setInputName('');
        setInputError('');
    }, [inputName, templates, stagedAdds]);

    const handleClearInput = useCallback(() => {
        setInputName('');
        setInputError('');
    }, []);

    // Open inline edit card for existing template (non-edit mode tap)
    const handleCardTap = useCallback((t: ProviderNoteTemplate) => {
        const mergeField = (abbrs: string[] | undefined, legacyAbbr: string | undefined, text: string | undefined): string => {
            const parts: string[] = [];
            if (abbrs?.length) parts.push(...abbrs);
            else if (legacyAbbr) parts.push(legacyAbbr);
            if (text) parts.push(text);
            return parts.join(' ');
        };
        setEditCard({
            id: t.id,
            name: t.name,
            isNew: false,
            hpiText: mergeField(t.hpiExpanderAbbrs, t.hpiExpanderAbbr, t.hpiText),
            peText: mergeField(t.peExpanderAbbrs, t.peExpanderAbbr, t.peText),
            peBlockKeys: t.peBlockKeys ?? [],
            assessText: mergeField(t.assessmentExpanderAbbrs, t.assessmentExpanderAbbr, t.assessmentText),
            planSetId: t.planOrderSetId ?? '',
            planText: mergeField(t.planExpanderAbbrs, t.planExpanderAbbr, t.planText),
        });
    }, []);

    // Accept edit card
    const handleEditCardAccept = useCallback(() => {
        if (!editCard) return;
        const hasPeBlocks = editCard.peBlockKeys.length > 0;
        const entry: ProviderNoteTemplate = {
            id: editCard.id,
            name: editCard.name,
            hpiText: editCard.hpiText || undefined,
            peText: !hasPeBlocks && editCard.peText ? editCard.peText : undefined,
            peBlockKeys: hasPeBlocks ? editCard.peBlockKeys : undefined,
            assessmentText: editCard.assessText || undefined,
            planOrderSetId: editCard.planSetId || undefined,
            planText: editCard.planText || undefined,
        };

        if (editCard.isNew) {
            setStagedAdds(prev => [...prev, entry]);
        } else {
            const current = profile.providerNoteTemplates ?? [];
            handleUpdate({ providerNoteTemplates: current.map(t => t.id === entry.id ? entry : t) });
        }
        setEditCard(null);
    }, [editCard, profile.providerNoteTemplates, handleUpdate]);

    const handleEditCardCancel = useCallback(() => {
        setEditCard(null);
    }, []);

    const handleEditCardDelete = useCallback(() => {
        if (!editCard || editCard.isNew) return;
        const current = profile.providerNoteTemplates ?? [];
        handleUpdate({ providerNoteTemplates: current.filter(t => t.id !== editCard.id) });
        setEditCard(null);
    }, [editCard, profile.providerNoteTemplates, handleUpdate]);

    const renderSection = (
        label: string,
        text: string,
        onText: (text: string) => void,
        placeholder: string,
    ) => (
        <div className="px-4 py-3.5">
            <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">{label}</p>
            <TemplateFieldInput value={text} onChange={onText} expanders={expanders} placeholder={placeholder} />
        </div>
    );

    // ── Render ──

    const totalCount = templates.length + stagedAdds.length - stagedDeletes.size;
    const hasItems = templates.length > 0 || stagedAdds.length > 0;

    const fieldPreview = (t: ProviderNoteTemplate): string => {
        const parts: string[] = [];
        if (t.hpiExpanderAbbrs?.length || t.hpiExpanderAbbr || t.hpiText) parts.push('HPI');
        if (t.peBlockKeys?.length) parts.push(`PE (${t.peBlockKeys.length})`);
        else if (t.peExpanderAbbrs?.length || t.peExpanderAbbr || t.peText) parts.push('PE');
        if (t.assessmentExpanderAbbrs?.length || t.assessmentExpanderAbbr || t.assessmentText) parts.push('Assess');
        if (t.planExpanderAbbrs?.length || t.planExpanderAbbr || t.planOrderSetId || t.planText) parts.push('Plan');
        return parts.join(' · ') || 'Empty';
    };

    return (
        <div className="h-full overflow-y-auto" data-tour="settings-provider-templates">
            <div className="px-5 py-4 space-y-5">
                <p className="text-xs text-tertiary leading-relaxed">
                    Compose note skeletons from your text shortcuts. Apply them in the Provider drawer to pre-fill fields.
                </p>

                <section className="space-y-3">
                    <div className="flex items-center gap-2">
                        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Templates</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/50 font-medium">
                            {totalCount}
                        </span>
                    </div>

                    {/* ── Inline edit card ── */}
                    <div className={`overflow-hidden transition-all duration-300 ease-out ${
                        editCard ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                        {editCard && (
                            <div className="rounded-xl bg-themewhite2 divide-y divide-tertiary/10">
                                {/* Header */}
                                <div className="px-4 py-3">
                                    <input
                                        type="text"
                                        value={editCard.name}
                                        onChange={(e) => setEditCard({ ...editCard, name: e.target.value })}
                                        placeholder="Template name"
                                        className="w-full bg-transparent outline-none text-base font-semibold text-primary placeholder:text-tertiary/30"
                                        autoFocus
                                    />
                                </div>

                                {/* SOAP sections */}
                                {renderSection('HPI',
                                    editCard.hpiText,
                                    (text) => setEditCard({ ...editCard, hpiText: text }),
                                    'Type shortcuts or free text…'
                                )}
                                {/* PE — block picker or expander/text */}
                                <div className="px-4 py-3.5">
                                    <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">Physical Exam</p>
                                    <p className="text-[9pt] text-tertiary/50 uppercase tracking-wider mb-1.5">Exam Blocks</p>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {COMPREHENSIVE_DEFAULT_BLOCK_IDS.map(key => {
                                            const block = getBlockByKey(key);
                                            if (!block) return null;
                                            const selected = editCard.peBlockKeys.includes(key);
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => {
                                                        const next = selected
                                                            ? editCard.peBlockKeys.filter(k => k !== key)
                                                            : [...editCard.peBlockKeys, key];
                                                        setEditCard({ ...editCard, peBlockKeys: next, peText: '' });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                                                        selected
                                                            ? 'bg-themegreen/15 text-themegreen ring-1 ring-inset ring-themegreen/20'
                                                            : 'bg-tertiary/8 text-tertiary hover:bg-tertiary/12'
                                                    }`}
                                                >
                                                    {block.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {editCard.peBlockKeys.length > 0 ? (
                                        <p className="text-[11px] text-tertiary/50 mt-1">
                                            {editCard.peBlockKeys.length} block{editCard.peBlockKeys.length !== 1 ? 's' : ''} → all normal on apply
                                        </p>
                                    ) : (
                                        <TemplateFieldInput
                                            value={editCard.peText}
                                            onChange={(text) => setEditCard({ ...editCard, peText: text })}
                                            expanders={expanders}
                                            placeholder="Type shortcuts or free text…"
                                        />
                                    )}
                                </div>
                                {renderSection('Assessment',
                                    editCard.assessText,
                                    (text) => setEditCard({ ...editCard, assessText: text }),
                                    'Type shortcuts or free text…'
                                )}

                                {/* Plan — text input + order sets */}
                                <div className="px-4 py-3.5">
                                    <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">Plan</p>
                                    {orderSets.length > 0 && (
                                        <>
                                            <p className="text-[9pt] text-tertiary/50 uppercase tracking-wider mb-1.5">Order Sets</p>
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                                {orderSets.map(os => (
                                                    <button
                                                        key={os.id}
                                                        type="button"
                                                        onClick={() => setEditCard({
                                                            ...editCard,
                                                            planSetId: editCard.planSetId === os.id ? '' : os.id,
                                                        })}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                                                            editCard.planSetId === os.id
                                                                ? 'bg-themeblue2/15 text-themeblue2 ring-1 ring-inset ring-themeblue2/20'
                                                                : 'bg-tertiary/8 text-tertiary hover:bg-tertiary/12'
                                                        }`}
                                                    >
                                                        {os.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                    <TemplateFieldInput
                                        value={editCard.planText}
                                        onChange={(text) => setEditCard({ ...editCard, planText: text })}
                                        expanders={expanders}
                                        placeholder="Type shortcuts or free text…"
                                    />
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-end gap-1.5 px-4 py-2.5">
                                    {!editCard.isNew && (
                                        <button
                                            type="button"
                                            onClick={handleEditCardDelete}
                                            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeredred/10 text-themeredred active:scale-95 transition-all"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleEditCardCancel}
                                        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleEditCardAccept}
                                        disabled={!editCard.name.trim()}
                                        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-40 active:scale-95 transition-all"
                                    >
                                        <Check size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── List card ── */}
                    <div className="rounded-xl bg-themewhite2 overflow-hidden">
                        {/* Input bar — edit gated */}
                        <div className={`overflow-hidden transition-all duration-300 ease-out ${
                            editing && !editCard ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
                        }`}>
                            <div className="relative px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                    <div className="relative flex flex-1 items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                                        <input
                                            type="text"
                                            value={inputName}
                                            onChange={(e) => { setInputName(e.target.value); setInputError(''); }}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInputSubmit(); } }}
                                            placeholder="New template name…"
                                            className="w-full bg-transparent outline-none text-sm text-primary px-3.5 py-2.5 rounded-full min-w-0 placeholder:text-tertiary/30"
                                        />
                                    </div>
                                    {inputName.trim() && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleClearInput}
                                                className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                                            >
                                                <X size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleInputSubmit}
                                                className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
                                            >
                                                <Check size={18} />
                                            </button>
                                        </>
                                    )}
                                </div>
                                {inputError && (
                                    <div className="absolute left-0 right-0 top-full mt-1.5 z-10">
                                        <p className="text-xs font-medium text-themeredred bg-themeredred/5 rounded-full px-4 py-1.5 text-center">
                                            {inputError}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* List */}
                        {hasItems ? (
                            <div className="divide-y divide-tertiary/8 px-2">
                                {stagedAdds.map(t => (
                                    <div
                                        key={`add-${t.id}`}
                                        onClick={editing ? () => handleUnstageAdd(t.id) : undefined}
                                        className="flex items-start py-2.5 px-2 rounded-lg border border-dashed border-themeblue2/30 bg-themeblue2/5 cursor-pointer active:scale-[0.98] transition-all"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-primary truncate">{t.name}</p>
                                            <p className="text-[11px] text-tertiary/50 mt-0.5">{fieldPreview(t)}</p>
                                        </div>
                                    </div>
                                ))}

                                {templates.map(t => {
                                    const isMarkedDelete = stagedDeletes.has(t.id);
                                    const isTourTemplate = t.id.startsWith(PROVIDER_TOUR_TEMPLATE_PREFIX);
                                    return (
                                        <div
                                            key={t.id}
                                            data-tour={isTourTemplate ? 'provider-demo-template' : undefined}
                                            onClick={editing ? () => handleToggleDelete(t.id) : () => handleCardTap(t)}
                                            className={`flex items-start py-2.5 px-2 rounded-lg transition-colors ${
                                                isMarkedDelete
                                                    ? 'ring-1 ring-inset ring-themeredred/30 bg-themeredred/5 cursor-pointer active:scale-[0.98]'
                                                    : editing
                                                        ? 'cursor-pointer active:scale-[0.98] hover:bg-themeredred/5'
                                                        : 'cursor-pointer active:scale-[0.98]'
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate ${
                                                    isMarkedDelete ? 'text-themeredred/60 line-through' : 'text-primary'
                                                }`}>{t.name}</p>
                                                <p className={`text-[11px] mt-0.5 ${
                                                    isMarkedDelete ? 'text-themeredred/30' : 'text-tertiary/50'
                                                }`}>
                                                    {fieldPreview(t)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-tertiary/50 py-4 text-center">
                                No templates configured
                            </p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};
