import { Building2 } from 'lucide-react';
import { useMemo } from 'react';
import type { PlanOrderSet, PlanBlockKey } from '../../Data/User';
import { PLAN_ORDER_CATEGORIES } from '../../Data/User';
import { planTagDisplay } from '@/Utilities/medTag';
import { PageSectionHeader } from '@/Components/primitives/Section';
import { SelectBox } from './contentPrimitives';

const ALL_PLAN_BLOCK_KEYS: PlanBlockKey[] = [...PLAN_ORDER_CATEGORIES, 'instructions'];

export const orderSetTags = (os: PlanOrderSet): string[] =>
    ALL_PLAN_BLOCK_KEYS.flatMap(k => (os.presets[k] ?? []).map(t => planTagDisplay(k, t)));

interface OrderSetManagerProps {
    orderSets: PlanOrderSet[];
    clinicOrderSetIds: Set<string>;
    isSupervisorRole?: boolean;
    filter?: string;
    /** Tap a row → the panel lifts it and drops its item menu. */
    onTapRow: (os: PlanOrderSet, el: HTMLElement) => void;
    /** Multiselect (driven by the panel header's Add menu). */
    selectMode?: boolean;
    selectedIds?: Set<string>;
    onToggleSelect?: (os: PlanOrderSet) => void;
}

/** Order set list. Add / Multiselect live on the container header; item actions
 *  ride the tapped row. */
export const OrderSetManager = ({
    orderSets, clinicOrderSetIds, isSupervisorRole, filter = '', onTapRow,
    selectMode = false, selectedIds, onToggleSelect,
}: OrderSetManagerProps) => {
    const lc = filter.trim().toLowerCase();
    const visibleSets = useMemo(() => {
        if (!lc) return orderSets;
        return orderSets.filter(os =>
            os.name.toLowerCase().includes(lc) ||
            orderSetTags(os).some(t => t.toLowerCase().includes(lc))
        );
    }, [orderSets, lc]);

    return (
        <section>
            <PageSectionHeader>Order Sets</PageSectionHeader>
            <div className="rounded-xl bg-themewhite2 overflow-hidden">
                <div className="px-4 py-3">
                    {visibleSets.length > 0 ? (
                        <div className="space-y-0.5">
                            {visibleSets.map(os => {
                                const tags = orderSetTags(os);
                                const isClinic = clinicOrderSetIds.has(os.id);
                                const canEdit = !isClinic || (isSupervisorRole ?? false);
                                const selectable = selectMode && canEdit;
                                const checked = selectedIds?.has(os.id) ?? false;
                                return (
                                    <button
                                        key={os.id}
                                        type="button"
                                        disabled={selectMode && !canEdit}
                                        onClick={(e) => {
                                            if (selectMode) { if (selectable) onToggleSelect?.(os); return; }
                                            onTapRow(os, e.currentTarget);
                                        }}
                                        className="w-full text-left py-2 px-2 rounded-lg cursor-pointer active:scale-[0.98] disabled:active:scale-100 disabled:opacity-50 hover:bg-tertiary/5 transition-all"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            {selectable && <SelectBox checked={checked} />}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center">
                                                    <p className="text-sm font-medium text-primary truncate">{os.name}</p>
                                                    {isClinic && (
                                                        <Building2 size={12} className="text-themeblue2 shrink-0 ml-1.5" aria-label="Cluster" />
                                                    )}
                                                </div>
                                                {tags.length > 0 && (
                                                    <p className="text-[9pt] text-tertiary mt-0.5 pl-0.5 break-words">{tags.join(', ')}</p>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-[10pt] text-tertiary py-4 text-center">
                            {lc ? 'No matches' : 'No order sets configured'}
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
};
