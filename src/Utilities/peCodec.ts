// Utilities/peCodec.ts
// Physical Exam compact encoding/decoding — v5 format.
// v5 encodes/decodes directly from PEState (no text parsing).
// Legacy v2/v3/v4 decoding kept as read-only fallback for old barcodes.

import { compressText, decompressText } from './textCodec';
import {
    getCategoryFromSymptomCode,
    getMSKBodyPart,
    isBackPainCode,
    VITAL_SIGNS,
    BASELINE_BEFORE_COUNT,
    getBaselineWrappers,
    getFocusedBlocks,
    getGeneralFindings,
    getLegacyGeneralFindings,
    getPECategory,
    WRAPPER_BEFORE_COUNT,
} from '../Data/PhysicalExamData';
import type { CategoryLetter, AbnormalOption } from '../Data/PhysicalExamData';
import type { PEState, PEItemState } from '../Types/PETypes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PE_NOT_EXAMINED = 0;
const PE_NORMAL = 1;
const PE_ABNORMAL = 2;

// ---------------------------------------------------------------------------
// V5 encoder
// ---------------------------------------------------------------------------
// Format: 5:{cat},{lat},{vitalsCsv}~{statusBits36}~{abnEntries}~{compressedAdditional}
// statusBits: 2 bits per item — wrappers (5) then focused blocks, merged into one number
// abnEntries: comma-separated "w{idx}.{chipBitmask36}[.{compressedFreeText}]" or "f{idx}.{...}"

/** Encode PE state directly into compact v5 string. */
export function encodePEState(state: PEState): string {
    const { categoryLetter, laterality, spineRegion, vitals, items, additional } = state;

    const wrapperDefs = getBaselineWrappers();
    const focusedBlocks = getFocusedBlocks(categoryLetter);

    // Vitals CSV
    const vitalsCsv = VITAL_SIGNS.map(v => vitals[v.key] || '').join(',');

    // Laterality: first char of value ('l', 'r', 'b') — uppercase single char
    const latChar = laterality ? laterality[0].toUpperCase() : 'R';

    // Status bits: 2 bits per wrapper, then 2 bits per focused block — all merged
    let statusBits = 0;
    for (let i = 0; i < wrapperDefs.length; i++) {
        const itemState = items[wrapperDefs[i].key];
        const status = itemStateToStatus(itemState);
        statusBits |= (status << (i * 2));
    }
    const wrapperCount = wrapperDefs.length;
    for (let i = 0; i < focusedBlocks.length; i++) {
        const itemState = items[focusedBlocks[i].key];
        const status = itemStateToStatus(itemState);
        statusBits |= (status << ((wrapperCount + i) * 2));
    }

    // Abnormal entries
    const abnParts: string[] = [];

    for (let i = 0; i < wrapperDefs.length; i++) {
        const block = wrapperDefs[i];
        const itemState = items[block.key];
        if (!itemState || itemState.status !== 'abnormal') continue;
        const chipBitmask = chipsToBitmask(itemState.selectedChips, block.abnormalOptions);
        let entry = `w${i}.${chipBitmask.toString(36)}`;
        if (itemState.findings.trim()) entry += `.${compressText(itemState.findings.trim())}`;
        abnParts.push(entry);
    }

    for (let i = 0; i < focusedBlocks.length; i++) {
        const block = focusedBlocks[i];
        const itemState = items[block.key];
        if (!itemState || itemState.status !== 'abnormal') continue;
        const chipBitmask = chipsToBitmask(itemState.selectedChips, block.abnormalOptions);
        let entry = `f${i}.${chipBitmask.toString(36)}`;
        if (itemState.findings.trim()) entry += `.${compressText(itemState.findings.trim())}`;
        abnParts.push(entry);
    }

    const add64 = additional.trim() ? compressText(additional.trim()) : '';

    // Include spineRegion in laterality field when present (back pain MSK)
    // Format: lat[/spineRegion]
    const latField = (categoryLetter === 'B' && spineRegion) ? `${latChar}/${spineRegion}` : latChar;

    return `5:${categoryLetter},${latField},${vitalsCsv}~${statusBits.toString(36)}~${abnParts.join(',')}~${add64}`;
}

