// Components/MyNotes.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, FileText, Trash2, Pencil, Share2, CheckSquare, Square, Eye, ClipboardCopy } from 'lucide-react';
import { useSpring, animated } from '@react-spring/web';
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
}

/* ────────────────────────────────────────────────────────────
   SwipeableNoteItem — A single note row with gesture support.
   Mobile:  swipe left → edit + share, swipe right → delete
   Desktop: click to reveal actions (edit, share, delete)
   Single select: delete, edit, share
   Multi-select mode: checkbox + highlight
   ──────────────────────────────────────────────────────────── */
const SwipeableNoteItem = ({
    note,
    isMobile,
    onDelete,
    onEdit,
    onView,
    onEditInWizard,
    onShare,
    shareStatus,
    activeSwipeId,
    setActiveSwipeId,
    multiSelectMode,
    isMultiSelected,
    onToggleMultiSelect,
    onLongPress,
}: {
    note: SavedNote;
    isMobile: boolean;
    onDelete: (noteId: string) => void;
    onEdit?: (noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>) => void;
    onView?: (note: SavedNote) => void;
    onEditInWizard?: (note: SavedNote) => void;
    onShare?: (note: SavedNote) => void;
    shareStatus?: string;
    activeSwipeId: string | null;
    setActiveSwipeId: (id: string | null) => void;
    multiSelectMode: boolean;
    isMultiSelected: boolean;
    onToggleMultiSelect: (noteId: string) => void;
    onLongPress: () => void;
}) => {
    const [confirmDeleteId, setConfirmDeleteId] = useState(false);
    const [copiedId, setCopiedId] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState('');
    const [desktopActionsVisible, setDesktopActionsVisible] = useState(false);
    const [mobileSelected, setMobileSelected] = useState(false);

    // react-spring animated swipe offset
    const [springStyles, springApi] = useSpring(() => ({
        x: 0,
        config: { tension: 300, friction: 28 },
    }));
    // Keep a ref to the current target offset for logic checks
    const swipeTargetRef = useRef(0);

    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const touchStartTime = useRef(0);
    const currentOffsetRef = useRef(0);
    const lastMoveOffsetRef = useRef(0); // Track the latest offset during move for reliable velocity calc
    const isTrackingSwipe = useRef(false);
    const swipeDirection = useRef<'none' | 'horizontal' | 'vertical'>('none');
    const noteRowRef = useRef<HTMLDivElement>(null);
    const wasSwiping = useRef(false); // Track if the gesture was a swipe (to distinguish from tap)

    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const ACTION_WIDTH = 64; // Width of each action button area
    const SNAP_THRESHOLD = 32; // Half of action width for snap decision
    const VELOCITY_THRESHOLD = 0.3;

    // Reset swipe when another item becomes active
    useEffect(() => {
        if (activeSwipeId !== note.id && swipeTargetRef.current !== 0) {
            springApi.start({ x: 0 });
            swipeTargetRef.current = 0;
            currentOffsetRef.current = 0;
            lastMoveOffsetRef.current = 0;
        } else if (activeSwipeId !== note.id) {
            currentOffsetRef.current = 0;
            lastMoveOffsetRef.current = 0;
        }
    }, [activeSwipeId, note.id, springApi]);

    // Reset desktop actions and mobile selection when another item is active
    useEffect(() => {
        if (activeSwipeId !== note.id && desktopActionsVisible) {
            setDesktopActionsVisible(false);
        }
        if (activeSwipeId !== note.id && mobileSelected) {
            setMobileSelected(false);
        }
    }, [activeSwipeId, note.id, desktopActionsVisible, mobileSelected]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
            }
        };
    }, []);

    // Attach non-passive touchmove listener to allow preventDefault during horizontal swipes.
    // React attaches touch handlers as passive by default, so we need a native listener
    // with { passive: false } to prevent vertical scrolling during horizontal swipe gestures.
    useEffect(() => {
        const el = noteRowRef.current;
        if (!el || !isMobile) return;

        const handleNativeTouchMove = (e: TouchEvent) => {
            if (swipeDirection.current === 'horizontal' && isTrackingSwipe.current) {
                e.preventDefault();
            }
        };

        el.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
        return () => el.removeEventListener('touchmove', handleNativeTouchMove);
    }, [isMobile]);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!isMobile || isEditing) return;
        const touch = e.touches[0];
        touchStartX.current = touch.clientX;
        touchStartY.current = touch.clientY;
        touchStartTime.current = Date.now();
        isTrackingSwipe.current = true;
        swipeDirection.current = 'none';
        wasSwiping.current = false;
        // Snapshot the current visual offset so new gesture starts from current position
        currentOffsetRef.current = swipeTargetRef.current;

        // Long-press detection for multi-select entry
        if (!multiSelectMode) {
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = setTimeout(() => {
                if (!wasSwiping.current) {
                    onLongPress();
                    onToggleMultiSelect(note.id);
                }
                longPressTimerRef.current = null;
            }, 500);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isMobile || !isTrackingSwipe.current || isEditing) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartX.current;
        const deltaY = touch.clientY - touchStartY.current;

        // Determine direction on first significant movement
        if (swipeDirection.current === 'none') {
            if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
                // Cancel long-press on any movement
                if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                }
                if (Math.abs(deltaY) > Math.abs(deltaX)) {
                    swipeDirection.current = 'vertical';
                    isTrackingSwipe.current = false;
                    return;
                }
                swipeDirection.current = 'horizontal';
                wasSwiping.current = true;
            } else {
                return;
            }
        }

        if (swipeDirection.current !== 'horizontal') return;

        // Note: vertical scroll prevention is handled by the non-passive native
        // touchmove listener attached via useEffect (see above).

        const startOffset = currentOffsetRef.current;
        let newOffset = startOffset + deltaX;

        // Clamp: left max = -ACTION_WIDTH*2 (showing edit+share), right max = ACTION_WIDTH (showing delete)
        const maxLeft = -(ACTION_WIDTH * 2);
        const maxRight = ACTION_WIDTH;

        // Apply resistance at boundaries
        if (newOffset < maxLeft) {
            const excess = maxLeft - newOffset;
            newOffset = maxLeft - excess * 0.3;
        } else if (newOffset > maxRight) {
            const excess = newOffset - maxRight;
            newOffset = maxRight + excess * 0.3;
        }

        lastMoveOffsetRef.current = newOffset;
        springApi.start({ x: newOffset, immediate: true });
    };

    const handleTouchEnd = () => {
        // Cancel long-press timer
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        if (!isMobile || !isTrackingSwipe.current || isEditing) return;
        isTrackingSwipe.current = false;

        const elapsed = Date.now() - touchStartTime.current;
        // Use ref-based offset for reliable velocity (not stale React state)
        const currentVisualOffset = lastMoveOffsetRef.current;
        const velocity = (currentVisualOffset - currentOffsetRef.current) / Math.max(elapsed, 1);

        let targetOffset = 0;

        if (velocity < -VELOCITY_THRESHOLD || currentVisualOffset < -SNAP_THRESHOLD) {
            // Swiped left → show edit + share (2 buttons)
            targetOffset = -(ACTION_WIDTH * 2);
            setActiveSwipeId(note.id);
        } else if (velocity > VELOCITY_THRESHOLD || currentVisualOffset > SNAP_THRESHOLD) {
            // Swiped right → show delete
            targetOffset = ACTION_WIDTH;
            setActiveSwipeId(note.id);
        } else {
            // Snap back
            targetOffset = 0;
            if (activeSwipeId === note.id) {
                setActiveSwipeId(null);
            }
        }

        // Animate to target with spring physics
        springApi.start({ x: targetOffset, immediate: false });
        swipeTargetRef.current = targetOffset;
        currentOffsetRef.current = targetOffset;
    };

    // Click/tap handler — works for both desktop and mobile
    const handleNoteClick = () => {
        if (isEditing) return;

        // In multi-select mode, taps toggle selection
        if (multiSelectMode) {
            onToggleMultiSelect(note.id);
            return;
        }

        if (isMobile) {
            // On mobile: only handle as tap if gesture wasn't a swipe
            if (wasSwiping.current) return;
            // If swiped open, treat tap on the card as closing the swipe
            if (swipeTargetRef.current !== 0) {
                springApi.start({ x: 0 });
                swipeTargetRef.current = 0;
                currentOffsetRef.current = 0;
                lastMoveOffsetRef.current = 0;
                setActiveSwipeId(null);
                setMobileSelected(false);
                return;
            }
            // Toggle mobile selection
            if (mobileSelected) {
                setMobileSelected(false);
                setActiveSwipeId(null);
            } else {
                setMobileSelected(true);
                setActiveSwipeId(note.id);
            }
        } else {
            // Desktop: toggle action row visibility
            if (desktopActionsVisible) {
                setDesktopActionsVisible(false);
                setActiveSwipeId(null);
            } else {
                setDesktopActionsVisible(true);
                setActiveSwipeId(note.id);
            }
        }
    };

    const handleDelete = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        if (confirmDeleteId) {
            onDelete(note.id);
            setConfirmDeleteId(false);
            setActiveSwipeId(null);
            setMobileSelected(false);
        } else {
            setConfirmDeleteId(true);
            setTimeout(() => setConfirmDeleteId(false), 3000);
        }
    };

    const handleEditStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        setEditText(note.previewText || '');
        setIsEditing(true);
        setMobileSelected(false);
        // Reset swipe
        if (isMobile) {
            springApi.start({ x: 0 });
            swipeTargetRef.current = 0;
            currentOffsetRef.current = 0;
            lastMoveOffsetRef.current = 0;
        }
    };

    const handleEditSave = () => {
        if (onEdit && editText.trim()) {
            onEdit(note.id, { previewText: editText.trim() });
        }
        setIsEditing(false);
        setActiveSwipeId(null);
        setDesktopActionsVisible(false);
    };

    const handleEditCancel = () => {
        setIsEditing(false);
    };

    const handleShare = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        if (onShare) {
            onShare(note);
        }
        // Keep selection visible for share status feedback
    };

    const handleView = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        if (onView) {
            onView(note);
        }
    };

    const handleEditInWizard = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        if (onEditInWizard) {
            onEditInWizard(note);
        }
    };

    const handleCopy = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        if (note.encodedText) {
            navigator.clipboard.writeText(note.encodedText).then(() => {
                setCopiedId(true);
                setTimeout(() => setCopiedId(false), 2000);
            }).catch(() => {
                // Fallback: set copied anyway for UX
                setCopiedId(true);
                setTimeout(() => setCopiedId(false), 2000);
            });
        }
    };

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

    return (
        <div className="relative overflow-hidden rounded-lg mb-2">
            {/* ── Mobile: Background action buttons revealed by swipe ── */}
            {isMobile && !multiSelectMode && (
                <>
                    {/* Left side actions (revealed when swiping right → delete) */}
                    <div
                        className="absolute inset-y-0 left-0 flex items-stretch"
                        style={{ width: ACTION_WIDTH }}
                    >
                        <button
                            className={`flex-1 flex flex-col items-center justify-center gap-1 text-white text-xs font-medium transition-colors ${
                                confirmDeleteId ? 'bg-red-700' : 'bg-red-500'
                            }`}
                            onTouchEnd={handleDelete}
                            onClick={handleDelete}
                        >
                            <Trash2 size={18} />
                            <span>{confirmDeleteId ? 'Confirm' : 'Delete'}</span>
                        </button>
                    </div>

                    {/* Right side actions (revealed when swiping left → edit + share) */}
                    <div
                        className="absolute inset-y-0 right-0 flex items-stretch"
                        style={{ width: ACTION_WIDTH * 2 }}
                    >
                        <button
                            className="flex-1 flex flex-col items-center justify-center gap-1 bg-blue-500 text-white text-xs font-medium"
                            onTouchEnd={handleEditInWizard}
                            onClick={handleEditInWizard}
                        >
                            <Pencil size={18} />
                            <span>Edit</span>
                        </button>
                        <button
                            className={`flex-1 flex flex-col items-center justify-center gap-1 text-white text-xs font-medium transition-colors ${
                                shareStatus === 'shared' || shareStatus === 'copied' ? 'bg-green-500' : 'bg-purple-500'
                            }`}
                            onTouchEnd={handleShare}
                            onClick={handleShare}
                        >
                            <Share2 size={18} />
                            <span>{shareStatus === 'copied' ? 'Copied!' : shareStatus === 'shared' ? 'Shared!' : 'Share'}</span>
                        </button>
                    </div>
                </>
            )}

            {/* ── Main note content (slides on mobile via react-spring) ── */}
            <animated.div
                ref={noteRowRef}
                className={`relative z-10 bg-themewhite border rounded-lg ${
                    !isMobile ? 'cursor-pointer hover:bg-themewhite2/50 border-tertiary/10' : ''
                } ${isMobile && mobileSelected ? 'border-themeblue3/50 bg-themeblue3/5 ring-1 ring-themeblue3/20' : isMobile ? 'border-tertiary/10' : ''}`}
                style={isMobile ? { transform: springStyles.x.to(x => `translateX(${x}px)`), willChange: 'transform', touchAction: 'pan-y' } : undefined}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={handleNoteClick}
            >
                {/* Note summary row */}
                <div className="flex items-center gap-3 px-3 py-3">
                    {/* Multi-select checkbox */}
                    {multiSelectMode && (
                        <div className="shrink-0">
                            {isMultiSelected ? (
                                <CheckSquare size={18} className="text-themeblue3" />
                            ) : (
                                <Square size={18} className="text-tertiary/30" />
                            )}
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
                                <span className="text-[10px] text-tertiary/60 bg-tertiary/8 px-1.5 py-0.5 rounded shrink-0">
                                    {note.dispositionType}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-tertiary/60 mt-0.5">
                            {formatDate(note.createdAt)}
                        </p>
                    </div>
                    {/* Mobile: subtle swipe hint */}
                    {isMobile && !isEditing && (
                        <div className="shrink-0 text-tertiary/20">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                            </svg>
                        </div>
                    )}
                    {/* Desktop: chevron indicator */}
                    {!isMobile && !isEditing && (
                        <div className="shrink-0 text-tertiary/30">
                            <svg
                                className={`w-4 h-4 transition-transform duration-200 ${desktopActionsVisible ? 'rotate-180' : ''}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    )}
                </div>

                {/* Desktop: action buttons revealed on click */}
                {!isMobile && desktopActionsVisible && !isEditing && (
                    <div className="px-3 pb-3 border-t border-tertiary/10">
                        <div className="flex items-center justify-end gap-2 mt-2">
                            <button
                                onClick={handleView}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-themewhite3 text-tertiary hover:bg-amber-50 hover:text-amber-600 transition-all active:scale-95"
                                title="View note in algorithm"
                            >
                                <Eye size={12} />
                                View
                            </button>
                            <button
                                onClick={handleEditInWizard}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-themewhite3 text-tertiary hover:bg-blue-50 hover:text-blue-500 transition-all active:scale-95"
                                title="Edit note"
                            >
                                <Pencil size={12} />
                                Edit
                            </button>
                            <button
                                onClick={handleCopy}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all active:scale-95 ${
                                    copiedId
                                        ? 'bg-green-100 text-green-600'
                                        : 'bg-themewhite3 text-tertiary hover:bg-themeblue3/10 hover:text-themeblue3'
                                }`}
                                title="Copy encoded text"
                            >
                                <ClipboardCopy size={12} />
                                {copiedId ? 'Copied!' : 'Copy'}
                            </button>
                            <button
                                onClick={handleShare}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all active:scale-95 ${
                                    shareStatus === 'shared' || shareStatus === 'copied'
                                        ? 'bg-green-100 text-green-600'
                                        : shareStatus === 'generating' || shareStatus === 'sharing'
                                            ? 'bg-purple-100 text-purple-600'
                                            : 'bg-themewhite3 text-tertiary hover:bg-purple-50 hover:text-purple-600'
                                }`}
                                title="Share note as image"
                            >
                                <Share2 size={12} />
                                {shareStatus === 'copied' ? 'Copied!' : shareStatus === 'shared' ? 'Shared!' : shareStatus === 'generating' || shareStatus === 'sharing' ? 'Sharing...' : 'Share'}
                            </button>
                            <button
                                onClick={handleDelete}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all active:scale-95 ${
                                    confirmDeleteId
                                        ? 'bg-red-500 text-white'
                                        : 'bg-themewhite3 text-tertiary hover:bg-red-50 hover:text-red-500'
                                }`}
                                title={confirmDeleteId ? 'Click again to confirm delete' : 'Delete note'}
                            >
                                <Trash2 size={12} />
                                {confirmDeleteId ? 'Confirm Delete' : 'Delete'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Mobile: action buttons revealed on tap selection */}
                {isMobile && mobileSelected && !isEditing && (
                    <div className="px-3 pb-3 border-t border-themeblue3/15">
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <button
                                onTouchEnd={handleView}
                                onClick={handleView}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-full bg-amber-500/10 text-amber-600 active:bg-amber-500/20 transition-all active:scale-95"
                            >
                                <Eye size={14} />
                                View
                            </button>
                            <button
                                onTouchEnd={handleEditInWizard}
                                onClick={handleEditInWizard}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-full bg-blue-500/10 text-blue-500 active:bg-blue-500/20 transition-all active:scale-95"
                            >
                                <Pencil size={14} />
                                Edit
                            </button>
                            <button
                                onTouchEnd={handleCopy}
                                onClick={handleCopy}
                                className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-full transition-all active:scale-95 ${
                                    copiedId
                                        ? 'bg-green-500/15 text-green-600'
                                        : 'bg-teal-500/10 text-teal-600 active:bg-teal-500/20'
                                }`}
                            >
                                <ClipboardCopy size={14} />
                                {copiedId ? 'Copied!' : 'Copy'}
                            </button>
                            <button
                                onTouchEnd={handleShare}
                                onClick={handleShare}
                                className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-full transition-all active:scale-95 ${
                                    shareStatus === 'shared' || shareStatus === 'copied'
                                        ? 'bg-green-500/15 text-green-600'
                                        : shareStatus === 'generating' || shareStatus === 'sharing'
                                            ? 'bg-purple-500/15 text-purple-600'
                                            : 'bg-purple-500/10 text-purple-600 active:bg-purple-500/20'
                                }`}
                            >
                                <Share2 size={14} />
                                {shareStatus === 'copied' ? 'Copied!' : shareStatus === 'shared' ? 'Shared!' : shareStatus === 'generating' || shareStatus === 'sharing' ? '...' : 'Share'}
                            </button>
                            <button
                                onTouchEnd={handleDelete}
                                onClick={handleDelete}
                                className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-full transition-all active:scale-95 ${
                                    confirmDeleteId
                                        ? 'bg-red-500 text-white'
                                        : 'bg-red-500/10 text-red-500 active:bg-red-500/20'
                                }`}
                            >
                                <Trash2 size={14} />
                                {confirmDeleteId ? 'Confirm' : 'Delete'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Edit mode inline */}
                {isEditing && (
                    <div className="px-3 pb-3 border-t border-tertiary/10" onClick={(e) => e.stopPropagation()}>
                        <textarea
                            className="w-full mt-2 p-2 rounded bg-themewhite3 text-xs text-primary border border-tertiary/20 focus:border-themeblue3 focus:outline-none resize-none"
                            rows={4}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            autoFocus
                        />
                        <div className="flex items-center justify-end gap-2 mt-2">
                            <button
                                onClick={handleEditCancel}
                                className="px-3 py-1.5 text-xs rounded-full bg-themewhite3 text-tertiary hover:bg-tertiary/10 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditSave}
                                className="px-3 py-1.5 text-xs rounded-full bg-themeblue3 text-white hover:bg-themeblue3/90 transition-all active:scale-95"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                )}
            </animated.div>
        </div>
    );
};

/* ────────────────────────────────────────────────────────────
   MyNotesContent — Scrollable list content rendered once
   ──────────────────────────────────────────────────────────── */
const MyNotesContent = ({
    onClose,
    isMobile,
    notes,
    onDeleteNote,
    onEditNote,
    onViewNote,
    onEditNoteInWizard,
}: {
    onClose: () => void;
    isMobile: boolean;
    notes: SavedNote[];
    onDeleteNote: (noteId: string) => void;
    onEditNote?: (noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>) => void;
    onViewNote?: (note: SavedNote) => void;
    onEditNoteInWizard?: (note: SavedNote) => void;
}) => {
    const [activeSwipeId, setActiveSwipeId] = useState<string | null>(null);
    const [multiSelectMode, setMultiSelectMode] = useState(false);
    const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
    const { shareNote, shareStatus } = useNoteShare();

    const handleShareNote = (note: SavedNote) => {
        shareNote(note, isMobile);
    };

    const handleToggleMultiSelect = useCallback((noteId: string) => {
        setMultiSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(noteId)) {
                next.delete(noteId);
            } else {
                next.add(noteId);
            }
            // Exit multi-select if nothing selected
            if (next.size === 0) {
                setMultiSelectMode(false);
            }
            return next;
        });
    }, []);

    const handleEnterMultiSelect = useCallback(() => {
        setMultiSelectMode(true);
    }, []);

    const handleMultiDelete = useCallback(() => {
        multiSelectedIds.forEach(id => onDeleteNote(id));
        setMultiSelectedIds(new Set());
        setMultiSelectMode(false);
    }, [multiSelectedIds, onDeleteNote]);

    // Tap outside to dismiss active swipe
    const handleContentClick = () => {
        if (activeSwipeId) {
            setActiveSwipeId(null);
        }
    };

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
                onClick={handleContentClick}
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
                        {isMobile && (
                            <p className="text-[10px] text-tertiary/40 text-center mb-2">
                                Tap to select · Swipe for quick actions
                            </p>
                        )}
                        {notes.map((note) => (
                            <SwipeableNoteItem
                                key={note.id}
                                note={note}
                                isMobile={isMobile}
                                onDelete={onDeleteNote}
                                onEdit={onEditNote}
                                onView={onViewNote}
                                onEditInWizard={onEditNoteInWizard}
                                onShare={handleShareNote}
                                shareStatus={shareStatus}
                                activeSwipeId={activeSwipeId}
                                setActiveSwipeId={setActiveSwipeId}
                                multiSelectMode={multiSelectMode}
                                isMultiSelected={multiSelectedIds.has(note.id)}
                                onToggleMultiSelect={handleToggleMultiSelect}
                                onLongPress={handleEnterMultiSelect}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Multi-select action bar */}
            {multiSelectMode && multiSelectedIds.size > 0 && (
                <div className="shrink-0 px-4 py-3 border-t border-tertiary/10 bg-themewhite2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-tertiary">
                            {multiSelectedIds.size} selected
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { setMultiSelectMode(false); setMultiSelectedIds(new Set()); }}
                                className="px-3 py-1.5 text-xs rounded-full bg-themewhite3 text-tertiary hover:bg-tertiary/10 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleMultiDelete}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-red-500 text-white hover:bg-red-600 transition-all active:scale-95"
                            >
                                <Trash2 size={12} />
                                Delete ({multiSelectedIds.size})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

/* ────────────────────────────────────────────────────────────
   MyNotes — Consolidated drawer using BaseDrawer for both
   mobile (bottom sheet) and desktop (modal panel).
   Eliminates ~200 lines of duplicate drawer/drag/animation
   logic by delegating to the shared BaseDrawer component.
   ──────────────────────────────────────────────────────────── */
export function MyNotes({ isVisible, onClose, isMobile: externalIsMobile, notes, onDeleteNote, onEditNote, onViewNote, onEditNoteInWizard }: MyNotesProps) {
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
                />
            )}
        </BaseDrawer>
    );
}
