// Utilities/peCodec.ts
// Physical Exam compact encoding/decoding — v8 (index-based condensed format).
// v8 encodes only deviations from the "all examined, all normal" default.
// v6/v7 deleted — no legacy barcodes to support.

import { compressText, decompressText } from './textCodec';
import {
    VITAL_SIGNS,
    MASTER_BLOCK_LIBRARY,
    getBlocksForFocusedExam,
} from '../Data/PhysicalExamData';
import type {
    CategoryLetter,
    AbnormalOption,
    MasterPEFinding,
} from '../Data/PhysicalExamData';
import type { PEState, PEItemState } from '../Types/PETypes';

// ---------------------------------------------------------------------------
// Index encoding helpers (single base-36 char: 0-9 = 0-9, a-z = 10-35)
// ---------------------------------------------------------------------------

function idxToChar(i: number): string {
    return i < 10 ? String(i) : String.fromCharCode(87 + i); // 87 + 10 = 'a'
}

function charToIdx(c: string): number {
    const code = c.charCodeAt(0);
    return code >= 97 ? code - 87 : code - 48; // 'a'→10, '0'→0
}

// ---------------------------------------------------------------------------
// Flatten master abnormals (shared between encode and decode)
// ---------------------------------------------------------------------------

function flattenMasterAbnormals(findings: MasterPEFinding[]): AbnormalOption[] {
    const result: AbnormalOption[] = [];
    for (const f of findings) {
        for (const a of f.abnormals) result.push(a);
    }
    return result;
}

// ---------------------------------------------------------------------------
// Canonical block list resolution
// ---------------------------------------------------------------------------

interface CanonicalBlock { key: string; findings: MasterPEFinding[] }

function getCanonicalBlocks(state: Pick<PEState, 'mode' | 'blockKeys' | 'categoryLetter'>, symptomCode?: string): CanonicalBlock[] {
    if (state.mode === 'template' && state.blockKeys?.length) {
        return state.blockKeys
            .map(key => {
                const block = MASTER_BLOCK_LIBRARY[key];
                return block ? { key: block.key, findings: block.findings } : null;
            })
            .filter((b): b is CanonicalBlock => b !== null);
    }
    const code = symptomCode || `${state.categoryLetter}-1`;
    const { blocks } = getBlocksForFocusedExam(state.categoryLetter, code);
    return blocks.map(b => ({ key: b.key, findings: b.findings }));
}

// ---------------------------------------------------------------------------
// V8 encoder
// ---------------------------------------------------------------------------
// Format: 8:{cat},{lat}[/{spine}],{mode},{vitalsCsv}~{peBody}~{compressedAdditional}

/** Encode PE state into compact v8 string. symptomCode needed for focused mode canonical resolution. */
export function encodePEState(state: PEState, symptomCode?: string): string {
    const mode: 'focused' | 'template' = state.mode ?? 'focused';
    const { categoryLetter, laterality, spineRegion, vitals, items, additional } = state;

    const vitalsCsv = VITAL_SIGNS.map(v => vitals[v.key] || '').join(',');

    const latChar = laterality ? laterality[0].toUpperCase() : 'R';
    const latField = (categoryLetter === 'B' && spineRegion) ? `${latChar}/${spineRegion}` : latChar;

    const modeField = mode === 'template'
        ? `T:${(state.blockKeys || []).join(',')}`
        : 'F';

    // Resolve canonical block list and build index lookup
    const canonical = getCanonicalBlocks(state, symptomCode);
    const canonicalKeyIndex = new Map<string, number>();
    canonical.forEach((b, i) => canonicalKeyIndex.set(b.key, i));

    // Build reorder prefix from blockOrder (array of block keys in display order)
    let reorderPrefix = '';
    if (state.blockOrder?.length) {
        const indices = state.blockOrder
            .map(key => canonicalKeyIndex.get(key))
            .filter((i): i is number => i !== undefined);
        if (indices.length > 0) {
            reorderPrefix = `!{${indices.map(idxToChar).join('')}}`;
        }
    }

    // Build block entries — only blocks that deviate from the "all normal" default
    const entries: string[] = [];

    for (const [blockKey, itemState] of Object.entries(items)) {
        if (!itemState || itemState.status === 'not-examined') continue;

        const blockIdx = canonicalKeyIndex.get(blockKey);
        if (blockIdx === undefined) continue;

        const masterBlock = MASTER_BLOCK_LIBRARY[blockKey];
        if (!masterBlock) continue;

        const allFindings = masterBlock.findings;
        const allAbnormals = flattenMasterAbnormals(allFindings);

        // Determine which findings are assessed (normal selected or has abnormals)
        const assessedIndices: number[] = [];
        for (let fi = 0; fi < allFindings.length; fi++) {
            const f = allFindings[fi];
            if (itemState.selectedNormals.includes(f.key)) {
                assessedIndices.push(fi);
            } else if (f.abnormals.some(a => itemState.selectedAbnormals.includes(a.key))) {
                assessedIndices.push(fi);
            }
        }

        // Determine abnormal indices in the flattened list
        const abnormalIndices: number[] = [];
        for (let ai = 0; ai < allAbnormals.length; ai++) {
            if (itemState.selectedAbnormals.includes(allAbnormals[ai].key)) {
                abnormalIndices.push(ai);
            }
        }

        const hasFreeText = itemState.findings.trim().length > 0;
        const isPartial = assessedIndices.length < allFindings.length;

        // Skip blocks that are fully normal with no free text (the default)
        if (abnormalIndices.length === 0 && !hasFreeText) continue;

        let entry = idxToChar(blockIdx);

        // Partial exam — only some findings assessed
        if (isPartial) {
            entry += `[${assessedIndices.map(idxToChar).join('')}]`;
        }

        // Abnormal chars + optional free text
        entry += ':' + abnormalIndices.map(idxToChar).join('');
        if (hasFreeText) {
            entry += '.' + compressText(itemState.findings.trim());
        }

        entries.push(entry);
    }

    const peBody = reorderPrefix + entries.join('-');
    const add64 = additional.trim() ? compressText(additional.trim()) : '';

    return `8:${categoryLetter},${latField},${modeField},${vitalsCsv}~${peBody}~${add64}`;
}

