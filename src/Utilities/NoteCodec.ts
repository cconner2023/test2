// Utilities/NoteCodec.ts
// Shared encoding, decoding, and reconstruction logic for note barcodes.
// Centralises the pipe-delimited barcode format so every consumer
// (useNoteRestore, useNoteImport, useNoteCapture, Barcode.tsx) uses one source.

import { deflateRaw, inflateRaw } from 'pako';
import { Algorithm } from '../Data/Algorithms';
import { catData } from '../Data/CatData';
import {
    getCategoryFromSymptomCode,
    getPECategory,
    getGeneralFindings,
    getMSKBodyPart,
    VITAL_SIGNS,
} from '../Data/PhysicalExamData';
import type { CategoryLetter, AbnormalOption } from '../Data/PhysicalExamData';
import { ranks, credentials, components } from '../Data/User';
import type { UserTypes } from '../Data/User';
import type { AlgorithmOptions, dispositionType } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import type { catDataTypes, subCatDataTypes } from '../Types/CatTypes';

// ---------------------------------------------------------------------------
// Text compression (zlib deflateRaw + base64)
// ---------------------------------------------------------------------------
// Replaces the old btoa(encodeURIComponent(text)) pipeline which expanded
// text ~1.78x. DeflateRaw + base64 compresses to ~0.78x of raw.
// Compressed values are prefixed with "!" to distinguish from legacy base64.
// Base64 never contains "!" so detection is unambiguous.

function uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/** Compress text for barcode encoding. Uses deflateRaw when it saves space. */
function compressText(text: string): string {
    try {
        const deflated = deflateRaw(new TextEncoder().encode(text));
        const compressed = '!' + uint8ToBase64(deflated);
        const legacy = btoa(encodeURIComponent(text));
        return compressed.length < legacy.length ? compressed : legacy;
    } catch {
        return btoa(encodeURIComponent(text));
    }
}

