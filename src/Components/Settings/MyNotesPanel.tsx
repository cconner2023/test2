import { useState, useCallback, useRef, useEffect } from 'react';
import { useDrag } from '@use-gesture/react';
import { FileText, Trash2, Share2, CheckSquare, Eye, ClipboardCopy } from 'lucide-react';
import type { SavedNote } from '../../Hooks/useNotesStorage';
import { useNoteShare } from '../../Hooks/useNoteShare';
import { getColorClasses } from '../../Utilities/ColorUtilities';
import type { dispositionType } from '../../Types/AlgorithmTypes';

/* ────────────────────────────────────────────────────────────
   Utility: format date (shared by note items)
   ──────────────────────────────────────────────────────────── */
const formatDate = (isoStr: string) => {
    try {
        const date = new Date(isoStr);
        const day = date.getDate().toString().padStart(2, '0');
        const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const year = date.getFullYear().toString().slice(2);
        const time = date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
        });
        return `${day}${month}${year} ${time}`;
    } catch {
        return 'Unknown date';
    }
};

/* ────────────────────────────────────────────────────────────
   NoteItemContent — Shared note display (icon, text, badge, date).
   Used by both SwipeableNoteItem (mobile) and NoteItemSettings (desktop).
   ──────────────────────────────────────────────────────────── */
const NoteItemContent = ({ note, isSelected }: { note: SavedNote; isSelected: boolean }) => (
    <div className="flex items-center gap-3 px-3 py-3">
        {isSelected && (
            <div className="shrink-0">
                <CheckSquare size={18} className="text-themeblue3" />
            </div>
        )}
        <div className="shrink-0 w-8 h-8 rounded-full bg-themeblue3/10 flex items-center justify-center text-sm">
            {note.symptomIcon || '\u{1F4CB}'}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">
                {note.symptomText || 'Note'}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-tertiary/60">
                    {formatDate(note.createdAt)}
                </p>
                {note.source?.startsWith('external') && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0">
                        {note.source.includes(':') ? note.source.split(':')[1] : 'External'}
                    </span>
                )}
            </div>
        </div>
        {note.dispositionType && (
            <span className={`text-[10px] font-medium px-2 py-1 rounded-full shrink-0 ${getColorClasses(note.dispositionType as dispositionType['type']).dispositionBadge}`}>
                {note.dispositionType}
            </span>
        )}
    </div>
);

/* ────────────────────────────────────────────────────────────
   SwipeableNoteItem — Mobile note item with swipe gestures.
   Uses plain CSS transform (no react-spring) for reliable touch.
   Swipe right → reveals View, Copy, Share (left side).
   Swipe left  → reveals Delete (right side).
   Tap → toggles selection.
   ──────────────────────────────────────────────────────────── */
const SNAP_LEFT = 160;
const SNAP_RIGHT = 70;
const SWIPE_THRESHOLD = 60;

