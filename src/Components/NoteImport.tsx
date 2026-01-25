// components/NoteImport.tsx
import { useState, useEffect, useRef } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { TextButton } from './TextButton';
import { useNoteImport } from '../Hooks/useNoteImport';

export type ViewState = 'input' | 'decoded' | 'copied';

interface NoteImportProps {
    onClose?: () => void;
}

export function NoteImport({ onClose }: NoteImportProps) {
    const [viewState, setViewState] = useState<ViewState>('input');
    const [inputText, setInputText] = useState<string>('');
    const [decodedText, setDecodedText] = useState<string>('');
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [scanError, setScanError] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    const { importFromBarcode } = useNoteImport();

    const [parentRef] = useAutoAnimate<HTMLDivElement>({
        duration: 200,
        easing: 'ease-in-out',
    });

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

    // Get title based on view state
    const getTitle = () => {
        switch (viewState) {
            case 'input':
                return 'Import Note';
            case 'decoded':
                return 'Screening Note';
            case 'copied':
                return 'Import Note';
            default:
                return 'Import Note';
        }
    };

    return (
        <div>
            <div
                ref={parentRef}
                className="w-max md:min-w-110 min-w-[94%] max-w-[94%] md:max-w-180 mx-auto mt-4 mb-4 rounded-md border border-themegray1/30 bg-themewhite overflow-hidden transition-[height,width,opacity] duration-200 ease-in-out"
            >
                {/* Header with close button on left and title on right */}
                <div className="flex items-center justify-between p-3 md:p-4 border-b border-themegray1/20">
                    <div className="flex items-center">
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1 text-tertiary hover:text-primary transition-colors mr-2"
                                title="Close"
                                aria-label="Close note import"
                            >
                                <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <div className="flex-1 text-center">
                        <h2 className="text-sm font-normal text-primary">
                            {getTitle()}
                        </h2>
                    </div>

                    {/* Spacer to balance the layout */}
                    <div className="w-8"></div>
                </div>

                {viewState === 'input' && (
                    <div className="flex flex-col p-4 md:p-5 h-max min-h-20">
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
                    <div className="flex flex-col p-4 md:p-5 min-h-20 h-max">
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
        </div>
    );
}