import { useState, useCallback, useEffect, useMemo } from 'react';
import { Check, X, Trash2 } from 'lucide-react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useMergedNoteContent } from '../../Hooks/useMergedNoteContent';
import { getColorClasses } from '../../Utilities/ColorUtilities';
import { ExpandableInput } from '../ExpandableInput';
import { PhysicalExam } from '../PhysicalExam';
import { Plan } from '../Plan';
import { PLAN_ORDER_LABELS } from '../../Data/User';
import type { UserTypes, ProviderNoteTemplate, TextExpander, PlanOrderSet } from '../../Data/User';
import { PROVIDER_TOUR_TEMPLATE_PREFIX } from '../../Data/GuidedTourData';

const INPUT_CLASS =
    'w-full rounded-xl border border-themeblue3/10 shadow-xs bg-themewhite p-3 text-sm text-primary ' +
    'placeholder:text-tertiary focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none resize-none transition-all duration-300 overflow-hidden';

interface EditCardState {
    id: string;
    name: string;
    isNew: boolean;
    hpiText: string;
    peBlockKeys: string[];
    assessText: string;
    planText: string;
}

// ── Legacy → plain text resolution ──────────────────────────────────────────
// Existing templates may carry abbr arrays and planOrderSetId. When opened in
// the new editor, flatten those into plain text so ExpandableInput/Plan can
// round-trip them. New saves never write these legacy fields.

function mergeLegacyText(
    abbrs: string[] | undefined,
    legacyAbbr: string | undefined,
    text: string | undefined,
): string {
    const parts: string[] = [];
    if (abbrs?.length) parts.push(...abbrs);
    else if (legacyAbbr) parts.push(legacyAbbr);
    if (text) parts.push(text);
    return parts.join(' ');
}

function resolveLegacyPlanText(t: ProviderNoteTemplate, orderSets: PlanOrderSet[]): string {
    const abbrText = mergeLegacyText(t.planExpanderAbbrs, t.planExpanderAbbr, t.planText);
    if (abbrText.trim()) return abbrText;
    // Expand planOrderSetId presets into Plan's line format so it parses back
    if (!t.planOrderSetId) return '';
    const os = orderSets.find(s => s.id === t.planOrderSetId);
    if (!os) return '';
    const labels: Record<string, string> = { ...PLAN_ORDER_LABELS, instructions: 'Instructions' };
    const keys = ['meds', 'lab', 'radiology', 'referral', 'instructions', 'followUp'] as const;
    return keys
        .filter(k => os.presets[k]?.length)
        .map(k => `${labels[k]}: ${os.presets[k]!.join('; ')}`)
        .join('\n');
}

// ── Field preview for list rows ─────────────────────────────────────────────

function fieldPreview(t: ProviderNoteTemplate): string {
    const parts: string[] = [];
    if (t.hpiExpanderAbbrs?.length || t.hpiExpanderAbbr || t.hpiText) parts.push('HPI');
    if (t.peBlockKeys?.length) parts.push(`PE (${t.peBlockKeys.length})`);
    else if (t.peExpanderAbbrs?.length || t.peExpanderAbbr || t.peText) parts.push('PE');
    if (t.assessmentExpanderAbbrs?.length || t.assessmentExpanderAbbr || t.assessmentText) parts.push('Assess');
    if (t.planExpanderAbbrs?.length || t.planExpanderAbbr || t.planOrderSetId || t.planText) parts.push('Plan');
    return parts.join(' · ') || 'Empty';
}

// ── Shared section wrapper ──────────────────────────────────────────────────

function Section({
    label, value, onChange, expanders, placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    expanders: TextExpander[];
    placeholder: string;
}) {
    return (
        <div className="px-4 py-3.5 space-y-2">
            <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">{label}</p>
            <ExpandableInput
                value={value}
                onChange={onChange}
                expanders={expanders}
                multiline
                className={INPUT_CLASS}
                placeholder={placeholder}
            />
        </div>
    );
}

