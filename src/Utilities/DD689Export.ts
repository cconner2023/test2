// Utilities/DD689Export.ts — Generate a filled DD Form 689 PDF with Data Matrix barcode

import bwipjs from 'bwip-js';
import { logError } from './ErrorHandler';

// ── Layout constants (PDF points, origin = bottom-left) ──
// Adjust these to calibrate placement on the DD689 template.
const COORDS = {
    // encoded note in provider comments
    barcode: { x: 306, y: 425, size: 90 },
    // Note author — centered below barcode
    authorLine: { x: 310, y: 390 },
    // Disposition text — right of barcode, inside comments box
    disposition: { x: 401, y: 495, maxWidth: 270 },
    // Clinic name
    clinicName: { x: 370, y: 675, maxWidth: 270 },
    // Algorithm title (e.g. "A-1 Sore Throat") — left of date
    algorithmTitle: { x: 50, y: 710 },
    // Note date (YYYYMMDD)
    noteDate: { x: 370, y: 710 },
    // Font sizes
    fontSize: { disposition: 10, clinicName: 10, noteDate: 10, authorLine: 10, algorithmTitle: 10 },
} as const;

export interface DD689ExportParams {
    encodedValue: string;
    dispositionType: string;
    dispositionText: string;
    symptomText: string;
    clinicName?: string;
    noteDate?: string;  // YYYYMMDD format
    authorLine?: string; // e.g. "Conner, Christopher, D, PA-C, CPT"
}

/**
 * Generate a Data Matrix barcode as PNG bytes using bwip-js.
 */
function generateBarcodePng(text: string): Uint8Array {
    const canvas = document.createElement('canvas');
    bwipjs.toCanvas(canvas, {
        bcid: 'datamatrix',
        text,
        scale: 4,
        padding: 2,
    });

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/**
 * Generate a filled DD Form 689 PDF with barcode + disposition overlay.
 * Lazy-loads pdf-lib on first call.
 */
export async function generateDD689Pdf(params: DD689ExportParams): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

    // Fetch the template PDF
    const templateUrl = new URL('../Data/DD689TEMP.pdf', import.meta.url).href;
    const templateBytes = await fetch(templateUrl).then(r => r.arrayBuffer());
    const pdfDoc = await PDFDocument.load(templateBytes);

    const page = pdfDoc.getPages()[0];
    const fontBold = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const gray = rgb(0.502, 0.522, 0.533);

    // ── Draw barcode ──
    if (params.encodedValue) {
        try {
            const pngBytes = generateBarcodePng(params.encodedValue);
            const barcodeImage = await pdfDoc.embedPng(pngBytes);
            page.drawImage(barcodeImage, {
                x: COORDS.barcode.x,
                y: COORDS.barcode.y,
                width: COORDS.barcode.size,
                height: COORDS.barcode.size,
            });
        } catch (e) {
            logError('DD689Export.barcode', e);
        }
    }

    // ── Draw author line below barcode ──
    if (params.authorLine) {
        page.drawText(params.authorLine, {
            x: COORDS.authorLine.x,
            y: COORDS.authorLine.y,
            size: COORDS.fontSize.authorLine,
            font: fontBold,
            color: gray,
        });
    }

    // ── Draw disposition text ──
    const dispText = params.dispositionType
        ? `${params.dispositionType}${params.dispositionText ? ' — ' + params.dispositionText : ''}`
        : '';

    if (dispText) {
        page.drawText(dispText, {
            x: COORDS.disposition.x,
            y: COORDS.disposition.y,
            size: COORDS.fontSize.disposition,
            font: fontBold,
            color: gray,
            maxWidth: COORDS.disposition.maxWidth,
        });
    }

    // ── Draw clinic name ──
    if (params.clinicName) {
        page.drawText(params.clinicName, {
            x: COORDS.clinicName.x,
            y: COORDS.clinicName.y,
            size: COORDS.fontSize.clinicName,
            font: fontBold,
            color: gray,
        });
    }

    // ── Draw algorithm title (left of date) ──
    if (params.symptomText) {
        page.drawText(params.symptomText, {
            x: COORDS.algorithmTitle.x,
            y: COORDS.algorithmTitle.y,
            size: COORDS.fontSize.algorithmTitle,
            font: fontBold,
            color: gray,
        });
    }

    // ── Draw note date (YYYYMMDD) ──
    if (params.noteDate) {
        page.drawText(params.noteDate, {
            x: COORDS.noteDate.x,
            y: COORDS.noteDate.y,
            size: COORDS.fontSize.noteDate,
            font: fontBold,
            color: gray,
        });
    }

    return pdfDoc.save();
}

/**
 * Trigger a browser download from raw PDF bytes.
 */
export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
