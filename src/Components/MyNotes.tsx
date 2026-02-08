// Components/MyNotes.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, FileText, Trash2, ClipboardCopy } from 'lucide-react';
import type { SavedNote } from '../Hooks/useNotesStorage';

interface MyNotesProps {
    isVisible: boolean;
    onClose: () => void;
    isMobile?: boolean;
    notes: SavedNote[];
    onDeleteNote: (noteId: string) => void;
}

// Content component rendered once - state persists across layout changes
const MyNotesContent = ({
    onClose,
    isMobile,
    notes,
    onDeleteNote,
}: {
    onClose: () => void;
    isMobile: boolean;
    notes: SavedNote[];
    onDeleteNote: (noteId: string) => void;
}) => {
    const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Track whether a button action handled the click (prevents parent toggle from interfering)
    const actionHandledRef = useRef(false);

    const handleToggleExpand = (noteId: string) => {
        // Skip if a child action button already handled this click
        if (actionHandledRef.current) {
            actionHandledRef.current = false;
            return;
        }
        setExpandedNoteId(prev => prev === noteId ? null : noteId);
        setConfirmDeleteId(null); // Reset delete confirm when toggling
    };

    const handleDeleteClick = (e: React.MouseEvent, noteId: string) => {
        e.stopPropagation();
        actionHandledRef.current = true;
        if (confirmDeleteId === noteId) {
            onDeleteNote(noteId);
            setConfirmDeleteId(null);
            setExpandedNoteId(null);
        } else {
            setConfirmDeleteId(noteId);
            // Auto-clear confirm state after 3s
            setTimeout(() => setConfirmDeleteId(prev => prev === noteId ? null : prev), 3000);
        }
    };

    const handleCopy = (e: React.MouseEvent, note: SavedNote) => {
        e.stopPropagation();
        actionHandledRef.current = true;
        navigator.clipboard.writeText(note.encodedText);
        setCopiedId(note.id);
        setTimeout(() => setCopiedId(prev => prev === note.id ? null : prev), 2000);
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
            <div className={`overflow-y-auto flex-1 ${isMobile ? 'pb-[env(safe-area-inset-bottom)]' : ''}`}>
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
                    <div className="p-3 md:p-4 space-y-2">
                        {notes.map((note) => {
                            const isExpanded = expandedNoteId === note.id;
                            const isConfirmingDelete = confirmDeleteId === note.id;
                            const isCopied = copiedId === note.id;

                            return (
                                <div
                                    key={note.id}
                                    className={`rounded-lg border transition-all duration-200 overflow-hidden cursor-pointer
                                        ${isExpanded
                                            ? 'border-themeblue3/30 bg-themewhite2 shadow-sm'
                                            : 'border-tertiary/10 bg-themewhite hover:bg-themewhite2/50'
                                        }`}
                                    onClick={() => handleToggleExpand(note.id)}
                                >
                                    {/* Note summary row */}
                                    <div className="flex items-center gap-3 px-3 py-3">
                                        <div className="shrink-0 w-8 h-8 rounded-full bg-themeblue3/10 flex items-center justify-center text-sm">
                                            {note.symptomIcon || '📋'}
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
                                        <div className="shrink-0 text-tertiary/30">
                                            <svg
                                                className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Expanded content */}
                                    {isExpanded && (
                                        <div className="px-3 pb-3 border-t border-tertiary/10">
                                            {/* Preview text */}
                                            <div className="mt-2 p-2 rounded bg-themewhite3 text-xs text-tertiary/80 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                                                {note.previewText || note.encodedText}
                                            </div>

                                            {/* Encoded string */}
                                            <div className="mt-2">
                                                <p className="text-[10px] text-tertiary/40 mb-1">Encoded:</p>
                                                <code className="text-[10px] text-tertiary/50 break-all block bg-themewhite3/50 p-1.5 rounded max-h-16 overflow-y-auto">
                                                    {note.encodedText}
                                                </code>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center justify-end gap-2 mt-3">
                                                <button
                                                    onClick={(e) => handleCopy(e, note)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-themewhite3 text-tertiary hover:bg-themeblue3/10 hover:text-themeblue3 transition-all active:scale-95"
                                                    title="Copy encoded text"
                                                >
                                                    <ClipboardCopy size={12} />
                                                    {isCopied ? 'Copied!' : 'Copy'}
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteClick(e, note.id)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all active:scale-95
                                                        ${isConfirmingDelete
                                                            ? 'bg-red-500 text-white'
                                                            : 'bg-themewhite3 text-tertiary hover:bg-red-50 hover:text-red-500'
                                                        }`}
                                                    title={isConfirmingDelete ? 'Click again to confirm delete' : 'Delete note'}
                                                >
                                                    <Trash2 size={12} />
                                                    {isConfirmingDelete ? 'Confirm Delete' : 'Delete'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
};

export function MyNotes({ isVisible, onClose, isMobile: externalIsMobile, notes, onDeleteNote }: MyNotesProps) {
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
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
