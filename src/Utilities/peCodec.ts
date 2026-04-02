// Utilities/peCodec.ts
// Physical Exam compact encoding/decoding — v6 (legacy) + v7 (master blocks).
// v7 uses MASTER_BLOCK_LIBRARY with tiered findings, mode field, and master block keys.
// v6 kept for backward compatibility — decodes old keys and maps to master block keys.

import { compressText, decompressText } from './textCodec';
import {
    getCategoryFromSymptomCode,
    VITAL_SIGNS,
    BASELINE_BEFORE_COUNT,
    getBaselineWrappers,
    getFocusedBlocks,
    BLOCK_LIBRARY,
    MASTER_BLOCK_LIBRARY,
    getMasterBlockByKey,
    FOCUSED_EXPANSION,
    BASELINE_BEFORE,
    BASELINE_AFTER,
    getBlocksForFocusedExam,
} from '../Data/PhysicalExamData';
import type {
    CategoryLetter,
    AbnormalOption,
    PEFinding,
    PEBlock,
    MasterPEBlock,
    MasterPEFinding,
} from '../Data/PhysicalExamData';
import type { PEState, PEItemState } from '../Types/PETypes';

// ---------------------------------------------------------------------------
// Old key → master key mapping (for v6 backward compat)
// ---------------------------------------------------------------------------

const OLD_KEY_TO_MASTER: Record<string, string> = {
    // Baseline wrappers
    'bl_gen': 'gen',
    'bl_eyes': 'eyes',
    'bl_hent': 'head',
    'bl_neuro': 'neuro',
    'bl_psych': 'psych',
    // System blocks
    'sys_ears': 'ears',
    'sys_nose': 'nose',
    'sys_oral': 'oral_throat',
    'sys_pharynx': 'oral_throat',
    'sys_neck': 'neck',
    'sys_cv': 'cv',
    'sys_pulm': 'pulm',
    'sys_abd': 'abd',
    'sys_msk': 'msk',
    'sys_derm': 'derm',
    'sys_extremities': 'extremities',
    'sys_gu': 'gu',
    'sys_breast': 'breast',
    'sys_rectal': 'rectal',
    'sys_lymph': 'lymph',
    // Cat A (HEENT)
    'cat_a_ears': 'ears',
    'cat_a_nose': 'nose',
    'cat_a_throat': 'oral_throat',
    'cat_a_oralCavity': 'oral_throat',
    'cat_a_neck': 'neck',
    'cat_a_cv': 'cv',
    'cat_a_pulm': 'pulm',
    // Cat B (MSK)
    'cat_b_inspection': 'msk',
    'cat_b_palpation': 'msk',
    'cat_b_rom': 'msk',
    'cat_b_strength': 'msk',
    'cat_b_specialTests': 'msk',
    'cat_b_neurovascular': 'msk',
    // Cat C (GI)
    'cat_c_inspection': 'abd',
    'cat_c_auscultation': 'abd',
    'cat_c_palpation': 'abd',
    'cat_c_percussion': 'abd',
    'cat_c_rectal': 'rectal',
    // Cat D (Cardiorespiratory)
    'cat_d_heartSounds': 'cv',
    'cat_d_lungSounds': 'pulm',
    'cat_d_respiratoryEffort': 'pulm',
    'cat_d_chestWall': 'pulm',
    'cat_d_peripheralPulses': 'cv',
    // Cat E (GU)
    'cat_e_abdomen': 'abd',
    'cat_e_cva': 'abd',
    'cat_e_externalGenitalia': 'gu',
    'cat_e_inguinal': 'gu',
    // Cat F (Neuropsych)
    'cat_f_mentalStatus': 'neuro',
    'cat_f_cranialNerves': 'neuro',
    'cat_f_motor': 'neuro',
    'cat_f_sensory': 'neuro',
    'cat_f_reflexes': 'neuro',
    'cat_f_coordination': 'neuro',
    // Cat G (Constitutional)
    'cat_g_generalAppearance': 'gen',
    'cat_g_skinColorTemp': 'derm',
    'cat_g_cv': 'cv',
    'cat_g_respiratory': 'pulm',
    // Cat H (Eye)
    'cat_h_visualAcuity': 'eyes',
    'cat_h_pupils': 'eyes',
    'cat_h_eom': 'eyes',
    'cat_h_conjunctivaSclera': 'eyes',
    'cat_h_fundoscopy': 'eyes',
    'cat_h_eyelids': 'eyes',
    // Cat I (Gyn)
    'cat_i_breast': 'breast',
    'cat_i_externalGenitalia': 'gyn',
    'cat_i_vaginalCervical': 'gyn',
    'cat_i_uterusAdnexa': 'gyn',
    // Cat J (Derm)
    'cat_j_locationDistribution': 'derm',
    'cat_j_morphology': 'derm',
    'cat_j_color': 'derm',
    'cat_j_sizeShape': 'derm',
    'cat_j_textureSurface': 'derm',
    'cat_j_surroundingSkin': 'derm',
    // Cat K (Environmental)
    'cat_k_skinAssessment': 'derm',
    'cat_k_circulation': 'extremities',
    'cat_k_sensation': 'neuro',
    'cat_k_temperature': 'gen',
    'cat_k_mentalStatus': 'neuro',
    // Cat L (Misc)
    'cat_l_generalAppearance': 'gen',
    'cat_l_oralDental': 'oral_throat',
    'cat_l_lymphNodes': 'lymph',
    // Cat M (Return Visit)
    'cat_m_generalAppearance': 'gen',
    'cat_m_relevantSystem': 'gen',
    'cat_m_comparisonToPrevious': 'gen',
};

