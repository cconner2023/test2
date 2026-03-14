// components/NoteImport.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera, ScanLine, User, ImagePlus, CheckCircle } from 'lucide-react';
import { profileAvatars } from '../Data/ProfileAvatars';
import { supabase } from '../lib/supabase';
import {
    MultiFormatReader, BinaryBitmap, HybridBinarizer,
    HTMLCanvasElementLuminanceSource, DecodeHintType, BarcodeFormat,
} from '@zxing/library';
import { TextButton } from './TextButton';
import { BaseDrawer } from './BaseDrawer';
import { BarcodeDisplay } from './Barcode';
import { ActionIconButton, shareStatusToIconStatus } from './WriteNoteHelpers';
import { useNoteImport } from '../Hooks/useNoteImport';
import type { ImportPreview } from '../Hooks/useNoteImport';
import { useImagePaste } from '../Hooks/useImagePaste';
import { useNoteShare } from '../Hooks/useNoteShare';
import { useBarcodeScanner } from '../Hooks/useBarcodeScanner';
import { isEncryptedBarcode, decryptBarcode } from '../Utilities/NoteCodec';
import { copyWithHtml } from '../Utilities/clipboardUtils';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { UI_TIMING } from '../Utilities/constants';

export type ViewState = 'input' | 'decoded' | 'scanning';

interface NoteImportProps {
    isVisible: boolean;
    onClose: () => void;
    initialViewState?: ViewState;
    initialBarcodeText?: string;
    autoPickImage?: boolean;
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

// Shared content component - receives state from parent to persist across layout changes
const NoteImportContent = ({
    state,
    setState,
    isMobile = false,
    onClose,
    autoPickImage,
}: {
    state: ContentState;
    setState: React.Dispatch<React.SetStateAction<ContentState>>;
    isMobile?: boolean;
    onClose?: () => void;
    autoPickImage?: boolean;
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDecodingImage, setIsDecodingImage] = useState(false);
    const [authorAvatarSvg, setAuthorAvatarSvg] = useState<React.ReactNode>(null);

    const { importFromBarcode } = useNoteImport();

    // Fetch the author's avatar from Supabase when a preview with a userId is available
    useEffect(() => {
        const userId = state.preview?.userId;
        if (!userId) { setAuthorAvatarSvg(null); return; }

        supabase
            .from('profiles')
            .select('avatar_id')
            .eq('id', userId)
            .single()
            .then(({ data }) => {
                const avatarId = data?.avatar_id;
                const match = avatarId ? profileAvatars.find(a => a.id === avatarId) : null;
                setAuthorAvatarSvg(match?.svg ?? null);
            });
    }, [state.preview?.userId]);
    const { shareNote, shareStatus } = useNoteShare();
    const { isScanning, error: scannerError, result: scanResult, startScanning, stopScanning, clearResult } = useBarcodeScanner();

    // Decode a barcode string (from scan or paste) into a preview
    const decodeBarcode = useCallback(async (text: string) => {
        try {
            let payload = text;

            if (isEncryptedBarcode(text)) {
                const decrypted = await decryptBarcode(text);
                if (!decrypted) {
                    setState(prev => ({
                        ...prev,
                        scanError: 'Sign in and connect to sync encryption key',
                    }));
                    return;
                }
                payload = decrypted;
            }

            const preview = importFromBarcode(payload);
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
    useImagePaste(state.viewState === 'input', handleImageDecode);

    // Auto-open file picker when requested (e.g. from NavTop ImagePlus button)
    const autoPickedRef = useRef(false);
    useEffect(() => {
        if (autoPickImage && state.viewState === 'input' && !autoPickedRef.current) {
            autoPickedRef.current = true;
            // Small delay to let the drawer render the file input first
            setTimeout(() => fileInputRef.current?.click(), 100);
        }
        if (!autoPickImage) autoPickedRef.current = false;
    }, [autoPickImage, state.viewState]);

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
        copyWithHtml(text);
        setState(prev => ({ ...prev, copiedTarget: target }));
    }, [setState]);

    const handleShare = useCallback(() => {
        if (!state.preview) return;
        shareNote({
            encodedText: state.preview.encodedText,
            symptomText: state.preview.symptomText,
            dispositionType: state.preview.dispositionType,
            dispositionText: state.preview.dispositionText,
        }, isMobile);
    }, [state.preview, shareNote, isMobile]);

    // Disposition badge colors
    const preview = state.preview;
    const colors = preview ? getColorClasses(preview.dispositionType as any) : null;

    return (
        <div className="flex flex-col h-full">
            {/* ── Input view ────────────────────────────────── */}
            {state.viewState === 'input' && (
                <div className="flex items-center gap-2 p-3 md:p-4">
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="shrink-0 p-1.5 text-tertiary/50 hover:text-tertiary active:scale-95 transition-colors"
                            title="Close"
                        >
                            <X size={18} />
                        </button>
                    )}
                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
                        className="flex-1 min-w-0"
                    >
                        <div className="relative flex items-center">
                            {/* Left icons — input sources */}
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                                <button
                                    type="button"
                                    onClick={handleStartScan}
                                    className="p-1.5 text-tertiary/50 hover:text-themeblue3 active:scale-95 transition-colors"
                                    title="Scan barcode"
                                >
                                    <Camera size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isDecodingImage}
                                    className="p-1.5 text-tertiary/50 hover:text-themeblue3 active:scale-95 transition-colors disabled:opacity-40"
                                    title={isDecodingImage ? 'Reading image...' : 'Upload image'}
                                >
                                    <ImagePlus size={16} />
                                </button>
                            </div>
                            <input
                                ref={inputRef}
                                type="text"
                                value={state.inputText}
                                onChange={(e) => setState(prev => ({ ...prev, inputText: e.target.value }))}
                                className="w-full rounded-full py-2.5 pl-[4.5rem] pr-10 border border-themegray1 focus:border-themeblue2 focus:outline-none text-sm bg-themewhite text-tertiary"
                                placeholder="Paste code or scan"
                            />
                            {/* Right icon — clear or decode */}
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
                                {state.inputText ? (
                                    <div className="flex items-center gap-0.5">
                                        <button
                                            type="button"
                                            onClick={() => setState(prev => ({ ...prev, inputText: '' }))}
                                            className="p-1 text-tertiary/40 hover:text-tertiary active:scale-95 transition-colors"
                                            title="Clear"
                                        >
                                            <X size={14} />
                                        </button>
                                        <button
                                            type="submit"
                                            className="p-1 text-themeblue3 hover:text-themeblue3/80 active:scale-95 transition-colors"
                                            title="Decode"
                                        >
                                            <CheckCircle size={22} />
                                        </button>
                                    </div>
                                ) : (
                                    <span className="p-1 text-tertiary/20">
                                        <CheckCircle size={22} />
                                    </span>
                                )}
                            </div>
                        </div>
                    </form>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    {state.scanError && (
                        <div className="mt-1.5 ml-2 text-xs text-themeredred">
                            {state.scanError}
                        </div>
                    )}
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
                            <span className="flex items-center gap-1.5">
                                {authorAvatarSvg
                                    ? <span className="w-4 h-4 rounded-full overflow-hidden shrink-0">{authorAvatarSvg}</span>
                                    : <User size={12} className="shrink-0" />
                                }
                                {preview.authorLabel}
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
                                            status={shareStatusToIconStatus(shareStatus)}
                                            variant="share"
                                            title="Share note as image"
                                        />
                                    </div>
                                </div>
                                <div className="mt-1">
                                    <BarcodeDisplay encodedText={preview.encodedText} />
                                </div>
                            </div>
                        </div>
                    </div>

                </>
            )}
        </div>
    );
};

