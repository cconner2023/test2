// Components/MyNotes.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, FileText, Trash2, Eye, Share2, ClipboardCopy } from 'lucide-react';
import type { SavedNote } from '../Hooks/useNotesStorage';
import { useNoteShare } from '../Hooks/useNoteShare';
import { BaseDrawer } from './BaseDrawer';

interface MyNotesProps {
    isVisible: boolean;
    onClose: () => void;
    isMobile?: boolean;
    notes: SavedNote[];
    onDeleteNote: (noteId: string) => void;
    onEditNote?: (noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>) => void;
    onViewNote?: (note: SavedNote) => void;
    onEditNoteInWizard?: (note: SavedNote) => void;
    initialSelectedId?: string | null;
}

/* ────────────────────────────────────────────────────────────
   Utility: format date and disposition colors
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

const getDispositionColor = (type: string) => {
    if (type.includes('I') && !type.includes('II') && !type.includes('III') && !type.includes('IV')) return 'bg-red-500/10 text-red-600';
    if (type.includes('II') && !type.includes('III') && !type.includes('IV')) return 'bg-yellow-500/10 text-yellow-700';
    if (type.includes('III')) return 'bg-green-500/10 text-green-600';
    if (type.includes('IV')) return 'bg-blue-500/10 text-blue-600';
    return 'bg-tertiary/8 text-tertiary/60';
};

/* ────────────────────────────────────────────────────────────
   ActionMenu — Popup action menu shown on tap (both mobile & desktop).
   Displays View, Copy, Share, Delete actions for a note.
   ──────────────────────────────────────────────────────────── */