// ── Main panel ──────────────────────────────────────────────────────────────

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
    const { expanders, orderTags, instructionTags, orderSets } = useMergedNoteContent();

    const templates = profile.providerNoteTemplates ?? [];

    // Staging — full parity with TextExpanderManager
    const [stagedDeletes, setStagedDeletes] = useState<Set<string>>(new Set());
    const [stagedAdds, setStagedAdds] = useState<ProviderNoteTemplate[]>([]);
    const [stagedEdits, setStagedEdits] = useState<Map<string, ProviderNoteTemplate>>(new Map());

    // Input bar
    const [inputName, setInputName] = useState('');
    const [inputError, setInputError] = useState('');

    // Inline edit card
    const [editCard, setEditCard] = useState<EditCardState | null>(null);

    const hasPending = stagedDeletes.size > 0 || stagedAdds.length > 0 || stagedEdits.size > 0;

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
        let next = [...templates]
            .filter(t => !stagedDeletes.has(t.id))
            .map(t => stagedEdits.get(t.id) ?? t);
        if (stagedAdds.length > 0) next = [...next, ...stagedAdds];
        if (hasPending) handleUpdate({ providerNoteTemplates: next });
        setStagedDeletes(new Set());
        setStagedAdds([]);
        setStagedEdits(new Map());
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
            setStagedEdits(new Map());
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
            peBlockKeys: [],
            assessText: '',
            planText: '',
        });
        setInputName('');
        setInputError('');
    }, [inputName, templates, stagedAdds]);

    const handleClearInput = useCallback(() => {
        setInputName('');
        setInputError('');
    }, []);

    // Open inline edit card for existing template — prefer staged edit, fold legacy → text
    const handleStartEdit = useCallback((t: ProviderNoteTemplate) => {
        const source = stagedEdits.get(t.id) ?? t;
        setEditCard({
            id: source.id,
            name: source.name,
            isNew: false,
            hpiText: mergeLegacyText(source.hpiExpanderAbbrs, source.hpiExpanderAbbr, source.hpiText),
            peBlockKeys: source.peBlockKeys ?? [],
            assessText: mergeLegacyText(source.assessmentExpanderAbbrs, source.assessmentExpanderAbbr, source.assessmentText),
            planText: resolveLegacyPlanText(source, orderSets),
        });
    }, [stagedEdits, orderSets]);

    // Accept edit card — stage the change
    const handleEditCardAccept = useCallback(() => {
        if (!editCard) return;
        const entry: ProviderNoteTemplate = {
            id: editCard.id,
            name: editCard.name,
            hpiText: editCard.hpiText || undefined,
            peBlockKeys: editCard.peBlockKeys.length > 0 ? editCard.peBlockKeys : undefined,
            assessmentText: editCard.assessText || undefined,
            planText: editCard.planText || undefined,
        };

        if (editCard.isNew) {
            setStagedAdds(prev => [...prev, entry]);
        } else {
            setStagedEdits(prev => {
                const next = new Map(prev);
                next.set(entry.id, entry);
                return next;
            });
        }
        setEditCard(null);
    }, [editCard]);

    const handleEditCardCancel = useCallback(() => {
        setEditCard(null);
    }, []);

    const handleEditCardDelete = useCallback(() => {
        if (!editCard || editCard.isNew) return;
        // Stage deletion + drop any staged edit for this id
        setStagedDeletes(prev => new Set(prev).add(editCard.id));
        setStagedEdits(prev => {
            if (!prev.has(editCard.id)) return prev;
            const next = new Map(prev);
            next.delete(editCard.id);
            return next;
        });
        setEditCard(null);
    }, [editCard]);

    // ── Render ──

    const totalCount = templates.length + stagedAdds.length - stagedDeletes.size;
    const hasItems = templates.length > 0 || stagedAdds.length > 0;

    const peColors = useMemo(() => getColorClasses('routine'), []);

    return (
        <div className="h-full overflow-y-auto" data-tour="settings-provider-templates">
            <div className="px-5 py-4 space-y-5">
                <p className="text-xs text-tertiary leading-relaxed">
                    Compose note skeletons using the same editors as the Provider drawer. Apply them to pre-fill fields.
                </p>

                <section className="space-y-3">
                    <div className="flex items-center gap-2">
                        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Templates</p>
                        <span className="text-[9pt] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium">
                            {totalCount}
                        </span>
                    </div>

                    {/* ── Inline edit card ── */}
                    <div className={`overflow-hidden transition-all duration-300 ease-out ${
                        editCard ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0'
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
                                        className="w-full bg-transparent outline-none text-base font-semibold text-primary placeholder:text-tertiary"
                                        autoFocus
                                    />
                                </div>

                                {/* HPI */}
                                <Section
                                    label="History of Present Illness"
                                    value={editCard.hpiText}
                                    onChange={(v) => setEditCard({ ...editCard, hpiText: v })}
                                    expanders={expanders}
                                    placeholder="Chief complaint, onset, duration, character, associated symptoms…"
                                />

                                {/* PE — real PhysicalExam component in template mode */}
                                <div className="px-4 py-3.5 space-y-2">
                                    <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Physical Exam</p>
                                    <PhysicalExam
                                        key={`pe-${editCard.id}`}
                                        initialText=""
                                        initialState={null}
                                        onChange={() => { /* template persists blockKeys only — "all normal on apply" */ }}
                                        colors={peColors}
                                        symptomCode="A-1"
                                        mode="template"
                                        templateBlockKeys={editCard.peBlockKeys}
                                        onBlockKeysChange={(keys) =>
                                            setEditCard(s => s ? { ...s, peBlockKeys: keys } : s)
                                        }
                                        expanders={expanders}
                                    />
                                </div>

                                {/* Assessment */}
                                <Section
                                    label="Assessment"
                                    value={editCard.assessText}
                                    onChange={(v) => setEditCard({ ...editCard, assessText: v })}
                                    expanders={expanders}
                                    placeholder="Clinical assessment, diagnosis, differential…"
                                />

                                {/* Plan — real Plan component */}
                                <div className="px-4 py-3.5 space-y-2">
                                    <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Plan</p>
                                    <Plan
                                        key={`plan-${editCard.id}`}
                                        orderTags={orderTags}
                                        instructionTags={instructionTags}
                                        orderSets={orderSets}
                                        initialText={editCard.planText}
                                        onChange={(text) =>
                                            setEditCard(s => s ? { ...s, planText: text } : s)
                                        }
                                        expanders={expanders}
                                    />
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-end gap-1.5 px-4 py-2.5">
                                    {!editCard.isNew && (
                                        <button
                                            type="button"
                                            onClick={handleEditCardDelete}
                                            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-themeredred hover:bg-themeredred/10 active:scale-95 transition-all mr-auto"
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
                                            className="w-full bg-transparent outline-none text-sm text-primary px-3.5 py-2.5 rounded-full min-w-0 placeholder:text-tertiary"
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
                                            <p className="text-[9pt] text-tertiary mt-0.5">{fieldPreview(t)}</p>
                                        </div>
                                    </div>
                                ))}

                                {templates.map(orig => {
                                    const edited = stagedEdits.get(orig.id);
                                    const t = edited ?? orig;
                                    const isMarkedDelete = stagedDeletes.has(orig.id);
                                    const isMarkedEdit = !!edited;
                                    const isOpenInEditor = !!editCard && !editCard.isNew && editCard.id === orig.id;
                                    const isTourTemplate = orig.id.startsWith(PROVIDER_TOUR_TEMPLATE_PREFIX);

                                    const handleClick = editing
                                        ? isMarkedDelete
                                            ? () => handleToggleDelete(orig.id)
                                            : () => handleStartEdit(orig)
                                        : () => handleStartEdit(orig);

                                    return (
                                        <div
                                            key={orig.id}
                                            data-tour={isTourTemplate ? 'provider-demo-template' : undefined}
                                            onClick={handleClick}
                                            className={`flex items-start py-2.5 px-2 rounded-lg transition-colors ${
                                                isMarkedDelete
                                                    ? 'ring-1 ring-inset ring-themeredred/30 bg-themeredred/5 cursor-pointer active:scale-[0.98]'
                                                    : isOpenInEditor
                                                        ? 'ring-1 ring-inset ring-themeblue3/40 bg-themeblue3/5'
                                                        : isMarkedEdit
                                                            ? 'ring-1 ring-inset ring-themeblue2/30 bg-themeblue2/5 cursor-pointer active:scale-[0.98]'
                                                            : 'cursor-pointer active:scale-[0.98]'
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className={`text-sm font-medium truncate ${
                                                        isMarkedDelete ? 'text-themeredred/60 line-through' : 'text-primary'
                                                    }`}>{t.name}</p>
                                                    {isMarkedEdit && !isMarkedDelete && (
                                                        <span className="text-[9pt] md:text-[9pt] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-themeblue2/15 text-themeblue2 shrink-0">
                                                            Edited
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={`text-[9pt] mt-0.5 ${
                                                    isMarkedDelete ? 'text-themeredred/30' : 'text-tertiary'
                                                }`}>
                                                    {fieldPreview(t)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-tertiary py-4 text-center">
                                No templates configured
                            </p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};
