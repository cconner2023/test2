import { useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Check, X, User, Building2, Plus, Trash2, CheckSquare, ListChecks, Tag } from 'lucide-react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useAuthStore } from '../../stores/useAuthStore';
import { useEditableClinicContent } from '../../Hooks/useEditableClinicContent';
import type { UserTypes, PlanBlockKey, PlanOrderSet, PlanOrderTags } from '../../Data/User';
import { PLAN_ORDER_CATEGORIES } from '../../Data/User';
import type { CardMorphHost } from '@/Components/primitives/OverlayStack';
import { PillButton } from '@/Components/primitives/HeaderPill';
import { SearchInput } from '@/Components/primitives/SearchInput';
import { TextInput } from '@/Components/primitives/FormInputs';
import { PlanAllBlocksPreview } from '../PlanBlockPreview';
import { CATEGORY_META, PlanTagManager, tagSelKey } from './PlanTagManager';
import { OrderSetManager } from './OrderSetManager';
import { ContentStack, useRowMenu, itemMenuItems } from './contentPrimitives';
import { usePublishHeaderActions } from './panelHeaderSlot';
import { HeaderMenuPill } from '@/Components/primitives/HeaderMenuPill';
import { OverlayHeaderMenu } from '@/Components/primitives/OverlayHeaderMenu';
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog';
import { EmptyState } from '@/Components/primitives/EmptyState';
import { exportOrderSetsCSV, exportPlanCSV } from '../../Utilities/noteBlocksCSV';
import { useClusterEditItem } from './ClusterEditPicker';
import { useNoteBlocksTransferItems } from './NoteBlocksTransferMenu';
import { useNoteBlocksTransfer } from '../../Hooks/useNoteBlocksTransfer';
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu';
import { parseMedTag, composeMedTag, planTagDisplay } from '@/Utilities/medTag';
import { ListGroupLabel } from '@/Components/primitives/Section';

const ALL_KEYS: PlanBlockKey[] = [...PLAN_ORDER_CATEGORIES, 'instructions'];
const EMPTY_TAGS: PlanOrderTags = { referral: [], meds: [], radiology: [], lab: [], followUp: [] };

type Scope = 'personal' | 'clinic';

type TagPopover =
    | { mode: 'edit'; key: PlanBlockKey; original: string; isClinic: boolean }
    | { mode: 'new' };

type OrderSetPopover =
    | { mode: 'edit'; orderSet: PlanOrderSet; isClinic: boolean }
    | { mode: 'new' };

/** Plan content: order sets + plan tags.
 *
 *  Header (published to the container): Add [New order set, New tag, Multiselect]
 *  and ⋯ [cluster, share, export, import]. Tapping a row lifts it with its item
 *  menu. Editors are PaneStack — a Sheet on mobile; `cardHost` (desktop Settings)
 *  morphs them into the subpage card's slot. */
