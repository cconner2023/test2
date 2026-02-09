import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Moon, Sun, Shield, HelpCircle, ChevronUp, User, ChevronRight, ChevronLeft, Bug, PlusCircle, RefreshCw, FileText, Trash2, Pencil, Share2, CheckSquare, Square, Eye, ClipboardCopy } from 'lucide-react';
import { ReleaseNotes, type ReleaseNoteTypes } from '../Data/Release';
import { BaseDrawer } from './BaseDrawer';
import type { SavedNote } from '../Hooks/useNotesStorage';
import { useNoteShare } from '../Hooks/useNoteShare';
import { useSpring, animated } from '@react-spring/web';

interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    isMobile?: boolean;
    onMyNotesClick?: () => void;
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

const ReleaseNotesPanel = ({ onBack }: { onBack: () => void }) => {
    const groupedNotes = ReleaseNotes.reduce<Record<string, ReleaseNoteTypes[]>>((acc, note) => {
        const version = note.version;
        if (!acc[version]) acc[version] = [];
        acc[version].push(note);
        return acc;
    }, {});

    const versions = Object.keys(groupedNotes).sort((a, b) => parseFloat(b) - parseFloat(a));

    return (
        <div className="h-full flex flex-col">
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
                        <div className="mr-4 w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-primary shrink-0">
                            <User size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-primary md:text-lg">Guest User</p>
                            <p className="text-xs text-tertiary/60 md:text-sm">Tap to sign in</p>
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
   SwipeableNoteItemSettings — A single note row for the Settings-embedded My Notes panel.
   Simplified version matching the standalone MyNotes component behavior.
   ──────────────────────────────────────────────────────────── */
const SwipeableNoteItemSettings = ({
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
}) => {
    const [confirmDeleteId, setConfirmDeleteId] = useState(false);
    const [copiedId, setCopiedId] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState('');
    const [desktopActionsVisible, setDesktopActionsVisible] = useState(false);
    const [mobileSelected, setMobileSelected] = useState(false);

    const [springStyles, springApi] = useSpring(() => ({
        x: 0,
        config: { tension: 300, friction: 28 },
    }));
    const swipeTargetRef = useRef(0);

    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const touchStartTime = useRef(0);
    const currentOffsetRef = useRef(0);
    const lastMoveOffsetRef = useRef(0);
    const isTrackingSwipe = useRef(false);
    const swipeDirection = useRef<'none' | 'horizontal' | 'vertical'>('none');
    const noteRowRef = useRef<HTMLDivElement>(null);
    const wasSwiping = useRef(false);

    const ACTION_WIDTH = 64;
    const SNAP_THRESHOLD = 32;
    const VELOCITY_THRESHOLD = 0.3;

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

    useEffect(() => {
        if (activeSwipeId !== note.id && desktopActionsVisible) {
            setDesktopActionsVisible(false);
        }
        if (activeSwipeId !== note.id && mobileSelected) {
            setMobileSelected(false);
        }
    }, [activeSwipeId, note.id, desktopActionsVisible, mobileSelected]);

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
        currentOffsetRef.current = swipeTargetRef.current;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isMobile || !isTrackingSwipe.current || isEditing) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartX.current;
        const deltaY = touch.clientY - touchStartY.current;

        if (swipeDirection.current === 'none') {
            if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
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

        const startOffset = currentOffsetRef.current;
        let newOffset = startOffset + deltaX;
        const maxLeft = -(ACTION_WIDTH * 2);
        const maxRight = ACTION_WIDTH;

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
        if (!isMobile || !isTrackingSwipe.current || isEditing) return;
        isTrackingSwipe.current = false;

        const elapsed = Date.now() - touchStartTime.current;
        const currentVisualOffset = lastMoveOffsetRef.current;
        const velocity = (currentVisualOffset - currentOffsetRef.current) / Math.max(elapsed, 1);

        let targetOffset = 0;

        if (velocity < -VELOCITY_THRESHOLD || currentVisualOffset < -SNAP_THRESHOLD) {
            targetOffset = -(ACTION_WIDTH * 2);
            setActiveSwipeId(note.id);
        } else if (velocity > VELOCITY_THRESHOLD || currentVisualOffset > SNAP_THRESHOLD) {
            targetOffset = ACTION_WIDTH;
            setActiveSwipeId(note.id);
        } else {
            targetOffset = 0;
            if (activeSwipeId === note.id) {
                setActiveSwipeId(null);
            }
        }

        springApi.start({ x: targetOffset, immediate: false });
        swipeTargetRef.current = targetOffset;
        currentOffsetRef.current = targetOffset;
    };

    const handleNoteClick = () => {
        if (isEditing) return;

        if (isMobile) {
            if (wasSwiping.current) return;
            if (swipeTargetRef.current !== 0) {
                springApi.start({ x: 0 });
                swipeTargetRef.current = 0;
                currentOffsetRef.current = 0;
                lastMoveOffsetRef.current = 0;
                setActiveSwipeId(null);
                setMobileSelected(false);
                return;
            }
            if (mobileSelected) {
                setMobileSelected(false);
                setActiveSwipeId(null);
            } else {
                setMobileSelected(true);
                setActiveSwipeId(note.id);
            }
        } else {
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
            {/* Mobile swipe action buttons */}
            {isMobile && (
                <>
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
                    {isMobile && !isEditing && (
                        <div className="shrink-0 text-tertiary/20">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                            </svg>
                        </div>
                    )}
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

                {/* Desktop action buttons */}
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

                {/* Mobile action buttons on tap select */}
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

                {/* Edit mode */}
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
   MyNotesPanel — Embedded My Notes panel inside Settings drawer.
   Acts like the Release Notes panel - slides in from the right,
   has a back button to return to Settings main.
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
}: {
    onBack: () => void;
    isMobile: boolean;
    notes: SavedNote[];
    onDeleteNote: (noteId: string) => void;
    onEditNote?: (noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>) => void;
    onViewNote?: (note: SavedNote) => void;
    onEditNoteInWizard?: (note: SavedNote) => void;
    onCloseDrawer: () => void;
}) => {
    const [activeSwipeId, setActiveSwipeId] = useState<string | null>(null);
    const { shareNote, shareStatus } = useNoteShare();

    const handleShareNote = (note: SavedNote) => {
        shareNote(note, isMobile);
    };

    const handleViewNote = (note: SavedNote) => {
        // Close the settings drawer when viewing a note
        onCloseDrawer();
        if (onViewNote) {
            onViewNote(note);
        }
    };

    const handleEditNoteInWizard = (note: SavedNote) => {
        // Close the settings drawer when editing a note in the wizard
        onCloseDrawer();
        if (onEditNoteInWizard) {
            onEditNoteInWizard(note);
        }
    };

    const handleContentClick = () => {
        if (activeSwipeId) {
            setActiveSwipeId(null);
        }
    };

    return (
        <div className="h-full flex flex-col">
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

            <div
                className="flex-1 overflow-y-auto"
                onClick={handleContentClick}
            >
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
                ) : (
                    <div className="p-3 md:p-4">
                        {isMobile && (
                            <p className="text-[10px] text-tertiary/40 text-center mb-2">
                                Tap to select · Swipe for quick actions
                            </p>
                        )}
                        {notes.map((note) => (
                            <SwipeableNoteItemSettings
                                key={note.id}
                                note={note}
                                isMobile={isMobile}
                                onDelete={onDeleteNote}
                                onEdit={onEditNote}
                                onView={handleViewNote}
                                onEditInWizard={handleEditNoteInWizard}
                                onShare={handleShareNote}
                                shareStatus={shareStatus}
                                activeSwipeId={activeSwipeId}
                                setActiveSwipeId={setActiveSwipeId}
                            />
                        ))}
                    </div>
                )}
            </div>
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
    onMyNotesClick,
    notes = [],
    onDeleteNote,
    onEditNote,
    onViewNote,
    onEditNoteInWizard,
}: SettingsDrawerProps) => {
    const [activePanel, setActivePanel] = useState<'main' | 'release-notes' | 'my-notes'>('main');
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');

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
            partialHeight="45dvh"
            fullHeight="90dvh"
            backdropOpacity={0.9}
            desktopPosition="right"
            desktopContainerMaxWidth="max-w-315"
            desktopMaxWidth="max-w-sm"
            desktopPanelPadding=""
            desktopHeight="h-[550px]"
            desktopTopOffset="4.5rem"
            disableDrag={activePanel !== 'main'}
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
                        <ReleaseNotesPanel onBack={() => handleItemClick(-2, handleClose)} />
                    ) : (
                        <MyNotesPanel
                            onBack={() => handleItemClick(-2, handleClose)}
                            isMobile={externalIsMobile ?? (typeof window !== 'undefined' && window.innerWidth < 768)}
                            notes={notes}
                            onDeleteNote={onDeleteNote || (() => {})}
                            onEditNote={onEditNote}
                            onViewNote={onViewNote}
                            onEditNoteInWizard={onEditNoteInWizard}
                            onCloseDrawer={handleClose}
                        />
                    )}
                </ContentWrapper>
            )}
        </BaseDrawer>
    );
};
