import { useMemo } from 'react';
import { TextCursorInput, Layers, Building2 } from 'lucide-react';
import type { TextExpander } from '../../Data/User';
import { isFlatTemplate } from '../../Utilities/templateParser';
import { SelectBox } from './contentPrimitives';

export const hasBranches = (e: TextExpander): boolean =>
    !!(e.template && e.template.length > 0 && !isFlatTemplate(e.template));

export const expansionPreview = (e: TextExpander): string => {
    if (e.template && e.template.length > 0) {
        return e.template.map(n => {
            switch (n.type) {
                case 'text': return n.content;
                case 'step': return `[${n.label}]`;
                case 'choice': return `[${n.label}]`;
                case 'branch': return `[${n.triggerField}]`;
            }
        }).join(' - ');
    }
    return e.expansion;
};

interface TextExpanderManagerProps {
    expanders: TextExpander[];
    /** Tap a row → the panel lifts it and drops its item menu. */
    onCardTap: (expander: TextExpander, el: HTMLElement) => void;
    filter: string;
    clinicAbbrSet?: Set<string>;
    isSupervisorRole?: boolean;
    /** Multiselect (driven by the panel header's Add menu); keyed by abbr. */
    selectMode?: boolean;
    selected?: Set<string>;
    onToggleSelect?: (expander: TextExpander) => void;
}

/** Shortcut / template list. Add / Multiselect live on the container header; item
 *  actions ride the tapped row. */
export const TextExpanderManager = ({
    expanders,
    onCardTap,
    filter,
    clinicAbbrSet,
    isSupervisorRole = false,
    selectMode = false,
    selected,
    onToggleSelect,
}: TextExpanderManagerProps) => {
    const lc = filter.trim().toLowerCase();
    const visible = useMemo(() => {
        if (!lc) return expanders;
        return expanders.filter(e =>
            e.abbr.toLowerCase().includes(lc) ||
            expansionPreview(e).toLowerCase().includes(lc)
        );
    }, [expanders, lc]);

    return (
        <section className="space-y-3">
            <div className="rounded-xl bg-themewhite2 overflow-hidden">
                <div className="px-2 py-2">
                    {visible.length > 0 ? (
                        <div className="divide-y divide-tertiary/8">
                            {visible.map(e => {
                                const isTemplate = hasBranches(e);
                                const isClinic = clinicAbbrSet?.has(e.abbr.toLowerCase()) ?? false;
                                const canEdit = !isClinic || isSupervisorRole;
                                const selectable = selectMode && canEdit;
                                const checked = selected?.has(e.abbr) ?? false;
                                const Icon = isTemplate ? Layers : TextCursorInput;
                                const iconBg = isClinic ? 'bg-tertiary/10' : isTemplate ? 'bg-themepurple/15' : 'bg-themeblue2/15';
                                const iconColor = isClinic && !isSupervisorRole ? 'text-tertiary' : isTemplate ? 'text-themepurple' : 'text-themeblue2';

                                return (
                                    <div
                                        key={e.abbr}
                                        role="button"
                                        onClick={(ev) => {
                                            if (selectMode) { if (selectable) onToggleSelect?.(e); return; }
                                            onCardTap(e, ev.currentTarget);
                                        }}
                                        className={`flex items-start gap-3 py-2 px-2 rounded-lg transition-colors ${
                                            selectMode && !canEdit ? 'opacity-50' : 'cursor-pointer active:scale-[0.98] hover:bg-themeblue3/5'
                                        }`}
                                    >
                                        {selectable && <span className="pt-2"><SelectBox checked={checked} /></span>}
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                                            <Icon size={14} className={iconColor} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-sm font-medium text-primary truncate">{e.abbr}</p>
                                                {isClinic && (
                                                    <Building2 size={12} className="text-themeblue2 shrink-0" aria-label="Cluster" />
                                                )}
                                            </div>
                                            <p className="text-[9pt] text-tertiary mt-0.5 leading-relaxed">
                                                {expansionPreview(e)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-[10pt] text-tertiary py-8 text-center">
                            {lc ? 'No matches' : 'No templates yet — tap + to add one.'}
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
};
