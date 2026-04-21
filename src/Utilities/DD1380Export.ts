// Utilities/DD1380Export.ts — Generate a filled DD Form 1380 (TCCC Card) PDF

import { logError } from './ErrorHandler';
export { downloadPdfBytes } from './downloadUtils';
import type { TC3Card } from '../Types/TC3Types';

// ── Layout constants (PDF points, origin = bottom-left) ──
// NOTE: These coordinates are starting estimates and will need visual calibration
// against the actual DD1380.pdf template. Adjust x/y values to align with each field box.
const COORDS = {
    // ── Page 1 header row ─────────────────────────────────────────────────────
    rosterNo:       { x: 50,  y: 740 },
    patientName:    { x: 150, y: 740 },
    last4:          { x: 400, y: 740 },
    unit:           { x: 450, y: 740 },
    service:        { x: 50,  y: 720 },
    sex:            { x: 200, y: 720 },
    bloodType:      { x: 260, y: 720 },
    dtgInjury:      { x: 320, y: 720 },
    dtgTreatment:   { x: 430, y: 720 },
    allergies:      { x: 50,  y: 700 },
    mechanism:      { x: 50,  y: 680 },
    // ── Hemorrhage ────────────────────────────────────────────────────────────
    tqStart:        { x: 50,  y: 640 },  // first tourniquet row; decrement y by lineHeight per row
    lineHeight:     14,
    // ── Airway / Respiration / Circulation ────────────────────────────────────
    airway:         { x: 50,  y: 580 },
    respiration:    { x: 50,  y: 560 },
    circulation:    { x: 50,  y: 540 },
    // ── Vitals ────────────────────────────────────────────────────────────────
    vitals:         { x: 300, y: 580 },
    // ── Medications ───────────────────────────────────────────────────────────
    medsStart:      { x: 300, y: 540 },
    // ── Page 1 footer / Page 2 fields ─────────────────────────────────────────
    evacPriority:   { x: 50,  y: 100 },
    other:          { x: 50,  y: 80  },
    firstResponder: { x: 300, y: 80  },
    notes:          { x: 50,  y: 60  },
    providerName:   { x: 300, y: 60  },
    // ── Font sizes ────────────────────────────────────────────────────────────
    fontSize:       { default: 8 },
} as const;

const MAX_LIST_ENTRIES = 6;

function fmtDateTime(iso: string): string {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short', hour12: false });
    } catch { return iso; }
}

export interface DD1380ExportParams {
    card: TC3Card;
    providerName?: string;
}

