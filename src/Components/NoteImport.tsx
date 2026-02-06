// components/NoteImport.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera, ScanLine } from 'lucide-react';
import { TextButton } from './TextButton';
import { useNoteImport } from '../Hooks/useNoteImport';
import { useBarcodeScanner } from '../Hooks/useBarcodeScanner';

export type ViewState = 'input' | 'decoded' | 'scanning';

interface NoteImportProps {
    isVisible: boolean;
    onClose: () => void;
    isMobile?: boolean;
}

// Content state interface for lifting state up
interface ContentState {
    viewState: ViewState;
    inputText: string;
    decodedText: string;
    scanError: string;
    isCopied: boolean;
}

// Shared content component - receives state from parent to persist across layout changes
const NoteImportContent = ({
    onClose,
    isMobile,
    state,
    setState
}: {
    onClose: () => void;
    isMobile: boolean;
    state: ContentState;
    setState: React.Dispatch<React.SetStateAction<ContentState>>;
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const { importFromBarcode } = useNoteImport();
    const { isScanning, error: scannerError, result: scanResult, startScanning, stopScanning, clearResult } = useBarcodeScanner();

    // Shared decode logic
    const decodeBarcode = useCallback((text: string) => {
        try {
            const importedNote = importFromBarcode(text);
            setState(prev => ({ ...prev, decodedText: importedNote, viewState: 'decoded' }));
        } catch (error: any) {
            setState(prev => ({ ...prev, scanError: error.message || 'Failed to decode barcode' }));
        }
    }, [importFromBarcode, setState]);

    // Handle scan result
    useEffect(() => {
        if (scanResult) {
            setState(prev => ({ ...prev, inputText: scanResult }));
            clearResult();
            decodeBarcode(scanResult);
        }
    }, [scanResult, clearResult, decodeBarcode, setState]);

    // Handle scanner error
    useEffect(() => {
        if (scannerError) {
            setState(prev => ({ ...prev, scanError: scannerError, viewState: 'input' }));
        }
    }, [scannerError, setState]);

    // Start camera scanning
    const handleStartScan = () => {
        setState(prev => ({ ...prev, scanError: '', viewState: 'scanning' }));
        setTimeout(() => {
            if (videoRef.current) {
                startScanning(videoRef.current);
            }
        }, 100);
    };

    // Stop camera scanning
    const handleStopScan = () => {
        stopScanning();
        setState(prev => ({ ...prev, viewState: 'input' }));
    };

    useEffect(() => {
        if (state.isCopied) {
            const timeoutId = window.setTimeout(() => setState(prev => ({ ...prev, isCopied: false })), 2000);
            return () => clearTimeout(timeoutId);
        }
    }, [state.isCopied, setState]);

    useEffect(() => {
        if (state.scanError && state.inputText) {
            setState(prev => ({ ...prev, scanError: '' }));
        }
    }, [state.inputText, state.scanError, setState]);

    const handleSubmit = () => {
        if (!state.inputText.trim()) {
            setState(prev => ({ ...prev, scanError: 'Please enter or scan a barcode' }));
            return;
        }
        decodeBarcode(state.inputText);
    };

    const handleBack = () => {
        setState(prev => ({ ...prev, viewState: 'input', scanError: '' }));
    };

    const handleCopyText = () => {
        navigator.clipboard.writeText(state.decodedText);
        setState(prev => ({ ...prev, isCopied: true }));
    };

    const getTitle = () => {
        switch (state.viewState) {
            case 'input': return 'Import Note';
            case 'decoded': return 'Screening Note';
            case 'scanning': return 'Scan Barcode';
            default: return 'Import Note';
        }
    };

    return (
        <>
            {/* Drag Handle - Only visible on mobile */}
            {isMobile && (
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
                </div>
            )}

            {/* Header */}
            <div className="px-6 border-b border-tertiary/10 py-4 md:py-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-primary md:text-2xl">
                        {getTitle()}
                    </h2>
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
            <div className={`overflow-y-auto ${isMobile ? 'h-[calc(100dvh-80px)]' : 'h-auto'}`}>
                {state.viewState === 'input' && (
                    <div className="flex flex-col p-4 md:p-6 h-max min-h-20">
                        <div className="mb-4 relative">
                            <div className="relative">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={state.inputText}
                                    onChange={(e) => setState(prev => ({ ...prev, inputText: e.target.value }))}
                                    className="w-full rounded-full p-2 pl-10 border border-themegray1 focus:bg-themewhite2 text-sm focus:outline-none bg-themewhite text-tertiary pr-10"
                                    placeholder="Enter barcode string or scan"
                                />
                                {state.inputText && (
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        <button
                                            type="button"
                                            onClick={() => setState(prev => ({ ...prev, inputText: '' }))}
                                            className="p-1 text-tertiary"
                                            title="Clear input"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {state.scanError && (
                                <div className="ml-2 mt-2 text-sm text-themeredred">
                                    {state.scanError}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 justify-between">
                            <button
                                onClick={handleStartScan}
                                className="flex items-center gap-2 px-4 py-2 bg-themewhite2 text-secondary rounded-full text-sm font-medium hover:bg-themewhite transition-colors"
                            >
                                <Camera size={16} />
                                Scan
                            </button>
                            <TextButton
                                text="Decode"
                                onClick={handleSubmit}
                                variant='dispo-specific'
                                className='bg-themeblue3 text-white rounded-full'
                            />
                        </div>
                    </div>
                )}

                {state.viewState === 'scanning' && (
                    <div className="flex flex-col p-4 md:p-6 h-max min-h-60">
                        <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-4">
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover"
                                playsInline
                                muted
                            />
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-4 border-2 border-white/30 rounded-lg" />
                                <div className="absolute inset-x-4 top-1/2 h-0.5 bg-themeblue2 animate-pulse" />
                                <ScanLine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 text-white/50" />
                            </div>
                            {isScanning && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                                    Looking for PDF417 barcode...
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 justify-center">
                            <TextButton
                                text="Cancel"
                                onClick={handleStopScan}
                                variant='dispo-specific'
                                className='bg-themewhite2 text-secondary rounded-full'
                            />
                        </div>
                    </div>
                )}

                {state.viewState === 'decoded' && (
                    <div className="flex flex-col p-4 md:p-6 min-h-20 h-max relative">
                        {state.isCopied && (
                            <div className="absolute inset-x-0 top-0 flex justify-center pointer-events-none z-10">
                                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-themeblue2 text-white shadow-lg">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-sm font-medium">Copied to Clipboard</span>
                                </div>
                            </div>
                        )}
                        <div className="mb-4 relative">
                            <div className="w-full h-max p-3 rounded-md border border-themegray1/20 bg-themewhite3 text-tertiary text-sm whitespace-pre-wrap wrap-break-word overflow-y-auto max-h-96">
                                {state.decodedText || "No decoded text available"}
                            </div>
                            <button
                                onClick={handleCopyText}
                                className="absolute top-3 right-3 p-2 text-tertiary hover:text-primary transition-colors"
                                title="Copy note to clipboard"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex items-center justify-start gap-3 mt-4">
                            <TextButton
                                text="← Back"
                                onClick={handleBack}
                                variant='dispo-specific'
                                className='bg-themewhite2 text-secondary rounded-full'
                            />
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export function NoteImport({ isVisible, onClose, isMobile: externalIsMobile }: NoteImportProps) {
    const [localIsMobile, setLocalIsMobile] = useState(false);
    const isMobile = externalIsMobile !== undefined ? externalIsMobile : localIsMobile;

    // Lifted content state - persists across mobile/desktop layout changes
    const [contentState, setContentState] = useState<ContentState>({
        viewState: 'input',
        inputText: '',
        decodedText: '',
        scanError: '',
        isCopied: false
    });

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
            // Reset content state when opening
            setContentState({
                viewState: 'input',
                inputText: '',
                decodedText: '',
                scanError: '',
                isCopied: false
            });
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
            if (isSwipingUp || drawerPosition > 70) {
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
    const mobileHeight = drawerStage === 'partial' ? '40dvh' : '90dvh';
    const mobileHorizontalPadding = drawerStage === 'partial' ? '0.5rem' : '0';
    const mobileBottomPadding = drawerStage === 'partial' ? '1.5rem' : '0';
    const mobileBorderRadius = drawerStage === 'partial' ? '1rem' : '1.25rem 1.25rem 0 0';
    const mobileBoxShadow = drawerStage === 'partial'
        ? '0 4px 2px rgba(0, 0, 0, 0.05)'
        : '0 -4px 20px rgba(0, 0, 0, 0.1)';

    // Single container that adapts styling based on isMobile
    // Content is rendered once - state persists across layout changes
    return (
        <div ref={drawerRef}>
            {isMobile ? (
                <>
                <div
                    className={`fixed inset-0 z-60 bg-black ${isDragging ? '' : 'transition-opacity duration-300 ease-out'}`}
                    style={{
                        opacity: (drawerPosition / 100) * 0.3,
                        pointerEvents: drawerPosition > 0 ? 'auto' : 'none',
                    }}
                    onClick={handleClose}
                />
                <div
                    className={`fixed left-0 right-0 z-60 bg-themewhite3 ${isDragging ? '' : 'transition-all duration-300 ease-out'}`}
                    style={{
                        height: mobileHeight,
                        maxHeight: mobileHeight,
                        marginLeft: mobileHorizontalPadding,
                        marginRight: mobileHorizontalPadding,
                        marginBottom: mobileBottomPadding,
                        width: drawerStage === 'partial' ? 'calc(100% - 1rem)' : '100%',
                        bottom: 0,
                        transform: `translateY(${mobileTranslateY}%)`,
                        opacity: mobileOpacity,
                        borderRadius: mobileBorderRadius,
                        willChange: isDragging ? 'transform' : 'auto',
                        touchAction: 'none',
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
                    <NoteImportContent
                        onClose={handleClose}
                        isMobile={isMobile}
                        state={contentState}
                        setState={setContentState}
                    />
                </div>
                </>
            ) : (
                // Desktop modal
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
                            ${isVisible
                                ? "scale-x-100 scale-y-100 translate-x-0 translate-y-0"
                                : "opacity-0 scale-x-20 scale-y-20 translate-x-10 -translate-y-2 pointer-events-none"
                            }`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <NoteImportContent
                                onClose={onClose}
                                isMobile={isMobile}
                                state={contentState}
                                setState={setContentState}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
