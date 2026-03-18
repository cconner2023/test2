import { useState, useEffect, useCallback, useMemo } from 'react';
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
} from '../Data/PhysicalExamData';
import type { CategoryLetter, Laterality, SpineRegion, AbnormalOption, PEBlock } from '../Data/PhysicalExamData';
import type { CustomPEBlock, TextExpander, ComprehensivePETemplate } from '../Data/User';
import type { PEState, PEItemState } from '../Types/PETypes';
import { ExpandableInput } from './ExpandableInput';

type SystemStatus = 'not-examined' | 'normal' | 'abnormal';

interface ItemState {
    status: SystemStatus;
    findings: string;
    selectedAbnormals: string[];
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
    return { status: 'not-examined', findings: '', selectedAbnormals: [] };
}

function normalItemState(): ItemState {
    return { status: 'normal', findings: '', selectedAbnormals: [] };
}

// ── Build abnormal text from chips + free text ───────────────
function buildAbnormalText(state: ItemState, options?: AbnormalOption[]): string {
    const parts: string[] = [];
    if (options) {
        for (const opt of options) {
            if (state.selectedAbnormals.includes(opt.key)) {
                parts.push(opt.label);
            }
        }
    }
    if (state.findings.trim()) parts.push(state.findings.trim());
    return parts.join('; ') || '(no details)';
}

// ── Parse abnormal text back into selected chip keys + free text remainder
function parseAbnormalText(text: string, options?: AbnormalOption[]): { selectedKeys: string[]; freeText: string } {
    if (!text || !options || options.length === 0) {
        return { selectedKeys: [], freeText: text || '' };
    }
    const segments = text.split(';').map(s => s.trim()).filter(Boolean);
    const selectedKeys: string[] = [];
    const freeTextParts: string[] = [];

    for (const seg of segments) {
        const matchedOpt = options.find(o => o.label === seg);
        if (matchedOpt) {
            selectedKeys.push(matchedOpt.key);
        } else {
            freeTextParts.push(seg);
        }
    }
    return { selectedKeys, freeText: freeTextParts.join('; ') };
}

function parseItemLine(
    line: string,
    label: string,
    abnormalOptions?: AbnormalOption[],
    normalText?: string,
): ItemState | null {
    if (!line.toUpperCase().startsWith(`${label.toUpperCase()}:`)) return null;
    const rest = line.slice(label.length + 1).trim();
    if (rest.startsWith('Abnormal')) {
        const abnormalText = rest.replace(/^Abnormal\s*-?\s*/, '').trim();
        const parsed = parseAbnormalText(abnormalText, abnormalOptions);
        return { status: 'abnormal', findings: parsed.freeText, selectedAbnormals: parsed.selectedKeys };
    }
    if (rest.startsWith('Normal')) {
        return normalItemState();
    }
    if (normalText && rest === normalText) {
        return normalItemState();
    }
    if (rest) {
        const parsed = parseAbnormalText(rest, abnormalOptions);
        return { status: 'abnormal', findings: parsed.freeText, selectedAbnormals: parsed.selectedKeys };
    }
    return null;
}