// ---------------------------------------------------------------------------
// V7 encoder
// ---------------------------------------------------------------------------
// Format: 7:{cat},{lat}[/{spineRegion}],{mode},{vitalsCsv}~{blockEntries}~{compressedAdditional}
// mode: F (focused) or T:{key1},{key2},... (template with block keys)
// blockEntries: caret-separated "{masterKey}:{normalBitmask36}.{abnormalBitmask36}[.{compressedFreeText}]"

/** Encode PE state into compact v7 string using master block keys. */
export function encodePEState(state: PEState): string {
    // Resolve mode — if only deprecated depth is present, convert
    const mode: 'focused' | 'template' = state.mode ?? (state.depth === 'comprehensive' || state.depth === 'custom' ? 'template' : 'focused');
    const { categoryLetter, laterality, spineRegion, vitals, items, additional } = state;

    // Vitals CSV
    const vitalsCsv = VITAL_SIGNS.map(v => vitals[v.key] || '').join(',');

    // Laterality char
    const latChar = laterality ? laterality[0].toUpperCase() : 'R';
    const latField = (categoryLetter === 'B' && spineRegion) ? `${latChar}/${spineRegion}` : latChar;

    // Mode field
    const modeField = mode === 'template'
        ? `T:${(state.blockKeys || []).join(',')}`
        : 'F';

    // Block entries — only include blocks that have been examined
    const blockEntries: string[] = [];

    for (const [blockKey, itemState] of Object.entries(items)) {
        if (!itemState || itemState.status === 'not-examined') continue;

        const block = MASTER_BLOCK_LIBRARY[blockKey];
        if (!block) continue;

        const normalBitmask = masterNormalsToBitmask(itemState.selectedNormals, block.findings);
        const abnormalBitmask = masterAbnormalsToBitmask(itemState.selectedAbnormals, block.findings);

        let entry = `${blockKey}:${normalBitmask.toString(36)}.${abnormalBitmask.toString(36)}`;
        if (itemState.findings.trim()) {
            entry += `.${compressText(itemState.findings.trim())}`;
        }
        blockEntries.push(entry);
    }

    const add64 = additional.trim() ? compressText(additional.trim()) : '';

    return `7:${categoryLetter},${latField},${modeField},${vitalsCsv}~${blockEntries.join('^')}~${add64}`;
}

// ---------------------------------------------------------------------------
// V7 decoder
// ---------------------------------------------------------------------------

