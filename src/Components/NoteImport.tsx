// components/NoteImport.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera, ScanLine, User, Building2, Clock, ImagePlus } from 'lucide-react';
import bwipjs from 'bwip-js';
import {
    MultiFormatReader, BinaryBitmap, HybridBinarizer,
    HTMLCanvasElementLuminanceSource, DecodeHintType, BarcodeFormat,
} from '@zxing/library';
import { TextButton } from './TextButton';
import { BaseDrawer } from './BaseDrawer';
import { ActionIconButton } from './WriteNoteHelpers';
import { useNoteImport } from '../Hooks/useNoteImport';
import type { ImportPreview } from '../Hooks/useNoteImport';
import { useNoteShare } from '../Hooks/useNoteShare';
import { useClinicName } from '../Hooks/useClinicNameResolver';
import { useBarcodeScanner } from '../Hooks/useBarcodeScanner';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { logError } from '../Utilities/ErrorHandler';
import { UI_TIMING } from '../Utilities/constants';

export type ViewState = 'input' | 'decoded' | 'scanning';

export interface ImportSuccessData {
    encodedText: string;
    decodedText: string;
    preview: ImportPreview;
}

interface NoteImportProps {
    isVisible: boolean;
    onClose: () => void;
    initialViewState?: ViewState;
    onImportSuccess?: (data: ImportSuccessData) => void;
    isMobile?: boolean;
}

// Content state interface for lifting state up
interface ContentState {
    viewState: ViewState;
    inputText: string;
    preview: ImportPreview | null;
    scanError: string;
    copiedTarget: 'preview' | 'encoded' | null;
}

/** Format a Date into military DTG format: DDHHmmMONYYYY (e.g. "122148FEB2026") */
function formatMilitaryDTG(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const year = date.getFullYear();
    return `${day}${hours}${minutes}${month}${year}`;
}

/** Renders a static Data Matrix barcode from an already-encoded string. */
function StaticBarcode({ encodedText }: { encodedText: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current || !encodedText) return;
        try {
            bwipjs.toCanvas(canvasRef.current, {
                bcid: 'datamatrix',
                text: encodedText,
                scale: 2,
                padding: 3,
            });
        } catch (e) {
            logError('NoteImport.StaticBarcode', e);
        }
    }, [encodedText]);

    const isLong = encodedText.length > 300;

    return (
        <div className="p-2 bg-themewhite2">
            <div className={`flex ${isLong ? 'flex-col items-center gap-3' : 'flex-row items-start gap-3'}`}>
                <div className={`shrink-0 ${isLong ? 'flex justify-center' : ''}`}>
                    <canvas
                        ref={canvasRef}
                        className="border border-gray-300 bg-white rounded-md"
                        style={{ maxWidth: '120px', height: 'auto' }}
                    />
                </div>
                <div className={`text-secondary ${isLong ? 'w-full' : 'flex-1 min-w-0'}`}>
                    <code className="text-xs break-all bg-themewhite3 p-2 rounded block max-h-24 overflow-y-auto">
                        {encodedText}
                    </code>
                </div>
            </div>
        </div>
    );
}

