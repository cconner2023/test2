import { useState, useEffect, useMemo, useRef } from 'react';
import { Check, Trash2, ChevronRight, Stethoscope, ListChecks, Plus } from 'lucide-react';
import { useMergedNoteContent } from '../../Hooks/useMergedNoteContent';
import { getColorClasses } from '../../Utilities/ColorUtilities';
import { PhysicalExam } from '../PhysicalExam';
import { Plan } from '../Plan';
import { PLAN_ORDER_LABELS } from '../../Data/User';
import type { ProviderNoteTemplate, PlanOrderSet } from '../../Data/User';
import { ActionPill } from '../ActionPill';
import { ActionButton } from '../ActionButton';
import { PreviewOverlay } from '../PreviewOverlay';
import { TextInput } from '../FormInputs';
import { EmptyState } from '../EmptyState';

// ── Legacy → plain text resolution ──────────────────────────────────────────

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

export type EditState =
    | { mode: 'new'; anchor: DOMRect }
    | { mode: 'edit'; anchor: DOMRect; template: ProviderNoteTemplate };

interface Props {
    state: EditState | null;
    onClose: () => void;
    onSave: (entry: ProviderNoteTemplate, isNew: boolean) => void;
    onDelete: (id: string) => void;
    /** Override the base z-index tier. Bump above the Templates Sheet
     *  (body portal at z-[1200]) when launched from the mobile picker; the
     *  nested PE/Plan overlays auto-bump above this via the overlay stack. */
    zIndex?: number;
}

export function ProviderTemplateEditPopover({ state, onClose, onSave, onDelete, zIndex }: Props) {
    const { orderTags, instructionTags, orderSets } = useMergedNoteContent();
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

    // Auto-open the block picker when PE drill opens with no blocks selected.
    const [pePickerSignal, setPePickerSignal] = useState(0);
    const [pePickerAnchor, setPePickerAnchor] = useState<DOMRect | null>(null);

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

    const openPeDrill = (rect: DOMRect) => {
        setPeOpen(rect);
    };

    // Auto-open the block picker in a post-mount effect so PhysicalExam's
    // lastPickerSignalRef captures the OLD signal value on mount, then sees a
    // genuine change when we bump on the next render.
    useEffect(() => {
        if (!peOpen) return;
        if (peBlockKeys.length > 0) return;
        setPePickerAnchor(peOpen);
        setPePickerSignal(s => s + 1);
        // Intentionally only react to peOpen identity; peBlockKeys re-bumps are
        // user-driven via the explicit Add system button.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [peOpen]);

    return (
        <PreviewOverlay
            isOpen={isOpen}
            onClose={onClose}
            anchorRect={state?.anchor ?? null}
            title={isEdit ? 'Edit template' : 'New template'}
            maxWidth={520}
            previewMaxHeight="60dvh"
            zIndex={zIndex}
            footer={
                isEdit ? (
                    <ActionPill>
                        <ActionButton
                            icon={Trash2}
                            label="Delete"
                            variant="danger"
                            onClick={() => onDelete(idRef.current)}
                        />
                    </ActionPill>
                ) : undefined
            }
            rightFooter={
                <ActionPill>
                    <ActionButton
                        icon={Check}
                        label="Save"
                        variant={canSave ? 'success' : 'disabled'}
                        onClick={handleSave}
                    />
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
                    onTap={openPeDrill}
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
                rightFooter={
                    <ActionPill>
                        <ActionButton icon={Check} label="Done" variant="success" onClick={() => setPeOpen(null)} />
                    </ActionPill>
                }
            >
                <div className="px-3 py-3">
                    {/* Always-mounted PE — visibility-toggled so the picker stays alive
                        across the empty→populated transition. */}
                    <div
                        style={peBlockKeys.length > 0 ? undefined : { display: 'none' }}
                        aria-hidden={peBlockKeys.length === 0}
                    >
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
                            pickerOpenSignal={pePickerSignal}
                            pickerOpenAnchor={pePickerAnchor}
                        />
                    </div>
                    {peBlockKeys.length === 0 && (
                        <EmptyState
                            title="No systems selected"
                            action={{
                                icon: Plus,
                                label: 'Add system',
                                onClick: (anchor) => {
                                    setPePickerAnchor(anchor.getBoundingClientRect());
                                    setPePickerSignal(s => s + 1);
                                },
                            }}
                        />
                    )}
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
                rightFooter={
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