function decodePEStateV7(data: string, _symptomCode: string): PEState | null {
    const sections = data.split('~');
    if (sections.length < 3) return null;

    const headerParts = sections[0].split(',');
    if (headerParts.length < 3) return null;

    const categoryLetter = headerParts[0] as CategoryLetter;
    const latField = headerParts[1] || 'R';
    const modeRaw = headerParts[2] || 'F';

    // Parse mode and block keys
    let mode: 'focused' | 'template' = 'focused';
    let blockKeys: string[] | undefined;
    if (modeRaw.startsWith('T')) {
        mode = 'template';
        // T:{key1},{key2},... — the keys are everything after "T:" which got split by commas
        // Reconstruct: modeRaw is "T:" (or just "T"), and the keys are headerParts[3..N] up to where vitals start
        // Since vitals are VITAL_SIGNS.length values at the end, we can compute the split point
        const vitalsCount = VITAL_SIGNS.length;
        const vitalsStart = headerParts.length - vitalsCount;
        // Block keys are from index 2 onward up to vitalsStart
        const modeAndKeys = headerParts.slice(2, vitalsStart).join(',');
        const afterT = modeAndKeys.startsWith('T:') ? modeAndKeys.substring(2) : modeAndKeys.substring(1);
        blockKeys = afterT ? afterT.split(',').filter(Boolean) : [];
        // Vitals
        var vitalCsvValues = headerParts.slice(vitalsStart);
    } else {
        // F mode — vitals start at index 3
        var vitalCsvValues = headerParts.slice(3);
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

    // Block entries
    const items: Record<string, PEItemState> = {};
    if (sections[1]) {
        for (const entry of sections[1].split('^').filter(Boolean)) {
            const colonIdx = entry.indexOf(':');
            if (colonIdx === -1) continue;
            const blockKey = entry.substring(0, colonIdx);
            const rest = entry.substring(colonIdx + 1);
            const dotParts = rest.split('.');
            const normalBitmask = parseInt(dotParts[0] || '0', 36);
            const abnormalBitmask = parseInt(dotParts[1] || '0', 36);
            let freeText = '';
            if (dotParts.length > 2) freeText = decompressText(dotParts.slice(2).join('.'));

            const block = MASTER_BLOCK_LIBRARY[blockKey];
            if (!block) continue;

            const selectedNormals = masterBitmaskToNormals(normalBitmask, block.findings);
            const selectedAbnormals = masterBitmaskToAbnormals(abnormalBitmask, block.findings);

            const hasAbnormals = selectedAbnormals.length > 0;
            const hasNormals = selectedNormals.length > 0;
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
        mode,
        blockKeys,
    };
}

// ---------------------------------------------------------------------------
// V6 decoder (backward compat — maps old keys to master keys)
// ---------------------------------------------------------------------------

function decodePEStateV6(data: string, _symptomCode: string): PEState | null {
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

    // Block entries — decode against old BLOCK_LIBRARY, then remap keys
    const items: Record<string, PEItemState> = {};
    if (sections[1]) {
        for (const entry of sections[1].split(/[|^]/).filter(Boolean)) {
            const colonIdx = entry.indexOf(':');
            if (colonIdx === -1) continue;
            const oldBlockKey = entry.substring(0, colonIdx);
            const rest = entry.substring(colonIdx + 1);
            const dotParts = rest.split('.');
            const normalBitmask = parseInt(dotParts[0] || '0', 36);
            const abnormalBitmask = parseInt(dotParts[1] || '0', 36);
            let freeText = '';
            if (dotParts.length > 2) freeText = decompressText(dotParts.slice(2).join('.'));

            // Decode bitmasks against the old block definition to get finding keys
            const oldBlock = BLOCK_LIBRARY[oldBlockKey];
            if (!oldBlock) continue;

            const selectedNormals = bitmaskToNormals(normalBitmask, oldBlock.findings);
            const selectedAbnormals = bitmaskToAbnormals(abnormalBitmask, oldBlock.findings);

            // Map old block key to master key
            const masterKey = OLD_KEY_TO_MASTER[oldBlockKey] || oldBlockKey;

            const hasAbnormals = selectedAbnormals.length > 0;
            const hasNormals = selectedNormals.length > 0;
            const status = hasAbnormals ? 'abnormal' : hasNormals ? 'normal' : 'normal';

            // Merge into master key — multiple old blocks may map to the same master key
            if (items[masterKey]) {
                const existing = items[masterKey];
                existing.selectedNormals = Array.from(new Set([...existing.selectedNormals, ...selectedNormals]));
                existing.selectedAbnormals = Array.from(new Set([...existing.selectedAbnormals, ...selectedAbnormals]));
                if (freeText) existing.findings = existing.findings ? `${existing.findings}; ${freeText}` : freeText;
                if (status === 'abnormal') existing.status = 'abnormal';
            } else {
                items[masterKey] = { status, selectedNormals, selectedAbnormals, findings: freeText };
            }
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
        mode: 'focused',
    };
}

// ---------------------------------------------------------------------------
// Public decode dispatcher
// ---------------------------------------------------------------------------

/** Decode a compact PE string (v6 or v7) back into PEState. Returns null on parse failure. */
export function decodePEState(encoded: string, symptomCode: string): PEState | null {
    if (encoded.startsWith('7:')) return decodePEStateV7(encoded.substring(2), symptomCode);
    if (encoded.startsWith('6:')) return decodePEStateV6(encoded.substring(2), symptomCode);
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

    // Determine block order: use focused layout (before → expanded → after) for focused mode,
    // or template blockKeys order, or fallback to items insertion order
    const isTemplate = state.mode === 'template';
    let orderedKeys: string[];

    if (isTemplate && state.blockKeys?.length) {
        orderedKeys = state.blockKeys;
    } else {
        // Focused layout: before → category expansion → after
        const { blocks } = getBlocksForFocusedExam(categoryLetter, symptomCode);
        orderedKeys = blocks.map(b => b.key);
    }

    // Also include any item keys not in the ordered list (e.g. added inline blocks)
    const orderedSet = new Set(orderedKeys);
    for (const key of Object.keys(items)) {
        if (!orderedSet.has(key)) orderedKeys.push(key);
    }

    for (const blockKey of orderedKeys) {
        const itemState = items[blockKey];
        if (!itemState || itemState.status === 'not-examined') continue;

        // Look up from master library first, fall back to old library
        const block = MASTER_BLOCK_LIBRARY[blockKey] || BLOCK_LIBRARY[blockKey];
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

/**
 * Decode a compact PE string (v6/v7) back into human-readable text.
 * Used by noteParser and NoteCodec barrel for reading stored barcodes.
 */
export function decodePECompact(encoded: string, symptomCode: string): string {
    const state = decodePEState(encoded, symptomCode);
    return state ? renderPEStateToTextWithCode(state, symptomCode) : '';
}

// ---------------------------------------------------------------------------
// Internal helpers — bitmask encoding for MasterPEFinding[]
// ---------------------------------------------------------------------------

function flattenMasterAbnormals(findings: MasterPEFinding[]): AbnormalOption[] {
    const result: AbnormalOption[] = [];
    for (const f of findings) {
        for (const a of f.abnormals) {
            result.push(a);
        }
    }
    return result;
}

function masterNormalsToBitmask(selectedNormals: string[], findings: MasterPEFinding[]): number {
    let bitmask = 0;
    for (let i = 0; i < Math.min(findings.length, 31); i++) {
        if (selectedNormals.includes(findings[i].key)) {
            bitmask |= (1 << i);
        }
    }
    return bitmask;
}

function masterAbnormalsToBitmask(selectedAbnormals: string[], findings: MasterPEFinding[]): number {
    const allAbnormals = flattenMasterAbnormals(findings);
    let bitmask = 0;
    for (let i = 0; i < Math.min(allAbnormals.length, 31); i++) {
        if (selectedAbnormals.includes(allAbnormals[i].key)) {
            bitmask |= (1 << i);
        }
    }
    return bitmask;
}

function masterBitmaskToNormals(bitmask: number, findings: MasterPEFinding[]): string[] {
    const keys: string[] = [];
    for (let i = 0; i < findings.length; i++) {
        if ((bitmask >> i) & 1) keys.push(findings[i].key);
    }
    return keys;
}

function masterBitmaskToAbnormals(bitmask: number, findings: MasterPEFinding[]): string[] {
    const allAbnormals = flattenMasterAbnormals(findings);
    const keys: string[] = [];
    for (let i = 0; i < allAbnormals.length; i++) {
        if ((bitmask >> i) & 1) keys.push(allAbnormals[i].key);
    }
    return keys;
}

// ---------------------------------------------------------------------------
// Internal helpers — bitmask encoding for legacy PEFinding[] (v6 compat)
// ---------------------------------------------------------------------------

function flattenAbnormals(findings: PEFinding[]): AbnormalOption[] {
    const result: AbnormalOption[] = [];
    for (const f of findings) {
        for (const a of f.abnormals) {
            result.push(a);
        }
    }
    return result;
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

/** Format a line for a master block or legacy block. Accepts either type. */
function formatItemLineMaster(block: { label: string; findings: (MasterPEFinding | PEFinding)[] }, itemState: PEItemState): string {
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
        const allAbnormals: AbnormalOption[] = [];
        for (const f of block.findings) {
            for (const a of f.abnormals) {
                allAbnormals.push(a);
            }
        }
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
