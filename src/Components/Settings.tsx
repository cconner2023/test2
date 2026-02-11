import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useDrag } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/web';
import { Moon, Sun, Shield, HelpCircle, ChevronUp, User, ChevronRight, Bug, PlusCircle, RefreshCw, FileText, Trash2, Share2, CheckSquare, Eye, ClipboardCopy } from 'lucide-react';
import { ReleaseNotes, type ReleaseNoteTypes } from '../Data/Release';
import { BaseDrawer } from './BaseDrawer';
import type { SavedNote } from '../Hooks/useNotesStorage';
import { useNoteShare } from '../Hooks/useNoteShare';
import { GESTURE_THRESHOLDS, SPRING_CONFIGS, clamp, dampedOffset } from '../Utilities/GestureUtils';
import { getColorClasses } from '../Utilities/ColorUtilities';
import type { dispositionType } from '../Types/AlgorithmTypes';

interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    isMobile?: boolean;
    initialPanel?: 'main' | 'my-notes' | 'release-notes';
    initialSelectedId?: string | null;
    notes?: SavedNote[];
    onDeleteNote?: (noteId: string) => void;
    onEditNote?: (noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>) => void;
    onViewNote?: (note: SavedNote) => void;
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

/* ────────────────────────────────────────────────────────────
   SwipeableNoteItem — Mobile note item with swipe gestures.
   Swipe left → reveals delete (right side).
   Swipe right → reveals view, copy, share (left side).
   Tap → toggles checkbox selection for bottom action bar.
   Action circles grow during swipe & bounce on overswipe.
   ──────────────────────────────────────────────────────────── */
const ACTION_WIDTH_LEFT = 160;
const ACTION_WIDTH_RIGHT = 70;

