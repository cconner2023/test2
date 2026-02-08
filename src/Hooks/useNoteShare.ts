// Hooks/useNoteShare.ts — Share a saved note as a PDF417 barcode image
import { useCallback, useState } from 'react';
import PDF417 from 'pdf417-generator';
import type { SavedNote } from './useNotesStorage';

type ShareStatus = 'idle' | 'generating' | 'sharing' | 'shared' | 'copied' | 'error';

/**
 * Draws rounded-corner rectangles on canvas.
 */
function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/**
 * Generates a shareable image canvas containing the PDF417 barcode,
 * note metadata, and encoded string.
 */
function generateShareCanvas(note: SavedNote): HTMLCanvasElement {
    // ── 1. Generate barcode on a temporary canvas ──
    const barcodeCanvas = document.createElement('canvas');
    barcodeCanvas.width = 300;
    barcodeCanvas.height = 120;
    const bCtx = barcodeCanvas.getContext('2d');
    if (bCtx) {
        bCtx.fillStyle = '#ffffff';
        bCtx.fillRect(0, 0, 300, 120);
    }

    // Use the same rendering approach as Barcode.tsx
    if (PDF417 && typeof (PDF417 as any).draw === 'function') {
        (PDF417 as any).draw(note.encodedText, barcodeCanvas);
    } else {
        PDF417(barcodeCanvas, note.encodedText, {
            bw: 2,
            height: 4,
            padding: 10,
        });
    }

    // ── 2. Compose the share image ──
    const pad = 32;
    const canvasW = 440;
    const contentW = canvasW - pad * 2;

    // Layout: title → symptom line → date → barcode → encoded string → footer
    const lineH = 22;
    const barcodeDisplayW = Math.min(contentW, 340);
    const barcodeDisplayH = Math.round(
        (barcodeDisplayW / barcodeCanvas.width) * barcodeCanvas.height
    );

    // Measure encoded text block height (word-wrap)
    const encodedFontSize = 10;
    const charsPerLine = Math.floor(contentW / (encodedFontSize * 0.6));
    const encodedLines = Math.ceil(note.encodedText.length / charsPerLine);
    const encodedBlockH = encodedLines * (encodedFontSize + 4) + 16; // padding

    const canvasH =
        pad +            // top padding
        lineH +          // "ADTMC Note" title
        12 +             // gap
        lineH +          // symptom text
        lineH +          // disposition line
        lineH +          // date line
        16 +             // gap before barcode
        barcodeDisplayH +// barcode
        12 +             // gap
        encodedBlockH +  // encoded string block
        16 +             // gap
        lineH +          // footer
        pad;             // bottom padding

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Content area with white rounded card
    const cardX = 16;
    const cardY = 16;
    const cardW = canvasW - 32;
    const cardH = canvasH - 32;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    roundRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.stroke();

    let y = pad + 8;

    // ── Title ──
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ADTMC Note', canvasW / 2, y);
    y += lineH + 8;

    // ── Symptom icon + text ──
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = '#334155';
    const symptomLabel = `${note.symptomIcon || '📋'} ${note.symptomText || 'Note'}`;
    ctx.fillText(symptomLabel, canvasW / 2, y);
    y += lineH;

    // ── Disposition badge ──
    if (note.dispositionType) {
        // Disposition color
        let badgeColor = '#6b7280';
        const dt = note.dispositionType.toUpperCase();
        if (dt.includes('I') && !dt.includes('II') && !dt.includes('III') && !dt.includes('IV')) badgeColor = '#dc2626';
        else if (dt.includes('II') && !dt.includes('III') && !dt.includes('IV')) badgeColor = '#f59e0b';
        else if (dt.includes('III')) badgeColor = '#22c55e';
        else if (dt.includes('IV')) badgeColor = '#3b82f6';

        const dispText = note.dispositionType + (note.dispositionText ? ` — ${note.dispositionText}` : '');
        ctx.fillStyle = badgeColor;
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(dispText, canvasW / 2, y);
        y += lineH;
    }

    // ── Date ──
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    try {
        const date = new Date(note.createdAt);
        const day = date.getDate().toString().padStart(2, '0');
        const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const year = date.getFullYear().toString().slice(2);
        const time = date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
        });
        ctx.fillText(`${day}${month}${year} ${time}`, canvasW / 2, y);
    } catch {
        ctx.fillText(note.createdAt, canvasW / 2, y);
    }
    y += lineH + 12;

    // ── PDF417 Barcode ──
    const barcodeX = (canvasW - barcodeDisplayW) / 2;
    ctx.drawImage(barcodeCanvas, barcodeX, y, barcodeDisplayW, barcodeDisplayH);
    y += barcodeDisplayH + 8;

    // Label under barcode
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('PDF417 Barcode', canvasW / 2, y);
    y += 16;

    // ── Encoded string block ──
    ctx.fillStyle = '#f1f5f9';
    roundRect(ctx, pad, y, contentW, encodedBlockH, 6);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.font = `${encodedFontSize}px "Courier New", monospace`;
    ctx.textAlign = 'left';
    const encodedText = note.encodedText;
    let textY = y + 12;
    for (let i = 0; i < encodedText.length; i += charsPerLine) {
        const line = encodedText.slice(i, i + charsPerLine);
        ctx.fillText(line, pad + 8, textY);
        textY += encodedFontSize + 4;
    }
    y += encodedBlockH + 12;

    // ── Footer ──
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('ADTMC • MEDCOM PAM 40-7-21', canvasW / 2, y);

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
 * Hook: share or copy a saved note as a PDF417 barcode image.
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
            console.error('Share failed:', err);
            setShareStatus('error');
            setTimeout(() => setShareStatus('idle'), 2500);
        }
    }, []);

    return { shareNote, shareStatus };
}
