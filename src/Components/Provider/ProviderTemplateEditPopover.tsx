import { useState, useEffect, useRef } from 'react';
import { Check, Trash2, ChevronRight } from 'lucide-react';
import { useMergedNoteContent } from '../../Hooks/useMergedNoteContent';
import { parsePlanState } from '../Plan';
import { PLAN_ORDER_LABELS } from '../../Data/User';
import type { ProviderNoteTemplate, PlanOrderSet } from '../../Data/User';
import type { PlanState } from '../../Types/PlanTypes';
import type { PEState, PEItemState } from '../../Types/PETypes';
import { usePEPaneScreens, PECenter, makeTemplatePEState } from './ProviderPESections';
import { usePlanPaneScreens } from './ProviderPlanSections';
import { ActionButton } from '@/Components/primitives/ActionButton';
import { PillButton } from '@/Components/primitives/HeaderPill';
import { OverlayHeaderMenu } from '@/Components/primitives/OverlayHeaderMenu';
import { OverlayStack, type StackNav, type StackScreen } from '@/Components/primitives/OverlayStack';
import { TextInput, TextArea } from '@/Components/primitives/FormInputs';
import { FooterPill } from '@/Components/primitives/FooterPill'

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
    /** Omit to hide the footer Delete — used where the host already offers delete
     *  (the provider drawer's template tree ellipsis). Settings passes it (no other
     *  delete affordance there). */
    onDelete?: (id: string) => void;
    /** Override the base z-index tier. Bump above the Templates Sheet
     *  (body portal at z-[1200]) when launched from the mobile picker; the
     *  nested PE/Plan overlays auto-bump above this via the overlay stack. */
    zIndex?: number;
}

/**
 * Shell-agnostic editor screens for the provider-template editor (name + HPI/PE/
 * Assessment/Plan, with PE + Plan as drill screens). Extracted so BOTH the
 * OverlayStack popover (mobile picker + Settings) AND the desktop right-pane
 * useStack surface (ProviderDrawer Case A) mount the identical editor — one source
 * of truth for the field state, save/delete, and the PE/Plan drills.
 *
 * Screen keys: `editor` (root) → drills to `pe` / `plan`. Compose these into a
 * larger `screens` map (the pane merges them with detail/section/output) — the keys
 * won't collide as long as the host namespaces its own screens.
 */
