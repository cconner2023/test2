import {
    VITAL_SIGNS,
    MASTER_BLOCKS,
    getBlocksForTemplate,
    applySpecify,
    lateralLabel,
} from '../Data/PhysicalExamData';
import type {
    CategoryLetter,
    Laterality,
    SpineRegion,
    PEFinding,
    PEBlock,
    MasterPEBlock,
    MasterPEFinding,
} from '../Data/PhysicalExamData';
import { formatVitalsText } from '../Utilities/peCodec';
import type { PEState, PEItemState } from '../Types/PETypes';

type SystemStatus = 'not-examined' | 'normal' | 'abnormal';

interface ItemState {
    status: SystemStatus;
    selectedNormals: string[];
    selectedAbnormals: string[];
    /** Detail text for "(specify…)" abnormals, keyed by abnormal key. */
    specifyDetails: Record<string, string>;
    findings: string;
    /** Per-block side for `lateral` blocks (Eyes). */
    laterality?: Laterality;
}

// ── Helpers ───────────────────────────────────────────────────

function defaultItemState(): ItemState {
    return { status: 'not-examined', selectedNormals: [], selectedAbnormals: [], specifyDetails: {}, findings: '' };
}

/** Strip tier from MasterPEFinding[] to produce PEFinding[]-compatible shape */
function toViewFindings(findings: MasterPEFinding[]): PEFinding[] {
    return findings.map(({ key, normal, abnormals }) => ({ key, normal, abnormals }));
}

/** Convert a MasterPEBlock (or filtered subset) to the PEBlock shape expected by ExamBlockPreview */
function toViewBlock(block: MasterPEBlock, visibleFindings: MasterPEFinding[]): PEBlock {
    return { key: block.key, label: block.label, findings: toViewFindings(visibleFindings), ...(block.lateral && { lateral: true as const }) };
}

/** Get the findings that should be visible for a block given expansion state */
function getVisibleFindings(block: MasterPEBlock, isExpanded: boolean): MasterPEFinding[] {
    if (isExpanded) return block.findings;
    return block.findings.filter(f => f.tier === 'baseline');
}

function allNormalsSelected(findings: PEFinding[]): ItemState {
    return {
        status: 'normal',
        selectedNormals: findings.filter(f => f.normal).map(f => f.key),
        selectedAbnormals: [],
        specifyDetails: {},
        findings: '',
    };
}

// ── Parse a single exam line against a PEBlock's findings ─────
function parseItemLine(
    line: string,
    label: string,
    block: PEBlock,
): ItemState | null {
    const upper = line.toUpperCase();
    const uLabel = label.toUpperCase();
    if (!upper.startsWith(uLabel)) return null;
    // Optional laterality tag between label and colon — "EYES (L):"
    const head = /^\s*(?:\((L|R|BILAT)\))?\s*:/.exec(upper.slice(uLabel.length));
    if (!head) return null;
    const tagLat: Laterality | undefined = block.lateral && head[1]
        ? (head[1] === 'L' ? 'left' : head[1] === 'R' ? 'right' : 'bilateral')
        : undefined;
    const rest = line.slice(uLabel.length + head[0].length).trim();

    const allNormalTexts: Array<{ key: string; text: string }> = block.findings
        .filter(f => f.normal)
        .map(f => ({ key: f.key, text: f.normal }));
    const allAbnormalTexts: Array<{ key: string; label: string }> = block.findings.flatMap(f =>
        f.abnormals.map(a => ({ key: a.key, label: a.label })),
    );

    if (rest === 'Normal') {
        return { ...allNormalsSelected(block.findings), laterality: tagLat };
    }

    const segments = rest.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    const selectedNormals: string[] = [];
    const selectedAbnormals: string[] = [];
    const freeTextParts: string[] = [];

    for (const seg of segments) {
        const normalMatch = allNormalTexts.find(n => n.text === seg);
        if (normalMatch) { selectedNormals.push(normalMatch.key); continue; }
        const abnormalMatch = allAbnormalTexts.find(a => a.label === seg);
        if (abnormalMatch) { selectedAbnormals.push(abnormalMatch.key); continue; }
        freeTextParts.push(seg);
    }

    const hasAbnormal = selectedAbnormals.length > 0 || freeTextParts.length > 0;
    const hasNormal = selectedNormals.length > 0;
    const status: SystemStatus = hasAbnormal ? 'abnormal' : hasNormal ? 'normal' : 'not-examined';

    if (status === 'not-examined' && !rest) return null;

    return { status, selectedNormals, selectedAbnormals, specifyDetails: {}, findings: freeTextParts.join('; '), laterality: tagLat };
}

