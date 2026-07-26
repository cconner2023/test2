import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Check, X, User, Building2, Plus } from 'lucide-react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useAuthStore } from '../../stores/useAuthStore';
import { useEditableClinicContent } from '../../Hooks/useEditableClinicContent';
import type { UserTypes, PlanBlockKey, PlanOrderSet, PlanOrderTags } from '../../Data/User';
import { PLAN_ORDER_CATEGORIES } from '../../Data/User';
import { PreviewOverlay } from '../PreviewOverlay';
import { SearchInput } from '@/Components/primitives/SearchInput';
import { TextInput } from '@/Components/primitives/FormInputs';
import { ActionButton } from '@/Components/primitives/ActionButton';
import { PlanAllBlocksPreview } from '../PlanBlockPreview';
import { CATEGORY_META, PlanTagManager } from './PlanTagManager';
import { OrderSetManager } from './OrderSetManager';
import { useClusterEditItem } from './ClusterEditPicker';
import { useNoteBlocksTransferItems } from './NoteBlocksTransferMenu';
import { useNoteBlocksTransfer } from '../../Hooks/useNoteBlocksTransfer';
import { FooterPill } from '@/Components/primitives/FooterPill'
import { OverlayHeaderMenu } from '@/Components/primitives/OverlayHeaderMenu';
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu';

const ALL_KEYS: PlanBlockKey[] = [...PLAN_ORDER_CATEGORIES, 'instructions'];
const EMPTY_TAGS: PlanOrderTags = { referral: [], meds: [], radiology: [], lab: [], followUp: [] };

type Scope = 'personal' | 'clinic';

type TagPopover =
    | { mode: 'edit'; anchor: DOMRect; key: PlanBlockKey; original: string; isClinic: boolean }
    | { mode: 'new'; anchor: DOMRect };

type OrderSetPopover =
    | { mode: 'edit'; anchor: DOMRect; orderSet: PlanOrderSet; isClinic: boolean }
    | { mode: 'new'; anchor: DOMRect };

