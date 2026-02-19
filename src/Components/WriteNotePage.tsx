import { useState, useEffect, useRef, useCallback } from 'react';
import type { dispositionType, AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import { useNoteCapture } from '../Hooks/useNoteCapture';
import { useNoteShare } from '../Hooks/useNoteShare';
import { useUserProfile } from '../Hooks/useUserProfile';
import { formatSignature } from '../Utilities/NoteFormatter';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { encodedContentEquals } from '../Utilities/NoteCodec';
import { NoteBarcodeGenerator } from './Barcode';
import { DecisionMaking } from './DecisionMaking';
import { PhysicalExam } from './PhysicalExam';
import { BaseDrawer } from './BaseDrawer';

type DispositionType = dispositionType['type'];

const PAGE_LABELS = ['Decision Making', 'HPI', 'Physical Exam', 'Full Note'];
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
    isVisible: boolean;
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
    initialPeText?: string;
    noteSource?: string | null;
    onAfterSave?: () => void;
    timestamp?: Date | null;
}

export const WriteNotePage = ({
    isVisible,
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
    initialPeText = '',
    noteSource = null,
    onAfterSave,
    timestamp = null,
}: WriteNoteProps) => {
    // Note content state
    const [note, setNote] = useState<string>(initialHpiText);
    const [previewNote, setPreviewNote] = useState<string>('');
    const [includeDecisionMaking, setIncludeDecisionMaking] = useState<boolean>(true);
    const [includeHPI, setIncludeHPI] = useState<boolean>(!!initialHpiText);
    const [peNote, setPeNote] = useState<string>(initialPeText);
    const [includePhysicalExam, setIncludePhysicalExam] = useState<boolean>(!!initialPeText);

    // Note timestamp — set automatically when user first reaches page 3
    const [noteTimestamp, setNoteTimestamp] = useState<Date | null>(timestamp);
    const [encodedValue, setEncodedValue] = useState<string>('');
    const [copiedTarget, setCopiedTarget] = useState<'preview' | 'encoded' | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const confirmDeleteRef = useRef(false);
    const confirmDeleteTimeoutRef = useRef<ReturnType<typeof setTimeout>>(0);

    // Page navigation state
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');

    // Refs
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Ref-based drag state for mobile swipe — no React re-renders during gesture
    const dragRef = useRef<{
        startX: number;
        startY: number;
        lastX: number;
        locked: boolean | null; // null = undecided, true = horizontal, false = vertical
    } | null>(null);
    const currentPageRef = useRef(currentPage);
    currentPageRef.current = currentPage;

    // Hooks
    const { generateNote } = useNoteCapture(algorithmOptions, cardStates);
    const { profile } = useUserProfile();
    const signature = formatSignature(profile);
    const { shareNote, shareStatus } = useNoteShare();
    const colors = getColorClasses(disposition.type);

    // --- Copied state auto-revert ---
    useEffect(() => {
        if (copiedTarget) {
            const id = window.setTimeout(() => setCopiedTarget(null), 2000);
            return () => clearTimeout(id);
        }
    }, [copiedTarget]);

    // --- Auto-select HPI/PE when content appears ---
    useEffect(() => {
        if (note.trim() && !includeHPI) setIncludeHPI(true);
    }, [note, includeHPI]);

    useEffect(() => {
        if (peNote.trim() && !includePhysicalExam) setIncludePhysicalExam(true);
    }, [peNote, includePhysicalExam]);

    // --- Set timestamp when first arriving at page 3 (Full Note) ---
    useEffect(() => {
        if (currentPage === 3 && !noteTimestamp) {
            setNoteTimestamp(new Date());
        }
    }, [currentPage, noteTimestamp]);

    // --- Auto-focus HPI textarea when navigating to page 1 (HPI) ---
    useEffect(() => {
        if (currentPage === 1 && includeHPI) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [currentPage, includeHPI]);

    // --- Preview note generation (eagerly updates so content is ready before navigating to Full Note) ---
    useEffect(() => {
        const result = generateNote(
            { includeAlgorithm: true, includeDecisionMaking, customNote: includeHPI ? note : '', physicalExamNote: includePhysicalExam ? peNote : '', signature },
            disposition.type,
            disposition.text,
            selectedSymptom,
            noteTimestamp,
        );
        setPreviewNote(result.fullNote);
    }, [note, includeDecisionMaking, includeHPI, peNote, includePhysicalExam, generateNote, disposition, selectedSymptom, noteTimestamp, signature]);

    // --- Copy handler ---
    const handleCopy = useCallback((text: string, target: 'preview' | 'encoded') => {
        navigator.clipboard.writeText(text);
        setCopiedTarget(target);
    }, []);

    // --- Share handler ---
    const handleShare = useCallback(() => {
        if (!encodedValue) return;
        shareNote({
            id: existingNoteId || '',
            encodedText: encodedValue,
            createdAt: noteTimestamp?.toISOString() || new Date().toISOString(),
            symptomIcon: selectedSymptom?.icon || '',
            symptomText: selectedSymptom?.text || 'Note',
            dispositionType: disposition.type,
            dispositionText: disposition.text,
            previewText: previewNote.slice(0, 200),
        }, isMobile);
    }, [encodedValue, existingNoteId, noteTimestamp, selectedSymptom, disposition, previewNote, isMobile, shareNote]);

    // --- Determine button state based on existing note ---
    const isAlreadySaved = Boolean(existingNoteId);
    const hasContentChanged = isAlreadySaved && encodedValue !== '' && !encodedContentEquals(encodedValue, existingEncodedText || '');

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
            onNoteDelete?.(existingNoteId);
            setIsDeleted(true);
            confirmDeleteRef.current = false;
            setConfirmDelete(false);
            if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
            setTimeout(() => setIsDeleted(false), 2500);
        } else {
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

    // --- Slide animation helper (mirrors Settings pattern) ---
    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        setSlideDirection(direction);
        setTimeout(() => setSlideDirection(''), 300);
    }, []);

    // --- Page navigation ---
    const handleNext = useCallback(() => {
        setCurrentPage(prev => {
            if (prev >= TOTAL_PAGES - 1) return prev;
            handleSlideAnimation('left');
            return prev + 1;
        });
    }, [handleSlideAnimation]);

    const handlePageBack = useCallback(() => {
        setCurrentPage(prev => {
            if (prev <= 0) return prev;
            handleSlideAnimation('right');
            return prev - 1;
        });
    }, [handleSlideAnimation]);

    // ========== PAGE SWIPE (horizontal, mobile only) — detect direction, trigger slide ==========
    const handleSwipeStart = useCallback((e: React.TouchEvent) => {
        if (!isMobile) return;
        const t = e.target as HTMLElement;
        if (t.closest('button, textarea, input, select, [role="checkbox"], [role="button"], [role="slider"]')) return;
        const touch = e.touches[0];
        dragRef.current = { startX: touch.clientX, startY: touch.clientY, lastX: touch.clientX, locked: null };
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
            if (!d.locked) { dragRef.current = null; return; }
        }
        if (!d.locked) return;

        d.lastX = touch.clientX;
        e.preventDefault();
    }, []);

    const handleSwipeEnd = useCallback(() => {
        const d = dragRef.current;
        dragRef.current = null;
        if (!d || d.locked !== true) return;

        const swipeDx = d.lastX - d.startX;
        const page = currentPageRef.current;

        // Swipe left (negative dx) → next page; swipe right (positive dx) → previous page
        if (swipeDx < -40 && page < TOTAL_PAGES - 1) {
            handleSlideAnimation('left');
            setCurrentPage(page + 1);
        } else if (swipeDx > 40 && page > 0) {
            handleSlideAnimation('right');
            setCurrentPage(page - 1);
        }
    }, [handleSlideAnimation]);

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

            {/* Header — aligned with BaseDrawer */}
            <div
                className="px-6 border-b border-tertiary/10 py-3 md:py-4"
                style={isMobile ? { touchAction: 'none' } : {}}
                data-drag-zone
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 transition-all duration-200">
                        <div
                            className="shrink-0 overflow-hidden transition-all duration-200"
                            style={{
                                width: currentPage > 0 ? 40 : 0,
                                opacity: currentPage > 0 ? 1 : 0,
                            }}
                        >
                            <button
                                onClick={handlePageBack}
                                className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all"
                                aria-label="Go back"
                            >
                                <svg className="w-6 h-6 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        </div>
                        <h2 className="text-[11pt] font-normal text-primary md:text-2xl truncate">
                            {PAGE_LABELS[currentPage]}
                        </h2>
                        <span className="text-xs text-tertiary shrink-0">
                            {noteSource?.startsWith('external')
                                ? `External${noteSource.includes(':') ? ': ' + noteSource.split(':')[1] : ''}`
                                : noteSource ? 'Saved: My Note' : 'New Note'}
                        </span>
                    </div>
                    <button
                        onClick={closeHandler}
                        className="p-2 rounded-full hover:bg-themewhite2 md:hover:bg-themewhite active:scale-95 transition-all shrink-0"
                        aria-label="Close"
                    >
                        <svg className="w-6 h-6 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="flex gap-1.5 mt-2">
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

            {/* Content Area */}
            <div
                className="flex-1 overflow-hidden relative"
                style={{ touchAction: isMobile ? 'pan-y' : 'auto' }}
                onTouchStart={isMobile ? handleSwipeStart : undefined}
                onTouchMove={isMobile ? handleSwipeMove : undefined}
                onTouchEnd={isMobile ? handleSwipeEnd : undefined}
                onTouchCancel={isMobile ? handleSwipeEnd : undefined}
            >
                <SlideWrapper slideDirection={slideDirection}>
                    {/* Page 0: Decision Making */}
                    {currentPage === 0 && (
                        <div className={`w-full h-full overflow-y-auto p-2 bg-themewhite2 ${isMobile ? 'pb-16' : ''}`}>
                            <div className="space-y-4">
                                <div className="mx-2 mt-2">
                                    <ToggleOption
                                        checked={includeDecisionMaking}
                                        onChange={() => setIncludeDecisionMaking(!includeDecisionMaking)}
                                        label="Include Decision Making in Note"
                                        colors={colors}
                                    />
                                </div>
                                <div className="mx-2">
                                    <div className="rounded-md border border-themegray1/15 overflow-hidden">
                                        <DecisionMaking
                                            algorithmOptions={algorithmOptions}
                                            cardStates={cardStates}
                                            disposition={disposition}
                                            dispositionType={disposition.type}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Page 1: HPI */}
                    {currentPage === 1 && (
                        <div className={`w-full h-full overflow-y-auto p-4 bg-themewhite2 ${isMobile ? 'pb-16' : ''}`}>
                            <div className="space-y-3">
                                {!includeHPI ? (
                                    <ToggleOption
                                        checked={includeHPI}
                                        onChange={() => { setIncludeHPI(true); setTimeout(() => inputRef.current?.focus(), 100); }}
                                        label="Include HPI / Clinical Notes"
                                        colors={colors}
                                    />
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-secondary">HPI / Clinical Notes</p>
                                            <button
                                                onClick={() => { setNote(''); setIncludeHPI(false); }}
                                                className="text-xs text-tertiary hover:text-primary p-1 rounded transition-colors"
                                                title="Remove HPI"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                        <textarea
                                            ref={inputRef}
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            placeholder="History of present illness, clinical observations, assessment..."
                                            className="w-full text-tertiary bg-themewhite outline-none text-[16px] md:text-[10pt] px-4 py-3 rounded-md border border-themegray1/20 min-w-0 resize-none min-h-[12rem] leading-6 focus:border-themeblue1/30 transition-colors"
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Page 2: Physical Exam */}
                    {currentPage === 2 && (
                        <div className={`w-full h-full overflow-y-auto p-2 bg-themewhite2 ${isMobile ? 'pb-16' : ''}`}>
                            <div className="space-y-3">
                                <div className="mx-2 mt-2">
                                    <ToggleOption
                                        checked={includePhysicalExam}
                                        onChange={() => setIncludePhysicalExam(!includePhysicalExam)}
                                        label="Include Physical Exam in Note"
                                        colors={colors}
                                    />
                                </div>
                                <div className="mx-2">
                                    <div className="rounded-md border border-themegray1/15 overflow-hidden">
                                        <PhysicalExam
                                            initialText={initialPeText}
                                            onChange={setPeNote}
                                            colors={colors}
                                            symptomCode={selectedSymptom?.icon || 'A-1'}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Page 3: Full Note */}
                    {currentPage === 3 && (
                        <div className={`w-full h-full overflow-y-auto p-4 bg-themewhite2 ${isMobile ? 'pb-16' : ''}`}>
                            <div className="space-y-4">
                                {/* Note Preview (always visible) */}
                                <div>
                                    <div className="flex items-center justify-between p-3 rounded-t-md bg-themewhite text-xs text-secondary">
                                        <span className="font-medium">Note Preview</span>
                                        <ActionIconButton
                                            onClick={() => handleCopy(previewNote, 'preview')}
                                            status={copiedTarget === 'preview' ? 'done' : 'idle'}
                                            variant="copy"
                                            title="Copy note text"
                                        />
                                    </div>
                                    <div className="p-3 rounded-b-md bg-themewhite3 text-tertiary text-[8pt] whitespace-pre-wrap max-h-48 overflow-y-auto border border-themegray1/15">
                                        {previewNote || "No content selected"}
                                    </div>
                                </div>

                                {/* Encoded Note / Barcode (always visible) */}
                                <div>
                                    <div className="flex items-center justify-between p-3 rounded-t-md bg-themewhite text-xs text-secondary">
                                        <span className="font-medium">Encoded Note</span>
                                        <div className="flex items-center gap-1">
                                            <ActionIconButton
                                                onClick={() => handleCopy(encodedValue, 'encoded')}
                                                status={copiedTarget === 'encoded' ? 'done' : 'idle'}
                                                variant="copy"
                                                title="Copy encoded text"
                                            />
                                            <ActionIconButton
                                                onClick={handleShare}
                                                status={shareStatus === 'shared' || shareStatus === 'copied' ? 'done'
                                                    : shareStatus === 'generating' || shareStatus === 'sharing' ? 'busy'
                                                        : 'idle'}
                                                variant="share"
                                                title="Share note as image"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-1">
                                        <NoteBarcodeGenerator
                                            algorithmOptions={algorithmOptions}
                                            cardStates={cardStates}
                                            noteOptions={{
                                                includeAlgorithm: true,
                                                includeDecisionMaking,
                                                customNote: includeHPI ? note : '',
                                                physicalExamNote: includePhysicalExam ? peNote : '',
                                                user: profile,
                                            }}
                                            symptomCode={selectedSymptom?.icon?.replace('-', '') || 'A1'}
                                            onEncodedValueChange={setEncodedValue}
                                            layout={encodedValue.length > 80 ? 'col' : 'row'}
                                        />
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}
                </SlideWrapper>

            </div>

            {/* Footer with navigation / action buttons */}
            <div
                className={`flex items-center gap-2 justify-between shrink-0 ${isMobile ? 'px-6 pt-4 pb-6' : 'p-4'}`}
                style={isMobile ? { paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 2rem))' } : {}}
            >
                <div />
                <div className="flex items-center gap-2">
                    {currentPage < TOTAL_PAGES - 1 ? (
                        <button
                            onClick={handleNext}
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all ${colors.buttonClass}`}
                            aria-label="Next"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    ) : (
                        <>
                            {/* Save (new note) — circle icon */}
                            {onNoteSave && !isAlreadySaved && (
                                <button
                                    onClick={handleSaveNote}
                                    disabled={isSaved || !encodedValue}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-40
                                        ${saveFailed
                                            ? 'bg-themeredred/15 text-themeredred'
                                            : isSaved
                                                ? 'bg-green-500/15 text-green-600 dark:text-green-300'
                                                : colors.buttonClass
                                        }`}
                                    title={saveFailed ? 'Storage full' : isSaved ? 'Saved' : 'Save to My Notes'}
                                >
                                    {saveFailed ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    ) : isSaved ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                    )}
                                </button>
                            )}

                            {/* Save Changes (existing note, content changed) — circle icon */}
                            {isAlreadySaved && hasContentChanged && onNoteUpdate && (
                                <button
                                    onClick={handleUpdateNote}
                                    disabled={isSaved || !encodedValue}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-40
                                        ${isSaved
                                            ? 'bg-green-500/15 text-green-600 dark:text-green-300'
                                            : 'bg-themeblue3/10 text-themeblue3 hover:bg-themeblue3/20'
                                        }`}
                                    title={isSaved ? 'Changes saved' : 'Save changes'}
                                >
                                    {isSaved ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                    )}
                                </button>
                            )}

                            {/* Delete (existing note, no content change) — circle icon */}
                            {isAlreadySaved && !hasContentChanged && onNoteDelete && (
                                <button
                                    onClick={handleDeleteNote}
                                    disabled={isDeleted}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-40
                                        ${isDeleted
                                            ? 'bg-themeredred/15 text-themeredred'
                                            : confirmDelete
                                                ? 'bg-red-500 text-white'
                                                : 'bg-themewhite3 text-themeredred hover:bg-themeredred/10'
                                        }`}
                                    title={confirmDelete ? 'Tap again to confirm' : 'Delete note'}
                                >
                                    {isDeleted ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    )}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={() => onExpansionChange(false)}
            fullHeight="90dvh"
            mobileClassName="flex flex-col bg-themewhite2"
        >
            {(handleClose) => renderContent(handleClose)}
        </BaseDrawer>
    );
};

// ========== HELPER COMPONENTS ==========

const ActionIconButton = ({
    onClick,
    status,
    variant,
    title,
}: {
    onClick: () => void;
    status: 'idle' | 'busy' | 'done';
    variant: 'copy' | 'share';
    title: string;
}) => {
    const colorClass = status === 'done' ? 'text-green-600'
        : status === 'busy' ? 'text-purple-600'
            : 'text-tertiary hover:text-primary hover:bg-themewhite3';

    return (
        <span
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`p-1.5 transition-colors rounded-full ${colorClass}`}
            title={title}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onClick(); } }}
        >
            {status === 'busy' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            ) : status === 'done' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
            ) : variant === 'copy' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
            )}
        </span>
    );
};

const SlideWrapper = ({
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
