import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import type { getColorClasses } from '../Utilities/ColorUtilities';
import { PIIWarningBanner } from './PIIWarningBanner';
import { detectPII } from '../lib/piiDetector';
import {
    getCategoryFromSymptomCode,
    getMSKBodyPart,
    isBackPainCode,
    VITAL_SIGNS,
    BASELINE_BEFORE_COUNT,
    COMPREHENSIVE_DEFAULT_BLOCK_IDS,
    BLOCK_LIBRARY,
    getBaselineWrappers,
    getFocusedBlocks,
    getBlockByKey,
    SPECIAL_TESTS_BY_BODY_PART,
} from '../Data/PhysicalExamData';
import type { CategoryLetter, Laterality, SpineRegion, PEFinding, PEBlock } from '../Data/PhysicalExamData';
import type { CustomPEBlock, TextExpander, ComprehensivePETemplate } from '../Data/User';
import type { PEState, PEItemState } from '../Types/PETypes';
import { ExpandableInput } from './ExpandableInput';

type SystemStatus = 'not-examined' | 'normal' | 'abnormal';

interface ItemState {
    status: SystemStatus;
    selectedNormals: string[];
    selectedAbnormals: string[];
    findings: string;
}

type PEDepth = 'focused' | 'comprehensive' | 'custom';

interface PhysicalExamProps {
    initialText?: string;
    onChange: (text: string) => void;
    onStateChange?: (state: PEState) => void;
    colors: ReturnType<typeof getColorClasses>;
    symptomCode: string;
    depth?: PEDepth;
    customBlocks?: CustomPEBlock[];
    comprehensiveTemplate?: ComprehensivePETemplate;
    expanders?: TextExpander[];
    expanderEnabled?: boolean;
}

// ── Old-format body systems (for backward-compat parsing) ─────
const OLD_BODY_SYSTEMS = [
    'General Appearance', 'HEENT', 'Cardiovascular', 'Respiratory',
    'Abdominal', 'Musculoskeletal', 'Neurological', 'Skin/Integumentary',
] as const;

function defaultItemState(): ItemState {
    return { status: 'not-examined', selectedNormals: [], selectedAbnormals: [], findings: '' };
}

function allNormalsSelected(block: PEBlock): ItemState {
    return {
        status: 'normal',
        selectedNormals: block.findings.filter(f => f.normal).map(f => f.key),
        selectedAbnormals: [],
        findings: '',
    };
}

// ── Convert CustomPEBlock to PEBlock-compatible shape ─────────
function customBlockToPEBlock(block: CustomPEBlock): PEBlock {
    return {
        key: block.id,
        label: block.name,
        findings: [
            ...(block.normalText ? [{ key: 'customNormal', normal: block.normalText, abnormals: [] as PEFinding['abnormals'] }] : []),
            ...block.abnormalTags.map(tag => ({ key: tag, normal: '', abnormals: [{ key: tag, label: tag }] })),
        ],
    };
}

// ── Mapping from old general finding labels (backward compat) ─
const OLD_GENERAL_TO_WRAPPER: Record<string, string> = {
    'General Appearance': 'sw_gen',
    'Skin': 'sw_derm',
    'Neuro': 'sw_neuro',
    'Psych': 'sw_psych',
};

// ── Parse a single exam line against a PEBlock's findings ─────
function parseItemLine(
    line: string,
    label: string,
    block: PEBlock,
): ItemState | null {
    if (!line.toUpperCase().startsWith(`${label.toUpperCase()}:`)) return null;
    const rest = line.slice(label.length + 1).trim();

    // Collect all normal/abnormal texts for matching
    const allNormalTexts: Array<{ key: string; text: string }> = block.findings
        .filter(f => f.normal)
        .map(f => ({ key: f.key, text: f.normal }));
    const allAbnormalTexts: Array<{ key: string; label: string }> = block.findings.flatMap(f =>
        f.abnormals.map(a => ({ key: a.key, label: a.label })),
    );

    if (rest === 'Normal') {
        // All-normal shorthand
        return allNormalsSelected(block);
    }

    // Try to match comma/semicolon-separated segments against known labels
    const segments = rest.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    const selectedNormals: string[] = [];
    const selectedAbnormals: string[] = [];
    const freeTextParts: string[] = [];

    for (const seg of segments) {
        const normalMatch = allNormalTexts.find(n => n.text === seg);
        if (normalMatch) {
            selectedNormals.push(normalMatch.key);
            continue;
        }
        const abnormalMatch = allAbnormalTexts.find(a => a.label === seg);
        if (abnormalMatch) {
            selectedAbnormals.push(abnormalMatch.key);
            continue;
        }
        freeTextParts.push(seg);
    }

    const hasAbnormal = selectedAbnormals.length > 0 || freeTextParts.length > 0;
    const hasNormal = selectedNormals.length > 0;
    const status: SystemStatus = hasAbnormal ? 'abnormal' : hasNormal ? 'normal' : 'not-examined';

    if (status === 'not-examined' && !rest) return null;

    return {
        status,
        selectedNormals,
        selectedAbnormals,
        findings: freeTextParts.join('; '),
    };
}

