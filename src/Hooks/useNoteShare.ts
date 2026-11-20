// Hooks/useNoteShare.ts — Share a note as a Data Matrix barcode image
import { useCallback, useState } from 'react';
import { barcodeSymbols, renderBarcodeSymbol } from '../Utilities/barcodeCodec';
import { createLogger } from '../Utilities/Logger';
import { UI_TIMING } from '../Utilities/constants';
import { emitCopied } from '../lib/copyFeedback';

/** Minimal note shape needed for sharing. */
export interface ShareableNote {
    encodedText: string;
    symptomText?: string;
    dispositionType?: string;
    dispositionText?: string;
}

const logger = createLogger('NoteShare');

type ShareStatus = 'idle' | 'generating' | 'sharing' | 'shared' | 'copied' | 'error';

const SHARE_RENDER = { scale: 6, padding: 6, backgroundcolor: 'ffffff' } as const;
/** White gutter between grid cells — keeps symbols separable for the tile-sweep import. */
const GRID_GAP = 64;
const LABEL_HEIGHT = 40;

/**
 * Generates a shareable image containing only the Data Matrix symbol(s)
 * on a white background. Keeping the image barcode-only ensures it can
 * be reliably decoded by ZXing when re-imported via paste or upload.
 * A multi-symbol series is laid out as a labeled grid with wide gutters.
 * Metadata (disposition, date) is sent as plain text alongside the image.
 */
function generateShareCanvas(note: ShareableNote): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    try {
        const symbols = barcodeSymbols(note.encodedText);
        if (symbols.length === 1) {
            renderBarcodeSymbol(canvas, symbols[0], SHARE_RENDER);
            return canvas;
        }
        const cells = symbols.map(sym => {
            const c = document.createElement('canvas');
            renderBarcodeSymbol(c, sym, SHARE_RENDER);
            return c;
        });
        const cell = Math.max(...cells.map(c => Math.max(c.width, c.height)));
        const cols = Math.ceil(Math.sqrt(cells.length));
        const rows = Math.ceil(cells.length / cols);
        canvas.width = cols * cell + (cols + 1) * GRID_GAP;
        canvas.height = rows * (cell + LABEL_HEIGHT) + (rows + 1) * GRID_GAP;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#444444';
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        cells.forEach((c, i) => {
            const x = GRID_GAP + (i % cols) * (cell + GRID_GAP);
            const y = GRID_GAP + Math.floor(i / cols) * (cell + LABEL_HEIGHT + GRID_GAP);
            ctx.drawImage(c, x + (cell - c.width) / 2, y + (cell - c.height) / 2);
            ctx.fillText(`${i + 1} / ${cells.length}`, x + cell / 2, y + cell + LABEL_HEIGHT - 8);
        });
    } catch {
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 200, 200);
        }
    }
    return canvas;
}

/** Build the plain-text description that accompanies the barcode image. */
function buildShareText(note: ShareableNote): string {
    const parts: string[] = [];
    if (note.symptomText) parts.push(note.symptomText);
    if (note.dispositionType) {
        parts.push(note.dispositionType + (note.dispositionText ? ` — ${note.dispositionText}` : ''));
    }
    return parts.join(' | ');
}

/**
 * Converts a canvas to a Blob (PNG).
 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to create image blob'));
            },
            'image/png',
            1.0
        );
    });
}

/**
 * Hook: share or copy a saved note as a Data Matrix barcode image.
 */
export function useNoteShare() {
    const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');

    const shareNote = useCallback(async (note: ShareableNote, isMobile: boolean) => {
        try {
            setShareStatus('generating');

            // Generate the image
            const canvas = generateShareCanvas(note);
            const blob = await canvasToBlob(canvas);

            const shareText = buildShareText(note);
            const fileName = `ADTMC-Note-${note.symptomText?.replace(/[^a-zA-Z0-9]/g, '-') || 'note'}.png`;

            if (isMobile && navigator.share) {
                // Mobile: use Web Share API — barcode image + metadata as text
                setShareStatus('sharing');
                const file = new File([blob], fileName, { type: 'image/png' });

                if (navigator.canShare?.({ files: [file] })) {
                    await navigator.share({
                        title: `ADTMC Note — ${note.symptomText || 'Note'}`,
                        text: shareText,
                        files: [file],
                    });
                    setShareStatus('shared');
                } else {
                    // Fallback: share text + encoded string (no file support)
                    await navigator.share({
                        title: `ADTMC Note — ${note.symptomText || 'Note'}`,
                        text: `${shareText}\n\nEncoded: ${note.encodedText}`,
                    });
                    setShareStatus('shared');
                }
            } else {
                // Desktop: copy image to clipboard
                setShareStatus('sharing');
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({
                            'image/png': blob,
                            'text/plain': new Blob([shareText], { type: 'text/plain' }),
                        }),
                    ]);
                    setShareStatus('copied');
                    // Desktop share IS a clipboard write — same confirmation as any copy.
                    emitCopied('Barcode copied');
                } catch {
                    // Fallback: download the image
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    setShareStatus('shared');
                }
            }

            // Reset status after delay
            setTimeout(() => setShareStatus('idle'), UI_TIMING.FEEDBACK_DURATION);
        } catch (err: unknown) {
            // User cancelled share dialog — not an error
            if (err instanceof Error && err.name === 'AbortError') {
                setShareStatus('idle');
                return;
            }
            logger.error('Share failed:', err);
            setShareStatus('error');
            setTimeout(() => setShareStatus('idle'), UI_TIMING.FEEDBACK_DURATION);
        }
    }, []);

    return { shareNote, shareStatus };
}
