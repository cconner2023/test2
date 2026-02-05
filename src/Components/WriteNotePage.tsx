import { useState, useEffect, useRef, useCallback } from 'react';
import type { dispositionType, AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import { useNoteCapture } from '../Hooks/useNoteCapture';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { TextButton } from './TextButton';
import { NoteBarcodeGenerator } from './Barcode';
import { DecisionMaking } from './DecisionMaking';

export type DispositionType = dispositionType['type'];

const PAGE_LABELS = ['Decision Making', 'Write Note', 'View Note', 'Share Note'];
const TOTAL_PAGES = 4;

interface WriteNoteProps {
    disposition: {
        type: DispositionType;
        text: string;
        addendum?: string;
    };
    algorithmOptions?: AlgorithmOptions[];
    cardStates?: CardState[];
    isExpanded: boolean;
    onExpansionChange: (expanded: boolean) => void;
    onNoteSave?: (note: string) => void;
    selectedSymptom?: {
        icon: string;
        text: string;
    };
    isMobile?: boolean;
}

export const WriteNotePage = ({
    disposition,
    algorithmOptions = [],
    cardStates = [],
    onExpansionChange,
    onNoteSave,
    selectedSymptom = { icon: '', text: '' },
    isMobile = false,
}: WriteNoteProps) => {
    // Note content state
    const [note, setNote] = useState<string>('');
    const [previewNote, setPreviewNote] = useState<string>('');
    const [includeAlgorithm, setIncludeAlgorithm] = useState<boolean>(true);
    const [includeDecisionMaking, setIncludeDecisionMaking] = useState<boolean>(true);
    const [includeHPI, setIncludeHPI] = useState<boolean>(false);
    const [encodedValue, setEncodedValue] = useState<string>('');
    const [isCopied, setIsCopied] = useState(false);

    // Page navigation state (0=Decision Making, 1=Write Note, 2=View Note, 3=Share Note)
    const [currentPage, setCurrentPage] = useState(0);

    // Bottom sheet state (mobile)
    const [sheetPosition, setSheetPosition] = useState(100); // 0=visible, 100=hidden

    // Refs
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const sheetRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Gesture refs - sheet drag (vertical close)
    const sheetDragStartY = useRef(0);
    const sheetDragActive = useRef(false);
    const sheetVelocity = useRef(0);
    const sheetLastY = useRef(0);
    const sheetLastTime = useRef(0);

    // Gesture refs - page swipe (horizontal)
    const pageTouchStart = useRef({ x: 0, y: 0 });
    const pageGestureDir = useRef<'none' | 'horizontal' | 'vertical'>('none');
    const [pageDragX, setPageDragX] = useState(0);
    const pageDragActive = useRef(false);
    const pageVelocityX = useRef(0);
    const pageLastX = useRef(0);
    const pageLastTime = useRef(0);

    // Hooks
    const { generateNote } = useNoteCapture(algorithmOptions, cardStates);
    const colors = getColorClasses(disposition.type);

    // --- Mount animation ---
    useEffect(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => setSheetPosition(0));
        });
    }, []);

    // --- Copied state auto-revert ---
    useEffect(() => {
        if (isCopied) {
            const id = window.setTimeout(() => setIsCopied(false), 2000);
            return () => clearTimeout(id);
        }
    }, [isCopied]);

    // --- Preview note generation (triggers when on View Note page) ---
    useEffect(() => {
        if (currentPage === 2) {
            const result = generateNote(
                { includeAlgorithm, includeDecisionMaking, customNote: includeHPI ? note : '' },
                disposition.type,
                disposition.text,
                selectedSymptom
            );
            setPreviewNote(result.fullNote);
        }
    }, [currentPage, note, includeAlgorithm, includeDecisionMaking, includeHPI, generateNote, disposition, selectedSymptom]);

    // --- Close handler (animate out then unmount) ---
    const handleClose = useCallback(() => {
        if (isMobile) {
            setSheetPosition(100);
            setTimeout(() => onExpansionChange(false), 300);
        } else {
            onExpansionChange(false);
        }
    }, [isMobile, onExpansionChange]);

    // --- Copy handler ---
    const handleCopy = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
        setIsCopied(true);
        onNoteSave?.(text);
    }, [onNoteSave]);

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

    // ========== SHEET DRAG HANDLERS (swipe-down-to-close, mobile only) ==========
    const handleSheetDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        if (!isMobile) return;
        const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
        sheetDragStartY.current = y;
        sheetDragActive.current = true;
        sheetVelocity.current = 0;
        sheetLastY.current = y;
        sheetLastTime.current = performance.now();
    }, [isMobile]);

    const handleSheetDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        if (!sheetDragActive.current || !isMobile) return;
        const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const dy = y - sheetDragStartY.current;

        const now = performance.now();
        const dt = now - sheetLastTime.current;
        if (dt > 0) {
            sheetVelocity.current = (y - sheetLastY.current) / dt;
        }
        sheetLastY.current = y;
        sheetLastTime.current = now;

        const sheetHeight = sheetRef.current?.clientHeight || window.innerHeight;
        const pct = Math.max(0, (dy / sheetHeight) * 100);
        setSheetPosition(pct);
    }, [isMobile]);

    const handleSheetDragEnd = useCallback(() => {
        if (!sheetDragActive.current || !isMobile) return;
        sheetDragActive.current = false;

        if (sheetVelocity.current > 0.4 || sheetPosition > 35) {
            // Close
            setSheetPosition(100);
            setTimeout(() => onExpansionChange(false), 300);
        } else {
            // Snap back open
            setSheetPosition(0);
        }
    }, [isMobile, sheetPosition, onExpansionChange]);

    // ========== PAGE SWIPE HANDLERS (horizontal, mobile only) ==========
    const handleContentTouchStart = useCallback((e: React.TouchEvent) => {
        if (!isMobile) return;
        const touch = e.touches[0];
        pageTouchStart.current = { x: touch.clientX, y: touch.clientY };
        pageGestureDir.current = 'none';
        pageDragActive.current = false;
        pageVelocityX.current = 0;
        pageLastX.current = touch.clientX;
        pageLastTime.current = performance.now();
    }, [isMobile]);

    const handleContentTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isMobile) return;
        const touch = e.touches[0];
        const dx = touch.clientX - pageTouchStart.current.x;
        const dy = touch.clientY - pageTouchStart.current.y;

        // Velocity tracking
        const now = performance.now();
        const dt = now - pageLastTime.current;
        if (dt > 0) {
            pageVelocityX.current = (touch.clientX - pageLastX.current) / dt;
        }
        pageLastX.current = touch.clientX;
        pageLastTime.current = now;

        // Determine gesture direction on first significant move
        if (pageGestureDir.current === 'none') {
            if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                pageGestureDir.current = 'horizontal';
                pageDragActive.current = true;
            } else if (Math.abs(dy) > 10) {
                pageGestureDir.current = 'vertical';
                return; // Let browser scroll
            } else {
                return;
            }
        }

        if (pageGestureDir.current === 'horizontal' && pageDragActive.current) {
            let dragX = dx * 0.85;
            // Resistance at edges
            if (currentPage === 0 && dragX > 0) dragX *= 0.25;
            if (currentPage === TOTAL_PAGES - 1 && dragX < 0) dragX *= 0.25;
            setPageDragX(dragX);
        }
    }, [isMobile, currentPage]);

    const handleContentTouchEnd = useCallback(() => {
        if (!pageDragActive.current || !isMobile) {
            pageGestureDir.current = 'none';
            return;
        }
        pageDragActive.current = false;
        pageGestureDir.current = 'none';

        const containerWidth = contentRef.current?.clientWidth || 300;
        const threshold = containerWidth * 0.2;

        if (pageDragX < -threshold || pageVelocityX.current < -0.3) {
            setCurrentPage(prev => Math.min(TOTAL_PAGES - 1, prev + 1));
        } else if (pageDragX > threshold || pageVelocityX.current > 0.3) {
            setCurrentPage(prev => Math.max(0, prev - 1));
        }
        setPageDragX(0);
    }, [isMobile, pageDragX]);

    // ========== MAIN RENDER ==========
    const backdropOpacity = Math.max(0, (1 - sheetPosition / 100) * 0.4);
    const isDraggingSheet = sheetDragActive.current;
    const isDraggingPage = pageDragActive.current;

    // Horizontal page transform
    const pageTranslateX = `calc(${-currentPage * 100}% + ${pageDragX}px)`;

    return (
        <div className="h-full w-full relative">
            {/* Backdrop (mobile only) */}
            {isMobile && (
                <div
                    className="absolute inset-0 bg-black"
                    style={{
                        opacity: backdropOpacity,
                        transition: isDraggingSheet ? 'none' : 'opacity 300ms ease',
                        pointerEvents: sheetPosition < 50 ? 'auto' : 'none',
                    }}
                    onClick={handleClose}
                />
            )}

            {/* Sheet / Container */}
            <div
                ref={sheetRef}
                className={`${isMobile
                    ? 'absolute inset-x-0 bottom-0 rounded-t-2xl'
                    : 'h-full w-full rounded-md'
                    } bg-themewhite2 overflow-hidden flex flex-col`}
                style={isMobile ? {
                    height: '95vh',
                    transform: `translateY(${sheetPosition}%)`,
                    transition: isDraggingSheet ? 'none' : 'transform 300ms cubic-bezier(0.25, 0.1, 0.25, 1)',
                    willChange: isDraggingSheet ? 'transform' : 'auto',
                    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)',
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                } : {}}
            >
                {/* Drag Handle (mobile only) */}
                {isMobile && (
                    <div
                        className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
                        style={{ touchAction: 'none' }}
                        onTouchStart={handleSheetDragStart}
                        onTouchMove={handleSheetDragMove}
                        onTouchEnd={handleSheetDragEnd}
                        onMouseDown={handleSheetDragStart}
                        onMouseMove={handleSheetDragMove}
                        onMouseUp={handleSheetDragEnd}
                        onMouseLeave={handleSheetDragEnd}
                    >
                        <div className="w-10 h-1 rounded-full bg-themegray1/50" />
                    </div>
                )}

                {/* Header: page title + step dots + close */}
                <div
                    className="flex items-center justify-between px-4 py-2 border-b border-themegray1/20 bg-themewhite2"
                    style={isMobile ? { touchAction: 'none' } : {}}
                    onTouchStart={isMobile ? handleSheetDragStart : undefined}
                    onTouchMove={isMobile ? handleSheetDragMove : undefined}
                    onTouchEnd={isMobile ? handleSheetDragEnd : undefined}
                    onMouseDown={isMobile ? handleSheetDragStart : undefined}
                    onMouseMove={isMobile ? handleSheetDragMove : undefined}
                    onMouseUp={isMobile ? handleSheetDragEnd : undefined}
                    onMouseLeave={isMobile ? handleSheetDragEnd : undefined}
                >
                    <div className="flex flex-col gap-1.5 flex-1">
                        <span className="text-sm font-medium text-primary">{PAGE_LABELS[currentPage]}</span>
                        <div className="flex gap-1.5">
                            {PAGE_LABELS.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-1 rounded-full transition-all duration-300 ${
                                        idx === currentPage
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
                        onClick={handleClose}
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
                    onTouchStart={isMobile ? handleContentTouchStart : undefined}
                    onTouchMove={isMobile ? handleContentTouchMove : undefined}
                    onTouchEnd={isMobile ? handleContentTouchEnd : undefined}
                >
                    <div
                        className="flex h-full"
                        style={{
                            transform: `translateX(${pageTranslateX})`,
                            transition: isDraggingPage ? 'none' : 'transform 300ms cubic-bezier(0.25, 0.1, 0.25, 1)',
                        }}
                    >
                        {/* Page 0: Decision Making */}
                        <div className="w-full h-full shrink-0 overflow-y-auto">
                            <DecisionMaking
                                algorithmOptions={algorithmOptions}
                                cardStates={cardStates}
                                disposition={disposition}
                                dispositionType={disposition.type}
                            />
                        </div>

                        {/* Page 1: Write Note Options */}
                        <div className={`w-full h-full shrink-0 overflow-y-auto p-2 bg-themewhite2 ${isMobile ? 'pb-10' : ''}`}>
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
                                            <div className="transition-all duration-200 ease-in-out">
                                                <div className="flex items-center justify-center transition-all duration-300 bg-themewhite text-tertiary rounded-md border border-themeblue3/10 shadow-xs focus-within:border-themeblue1/30 focus-within:bg-themewhite2">
                                                    <textarea
                                                        ref={inputRef}
                                                        value={note}
                                                        onChange={(e) => setNote(e.target.value)}
                                                        className="text-tertiary bg-transparent outline-none text-[16px] md:text-[8pt] w-full px-4 py-2 rounded-l-full min-w-0 resize-none h-10 leading-5"
                                                    />
                                                    <div
                                                        className="flex items-center justify-center px-2 py-2 bg-transparent stroke-themeblue3 cursor-pointer transition-all duration-300 shrink-0"
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
                        <div className={`w-full h-full shrink-0 overflow-y-auto p-4 bg-themewhite2 ${isMobile ? 'pb-10' : ''}`}>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-normal text-primary">Note Preview</div>
                                    <div className="flex items-center gap-1 text-[9px]">
                                        {includeAlgorithm && <span className={`px-2 py-2 rounded-md ${colors.symptomClass}`}>Algorithm</span>}
                                        {includeAlgorithm && includeDecisionMaking && <span className="text-tertiary mx-1">•</span>}
                                        {includeDecisionMaking && <span className={`px-2 py-2 rounded-md ${colors.symptomClass}`}>Decision Making</span>}
                                        {(includeAlgorithm || includeDecisionMaking) && includeHPI && <span className="text-tertiary mx-1">•</span>}
                                        {includeHPI && <span className={`px-2 py-2 rounded-md ${colors.symptomClass}`}>HPI</span>}
                                        {(!includeAlgorithm && !includeDecisionMaking && !includeHPI) && <span className="text-tertiary">No content selected</span>}
                                    </div>
                                </div>
                                <div className="relative">
                                    <div className="w-full max-h-96 p-3 rounded-md bg-themewhite3 text-tertiary text-[8pt] whitespace-pre-wrap overflow-y-auto">
                                        {previewNote || "No content selected"}
                                    </div>
                                    <CopyButton onClick={() => handleCopy(previewNote)} title="Copy note to clipboard" />
                                </div>
                            </div>
                        </div>

                        {/* Page 3: Share Note */}
                        <div className={`w-full h-full shrink-0 overflow-y-auto p-4 bg-themewhite2 ${isMobile ? 'pb-10' : ''}`}>
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
                    className="flex items-center gap-2 justify-between p-4 shrink-0"
                    style={isMobile ? { paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' } : {}}
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
                            <TextButton text="Done" onClick={handleClose} variant="dispo-specific" className={`${colors.buttonClass} rounded-full`} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ========== HELPER COMPONENTS ==========

const ToggleOption: React.FC<{
    checked: boolean;
    onChange: () => void;
    label: string;
    colors: any;
}> = ({ checked, onChange, label, colors }) => (
    <div
        onClick={onChange}
        className={`text-xs p-3 rounded border transition-all duration-300 cursor-pointer
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