// ── Parse initial text against master blocks ──────────────────
function parseInitialText(
    text: string,
    blocks: MasterPEBlock[],
): {
    blockStates: Record<string, ItemState>;
    laterality: Laterality;
    spineRegion: SpineRegion;
    additional: string;
    vitals: Record<string, string>;
} {
    const blockStates: Record<string, ItemState> = {};
    for (const b of blocks) blockStates[b.key] = defaultItemState();
    let laterality: Laterality = 'right';
    let spineRegion: SpineRegion = 'lumbar';
    let additional = '';
    const vitals: Record<string, string> = {};
    VITAL_SIGNS.forEach(v => { vitals[v.key] = ''; });

    if (!text) return { blockStates, laterality, spineRegion, additional, vitals };

    // Build PEBlock views for ALL master blocks (full findings) to maximize parse matching
    const viewBlocks: PEBlock[] = MASTER_BLOCKS.map(b => toViewBlock(b, b.findings));

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

        // Parses one "Label: value unit (conversion)" vital segment; false if unrecognized.
        const parseVitalSegment = (seg: string): boolean => {
            const bpMatch = seg.match(/^\s*BP:\s*(.+?)\/(.+?)\s*mmHg/);
            if (bpMatch) {
                const sys = bpMatch[1].trim();
                const dia = bpMatch[2].trim();
                if (sys && sys !== '--') vitals['bpSys'] = sys;
                if (dia && dia !== '--') vitals['bpDia'] = dia;
                return true;
            }
            if (seg.match(/^\s*BMI:/)) return true;
            const vitalMatch = seg.match(/^\s*(\w+):\s*(.+)/);
            if (!vitalMatch) return false;
            const key = vitalLabelToKey[vitalMatch[1]];
            if (!key) return false;
            let val = vitalMatch[2].trim();
            val = val.replace(/\s*\([^)]*\)\s*$/, '');
            const vitalDef = VITAL_SIGNS.find(v => v.key === key);
            if (vitalDef && vitalDef.unit && val.endsWith(vitalDef.unit)) {
                val = val.slice(0, -vitalDef.unit.length).trim();
            }
            vitals[key] = val;
            return true;
        };

        if (line.startsWith('Vital Signs:') || line === 'Vital Signs') {
            const rest = line.replace(/^Vital Signs:?/, '').trim();
            if (rest) {
                // Single-line format: segments separated by " | "
                rest.split('|').forEach(seg => parseVitalSegment(seg));
            } else {
                inVitals = true; // legacy multi-line format
            }
            continue;
        }
        if (inVitals) {
            if (parseVitalSegment(line)) continue;
            if (line.trim()) inVitals = false;
            else continue;
        }

        if (!line.trim()) continue;

        // Skip category headers and old section labels
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

        // Try matching against all master blocks (full findings for best parse coverage)
        let matched = false;
        for (const vb of viewBlocks) {
            const state = parseItemLine(line, vb.label, vb);
            if (state) {
                blockStates[vb.key] = state;
                matched = true;
                break;
            }
        }
        if (matched) continue;

        // Backward compat: skip old labels we recognize but don't care about
        if (line.match(/^(General Appearance|Skin|Neuro|Psych|GEN|EYES|HENT|NEURO|PSYCH)\s*:/i)) continue;

        if (line.trim() && !line.match(/^(Vitals:|PE:)/)) {
            unmatchedLines.push(line);
        }
    }

    if (unmatchedLines.length > 0) {
        const extraContent = unmatchedLines.join('\n');
        additional = additional ? `${additional}\n${extraContent}` : extraContent;
    }

    return { blockStates, laterality, spineRegion, additional, vitals };
}

// ── Text generation ──────────────────────────────────────────

function formatExamLine(label: string, state: ItemState, findings: PEFinding[], lateral?: boolean): string {
    const uLabel = lateralLabel(label.toUpperCase(), lateral ? state.laterality : undefined);
    const normalParts: string[] = [];
    const abnormalParts: string[] = [];

    for (const finding of findings) {
        if (finding.normal && state.selectedNormals.includes(finding.key)) {
            normalParts.push(finding.normal);
        }
        for (const abn of finding.abnormals) {
            if (state.selectedAbnormals.includes(abn.key)) {
                abnormalParts.push(applySpecify(abn.label, state.specifyDetails[abn.key]));
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

function generateText(
    blocks: MasterPEBlock[],
    blockStates: Record<string, ItemState>,
    expandedKeys: Set<string>,
    laterality: Laterality,
    spineRegion: SpineRegion,
    additional: string,
    vitals: Record<string, string>,
    categoryLetter: CategoryLetter,
): string {
    const parts: string[] = [...formatVitalsText(vitals)];
    const examLines: string[] = [];

    for (const block of blocks) {
        const state = blockStates[block.key];
        if (!state || state.status === 'not-examined') continue;

        const isExpanded = expandedKeys.has(block.key);
        const visibleFindings = getVisibleFindings(block, isExpanded);
        examLines.push(formatExamLine(block.label, state, toViewFindings(visibleFindings), block.lateral));
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

/** Structured state from legacy PE text; examined blocks become the template. */
export function parsePEText(text: string, categoryLetter: CategoryLetter): PEState {
    const p = parseInitialText(text, []);
    const items = toEncodableState(p.blockStates);
    const blockKeys = Object.keys(items);
    return {
        categoryLetter, laterality: p.laterality, spineRegion: p.spineRegion,
        items, vitals: p.vitals, additional: p.additional,
        mode: 'template', blockKeys, blockOrder: blockKeys,
    };
}

export function generatePEText(peState: PEState): string {
    const blocks = getBlocksForTemplate(peState.blockKeys ?? []);
    const expandedKeys = new Set(blocks.map(b => b.key));
    const blockStates: Record<string, ItemState> = {};
    for (const [key, s] of Object.entries(peState.items)) {
        blockStates[key] = { ...s, specifyDetails: s.specifyDetails ?? {} };
    }
    return generateText(
        blocks,
        blockStates,
        expandedKeys,
        peState.laterality,
        peState.spineRegion,
        peState.additional,
        peState.vitals,
        peState.categoryLetter,
    );
}

// ── State encoding ────────────────────────────────────────────

function toEncodableState(blockStates: Record<string, ItemState>): Record<string, PEItemState> {
    const result: Record<string, PEItemState> = {};
    for (const [key, state] of Object.entries(blockStates)) {
        if (state.status === 'not-examined') continue;
        result[key] = {
            status: state.status,
            selectedNormals: state.selectedNormals,
            selectedAbnormals: state.selectedAbnormals,
            specifyDetails: state.specifyDetails,
            findings: state.findings,
            ...(state.laterality && { laterality: state.laterality }),
        };
    }
    return result;
}
