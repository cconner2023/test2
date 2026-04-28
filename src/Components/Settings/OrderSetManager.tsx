import { Plus } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { ActionButton } from '../ActionButton';
import type { PlanOrderSet, PlanBlockKey } from '../../Data/User';
import { PLAN_ORDER_CATEGORIES } from '../../Data/User';
import { ActionPill } from '../ActionPill'

const ALL_PLAN_BLOCK_KEYS: PlanBlockKey[] = [...PLAN_ORDER_CATEGORIES, 'instructions'];

interface OrderSetManagerProps {
    orderSets: PlanOrderSet[];
    clinicOrderSetIds: Set<string>;
    isSupervisorRole?: boolean;
    filter?: string;
    onTapRow: (os: PlanOrderSet, anchor: HTMLElement) => void;
    onTapNew: (anchor: HTMLElement) => void;
}

export const OrderSetManager = ({
    orderSets, clinicOrderSetIds, isSupervisorRole, filter = '', onTapRow, onTapNew,
}: OrderSetManagerProps) => {
    const fabRef = useRef<HTMLDivElement>(null);

    const collectTags = (os: PlanOrderSet): string[] =>
        ALL_PLAN_BLOCK_KEYS.flatMap(k => os.presets[k] ?? []);

    const lc = filter.trim().toLowerCase();
    const visibleSets = useMemo(() => {
        if (!lc) return orderSets;
        return orderSets.filter(os =>
            os.name.toLowerCase().includes(lc) ||
            collectTags(os).some(t => t.toLowerCase().includes(lc))
        );
    }, [orderSets, lc]);

    return (
        <section data-tour="plan-orderset-section">
            <div className="pb-2">
                <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Order Sets</p>
            </div>
            <div className="relative rounded-xl bg-themewhite2 overflow-hidden">
                <div className="px-4 py-3">
                    {visibleSets.length > 0 ? (
                        <div className="space-y-0.5">
                            {visibleSets.map(os => {
                                const tags = collectTags(os);
                                const isClinic = clinicOrderSetIds.has(os.id);
                                const canEdit = !isClinic || (isSupervisorRole ?? false);
                                return (
                                    <button
                                        key={os.id}
                                        type="button"
                                        disabled={!canEdit}
                                        onClick={(e) => onTapRow(os, e.currentTarget)}
                                        className="w-full text-left py-2 px-2 rounded-lg cursor-pointer active:scale-[0.98] disabled:active:scale-100 hover:bg-tertiary/5 transition-all"
                                    >
                                        <div className="flex items-center">
                                            <p className="text-sm font-medium text-primary truncate">{os.name}</p>
                                            {isClinic && (
                                                <span className="text-[9pt] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary shrink-0 ml-1.5">
                                                    Clinic
                                                </span>
                                            )}
                                        </div>
                                        {tags.length > 0 && (
                                            <p className="text-[9pt] text-tertiary mt-0.5 pl-0.5 break-words">{tags.join(', ')}</p>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-tertiary py-4 text-center">
                            {lc ? 'No matches' : 'No order sets configured'}
                        </p>
                    )}
                </div>
                <ActionPill ref={fabRef} shadow="sm" className="absolute top-2 right-2">
                    <ActionButton icon={Plus} label="New order set" onClick={() => fabRef.current && onTapNew(fabRef.current)} />
                </ActionPill>
            </div>
        </section>
    );
};