// ── Parse initial text (focused / comprehensive modes) ────────
function parseInitialTextBlocks(
    text: string,
    allBlocks: PEBlock[],
): {
    blockStates: Record<string, ItemState>;
    laterality: Laterality;
    spineRegion: SpineRegion;
    additional: string;
    vitals: Record<string, string>;
} {
    const blockStates: Record<string, ItemState> = {};
    for (const b of allBlocks) {
        blockStates[b.key] = defaultItemState();
    }
    let laterality: Laterality = 'right';
    let spineRegion: SpineRegion = 'lumbar';
    let additional = '';
    const vitals: Record<string, string> = {};
    VITAL_SIGNS.forEach(v => { vitals[v.key] = ''; });

    if (!text) return { blockStates, laterality, spineRegion, additional, vitals };

    const lines = text.split('\n');
    let inAdditional = false;
    let inVitals = false;
    const unmatchedLines: string[] = [];

    const vitalLabelToKey: Record<string, string> = {};
    VITAL_SIGNS.forEach(v => { vitalLabelToKey[v.shortLabel] = v.key; });

    for (const line of lines) {
        if (line.startsWith('Additional Findings:')) {
            inAdditional = true;
            inVitals = false;
            additional = line.replace('Additional Findings:', '').trim();
            continue;
        }
        if (inAdditional) {
            additional += (additional ? '\n' : '') + line;
            continue;
        }

        if (line.startsWith('Vital Signs:') || line === 'Vital Signs') {
            inVitals = true;
            continue;
        }
        if (inVitals) {
            const bpMatch = line.match(/^\s*BP:\s*(.+?)\/(.+?)\s*mmHg/);
            if (bpMatch) {
                const sys = bpMatch[1].trim();
                const dia = bpMatch[2].trim();
                if (sys && sys !== '--') vitals['bpSys'] = sys;
                if (dia && dia !== '--') vitals['bpDia'] = dia;
                continue;
            }
            if (line.match(/^\s*BMI:/)) continue;
            const vitalMatch = line.match(/^\s*(\w+):\s*(.+)/);
            if (vitalMatch) {
                const key = vitalLabelToKey[vitalMatch[1]];
                if (key) {
                    let val = vitalMatch[2].trim();
                    val = val.replace(/\s*\([^)]*\)\s*$/, '');
                    const vitalDef = VITAL_SIGNS.find(v => v.key === key);
                    if (vitalDef && val.endsWith(vitalDef.unit)) {
                        val = val.slice(0, -vitalDef.unit.length).trim();
                    }
                    vitals[key] = val;
                    continue;
                }
            }
            if (line.trim()) inVitals = false;
            else continue;
        }

        if (!line.trim()) continue;

        if (line.trim() === 'General:') continue;
        if (line.startsWith('Vitals:')) continue;
        if (line.match(/^(HEENT|Gastrointestinal|Cardiorespiratory|Genitourinary|Neuropsychiatric|Constitutional|Eye|Gynecological|Dermatological|Environmental|Miscellaneous|Misc Return|Musculoskeletal)(\s*[-:]|$)/)) {
            continue;
        }

        if (line.startsWith('MSK')) {
            const spineMatch = line.match(/\((Cervical|Thoracic|Lumbar|Sacral)\)/i);
            if (spineMatch) {
                spineRegion = spineMatch[1].toLowerCase() as SpineRegion;
            } else {
                const latMatch = line.match(/\((Left|Right|Bilateral)\)/i);
                if (latMatch) laterality = latMatch[1].toLowerCase() as Laterality;
            }
            continue;
        }

        // Try matching against all known blocks
        let matched = false;
        for (const block of allBlocks) {
            const state = parseItemLine(line, block.label, block);
            if (state) {
                blockStates[block.key] = state;
                matched = true;
                break;
            }
        }
        if (matched) continue;

        // Fall back to full BLOCK_LIBRARY for labels not in current block set
        for (const block of Object.values(BLOCK_LIBRARY)) {
            const state = parseItemLine(line, block.label, block);
            if (state) {
                blockStates[block.key] = state;
                matched = true;
                break;
            }
        }
        if (matched) continue;

        // Backward compat: old general finding labels
        for (const [oldLabel] of Object.entries(OLD_GENERAL_TO_WRAPPER)) {
            if (line.toUpperCase().startsWith(`${oldLabel.toUpperCase()}:`)) {
                matched = true;
                break;
            }
        }
        if (matched) continue;

        // Backward compat: old body system names
        let oldMatch = false;
        for (const sys of OLD_BODY_SYSTEMS) {
            if (line.startsWith(`${sys}:`)) { oldMatch = true; break; }
        }
        if (!oldMatch && line.trim() && !line.match(/^(Vitals:|PE:)/)) {
            unmatchedLines.push(line);
        }
    }

    if (unmatchedLines.length > 0) {
        const extraContent = unmatchedLines.join('\n');
        additional = additional ? `${additional}\n${extraContent}` : extraContent;
    }

    return { blockStates, laterality, spineRegion, additional, vitals };
}

// ── Parse initial text (custom blocks mode) ───────────────────
function parseInitialTextCustom(
    text: string,
    customBlocks: CustomPEBlock[],
    baselineWrappers: PEBlock[],
): {
    customStates: Record<string, ItemState>;
    wrapperStates: Record<string, ItemState>;
    additional: string;
    vitals: Record<string, string>;
} {
    const customStates: Record<string, ItemState> = {};
    for (const b of customBlocks) customStates[b.id] = defaultItemState();
    const wrapperStates: Record<string, ItemState> = {};
    for (const b of baselineWrappers) wrapperStates[b.key] = defaultItemState();
    let additional = '';
    const vitals: Record<string, string> = {};
    VITAL_SIGNS.forEach(v => { vitals[v.key] = ''; });

    if (!text) return { customStates, wrapperStates, additional, vitals };

    const lines = text.split('\n');
    let inAdditional = false;
    let inVitals = false;
    const unmatchedLines: string[] = [];

    const vitalLabelToKey: Record<string, string> = {};
    VITAL_SIGNS.forEach(v => { vitalLabelToKey[v.shortLabel] = v.key; });

    for (const line of lines) {
        if (line.startsWith('Additional Findings:')) {
            inAdditional = true;
            inVitals = false;
            additional = line.replace('Additional Findings:', '').trim();
            continue;
        }
        if (inAdditional) {
            additional += (additional ? '\n' : '') + line;
            continue;
        }
        if (line.startsWith('Vital Signs:') || line === 'Vital Signs') {
            inVitals = true;
            continue;
        }
        if (inVitals) {
            const bpMatch = line.match(/^\s*BP:\s*(.+?)\/(.+?)\s*mmHg/);
            if (bpMatch) {
                const sys = bpMatch[1].trim();
                const dia = bpMatch[2].trim();
                if (sys && sys !== '--') vitals['bpSys'] = sys;
                if (dia && dia !== '--') vitals['bpDia'] = dia;
                continue;
            }
            if (line.match(/^\s*BMI:/)) continue;
            const vitalMatch = line.match(/^\s*(\w+):\s*(.+)/);
            if (vitalMatch) {
                const key = vitalLabelToKey[vitalMatch[1]];
                if (key) {
                    let val = vitalMatch[2].trim();
                    val = val.replace(/\s*\([^)]*\)\s*$/, '');
                    const vitalDef = VITAL_SIGNS.find(v => v.key === key);
                    if (vitalDef && val.endsWith(vitalDef.unit)) {
                        val = val.slice(0, -vitalDef.unit.length).trim();
                    }
                    vitals[key] = val;
                    continue;
                }
            }
            if (line.trim()) inVitals = false;
            else continue;
        }
        if (!line.trim()) continue;

        let matched = false;
        for (const block of baselineWrappers) {
            const state = parseItemLine(line, block.label, block);
            if (state) { wrapperStates[block.key] = state; matched = true; break; }
        }
        if (matched) continue;

        for (const block of customBlocks) {
            const peBlock = customBlockToPEBlock(block);
            const state = parseItemLine(line, block.name, peBlock);
            if (state) { customStates[block.id] = state; matched = true; break; }
        }
        if (matched) continue;

        unmatchedLines.push(line);
    }

    if (unmatchedLines.length > 0) {
        const extraContent = unmatchedLines.join('\n');
        additional = additional ? `${additional}\n${extraContent}` : extraContent;
    }

    return { customStates, wrapperStates, additional, vitals };
}