const SwipeableNoteItem = ({
    note,
    onView,
    onCopy,
    onShare,
    onDelete,
    isSelected,
    onToggleSelect,
    shareStatus,
    copiedStatus,
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
    const [isRevealed, setIsRevealed] = useState<'left' | 'right' | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout>>(0);
    const confirmDeleteStateRef = useRef(false);
    confirmDeleteStateRef.current = confirmDelete;
    const snapTargetRef = useRef(0);

    const [{ x }, api] = useSpring(() => ({ x: 0, config: SPRING_CONFIGS.snap }));

    // Staggered per-button reveals: each button starts later, slides in from a small offset
    const STAGGER = 20;  // px offset between each button's reveal start
    const SLIDE = 10;    // px horizontal slide distance per button

    const leftButton = (index: number) => {
        const start = index * STAGGER;
        const end = ACTION_WIDTH_LEFT * 0.65 + index * STAGGER;
        return {
            scale: x.to(v => clamp((v - start) / (end - start), 0, 1)),
            slideX: x.to(v => {
                const t = clamp((v - start) / (end - start), 0, 1);
                return (1 - t) * -SLIDE;
            }),
        };
    };

    const rightButton = {
        scale: x.to(v => clamp(-v / (ACTION_WIDTH_RIGHT * 0.8), 0, 1)),
        slideX: x.to(v => {
            const t = clamp(-v / (ACTION_WIDTH_RIGHT * 0.8), 0, 1);
            return (1 - t) * SLIDE;
        }),
    };

    useEffect(() => {
        return () => {
            if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
        };
    }, []);

    // Keep card revealed while delete confirmation is active
    useEffect(() => {
        if (confirmDelete) {
            snapTargetRef.current = -ACTION_WIDTH_RIGHT;
            api.start({ x: -ACTION_WIDTH_RIGHT, config: SPRING_CONFIGS.snap });
            setIsRevealed('right');
        }
    }, [confirmDelete, api]);

    const closeSwipe = useCallback(() => {
        snapTargetRef.current = 0;
        api.start({ x: 0, config: SPRING_CONFIGS.snap });
        setIsRevealed(null);
        setConfirmDelete(false);
    }, [api]);

    const bindSwipe = useDrag(
        ({ active, first, movement: [mx], tap, memo }) => {
            if (tap) return memo;

            const startOffset = first ? snapTargetRef.current : (memo ?? 0);
            const rawOffset = startOffset + mx;

            // Rubber-band dampening beyond action widths
            const newOffset = rawOffset >= 0
                ? dampedOffset(rawOffset, ACTION_WIDTH_LEFT)
                : -dampedOffset(-rawOffset, ACTION_WIDTH_RIGHT);

            if (active) {
                api.start({ x: newOffset, immediate: true });
            } else {
                // Keep card revealed while delete confirmation is active
                if (confirmDeleteStateRef.current) {
                    snapTargetRef.current = -ACTION_WIDTH_RIGHT;
                    api.start({ x: -ACTION_WIDTH_RIGHT, config: SPRING_CONFIGS.snap });
                    return startOffset;
                }

                // Determine if released from overswipe
                const wasOverswipeLeft = newOffset > ACTION_WIDTH_LEFT;
                const wasOverswipeRight = newOffset < -ACTION_WIDTH_RIGHT;

                if (newOffset > GESTURE_THRESHOLDS.NOTE_SWIPE_THRESHOLD) {
                    snapTargetRef.current = ACTION_WIDTH_LEFT;
                    api.start({
                        x: ACTION_WIDTH_LEFT,
                        config: wasOverswipeLeft ? SPRING_CONFIGS.bounce : SPRING_CONFIGS.snap,
                    });
                    setIsRevealed('left');
                } else if (newOffset < -GESTURE_THRESHOLDS.NOTE_SWIPE_THRESHOLD) {
                    snapTargetRef.current = -ACTION_WIDTH_RIGHT;
                    api.start({
                        x: -ACTION_WIDTH_RIGHT,
                        config: wasOverswipeRight ? SPRING_CONFIGS.bounce : SPRING_CONFIGS.snap,
                    });
                    setIsRevealed('right');
                } else {
                    snapTargetRef.current = 0;
                    api.start({ x: 0, config: SPRING_CONFIGS.snap });
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
            if (confirmDelete) return;
            closeSwipe();
            return;
        }
        onToggleSelect(note.id);
    }, [isRevealed, confirmDelete, closeSwipe, onToggleSelect, note.id]);

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
            {/* Left actions (revealed by swiping right): View, Copy, Share — staggered */}
            <div
                className="absolute inset-y-0 left-0 flex items-center justify-center gap-3 pl-3 pr-1"
                style={{
                    width: ACTION_WIDTH_LEFT,
                    pointerEvents: isRevealed === 'left' ? 'auto' : 'none',
                }}
            >
                {(() => { const b0 = leftButton(0); return (
                <animated.div style={{ scale: b0.scale, x: b0.slideX }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); onView(note); closeSwipe(); }}
                        className="flex flex-col items-center gap-1"
                        aria-label="View note"
                    >
                        <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center active:scale-95 transition-transform">
                            <Eye size={18} />
                        </div>
                        <span className="text-[9px] font-medium text-amber-600">View</span>
                    </button>
                </animated.div>
                ); })()}
                {(() => { const b1 = leftButton(1); return (
                <animated.div style={{ scale: b1.scale, x: b1.slideX }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); onCopy(note); }}
                        className="flex flex-col items-center gap-1"
                        aria-label="Copy note"
                    >
                        <div className="w-10 h-10 rounded-full bg-teal-500/15 text-teal-600 flex items-center justify-center active:scale-95 transition-transform">
                            <ClipboardCopy size={18} />
                        </div>
                        <span className="text-[9px] font-medium text-teal-600">{copiedStatus ? 'Copied!' : 'Copy'}</span>
                    </button>
                </animated.div>
                ); })()}
                {(() => { const b2 = leftButton(2); return (
                <animated.div style={{ scale: b2.scale, x: b2.slideX }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); onShare(note); }}
                        className="flex flex-col items-center gap-1"
                        aria-label="Share note"
                    >
                        <div className="w-10 h-10 rounded-full bg-purple-500/15 text-purple-600 flex items-center justify-center active:scale-95 transition-transform">
                            <Share2 size={18} />
                        </div>
                        <span className="text-[9px] font-medium text-purple-600">
                            {shareStatus === 'shared' || shareStatus === 'copied' ? 'Done!' : 'Share'}
                        </span>
                    </button>
                </animated.div>
                ); })()}
            </div>

            {/* Right action (revealed by swiping left): Delete */}
            <div
                className="absolute inset-y-0 right-0 flex items-center justify-center pr-3 pl-1"
                style={{
                    width: ACTION_WIDTH_RIGHT,
                    pointerEvents: isRevealed === 'right' ? 'auto' : 'none',
                }}
            >
                <animated.div style={{ scale: rightButton.scale, x: rightButton.slideX }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteAction(); }}
                        className="flex flex-col items-center gap-1"
                        aria-label={confirmDelete ? 'Confirm' : 'Delete note'}
                    >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-colors ${confirmDelete
                            ? 'bg-red-500 text-white'
                            : 'bg-red-500/15 text-red-500'
                            }`}>
                            <Trash2 size={18} />
                        </div>
                        <span className={`text-[9px] font-medium text-red-500`}>
                            {confirmDelete ? 'Confirm' : 'Delete'}
                        </span>
                    </button>
                </animated.div>
            </div>

            {/* Foreground: the actual note card, slides left/right */}
            <animated.div
                className={`relative bg-themewhite border rounded-lg ${isSelected
                    ? 'border-themeblue3/50 bg-themeblue3/5 ring-1 ring-themeblue3/20'
                    : 'border-tertiary/10'
                    }`}
                style={{ x, touchAction: 'pan-y' }}
                {...bindSwipe()}
                onClick={handleTap}
            >
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
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-primary truncate">
                                {note.symptomText || 'Note'}
                            </p>
                            {note.dispositionType && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${getColorClasses(note.dispositionType as dispositionType['type']).dispositionBadge}`}>
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
            </animated.div>
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