// ---------------------------------------------------------------------------
// V8 decoder
// ---------------------------------------------------------------------------

function decodePEStateV8(data: string, symptomCode: string): PEState | null {
    const sections = data.split('~');
    if (sections.length < 3) return null;

    const headerParts = sections[0].split(',');
    if (headerParts.length < 3) return null;

    const categoryLetter = headerParts[0] as CategoryLetter;
    const latField = headerParts[1] || 'R';
    const rawModeField = headerParts[2] || 'F';

    // Parse mode and block keys
    let mode: 'focused' | 'template' = 'focused';
    let blockKeys: string[] | undefined;
    let vitalCsvValues: string[];

    if (rawModeField.startsWith('T')) {
        mode = 'template';
        const vitalsCount = VITAL_SIGNS.length;
        const vitalsStart = headerParts.length - vitalsCount;
        const modeAndKeys = headerParts.slice(2, vitalsStart).join(',');
        const afterT = modeAndKeys.startsWith('T:') ? modeAndKeys.substring(2) : modeAndKeys.substring(1);
        blockKeys = afterT ? afterT.split(',').filter(Boolean) : [];
        vitalCsvValues = headerParts.slice(vitalsStart);
    } else {
        vitalCsvValues = headerParts.slice(3);
    }

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

    // Resolve canonical block list
    const canonical = getCanonicalBlocks({ categoryLetter, mode, blockKeys }, symptomCode);

    // Parse PE body
    const peBody = sections[1] || '';
    const items: Record<string, PEItemState> = {};

    // Parse reorder prefix
    let blockOrder: string[] | undefined;
    let bodyRest = peBody;

    if (bodyRest.startsWith('!{')) {
        const closeIdx = bodyRest.indexOf('}');
        if (closeIdx > 0) {
            const reorderChars = bodyRest.substring(2, closeIdx);
            blockOrder = [];
            for (const ch of reorderChars) {
                const idx = charToIdx(ch);
                if (idx >= 0 && idx < canonical.length) {
                    blockOrder.push(canonical[idx].key);
                }
            }
            bodyRest = bodyRest.substring(closeIdx + 1);
        }
    }

    // Track which blocks have explicit entries
    const explicitBlocks = new Set<number>();

    if (bodyRest) {
        for (const entry of bodyRest.split('-').filter(Boolean)) {
            let pos = 0;
            const blockIdx = charToIdx(entry[pos]);
            pos++;
            explicitBlocks.add(blockIdx);

            if (blockIdx < 0 || blockIdx >= canonical.length) continue;
            const canonBlock = canonical[blockIdx];
            const masterBlock = MASTER_BLOCK_LIBRARY[canonBlock.key];
            if (!masterBlock) continue;

            // Parse optional partial exam indices [findingIndices]
            let assessedFindingIndices: number[] | null = null;
            if (pos < entry.length && entry[pos] === '[') {
                pos++;
                const closeBracket = entry.indexOf(']', pos);
                if (closeBracket > pos) {
                    assessedFindingIndices = [];
                    for (let i = pos; i < closeBracket; i++) {
                        assessedFindingIndices.push(charToIdx(entry[i]));
                    }
                    pos = closeBracket + 1;
                }
            }

            // Parse :abnormalChars[.compressedText]
            let abnormalIndices: number[] = [];
            let freeText = '';
            if (pos < entry.length && entry[pos] === ':') {
                pos++;
                const dotIdx = entry.indexOf('.', pos);
                const abnormalStr = dotIdx >= 0 ? entry.substring(pos, dotIdx) : entry.substring(pos);
                abnormalIndices = [...abnormalStr].map(charToIdx);
                if (dotIdx >= 0) {
                    freeText = decompressText(entry.substring(dotIdx + 1));
                }
            }

            // Reconstruct PEItemState
            const allFindings = masterBlock.findings;
            const allAbnormals = flattenMasterAbnormals(allFindings);

            const assessedSet = new Set(assessedFindingIndices ?? allFindings.map((_, i) => i));

            // Resolve selected abnormals from indices
            const selectedAbnormals: string[] = [];
            const abnormalKeySet = new Set<string>();
            for (const ai of abnormalIndices) {
                if (ai >= 0 && ai < allAbnormals.length) {
                    selectedAbnormals.push(allAbnormals[ai].key);
                    abnormalKeySet.add(allAbnormals[ai].key);
                }
            }

            // Resolve selected normals: assessed findings whose abnormals aren't selected
            const selectedNormals: string[] = [];
            for (const fi of assessedSet) {
                if (fi < 0 || fi >= allFindings.length) continue;
                const f = allFindings[fi];
                const hasAbnormal = f.abnormals.some(a => abnormalKeySet.has(a.key));
                if (!hasAbnormal) {
                    selectedNormals.push(f.key);
                }
            }

            const status = selectedAbnormals.length > 0 ? 'abnormal' : 'normal';
            items[canonBlock.key] = { status, selectedNormals, selectedAbnormals, findings: freeText };
        }
    }

    // Fill in default blocks (unlisted = all examined, all normal)
    for (let i = 0; i < canonical.length; i++) {
        if (explicitBlocks.has(i)) continue;
        const block = canonical[i];
        items[block.key] = {
            status: 'normal',
            selectedNormals: block.findings.map(f => f.key),
            selectedAbnormals: [],
            findings: '',
        };
    }

    const additional = sections[2] ? decompressText(sections[2]) : '';

    return {
        categoryLetter,
        laterality,
        spineRegion,
        vitals,
        items,
        additional,
        mode,
        blockKeys,
        blockOrder,
    };
}

