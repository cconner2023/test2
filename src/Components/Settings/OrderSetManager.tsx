import { Plus, MessageSquare, Download, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { PlanOrderSet, PlanBlockKey } from '../../Data/User';
import { PLAN_ORDER_CATEGORIES } from '../../Data/User';
import { OverlayActionMenu } from '../OverlayActionMenu';
import { LiftedRowMenu } from '../LiftedRowMenu';
import { liftPressHandlers, type LiftPressState, type LiftSnapshot } from '../liftPress';
import type { ContextMenuItem } from '../ContextMenu';

const ALL_PLAN_BLOCK_KEYS: PlanBlockKey[] = [...PLAN_ORDER_CATEGORIES, 'instructions'];

interface OrderSetManagerProps {
    orderSets: PlanOrderSet[];
    clinicOrderSetIds: Set<string>;
    isSupervisorRole?: boolean;
    filter?: string;
    onTapRow: (os: PlanOrderSet, anchor: HTMLElement) => void;
    onTapNew: (anchor: HTMLElement) => void;
    /** Cluster picker + Share/Export/Import items, folded into the single corner ⋯
     *  menu alongside the New action this manager owns. */
    cornerItems?: ContextMenuItem[];
    /** Per-row actions (long-press / right-click lifted-row menu). When any are
     *  set, editable rows raise a clone-and-menu with Share / Export / Delete. */
    onShareItem?: (os: PlanOrderSet) => void;
    onExportItem?: (os: PlanOrderSet) => void;
    onDeleteItem?: (os: PlanOrderSet) => void;
}

export const OrderSetManager = ({
    orderSets, clinicOrderSetIds, isSupervisorRole, filter = '', onTapRow, onTapNew, cornerItems,
    onShareItem, onExportItem, onDeleteItem,
}: OrderSetManagerProps) => {
    const fabRef = useRef<HTMLDivElement>(null);

    // Lift-and-clone row menu (long-press / right-click) — Share / Export / Delete
    // ride the row itself (clone includes the text) instead of an editor-header icon.
    const [lifted, setLifted] = useState<({ os: PlanOrderSet } & LiftSnapshot) | null>(null);
    const pressRef = useRef<LiftPressState | null>(null);
    const hasRowActions = !!(onShareItem || onExportItem || onDeleteItem);
    const makeHandlers = useCallback((os: PlanOrderSet) =>
        liftPressHandlers((snap) => setLifted({ os, ...snap }), pressRef), []);

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
            <div className="relative"><div className="rounded-xl bg-themewhite2 overflow-hidden">
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
                                        onClick={(e) => { if (pressRef.current?.fired) return; onTapRow(os, e.currentTarget); }}
                                        {...(canEdit && hasRowActions ? makeHandlers(os) : {})}
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
                        <p className="text-[10pt] text-tertiary py-4 text-center">
                            {lc ? 'No matches' : 'No order sets configured'}
                        </p>
                    )}
                </div>
                </div>
                <OverlayActionMenu
                    ref={fabRef}
                    shadow="sm"
                    items={[
                        { key: 'new', label: 'New order set', icon: Plus, onAction: () => fabRef.current && onTapNew(fabRef.current) },
                        ...(cornerItems ?? []),
                    ]}
                />
            </div>

            {lifted && (
                <LiftedRowMenu
                    isOpen
                    anchorRect={lifted.rect}
                    row={<div dangerouslySetInnerHTML={{ __html: lifted.html }} />}
                    onClose={() => setLifted(null)}
                    layout="list"
                    items={[
                        ...(onShareItem ? [{ key: 'share', label: 'Share to chat', icon: MessageSquare, onAction: () => onShareItem(lifted.os) }] : []),
                        ...(onExportItem ? [{ key: 'export', label: 'Export to file', icon: Download, onAction: () => onExportItem(lifted.os) }] : []),
                        ...(onDeleteItem ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteItem(lifted.os) }] : []),
                    ] as ContextMenuItem[]}
                />
            )}
        </section>
    );
};