const ReleaseNotesPanel = () => {
    const groupedNotes = ReleaseNotes.reduce<Record<string, ReleaseNoteTypes[]>>((acc, note) => {
        const version = note.version;
        if (!acc[version]) acc[version] = [];
        acc[version].push(note);
        return acc;
    }, {});

    const versions = Object.keys(groupedNotes).sort((a, b) => parseFloat(b) - parseFloat(a));

    return (
        <div className="h-full overflow-y-auto px-4 py-3 md:p-6">
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
    );
};

const MainSettingsPanel = ({
    settingsOptions,
    onItemClick,
}: {
    settingsOptions: Array<{
        icon: React.ReactNode;
        label: string;
        action: () => void;
        color: string;
        id: number;
    }>;
    onItemClick: (id: number) => void;
}) => (
    <div className="h-full overflow-y-auto">
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
);

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
                {isSelected && (
                    <div className="shrink-0">
                        <CheckSquare size={18} className="text-themeblue3" />
                    </div>
                )}
                <div className="shrink-0 w-8 h-8 rounded-full bg-themeblue3/10 flex items-center justify-center text-sm">
                    {note.symptomIcon || '\u{1F4CB}'}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-primary truncate">
                            {note.symptomText || 'Note'}
                        </p>
                        {note.dispositionType && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${getColorClasses(note.dispositionType as dispositionType['type']).dispositionBadge}`}>
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
   Mobile: swipe gestures + tap checkbox + shared bottom action bar.
   ──────────────────────────────────────────────────────────── */
const MyNotesPanel = ({
    isMobile,
    notes,
    onDeleteNote,
    onEditNote,
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
                                    onClick={() => handleSingleView(singleNote)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-full bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-all active:scale-95"
                                    title="View note in algorithm"
                                >
                                    <Eye size={14} />
                                    View
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

    const headerConfig = useMemo(() => {
        switch (activePanel) {
            case 'main':
                return { title: 'Settings' };
            case 'my-notes':
                return {
                    title: 'My Notes',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                    badge: notes.length > 0 ? String(notes.length) : undefined,
                };
            case 'release-notes':
                return {
                    title: 'Release Notes',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                };
        }
    }, [activePanel, notes.length, handleSlideAnimation]);

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={() => { setActivePanel('main'); setSlideDirection(''); onClose(); }}
            fullHeight="90dvh"
            disableDrag={false}
            header={headerConfig}
        >
            {(handleClose) => (
                <ContentWrapper slideDirection={slideDirection}>
                    {activePanel === 'main' ? (
                        <MainSettingsPanel
                            settingsOptions={buildSettingsOptions(handleClose)}
                            onItemClick={(id) => handleItemClick(id, handleClose)}
                        />
                    ) : activePanel === 'release-notes' ? (
                        <ReleaseNotesPanel />
                    ) : (
                        <MyNotesPanel
                            isMobile={externalIsMobile ?? (typeof window !== 'undefined' && window.innerWidth < 768)}
                            notes={notes}
                            onDeleteNote={onDeleteNote || (() => { })}
                            onEditNote={onEditNote}
                            onViewNote={onViewNote}
                            onCloseDrawer={handleClose}
                            initialSelectedId={initialSelectedId}
                        />
                    )}
                </ContentWrapper>
            )}
        </BaseDrawer>
    );
};
