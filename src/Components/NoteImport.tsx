// components/NoteImport.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera, ScanLine } from 'lucide-react';
import { TextButton } from './TextButton';
import { BaseDrawer } from './BaseDrawer';
import { useNoteImport } from '../Hooks/useNoteImport';
import { useBarcodeScanner } from '../Hooks/useBarcodeScanner';

export type ViewState = 'input' | 'decoded' | 'scanning';

export interface ImportSuccessData {
    encodedText: string;
    decodedText: string;
}

interface NoteImportProps {
    isVisible: boolean;
    onClose: () => void;
    initialViewState?: ViewState;
    onImportSuccess?: (data: ImportSuccessData) => void;
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
    state,
    setState,
    onImportSuccess
}: {
    state: ContentState;
    setState: React.Dispatch<React.SetStateAction<ContentState>>;
    onImportSuccess?: (data: ImportSuccessData) => void;
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

    return (
        <div className="overflow-y-auto h-full">
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
                    <div className="flex items-center justify-between gap-3 mt-4">
                        <TextButton
                            text="← Back"
                            onClick={handleBack}
                            variant='dispo-specific'
                            className='bg-themewhite2 text-secondary rounded-full'
                        />
                        {onImportSuccess && (
                            <TextButton
                                text="Import Note"
                                onClick={() => {
                                    onImportSuccess({
                                        encodedText: state.inputText,
                                        decodedText: state.decodedText
                                    });
                                }}
                                variant='dispo-specific'
                                className='bg-themeblue3 text-white rounded-full'
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export function NoteImport({ isVisible, onClose, initialViewState, onImportSuccess }: NoteImportProps) {
    // Lifted content state - persists across mobile/desktop layout changes
    const [contentState, setContentState] = useState<ContentState>({
        viewState: initialViewState || 'input',
        inputText: '',
        decodedText: '',
        scanError: '',
        isCopied: false
    });

    // Reset content state when opening
    useEffect(() => {
        if (isVisible) {
            setContentState({
                viewState: initialViewState || 'input',
                inputText: '',
                decodedText: '',
                scanError: '',
                isCopied: false
            });
        }
    }, [isVisible, initialViewState]);

    const title = contentState.viewState === 'decoded' ? 'Screening Note'
        : contentState.viewState === 'scanning' ? 'Scan Barcode'
            : 'Import Note';

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={onClose}
            fullHeight="90dvh"
            backdropOpacity={0.9}
            desktopPosition="right"
            desktopContainerMaxWidth="max-w-315"
            desktopMaxWidth="max-w-sm"
            desktopPanelPadding=""
            desktopTopOffset="4.5rem"
            header={{ title }}
        >
            <NoteImportContent
                state={contentState}
                setState={setContentState}
                onImportSuccess={onImportSuccess}
            />
        </BaseDrawer>
    );
}