// ── Generate text output ──────────────────────────────────────

function formatExamLine(label: string, state: ItemState, block: PEBlock): string {
    const uLabel = label.toUpperCase();
    const normalParts: string[] = [];
    const abnormalParts: string[] = [];

    for (const finding of block.findings) {
        if (finding.normal && state.selectedNormals.includes(finding.key)) {
            normalParts.push(finding.normal);
        }
        for (const abn of finding.abnormals) {
            if (state.selectedAbnormals.includes(abn.key)) {
                abnormalParts.push(abn.label);
            }
        }
    }

    if (state.findings.trim()) abnormalParts.push(state.findings.trim());

    if (abnormalParts.length > 0 && normalParts.length > 0) {
        return `${uLabel}: ${normalParts.join(', ')}. ${abnormalParts.join('; ')}`;
    }
    if (abnormalParts.length > 0) {
        return `${uLabel}: ${abnormalParts.join('; ')}`;
    }
    if (normalParts.length > 0) {
        return `${uLabel}: ${normalParts.join(', ')}`;
    }
    return `${uLabel}: Normal`;
}

function formatVitals(vitals: Record<string, string>): string[] {
    const lines: string[] = [];
    const hasVitals = VITAL_SIGNS.some(v => vitals[v.key]?.trim());
    if (!hasVitals) return lines;
    lines.push('Vital Signs:');
    for (const v of VITAL_SIGNS) {
        if (v.key === 'bpSys') {
            const sys = vitals['bpSys']?.trim();
            const dia = vitals['bpDia']?.trim();
            if (sys || dia) {
                lines.push(`  BP: ${sys || '--'}/${dia || '--'} mmHg`);
            }
            continue;
        }
        if (v.key === 'bpDia') continue;
        const val = vitals[v.key]?.trim();
        if (val) {
            const num = parseFloat(val);
            if (v.key === 'ht' && !isNaN(num)) {
                lines.push(`  ${v.shortLabel}: ${val} ${v.unit} (${(num * 2.54).toFixed(1)} cm)`);
            } else if (v.key === 'wt' && !isNaN(num)) {
                lines.push(`  ${v.shortLabel}: ${val} ${v.unit} (${(num * 0.453592).toFixed(1)} kg)`);
            } else {
                lines.push(`  ${v.shortLabel}: ${val} ${v.unit}`);
            }
        }
    }
    const htNum = parseFloat(vitals['ht']?.trim() || '');
    const wtNum = parseFloat(vitals['wt']?.trim() || '');
    if (!isNaN(htNum) && htNum > 0 && !isNaN(wtNum) && wtNum > 0) {
        const htM = (htNum * 2.54) / 100;
        const bmi = (wtNum * 0.453592) / (htM * htM);
        lines.push(`  BMI: ${bmi.toFixed(1)}`);
    }
    return lines;
}

