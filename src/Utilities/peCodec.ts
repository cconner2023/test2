// Utilities/peCodec.ts
// Physical Exam compact encoding/decoding for barcode format.

import { compressText, decompressText } from './textCodec';
import {
    getCategoryFromSymptomCode,
    getPECategory,
    getGeneralFindings,
    getLegacyGeneralFindings,
    getMSKBodyPart,
    VITAL_SIGNS,
    WRAPPER_BEFORE_COUNT,
} from '../Data/PhysicalExamData';
import type { CategoryLetter, AbnormalOption } from '../Data/PhysicalExamData';

// ---------------------------------------------------------------------------
// Compact PE encoding (structured state -> short string for barcode)
// ---------------------------------------------------------------------------
// v3 format: 3:{cat},{lat},{hr},{rr},{sys},{dia},{temp},{ht},{wt}~{gsBits36}~{isBits36}~{abnDetails}~{add64}
// v2 format: 2:{cat},{lat},{hr},{rr},{sys},{dia},{temp},{ht},{wt}~{gsBits36}~{isBits36}~{abnDetails}~{add64}
// v3: gsBits encodes 5 standard wrappers (GEN,HEAD,DERM,NEURO,PSYCH), flat text output
// v2: gsBits encodes legacy variable general findings per category, sectioned text output
// Status bits: 2 bits per item -- 0=not-examined, 1=normal, 2=abnormal
// Abnormal details: comma-separated "g{idx}.{chipBitmask36}[.{freetext64}]" or "i{idx}.{...}"
// Backward compat: legacy P segments don't start with "2:" or "3:" (base64 never contains ":")

const PE_NOT_EXAMINED = 0;
const PE_NORMAL = 1;
const PE_ABNORMAL = 2;

/**
 * Match abnormal detail text against known chip options, splitting recognized
 * chip labels into a bitmask and collecting everything else as free text.
 * @param text - Raw abnormal detail string (semicolon-separated segments)
 * @param options - Available abnormal chip option definitions for the finding
 * @returns Object with `chipBitmask` (bitfield of matched options) and `freeText` (unmatched segments)
 */
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

/**
 * Rebuild human-readable abnormal detail text from a chip bitmask and free text.
 * Reverses the encoding performed by {@link matchAbnormalChips}.
 * @param chipBitmask - Bitfield of selected abnormal chip options
 * @param freeText - Additional free-text details not captured by chip options
 * @param options - Available abnormal chip option definitions for the finding
 * @returns Semicolon-separated abnormal detail string, or "(no details)" if empty
 */
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

// ---------------------------------------------------------------------------
// Shared decode helpers (used by both V2 and V3 decoders)
// ---------------------------------------------------------------------------

/** Parsed fields extracted from a compact PE string by {@link parseCompactSections}. */
interface ParsedPESections {
    categoryLetter: CategoryLetter;
    laterality: string;
    vitals: Record<string, string>;
    gsBits: number;
    isBits: number;
    abnMap: Record<string, { chipBitmask: number; freeText: string }>;
    additional: string;
    categoryDef: ReturnType<typeof getPECategory>;
    bodyPart: { code: string; label: string } | null;
}

/**
 * Parse the tilde-delimited compact PE string into structured fields common
 * to both V2 and V3 formats. Both versions share the same wire format for
 * header, vitals CSV, status bits, abnormal detail entries, and additional text.
 * @param data - Raw compact PE payload (after version prefix has been stripped)
 * @param symptomCode - Algorithm symptom code used to resolve the PE category
 * @returns Parsed sections, or `null` if the data has fewer than 5 tilde-separated segments
 */
