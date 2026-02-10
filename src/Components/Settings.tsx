import { useState, useCallback, useRef, useEffect } from 'react';
import { useDrag } from '@use-gesture/react';
import { GESTURE_THRESHOLDS } from '../Utilities/GestureUtils';
import { X, Moon, Sun, Shield, HelpCircle, ChevronUp, User, ChevronRight, ChevronLeft, Bug, PlusCircle, RefreshCw, FileText, Trash2, Pencil, Share2, CheckSquare, Square, Eye, ClipboardCopy } from 'lucide-react';
import { ReleaseNotes, type ReleaseNoteTypes } from '../Data/Release';
import { BaseDrawer } from './BaseDrawer';
import type { SavedNote } from '../Hooks/useNotesStorage';
import { useNoteShare } from '../Hooks/useNoteShare';

interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    isMobile?: boolean;
    initialPanel?: 'main' | 'my-notes';
    initialSelectedId?: string | null;
    notes?: SavedNote[];
    onDeleteNote?: (noteId: string) => void;
    onEditNote?: (noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>) => void;
    onViewNote?: (note: SavedNote) => void;
    onEditNoteInWizard?: (note: SavedNote) => void;
}

// Extract the note type safely
type NoteType = Exclude<ReleaseNoteTypes['type'], undefined> | 'default';

const NOTE_ICONS: Record<NoteType, {
    icon: React.ComponentType<{ size: number; className: string }>;
    className: string
}> = {
    bug: { icon: Bug, className: "text-red-500" },
    added: { icon: PlusCircle, className: "text-green-500" },
    changed: { icon: RefreshCw, className: "text-blue-500" },
    default: { icon: PlusCircle, className: "text-tertiary" }
};

/* ────────────────────────────────────────────────────────────
   Utility: format date and disposition colors (shared by note items)
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
   ActionMenu — Popup action menu shown on tap (mobile).
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
    const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout>>(0);

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
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all active:scale-95 ${copiedStatus
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
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all active:scale-95 ${shareStatus === 'shared' || shareStatus === 'copied'
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
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all active:scale-95 ${confirmDelete
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
   Tap → toggles action menu.
   ──────────────────────────────────────────────────────────── */