// ---------------------------------------------------------------------------
// V5 decoder
// ---------------------------------------------------------------------------

/** Decode a compact v5 PE string back into PEState. Returns null on parse failure. */
export function decodePEState(encoded: string, symptomCode: string): PEState | null {
    if (!encoded.startsWith('5:')) return null;
    const data = encoded.substring(2);

    const sections = data.split('~');
    if (sections.length < 4) return null;

    const headerParts = sections[0].split(',');
    const categoryLetter = headerParts[0] as CategoryLetter;
    const latField = headerParts[1] || 'R';
    const vitalCsvValues = headerParts.slice(2);

    // Parse laterality and optional spineRegion
    let lateralityRaw = latField;
    let spineRegion: PEState['spineRegion'] = 'lumbar';
    if (latField.includes('/')) {
        const [latPart, regionPart] = latField.split('/');
        lateralityRaw = latPart;
        spineRegion = (regionPart as PEState['spineRegion']) || 'lumbar';
    }
    const laterality = charToLaterality(lateralityRaw);

    // Vitals
    const vitals: Record<string, string> = {};
    VITAL_SIGNS.forEach((v, i) => { vitals[v.key] = vitalCsvValues[i] || ''; });

    const statusBits = parseInt(sections[1] || '0', 36);

    // Parse abnormal entries into a map keyed by "w{i}" or "f{i}"
    const abnMap: Record<string, { chipBitmask: number; freeText: string }> = {};
    if (sections[2]) {
        for (const entry of sections[2].split(',').filter(Boolean)) {
            const dotParts = entry.split('.');
            const key = dotParts[0];
            const chipBitmask = parseInt(dotParts[1] || '0', 36);
            let freeText = '';
            if (dotParts.length > 2) freeText = decompressText(dotParts.slice(2).join('.'));
            abnMap[key] = { chipBitmask, freeText };
        }
    }

    const additional = sections[3] ? decompressText(sections[3]) : '';

    const wrapperDefs = getBaselineWrappers();
    const focusedBlocks = getFocusedBlocks(categoryLetter);
    const wrapperCount = wrapperDefs.length;

    const items: Record<string, PEItemState> = {};

    for (let i = 0; i < wrapperDefs.length; i++) {
        const block = wrapperDefs[i];
        const status = getItemStatus(statusBits, i);
        if (status === PE_NOT_EXAMINED) continue;
        const abn = abnMap[`w${i}`];
        items[block.key] = buildItemState(status, abn, block.abnormalOptions);
    }

    for (let i = 0; i < focusedBlocks.length; i++) {
        const block = focusedBlocks[i];
        const status = getItemStatus(statusBits, wrapperCount + i);
        if (status === PE_NOT_EXAMINED) continue;
        const abn = abnMap[`f${i}`];
        items[block.key] = buildItemState(status, abn, block.abnormalOptions);
    }

    return {
        categoryLetter,
        laterality,
        spineRegion,
        vitals,
        items,
        additional,
        depth: 'focused',
    };
}

// ---------------------------------------------------------------------------
// Text renderer
// ---------------------------------------------------------------------------