function parseCompactSections(data: string, symptomCode: string): ParsedPESections | null {
    const sections = data.split('~');
    if (sections.length < 5) return null;

    const headerParts = sections[0].split(',');
    const categoryLetter = headerParts[0] as CategoryLetter;
    const laterality = headerParts[1] || 'R';
    const vitalCsvValues = headerParts.slice(2);

    const categoryDef = getPECategory(categoryLetter);
    const dashCode = symptomCode.includes('-') ? symptomCode : symptomCode.replace(/([A-M])(\d+)/, '$1-$2');
    const bodyPart = categoryLetter === 'B' ? getMSKBodyPart(dashCode) : null;

    const vitals: Record<string, string> = {};
    VITAL_SIGNS.forEach((v, i) => { vitals[v.key] = vitalCsvValues[i] || ''; });

    const gsBits = parseInt(sections[1] || '0', 36);
    const isBits = parseInt(sections[2] || '0', 36);

    const abnMap: Record<string, { chipBitmask: number; freeText: string }> = {};
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

    let additional = '';
    if (sections[4]) additional = decompressText(sections[4]);

    return { categoryLetter, laterality, vitals, gsBits, isBits, abnMap, additional, categoryDef, bodyPart };
}

/** Extract 2-bit status for item at the given index. */
function getItemStatus(bits: number, index: number): number {
    return (bits >> (index * 2)) & 3;
}

/** Check whether any item in a bit field has been examined (status !== PE_NOT_EXAMINED). */
function hasExaminedItems(bits: number, count: number): boolean {
    for (let i = 0; i < count; i++) {
        if (getItemStatus(bits, i) !== PE_NOT_EXAMINED) return true;
    }
    return false;
}

/**
 * Format the vital signs portion of the decoded PE text.
 * Produces a "Vital Signs:" header followed by indented vital lines.
 * Blood pressure is combined into a single "BP: sys/dia mmHg" line.
 * @param vitals - Map of vital sign keys to their string values
 * @returns Array of formatted text lines, or empty array if no vitals are present
 */
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

/**
 * Format a single exam finding line from its status and abnormal detail lookup.
 * Returns `null` for not-examined items.
 * @param label - Display label for the finding (e.g. "General Appearance")
 * @param normalText - Text appended after "Normal - " when status is normal
 * @param status - 2-bit status value: 0=not-examined, 1=normal, 2=abnormal
 * @param abnKey - Key into `abnMap` for retrieving abnormal chip/free-text data
 * @param abnMap - Map of abnormal detail entries parsed from the compact string
 * @param abnormalOptions - Available chip options for reconstructing abnormal text
 * @returns Formatted line string, or `null` if the item was not examined
 */
function emitLine(
    label: string,
    normalText: string,
    status: number,
    abnKey: string,
    abnMap: Record<string, { chipBitmask: number; freeText: string }>,
    abnormalOptions?: AbnormalOption[],
): string | null {
    if (status === PE_NORMAL) {
        return normalText ? `${label}: Normal - ${normalText}` : `${label}: Normal`;
    } else if (status === PE_ABNORMAL) {
        const abn = abnMap[abnKey];
        const abnText = rebuildAbnormalText(abn?.chipBitmask || 0, abn?.freeText || '', abnormalOptions);
        return `${label}: Abnormal - ${abnText}`;
    }
    return null;
}

/**
 * Encode physical exam text into a compact structured string for barcode storage.
 * Falls back to compressed text if the symptom code has no PE category mapping.
 * @param peText - Human-readable physical exam note text
 * @param symptomCode - Algorithm symptom code (e.g. "A-1") used to determine the PE category
 * @returns Compact v3 PE string or compressed fallback
 */
