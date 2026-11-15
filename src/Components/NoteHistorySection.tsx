import { useRef, useState, type ReactNode, type SetStateAction } from 'react';
import { Check, GripVertical, RotateCcw } from 'lucide-react';
import { ListItemRow } from '@/Components/primitives/ListItemRow';
import { ExpandableInput } from '@/Components/primitives/ExpandableInput';
import { ActionButton } from '@/Components/primitives/ActionButton';
import { FooterPill } from '@/Components/primitives/FooterPill';
import { PreviewOverlay } from './PreviewOverlay';
import { TextSectionEditor } from './Provider/ProviderPaneSections';
import { type StackScreen } from './stackNav';
import type { TextExpander } from '../Data/User';
import { HISTORY_FIELDS, orderedHistoryFields, type NoteHistory, type HistoryKey } from '../Utilities/noteHistory';

type SetHistory = (next: SetStateAction<NoteHistory>) => void;

const TEXTAREA_CLASS =
    'w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary ' +
    'focus:outline-none resize-none overflow-hidden min-h-[200px]';

/**
 * History items as PE-style rows under the HPI, two columns. Tap opens that item's
 * editor; the grip drags to reorder (note prints in this order). PE's list reorders
 * by vertical offset; a grid can't, so the drop target is whichever row is under the pointer.
 */
function HistoryRows({ value, onOpen, onReorder }: {
    value: NoteHistory;
    onOpen: (key: HistoryKey, anchor: DOMRect) => void;
    onReorder: (order: HistoryKey[]) => void;
}) {
    const fields = orderedHistoryFields(value);
    const dragRef = useRef<{ from: number; to: number; x: number; y: number } | null>(null);
    const [drag, setDrag] = useState<{ from: number; to: number; dx: number; dy: number } | null>(null);

    const onDragStart = (index: number, e: React.PointerEvent) => {
        dragRef.current = { from: index, to: index, x: e.clientX, y: e.clientY };
        setDrag({ from: index, to: index, dx: 0, dy: 0 });
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };
    const onDragMove = (e: React.PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const over = document.elementsFromPoint(e.clientX, e.clientY)
            .map(el => (el as HTMLElement).closest?.('[data-hx-index]') as HTMLElement | null)
            .find(el => el && Number(el.dataset.hxIndex) !== d.from);
        if (over) d.to = Number(over.dataset.hxIndex);
        setDrag({ from: d.from, to: d.to, dx: e.clientX - d.x, dy: e.clientY - d.y });
    };
    const onDragEnd = () => {
        const d = dragRef.current;
        if (d && d.from !== d.to) {
            const keys = fields.map(f => f.key);
            const [moved] = keys.splice(d.from, 1);
            keys.splice(d.to, 0, moved);
            onReorder(keys);
        }
        dragRef.current = null;
        setDrag(null);
    };

    return (
        <div className="grid grid-cols-2 gap-3 md:gap-2" onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
            {fields.map((f, i) => {
                const text = value[f.key].trim();
                const isDragging = drag?.from === i;
                return (
                    // ListItemRow's onClick carries no event; the wrapper supplies the overlay anchor.
                    <div
                        key={f.key}
                        data-hx-index={i}
                        className={`min-w-0 ${isDragging ? 'opacity-80 shadow-lg rounded-lg bg-themewhite2' : ''} ${drag && drag.to === i && !isDragging ? 'ring-1 ring-themeblue3/40 rounded-lg' : ''}`}
                        style={isDragging ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 50, position: 'relative' } : undefined}
                        onClick={(e) => onOpen(f.key, e.currentTarget.getBoundingClientRect())}
                    >
                        <ListItemRow
                            as="div"
                            className="py-2.5 active:scale-[0.98] transition-all cursor-pointer"
                            left={
                                <div
                                    className="shrink-0 text-tertiary touch-none cursor-grab active:cursor-grabbing"
                                    onPointerDown={(e) => onDragStart(i, e)}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <GripVertical size={16} />
                                </div>
                            }
                            center={
                                <>
                                    <p className="text-sm font-medium text-primary truncate">{f.label}</p>
                                    {text && (
                                        <p className="text-[9pt] mt-0.5 text-primary whitespace-pre-line break-words">{text}</p>
                                    )}
                                </>
                            }
                        />
                    </div>
                );
            })}
        </div>
    );
}

/**
 * History rows plus their editor, shared by Write Note and the provider note.
 * With onOpenPane (desktop) a tap routes to the caller's 's-hx' pane screen
 * (historyPaneScreen); without it the item edits in an anchored overlay.
 */
export function NoteHistorySection({ value, onChange, expanders, onOpenPane }: {
    value: NoteHistory;
    onChange: SetHistory;
    expanders?: TextExpander[];
    onOpenPane?: (key: HistoryKey) => void;
}) {
    const [field, setField] = useState<HistoryKey | null>(null);
    const [anchor, setAnchor] = useState<DOMRect | null>(null);
    const meta = field ? HISTORY_FIELDS.find(f => f.key === field) : undefined;
    const setField_ = (key: HistoryKey, v: string) => onChange(prev => ({ ...prev, [key]: v }));

    return (
        <>
            <HistoryRows
                value={value}
                onOpen={(key, a) => {
                    if (onOpenPane) { onOpenPane(key); return; }
                    setAnchor(a);
                    setField(key);
                }}
                onReorder={(order) => onChange(prev => ({ ...prev, order }))}
            />
            {!onOpenPane && (
                <PreviewOverlay
                    isOpen={field !== null}
                    onClose={() => setField(null)}
                    anchorRect={anchor}
                    title={meta?.label ?? 'History'}
                    previewMaxHeight="50dvh"
                    actions={field && value[field].trim() ? [{
                        key: 'reset',
                        label: 'Reset',
                        icon: RotateCcw,
                        closesOnAction: false,
                        onAction: () => setField_(field, ''),
                    }] : []}
                    rightFooter={
                        <FooterPill side="right">
                            <ActionButton icon={Check} label="Done" onClick={() => setField(null)} />
                        </FooterPill>
                    }
                >
                    {field && (
                        <ExpandableInput
                            value={value[field]}
                            onChange={(v) => setField_(field, v)}
                            expanders={expanders}
                            multiline
                            hideClear
                            className={TEXTAREA_CLASS}
                            placeholder={meta?.placeholder}
                        />
                    )}
                </PreviewOverlay>
            )}
        </>
    );
}

/** Desktop pane screen for one history item; open with params { key }. */
export function historyPaneScreen(value: NoteHistory, onChange: SetHistory, headerActions: ReactNode): StackScreen {
    const set = (key: HistoryKey, v: string) => onChange(prev => ({ ...prev, [key]: v }));
    return {
        title: (p: { key: HistoryKey }) => HISTORY_FIELDS.find(f => f.key === p.key)?.label ?? 'History',
        headerActions,
        footer: (p: { key: HistoryKey }) => value[p.key].trim() ? (
            <FooterPill side="left">
                <ActionButton icon={RotateCcw} label="Reset" onClick={() => set(p.key, '')} />
            </FooterPill>
        ) : undefined,
        render: (p: { key: HistoryKey }) => (
            <TextSectionEditor
                value={value[p.key]}
                onChange={(v) => set(p.key, v)}
                placeholder={HISTORY_FIELDS.find(f => f.key === p.key)?.placeholder ?? ''}
            />
        ),
    };
}
