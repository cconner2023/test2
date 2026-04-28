import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Check, Trash2, Plus, ChevronRight, Stethoscope, ListChecks } from 'lucide-react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useMergedNoteContent } from '../../Hooks/useMergedNoteContent';
import { getColorClasses } from '../../Utilities/ColorUtilities';
import { PhysicalExam } from '../PhysicalExam';
import { Plan } from '../Plan';
import { PLAN_ORDER_LABELS } from '../../Data/User';
import type { UserTypes, ProviderNoteTemplate, PlanOrderSet } from '../../Data/User';
import { PROVIDER_TOUR_TEMPLATE_PREFIX } from '../../Data/GuidedTourData';
import { ActionPill } from '../ActionPill';
import { ActionButton } from '../ActionButton';
import { PreviewOverlay } from '../PreviewOverlay';
import { TextInput } from '../FormInputs';

// ── Legacy → plain text resolution ──────────────────────────────────────────
// Existing templates may carry abbr arrays and planOrderSetId. Flatten on open
// so primitive inputs can round-trip them. New saves never write legacy fields.

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

function fieldPreview(t: ProviderNoteTemplate): string {
    const parts: string[] = [];
    if (t.hpiExpanderAbbrs?.length || t.hpiExpanderAbbr || t.hpiText) parts.push('HPI');
    if (t.peBlockKeys?.length) parts.push(`PE (${t.peBlockKeys.length})`);
    else if (t.peExpanderAbbrs?.length || t.peExpanderAbbr || t.peText) parts.push('PE');
    if (t.assessmentExpanderAbbrs?.length || t.assessmentExpanderAbbr || t.assessmentText) parts.push('Assess');
    if (t.planExpanderAbbrs?.length || t.planExpanderAbbr || t.planOrderSetId || t.planText) parts.push('Plan');
    return parts.join(' · ') || 'Empty';
}

// ── Popover state ───────────────────────────────────────────────────────────

type EditState =
    | { mode: 'new'; anchor: DOMRect }
    | { mode: 'edit'; anchor: DOMRect; template: ProviderNoteTemplate };

// ── Main panel ──────────────────────────────────────────────────────────────

