import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { dispositionType, AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import { useNoteCapture } from '../Hooks/useNoteCapture';
import { useNoteShare } from '../Hooks/useNoteShare';
import { useDD689Export } from '../Hooks/useDD689Export';
import { useUserProfile } from '../Hooks/useUserProfile';
import { useAuthStore } from '../stores/useAuthStore';
import { usePageSwipe } from '../Hooks/usePageSwipe';
import { useTextExpander } from '../Hooks/useTextExpander';
import { TextExpanderSuggestion } from './TextExpanderSuggestion';
import { formatSignature } from '../Utilities/NoteFormatter';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { encodedContentEquals } from '../Utilities/NoteCodec';
import { UI_TIMING } from '../Utilities/constants';
import { formatNoteSource } from '../Utilities/NoteSourceUtils';
import { NoteBarcodeGenerator } from './Barcode';
import { DecisionMaking } from './DecisionMaking';
import { PhysicalExam } from './PhysicalExam';
import { BaseDrawer } from './BaseDrawer';
import { ActionIconButton, SlideWrapper, ToggleOption } from './WriteNoteHelpers';
import { BrainCircuit, FileText, Stethoscope, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';

type DispositionType = dispositionType['type'];

type PageId = 'decision' | 'hpi' | 'pe' | 'fullnote';

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
    // Note content state — profile preferences provide defaults for new notes
    const { profile } = useUserProfile();
    const authUserId = useAuthStore(s => s.user?.id);
    const authClinicId = useAuthStore(s => s.clinicId);
    const defaultHPI = initialHpiText ? true : (profile.noteIncludeHPI ?? true);
    const defaultPE = initialPeText ? true : (profile.noteIncludePE ?? false);

    // Build visible wizard pages — hide HPI/PE when disabled in settings
    const visiblePages = useMemo(() => {
        const pages: { id: PageId; label: string }[] = [{ id: 'decision', label: 'Decision Making' }];
        if (defaultHPI) pages.push({ id: 'hpi', label: 'HPI' });
        if (defaultPE) pages.push({ id: 'pe', label: 'Physical Exam' });
        pages.push({ id: 'fullnote', label: 'Full Note' });
        return pages;
    }, [defaultHPI, defaultPE]);

    const [note, setNote] = useState<string>(initialHpiText);
    const [previewNote, setPreviewNote] = useState<string>('');
    const [includeDecisionMaking, setIncludeDecisionMaking] = useState<boolean>(true);
    const [includeHPI, setIncludeHPI] = useState<boolean>(defaultHPI);
    const [peNote, setPeNote] = useState<string>(initialPeText);
    const [includePhysicalExam, setIncludePhysicalExam] = useState<boolean>(defaultPE);

    // Note timestamp — set automatically when user first reaches Full Note
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
    const [currentPage, setCurrentPage] = useState(() =>
        initialPage >= 3 ? visiblePages.length - 1 : Math.min(initialPage, visiblePages.length - 1)
    );
    const currentPageId = visiblePages[currentPage]?.id ?? 'decision';
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');

    // Text expander
    const [cursorPosition, setCursorPosition] = useState(0);
    const textExpanders = profile.textExpanders ?? [];
    const textExpanderEnabled = profile.textExpanderEnabled ?? true;
    const { suggestions: expanderSuggestions, selectedIndex: expanderIndex, accept: acceptExpander, dismiss: dismissExpander, selectNext: expanderNext, selectPrev: expanderPrev } = useTextExpander({
        text: note,
        cursorPosition,
        expanders: textExpanders,
        enabled: textExpanderEnabled && currentPageId === 'hpi',
    });
    const hasExpanderSuggestion = expanderSuggestions.length > 0;

    // Refs
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Ref to track current page for swipe callbacks (avoids stale closures)
    const currentPageRef = useRef(currentPage);
    currentPageRef.current = currentPage;

    // Hooks
    const { generateNote } = useNoteCapture(algorithmOptions, cardStates);
    const signature = formatSignature(profile);
    const { shareNote, shareStatus } = useNoteShare();
    const { exportDD689, exportStatus } = useDD689Export();
    const colors = getColorClasses(disposition.type);

    // --- Copied state auto-revert ---
    useEffect(() => {
        if (copiedTarget) {
            const id = window.setTimeout(() => setCopiedTarget(null), UI_TIMING.COPY_FEEDBACK);
            return () => clearTimeout(id);
        }
    }, [copiedTarget]);

    // --- Set timestamp when first arriving at Full Note ---
    useEffect(() => {
        if (currentPageId === 'fullnote' && !noteTimestamp) {
            setNoteTimestamp(new Date());
        }
    }, [currentPageId, noteTimestamp]);

    // --- Auto-focus HPI textarea when navigating to HPI page ---
    useEffect(() => {
        if (currentPageId === 'hpi' && includeHPI) {
            setTimeout(() => inputRef.current?.focus(), UI_TIMING.AUTOFOCUS_DELAY);
        }
    }, [currentPageId, includeHPI]);

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

    // --- DD689 PDF export handler ---
    const handleExportDD689 = useCallback(() => {
        if (!encodedValue) return;
        const dateStr = noteTimestamp
            ? `${noteTimestamp.getFullYear()}${String(noteTimestamp.getMonth() + 1).padStart(2, '0')}${String(noteTimestamp.getDate()).padStart(2, '0')}`
            : '';
        const authorParts = [
            profile.lastName,
            profile.firstName,
            profile.middleInitial,
            profile.credential,
            profile.rank,
        ].filter(Boolean);
        exportDD689({
            encodedValue,
            dispositionType: disposition.type,
            dispositionText: disposition.text,
            symptomText: selectedSymptom?.text || 'Note',
            clinicName: profile.clinicName || '',
            noteDate: dateStr,
            authorLine: authorParts.length ? authorParts.join(', ') : undefined,
        });
    }, [encodedValue, disposition, selectedSymptom, exportDD689, noteTimestamp, profile]);

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
            setTimeout(() => setSaveFailed(false), UI_TIMING.SAVE_ERROR_DURATION);
            return;
        }
        setIsSaved(true);
        if (onAfterSave) {
            setTimeout(() => onAfterSave(), UI_TIMING.AFTER_SAVE_DELAY);
        } else {
            setTimeout(() => setIsSaved(false), UI_TIMING.FEEDBACK_DURATION);
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
            setTimeout(() => setIsDeleted(false), UI_TIMING.FEEDBACK_DURATION);
        } else {
            confirmDeleteRef.current = true;
            setConfirmDelete(true);
            if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
            confirmDeleteTimeoutRef.current = setTimeout(() => {
                confirmDeleteRef.current = false;
                setConfirmDelete(false);
            }, UI_TIMING.DELETE_CONFIRM_TIMEOUT);
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
            setTimeout(() => onAfterSave(), UI_TIMING.AFTER_SAVE_DELAY);
        } else {
            setTimeout(() => setIsSaved(false), UI_TIMING.FEEDBACK_DURATION);
        }
    }, [existingNoteId, encodedValue, previewNote, selectedSymptom, disposition, onNoteUpdate, onAfterSave]);

    // --- Slide animation helper (mirrors Settings pattern) ---
    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        setSlideDirection(direction);
        setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION);
    }, []);

    // --- Page navigation ---
    const handleNext = useCallback(() => {
        setCurrentPage(prev => {
            if (prev >= visiblePages.length - 1) return prev;
            handleSlideAnimation('left');
            return prev + 1;
        });
    }, [handleSlideAnimation, visiblePages.length]);

    const handlePageBack = useCallback(() => {
        setCurrentPage(prev => {
            if (prev <= 0) return prev;
            handleSlideAnimation('right');
            return prev - 1;
        });
    }, [handleSlideAnimation]);

    // ========== PAGE SWIPE (horizontal, mobile only) — detect direction, trigger slide ==========
    const handleSwipeLeft = useCallback(() => {
        const page = currentPageRef.current;
        if (page < visiblePages.length - 1) {
            handleSlideAnimation('left');
            setCurrentPage(page + 1);
        }
    }, [handleSlideAnimation, visiblePages.length]);

    const handleSwipeRight = useCallback(() => {
        const page = currentPageRef.current;
        if (page > 0) {
            handleSlideAnimation('right');
            setCurrentPage(page - 1);
        }
    }, [handleSlideAnimation]);

    const { onTouchStart: handleSwipeStart, onTouchMove: handleSwipeMove, onTouchEnd: handleSwipeEnd } = usePageSwipe(
        handleSwipeLeft,
        handleSwipeRight,
        isMobile,
    );

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
                                <ChevronLeft className="w-6 h-6 text-tertiary" />
                            </button>
                        </div>
                        <h2 className="text-[11pt] font-normal text-primary md:text-2xl truncate">
                            {visiblePages[currentPage]?.label}
                        </h2>
                        <span className="text-xs text-tertiary shrink-0">
                            {formatNoteSource(noteSource)}
                        </span>
                    </div>
                    <button
                        onClick={closeHandler}
                        className="p-2 rounded-full hover:bg-themewhite2 md:hover:bg-themewhite active:scale-95 transition-all shrink-0"
                        aria-label="Close"
                    >
                        <X className="w-6 h-6 text-tertiary" />
                    </button>
                </div>
                <div className="flex gap-1.5 mt-2">
                    {visiblePages.map((_, idx) => (
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
                    {/* Decision Making */}
                        <div className={`w-full h-full overflow-y-auto p-2 bg-themewhite2 ${isMobile ? 'pb-16' : ''} ${currentPageId !== 'decision' ? 'hidden' : ''}`}>
                            <div className="space-y-4">
                                <div className="mx-2 mt-2">
                                    <ToggleOption
                                        checked={includeDecisionMaking}
                                        onChange={() => setIncludeDecisionMaking(!includeDecisionMaking)}
                                        label="Include Decision Making in note"
                                        onDescription="Decision making will be added to your note"
                                        offDescription="Decision making will not be included"
                                        icon={<BrainCircuit size={18} />}
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

                    {/* HPI */}
                    {defaultHPI && (
                        <div className={`w-full h-full overflow-y-auto p-2 bg-themewhite2 ${isMobile ? 'pb-16' : ''} ${currentPageId !== 'hpi' ? 'hidden' : ''}`}>
                            <div className="space-y-3">
                                <div className="mx-2 mt-2">
                                    <ToggleOption
                                        checked={includeHPI}
                                        onChange={() => { const next = !includeHPI; setIncludeHPI(next); if (next) setTimeout(() => inputRef.current?.focus(), UI_TIMING.AUTOFOCUS_DELAY); }}
                                        label="Include HPI in note"
                                        onDescription="HPI will be added to your note"
                                        offDescription="HPI will not be included"
                                        icon={<FileText size={18} />}
                                        colors={colors}
                                    />
                                </div>
                                {includeHPI && (
                                    <div className="mx-2 relative">
                                        <textarea
                                            ref={inputRef}
                                            value={note}
                                            onChange={(e) => { setNote(e.target.value); setCursorPosition(e.target.selectionStart); }}
                                            onSelect={(e) => setCursorPosition((e.target as HTMLTextAreaElement).selectionStart)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Escape' && hasExpanderSuggestion) {
                                                    e.preventDefault();
                                                    dismissExpander();
                                                    return;
                                                }
                                                if (hasExpanderSuggestion && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                                                    e.preventDefault();
                                                    if (e.key === 'ArrowDown') expanderNext();
                                                    else expanderPrev();
                                                    return;
                                                }
                                                if (e.key === 'Enter' && hasExpanderSuggestion && !e.shiftKey) {
                                                    e.preventDefault();
                                                    const result = acceptExpander();
                                                    if (result) {
                                                        setNote(result.newText);
                                                        setCursorPosition(result.newCursorPosition);
                                                        requestAnimationFrame(() => {
                                                            const ta = inputRef.current;
                                                            if (ta) {
                                                                ta.selectionStart = result.newCursorPosition;
                                                                ta.selectionEnd = result.newCursorPosition;
                                                            }
                                                        });
                                                    }
                                                    return;
                                                }
                                            }}
                                            placeholder="History of present illness, clinical observations, assessment..."
                                            className="w-full text-tertiary bg-themewhite outline-none text-[16px] md:text-[10pt] px-4 py-3 rounded-md border border-themegray1/20 min-w-0 resize-none min-h-[12rem] leading-6 focus:border-themeblue1/30 transition-colors"
                                        />
                                        {hasExpanderSuggestion && (
                                            <TextExpanderSuggestion
                                                suggestions={expanderSuggestions}
                                                selectedIndex={expanderIndex}
                                                onDismiss={dismissExpander}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Physical Exam */}
                    {defaultPE && (
                        <div className={`w-full h-full overflow-y-auto p-2 bg-themewhite2 ${isMobile ? 'pb-16' : ''} ${currentPageId !== 'pe' ? 'hidden' : ''}`}>
                            <div className="space-y-3">
                                <div className="mx-2 mt-2">
                                    <ToggleOption
                                        checked={includePhysicalExam}
                                        onChange={() => setIncludePhysicalExam(!includePhysicalExam)}
                                        label="Include Physical Exam in note"
                                        onDescription="Physical exam will be added to your note"
                                        offDescription="Physical exam will not be included"
                                        icon={<Stethoscope size={18} />}
                                        colors={colors}
                                    />
                                </div>
                                {includePhysicalExam && (
                                    <div className="mx-2">
                                        <div className="rounded-md border border-themegray1/15 overflow-hidden">
                                            <PhysicalExam
                                                initialText={peNote}
                                                onChange={setPeNote}
                                                colors={colors}
                                                symptomCode={selectedSymptom?.icon || 'A-1'}
                                                depth={profile.peDepth ?? 'minimal'}
                                                customBlocks={profile.peDepth === 'custom' ? profile.customPEBlocks : undefined}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Full Note */}
                        <div className={`w-full h-full overflow-y-auto p-4 bg-themewhite2 ${isMobile ? 'pb-16' : ''} ${currentPageId !== 'fullnote' ? 'hidden' : ''}`}>
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
                                            <ActionIconButton
                                                onClick={handleExportDD689}
                                                status={exportStatus === 'done' ? 'done'
                                                    : exportStatus === 'generating' ? 'busy'
                                                        : 'idle'}
                                                variant="pdf"
                                                title="Export DD689 PDF"
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
                                                userId: authUserId,
                                                clinicId: authClinicId ?? undefined,
                                            }}
                                            symptomCode={selectedSymptom?.icon?.replace('-', '') || 'A1'}
                                            onEncodedValueChange={setEncodedValue}
                                            layout={encodedValue.length > 300 ? 'col' : 'row'}
                                        />
                                    </div>
                                </div>

                            </div>
                        </div>
                </SlideWrapper>

            </div>

            {/* Footer with navigation / action buttons */}
            <div
                className={`flex items-center gap-2 justify-between shrink-0 ${isMobile ? 'px-6 pt-4 pb-6' : 'p-4'}`}
                style={isMobile ? { paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 2rem))' } : {}}
            >
                <div />
                <div key={currentPage} className={`flex items-center gap-2 ${slideDirection === 'left' ? 'animate-footer-btn-left' : slideDirection === 'right' ? 'animate-footer-btn-right' : ''}`}>
                    {currentPage < visiblePages.length - 1 ? (
                        <button
                            onClick={handleNext}
                            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all md:w-auto md:h-auto md:px-5 md:py-2.5 md:rounded-xl md:gap-2 ${colors.buttonClass}`}
                            aria-label="Next"
                        >
                            <span className="hidden md:inline text-sm font-medium">Next</span>
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    ) : (
                        <>
                            {/* Save (new note) */}
                            {onNoteSave && !isAlreadySaved && (
                                <button
                                    onClick={handleSaveNote}
                                    disabled={isSaved || !encodedValue}
                                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 md:w-auto md:h-auto md:px-5 md:py-2.5 md:rounded-xl md:gap-2
                                        ${saveFailed
                                            ? 'bg-themeredred/15 text-themeredred'
                                            : isSaved
                                                ? 'bg-green-500/15 text-green-600 dark:text-green-300'
                                                : colors.buttonClass
                                        }`}
                                    title={saveFailed ? 'Storage full' : isSaved ? 'Saved' : 'Save to My Notes'}
                                >
                                    {saveFailed ? (
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    ) : isSaved ? (
                                        <Check className="w-6 h-6" />
                                    ) : (
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                    )}
                                    <span className="hidden md:inline text-sm font-medium">
                                        {saveFailed ? 'Storage Full' : isSaved ? 'Saved' : 'Save Note'}
                                    </span>
                                </button>
                            )}

                            {/* Save Changes (existing note, content changed) */}
                            {isAlreadySaved && hasContentChanged && onNoteUpdate && (
                                <button
                                    onClick={handleUpdateNote}
                                    disabled={isSaved || !encodedValue}
                                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 md:w-auto md:h-auto md:px-5 md:py-2.5 md:rounded-xl md:gap-2
                                        ${isSaved
                                            ? 'bg-green-500/15 text-green-600 dark:text-green-300'
                                            : 'bg-themeblue3/10 text-themeblue3 hover:bg-themeblue3/20'
                                        }`}
                                    title={isSaved ? 'Changes saved' : 'Save changes'}
                                >
                                    {isSaved ? (
                                        <Check className="w-6 h-6" />
                                    ) : (
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                    )}
                                    <span className="hidden md:inline text-sm font-medium">
                                        {isSaved ? 'Saved' : 'Save Changes'}
                                    </span>
                                </button>
                            )}

                            {/* Delete (existing note, no content change) */}
                            {isAlreadySaved && !hasContentChanged && onNoteDelete && (
                                <button
                                    onClick={handleDeleteNote}
                                    disabled={isDeleted}
                                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 md:w-auto md:h-auto md:px-5 md:py-2.5 md:rounded-xl md:gap-2
                                        ${isDeleted
                                            ? 'bg-themeredred/15 text-themeredred'
                                            : confirmDelete
                                                ? 'bg-red-500 text-white'
                                                : 'bg-themewhite3 text-themeredred hover:bg-themeredred/10'
                                        }`}
                                    title={confirmDelete ? 'Tap again to confirm' : 'Delete note'}
                                >
                                    {isDeleted ? (
                                        <Check className="w-6 h-6" />
                                    ) : (
                                        <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    )}
                                    <span className="hidden md:inline text-sm font-medium">
                                        {isDeleted ? 'Deleted' : confirmDelete ? 'Confirm?' : 'Delete'}
                                    </span>
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