const ActionMenu = ({
    note,
    onView,
    onCopy,
    onShare,
    onDelete,
    onClose,
    shareStatus,
    copiedStatus,
}: {
    note: SavedNote;
    onView: (note: SavedNote) => void;
    onCopy: (note: SavedNote) => void;
    onShare: (note: SavedNote) => void;
    onDelete: (noteId: string) => void;
    onClose: () => void;
    shareStatus: string;
    copiedStatus: boolean;
}) => {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        return () => {
            if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
        };
    }, []);

    const handleDelete = () => {
        if (confirmDelete) {
            onDelete(note.id);
            onClose();
        } else {
            setConfirmDelete(true);
            if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
            confirmTimeoutRef.current = setTimeout(() => setConfirmDelete(false), 5000);
        }
    };

    return (
        <div className="flex items-center justify-center gap-2 flex-wrap px-3 py-2 bg-themewhite2/80 rounded-b-lg border-t border-tertiary/10" data-action-menu>
            <button
                onClick={(e) => { e.stopPropagation(); onView(note); onClose(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-all active:scale-95"
                title="View / Edit note"
            >
                <Eye size={13} />
                View
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); onCopy(note); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all active:scale-95 ${
                    copiedStatus
                        ? 'bg-green-500/15 text-green-600'
                        : 'bg-teal-500/10 text-teal-600 hover:bg-teal-500/20'
                }`}
                title="Copy encoded text"
            >
                <ClipboardCopy size={13} />
                {copiedStatus ? 'Copied!' : 'Copy'}
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); onShare(note); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all active:scale-95 ${
                    shareStatus === 'shared' || shareStatus === 'copied'
                        ? 'bg-green-500/15 text-green-600'
                        : shareStatus === 'generating' || shareStatus === 'sharing'
                            ? 'bg-purple-500/15 text-purple-600'
                            : 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20'
                }`}
                title="Share note as image"
            >
                <Share2 size={13} />
                {shareStatus === 'copied' ? 'Copied!' : shareStatus === 'shared' ? 'Shared!' : shareStatus === 'generating' || shareStatus === 'sharing' ? '...' : 'Share'}
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all active:scale-95 ${
                    confirmDelete
                        ? 'bg-red-500 text-white'
                        : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                }`}
                title={confirmDelete ? 'Confirm' : 'Delete note'}
                aria-label={confirmDelete ? 'Confirm' : 'Delete'}
            >
                <Trash2 size={13} />
                {confirmDelete ? 'Confirm' : 'Delete'}
            </button>
        </div>
    );
};

/* ────────────────────────────────────────────────────────────
   SwipeableNoteItem — Mobile note item with swipe gestures.
   Swipe left → reveals delete (right side).
   Swipe right → reveals view, copy, share (left side).
   Tap → toggles action menu (same as desktop).
   ──────────────────────────────────────────────────────────── */
const SWIPE_THRESHOLD = 60;     // px to trigger reveal
const ACTION_WIDTH_LEFT = 180;  // revealed action area width (left side: view/copy/share)
const ACTION_WIDTH_RIGHT = 80;  // revealed action area width (right side: delete)

const SwipeableNoteItem = ({
    note,
    onView,
    onCopy,
    onShare,
    onDelete,
    activeMenuId,
    onToggleMenu,
    shareStatus,
    copiedStatus,
}: {
    note: SavedNote;
    onView: (note: SavedNote) => void;
    onCopy: (note: SavedNote) => void;
    onShare: (note: SavedNote) => void;
    onDelete: (noteId: string) => void;
    activeMenuId: string | null;
    onToggleMenu: (noteId: string) => void;
    shareStatus: string;
    copiedStatus: boolean;
}) => {
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isRevealed, setIsRevealed] = useState<'left' | 'right' | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const touchRef = useRef<{
        startX: number;
        startY: number;
        startTime: number;
        direction: 'none' | 'horizontal' | 'vertical';
        startOffsetX: number;
    } | null>(null);

    const showMenu = activeMenuId === note.id;

    // Reset offset when this item's menu is closed
    useEffect(() => {
        if (!showMenu && isRevealed) {
            // Keep revealed state as-is
        }
    }, [showMenu, isRevealed]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
        };
    }, []);

    const closeSwipe = useCallback(() => {
        setOffsetX(0);
        setIsRevealed(null);
        setConfirmDelete(false);
    }, []);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchRef.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            startTime: performance.now(),
            direction: 'none',
            startOffsetX: offsetX,
        };
    }, [offsetX]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (!touchRef.current) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchRef.current.startX;
        const dy = touch.clientY - touchRef.current.startY;

        // Direction lock
        if (touchRef.current.direction === 'none') {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            touchRef.current.direction = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
        }

        if (touchRef.current.direction === 'vertical') {
            touchRef.current = null;
            return;
        }

        // Prevent vertical scroll while swiping horizontally
        e.preventDefault();

        setIsDragging(true);
        let newOffset = touchRef.current.startOffsetX + dx;

        // Clamp: right-swipe reveals left actions (positive offset), limited to ACTION_WIDTH_LEFT
        // left-swipe reveals right action (negative offset), limited to ACTION_WIDTH_RIGHT
        if (newOffset > ACTION_WIDTH_LEFT) {
            // Rubber band beyond limit
            const overshoot = newOffset - ACTION_WIDTH_LEFT;
            newOffset = ACTION_WIDTH_LEFT + overshoot * 0.3;
        } else if (newOffset < -ACTION_WIDTH_RIGHT) {
            const overshoot = Math.abs(newOffset) - ACTION_WIDTH_RIGHT;
            newOffset = -(ACTION_WIDTH_RIGHT + overshoot * 0.3);
        }

        setOffsetX(newOffset);
    }, []);

    const onTouchEnd = useCallback(() => {
        if (!touchRef.current) return;
        const { startX, startTime, direction: dir } = touchRef.current;
        touchRef.current = null;
        setIsDragging(false);

        if (dir !== 'horizontal') {
            return;
        }

        // Determine resting position based on offset
        if (offsetX > SWIPE_THRESHOLD) {
            // Reveal left actions (view, copy, share)
            setOffsetX(ACTION_WIDTH_LEFT);
            setIsRevealed('left');
        } else if (offsetX < -SWIPE_THRESHOLD) {
            // Reveal right action (delete)
            setOffsetX(-ACTION_WIDTH_RIGHT);
            setIsRevealed('right');
        } else {
            // Snap back
            setOffsetX(0);
            setIsRevealed(null);
        }
    }, [offsetX]);

    const handleTap = useCallback(() => {
        if (isDragging) return;
        // If swiped, close swipe first
        if (isRevealed) {
            closeSwipe();
            return;
        }
        onToggleMenu(note.id);
    }, [isDragging, isRevealed, closeSwipe, onToggleMenu, note.id]);

    const handleDeleteAction = useCallback(() => {
        if (confirmDelete) {
            onDelete(note.id);
            closeSwipe();
        } else {
            setConfirmDelete(true);
            if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
            confirmTimeoutRef.current = setTimeout(() => setConfirmDelete(false), 5000);
        }
    }, [confirmDelete, note.id, onDelete, closeSwipe]);

    return (
        <div className="relative mb-2 rounded-lg overflow-hidden" data-note-item={note.id}>
            {/* Left actions (revealed by swiping right): View, Copy, Share */}
            {(offsetX > 0 || isRevealed === 'left') && (
            <div
                className="absolute inset-y-0 left-0 flex items-center gap-1 pl-2 pr-1"
                style={{ width: ACTION_WIDTH_LEFT }}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); onView(note); closeSwipe(); }}
                    className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg bg-amber-500/15 text-amber-600 active:scale-95 transition-transform"
                    aria-label="View note"
                >
                    <Eye size={18} />
                    <span className="text-[9px] font-medium">View</span>
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onCopy(note); }}
                    className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg bg-teal-500/15 text-teal-600 active:scale-95 transition-transform"
                    aria-label="Copy note"
                >
                    <ClipboardCopy size={18} />
                    <span className="text-[9px] font-medium">{copiedStatus ? 'Copied!' : 'Copy'}</span>
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onShare(note); }}
                    className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg bg-purple-500/15 text-purple-600 active:scale-95 transition-transform"
                    aria-label="Share note"
                >
                    <Share2 size={18} />
                    <span className="text-[9px] font-medium">
                        {shareStatus === 'shared' || shareStatus === 'copied' ? 'Done!' : 'Share'}
                    </span>
                </button>
            </div>
            )}

            {/* Right action (revealed by swiping left): Delete */}
            {(offsetX < 0 || isRevealed === 'right') && (
            <div
                className="absolute inset-y-0 right-0 flex items-center justify-center pr-2 pl-1"
                style={{ width: ACTION_WIDTH_RIGHT }}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteAction(); }}
                    className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg active:scale-95 transition-all ${
                        confirmDelete
                            ? 'bg-red-500 text-white'
                            : 'bg-red-500/15 text-red-500'
                    }`}
                    aria-label={confirmDelete ? 'Confirm' : 'Delete note'}
                >
                    <Trash2 size={18} />
                    <span className="text-[9px] font-medium">{confirmDelete ? 'Confirm' : 'Delete'}</span>
                </button>
            </div>
            )}

            {/* Foreground: the actual note card, slides left/right */}
            <div
                className={`relative bg-themewhite border border-tertiary/10 rounded-lg ${
                    showMenu ? 'border-themeblue3/30 bg-themeblue3/5' : ''
                }`}
                style={{
                    transform: `translateX(${offsetX}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    touchAction: 'pan-y',
                    willChange: isDragging ? 'transform' : 'auto',
                }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onClick={handleTap}
            >
                {/* Note summary row */}
                <div className="flex items-center gap-3 px-3 py-3">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-themeblue3/10 flex items-center justify-center text-sm">
                        {note.symptomIcon || '\u{1F4CB}'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-primary truncate">
                                {note.symptomText || 'Note'}
                            </p>
                            {note.dispositionType && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${getDispositionColor(note.dispositionType)}`}>
                                    {note.dispositionType}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-tertiary/60">
                                {formatDate(note.createdAt)}
                            </p>
                            {note.source === 'external source' && (
                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0">
                                    External
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Action menu (shown on tap, both mobile and desktop) */}
            {showMenu && !isRevealed && (
                <ActionMenu
                    note={note}
                    onView={onView}
                    onCopy={onCopy}
                    onShare={onShare}
                    onDelete={onDelete}
                    onClose={() => onToggleMenu(note.id)}
                    shareStatus={shareStatus}
                    copiedStatus={copiedStatus}
                />
            )}
        </div>
    );
};

