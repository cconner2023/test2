import { useState, useCallback, useEffect } from 'react';
import { Check, X, Trash2 } from 'lucide-react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import type { UserTypes, ProviderNoteTemplate } from '../../Data/User';

const TEXTAREA_CLASS =
    'w-full min-h-[80px] rounded-xl border border-themeblue3/10 shadow-xs bg-themewhite p-3 text-sm text-primary ' +
    'placeholder:text-tertiary/30 focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none resize-none transition-all duration-300';

interface EditCardState {
    id: string;
    name: string;
    isNew: boolean;
    hpiAbbr: string;
    hpiText: string;
    peAbbr: string;
    peText: string;
    assessAbbr: string;
    assessText: string;
    planAbbr: string;
    planSetId: string;
    planText: string;
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
            hpiAbbr: '', hpiText: '',
            peAbbr: '', peText: '',
            assessAbbr: '', assessText: '',
            planAbbr: '', planSetId: '', planText: '',
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
        setEditCard({
            id: t.id,
            name: t.name,
            isNew: false,
            hpiAbbr: t.hpiExpanderAbbr ?? '',
            hpiText: t.hpiText ?? '',
            peAbbr: t.peExpanderAbbr ?? '',
            peText: t.peText ?? '',
            assessAbbr: t.assessmentExpanderAbbr ?? '',
            assessText: t.assessmentText ?? '',
            planAbbr: t.planExpanderAbbr ?? '',
            planSetId: t.planOrderSetId ?? '',
            planText: t.planText ?? '',
        });
    }, []);

    // Accept edit card
    const handleEditCardAccept = useCallback(() => {
        if (!editCard) return;
        const entry: ProviderNoteTemplate = {
            id: editCard.id,
            name: editCard.name,
            hpiExpanderAbbr: editCard.hpiAbbr || undefined,
            hpiText: !editCard.hpiAbbr && editCard.hpiText ? editCard.hpiText : undefined,
            peExpanderAbbr: editCard.peAbbr || undefined,
            peText: !editCard.peAbbr && editCard.peText ? editCard.peText : undefined,
            assessmentExpanderAbbr: editCard.assessAbbr || undefined,
            assessmentText: !editCard.assessAbbr && editCard.assessText ? editCard.assessText : undefined,
            planExpanderAbbr: editCard.planAbbr || undefined,
            planOrderSetId: !editCard.planAbbr && editCard.planSetId ? editCard.planSetId : undefined,
            planText: !editCard.planAbbr && !editCard.planSetId && editCard.planText ? editCard.planText : undefined,
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

    // ── Shared pill renderers ──

    const renderExpanderPills = (selectedAbbr: string, onSelect: (abbr: string) => void) => {
        if (!expanders.length) return null;
        return (
            <div className="flex flex-wrap gap-1.5 mb-2">
                {expanders.map(e => (
                    <button
                        key={e.abbr}
                        type="button"
                        onClick={() => onSelect(selectedAbbr === e.abbr ? '' : e.abbr)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                            selectedAbbr === e.abbr
                                ? 'bg-themeblue2/15 text-themeblue2 ring-1 ring-inset ring-themeblue2/20'
                                : 'bg-tertiary/8 text-tertiary hover:bg-tertiary/12'
                        }`}
                    >
                        {e.abbr}
                    </button>
                ))}
            </div>
        );
    };

    const renderPreview = (abbr: string) => {
        if (!abbr) return null;
        const match = expanders.find(e => e.abbr === abbr);
        if (!match) return null;
        const text = match.template?.length ? 'Template shortcut' : match.expansion;
        return <p className="text-[11px] text-tertiary/50 mt-1 line-clamp-2">{text}</p>;
    };

    const renderSection = (
        label: string,
        selectedAbbr: string,
        onSelectAbbr: (abbr: string) => void,
        customText: string,
        onCustomText: (text: string) => void,
        placeholder: string,
    ) => (
        <div className="px-4 py-3.5">
            <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">{label}</p>
            {renderExpanderPills(selectedAbbr, onSelectAbbr)}
            {selectedAbbr ? renderPreview(selectedAbbr) : (
                <textarea
                    value={customText}
                    onChange={(e) => onCustomText(e.target.value)}
                    placeholder={placeholder}
                    className={TEXTAREA_CLASS}
                />
            )}
        </div>
    );

    // ── Render ──

    const totalCount = templates.length + stagedAdds.length - stagedDeletes.size;
    const hasItems = templates.length > 0 || stagedAdds.length > 0;

    const fieldPreview = (t: ProviderNoteTemplate): string => {
        const parts: string[] = [];
        if (t.hpiExpanderAbbr || t.hpiText) parts.push('HPI');
        if (t.peExpanderAbbr || t.peText) parts.push('PE');
        if (t.assessmentExpanderAbbr || t.assessmentText) parts.push('Assess');
        if (t.planExpanderAbbr || t.planOrderSetId || t.planText) parts.push('Plan');
        return parts.join(' · ') || 'Empty template';
    };

    return (
        <div className="h-full overflow-y-auto">
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
                                {renderSection('HPI', editCard.hpiAbbr,
                                    (abbr) => setEditCard({ ...editCard, hpiAbbr: abbr }),
                                    editCard.hpiText,
                                    (text) => setEditCard({ ...editCard, hpiText: text }),
                                    'Custom HPI text…'
                                )}
                                {renderSection('Physical Exam', editCard.peAbbr,
                                    (abbr) => setEditCard({ ...editCard, peAbbr: abbr }),
                                    editCard.peText,
                                    (text) => setEditCard({ ...editCard, peText: text }),
                                    'Custom PE text…'
                                )}
                                {renderSection('Assessment', editCard.assessAbbr,
                                    (abbr) => setEditCard({ ...editCard, assessAbbr: abbr }),
                                    editCard.assessText,
                                    (text) => setEditCard({ ...editCard, assessText: text }),
                                    'Custom assessment text…'
                                )}

                                {/* Plan — expanders + order sets */}
                                <div className="px-4 py-3.5">
                                    <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">Plan</p>
                                    {renderExpanderPills(editCard.planAbbr, (abbr) => {
                                        setEditCard({ ...editCard, planAbbr: abbr, ...(abbr ? { planSetId: '', planText: '' } : {}) });
                                    })}
                                    {editCard.planAbbr ? renderPreview(editCard.planAbbr) : (
                                        <>
                                            {orderSets.length > 0 && (
                                                <>
                                                    <p className="text-[9pt] text-tertiary/50 uppercase tracking-wider mb-1.5 mt-1">Order Sets</p>
                                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                                        {orderSets.map(os => (
                                                            <button
                                                                key={os.id}
                                                                type="button"
                                                                onClick={() => setEditCard({
                                                                    ...editCard,
                                                                    planSetId: editCard.planSetId === os.id ? '' : os.id,
                                                                    planText: editCard.planSetId !== os.id ? '' : editCard.planText,
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
                                            {!editCard.planSetId && (
                                                <textarea
                                                    value={editCard.planText}
                                                    onChange={(e) => setEditCard({ ...editCard, planText: e.target.value })}
                                                    placeholder="Custom plan text…"
                                                    className={TEXTAREA_CLASS}
                                                />
                                            )}
                                        </>
                                    )}
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
                                    return (
                                        <div
                                            key={t.id}
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
