import { useMemo } from 'react';
import { UserPlus, Pill, ScanLine, FlaskConical, CalendarCheck, ClipboardList, Building2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PlanOrderTags, PlanBlockKey } from '../../Data/User';
import { PLAN_ORDER_CATEGORIES } from '../../Data/User';
import { planTagDisplay } from '@/Utilities/medTag';
import { ListGroupLabel, PageSectionHeader } from '@/Components/primitives/Section';
import { SelectBox } from './contentPrimitives';

const ALL_KEYS: PlanBlockKey[] = [...PLAN_ORDER_CATEGORIES, 'instructions'];

// Separator is an escaped NUL, not a literal one. It used to be typed straight
// into the template literal, which made the whole file read as BINARY to grep
// and diff tools and hid the delimiter from anyone reading the line. NUL stays
// the right separator: no block key or tag can contain one, so the composite
// key cannot collide.
export const tagSelKey = (key: PlanBlockKey, tag: string) => `${key}\u0000${tag}`;

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
    /** Tap a tag → the panel lifts the row and drops its item menu. */
    onTapTag: (key: PlanBlockKey, tag: string, el: HTMLElement) => void;
    /** Multiselect (driven by the panel header's Add menu); keys via tagSelKey. */
    selectMode?: boolean;
    selected?: Set<string>;
    onToggleSelect?: (key: PlanBlockKey, tag: string) => void;
}

/** Plan tag list, grouped by category. Add / Multiselect live on the container
 *  header; item actions ride the tapped row. */
export const PlanTagManager = ({
    orderTags, instructionTags, clinicTagSets, isSupervisorRole, filter = '', onTapTag,
    selectMode = false, selected, onToggleSelect,
}: PlanTagManagerProps) => {
    const lc = filter.trim().toLowerCase();
    const tagsByKey = useMemo(() => {
        const out: Record<string, string[]> = {};
        for (const key of ALL_KEYS) {
            const all = key === 'instructions' ? instructionTags : (orderTags[key] ?? []);
            out[key] = lc ? all.filter(t => t.toLowerCase().includes(lc)) : all;
        }
        return out;
    }, [orderTags, instructionTags, lc]);

    const visibleCategories = ALL_KEYS.filter(k => tagsByKey[k].length > 0);

    return (
        <section>
            <PageSectionHeader>Plan Tags</PageSectionHeader>
            <div className="rounded-xl bg-themewhite2 overflow-hidden">
                {visibleCategories.length > 0 ? (
                    <div className="p-2 space-y-2">
                        {visibleCategories.map(key => {
                            const meta = CATEGORY_META[key];
                            const tags = tagsByKey[key];
                            return (
                                <div key={key} className="overflow-hidden">
                                    <div className="border-b border-primary/6">
                                        <ListGroupLabel>{meta.label}</ListGroupLabel>
                                    </div>
                                    <div>
                                        {tags.map((tag, i) => {
                                            const isClinic = clinicTagSets[key]?.has(tag) ?? false;
                                            const canEdit = !isClinic || (isSupervisorRole ?? false);
                                            const selectable = selectMode && canEdit;
                                            const isSelected = selected?.has(tagSelKey(key, tag)) ?? false;
                                            return (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    disabled={selectMode && !canEdit}
                                                    onClick={(e) => {
                                                        if (selectMode) { if (selectable) onToggleSelect?.(key, tag); return; }
                                                        onTapTag(key, tag, e.currentTarget);
                                                    }}
                                                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left border-b border-primary/6 last:border-0 hover:bg-themeblue3/5 active:scale-[0.99] disabled:active:scale-100 disabled:opacity-50 transition-colors"
                                                >
                                                    <span className="flex items-center gap-2.5 min-w-0">
                                                        {selectable && <SelectBox checked={isSelected} />}
                                                        <span className="text-sm text-primary min-w-0 break-words">{planTagDisplay(key, tag)}</span>
                                                    </span>
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
        </section>
    );
};