const SwipeableNoteItem = ({
    note,
    onView,
    onCopy,
    onShare,
    onDelete,
    isSelected,
    onToggleSelect,
}: {
    note: SavedNote;
    onView: (note: SavedNote) => void;
    onCopy: (note: SavedNote) => void;
    onShare: (note: SavedNote) => void;
    onDelete: (noteId: string) => void;
    isSelected: boolean;
    onToggleSelect: (noteId: string) => void;
    shareStatus: string;
    copiedStatus: boolean;
}) => {
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isRevealed, setIsRevealed] = useState<'left' | 'right' | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout>>(0);

    useEffect(() => {
        return () => { if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current); };
    }, []);

    const closeSwipe = useCallback(() => {
        setOffsetX(0);
        setIsRevealed(null);
        setConfirmDelete(false);
    }, []);

    const bind = useDrag(
        ({ active, first, movement: [mx], tap, memo }) => {
            if (tap) return memo;

            const startOffset = first ? offsetX : (memo ?? 0);
            let newOffset = startOffset + mx;

            // Overshoot dampening beyond action widths
            if (newOffset > SNAP_LEFT) {
                const overshoot = newOffset - SNAP_LEFT;
                newOffset = SNAP_LEFT + overshoot * 0.3;
            } else if (newOffset < -SNAP_RIGHT) {
                const overshoot = Math.abs(newOffset) - SNAP_RIGHT;
                newOffset = -(SNAP_RIGHT + overshoot * 0.3);
            }

            if (active) {
                setIsDragging(true);
                setOffsetX(newOffset);
            } else {
                setIsDragging(false);
                if (newOffset > SWIPE_THRESHOLD) {
                    setOffsetX(SNAP_LEFT);
                    setIsRevealed('left');
                } else if (newOffset < -SWIPE_THRESHOLD) {
                    setOffsetX(-SNAP_RIGHT);
                    setIsRevealed('right');
                } else {
                    setOffsetX(0);
                    setIsRevealed(null);
                }
            }

            return startOffset;
        },
        { axis: 'x', filterTaps: true, pointer: { touch: true } }
    );

    const handleTap = useCallback(() => {
        if (isRevealed) {
            closeSwipe();
            return;
        }
        onToggleSelect(note.id);
    }, [isRevealed, closeSwipe, onToggleSelect, note.id]);

    return (
        <div className="relative mb-2 rounded-lg overflow-hidden">
            {/* Left actions (revealed by swiping right): View, Copy, Share */}
            {(offsetX > 0 || isRevealed === 'left') && (
                <div
                    className="absolute inset-y-0 left-0 flex items-center gap-1 pl-2 pr-1"
                    style={{ width: SNAP_LEFT }}
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); onView(note); closeSwipe(); }}
                        className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
                        aria-label="View note"
                    >
                        <div className="w-9 h-9 rounded-full bg-themeyellow/10 flex items-center justify-center">
                            <Eye size={16} className="text-themeyellow" />
                        </div>
                        <span className="text-[9px] font-normal text-tertiary">View</span>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onCopy(note); }}
                        className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
                        aria-label="Copy note"
                    >
                        <div className="w-9 h-9 rounded-full bg-themegreen/10 flex items-center justify-center">
                            <ClipboardCopy size={16} className="text-themegreen" />
                        </div>
                        <span className="text-[9px] font-normal text-tertiary">Copy</span>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onShare(note); }}
                        className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
                        aria-label="Share note"
                    >
                        <div className="w-9 h-9 rounded-full bg-themeblue3/30 flex items-center justify-center">
                            <Share2 size={16} className="text-themeblue2" />
                        </div>
                        <span className="text-[9px] font-normal text-tertiary">Share</span>
                    </button>
                </div>
            )}

            {/* Right action (revealed by swiping left): Delete */}
            {(offsetX < 0 || isRevealed === 'right') && (
                <div
                    className="absolute inset-y-0 right-0 flex items-center justify-center pr-2 pl-1"
                    style={{ width: SNAP_RIGHT }}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirmDelete) {
                                onDelete(note.id);
                                closeSwipe();
                            } else {
                                setConfirmDelete(true);
                                if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
                                confirmTimeoutRef.current = setTimeout(() => setConfirmDelete(false), 5000);
                            }
                        }}
                        className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
                        aria-label={confirmDelete ? 'Confirm delete' : 'Delete note'}
                    >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${confirmDelete ? 'bg-themeredred/40' : 'bg-themeredred/15'}`}>
                            <Trash2 size={16} className={confirmDelete ? 'text-themeredred' : 'text-themeredred'} />
                        </div>
                        <span className={`text-[9px] font-medium ${confirmDelete ? 'text-themeredred/60' : 'text-themeredred'}`}>
                            {confirmDelete ? 'Confirm' : 'Delete'}
                        </span>
                    </button>
                </div>
            )}

            {/* Foreground card — plain div with CSS transform (no react-spring) */}
            <div
                className={`relative bg-themewhite border rounded-lg ${isSelected
                    ? 'border-themeblue3/50 bg-themeblue3/5 ring-1 ring-themeblue3/20'
                    : 'border-tertiary/10'}`}
                style={{
                    transform: `translateX(${offsetX}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    touchAction: 'pan-y',
                    willChange: isDragging ? 'transform' : 'auto',
                }}
                {...bind()}
                onClick={handleTap}
            >
                <div className="flex items-center gap-3 px-3 py-3">
                    {isSelected && (
                        <div className="shrink-0">
                            <CheckSquare size={18} className="text-themeblue3" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary truncate">
                            {note.symptomText || 'Note'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-tertiary/60">
                                {formatDate(note.createdAt)}
                            </p>
                            {note.source?.startsWith('external') && (
                                <span className="text-[9px] font-normal px-1.5 py-0.5 rounded-full text-tertiary shrink-0">
                                    {note.source.includes(':') ? note.source.split(':')[1] : 'External'}
                                </span>
                            )}
                        </div>
                    </div>
                    {note.dispositionType && (
                        <span className={`text-[10px] font-medium px-2 py-1 rounded-full shrink-0 ${getColorClasses(note.dispositionType as dispositionType['type']).badgeBg}`}>
                            {note.dispositionType}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ────────────────────────────────────────────────────────────
   NoteItemSettings
   No per-item action menu. Selection indicated by checkbox highlight.
   Actions live in the bottom panel action bar.
   ──────────────────────────────────────────────────────────── */
const NoteItemSettings = ({
    note,
    isSelected,
    onToggleSelect,
}: {
    note: SavedNote;
    isSelected: boolean;
    onToggleSelect: (noteId: string) => void;
}) => (
    <div
        className={`relative rounded-lg mb-2 cursor-pointer transition-all duration-150 ${isSelected
            ? 'border-themeblue3/50 bg-themeblue3/5 ring-1 ring-themeblue3/20 border'
            : 'border border-tertiary/10 bg-themewhite hover:bg-themewhite2/50'
            }`}
        onClick={() => onToggleSelect(note.id)}
    >
        <NoteItemContent note={note} isSelected={isSelected} />
    </div>
);

/* ────────────────────────────────────────────────────────────
   MyNotesPanel — Embedded My Notes panel inside Settings drawer.
   Acts like the Release Notes panel - slides in from the right,
   has a back button to return to Settings main.
   Desktop: checkbox selection + bottom action bar.
   Mobile: swipe gestures + tap checkbox + shared bottom action bar.
   ──────────────────────────────────────────────────────────── */
export const MyNotesPanel = ({
    isMobile,
    notes,
    onDeleteNote,
    onViewNote,
    onCloseDrawer,
    initialSelectedId,
}: {
    isMobile: boolean;
    notes: SavedNote[];
    onDeleteNote: (noteId: string) => void;
    onEditNote?: (noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>) => void;
    onViewNote?: (note: SavedNote) => void;
    onCloseDrawer: () => void;
    initialSelectedId?: string | null;
}) => {
    // Shared state: checkbox selection + bottom action bar (both mobile & desktop)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [confirmDelete, setConfirmDelete] = useState(false);
    const confirmDeleteRef = useRef(false);
    const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout>>(0);

    // Shared state
    const [copiedStatus, setCopiedStatus] = useState(false);
    const { shareNote, shareStatus } = useNoteShare();

    // Pre-select for initially selected note
    useEffect(() => {
        if (initialSelectedId && notes.some(n => n.id === initialSelectedId)) {
            setSelectedIds(new Set([initialSelectedId]));
        }
    }, [initialSelectedId, notes]);

    // Clear selection when notes change (e.g., after delete)
    useEffect(() => {
        setSelectedIds(prev => {
            const noteIdSet = new Set(notes.map(n => n.id));
            const next = new Set<string>();
            prev.forEach(id => {
                if (noteIdSet.has(id)) next.add(id);
            });
            if (next.size !== prev.size) return next;
            return prev;
        });
    }, [notes]);

    // Shared handlers
    const handleToggleSelect = useCallback((noteId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(noteId)) {
                next.delete(noteId);
            } else {
                next.add(noteId);
            }
            return next;
        });
        confirmDeleteRef.current = false;
        setConfirmDelete(false);
    }, []);

    const handleClearSelection = useCallback(() => {
        setSelectedIds(new Set());
        confirmDeleteRef.current = false;
        setConfirmDelete(false);
    }, []);

    // View handler — closes drawer and opens note in WriteNotePage
    const handleViewNote = useCallback((note: SavedNote) => {
        onCloseDrawer();
        if (onViewNote) onViewNote(note);
    }, [onCloseDrawer, onViewNote]);

    const handleCopy = useCallback((note: SavedNote) => {
        if (note.encodedText) {
            navigator.clipboard.writeText(note.encodedText).then(() => {
                setCopiedStatus(true);
                setTimeout(() => setCopiedStatus(false), 2000);
            }).catch(() => {
                setCopiedStatus(true);
                setTimeout(() => setCopiedStatus(false), 2000);
            });
        }
    }, []);

    const handleShare = useCallback((note: SavedNote) => {
        shareNote(note, isMobile);
    }, [shareNote, isMobile]);

    const handleDelete = useCallback(() => {
        if (confirmDeleteRef.current) {
            selectedIds.forEach(id => onDeleteNote(id));
            setSelectedIds(new Set());
            confirmDeleteRef.current = false;
            setConfirmDelete(false);
            if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
        } else {
            confirmDeleteRef.current = true;
            setConfirmDelete(true);
            if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
            confirmTimeoutRef.current = setTimeout(() => {
                confirmDeleteRef.current = false;
                setConfirmDelete(false);
            }, 5000);
        }
    }, [selectedIds, onDeleteNote]);

    const selectedCount = selectedIds.size;
    const selectedNotes = notes.filter(n => selectedIds.has(n.id));
    const isSingleSelect = selectedCount === 1;
    const isMultiSelect = selectedCount > 1;
    const singleNote = isSingleSelect ? selectedNotes[0] : null;

    // View handler — unified for mobile and desktop
    const handleSingleView = useCallback((note: SavedNote) => {
        handleViewNote(note);
    }, [handleViewNote]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
                {notes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-tertiary/5 flex items-center justify-center mb-4">
                            <FileText size={28} className="text-tertiary/30" />
                        </div>
                        <p className="text-sm font-medium text-primary/70 mb-1">No saved notes</p>
                        <p className="text-xs text-tertiary/50 max-w-[240px]">
                            Notes you save from the Write Note page will appear here.
                        </p>
                    </div>
                ) : isMobile ? (
                    /* Mobile: swipe gestures + tap to select */
                    <div className="p-3">
                        <p className="text-[10px] text-tertiary/40 text-center mb-2">
                            Swipe for actions · Tap to select
                        </p>
                        {notes.map((note) => (
                            <SwipeableNoteItem
                                key={note.id}
                                note={note}
                                onView={handleViewNote}
                                onCopy={handleCopy}
                                onShare={handleShare}
                                onDelete={onDeleteNote}
                                isSelected={selectedIds.has(note.id)}
                                onToggleSelect={handleToggleSelect}
                                shareStatus={shareStatus}
                                copiedStatus={copiedStatus}
                            />
                        ))}
                    </div>
                ) : (
                    /* Desktop: checkbox selection + bottom action bar */
                    <div className="p-3 md:p-4">
                        <p className="text-[10px] text-tertiary/40 text-center mb-2">
                            Tap to select · Multi-select for bulk actions
                        </p>
                        {notes.map((note) => (
                            <NoteItemSettings
                                key={note.id}
                                note={note}
                                isSelected={selectedIds.has(note.id)}
                                onToggleSelect={handleToggleSelect}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Action Bar — visible when notes are selected (mobile & desktop) */}
            {selectedCount > 0 && (
                <div
                    className="shrink-0 border-t border-tertiary/10 bg-themewhite2"
                    style={isMobile ? { paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : undefined}
                >
                    {/* Selection info row */}
                    <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                        <span className="text-xs text-tertiary">
                            {selectedCount} {selectedCount === 1 ? 'note' : 'notes'} selected
                        </span>
                        <button
                            onClick={handleClearSelection}
                            className="px-3 py-1 text-xs rounded-full bg-themewhite3 text-tertiary hover:bg-tertiary/10 transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                    </div>

                    {/* Action buttons */}
                    <div className="px-4 pb-3">
                        {isSingleSelect && singleNote && (
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                <button
                                    onClick={() => handleSingleView(singleNote)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-full bg-themeyellow/10 text-themeyellow hover:bg-themeyellow/20 transition-all active:scale-95"
                                    title="View note in algorithm"
                                >
                                    <Eye size={14} />
                                    View
                                </button>
                                <button
                                    onClick={() => handleCopy(singleNote)}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-full transition-all active:scale-95 ${copiedStatus
                                        ? 'bg-themegreen/15 text-themegreen'
                                        : 'bg-themegreen/10 text-themegreen hover:bg-themegreen/20'
                                        }`}
                                    title="Copy encoded text"
                                >
                                    <ClipboardCopy size={14} />
                                    {copiedStatus ? 'Copied!' : 'Copy'}
                                </button>
                                <button
                                    onClick={() => handleShare(singleNote)}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-full transition-all active:scale-95 ${shareStatus === 'shared' || shareStatus === 'copied'
                                        ? 'bg-themegreen/15 text-themegreen'
                                        : shareStatus === 'generating' || shareStatus === 'sharing'
                                            ? 'bg-themeblue2/15 text-themeblue2'
                                            : 'bg-themeblue2/10 text-themeblue2 hover:bg-themeblue2/20'
                                        }`}
                                    title="Share note as image"
                                >
                                    <Share2 size={14} />
                                    {shareStatus === 'copied' ? 'Copied!' : shareStatus === 'shared' ? 'Shared!' : shareStatus === 'generating' || shareStatus === 'sharing' ? '...' : 'Share'}
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-full transition-all active:scale-95 ${confirmDelete
                                        ? 'bg-themeredred text-white'
                                        : 'bg-themeredred/10 text-themeredred hover:bg-themeredred/20'
                                        }`}
                                    title={confirmDelete ? 'Tap again to confirm delete' : 'Delete note'}
                                >
                                    <Trash2 size={14} />
                                    {confirmDelete ? 'Confirm' : 'Delete'}
                                </button>
                            </div>
                        )}

                        {isMultiSelect && (
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    onClick={handleDelete}
                                    className={`flex items-center gap-1.5 px-4 py-2 text-xs rounded-full transition-all active:scale-95 ${confirmDelete
                                        ? 'bg-themeredred text-white'
                                        : 'bg-themeredred text-white hover:bg-themeredred/80'
                                        }`}
                                >
                                    <Trash2 size={14} />
                                    {confirmDelete ? `Confirm Delete (${selectedCount})` : `Delete (${selectedCount})`}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
