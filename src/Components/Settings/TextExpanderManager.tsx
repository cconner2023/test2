import { useMemo, useRef } from 'react';
import { Plus, TextCursorInput, Layers } from 'lucide-react';
import type { TextExpander } from '../../Data/User';
import { isFlatTemplate } from '../../Utilities/templateParser';
import { ActionButton } from '../ActionButton';
import { SearchInput } from '../SearchInput';
import { ActionPill } from '../ActionPill'

const hasBranches = (e: TextExpander): boolean =>
    !!(e.template && e.template.length > 0 && !isFlatTemplate(e.template));

const expansionPreview = (e: TextExpander): string => {
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
    onCardTap: (expander: TextExpander, anchor: HTMLElement) => void;
    onStartNew: (anchor: HTMLElement) => void;
    filter: string;
    onFilterChange: (value: string) => void;
    clinicAbbrSet?: Set<string>;
    isSupervisorRole?: boolean;
}

export const TextExpanderManager = ({
    expanders,
    onCardTap,
    onStartNew,
    filter,
    onFilterChange,
    clinicAbbrSet,
    isSupervisorRole = false,
}: TextExpanderManagerProps) => {
    const fabRef = useRef<HTMLDivElement>(null);

    const lc = filter.trim().toLowerCase();
    const visible = useMemo(() => {
        if (!lc) return expanders;
        return expanders.filter(e =>
            e.abbr.toLowerCase().includes(lc) ||
            expansionPreview(e).toLowerCase().includes(lc)
        );
    }, [expanders, lc]);

    const hasItems = visible.length > 0;

    return (
        <section className="space-y-3">
            <SearchInput
                value={filter}
                onChange={onFilterChange}
                placeholder="Search shortcuts..."
            />

            <div data-tour="expander-list" className="relative rounded-xl bg-themewhite2 overflow-hidden">
                <ActionPill ref={fabRef} data-tour="expander-fab" shadow="sm" className="absolute top-2 right-2 z-10">
                    <ActionButton icon={Plus} label="New shortcut" onClick={() => fabRef.current && onStartNew(fabRef.current)} />
                </ActionPill>

                <div className="px-2 py-2">
                    {hasItems ? (
                        <div className="divide-y divide-tertiary/8">
                            {visible.map(e => {
                                const isTemplate = hasBranches(e);
                                const isClinic = clinicAbbrSet?.has(e.abbr.toLowerCase()) ?? false;
                                const canEdit = !isClinic || isSupervisorRole;
                                const Icon = isTemplate ? Layers : TextCursorInput;
                                const iconBg = isClinic ? 'bg-tertiary/10' : isTemplate ? 'bg-themepurple/15' : 'bg-themeblue2/15';
                                const iconColor = isClinic && !isSupervisorRole ? 'text-tertiary' : isTemplate ? 'text-themepurple' : 'text-themeblue2';

                                return (
                                    <div
                                        key={e.abbr}
                                        onClick={canEdit ? (ev) => onCardTap(e, ev.currentTarget) : undefined}
                                        className={`flex items-start gap-3 py-2 px-2 rounded-lg transition-colors ${
                                            canEdit ? 'cursor-pointer active:scale-[0.98] hover:bg-themeblue3/5' : 'opacity-60'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                                            <Icon size={14} className={iconColor} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-sm font-medium text-primary truncate">{e.abbr}</p>
                                                {isClinic && (
                                                    <span className="text-[9pt] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary shrink-0">
                                                        Clinic
                                                    </span>
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
                        <p className="text-sm text-tertiary py-8 text-center">
                            {lc ? 'No matches' : 'No templates yet — tap + to add one.'}
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
};