/* ────────────────────────────────────────────────────────────
   DesktopNoteItem — Desktop note item with tap-to-reveal
   action menu. No swipe gestures needed on desktop.
   ──────────────────────────────────────────────────────────── */
const DesktopNoteItem = ({
    note,
    onView,
    onCopy,
    onShare,
    onDelete,
    activeMenuId,
    onToggleMenu,
    shareStatus,
    copiedStatus,
}: {
    note: SavedNote;
    onView: (note: SavedNote) => void;
    onCopy: (note: SavedNote) => void;
    onShare: (note: SavedNote) => void;
    onDelete: (noteId: string) => void;
    activeMenuId: string | null;
    onToggleMenu: (noteId: string) => void;
    shareStatus: string;
    copiedStatus: boolean;
}) => {
    const showMenu = activeMenuId === note.id;

    return (
        <div className="relative mb-2 rounded-lg overflow-hidden" data-note-item={note.id}>
            <div
                className={`relative bg-themewhite border rounded-lg cursor-pointer transition-all duration-150 ${
                    showMenu
                        ? 'border-themeblue3/50 bg-themeblue3/5 ring-1 ring-themeblue3/20'
                        : 'border-tertiary/10 hover:bg-themewhite2/50'
                }`}
                onClick={() => onToggleMenu(note.id)}
            >
                {/* Note summary row */}
                <div className="flex items-center gap-3 px-3 py-3">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-themeblue3/10 flex items-center justify-center text-sm">
                        {note.symptomIcon || '\u{1F4CB}'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-primary truncate">
                                {note.symptomText || 'Note'}
                            </p>
                            {note.dispositionType && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${getDispositionColor(note.dispositionType)}`}>
                                    {note.dispositionType}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-tertiary/60">
                                {formatDate(note.createdAt)}
                            </p>
                            {note.source === 'external source' && (
                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0">
                                    External
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Action menu (shown on tap) */}
            {showMenu && (
                <ActionMenu
                    note={note}
                    onView={onView}
                    onCopy={onCopy}
                    onShare={onShare}
                    onDelete={onDelete}
                    onClose={() => onToggleMenu(note.id)}
                    shareStatus={shareStatus}
                    copiedStatus={copiedStatus}
                />
            )}
        </div>
    );
};

/* ────────────────────────────────────────────────────────────
   MyNotesContent — Scrollable list content.
   Mobile: swipe left/right + tap for action menu.
   Desktop: tap for action menu.
   View/Edit consolidated into single "View" action.
   ──────────────────────────────────────────────────────────── */
const MyNotesContent = ({
    onClose,
    isMobile,
    notes,
    onDeleteNote,
    onViewNote,
    onEditNoteInWizard,
    initialSelectedId,
}: {
    onClose: () => void;
    isMobile: boolean;
    notes: SavedNote[];
    onDeleteNote: (noteId: string) => void;
    onEditNote?: (noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>) => void;
    onViewNote?: (note: SavedNote) => void;
    onEditNoteInWizard?: (note: SavedNote) => void;
    initialSelectedId?: string | null;
}) => {
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [copiedStatus, setCopiedStatus] = useState(false);
    const { shareNote, shareStatus } = useNoteShare();

    // Pre-open menu for initially selected note
    useEffect(() => {
        if (initialSelectedId && notes.some(n => n.id === initialSelectedId)) {
            setActiveMenuId(initialSelectedId);
        }
    }, [initialSelectedId, notes]);

    // Close menu if the active note was deleted
    useEffect(() => {
        if (activeMenuId && !notes.some(n => n.id === activeMenuId)) {
            setActiveMenuId(null);
        }
    }, [notes, activeMenuId]);

    const handleToggleMenu = useCallback((noteId: string) => {
        setActiveMenuId(prev => prev === noteId ? null : noteId);
    }, []);

    // Consolidated View action: opens note in wizard for view/edit
    const handleView = useCallback((note: SavedNote) => {
        if (onEditNoteInWizard) {
            onEditNoteInWizard(note);
        } else if (onViewNote) {
            onViewNote(note);
        }
    }, [onViewNote, onEditNoteInWizard]);

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

    return (
        <>
            {/* Drag Handle - Only visible on mobile */}
            {isMobile && (
                <div className="flex justify-center pt-3 pb-2" data-drag-zone style={{ touchAction: 'none' }}>
                    <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
                </div>
            )}

            {/* Header */}
            <div className="px-6 border-b border-tertiary/10 py-2 md:py-3" data-drag-zone style={{ touchAction: 'none' }}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h2 className="text-[11pt] font-normal text-primary md:text-[12pt]">
                            My Notes
                        </h2>
                        {notes.length > 0 && (
                            <span className="text-xs text-tertiary/60 bg-tertiary/10 px-2 py-0.5 rounded-full">
                                {notes.length}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-themewhite2 md:hover:bg-themewhite active:scale-95 transition-all"
                        aria-label="Close"
                    >
                        <X size={24} className="text-tertiary" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div
                className={`overflow-y-auto flex-1 ${isMobile ? 'pb-[env(safe-area-inset-bottom)]' : ''}`}
            >
                {notes.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-tertiary/5 flex items-center justify-center mb-4">
                            <FileText size={28} className="text-tertiary/30" />
                        </div>
                        <p className="text-sm font-medium text-primary/70 mb-1">No saved notes</p>
                        <p className="text-xs text-tertiary/50 max-w-[240px]">
                            Notes you save from the Write Note page will appear here.
                        </p>
                    </div>
                ) : (
                    /* Note list */
                    <div className="p-3 md:p-4">
                        <p className="text-[10px] text-tertiary/40 text-center mb-2">
                            {isMobile ? 'Swipe or tap for actions' : 'Tap a note for actions'}
                        </p>
                        {notes.map((note) => (
                            isMobile ? (
                                <SwipeableNoteItem
                                    key={note.id}
                                    note={note}
                                    onView={handleView}
                                    onCopy={handleCopy}
                                    onShare={handleShare}
                                    onDelete={onDeleteNote}
                                    activeMenuId={activeMenuId}
                                    onToggleMenu={handleToggleMenu}
                                    shareStatus={shareStatus}
                                    copiedStatus={copiedStatus}
                                />
                            ) : (
                                <DesktopNoteItem
                                    key={note.id}
                                    note={note}
                                    onView={handleView}
                                    onCopy={handleCopy}
                                    onShare={handleShare}
                                    onDelete={onDeleteNote}
                                    activeMenuId={activeMenuId}
                                    onToggleMenu={handleToggleMenu}
                                    shareStatus={shareStatus}
                                    copiedStatus={copiedStatus}
                                />
                            )
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

/* ────────────────────────────────────────────────────────────
   MyNotes — Consolidated drawer using BaseDrawer for both
   mobile (bottom sheet) and desktop (modal panel).
   Mobile: swipe gestures + tap action menu.
   Desktop: tap action menu.
   View/Edit consolidated into single "View" action.
   ──────────────────────────────────────────────────────────── */
export function MyNotes({ isVisible, onClose, isMobile: externalIsMobile, notes, onDeleteNote, onEditNote, onViewNote, onEditNoteInWizard, initialSelectedId }: MyNotesProps) {
    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={onClose}
            isMobile={externalIsMobile}
            fullHeight="90dvh"
            backdropOpacity={0.9}
            desktopPosition="right"
            desktopContainerMaxWidth="max-w-315"
            desktopMaxWidth="max-w-sm"
            desktopPanelPadding=""
            desktopHeight="h-[500px]"
            desktopTopOffset="4.5rem"
        >
            {(handleClose) => (
                <MyNotesContent
                    onClose={handleClose}
                    isMobile={externalIsMobile ?? (typeof window !== 'undefined' && window.innerWidth < 768)}
                    notes={notes}
                    onDeleteNote={onDeleteNote}
                    onEditNote={onEditNote}
                    onViewNote={onViewNote}
                    onEditNoteInWizard={onEditNoteInWizard}
                    initialSelectedId={initialSelectedId}
                />
            )}
        </BaseDrawer>
    );
}