export const PlanPanel = () => {
    const { profile, updateProfile, syncProfileField } = useUserProfile();
    const transfer = useNoteBlocksTransfer();
    const isSupervisorRole = useAuthStore(s => s.isSupervisorRole);
    const homeClinicId = useAuthStore(s => s.clinicId);
    const [editingClinicId, setEditingClinicId] = useState<string | null>(homeClinicId);
    const { content: clinicContent, update: updateClinicContent } = useEditableClinicContent(editingClinicId);
    const clinicPlanOrderTags = clinicContent.planOrderTags;
    const clinicPlanInstructionTags = clinicContent.planInstructionTags;
    const clinicPlanOrderSets = clinicContent.planOrderSets;
    const clinicId = editingClinicId;

    // Normalize per-key — older saved shapes can omit a category (e.g. followUp),
    // and a missing key would throw "not iterable" when spread below.
    const planOrderTags = useMemo<PlanOrderTags>(() => {
        const p = profile.planOrderTags;
        return {
            referral:  p?.referral  ?? [],
            meds:      p?.meds      ?? [],
            radiology: p?.radiology ?? [],
            lab:       p?.lab       ?? [],
            followUp:  p?.followUp  ?? [],
        };
    }, [profile.planOrderTags]);
    const planInstructionTags = profile.planInstructionTags ?? [];
    const planOrderSets = profile.planOrderSets ?? [];

    // Merged display lists — every viewer sees personal + clinic, with provenance
    const activePlanOrderTags = useMemo<PlanOrderTags>(() => {
        const c = clinicPlanOrderTags;
        return {
            referral:  [...new Set([...(c?.referral  ?? []), ...planOrderTags.referral])],
            meds:      [...new Set([...(c?.meds      ?? []), ...planOrderTags.meds])],
            radiology: [...new Set([...(c?.radiology ?? []), ...planOrderTags.radiology])],
            lab:       [...new Set([...(c?.lab       ?? []), ...planOrderTags.lab])],
            followUp:  [...new Set([...(c?.followUp  ?? []), ...planOrderTags.followUp])],
        };
    }, [clinicPlanOrderTags, planOrderTags]);

    const activePlanInstructionTags = useMemo(() =>
        [...new Set([...(clinicPlanInstructionTags ?? []), ...planInstructionTags])],
        [clinicPlanInstructionTags, planInstructionTags]
    );

    const activePlanOrderSets = useMemo(() =>
        [...(clinicPlanOrderSets ?? []), ...planOrderSets],
        [clinicPlanOrderSets, planOrderSets]
    );

    const clinicOrderSetIds = useMemo(() =>
        new Set((clinicPlanOrderSets ?? []).map(s => s.id)),
        [clinicPlanOrderSets]
    );

    const clinicTagSets = useMemo<Record<string, Set<string>>>(() => {
        const c = clinicPlanOrderTags;
        return {
            referral:     new Set(c?.referral  ?? []),
            meds:         new Set(c?.meds      ?? []),
            radiology:    new Set(c?.radiology ?? []),
            lab:          new Set(c?.lab       ?? []),
            followUp:     new Set(c?.followUp  ?? []),
            instructions: new Set(clinicPlanInstructionTags ?? []),
        };
    }, [clinicPlanOrderTags, clinicPlanInstructionTags]);

    // ── Persistence ────────────────────────────────────────────────

    const writePersonal = useCallback((updates: Partial<UserTypes>) => {
        updateProfile(updates);
        const dbFields: Record<string, unknown> = {};
        if (updates.planOrderTags !== undefined)        dbFields.plan_order_tags = updates.planOrderTags;
        if (updates.planInstructionTags !== undefined)  dbFields.plan_instruction_tags = updates.planInstructionTags;
        if (updates.planOrderSets !== undefined)        dbFields.plan_order_sets = updates.planOrderSets;
        syncProfileField(dbFields);
    }, [updateProfile, syncProfileField]);

    const writeClinic = useCallback((updates: { planOrderTags?: PlanOrderTags; planInstructionTags?: string[]; planOrderSets?: PlanOrderSet[] }) => {
        if (!clinicId) return;
        updateClinicContent(updates);
    }, [clinicId, updateClinicContent]);

    const mutateTags = useCallback((scope: Scope, key: PlanBlockKey, fn: (current: string[]) => string[]) => {
        if (scope === 'clinic') {
            if (key === 'instructions') {
                writeClinic({ planInstructionTags: fn(clinicPlanInstructionTags ?? []) });
            } else {
                const base = clinicPlanOrderTags ?? EMPTY_TAGS;
                writeClinic({ planOrderTags: { ...base, [key]: fn(base[key] ?? []) } });
            }
        } else {
            if (key === 'instructions') {
                writePersonal({ planInstructionTags: fn(planInstructionTags) });
            } else {
                writePersonal({ planOrderTags: { ...planOrderTags, [key]: fn(planOrderTags[key] ?? []) } });
            }
        }
    }, [clinicPlanInstructionTags, clinicPlanOrderTags, planInstructionTags, planOrderTags, writeClinic, writePersonal]);

    const cascadeRenameInSets = (sets: PlanOrderSet[], key: PlanBlockKey, original: string, next: string) =>
        sets.map(os => {
            const presets = os.presets[key];
            if (!presets || !presets.includes(original)) return os;
            return { ...os, presets: { ...os.presets, [key]: presets.map(t => t === original ? next : t) } };
        });

    const cascadeDeleteFromSets = (sets: PlanOrderSet[], key: PlanBlockKey, tag: string) =>
        sets.map(os => {
            const presets = os.presets[key];
            if (!presets || !presets.includes(tag)) return os;
            const remaining = presets.filter(t => t !== tag);
            const nextPresets = { ...os.presets };
            if (remaining.length > 0) nextPresets[key] = remaining;
            else delete nextPresets[key];
            return { ...os, presets: nextPresets };
        });

    // Batch add — appends every novel tag in one mutateTags pass (one write /
    // one sync), skipping blanks, in-batch dupes, and any already present.
    const addTags = useCallback((scope: Scope, key: PlanBlockKey, tags: string[]) => {
        const clean = [...new Set(tags.map(t => t.trim()).filter(Boolean))];
        if (clean.length === 0) return;
        mutateTags(scope, key, (cur) => {
            const have = new Set(cur);
            const add = clean.filter(t => !have.has(t));
            return add.length > 0 ? [...cur, ...add] : cur;
        });
    }, [mutateTags]);

    const renameTag = useCallback((scope: Scope, key: PlanBlockKey, original: string, next: string) => {
        if (original === next) return;
        mutateTags(scope, key, (cur) => cur.map(t => t === original ? next : t));
        if (scope === 'clinic') {
            writeClinic({ planOrderSets: cascadeRenameInSets(clinicPlanOrderSets ?? [], key, original, next) });
        } else {
            writePersonal({ planOrderSets: cascadeRenameInSets(planOrderSets, key, original, next) });
        }
    }, [mutateTags, clinicPlanOrderSets, planOrderSets, writeClinic, writePersonal]);

    const deleteTag = useCallback((scope: Scope, key: PlanBlockKey, tag: string) => {
        mutateTags(scope, key, (cur) => cur.filter(t => t !== tag));
        if (scope === 'clinic') {
            writeClinic({ planOrderSets: cascadeDeleteFromSets(clinicPlanOrderSets ?? [], key, tag) });
        } else {
            writePersonal({ planOrderSets: cascadeDeleteFromSets(planOrderSets, key, tag) });
        }
    }, [mutateTags, clinicPlanOrderSets, planOrderSets, writeClinic, writePersonal]);

    // Batch delete — resolve each tag's scope, then commit ONE write per scope
    // (tags + instructions + order-set cascade folded together) instead of the
    // 2·N writes/syncs a per-item loop would fire.
    const deleteTags = useCallback((items: Array<{ key: PlanBlockKey; tag: string }>) => {
        if (items.length === 0) return;
        const personalByKey = new Map<PlanBlockKey, Set<string>>();
        const clinicByKey = new Map<PlanBlockKey, Set<string>>();
        for (const { key, tag } of items) {
            const isClinic = clinicTagSets[key]?.has(tag) ?? false;
            const bucket = isClinic ? clinicByKey : personalByKey;
            (bucket.get(key) ?? bucket.set(key, new Set()).get(key)!).add(tag);
        }

        const commit = (
            byKey: Map<PlanBlockKey, Set<string>>,
            baseOrderTags: PlanOrderTags,
            baseInstr: string[],
            baseSets: PlanOrderSet[],
            write: (u: { planOrderTags?: PlanOrderTags; planInstructionTags?: string[]; planOrderSets?: PlanOrderSet[] }) => void,
        ) => {
            if (byKey.size === 0) return;
            let nextOrderTags = baseOrderTags;
            let nextInstr = baseInstr;
            let sets = baseSets;
            let touchedOrderTags = false;
            for (const [key, tags] of byKey) {
                if (key === 'instructions') {
                    nextInstr = nextInstr.filter(t => !tags.has(t));
                } else {
                    nextOrderTags = { ...nextOrderTags, [key]: (nextOrderTags[key] ?? []).filter(t => !tags.has(t)) };
                    touchedOrderTags = true;
                }
                for (const tag of tags) sets = cascadeDeleteFromSets(sets, key, tag);
            }
            const updates: { planOrderTags?: PlanOrderTags; planInstructionTags?: string[]; planOrderSets?: PlanOrderSet[] } = { planOrderSets: sets };
            if (touchedOrderTags) updates.planOrderTags = nextOrderTags;
            if (byKey.has('instructions')) updates.planInstructionTags = nextInstr;
            write(updates);
        };

        commit(personalByKey, planOrderTags, planInstructionTags, planOrderSets, writePersonal);
        commit(clinicByKey, clinicPlanOrderTags ?? EMPTY_TAGS, clinicPlanInstructionTags ?? [], clinicPlanOrderSets ?? [], writeClinic);
    }, [clinicTagSets, planOrderTags, planInstructionTags, planOrderSets, clinicPlanOrderTags, clinicPlanInstructionTags, clinicPlanOrderSets, writePersonal, writeClinic]);

    const upsertOrderSet = useCallback((scope: Scope, set: PlanOrderSet) => {
        if (scope === 'clinic') {
            const cur = clinicPlanOrderSets ?? [];
            const exists = cur.some(s => s.id === set.id);
            writeClinic({ planOrderSets: exists ? cur.map(s => s.id === set.id ? set : s) : [...cur, set] });
        } else {
            const exists = planOrderSets.some(s => s.id === set.id);
            writePersonal({ planOrderSets: exists ? planOrderSets.map(s => s.id === set.id ? set : s) : [...planOrderSets, set] });
        }
    }, [clinicPlanOrderSets, planOrderSets, writeClinic, writePersonal]);

    const deleteOrderSet = useCallback((scope: Scope, id: string) => {
        if (scope === 'clinic') {
            writeClinic({ planOrderSets: (clinicPlanOrderSets ?? []).filter(s => s.id !== id) });
        } else {
            writePersonal({ planOrderSets: planOrderSets.filter(s => s.id !== id) });
        }
    }, [clinicPlanOrderSets, planOrderSets, writeClinic, writePersonal]);

    // ── Popover state ──────────────────────────────────────────────
    const [tagPopover, setTagPopover] = useState<TagPopover | null>(null);
    const [orderSetPopover, setOrderSetPopover] = useState<OrderSetPopover | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // ── Consolidated corner ⋯ actions (cluster picker + Share/Export/Import) ──
    const clusterItem = useClusterEditItem({ selectedClinicId: editingClinicId, onSelect: setEditingClinicId });
    const { items: transferItems, overlays: transferOverlays } = useNoteBlocksTransferItems({
        baseName: 'order sets',
        kind: 'orderSets',
        data: { planOrderSets, planOrderTags, planInstructionTags },
        hasData: planOrderSets.length > 0 || planInstructionTags.length > 0 || Object.values(planOrderTags).some(v => v.length > 0),
    });
    const orderSetCornerItems = [...(clusterItem ? [clusterItem] : []), ...transferItems];

    return (
        <>
            <div className="px-3 pb-2 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
                <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search order sets and tags..."
                />
            </div>
            <div className="px-5 py-4 space-y-5">
                    <p className="text-[10pt] text-tertiary leading-relaxed">
                        Manage order tags and order sets for the plan section of your notes.
                        {(clinicPlanOrderTags || (clinicPlanOrderSets?.length ?? 0) > 0) && (
                            <span className="text-tertiary"> Includes cluster-wide items.</span>
                        )}
                    </p>

                    <OrderSetManager
                        orderSets={activePlanOrderSets}
                        clinicOrderSetIds={clinicOrderSetIds}
                        isSupervisorRole={isSupervisorRole}
                        filter={searchQuery}
                        onTapRow={(os, anchor) => setOrderSetPopover({
                            mode: 'edit',
                            anchor: anchor.getBoundingClientRect(),
                            orderSet: os,
                            isClinic: clinicOrderSetIds.has(os.id),
                        })}
                        onTapNew={(anchor) => setOrderSetPopover({ mode: 'new', anchor: anchor.getBoundingClientRect() })}
                        onShareItem={(os) => transfer.share({ planOrderSets: [os] }, os.name)}
                        onDeleteItem={(os) => deleteOrderSet(clinicOrderSetIds.has(os.id) ? 'clinic' : 'personal', os.id)}
                        cornerItems={orderSetCornerItems}
                    />

                    <PlanTagManager
                        orderTags={activePlanOrderTags}
                        instructionTags={activePlanInstructionTags}
                        clinicTagSets={clinicTagSets}
                        isSupervisorRole={isSupervisorRole}
                        filter={searchQuery}
                        onTapTag={(key, tag, anchor) => setTagPopover({
                            mode: 'edit',
                            anchor: anchor.getBoundingClientRect(),
                            key,
                            original: tag,
                            isClinic: clinicTagSets[key]?.has(tag) ?? false,
                        })}
                        onTapNew={(anchor) => setTagPopover({ mode: 'new', anchor: anchor.getBoundingClientRect() })}
                        onShareItem={(key, tag) => transfer.share(tagToData(key, tag), tag)}
                        onDeleteItem={(key, tag) => deleteTag((clinicTagSets[key]?.has(tag) ?? false) ? 'clinic' : 'personal', key, tag)}
                        onDeleteMany={deleteTags}
                    />
            </div>

            <TagEditPopover
                state={tagPopover}
                onClose={() => setTagPopover(null)}
                isSupervisorRole={!!isSupervisorRole}
                hasClinic={!!clinicId}
                onSubmitMany={(scope, key, tags) => { addTags(scope, key, tags); setTagPopover(null); }}
                onRename={(scope, key, original, next) => { renameTag(scope, key, original, next); setTagPopover(null); }}
            />

            <OrderSetEditPopover
                state={orderSetPopover}
                onClose={() => setOrderSetPopover(null)}
                allOrderTags={activePlanOrderTags}
                allInstructionTags={activePlanInstructionTags}
                isSupervisorRole={!!isSupervisorRole}
                hasClinic={!!clinicId}
                onSave={(scope, set) => { upsertOrderSet(scope, set); setOrderSetPopover(null); }}
            />

            {transfer.picker}
            {transferOverlays}
        </>
    );
};