// Mapping from old general finding labels to new wrapper keys (for backward compat)
const OLD_GENERAL_TO_WRAPPER: Record<string, string> = {
    'General Appearance': 'sw_gen',
    'Skin': 'sw_derm',
    'Neuro': 'sw_neuro',
    'Psych': 'sw_psych',
};

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

        // Try matching against all known blocks (new labels first)
        let matched = false;
        for (const block of allBlocks) {
            const state = parseItemLine(line, block.label, block.abnormalOptions, block.normalText);
            if (state) {
                blockStates[block.key] = state;
                matched = true;
                break;
            }
        }
        if (matched) continue;

        // Fall back to full BLOCK_LIBRARY for labels not in current block set
        for (const block of Object.values(BLOCK_LIBRARY)) {
            const state = parseItemLine(line, block.label, block.abnormalOptions, block.normalText);
            if (state) {
                // Store under the known key even if it wasn't in the active set
                blockStates[block.key] = state;
                matched = true;
                break;
            }
        }
        if (matched) continue;

        // Backward compat: old general finding labels
        for (const [oldLabel, _newKey] of Object.entries(OLD_GENERAL_TO_WRAPPER)) {
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
            const state = parseItemLine(line, block.label, block.abnormalOptions, block.normalText);
            if (state) { wrapperStates[block.key] = state; matched = true; break; }
        }
        if (matched) continue;

        for (const block of customBlocks) {
            const tagOptions: AbnormalOption[] = block.abnormalTags.map(t => ({ key: t, label: t }));
            const state = parseItemLine(line, block.name, tagOptions, block.normalText);
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

function formatExamLine(label: string, state: ItemState, normalText?: string, abnormalOptions?: AbnormalOption[]): string {
    const uLabel = label.toUpperCase();
    if (state.status === 'normal') {
        return normalText ? `${uLabel}: ${normalText}` : `${uLabel}: Normal`;
    }
    const abnormalText = buildAbnormalText(state, abnormalOptions);
    return `${uLabel}: ${abnormalText}`;
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

    for (const b of beforeWrappers) {
        const state = blockStates[b.key];
        if (!state || state.status === 'not-examined') continue;
        examLines.push(formatExamLine(b.label, state, b.normalText, b.abnormalOptions));
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
        examLines.push(formatExamLine(b.label, state, b.normalText, b.abnormalOptions));
    }

    for (const b of afterWrappers) {
        const state = blockStates[b.key];
        if (!state || state.status === 'not-examined') continue;
        examLines.push(formatExamLine(b.label, state, b.normalText, b.abnormalOptions));
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
        examLines.push(formatExamLine(b.label, state, b.normalText, b.abnormalOptions));
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
        examLines.push(formatExamLine(b.label, state, b.normalText, b.abnormalOptions));
    }

    for (const block of customBlocks) {
        const state = customStates[block.id];
        if (!state || state.status === 'not-examined') continue;
        const tagOptions: AbnormalOption[] = block.abnormalTags.map(t => ({ key: t, label: t }));
        examLines.push(formatExamLine(block.name, state, block.normalText, tagOptions));
    }

    for (const b of afterWrappers) {
        const state = wrapperStates[b.key];
        if (!state || state.status === 'not-examined') continue;
        examLines.push(formatExamLine(b.label, state, b.normalText, b.abnormalOptions));
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

function ExamItemRow({ label, normalText, abnormalOptions, state, onCycleStatus, onToggleAbnormal, onSetFindings, expanders = [], expanderEnabled = false }: {
    label: string;
    normalText?: string;
    abnormalOptions?: AbnormalOption[];
    state: ItemState;
    onCycleStatus: () => void;
    onToggleAbnormal: (optKey: string) => void;
    onSetFindings: (findings: string) => void;
    expanders?: TextExpander[];
    expanderEnabled?: boolean;
}) {
    const findingsWarnings = useMemo(() => detectPII(state.findings), [state.findings]);

    return (
        <div>
            <button
                type="button"
                className="flex items-center justify-between w-full text-left px-1 py-2 text-[10pt] text-secondary active:scale-[0.98] transition-all"
                onClick={onCycleStatus}
            >
                <span className="font-medium">{label.toUpperCase()}</span>
                <span className={`text-[10pt] uppercase tracking-wide font-semibold ${state.status === 'normal'
                        ? 'text-themegreen'
                        : state.status === 'abnormal'
                            ? 'text-themeredred'
                            : 'text-secondary/40'
                    }`}>
                    {state.status === 'not-examined' ? 'Not Examined'
                        : state.status === 'normal' ? 'Normal'
                            : 'Abnormal'}
                </span>
            </button>
            {state.status === 'normal' && normalText && (
                <div className="text-[10pt] text-secondary/60 px-1 pb-1 italic">
                    {normalText}
                </div>
            )}
            {state.status === 'abnormal' && (
                <div className="px-1 pb-2">
                    {abnormalOptions && abnormalOptions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                            {abnormalOptions.map(opt => (
                                <button
                                    key={opt.key}
                                    onClick={(e) => { e.stopPropagation(); onToggleAbnormal(opt.key); }}
                                    className={`px-2 py-0.5 text-[10pt] rounded-full border transition-colors active:scale-95 ${state.selectedAbnormals.includes(opt.key)
                                            ? 'bg-themeredred/20 border-themeredred/40 text-primary'
                                            : 'border-tertiary/15 text-secondary'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                    <ExpandableInput
                        value={state.findings}
                        onChange={onSetFindings}
                        expanders={expanders}
                        expanderEnabled={expanderEnabled}
                        placeholder="Describe findings..."
                        className="w-full text-[10pt] px-3 py-1.5 rounded-lg border border-themeredred/20 shadow-xs bg-themewhite text-tertiary outline-none focus:border-themeredred/40 transition-all duration-300"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <PIIWarningBanner warnings={findingsWarnings} />
                </div>
            )}
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
            findings: state.findings,
            selectedChips: state.selectedAbnormals,
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
        return [...getBaselineWrappers(), ...getFocusedBlocks(categoryLetter)];
    }, [isCustom, isComprehensive, categoryLetter]);

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
        if (isComprehensive) {
            onChange(generateComprehensiveText(bStates, comprehensiveBlocks, add, vit));
        } else {
            onChange(generateFocusedText(categoryLetter, bStates, bodyPart, lat, spine, add, vit));
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
    }, [onChange, onStateChange, isComprehensive, comprehensiveBlocks, categoryLetter, bodyPart]);

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

    const cycleStatus = (key: string, setter: React.Dispatch<React.SetStateAction<Record<string, ItemState>>>) => {
        setter(prev => {
            const current = prev[key]?.status ?? 'not-examined';
            let next: SystemStatus;
            if (current === 'not-examined') next = 'normal';
            else if (current === 'normal') next = 'abnormal';
            else next = 'not-examined';
            return {
                ...prev,
                [key]: {
                    ...(prev[key] ?? defaultItemState()),
                    status: next,
                    findings: next === 'not-examined' ? '' : (prev[key]?.findings ?? ''),
                    selectedAbnormals: next === 'not-examined' ? [] : (prev[key]?.selectedAbnormals ?? []),
                },
            };
        });
    };

    const toggleAbnormal = (itemKey: string, optKey: string, setter: React.Dispatch<React.SetStateAction<Record<string, ItemState>>>) => {
        setter(prev => {
            const state = prev[itemKey] ?? defaultItemState();
            const selected = state.selectedAbnormals.includes(optKey)
                ? state.selectedAbnormals.filter(k => k !== optKey)
                : [...state.selectedAbnormals, optKey];
            return { ...prev, [itemKey]: { ...state, selectedAbnormals: selected } };
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
                for (const key of Object.keys(next)) next[key] = normalItemState();
                return next;
            });
            setWrapperStates(prev => {
                const next = { ...prev };
                for (const key of Object.keys(next)) next[key] = normalItemState();
                return next;
            });
        } else {
            setBlockStates(prev => {
                const next = { ...prev };
                for (const key of Object.keys(next)) next[key] = normalItemState();
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
        return getFocusedBlocks(categoryLetter);
    }, [isComprehensive, isCustom, comprehensiveBlocks, categoryLetter]);

    const examBlockCount = renderBeforeBlocks.length + (isCustom ? customBlocks.length : renderMiddleBlocks.length) + renderAfterBlocks.length;

    return (
        <div className="space-y-4">
            {/* ── Vital Signs ──────────────────────────────────────── */}
            <section>
                <div className="pb-2 flex items-center gap-2">
                    <p className="text-[10pt] font-semibold text-tertiary/50 tracking-widest uppercase">Vital Signs</p>
                </div>
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
                                            className="w-1/2 text-[10pt] px-2 py-2 rounded-lg border border-themeblue3/10 shadow-xs bg-themewhite text-primary outline-none focus:border-themeblue1/30 focus:bg-themewhite2 placeholder:text-tertiary/30 transition-all duration-300"
                                        />
                                        <span className="text-[10pt] text-tertiary/40">/</span>
                                        <input
                                            type="text"
                                            value={vitals['bpDia'] || ''}
                                            onChange={(e) => setVitalValue('bpDia', e.target.value)}
                                            placeholder="dia"
                                            className="w-1/2 text-[10pt] px-2 py-2 rounded-lg border border-themeblue3/10 shadow-xs bg-themewhite text-primary outline-none focus:border-themeblue1/30 focus:bg-themewhite2 placeholder:text-tertiary/30 transition-all duration-300"
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
                                            className="w-full text-[10pt] px-2 py-2 rounded-lg border border-themeblue3/10 shadow-xs bg-themewhite text-primary outline-none focus:border-themeblue1/30 focus:bg-themewhite2 placeholder:text-tertiary/30 transition-all duration-300"
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
            <section>
                <div className="pb-2 flex items-center gap-2">
                    <p className="text-[10pt] font-semibold text-tertiary/50 tracking-widest uppercase">Exam</p>
                    <span className="text-[10pt] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/50 font-medium">
                        {examBlockCount}
                    </span>
                </div>
                <div className="rounded-xl bg-themewhite2 overflow-hidden">
                    <div className="px-4 py-3">
                        <button
                            onClick={markAllNormal}
                            className="w-full py-2 mb-2 text-[10pt] font-medium rounded-lg border border-themeblue1/30 text-themeblue1 bg-themeblue1/5 active:scale-[0.98] transition-all"
                        >
                            All Normal
                        </button>

                        {/* MSK laterality / spine region selector (focused mode only) */}
                        {!isCustom && !isComprehensive && categoryLetter === 'B' && bodyPart && (
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10pt] text-secondary font-medium">{bodyPart.label}</span>
                                <div className="flex gap-1 ml-auto">
                                    {isBack ? (
                                        (['cervical', 'thoracic', 'lumbar', 'sacral'] as SpineRegion[]).map(region => (
                                            <button
                                                key={region}
                                                onClick={() => setSpineRegion(region)}
                                                className={`px-2.5 py-1 text-[10pt] rounded-full transition-colors active:scale-95 ${spineRegion === region
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
                                                className={`px-2.5 py-1 text-[10pt] rounded-full transition-colors active:scale-95 ${laterality === lat
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

                        <div>
                            {renderBeforeBlocks.map(b => {
                                const state = (isCustom ? wrapperStates[b.key] : blockStates[b.key]) ?? defaultItemState();
                                const setter = isCustom ? setWrapperStates : setBlockStates;
                                return (
                                    <ExamItemRow
                                        key={b.key}
                                        label={b.label}
                                        normalText={b.normalText}
                                        abnormalOptions={b.abnormalOptions}
                                        state={state}
                                        onCycleStatus={() => cycleStatus(b.key, setter)}
                                        onToggleAbnormal={(optKey) => toggleAbnormal(b.key, optKey, setter)}
                                        onSetFindings={(findings) => setFindings(b.key, findings, setter)}
                                        expanders={expanders}
                                        expanderEnabled={expanderEnabled}
                                    />
                                );
                            })}

                            {isCustom ? (
                                customBlocks.map(block => {
                                    const state = customStates[block.id] ?? defaultItemState();
                                    const abnormalOptions: AbnormalOption[] = block.abnormalTags.map(tag => ({ key: tag, label: tag }));
                                    return (
                                        <ExamItemRow
                                            key={block.id}
                                            label={block.name}
                                            normalText={block.normalText}
                                            abnormalOptions={abnormalOptions}
                                            state={state}
                                            onCycleStatus={() => cycleStatus(block.id, setCustomStates)}
                                            onToggleAbnormal={(optKey) => toggleAbnormal(block.id, optKey, setCustomStates)}
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
                                            label={b.label}
                                            normalText={b.normalText}
                                            abnormalOptions={b.abnormalOptions}
                                            state={state}
                                            onCycleStatus={() => cycleStatus(b.key, setBlockStates)}
                                            onToggleAbnormal={(optKey) => toggleAbnormal(b.key, optKey, setBlockStates)}
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
                                        label={b.label}
                                        normalText={b.normalText}
                                        abnormalOptions={b.abnormalOptions}
                                        state={state}
                                        onCycleStatus={() => cycleStatus(b.key, setter)}
                                        onToggleAbnormal={(optKey) => toggleAbnormal(b.key, optKey, setter)}
                                        onSetFindings={(findings) => setFindings(b.key, findings, setter)}
                                        expanders={expanders}
                                        expanderEnabled={expanderEnabled}
                                    />
                                );
                            })}
                        </div>

                        <ExpandableInput
                            multiline
                            value={additional}
                            onChange={setAdditional}
                            expanders={expanders}
                            expanderEnabled={expanderEnabled}
                            placeholder="Additional findings..."
                            className="w-full text-[10pt] px-3 py-2 mt-2 rounded-lg border border-themeblue3/10 shadow-xs bg-themewhite text-tertiary outline-none focus:border-themeblue1/30 focus:bg-themewhite2 placeholder:text-tertiary/30 resize-none min-h-[3rem] transition-all duration-300"
                        />
                        <PIIWarningBanner warnings={additionalPiiWarnings} />
                    </div>
                </div>
            </section>
        </div>
    );
}