export function useProviderTemplateEditorScreens({
    state, onSave, onDelete,
}: {
    state: EditState | null;
    onSave: Props['onSave'];
    onDelete?: Props['onDelete'];
}): { screens: Record<string, StackScreen>; isOpen: boolean } {
    const { orderTags, instructionTags, orderSets } = useMergedNoteContent();
    const isOpen = !!state;
    const isEdit = state?.mode === 'edit';

    const [name, setName] = useState('');
    const [hpiText, setHpiText] = useState('');
    const [peBlockKeys, setPeBlockKeys] = useState<string[]>([]);
    const [peState, setPeState] = useState<PEState | null>(null);
    const [assessText, setAssessText] = useState('');
    const [planText, setPlanText] = useState('');
    const [planState, setPlanState] = useState<PlanState | null>(null);
    const idRef = useRef<string>('');

    useEffect(() => {
        if (!state) return;
        if (state.mode === 'edit') {
            const t = state.template;
            idRef.current = t.id;
            setName(t.name);
            setHpiText(mergeLegacyText(t.hpiExpanderAbbrs, t.hpiExpanderAbbr, t.hpiText));
            const peKeys = t.peBlockKeys ?? [];
            setPeBlockKeys(peKeys);
            // Seed findings from the template (legacy templates lack peItems → empty,
            // and apply/edit fall back to all-normal defaults per system).
            setPeState(peKeys.length ? makeTemplatePEState(peKeys, t.peItems ?? {}) : null);
            setAssessText(mergeLegacyText(t.assessmentExpanderAbbrs, t.assessmentExpanderAbbr, t.assessmentText));
            const resolvedPlan = resolveLegacyPlanText(t, orderSets);
            setPlanText(resolvedPlan);
            setPlanState(resolvedPlan ? parsePlanState(resolvedPlan, orderTags, instructionTags) : null);
        } else {
            idRef.current = crypto.randomUUID();
            setName('');
            setHpiText('');
            setPeBlockKeys([]);
            setPeState(null);
            setAssessText('');
            setPlanText('');
            setPlanState(null);
        }
    }, [state, orderSets, orderTags, instructionTags]);

    const trimmedName = name.trim();
    const canSave = !!trimmedName;

    const handleSave = () => {
        if (!canSave) return;
        // Persist findings only for systems the provider actually configured (normal
        // chips / abnormals / free text); untouched systems are omitted so apply
        // defaults them to all-normal (the prior template behavior).
        const configuredPeItems: Record<string, PEItemState> = {};
        if (peState) {
            for (const [key, item] of Object.entries(peState.items)) {
                if (item.status !== 'not-examined') configuredPeItems[key] = item;
            }
        }
        onSave({
            id: idRef.current,
            name: trimmedName,
            hpiText: hpiText || undefined,
            peBlockKeys: peBlockKeys.length > 0 ? peBlockKeys : undefined,
            peItems: Object.keys(configuredPeItems).length ? configuredPeItems : undefined,
            assessmentText: assessText || undefined,
            planText: planText || undefined,
        }, !isEdit);
    };

    const planLineCount = planText.trim() ? planText.split('\n').filter(l => l.trim()).length : 0;

    // PE + Plan reuse the drawer's OWN established pane flows, bound to TEMPLATE-local
    // state — never the note. onPeNoteChange is a no-op (the template stores peState,
    // not generated text); planText tracks the generated plan. keyPrefix='tmpl-'
    // namespaces the PE screen keys so the desktop pane can merge these alongside the
    // note-flow's own s-pe/s-pe-block without collision.
    // The PE flow's Accept/last-remove call onClose → we pop back to the cards screen
    // via the nav captured when it renders.
    const peNavRef = useRef<StackNav | null>(null);
    const { screens: pePaneScreens, reorder: reorderPe } = usePEPaneScreens({
        peState,
        selectedBlockKeys: peBlockKeys,
        onPeStateChange: setPeState,
        onBlockKeysChange: setPeBlockKeys,
        onPeNoteChange: () => { /* template stores peState, not note text */ },
        onClose: () => peNavRef.current?.pop(),
        keyPrefix: 'tmpl-',
    });
    const { screens: planPaneScreens, headerMenuItems: planMenuItems } = usePlanPaneScreens({
        planState,
        orderTags,
        instructionTags,
        orderSets,
        onPlanStateChange: setPlanState,
        onPlanNoteChange: setPlanText,
        onClose: () => { /* Done overridden per-screen to nav.pop */ },
    });

    // Drill screens close by popping back to the editor (not closing the overlay).
    const drillDone = (_: unknown, nav: StackNav) => (
        <PillButton icon={Check} iconSize={18} accent="success" label="Done" onClick={() => nav.pop()} />
    );

    // PE + Plan are drill-down screens of the same editor card; back pops to the
    // editor. They borrow the drawer's pane screens (render + state), override Done
    // to pop, and — since the OverlayStack shell ignores headerLeft — surface Plan's
    // Free text / Reset in headerActions via OverlayHeaderMenu (the text-expander
    // modifier-menu pattern), dropping the pane-only headerLeft.
    const screens: Record<string, StackScreen> = {
        editor: {
            title: isEdit ? 'Edit template' : 'New template',
            // Save rides the header as a Check pill (section-editor primitive); shown
            // only once the name qualifies (no dimmed/disabled actions).
            headerActions: canSave
                ? <PillButton icon={Check} iconSize={18} accent="success" label="Save" onClick={handleSave} />
                : null,
            footer: isEdit && onDelete ? (
                <FooterPill>
                    <ActionButton icon={Trash2} label="Delete" variant="danger" onClick={() => onDelete(idRef.current)} />
                </FooterPill>
            ) : undefined,
            render: (_: unknown, nav: StackNav) => (
                <div>
                    <TextInput value={name} onChange={setName} placeholder="Template name" />
                    <RowTextarea
                        label="HPI"
                        value={hpiText}
                        onChange={setHpiText}
                        placeholder="Chief complaint, onset, duration, character…"
                    />
                    <DrillRow
                        label="Physical Exam"
                        preview={peBlockKeys.length > 0 ? `${peBlockKeys.length} block${peBlockKeys.length === 1 ? '' : 's'}` : 'No blocks selected'}
                        onTap={() => nav.push('pe')}
                    />
                    <RowTextarea
                        label="Assessment"
                        value={assessText}
                        onChange={setAssessText}
                        placeholder="Clinical assessment, diagnosis, differential…"
                    />
                    <DrillRow
                        label="Plan"
                        preview={planLineCount > 0 ? `${planLineCount} line${planLineCount === 1 ? '' : 's'}` : 'No plan content'}
                        onTap={() => nav.push('plan')}
                    />
                </div>
            ),
        },
        // PE cards (selected systems) — the established detailed flow: add via the
        // selector, tap a card to edit that system's findings, drag to reorder.
        pe: {
            title: 'Physical Exam',
            maxWidth: 560,
            headerActions: drillDone,
            render: (_: unknown, nav: StackNav) => {
                peNavRef.current = nav;
                return (
                    <PECenter
                        selectedBlockKeys={peBlockKeys}
                        items={peState?.items ?? {}}
                        onOpenSelector={() => nav.push('tmpl-s-pe')}
                        onOpenBlock={(blockKey) => nav.push('tmpl-s-pe-block', { blockKey })}
                        onReorder={reorderPe}
                    />
                );
            },
        },
        'tmpl-s-pe': { ...pePaneScreens['tmpl-s-pe'], maxWidth: 560 },
        'tmpl-s-pe-block': { ...pePaneScreens['tmpl-s-pe-block'], maxWidth: 560 },
        plan: {
            ...planPaneScreens['s-plan'],
            title: 'Plan',
            maxWidth: 560,
            headerLeft: undefined, // overlay shell ignores it; menu moves to headerActions
            headerActions: (_: unknown, nav: StackNav) => (
                <>
                    <OverlayHeaderMenu items={planMenuItems} />
                    <PillButton icon={Check} iconSize={18} accent="success" label="Done" onClick={() => nav.pop()} />
                </>
            ),
        },
    };

    return { screens, isOpen };
}