/** Build a single-tag note-blocks payload — instructions land in their own list,
 *  every other category goes under planOrderTags keyed by category. */
function tagToData(key: PlanBlockKey, tag: string): { planOrderTags?: PlanOrderTags; planInstructionTags?: string[] } {
    if (key === 'instructions') return { planInstructionTags: [tag] };
    return { planOrderTags: { ...EMPTY_TAGS, [key]: [tag] } };
}

// ── Tag edit / new popover ─────────────────────────────────────────

function TagEditPopover({ state, onClose, isSupervisorRole, hasClinic, onSubmitMany, onRename }: {
    state: TagPopover | null;
    onClose: () => void;
    isSupervisorRole: boolean;
    hasClinic: boolean;
    onSubmitMany: (scope: Scope, key: PlanBlockKey, tags: string[]) => void;
    onRename: (scope: Scope, key: PlanBlockKey, original: string, next: string) => void;
}) {
    // New mode builds an array (one row per tag); edit mode is a single row.
    const [values, setValues] = useState<string[]>(['']);
    const [category, setCategory] = useState<PlanBlockKey>('meds');
    const [scope, setScope] = useState<Scope>('personal');
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const focusIdxRef = useRef<number | null>(null);
    const supervisorScopeAvailable = isSupervisorRole && hasClinic;

    useEffect(() => {
        if (!state) return;
        if (state.mode === 'edit') {
            setValues([state.original]);
            setCategory(state.key);
            setScope(state.isClinic ? 'clinic' : 'personal');
        } else {
            setValues(['']);
            setCategory('meds');
            setScope('personal');
        }
    }, [state]);

    // Focus a freshly-appended row once it renders.
    useEffect(() => {
        const idx = focusIdxRef.current;
        if (idx == null) return;
        focusIdxRef.current = null;
        requestAnimationFrame(() => inputRefs.current[idx]?.focus());
    }, [values.length]);

    const isOpen = !!state;
    const isEdit = state?.mode === 'edit';
    const original = isEdit ? (state as Extract<TagPopover, { mode: 'edit' }>).original : '';

    // Trimmed, de-duped, blank-free — the array Save commits.
    const cleaned = useMemo(() => [...new Set(values.map(v => v.trim()).filter(Boolean))], [values]);
    const lastFilled = values[values.length - 1]?.trim().length > 0;
    const canSave = isEdit
        ? (!!cleaned[0] && cleaned[0] !== original)
        : cleaned.length > 0;

    const setValueAt = (i: number, v: string) =>
        setValues(prev => prev.map((x, idx) => (idx === i ? v : x)));
    const addRow = () => setValues(prev => { focusIdxRef.current = prev.length; return [...prev, '']; });
    const removeRow = (i: number) =>
        setValues(prev => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

    const handleSave = () => {
        if (!state || !canSave) return;
        if (state.mode === 'edit') {
            onRename(scope, state.key, state.original, cleaned[0]);
        } else {
            onSubmitMany(scope, category, cleaned);
        }
    };

    const editMeta = isEdit ? CATEGORY_META[(state as Extract<TagPopover, { mode: 'edit' }>).key] : null;
    const placeholder = isEdit ? editMeta?.label ?? 'Tag' : CATEGORY_META[category].label;
    const scopeLabel = scope === 'clinic' ? 'Cluster' : 'Personal';
    const newTitle = supervisorScopeAvailable
        ? `New ${scopeLabel} ${CATEGORY_META[category].label}`
        : `New ${CATEGORY_META[category].label}`;
    const editTitle = isEdit ? `Edit ${editMeta?.label ?? ''} tag` : newTitle;

    // Modifiers (category + scope) → header ellipsis; only on new (category/scope
    // are fixed when editing). Footer carries the primary commit (Save, right).
    const modifierItems: ContextMenuItem[] = [];
    if (!isEdit) {
        modifierItems.push({
            key: 'category',
            label: CATEGORY_META[category].label,
            icon: CATEGORY_META[category].icon,
            submenu: ALL_KEYS.map(k => ({
                key: k,
                label: CATEGORY_META[k].label,
                icon: CATEGORY_META[k].icon,
                selected: k === category,
                onAction: () => setCategory(k),
            })),
        });
        if (supervisorScopeAvailable) {
            modifierItems.push({
                key: 'scope',
                label: scope === 'clinic' ? 'Cluster' : 'Personal',
                icon: scope === 'clinic' ? Building2 : User,
                submenu: [
                    { key: 'personal', label: 'Personal', icon: User, selected: scope === 'personal', onAction: () => setScope('personal') },
                    { key: 'clinic', label: 'Cluster', icon: Building2, selected: scope === 'clinic', onAction: () => setScope('clinic') },
                ],
            });
        }
    }

    return (
        <PreviewOverlay
            isOpen={isOpen}
            onClose={onClose}
            anchorRect={state?.anchor ?? null}
            title={editTitle}
            maxWidth={360}
            headerActions={<OverlayHeaderMenu items={modifierItems} />}
            // Left footer — "Add additional" appends a shapeable row for the next
            // tag. Rendered only once the current last row has content (no dimmed
            // dead-end, no stacked blanks); the array grows one non-empty row at a time.
            footer={!isEdit && lastFilled ? (
                <FooterPill>
                    <ActionButton icon={Plus} label="Add additional" onClick={addRow} />
                </FooterPill>
            ) : undefined}
            rightFooter={
                <FooterPill side="right">
                    <ActionButton
                        icon={Check}
                        label="Save"
                        variant={canSave ? 'confirm' : 'disabled'}
                        onClick={handleSave}
                    />
                </FooterPill>
            }
        >
            {isEdit ? (
                <div className="flex items-center gap-2 px-3 py-2">
                    {editMeta && (
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${editMeta.bg}`}>
                            <editMeta.icon size={14} className={editMeta.color} />
                        </div>
                    )}
                    <input
                        autoFocus
                        type="text"
                        value={values[0] ?? ''}
                        onChange={(e) => setValueAt(0, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
                        placeholder={placeholder}
                        className="flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm min-w-0"
                    />
                </div>
            ) : (
                <div className="py-1">
                    {values.map((val, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                            <input
                                autoFocus={i === 0}
                                ref={(el) => { inputRefs.current[i] = el; }}
                                type="text"
                                value={val}
                                onChange={(e) => setValueAt(i, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key !== 'Enter') return;
                                    e.preventDefault();
                                    // Enter builds the list: a filled last row spawns the
                                    // next; otherwise it commits.
                                    if (i === values.length - 1 && val.trim()) addRow();
                                    else handleSave();
                                }}
                                placeholder={placeholder}
                                className="flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm min-w-0"
                            />
                            {values.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeRow(i)}
                                    className="shrink-0 p-1 text-tertiary active:text-themeredred transition-colors"
                                    aria-label="Remove"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </PreviewOverlay>
    );
}

// ── Order set edit / new popover ───────────────────────────────────

function OrderSetEditPopover({
    state, onClose, allOrderTags, allInstructionTags, isSupervisorRole, hasClinic,
    onSave,
}: {
    state: OrderSetPopover | null;
    onClose: () => void;
    allOrderTags: PlanOrderTags;
    allInstructionTags: string[];
    isSupervisorRole: boolean;
    hasClinic: boolean;
    onSave: (scope: Scope, set: PlanOrderSet) => void;
}) {
    const [name, setName] = useState('');
    const [presets, setPresets] = useState<Partial<Record<PlanBlockKey, string[]>>>({});
    const [scope, setScope] = useState<Scope>('personal');
    const idRef = useRef<string>('');
    const supervisorScopeAvailable = isSupervisorRole && hasClinic;

    useEffect(() => {
        if (!state) return;
        if (state.mode === 'edit') {
            setName(state.orderSet.name);
            setPresets(JSON.parse(JSON.stringify(state.orderSet.presets)));
            setScope(state.isClinic ? 'clinic' : 'personal');
            idRef.current = state.orderSet.id;
        } else {
            setName('');
            setPresets({});
            setScope('personal');
            idRef.current = crypto.randomUUID();
        }
    }, [state]);

    const isOpen = !!state;
    const isEdit = state?.mode === 'edit';
    const trimmed = name.trim();
    const canSave = !!trimmed;

    const togglePreset = useCallback((key: PlanBlockKey, tag: string) => {
        setPresets(prev => {
            const current = prev[key] ?? [];
            const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
            const nextMap = { ...prev };
            if (next.length > 0) nextMap[key] = next;
            else delete nextMap[key];
            return nextMap;
        });
    }, []);

    const allFor = useCallback((key: PlanBlockKey) =>
        key === 'instructions' ? allInstructionTags : (allOrderTags[key] ?? []),
        [allOrderTags, allInstructionTags]
    );

    const categories = useMemo(() => ALL_KEYS.map(key => ({
        key,
        label: CATEGORY_META[key].label,
        tags: allFor(key),
        state: { status: 'active' as const, selectedTags: presets[key] ?? [], freeText: '' },
    })), [allFor, presets]);

    const selectedFlat = useMemo(() =>
        ALL_KEYS.flatMap(key => (presets[key] ?? []).map(tag => ({ catKey: key, tag }))),
        [presets]
    );

    const buildCurrentSet = (): PlanOrderSet => {
        const cleaned: Partial<Record<PlanBlockKey, string[]>> = {};
        for (const k of ALL_KEYS) {
            const v = presets[k];
            if (v && v.length > 0) cleaned[k] = v;
        }
        return { id: idRef.current, name: trimmed, presets: cleaned };
    };

    const handleSave = () => {
        if (!canSave) return;
        onSave(scope, buildCurrentSet());
    };

    const osTitle = isEdit ? 'Edit order set' : 'New order set';

    // Scope modifier → header ellipsis (new + supervisor only). Primary commit
    // (Save) rides the bottom-right footer.
    const modifierItems: ContextMenuItem[] = [];
    if (!isEdit && supervisorScopeAvailable) {
        modifierItems.push({
            key: 'scope',
            label: scope === 'clinic' ? 'Cluster' : 'Personal',
            icon: scope === 'clinic' ? Building2 : User,
            submenu: [
                { key: 'personal', label: 'Personal', icon: User, selected: scope === 'personal', onAction: () => setScope('personal') },
                { key: 'clinic', label: 'Cluster', icon: Building2, selected: scope === 'clinic', onAction: () => setScope('clinic') },
            ],
        });
    }

    return (
        <PreviewOverlay
            isOpen={isOpen}
            onClose={onClose}
            anchorRect={state?.anchor ?? null}
            title={osTitle}
            maxWidth={520}
            previewMaxHeight="40dvh"
            searchPlaceholder="Search tags"
            preview={(filter, clearFilter) => (
                <div>
                    {/* Sits on the PreviewOverlay card surface — a distinct bg here
                        reads as a second, standalone search bar under the real one. */}
                    <div className="sticky top-0 z-10 bg-themewhite3">
                        <TextInput
                            value={name}
                            onChange={setName}
                            placeholder="Name (e.g. URI Basic)"
                        />
                    </div>
                    {selectedFlat.length > 0 && (
                        <div className="border-b border-primary/6">
                            <div className="px-4 pt-3 pb-1">
                                <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest">
                                    Selected
                                </p>
                            </div>
                            <div className="px-4 pb-2">
                                {selectedFlat.map(({ catKey, tag }) => (
                                    <div key={`${catKey}-${tag}`} className="flex items-center gap-2 py-1">
                                        <span className="flex-1 text-sm text-primary break-words min-w-0">{tag}</span>
                                        <button
                                            type="button"
                                            onClick={() => togglePreset(catKey, tag)}
                                            className="shrink-0 p-1 text-tertiary active:text-themeredred transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <PlanAllBlocksPreview
                        categories={categories}
                        filter={filter}
                        onToggleTag={(catKey, tag) => { togglePreset(catKey as PlanBlockKey, tag); clearFilter(); }}
                        activeTab={null}
                    />
                </div>
            )}
            headerActions={<OverlayHeaderMenu items={modifierItems} />}
            rightFooter={
                <FooterPill side="right">
                    <ActionButton
                        icon={Check}
                        label="Save"
                        variant={canSave ? 'confirm' : 'disabled'}
                        onClick={handleSave}
                    />
                </FooterPill>
            }
        />
    );
}