// ---------------------------------------------------------------------------
// Public decode dispatcher
// ---------------------------------------------------------------------------

/** Decode a compact PE string (v8) back into PEState. Returns null on parse failure. */
export function decodePEState(encoded: string, symptomCode: string): PEState | null {
    if (encoded.startsWith('8:')) return decodePEStateV8(encoded.substring(2), symptomCode);
    return null;
}

// ---------------------------------------------------------------------------
// Text renderer
// ---------------------------------------------------------------------------

/** Render PEState into human-readable text (for display/preview). */
export function renderPEStateToText(state: PEState): string {
    const dashCode = `${state.categoryLetter}-1`;
    return renderPEStateToTextWithCode(state, dashCode);
}

/** Render PEState with the real symptom code for accurate focused block resolution. */
export function renderPEStateToTextWithCode(state: PEState, symptomCode: string): string {
    const { categoryLetter, vitals, items, additional } = state;

    const parts: string[] = [...formatVitalsText(vitals)];
    const examLines: string[] = [];

    const isTemplate = state.mode === 'template';
    let orderedKeys: string[];

    if (isTemplate && state.blockKeys?.length) {
        orderedKeys = state.blockKeys;
    } else {
        const { blocks } = getBlocksForFocusedExam(categoryLetter, symptomCode);
        orderedKeys = blocks.map(b => b.key);
    }

    // Include any item keys not in the ordered list
    const orderedSet = new Set(orderedKeys);
    for (const key of Object.keys(items)) {
        if (!orderedSet.has(key)) orderedKeys.push(key);
    }

    for (const blockKey of orderedKeys) {
        const itemState = items[blockKey];
        if (!itemState || itemState.status === 'not-examined') continue;

        const block = MASTER_BLOCK_LIBRARY[blockKey];
        if (!block) continue;

        examLines.push(formatItemLineMaster(block, itemState));
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

/** Decode a compact PE string back into human-readable text. */
export function decodePECompact(encoded: string, symptomCode: string): string {
    const state = decodePEState(encoded, symptomCode);
    return state ? renderPEStateToTextWithCode(state, symptomCode) : '';
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

function formatItemLineMaster(block: { label: string; findings: MasterPEFinding[] }, itemState: PEItemState): string {
    const uLabel = block.label.toUpperCase();

    const normalLabels: string[] = [];
    if (itemState.selectedNormals.length > 0) {
        for (const f of block.findings) {
            if (itemState.selectedNormals.includes(f.key)) {
                normalLabels.push(f.normal);
            }
        }
    }

    const abnormalLabels: string[] = [];
    if (itemState.selectedAbnormals.length > 0) {
        const allAbnormals = flattenMasterAbnormals(block.findings);
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
