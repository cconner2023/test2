import { useCallback, useMemo, useRef, useState } from 'react';
import { Plus, TextCursorInput, Layers, MessageSquare, Trash2, Building2 } from 'lucide-react';
import type { TextExpander } from '../../Data/User';
import { isFlatTemplate } from '../../Utilities/templateParser';
import { OverlayActionMenu } from '@/Components/primitives/OverlayActionMenu';
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu';
import { liftPressHandlers, type LiftPressState, type LiftSnapshot } from '../liftPress';
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu';

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
    clinicAbbrSet?: Set<string>;
    isSupervisorRole?: boolean;
    /** Cluster picker + Share/Export/Import items, folded into the single corner ⋯
     *  menu alongside the New action this manager owns. */
    cornerItems?: ContextMenuItem[];
    /** Per-row actions (long-press / right-click lifted-row menu). */
    onShareItem?: (expander: TextExpander) => void;
    onDeleteItem?: (expander: TextExpander) => void;
}

export const TextExpanderManager = ({
    expanders,
    onCardTap,
    onStartNew,
    filter,
    clinicAbbrSet,
    isSupervisorRole = false,
    cornerItems,
    onShareItem,
    onDeleteItem,
}: TextExpanderManagerProps) => {
    const fabRef = useRef<HTMLDivElement>(null);

    // Lift-and-clone row menu (long-press / right-click) — Share / Export / Delete
    // ride the row (clone includes the text) instead of an editor-header icon.
    const [lifted, setLifted] = useState<({ expander: TextExpander } & LiftSnapshot) | null>(null);
    const pressRef = useRef<LiftPressState | null>(null);
    const hasRowActions = !!(onShareItem || onDeleteItem);
    const makeHandlers = useCallback((expander: TextExpander) =>
        liftPressHandlers((snap) => setLifted({ expander, ...snap }), pressRef), []);

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
            <div className="relative">
                <OverlayActionMenu
                    ref={fabRef}
                    shadow="sm"
                    items={[
                        { key: 'new', label: 'New shortcut', icon: Plus, onAction: () => fabRef.current && onStartNew(fabRef.current) },
                        ...(cornerItems ?? []),
                    ]}
                />
                <div className="rounded-xl bg-themewhite2 overflow-hidden">
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
                                        onClick={canEdit ? (ev) => { if (pressRef.current?.fired) return; onCardTap(e, ev.currentTarget); } : undefined}
                                        {...(canEdit && hasRowActions ? makeHandlers(e) : {})}
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
            </div>

            {lifted && (
                <LiftedRowMenu
                    isOpen
                    anchorRect={lifted.rect}
                    row={<div dangerouslySetInnerHTML={{ __html: lifted.html }} />}
                    onClose={() => setLifted(null)}
                    layout="list"
                    items={[
                        ...(onShareItem ? [{ key: 'share', label: 'Share to chat', icon: MessageSquare, onAction: () => onShareItem(lifted.expander) }] : []),
                        ...(onDeleteItem ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteItem(lifted.expander) }] : []),
                    ] as ContextMenuItem[]}
                />
            )}
        </section>
    );
};
