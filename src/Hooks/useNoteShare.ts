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
 * Theme-aware color palettes for the share image.
 * Maps to the app's CSS custom properties from App.css.
 */
const SHARE_COLORS = {
    light: {
        background: '#f0f2f5',      // themewhite2
        cardBg: '#fffbfb',          // themewhite
        cardBorder: '#e2e8f0',
        title: '#1e1e23',           // primary
        symptom: '#464650',         // secondary
        date: '#848b92',            // tertiary
        encodedBlockBg: '#f0f2f5',  // themewhite2
        encodedText: '#464650',     // secondary
        footer: '#c4bebe',          // themegray1
        barcodeBg: '#ffffff',
    },
    dark: {
        background: '#192d3d',      // themewhite2
        cardBg: '#0f1923',          // themewhite
        cardBorder: '#374b5b',      // themegray1
        title: '#cbd1d6',           // primary
        symptom: '#b3bac9',         // secondary
        date: '#848b92',            // tertiary
        encodedBlockBg: '#141e28',  // themewhite3
        encodedText: '#b3bac9',     // secondary
        footer: '#374b5b',          // themegray1
        barcodeBg: '#ffffff',       // barcode always white for scannability
    },
} as const;

/**
 * Generates a shareable image canvas containing the PDF417 barcode,
 * note metadata, and encoded string. Renders at 2x resolution for
 * sharp output on high-DPI screens and respects the current theme.
 */
function generateShareCanvas(note: SavedNote): HTMLCanvasElement {
    // Detect current theme from DOM
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const colors = isDark ? SHARE_COLORS.dark : SHARE_COLORS.light;

    // 2x scale for sharp output on high-DPI displays
    const scale = 2;

    // ── 1. Generate barcode on a temporary canvas ──
    const barcodeCanvas = document.createElement('canvas');
    barcodeCanvas.width = 300;
    barcodeCanvas.height = 120;
    const bCtx = barcodeCanvas.getContext('2d');
    if (bCtx) {
        bCtx.fillStyle = colors.barcodeBg;
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

    const barcodePad = 8;
    const barcodeContainerH = barcodeDisplayH + barcodePad * 2;

    const canvasH =
        pad +                // top padding
        lineH +              // "ADTMC Note" title
        12 +                 // gap
        lineH +              // symptom text
        lineH +              // disposition line
        lineH +              // date line
        16 +                 // gap before barcode
        barcodeContainerH +  // barcode container (barcode + padding)
        12 +                 // gap
        encodedBlockH +      // encoded string block
        16 +                 // gap
        lineH +              // footer
        pad;                 // bottom padding

    const canvas = document.createElement('canvas');
    // Render at 2x resolution for sharp text and barcode on Retina/HiDPI
    canvas.width = canvasW * scale;
    canvas.height = canvasH * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Content area with rounded card
    const cardX = 16;
    const cardY = 16;
    const cardW = canvasW - 32;
    const cardH = canvasH - 32;
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = colors.cardBorder;
    ctx.lineWidth = 1;
    roundRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.stroke();

    let y = pad + 8;

    // ── Title ──
    ctx.fillStyle = colors.title;
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ADTMC Note', canvasW / 2, y);
    y += lineH + 8;

    // ── Symptom icon + text ──
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = colors.symptom;
    const symptomLabel = `${note.symptomIcon || '📋'} ${note.symptomText || 'Note'}`;
    ctx.fillText(symptomLabel, canvasW / 2, y);
    y += lineH;

    // ── Disposition badge ──
    if (note.dispositionType) {
        // Disposition colors are semantic — same for both themes
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
    ctx.fillStyle = colors.date;
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

    // ── PDF417 Barcode (white container with border, matching in-app style) ──
    const barcodeContainerW = barcodeDisplayW + barcodePad * 2;
    const barcodeContainerX = (canvasW - barcodeContainerW) / 2;

    // White background
    ctx.fillStyle = colors.barcodeBg;
    roundRect(ctx, barcodeContainerX, y, barcodeContainerW, barcodeContainerH, 6);
    ctx.fill();
    // Subtle border
    ctx.strokeStyle = isDark ? '#4b5563' : '#d1d5db'; // gray-600 / gray-300
    ctx.lineWidth = 1;
    roundRect(ctx, barcodeContainerX, y, barcodeContainerW, barcodeContainerH, 6);
    ctx.stroke();

    // Draw barcode inside the container
    const barcodeX = barcodeContainerX + barcodePad;
    ctx.drawImage(barcodeCanvas, barcodeX, y + barcodePad, barcodeDisplayW, barcodeDisplayH);
    y += barcodeContainerH + 8;

    // Label under barcode
    ctx.fillStyle = colors.date;
    ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('PDF417 Barcode', canvasW / 2, y);
    y += 16;

    // ── Encoded string block ──
    ctx.fillStyle = colors.encodedBlockBg;
    roundRect(ctx, pad, y, contentW, encodedBlockH, 6);
    ctx.fill();

    ctx.fillStyle = colors.encodedText;
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
    ctx.fillStyle = colors.footer;
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