const SWIPE_THRESHOLD = GESTURE_THRESHOLDS.REVEAL_THRESHOLD;
const ACTION_WIDTH_LEFT = GESTURE_THRESHOLDS.REVEAL_ACTION_WIDTH_LEFT;
const ACTION_WIDTH_RIGHT = GESTURE_THRESHOLDS.REVEAL_ACTION_WIDTH_RIGHT;

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
    const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout>>(0);

    const showMenu = activeMenuId === note.id;

    useEffect(() => {
        if (!showMenu && isRevealed) {
            // Keep revealed state as-is
        }
    }, [showMenu, isRevealed]);

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

    const bindSwipe = useDrag(
        ({ active, first, movement: [mx], tap, memo }) => {
            if (tap) return memo;

            // Capture starting offset at gesture start
            const startOffset = first ? offsetX : (memo ?? 0);

            let newOffset = startOffset + mx;

            // Overshoot dampening beyond action widths
            if (newOffset > ACTION_WIDTH_LEFT) {
                const overshoot = newOffset - ACTION_WIDTH_LEFT;
                newOffset = ACTION_WIDTH_LEFT + overshoot * GESTURE_THRESHOLDS.REVEAL_OVERSHOOT_DAMPENING;
            } else if (newOffset < -ACTION_WIDTH_RIGHT) {
                const overshoot = Math.abs(newOffset) - ACTION_WIDTH_RIGHT;
                newOffset = -(ACTION_WIDTH_RIGHT + overshoot * GESTURE_THRESHOLDS.REVEAL_OVERSHOOT_DAMPENING);
            }

            if (active) {
                setIsDragging(true);
                setOffsetX(newOffset);
            } else {
                setIsDragging(false);
                // Snap to revealed position or back to center
                if (newOffset > SWIPE_THRESHOLD) {
                    setOffsetX(ACTION_WIDTH_LEFT);
                    setIsRevealed('left');
                } else if (newOffset < -SWIPE_THRESHOLD) {
                    setOffsetX(-ACTION_WIDTH_RIGHT);
                    setIsRevealed('right');
                } else {
                    setOffsetX(0);
                    setIsRevealed(null);
                }
            }

            return startOffset;
        },
        {
            axis: 'x',
            filterTaps: true,
            pointer: { touch: true },
        }
    );

    const handleTap = useCallback(() => {
        if (isRevealed) {
            closeSwipe();
            return;
        }
        onToggleMenu(note.id);
    }, [isRevealed, closeSwipe, onToggleMenu, note.id]);

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
                        className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg active:scale-95 transition-all ${confirmDelete
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
                className={`relative bg-themewhite border border-tertiary/10 rounded-lg ${showMenu ? 'border-themeblue3/30 bg-themeblue3/5' : ''
                    }`}
                style={{
                    transform: `translateX(${offsetX}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    touchAction: 'pan-y',
                    willChange: isDragging ? 'transform' : 'auto',
                }}
                {...bindSwipe()}
                onClick={handleTap}
            >
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
                                <span className="text-[9px] font-normal px-1.5 py-0.5 rounded-full bg-themeyellow text-black shrink-0">
                                    External
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Action menu (shown on tap) */}
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

const ReleaseNoteItem = ({ note }: { note: ReleaseNoteTypes }) => {
    const noteType: NoteType = note.type || 'default';
    const { icon: Icon, className } = NOTE_ICONS[noteType];

    return (
        <div className="flex items-start mb-2 last:mb-0">
            <div className="mt-1.5 mr-3">
                <Icon size={14} className={className} />
            </div>
            <p className="text-sm text-tertiary/80 flex-1">{note.text}</p>
        </div>
    );
};

const ReleaseNotesPanel = ({ onBack, isMobile }: { onBack: () => void; isMobile: boolean }) => {
    const groupedNotes = ReleaseNotes.reduce<Record<string, ReleaseNoteTypes[]>>((acc, note) => {
        const version = note.version;
        if (!acc[version]) acc[version] = [];
        acc[version].push(note);
        return acc;
    }, {});

    const versions = Object.keys(groupedNotes).sort((a, b) => parseFloat(b) - parseFloat(a));

    return (
        <div className="h-full flex flex-col">
            {isMobile && (
                <div className="flex justify-center pt-3 pb-2" data-drag-zone style={{ touchAction: 'none' }}>
                    <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
                </div>
            )}
            <div className="px-6 border-b border-tertiary/10 py-4 md:py-5">
                <div className="flex items-center">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all mr-2"
                        aria-label="Go back"
                    >
                        <ChevronLeft size={24} className="text-tertiary" />
                    </button>
                    <h2 className="text-xl font-semibold text-primary md:text-2xl">Release Notes</h2>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 md:p-6">
                {versions.map((version, versionIndex) => {
                    const notes = groupedNotes[version];
                    const isLatest = versionIndex === 0;

                    return (
                        <div
                            key={version}
                            className={`${versionIndex > 0 ? 'pt-6 border-t border-tertiary/10' : 'mb-6'}`}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-primary">Version {version}</h3>
                                {isLatest && (
                                    <span className="text-xs text-tertiary/60 bg-tertiary/10 px-2 py-1 rounded-full">
                                        Latest
                                    </span>
                                )}
                            </div>
                            <div className="space-y-1">
                                {notes.map((note, noteIndex) => (
                                    <ReleaseNoteItem
                                        key={`${version}-${noteIndex}`}
                                        note={note}
                                    />
                                ))}
                            </div>
                            {notes[0]?.date && (
                                <p className="text-xs text-tertiary/60 mt-3">Released: {notes[0].date}</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const MainSettingsPanel = ({
    settingsOptions,
    onItemClick,
    onClose,
    isMobile
}: {
    settingsOptions: Array<{
        icon: React.ReactNode;
        label: string;
        action: () => void;
        color: string;
        id: number;
    }>;
    onItemClick: (id: number) => void;
    onClose: () => void;
    isMobile: boolean;
}) => (
    <div className="h-full flex flex-col">
        {isMobile && (
            <div className="flex justify-center pt-3 pb-2" data-drag-zone style={{ touchAction: 'none' }}>
                <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
            </div>
        )}

        <div className="px-6 border-b border-tertiary/10 py-3 md:py-4" data-drag-zone style={{ touchAction: 'none' }}>
            <div className="flex items-center justify-between">
                <h2 className="text-[11pt] font-normal text-primary md:text-2xl">Settings</h2>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-themewhite2 md:hover:bg-themewhite active:scale-95 transition-all"
                    aria-label="Close"
                >
                    <X size={24} className="text-tertiary" />
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <div className="mb-4 pb-4 border-b border-tertiary/10">
                    <div className="flex items-center w-full px-4 py-3.5 hover:bg-themewhite2/10 active:scale-[0.98]
                                  transition-all cursor-pointer group
                                  md:px-5 md:py-4">
                        <div className="mr-4 w-12 h-12 rounded-full bg-themewhite flex items-center justify-center text-primary shrink-0">
                            <User size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-primary md:text-lg">User</p>
                            <p className="text-xs text-tertiary/60 md:text-sm">Coming Soon</p>
                        </div>
                        <ChevronRight size={20} className="text-tertiary/40 shrink-0" />
                    </div>
                </div>

                <div className="space-y-1 md:space-y-3">
                    {settingsOptions.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => {
                                option.action();
                                onItemClick(option.id);
                            }}
                            className="flex items-center w-full px-4 py-3.5 hover:bg-themewhite2 active:scale-[0.98]
                                     transition-all rounded-xl group
                                     md:px-5 md:py-4"
                        >
                            <div className={`mr-4 ${option.color} md:group-hover:scale-110 md:transition-transform`}>
                                {option.icon}
                            </div>
                            <span className="flex-1 text-left text-base text-primary font-medium md:text-lg">
                                {option.label}
                            </span>
                            <ChevronUp size={16} className="text-tertiary/40 rotate-90 md:hidden" />
                        </button>
                    ))}
                </div>

                <div className="mt-8 pt-6 border-t border-tertiary/10 md:mt-10">
                    <div className="text-center">
                        <p className="text-sm text-tertiary/60 font-medium md:text-base">Version 2.6.0</p>
                        <p className="text-xs text-tertiary/40 mt-1 md:text-sm">ADTMC MEDCOM PAM 40-7-21</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

/* ────────────────────────────────────────────────────────────
   NoteItemSettings — A single note row for the Settings-embedded My Notes panel.
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
}) => {
    return (
        <div
            className={`relative rounded-lg mb-2 cursor-pointer transition-all duration-150 ${isSelected
                ? 'border-themeblue3/50 bg-themeblue3/5 ring-1 ring-themeblue3/20 border'
                : 'border border-tertiary/10 bg-themewhite hover:bg-themewhite2/50'
                }`}
            onClick={() => onToggleSelect(note.id)}
        >
            <div className="flex items-center gap-3 px-3 py-3">
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
                            <span className="text-[10px] text-tertiary/60 bg-tertiary/8 px-1.5 py-0.5 rounded shrink-0">
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
   MyNotesPanel — Embedded My Notes panel inside Settings drawer.
   Acts like the Release Notes panel - slides in from the right,
   has a back button to return to Settings main.
   Desktop: checkbox selection + bottom action bar.
   Mobile: swipe gestures + tap action menu (SwipeableNoteItem).
   ──────────────────────────────────────────────────────────── */
const MyNotesPanel = ({
    onBack,
    isMobile,
    notes,
    onDeleteNote,
    onEditNote,
    onViewNote,
    onEditNoteInWizard,
    onCloseDrawer,
    initialSelectedId,
}: {
    onBack: () => void;
    isMobile: boolean;
    notes: SavedNote[];
    onDeleteNote: (noteId: string) => void;
    onEditNote?: (noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>) => void;
    onViewNote?: (note: SavedNote) => void;
    onEditNoteInWizard?: (note: SavedNote) => void;
    onCloseDrawer: () => void;
    initialSelectedId?: string | null;
}) => {
    // Desktop state: checkbox selection + bottom action bar
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [confirmDelete, setConfirmDelete] = useState(false);
    const confirmDeleteRef = useRef(false);
    const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout>>(0);

    // Mobile state: swipe + tap action menu
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    // Shared state
    const [copiedStatus, setCopiedStatus] = useState(false);
    const { shareNote, shareStatus } = useNoteShare();

    // Pre-select / pre-open menu for initially selected note
    useEffect(() => {
        if (initialSelectedId && notes.some(n => n.id === initialSelectedId)) {
            if (isMobile) {
                setActiveMenuId(initialSelectedId);
            } else {
                setSelectedIds(new Set([initialSelectedId]));
            }
        }
    }, [initialSelectedId, notes, isMobile]);

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

    // Close mobile menu if the active note was deleted
    useEffect(() => {
        if (activeMenuId && !notes.some(n => n.id === activeMenuId)) {
            setActiveMenuId(null);
        }
    }, [notes, activeMenuId]);

    // Desktop handlers
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

    // Mobile handlers
    const handleToggleMenu = useCallback((noteId: string) => {
        setActiveMenuId(prev => prev === noteId ? null : noteId);
    }, []);

    // Mobile view: consolidated view action (opens note in wizard)
    const handleMobileView = useCallback((note: SavedNote) => {
        onCloseDrawer();
        if (onEditNoteInWizard) {
            onEditNoteInWizard(note);
        } else if (onViewNote) {
            onViewNote(note);
        }
    }, [onCloseDrawer, onEditNoteInWizard, onViewNote]);

    // Desktop view/edit handlers
    const handleViewNote = useCallback((note: SavedNote) => {
        onCloseDrawer();
        if (onViewNote) onViewNote(note);
    }, [onCloseDrawer, onViewNote]);

    const handleEditNoteInWizard = useCallback((note: SavedNote) => {
        onCloseDrawer();
        if (onEditNoteInWizard) onEditNoteInWizard(note);
    }, [onCloseDrawer, onEditNoteInWizard]);

    // Shared handlers
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

    return (
        <div className="h-full flex flex-col">
            {isMobile && (
                <div className="flex justify-center pt-3 pb-2" data-drag-zone style={{ touchAction: 'none' }}>
                    <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
                </div>
            )}
            <div className="px-6 border-b border-tertiary/10 py-4 md:py-5">
                <div className="flex items-center">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all mr-2"
                        aria-label="Go back"
                    >
                        <ChevronLeft size={24} className="text-tertiary" />
                    </button>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-primary md:text-2xl">My Notes</h2>
                        {notes.length > 0 && (
                            <span className="text-xs text-tertiary/60 bg-tertiary/10 px-2 py-0.5 rounded-full">
                                {notes.length}
                            </span>
                        )}
                    </div>
                </div>
            </div>

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
                    /* Mobile: swipe gestures + tap action menu */
                    <div className="p-3">
                        <p className="text-[10px] text-tertiary/40 text-center mb-2">
                            Swipe or tap for actions
                        </p>
                        {notes.map((note) => (
                            <SwipeableNoteItem
                                key={note.id}
                                note={note}
                                onView={handleMobileView}
                                onCopy={handleCopy}
                                onShare={handleShare}
                                onDelete={onDeleteNote}
                                activeMenuId={activeMenuId}
                                onToggleMenu={handleToggleMenu}
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

            {/* Bottom Action Bar — desktop only, visible when notes are selected */}
            {!isMobile && selectedCount > 0 && (
                <div className="shrink-0 border-t border-tertiary/10 bg-themewhite2">
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
                                    onClick={() => handleViewNote(singleNote)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-full bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-all active:scale-95"
                                    title="View note in algorithm"
                                >
                                    <Eye size={14} />
                                    View
                                </button>
                                <button
                                    onClick={() => handleEditNoteInWizard(singleNote)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-all active:scale-95"
                                    title="Edit note"
                                >
                                    <Pencil size={14} />
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleCopy(singleNote)}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-full transition-all active:scale-95 ${copiedStatus
                                        ? 'bg-green-500/15 text-green-600'
                                        : 'bg-teal-500/10 text-teal-600 hover:bg-teal-500/20'
                                        }`}
                                    title="Copy encoded text"
                                >
                                    <ClipboardCopy size={14} />
                                    {copiedStatus ? 'Copied!' : 'Copy'}
                                </button>
                                <button
                                    onClick={() => handleShare(singleNote)}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-full transition-all active:scale-95 ${shareStatus === 'shared' || shareStatus === 'copied'
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
                                    onClick={handleDelete}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-full transition-all active:scale-95 ${confirmDelete
                                        ? 'bg-themeredred text-white'
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
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    onClick={handleDelete}
                                    className={`flex items-center gap-1.5 px-4 py-2 text-xs rounded-full transition-all active:scale-95 ${confirmDelete
                                        ? 'bg-themeredred text-white'
                                        : 'bg-themeredred text-white hover:bg-red-600'
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

// Content wrapper with slide animation
const ContentWrapper = ({
    children,
    slideDirection
}: {
    children: React.ReactNode;
    slideDirection: 'left' | 'right' | '';
}) => {
    const slideClasses = {
        '': '',
        'left': 'animate-slide-in-left',
        'right': 'animate-slide-in-right'
    };

    return (
        <div className={`h-full w-full ${slideClasses[slideDirection]}`}>
            {children}
        </div>
    );
};

export const Settings = ({
    isVisible,
    onClose,
    isDarkMode,
    onToggleTheme,
    isMobile: externalIsMobile,
    initialPanel,
    initialSelectedId,
    notes = [],
    onDeleteNote,
    onEditNote,
    onViewNote,
    onEditNoteInWizard,
}: SettingsDrawerProps) => {
    const [activePanel, setActivePanel] = useState<'main' | 'release-notes' | 'my-notes'>('main');
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');
    const prevVisibleRef = useRef(false);

    // Set initial panel when drawer opens
    useEffect(() => {
        if (isVisible && !prevVisibleRef.current) {
            setActivePanel(initialPanel || 'main');
            setSlideDirection('');
        }
        prevVisibleRef.current = isVisible;
    }, [isVisible, initialPanel]);

    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        setSlideDirection(direction);
        setTimeout(() => setSlideDirection(''), 300);
    }, []);

    const handleItemClick = useCallback((id: number, closeDrawer: () => void) => {
        switch (id) {
            case -1:
                closeDrawer();
                break;
            case -2:
                handleSlideAnimation('right');
                setActivePanel('main');
                break;
            case 1:
                // My Notes — slide into my-notes panel within Settings
                handleSlideAnimation('left');
                setActivePanel('my-notes');
                break;
            case 4:
                handleSlideAnimation('left');
                setActivePanel('release-notes');
                break;
            default:
                break;
        }
    }, [handleSlideAnimation]);

    const buildSettingsOptions = useCallback((closeDrawer: () => void) => [
        {
            icon: <FileText size={20} />,
            label: 'My Notes',
            action: () => handleItemClick(1, closeDrawer),
            color: 'text-tertiary',
            id: 1
        },
        {
            icon: isDarkMode ? <Sun size={20} /> : <Moon size={20} />,
            label: 'Toggle Theme',
            action: onToggleTheme,
            color: 'text-primary',
            id: 0
        },
        {
            icon: <Shield size={20} />,
            label: 'Release Notes',
            action: () => handleItemClick(4, closeDrawer),
            color: 'text-tertiary',
            id: 4
        },
        {
            icon: <HelpCircle size={20} />,
            label: 'Help & Support',
            action: () => null,
            color: 'text-tertiary',
            id: 5
        }
    ], [isDarkMode, onToggleTheme, handleItemClick]);

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={() => { setActivePanel('main'); setSlideDirection(''); onClose(); }}
            isMobile={externalIsMobile}
            fullHeight="90dvh"
            backdropOpacity={0.9}
            desktopPosition="right"
            desktopContainerMaxWidth="max-w-315"
            desktopMaxWidth="max-w-sm"
            desktopPanelPadding=""
            desktopHeight="h-[550px]"
            desktopTopOffset="4.5rem"
            disableDrag={false}
        >
            {(handleClose) => (
                <ContentWrapper slideDirection={slideDirection}>
                    {activePanel === 'main' ? (
                        <MainSettingsPanel
                            settingsOptions={buildSettingsOptions(handleClose)}
                            onItemClick={(id) => handleItemClick(id, handleClose)}
                            onClose={handleClose}
                            isMobile={externalIsMobile ?? (typeof window !== 'undefined' && window.innerWidth < 768)}
                        />
                    ) : activePanel === 'release-notes' ? (
                        <ReleaseNotesPanel onBack={() => handleItemClick(-2, handleClose)} isMobile={externalIsMobile ?? (typeof window !== 'undefined' && window.innerWidth < 768)} />
                    ) : (
                        <MyNotesPanel
                            onBack={() => handleItemClick(-2, handleClose)}
                            isMobile={externalIsMobile ?? (typeof window !== 'undefined' && window.innerWidth < 768)}
                            notes={notes}
                            onDeleteNote={onDeleteNote || (() => { })}
                            onEditNote={onEditNote}
                            onViewNote={onViewNote}
                            onEditNoteInWizard={onEditNoteInWizard}
                            onCloseDrawer={handleClose}
                            initialSelectedId={initialSelectedId}
                        />
                    )}
                </ContentWrapper>
            )}
        </BaseDrawer>
    );
};
