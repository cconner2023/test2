import { useState, useEffect, useRef, useCallback } from 'react';
import type { dispositionType, AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import { useNoteCapture } from '../Hooks/useNoteCapture';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { TextButton } from './TextButton';
import { NoteBarcodeGenerator } from './Barcode';
import { DecisionMaking } from './DecisionMaking';

export type DispositionType = dispositionType['type'];
export type NoteViewState = 'input' | 'preview' | 'copied' | 'share';

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
    const [viewState, setViewState] = useState<NoteViewState>('input');
    const [note, setNote] = useState<string>('');
    const [previewNote, setPreviewNote] = useState<string>('');
    const [includeAlgorithm, setIncludeAlgorithm] = useState<boolean>(true);
    const [includeDecisionMaking, setIncludeDecisionMaking] = useState<boolean>(true);
    const [includeHPI, setIncludeHPI] = useState<boolean>(false);
    const [previousViewState, setPreviousViewState] = useState<Exclude<NoteViewState, 'copied'>>('input');
    const [encodedValue, setEncodedValue] = useState<string>('');

    // Page navigation state (0 = Decision Making, 1 = Write Note)
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
        if (viewState === 'copied') {
            const id = window.setTimeout(() => setViewState(previousViewState), 2000);
            return () => clearTimeout(id);
        }
    }, [viewState, previousViewState]);

    // --- Preview note generation ---
    useEffect(() => {
        if (viewState === 'preview') {
            const result = generateNote(
                { includeAlgorithm, includeDecisionMaking, customNote: includeHPI ? note : '' },
                disposition.type,
                disposition.text,
                selectedSymptom
            );
            setPreviewNote(result.fullNote);
        }
    }, [viewState, note, includeAlgorithm, includeDecisionMaking, includeHPI, generateNote, disposition, selectedSymptom]);

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
    const handleCopyToClipboard = useCallback((text: string, fromView: Exclude<NoteViewState, 'copied'>) => {
        navigator.clipboard.writeText(text);
        setPreviousViewState(fromView);
        setViewState('copied');
        onNoteSave?.(text);
    }, [onNoteSave]);

    const handleClearNoteAndHide = () => {
        setNote('');
        setIncludeHPI(false);
        inputRef.current?.focus();
    };

    // ========== SHEET DRAG HANDLERS (swipe-down-to-close, mobile only) ==========
    const handleSheetDragStart = useCallback((e: React.TouchEvent) => {
        if (!isMobile) return;
        const y = e.touches[0].clientY;
        sheetDragStartY.current = y;
        sheetDragActive.current = true;
        sheetVelocity.current = 0;
        sheetLastY.current = y;
        sheetLastTime.current = performance.now();
    }, [isMobile]);

    const handleSheetDragMove = useCallback((e: React.TouchEvent) => {
        if (!sheetDragActive.current || !isMobile) return;
        const y = e.touches[0].clientY;
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
            if (currentPage === 1 && dragX < 0) dragX *= 0.25;
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
            setCurrentPage(prev => Math.min(1, prev + 1));
        } else if (pageDragX > threshold || pageVelocityX.current > 0.3) {
            setCurrentPage(prev => Math.max(0, prev - 1));
        }
        setPageDragX(0);
    }, [isMobile, pageDragX]);

    // ========== RENDER HELPERS ==========
    const renderInputView = () => (
        <div key="input" className="space-y-6">
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
    );

    const renderShareView = () => (
        <div key="share" className="space-y-6">
            <div className="p-2 text-[10pt] font-normal text-primary">Share Encoded Note</div>
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
                <CopyButton onClick={() => handleCopyToClipboard(encodedValue, 'share')} title="Copy encoded value" />
            </div>
        </div>
    );

    const renderPreviewView = () => (
        <div key="preview" className="space-y-6">
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
                <CopyButton onClick={() => handleCopyToClipboard(previewNote, 'preview')} title="Copy note to clipboard" />
            </div>
        </div>
    );

    const renderCopiedView = () => (
        <div key="copied" className="flex flex-col items-center justify-center h-full">
            <div className="mb-4">
                <div className={`w-16 h-16 rounded-full ${colors.symptomClass} flex items-center justify-center`}>
                    <CheckIcon />
                </div>
            </div>
            <div className="text-center">
                <h3 className="text-base font-semibold text-primary">Copied to Clipboard</h3>
                <p className="text-sm text-tertiary mt-1">Returning to {previousViewState}...</p>
            </div>
        </div>
    );

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
                    >
                        <div className="w-10 h-1 rounded-full bg-themegray1/50" />
                    </div>
                )}

                {/* Header with page labels + close */}
                <div
                    className="flex items-center justify-between px-4 py-2 border-b border-themegray1/20 bg-themewhite2"
                    style={isMobile ? { touchAction: 'none' } : {}}
                    onTouchStart={isMobile ? handleSheetDragStart : undefined}
                    onTouchMove={isMobile ? handleSheetDragMove : undefined}
                    onTouchEnd={isMobile ? handleSheetDragEnd : undefined}
                >
                    <div className="flex gap-1 flex-1">
                        {(['Decision Making', 'Write Note'] as const).map((label, idx) => (
                            <button
                                key={label}
                                onClick={() => setCurrentPage(idx)}
                                className={`relative flex-1 py-2 text-sm font-medium transition-all duration-200
                                    ${currentPage === idx ? 'text-primary' : 'text-tertiary hover:text-primary'}`}
                            >
                                {label}
                                {currentPage === idx && (
                                    <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-all duration-200 ${colors.symptomClass}`} />
                                )}
                            </button>
                        ))}
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
                    className="flex-1 overflow-hidden"
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

                        {/* Page 1: Write Note */}
                        <div className={`w-full h-full shrink-0 overflow-y-auto p-2 bg-themewhite2 ${isMobile ? 'pb-10' : ''}`}>
                            {viewState === 'input' && renderInputView()}
                            {viewState === 'share' && renderShareView()}
                            {viewState === 'preview' && renderPreviewView()}
                            {viewState === 'copied' && renderCopiedView()}
                        </div>
                    </div>
                </div>

                {/* Action Buttons (Write Note page only) */}
                {currentPage === 1 && (
                    <ActionButtons
                        viewState={viewState}
                        colors={colors}
                        onBack={() => {
                            if (viewState === 'share') setViewState('preview');
                            else setViewState('input');
                        }}
                        onViewNote={() => setViewState('preview')}
                        onShare={() => setViewState('share')}
                        onDone={handleClose}
                    />
                )}
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

const CheckIcon: React.FC = () => (
    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
    </svg>
);

const ActionButtons: React.FC<{
    viewState: NoteViewState;
    colors: any;
    onBack: () => void;
    onViewNote: () => void;
    onShare: () => void;
    onDone: () => void;
}> = ({ viewState, colors, onBack, onViewNote, onShare, onDone }) => (
    <div className="flex items-start gap-2 justify-end p-4 shrink-0">
        {(viewState === 'preview' || viewState === 'share') && (
            <TextButton text="← Back" onClick={onBack} variant="dispo-specific" className='bg-themewhite3 text-tertiary rounded-full' />
        )}
        {viewState === 'input' && (
            <TextButton text="View Note" onClick={onViewNote} variant="dispo-specific" className={`${colors.buttonClass} rounded-full`} />
        )}
        {viewState === 'preview' && (
            <TextButton text="Share" onClick={onShare} variant="dispo-specific" className={`${colors.buttonClass} rounded-full`} />
        )}
        {viewState === 'share' && (
            <TextButton text="Done" onClick={onDone} variant="dispo-specific" className={`${colors.buttonClass} rounded-full`} />
        )}
    </div>
);