export async function generateDD1380Pdf(params: DD1380ExportParams): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

    const templateUrl = new URL('../Data/DD1380.pdf', import.meta.url).href;
    const templateBytes = await fetch(templateUrl).then(r => r.arrayBuffer());
    const pdfDoc = await PDFDocument.load(templateBytes);

    const pages = pdfDoc.getPages();
    const page1 = pages[0];
    const page2 = pages.length > 1 ? pages[1] : null;
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const black = rgb(0, 0, 0);
    const fs = COORDS.fontSize.default;
    const lh = COORDS.lineHeight;

    const draw = (page: typeof page1, text: string, x: number, y: number, maxWidth?: number) => {
        if (!text) return;
        try {
            page.drawText(text, { x, y, size: fs, font, color: black, ...(maxWidth ? { maxWidth } : {}) });
        } catch (e) {
            logError('DD1380Export.draw', e);
        }
    };

    const { card } = params;
    const c = card.casualty;

    // ── Header ────────────────────────────────────────────────────────────────
    draw(page1, c.battleRosterNo, COORDS.rosterNo.x, COORDS.rosterNo.y);
    const fullName = [c.lastName, c.firstName].filter(Boolean).join(', ');
    draw(page1, fullName, COORDS.patientName.x, COORDS.patientName.y);
    draw(page1, c.last4, COORDS.last4.x, COORDS.last4.y);
    draw(page1, c.unit, COORDS.unit.x, COORDS.unit.y);
    draw(page1, c.service, COORDS.service.x, COORDS.service.y);
    draw(page1, c.sex, COORDS.sex.x, COORDS.sex.y);
    draw(page1, c.bloodType, COORDS.bloodType.x, COORDS.bloodType.y);
    draw(page1, fmtDateTime(c.dateTimeOfInjury), COORDS.dtgInjury.x, COORDS.dtgInjury.y);
    draw(page1, fmtDateTime(c.dateTimeOfTreatment), COORDS.dtgTreatment.x, COORDS.dtgTreatment.y);
    draw(page1, c.allergies, COORDS.allergies.x, COORDS.allergies.y);

    // ── Mechanism ─────────────────────────────────────────────────────────────
    const m = card.mechanism;
    let mechText = m.types.join(', ');
    if (m.types.includes('Other') && m.otherDescription) mechText += ` (${m.otherDescription})`;
    draw(page1, mechText, COORDS.mechanism.x, COORDS.mechanism.y);

    // ── Tourniquets ───────────────────────────────────────────────────────────
    const tqs = card.march.massiveHemorrhage.tourniquets;
    const tqDisplay = tqs.slice(0, MAX_LIST_ENTRIES);
    tqDisplay.forEach((tq, i) => {
        const text = `TQ: ${tq.time || '--'} ${tq.location} (${tq.type})`;
        draw(page1, text, COORDS.tqStart.x, COORDS.tqStart.y - i * lh);
    });
    if (tqs.length > MAX_LIST_ENTRIES) {
        const overflow = tqs.length - MAX_LIST_ENTRIES;
        draw(page1, `+${overflow} more`, COORDS.tqStart.x, COORDS.tqStart.y - MAX_LIST_ENTRIES * lh);
    }

    // ── Airway ────────────────────────────────────────────────────────────────
    const aw = card.march.airway;
    const awItems: string[] = [];
    if (aw.intact) awItems.push('Intact');
    if (aw.npa) awItems.push('NPA');
    if (aw.cric) awItems.push('CRIC');
    if (aw.ett) awItems.push('ET-Tube');
    if (aw.supraglottic) awItems.push('SGA');
    if (aw.chinLift) awItems.push('Chin Lift');
    if (aw.airwayType) awItems.push(aw.airwayType);
    draw(page1, awItems.join(', '), COORDS.airway.x, COORDS.airway.y);

    // ── Respiration ───────────────────────────────────────────────────────────
    const resp = card.march.respiration;
    const respItems: string[] = [];
    if (resp.needleDecomp.performed) respItems.push(`Needle-D (${resp.needleDecomp.side})`);
    if (resp.chestSeal.applied) respItems.push(`Chest-Seal (${resp.chestSeal.side})`);
    if (resp.chestTube) respItems.push('Chest-Tube');
    if (resp.o2) respItems.push(`O2 via ${resp.o2Method || '?'}`);
    draw(page1, respItems.join(', '), COORDS.respiration.x, COORDS.respiration.y);

    // ── Circulation / IV Access ───────────────────────────────────────────────
    const ivs = card.march.circulation.ivAccess;
    const ivDisplay = ivs.slice(0, MAX_LIST_ENTRIES);
    const ivText = ivDisplay.map(iv => `${iv.type} ${iv.site} ${iv.gauge} ${iv.time}`).join('  |  ');
    if (ivs.length > MAX_LIST_ENTRIES) {
        draw(page1, `${ivText}  +${ivs.length - MAX_LIST_ENTRIES} more`, COORDS.circulation.x, COORDS.circulation.y);
    } else {
        draw(page1, ivText, COORDS.circulation.x, COORDS.circulation.y);
    }

    // ── Vitals (first set) ────────────────────────────────────────────────────
    const vs = card.vitals[0];
    if (vs) {
        const vitalsText = [
            vs.pulse ? `HR: ${vs.pulse}` : '',
            vs.rr ? `RR: ${vs.rr}` : '',
            vs.bp ? `BP: ${vs.bp}` : '',
            vs.spo2 ? `SpO2: ${vs.spo2}` : '',
            vs.avpu ? `AVPU: ${vs.avpu}` : '',
        ].filter(Boolean).join('  ');
        draw(page1, vitalsText, COORDS.vitals.x, COORDS.vitals.y);
    }

    // ── Medications ───────────────────────────────────────────────────────────
    const meds = card.medications;
    const medsDisplay = meds.slice(0, MAX_LIST_ENTRIES);
    medsDisplay.forEach((med, i) => {
        const text = `${med.name} ${med.dose} ${med.route} ${med.time}`.trim();
        draw(page1, text, COORDS.medsStart.x, COORDS.medsStart.y - i * lh);
    });
    if (meds.length > MAX_LIST_ENTRIES) {
        const overflow = meds.length - MAX_LIST_ENTRIES;
        draw(page1, `+${overflow} more`, COORDS.medsStart.x, COORDS.medsStart.y - MAX_LIST_ENTRIES * lh);
    }

    // ── Evac Priority ─────────────────────────────────────────────────────────
    const targetPage = page2 ?? page1;
    draw(targetPage, card.evacuation.priority, COORDS.evacPriority.x, COORDS.evacPriority.y);

    // ── Other interventions ───────────────────────────────────────────────────
    const o = card.other;
    const otherItems: string[] = [];
    if (o.combatPillPack) otherItems.push('[X] Combat Pill Pack');
    if (o.eyeShield.applied) otherItems.push(`[X] Eye Shield (${o.eyeShield.side || 'N/A'})`);
    if (o.splint) otherItems.push('[X] Splint');
    if (o.hypothermiaPrevention.applied) otherItems.push(`[X] Hypothermia: ${o.hypothermiaPrevention.type || 'Yes'}`);
    draw(targetPage, otherItems.join('  '), COORDS.other.x, COORDS.other.y);

    // ── First Responder ───────────────────────────────────────────────────────
    const fr = card.firstResponder;
    const frName = [fr.lastName, fr.firstName].filter(Boolean).join(', ');
    const frText = frName ? (fr.last4 ? `${frName} (${fr.last4})` : frName) : '';
    draw(targetPage, frText, COORDS.firstResponder.x, COORDS.firstResponder.y);

    // ── Notes ─────────────────────────────────────────────────────────────────
    draw(targetPage, card.notes.trim(), COORDS.notes.x, COORDS.notes.y, 250);

    // ── Provider ──────────────────────────────────────────────────────────────
    if (params.providerName) {
        draw(targetPage, params.providerName, COORDS.providerName.x, COORDS.providerName.y);
    }

    return pdfDoc.save();
}