export function encodePECompact(peText: string, symptomCode: string): string {
    const dashCode = symptomCode.includes('-') ? symptomCode : symptomCode.replace(/([A-M])(\d+)/, '$1-$2');
    const categoryLetter = getCategoryFromSymptomCode(dashCode);
    if (!categoryLetter) return compressText(peText);

    const categoryDef = getPECategory(categoryLetter);
    const wrapperDefs = getGeneralFindings(categoryLetter); // always 5 standard wrappers

    const vitalValues: Record<string, string> = {};
    const generalStatuses: number[] = new Array(wrapperDefs.length).fill(PE_NOT_EXAMINED);
    const generalAbn: { idx: number; chipBitmask: number; freeText: string }[] = [];
    const itemStatuses: number[] = new Array(categoryDef.items.length).fill(PE_NOT_EXAMINED);
    const itemAbn: { idx: number; chipBitmask: number; freeText: string }[] = [];
    let laterality = 'R';
    let additional = '';

    const lines = peText.split('\n');
    let inVitals = false;
    let inAdditional = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Additional Findings
        if (trimmed.startsWith('Additional Findings:')) {
            inAdditional = true;
            inVitals = false;
            additional = trimmed.replace('Additional Findings:', '').trim();
            continue;
        }
        if (inAdditional) { additional += '\n' + trimmed; continue; }

        // Vitals header
        if (trimmed === 'Vital Signs:' || trimmed === 'Vital Signs') { inVitals = true; continue; }
        if (inVitals) {
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
                    continue;
                }
            }
            if (trimmed) inVitals = false;
            else continue;
        }

        // Skip old section headers (backward compat)
        if (trimmed === 'General:') continue;
        if (trimmed.startsWith(`${categoryDef.label}:`)) continue;

        // MSK context line (extract laterality)
        if (trimmed.startsWith('MSK')) {
            const latMatch = trimmed.match(/\((Left|Right|Bilateral)\)/i);
            if (latMatch) laterality = latMatch[1][0].toUpperCase();
            continue;
        }

        // Try matching wrapper items (case-insensitive for old/new label formats)
        const upper = trimmed.toUpperCase();
        let matched = false;
        for (let gi = 0; gi < wrapperDefs.length; gi++) {
            const g = wrapperDefs[gi];
            if (upper.startsWith(`${g.label.toUpperCase()}:`)) {
                const rest = trimmed.slice(g.label.length + 1).trim();
                if (rest.startsWith('Normal')) {
                    generalStatuses[gi] = PE_NORMAL;
                } else if (rest.startsWith('Abnormal')) {
                    generalStatuses[gi] = PE_ABNORMAL;
                    const abnText = rest.replace(/^Abnormal\s*-?\s*/, '').trim();
                    const { chipBitmask, freeText } = matchAbnormalChips(abnText, g.abnormalOptions);
                    generalAbn.push({ idx: gi, chipBitmask, freeText });
                }
                matched = true;
                break;
            }
        }
        if (matched) continue;

        // Try matching category items (case-insensitive)
        for (let ii = 0; ii < categoryDef.items.length; ii++) {
            const item = categoryDef.items[ii];
            if (upper.startsWith(`${item.label.toUpperCase()}:`)) {
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
    }

    // Build compact string (v3 format)
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

    return `3:${categoryLetter},${laterality},${vitalsCsv}~${gsBits.toString(36)}~${isBits.toString(36)}~${abnParts.join(',')}~${add64}`;
}

/**
 * Decode a v2-format compact PE string back into sectioned human-readable text.
 * V2 output uses "General:" section headers and legacy per-category general findings.
 * @param data - Raw v2 compact payload (version prefix already stripped)
 * @param symptomCode - Algorithm symptom code used to resolve the PE category
 * @returns Reconstructed multi-line physical exam text in the legacy sectioned format
 */
function decodePECompactV2(data: string, symptomCode: string): string {
    const parsed = parseCompactSections(data, symptomCode);
    if (!parsed) return '';

    const { categoryLetter, laterality, vitals, gsBits, isBits, abnMap, additional, categoryDef, bodyPart } = parsed;
    const legacyDefs = getLegacyGeneralFindings(categoryLetter);

    // Reconstruct old-format text (parseInitialText handles backward compat)
    const textParts: string[] = formatVitalsText(vitals);

    if (hasExaminedItems(gsBits, legacyDefs.length)) {
        if (textParts.length > 0) textParts.push('');
        textParts.push('General:');
        for (let gi = 0; gi < legacyDefs.length; gi++) {
            const status = getItemStatus(gsBits, gi);
            if (status === PE_NOT_EXAMINED) continue;
            const g = legacyDefs[gi];
            const line = emitLine(g.label, g.normalText, status, `g${gi}`, abnMap, g.abnormalOptions);
            if (line) textParts.push(line);
        }
    }

    if (hasExaminedItems(isBits, categoryDef.items.length)) {
        if (textParts.length > 0) textParts.push('');
        if (categoryDef.category === 'B' && bodyPart) {
            const latLabel = laterality === 'B' ? 'Bilateral' : laterality === 'L' ? 'Left' : 'Right';
            textParts.push(`MSK - ${bodyPart.label} (${latLabel})`);
        }
        for (let ii = 0; ii < categoryDef.items.length; ii++) {
            const status = getItemStatus(isBits, ii);
            if (status === PE_NOT_EXAMINED) continue;
            const item = categoryDef.items[ii];
            const line = emitLine(item.label, item.normalText || '', status, `i${ii}`, abnMap, item.abnormalOptions);
            if (line) textParts.push(line);
        }
    }

    if (additional.trim()) {
        if (textParts.length > 0) textParts.push('');
        textParts.push(`Additional Findings: ${additional.trim()}`);
    }

    return textParts.join('\n');
}

