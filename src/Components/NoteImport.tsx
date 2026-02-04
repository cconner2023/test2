// components/NoteImport.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { TextButton } from './TextButton';
import { useNoteImport } from '../Hooks/useNoteImport';

export type ViewState = 'input' | 'decoded' | 'copied';

interface NoteImportProps {
    isVisible: boolean;
    onClose: () => void;
    isMobile?: boolean;
}

// Shared content component for both mobile and desktop
const NoteImportContent = ({ onClose }: { onClose: () => void }) => {
    const [viewState, setViewState] = useState<ViewState>('input');
    const [inputText, setInputText] = useState<string>('');
    const [decodedText, setDecodedText] = useState<string>('');
    const [scanError, setScanError] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    const { importFromBarcode } = useNoteImport();

    useEffect(() => {
        let timeoutId: number;
        if (viewState === 'copied') {
            timeoutId = window.setTimeout(() => {
                setViewState('decoded');
            }, 2000);
        }
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [viewState]);

    useEffect(() => {
        if (scanError && inputText) {
            setScanError('');
        }
    }, [inputText, scanError]);

    const handleSubmit = () => {
        if (!inputText.trim()) {
            setScanError('Please enter or scan a barcode');
            return;
        }
        try {
            const importedNote = importFromBarcode(inputText);
            setDecodedText(importedNote);
            setViewState('decoded');
        } catch (error: any) {
            setScanError(error.message || 'Failed to decode barcode');
        }
    };

    const handleBack = () => {
        setViewState('input');
        setScanError('');
    };

    const handleCopyText = () => {
        navigator.clipboard.writeText(decodedText);
        setViewState('copied');
    };

    const getTitle = () => {
        switch (viewState) {
            case 'input': return 'Import Note';
            case 'decoded': return 'Screening Note';
            case 'copied': return 'Import Note';
            default: return 'Import Note';
        }
    };

    return (
        <>
            {/* Drag Handle - Only visible on mobile */}
            <div className="flex justify-center pt-3 pb-2 md:hidden">
                <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
            </div>

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
            <div className="overflow-y-auto h-[calc(100dvh-80px)] md:overflow-visible md:h-auto">
                {viewState === 'input' && (
                    <div className="flex flex-col p-4 md:p-6 h-max min-h-20">
                        <div className="mb-4 relative">
                            <div className="relative">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    className="w-full rounded-full p-2 pl-10 border border-themegray1 focus:bg-themewhite2 text-sm focus:outline-none bg-themewhite text-tertiary pr-10"
                                    placeholder="Enter barcode string (e.g., A1|R1k|L2|S012|A0)"
                                />
                                {inputText && (
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        <button
                                            type="button"
                                            onClick={() => setInputText('')}
                                            className="p-1 text-tertiary"
                                            title="Clear input"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                            {scanError && (
                                <div className="ml-2 mt-2 text-sm text-themeredred">
                                    {scanError}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 justify-end">
                            <TextButton
                                text="Decode"
                                onClick={handleSubmit}
                                variant='dispo-specific'
                                className='bg-themeblue3 text-white rounded-full'
                            />
                        </div>
                    </div>
                )}

                {viewState === 'decoded' && (
                    <div className="flex flex-col p-4 md:p-6 min-h-20 h-max">
                        <div className="mb-4">
                            <div className="w-full h-max p-2 md:p-2 rounded border border-themegray1/20 bg-themewhite2 text-tertiary text-sm whitespace-pre-wrap wrap-break-word overflow-y-auto">
                                {decodedText || "No decoded text available"}
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-4">
                            <TextButton
                                text="← Back"
                                onClick={handleBack}
                                variant='dispo-specific'
                                className='bg-themewhite2 text-secondary rounded-full'
                            />
                            <div className="flex gap-3 w-auto">
                                <TextButton
                                    text="Copy Text"
                                    onClick={handleCopyText}
                                    variant='dispo-specific'
                                    className='bg-themeblue3 text-white rounded-full'
                                />
                            </div>
                        </div>
                    </div>
                )}

                {viewState === 'copied' && (
                    <div className="flex flex-col items-center justify-center p-8 md:p-12 min-w-75 h-max">
                        <div className="pt-2 pb-4">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-themeblue2/10 flex items-center justify-center">
                                <svg className="w-4 h-4 md:w-6 md:h-6 text-themeblue2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-md font-normal text-primary">
                                Document Copied to Clipboard
                            </h3>
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

    const [drawerPosition, setDrawerPosition] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [contentKey, setContentKey] = useState(0);
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
            setDrawerPosition(100);
            setContentKey(prev => prev + 1);
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

        const shouldClose = velocityRef.current > 0.3 || drawerPosition < 40;
        const shouldOpen = velocityRef.current < -0.3 || drawerPosition > 60;

        if (shouldClose) {
            animateToPosition(0);
        } else if (shouldOpen) {
            animateToPosition(100);
        } else {
            animateToPosition(drawerPosition > 50 ? 100 : 0);
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
    const backdropOpacity = Math.min(0.4, drawerPosition / 100 * 0.4);

    return (
        <>
            {/* Mobile Container */}
            <div ref={drawerRef} className="md:hidden">
                {/* Backdrop */}
                {isVisible && (
                    <div
                        className={`fixed inset-0 z-55 bg-black ${isDragging ? '' : 'transition-opacity duration-300 ease-out'}`}
                        style={{
                            opacity: backdropOpacity,
                            pointerEvents: drawerPosition > 10 ? 'auto' : 'none'
                        }}
                        onClick={handleClose}
                    />
                )}

                <div
                    className={`fixed left-0 right-0 z-60 bg-themewhite3 shadow-2xl ${isDragging ? '' : 'transition-all duration-300 ease-out'}`}
                    style={{
                        height: '100dvh',
                        maxHeight: '100dvh',
                        bottom: 0,
                        transform: `translateY(${mobileTranslateY}%)`,
                        opacity: mobileOpacity,
                        borderTopLeftRadius: '1.25rem',
                        borderTopRightRadius: '1.25rem',
                        willChange: isDragging ? 'transform' : 'auto',
                        touchAction: 'none',
                        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)',
                    }}
                    onTouchStart={handleDragStart}
                    onTouchMove={handleDragMove}
                    onTouchEnd={handleDragEnd}
                    onMouseDown={handleDragStart}
                    onMouseMove={handleDragMove}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                >
                    <NoteImportContent key={contentKey} onClose={handleClose} />
                </div>
            </div>

            {/* Desktop Container — aligned to right edge of content container */}
            <div className="hidden md:block">
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
                            <NoteImportContent key={contentKey} onClose={onClose} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
