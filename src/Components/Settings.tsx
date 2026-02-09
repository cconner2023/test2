import { useState, useCallback, useRef, useEffect } from 'react';
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
        <div
            className={`relative rounded-lg mb-2 cursor-pointer transition-all duration-150 ${
                isSelected
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
   Action menu is at the BOTTOM of the panel, not per-item.
   Single-select shows full actions, multi-select shows only delete.
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
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
        confirmDeleteRef.current = false;
        setConfirmDelete(false);
    }, []);

    const handleClearSelection = useCallback(() => {
        setSelectedIds(new Set());
        confirmDeleteRef.current = false;
        setConfirmDelete(false);
    }, []);

    const handleViewNote = useCallback((note: SavedNote) => {
        onCloseDrawer();
        if (onViewNote) onViewNote(note);
    }, [onCloseDrawer, onViewNote]);

    const handleEditNoteInWizard = useCallback((note: SavedNote) => {
        onCloseDrawer();
        if (onEditNoteInWizard) onEditNoteInWizard(note);
    }, [onCloseDrawer, onEditNoteInWizard]);

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
                ) : (
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

            {/* Bottom Action Bar — only visible when notes are selected */}
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
                                    onClick={() => handleShare(singleNote)}
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
                                    onClick={handleDelete}
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
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    onClick={handleDelete}
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
