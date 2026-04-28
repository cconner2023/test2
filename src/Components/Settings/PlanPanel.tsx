import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Check, Trash2, X, User, Building2 } from 'lucide-react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useAuthStore } from '../../stores/useAuthStore';
import { updateClinicNoteContent } from '../../lib/supervisorService';
import type { UserTypes, PlanBlockKey, PlanOrderSet, PlanOrderTags } from '../../Data/User';
import { PLAN_ORDER_CATEGORIES } from '../../Data/User';
import { PreviewOverlay } from '../PreviewOverlay';
import { MobileSearchBar } from '../MobileSearchBar';
import { TextInput } from '../FormInputs';
import { ActionButton } from '../ActionButton';
import { PlanAllBlocksPreview, CategoryPicker } from '../PlanBlockPreview';
import type { LucideIcon } from 'lucide-react';
import { CATEGORY_META, PlanTagManager } from './PlanTagManager';
import { OrderSetManager } from './OrderSetManager';
import { ActionPill } from '../ActionPill'

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
    const clinicPlanOrderTags = useAuthStore(s => s.clinicPlanOrderTags);
    const clinicPlanInstructionTags = useAuthStore(s => s.clinicPlanInstructionTags);
    const clinicPlanOrderSets = useAuthStore(s => s.clinicPlanOrderSets);
    const isSupervisorRole = useAuthStore(s => s.isSupervisorRole);
    const clinicId = useAuthStore(s => s.clinicId);

    const planOrderTags = profile.planOrderTags ?? EMPTY_TAGS;
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
        updateClinicNoteContent(clinicId, updates);
        const next: Partial<{ clinicPlanOrderTags: PlanOrderTags; clinicPlanInstructionTags: string[]; clinicPlanOrderSets: PlanOrderSet[] }> = {};
        if (updates.planOrderTags !== undefined)        next.clinicPlanOrderTags = updates.planOrderTags;
        if (updates.planInstructionTags !== undefined)  next.clinicPlanInstructionTags = updates.planInstructionTags;
        if (updates.planOrderSets !== undefined)        next.clinicPlanOrderSets = updates.planOrderSets;
        useAuthStore.setState(next);
    }, [clinicId]);

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

    const addTag = useCallback((scope: Scope, key: PlanBlockKey, tag: string) => {
        mutateTags(scope, key, (cur) => cur.includes(tag) ? cur : [...cur, tag]);
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

    return (
        <>
            <MobileSearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search order sets and tags..."
                inheritScroll
            >
                <div className="px-5 py-4 space-y-5" data-tour="plan-settings-panel">
                    <p className="text-[10pt] text-tertiary leading-relaxed">
                        Manage order tags and order sets for the plan section of your notes.
                        {(clinicPlanOrderTags || (clinicPlanOrderSets?.length ?? 0) > 0) && (
                            <span className="text-tertiary"> Includes clinic-wide items.</span>
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
                    />
                </div>
            </MobileSearchBar>

            <TagEditPopover
                state={tagPopover}
                onClose={() => setTagPopover(null)}
                isSupervisorRole={!!isSupervisorRole}
                hasClinic={!!clinicId}
                onSubmitNew={(scope, key, tag) => { addTag(scope, key, tag); setTagPopover(null); }}
                onRename={(scope, key, original, next) => { renameTag(scope, key, original, next); setTagPopover(null); }}
                onDelete={(scope, key, tag) => { deleteTag(scope, key, tag); setTagPopover(null); }}
            />

            <OrderSetEditPopover
                state={orderSetPopover}
                onClose={() => setOrderSetPopover(null)}
                allOrderTags={activePlanOrderTags}
                allInstructionTags={activePlanInstructionTags}
                isSupervisorRole={!!isSupervisorRole}
                hasClinic={!!clinicId}
                onSave={(scope, set) => { upsertOrderSet(scope, set); setOrderSetPopover(null); }}
                onDelete={(scope, id) => { deleteOrderSet(scope, id); setOrderSetPopover(null); }}
            />
        </>
    );
};

// ── Tag edit / new popover ─────────────────────────────────────────

function TagEditPopover({ state, onClose, isSupervisorRole, hasClinic, onSubmitNew, onRename, onDelete }: {
    state: TagPopover | null;
    onClose: () => void;
    isSupervisorRole: boolean;
    hasClinic: boolean;
    onSubmitNew: (scope: Scope, key: PlanBlockKey, tag: string) => void;
    onRename: (scope: Scope, key: PlanBlockKey, original: string, next: string) => void;
    onDelete: (scope: Scope, key: PlanBlockKey, tag: string) => void;
}) {
    const [name, setName] = useState('');
    const [category, setCategory] = useState<PlanBlockKey>('meds');
    const [scope, setScope] = useState<Scope>('personal');
    const supervisorScopeAvailable = isSupervisorRole && hasClinic;

    useEffect(() => {
        if (!state) return;
        if (state.mode === 'edit') {
            setName(state.original);
            setCategory(state.key);
            setScope(state.isClinic ? 'clinic' : 'personal');
        } else {
            setName('');
            setCategory('meds');
            setScope('personal');
        }
    }, [state]);

    const trimmed = name.trim();
    const isOpen = !!state;
    const isEdit = state?.mode === 'edit';
    const canSave = !!trimmed && (!isEdit || trimmed !== (state as Extract<TagPopover, { mode: 'edit' }>).original);

    const handleSave = () => {
        if (!state) return;
        if (state.mode === 'edit') {
            if (!trimmed || trimmed === state.original) return;
            onRename(scope, state.key, state.original, trimmed);
        } else {
            if (!trimmed) return;
            onSubmitNew(scope, category, trimmed);
        }
    };

    const handleDelete = () => {
        if (!state || state.mode !== 'edit') return;
        onDelete(scope, state.key, state.original);
    };

    const editMeta = isEdit ? CATEGORY_META[(state as Extract<TagPopover, { mode: 'edit' }>).key] : null;
    const placeholder = isEdit ? editMeta?.label ?? 'Tag' : CATEGORY_META[category].label;

    return (
        <PreviewOverlay
            isOpen={isOpen}
            onClose={onClose}
            anchorRect={state?.anchor ?? null}
            title={isEdit ? `Edit ${editMeta?.label ?? ''} tag` : 'New tag'}
            maxWidth={360}
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
                            onClick={handleDelete}
                        />
                    )}
                </ActionPill>
            }
            rightFooter={!isEdit ? (
                <ActionPill>
                    <CategoryPicker
                        value={category}
                        variant="icon"
                        categories={ALL_KEYS.map(k => ({
                            key: k,
                            label: CATEGORY_META[k].label,
                            icon: CATEGORY_META[k].icon,
                            color: CATEGORY_META[k].color,
                            bg: CATEGORY_META[k].bg,
                        }))}
                        onChange={(k) => k && setCategory(k as PlanBlockKey)}
                    />
                    {supervisorScopeAvailable && (
                        <ActionButton
                            icon={scope === 'clinic' ? Building2 : User}
                            label={scope === 'clinic' ? 'Clinic' : 'Personal'}
                            onClick={() => setScope(s => s === 'personal' ? 'clinic' : 'personal')}
                        />
                    )}
                </ActionPill>
            ) : undefined}
        >
            <div className="flex items-center gap-2 px-3 py-2">
                {isEdit && editMeta && (
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${editMeta.bg}`}>
                        <editMeta.icon size={14} className={editMeta.color} />
                    </div>
                )}
                <input
                    autoFocus
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm min-w-0"
                />
            </div>
        </PreviewOverlay>
    );
}

// ── Order set edit / new popover ───────────────────────────────────

function OrderSetEditPopover({
    state, onClose, allOrderTags, allInstructionTags, isSupervisorRole, hasClinic,
    onSave, onDelete,
}: {
    state: OrderSetPopover | null;
    onClose: () => void;
    allOrderTags: PlanOrderTags;
    allInstructionTags: string[];
    isSupervisorRole: boolean;
    hasClinic: boolean;
    onSave: (scope: Scope, set: PlanOrderSet) => void;
    onDelete: (scope: Scope, id: string) => void;
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

    const groupedSelected = useMemo(() =>
        ALL_KEYS
            .map(key => ({
                catKey: key,
                catLabel: CATEGORY_META[key].label,
                catIcon: CATEGORY_META[key].icon as LucideIcon,
                catColor: CATEGORY_META[key].color,
                catBg: CATEGORY_META[key].bg,
                tags: presets[key] ?? [],
            }))
            .filter(g => g.tags.length > 0),
        [presets]
    );

    const handleSave = () => {
        if (!canSave) return;
        const cleaned: Partial<Record<PlanBlockKey, string[]>> = {};
        for (const k of ALL_KEYS) {
            const v = presets[k];
            if (v && v.length > 0) cleaned[k] = v;
        }
        onSave(scope, { id: idRef.current, name: trimmed, presets: cleaned });
    };

    const handleDelete = () => {
        if (!state || state.mode !== 'edit') return;
        onDelete(scope, state.orderSet.id);
    };

    return (
        <PreviewOverlay
            isOpen={isOpen}
            onClose={onClose}
            anchorRect={state?.anchor ?? null}
            title={isEdit ? 'Edit order set' : 'New order set'}
            maxWidth={520}
            previewMaxHeight="40dvh"
            searchPlaceholder="Search tags"
            preview={(filter, clearFilter) => (
                <div>
                    <div className="sticky top-0 z-10 bg-themewhite">
                        <TextInput
                            value={name}
                            onChange={setName}
                            placeholder="Name (e.g. URI Basic)"
                        />
                    </div>
                    {groupedSelected.length > 0 && (
                        <div className="border-b border-primary/6">
                            <div className="px-4 pt-3 pb-1">
                                <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest">
                                    Selected
                                </p>
                            </div>
                            <div className="px-2 pb-2 space-y-1">
                                {groupedSelected.map(({ catKey, catLabel, catIcon: CatIcon, catColor, catBg, tags }) => (
                                    <div key={catKey}>
                                        <div className="flex items-center gap-2 px-2 pt-1.5 pb-0.5">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${catBg}`}>
                                                <CatIcon size={11} className="text-themeblue2" />
                                            </div>
                                            <span className="text-[9pt] font-semibold uppercase tracking-widest text-themeblue2">{catLabel}</span>
                                        </div>
                                        <div className="pl-10">
                                            {tags.map(tag => (
                                                <div key={tag} className="flex items-center gap-2 py-1">
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
            rightFooter={!isEdit && supervisorScopeAvailable ? (
                <ActionPill>
                    <ActionButton
                        icon={scope === 'clinic' ? Building2 : User}
                        label={scope === 'clinic' ? 'Clinic' : 'Personal'}
                        onClick={() => setScope(s => s === 'personal' ? 'clinic' : 'personal')}
                    />
                </ActionPill>
            ) : undefined}
            actions={[
                ...(isEdit ? [{
                    key: 'delete',
                    label: 'Delete',
                    icon: Trash2,
                    onAction: handleDelete,
                    variant: 'danger' as const,
                }] : []),
                {
                    key: 'save',
                    label: 'Save',
                    icon: Check,
                    onAction: handleSave,
                    variant: canSave ? ('default' as const) : ('disabled' as const),
                },
            ]}
        />
    );
}