/** Render PEState into human-readable text (for display/preview). */
export function renderPEStateToText(state: PEState): string {
    const { categoryLetter, laterality, spineRegion, vitals, items, additional } = state;

    const dashCode = `${categoryLetter}-1`; // minimal code for body part lookup
    const bodyPart = categoryLetter === 'B' ? getMSKBodyPart(
        // We need the real symptom code for body part; use a placeholder approach
        // Callers should pass the real code if body part label matters.
        dashCode
    ) : null;

    const wrapperDefs = getBaselineWrappers();
    const focusedBlocks = getFocusedBlocks(categoryLetter);
    const beforeWrappers = wrapperDefs.slice(0, BASELINE_BEFORE_COUNT);
    const afterWrappers = wrapperDefs.slice(BASELINE_BEFORE_COUNT);

    const parts: string[] = [...formatVitalsText(vitals)];
    const examLines: string[] = [];

    for (const b of beforeWrappers) {
        const itemState = items[b.key];
        if (!itemState || itemState.status === 'not-examined') continue;
        examLines.push(formatItemLine(b.label, itemState, b.normalText, b.abnormalOptions));
    }

    if (categoryLetter === 'B' && bodyPart) {
        const hasExamined = focusedBlocks.some(b => items[b.key]?.status !== 'not-examined' && items[b.key]);
        if (hasExamined) {
            if (isBackPainCode(bodyPart.code) && spineRegion) {
                const regionLabel = spineRegion.charAt(0).toUpperCase() + spineRegion.slice(1);
                examLines.push(`MSK - ${bodyPart.label} (${regionLabel})`);
            } else {
                const latLabel = laterality === 'bilateral' ? 'Bilateral' : laterality === 'left' ? 'Left' : 'Right';
                examLines.push(`MSK - ${bodyPart.label} (${latLabel})`);
            }
        }
    }

    for (const b of focusedBlocks) {
        const itemState = items[b.key];
        if (!itemState || itemState.status === 'not-examined') continue;
        examLines.push(formatItemLine(b.label, itemState, b.normalText, b.abnormalOptions));
    }

    for (const b of afterWrappers) {
        const itemState = items[b.key];
        if (!itemState || itemState.status === 'not-examined') continue;
        examLines.push(formatItemLine(b.label, itemState, b.normalText, b.abnormalOptions));
    }

    if (examLines.length > 0) {
        if (parts.length > 0) parts.push('');
        parts.push(...examLines);
    }

    if (additional.trim()) {
        if (parts.length > 0) parts.push('');
        parts.push(`Additional Findings: ${additional.trim()}`);
    }

    return parts.join('\n');
}