/** Decompress text — handles both !{compressed} and legacy base64 formats. */
function decompressText(encoded: string): string {
    if (encoded.startsWith('!')) {
        try {
            const inflated = inflateRaw(base64ToUint8(encoded.substring(1)));
            return new TextDecoder().decode(inflated);
        } catch { /* fall through to legacy */ }
    }
    try {
        return decodeURIComponent(atob(encoded));
    } catch {
        try { return atob(encoded); }
        catch { return decodeURIComponent(encoded); }
    }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScreenerEntry {
    id: string;
    responses: number[];
    followUp?: number;
}

export interface ParsedNote {
    symptomCode: string;
    rfSelections: number[];
    cardEntries: { index: number; selections: number[]; answerIndex: number }[];
    screenerEntries: ScreenerEntry[];
    actionEntries: { index: number; status: 'performed' | 'deferred' }[];
    hpiText: string;
    peText: string;
    flags: { includeAlgorithm: boolean; includeDecisionMaking: boolean; includeHPI: boolean; includePhysicalExam: boolean };
    timestamp: Date | null;
    user: UserTypes | null;
}

export interface NoteEncodeOptions {
    includeAlgorithm: boolean;
    includeDecisionMaking: boolean;
    customNote: string;
    physicalExamNote?: string;
    user?: UserTypes;
}

// ---------------------------------------------------------------------------
// Bitmask helpers
// ---------------------------------------------------------------------------

export function bitmaskToIndices(bitmask: number): number[] {
    const indices: number[] = [];
    for (let i = 0; i < 32; i++) {
        if ((bitmask >> i) & 1) {
            indices.push(i);
        }
    }
    return indices;
}

export function indicesToBitmask(indices: number[]): number {
    let bitmask = 0;
    for (const i of indices) {
        bitmask |= (1 << i);
    }
    return bitmask;
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function findAlgorithmByCode(code: string): AlgorithmOptions[] | null {
    const algorithmId = code.replace(/([A-Z])(\d+)/, '$1-$2');
    const algorithm = Algorithm.find(item => item.id === algorithmId);
    return algorithm?.options || null;
}

export function findSymptomByCode(code: string): { category: catDataTypes; symptom: subCatDataTypes } | null {
    const iconId = code.replace(/([A-Z])(\d+)/, '$1-$2');
    for (const category of catData) {
        if (category.contents) {
            const symptom = category.contents.find(s => s.icon === iconId);
            if (symptom) {
                return { category, symptom };
            }
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Decoding (barcode string → ParsedNote)
// ---------------------------------------------------------------------------

export function parseNoteEncoding(encodedText: string): ParsedNote | null {
    if (!encodedText.trim()) return null;

    const parts = encodedText.split('|');
    const result: ParsedNote = {
        symptomCode: '',
        rfSelections: [],
        cardEntries: [],
        screenerEntries: [],
        actionEntries: [],
        hpiText: '',
        peText: '',
        flags: { includeAlgorithm: true, includeDecisionMaking: true, includeHPI: false, includePhysicalExam: false },
        timestamp: null,
        user: null,
    };

    let legacyLastCard = -1;
    let legacySelections: number[] = [];

    const nonEmptyParts = parts.filter(p => p.length > 0);
    if (nonEmptyParts.length > 0) {
        result.symptomCode = nonEmptyParts[0];
    }

    for (let partIdx = 1; partIdx < nonEmptyParts.length; partIdx++) {
        const part = nonEmptyParts[partIdx];
        const prefix = part[0];
        const value = part.substring(1);

        if (prefix === 'R') {
            const bitmask = parseInt(value || '0', 36);
            result.rfSelections = bitmaskToIndices(bitmask);
        } else if (prefix === 'H') {
            result.hpiText = decompressText(value);
        } else if (prefix === 'P') {
            if (value.startsWith('2:')) {
                // Compact PE format v2 — reconstruct text from structural encoding
                result.peText = decodePECompact(value, result.symptomCode);
            } else {
                // Compressed or legacy base64 text format
                result.peText = decompressText(value);
            }
        } else if (prefix === 'F') {
            const flagsNum = parseInt(value, 10);
            result.flags = {
                includeAlgorithm: !!(flagsNum & 1),
                includeDecisionMaking: !!(flagsNum & 2),
                includeHPI: !!(flagsNum & 4),
                includePhysicalExam: !!(flagsNum & 8),
            };
        } else if (prefix === 'T') {
            const epoch = parseInt(value, 36);
            if (!isNaN(epoch)) {
                result.timestamp = new Date(epoch * 1000);
            }
        } else if (prefix === 'U') {
            // User segment: rankIdx.credIdx.compIdx.base64(first|last|middle)
            const segs = value.split('.');
            if (segs.length >= 4) {
                const ri = parseInt(segs[0], 10);
                const ci = parseInt(segs[1], 10);
                const coi = parseInt(segs[2], 10);
                let names: string[] = [];
                try {
                    names = decodeURIComponent(atob(segs.slice(3).join('.'))).split('|');
                } catch { /* ignore decode errors */ }
                result.user = {
                    firstName: names[0] || undefined,
                    lastName: names[1] || undefined,
                    middleInitial: names[2] || undefined,
                    rank: ri >= 0 ? ranks[ri] : undefined,
                    credential: ci >= 0 ? credentials[ci] : undefined,
                    component: coi >= 0 ? components[coi] : undefined,
                    uic: names[3] || undefined,
                };
            }
        } else if (prefix === 'A') {
            // Action status segment: A{cardIndex}.{P|D}
            const aSegs = value.split('.');
            if (aSegs.length >= 2) {
                const idx = parseInt(aSegs[0], 10);
                const status = aSegs[1] === 'D' ? 'deferred' : 'performed';
                result.actionEntries.push({ index: idx, status });
            }
        } else if (prefix === 'Q') {
            // Screener segment: Q{id}.{responseDigits}[.{followUpIdx}]
            const qSegs = value.split('.');
            if (qSegs.length >= 2) {
                const id = qSegs[0];
                const responseStr = qSegs[1];
                const responses = responseStr.includes('-')
                    ? responseStr.split('-').map(s => parseInt(s, 36))
                    : responseStr.split('').map(d => parseInt(d, 10));
                const followUp = qSegs.length >= 3 ? parseInt(qSegs[2], 10) : undefined;
                result.screenerEntries.push({ id, responses, followUp: isNaN(followUp as number) ? undefined : followUp });
            }
        } else if (prefix === 'L') {
            legacyLastCard = parseInt(value, 10);
        } else if (prefix === 'S') {
            legacySelections = value === '0' ? [] : value.split('').map(n => parseInt(n, 10));
        } else if (/^\d/.test(part)) {
            const segments = part.split('.');
            if (segments.length >= 3) {
                result.cardEntries.push({
                    index: parseInt(segments[0], 10),
                    selections: bitmaskToIndices(parseInt(segments[1], 36)),
                    answerIndex: parseInt(segments[2], 10),
                });
            }
        }
    }

    // Legacy format fallback
    if (result.cardEntries.length === 0 && legacyLastCard > 0) {
        result.cardEntries = [{
            index: legacyLastCard,
            selections: legacySelections,
            answerIndex: -1,
        }];
        result.flags = { includeAlgorithm: true, includeDecisionMaking: false, includeHPI: false, includePhysicalExam: false };
    }

    if (!result.symptomCode) return null;
    return result;
}

// ---------------------------------------------------------------------------
// Compact PE encoding (structured state → short string for barcode)
// ---------------------------------------------------------------------------
// Format: 2:{cat},{lat},{hr},{rr},{sys},{dia},{temp},{ht},{wt}~{gsBits36}~{isBits36}~{abnDetails}~{add64}
// Status bits: 2 bits per item — 0=not-examined, 1=normal, 2=abnormal
// Abnormal details: comma-separated "g{idx}.{chipBitmask36}[.{freetext64}]" or "i{idx}.{...}"
// Backward compat: legacy P segments don't start with "2:" (base64 never contains ":")

const PE_NOT_EXAMINED = 0;
const PE_NORMAL = 1;
const PE_ABNORMAL = 2;

function matchAbnormalChips(text: string, options?: AbnormalOption[]): { chipBitmask: number; freeText: string } {
    if (!text || text === '(no details)' || !options?.length) {
        return { chipBitmask: 0, freeText: text === '(no details)' ? '' : text };
    }
    const segments = text.split(';').map(s => s.trim()).filter(Boolean);
    let chipBitmask = 0;
    const freeTextParts: string[] = [];
    for (const seg of segments) {
        const idx = options.findIndex(o => o.label === seg);
        if (idx >= 0) {
            chipBitmask |= (1 << idx);
        } else {
            freeTextParts.push(seg);
        }
    }
    return { chipBitmask, freeText: freeTextParts.join('; ') };
}

function rebuildAbnormalText(chipBitmask: number, freeText: string, options?: AbnormalOption[]): string {
    const parts: string[] = [];
    if (options) {
        for (let i = 0; i < options.length; i++) {
            if ((chipBitmask >> i) & 1) {
                parts.push(options[i].label);
            }
        }
    }
    if (freeText) parts.push(freeText);
    return parts.join('; ') || '(no details)';
}

function encodePECompact(peText: string, symptomCode: string): string {
    const dashCode = symptomCode.includes('-') ? symptomCode : symptomCode.replace(/([A-M])(\d+)/, '$1-$2');
    const categoryLetter = getCategoryFromSymptomCode(dashCode);
    if (!categoryLetter) return compressText(peText);

    const categoryDef = getPECategory(categoryLetter);
    const generalDefs = getGeneralFindings(categoryLetter);

    const vitalValues: Record<string, string> = {};
    const generalStatuses: number[] = new Array(generalDefs.length).fill(PE_NOT_EXAMINED);
    const generalAbn: { idx: number; chipBitmask: number; freeText: string }[] = [];
    const itemStatuses: number[] = new Array(categoryDef.items.length).fill(PE_NOT_EXAMINED);
    const itemAbn: { idx: number; chipBitmask: number; freeText: string }[] = [];
    let laterality = 'R';
    let additional = '';

    const lines = peText.split('\n');
    let section: 'none' | 'vitals' | 'general' | 'category' | 'additional' = 'none';

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed === 'Vital Signs:' || trimmed === 'Vital Signs') { section = 'vitals'; continue; }
        if (trimmed === 'General:') { section = 'general'; continue; }
        if (trimmed.startsWith('Additional Findings:')) {
            section = 'additional';
            additional = trimmed.replace('Additional Findings:', '').trim();
            continue;
        }
        if (trimmed.startsWith(`${categoryDef.label}:`) || trimmed.startsWith('MSK -')) {
            section = 'category';
            const latMatch = trimmed.match(/\((Left|Right|Bilateral)\)/i);
            if (latMatch) laterality = latMatch[1][0].toUpperCase();
            continue;
        }

        if (section === 'additional') { additional += '\n' + trimmed; continue; }

        if (section === 'vitals') {
            const bpMatch = trimmed.match(/^BP:\s*(.+?)\/(.+?)\s*mmHg/);
            if (bpMatch) {
                if (bpMatch[1].trim() !== '--') vitalValues['bpSys'] = bpMatch[1].trim();
                if (bpMatch[2].trim() !== '--') vitalValues['bpDia'] = bpMatch[2].trim();
                continue;
            }
            const vm = trimmed.match(/^(\w+):\s*(.+)/);
            if (vm) {
                const vDef = VITAL_SIGNS.find(v => v.shortLabel === vm[1]);
                if (vDef) {
                    let val = vm[2].trim();
                    if (val.endsWith(vDef.unit)) val = val.slice(0, -vDef.unit.length).trim();
                    vitalValues[vDef.key] = val;
                }
            }
            continue;
        }

        if (section === 'general') {
            for (let gi = 0; gi < generalDefs.length; gi++) {
                const g = generalDefs[gi];
                if (trimmed.startsWith(`${g.label}:`)) {
                    const rest = trimmed.slice(g.label.length + 1).trim();
                    if (rest.startsWith('Normal')) {
                        generalStatuses[gi] = PE_NORMAL;
                    } else if (rest.startsWith('Abnormal')) {
                        generalStatuses[gi] = PE_ABNORMAL;
                        const abnText = rest.replace(/^Abnormal\s*-?\s*/, '').trim();
                        const { chipBitmask, freeText } = matchAbnormalChips(abnText, g.abnormalOptions);
                        generalAbn.push({ idx: gi, chipBitmask, freeText });
                    }
                    break;
                }
            }
            continue;
        }

        if (section === 'category') {
            for (let ii = 0; ii < categoryDef.items.length; ii++) {
                const item = categoryDef.items[ii];
                if (trimmed.startsWith(`${item.label}:`)) {
                    const rest = trimmed.slice(item.label.length + 1).trim();
                    if (rest.startsWith('Normal')) {
                        itemStatuses[ii] = PE_NORMAL;
                    } else if (rest.startsWith('Abnormal')) {
                        itemStatuses[ii] = PE_ABNORMAL;
                        const abnText = rest.replace(/^Abnormal\s*-?\s*/, '').trim();
                        const { chipBitmask, freeText } = matchAbnormalChips(abnText, item.abnormalOptions);
                        itemAbn.push({ idx: ii, chipBitmask, freeText });
                    }
                    break;
                }
            }
            continue;
        }
    }

    // Build compact string
    const vitalsCsv = VITAL_SIGNS.map(v => vitalValues[v.key] || '').join(',');

    let gsBits = 0;
    for (let i = 0; i < generalStatuses.length; i++) gsBits |= (generalStatuses[i] << (i * 2));

    let isBits = 0;
    for (let i = 0; i < itemStatuses.length; i++) isBits |= (itemStatuses[i] << (i * 2));

    const abnParts: string[] = [];
    for (const a of generalAbn) {
        let e = `g${a.idx}.${a.chipBitmask.toString(36)}`;
        if (a.freeText) e += `.${compressText(a.freeText)}`;
        abnParts.push(e);
    }
    for (const a of itemAbn) {
        let e = `i${a.idx}.${a.chipBitmask.toString(36)}`;
        if (a.freeText) e += `.${compressText(a.freeText)}`;
        abnParts.push(e);
    }

    const add64 = additional.trim() ? compressText(additional.trim()) : '';

    return `2:${categoryLetter},${laterality},${vitalsCsv}~${gsBits.toString(36)}~${isBits.toString(36)}~${abnParts.join(',')}~${add64}`;
}

function decodePECompact(encoded: string, symptomCode: string): string {
    const data = encoded.startsWith('2:') ? encoded.substring(2) : encoded;
    const sections = data.split('~');
    if (sections.length < 5) return '';

    const headerParts = sections[0].split(',');
    const categoryLetter = headerParts[0] as CategoryLetter;
    const laterality = headerParts[1] || 'R';
    const vitalCsvValues = headerParts.slice(2);

    const categoryDef = getPECategory(categoryLetter);
    const generalDefs = getGeneralFindings(categoryLetter);
    const dashCode = symptomCode.includes('-') ? symptomCode : symptomCode.replace(/([A-M])(\d+)/, '$1-$2');
    const bodyPart = categoryLetter === 'B' ? getMSKBodyPart(dashCode) : null;

    // Reconstruct vitals
    const vitals: Record<string, string> = {};
    VITAL_SIGNS.forEach((v, i) => { vitals[v.key] = vitalCsvValues[i] || ''; });

    // Decode status bits
    const gsBits = parseInt(sections[1] || '0', 36);
    const isBits = parseInt(sections[2] || '0', 36);

    // Decode abnormal details
    const abnMap: Record<string, { chipBitmask: number; freeText: string }> = {};
    if (sections[3]) {
        for (const entry of sections[3].split(',').filter(Boolean)) {
            const dotParts = entry.split('.');
            const key = dotParts[0];
            const chipBitmask = parseInt(dotParts[1] || '0', 36);
            let freeText = '';
            if (dotParts.length > 2) {
                freeText = decompressText(dotParts.slice(2).join('.'));
            }
            abnMap[key] = { chipBitmask, freeText };
        }
    }

    // Decode additional findings
    let additional = '';
    if (sections[4]) {
        additional = decompressText(sections[4]);
    }

    // ── Reconstruct full PE text ──
    const textParts: string[] = [];

    // Vitals
    const hasVitals = VITAL_SIGNS.some(v => vitals[v.key]?.trim());
    if (hasVitals) {
        textParts.push('Vital Signs:');
        for (const v of VITAL_SIGNS) {
            if (v.key === 'bpSys') {
                const sys = vitals['bpSys']?.trim();
                const dia = vitals['bpDia']?.trim();
                if (sys || dia) textParts.push(`  BP: ${sys || '--'}/${dia || '--'} mmHg`);
                continue;
            }
            if (v.key === 'bpDia') continue;
            const val = vitals[v.key]?.trim();
            if (val) textParts.push(`  ${v.shortLabel}: ${val} ${v.unit}`);
        }
    }

    // General findings
    let hasGenerals = false;
    for (let gi = 0; gi < generalDefs.length; gi++) {
        if (((gsBits >> (gi * 2)) & 3) !== PE_NOT_EXAMINED) { hasGenerals = true; break; }
    }
    if (hasGenerals) {
        if (textParts.length > 0) textParts.push('');
        textParts.push('General:');
        for (let gi = 0; gi < generalDefs.length; gi++) {
            const status = (gsBits >> (gi * 2)) & 3;
            const g = generalDefs[gi];
            if (status === PE_NOT_EXAMINED) continue;
            if (status === PE_NORMAL) {
                textParts.push(`${g.label}: Normal - ${g.normalText}`);
            } else if (status === PE_ABNORMAL) {
                const abn = abnMap[`g${gi}`];
                const abnText = rebuildAbnormalText(abn?.chipBitmask || 0, abn?.freeText || '', g.abnormalOptions);
                textParts.push(`${g.label}: Abnormal - ${abnText}`);
            }
        }
    }

    // Category items
    let hasItems = false;
    for (let ii = 0; ii < categoryDef.items.length; ii++) {
        if (((isBits >> (ii * 2)) & 3) !== PE_NOT_EXAMINED) { hasItems = true; break; }
    }
    if (hasItems) {
        if (textParts.length > 0) textParts.push('');
        if (categoryDef.category === 'B' && bodyPart) {
            const latLabel = laterality === 'B' ? 'Bilateral' : laterality === 'L' ? 'Left' : 'Right';
            textParts.push(`MSK - ${bodyPart.label} (${latLabel}):`);
        } else {
            textParts.push(`${categoryDef.label}:`);
        }
        for (let ii = 0; ii < categoryDef.items.length; ii++) {
            const status = (isBits >> (ii * 2)) & 3;
            const item = categoryDef.items[ii];
            if (status === PE_NOT_EXAMINED) continue;
            if (status === PE_NORMAL) {
                textParts.push(item.normalText ? `${item.label}: Normal - ${item.normalText}` : `${item.label}: Normal`);
            } else if (status === PE_ABNORMAL) {
                const abn = abnMap[`i${ii}`];
                const abnText = rebuildAbnormalText(abn?.chipBitmask || 0, abn?.freeText || '', item.abnormalOptions);
                textParts.push(`${item.label}: Abnormal - ${abnText}`);
            }
        }
    }

    if (additional.trim()) {
        if (textParts.length > 0) textParts.push('');
        textParts.push(`Additional Findings: ${additional.trim()}`);
    }

    return textParts.join('\n');
}

// ---------------------------------------------------------------------------
// Encoding (live state → barcode string)
// ---------------------------------------------------------------------------

export function encodeNoteState(
    algorithmOptions: AlgorithmOptions[],
    cardStates: CardState[],
    noteOptions: NoteEncodeOptions,
    symptomCode: string,
): string {
    const parts: string[] = [];

    // 1. Symptom code
    parts.push(symptomCode);

    // 2. Red flag selections (card 0 if RF type)
    const rfCard = algorithmOptions[0];
    if (rfCard?.type === 'rf' && cardStates[0]?.selectedOptions) {
        const totalOptions = rfCard.questionOptions?.length || 0;
        let bitmask = 0;
        for (let i = 0; i < totalOptions; i++) {
            if (cardStates[0].selectedOptions.includes(i)) {
                bitmask |= (1 << i);
            }
        }
        parts.push(`R${bitmask.toString(36)}`);
    } else {
        parts.push('R0');
    }

    // 3. Each visible non-RF card: {index}.{selBitmaskBase36}.{answerIndex}
    for (let i = 0; i < cardStates.length; i++) {
        const state = cardStates[i];
        const card = algorithmOptions[i];
        if (!state?.isVisible || !card || card.type === 'rf') continue;

        let selBitmask = 0;
        for (const optIdx of state.selectedOptions) {
            selBitmask |= (1 << optIdx);
        }

        let answerIdx = -1;
        if (state.answer) {
            answerIdx = card.answerOptions.findIndex(a => a.text === state.answer?.text);
        }

        parts.push(`${i}.${selBitmask.toString(36)}.${answerIdx}`);
    }

    // 3b. Screener entries for action cards with screenerConfig + screenerResponses
    for (let i = 0; i < cardStates.length; i++) {
        const state = cardStates[i];
        const card = algorithmOptions[i];
        if (!state?.isVisible || !card || !card.screenerConfig || !state.screenerResponses) continue;

        const screenerId = state.completedScreenerId || card.screenerConfig.id;
        const allSingleDigit = state.screenerResponses.every(d => d >= 0 && d <= 9);
        const encoded = allSingleDigit
            ? state.screenerResponses.map(d => d.toString()).join('')
            : state.screenerResponses.map(d => d.toString(36)).join('-');
        let seg = `Q${screenerId}.${encoded}`;
        if (state.followUpResponse !== undefined && state.followUpResponse !== null) {
            seg += `.${state.followUpResponse}`;
        }
        parts.push(seg);
    }

    // 3c. Action status entries for non-screener action cards
    for (let i = 0; i < cardStates.length; i++) {
        const state = cardStates[i];
        const card = algorithmOptions[i];
        if (!state?.isVisible || !card || card.type !== 'action' || card.screenerConfig || !state.actionStatus) continue;
        parts.push(`A${i}.${state.actionStatus === 'deferred' ? 'D' : 'P'}`);
    }

    // 4. HPI text (compressed)
    const customNote = noteOptions.customNote?.trim();
    if (customNote) {
        parts.push(`H${compressText(customNote)}`);
    }

    // 4b. Physical Exam (compact structured encoding)
    const peNote = noteOptions.physicalExamNote?.trim();
    if (peNote) {
        try {
            parts.push(`P${encodePECompact(peNote, symptomCode)}`);
        } catch {
            // Fallback to compressed text if compact encoding fails
            parts.push(`P${compressText(peNote)}`);
        }
    }

    // 5. Flags: bit0=includeAlgorithm, bit1=includeDM, bit2=includeHPI, bit3=includePE
    let flags = 0;
    if (noteOptions.includeAlgorithm) flags |= 1;
    if (noteOptions.includeDecisionMaking) flags |= 2;
    if (customNote) flags |= 4;
    if (peNote) flags |= 8;
    parts.push(`F${flags}`);

    // 6. User profile (indexed enums + base64 name)
    const user = noteOptions.user;
    if (user?.lastName) {
        const ri = user.rank ? ranks.indexOf(user.rank) : -1;
        const ci = user.credential ? credentials.indexOf(user.credential) : -1;
        const coi = user.component ? components.indexOf(user.component) : -1;
        const nameStr = `${user.firstName ?? ''}|${user.lastName ?? ''}|${user.middleInitial ?? ''}|${user.uic ?? ''}`;
        try {
            parts.push(`U${ri}.${ci}.${coi}.${btoa(encodeURIComponent(nameStr))}`);
        } catch {
            parts.push(`U${ri}.${ci}.${coi}.${encodeURIComponent(nameStr)}`);
        }
    }

    // 7. Timestamp (epoch seconds in base36)
    parts.push(`T${Math.floor(Date.now() / 1000).toString(36)}`);

    return parts.join('|');
}

// ---------------------------------------------------------------------------
// Content comparison (ignores volatile segments like timestamp)
// ---------------------------------------------------------------------------

/** Compare two encoded note strings ignoring the timestamp segment (T...) */
export function encodedContentEquals(a: string, b: string): boolean {
    const strip = (s: string) => s.split('|').filter(p => !p.startsWith('T')).join('|');
    return strip(a) === strip(b);
}

// ---------------------------------------------------------------------------
// Reconstruction (ParsedNote + algorithm → CardState[] + disposition)
// ---------------------------------------------------------------------------

export function reconstructCardStates(
    algorithmOptions: AlgorithmOptions[],
    parsed: ParsedNote,
): { cardStates: CardState[]; disposition: dispositionType | null } {
    const initialIndex = algorithmOptions.findIndex(card => card.type === 'initial');

    const cardStates: CardState[] = algorithmOptions.map((_, index) => ({
        index,
        isVisible: index <= initialIndex,
        answer: null,
        selectedOptions: [],
        count: 0,
    }));

    // Apply RF selections
    const rfCard = algorithmOptions[0];
    if (rfCard?.type === 'rf') {
        cardStates[0].selectedOptions = parsed.rfSelections;
        cardStates[0].count = parsed.rfSelections.length;
    }

    // Apply each card entry
    let lastDisposition: dispositionType | null = null;

    for (const entry of parsed.cardEntries) {
        if (entry.index < 0 || entry.index >= cardStates.length) continue;
        const card = algorithmOptions[entry.index];
        if (!card) continue;

        cardStates[entry.index].isVisible = true;
        cardStates[entry.index].selectedOptions = entry.selections;
        cardStates[entry.index].count = entry.selections.length;

        if (entry.answerIndex >= 0 && entry.answerIndex < card.answerOptions.length) {
            const answer = card.answerOptions[entry.answerIndex];
            cardStates[entry.index].answer = answer;

            if (answer.disposition && answer.disposition.length > 0) {
                lastDisposition = answer.disposition[0];
            }

            if (answer.next !== null) {
                const nextIndices = Array.isArray(answer.next) ? answer.next : [answer.next];
                nextIndices.forEach(nextIndex => {
                    if (nextIndex >= 0 && nextIndex < cardStates.length) {
                        cardStates[nextIndex].isVisible = true;
                    }
                });
            }
        }
    }

    // Apply screener entries
    for (const entry of parsed.screenerEntries) {
        // Find the action card whose screenerConfig matches this entry
        const cardIdx = algorithmOptions.findIndex(card => {
            if (!card.screenerConfig) return false;
            // Direct match
            if (card.screenerConfig.id === entry.id) return true;
            // Extended match (e.g. PHQ-2 card completed as PHQ-9)
            if (card.screenerConfig.conditionalExtension?.screener.id === entry.id) return true;
            return false;
        });
        if (cardIdx >= 0) {
            cardStates[cardIdx].screenerResponses = entry.responses;
            cardStates[cardIdx].completedScreenerId = entry.id;
            if (entry.followUp !== undefined) {
                cardStates[cardIdx].followUpResponse = entry.followUp;
            }
        }
    }

    // Apply action status entries
    for (const entry of parsed.actionEntries) {
        if (entry.index >= 0 && entry.index < cardStates.length) {
            cardStates[entry.index].actionStatus = entry.status;
            if (entry.status === 'deferred') {
                lastDisposition = { type: "OTHER", text: "defer to AEM" };
            }
        }
    }

    return { cardStates, disposition: lastDisposition };
}
