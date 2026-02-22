// Hooks/useNoteShare.ts — Share a saved note as a Data Matrix barcode image
import { useCallback, useState } from 'react';
import bwipjs from 'bwip-js';
import type { SavedNote } from './useNotesStorage';
import { createLogger } from '../Utilities/Logger';
import { UI_TIMING } from '../Utilities/constants';

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
 * Generates a shareable image containing only the Data Matrix barcode
 * on a white background. Keeping the image barcode-only ensures it can
 * be reliably decoded by ZXing when re-imported via paste or upload.
 * Metadata (disposition, date) is sent as plain text alongside the image.
 */
function generateShareCanvas(note: SavedNote): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    try {
        bwipjs.toCanvas(canvas, {
            bcid: 'datamatrix',
            text: note.encodedText,
            scale: 6,
            padding: 6,
            backgroundcolor: 'ffffff',
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
function buildShareText(note: SavedNote): string {
    const parts: string[] = [];
    if (note.symptomText) parts.push(note.symptomText);
    if (note.dispositionType) {
        parts.push(note.dispositionType + (note.dispositionText ? ` — ${note.dispositionText}` : ''));
    }
    try {
        parts.push(formatMilitaryDate(new Date(note.createdAt)));
    } catch { /* ignore */ }
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

    const shareNote = useCallback(async (note: SavedNote, isMobile: boolean) => {
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