/**
 * Lifted OverlayStack popover for the mobile Templates picker + Settings panel.
 * On desktop the ProviderDrawer mounts the same editor via the right-pane stack
 * (useProviderTemplateEditorScreens) instead of this floating popover.
 */
export function ProviderTemplateEditPopover({ state, onClose, onSave, onDelete, zIndex }: Props) {
    const { screens, isOpen } = useProviderTemplateEditorScreens({ state, onSave, onDelete });
    return (
        <OverlayStack
            isOpen={isOpen}
            onClose={onClose}
            initial={{ key: 'editor' }}
            screens={screens}
            maxWidth={520}
            previewMaxHeight="60dvh"
            zIndex={zIndex}
        />
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
            <TextArea
                bare
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                ariaLabel={label}
                inputClassName="w-full bg-transparent px-4 py-2 pb-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none min-h-[4rem] leading-5"
            />
        </label>
    );
}

// Drill row for PE / Plan — no icon; the label wears the same section-title style
// as RowTextarea (HPI / Assessment) so all four sections read as one stack.
function DrillRow({
    label, preview, onTap,
}: {
    label: string;
    preview: string;
    onTap: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onTap}
            className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-primary/6 last:border-b-0 active:bg-themeblue3/5 transition-colors"
        >
            <div className="flex-1 min-w-0">
                <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider">{label}</p>
                <p className="text-[10pt] text-primary/80 truncate mt-0.5">{preview}</p>
            </div>
            <ChevronRight size={14} className="text-tertiary shrink-0" />
        </button>
    );
}