/**
 * Decode a v3-format compact PE string back into flat human-readable text.
 * V3 output interleaves "before" wrappers (GEN, HEAD), then category items,
 * then "after" wrappers (DERM, NEURO, PSYCH) with no section headers.
 * @param data - Raw v3 compact payload (version prefix already stripped)
 * @param symptomCode - Algorithm symptom code used to resolve the PE category
 * @returns Reconstructed multi-line physical exam text in the flat v3 format
 */
function decodePECompactV3(data: string, symptomCode: string): string {
    const parsed = parseCompactSections(data, symptomCode);
    if (!parsed) return '';

    const { categoryLetter, laterality, vitals, gsBits, isBits, abnMap, additional, categoryDef, bodyPart } = parsed;
    const wrapperDefs = getGeneralFindings(categoryLetter); // standard 5 wrappers

    // Reconstruct flat PE text (new format: no section headers)
    const textParts: string[] = formatVitalsText(vitals);

    const examLines: string[] = [];

    // Before wrappers (GEN, HEAD)
    for (let gi = 0; gi < WRAPPER_BEFORE_COUNT; gi++) {
        const status = getItemStatus(gsBits, gi);
        if (status === PE_NOT_EXAMINED) continue;
        const g = wrapperDefs[gi];
        const line = emitLine(g.label, g.normalText, status, `g${gi}`, abnMap, g.abnormalOptions);
        if (line) examLines.push(line);
    }

    // MSK context
    if (categoryDef.category === 'B' && bodyPart) {
        if (hasExaminedItems(isBits, categoryDef.items.length)) {
            const latLabel = laterality === 'B' ? 'Bilateral' : laterality === 'L' ? 'Left' : 'Right';
            examLines.push(`MSK - ${bodyPart.label} (${latLabel})`);
        }
    }

    // Category items
    for (let ii = 0; ii < categoryDef.items.length; ii++) {
        const status = getItemStatus(isBits, ii);
        if (status === PE_NOT_EXAMINED) continue;
        const item = categoryDef.items[ii];
        const line = emitLine(item.label, item.normalText || '', status, `i${ii}`, abnMap, item.abnormalOptions);
        if (line) examLines.push(line);
    }

    // After wrappers (DERM, NEURO, PSYCH)
    for (let gi = WRAPPER_BEFORE_COUNT; gi < wrapperDefs.length; gi++) {
        const status = getItemStatus(gsBits, gi);
        if (status === PE_NOT_EXAMINED) continue;
        const g = wrapperDefs[gi];
        const line = emitLine(g.label, g.normalText, status, `g${gi}`, abnMap, g.abnormalOptions);
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

/**
 * Decode a compact PE string (v2 or v3) back into human-readable physical exam text.
 * @param encoded - Compact PE-encoded string (prefixed "3:" or "2:" for version)
 * @param symptomCode - Algorithm symptom code used to resolve the PE category definition
 * @returns Reconstructed multi-line physical exam text
 */
export function decodePECompact(encoded: string, symptomCode: string): string {
    if (encoded.startsWith('3:')) {
        return decodePECompactV3(encoded.substring(2), symptomCode);
    }
    // Legacy v2 format
    const data = encoded.startsWith('2:') ? encoded.substring(2) : encoded;
    return decodePECompactV2(data, symptomCode);
}
