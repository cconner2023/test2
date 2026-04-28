import { useState, useCallback, useEffect } from 'react';
import { Trash2, Check, User, Building2, TextCursorInput, Layers } from 'lucide-react';
import type { TextExpander } from '../../Data/User';
import type { TemplateNode } from '../../Data/TemplateTypes';
import type { FieldInfo } from '../../Utilities/templateParser';
import { templateNodesToFieldText, parseFieldText, isFlatTemplate } from '../../Utilities/templateParser';
import { TemplateBuilder } from './TemplateBuilder';
import { FieldTextEditor } from './FieldTextEditor';
import { ActionButton } from '../ActionButton';
import { PreviewOverlay } from '../PreviewOverlay';
import { ActionPill } from '../ActionPill'
import { TextInput } from '../FormInputs';

export type ExpanderScope = 'personal' | 'clinic';

export type TextExpanderEditState =
    | { mode: 'new'; type: 'simple' | 'template'; anchor: DOMRect | null; source: ExpanderScope; seed?: TextExpander }
    | { mode: 'edit'; expander: TextExpander; anchor: DOMRect | null; source: ExpanderScope };

interface Props {
    state: TextExpanderEditState | null;
    existingAbbrs: string[];
    isSupervisorRole?: boolean;
    onClose: () => void;
    onSave: (expander: TextExpander, source: ExpanderScope, originalAbbr?: string, originalSource?: ExpanderScope) => void;
    onDelete?: (abbr: string) => void;
}

const initialModeFromState = (state: TextExpanderEditState | null): 'simple' | 'template' => {
    if (!state) return 'simple';
    if (state.mode === 'new') return state.type;
    const tpl = state.expander.template;
    if (tpl && tpl.length > 0 && !isFlatTemplate(tpl)) return 'template';
    return 'simple';
};