export const PlanPanel = ({ cardHost }: { cardHost?: CardMorphHost } = {}) => {
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
    const deleteMany = useCallback((items: Array<{ key: PlanBlockKey; tag: string }>, setIds: Set<string>) => {
        if (items.length === 0 && setIds.size === 0) return;
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
            const dropSets = baseSets.some(os => setIds.has(os.id));
            if (byKey.size === 0 && !dropSets) return;
            let nextOrderTags = baseOrderTags;
            let nextInstr = baseInstr;
            let sets = dropSets ? baseSets.filter(os => !setIds.has(os.id)) : baseSets;
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
    const [viewSet, setViewSet] = useState<PlanOrderSet | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const rowMenu = useRowMenu();

    const isClinicSet = useCallback((os: PlanOrderSet) => clinicOrderSetIds.has(os.id), [clinicOrderSetIds]);
    const canEditSet = useCallback((os: PlanOrderSet) => !isClinicSet(os) || !!isSupervisorRole, [isClinicSet, isSupervisorRole]);
    const isClinicTag = useCallback((key: PlanBlockKey, tag: string) => clinicTagSets[key]?.has(tag) ?? false, [clinicTagSets]);
    const canEditTag = useCallback((key: PlanBlockKey, tag: string) => !isClinicTag(key, tag) || !!isSupervisorRole, [isClinicTag, isSupervisorRole]);

    const editSet = useCallback((os: PlanOrderSet) =>
        setOrderSetPopover({ mode: 'edit', orderSet: os, isClinic: isClinicSet(os) }), [isClinicSet]);
    const setActions = useCallback((os: PlanOrderSet, withOpen: boolean) => itemMenuItems({
        canEdit: canEditSet(os),
        onOpen: withOpen ? () => setViewSet(os) : undefined,
        onEdit: () => { setViewSet(null); editSet(os); },
        onShare: () => transfer.share({ planOrderSets: [os] }, os.name),
        onExport: () => exportOrderSetsCSV([os]),
        onDelete: () => { setViewSet(null); deleteOrderSet(isClinicSet(os) ? 'clinic' : 'personal', os.id); },
    }), [canEditSet, editSet, transfer, deleteOrderSet, isClinicSet]);
    const tagActions = useCallback((key: PlanBlockKey, tag: string) => itemMenuItems({
        canEdit: canEditTag(key, tag),
        onEdit: () => setTagPopover({ mode: 'edit', key, original: tag, isClinic: isClinicTag(key, tag) }),
        onShare: () => transfer.share(tagToData(key, tag), tag),
        onExport: () => { const d = tagToData(key, tag); exportPlanCSV({ orderTags: d.planOrderTags, instructionTags: d.planInstructionTags, base: 'plan-tag' }); },
        onDelete: () => deleteTag(isClinicTag(key, tag) ? 'clinic' : 'personal', key, tag),
    }), [canEditTag, isClinicTag, transfer, deleteTag]);

    // ── Multiselect (sets + tags together) ─────────────────────────
    const [selectMode, setSelectMode] = useState(false);
    const [selectedSets, setSelectedSets] = useState<Set<string>>(new Set());
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
    const [confirmDelete, setConfirmDelete] = useState(false);
    const exitSelect = useCallback(() => { setSelectMode(false); setSelectedSets(new Set()); setSelectedTags(new Set()); }, []);
    const toggleIn = (set: Set<string>, k: string) => { const n = new Set(set); n.has(k) ? n.delete(k) : n.add(k); return n; };
    const selectedTagItems = useMemo(() =>
        ALL_KEYS.flatMap(key => (key === 'instructions' ? activePlanInstructionTags : activePlanOrderTags[key] ?? [])
            .filter(tag => selectedTags.has(tagSelKey(key, tag)))
            .map(tag => ({ key, tag }))),
        [activePlanOrderTags, activePlanInstructionTags, selectedTags]);
    const selectedCount = selectedSets.size + selectedTagItems.length;
    const hasEditable = activePlanOrderSets.some(canEditSet)
        || ALL_KEYS.some(key => (key === 'instructions' ? activePlanInstructionTags : activePlanOrderTags[key] ?? []).some(t => canEditTag(key, t)));

    // ── Container header: Add + ⋯ (cluster picker + Share/Export/Import) ──
    const clusterItem = useClusterEditItem({ selectedClinicId: editingClinicId, onSelect: setEditingClinicId });
    const { items: transferItems, overlays: transferOverlays } = useNoteBlocksTransferItems({
        baseName: 'order sets',
        kind: 'orderSets',
        cardHost,
        data: { planOrderSets, planOrderTags, planInstructionTags },
        hasData: planOrderSets.length > 0 || planInstructionTags.length > 0 || Object.values(planOrderTags).some(v => v.length > 0),
    });
    const addItems: ContextMenuItem[] = [
        { key: 'new-set', label: 'New order set', icon: ListChecks, onAction: () => setOrderSetPopover({ mode: 'new' }) },
        { key: 'new-tag', label: 'New tag', icon: Tag, onAction: () => setTagPopover({ mode: 'new' }) },
        ...(hasEditable ? [{ key: 'multiselect', label: 'Multiselect', icon: CheckSquare, onAction: () => setSelectMode(true) }] : []),
    ];
    const moreItems: ContextMenuItem[] = [...(clusterItem ? [clusterItem] : []), ...transferItems];

    usePublishHeaderActions(selectMode ? (
        <>
            {selectedCount > 0 && (
                <PillButton icon={Trash2} iconSize={18} variant="danger" label={`Delete ${selectedCount}`} onClick={() => setConfirmDelete(true)} />
            )}
            <PillButton icon={Check} iconSize={18} label="Done" onClick={exitSelect} />
        </>
    ) : (
        <HeaderMenuPill icon={Plus} label="Add" items={addItems} />
    ), selectMode ? [] : moreItems);

    return (
        <>
            {/* The pane body owns its scroll (the desktop subpage card is `fill`). */}
            <div className="h-full overflow-y-auto overscroll-contain">
            <div className="px-3 pb-2 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
                <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search order sets and tags..."
                />
            </div>
            <div className="px-5 py-4 space-y-5">
                    <p className="text-[10pt] text-tertiary leading-relaxed">
                        {selectMode
                            ? 'Select order sets and tags to delete.'
                            : 'Manage order tags and order sets for the plan section of your notes.'}
                        {!selectMode && (clinicPlanOrderTags || (clinicPlanOrderSets?.length ?? 0) > 0) && (
                            <span className="text-tertiary"> Includes cluster-wide items.</span>
                        )}
                    </p>

                    <OrderSetManager
                        orderSets={activePlanOrderSets}
                        clinicOrderSetIds={clinicOrderSetIds}
                        isSupervisorRole={isSupervisorRole}
                        filter={searchQuery}
                        onTapRow={(os, el) => rowMenu.open(el, setActions(os, true))}
                        selectMode={selectMode}
                        selectedIds={selectedSets}
                        onToggleSelect={(os) => setSelectedSets(prev => toggleIn(prev, os.id))}
                    />

                    <PlanTagManager
                        orderTags={activePlanOrderTags}
                        instructionTags={activePlanInstructionTags}
                        clinicTagSets={clinicTagSets}
                        isSupervisorRole={isSupervisorRole}
                        filter={searchQuery}
                        onTapTag={(key, tag, el) => rowMenu.open(el, tagActions(key, tag))}
                        selectMode={selectMode}
                        selected={selectedTags}
                        onToggleSelect={(key, tag) => setSelectedTags(prev => toggleIn(prev, tagSelKey(key, tag)))}
                    />
            </div>
            </div>

            {rowMenu.node}

            <OrderSetView
                orderSet={viewSet}
                onClose={() => setViewSet(null)}
                items={viewSet ? setActions(viewSet, false) : []}
                cardHost={cardHost}
            />

            <TagEditPopover
                state={tagPopover}
                onClose={() => setTagPopover(null)}
                isSupervisorRole={!!isSupervisorRole}
                hasClinic={!!clinicId}
                onSubmitMany={(scope, key, tags) => { addTags(scope, key, tags); setTagPopover(null); }}
                onRename={(scope, key, original, next) => { renameTag(scope, key, original, next); setTagPopover(null); }}
                cardHost={cardHost}
            />

            <OrderSetEditPopover
                state={orderSetPopover}
                onClose={() => setOrderSetPopover(null)}
                allOrderTags={activePlanOrderTags}
                allInstructionTags={activePlanInstructionTags}
                isSupervisorRole={!!isSupervisorRole}
                hasClinic={!!clinicId}
                onSave={(scope, set) => { upsertOrderSet(scope, set); setOrderSetPopover(null); }}
                cardHost={cardHost}
            />

            <ConfirmDialog
                visible={confirmDelete}
                variant="danger"
                title={`Delete ${selectedCount} item${selectedCount === 1 ? '' : 's'}?`}
                subtitle={selectedTagItems.length > 0 ? "Deleted tags are also removed from any order sets that use them." : undefined}
                confirmLabel="Delete"
                onConfirm={() => {
                    deleteMany(selectedTagItems, selectedSets);
                    setConfirmDelete(false);
                    exitSelect();
                }}
                onCancel={() => setConfirmDelete(false)}
            />

            {transfer.picker}
            {transferOverlays}
        </>
    );
};

/** Read-only order set: its tags grouped by category. Item actions ride the ⋯. */
function OrderSetView({ orderSet, onClose, items, cardHost }: {
    orderSet: PlanOrderSet | null;
    onClose: () => void;
    items: ContextMenuItem[];
    cardHost?: CardMorphHost;
}) {
    return (
        <ContentStack
            isOpen={!!orderSet}
            onClose={onClose}
            initial={{ key: 'view' }}
            cardHost={cardHost}
            screens={{
                view: {
                    title: orderSet?.name ?? 'Order set',
                    headerLeft: <OverlayHeaderMenu items={items} align="left" />,
                    render: () => {
                        const keys = orderSet ? ALL_KEYS.filter(k => (orderSet.presets[k]?.length ?? 0) > 0) : [];
                        if (keys.length === 0) return <p className="text-[10pt] text-tertiary py-6 text-center">No tags in this order set</p>;
                        return (
                            <div className="pb-2">
                                {keys.map(k => (
                                    <div key={k}>
                                        <div className="border-b border-primary/6">
                                            <ListGroupLabel>{CATEGORY_META[k].label}</ListGroupLabel>
                                        </div>
                                        {orderSet!.presets[k]!.map(tag => (
                                            <p key={tag} className="px-4 py-2 text-sm text-primary break-words border-b border-primary/6 last:border-0">
                                                {planTagDisplay(k, tag)}
                                            </p>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        );
                    },
                },
            }}
        />
    );
}

/** Build a single-tag note-blocks payload — instructions land in their own list,
 *  every other category goes under planOrderTags keyed by category. */
function tagToData(key: PlanBlockKey, tag: string): { planOrderTags?: PlanOrderTags; planInstructionTags?: string[] } {
    if (key === 'instructions') return { planInstructionTags: [tag] };
    return { planOrderTags: { ...EMPTY_TAGS, [key]: [tag] } };
}

// ── Tag edit / new popover ─────────────────────────────────────────

/** Dispense count on a medication tag — the default handed out when the tag is
 *  used in a note. Blank means the tag carries no quantity at all. */
function QtyInput({ value, onChange, onEnter }: {
    value: string;
    onChange: (v: string) => void;
    onEnter: () => void;
}) {
    return (
        <span className="flex items-center gap-0.5 shrink-0 text-tertiary">
            <span className="text-sm">x</span>
            <input
                type="text"
                inputMode="numeric"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
                placeholder="Qty"
                className="w-12 bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm tabular-nums"
            />
        </span>
    );
}

/** Directions on a medication tag ("1 tab PO q8h PRN pain") — rendered into the
 *  note after the dispense count. Sits on its own line under the label row. */
function SigInput({ value, onChange, onEnter }: {
    value: string;
    onChange: (v: string) => void;
    onEnter: () => void;
}) {
    return (
        <div className="flex items-center gap-1.5 pl-1 text-tertiary">
            <span className="text-[9pt] font-semibold uppercase tracking-wider shrink-0">Sig</span>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
                placeholder="1 tab PO q8h PRN pain"
                className="flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm min-w-0"
            />
        </div>
    );
}

function TagEditPopover({ state, onClose, isSupervisorRole, hasClinic, onSubmitMany, onRename, cardHost }: {
    state: TagPopover | null;
    onClose: () => void;
    isSupervisorRole: boolean;
    hasClinic: boolean;
    onSubmitMany: (scope: Scope, key: PlanBlockKey, tags: string[]) => void;
    onRename: (scope: Scope, key: PlanBlockKey, original: string, next: string) => void;
    cardHost?: CardMorphHost;
}) {
    // New mode builds an array (one row per tag); edit mode is a single row.
    // Med rows carry a quantity and sig alongside the label — all three are
    // composed into one tag string on save, so `values` holds labels only.
    const [values, setValues] = useState<string[]>(['']);
    const [qtys, setQtys] = useState<string[]>(['']);
    const [sigs, setSigs] = useState<string[]>(['']);
    const [category, setCategory] = useState<PlanBlockKey>('meds');
    const [scope, setScope] = useState<Scope>('personal');
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const focusIdxRef = useRef<number | null>(null);
    const supervisorScopeAvailable = isSupervisorRole && hasClinic;

    useEffect(() => {
        if (!state) return;
        if (state.mode === 'edit') {
            const { label, qty, sig } = parseMedTag(state.original);
            const isMed = state.key === 'meds';
            setValues([isMed ? label : state.original]);
            setQtys([isMed && qty != null ? String(qty) : '']);
            setSigs([isMed && sig ? sig : '']);
            setCategory(state.key);
            setScope(state.isClinic ? 'clinic' : 'personal');
        } else {
            setValues(['']);
            setQtys(['']);
            setSigs(['']);
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

    // The category being authored — fixed when editing, picked from the header menu on new.
    const targetKey = isEdit ? (state as Extract<TagPopover, { mode: 'edit' }>).key : category;
    const isMedCategory = targetKey === 'meds';

    // Trimmed, de-duped, blank-free — the array Save commits. Med rows fold their
    // quantity and sig in here, so everything downstream still sees plain tag strings.
    const cleaned = useMemo(() => {
        const composed = values.map((v, i) => {
            const label = v.trim();
            if (!label) return '';
            if (!isMedCategory) return label;
            const n = Number.parseInt(qtys[i] ?? '', 10);
            return composeMedTag(label, Number.isFinite(n) ? n : null, sigs[i]);
        });
        return [...new Set(composed.filter(Boolean))];
    }, [values, qtys, sigs, isMedCategory]);
    const lastFilled = values[values.length - 1]?.trim().length > 0;
    const canSave = isEdit
        ? (!!cleaned[0] && cleaned[0] !== original)
        : cleaned.length > 0;

    const setValueAt = (i: number, v: string) =>
        setValues(prev => prev.map((x, idx) => (idx === i ? v : x)));
    const setQtyAt = (i: number, v: string) =>
        setQtys(prev => prev.map((x, idx) => (idx === i ? v.replace(/\D/g, '') : x)));
    const setSigAt = (i: number, v: string) =>
        setSigs(prev => prev.map((x, idx) => (idx === i ? v : x)));
    const addRow = () => {
        focusIdxRef.current = values.length;
        setValues(prev => [...prev, '']);
        setQtys(prev => [...prev, '']);
        setSigs(prev => [...prev, '']);
    };
    const removeRow = (i: number) => {
        if (values.length <= 1) return;
        setValues(prev => prev.filter((_, idx) => idx !== i));
        setQtys(prev => prev.filter((_, idx) => idx !== i));
        setSigs(prev => prev.filter((_, idx) => idx !== i));
    };

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
    // are fixed when editing). Save → header check.
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

    // Multi-add: the dashed EmptyState add-row under the latest row appends a row
    // for the next tag. Rendered only once that row has content (no dimmed dead-end,
    // no stacked blanks); the array grows one non-empty row at a time.
    const body = isEdit ? (
            <div className="px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-2">
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
                {isMedCategory && <QtyInput value={qtys[0] ?? ''} onChange={(v) => setQtyAt(0, v)} onEnter={handleSave} />}
            </div>
            {isMedCategory && <SigInput value={sigs[0] ?? ''} onChange={(v) => setSigAt(0, v)} onEnter={handleSave} />}
            </div>
        ) : (
            <div className="py-1">
                {values.map((val, i) => (
                    <div key={i} className={`px-3 py-1.5 space-y-1 ${isMedCategory && i > 0 ? 'border-t border-primary/6' : ''}`}>
                    <div className="flex items-center gap-2">
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
                        {isMedCategory && <QtyInput value={qtys[i] ?? ''} onChange={(v) => setQtyAt(i, v)} onEnter={handleSave} />}
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
                    {isMedCategory && <SigInput value={sigs[i] ?? ''} onChange={(v) => setSigAt(i, v)} onEnter={handleSave} />}
                    </div>
                ))}
                {lastFilled && (
                    <div className="px-3 pt-1 pb-2">
                        <EmptyState title="Add another" action={{ icon: Plus, label: 'Add another', onClick: addRow }} />
                    </div>
                )}
            </div>
        );

    // Save rides the header and renders only when usable; modifiers ride the ⋯.
    return (
        <ContentStack
            isOpen={isOpen}
            onClose={onClose}
            initial={{ key: 'edit' }}
            cardHost={cardHost}
            screens={{
                edit: {
                    title: editTitle,
                    headerLeft: <OverlayHeaderMenu items={modifierItems} align="left" />,
                    headerActions: canSave && <PillButton icon={Check} iconSize={18} accent="success" label="Save" onClick={handleSave} />,
                    render: () => body,
                },
            }}
        />
    );
}

// ── Order set edit / new popover ───────────────────────────────────

function OrderSetEditPopover({
    state, onClose, allOrderTags, allInstructionTags, isSupervisorRole, hasClinic,
    onSave, cardHost,
}: {
    state: OrderSetPopover | null;
    onClose: () => void;
    allOrderTags: PlanOrderTags;
    allInstructionTags: string[];
    isSupervisorRole: boolean;
    hasClinic: boolean;
    onSave: (scope: Scope, set: PlanOrderSet) => void;
    cardHost?: CardMorphHost;
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

    // Scope modifier → header ellipsis (new + supervisor only). Save → header check.
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

    const nameField = (
        <TextInput
            value={name}
            onChange={setName}
            placeholder="Name (e.g. URI Basic)"
        />
    );

    const renderList = (filter: string, clearFilter: () => void) => (
        <div>
            {selectedFlat.length > 0 && (
                <div className="border-b border-primary/6">
                    <ListGroupLabel>Selected</ListGroupLabel>
                    <div className="px-4 pb-2">
                        {selectedFlat.map(({ catKey, tag }) => (
                            <div key={`${catKey}-${tag}`} className="flex items-center gap-2 py-1">
                                <span className="flex-1 text-sm text-primary break-words min-w-0">{planTagDisplay(catKey, tag)}</span>
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
    );

    // The search is local to the body: picking a tag resets the filter.
    return (
        <ContentStack
            isOpen={isOpen}
            onClose={onClose}
            initial={{ key: 'edit' }}
            cardHost={cardHost}
            screens={{
                edit: {
                    title: osTitle,
                    headerLeft: <OverlayHeaderMenu items={modifierItems} align="left" />,
                    headerActions: canSave && <PillButton icon={Check} iconSize={18} accent="success" label="Save" onClick={handleSave} />,
                    render: () => <LocalSearch placeholder="Search tags" pinned={nameField}>{renderList}</LocalSearch>,
                },
            }}
        />
    );
}

/** Search row owned by the body, for editors whose filter must be clearable from
 *  inside (see OrderSetEditPopover). `pinned` sticks with it. */
function LocalSearch({ placeholder, pinned, children }: {
    placeholder: string;
    pinned?: ReactNode;
    children: (filter: string, clearFilter: () => void) => ReactNode;
}) {
    const [filter, setFilter] = useState('');
    return (
        <>
            <div className="sticky top-0 z-10 bg-themewhite3">
                <div className="px-3 py-2">
                    <SearchInput value={filter} onChange={setFilter} placeholder={placeholder} />
                </div>
                {pinned}
            </div>
            {children(filter, () => setFilter(''))}
        </>
    );
}