export const ProviderTemplatesPanel = () => {
    const { profile, updateProfile, syncProfileField } = useUserProfile();
    const { orderTags, instructionTags, orderSets } = useMergedNoteContent();

    const templates = profile.providerNoteTemplates ?? [];

    const [editState, setEditState] = useState<EditState | null>(null);
    const fabRef = useRef<HTMLDivElement>(null);

    const handleUpdate = useCallback((next: ProviderNoteTemplate[]) => {
        updateProfile({ providerNoteTemplates: next });
        syncProfileField({ provider_note_templates: next as unknown as UserTypes['providerNoteTemplates'] });
    }, [updateProfile, syncProfileField]);

    const handleSave = useCallback((entry: ProviderNoteTemplate, isNew: boolean) => {
        const next = isNew
            ? [...templates, entry]
            : templates.map(t => t.id === entry.id ? entry : t);
        handleUpdate(next);
        setEditState(null);
    }, [templates, handleUpdate]);

    const handleDelete = useCallback((id: string) => {
        handleUpdate(templates.filter(t => t.id !== id));
        setEditState(null);
    }, [templates, handleUpdate]);

    return (
        <div className="h-full overflow-y-auto" data-tour="settings-provider-templates">
            <div className="px-5 py-4 space-y-5">
                <p className="text-[10pt] text-tertiary leading-relaxed">
                    Compose note skeletons with HPI, exam, assessment, and plan presets. Apply them to pre-fill fields.
                </p>

                <section className="space-y-3">
                    <div className="pb-2">
                        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Templates</p>
                    </div>

                    <div className="relative rounded-xl bg-themewhite2 overflow-hidden">
                        <div className="px-4 py-3">
                            {templates.length > 0 ? (
                                <div className="space-y-0.5">
                                    {templates.map(t => {
                                        const isTourTemplate = t.id.startsWith(PROVIDER_TOUR_TEMPLATE_PREFIX);
                                        return (
                                            <button
                                                key={t.id}
                                                type="button"
                                                data-tour={isTourTemplate ? 'provider-demo-template' : undefined}
                                                onClick={(e) => setEditState({
                                                    mode: 'edit',
                                                    anchor: e.currentTarget.getBoundingClientRect(),
                                                    template: t,
                                                })}
                                                className="w-full text-left py-2 px-2 rounded-lg cursor-pointer active:scale-[0.98] hover:bg-tertiary/5 transition-all"
                                            >
                                                <p className="text-sm font-medium text-primary truncate">{t.name}</p>
                                                <p className="text-[9pt] text-tertiary mt-0.5 pl-0.5 break-words">
                                                    {fieldPreview(t)}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-tertiary py-4 text-center">
                                    No templates configured
                                </p>
                            )}
                        </div>
                        <ActionPill ref={fabRef} shadow="sm" className="absolute top-2 right-2">
                            <ActionButton
                                icon={Plus}
                                label="New template"
                                onClick={() => fabRef.current && setEditState({
                                    mode: 'new',
                                    anchor: fabRef.current.getBoundingClientRect(),
                                })}
                            />
                        </ActionPill>
                    </div>
                </section>
            </div>

            <TemplateEditPopover
                state={editState}
                onClose={() => setEditState(null)}
                orderTags={orderTags}
                instructionTags={instructionTags}
                orderSets={orderSets}
                onSave={handleSave}
                onDelete={handleDelete}
            />
        </div>
    );
};

// ── Edit / new popover ──────────────────────────────────────────────────────

interface TemplateEditPopoverProps {
    state: EditState | null;
    onClose: () => void;
    orderTags: ReturnType<typeof useMergedNoteContent>['orderTags'];
    instructionTags: string[];
    orderSets: PlanOrderSet[];
    onSave: (entry: ProviderNoteTemplate, isNew: boolean) => void;
    onDelete: (id: string) => void;
}

function TemplateEditPopover({
    state, onClose, orderTags, instructionTags, orderSets, onSave, onDelete,
}: TemplateEditPopoverProps) {
    const isOpen = !!state;
    const isEdit = state?.mode === 'edit';

    const [name, setName] = useState('');
    const [hpiText, setHpiText] = useState('');
    const [peBlockKeys, setPeBlockKeys] = useState<string[]>([]);
    const [assessText, setAssessText] = useState('');
    const [planText, setPlanText] = useState('');
    const idRef = useRef<string>('');

    const [peOpen, setPeOpen] = useState<DOMRect | null>(null);
    const [planOpen, setPlanOpen] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (!state) return;
        if (state.mode === 'edit') {
            const t = state.template;
            idRef.current = t.id;
            setName(t.name);
            setHpiText(mergeLegacyText(t.hpiExpanderAbbrs, t.hpiExpanderAbbr, t.hpiText));
            setPeBlockKeys(t.peBlockKeys ?? []);
            setAssessText(mergeLegacyText(t.assessmentExpanderAbbrs, t.assessmentExpanderAbbr, t.assessmentText));
            setPlanText(resolveLegacyPlanText(t, orderSets));
        } else {
            idRef.current = crypto.randomUUID();
            setName('');
            setHpiText('');
            setPeBlockKeys([]);
            setAssessText('');
            setPlanText('');
        }
        setPeOpen(null);
        setPlanOpen(null);
    }, [state, orderSets]);

    const trimmedName = name.trim();
    const canSave = !!trimmedName;

    const handleSave = () => {
        if (!canSave) return;
        onSave({
            id: idRef.current,
            name: trimmedName,
            hpiText: hpiText || undefined,
            peBlockKeys: peBlockKeys.length > 0 ? peBlockKeys : undefined,
            assessmentText: assessText || undefined,
            planText: planText || undefined,
        }, !isEdit);
    };

    const peColors = useMemo(() => getColorClasses('routine'), []);
    const planLineCount = planText.trim() ? planText.split('\n').filter(l => l.trim()).length : 0;

    return (
        <PreviewOverlay
            isOpen={isOpen}
            onClose={onClose}
            anchorRect={state?.anchor ?? null}
            title={isEdit ? 'Edit template' : 'New template'}
            maxWidth={520}
            previewMaxHeight="60dvh"
            footer={
                <ActionPill>
                    <ActionButton
                        icon={Check}
                        label="Save"
                        variant={canSave ? 'success' : 'disabled'}
                        onClick={handleSave}
                    />
                    {isEdit && (
                        <ActionButton
                            icon={Trash2}
                            label="Delete"
                            variant="danger"
                            onClick={() => onDelete(idRef.current)}
                        />
                    )}
                </ActionPill>
            }
        >
            <div>
                <TextInput
                    value={name}
                    onChange={setName}
                    placeholder="Template name"
                />
                <RowTextarea
                    label="HPI"
                    value={hpiText}
                    onChange={setHpiText}
                    placeholder="Chief complaint, onset, duration, character…"
                />
                <DrillRow
                    icon={Stethoscope}
                    label="Physical Exam"
                    preview={peBlockKeys.length > 0 ? `${peBlockKeys.length} block${peBlockKeys.length === 1 ? '' : 's'}` : 'No blocks selected'}
                    onTap={(rect) => setPeOpen(rect)}
                />
                <RowTextarea
                    label="Assessment"
                    value={assessText}
                    onChange={setAssessText}
                    placeholder="Clinical assessment, diagnosis, differential…"
                />
                <DrillRow
                    icon={ListChecks}
                    label="Plan"
                    preview={planLineCount > 0 ? `${planLineCount} line${planLineCount === 1 ? '' : 's'}` : 'No plan content'}
                    onTap={(rect) => setPlanOpen(rect)}
                />
            </div>

            {/* ── Nested: Physical Exam ── */}
            <PreviewOverlay
                isOpen={!!peOpen}
                onClose={() => setPeOpen(null)}
                anchorRect={peOpen}
                title="Physical Exam"
                maxWidth={560}
                previewMaxHeight="60dvh"
                footer={
                    <ActionPill>
                        <ActionButton icon={Check} label="Done" variant="success" onClick={() => setPeOpen(null)} />
                    </ActionPill>
                }
            >
                <div className="px-3 py-3">
                    <PhysicalExam
                        key={`pe-${idRef.current}`}
                        initialText=""
                        initialState={null}
                        onChange={() => { /* template persists blockKeys only */ }}
                        colors={peColors}
                        symptomCode="A-1"
                        mode="template"
                        templateBlockKeys={peBlockKeys}
                        onBlockKeysChange={setPeBlockKeys}
                    />
                </div>
            </PreviewOverlay>

            {/* ── Nested: Plan ── */}
            <PreviewOverlay
                isOpen={!!planOpen}
                onClose={() => setPlanOpen(null)}
                anchorRect={planOpen}
                title="Plan"
                maxWidth={560}
                previewMaxHeight="60dvh"
                footer={
                    <ActionPill>
                        <ActionButton icon={Check} label="Done" variant="success" onClick={() => setPlanOpen(null)} />
                    </ActionPill>
                }
            >
                <div className="px-3 py-3">
                    <Plan
                        key={`plan-${idRef.current}`}
                        orderTags={orderTags}
                        instructionTags={instructionTags}
                        orderSets={orderSets}
                        initialText={planText}
                        onChange={setPlanText}
                    />
                </div>
            </PreviewOverlay>
        </PreviewOverlay>
    );
}

// ── Row primitives ──────────────────────────────────────────────────────────

function RowTextarea({
    label, value, onChange, placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    return (
        <label className="block border-b border-primary/6 last:border-b-0">
            <div className="px-4 pt-2.5 text-[9pt] font-semibold text-tertiary uppercase tracking-wider">
                {label}
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent px-4 py-2 pb-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none min-h-[4rem] leading-5"
            />
        </label>
    );
}

function DrillRow({
    icon: Icon, label, preview, onTap,
}: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    preview: string;
    onTap: (rect: DOMRect) => void;
}) {
    return (
        <button
            type="button"
            onClick={(e) => onTap(e.currentTarget.getBoundingClientRect())}
            className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-primary/6 last:border-b-0 active:bg-themeblue3/5 transition-colors"
        >
            <span className="w-7 h-7 rounded-full bg-themeblue2/15 text-themeblue2 flex items-center justify-center shrink-0">
                <Icon size={12} />
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-[10pt] font-medium text-primary truncate">{label}</p>
                <p className="text-[9pt] text-tertiary truncate">{preview}</p>
            </div>
            <ChevronRight size={14} className="text-tertiary shrink-0" />
        </button>
    );
}
