// Utilities/DD689Export.ts — Generate a filled DD Form 689 PDF with Data Matrix barcode

import { renderBarcodeToCanvas } from './NoteCodec';
import { logError } from './ErrorHandler';
import { base64ToBytes } from '../lib/base64Utils';
import { toWinAnsi, wrapText } from './pdfText';
import type { PatientIdentification } from './SF600Export';
export { downloadPdfBytes } from './downloadUtils';

// ── Layout constants (PDF points, origin = bottom-left) ──
// Adjust these to calibrate placement on the DD689 template.
// Template boxes: 2. DATE x360–576 y701–737 · 3. NAME x36–360 y665–701 ·
// 4. DoD ID x36–198 y629–665 · 5. GRADE x198–360 y629–665 ·
// 12. REMARKS x306–576 y383–527 · 13. SIGNATURE x306–576 y340–383.
const COORDS = {
    // encoded note in provider comments
    barcode: { x: 306, y: 425, size: 90 },
    // Note author — centered below barcode
    authorLine: { x: 310, y: 390 },
    // Right-of-barcode column inside the remarks box: disposition, then profile
    remarksColumn: { x: 401, topY: 495, maxWidth: 170, floorY: 402 },
    // Clinic name
    clinicName: { x: 370, y: 675, maxWidth: 270 },
    // Algorithm title (e.g. "A-1 Sore Throat")
    algorithmTitle: { x: 50, y: 710 },
    // Block 2 — export date (YYYYMMDD)
    date: { x: 374, y: 710 },
    // Blocks 3–5 — patient identification
    patientName: { x: 50, y: 674 },
    dodid: { x: 50, y: 638 },
    rankGrade: { x: 212, y: 638 },
    // Block 13 — drawn medic signature, fit inside this box
    signature: { x: 312, y: 342, maxWidth: 150, maxHeight: 26 },
    // Font sizes
    fontSize: { disposition: 10, profile: 9, clinicName: 10, authorLine: 10, algorithmTitle: 10, patient: 10, date: 10 },
    lineHeight: { disposition: 11, profile: 10 },
} as const

/** DD689-only inputs collected alongside the patient block. Ephemeral — never persisted. */
export interface DD689Extras {
    /** Profile / duty limitations for the medical officer's remarks (block 12). */
    profile: string;
    /** Drawn medic signature (transparent PNG data URL) for block 13. */
    signatureImage?: string;
}

export interface DD689ExportParams extends Partial<DD689Extras> {
    encodedValue: string;
    dispositionType: string;
    dispositionText: string;
    symptomText: string;
    clinicName?: string;
    authorLine?: string; // e.g. "Conner, Christopher, D, PA-C, CPT"
    patient?: PatientIdentification;
}

function yyyymmdd(d: Date): string {
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Generate a Data Matrix barcode as PNG bytes using bwip-js.
 */
function generateBarcodePng(data: string): Uint8Array {
    const canvas = document.createElement('canvas');
    renderBarcodeToCanvas(canvas, data, { scale: 4, padding: 2 });

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    return base64ToBytes(base64);
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
        page.drawText(toWinAnsi(params.authorLine, fontBold), {
            x: COORDS.authorLine.x,
            y: COORDS.authorLine.y,
            size: COORDS.fontSize.authorLine,
            font: fontBold,
            color: gray,
        });
    }

    // ── Draw disposition + profile (right of barcode, remarks box) ──
    // Disposition first, profile wraps beneath it; anything past the floor is
    // truncated with an ellipsis so it never spills into the signature block.
    const dispText = params.dispositionType
        ? `${params.dispositionType}${params.dispositionText ? ' — ' + params.dispositionText : ''}`
        : '';
    const col = COORDS.remarksColumn;
    let colY = col.topY;
    const drawColumn = (text: string, size: number, lineHeight: number) => {
        const lines = wrapText(toWinAnsi(text, fontBold), fontBold, size, col.maxWidth);
        for (let i = 0; i < lines.length; i++) {
            if (colY < col.floorY) return;
            const last = colY - lineHeight < col.floorY && i < lines.length - 1;
            page.drawText(last ? `${lines[i]}…` : lines[i], {
                x: col.x, y: colY, size, font: fontBold, color: gray,
            });
            colY -= lineHeight;
        }
    };
    if (dispText) drawColumn(dispText, COORDS.fontSize.disposition, COORDS.lineHeight.disposition);
    const profile = params.profile?.trim();
    if (profile) {
        if (dispText) colY -= COORDS.lineHeight.profile / 2;
        drawColumn(profile, COORDS.fontSize.profile, COORDS.lineHeight.profile);
    }

    // ── Draw clinic name ──
    if (params.clinicName) {
        page.drawText(toWinAnsi(params.clinicName, fontBold), {
            x: COORDS.clinicName.x,
            y: COORDS.clinicName.y,
            size: COORDS.fontSize.clinicName,
            font: fontBold,
            color: gray,
        });
    }

    // ── Draw algorithm title (left of date) ──
    if (params.symptomText) {
        page.drawText(toWinAnsi(params.symptomText, fontBold), {
            x: COORDS.algorithmTitle.x,
            y: COORDS.algorithmTitle.y,
            size: COORDS.fontSize.algorithmTitle,
            font: fontBold,
            color: gray,
        });
    }

    // ── Draw date (block 2) ──
    page.drawText(yyyymmdd(new Date()), {
        x: COORDS.date.x,
        y: COORDS.date.y,
        size: COORDS.fontSize.date,
        font: fontBold,
        color: gray,
    });

    // ── Draw patient identification (blocks 3–5) ──
    if (params.patient) {
        const pt = params.patient;
        const nameLine = [pt.lastName, [pt.firstName, pt.middleInitial].filter(Boolean).join(' ')]
            .filter(Boolean).join(', ');
        const fields: [string, { x: number; y: number }][] = [
            [nameLine, COORDS.patientName],
            [pt.dodid, COORDS.dodid],
            [pt.rankGrade, COORDS.rankGrade],
        ];
        for (const [text, at] of fields) {
            if (!text) continue;
            page.drawText(toWinAnsi(text, fontBold), {
                x: at.x,
                y: at.y,
                size: COORDS.fontSize.patient,
                font: fontBold,
                color: gray,
            });
        }
    }

    // ── Draw medic signature (block 13) ──
    if (params.signatureImage) {
        try {
            const sigImage = await pdfDoc.embedPng(params.signatureImage);
            const { width, height } = sigImage.scaleToFit(COORDS.signature.maxWidth, COORDS.signature.maxHeight);
            page.drawImage(sigImage, { x: COORDS.signature.x, y: COORDS.signature.y, width, height });
        } catch (e) {
            logError('DD689Export.signature', e);
        }
    }

    return pdfDoc.save();
}

