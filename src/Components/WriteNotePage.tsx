import { useState, useEffect, useRef, useCallback } from 'react';
import type { dispositionType, AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import { useNoteCapture } from '../Hooks/useNoteCapture';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { GESTURE_THRESHOLDS } from '../Utilities/GestureUtils';
import { TextButton } from './TextButton';
import { NoteBarcodeGenerator } from './Barcode';
import { DecisionMaking } from './DecisionMaking';
import { BaseDrawer } from './BaseDrawer';

type DispositionType = dispositionType['type'];

const PAGE_LABELS = ['Decision Making', 'Write Note', 'View Note', 'Share Note'];
const TOTAL_PAGES = 4;

export interface NoteSaveData {
    encodedText: string;
    previewText: string;
    symptomIcon: string;
    symptomText: string;
    dispositionType: string;
    dispositionText: string;
}

interface WriteNoteProps {
    disposition: {
        type: DispositionType;
        text: string;
        addendum?: string;
    };
    algorithmOptions?: AlgorithmOptions[];
    cardStates?: CardState[];
    onExpansionChange: (expanded: boolean) => void;
    onNoteSave?: (data: NoteSaveData) => boolean | void;
    onNoteDelete?: (noteId: string) => void;
    onNoteUpdate?: (noteId: string, data: NoteSaveData) => boolean | void;
    existingNoteId?: string | null;
    existingEncodedText?: string | null;
    selectedSymptom?: {
        icon: string;
        text: string;
    };
    isMobile?: boolean;
    initialPage?: number;
    initialHpiText?: string;
    noteSource?: string | null;
    onAfterSave?: () => void;
}

export const WriteNotePage = ({
    disposition,
    algorithmOptions = [],
    cardStates = [],
    onExpansionChange,
    onNoteSave,
    onNoteDelete,
    onNoteUpdate,
    existingNoteId = null,
    existingEncodedText = null,
    selectedSymptom = { icon: '', text: '' },
    isMobile = false,
    initialPage = 0,
    initialHpiText = '',
    noteSource = null,
    onAfterSave,
}: WriteNoteProps) => {
    // Note content state
    const [note, setNote] = useState<string>(initialHpiText);
    const [previewNote, setPreviewNote] = useState<string>('');
    const [includeAlgorithm, setIncludeAlgorithm] = useState<boolean>(true);
    const [includeDecisionMaking, setIncludeDecisionMaking] = useState<boolean>(true);
    const [includeHPI, setIncludeHPI] = useState<boolean>(!!initialHpiText);
    const [encodedValue, setEncodedValue] = useState<string>('');
    const [isCopied, setIsCopied] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const confirmDeleteRef = useRef(false);
    const confirmDeleteTimeoutRef = useRef<ReturnType<typeof setTimeout>>(0);

    // Page navigation state (0=Decision Making, 1=Write Note, 2=View Note, 3=Share Note)
    const [currentPage, setCurrentPage] = useState(initialPage);

    // Desktop expansion state for smooth animation
    const [desktopExpanded, setDesktopExpanded] = useState(false);

    // Refs
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const carouselRef = useRef<HTMLDivElement>(null);

    // Animate carousel to currentPage (button nav or swipe completion)
    useEffect(() => {
        if (!carouselRef.current) return;
        carouselRef.current.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        carouselRef.current.style.transform = `translateX(${-currentPage * 100}%)`;
    }, [currentPage]);

    // Ref-based drag state — no React re-renders during gesture
    const dragRef = useRef<{
        startX: number;
        startY: number;
        locked: boolean | null; // null = undecided, true = horizontal, false = vertical
    } | null>(null);
    const currentPageRef = useRef(currentPage);
    currentPageRef.current = currentPage;

    // Hooks
    const { generateNote } = useNoteCapture(algorithmOptions, cardStates);
    const colors = getColorClasses(disposition.type);

    // --- Desktop mount animation ---
    useEffect(() => {
        if (!isMobile) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setDesktopExpanded(true);
                });
            });
        }
    }, [isMobile]);

    // --- Copied state auto-revert ---
    useEffect(() => {
        if (isCopied) {
            const id = window.setTimeout(() => setIsCopied(false), 2000);
            return () => clearTimeout(id);
        }
    }, [isCopied]);

    // --- Preview note generation (eagerly updates so content is ready before navigating to View Note) ---
    useEffect(() => {
        const result = generateNote(
            { includeAlgorithm, includeDecisionMaking, customNote: includeHPI ? note : '' },
            disposition.type,
            disposition.text,
            selectedSymptom
        );
        setPreviewNote(result.fullNote);
    }, [note, includeAlgorithm, includeDecisionMaking, includeHPI, generateNote, disposition, selectedSymptom]);

    // --- Close handler (animate out then unmount) ---
    const handleDesktopClose = useCallback(() => {
        setDesktopExpanded(false);
        setTimeout(() => onExpansionChange(false), 400);
    }, [onExpansionChange]);

    // --- Copy handler ---
    const handleCopy = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
        setIsCopied(true);
    }, []);

    // --- Determine button state based on existing note ---
    // isAlreadySaved: note exists in storage (existingNoteId is set)
    // hasContentChanged: encoded value differs from what was saved
    const isAlreadySaved = Boolean(existingNoteId);
    const hasContentChanged = isAlreadySaved && encodedValue !== '' && encodedValue !== existingEncodedText;

    // --- Save note handler (new note) ---
    const handleSaveNote = useCallback(() => {
        if (!encodedValue) return;
        const result = onNoteSave?.({
            encodedText: encodedValue,
            previewText: previewNote.slice(0, 200),
            symptomIcon: selectedSymptom?.icon || '',
            symptomText: selectedSymptom?.text || 'Note',
            dispositionType: disposition.type,
            dispositionText: disposition.text,
        });
        if (result === false) {
            // Save failed — show error state on button briefly
            setSaveFailed(true);
            setTimeout(() => setSaveFailed(false), 3000);
            return;
        }
        setIsSaved(true);
        if (onAfterSave) {
            setTimeout(() => onAfterSave(), 800);
        } else {
            setTimeout(() => setIsSaved(false), 2500);
        }
    }, [encodedValue, previewNote, selectedSymptom, disposition, onNoteSave, onAfterSave]);

    // --- Delete note handler (two-tap confirmation) ---
    const handleDeleteNote = useCallback(() => {
        if (!existingNoteId) return;
        if (confirmDeleteRef.current) {
            // Second tap — actually delete
            onNoteDelete?.(existingNoteId);
            setIsDeleted(true);
            confirmDeleteRef.current = false;
            setConfirmDelete(false);
            if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
            setTimeout(() => setIsDeleted(false), 2500);
        } else {
            // First tap — ask for confirmation
            confirmDeleteRef.current = true;
            setConfirmDelete(true);
            if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
            confirmDeleteTimeoutRef.current = setTimeout(() => {
                confirmDeleteRef.current = false;
                setConfirmDelete(false);
            }, 5000);
        }
    }, [existingNoteId, onNoteDelete]);

    // --- Update note handler (save changes to existing note) ---
    const handleUpdateNote = useCallback(() => {
        if (!existingNoteId || !encodedValue) return;
        const result = onNoteUpdate?.(existingNoteId, {
            encodedText: encodedValue,
            previewText: previewNote.slice(0, 200),
            symptomIcon: selectedSymptom?.icon || '',
            symptomText: selectedSymptom?.text || 'Note',
            dispositionType: disposition.type,
            dispositionText: disposition.text,
        });
        if (result === false) return;
        setIsSaved(true);
        if (onAfterSave) {
            setTimeout(() => onAfterSave(), 800);
        } else {
            setTimeout(() => setIsSaved(false), 2500);
        }
    }, [existingNoteId, encodedValue, previewNote, selectedSymptom, disposition, onNoteUpdate, onAfterSave]);

    const handleClearNoteAndHide = () => {
        setNote('');
        setIncludeHPI(false);
        inputRef.current?.focus();
    };

    // --- Page navigation ---
    const handleNext = useCallback(() => {
        setCurrentPage(prev => Math.min(TOTAL_PAGES - 1, prev + 1));
    }, []);

    const handlePageBack = useCallback(() => {
        setCurrentPage(prev => Math.max(0, prev - 1));
    }, []);

    // ========== PAGE SWIPE (horizontal, mobile only) — direct touch handlers ==========
    const handleSwipeStart = useCallback((e: React.TouchEvent) => {
        if (!isMobile) return;
        // Skip interactive elements — taps on toggles/buttons/inputs must not start a swipe
        const t = e.target as HTMLElement;
        if (t.closest('button, textarea, input, select, [role="checkbox"], [role="button"], [role="slider"]')) return;
        const touch = e.touches[0];
        dragRef.current = { startX: touch.clientX, startY: touch.clientY, locked: null };
    }, [isMobile]);

    const handleSwipeMove = useCallback((e: React.TouchEvent) => {
        const d = dragRef.current;
        if (!d) return;

        const touch = e.touches[0];
        const dx = touch.clientX - d.startX;
        const dy = touch.clientY - d.startY;

        // Direction lock: 10px dead zone
        if (d.locked === null) {
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
            d.locked = Math.abs(dx) > Math.abs(dy);
            if (!d.locked) { dragRef.current = null; return; } // vertical — bail
        }
        if (!d.locked) return;

        e.preventDefault();
        const page = currentPageRef.current;
        let dragX = dx * GESTURE_THRESHOLDS.PAGE_DRAG_DAMPENING;
        // Edge resistance on first/last page
        if (page === 0 && dragX > 0) dragX *= GESTURE_THRESHOLDS.EDGE_RESISTANCE;
        if (page === TOTAL_PAGES - 1 && dragX < 0) dragX *= GESTURE_THRESHOLDS.EDGE_RESISTANCE;

        // Direct DOM update — zero React re-renders during drag
        if (carouselRef.current) {
            carouselRef.current.style.transition = 'none';
            carouselRef.current.style.transform = `translateX(calc(${-page * 100}% + ${dragX}px))`;
        }
    }, []);

    const handleSwipeEnd = useCallback(() => {
        const d = dragRef.current;
        dragRef.current = null;
        if (!d || d.locked !== true) return;

        const page = currentPageRef.current;
        const containerWidth = contentRef.current?.clientWidth || 300;
        const threshold = containerWidth * GESTURE_THRESHOLDS.PAGE_NAV_FRACTION;

        // Re-read final offset from the DOM transform
        const matrix = carouselRef.current ? new DOMMatrix(getComputedStyle(carouselRef.current).transform) : null;
        const currentX = matrix ? matrix.m41 : 0;
        const pageX = -page * containerWidth;
        const dragOffset = currentX - pageX;

        if (dragOffset < -threshold && page < TOTAL_PAGES - 1) {
            setCurrentPage(page + 1);
        } else if (dragOffset > threshold && page > 0) {
            setCurrentPage(page - 1);
        } else {
            // Snap back — re-enable transition and reset position
            if (carouselRef.current) {
                carouselRef.current.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                carouselRef.current.style.transform = `translateX(${-page * 100}%)`;
            }
        }
    }, []);

    const renderContent = (closeHandler: () => void) => (
        <>
            {/* Drag Handle (mobile only) */}
            {isMobile && (
                <div
                    className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
                    style={{ touchAction: 'none' }}
                    data-drag-zone
                >
                    <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
                </div>
            )}

            {/* Header: page title + step dots + close */}
            <div
                className="flex items-center justify-between px-4 py-2 border-b border-themegray1/20 bg-transparent"
                style={isMobile ? { touchAction: 'none' } : {}}
                data-drag-zone
            >
                <div className="flex flex-col gap-1.5 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-primary">{PAGE_LABELS[currentPage]}</span>
                        {noteSource && (
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${noteSource === 'external source'
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                : 'bg-themeblue3/15 text-themeblue3'
                                }`}>
                                {noteSource === 'external source' ? 'Saved Note (External)' : 'Saved Note'}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-1.5">
                        {PAGE_LABELS.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1 rounded-full transition-all duration-300 ${idx === currentPage
                                    ? `w-4 ${colors.symptomClass}`
                                    : idx < currentPage
                                        ? `w-1.5 ${colors.symptomClass} opacity-40`
                                        : 'w-1.5 bg-themegray1/30'
                                    }`}
                            />
                        ))}
                    </div>
                </div>
                <button
                    onClick={closeHandler}
                    className="shrink-0 ml-4 p-2 text-tertiary hover:text-primary transition-colors rounded-full hover:bg-themewhite3"
                    title="Close"
                    aria-label="Close"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Swipeable Content Area */}
            <div
                ref={contentRef}
                className="flex-1 overflow-hidden relative"
                style={{ touchAction: isMobile ? 'pan-y' : 'auto' }}
                onTouchStart={isMobile ? handleSwipeStart : undefined}
                onTouchMove={isMobile ? handleSwipeMove : undefined}
                onTouchEnd={isMobile ? handleSwipeEnd : undefined}
                onTouchCancel={isMobile ? handleSwipeEnd : undefined}
            >
                <div
                    ref={carouselRef}
                    className="flex h-full"
                    style={{ transform: `translateX(${-currentPage * 100}%)` }}
                >
                    {/* Page 0: Decision Making */}
                    <div key="page-0-decision" className="w-full h-full shrink-0 overflow-y-auto">
                        <DecisionMaking
                            algorithmOptions={algorithmOptions}
                            cardStates={cardStates}
                            disposition={disposition}
                            dispositionType={disposition.type}
                        />
                    </div>

                    {/* Page 1: Write Note Options */}
                    <div key="page-1-write" className={`w-full h-full shrink-0 overflow-y-auto p-2 bg-themewhite2 ${isMobile ? 'pb-16' : ''}`}>
                        <div className="space-y-6">
                            <div className="p-4">
                                <div className="text-[10pt] font-normal text-primary mb-3">Note Content:</div>
                                <div className="space-y-3">
                                    <ToggleOption checked={includeAlgorithm} onChange={() => setIncludeAlgorithm(!includeAlgorithm)} label="Algorithm" colors={colors} />
                                    <ToggleOption checked={includeDecisionMaking} onChange={() => setIncludeDecisionMaking(!includeDecisionMaking)} label="Decision Making" colors={colors} />

                                    {!includeHPI && (
                                        <ToggleOption
                                            checked={includeHPI}
                                            onChange={() => { setIncludeHPI(true); setTimeout(() => inputRef.current?.focus(), 100); }}
                                            label="HPI or other clinical note"
                                            colors={colors}
                                        />
                                    )}

                                    {includeHPI && (
                                        <div>
                                            <div className="flex items-center justify-center bg-themewhite text-tertiary rounded-md border border-themeblue3/10 shadow-xs transition-colors duration-200 focus-within:border-themeblue1/30 focus-within:bg-themewhite2">
                                                <textarea
                                                    ref={inputRef}
                                                    value={note}
                                                    onChange={(e) => setNote(e.target.value)}
                                                    className="text-tertiary bg-transparent outline-none text-[16px] md:text-[8pt] w-full px-4 py-2 rounded-l-full min-w-0 resize-none h-10 leading-5"
                                                />
                                                <div
                                                    className="flex items-center justify-center px-2 py-2 bg-transparent stroke-themeblue3 cursor-pointer transition-colors duration-200 shrink-0"
                                                    onClick={handleClearNoteAndHide}
                                                    title="Remove HPI and clear notes"
                                                    aria-label="Remove HPI and clear notes"
                                                >
                                                    <svg className="h-5 w-5 stroke-themeblue1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center mt-2">
                                                <p className="text-xs text-secondary italic">Enter your HPI or other clinical notes above</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Page 2: View Note */}
                    <div key="page-2-view" className={`w-full h-full shrink-0 overflow-y-auto p-4 bg-themewhite2 ${isMobile ? 'pb-16' : ''}`}>
                        <div className="space-y-6">
                            <div className="relative">
                                <div className="w-full max-h-96 p-3 rounded-md bg-themewhite3 text-tertiary text-[8pt] whitespace-pre-wrap overflow-y-auto">
                                    {previewNote || "No content selected"}
                                </div>
                                <CopyButton onClick={() => handleCopy(previewNote)} title="Copy note to clipboard" />
                            </div>
                        </div>
                    </div>

                    {/* Page 3: Share Note */}
                    <div key="page-3-share" className={`w-full h-full shrink-0 overflow-y-auto p-4 bg-themewhite2 ${isMobile ? 'pb-16' : ''}`}>
                        <div className="space-y-6">
                            <div className="text-[10pt] font-normal text-primary">Share Encoded Note</div>
                            <div className="relative">
                                <NoteBarcodeGenerator
                                    algorithmOptions={algorithmOptions}
                                    cardStates={cardStates}
                                    noteOptions={{
                                        includeAlgorithm,
                                        includeDecisionMaking,
                                        customNote: includeHPI ? note : ''
                                    }}
                                    symptomCode={selectedSymptom?.icon?.replace('-', '') || 'A1'}
                                    onEncodedValueChange={setEncodedValue}
                                />
                                <CopyButton onClick={() => handleCopy(encodedValue)} title="Copy encoded value" />
                            </div>
                            {/* Note action button: Save / Delete / Save Changes */}
                            {onNoteSave && !isAlreadySaved && (
                                <button
                                    onClick={handleSaveNote}
                                    disabled={isSaved || !encodedValue}
                                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300 active:scale-95
                                        ${saveFailed
                                            ? 'bg-themeredred/15 text-themeredred'
                                            : isSaved
                                                ? 'bg-green-500/20 text-green-700 dark:text-green-300'
                                                : 'bg-themewhite3 text-tertiary hover:bg-themeblue3/10 hover:text-themeblue3'
                                        }`}
                                >
                                    {saveFailed ? (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            Save Failed — Storage Full
                                        </>
                                    ) : isSaved ? (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                            Saved to My Notes
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                            </svg>
                                            Save to My Notes
                                        </>
                                    )}
                                </button>
                            )}
                            {/* Already saved + content changed → Save Changes */}
                            {isAlreadySaved && hasContentChanged && onNoteUpdate && (
                                <button
                                    onClick={handleUpdateNote}
                                    disabled={isSaved || !encodedValue}
                                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300 active:scale-95
                                        ${isSaved
                                            ? 'bg-green-500/20 text-green-700 dark:text-green-300'
                                            : 'bg-themeblue3/10 text-themeblue3 hover:bg-themeblue3/20'
                                        }`}
                                >
                                    {isSaved ? (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                            Changes Saved
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            Save Changes
                                        </>
                                    )}
                                </button>
                            )}
                            {/* Already saved + no content change → Delete Note (two-tap confirmation) */}
                            {isAlreadySaved && !hasContentChanged && onNoteDelete && (
                                <button
                                    onClick={handleDeleteNote}
                                    disabled={isDeleted}
                                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300 active:scale-95
                                        ${isDeleted
                                            ? 'bg-themeredred/15 text-themeredred'
                                            : confirmDelete
                                                ? 'bg-red-500 text-white'
                                                : 'bg-themewhite3 text-themeredred hover:bg-themeredred/10'
                                        }`}
                                    title={confirmDelete ? 'Tap again to confirm delete' : 'Delete note'}
                                >
                                    {isDeleted ? (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                            Note Deleted
                                        </>
                                    ) : confirmDelete ? (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Confirm Delete
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Delete Note
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Copied toast */}
                {isCopied && (
                    <div className="absolute inset-x-0 top-4 flex justify-center pointer-events-none z-10">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${colors.symptomClass} shadow-lg`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-sm font-medium">Copied to Clipboard</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer with navigation buttons */}
            <div
                className={`flex items-center gap-2 justify-between shrink-0 ${isMobile ? 'px-6 pt-4 pb-6' : 'p-4'}`}
                style={isMobile ? { paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 2rem))' } : {}}
            >
                {currentPage > 0 ? (
                    <TextButton text="← Back" onClick={handlePageBack} variant="dispo-specific" className="bg-themewhite3 text-tertiary rounded-full" />
                ) : (
                    <div />
                )}
                <div className="flex items-center gap-2">
                    {currentPage < TOTAL_PAGES - 1 ? (
                        <TextButton text="Next →" onClick={handleNext} variant="dispo-specific" className={`${colors.buttonClass} rounded-full`} />
                    ) : (
                        <TextButton text="Done" onClick={closeHandler} variant="dispo-specific" className={`${colors.buttonClass} rounded-full`} />
                    )}
                </div>
            </div>
        </>
    );

    // ========== MOBILE: Use BaseDrawer ==========
    if (isMobile) {
        return (
            <BaseDrawer
                isVisible={true}
                onClose={() => onExpansionChange(false)}
                fullHeight="90dvh"
                backdropOpacity={0.3}
                mobileOnly={true}
                mobileClassName="flex flex-col bg-themewhite2"
            >
                {(handleClose) => renderContent(handleClose)}
            </BaseDrawer>
        );
    }

    // ========== DESKTOP: Inline expanded panel (no BaseDrawer needed) ==========
    return (
        <div className="h-full w-full relative">
            <div
                className="h-full w-full rounded-md bg-themewhite2 overflow-hidden flex flex-col"
                style={{
                    transform: desktopExpanded ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)',
                    opacity: desktopExpanded ? 1 : 0,
                    transition: 'all 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    transformOrigin: 'bottom center',
                }}
            >
                {renderContent(handleDesktopClose)}
            </div>
        </div>
    );
};

// ========== HELPER COMPONENTS ==========

const ToggleOption: React.FC<{
    checked: boolean;
    onChange: () => void;
    label: string;
    colors: ReturnType<typeof getColorClasses>;
}> = ({ checked, onChange, label, colors }) => (
    <div
        onClick={onChange}
        className={`text-xs p-3 rounded border cursor-pointer transition-colors duration-200
            ${checked ? colors.symptomClass : 'border border-themewhite2/10 text-secondary bg-themewhite hover:themewhite2/80 hover:shadow-sm'}`}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(); }
        }}
    >
        <div className="font-normal flex items-center">
            <span className={`mr-2 ${checked ? 'opacity-100' : 'opacity-40'}`}>{checked ? '✓' : ''}</span>
            {label}
        </div>
    </div>
);

const CopyButton: React.FC<{ onClick: () => void; title: string }> = ({ onClick, title }) => (
    <button
        onClick={onClick}
        className="absolute top-3 right-3 p-2 text-tertiary hover:text-primary transition-colors"
        title={title}
    >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
    </button>
);