// Focused mode: baseline wrappers split around category blocks
function generateFocusedText(
    categoryLetter: CategoryLetter,
    blockStates: Record<string, ItemState>,
    allBlocks: PEBlock[],
    bodyPart: { code: string; label: string } | null,
    laterality: Laterality,
    spineRegion: SpineRegion,
    additional: string,
    vitals: Record<string, string>,
): string {
    const parts: string[] = [...formatVitals(vitals)];
    const baselineWrappers = getBaselineWrappers();
    const focusedBlocks = getFocusedBlocks(categoryLetter);
    const beforeWrappers = baselineWrappers.slice(0, BASELINE_BEFORE_COUNT);
    const afterWrappers = baselineWrappers.slice(BASELINE_BEFORE_COUNT);
    const examLines: string[] = [];

    // Build a lookup for blocks by key
    const blockByKey = new Map<string, PEBlock>();
    for (const b of allBlocks) blockByKey.set(b.key, b);

    for (const b of beforeWrappers) {
        const state = blockStates[b.key];
        if (!state || state.status === 'not-examined') continue;
        examLines.push(formatExamLine(b.label, state, b));
    }

    if (categoryLetter === 'B' && bodyPart) {
        const hasExamined = focusedBlocks.some(b => blockStates[b.key]?.status !== 'not-examined');
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
        const state = blockStates[b.key];
        if (!state || state.status === 'not-examined') continue;
        examLines.push(formatExamLine(b.label, state, b));
    }

    for (const b of afterWrappers) {
        const state = blockStates[b.key];
        if (!state || state.status === 'not-examined') continue;
        examLines.push(formatExamLine(b.label, state, b));
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

// Comprehensive mode: all resolved blocks in order, no before/after split
function generateComprehensiveText(
    blockStates: Record<string, ItemState>,
    resolvedBlocks: PEBlock[],
    additional: string,
    vitals: Record<string, string>,
): string {
    const parts: string[] = [...formatVitals(vitals)];
    const examLines: string[] = [];

    for (const b of resolvedBlocks) {
        const state = blockStates[b.key];
        if (!state || state.status === 'not-examined') continue;
        examLines.push(formatExamLine(b.label, state, b));
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

// Custom mode: baseline wrappers split around user-defined blocks
function generateCustomText(
    customBlocks: CustomPEBlock[],
    customStates: Record<string, ItemState>,
    baselineWrappers: PEBlock[],
    wrapperStates: Record<string, ItemState>,
    additional: string,
    vitals: Record<string, string>,
): string {
    const parts: string[] = [...formatVitals(vitals)];
    const examLines: string[] = [];
    const beforeWrappers = baselineWrappers.slice(0, BASELINE_BEFORE_COUNT);
    const afterWrappers = baselineWrappers.slice(BASELINE_BEFORE_COUNT);

    for (const b of beforeWrappers) {
        const state = wrapperStates[b.key];
        if (!state || state.status === 'not-examined') continue;
        examLines.push(formatExamLine(b.label, state, b));
    }

    for (const block of customBlocks) {
        const state = customStates[block.id];
        if (!state || state.status === 'not-examined') continue;
        const peBlock = customBlockToPEBlock(block);
        examLines.push(formatExamLine(block.name, state, peBlock));
    }

    for (const b of afterWrappers) {
        const state = wrapperStates[b.key];
        if (!state || state.status === 'not-examined') continue;
        examLines.push(formatExamLine(b.label, state, b));
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

// ── Shared item row renderer ─────────────────────────────────

function ExamItemRow({ block, state, onCycleStatus, onToggleNormal, onToggleAbnormal, onSetFindings, expanders = [], expanderEnabled = false }: {
    block: PEBlock;
    state: ItemState;
    onCycleStatus: () => void;
    onToggleNormal: (findingKey: string) => void;
    onToggleAbnormal: (abnormalKey: string) => void;
    onSetFindings: (findings: string) => void;
    expanders?: TextExpander[];
    expanderEnabled?: boolean;
}) {
    const findingsWarnings = useMemo(() => detectPII(state.findings), [state.findings]);
    const isExpanded = state.status !== 'not-examined';

    return (
        <div>
            <button
                type="button"
                className="flex items-center gap-3 w-full text-left py-3 active:scale-[0.98] transition-all"
                onClick={onCycleStatus}
            >
                <span className={`w-3.5 h-3.5 rounded-full shrink-0 transition-colors duration-200 ${
                    state.status === 'normal' ? 'bg-themegreen'
                    : state.status === 'abnormal' ? 'bg-themeredred'
                    : 'ring-[1.5px] ring-inset ring-tertiary/25 bg-transparent'
                }`} />
                <span className="text-[10pt] font-medium text-primary flex-1">{block.label}</span>
            </button>

            <div
                className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
                style={{
                    gridTemplateRows: isExpanded ? '1fr' : '0fr',
                    opacity: isExpanded ? 1 : 0,
                }}
            >
                <div className="overflow-hidden min-h-0">
                    <div className="pb-4">
                        <div className="grid grid-cols-[auto_1fr] items-start border border-tertiary/10 rounded-lg overflow-hidden">
                            {block.findings.map((finding, i) => (
                                finding.normal ? (
                                    <React.Fragment key={finding.key}>
                                        <div className={`flex items-center py-1.5 px-1 ${
                                            i > 0 ? 'border-t border-tertiary/10' : ''
                                        }`}>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onToggleNormal(finding.key); }}
                                                className={`text-left px-3 py-1.5 text-[9pt] rounded-full transition-colors active:scale-95 whitespace-nowrap ${
                                                    state.selectedNormals.includes(finding.key)
                                                        ? 'bg-themegreen/15 text-themegreen'
                                                        : 'bg-tertiary/5 text-tertiary/40'
                                                }`}
                                            >
                                                {finding.normal}
                                            </button>
                                        </div>
                                        {finding.abnormals.length > 0 ? (
                                            <div className={`flex flex-wrap gap-1.5 min-w-0 border-l border-tertiary/10 pl-2 py-1.5 ${
                                                i > 0 ? 'border-t border-tertiary/10' : ''
                                            }`}>
                                                {finding.abnormals.map(abn => (
                                                    <button
                                                        key={abn.key}
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); onToggleAbnormal(abn.key); }}
                                                        className={`px-3 py-1 text-[9pt] rounded-full transition-colors active:scale-95 ${
                                                            state.selectedAbnormals.includes(abn.key)
                                                                ? 'bg-themeredred/15 text-themeredred'
                                                                : 'bg-tertiary/5 text-tertiary/40'
                                                        }`}
                                                    >
                                                        {abn.label}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : <div className={`border-l border-tertiary/10 ${i > 0 ? 'border-t' : ''}`} />}
                                    </React.Fragment>
                                ) : finding.abnormals.length > 0 ? (
                                    <div key={finding.key} className={`col-span-2 flex flex-wrap gap-1.5 min-w-0 py-1.5 px-1 ${
                                        i > 0 ? 'border-t border-tertiary/10' : ''
                                    }`}>
                                        {finding.abnormals.map(abn => (
                                            <button
                                                key={abn.key}
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onToggleAbnormal(abn.key); }}
                                                className={`px-3 py-1 text-[9pt] rounded-full transition-colors active:scale-95 ${
                                                    state.selectedAbnormals.includes(abn.key)
                                                        ? 'bg-themeredred/15 text-themeredred'
                                                        : 'bg-tertiary/5 text-tertiary/40'
                                                }`}
                                            >
                                                {abn.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : null
                            ))}
                        </div>
                        <div className="mt-3">
                        <ExpandableInput
                            value={state.findings}
                            onChange={onSetFindings}
                            expanders={expanders}
                            expanderEnabled={expanderEnabled}
                            placeholder="Additional findings..."
                            className="w-full text-[9pt] px-4 py-2.5 rounded-full border border-themeblue3/10 shadow-xs bg-themewhite text-primary outline-none focus:border-themeblue1/30 focus:bg-themewhite2 placeholder:text-tertiary/30 transition-all duration-300"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <PIIWarningBanner warnings={findingsWarnings} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────

function toEncodableState(blockStates: Record<string, ItemState>): Record<string, PEItemState> {
    const result: Record<string, PEItemState> = {};
    for (const [key, state] of Object.entries(blockStates)) {
        if (state.status === 'not-examined') continue;
        result[key] = {
            status: state.status,
            selectedNormals: state.selectedNormals,
            selectedAbnormals: state.selectedAbnormals,
            findings: state.findings,
        };
    }
    return result;
}

// ── Component ─────────────────────────────────────────────────

const EMPTY_CUSTOM_BLOCKS: CustomPEBlock[] = [];

export function PhysicalExam({
    initialText = '',
    onChange,
    onStateChange,
    colors,
    symptomCode,
    depth = 'focused',
    customBlocks = EMPTY_CUSTOM_BLOCKS,
    comprehensiveTemplate,
    expanders = [],
    expanderEnabled = false,
}: PhysicalExamProps) {
    const categoryLetter = (getCategoryFromSymptomCode(symptomCode) || 'A') as CategoryLetter;
    const bodyPart = useMemo(
        () => categoryLetter === 'B' ? getMSKBodyPart(symptomCode) : null,
        [categoryLetter, symptomCode],
    );

    const isCustom = depth === 'custom' && customBlocks.length > 0;
    const isComprehensive = depth === 'comprehensive' && !isCustom;

    // Resolve the ordered list of blocks for comprehensive mode
    const comprehensiveBlocks = useMemo((): PEBlock[] => {
        if (!isComprehensive) return [];
        const ids = comprehensiveTemplate?.blockIds ?? COMPREHENSIVE_DEFAULT_BLOCK_IDS;
        return ids.map(id => getBlockByKey(id)).filter((b): b is PEBlock => b !== undefined);
    }, [isComprehensive, comprehensiveTemplate]);

    // Focused mode: baseline wrappers + category-specific blocks
    const focusedAllBlocks = useMemo((): PEBlock[] => {
        if (isCustom || isComprehensive) return [];
        const wrappers = getBaselineWrappers();
        const focused = getFocusedBlocks(categoryLetter);
        if (categoryLetter !== 'B' || !bodyPart) return [...wrappers, ...focused];
        const allowedKeys = SPECIAL_TESTS_BY_BODY_PART[bodyPart.code];
        if (!allowedKeys || allowedKeys.length === 0) {
            return [...wrappers, ...focused.filter(b => b.key !== 'cat_b_specialTests')];
        }
        return [...wrappers, ...focused.map(b => {
            if (b.key !== 'cat_b_specialTests') return b;
            return { ...b, findings: b.findings.filter(f => allowedKeys.includes(f.key)) };
        })];
    }, [isCustom, isComprehensive, categoryLetter, bodyPart]);

    const baselineWrappers = useMemo(() => getBaselineWrappers(), []);

    // ── Focused / Comprehensive state ─────────────────────────
    const [parsedBlocks] = useState(() => {
        if (isCustom) return null;
        const activeBlocks = isComprehensive ? comprehensiveBlocks : focusedAllBlocks;
        return parseInitialTextBlocks(initialText, activeBlocks);
    });

    const [blockStates, setBlockStates] = useState<Record<string, ItemState>>(() => {
        if (isCustom) return {};
        return parsedBlocks?.blockStates ?? {};
    });

    // ── Custom mode state ──────────────────────────────────────
    const [parsedCustom] = useState(() => {
        if (!isCustom) return null;
        return parseInitialTextCustom(initialText, customBlocks, baselineWrappers);
    });

    const [customStates, setCustomStates] = useState<Record<string, ItemState>>(() => {
        if (!isCustom) return {};
        const states: Record<string, ItemState> = {};
        for (const block of customBlocks) {
            states[block.id] = parsedCustom?.customStates[block.id] ?? defaultItemState();
        }
        return states;
    });

    const [wrapperStates, setWrapperStates] = useState<Record<string, ItemState>>(() => {
        if (!isCustom) return {};
        const states: Record<string, ItemState> = {};
        for (const b of baselineWrappers) {
            states[b.key] = parsedCustom?.wrapperStates[b.key] ?? defaultItemState();
        }
        return states;
    });

    // ── Shared state ───────────────────────────────────────────
    const [laterality, setLaterality] = useState<Laterality>(() => parsedBlocks?.laterality ?? 'right');
    const [spineRegion, setSpineRegion] = useState<SpineRegion>(() => parsedBlocks?.spineRegion ?? 'lumbar');
    const [additional, setAdditional] = useState(() =>
        isCustom ? (parsedCustom?.additional ?? '') : (parsedBlocks?.additional ?? '')
    );
    const [vitals, setVitals] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        VITAL_SIGNS.forEach(v => { init[v.key] = ''; });
        const source = isCustom ? parsedCustom?.vitals : parsedBlocks?.vitals;
        return source ? { ...init, ...source } : init;
    });

    const isBack = isBackPainCode(symptomCode);

    const bmiInfo = useMemo(() => {
        const htNum = parseFloat(vitals['ht'] || '');
        const wtNum = parseFloat(vitals['wt'] || '');
        if (isNaN(htNum) || htNum <= 0 || isNaN(wtNum) || wtNum <= 0) return null;
        const htM = (htNum * 2.54) / 100;
        const wtKg = wtNum * 0.453592;
        const bmi = wtKg / (htM * htM);
        return { value: bmi, display: bmi.toFixed(1) };
    }, [vitals]);

    const [additionalPiiWarnings, setAdditionalPiiWarnings] = useState<string[]>([]);
    useEffect(() => {
        const id = window.setTimeout(() => setAdditionalPiiWarnings(detectPII(additional)), 400);
        return () => clearTimeout(id);
    }, [additional]);

    // Keep custom states in sync when blocks change
    useEffect(() => {
        if (!isCustom) return;
        setCustomStates(prev => {
            const next: Record<string, ItemState> = {};
            for (const block of customBlocks) {
                next[block.id] = prev[block.id] || defaultItemState();
            }
            return next;
        });
    }, [customBlocks, isCustom]);

    // ── Emit change ────────────────────────────────────────────
    const emitChange = useCallback((
        bStates: Record<string, ItemState>,
        lat: Laterality,
        spine: SpineRegion,
        add: string,
        vit: Record<string, string>,
    ) => {
        const allBlocks = isComprehensive ? comprehensiveBlocks : focusedAllBlocks;
        if (isComprehensive) {
            onChange(generateComprehensiveText(bStates, comprehensiveBlocks, add, vit));
        } else {
            onChange(generateFocusedText(categoryLetter, bStates, allBlocks, bodyPart, lat, spine, add, vit));
        }
        if (onStateChange) {
            onStateChange({
                categoryLetter,
                laterality: lat,
                spineRegion: spine,
                items: toEncodableState(bStates),
                vitals: vit,
                additional: add,
                depth: isComprehensive ? 'comprehensive' : 'focused',
                blockOrder: isComprehensive ? comprehensiveBlocks.map(b => b.key) : undefined,
            });
        }
    }, [onChange, onStateChange, isComprehensive, comprehensiveBlocks, focusedAllBlocks, categoryLetter, bodyPart]);

    const emitCustomChange = useCallback((
        custStates: Record<string, ItemState>,
        wrpStates: Record<string, ItemState>,
        add: string,
        vit: Record<string, string>,
    ) => {
        onChange(generateCustomText(customBlocks, custStates, baselineWrappers, wrpStates, add, vit));
        if (onStateChange) {
            const mergedItems = { ...toEncodableState(wrpStates), ...toEncodableState(custStates) };
            onStateChange({
                categoryLetter,
                laterality: 'right',
                spineRegion: 'lumbar',
                items: mergedItems,
                vitals: vit,
                additional: add,
                depth: 'custom',
            });
        }
    }, [onChange, onStateChange, customBlocks, baselineWrappers, categoryLetter]);

    useEffect(() => {
        if (isCustom) {
            emitCustomChange(customStates, wrapperStates, additional, vitals);
        } else {
            emitChange(blockStates, laterality, spineRegion, additional, vitals);
        }
    }, [isCustom, blockStates, customStates, wrapperStates, laterality, spineRegion, additional, vitals, emitChange, emitCustomChange]);

    const setVitalValue = (key: string, value: string) => {
        setVitals(prev => ({ ...prev, [key]: value }));
    };

    const cycleStatus = (key: string, setter: React.Dispatch<React.SetStateAction<Record<string, ItemState>>>, block?: PEBlock) => {
        setter(prev => {
            const cur = prev[key] ?? defaultItemState();
            if (cur.status === 'not-examined') {
                return {
                    ...prev,
                    [key]: block ? allNormalsSelected(block) : { ...defaultItemState(), status: 'normal' },
                };
            }
            if (cur.status === 'normal') {
                const autoAbnormals = block
                    ? block.findings
                        .filter(f => f.abnormals.length > 0)
                        .map(f => f.abnormals[0].key)
                    : [];
                return {
                    ...prev,
                    [key]: { status: 'abnormal', selectedNormals: [], selectedAbnormals: autoAbnormals, findings: cur.findings },
                };
            }
            return { ...prev, [key]: defaultItemState() };
        });
    };

    const toggleNormal = (blockKey: string, findingKey: string, setter: React.Dispatch<React.SetStateAction<Record<string, ItemState>>>, block?: PEBlock) => {
        setter(prev => {
            const cur = prev[blockKey] ?? defaultItemState();
            const wasSelected = cur.selectedNormals.includes(findingKey);
            const normals = wasSelected
                ? cur.selectedNormals.filter(k => k !== findingKey)
                : [...cur.selectedNormals, findingKey];

            let abnormals = cur.selectedAbnormals;
            if (block && !wasSelected) {
                // Selecting normal → deselect all abnormals for this finding
                const finding = block.findings.find(f => f.key === findingKey);
                if (finding) {
                    const findingAbnKeys = new Set(finding.abnormals.map(a => a.key));
                    abnormals = abnormals.filter(k => !findingAbnKeys.has(k));
                }
            }

            const hasAbnormal = abnormals.length > 0;
            const hasNormal = normals.length > 0;
            const status: SystemStatus = hasAbnormal ? 'abnormal' : hasNormal ? 'normal' : 'not-examined';
            return { ...prev, [blockKey]: { ...cur, selectedNormals: normals, selectedAbnormals: abnormals, status } };
        });
    };

    const toggleAbnormal = (blockKey: string, abnormalKey: string, setter: React.Dispatch<React.SetStateAction<Record<string, ItemState>>>, block?: PEBlock) => {
        setter(prev => {
            const cur = prev[blockKey] ?? defaultItemState();
            const wasSelected = cur.selectedAbnormals.includes(abnormalKey);
            const abnormals = wasSelected
                ? cur.selectedAbnormals.filter(k => k !== abnormalKey)
                : [...cur.selectedAbnormals, abnormalKey];

            let normals = cur.selectedNormals;
            if (block && !wasSelected) {
                // Selecting abnormal → deselect normal for this finding
                const finding = block.findings.find(f => f.abnormals.some(a => a.key === abnormalKey));
                if (finding && finding.normal) {
                    normals = normals.filter(k => k !== finding.key);
                }
            }

            const hasAbnormal = abnormals.length > 0;
            const hasNormal = normals.length > 0;
            const status: SystemStatus = hasAbnormal ? 'abnormal' : hasNormal ? 'normal' : 'not-examined';
            return { ...prev, [blockKey]: { ...cur, selectedNormals: normals, selectedAbnormals: abnormals, status } };
        });
    };

    const setFindings = (key: string, findings: string, setter: React.Dispatch<React.SetStateAction<Record<string, ItemState>>>) => {
        setter(prev => ({
            ...prev,
            [key]: { ...(prev[key] ?? defaultItemState()), findings },
        }));
    };

    const markAllNormal = () => {
        if (isCustom) {
            setCustomStates(prev => {
                const next = { ...prev };
                for (const block of customBlocks) {
                    next[block.id] = allNormalsSelected(customBlockToPEBlock(block));
                }
                return next;
            });
            setWrapperStates(prev => {
                const next = { ...prev };
                for (const b of baselineWrappers) {
                    next[b.key] = allNormalsSelected(b);
                }
                return next;
            });
        } else {
            const activeBlocks = isComprehensive ? comprehensiveBlocks : focusedAllBlocks;
            setBlockStates(prev => {
                const next = { ...prev };
                for (const b of activeBlocks) {
                    next[b.key] = allNormalsSelected(b);
                }
                return next;
            });
        }
    };

    // ── Determine active block sets for rendering ──────────────
    const renderBeforeBlocks = useMemo((): PEBlock[] => {
        if (isCustom) return baselineWrappers.slice(0, BASELINE_BEFORE_COUNT);
        if (isComprehensive) return [];
        return getBaselineWrappers().slice(0, BASELINE_BEFORE_COUNT);
    }, [isCustom, isComprehensive, baselineWrappers]);

    const renderAfterBlocks = useMemo((): PEBlock[] => {
        if (isCustom) return baselineWrappers.slice(BASELINE_BEFORE_COUNT);
        if (isComprehensive) return [];
        return getBaselineWrappers().slice(BASELINE_BEFORE_COUNT);
    }, [isCustom, isComprehensive, baselineWrappers]);

    const renderMiddleBlocks = useMemo((): PEBlock[] => {
        if (isComprehensive) return comprehensiveBlocks;
        if (isCustom) return [];
        const blocks = getFocusedBlocks(categoryLetter);
        if (categoryLetter !== 'B' || !bodyPart) return blocks;
        const allowedKeys = SPECIAL_TESTS_BY_BODY_PART[bodyPart.code];
        if (!allowedKeys || allowedKeys.length === 0) {
            return blocks.filter(b => b.key !== 'cat_b_specialTests');
        }
        return blocks.map(b => {
            if (b.key !== 'cat_b_specialTests') return b;
            return { ...b, findings: b.findings.filter(f => allowedKeys.includes(f.key)) };
        });
    }, [isComprehensive, isCustom, comprehensiveBlocks, categoryLetter, bodyPart]);

    const examBlockCount = renderBeforeBlocks.length + (isCustom ? customBlocks.length : renderMiddleBlocks.length) + renderAfterBlocks.length;

    // Compute exam-wide status for cycling icon
    const examStatus = useMemo((): 'not-examined' | 'all-normal' | 'has-abnormal' => {
        const allStates = isCustom
            ? [...Object.values(wrapperStates), ...Object.values(customStates)]
            : Object.values(blockStates);
        const examined = allStates.filter(s => s.status !== 'not-examined');
        if (examined.length === 0) return 'not-examined';
        if (examined.some(s => s.status === 'abnormal')) return 'has-abnormal';
        return 'all-normal';
    }, [isCustom, blockStates, wrapperStates, customStates]);

    const resetAllBlocks = () => {
        if (isCustom) {
            setCustomStates(prev => {
                const next: Record<string, ItemState> = {};
                for (const key of Object.keys(prev)) next[key] = defaultItemState();
                return next;
            });
            setWrapperStates(prev => {
                const next: Record<string, ItemState> = {};
                for (const key of Object.keys(prev)) next[key] = defaultItemState();
                return next;
            });
        } else {
            setBlockStates(prev => {
                const next: Record<string, ItemState> = {};
                for (const key of Object.keys(prev)) next[key] = defaultItemState();
                return next;
            });
        }
    };

    const cycleExamStatus = () => {
        if (examStatus === 'not-examined' || examStatus === 'has-abnormal') {
            markAllNormal();
        } else {
            resetAllBlocks();
        }
    };

    return (
        <div className="space-y-4">
            {/* ── Vital Signs ──────────────────────────────────────── */}
            <section>
                <div className="rounded-xl bg-themewhite2 overflow-hidden">
                    <div className="px-4 py-3">
                        <div className="grid grid-cols-3 gap-2">
                            {VITAL_SIGNS.map(v => {
                                if (v.key === 'bpDia') return null;
                                if (v.key === 'bpSys') return (
                                    <div key="bp" className="flex items-center gap-1">
                                        <input
                                            type="text"
                                            value={vitals['bpSys'] || ''}
                                            onChange={(e) => setVitalValue('bpSys', e.target.value)}
                                            placeholder="BP sys"
                                            className="w-1/2 text-[10pt] px-3 py-2.5 rounded-full border border-themeblue3/10 shadow-xs bg-themewhite text-primary outline-none focus:border-themeblue1/30 focus:bg-themewhite2 placeholder:text-tertiary/30 transition-all duration-300"
                                        />
                                        <span className="text-[10pt] text-tertiary/40">/</span>
                                        <input
                                            type="text"
                                            value={vitals['bpDia'] || ''}
                                            onChange={(e) => setVitalValue('bpDia', e.target.value)}
                                            placeholder="dia"
                                            className="w-1/2 text-[10pt] px-3 py-2.5 rounded-full border border-themeblue3/10 shadow-xs bg-themewhite text-primary outline-none focus:border-themeblue1/30 focus:bg-themewhite2 placeholder:text-tertiary/30 transition-all duration-300"
                                        />
                                    </div>
                                );
                                return (
                                    <div key={v.key}>
                                        <input
                                            type="text"
                                            value={vitals[v.key] || ''}
                                            onChange={(e) => setVitalValue(v.key, e.target.value)}
                                            placeholder={`${v.shortLabel} (${v.unit})`}
                                            className="w-full text-[10pt] px-3 py-2.5 rounded-full border border-themeblue3/10 shadow-xs bg-themewhite text-primary outline-none focus:border-themeblue1/30 focus:bg-themewhite2 placeholder:text-tertiary/30 transition-all duration-300"
                                        />
                                        {v.key === 'ht' && vitals[v.key]?.trim() && !isNaN(parseFloat(vitals[v.key])) && (
                                            <span className="text-[10pt] text-secondary/50 mt-0.5 block">{(parseFloat(vitals[v.key]) * 2.54).toFixed(1)} cm</span>
                                        )}
                                        {v.key === 'wt' && vitals[v.key]?.trim() && !isNaN(parseFloat(vitals[v.key])) && (
                                            <span className="text-[10pt] text-secondary/50 mt-0.5 block">{(parseFloat(vitals[v.key]) * 0.453592).toFixed(1)} kg</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {bmiInfo && (
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10pt] text-secondary">BMI:</span>
                                <span className={`text-[10pt] font-medium ${
                                    bmiInfo.value < 18.5 ? 'text-amber-500'
                                    : bmiInfo.value < 25 ? 'text-themegreen'
                                    : bmiInfo.value < 30 ? 'text-amber-500'
                                    : 'text-themeredred'
                                }`}>
                                    {bmiInfo.display}
                                </span>
                                <span className="text-[10pt] text-secondary/50">
                                    {bmiInfo.value < 18.5 ? 'Underweight'
                                    : bmiInfo.value < 25 ? 'Normal'
                                    : bmiInfo.value < 30 ? 'Overweight'
                                    : 'Obese'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Exam Blocks ──────────────────────────────────────── */}
            <div className="rounded-xl bg-themewhite2 overflow-hidden">
                <div className="px-4 py-3 relative">
                    <button
                        onClick={cycleExamStatus}
                        className={`absolute top-3 right-4 w-11 h-11 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all z-10 ${
                            examStatus === 'all-normal'
                                ? 'bg-themegreen text-white'
                                : examStatus === 'has-abnormal'
                                ? 'bg-themeredred/20 text-themeredred'
                                : 'bg-tertiary/10 text-tertiary/40'
                        }`}
                    >
                        {examStatus === 'all-normal'
                            ? <RotateCcw size={18} strokeWidth={2.5} />
                            : <Check size={20} strokeWidth={2.5} />
                        }
                    </button>
                    <div className="flex flex-col gap-2 mb-2">
                        {/* MSK laterality / spine region selector (focused mode only) */}
                        {!isCustom && !isComprehensive && categoryLetter === 'B' && bodyPart && (
                            <div className="flex items-center gap-2 flex-wrap pr-14">
                                <span className="text-[10pt] text-secondary font-medium">{bodyPart.label}</span>
                                <div className="flex flex-wrap gap-1">
                                    {isBack ? (
                                        (['cervical', 'thoracic', 'lumbar', 'sacral'] as SpineRegion[]).map(region => (
                                            <button
                                                key={region}
                                                onClick={() => setSpineRegion(region)}
                                                className={`px-3 py-1 text-[10pt] rounded-full transition-colors active:scale-95 ${spineRegion === region
                                                        ? colors.symptomClass
                                                        : 'bg-themewhite3 text-secondary'
                                                    }`}
                                            >
                                                {region.charAt(0).toUpperCase() + region.slice(1)}
                                            </button>
                                        ))
                                    ) : (
                                        (['left', 'right', 'bilateral'] as Laterality[]).map(lat => (
                                            <button
                                                key={lat}
                                                onClick={() => setLaterality(lat)}
                                                className={`px-3 py-1 text-[10pt] rounded-full transition-colors active:scale-95 ${laterality === lat
                                                        ? colors.symptomClass
                                                        : 'bg-themewhite3 text-secondary'
                                                    }`}
                                            >
                                                {lat === 'bilateral' ? 'BL' : lat === 'left' ? 'L' : 'R'}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        {renderBeforeBlocks.map(b => {
                            const state = (isCustom ? wrapperStates[b.key] : blockStates[b.key]) ?? defaultItemState();
                            const setter = isCustom ? setWrapperStates : setBlockStates;
                            return (
                                <ExamItemRow
                                    key={b.key}
                                    block={b}
                                    state={state}
                                    onCycleStatus={() => cycleStatus(b.key, setter, b)}
                                    onToggleNormal={(fk) => toggleNormal(b.key, fk, setter, b)}
                                    onToggleAbnormal={(ak) => toggleAbnormal(b.key, ak, setter, b)}
                                    onSetFindings={(findings) => setFindings(b.key, findings, setter)}
                                    expanders={expanders}
                                    expanderEnabled={expanderEnabled}
                                />
                            );
                        })}

                        {isCustom ? (
                            customBlocks.map(block => {
                                const state = customStates[block.id] ?? defaultItemState();
                                const peBlock = customBlockToPEBlock(block);
                                return (
                                    <ExamItemRow
                                        key={block.id}
                                        block={peBlock}
                                        state={state}
                                        onCycleStatus={() => cycleStatus(block.id, setCustomStates, peBlock)}
                                        onToggleNormal={(fk) => toggleNormal(block.id, fk, setCustomStates, peBlock)}
                                        onToggleAbnormal={(ak) => toggleAbnormal(block.id, ak, setCustomStates, peBlock)}
                                        onSetFindings={(findings) => setFindings(block.id, findings, setCustomStates)}
                                        expanders={expanders}
                                        expanderEnabled={expanderEnabled}
                                    />
                                );
                            })
                        ) : (
                            renderMiddleBlocks.map(b => {
                                const state = blockStates[b.key] ?? defaultItemState();
                                return (
                                    <ExamItemRow
                                        key={b.key}
                                        block={b}
                                        state={state}
                                        onCycleStatus={() => cycleStatus(b.key, setBlockStates, b)}
                                        onToggleNormal={(fk) => toggleNormal(b.key, fk, setBlockStates, b)}
                                        onToggleAbnormal={(ak) => toggleAbnormal(b.key, ak, setBlockStates, b)}
                                        onSetFindings={(findings) => setFindings(b.key, findings, setBlockStates)}
                                        expanders={expanders}
                                        expanderEnabled={expanderEnabled}
                                    />
                                );
                            })
                        )}

                        {renderAfterBlocks.map(b => {
                            const state = (isCustom ? wrapperStates[b.key] : blockStates[b.key]) ?? defaultItemState();
                            const setter = isCustom ? setWrapperStates : setBlockStates;
                            return (
                                <ExamItemRow
                                    key={b.key}
                                    block={b}
                                    state={state}
                                    onCycleStatus={() => cycleStatus(b.key, setter, b)}
                                    onToggleNormal={(fk) => toggleNormal(b.key, fk, setter, b)}
                                    onToggleAbnormal={(ak) => toggleAbnormal(b.key, ak, setter, b)}
                                    onSetFindings={(findings) => setFindings(b.key, findings, setter)}
                                    expanders={expanders}
                                    expanderEnabled={expanderEnabled}
                                />
                            );
                        })}
                    </div>

                </div>
            </div>

            <div className="rounded-xl bg-themewhite2 overflow-hidden">
                <div className="px-4 py-3">
                    <ExpandableInput
                        multiline
                        value={additional}
                        onChange={setAdditional}
                        expanders={expanders}
                        expanderEnabled={expanderEnabled}
                        placeholder="Additional findings..."
                        className="w-full text-[9pt] px-4 py-2.5 rounded-2xl border border-themeblue3/10 shadow-xs bg-themewhite text-primary outline-none focus:border-themeblue1/30 focus:bg-themewhite2 placeholder:text-tertiary/30 resize-none min-h-[3rem] transition-all duration-300"
                    />
                    <PIIWarningBanner warnings={additionalPiiWarnings} />
                </div>
            </div>
        </div>
    );
}
