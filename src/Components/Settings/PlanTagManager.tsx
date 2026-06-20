import { useCallback, useMemo, useRef, useState } from 'react';
import { Plus, UserPlus, Pill, ScanLine, FlaskConical, CalendarCheck, ClipboardList, MessageSquare, Trash2, Building2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PlanOrderTags, PlanBlockKey } from '../../Data/User';
import { PLAN_ORDER_CATEGORIES } from '../../Data/User';
import { ActionButton } from '../ActionButton';
import { ActionPill } from '../ActionPill'
import { LiftedRowMenu } from '../LiftedRowMenu';
import { liftPressHandlers, type LiftPressState, type LiftSnapshot } from '../liftPress';
import type { ContextMenuItem } from '../ContextMenu';

const ALL_KEYS: PlanBlockKey[] = [...PLAN_ORDER_CATEGORIES, 'instructions'];

export const CATEGORY_META: Record<PlanBlockKey, { label: string; icon: LucideIcon; color: string; bg: string }> = {
    referral:     { label: 'Referral',      icon: UserPlus,      color: 'text-themeblue2',    bg: 'bg-themeblue2/15' },
    meds:         { label: 'Medications',   icon: Pill,          color: 'text-themepurple',   bg: 'bg-themepurple/15' },
    radiology:    { label: 'Radiology',     icon: ScanLine,      color: 'text-themeyellow',   bg: 'bg-themeyellow/15' },
    lab:          { label: 'Lab',           icon: FlaskConical,  color: 'text-themegreen',    bg: 'bg-themegreen/15' },
    followUp:     { label: 'Follow-Up',     icon: CalendarCheck, color: 'text-themeorange',   bg: 'bg-themeorange/15' },
    instructions: { label: 'Instructions',  icon: ClipboardList, color: 'text-tertiary',      bg: 'bg-tertiary/15' },
};

interface PlanTagManagerProps {
    orderTags: PlanOrderTags;
    instructionTags: string[];
    clinicTagSets: Record<string, Set<string>>;
    isSupervisorRole?: boolean;
    filter?: string;
    onTapTag: (key: PlanBlockKey, tag: string, anchor: HTMLElement) => void;
    onTapNew: (anchor: HTMLElement) => void;
    /** Per-row actions (long-press / right-click lifted-row menu). */
    onShareItem?: (key: PlanBlockKey, tag: string) => void;
    onDeleteItem?: (key: PlanBlockKey, tag: string) => void;
}

export const PlanTagManager = ({
    orderTags, instructionTags, clinicTagSets, isSupervisorRole, filter = '', onTapTag, onTapNew,
    onShareItem, onDeleteItem,
}: PlanTagManagerProps) => {
    const fabRef = useRef<HTMLDivElement>(null);

    // Lift-and-clone row menu (long-press / right-click) — Share / Delete
    // ride the tag row (clone includes the text) instead of an editor-header icon.
    const [lifted, setLifted] = useState<({ key: PlanBlockKey; tag: string } & LiftSnapshot) | null>(null);
    const pressRef = useRef<LiftPressState | null>(null);
    const hasRowActions = !!(onShareItem || onDeleteItem);
    const makeHandlers = useCallback((key: PlanBlockKey, tag: string) =>
        liftPressHandlers((snap) => setLifted({ key, tag, ...snap }), pressRef), []);

    const getTagsForKey = (key: PlanBlockKey): string[] =>
        key === 'instructions' ? instructionTags : (orderTags[key] ?? []);

    const lc = filter.trim().toLowerCase();
    const tagsByKey = useMemo(() => {
        const out: Record<string, string[]> = {};
        for (const key of ALL_KEYS) {
            const all = getTagsForKey(key);
            out[key] = lc ? all.filter(t => t.toLowerCase().includes(lc)) : all;
        }
        return out;
    }, [orderTags, instructionTags, lc]);

    const visibleCategories = ALL_KEYS.filter(k => tagsByKey[k].length > 0);
    const totalCount = visibleCategories.reduce((s, k) => s + tagsByKey[k].length, 0);

    return (
        <section data-tour="plan-tag-section">
            <div className="pb-2">
                <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Plan Tags</p>
            </div>
            <div className="relative"><div className="rounded-xl bg-themewhite2 overflow-hidden">
                {visibleCategories.length > 0 ? (
                    <div className="p-2 space-y-2">
                        {visibleCategories.map(key => {
                            const meta = CATEGORY_META[key];
                            const tags = tagsByKey[key];
                            return (
                                <div
                                    key={key}
                                    data-tour={`plan-tag-${key}`}
                                    className="overflow-hidden"
                                >
                                    <div className="flex items-center gap-2.5 px-3 py-2 border-b border-primary/6">
                                        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">
                                            {meta.label}
                                        </p>
                                    </div>
                                    <div>
                                        {tags.map((tag, i) => {
                                            const isClinic = clinicTagSets[key]?.has(tag) ?? false;
                                            const canEdit = !isClinic || (isSupervisorRole ?? false);
                                            return (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    disabled={!canEdit}
                                                    onClick={(e) => { if (pressRef.current?.fired) return; onTapTag(key, tag, e.currentTarget); }}
                                                    {...(canEdit && hasRowActions ? makeHandlers(key, tag) : {})}
                                                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left border-b border-primary/6 last:border-0 hover:bg-themeblue3/5 active:scale-[0.99] disabled:active:scale-100 transition-colors"
                                                >
                                                    <span className="text-sm text-primary min-w-0 break-words">{tag}</span>
                                                    {isClinic && (
                                                        <Building2 size={12} className="text-themeblue2 shrink-0" aria-label="Cluster" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="px-4 py-6">
                        <p className="text-sm text-tertiary text-center">
                            {lc ? 'No matches' : 'No tags configured'}
                        </p>
                    </div>
                )}
                </div>
                <ActionPill ref={fabRef} data-tour="plan-tag-input" shadow="sm" placement="overlay">
                    <ActionButton icon={Plus} label="New tag" onClick={() => fabRef.current && onTapNew(fabRef.current)} />
                </ActionPill>
            </div>

            {lifted && (
                <LiftedRowMenu
                    isOpen
                    anchorRect={lifted.rect}
                    row={<div dangerouslySetInnerHTML={{ __html: lifted.html }} />}
                    onClose={() => setLifted(null)}
                    layout="list"
                    items={[
                        ...(onShareItem ? [{ key: 'share', label: 'Share to chat', icon: MessageSquare, onAction: () => onShareItem(lifted.key, lifted.tag) }] : []),
                        ...(onDeleteItem ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteItem(lifted.key, lifted.tag) }] : []),
                    ] as ContextMenuItem[]}
                />
            )}
        </section>
    );
};
