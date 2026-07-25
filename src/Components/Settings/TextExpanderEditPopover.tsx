import { useState, useCallback, useEffect, useRef } from 'react';
import { Check, User, Building2, TextCursorInput, Layers } from 'lucide-react';
import type { TextExpander } from '../../Data/User';
import type { TemplateNode } from '../../Data/TemplateTypes';
import type { FieldInfo } from '../../Utilities/templateParser';
import { templateNodesToFieldText, parseFieldText, isFlatTemplate } from '../../Utilities/templateParser';
import {
    TemplateNodeList,
    AddStepFooter,
    makeTemplateScreens,
    makeNode,
    pathEq,
    type AddMenuState,
} from './TemplateBuilder';
import { FieldTextEditor, type FieldEditorHandle } from './FieldTextEditor';
import { InsertFieldForm, FieldInsertFooter, buildFieldInfo, emptyInsertDraft, type InsertDraft, type FieldType } from './InsertFieldButton';
import { ActionButton } from '@/Components/primitives/ActionButton';
import { OverlayStack, type StackNav } from '@/Components/primitives/OverlayStack';
import { FooterPill } from '@/Components/primitives/FooterPill'
import { OverlayHeaderMenu } from '@/Components/primitives/OverlayHeaderMenu';
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu';
import { TextInput } from '@/Components/primitives/FormInputs';

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
}

const initialModeFromState = (state: TextExpanderEditState | null): 'simple' | 'template' => {
    if (!state) return 'simple';
    if (state.mode === 'new') return state.type;
    const tpl = state.expander.template;
    if (tpl && tpl.length > 0 && !isFlatTemplate(tpl)) return 'template';
    return 'simple';
};

/**
 * TextExpanderEditPopover — the shortcut/template authoring surface. ONE OverlayStack
 * (the drill-down/morph primitive): the `shortcut` root screen holds the abbreviation
 * + the content editor (simple FieldTextEditor, or — in template mode — the inline
 * template node list). Tapping a template node DRILLS into the shared template screens
 * (`tpl-node` / `tpl-list`) on the SAME stack, instead of stacking a second overlay
 * over this one. See makeTemplateScreens in TemplateBuilder.
 */
