// Utilities/peCodec.ts
// Physical Exam compact encoding/decoding — v6 format.
// v6 encodes/decodes directly from PEState using the paired findings model
// (selectedNormals + selectedAbnormals per block, no legacy chip/status bits).

import { compressText, decompressText } from './textCodec';
import {
    getCategoryFromSymptomCode,
    getMSKBodyPart,
    isBackPainCode,
    VITAL_SIGNS,
    BASELINE_BEFORE_COUNT,
    getBaselineWrappers,
    getFocusedBlocks,
    BLOCK_LIBRARY,
} from '../Data/PhysicalExamData';
import type { CategoryLetter, AbnormalOption, PEFinding, PEBlock } from '../Data/PhysicalExamData';
import type { PEState, PEItemState } from '../Types/PETypes';

// ---------------------------------------------------------------------------
// V6 encoder
// ---------------------------------------------------------------------------
// Format: 6:{cat},{lat}[/{spineRegion}],{vitalsCsv}~{blockEntries}~{compressedAdditional}
// blockEntries: pipe-separated "{blockKey}:{normalBitmask36}.{abnormalBitmask36}[.{compressedFreeText}]"

/** Encode PE state directly into compact v6 string. */
export function encodePEState(state: PEState): string {
    const { categoryLetter, laterality, spineRegion, vitals, items, additional } = state;

    // Vitals CSV
    const vitalsCsv = VITAL_SIGNS.map(v => vitals[v.key] || '').join(',');

    // Laterality char
    const latChar = laterality ? laterality[0].toUpperCase() : 'R';
    const latField = (categoryLetter === 'B' && spineRegion) ? `${latChar}/${spineRegion}` : latChar;

    // Block entries — only include blocks that have been examined
    const blockEntries: string[] = [];

    for (const [blockKey, itemState] of Object.entries(items)) {
        if (!itemState || itemState.status === 'not-examined') continue;

        const block = BLOCK_LIBRARY[blockKey];
        if (!block) continue;

        const normalBitmask = normalsToBitmask(itemState.selectedNormals, block.findings);
        const abnormalBitmask = abnormalsToBitmask(itemState.selectedAbnormals, block.findings);

        let entry = `${blockKey}:${normalBitmask.toString(36)}.${abnormalBitmask.toString(36)}`;
        if (itemState.findings.trim()) {
            entry += `.${compressText(itemState.findings.trim())}`;
        }
        blockEntries.push(entry);
    }

    const add64 = additional.trim() ? compressText(additional.trim()) : '';

    return `6:${categoryLetter},${latField},${vitalsCsv}~${blockEntries.join('^')}~${add64}`;
}

// ---------------------------------------------------------------------------
// V6 decoder
// ---------------------------------------------------------------------------