// Shared content component - receives state from parent to persist across layout changes
const NoteImportContent = ({
    state,
    setState,
    onImportSuccess,
    isMobile = false,
}: {
    state: ContentState;
    setState: React.Dispatch<React.SetStateAction<ContentState>>;
    onImportSuccess?: (data: ImportSuccessData) => void;
    isMobile?: boolean;
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDecodingImage, setIsDecodingImage] = useState(false);

    const { importFromBarcode } = useNoteImport();
    const { shareNote, shareStatus } = useNoteShare();
    const clinicName = useClinicName(state.preview?.clinicId ?? null);
    const { isScanning, error: scannerError, result: scanResult, startScanning, stopScanning, clearResult } = useBarcodeScanner();

    // Shared decode logic
    const decodeBarcode = useCallback((text: string) => {
        try {
            const preview = importFromBarcode(text);
            setState(prev => ({ ...prev, preview, viewState: 'decoded' }));
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

    // Decode Data Matrix barcode from an uploaded or pasted image.
    // Uses the raw ZXing pipeline (canvas → luminance → binarizer → reader)
    // instead of BrowserCodeReader.decodeFromImage which has DOM quirks.
    const handleImageDecode = useCallback(async (file: File) => {
        setIsDecodingImage(true);
        setState(prev => ({ ...prev, scanError: '' }));

        const objectUrl = URL.createObjectURL(file);
        try {
            const img = document.createElement('img');
            img.src = objectUrl;
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Failed to load image'));
            });

            // Draw onto a canvas so we can extract pixel data
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);

            // ZXing raw decode: canvas → luminance source → binary bitmap → reader
            const luminanceSource = new HTMLCanvasElementLuminanceSource(canvas);
            const bitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

            const hints = new Map<DecodeHintType, any>();
            hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX]);
            hints.set(DecodeHintType.TRY_HARDER, true);

            const reader = new MultiFormatReader();
            reader.setHints(hints);

            const result = reader.decode(bitmap);
            const text = result.getText();
            setState(prev => ({ ...prev, inputText: text }));
            decodeBarcode(text);
        } catch {
            setState(prev => ({
                ...prev,
                scanError: 'No barcode found in image. Try a clearer photo or paste the string directly.',
            }));
        } finally {
            URL.revokeObjectURL(objectUrl);
            setIsDecodingImage(false);
        }
    }, [decodeBarcode, setState]);

    // Intercept clipboard paste for images (text pastes flow through to the input normally)
    useEffect(() => {
        if (state.viewState !== 'input') return;

        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of Array.from(items)) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) handleImageDecode(file);
                    return;
                }
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [state.viewState, handleImageDecode]);

    // File input change handler
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleImageDecode(file);
        e.target.value = '';
    }, [handleImageDecode]);

    // Copy feedback auto-revert
    useEffect(() => {
        if (state.copiedTarget) {
            const timeoutId = window.setTimeout(
                () => setState(prev => ({ ...prev, copiedTarget: null })),
                UI_TIMING.COPY_FEEDBACK,
            );
            return () => clearTimeout(timeoutId);
        }
    }, [state.copiedTarget, setState]);

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

    const handleCopy = useCallback((text: string, target: 'preview' | 'encoded') => {
        navigator.clipboard.writeText(text);
        setState(prev => ({ ...prev, copiedTarget: target }));
    }, [setState]);

    const handleShare = useCallback(() => {
        if (!state.preview) return;
        shareNote({
            id: '',
            encodedText: state.preview.encodedText,
            createdAt: state.preview.timestamp?.toISOString() || new Date().toISOString(),
            symptomIcon: state.preview.symptomIcon,
            symptomText: state.preview.symptomText,
            dispositionType: state.preview.dispositionType,
            dispositionText: state.preview.dispositionText,
            previewText: state.preview.fullNote.slice(0, 200),
            sync_status: 'synced',
            authorId: '',
            authorName: null,
        }, isMobile);
    }, [state.preview, shareNote, isMobile]);

    // Disposition badge colors
    const preview = state.preview;
    const colors = preview ? getColorClasses(preview.dispositionType as any) : null;

    return (
        <div className="flex flex-col h-full">
            {/* ── Input view ────────────────────────────────── */}
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
                        <div className="flex gap-2">
                            <button
                                onClick={handleStartScan}
                                className="flex items-center gap-2 px-4 py-2 bg-themewhite2 text-secondary rounded-full text-sm font-medium hover:bg-themewhite transition-colors"
                            >
                                <Camera size={16} />
                                Scan
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isDecodingImage}
                                className="flex items-center gap-2 px-4 py-2 bg-themewhite2 text-secondary rounded-full text-sm font-medium hover:bg-themewhite transition-colors disabled:opacity-50"
                            >
                                <ImagePlus size={16} />
                                {isDecodingImage ? 'Reading...' : 'Image'}
                            </button>
                        </div>
                        <TextButton
                            text="Decode"
                            onClick={handleSubmit}
                            variant='dispo-specific'
                            className='bg-themeblue3 text-white rounded-full'
                        />
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>
            )}

            {/* ── Scanning view ────────────────────────────── */}
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
                                Looking for Data Matrix code...
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

            {/* ── Decoded review view ──────────────────────── */}
            {state.viewState === 'decoded' && preview && (
                <>
                    {/* Overview header info */}
                    <div className="px-4 md:px-6 pt-3 pb-2 border-b border-tertiary/10 bg-themewhite2">
                        {/* Symptom + disposition badge */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-sm font-medium text-primary">
                                {preview.symptomText}
                            </span>
                            {preview.dispositionType && colors && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${colors.badgeBg} ${colors.badgeText}`}>
                                    {preview.dispositionType}
                                    {preview.dispositionText ? ` — ${preview.dispositionText}` : ''}
                                </span>
                            )}
                        </div>
                        {/* Metadata row */}
                        <div className="flex items-center gap-3 text-xs text-tertiary flex-wrap">
                            {preview.timestamp && (
                                <span className="flex items-center gap-1">
                                    <Clock size={12} className="shrink-0" />
                                    {formatMilitaryDTG(preview.timestamp)}
                                </span>
                            )}
                            <span className="flex items-center gap-1">
                                <User size={12} className="shrink-0" />
                                {preview.authorLabel}
                            </span>
                            <span className="flex items-center gap-1">
                                <Building2 size={12} className="shrink-0" />
                                {clinicName || (preview.clinicId ? 'Loading...' : 'Unknown')}
                            </span>
                        </div>
                    </div>

                    {/* Scrollable two-box content */}
                    <div className={`flex-1 overflow-y-auto p-4 md:p-6 bg-themewhite2 ${isMobile ? 'pb-24' : ''}`}>
                        <div className="space-y-4">
                            {/* Box 1: Note Preview */}
                            <div>
                                <div className="flex items-center justify-between p-3 rounded-t-md bg-themewhite text-xs text-secondary">
                                    <span className="font-medium">Note Preview</span>
                                    <ActionIconButton
                                        onClick={() => handleCopy(preview.fullNote, 'preview')}
                                        status={state.copiedTarget === 'preview' ? 'done' : 'idle'}
                                        variant="copy"
                                        title="Copy note text"
                                    />
                                </div>
                                <div className="p-3 rounded-b-md bg-themewhite3 text-tertiary text-[8pt] whitespace-pre-wrap max-h-48 overflow-y-auto border border-themegray1/15">
                                    {preview.fullNote || "No content"}
                                </div>
                            </div>

                            {/* Box 2: Encoded Note / Barcode */}
                            <div>
                                <div className="flex items-center justify-between p-3 rounded-t-md bg-themewhite text-xs text-secondary">
                                    <span className="font-medium">Encoded Note</span>
                                    <div className="flex items-center gap-1">
                                        <ActionIconButton
                                            onClick={() => handleCopy(preview.encodedText, 'encoded')}
                                            status={state.copiedTarget === 'encoded' ? 'done' : 'idle'}
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
                                    <StaticBarcode encodedText={preview.encodedText} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer: Import Note button */}
                    {onImportSuccess && (
                        <div
                            className={`shrink-0 flex justify-end px-4 md:px-6 ${isMobile ? 'pt-3 pb-4' : 'py-3'} border-t border-tertiary/10 bg-themewhite2`}
                            style={isMobile ? { paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' } : {}}
                        >
                            <TextButton
                                text="Import Note"
                                onClick={() => {
                                    onImportSuccess({
                                        encodedText: state.inputText,
                                        decodedText: preview.fullNote,
                                        preview,
                                    });
                                }}
                                variant='dispo-specific'
                                className='bg-themeblue3 text-white rounded-full'
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export function NoteImport({ isVisible, onClose, initialViewState, onImportSuccess, isMobile }: NoteImportProps) {
    // Lifted content state - persists across mobile/desktop layout changes
    const [contentState, setContentState] = useState<ContentState>({
        viewState: initialViewState || 'input',
        inputText: '',
        preview: null,
        scanError: '',
        copiedTarget: null,
    });

    // Reset content state when opening
    useEffect(() => {
        if (isVisible) {
            setContentState({
                viewState: initialViewState || 'input',
                inputText: '',
                preview: null,
                scanError: '',
                copiedTarget: null,
            });
        }
    }, [isVisible, initialViewState]);

    const isDecoded = contentState.viewState === 'decoded';

    const title = isDecoded ? 'Screening Note'
        : contentState.viewState === 'scanning' ? 'Scan Barcode'
            : 'Import Note';

    const handleBack = useCallback(() => {
        setContentState(prev => ({ ...prev, viewState: 'input', scanError: '', preview: null }));
    }, []);

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={onClose}
            fullHeight="90dvh"
            header={{
                title,
                showBack: isDecoded,
                onBack: isDecoded ? handleBack : undefined,
            }}
        >
            <NoteImportContent
                state={contentState}
                setState={setContentState}
                onImportSuccess={onImportSuccess}
                isMobile={isMobile}
            />
        </BaseDrawer>
    );
}
