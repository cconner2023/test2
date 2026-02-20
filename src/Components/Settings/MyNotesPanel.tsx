import { useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { useDrag } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/web';
import { FileText, Trash2, Share2, CheckSquare, Eye, ClipboardCopy, CloudOff, CloudCheck } from 'lucide-react';
import type { SavedNote, NoteSyncStatus } from '../../Hooks/useNotesStorage';
import { useNoteShare } from '../../Hooks/useNoteShare';
import { getColorClasses } from '../../Utilities/ColorUtilities';
import type { dispositionType } from '../../Types/AlgorithmTypes';
import { parseNoteEncoding } from '../../Utilities/NoteCodec';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { UI_TIMING } from '../../Utilities/constants';

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
   Utility: group notes by date (newest first), sort by acuity within each group
   ──────────────────────────────────────────────────────────── */
function formatDateHeader(isoStr: string): string {
    try {
        const date = new Date(isoStr);
        const day = date.getDate().toString().padStart(2, '0');
        const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const year = date.getFullYear().toString().slice(2);
        return `${day} ${month} ${year}`;
    } catch {
        return 'Unknown';
    }
}

function groupAndSortNotes(notes: SavedNote[], userClinicName?: string): { key: string; label: string; notes: SavedNote[] }[] {
    const groups = new Map<string, { label: string; notes: SavedNote[] }>();
    for (const note of notes) {
        const d = new Date(note.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!groups.has(key)) {
            groups.set(key, { label: formatDateHeader(note.createdAt), notes: [] });
        }
        groups.get(key)!.notes.push(note);
    }
    // Within each date group: sort by time (newest first),
    // then by clinic (current user's clinic first as tiebreaker)
    for (const group of groups.values()) {
        group.notes.sort((a, b) => {
            const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (timeDiff !== 0) return timeDiff;
            // Tiebreaker: current user's clinic sorts first
            if (userClinicName) {
                const aOwn = a.clinicName === userClinicName ? 0 : 1;
                const bOwn = b.clinicName === userClinicName ? 0 : 1;
                return aOwn - bOwn;
            }
            return 0;
        });
    }
    return Array.from(groups.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([key, { label, notes }]) => ({ key, label, notes }));
}


/* ────────────────────────────────────────────────────────────
   NoteSyncBadge — Compact inline badge showing sync status and author.
   "pending · Author" (amber) or "saved · Author" (green).
   ──────────────────────────────────────────────────────────── */
const NoteSyncBadge = ({
    syncStatus,
    authorName,
    clinicName,
}: {
    syncStatus: NoteSyncStatus;
    authorName: string;
    clinicName?: string;
}) => {
    const isPending = syncStatus === 'pending';
    const isError = syncStatus === 'error';

    const label = isError ? 'error' : isPending ? 'pending' : 'saved';
    const Icon = isPending || isError ? CloudOff : CloudCheck;
    const colorClasses = isError
        ? 'text-themeredred/70 bg-themeredred/8'
        : isPending
            ? 'text-themeyellow bg-themeyellowlow/10'
            : 'text-themegreen/80 bg-themegreen/8';

    return (
        <span
            className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${colorClasses}`}
            aria-label={`${label}, authored by ${authorName}${clinicName ? `, from ${clinicName}` : ''}`}
        >
            <Icon size={9} className="shrink-0" />
            <span>{label}</span>
            <span className="opacity-50">&middot;</span>
            <span className="truncate max-w-20">{authorName}</span>
            {clinicName && (
                <>
                    <span className="opacity-50">&middot;</span>
                    <span className="truncate max-w-24 opacity-70">{clinicName}</span>
                </>
            )}
        </span>
    );
};

/* ────────────────────────────────────────────────────────────
   NoteItemContent — Shared note display (icon, text, badge, date).
   Used by both SwipeableNoteItem (mobile) and NoteItemSettings (desktop).
   ──────────────────────────────────────────────────────────── */
const NoteItemContent = ({ note, isSelected, authorLabel, clinicName }: { note: SavedNote; isSelected: boolean; authorLabel: string; clinicName?: string }) => (
    <div className="flex items-center gap-3 px-3 py-3">
        {isSelected && (
            <div className="shrink-0">
                <CheckSquare size={20} className="text-themeblue3" />
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
                <NoteSyncBadge
                    syncStatus={note.sync_status}
                    authorName={authorLabel}
                    clinicName={clinicName}
                />
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
   ActionCircle — Reusable circle-icon + label action button.
   Used in swipe actions and bottom action bar for consistent UI.
   ──────────────────────────────────────────────────────────── */
const ActionCircle = ({
    icon,
    label,
    bgClass,
    textClass,
    onClick,
    ariaLabel,
}: {
    icon: ReactNode;
    label: string;
    bgClass: string;
    textClass?: string;
    onClick: (e: React.MouseEvent) => void;
    ariaLabel?: string;
}) => (
    <button
        onClick={onClick}
        className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
        aria-label={ariaLabel || label}
    >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bgClass}`}>
            {icon}
        </div>
        <span className={`text-[10px] ${textClass ?? 'font-normal text-themeyellowlow'}`}>{label}</span>
    </button>
);

/* ────────────────────────────────────────────────────────────
   SwipeableNoteItem — Mobile note item with swipe gestures.
   Uses plain CSS transform (no react-spring) for reliable touch.
   Swipe right → reveals View, Copy, Share (left side).
   Swipe left  → reveals Delete (right side).
   Tap → toggles selection.
   ──────────────────────────────────────────────────────────── */
const SNAP_LEFT = 148;
const SNAP_RIGHT = 72;
const SWIPE_THRESHOLD = 60;

const SwipeableNoteItem = ({
    note,
    onView,
    onCopy,
    onShare,
    onDelete,
    isSelected,
    onToggleSelect,
    authorLabel,
    clinicName,
    copyLabel,
    shareLabel,
    readOnly,
}: {
    note: SavedNote;
    onView: (note: SavedNote) => void;
    onCopy: (note: SavedNote) => void;
    onShare: (note: SavedNote) => void;
    onDelete: (noteId: string) => void;
    isSelected: boolean;
    onToggleSelect: (noteId: string) => void;
    authorLabel: string;
    clinicName?: string;
    copyLabel?: string;
    shareLabel?: string;
    /** When true, disables swipe-left delete action. */
    readOnly?: boolean;
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

    // Visual-only: fade-in + scale for swipe action buttons
    const leftProgress = Math.min(Math.max(offsetX / SNAP_LEFT, 0), 1);
    const rightProgress = Math.min(Math.max(-offsetX / SNAP_RIGHT, 0), 1);

    const leftActionSpring = useSpring({
        opacity: leftProgress,
        scale: 0.5 + leftProgress * 0.5,
        immediate: isDragging,
        config: { tension: 300, friction: 22 },
    });
    const rightActionSpring = useSpring({
        opacity: rightProgress,
        scale: 0.5 + rightProgress * 0.5,
        immediate: isDragging,
        config: { tension: 300, friction: 22 },
    });
    const actionStyle = (spring: typeof leftActionSpring) => ({
        opacity: spring.opacity,
        transform: spring.scale.to((s: number) => `scale(${s})`),
    });

    const bind = useDrag(
        ({ active, first, movement: [mx], tap, memo }) => {
            if (tap) return memo;

            const startOffset = first ? offsetX : (memo ?? 0);
            let newOffset = startOffset + mx;

            // Overshoot dampening beyond action widths
            if (newOffset > SNAP_LEFT) {
                const overshoot = newOffset - SNAP_LEFT;
                newOffset = SNAP_LEFT + overshoot * 0.3;
            } else if (!readOnly && newOffset < -SNAP_RIGHT) {
                const overshoot = Math.abs(newOffset) - SNAP_RIGHT;
                newOffset = -(SNAP_RIGHT + overshoot * 0.3);
            } else if (readOnly && newOffset < 0) {
                // In read-only mode, dampen all leftward swipe
                newOffset = newOffset * 0.15;
            }

            if (active) {
                setIsDragging(true);
                setOffsetX(newOffset);
            } else {
                setIsDragging(false);
                if (newOffset > SWIPE_THRESHOLD) {
                    setOffsetX(SNAP_LEFT);
                    setIsRevealed('left');
                } else if (!readOnly && newOffset < -SWIPE_THRESHOLD) {
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
                    <animated.div style={actionStyle(leftActionSpring)}>
                        <ActionCircle
                            icon={<Eye size={18} className="text-themeyellow" />}
                            label="View"
                            bgClass="bg-themeyellow/10"
                            onClick={(e) => { e.stopPropagation(); onView(note); closeSwipe(); }}
                            ariaLabel="View note"
                        />
                    </animated.div>
                    <animated.div style={actionStyle(leftActionSpring)}>
                        <ActionCircle
                            icon={<ClipboardCopy size={18} className="text-themegreen" />}
                            label={copyLabel ?? 'Copy'}
                            bgClass="bg-themegreen/10"
                            textClass={copyLabel === 'Copied!' ? 'font-normal text-themegreen' : 'text-themegreen'}
                            onClick={(e) => { e.stopPropagation(); onCopy(note); }}
                            ariaLabel="Copy note"
                        />
                    </animated.div>
                    <animated.div style={actionStyle(leftActionSpring)}>
                        <ActionCircle
                            icon={<Share2 size={18} className="text-themeblue2" />}
                            label={shareLabel ?? 'Share'}
                            bgClass="bg-themeblue2/15"
                            textClass={shareLabel === 'Shared!' || shareLabel === 'Copied!' ? 'font-normal text-themeblue2' : 'text-themeblue2'}
                            onClick={(e) => { e.stopPropagation(); onShare(note); }}
                            ariaLabel="Share note"
                        />
                    </animated.div>
                </div>
            )}

            {/* Right action (revealed by swiping left): Delete — hidden in read-only mode */}
            {!readOnly && (offsetX < 0 || isRevealed === 'right') && (
                <div
                    className="absolute inset-y-0 right-0 flex items-center justify-center pr-2 pl-1"
                    style={{ width: SNAP_RIGHT }}
                >
                    <animated.div style={actionStyle(rightActionSpring)}>
                        <ActionCircle
                            icon={<Trash2 size={18} className="text-themeredred" />}
                            label={confirmDelete ? 'Confirm' : 'Delete'}
                            bgClass={confirmDelete ? 'bg-themeredred/40' : 'bg-themeredred/15'}
                            textClass={confirmDelete ? 'font-medium text-themeredred' : 'font-medium text-themeredred/60'}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirmDelete) {
                                    onDelete(note.id);
                                    closeSwipe();
                                } else {
                                    setConfirmDelete(true);
                                    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
                                    confirmTimeoutRef.current = setTimeout(() => setConfirmDelete(false), UI_TIMING.DELETE_CONFIRM_TIMEOUT);
                                }
                            }}
                            ariaLabel={confirmDelete ? 'Confirm delete' : 'Delete note'}
                        />
                    </animated.div>
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
                            <CheckSquare size={20} className="text-themeblue3" />
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
                            <NoteSyncBadge
                                syncStatus={note.sync_status}
                                authorName={authorLabel}
                                clinicName={clinicName}
                            />
                        </div>
                    </div>
                    {note.dispositionType && (
                        <span className={`text-[10px] font-normal px-2 py-1 rounded-full shrink-0 ${getColorClasses(note.dispositionType as dispositionType['type']).badgeBg}`}>
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
    authorLabel,
    clinicName,
}: {
    note: SavedNote;
    isSelected: boolean;
    onToggleSelect: (noteId: string) => void;
    authorLabel: string;
    clinicName?: string;
}) => (
    <div
        className={`relative rounded-lg mb-2 cursor-pointer transition-all duration-150 ${isSelected
            ? 'border-themeblue3/50 bg-themeblue3/5 ring-1 ring-themeblue3/20 border'
            : 'border border-tertiary/10 bg-themewhite hover:bg-themewhite2/50'
            }`}
        onClick={() => onToggleSelect(note.id)}
    >
        <NoteItemContent note={note} isSelected={isSelected} authorLabel={authorLabel} clinicName={clinicName} />
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
    clinicNotes,
    onDeleteNote,
    onDeleteClinicNote,
    onViewNote,
    onCloseDrawer,
}: {
    isMobile: boolean;
    notes: SavedNote[];
    clinicNotes?: SavedNote[];
    onDeleteNote: (noteId: string) => void;
    /** Hard-delete a clinic note on the server. Falls back to onDeleteNote if not provided. */
    onDeleteClinicNote?: (noteId: string) => void;
    onEditNote?: (noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>) => void;
    onViewNote?: (note: SavedNote) => void;
    onCloseDrawer: () => void;
    initialSelectedId?: string | null;
}) => {
    const { profile } = useUserProfile();
    const userClinicName = profile.clinicName;

    // Merge personal and clinic notes into a single deduplicated list.
    // Deduplication by note ID with last-write-wins: if the same note
    // appears in both local and clinic lists (e.g., during a sync race),
    // the version with the more recent createdAt timestamp wins.
    // Under normal operation the server-side exclusion (neq user_id)
    // prevents overlap, but this is a belt-and-suspenders safeguard.
    const displayNotes = useMemo(() => {
        const noteMap = new Map<string, SavedNote>();

        // Local (personal) notes go in first
        for (const note of notes) {
            noteMap.set(note.id, note);
        }

        // Clinic notes: only add if ID is new, or replace if clinic
        // version has a more recent timestamp (last-write-wins)
        for (const clinicNote of (clinicNotes || [])) {
            const existing = noteMap.get(clinicNote.id);
            if (!existing) {
                noteMap.set(clinicNote.id, clinicNote);
            } else {
                const existingTime = new Date(existing.createdAt).getTime();
                const clinicTime = new Date(clinicNote.createdAt).getTime();
                if (clinicTime > existingTime) {
                    noteMap.set(clinicNote.id, clinicNote);
                }
            }
        }

        return Array.from(noteMap.values());
    }, [notes, clinicNotes]);

    // Track which note IDs originated from the clinic list so we can route
    // deletes to the correct handler (personal vs. clinic).
    const clinicNoteIds = useMemo(
        () => new Set((clinicNotes || []).map(n => n.id)),
        [clinicNotes]
    );

    /**
     * Route a delete to the correct handler based on whether the note
     * is a personal note (IndexedDB + sync queue) or a clinic note
     * (server-only hard delete).
     */
    const routeDelete = useCallback((noteId: string) => {
        if (clinicNoteIds.has(noteId) && onDeleteClinicNote) {
            onDeleteClinicNote(noteId);
        } else {
            onDeleteNote(noteId);
        }
    }, [clinicNoteIds, onDeleteClinicNote, onDeleteNote]);

    // Shared state: checkbox selection + bottom action bar (both mobile & desktop)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [confirmDelete, setConfirmDelete] = useState(false);
    const confirmDeleteRef = useRef(false);
    const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout>>(0);

    // Shared state
    const [copiedStatus, setCopiedStatus] = useState(false);
    const { shareNote, shareStatus } = useNoteShare();

    // Group by date, sort by time (newest first), current clinic first as tiebreaker
    const groupedNotes = useMemo(() => groupAndSortNotes(displayNotes, userClinicName), [displayNotes, userClinicName]);

    // Determine which notes belong to the current user (any origination)
    const ownNoteIds = useMemo(() => {
        const ids = new Set<string>();
        if (!profile.lastName) return ids;
        for (const note of displayNotes) {
            const parsed = parseNoteEncoding(note.encodedText);
            if (!parsed?.user) continue;
            const nameMatch =
                parsed.user.lastName?.toLowerCase() === profile.lastName.toLowerCase() &&
                (parsed.user.firstName?.toLowerCase() ?? '') === (profile.firstName?.toLowerCase() ?? '');
            const unitMatch = (parsed.user.uic ?? '') === (profile.uic ?? '');
            if (nameMatch && unitMatch) ids.add(note.id);
        }
        return ids;
    }, [displayNotes, profile.lastName, profile.firstName, profile.uic]);

    /**
     * Resolve the clinic name badge label for a note.
     * Only shown when the note originates from a different clinic.
     */
    const getClinicLabel = useCallback((note: SavedNote): string | undefined => {
        return note.clinicName;
    }, []);

    /**
     * Resolve the author label for a note.
     * Priority: current user -> note.authorName -> external source -> fallback.
     */
    const getAuthorLabel = useCallback((note: SavedNote): string => {
        // 1. If the note belongs to the current user, show "You"
        if (ownNoteIds.has(note.id)) return 'You';

        // 2. If the note has authorName from server/local data (clinic notes)
        if (note.authorName) return note.authorName;

        // 3. If it's an external/imported note, extract the author from source
        if (note.source?.startsWith('external')) {
            const colonIdx = note.source.indexOf(':');
            if (colonIdx !== -1) return note.source.slice(colonIdx + 1);
            return 'External';
        }

        // 4. Fallback
        return 'Unknown';
    }, [ownNoteIds]);

    // Clear selection when displayed notes change (e.g., after delete or tab switch)
    useEffect(() => {
        setSelectedIds(prev => {
            const noteIdSet = new Set(displayNotes.map(n => n.id));
            const next = new Set<string>();
            prev.forEach(id => {
                if (noteIdSet.has(id)) next.add(id);
            });
            if (next.size !== prev.size) return next;
            return prev;
        });
    }, [displayNotes]);

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
                setTimeout(() => setCopiedStatus(false), UI_TIMING.COPY_FEEDBACK);
            }).catch(() => {
                setCopiedStatus(true);
                setTimeout(() => setCopiedStatus(false), UI_TIMING.COPY_FEEDBACK);
            });
        }
    }, []);

    const handleShare = useCallback((note: SavedNote) => {
        shareNote(note, isMobile);
    }, [shareNote, isMobile]);

    const handleDelete = useCallback(() => {
        if (confirmDeleteRef.current) {
            selectedIds.forEach(id => routeDelete(id));
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
            }, UI_TIMING.DELETE_CONFIRM_TIMEOUT);
        }
    }, [selectedIds, routeDelete]);

    const selectedCount = selectedIds.size;
    const selectedNotes = displayNotes.filter(n => selectedIds.has(n.id));
    const isSingleSelect = selectedCount === 1;
    const isMultiSelect = selectedCount > 1;
    const singleNote = isSingleSelect ? selectedNotes[0] : null;

    // Computed labels for consistent text feedback across swipe + action bar
    const copyLabel = copiedStatus ? 'Copied!' : 'Copy';
    const shareLabel = shareStatus === 'copied' ? 'Copied!'
        : shareStatus === 'shared' ? 'Shared!'
            : (shareStatus === 'generating' || shareStatus === 'sharing') ? '...'
                : 'Share';

    // View handler — unified for mobile and desktop
    const handleSingleView = useCallback((note: SavedNote) => {
        handleViewNote(note);
    }, [handleViewNote]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
                {displayNotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-tertiary/5 flex items-center justify-center mb-4">
                            <FileText size={28} className="text-tertiary/30" />
                        </div>
                        <p className="text-sm font-medium text-primary/70 mb-1">No saved notes</p>
                        <p className="text-xs text-tertiary/50 max-w-60">
                            Notes you save from the Write Note page will appear here.
                        </p>
                    </div>
                ) : isMobile ? (
                    /* Mobile: swipe gestures + tap to select */
                    <div className="px-4 py-3 md:p-5">
                        <p className="text-[10px] text-tertiary/40 text-center mb-2">
                            Swipe for actions · Tap to select
                        </p>
                        {groupedNotes.map((group, idx) => (
                            <div key={group.key}>
                                <p className={`text-[10px] font-medium text-tertiary/50 uppercase tracking-wider px-1 pb-1 ${idx === 0 ? 'pt-1' : 'pt-4'}`}>
                                    {group.label}
                                </p>
                                {group.notes.map((note) => (
                                    <SwipeableNoteItem
                                        key={note.id}
                                        note={note}
                                        onView={handleViewNote}
                                        onCopy={handleCopy}
                                        onShare={handleShare}
                                        onDelete={routeDelete}
                                        isSelected={selectedIds.has(note.id)}
                                        onToggleSelect={handleToggleSelect}
                                        authorLabel={getAuthorLabel(note)}
                                        clinicName={getClinicLabel(note)}
                                        copyLabel={copyLabel}
                                        shareLabel={shareLabel}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Desktop: checkbox selection + bottom action bar */
                    <div className="px-4 py-3 md:p-5">
                        <p className="text-[10px] text-tertiary/40 text-center mb-2">
                            Tap to select · Multi-select for bulk actions
                        </p>
                        {groupedNotes.map((group, idx) => (
                            <div key={group.key}>
                                <p className={`text-[10px] font-medium text-tertiary/50 uppercase tracking-wider px-1 pb-1 ${idx === 0 ? 'pt-1' : 'pt-4'}`}>
                                    {group.label}
                                </p>
                                {group.notes.map((note) => (
                                    <NoteItemSettings
                                        key={note.id}
                                        note={note}
                                        isSelected={selectedIds.has(note.id)}
                                        onToggleSelect={handleToggleSelect}
                                        authorLabel={getAuthorLabel(note)}
                                        clinicName={getClinicLabel(note)}
                                    />
                                ))}
                            </div>
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
                            <div className="flex items-center justify-center gap-4">
                                <ActionCircle
                                    icon={<Eye size={18} className="text-themeyellow" />}
                                    label="View"
                                    bgClass="bg-themeyellow/10"
                                    onClick={() => handleSingleView(singleNote)}
                                    ariaLabel="View note in algorithm"
                                />
                                <ActionCircle
                                    icon={<ClipboardCopy size={18} className="text-themegreen" />}
                                    label={copyLabel}
                                    bgClass="bg-themegreen/10"
                                    textClass={copiedStatus ? 'font-normal text-themegreen' : 'text-themegreen'}
                                    onClick={() => handleCopy(singleNote)}
                                    ariaLabel="Copy encoded text"
                                />
                                <ActionCircle
                                    icon={<Share2 size={18} className="text-themeblue2" />}
                                    label={shareLabel}
                                    bgClass="bg-themeblue2/15"
                                    textClass={shareStatus === 'shared' || shareStatus === 'copied' ? 'font-normal text-themeblue2' : 'text-themeblue2'}
                                    onClick={() => handleShare(singleNote)}
                                    ariaLabel="Share note as image"
                                />
                                <ActionCircle
                                    icon={<Trash2 size={18} className="text-themeredred" />}
                                    label={confirmDelete ? 'Confirm' : 'Delete'}
                                    bgClass={confirmDelete ? 'bg-themeredred/40' : 'bg-themeredred/15'}
                                    textClass={confirmDelete ? 'font-medium text-themeredred' : 'font-medium text-themeredred/60'}
                                    onClick={handleDelete}
                                    ariaLabel={confirmDelete ? 'Tap again to confirm delete' : 'Delete note'}
                                />
                            </div>
                        )}

                        {isMultiSelect && (
                            <div className="flex items-center justify-center gap-4">
                                <ActionCircle
                                    icon={<Trash2 size={18} className="text-white" />}
                                    label={confirmDelete ? `Confirm (${selectedCount})` : `Delete (${selectedCount})`}
                                    bgClass="bg-themeredred"
                                    textClass="font-medium text-themeredred"
                                    onClick={handleDelete}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