/** Decode a compact v6 PE string back into PEState. Returns null on parse failure. */
export function decodePEState(encoded: string, symptomCode: string): PEState | null {
    if (!encoded.startsWith('6:')) return null;
    const data = encoded.substring(2);

    const sections = data.split('~');
    if (sections.length < 3) return null;

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

    // Block entries
    const items: Record<string, PEItemState> = {};
    if (sections[1]) {
        for (const entry of sections[1].split(/[|^]/).filter(Boolean)) {
            const colonIdx = entry.indexOf(':');
            if (colonIdx === -1) continue;
            const blockKey = entry.substring(0, colonIdx);
            const rest = entry.substring(colonIdx + 1);
            const dotParts = rest.split('.');
            const normalBitmask = parseInt(dotParts[0] || '0', 36);
            const abnormalBitmask = parseInt(dotParts[1] || '0', 36);
            let freeText = '';
            if (dotParts.length > 2) freeText = decompressText(dotParts.slice(2).join('.'));

            const block = BLOCK_LIBRARY[blockKey];
            if (!block) continue;

            const selectedNormals = bitmaskToNormals(normalBitmask, block.findings);
            const selectedAbnormals = bitmaskToAbnormals(abnormalBitmask, block.findings);

            const hasNormals = selectedNormals.length > 0;
            const hasAbnormals = selectedAbnormals.length > 0;
            const status = hasAbnormals ? 'abnormal' : hasNormals ? 'normal' : 'normal';

            items[blockKey] = { status, selectedNormals, selectedAbnormals, findings: freeText };
        }
    }

    const additional = sections[2] ? decompressText(sections[2]) : '';

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
    const dashCode = `${state.categoryLetter}-1`;
    return renderPEStateToTextWithCode(state, dashCode);
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
        examLines.push(formatItemLine(b, itemState));
    }

    if (categoryLetter === 'B' && bodyPart) {
        const hasExamined = focusedBlocks.some(b => items[b.key] && items[b.key].status !== 'not-examined');
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
        examLines.push(formatItemLine(b, itemState));
    }

    for (const b of afterWrappers) {
        const itemState = items[b.key];
        if (!itemState || itemState.status === 'not-examined') continue;
        examLines.push(formatItemLine(b, itemState));
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
// Public compat wrapper
// ---------------------------------------------------------------------------

/**
 * Decode a compact PE string (v6) back into human-readable text.
 * Used by noteParser and NoteCodec barrel for reading stored barcodes.
 */
export function decodePECompact(encoded: string, symptomCode: string): string {
    const state = decodePEState(encoded, symptomCode);
    return state ? renderPEStateToTextWithCode(state, symptomCode) : '';
}

// ---------------------------------------------------------------------------
// Internal helpers — bitmask encoding
// ---------------------------------------------------------------------------

/** Flatten all abnormal options across all findings in order. */
function flattenAbnormals(findings: PEFinding[]): AbnormalOption[] {
    const result: AbnormalOption[] = [];
    for (const f of findings) {
        for (const a of f.abnormals) {
            result.push(a);
        }
    }
    return result;
}

function normalsToBitmask(selectedNormals: string[], findings: PEFinding[]): number {
    let bitmask = 0;
    for (let i = 0; i < findings.length; i++) {
        if (selectedNormals.includes(findings[i].key)) {
            bitmask |= (1 << i);
        }
    }
    return bitmask;
}

function abnormalsToBitmask(selectedAbnormals: string[], findings: PEFinding[]): number {
    const allAbnormals = flattenAbnormals(findings);
    let bitmask = 0;
    for (let i = 0; i < allAbnormals.length; i++) {
        if (selectedAbnormals.includes(allAbnormals[i].key)) {
            bitmask |= (1 << i);
        }
    }
    return bitmask;
}

function bitmaskToNormals(bitmask: number, findings: PEFinding[]): string[] {
    const keys: string[] = [];
    for (let i = 0; i < findings.length; i++) {
        if ((bitmask >> i) & 1) keys.push(findings[i].key);
    }
    return keys;
}

function bitmaskToAbnormals(bitmask: number, findings: PEFinding[]): string[] {
    const allAbnormals = flattenAbnormals(findings);
    const keys: string[] = [];
    for (let i = 0; i < allAbnormals.length; i++) {
        if ((bitmask >> i) & 1) keys.push(allAbnormals[i].key);
    }
    return keys;
}

// ---------------------------------------------------------------------------
// Internal helpers — text formatting
// ---------------------------------------------------------------------------

function charToLaterality(char: string): PEState['laterality'] {
    const c = char.toUpperCase();
    if (c === 'L') return 'left';
    if (c === 'B') return 'bilateral';
    return 'right';
}

function formatItemLine(block: PEBlock, itemState: PEItemState): string {
    const uLabel = block.label.toUpperCase();

    // Resolve normal labels from finding keys
    const normalLabels: string[] = [];
    if (itemState.selectedNormals.length > 0) {
        for (const f of block.findings) {
            if (itemState.selectedNormals.includes(f.key)) {
                normalLabels.push(f.normal);
            }
        }
    }

    // Resolve abnormal labels from flattened abnormal options
    const abnormalLabels: string[] = [];
    if (itemState.selectedAbnormals.length > 0) {
        const allAbnormals = flattenAbnormals(block.findings);
        for (const opt of allAbnormals) {
            if (itemState.selectedAbnormals.includes(opt.key)) {
                abnormalLabels.push(opt.label);
            }
        }
    }

    const freeText = itemState.findings.trim();

    if (normalLabels.length > 0 && abnormalLabels.length > 0) {
        let line = `${uLabel}: ${normalLabels.join(', ')}. ${abnormalLabels.join('; ')}`;
        if (freeText) line += `; ${freeText}`;
        return line;
    }
    if (normalLabels.length > 0) {
        let line = `${uLabel}: ${normalLabels.join(', ')}`;
        if (freeText) line += `; ${freeText}`;
        return line;
    }
    if (abnormalLabels.length > 0) {
        let line = `${uLabel}: ${abnormalLabels.join('; ')}`;
        if (freeText) line += `; ${freeText}`;
        return line;
    }
    if (freeText) return `${uLabel}: ${freeText}`;
    return `${uLabel}: Normal`;
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
