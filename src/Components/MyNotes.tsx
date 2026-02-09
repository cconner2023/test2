// Components/MyNotes.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, FileText, Trash2, Pencil, Share2, CheckSquare, Square, Eye, ClipboardCopy } from 'lucide-react';
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
   NoteItem — A single note row. No per-item action menu.
   Selection is indicated by highlight/checkbox. Actions live
   in the bottom panel action bar.
   ──────────────────────────────────────────────────────────── */
const NoteItem = ({
    note,
    isMobile,
    isSelected,
    onToggleSelect,
    multiSelectMode,
}: {
    note: SavedNote;
    isMobile: boolean;
    isSelected: boolean;
    onToggleSelect: (noteId: string) => void;
    multiSelectMode: boolean;
}) => {
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

    return (
        <div
            className={`relative rounded-lg mb-2 cursor-pointer transition-all duration-150 ${
                isSelected
                    ? 'border-themeblue3/50 bg-themeblue3/5 ring-1 ring-themeblue3/20 border'
                    : 'border border-tertiary/10 bg-themewhite hover:bg-themewhite2/50'
            }`}
            onClick={() => onToggleSelect(note.id)}
        >
            {/* Note summary row */}
            <div className="flex items-center gap-3 px-3 py-3">
                {/* Selection indicator: checkbox in multi-select, radio-like in single */}
                <div className="shrink-0">
                    {isSelected ? (
                        <CheckSquare size={18} className="text-themeblue3" />
                    ) : (
                        <Square size={18} className="text-tertiary/30" />
                    )}
                </div>
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
    );
};

/* ────────────────────────────────────────────────────────────
   BottomActionBar — Fixed at the bottom of the drawer/panel.
   Single select: View, Edit, Copy, Share, Delete
   Multi-select: Delete only
   ──────────────────────────────────────────────────────────── */