/** Render PEState with the real symptom code for accurate MSK body part labels. */
export function renderPEStateToTextWithCode(state: PEState, symptomCode: string): string {
    const { categoryLetter, laterality, spineRegion, vitals, items, additional } = state;

    const dashCode = symptomCode.includes('-') ? symptomCode : symptomCode.replace(/([A-M])(\d+)/, '$1-$2');
    const bodyPart = categoryLetter === 'B' ? getMSKBodyPart(dashCode) : null;

    const wrapperDefs = getBaselineWrappers();
    const focusedBlocks = getFocusedBlocks(categoryLetter);
    const beforeWrappers = wrapperDefs.slice(0, BASELINE_BEFORE_COUNT);
    const afterWrappers = wrapperDefs.slice(BASELINE_BEFORE_COUNT);

    const parts: string[] = [...formatVitalsText(vitals)];
    const examLines: string[] = [];

    for (const b of beforeWrappers) {
        const itemState = items[b.key];
        if (!itemState || itemState.status === 'not-examined') continue;
        examLines.push(formatItemLine(b.label, itemState, b.normalText, b.abnormalOptions));
    }

    if (categoryLetter === 'B' && bodyPart) {
        const hasExamined = focusedBlocks.some(b => items[b.key]?.status !== 'not-examined' && items[b.key]);
        if (hasExamined) {
            if (isBackPainCode(bodyPart.code) && spineRegion) {
                const regionLabel = spineRegion.charAt(0).toUpperCase() + spineRegion.slice(1);
                examLines.push(`MSK - ${bodyPart.label} (${regionLabel})`);
            } else {
                const latLabel = laterality === 'bilateral' ? 'Bilateral' : laterality === 'left' ? 'Left' : 'Right';
                examLines.push(`MSK - ${bodyPart.label} (${latLabel})`);
            }
        }
    }

    for (const b of focusedBlocks) {
        const itemState = items[b.key];
        if (!itemState || itemState.status === 'not-examined') continue;
        examLines.push(formatItemLine(b.label, itemState, b.normalText, b.abnormalOptions));
    }

    for (const b of afterWrappers) {
        const itemState = items[b.key];
        if (!itemState || itemState.status === 'not-examined') continue;
        examLines.push(formatItemLine(b.label, itemState, b.normalText, b.abnormalOptions));
    }

    if (examLines.length > 0) {
        if (parts.length > 0) parts.push('');
        parts.push(...examLines);
    }

    if (additional.trim()) {
        if (parts.length > 0) parts.push('');
        parts.push(`Additional Findings: ${additional.trim()}`);
    }

    return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Legacy decoder (v2 / v3 / v4 → plain text, read-only fallback)
// ---------------------------------------------------------------------------

/**
 * Decode a compact PE string (any version: v2, v3, v4, or v5) back into
 * human-readable text. For v5, decodes to PEState then renders to text.
 * Used by noteParser and NoteCodec barrel for reading stored barcodes.
 */
export function decodePECompact(encoded: string, symptomCode: string): string {
    if (encoded.startsWith('5:')) {
        const state = decodePEState(encoded, symptomCode);
        return state ? renderPEStateToTextWithCode(state, symptomCode) : '';
    }
    return decodePECompactLegacy(encoded, symptomCode);
}

/**
 * Decode a legacy compact PE string (v2, v3, or v4) back into human-readable text.
 * Used only for reading old barcodes — no encoding equivalent exists.
 */
export function decodePECompactLegacy(encoded: string, symptomCode: string): string {
    if (encoded.startsWith('4:')) return decodePECompactV4(encoded.substring(2), symptomCode);
    if (encoded.startsWith('3:')) return decodePECompactV3(encoded.substring(2), symptomCode);
    const data = encoded.startsWith('2:') ? encoded.substring(2) : encoded;
    return decodePECompactV2(data, symptomCode);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function itemStateToStatus(itemState: PEItemState | undefined): number {
    if (!itemState) return PE_NOT_EXAMINED;
    if (itemState.status === 'normal') return PE_NORMAL;
    if (itemState.status === 'abnormal') return PE_ABNORMAL;
    return PE_NOT_EXAMINED;
}

function chipsToBitmask(selectedChips: string[], options: AbnormalOption[]): number {
    let bitmask = 0;
    for (const key of selectedChips) {
        const idx = options.findIndex(o => o.key === key);
        if (idx >= 0) bitmask |= (1 << idx);
    }
    return bitmask;
}

function bitmaskToChips(bitmask: number, options: AbnormalOption[]): string[] {
    const keys: string[] = [];
    for (let i = 0; i < options.length; i++) {
        if ((bitmask >> i) & 1) keys.push(options[i].key);
    }
    return keys;
}

function getItemStatus(bits: number, index: number): number {
    return (bits >> (index * 2)) & 3;
}

function charToLaterality(char: string): PEState['laterality'] {
    const c = char.toUpperCase();
    if (c === 'L') return 'left';
    if (c === 'B') return 'bilateral';
    return 'right';
}

function buildItemState(
    status: number,
    abn: { chipBitmask: number; freeText: string } | undefined,
    options: AbnormalOption[],
): PEItemState {
    if (status === PE_NORMAL) {
        return { status: 'normal', findings: '', selectedChips: [] };
    }
    // abnormal
    const selectedChips = abn ? bitmaskToChips(abn.chipBitmask, options) : [];
    const findings = abn?.freeText || '';
    return { status: 'abnormal', findings, selectedChips };
}

function formatItemLine(
    label: string,
    itemState: PEItemState,
    normalText?: string,
    abnormalOptions?: AbnormalOption[],
): string {
    const uLabel = label.toUpperCase();
    if (itemState.status === 'normal') {
        return normalText ? `${uLabel}: ${normalText}` : `${uLabel}: Normal`;
    }
    const parts: string[] = [];
    if (abnormalOptions) {
        for (const opt of abnormalOptions) {
            if (itemState.selectedChips.includes(opt.key)) parts.push(opt.label);
        }
    }
    if (itemState.findings.trim()) parts.push(itemState.findings.trim());
    const abnText = parts.join('; ') || '(no details)';
    return `${uLabel}: ${abnText}`;
}

function formatVitalsText(vitals: Record<string, string>): string[] {
    const hasVitals = VITAL_SIGNS.some(v => vitals[v.key]?.trim());
    if (!hasVitals) return [];
    const lines: string[] = ['Vital Signs:'];
    for (const v of VITAL_SIGNS) {
        if (v.key === 'bpSys') {
            const sys = vitals['bpSys']?.trim();
            const dia = vitals['bpDia']?.trim();
            if (sys || dia) lines.push(`  BP: ${sys || '--'}/${dia || '--'} mmHg`);
            continue;
        }
        if (v.key === 'bpDia') continue;
        const val = vitals[v.key]?.trim();
        if (val) lines.push(`  ${v.shortLabel}: ${val} ${v.unit}`);
    }
    return lines;
}

// ---------------------------------------------------------------------------
// Legacy decode helpers (v2/v3/v4)
// ---------------------------------------------------------------------------

interface LegacyAbnMap {
    [key: string]: { chipBitmask: number; freeText: string };
}

function parseLegacySections(data: string): {
    categoryLetter: CategoryLetter;
    laterality: string;
    vitals: Record<string, string>;
    gsBits: number;
    isBits: number;
    abnMap: LegacyAbnMap;
    additional: string;
} | null {
    const sections = data.split('~');
    if (sections.length < 5) return null;

    const headerParts = sections[0].split(',');
    const categoryLetter = headerParts[0] as CategoryLetter;
    const laterality = headerParts[1] || 'R';
    const vitalCsvValues = headerParts.slice(2);

    const vitals: Record<string, string> = {};
    VITAL_SIGNS.forEach((v, i) => { vitals[v.key] = vitalCsvValues[i] || ''; });

    const gsBits = parseInt(sections[1] || '0', 36);
    const isBits = parseInt(sections[2] || '0', 36);

    const abnMap: LegacyAbnMap = {};
    if (sections[3]) {
        for (const entry of sections[3].split(',').filter(Boolean)) {
            const dotParts = entry.split('.');
            const key = dotParts[0];
            const chipBitmask = parseInt(dotParts[1] || '0', 36);
            let freeText = '';
            if (dotParts.length > 2) freeText = decompressText(dotParts.slice(2).join('.'));
            abnMap[key] = { chipBitmask, freeText };
        }
    }

    const additional = sections[4] ? decompressText(sections[4]) : '';
    return { categoryLetter, laterality, vitals, gsBits, isBits, abnMap, additional };
}

function legacyGetItemStatus(bits: number, index: number): number {
    return (bits >> (index * 2)) & 3;
}

function legacyHasExamined(bits: number, count: number): boolean {
    for (let i = 0; i < count; i++) {
        if (legacyGetItemStatus(bits, i) !== PE_NOT_EXAMINED) return true;
    }
    return false;
}

function legacyFormatVitals(vitals: Record<string, string>): string[] {
    const hasVitals = VITAL_SIGNS.some(v => vitals[v.key]?.trim());
    if (!hasVitals) return [];
    const lines: string[] = ['Vital Signs:'];
    for (const v of VITAL_SIGNS) {
        if (v.key === 'bpSys') {
            const sys = vitals['bpSys']?.trim();
            const dia = vitals['bpDia']?.trim();
            if (sys || dia) lines.push(`  BP: ${sys || '--'}/${dia || '--'} mmHg`);
            continue;
        }
        if (v.key === 'bpDia') continue;
        const val = vitals[v.key]?.trim();
        if (val) lines.push(`  ${v.shortLabel}: ${val} ${v.unit}`);
    }
    return lines;
}

function legacyRebuildAbnText(chipBitmask: number, freeText: string, options?: AbnormalOption[]): string {
    const parts: string[] = [];
    if (options) {
        for (let i = 0; i < options.length; i++) {
            if ((chipBitmask >> i) & 1) parts.push(options[i].label);
        }
    }
    if (freeText) parts.push(freeText);
    return parts.join('; ') || '(no details)';
}

function legacyEmitLine(
    label: string,
    normalText: string,
    status: number,
    abnKey: string,
    abnMap: LegacyAbnMap,
    abnormalOptions?: AbnormalOption[],
    usePrefix = false,
): string | null {
    const uLabel = label.toUpperCase();
    if (status === PE_NORMAL) {
        if (!usePrefix && normalText) return `${uLabel}: ${normalText}`;
        return normalText ? `${uLabel}: Normal - ${normalText}` : `${uLabel}: Normal`;
    }
    if (status === PE_ABNORMAL) {
        const abn = abnMap[abnKey];
        const abnText = legacyRebuildAbnText(abn?.chipBitmask || 0, abn?.freeText || '', abnormalOptions);
        if (!usePrefix) return `${uLabel}: ${abnText}`;
        return `${uLabel}: Abnormal - ${abnText}`;
    }
    return null;
}

function decodePECompactV2(data: string, symptomCode: string): string {
    const parsed = parseLegacySections(data);
    if (!parsed) return '';
    const { categoryLetter, laterality, vitals, gsBits, isBits, abnMap, additional } = parsed;
    const dashCode = symptomCode.includes('-') ? symptomCode : symptomCode.replace(/([A-M])(\d+)/, '$1-$2');
    const categoryDef = getPECategory(categoryLetter);
    const bodyPart = categoryLetter === 'B' ? getMSKBodyPart(dashCode) : null;
    const legacyDefs = getLegacyGeneralFindings(categoryLetter);

    const textParts: string[] = legacyFormatVitals(vitals);

    if (legacyHasExamined(gsBits, legacyDefs.length)) {
        if (textParts.length > 0) textParts.push('');
        textParts.push('General:');
        for (let gi = 0; gi < legacyDefs.length; gi++) {
            const status = legacyGetItemStatus(gsBits, gi);
            if (status === PE_NOT_EXAMINED) continue;
            const g = legacyDefs[gi];
            const line = legacyEmitLine(g.label, g.normalText, status, `g${gi}`, abnMap, g.abnormalOptions, true);
            if (line) textParts.push(line);
        }
    }

    if (legacyHasExamined(isBits, categoryDef.items.length)) {
        if (textParts.length > 0) textParts.push('');
        if (categoryDef.category === 'B' && bodyPart) {
            const latLabel = laterality === 'B' ? 'Bilateral' : laterality === 'L' ? 'Left' : 'Right';
            textParts.push(`MSK - ${bodyPart.label} (${latLabel})`);
        }
        for (let ii = 0; ii < categoryDef.items.length; ii++) {
            const status = legacyGetItemStatus(isBits, ii);
            if (status === PE_NOT_EXAMINED) continue;
            const item = categoryDef.items[ii];
            const line = legacyEmitLine(item.label, item.normalText || '', status, `i${ii}`, abnMap, item.abnormalOptions, true);
            if (line) textParts.push(line);
        }
    }

    if (additional.trim()) {
        if (textParts.length > 0) textParts.push('');
        textParts.push(`Additional Findings: ${additional.trim()}`);
    }

    return textParts.join('\n');
}

function decodePECompactV3(data: string, symptomCode: string): string {
    const parsed = parseLegacySections(data);
    if (!parsed) return '';
    const { categoryLetter, laterality, vitals, gsBits, isBits, abnMap, additional } = parsed;
    const dashCode = symptomCode.includes('-') ? symptomCode : symptomCode.replace(/([A-M])(\d+)/, '$1-$2');
    const categoryDef = getPECategory(categoryLetter);
    const bodyPart = categoryLetter === 'B' ? getMSKBodyPart(dashCode) : null;
    const wrapperDefs = getGeneralFindings(categoryLetter);

    const textParts: string[] = legacyFormatVitals(vitals);
    const examLines: string[] = [];

    for (let gi = 0; gi < WRAPPER_BEFORE_COUNT; gi++) {
        const status = legacyGetItemStatus(gsBits, gi);
        if (status === PE_NOT_EXAMINED) continue;
        const g = wrapperDefs[gi];
        const line = legacyEmitLine(g.label, g.normalText, status, `g${gi}`, abnMap, g.abnormalOptions);
        if (line) examLines.push(line);
    }

    if (categoryDef.category === 'B' && bodyPart && legacyHasExamined(isBits, categoryDef.items.length)) {
        const latLabel = laterality === 'B' ? 'Bilateral' : laterality === 'L' ? 'Left' : 'Right';
        examLines.push(`MSK - ${bodyPart.label} (${latLabel})`);
    }

    for (let ii = 0; ii < categoryDef.items.length; ii++) {
        const status = legacyGetItemStatus(isBits, ii);
        if (status === PE_NOT_EXAMINED) continue;
        const item = categoryDef.items[ii];
        const line = legacyEmitLine(item.label, item.normalText || '', status, `i${ii}`, abnMap, item.abnormalOptions);
        if (line) examLines.push(line);
    }

    for (let gi = WRAPPER_BEFORE_COUNT; gi < wrapperDefs.length; gi++) {
        const status = legacyGetItemStatus(gsBits, gi);
        if (status === PE_NOT_EXAMINED) continue;
        const g = wrapperDefs[gi];
        const line = legacyEmitLine(g.label, g.normalText, status, `g${gi}`, abnMap, g.abnormalOptions);
        if (line) examLines.push(line);
    }

    if (examLines.length > 0) {
        if (textParts.length > 0) textParts.push('');
        textParts.push(...examLines);
    }

    if (additional.trim()) {
        if (textParts.length > 0) textParts.push('');
        textParts.push(`Additional Findings: ${additional.trim()}`);
    }

    return textParts.join('\n');
}

function decodePECompactV4(data: string, symptomCode: string): string {
    const sections = data.split('~');
    if (sections.length < 5) return '';

    const headerParts = sections[0].split(',');
    const categoryLetter = headerParts[0] as CategoryLetter;
    const laterality = headerParts[1] || 'R';
    const vitalCsvValues = headerParts.slice(2);

    const dashCode = symptomCode.includes('-') ? symptomCode : symptomCode.replace(/([A-M])(\d+)/, '$1-$2');
    const bodyPart = categoryLetter === 'B' ? getMSKBodyPart(dashCode) : null;

    const vitals: Record<string, string> = {};
    VITAL_SIGNS.forEach((v, i) => { vitals[v.key] = vitalCsvValues[i] || ''; });

    const gsBits = parseInt(sections[1] || '0', 36);
    const isBits = parseInt(sections[2] || '0', 36);

    const abnMap: LegacyAbnMap = {};
    if (sections[3]) {
        for (const entry of sections[3].split(',').filter(Boolean)) {
            const dotParts = entry.split('.');
            const key = dotParts[0];
            const chipBitmask = parseInt(dotParts[1] || '0', 36);
            let freeText = '';
            if (dotParts.length > 2) freeText = decompressText(dotParts.slice(2).join('.'));
            abnMap[key] = { chipBitmask, freeText };
        }
    }

    const additional = sections[4] ? decompressText(sections[4]) : '';

    const wrapperDefs = getBaselineWrappers();
    const focusedItems = getFocusedBlocks(categoryLetter);

    const textParts: string[] = legacyFormatVitals(vitals);
    const examLines: string[] = [];

    for (let gi = 0; gi < BASELINE_BEFORE_COUNT; gi++) {
        const status = legacyGetItemStatus(gsBits, gi);
        if (status === PE_NOT_EXAMINED) continue;
        const g = wrapperDefs[gi];
        const line = legacyEmitLine(g.label, g.normalText || '', status, `g${gi}`, abnMap, g.abnormalOptions);
        if (line) examLines.push(line);
    }

    if (categoryLetter === 'B' && bodyPart && legacyHasExamined(isBits, focusedItems.length)) {
        const latLabel = laterality === 'B' ? 'Bilateral' : laterality === 'L' ? 'Left' : 'Right';
        examLines.push(`MSK - ${bodyPart.label} (${latLabel})`);
    }

    for (let ii = 0; ii < focusedItems.length; ii++) {
        const status = legacyGetItemStatus(isBits, ii);
        if (status === PE_NOT_EXAMINED) continue;
        const item = focusedItems[ii];
        const line = legacyEmitLine(item.label, item.normalText || '', status, `i${ii}`, abnMap, item.abnormalOptions);
        if (line) examLines.push(line);
    }

    for (let gi = BASELINE_BEFORE_COUNT; gi < wrapperDefs.length; gi++) {
        const status = legacyGetItemStatus(gsBits, gi);
        if (status === PE_NOT_EXAMINED) continue;
        const g = wrapperDefs[gi];
        const line = legacyEmitLine(g.label, g.normalText || '', status, `g${gi}`, abnMap, g.abnormalOptions);
        if (line) examLines.push(line);
    }

    if (examLines.length > 0) {
        if (textParts.length > 0) textParts.push('');
        textParts.push(...examLines);
    }

    if (additional.trim()) {
        if (textParts.length > 0) textParts.push('');
        textParts.push(`Additional Findings: ${additional.trim()}`);
    }

    return textParts.join('\n');
}
