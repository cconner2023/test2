// Hooks/useNoteShare.ts — Share a saved note as a Data Matrix barcode image
import { useCallback, useState } from 'react';
import bwipjs from 'bwip-js';
import type { SavedNote } from './useNotesStorage';
import { createLogger } from '../Utilities/Logger';

const logger = createLogger('NoteShare');

type ShareStatus = 'idle' | 'generating' | 'sharing' | 'shared' | 'copied' | 'error';

/**
 * Formats a Date into military DDHHmmMONYYYY string (e.g. "122148FEB2026").
 */
function formatMilitaryDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const year = date.getFullYear();
    return `${day}${hours}${minutes}${month}${year}`;
}

/**
 * Returns a disposition badge color based on category.
 */
function getDispositionColor(dispositionType: string): string {
    const dt = dispositionType.toUpperCase();
    if (dt.includes('I') && !dt.includes('II') && !dt.includes('III') && !dt.includes('IV')) return '#dc2626';
    if (dt.includes('II') && !dt.includes('III') && !dt.includes('IV')) return '#f59e0b';
    if (dt.includes('III')) return '#22c55e';
    if (dt.includes('IV')) return '#3b82f6';
    return '#6b7280';
}

/**
 * Generates a clean shareable image: barcode on the left,
 * disposition + date/time on the right. White background
 * regardless of theme. Renders at 2x for sharp output.
 *
 * Layout:
 *   [barcode]  |  Disposition (colored)
 *              |  DDHHmmMONYYYY
 */
function generateShareCanvas(note: SavedNote): HTMLCanvasElement {
    const scale = 2;
    const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    // ── 1. Generate Data Matrix barcode ──
    const barcodeCanvas = document.createElement('canvas');
    try {
        bwipjs.toCanvas(barcodeCanvas, {
            bcid: 'datamatrix',
            text: note.encodedText,
            scale: 3,
            padding: 4,
        });
    } catch {
        barcodeCanvas.width = 200;
        barcodeCanvas.height = 200;
        const bCtx = barcodeCanvas.getContext('2d');
        if (bCtx) {
            bCtx.fillStyle = '#ffffff';
            bCtx.fillRect(0, 0, 200, 200);
        }
    }

    // ── 2. Sizing ──
    const pad = 24;
    const gap = 20;  // gap between barcode and text
    const barcodeSize = 160;
    const rightW = 220;
    const canvasW = pad + barcodeSize + gap + rightW + pad;
    const canvasH = pad + barcodeSize + pad;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW * scale;
    canvas.height = canvasH * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // ── 3. Draw barcode on the left ──
    ctx.drawImage(barcodeCanvas, pad, pad, barcodeSize, barcodeSize);

    // ── 4. Draw text on the right, vertically centered ──
    const rightX = pad + barcodeSize + gap;
    const centerY = pad + barcodeSize / 2;

    // Disposition
    const hasDisposition = !!note.dispositionType;
    const dispText = hasDisposition
        ? note.dispositionType + (note.dispositionText ? ` — ${note.dispositionText}` : '')
        : '';

    // Date
    let dateStr = '';
    try {
        dateStr = formatMilitaryDate(new Date(note.createdAt));
    } catch { /* ignore */ }

    // Calculate vertical offsets so content is centered
    const lineH = 22;
    const totalTextH = (hasDisposition ? lineH : 0) + (dateStr ? lineH : 0);
    let textY = centerY - totalTextH / 2 + 14; // +14 for baseline offset

    if (hasDisposition) {
        ctx.fillStyle = getDispositionColor(note.dispositionType);
        ctx.font = `bold 15px ${font}`;
        ctx.textAlign = 'left';
        ctx.fillText(dispText, rightX, textY, rightW);
        textY += lineH;
    }

    if (dateStr) {
        ctx.fillStyle = '#6b7280';
        ctx.font = `13px ${font}`;
        ctx.textAlign = 'left';
        ctx.fillText(dateStr, rightX, textY);
    }

    return canvas;
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

    const shareNote = useCallback(async (note: SavedNote, isMobile: boolean) => {
        try {
            setShareStatus('generating');

            // Generate the image
            const canvas = generateShareCanvas(note);
            const blob = await canvasToBlob(canvas);

            if (isMobile && navigator.share) {
                // Mobile: use Web Share API with the image file
                setShareStatus('sharing');
                const file = new File(
                    [blob],
                    `ADTMC-Note-${note.symptomText?.replace(/[^a-zA-Z0-9]/g, '-') || 'note'}.png`,
                    { type: 'image/png' }
                );

                if (navigator.canShare?.({ files: [file] })) {
                    await navigator.share({
                        title: `ADTMC Note — ${note.symptomText || 'Note'}`,
                        text: note.dispositionType
                            ? `${note.symptomText} (${note.dispositionType})`
                            : note.symptomText || 'ADTMC Note',
                        files: [file],
                    });
                    setShareStatus('shared');
                } else {
                    // Fallback: try sharing without files (just text + data)
                    await navigator.share({
                        title: `ADTMC Note — ${note.symptomText || 'Note'}`,
                        text: `${note.symptomText || 'Note'}${note.dispositionType ? ` (${note.dispositionType})` : ''}\n\nEncoded: ${note.encodedText}`,
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
                        }),
                    ]);
                    setShareStatus('copied');
                } catch {
                    // Fallback: download the image
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `ADTMC-Note-${note.symptomText?.replace(/[^a-zA-Z0-9]/g, '-') || 'note'}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    setShareStatus('shared');
                }
            }

            // Reset status after delay
            setTimeout(() => setShareStatus('idle'), 2500);
        } catch (err: unknown) {
            // User cancelled share dialog — not an error
            if (err instanceof Error && err.name === 'AbortError') {
                setShareStatus('idle');
                return;
            }
            logger.error('Share failed:', err);
            setShareStatus('error');
            setTimeout(() => setShareStatus('idle'), 2500);
        }
    }, []);

    return { shareNote, shareStatus };
}