export const TextExpanderEditPopover = ({
    state, existingAbbrs, isSupervisorRole = false, onClose, onSave, onDelete,
}: Props) => {
    const isOpen = !!state;
    const isNew = state?.mode === 'new';
    const editing = state?.mode === 'edit' ? state.expander : null;
    const originalSource = state?.source ?? 'personal';

    const [abbr, setAbbr] = useState('');
    const [mode, setMode] = useState<'simple' | 'template'>('simple');
    const [source, setSource] = useState<ExpanderScope>('personal');
    const [expansion, setExpansion] = useState('');
    const [fields, setFields] = useState<Record<string, FieldInfo>>({});
    const [templateNodes, setTemplateNodes] = useState<TemplateNode[]>([]);
    const [abbrError, setAbbrError] = useState('');

    // Re-seed every time the popover opens with a new state
    useEffect(() => {
        if (!state) return;
        const seed = state.mode === 'edit'
            ? state.expander
            : state.seed ?? { abbr: '', expansion: '' };
        const flatResult = seed.template?.length && isFlatTemplate(seed.template)
            ? templateNodesToFieldText(seed.template)
            : null;
        setAbbr(seed.abbr ?? '');
        setMode(initialModeFromState(state));
        setSource(state.source);
        setExpansion(flatResult?.text ?? seed.expansion ?? '');
        setFields(flatResult?.fields ?? {});
        setTemplateNodes(seed.template ?? []);
        setAbbrError('');
    }, [state]);

    // Tour: progressively fill expansion + fields when build events arrive
    useEffect(() => {
        const handler = (e: Event) => {
            const build = (e as CustomEvent).detail as { expansion: string; fields: Record<string, FieldInfo> } | null;
            if (!build) return;
            setExpansion(build.expansion);
            setFields({ ...build.fields });
        };
        window.addEventListener('tour:expander-detail-build', handler);
        return () => window.removeEventListener('tour:expander-detail-build', handler);
    }, []);

    const handleSave = useCallback(() => {
        if (!state) return;
        const trimmed = abbr.trim();
        if (!trimmed) { setAbbrError('Abbreviation required'); return; }
        if (/\s/.test(trimmed)) { setAbbrError('No spaces allowed'); return; }

        // Self-exclusion only applies when staying in the same scope; on promotion
        // the original abbr should still trigger a duplicate against itself.
        const selfAbbr = (!isNew && source === originalSource) ? (editing?.abbr ?? '') : '';
        const otherAbbrs = existingAbbrs
            .filter(a => a.toLowerCase() !== selfAbbr.toLowerCase())
            .map(a => a.toLowerCase());
        if (otherAbbrs.includes(trimmed.toLowerCase())) {
            setAbbrError('Abbreviation already exists');
            return;
        }

        if (mode === 'simple' && !expansion.trim()) return;
        if (mode === 'template' && templateNodes.length === 0) return;

        let entry: TextExpander;
        if (mode === 'template') {
            entry = { abbr: trimmed, expansion: '', template: templateNodes };
        } else {
            const hasFields = Object.keys(fields).some(
                label => expansion.includes(`[${label}]`),
            );
            if (hasFields) {
                const nodes = parseFieldText(expansion, fields);
                entry = { abbr: trimmed, expansion: '', template: nodes };
            } else {
                entry = { abbr: trimmed, expansion: expansion.trim() };
            }
        }

        onSave(entry, source, isNew ? undefined : editing?.abbr, isNew ? undefined : originalSource);
    }, [state, abbr, mode, source, originalSource, expansion, fields, templateNodes, existingAbbrs, editing, isNew, onSave]);

    const saveDisabled = mode === 'simple'
        ? !expansion.trim() || !abbr.trim()
        : templateNodes.length === 0 || !abbr.trim();

    const titleText = isNew
        ? (mode === 'template' ? 'New template' : 'New shortcut')
        : (mode === 'template' ? 'Edit template' : 'Edit shortcut');

    return (
        <PreviewOverlay
            isOpen={isOpen}
            onClose={onClose}
            anchorRect={state?.anchor ?? null}
            title={titleText}
            maxWidth={560}
            previewMaxHeight="60dvh"
            footer={
                <div data-tour="expander-edit-accept" className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
                    {!isNew && onDelete && editing && (
                        <ActionButton
                            icon={Trash2}
                            label="Delete"
                            variant="danger"
                            onClick={() => onDelete(editing.abbr)}
                        />
                    )}
                    <ActionButton
                        icon={Check}
                        label="Save"
                        variant={saveDisabled ? 'disabled' : 'success'}
                        onClick={saveDisabled ? () => {} : handleSave}
                    />
                </div>
            }
            rightFooter={
                <ActionPill>
                    {isSupervisorRole && (() => {
                        const isClinic = source === 'clinic';
                        const ScopeIcon = isClinic ? Building2 : User;
                        return (
                            <button
                                type="button"
                                onClick={() => setSource(isClinic ? 'personal' : 'clinic')}
                                aria-label={isClinic ? 'Clinic shortcut — tap for personal' : 'Personal shortcut — tap for clinic'}
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                                    isClinic ? 'bg-themeblue2 text-white' : 'bg-themeblue2/8 text-primary'
                                }`}
                            >
                                <ScopeIcon size={14} />
                            </button>
                        );
                    })()}
                    <button
                        type="button"
                        onClick={() => setMode('simple')}
                        aria-label="Simple shortcut"
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                            mode === 'simple' ? 'bg-themeblue2 text-white' : 'bg-themeblue2/8 text-primary'
                        }`}
                    >
                        <TextCursorInput size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('template')}
                        aria-label="Template shortcut"
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                            mode === 'template' ? 'bg-themeblue2 text-white' : 'bg-themeblue2/8 text-primary'
                        }`}
                    >
                        <Layers size={14} />
                    </button>
                </ActionPill>
            }
        >
            <div data-tour="expander-edit-card" className="px-4 pb-3 space-y-3">
                {/* ── Title input ── */}
                <TextInput
                    value={abbr}
                    onChange={(v) => { setAbbr(v); setAbbrError(''); }}
                    placeholder="e.g. htn, sob, cva"
                    hint={abbrError || null}
                />


                {/* ── Content editor ── */}
                {mode === 'simple' ? (
                    <div className="rounded-xl bg-themewhite2 px-3 py-2.5">
                        <FieldTextEditor
                            value={expansion}
                            onChange={setExpansion}
                            fields={fields}
                            onFieldsChange={setFields}
                            placeholder="Text that replaces the shortcut..."
                        />
                    </div>
                ) : (
                    <TemplateBuilder
                        nodes={templateNodes}
                        onChange={setTemplateNodes}
                    />
                )}
            </div>
        </PreviewOverlay>
    );
};