export const TextExpanderEditPopover = ({
    state, existingAbbrs, isSupervisorRole = false, onClose, onSave,
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

    // Template drill-down: the stack nav (for async/handler-driven push) + the add
    // type-picker target. The node editor screens push onto this same stack.
    const navRef = useRef<StackNav | null>(null);
    const [addMenu, setAddMenu] = useState<AddMenuState>(null);

    // Simple-mode field insert: an IN-CARD panel (not an overlay, not a drill). The
    // editor stays mounted (CSS-hidden) so its caret survives; commit rides rightFooter.
    // The TYPE is chosen in the footer (FieldInsertFooter). Stages: idle → picking
    // (insertOpen, type=null, editor still shown) → form (type set, editor CSS-hidden).
    const fieldEditorRef = useRef<FieldEditorHandle>(null);
    const [insertOpen, setInsertOpen] = useState(false);
    const [insertDraft, setInsertDraft] = useState<InsertDraft>(emptyInsertDraft);
    const insertFormStage = insertOpen && insertDraft.type !== null;
    const openInsert = useCallback(() => { setInsertDraft(emptyInsertDraft); setInsertOpen(true); }, []);
    const pickInsertType = useCallback((t: FieldType) => setInsertDraft(d => ({ ...d, type: t })), []);
    const closeInsert = useCallback(() => { setInsertOpen(false); setInsertDraft(emptyInsertDraft); }, []);
    const commitInsert = useCallback(() => {
        const built = buildFieldInfo(insertDraft);
        if (!built) return;
        closeInsert();
        // Un-hide the editor first (closeInsert re-shows it), then place the pill on
        // the preserved caret on the next frame.
        requestAnimationFrame(() => fieldEditorRef.current?.insertField(built.label, built.field));
    }, [insertDraft, closeInsert]);

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
        setAddMenu(null);
        setInsertOpen(false);
        setInsertDraft(emptyInsertDraft);
    }, [state]);

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

    // Surface scope in the title when the author can choose it (supervisor),
    // mirroring Plan Tags' "New Cluster/Personal …" so it's clear whether the
    // shortcut being authored is personal or cluster-wide. Reacts live as the
    // scope submenu toggles.
    const scopeWord = source === 'clinic' ? 'Cluster' : 'Personal';
    const kindWord = mode === 'template' ? 'template' : 'shortcut';
    const titleText = isNew
        ? (isSupervisorRole ? `New ${scopeWord} ${kindWord}` : `New ${kindWord}`)
        : (isSupervisorRole ? `Edit ${scopeWord} ${kindWord}` : `Edit ${kindWord}`);

    // Modifiers (scope + type) live in the header ellipsis — lifted-row submenus,
    // not footer toggles. Footer stays focused on the primary commit (Save, right).
    const modifierItems: ContextMenuItem[] = [];
    if (isSupervisorRole) {
        modifierItems.push({
            key: 'scope',
            label: source === 'clinic' ? 'Cluster' : 'Personal',
            icon: source === 'clinic' ? Building2 : User,
            submenu: [
                { key: 'personal', label: 'Personal', icon: User, selected: source === 'personal', onAction: () => setSource('personal') },
                { key: 'clinic', label: 'Cluster', icon: Building2, selected: source === 'clinic', onAction: () => setSource('clinic') },
            ],
        });
    }
    modifierItems.push({
        key: 'type',
        label: mode === 'template' ? 'Template' : 'Simple',
        icon: mode === 'template' ? Layers : TextCursorInput,
        submenu: [
            { key: 'simple', label: 'Simple', icon: TextCursorInput, selected: mode === 'simple', onAction: () => setMode('simple') },
            { key: 'template', label: 'Template', icon: Layers, selected: mode === 'template', onAction: () => setMode('template') },
        ],
    });

    // Add a node at the root of the template, then drill into its editor. The
    // append is functional (atomic); the new node lands at the current length.
    const handleAddRoot = useCallback((type: TemplateNode['type']) => {
        setTemplateNodes(prev => [...prev, makeNode(type)]);
        setAddMenu(null);
        navRef.current?.push('tpl-node', { path: [], index: templateNodes.length });
    }, [templateNodes.length]);

    const templateScreens = makeTemplateScreens({
        nodes: templateNodes,
        onChange: setTemplateNodes,
        navRef,
        addMenu,
        setAddMenu,
    });

    const insertValid = !!buildFieldInfo(insertDraft);

    const screens = {
        shortcut: {
            // Insert flow (simple mode): tapping the footer `[ ]` engages type-PICKING
            // (editor still shown); picking a type enters the FORM stage — the whole
            // screen becomes "Insert field", ellipsis suppressed, Save→Insert, editor
            // CSS-hidden (never unmounted, so the caret survives). Back cancels.
            title: insertFormStage ? 'Insert field' : titleText,
            headerActions: insertOpen ? undefined : <OverlayHeaderMenu items={modifierItems} />,
            onBack: insertOpen ? () => closeInsert() : undefined,
            // Footer-LEFT: template Add / simple insert `[ ]` — both morph into their
            // type options in place (no overlay).
            footer: insertOpen ? (
                <FieldInsertFooter
                    open
                    type={insertDraft.type}
                    onStart={openInsert}
                    onPick={pickInsertType}
                    onCancel={closeInsert}
                />
            ) : mode === 'template' ? (
                <AddStepFooter
                    adding={!!addMenu && pathEq(addMenu.path, [])}
                    onStart={() => setAddMenu({ path: [] })}
                    onCancel={() => setAddMenu(null)}
                    onPick={handleAddRoot}
                />
            ) : (
                <FieldInsertFooter
                    open={false}
                    type={null}
                    onStart={openInsert}
                    onPick={pickInsertType}
                    onCancel={closeInsert}
                />
            ),
            rightFooter: insertFormStage ? (
                <FooterPill side="right">
                    <ActionButton
                        icon={Check}
                        label="Insert"
                        variant={insertValid ? 'confirm' : 'disabled'}
                        onClick={insertValid ? commitInsert : () => {}}
                    />
                </FooterPill>
            ) : (
                <FooterPill side="right">
                    <ActionButton
                        icon={Check}
                        label="Save"
                        variant={saveDisabled ? 'disabled' : 'confirm'}
                        onClick={saveDisabled ? () => {} : handleSave}
                    />
                </FooterPill>
            ),
            render: (_: unknown, nav: StackNav) => (
                <div className="px-4 pb-3 space-y-3">
                    <div className={insertFormStage ? 'hidden' : ''}>
                        <TextInput
                            value={abbr}
                            onChange={(v) => { setAbbr(v); setAbbrError(''); }}
                            placeholder="e.g. htn, sob, cva"
                            hint={abbrError || null}
                        />
                    </div>

                    {mode === 'simple' ? (
                        <>
                            <div className={`rounded-xl bg-themewhite2 px-3 py-2.5${insertFormStage ? ' hidden' : ''}`}>
                                <FieldTextEditor
                                    ref={fieldEditorRef}
                                    hidden={insertFormStage}
                                    value={expansion}
                                    onChange={setExpansion}
                                    fields={fields}
                                    onFieldsChange={setFields}
                                    placeholder="Text that replaces the shortcut..."
                                />
                            </div>
                            {insertFormStage && (
                                <InsertFieldForm draft={insertDraft} onChange={setInsertDraft} />
                            )}
                        </>
                    ) : (
                        <TemplateNodeList
                            nodes={templateNodes}
                            showFab={false}
                            emptyHint="No template steps yet — add one below."
                            onEdit={(index) => nav.push('tpl-node', { path: [], index })}
                            onAdd={() => setAddMenu({ path: [] })}
                        />
                    )}
                </div>
            ),
        },
        ...templateScreens,
    };

    return (
        <OverlayStack
            isOpen={isOpen}
            onClose={onClose}
            anchorRect={state?.anchor ?? null}
            initial={{ key: 'shortcut' }}
            screens={screens}
            maxWidth={560}
            previewMaxHeight="60dvh"
        />
    );
};
