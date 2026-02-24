import { useState, useEffect, useRef, useCallback, useMemo, type RefObject } from 'react';
import type { dispositionType, AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import { useNoteCapture } from '../Hooks/useNoteCapture';
import { useNoteShare } from '../Hooks/useNoteShare';
import { useDD689Export } from '../Hooks/useDD689Export';
import { useUserProfile } from '../Hooks/useUserProfile';
import { useAuthStore } from '../stores/useAuthStore';
import { usePageSwipe } from '../Hooks/usePageSwipe';
import { useTextExpander } from '../Hooks/useTextExpander';
import { useTemplateSession } from '../Hooks/useTemplateSession';
import { TextExpanderSuggestion } from './TextExpanderSuggestion';
import { TemplateOverlay } from './TemplateOverlay';
import { PIIWarningBanner } from './PIIWarningBanner';
import { detectPII } from '../lib/piiDetector';
import { formatSignature } from '../Utilities/NoteFormatter';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { UI_TIMING } from '../Utilities/constants';
import { NoteBarcodeGenerator } from './Barcode';
import { DecisionMaking } from './DecisionMaking';
import { PhysicalExam } from './PhysicalExam';
import { BaseDrawer } from './BaseDrawer';
import { ActionIconButton, SlideWrapper, ToggleOption } from './WriteNoteHelpers';
import { BrainCircuit, FileText, Stethoscope, ChevronLeft, ChevronRight, X } from 'lucide-react';

type DispositionType = dispositionType['type'];

type PageId = 'decision' | 'hpi' | 'pe' | 'fullnote';

/** Apply a text + cursor result to the textarea, batching state updates with a rAF cursor sync. */
function applyToTextarea(
    ref: RefObject<HTMLTextAreaElement | null>,
    setNote: (v: string) => void,
    setCursorPosition: (v: number) => void,
    text: string,
    cursor: number,
    focus = false,
) {
    setNote(text);
    setCursorPosition(cursor);
    requestAnimationFrame(() => {
        const ta = ref.current;
        if (ta) {
            ta.selectionStart = cursor;
            ta.selectionEnd = cursor;
            if (focus) ta.focus();
        }
    });
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
    selectedSymptom?: {
        icon: string;
        text: string;
    };
    isMobile?: boolean;
    initialPage?: number;
}

export const WriteNotePage = ({
    isVisible,
    disposition,
    algorithmOptions = [],
    cardStates = [],
    onExpansionChange,
    selectedSymptom = { icon: '', text: '' },
    isMobile = false,
    initialPage = 0,
}: WriteNoteProps) => {
    // Note content state — profile preferences provide defaults for new notes
    const { profile } = useUserProfile();
    const authUserId = useAuthStore(s => s.user?.id);
    const defaultHPI = profile.noteIncludeHPI ?? true;
    const defaultPE = profile.noteIncludePE ?? false;

    // Build visible wizard pages — hide HPI/PE when disabled in settings
    const visiblePages = useMemo(() => {
        const pages: { id: PageId; label: string }[] = [{ id: 'decision', label: 'Decision Making' }];
        if (defaultHPI) pages.push({ id: 'hpi', label: 'HPI' });
        if (defaultPE) pages.push({ id: 'pe', label: 'Physical Exam' });
        pages.push({ id: 'fullnote', label: 'Full Note' });
        return pages;
    }, [defaultHPI, defaultPE]);

    const [note, setNote] = useState<string>('');
    const [previewNote, setPreviewNote] = useState<string>('');
    const [includeDecisionMaking, setIncludeDecisionMaking] = useState<boolean>(true);
    const [includeHPI, setIncludeHPI] = useState<boolean>(defaultHPI);
    const [peNote, setPeNote] = useState<string>('');
    const [includePhysicalExam, setIncludePhysicalExam] = useState<boolean>(defaultPE);

    // Note timestamp — set automatically when user first reaches Full Note
    const [noteTimestamp, setNoteTimestamp] = useState<Date | null>(null);
    const [encodedValue, setEncodedValue] = useState<string>('');
    const [copiedTarget, setCopiedTarget] = useState<'preview' | 'encoded' | null>(null);

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
    const { session: templateSession, stepStartRef, startSession, fillCurrentAndAdvance, dismissDropdown, selectNextChoice, selectPrevChoice, endSession } = useTemplateSession();
    const { suggestions: expanderSuggestions, selectedIndex: expanderIndex, accept: acceptExpander, dismiss: dismissExpander, selectNext: expanderNext, selectPrev: expanderPrev } = useTextExpander({
        text: note,
        cursorPosition,
        expanders: textExpanders,
        enabled: textExpanderEnabled && currentPageId === 'hpi' && !templateSession.isActive,
    });
    const hasExpanderSuggestion = expanderSuggestions.length > 0;

    // End template session on page change
    useEffect(() => {
        if (templateSession.isActive) endSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPageId]);

    // PII detection (debounced) — checks both HPI and PE text
    const [piiWarnings, setPiiWarnings] = useState<string[]>([]);
    const [pePiiWarnings, setPePiiWarnings] = useState<string[]>([]);
    useEffect(() => {
        const id = window.setTimeout(() => setPiiWarnings(detectPII(note)), 400);
        return () => clearTimeout(id);
    }, [note]);
    useEffect(() => {
        const id = window.setTimeout(() => setPePiiWarnings(detectPII(peNote)), 400);
        return () => clearTimeout(id);
    }, [peNote]);
    const hasPII = piiWarnings.length > 0 || pePiiWarnings.length > 0;

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
            encodedText: encodedValue,
            createdAt: noteTimestamp?.toISOString() || new Date().toISOString(),
            symptomText: selectedSymptom?.text || 'Note',
            dispositionType: disposition.type,
            dispositionText: disposition.text,
        }, isMobile);
    }, [encodedValue, noteTimestamp, selectedSymptom, disposition, isMobile, shareNote]);

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
                                            onBlur={() => { if (templateSession.isActive) endSession(); }}
                                            onKeyDown={(e) => {
                                                const apply = (text: string, cursor: number, focus = false) =>
                                                    applyToTextarea(inputRef, setNote, setCursorPosition, text, cursor, focus);

                                                // --- Template session keyboard handlers ---
                                                if (templateSession.isActive && templateSession.activeNode) {
                                                    const { activeNode } = templateSession;

                                                    if (e.key === 'Escape') {
                                                        e.preventDefault();
                                                        if (activeNode.type === 'choice' && templateSession.showDropdown) {
                                                            dismissDropdown();
                                                        } else {
                                                            endSession();
                                                        }
                                                        return;
                                                    }
                                                    if (templateSession.showDropdown && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
                                                        e.preventDefault();
                                                        if (e.key === 'ArrowRight') selectNextChoice();
                                                        else selectPrevChoice();
                                                        return;
                                                    }
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        // Dropdown showing with a focused option — select it
                                                        if (templateSession.showDropdown && templateSession.selectedChoiceIndex >= 0 && activeNode.options) {
                                                            const opts = activeNode.options.filter((o) => o.trim() !== '');
                                                            if (templateSession.selectedChoiceIndex < opts.length) {
                                                                const result = fillCurrentAndAdvance(note, opts[templateSession.selectedChoiceIndex]);
                                                                if (result) apply(result.newText, result.cursorPosition);
                                                            } else if (activeNode.type === 'choice') {
                                                                // "Other" only exists on choice nodes
                                                                dismissDropdown();
                                                            }
                                                            return;
                                                        }
                                                        // Inline branch with no selection — must pick an option, ignore Enter
                                                        if (activeNode.type === 'branch') return;
                                                        // Step mode or dismissed choice dropdown — use typed text
                                                        const typedValue = note.slice(stepStartRef.current, cursorPosition);
                                                        const result = fillCurrentAndAdvance(note, typedValue);
                                                        if (result) apply(result.newText, result.cursorPosition);
                                                        return;
                                                    }
                                                    // Inline branch — block all other keystrokes (must use arrow+enter or tap)
                                                    if (activeNode.type === 'branch') {
                                                        if (!e.shiftKey) e.preventDefault();
                                                        return;
                                                    }
                                                    // Shift+Enter passes through for newline (step/choice only)
                                                    return;
                                                }

                                                // --- Text expander keyboard handlers ---
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
                                                        const accepted = expanderSuggestions[expanderIndex];
                                                        if (accepted?.template && accepted.template.length > 0) {
                                                            const abbrStart = result.newCursorPosition - accepted.expansion.length;
                                                            const cleaned = result.newText.slice(0, abbrStart) + result.newText.slice(result.newCursorPosition);
                                                            const tmpl = startSession(cleaned, abbrStart, accepted.template);
                                                            apply(tmpl.newText, tmpl.cursorPosition);
                                                        } else {
                                                            apply(result.newText, result.newCursorPosition);
                                                        }
                                                    }
                                                    return;
                                                }
                                            }}
                                            placeholder="History of present illness, clinical observations, assessment..."
                                            className="w-full text-tertiary bg-themewhite outline-none text-[16px] md:text-[10pt] px-4 py-3 rounded-md border border-themegray1/20 min-w-0 resize-none min-h-[12rem] leading-6 focus:border-themeblue1/30 transition-colors"
                                        />
                                        {hasExpanderSuggestion && !templateSession.isActive && (
                                            <TextExpanderSuggestion
                                                suggestions={expanderSuggestions}
                                                selectedIndex={expanderIndex}
                                                onDismiss={dismissExpander}
                                            />
                                        )}
                                        {templateSession.isActive && templateSession.activeNode && (
                                            <TemplateOverlay
                                                activeNode={templateSession.activeNode}
                                                showDropdown={templateSession.showDropdown}
                                                selectedChoiceIndex={templateSession.selectedChoiceIndex}
                                                onSelectOption={(value) => {
                                                    const result = fillCurrentAndAdvance(note, value);
                                                    if (result) applyToTextarea(inputRef, setNote, setCursorPosition, result.newText, result.cursorPosition, true);
                                                }}
                                                onDismissDropdown={dismissDropdown}
                                                onEndSession={endSession}
                                            />
                                        )}
                                        <PIIWarningBanner warnings={piiWarnings} />
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
                                {hasPII && (
                                    <PIIWarningBanner warnings={[...new Set([...piiWarnings, ...pePiiWarnings])]} />
                                )}
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
                    {currentPage < visiblePages.length - 1 && (
                        <button
                            onClick={handleNext}
                            disabled={hasPII}
                            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all md:w-auto md:h-auto md:px-5 md:py-2.5 md:rounded-xl md:gap-2 disabled:opacity-40 ${colors.buttonClass}`}
                            aria-label="Next"
                            title={hasPII ? 'Remove PII/PHI before continuing' : undefined}
                        >
                            <span className="hidden md:inline text-sm font-medium">Next</span>
                            <ChevronRight className="w-6 h-6" />
                        </button>
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
