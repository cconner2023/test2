import { useState, useCallback, useEffect } from 'react';
import { Check, X, Trash2 } from 'lucide-react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useAuthStore } from '../../stores/useAuthStore';
import { updateClinicNoteContent } from '../../lib/supervisorService';
import type { UserTypes, PlanBlockKey, PlanOrderSet, PlanOrderTags } from '../../Data/User';
import { PlanTagManager } from './PlanTagManager';
import type { StagedTagDeletes, StagedTagAdds } from './PlanTagManager';
import { OrderSetManager } from './OrderSetManager';

export interface ComposingSet {
    editId: string | null;
    name: string;
    presets: Partial<Record<PlanBlockKey, string[]>>;
}

interface PlanPanelProps {
    editing?: boolean;
    saveRequested?: boolean;
    onSaveComplete?: () => void;
    onPendingChangesChange?: (hasPending: boolean) => void;
}

export const PlanPanel = ({ editing = false, saveRequested, onSaveComplete, onPendingChangesChange }: PlanPanelProps) => {
    const { profile, updateProfile, syncProfileField } = useUserProfile();
    const [scope, setScope] = useState<'personal' | 'clinic'>('personal');
    const clinicPlanOrderTags = useAuthStore(s => s.clinicPlanOrderTags);
    const clinicPlanInstructionTags = useAuthStore(s => s.clinicPlanInstructionTags);
    const clinicPlanOrderSets = useAuthStore(s => s.clinicPlanOrderSets);
    const isSupervisorRole = useAuthStore(s => s.isSupervisorRole);
    const clinicId = useAuthStore(s => s.clinicId);

    const planOrderTags = profile.planOrderTags ?? { referral: [], meds: [], radiology: [], lab: [], followUp: [] };
    const planInstructionTags = profile.planInstructionTags ?? [];
    const planOrderSets = profile.planOrderSets ?? [];

    // For non-supervisors, merge clinic data into personal view (clinic items first, deduplicated)
    const emptyTags = { referral: [], meds: [], radiology: [], lab: [], followUp: [] } as PlanOrderTags;

    const mergedOrderTags = !isSupervisorRole && clinicPlanOrderTags
        ? {
            referral: [...new Set([...(clinicPlanOrderTags.referral ?? []), ...planOrderTags.referral])],
            meds: [...new Set([...(clinicPlanOrderTags.meds ?? []), ...planOrderTags.meds])],
            radiology: [...new Set([...(clinicPlanOrderTags.radiology ?? []), ...planOrderTags.radiology])],
            lab: [...new Set([...(clinicPlanOrderTags.lab ?? []), ...planOrderTags.lab])],
            followUp: [...new Set([...(clinicPlanOrderTags.followUp ?? []), ...planOrderTags.followUp])],
        }
        : null;

    const mergedInstructionTags = !isSupervisorRole && clinicPlanInstructionTags
        ? [...new Set([...clinicPlanInstructionTags, ...planInstructionTags])]
        : null;

    const mergedOrderSets = !isSupervisorRole && clinicPlanOrderSets
        ? [...clinicPlanOrderSets, ...planOrderSets]
        : null;

    const activePlanOrderTags = isSupervisorRole
        ? (scope === 'clinic' ? (clinicPlanOrderTags ?? emptyTags) : planOrderTags)
        : (mergedOrderTags ?? planOrderTags);
    const activePlanInstructionTags = isSupervisorRole
        ? (scope === 'clinic' ? (clinicPlanInstructionTags ?? []) : planInstructionTags)
        : (mergedInstructionTags ?? planInstructionTags);
    const activePlanOrderSets = isSupervisorRole
        ? (scope === 'clinic' ? (clinicPlanOrderSets ?? []) : planOrderSets)
        : (mergedOrderSets ?? planOrderSets);

    const [composing, setComposing] = useState<ComposingSet | null>(null);

    // Order set staging
    const [stagedDeletes, setStagedDeletes] = useState<Set<string>>(new Set());
    const [stagedAdds, setStagedAdds] = useState<PlanOrderSet[]>([]);
    const [stagedEdits, setStagedEdits] = useState<PlanOrderSet[]>([]);

    // Tag staging
    const [stagedTagDeletes, setStagedTagDeletes] = useState<StagedTagDeletes>({});
    const [stagedTagAdds, setStagedTagAdds] = useState<StagedTagAdds>({});

    const hasOrderSetPending = stagedDeletes.size > 0 || stagedAdds.length > 0 || stagedEdits.length > 0;
    const hasTagPending = Object.values(stagedTagDeletes).some(s => s && s.size > 0)
        || Object.values(stagedTagAdds).some(a => a && a.length > 0);
    const hasPending = hasOrderSetPending || hasTagPending;

    useEffect(() => {
        onPendingChangesChange?.(hasPending);
    }, [hasPending, onPendingChangesChange]);

    const handleUpdate = useCallback((fields: Partial<UserTypes>) => {
        updateProfile(fields);
        const dbFields: Record<string, unknown> = {};
        if (fields.planOrderTags !== undefined) dbFields.plan_order_tags = fields.planOrderTags;
        if (fields.planInstructionTags !== undefined) dbFields.plan_instruction_tags = fields.planInstructionTags;
        if (fields.planOrderSets !== undefined) dbFields.plan_order_sets = fields.planOrderSets;
        syncProfileField(dbFields);
    }, [updateProfile, syncProfileField]);

    // Commit all staged changes
    useEffect(() => {
        if (!saveRequested) return;

        if (scope === 'clinic' && clinicId) {
            // --- Clinic save ---
            const baseTags = clinicPlanOrderTags ?? emptyTags;
            const baseInstr = clinicPlanInstructionTags ?? [];
            const baseSets = clinicPlanOrderSets ?? [];

            let nextSets = [...baseSets];
            if (hasOrderSetPending) {
                for (const edited of stagedEdits) {
                    nextSets = nextSets.map(s => s.id === edited.id ? edited : s);
                }
                if (stagedDeletes.size > 0) nextSets = nextSets.filter(s => !stagedDeletes.has(s.id));
                if (stagedAdds.length > 0) nextSets = [...nextSets, ...stagedAdds];
            }

            let nextOrderTags = { ...baseTags };
            let nextInstrTags = [...baseInstr];
            if (hasTagPending) {
                for (const cat of ['referral', 'meds', 'radiology', 'lab', 'followUp'] as const) {
                    let tags = [...(nextOrderTags[cat] ?? [])];
                    const deletes = stagedTagDeletes[cat];
                    if (deletes && deletes.size > 0) tags = tags.filter(t => !deletes.has(t));
                    const adds = stagedTagAdds[cat];
                    if (adds && adds.length > 0) tags = [...tags, ...adds];
                    nextOrderTags[cat] = tags;
                }
                const instrDeletes = stagedTagDeletes.instructions;
                if (instrDeletes && instrDeletes.size > 0) nextInstrTags = nextInstrTags.filter(t => !instrDeletes.has(t));
                const instrAdds = stagedTagAdds.instructions;
                if (instrAdds && instrAdds.length > 0) nextInstrTags = [...nextInstrTags, ...instrAdds];
            }

            if (hasPending) {
                updateClinicNoteContent(clinicId, {
                    planOrderTags: nextOrderTags,
                    planInstructionTags: nextInstrTags,
                    planOrderSets: nextSets,
                });
                useAuthStore.setState({
                    clinicPlanOrderTags: nextOrderTags,
                    clinicPlanInstructionTags: nextInstrTags,
                    clinicPlanOrderSets: nextSets,
                });
            }
        } else {
            // --- Personal save ---
            const updates: Partial<UserTypes> = {};

            if (hasOrderSetPending) {
                let next = [...planOrderSets];
                for (const edited of stagedEdits) {
                    next = next.map(s => s.id === edited.id ? edited : s);
                }
                if (stagedDeletes.size > 0) next = next.filter(s => !stagedDeletes.has(s.id));
                if (stagedAdds.length > 0) next = [...next, ...stagedAdds];
                updates.planOrderSets = next;
            }

            if (hasTagPending) {
                const newOrderTags = { ...planOrderTags };
                for (const cat of ['referral', 'meds', 'radiology', 'lab', 'followUp'] as const) {
                    let tags = [...(newOrderTags[cat] ?? [])];
                    const deletes = stagedTagDeletes[cat];
                    if (deletes && deletes.size > 0) tags = tags.filter(t => !deletes.has(t));
                    const adds = stagedTagAdds[cat];
                    if (adds && adds.length > 0) tags = [...tags, ...adds];
                    newOrderTags[cat] = tags;
                }
                updates.planOrderTags = newOrderTags;

                let instrTags = [...planInstructionTags];
                const instrDeletes = stagedTagDeletes.instructions;
                if (instrDeletes && instrDeletes.size > 0) instrTags = instrTags.filter(t => !instrDeletes.has(t));
                const instrAdds = stagedTagAdds.instructions;
                if (instrAdds && instrAdds.length > 0) instrTags = [...instrTags, ...instrAdds];
                updates.planInstructionTags = instrTags;
            }

            if (hasPending) handleUpdate(updates);
        }

        // Clear all staging
        setStagedDeletes(new Set());
        setStagedAdds([]);
        setStagedEdits([]);
        setStagedTagDeletes({});
        setStagedTagAdds({});
        setComposing(null);
        onSaveComplete?.();
    }, [saveRequested]); // eslint-disable-line react-hooks/exhaustive-deps

    // Clear staging when editing is turned off (cancel)
    useEffect(() => {
        if (!editing) {
            setStagedDeletes(new Set());
            setStagedAdds([]);
            setStagedEdits([]);
            setStagedTagDeletes({});
            setStagedTagAdds({});
            setComposing(null);
        }
    }, [editing]);

    // Reset staging when scope changes
    useEffect(() => {
        setStagedDeletes(new Set());
        setStagedAdds([]);
        setStagedEdits([]);
        setStagedTagDeletes({});
        setStagedTagAdds({});
        setComposing(null);
    }, [scope]);

    // Tour system: listen for plan tour events
    useEffect(() => {
        const handleStageTag = (e: Event) => {
            const { key, tag } = (e as CustomEvent).detail as { key: PlanBlockKey; tag: string };
            setStagedTagAdds(prev => ({ ...prev, [key]: [...(prev[key] ?? []), tag] }));
        };
        const handleStartCompose = (e: Event) => {
            const { name } = (e as CustomEvent).detail as { name: string };
            setComposing({ editId: null, name, presets: {} });
        };
        const handleTogglePreset = (e: Event) => {
            const { key, tag } = (e as CustomEvent).detail as { key: PlanBlockKey; tag: string };
            setComposing(prev => {
                if (!prev) return prev;
                const current = prev.presets[key] ?? [];
                const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
                return { ...prev, presets: { ...prev.presets, [key]: next } };
            });
        };
        const handleSaveCompose = () => {
            setComposing(prev => {
                if (!prev || !prev.name.trim()) return prev;
                const cleaned: Partial<Record<PlanBlockKey, string[]>> = {};
                for (const [key, tags] of Object.entries(prev.presets)) {
                    if (tags && tags.length > 0) cleaned[key as PlanBlockKey] = tags;
                }
                setStagedAdds(a => [...a, { id: crypto.randomUUID(), name: prev.name.trim(), presets: cleaned }]);
                return null;
            });
        };
        window.addEventListener('tour:plan-stage-tag', handleStageTag);
        window.addEventListener('tour:plan-start-compose', handleStartCompose);
        window.addEventListener('tour:plan-toggle-preset', handleTogglePreset);
        window.addEventListener('tour:plan-save-compose', handleSaveCompose);
        return () => {
            window.removeEventListener('tour:plan-stage-tag', handleStageTag);
            window.removeEventListener('tour:plan-start-compose', handleStartCompose);
            window.removeEventListener('tour:plan-toggle-preset', handleTogglePreset);
            window.removeEventListener('tour:plan-save-compose', handleSaveCompose);
        };
    }, []);

    // --- Order set handlers ---

    const handleStartAdd = useCallback((name: string) => {
        setComposing({ editId: null, name, presets: {} });
    }, []);

    const handleStartEdit = useCallback((os: PlanOrderSet) => {
        const staged = stagedEdits.find(s => s.id === os.id);
        const source = staged ?? os;
        setComposing({ editId: source.id, name: source.name, presets: JSON.parse(JSON.stringify(source.presets)) });
    }, [stagedEdits]);

    const handleTogglePreset = useCallback((key: PlanBlockKey, tag: string) => {
        setComposing(prev => {
            if (!prev) return prev;
            const current = prev.presets[key] ?? [];
            const next = current.includes(tag)
                ? current.filter(t => t !== tag)
                : [...current, tag];
            return { ...prev, presets: { ...prev.presets, [key]: next } };
        });
    }, []);

    const handleSaveCompose = useCallback(() => {
        if (!composing || !composing.name.trim()) return;

        const cleaned: Partial<Record<PlanBlockKey, string[]>> = {};
        for (const [key, tags] of Object.entries(composing.presets)) {
            if (tags && tags.length > 0) cleaned[key as PlanBlockKey] = tags;
        }

        if (composing.editId) {
            setStagedEdits(prev => {
                const filtered = prev.filter(s => s.id !== composing.editId);
                return [...filtered, { id: composing.editId!, name: composing.name.trim(), presets: cleaned }];
            });
            setStagedDeletes(prev => {
                if (!prev.has(composing.editId!)) return prev;
                const next = new Set(prev);
                next.delete(composing.editId!);
                return next;
            });
        } else {
            setStagedAdds(prev => [...prev, { id: crypto.randomUUID(), name: composing.name.trim(), presets: cleaned }]);
        }
        setComposing(null);
    }, [composing]);

    const handleDeleteCompose = useCallback(() => {
        if (!composing?.editId) return;
        setStagedDeletes(prev => {
            const next = new Set(prev);
            next.add(composing.editId!);
            return next;
        });
        setStagedEdits(prev => prev.filter(s => s.id !== composing.editId));
        setComposing(null);
    }, [composing]);

    const handleCancelCompose = useCallback(() => setComposing(null), []);

    const handleComposingNameChange = useCallback((name: string) => {
        setComposing(prev => prev ? { ...prev, name } : prev);
    }, []);

    const handleUnstageAdd = useCallback((id: string) => {
        setStagedAdds(prev => prev.filter(s => s.id !== id));
    }, []);

    const handleUnstageDelete = useCallback((id: string) => {
        setStagedDeletes(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    // --- Tag handlers ---

    const handleToggleTagDelete = useCallback((key: PlanBlockKey, tag: string) => {
        setStagedTagDeletes(prev => {
            const current = prev[key] ?? new Set();
            const next = new Set(current);
            if (next.has(tag)) {
                next.delete(tag);
            } else {
                next.add(tag);
            }
            return { ...prev, [key]: next };
        });
    }, []);

    const handleStageTagAdd = useCallback((key: PlanBlockKey, tag: string) => {
        setStagedTagAdds(prev => {
            const current = prev[key] ?? [];
            return { ...prev, [key]: [...current, tag] };
        });
    }, []);

    const handleUnstageTagAdd = useCallback((key: PlanBlockKey, tag: string) => {
        setStagedTagAdds(prev => {
            const current = prev[key] ?? [];
            return { ...prev, [key]: current.filter(t => t !== tag) };
        });
    }, []);

    const composeSelectedCount = composing
        ? (['referral', 'meds', 'radiology', 'lab', 'followUp', 'instructions'] as PlanBlockKey[]).reduce(
            (sum, k) => sum + (composing.presets[k]?.length ?? 0), 0,
        )
        : 0;

    return (
        <div className="flex flex-col h-full" data-tour="plan-settings-panel">
            <div className="flex-1 overflow-y-auto">
                <div className="px-5 py-4 space-y-5">
                    {isSupervisorRole ? (
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-tertiary leading-relaxed flex-1">
                                {scope === 'clinic'
                                    ? 'Clinic order sets and tags shared with all members.'
                                    : 'Your personal order tags and order sets.'}
                            </p>
                            <div className="flex rounded-full border border-themeblue3/10 overflow-hidden shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setScope('personal')}
                                    className={`px-3 py-1.5 text-[11px] font-semibold transition-all ${
                                        scope === 'personal'
                                            ? 'bg-themeblue2 text-white'
                                            : 'text-tertiary hover:bg-tertiary/5'
                                    }`}
                                >
                                    Personal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setScope('clinic')}
                                    className={`px-3 py-1.5 text-[11px] font-semibold transition-all ${
                                        scope === 'clinic'
                                            ? 'bg-themeblue2 text-white'
                                            : 'text-tertiary hover:bg-tertiary/5'
                                    }`}
                                >
                                    Clinic
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-tertiary leading-relaxed">
                            Manage order tags and order sets for the plan section of your notes.
                        </p>
                    )}

                    <OrderSetManager
                        orderSets={activePlanOrderSets}
                        editing={editing}
                        composing={composing}
                        onComposingNameChange={handleComposingNameChange}
                        onStartAdd={handleStartAdd}
                        onStartEdit={handleStartEdit}
                        stagedDeletes={stagedDeletes}
                        stagedAdds={stagedAdds}
                        stagedEdits={stagedEdits}
                        onUnstageAdd={handleUnstageAdd}
                        onUnstageDelete={handleUnstageDelete}
                    />

                    <PlanTagManager
                        orderTags={activePlanOrderTags}
                        instructionTags={activePlanInstructionTags}
                        editing={editing}
                        selectMode={!!composing}
                        selectedPresets={composing?.presets}
                        onTogglePreset={handleTogglePreset}
                        stagedTagDeletes={stagedTagDeletes}
                        stagedTagAdds={stagedTagAdds}
                        onToggleTagDelete={handleToggleTagDelete}
                        onStageTagAdd={handleStageTagAdd}
                        onUnstageTagAdd={handleUnstageTagAdd}
                    />
                </div>
            </div>

            {/* Sticky footer — visible during order set composition */}
            <div data-tour="plan-orderset-footer" className={`overflow-hidden transition-all duration-300 ease-out ${
                composing ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
            }`}>
                <div className="px-5 py-3 border-t border-themeblue2/15 bg-themewhite2">
                    <div className="flex items-center justify-between">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-primary truncate">{composing?.name}</p>
                            <p className="text-[11px] text-tertiary/60">
                                {composeSelectedCount > 0
                                    ? <><span className="font-medium text-themeblue2">{composeSelectedCount}</span> tag{composeSelectedCount !== 1 ? 's' : ''} selected</>
                                    : 'Select tags above'
                                }
                            </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                            <button
                                onClick={handleCancelCompose}
                                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                            >
                                <X size={18} />
                            </button>
                            {composing?.editId && (
                                <button
                                    onClick={handleDeleteCompose}
                                    className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeredred/10 text-themeredred active:scale-95 transition-all"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                            <button
                                onClick={handleSaveCompose}
                                disabled={!composing?.name?.trim()}
                                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-40 active:scale-95 transition-all"
                            >
                                <Check size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