const BottomActionBar = ({
    selectedNotes,
    selectedCount,
    isMobile,
    onView,
    onEditInWizard,
    onCopy,
    onShare,
    onDelete,
    onClearSelection,
    shareStatus,
    copiedStatus,
    confirmDelete,
}: {
    selectedNotes: SavedNote[];
    selectedCount: number;
    isMobile: boolean;
    onView: (note: SavedNote) => void;
    onEditInWizard: (note: SavedNote) => void;
    onCopy: (note: SavedNote) => void;
    onShare: (note: SavedNote) => void;
    onDelete: () => void;
    onClearSelection: () => void;
    shareStatus: string;
    copiedStatus: boolean;
    confirmDelete: boolean;
}) => {
    const isSingleSelect = selectedCount === 1;
    const isMultiSelect = selectedCount > 1;
    const singleNote = isSingleSelect ? selectedNotes[0] : null;

    return (
        <div className="shrink-0 border-t border-tertiary/10 bg-themewhite2">
            {/* Selection info row */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                <span className="text-xs text-tertiary">
                    {selectedCount} {selectedCount === 1 ? 'note' : 'notes'} selected
                </span>
                <button
                    onClick={onClearSelection}
                    className="px-3 py-1 text-xs rounded-full bg-themewhite3 text-tertiary hover:bg-tertiary/10 transition-all active:scale-95"
                >
                    Cancel
                </button>
            </div>

            {/* Action buttons */}
            <div className="px-4 pb-3">
                {isSingleSelect && singleNote && (
                    /* Single-select: full action set */
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                        <button
                            onClick={() => onView(singleNote)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-full bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-all active:scale-95"
                            title="View note in algorithm"
                        >
                            <Eye size={14} />
                            View
                        </button>
                        <button
                            onClick={() => onEditInWizard(singleNote)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-all active:scale-95"
                            title="Edit note"
                        >
                            <Pencil size={14} />
                            Edit
                        </button>
                        <button
                            onClick={() => onCopy(singleNote)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-full transition-all active:scale-95 ${
                                copiedStatus
                                    ? 'bg-green-500/15 text-green-600'
                                    : 'bg-teal-500/10 text-teal-600 hover:bg-teal-500/20'
                            }`}
                            title="Copy encoded text"
                        >
                            <ClipboardCopy size={14} />
                            {copiedStatus ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                            onClick={() => onShare(singleNote)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-full transition-all active:scale-95 ${
                                shareStatus === 'shared' || shareStatus === 'copied'
                                    ? 'bg-green-500/15 text-green-600'
                                    : shareStatus === 'generating' || shareStatus === 'sharing'
                                        ? 'bg-purple-500/15 text-purple-600'
                                        : 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20'
                            }`}
                            title="Share note as image"
                        >
                            <Share2 size={14} />
                            {shareStatus === 'copied' ? 'Copied!' : shareStatus === 'shared' ? 'Shared!' : shareStatus === 'generating' || shareStatus === 'sharing' ? '...' : 'Share'}
                        </button>
                        <button
                            onClick={onDelete}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-full transition-all active:scale-95 ${
                                confirmDelete
                                    ? 'bg-red-500 text-white'
                                    : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                            }`}
                            title={confirmDelete ? 'Tap again to confirm delete' : 'Delete note'}
                        >
                            <Trash2 size={14} />
                            {confirmDelete ? 'Confirm' : 'Delete'}
                        </button>
                    </div>
                )}

                {isMultiSelect && (
                    /* Multi-select: delete only */
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={onDelete}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs rounded-full transition-all active:scale-95 ${
                                confirmDelete
                                    ? 'bg-red-600 text-white'
                                    : 'bg-red-500 text-white hover:bg-red-600'
                            }`}
                        >
                            <Trash2 size={14} />
                            {confirmDelete ? `Confirm Delete (${selectedCount})` : `Delete (${selectedCount})`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ────────────────────────────────────────────────────────────
   MyNotesContent — Scrollable list content rendered once.
   Action menu is at the BOTTOM of the drawer, not per-item.
   ──────────────────────────────────────────────────────────── */
const MyNotesContent = ({
    onClose,
    isMobile,
    notes,
    onDeleteNote,
    onEditNote,
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
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Pre-select a note when initialSelectedId is provided (e.g., duplicate import detection)
    useEffect(() => {
        if (initialSelectedId && notes.some(n => n.id === initialSelectedId)) {
            setSelectedIds(new Set([initialSelectedId]));
        }
    }, [initialSelectedId, notes]);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const confirmDeleteRef = useRef(false);
    const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const [copiedStatus, setCopiedStatus] = useState(false);
    const { shareNote, shareStatus } = useNoteShare();

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
        // Clear confirm delete state when selection changes
        confirmDeleteRef.current = false;
        setConfirmDelete(false);
    }, []);

    const handleClearSelection = useCallback(() => {
        setSelectedIds(new Set());
        confirmDeleteRef.current = false;
        setConfirmDelete(false);
    }, []);

    const handleView = useCallback((note: SavedNote) => {
        if (onViewNote) onViewNote(note);
    }, [onViewNote]);

    const handleEditInWizard = useCallback((note: SavedNote) => {
        if (onEditNoteInWizard) onEditNoteInWizard(note);
    }, [onEditNoteInWizard]);

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
            // Second tap — actually delete
            selectedIds.forEach(id => onDeleteNote(id));
            setSelectedIds(new Set());
            confirmDeleteRef.current = false;
            setConfirmDelete(false);
            if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
        } else {
            // First tap — ask for confirmation
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
    const isMultiSelect = selectedCount > 1;

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
                            Tap to select · Multi-select for bulk actions
                        </p>
                        {notes.map((note) => (
                            <NoteItem
                                key={note.id}
                                note={note}
                                isMobile={isMobile}
                                isSelected={selectedIds.has(note.id)}
                                onToggleSelect={handleToggleSelect}
                                multiSelectMode={isMultiSelect}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Action Bar — only visible when notes are selected */}
            {selectedCount > 0 && (
                <BottomActionBar
                    selectedNotes={selectedNotes}
                    selectedCount={selectedCount}
                    isMobile={isMobile}
                    onView={handleView}
                    onEditInWizard={handleEditInWizard}
                    onCopy={handleCopy}
                    onShare={handleShare}
                    onDelete={handleDelete}
                    onClearSelection={handleClearSelection}
                    shareStatus={shareStatus}
                    copiedStatus={copiedStatus}
                    confirmDelete={confirmDelete}
                />
            )}
        </>
    );
};

/* ────────────────────────────────────────────────────────────
   MyNotes — Consolidated drawer using BaseDrawer for both
   mobile (bottom sheet) and desktop (modal panel).
   Action menu is at the BOTTOM of the drawer/panel, not
   per-item. Single-select shows full actions, multi-select
   shows only delete.
   ──────────────────────────────────────────────────────────── */
export function MyNotes({ isVisible, onClose, isMobile: externalIsMobile, notes, onDeleteNote, onEditNote, onViewNote, onEditNoteInWizard, initialSelectedId }: MyNotesProps) {
    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={onClose}
            isMobile={externalIsMobile}
            partialHeight="45dvh"
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
