// Components/MyNotes.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, FileText, Trash2, ClipboardCopy, Pencil } from 'lucide-react';
import type { SavedNote } from '../Hooks/useNotesStorage';

interface MyNotesProps {
    isVisible: boolean;
    onClose: () => void;
    isMobile?: boolean;
    notes: SavedNote[];
    onDeleteNote: (noteId: string) => void;
    onEditNote?: (noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>) => void;
}

/* ────────────────────────────────────────────────────────────
   SwipeableNoteItem — A single note row with gesture support.
   Mobile:  swipe left → edit + copy, swipe right → delete
   Desktop: click to reveal all three (edit, copy, delete)
   ──────────────────────────────────────────────────────────── */
const SwipeableNoteItem = ({
    note,
    isMobile,
    onDelete,
    onEdit,
    activeSwipeId,
    setActiveSwipeId,
}: {
    note: SavedNote;
    isMobile: boolean;
    onDelete: (noteId: string) => void;
    onEdit?: (noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>) => void;
    activeSwipeId: string | null;
    setActiveSwipeId: (id: string | null) => void;
}) => {
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(false);
    const [copiedId, setCopiedId] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState('');
    const [desktopActionsVisible, setDesktopActionsVisible] = useState(false);

    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const touchStartTime = useRef(0);
    const currentOffsetRef = useRef(0);
    const isTrackingSwipe = useRef(false);
    const swipeDirection = useRef<'none' | 'horizontal' | 'vertical'>('none');

    const ACTION_WIDTH = 72; // Width of each action button area
    const SNAP_THRESHOLD = 36; // Half of action width for snap decision
    const VELOCITY_THRESHOLD = 0.3;

    // Reset swipe when another item becomes active
    useEffect(() => {
        if (activeSwipeId !== note.id && swipeOffset !== 0) {
            setIsAnimating(true);
            setSwipeOffset(0);
            currentOffsetRef.current = 0;
        }
    }, [activeSwipeId, note.id, swipeOffset]);

    // Reset desktop actions when another item is active
    useEffect(() => {
        if (activeSwipeId !== note.id && desktopActionsVisible) {
            setDesktopActionsVisible(false);
        }
    }, [activeSwipeId, note.id, desktopActionsVisible]);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!isMobile || isEditing) return;
        const touch = e.touches[0];
        touchStartX.current = touch.clientX;
        touchStartY.current = touch.clientY;
        touchStartTime.current = Date.now();
        isTrackingSwipe.current = true;
        swipeDirection.current = 'none';
        setIsAnimating(false);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isMobile || !isTrackingSwipe.current || isEditing) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartX.current;
        const deltaY = touch.clientY - touchStartY.current;

        // Determine direction on first significant movement
        if (swipeDirection.current === 'none') {
            if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
                if (Math.abs(deltaY) > Math.abs(deltaX)) {
                    swipeDirection.current = 'vertical';
                    isTrackingSwipe.current = false;
                    return;
                }
                swipeDirection.current = 'horizontal';
            } else {
                return;
            }
        }

        if (swipeDirection.current !== 'horizontal') return;

        // Prevent vertical scroll while swiping horizontally
        e.preventDefault();

        const startOffset = currentOffsetRef.current;
        let newOffset = startOffset + deltaX;

        // Clamp: left max = -ACTION_WIDTH*2 (showing edit+copy), right max = ACTION_WIDTH (showing delete)
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

        setSwipeOffset(newOffset);
    };

    const handleTouchEnd = () => {
        if (!isMobile || !isTrackingSwipe.current || isEditing) return;
        isTrackingSwipe.current = false;

        const elapsed = Date.now() - touchStartTime.current;
        const velocity = (swipeOffset - currentOffsetRef.current) / Math.max(elapsed, 1);

        setIsAnimating(true);

        let targetOffset = 0;

        if (velocity < -VELOCITY_THRESHOLD || swipeOffset < -SNAP_THRESHOLD) {
            // Swiped left → show edit + copy
            targetOffset = -(ACTION_WIDTH * 2);
            setActiveSwipeId(note.id);
        } else if (velocity > VELOCITY_THRESHOLD || swipeOffset > SNAP_THRESHOLD) {
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

        setSwipeOffset(targetOffset);
        currentOffsetRef.current = targetOffset;
    };

    // Desktop click handler
    const handleDesktopClick = () => {
        if (isMobile || isEditing) return;
        if (desktopActionsVisible) {
            setDesktopActionsVisible(false);
            setActiveSwipeId(null);
        } else {
            setDesktopActionsVisible(true);
            setActiveSwipeId(note.id);
        }
    };

    const handleCopy = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(note.encodedText);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
        // Reset swipe after action
        if (isMobile) {
            setTimeout(() => {
                setIsAnimating(true);
                setSwipeOffset(0);
                currentOffsetRef.current = 0;
                setActiveSwipeId(null);
            }, 300);
        }
    };

    const handleDelete = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        if (confirmDeleteId) {
            onDelete(note.id);
            setConfirmDeleteId(false);
            setActiveSwipeId(null);
        } else {
            setConfirmDeleteId(true);
            setTimeout(() => setConfirmDeleteId(false), 3000);
        }
    };

    const handleEditStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        setEditText(note.previewText || '');
        setIsEditing(true);
        // Reset swipe
        if (isMobile) {
            setIsAnimating(true);
            setSwipeOffset(0);
            currentOffsetRef.current = 0;
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
            {isMobile && (
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

                    {/* Right side actions (revealed when swiping left → edit + copy) */}
                    <div
                        className="absolute inset-y-0 right-0 flex items-stretch"
                        style={{ width: ACTION_WIDTH * 2 }}
                    >
                        <button
                            className="flex-1 flex flex-col items-center justify-center gap-1 bg-blue-500 text-white text-xs font-medium"
                            onTouchEnd={handleEditStart}
                            onClick={handleEditStart}
                        >
                            <Pencil size={18} />
                            <span>Edit</span>
                        </button>
                        <button
                            className={`flex-1 flex flex-col items-center justify-center gap-1 text-white text-xs font-medium transition-colors ${
                                copiedId ? 'bg-green-500' : 'bg-amber-500'
                            }`}
                            onTouchEnd={handleCopy}
                            onClick={handleCopy}
                        >
                            <ClipboardCopy size={18} />
                            <span>{copiedId ? 'Copied!' : 'Copy'}</span>
                        </button>
                    </div>
                </>
            )}

            {/* ── Main note content (slides on mobile) ── */}
            <div
                className={`relative z-10 bg-themewhite border border-tertiary/10 rounded-lg ${
                    !isMobile ? 'cursor-pointer hover:bg-themewhite2/50' : ''
                } ${isAnimating ? 'transition-transform duration-300 ease-out' : ''}`}
                style={isMobile ? { transform: `translateX(${swipeOffset}px)` } : undefined}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={handleDesktopClick}
                onTransitionEnd={() => setIsAnimating(false)}
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
                                onClick={handleEditStart}
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
            </div>
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
}: {
    onClose: () => void;
    isMobile: boolean;
    notes: SavedNote[];
    onDeleteNote: (noteId: string) => void;
    onEditNote?: (noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>) => void;
}) => {
    const [activeSwipeId, setActiveSwipeId] = useState<string | null>(null);

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
                                Swipe left for edit/copy, right for delete
                            </p>
                        )}
                        {notes.map((note) => (
                            <SwipeableNoteItem
                                key={note.id}
                                note={note}
                                isMobile={isMobile}
                                onDelete={onDeleteNote}
                                onEdit={onEditNote}
                                activeSwipeId={activeSwipeId}
                                setActiveSwipeId={setActiveSwipeId}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

/* ────────────────────────────────────────────────────────────
   MyNotes — Drawer shell (mobile bottom sheet / desktop modal)
   ──────────────────────────────────────────────────────────── */
export function MyNotes({ isVisible, onClose, isMobile: externalIsMobile, notes, onDeleteNote, onEditNote }: MyNotesProps) {
    const [localIsMobile, setLocalIsMobile] = useState(false);
    const isMobile = externalIsMobile !== undefined ? externalIsMobile : localIsMobile;

    const [drawerPosition, setDrawerPosition] = useState(0);
    const [drawerStage, setDrawerStage] = useState<'partial' | 'full'>('partial');
    const [isDragging, setIsDragging] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const dragStartY = useRef(0);
    const dragStartPosition = useRef(0);
    const animationFrameId = useRef<number>(0);
    const velocityRef = useRef(0);
    const lastYRef = useRef(0);
    const lastTimeRef = useRef(0);

    useEffect(() => {
        if (externalIsMobile === undefined) {
            const checkMobile = () => setLocalIsMobile(window.innerWidth < 768);
            checkMobile();
            window.addEventListener('resize', checkMobile);
            return () => window.removeEventListener('resize', checkMobile);
        }
    }, [externalIsMobile]);

    useEffect(() => {
        if (isVisible) {
            setDrawerStage('partial');
            setDrawerPosition(100);
            document.body.style.overflow = 'hidden';
        } else {
            setDrawerPosition(0);
            document.body.style.overflow = '';
        }
        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [isVisible]);

    const animateToPosition = useCallback((targetPosition: number) => {
        const startPosition = drawerPosition;
        const startTime = performance.now();
        const duration = 300;

        const animate = (timestamp: number) => {
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentPosition = startPosition + (targetPosition - startPosition) * easeProgress;

            setDrawerPosition(currentPosition);

            if (progress < 1) {
                animationFrameId.current = requestAnimationFrame(animate);
            } else {
                animationFrameId.current = 0;
                if (targetPosition === 0) {
                    setTimeout(onClose, 50);
                }
            }
        };

        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }
        animationFrameId.current = requestAnimationFrame(animate);
    }, [drawerPosition, onClose]);

    const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isMobile) return;

        const target = e.target as HTMLElement;
        if (!target.closest('[data-drag-zone]')) return;

        setIsDragging(true);
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragStartY.current = clientY;
        dragStartPosition.current = drawerPosition;
        lastYRef.current = clientY;
        lastTimeRef.current = performance.now();
        velocityRef.current = 0;
        e.stopPropagation();
    };

    const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isDragging || !isMobile) return;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const deltaY = clientY - dragStartY.current;

        const currentTime = performance.now();
        const deltaTime = currentTime - lastTimeRef.current;
        if (deltaTime > 0) {
            velocityRef.current = (clientY - lastYRef.current) / deltaTime;
        }

        lastYRef.current = clientY;
        lastTimeRef.current = currentTime;

        const dragSensitivity = 0.8;
        const newPosition = Math.min(100, Math.max(20, dragStartPosition.current - (deltaY * dragSensitivity)));
        setDrawerPosition(newPosition);
        e.stopPropagation();
    };

    const handleDragEnd = () => {
        if (!isDragging || !isMobile) return;
        setIsDragging(false);

        const isSwipingDown = velocityRef.current > 0.3;
        const isSwipingUp = velocityRef.current < -0.3;

        if (drawerStage === 'partial') {
            if (isSwipingUp) {
                setDrawerStage('full');
                animateToPosition(100);
            } else if (isSwipingDown || drawerPosition < 40) {
                animateToPosition(0);
            } else {
                animateToPosition(100);
            }
        } else {
            if (velocityRef.current > 0.6 || drawerPosition < 30) {
                animateToPosition(0);
            } else if (isSwipingDown || drawerPosition < 70) {
                setDrawerStage('partial');
                animateToPosition(100);
            } else {
                animateToPosition(100);
            }
        }
    };

    const handleClose = () => {
        if (isMobile) {
            animateToPosition(0);
        } else {
            onClose();
        }
    };

    const mobileTranslateY = 100 - drawerPosition;
    const mobileOpacity = Math.min(1, drawerPosition / 60 + 0.2);
    const mobileHeight = drawerStage === 'partial' ? '45dvh' : '90dvh';
    const mobileHorizontalPadding = drawerStage === 'partial' ? '0.4rem' : '0';
    const mobileBottomPadding = drawerStage === 'partial' ? '1.5rem' : '0';
    const mobileBorderRadius = drawerStage === 'partial' ? '1rem' : '1.25rem 1.25rem 0 0';
    const mobileBoxShadow = drawerStage === 'partial'
        ? '0 4px 2px rgba(0, 0, 0, 0.05)'
        : '0 -4px 20px rgba(0, 0, 0, 0.1)';

    return (
        <div ref={drawerRef}>
            {isMobile ? (
                <>
                    <div
                        className={`fixed inset-0 z-60 bg-black ${isDragging ? '' : 'transition-opacity duration-300 ease-out'}`}
                        style={{
                            opacity: (drawerPosition / 100) * 0.9,
                            pointerEvents: drawerPosition > 0 ? 'auto' : 'none',
                        }}
                        onClick={handleClose}
                    />
                    <div
                        className={`fixed left-0 right-0 z-60 bg-themewhite3 flex flex-col ${isDragging ? '' : 'transition-all duration-300 ease-out'}`}
                        style={{
                            height: mobileHeight,
                            maxHeight: mobileHeight,
                            marginLeft: mobileHorizontalPadding,
                            marginRight: mobileHorizontalPadding,
                            marginBottom: mobileBottomPadding,
                            width: drawerStage === 'partial' ? 'calc(100% - 0.8rem)' : '100%',
                            bottom: 0,
                            transform: `translateY(${mobileTranslateY}%)`,
                            opacity: mobileOpacity,
                            borderRadius: mobileBorderRadius,
                            willChange: isDragging ? 'transform' : 'auto',
                            boxShadow: mobileBoxShadow,
                            overflow: 'hidden',
                            visibility: isVisible ? 'visible' : 'hidden',
                        }}
                        onTouchStart={handleDragStart}
                        onTouchMove={handleDragMove}
                        onTouchEnd={handleDragEnd}
                        onMouseDown={handleDragStart}
                        onMouseMove={handleDragMove}
                        onMouseUp={handleDragEnd}
                        onMouseLeave={handleDragEnd}
                    >
                        <MyNotesContent
                            onClose={handleClose}
                            isMobile={isMobile}
                            notes={notes}
                            onDeleteNote={onDeleteNote}
                            onEditNote={onEditNote}
                        />
                    </div>
                </>
            ) : (
                /* Desktop modal */
                <div
                    className={`fixed inset-0 z-60 flex items-start justify-center transition-all duration-300 ease-out ${isVisible
                        ? 'visible pointer-events-auto'
                        : 'invisible pointer-events-none'
                        }`}
                    onClick={onClose}
                >
                    <div className="max-w-315 w-full relative">
                        <div
                            className={`absolute right-2 top-2 z-60
                            flex flex-col rounded-xl
                            border border-tertiary/20
                            shadow-[0_2px_4px_0] shadow-themewhite2/20
                            backdrop-blur-md bg-themewhite2/10
                            transform-gpu
                            overflow-hidden
                            text-primary/80 text-sm
                            origin-top-right
                            transition-all duration-300 ease-out
                            max-w-md
                            w-full
                            h-[500px]
                            ${isVisible
                                    ? "scale-x-100 scale-y-100 translate-x-0 translate-y-0"
                                    : "opacity-0 scale-x-20 scale-y-20 translate-x-10 -translate-y-2 pointer-events-none"
                                }`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MyNotesContent
                                onClose={onClose}
                                isMobile={isMobile}
                                notes={notes}
                                onDeleteNote={onDeleteNote}
                                onEditNote={onEditNote}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