export function NoteImport({ isVisible, onClose, initialViewState, initialBarcodeText, autoPickImage, isMobile }: NoteImportProps) {
    // Lifted content state - persists across mobile/desktop layout changes
    const [contentState, setContentState] = useState<ContentState>({
        viewState: initialViewState || 'input',
        inputText: '',
        preview: null,
        scanError: '',
        copiedTarget: null,
    });

    const { importFromBarcode } = useNoteImport();
    const autoDecodeRef = useRef(false);

    // Reset content state when opening
    useEffect(() => {
        if (isVisible) {
            autoDecodeRef.current = false;
            setContentState({
                viewState: initialViewState || 'input',
                inputText: initialBarcodeText || '',
                preview: null,
                scanError: '',
                copiedTarget: null,
            });
        }
    }, [isVisible, initialViewState, initialBarcodeText]);

    // Auto-decode when opened with a barcode from the inline NavTop input
    useEffect(() => {
        if (!isVisible || !initialBarcodeText || autoDecodeRef.current) return;
        autoDecodeRef.current = true;

        (async () => {
            try {
                let payload = initialBarcodeText;
                if (isEncryptedBarcode(initialBarcodeText)) {
                    const decrypted = await decryptBarcode(initialBarcodeText);
                    if (!decrypted) {
                        setContentState(prev => ({
                            ...prev,
                            scanError: 'Sign in and connect to sync encryption key',
                            viewState: 'input',
                        }));
                        return;
                    }
                    payload = decrypted;
                }
                const preview = importFromBarcode(payload);
                setContentState(prev => ({ ...prev, preview, viewState: 'decoded' }));
            } catch (error: any) {
                setContentState(prev => ({
                    ...prev,
                    scanError: error.message || 'Failed to decode barcode',
                    viewState: 'input',
                }));
            }
        })();
    }, [isVisible, initialBarcodeText, importFromBarcode]);

    const isDecoded = contentState.viewState === 'decoded';
    const isInput = contentState.viewState === 'input';

    const title = isDecoded ? 'Screening Note'
        : contentState.viewState === 'scanning' ? 'Scan Barcode'
            : 'Import Note';

    const drawerHeight = isInput ? 'auto' : '90dvh';

    const handleBack = useCallback(() => {
        setContentState(prev => ({ ...prev, viewState: 'input', scanError: '', preview: null }));
    }, []);

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={onClose}
            fullHeight={drawerHeight}
            desktopPosition="right"
            mobileFloating={isInput}
            header={isInput ? undefined : {
                title,
                showBack: isDecoded,
                onBack: isDecoded ? handleBack : undefined,
            }}
        >
            {(handleClose) => (
                <NoteImportContent
                    state={contentState}
                    setState={setContentState}
                    isMobile={isMobile}
                    onClose={handleClose}
                    autoPickImage={autoPickImage}
                />
            )}
        </BaseDrawer>
    );
}
