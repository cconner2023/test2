import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Check, RotateCcw, Plus, AlertTriangle, ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';
import { ContextMenuPreview } from './ContextMenuPreview';
import type { ContextMenuAction } from './ContextMenuPreview';
import { ExamBlockPreview } from './ExamBlockPreview';
import { ListItemRow } from './ListItemRow';
import type { getColorClasses } from '../Utilities/ColorUtilities';
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

function allAbnormalsSelected(block: PEBlock): ItemState {
    return {
        status: 'abnormal',
        selectedNormals: [],
        selectedAbnormals: block.findings.flatMap(f => f.abnormals.map(a => a.key)),
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

function summarizeFindings(block: PEBlock, state: ItemState): { normals: string[]; abnormals: string[] } {
    const normals: string[] = [];
    const abnormals: string[] = [];
    for (const finding of block.findings) {
        if (finding.normal && state.selectedNormals.includes(finding.key)) {
            normals.push(finding.normal);
        }
        for (const abn of finding.abnormals) {
            if (state.selectedAbnormals.includes(abn.key)) {
                abnormals.push(abn.label);
            }
        }
    }
    if (state.findings.trim()) abnormals.push(state.findings.trim());
    return { normals, abnormals };
}

function ExamItemRow({ block, state, onCycleStatus, onTap, index }: {
    block: PEBlock;
    state: ItemState;
    onCycleStatus: () => void;
    onTap: (index: number, rect: DOMRect) => void;
    index: number;
}) {
    const rowRef = useRef<HTMLDivElement>(null);

    const handleTap = () => {
        if (rowRef.current) {
            onTap(index, rowRef.current.getBoundingClientRect());
        }
    };

    const { normals, abnormals } = useMemo(() => summarizeFindings(block, state), [block, state]);
    const hasSummary = state.status !== 'not-examined' && (normals.length > 0 || abnormals.length > 0);

    return (
        <div ref={rowRef}>
            <ListItemRow
                onClick={handleTap}
                className="py-2.5 active:scale-[0.98] transition-all"
                left={
                    <button
                        type="button"
                        className="shrink-0 active:scale-90 transition-transform"
                        onClick={(e) => { e.stopPropagation(); onCycleStatus(); }}
                    >
                        <span className={`block w-3.5 h-3.5 rounded-full transition-colors duration-200 ${
                            state.status === 'normal' ? 'bg-themegreen'
                            : state.status === 'abnormal' ? 'bg-themeredred'
                            : 'ring-[1.5px] ring-inset ring-tertiary/25 bg-transparent'
                        }`} />
                    </button>
                }
                center={
                    <>
                        <p className="text-sm font-medium text-primary truncate">{block.label}</p>
                        {hasSummary && (
                            <p className="text-[11px] text-tertiary/70 mt-0.5 truncate">
                                {normals.length > 0 && normals.join(', ')}
                                {normals.length > 0 && abnormals.length > 0 && ' · '}
                                {abnormals.length > 0 && abnormals.join(', ')}
                            </p>
                        )}
                    </>
                }
            />
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

function InlineAddCard({ onSubmit, onCancel }: {
    onSubmit: (label: string, findings: string) => void;
    onCancel: () => void;
}) {
    const [label, setLabel] = useState('');
    const [findings, setFindings] = useState('');

    return (
        <div className="rounded-xl bg-themewhite2 overflow-hidden px-4 py-3 space-y-2">
            <div className="relative flex flex-1 items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                <input
                    type="text"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="Label (e.g. CARDIO, NEURO)"
                    className="w-full bg-transparent outline-none text-sm text-primary px-3.5 py-2.5 rounded-full min-w-0 placeholder:text-tertiary/30"
                />
            </div>

            <textarea
                value={findings}
                onChange={e => setFindings(e.target.value)}
                placeholder="Findings..."
                className="w-full min-h-[3rem] px-3.5 py-2.5 rounded-xl text-sm text-primary border border-themeblue3/10 shadow-xs bg-themewhite focus:border-themeblue1/30 focus:outline-none transition-all placeholder:text-tertiary/30 resize-none leading-5"
            />

            <div className="flex gap-1.5 justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                >
                    <X size={18} />
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const l = label.trim();
                        const f = findings.trim();
                        if (!l && !f) return;
                        onSubmit(l, f);
                    }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
                        label.trim() || findings.trim()
                            ? 'bg-themeblue3 text-white'
                            : 'bg-tertiary/8 text-tertiary/30 cursor-default'
                    }`}
                >
                    <Check size={18} />
                </button>
            </div>
        </div>
    );
}

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

    // ── Add section / text state ────────────────────────────────
    const [showAddCard, setShowAddCard] = useState(false);
    const [addedBlocks, setAddedBlocks] = useState<PEBlock[]>([]);

    // ── Emit change ────────────────────────────────────────────
    const emitChange = useCallback((
        bStates: Record<string, ItemState>,
        lat: Laterality,
        spine: SpineRegion,
        add: string,
        vit: Record<string, string>,
    ) => {
        const baseBlocks = isComprehensive ? comprehensiveBlocks : focusedAllBlocks;
        const allBlocks = addedBlocks.length > 0 ? [...baseBlocks, ...addedBlocks] : baseBlocks;
        if (isComprehensive) {
            onChange(generateComprehensiveText(bStates, [...comprehensiveBlocks, ...addedBlocks], add, vit));
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
    }, [onChange, onStateChange, isComprehensive, comprehensiveBlocks, focusedAllBlocks, categoryLetter, bodyPart, addedBlocks]);

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

    const markAllAbnormal = () => {
        if (isCustom) {
            setCustomStates(prev => {
                const next = { ...prev };
                for (const block of customBlocks) {
                    next[block.id] = allAbnormalsSelected(customBlockToPEBlock(block));
                }
                return next;
            });
            setWrapperStates(prev => {
                const next = { ...prev };
                for (const b of baselineWrappers) {
                    next[b.key] = allAbnormalsSelected(b);
                }
                return next;
            });
        } else {
            const activeBlocks = isComprehensive ? comprehensiveBlocks : focusedAllBlocks;
            setBlockStates(prev => {
                const next = { ...prev };
                for (const b of activeBlocks) {
                    next[b.key] = allAbnormalsSelected(b);
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

    // Compute exam-wide status for cycling icon
    const examStatus = useMemo((): 'not-examined' | 'all-normal' | 'all-abnormal' | 'has-abnormal' => {
        const allStates = isCustom
            ? [...Object.values(wrapperStates), ...Object.values(customStates)]
            : Object.values(blockStates);
        const examined = allStates.filter(s => s.status !== 'not-examined');
        if (examined.length === 0) return 'not-examined';
        if (examined.every(s => s.status === 'abnormal') && examined.length === allStates.length) return 'all-abnormal';
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
        if (examStatus === 'not-examined') {
            markAllNormal();
        } else if (examStatus === 'all-normal') {
            markAllAbnormal();
        } else {
            // has-abnormal or all-abnormal → reset
            resetAllBlocks();
        }
    };

    // ── Flat block list for popover navigation ────────────────
    type FlatEntry = { block: PEBlock; key: string; getter: () => ItemState; setter: React.Dispatch<React.SetStateAction<Record<string, ItemState>>>; isAdded?: boolean };

    const flatBlockList = useMemo((): FlatEntry[] => {
        const list: FlatEntry[] = [];
        for (const b of renderBeforeBlocks) {
            const s = isCustom ? setWrapperStates : setBlockStates;
            const stateMap = isCustom ? wrapperStates : blockStates;
            list.push({ block: b, key: b.key, getter: () => stateMap[b.key] ?? defaultItemState(), setter: s });
        }
        if (isCustom) {
            for (const cb of customBlocks) {
                const peBlock = customBlockToPEBlock(cb);
                list.push({ block: peBlock, key: cb.id, getter: () => customStates[cb.id] ?? defaultItemState(), setter: setCustomStates });
            }
        } else {
            for (const b of renderMiddleBlocks) {
                list.push({ block: b, key: b.key, getter: () => blockStates[b.key] ?? defaultItemState(), setter: setBlockStates });
            }
        }
        // Added blocks from section builder
        for (const b of addedBlocks) {
            if (!list.some(e => e.key === b.key)) {
                list.push({ block: b, key: b.key, getter: () => blockStates[b.key] ?? defaultItemState(), setter: setBlockStates, isAdded: true });
            }
        }
        for (const b of renderAfterBlocks) {
            const s = isCustom ? setWrapperStates : setBlockStates;
            const stateMap = isCustom ? wrapperStates : blockStates;
            list.push({ block: b, key: b.key, getter: () => stateMap[b.key] ?? defaultItemState(), setter: s });
        }
        return list;
    }, [renderBeforeBlocks, renderMiddleBlocks, renderAfterBlocks, isCustom, customBlocks, blockStates, wrapperStates, customStates, addedBlocks]);

    // ── Custom findings added inline via popover ──────────────
    const [customFindings, setCustomFindings] = useState<Record<string, { key: string; label: string }[]>>({});

    const augmentBlock = useCallback((block: PEBlock, blockKey: string): PEBlock => {
        const extras = customFindings[blockKey];
        if (!extras || extras.length === 0) return block;
        return {
            ...block,
            findings: [
                ...block.findings,
                ...extras.map(cf => ({
                    key: cf.key,
                    normal: '',
                    abnormals: [{ key: cf.key, label: cf.label }],
                })),
            ],
        };
    }, [customFindings]);

    const addCustomFinding = useCallback((blockKey: string, value: string, entry: FlatEntry) => {
        const cfKey = `custom_${blockKey}_${Date.now()}`;
        setCustomFindings(prev => ({
            ...prev,
            [blockKey]: [...(prev[blockKey] ?? []), { key: cfKey, label: value }],
        }));
        // Auto-select as abnormal
        entry.setter(prev => {
            const cur = prev[blockKey] ?? defaultItemState();
            return {
                ...prev,
                [blockKey]: {
                    ...cur,
                    status: 'abnormal',
                    selectedAbnormals: [...cur.selectedAbnormals, cfKey],
                },
            };
        });
    }, []);

    // ── Lifted popover state ──────────────────────────────────
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [popoverAnchorRect, setPopoverAnchorRect] = useState<DOMRect | null>(null);


    const handleRowTap = useCallback((index: number, rect: DOMRect) => {
        setPopoverAnchorRect(rect);
        setEditingIndex(index);
    }, []);

    const editingEntry = editingIndex !== null ? flatBlockList[editingIndex] : null;
    const editingState = editingEntry ? editingEntry.getter() : null;

    const deleteBlock = useCallback((entry: FlatEntry) => {
        setAddedBlocks(prev => prev.filter(b => b.key !== entry.key));
        entry.setter(prev => ({ ...prev, [entry.key]: defaultItemState() }));
        setEditingIndex(null);
    }, []);

    const popoverActions = useMemo((): ContextMenuAction[] => {
        if (editingIndex === null) return [];
        const len = flatBlockList.length;
        const isFirst = editingIndex === 0;
        const isLast = editingIndex === len - 1;
        const entry = flatBlockList[editingIndex];
        const state = entry.getter();
        const hasSelections = state.status !== 'not-examined';
        const actions: ContextMenuAction[] = [];
        if (!isFirst) {
            actions.push({
                key: 'prev',
                label: '',
                icon: ChevronLeft,
                onAction: () => setEditingIndex(editingIndex - 1),
                closesOnAction: false,
            });
        }
        actions.push({
            key: 'normal',
            label: '',
            icon: Check,
            onAction: () => entry.setter(prev => ({ ...prev, [entry.key]: allNormalsSelected(entry.block) })),
            closesOnAction: false,
        });
        if (hasSelections) {
            actions.push({
                key: 'reset',
                label: '',
                icon: RotateCcw,
                onAction: () => entry.setter(prev => ({ ...prev, [entry.key]: defaultItemState() })),
                closesOnAction: false,
            });
        }
        if (!isLast) {
            actions.push({
                key: 'next',
                label: '',
                icon: ChevronRight,
                onAction: () => setEditingIndex(editingIndex + 1),
                closesOnAction: false,
            });
        }
        if (entry.isAdded) {
            actions.push({
                key: 'delete',
                label: '',
                icon: Trash2,
                onAction: () => deleteBlock(entry),
                variant: 'danger',
            });
        }
        return actions;
    }, [editingIndex, flatBlockList, deleteBlock]);

    // ── Tour event listeners ──────────────────────────────────
    useEffect(() => {
        const onOpenPreview = (e: Event) => {
            const blockKey = (e as CustomEvent<string>).detail;
            const idx = flatBlockList.findIndex(entry => entry.key === blockKey);
            if (idx === -1) return;
            setPopoverAnchorRect(new DOMRect(window.innerWidth / 2, window.innerHeight / 3, 0, 0));
            setEditingIndex(idx);
        };
        const onMarkNormal = () => {
            if (editingIndex === null) return;
            const entry = flatBlockList[editingIndex];
            entry.setter(prev => ({ ...prev, [entry.key]: allNormalsSelected(entry.block) }));
        };
        const onToggleAbnormal = (e: Event) => {
            if (editingIndex === null) return;
            const abnormalKey = (e as CustomEvent<string>).detail;
            const entry = flatBlockList[editingIndex];
            toggleAbnormal(entry.key, abnormalKey, entry.setter, augmentBlock(entry.block, entry.key));
        };
        const onReset = () => {
            if (editingIndex === null) return;
            const entry = flatBlockList[editingIndex];
            entry.setter(prev => ({ ...prev, [entry.key]: defaultItemState() }));
        };
        const onClosePreview = () => setEditingIndex(null);

        window.addEventListener('tour:pe-open-preview', onOpenPreview);
        window.addEventListener('tour:pe-mark-normal', onMarkNormal);
        window.addEventListener('tour:pe-toggle-abnormal', onToggleAbnormal);
        window.addEventListener('tour:pe-reset', onReset);
        window.addEventListener('tour:pe-close-preview', onClosePreview);
        return () => {
            window.removeEventListener('tour:pe-open-preview', onOpenPreview);
            window.removeEventListener('tour:pe-mark-normal', onMarkNormal);
            window.removeEventListener('tour:pe-toggle-abnormal', onToggleAbnormal);
            window.removeEventListener('tour:pe-reset', onReset);
            window.removeEventListener('tour:pe-close-preview', onClosePreview);
        };
    }, [flatBlockList, editingIndex, augmentBlock]);

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
                                : examStatus === 'all-abnormal'
                                ? 'bg-themeredred text-white'
                                : examStatus === 'has-abnormal'
                                ? 'bg-themeredred/20 text-themeredred'
                                : 'bg-tertiary/10 text-tertiary/40'
                        }`}
                    >
                        {examStatus === 'all-normal'
                            ? <Check size={20} strokeWidth={2.5} />
                            : examStatus === 'all-abnormal' || examStatus === 'has-abnormal'
                            ? <AlertTriangle size={18} strokeWidth={2.5} />
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
                        {flatBlockList.map((entry, i) => (
                            <ExamItemRow
                                key={entry.key}
                                block={entry.block}
                                state={entry.getter()}
                                onCycleStatus={() => cycleStatus(entry.key, entry.setter, entry.block)}
                                onTap={handleRowTap}
                                index={i}
                            />
                        ))}
                    </div>

                </div>
            </div>

            {/* ── Lifted single popover ── */}
            {editingEntry && editingState && (
                <ContextMenuPreview
                    isVisible={editingIndex !== null}
                    onClose={() => setEditingIndex(null)}
                    anchorRect={popoverAnchorRect}
                    maxWidth="max-w-[340px] md:max-w-[520px]"
                    searchPlaceholder="Filter findings..."
                    preview={(filter, clearFilter) => {
                        const augmented = augmentBlock(editingEntry.block, editingEntry.key);
                        return (
                            <ExamBlockPreview
                                block={augmented}
                                state={editingState}
                                filter={filter}
                                onToggleNormal={(fk) => { toggleNormal(editingEntry.key, fk, editingEntry.setter, augmented); clearFilter(); }}
                                onToggleAbnormal={(ak) => { toggleAbnormal(editingEntry.key, ak, editingEntry.setter, augmented); clearFilter(); }}
                            />
                        );
                    }}
                    actions={popoverActions}
                    onAdd={(value) => addCustomFinding(editingEntry.key, value, editingEntry)}
                    addPlaceholder="Add custom finding..."
                />
            )}

            {/* ── Inline add card (animated reveal) ── */}
            <div className={`overflow-hidden transition-all duration-300 ease-out ${
                showAddCard ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
            }`}>
                {showAddCard && (
                    <InlineAddCard
                        onCancel={() => setShowAddCard(false)}
                        onSubmit={(label, findings) => {
                            const key = `inline_${Date.now()}`;
                            const block: PEBlock = { key, label: label || 'Additional', findings: [] };
                            setAddedBlocks(prev => [...prev, block]);
                            setBlockStates(prev => ({
                                ...prev,
                                [key]: { status: 'abnormal', selectedNormals: [], selectedAbnormals: [], findings },
                            }));
                            setShowAddCard(false);
                        }}
                    />
                )}
            </div>

            {/* ── Add button ── */}
            {!showAddCard && (
                <div className="flex justify-center pt-1">
                    <button
                        type="button"
                        onClick={() => setShowAddCard(true)}
                        className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}
