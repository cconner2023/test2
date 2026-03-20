// components/NoteImport.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera, ScanLine, User, ImagePlus, Check, AlertCircle } from 'lucide-react';
import { profileAvatars } from '../Data/ProfileAvatars';
import { supabase } from '../lib/supabase';
import {
    MultiFormatReader, BinaryBitmap, HybridBinarizer,
    HTMLCanvasElementLuminanceSource, DecodeHintType, BarcodeFormat,
} from '@zxing/library';
import { BaseDrawer } from './BaseDrawer';
import { HeaderPill, PillButton } from './HeaderPill';
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

interface ContentState {
    inputText: string;
    preview: ImportPreview | null;
    scanError: string;
    copiedTarget: 'preview' | 'encoded' | null;
}

// ─── Content component — ProviderDrawer-style layout ─────────────────────────

const NoteImportContent = ({
    state,
    setState,
    isMobile = false,
    onClose,
    autoPickImage,
    autoStartScan,
}: {
    state: ContentState;
    setState: React.Dispatch<React.SetStateAction<ContentState>>;
    isMobile?: boolean;
    onClose?: () => void;
    autoPickImage?: boolean;
    autoStartScan?: boolean;
}) => {
    const importInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDecodingImage, setIsDecodingImage] = useState(false);
    const [authorAvatarSvg, setAuthorAvatarSvg] = useState<React.ReactNode>(null);
    const [importExpanded, setImportExpanded] = useState(!state.preview);
    const [scanRequested, setScanRequested] = useState(false);

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

    // Decode a barcode string into a preview
    const decodeBarcode = useCallback(async (text: string) => {
        try {
            let payload = text;
            if (isEncryptedBarcode(text)) {
                const decrypted = await decryptBarcode(text);
                if (!decrypted) {
                    setState(prev => ({ ...prev, scanError: 'Sign in and connect to sync encryption key' }));
                    return;
                }
                payload = decrypted;
            }
            const preview = importFromBarcode(payload);
            preview.encodedText = text;
            setState(prev => ({ ...prev, preview, scanError: '' }));
            setImportExpanded(false);
        } catch (error: any) {
            setState(prev => ({ ...prev, scanError: error.message || 'Failed to decode barcode' }));
        }
    }, [importFromBarcode, setState]);

    // Handle scan result
    useEffect(() => {
        if (scanResult) {
            setScanRequested(false);
            setState(prev => ({ ...prev, inputText: scanResult }));
            clearResult();
            decodeBarcode(scanResult);
        }
    }, [scanResult, clearResult, decodeBarcode, setState]);

    // Handle scanner error
    useEffect(() => {
        if (scannerError) {
            setState(prev => ({ ...prev, scanError: scannerError }));
        }
    }, [scannerError, setState]);

    // Start camera scanning — sets scanRequested to render the video element,
    // then starts the scanner after a delay so the ref is available.
    const handleStartScan = useCallback(() => {
        setState(prev => ({ ...prev, scanError: '' }));
        setScanRequested(true);
    }, [setState]);

    // Once the video element mounts (scanRequested renders it), start the scanner
    useEffect(() => {
        if (scanRequested && !isScanning) {
            const timer = setTimeout(() => {
                if (videoRef.current) startScanning(videoRef.current);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [scanRequested, isScanning, startScanning]);

    // Stop camera scanning
    const handleStopScan = useCallback(() => {
        stopScanning();
        setScanRequested(false);
    }, [stopScanning]);

    // Auto-start scanning when requested (e.g. from NavTop scan button)
    const autoScanRef = useRef(false);
    useEffect(() => {
        if (autoStartScan && !autoScanRef.current) {
            autoScanRef.current = true;
            handleStartScan();
        }
        if (!autoStartScan) autoScanRef.current = false;
    }, [autoStartScan, handleStartScan]);

    // Decode barcode from an uploaded or pasted image
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

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);

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

    // Intercept clipboard paste for images
    useImagePaste(importExpanded, handleImageDecode);

    // Auto-open file picker when requested
    const autoPickedRef = useRef(false);
    useEffect(() => {
        if (autoPickImage && !autoPickedRef.current) {
            autoPickedRef.current = true;
            setTimeout(() => fileInputRef.current?.click(), 100);
        }
        if (!autoPickImage) autoPickedRef.current = false;
    }, [autoPickImage]);

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

    // Clear scan error when typing
    useEffect(() => {
        if (state.scanError && state.inputText) {
            setState(prev => ({ ...prev, scanError: '' }));
        }
    }, [state.inputText, state.scanError, setState]);

    // Focus import input when expanded
    useEffect(() => {
        if (importExpanded && importInputRef.current) {
            const timer = setTimeout(() => importInputRef.current?.focus(), 120);
            return () => clearTimeout(timer);
        }
    }, [importExpanded]);

    const handleExpandImport = useCallback(() => {
        setImportExpanded(true);
        setState(prev => ({ ...prev, scanError: '' }));
    }, [setState]);

    const handleCollapseImport = useCallback(() => {
        setImportExpanded(false);
        setState(prev => ({ ...prev, inputText: '', scanError: '' }));
        if (isScanning || scanRequested) { stopScanning(); setScanRequested(false); }
    }, [isScanning, scanRequested, stopScanning, setState]);

    const handleSubmit = useCallback(() => {
        const text = state.inputText.trim();
        if (!text) {
            setState(prev => ({ ...prev, scanError: 'Please enter or scan a barcode' }));
            return;
        }
        decodeBarcode(text);
    }, [state.inputText, decodeBarcode, setState]);

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

    const preview = state.preview;
    const colors = preview ? getColorClasses(preview.dispositionType as any) : null;

    // ── Header right: HeaderPill ↔ expanding input bar (matches ProviderDrawer) ──

    const headerRight = (
        <div className="flex items-center flex-1 min-w-0 justify-end relative">
            {/* Collapsed pill */}
            <div className={`transition-all duration-300 ${
                importExpanded
                    ? 'opacity-0 scale-90 pointer-events-none absolute right-0'
                    : 'opacity-100 scale-100'
            }`}>
                <HeaderPill>
                    <PillButton icon={ScanLine} iconSize={20} onClick={handleExpandImport} label="Import Note" />
                    <PillButton icon={X} onClick={onClose!} label="Close" />
                </HeaderPill>
            </div>
            {/* Expanded input bar */}
            <div className={`flex items-center flex-1 min-w-0 gap-2 transition-all duration-300 origin-right ${
                importExpanded
                    ? 'opacity-100 scale-100'
                    : 'opacity-0 scale-95 pointer-events-none absolute right-0 left-0'
            }`}>
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
                    className="flex-1 min-w-0"
                >
                    <div className="relative flex items-center">
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                            <button
                                type="button"
                                onClick={handleStartScan}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary/50 hover:text-themeblue3 hover:bg-themeblue3/5 active:scale-95 transition-colors"
                                title="Scan barcode"
                            >
                                <Camera size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isDecodingImage}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary/50 hover:text-themeblue3 hover:bg-themeblue3/5 active:scale-95 transition-colors disabled:opacity-40"
                                title={isDecodingImage ? 'Reading image...' : 'Upload image'}
                            >
                                <ImagePlus size={16} />
                            </button>
                        </div>
                        <input
                            ref={importInputRef}
                            type="text"
                            value={state.inputText}
                            onChange={(e) => setState(prev => ({ ...prev, inputText: e.target.value }))}
                            className="w-full rounded-full py-2.5 pl-[4.5rem] pr-3 border border-themeblue3/10 shadow-xs bg-themewhite focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm text-primary placeholder:text-tertiary/30 transition-all duration-300"
                            placeholder="Paste code or scan"
                        />
                    </div>
                </form>
                {state.inputText.trim() && (
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all duration-300 bg-themeblue3 text-white"
                        aria-label="Decode"
                        title="Decode"
                    >
                        <Check style={{ width: 20, height: 20 }} />
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleCollapseImport}
                    className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all duration-300 bg-themewhite2 border border-themeblue3/10 text-tertiary hover:text-primary"
                    aria-label="Close import"
                    title="Close import"
                >
                    <X style={{ width: 24, height: 24 }} />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>
        </div>
    );

    return (
        <div className="h-full overflow-y-auto">
            {/* ── Floating header — matches ProviderDrawer pattern ──────────── */}
            <div
                className="sticky top-0 z-10 backdrop-blur-sm bg-transparent"
                data-drag-zone
                style={{ touchAction: 'none' }}
            >
                {isMobile && (
                    <div className="flex justify-center pt-1.5 pb-1">
                        <div className="w-9 h-1 rounded-full bg-tertiary/25" />
                    </div>
                )}
                <div className={`px-5 ${isMobile ? 'pb-2.5' : 'py-4'}`}>
                    <div className="flex items-center justify-between">
                        {/* Left: title — collapses when import bar is expanded */}
                        <div className={`flex items-center gap-2 min-w-0 transition-all duration-200${importExpanded ? ' w-0 overflow-hidden' : ''}`}>
                            <h2 className={`truncate ${isMobile ? 'text-[17px] font-semibold text-primary' : 'text-2xl text-primary'}`}>
                                {preview ? 'Screening Note' : 'Import Note'}
                            </h2>
                        </div>
                        {/* Right: pill controls or expanding input bar */}
                        <div className={`flex items-center gap-2${importExpanded ? ' flex-1 min-w-0' : ' flex-1 min-w-0 justify-end'}`}>
                            {preview ? (
                                <div className="flex items-center justify-end flex-1">
                                    <HeaderPill>
                                        <PillButton icon={ScanLine} iconSize={20} onClick={() => {
                                            setState(prev => ({ ...prev, preview: null, inputText: '', scanError: '' }));
                                            setImportExpanded(true);
                                        }} label="Import Another" />
                                        <PillButton icon={X} onClick={onClose!} label="Close" />
                                    </HeaderPill>
                                </div>
                            ) : headerRight}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Inline camera scanning (matches ProviderDrawer) ──────────── */}
            {(scanRequested || isScanning) && (
                <div className="px-4 pt-3 pb-2">
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute inset-4 border-2 border-white/30 rounded-lg" />
                            <div className="absolute inset-x-4 top-1/2 h-0.5 bg-themeblue2 animate-pulse" />
                            <ScanLine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 text-white/50" />
                        </div>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                            Looking for barcode...
                        </div>
                    </div>
                    <div className="flex justify-center pt-2">
                        <button
                            onClick={handleStopScan}
                            className="text-xs text-tertiary/60 hover:text-tertiary active:scale-95 transition-colors"
                        >
                            Cancel scan
                        </button>
                    </div>
                </div>
            )}

            {/* ── Decode error ─────────────────────────────────────────────── */}
            {state.scanError && (
                <div className="px-4 pt-2">
                    {!preview ? (
                        <div className="rounded-xl bg-themeredred/5 border border-themeredred/20 p-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <AlertCircle size={16} className="text-themeredred shrink-0" />
                                <span className="text-sm font-medium text-themeredred">Unable to decode</span>
                            </div>
                            <p className="text-xs text-tertiary pl-6">{state.scanError}</p>
                        </div>
                    ) : (
                        <div className="text-xs text-themeredred">{state.scanError}</div>
                    )}
                </div>
            )}

            {/* ── Decoded content ──────────────────────────────────────────── */}
            {preview && (
                <div className="px-4 py-3 md:p-5 pb-8">
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
                    {/* Author metadata */}
                    <div className="flex items-center gap-3 text-xs text-tertiary flex-wrap mb-4">
                        <span className="flex items-center gap-1.5">
                            {authorAvatarSvg
                                ? <span className="w-4 h-4 rounded-full overflow-hidden shrink-0">{authorAvatarSvg}</span>
                                : <User size={12} className="shrink-0" />
                            }
                            {preview.authorLabel}
                        </span>
                    </div>

                    <div className="space-y-4">
                        {/* Note Preview */}
                        <section>
                            <div className="pb-2 flex items-center justify-between">
                                <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Note Preview</p>
                                <div className="flex items-center gap-0.5">
                                    <ActionIconButton
                                        onClick={() => handleCopy(preview.fullNote, 'preview')}
                                        status={state.copiedTarget === 'preview' ? 'done' : 'idle'}
                                        variant="copy"
                                        title="Copy note text"
                                    />
                                </div>
                            </div>
                            <div className="rounded-xl bg-themewhite2 overflow-hidden">
                                <div className="px-4 py-3 text-tertiary text-[8pt] whitespace-pre-wrap max-h-48 overflow-y-auto">
                                    {preview.fullNote || "No content selected"}
                                </div>
                            </div>
                        </section>

                        {/* Encoded Note / Barcode */}
                        <section>
                            <div className="pb-2 flex items-center justify-between">
                                <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Encoded Note</p>
                                <div className="flex items-center gap-0.5">
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
                            <div className="rounded-xl bg-themewhite2 overflow-hidden">
                                <div className="px-4 py-3">
                                    <BarcodeDisplay encodedText={preview.encodedText} />
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Outer wrapper — manages state, BaseDrawer, auto-decode ──────────────────

export function NoteImport({ isVisible, onClose, initialViewState, initialBarcodeText, autoPickImage, isMobile }: NoteImportProps) {
    const [contentState, setContentState] = useState<ContentState>({
        inputText: '',
        preview: null,
        scanError: '',
        copiedTarget: null,
    });

    const [startScan, setStartScan] = useState(false);
    const { importFromBarcode } = useNoteImport();
    const autoDecodeRef = useRef(false);

    // Reset content state when opening
    useEffect(() => {
        if (isVisible) {
            autoDecodeRef.current = false;
            setStartScan(initialViewState === 'scanning');
            setContentState({
                inputText: initialBarcodeText || '',
                preview: null,
                scanError: '',
                copiedTarget: null,
            });
        } else {
            setStartScan(false);
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
                        }));
                        return;
                    }
                    payload = decrypted;
                }
                const preview = importFromBarcode(payload);
                preview.encodedText = initialBarcodeText;
                setContentState(prev => ({ ...prev, preview }));
            } catch (error: any) {
                setContentState(prev => ({
                    ...prev,
                    scanError: error.message || 'Failed to decode barcode',
                }));
            }
        })();
    }, [isVisible, initialBarcodeText, importFromBarcode]);

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={onClose}
            fullHeight="90dvh"
            desktopPosition="right"
            mobileFloating={false}
        >
            {(handleClose) => (
                <NoteImportContent
                    state={contentState}
                    setState={setContentState}
                    isMobile={isMobile}
                    onClose={handleClose}
                    autoPickImage={autoPickImage}
                    autoStartScan={startScan}
                />
            )}
        </BaseDrawer>
    );
}
