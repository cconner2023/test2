import { useMemo, useRef } from 'react';
import { Plus, UserPlus, Pill, ScanLine, FlaskConical, CalendarCheck, ClipboardList } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PlanOrderTags, PlanBlockKey } from '../../Data/User';
import { PLAN_ORDER_CATEGORIES } from '../../Data/User';
import { ActionButton } from '../ActionButton';
import { ActionPill } from '../ActionPill'

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
}

export const PlanTagManager = ({
    orderTags, instructionTags, clinicTagSets, isSupervisorRole, filter = '', onTapTag, onTapNew,
}: PlanTagManagerProps) => {
    const fabRef = useRef<HTMLDivElement>(null);

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
            <div className="relative rounded-xl bg-themewhite2 overflow-hidden">
                {visibleCategories.length > 0 ? (
                    <div className="p-2 space-y-2">
                        {visibleCategories.map(key => {
                            const meta = CATEGORY_META[key];
                            const Icon = meta.icon;
                            const tags = tagsByKey[key];
                            return (
                                <div
                                    key={key}
                                    data-tour={`plan-tag-${key}`}
                                    className="overflow-hidden"
                                >
                                    <div className="flex items-center gap-2.5 px-3 py-2 border-b border-primary/6">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                                            <Icon size={12} className={meta.color} />
                                        </div>
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
                                                    onClick={(e) => onTapTag(key, tag, e.currentTarget)}
                                                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left border-b border-primary/6 last:border-0 hover:bg-themeblue3/5 active:scale-[0.99] disabled:active:scale-100 transition-colors"
                                                >
                                                    <span className="text-sm text-primary min-w-0 break-words">{tag}</span>
                                                    <span className={`text-[9pt] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full shrink-0 ${
                                                        isClinic
                                                            ? 'bg-themeblue2/10 text-themeblue2'
                                                            : 'bg-tertiary/10 text-tertiary'
                                                    }`}>
                                                        {isClinic ? 'Clinic' : 'Personal'}
                                                    </span>
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
                <ActionPill ref={fabRef} data-tour="plan-tag-input" shadow="sm" className="absolute top-2 right-2">
                    <ActionButton icon={Plus} label="New tag" onClick={() => fabRef.current && onTapNew(fabRef.current)} />
                </ActionPill>
            </div>
        </section>
    );
};
