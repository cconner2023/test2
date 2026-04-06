import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Check, RotateCcw, Plus, AlertTriangle, ChevronLeft, ChevronRight, X, Trash2, GripVertical } from 'lucide-react';
import { ContextMenuPreview } from './ContextMenuPreview';
import type { ContextMenuAction } from './ContextMenuPreview';
import { ExamBlockPreview } from './ExamBlockPreview';
import { ListItemRow } from './ListItemRow';
import type { getColorClasses } from '../Utilities/ColorUtilities';
import {
    getCategoryFromSymptomCode,
    isBackPainCode,
    VITAL_SIGNS,
    MASTER_BLOCKS,
    MASTER_BLOCKS_TOP_LEVEL,
    MASTER_BLOCK_LIBRARY,
    MSK_CHILD_KEYS,
    getBlocksForFocusedExam,
    getBlocksForTemplate,
    getMasterBlockByKey,
    FOCUSED_EXPANSION,
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
import type { TextExpander } from '../Data/User';
import type { PEState, PEItemState } from '../Types/PETypes';


type SystemStatus = 'not-examined' | 'normal' | 'abnormal';

interface ItemState {
    status: SystemStatus;
    selectedNormals: string[];
    selectedAbnormals: string[];
    findings: string;
}

interface PhysicalExamProps {
    initialText?: string;
    initialState?: PEState | null;
    onChange: (text: string) => void;
    onStateChange?: (state: PEState) => void;
    colors: ReturnType<typeof getColorClasses>;
    symptomCode: string;
    mode?: 'focused' | 'template';
    templateBlockKeys?: string[];
    onBlockKeysChange?: (keys: string[]) => void;
    expanders?: TextExpander[];
}

// ── Helpers ───────────────────────────────────────────────────

function defaultItemState(): ItemState {
    return { status: 'not-examined', selectedNormals: [], selectedAbnormals: [], findings: '' };
}

/** Strip tier from MasterPEFinding[] to produce PEFinding[]-compatible shape */
function toViewFindings(findings: MasterPEFinding[]): PEFinding[] {
    return findings.map(({ key, normal, abnormals }) => ({ key, normal, abnormals }));
}

/** Convert a MasterPEBlock (or filtered subset) to the PEBlock shape expected by ExamBlockPreview */
function toViewBlock(block: MasterPEBlock, visibleFindings: MasterPEFinding[]): PEBlock {
    return { key: block.key, label: block.label, findings: toViewFindings(visibleFindings) };
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
        findings: '',
    };
}

function allAbnormalsSelected(findings: PEFinding[]): ItemState {
    return {
        status: 'abnormal',
        selectedNormals: [],
        selectedAbnormals: findings.flatMap(f => f.abnormals.map(a => a.key)),
        findings: '',
    };
}

// ── Parse a single exam line against a PEBlock's findings ─────
function parseItemLine(
    line: string,
    label: string,
    block: PEBlock,
): ItemState | null {
    if (!line.toUpperCase().startsWith(`${label.toUpperCase()}:`)) return null;
    const rest = line.slice(label.length + 1).trim();

    const allNormalTexts: Array<{ key: string; text: string }> = block.findings
        .filter(f => f.normal)
        .map(f => ({ key: f.key, text: f.normal }));
    const allAbnormalTexts: Array<{ key: string; label: string }> = block.findings.flatMap(f =>
        f.abnormals.map(a => ({ key: a.key, label: a.label })),
    );

    if (rest === 'Normal') {
        return allNormalsSelected(block.findings);
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

    return { status, selectedNormals, selectedAbnormals, findings: freeTextParts.join('; ') };
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

function formatExamLine(label: string, state: ItemState, findings: PEFinding[]): string {
    const uLabel = label.toUpperCase();
    const normalParts: string[] = [];
    const abnormalParts: string[] = [];

    for (const finding of findings) {
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
    const parts: string[] = [...formatVitals(vitals)];
    const examLines: string[] = [];

    for (const block of blocks) {
        const state = blockStates[block.key];
        if (!state || state.status === 'not-examined') continue;

        const isExpanded = expandedKeys.has(block.key);
        const visibleFindings = getVisibleFindings(block, isExpanded);
        examLines.push(formatExamLine(block.label, state, toViewFindings(visibleFindings)));
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

function summarizeFindings(findings: PEFinding[], state: ItemState): { normals: string[]; abnormals: string[] } {
    const normals: string[] = [];
    const abnormals: string[] = [];
    for (const finding of findings) {
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

function ExamItemRow({ block, state, onTap, index, isDragging, dragOffset, onDragStart }: {
    block: PEBlock;
    state: ItemState;
    onTap: (index: number, rect: DOMRect) => void;
    index: number;
    isDragging?: boolean;
    dragOffset?: number;
    onDragStart?: (index: number, e: React.PointerEvent) => void;
}) {
    const rowRef = useRef<HTMLDivElement>(null);

    const handleTap = () => {
        if (rowRef.current) {
            onTap(index, rowRef.current.getBoundingClientRect());
        }
    };

    const { normals, abnormals } = useMemo(() => summarizeFindings(block.findings, state), [block, state]);
    const hasSummary = state.status !== 'not-examined' && (normals.length > 0 || abnormals.length > 0);

    return (
        <div
            ref={rowRef}
            data-block-row
            style={isDragging ? { transform: `translateY(${dragOffset}px)`, zIndex: 50, position: 'relative' } : undefined}
            className={isDragging ? 'opacity-80 shadow-lg rounded-lg bg-themewhite2' : ''}
        >
            <ListItemRow
                as="div"
                onClick={handleTap}
                className="py-2.5 active:scale-[0.98] transition-all cursor-pointer"
                left={
                    <div
                        className="shrink-0 text-tertiary/30 touch-none cursor-grab active:cursor-grabbing"
                        onPointerDown={onDragStart ? (e) => onDragStart(index, e) : undefined}
                    >
                        <GripVertical size={16} />
                    </div>
                }
                center={
                    <>
                        <p className="text-sm font-medium text-primary truncate">{block.label}</p>
                        {hasSummary && (
                            <p className="text-[11px] mt-0.5 truncate">
                                {normals.length > 0 && <span className="text-tertiary/70">{normals.join(', ')}</span>}
                                {normals.length > 0 && abnormals.length > 0 && <span className="text-tertiary/70"> · </span>}
                                {abnormals.length > 0 && <span className="text-primary font-medium">{abnormals.join(', ')}</span>}
                            </p>
                        )}
                    </>
                }
            />
        </div>
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
            findings: state.findings,
        };
    }
    return result;
}

// ── Inline add card ──────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────

export function PhysicalExam({
    initialText = '',
    initialState = null,
    onChange,
    onStateChange,
    colors,
    symptomCode,
    mode = 'focused',
    templateBlockKeys,
    onBlockKeysChange,
    expanders = [],
}: PhysicalExamProps) {
    const categoryLetter = (getCategoryFromSymptomCode(symptomCode) || 'A') as CategoryLetter;
    const isBack = isBackPainCode(symptomCode);

    // ── Resolve blocks and expanded keys based on mode ─────────
    const { activeBlocks, expandedKeys } = useMemo(() => {
        if (mode === 'template' && templateBlockKeys) {
            const blocks = getBlocksForTemplate(templateBlockKeys);
            // Template mode: all blocks are fully expanded
            const expanded = new Set(blocks.map(b => b.key));
            return { activeBlocks: blocks, expandedKeys: expanded };
        }
        // Focused mode: baseline wrappers bookending category-specific expanded blocks
        const { blocks, expandedKeys: expKeys } = getBlocksForFocusedExam(categoryLetter, symptomCode);
        return { activeBlocks: blocks, expandedKeys: expKeys };
    }, [mode, templateBlockKeys, categoryLetter, symptomCode]);

    // ── Build the view blocks (PEBlock shapes with tier-filtered findings) ──
    const viewBlockMap = useMemo((): Map<string, PEBlock> => {
        const map = new Map<string, PEBlock>();
        for (const block of activeBlocks) {
            const isExpanded = expandedKeys.has(block.key);
            let visible = getVisibleFindings(block, isExpanded);

            map.set(block.key, toViewBlock(block, visible));
        }
        return map;
    }, [activeBlocks, expandedKeys]);

    // ── Seed initial state — prefer structured initialState over text parsing ─
    const [parsed] = useState(() => {
        if (initialState) {
            const blockStates: Record<string, ItemState> = {};
            for (const b of activeBlocks) {
                const seeded = initialState.items[b.key];
                blockStates[b.key] = seeded
                    ? {
                        status: seeded.status,
                        selectedNormals: [...seeded.selectedNormals],
                        selectedAbnormals: [...seeded.selectedAbnormals],
                        findings: seeded.findings,
                    }
                    : defaultItemState();
            }
            const vit: Record<string, string> = {};
            VITAL_SIGNS.forEach(v => { vit[v.key] = ''; });
            return {
                blockStates,
                laterality: initialState.laterality,
                spineRegion: initialState.spineRegion,
                additional: initialState.additional,
                vitals: { ...vit, ...initialState.vitals },
            };
        }
        return parseInitialText(initialText, activeBlocks);
    });

    const [blockStates, setBlockStates] = useState<Record<string, ItemState>>(() => parsed.blockStates);

    const [laterality, setLaterality] = useState<Laterality>(() => parsed.laterality);
    const [spineRegion, setSpineRegion] = useState<SpineRegion>(() => parsed.spineRegion);
    const [additional, setAdditional] = useState(() => parsed.additional);
    const [vitals, setVitals] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        VITAL_SIGNS.forEach(v => { init[v.key] = ''; });
        return parsed.vitals ? { ...init, ...parsed.vitals } : init;
    });

    const bmiInfo = useMemo(() => {
        const htNum = parseFloat(vitals['ht'] || '');
        const wtNum = parseFloat(vitals['wt'] || '');
        if (isNaN(htNum) || htNum <= 0 || isNaN(wtNum) || wtNum <= 0) return null;
        const htM = (htNum * 2.54) / 100;
        const wtKg = wtNum * 0.453592;
        const bmi = wtKg / (htM * htM);
        return { value: bmi, display: bmi.toFixed(1) };
    }, [vitals]);

    // ── Add section / text state ────────────────────────────────
    const [showAddCard, setShowAddCard] = useState(false);
    const [addedBlocks, setAddedBlocks] = useState<PEBlock[]>([]);

    // ── Block reorder state ──────────────────────────────────
    const [blockOrder, setBlockOrder] = useState<string[] | null>(null);

    // Reset custom order when the underlying block set changes
    useEffect(() => {
        setBlockOrder(null);
    }, [activeBlocks]);

    // ── Block picker (template mode) ─────────────────────────
    const [showBlockPicker, setShowBlockPicker] = useState(false);
    const [blockPickerAnchorRect, setBlockPickerAnchorRect] = useState<DOMRect | null>(null);

    const openBlockPicker = useCallback((e: React.MouseEvent) => {
        setBlockPickerAnchorRect((e.currentTarget as HTMLElement).getBoundingClientRect());
        setShowBlockPicker(true);
    }, []);


    const vitalsSummary = useMemo(() => {
        const parts: string[] = [];
        const sys = vitals['bpSys']?.trim();
        const dia = vitals['bpDia']?.trim();
        if (sys || dia) parts.push(`BP ${sys || '—'}/${dia || '—'}`);
        for (const v of VITAL_SIGNS) {
            if (v.key === 'bpSys' || v.key === 'bpDia') continue;
            const val = vitals[v.key]?.trim();
            if (val) parts.push(`${v.shortLabel} ${val}`);
        }
        return parts.join(' · ');
    }, [vitals]);

    const hasAnyVitals = useMemo(() => Object.values(vitals).some(v => v?.trim()), [vitals]);

    const toggleBlockKey = useCallback((key: string) => {
        if (!onBlockKeysChange) return;
        const current = templateBlockKeys ?? [];
        const next = current.includes(key)
            ? current.filter(k => k !== key)
            : [...current, key];
        onBlockKeysChange(next);
    }, [onBlockKeysChange, templateBlockKeys]);

    // ── Emit change ────────────────────────────────────────────
    const emitChange = useCallback((
        bStates: Record<string, ItemState>,
        lat: Laterality,
        spine: SpineRegion,
        add: string,
        vit: Record<string, string>,
    ) => {
        onChange(generateText(
            activeBlocks,
            bStates,
            expandedKeys,
            lat,
            spine,
            add,
            vit,
            categoryLetter,
        ));
        if (onStateChange) {
            onStateChange({
                categoryLetter,
                laterality: lat,
                spineRegion: spine,
                items: toEncodableState(bStates),
                vitals: vit,
                additional: add,
                mode,
                blockKeys: mode === 'template' ? templateBlockKeys : undefined,
                blockOrder: blockOrder ?? undefined,
            });
        }
    }, [onChange, onStateChange, activeBlocks, expandedKeys, categoryLetter, mode, templateBlockKeys, blockOrder]);

    useEffect(() => {
        emitChange(blockStates, laterality, spineRegion, additional, vitals);
    }, [blockStates, laterality, spineRegion, additional, vitals, emitChange]);

    const setVitalValue = (key: string, value: string) => {
        setVitals(prev => ({ ...prev, [key]: value }));
    };

    const cycleStatus = (key: string, viewBlock: PEBlock) => {
        setBlockStates(prev => {
            const cur = prev[key] ?? defaultItemState();
            if (cur.status === 'not-examined') {
                return { ...prev, [key]: allNormalsSelected(viewBlock.findings) };
            }
            if (cur.status === 'normal') {
                const autoAbnormals = viewBlock.findings
                    .filter(f => f.abnormals.length > 0)
                    .map(f => f.abnormals[0].key);
                return {
                    ...prev,
                    [key]: { status: 'abnormal', selectedNormals: [], selectedAbnormals: autoAbnormals, findings: cur.findings },
                };
            }
            return { ...prev, [key]: defaultItemState() };
        });
    };

    const toggleNormal = (blockKey: string, findingKey: string, viewBlock: PEBlock) => {
        setBlockStates(prev => {
            const cur = prev[blockKey] ?? defaultItemState();
            const wasSelected = cur.selectedNormals.includes(findingKey);
            const normals = wasSelected
                ? cur.selectedNormals.filter(k => k !== findingKey)
                : [...cur.selectedNormals, findingKey];

            let abnormals = cur.selectedAbnormals;
            if (!wasSelected) {
                const finding = viewBlock.findings.find(f => f.key === findingKey);
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

    const toggleAbnormal = (blockKey: string, abnormalKey: string, viewBlock: PEBlock) => {
        setBlockStates(prev => {
            const cur = prev[blockKey] ?? defaultItemState();
            const wasSelected = cur.selectedAbnormals.includes(abnormalKey);
            const abnormals = wasSelected
                ? cur.selectedAbnormals.filter(k => k !== abnormalKey)
                : [...cur.selectedAbnormals, abnormalKey];

            let normals = cur.selectedNormals;
            if (!wasSelected) {
                const finding = viewBlock.findings.find(f => f.abnormals.some(a => a.key === abnormalKey));
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

    const setFindingsText = (key: string, findings: string) => {
        setBlockStates(prev => ({
            ...prev,
            [key]: { ...(prev[key] ?? defaultItemState()), findings },
        }));
    };

    // ── Bulk actions ──────────────────────────────────────────
    const markAllNormal = () => {
        setBlockStates(prev => {
            const next = { ...prev };
            for (const [key, vb] of viewBlockMap) {
                next[key] = allNormalsSelected(vb.findings);
            }
            return next;
        });
    };

    const markAllAbnormal = () => {
        setBlockStates(prev => {
            const next = { ...prev };
            for (const [key, vb] of viewBlockMap) {
                next[key] = allAbnormalsSelected(vb.findings);
            }
            return next;
        });
    };

    const resetAllBlocks = () => {
        setBlockStates(prev => {
            const next: Record<string, ItemState> = {};
            for (const key of Object.keys(prev)) next[key] = defaultItemState();
            return next;
        });
    };

    const examStatus = useMemo((): 'not-examined' | 'all-normal' | 'all-abnormal' | 'has-abnormal' => {
        const allStates = Object.values(blockStates);
        const examined = allStates.filter(s => s.status !== 'not-examined');
        if (examined.length === 0) return 'not-examined';
        if (examined.every(s => s.status === 'abnormal') && examined.length === allStates.length) return 'all-abnormal';
        if (examined.some(s => s.status === 'abnormal')) return 'has-abnormal';
        return 'all-normal';
    }, [blockStates]);

    const cycleExamStatus = () => {
        if (examStatus === 'not-examined') {
            markAllNormal();
        } else if (examStatus === 'all-normal') {
            markAllAbnormal();
        } else {
            resetAllBlocks();
        }
    };

    // ── Flat block list for popover navigation ────────────────
    type FlatEntry = { viewBlock: PEBlock; key: string; isAdded?: boolean };

    const flatBlockList = useMemo((): FlatEntry[] => {
        const list: FlatEntry[] = [];

        // If user has set a custom order, use it (filtering to only active keys)
        const activeKeys = new Set(activeBlocks.map(b => b.key));
        const orderedKeys = blockOrder
            ? [...blockOrder.filter(k => activeKeys.has(k)), ...activeBlocks.filter(b => !blockOrder.includes(b.key)).map(b => b.key)]
            : activeBlocks.map(b => b.key);

        for (const key of orderedKeys) {
            const vb = viewBlockMap.get(key);
            if (vb) list.push({ viewBlock: vb, key });
        }
        // Added blocks from inline add card
        for (const b of addedBlocks) {
            if (!list.some(e => e.key === b.key)) {
                list.push({ viewBlock: b, key: b.key, isAdded: true });
            }
        }
        return list;
    }, [activeBlocks, viewBlockMap, addedBlocks, blockOrder]);

    // ── Custom findings added inline via popover ──────────────
    const [customFindings, setCustomFindings] = useState<Record<string, { key: string; label: string }[]>>({});

    const augmentBlock = useCallback((viewBlock: PEBlock, blockKey: string): PEBlock => {
        const extras = customFindings[blockKey];
        if (!extras || extras.length === 0) return viewBlock;
        return {
            ...viewBlock,
            findings: [
                ...viewBlock.findings,
                ...extras.map(cf => ({
                    key: cf.key,
                    normal: '',
                    abnormals: [{ key: cf.key, label: cf.label }],
                })),
            ],
        };
    }, [customFindings]);

    const addCustomFinding = useCallback((blockKey: string, value: string) => {
        const cfKey = `custom_${blockKey}_${Date.now()}`;
        setCustomFindings(prev => ({
            ...prev,
            [blockKey]: [...(prev[blockKey] ?? []), { key: cfKey, label: value }],
        }));
        // Auto-select as abnormal
        setBlockStates(prev => {
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
    const editingState = editingEntry ? (blockStates[editingEntry.key] ?? defaultItemState()) : null;

    const deleteBlock = useCallback((entry: FlatEntry) => {
        setAddedBlocks(prev => prev.filter(b => b.key !== entry.key));
        setBlockStates(prev => ({ ...prev, [entry.key]: defaultItemState() }));
        setEditingIndex(null);
    }, []);

    const popoverActions = useMemo((): ContextMenuAction[] => {
        if (editingIndex === null) return [];
        const len = flatBlockList.length;
        const isFirst = editingIndex === 0;
        const isLast = editingIndex === len - 1;
        const entry = flatBlockList[editingIndex];
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
            onAction: () => setBlockStates(prev => ({ ...prev, [entry.key]: allNormalsSelected(entry.viewBlock.findings) })),
            closesOnAction: false,
        });
        actions.push({
            key: 'reset',
            label: '',
            icon: RotateCcw,
            onAction: () => setBlockStates(prev => ({ ...prev, [entry.key]: defaultItemState() })),
            closesOnAction: false,
        });
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
        } else if (mode === 'template' && onBlockKeysChange && templateBlockKeys) {
            actions.push({
                key: 'remove',
                label: '',
                icon: X,
                onAction: () => {
                    onBlockKeysChange(templateBlockKeys.filter(k => k !== entry.key));
                    setBlockStates(prev => ({ ...prev, [entry.key]: defaultItemState() }));
                    setEditingIndex(null);
                },
                variant: 'danger',
            });
        }
        return actions;
    }, [editingIndex, flatBlockList, blockStates, deleteBlock]);

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
            setBlockStates(prev => ({ ...prev, [entry.key]: allNormalsSelected(entry.viewBlock.findings) }));
        };
        const onToggleAbnormal = (e: Event) => {
            if (editingIndex === null) return;
            const abnormalKey = (e as CustomEvent<string>).detail;
            const entry = flatBlockList[editingIndex];
            const augmented = augmentBlock(entry.viewBlock, entry.key);
            toggleAbnormal(entry.key, abnormalKey, augmented);
        };
        const onReset = () => {
            if (editingIndex === null) return;
            const entry = flatBlockList[editingIndex];
            setBlockStates(prev => ({ ...prev, [entry.key]: defaultItemState() }));
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

    // ── Drag reorder ─────────────────────────────────────────────
    const dragStateRef = useRef<{
        dragIndex: number;
        currentIndex: number;
        startY: number;
        itemHeight: number;
    } | null>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    const handleDragStart = useCallback((index: number, e: React.PointerEvent) => {
        const target = (e.currentTarget as HTMLElement).closest('[data-block-row]') as HTMLElement | null;
        if (!target) return;
        const rect = target.getBoundingClientRect();
        dragStateRef.current = {
            dragIndex: index,
            currentIndex: index,
            startY: e.clientY,
            itemHeight: rect.height,
        };
        setDragIndex(index);
        setDragOffset(0);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, []);

    const handleDragMove = useCallback((e: React.PointerEvent) => {
        const ds = dragStateRef.current;
        if (!ds) return;
        const dy = e.clientY - ds.startY;
        setDragOffset(dy);

        const indexShift = Math.round(dy / ds.itemHeight);
        const newIndex = Math.max(0, Math.min(flatBlockList.length - 1, ds.dragIndex + indexShift));
        ds.currentIndex = newIndex;
    }, [flatBlockList.length]);

    const handleDragEnd = useCallback(() => {
        const ds = dragStateRef.current;
        if (!ds) {
            setDragIndex(null);
            setDragOffset(0);
            return;
        }

        if (ds.dragIndex !== ds.currentIndex) {
            const keys = flatBlockList.map(e => e.key);
            const [moved] = keys.splice(ds.dragIndex, 1);
            keys.splice(ds.currentIndex, 0, moved);
            setBlockOrder(keys);
        }

        dragStateRef.current = null;
        setDragIndex(null);
        setDragOffset(0);
    }, [flatBlockList]);

    return (
        <div className="space-y-4">
            {/* ── Exam Blocks ──────────────────────────────────────── */}
            {mode === 'template' && flatBlockList.length === 0 ? (
                /* Empty state — provider hasn't selected any blocks yet */
                <div className="flex flex-col items-center gap-2 py-6">
                    <button
                        type="button"
                        onClick={openBlockPicker}
                        className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40"
                    >
                        <Plus size={14} />
                    </button>
                    <p className="text-[10px] text-tertiary/40">Add exam systems</p>
                </div>
            ) : (
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
                            {/* MSK laterality / spine region selector (focused mode, category B) */}
                            {mode === 'focused' && categoryLetter === 'B' && (
                                <div className="flex items-center gap-2 flex-wrap pr-14">
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

                        <div
                            ref={listRef}
                            onPointerMove={handleDragMove}
                            onPointerUp={handleDragEnd}
                            onPointerCancel={handleDragEnd}
                        >
                            {flatBlockList.map((entry, i) => (
                                <ExamItemRow
                                    key={entry.key}
                                    block={entry.viewBlock}
                                    state={blockStates[entry.key] ?? defaultItemState()}
                                    onTap={handleRowTap}
                                    index={i}
                                    isDragging={dragIndex === i}
                                    dragOffset={dragIndex === i ? dragOffset : 0}
                                    onDragStart={handleDragStart}
                                />
                            ))}
                        </div>

                    </div>
                </div>
            )}

            {/* ── Lifted single popover ── */}
            {editingEntry && editingState && (
                <ContextMenuPreview
                    isVisible={editingIndex !== null}
                    onClose={() => setEditingIndex(null)}
                    anchorRect={popoverAnchorRect}
                    maxWidth="max-w-[340px] md:max-w-[520px]"
                    searchPlaceholder="Filter findings..."
                    preview={(filter, clearFilter) => {
                        const augmented = augmentBlock(editingEntry.viewBlock, editingEntry.key);
                        return (
                            <ExamBlockPreview
                                block={augmented}
                                state={editingState}
                                filter={filter}
                                onToggleNormal={(fk) => { toggleNormal(editingEntry.key, fk, augmented); clearFilter(); }}
                                onToggleAbnormal={(ak) => { toggleAbnormal(editingEntry.key, ak, augmented); clearFilter(); }}
                            />
                        );
                    }}
                    actions={popoverActions}
                    onAdd={(value) => addCustomFinding(editingEntry.key, value)}
                    addPlaceholder="Add custom finding..."
                />
            )}

            {/* ── Block picker popover (template mode) ── */}
            {mode === 'template' && onBlockKeysChange && (
                <ContextMenuPreview
                    isVisible={showBlockPicker}
                    onClose={() => setShowBlockPicker(false)}
                    anchorRect={blockPickerAnchorRect}
                    maxWidth="max-w-[340px]"
                    searchPlaceholder="Search systems..."
                    preview={(filter) => {
                        const lc = filter.toLowerCase();
                        const tl = lc ? MASTER_BLOCKS_TOP_LEVEL.filter(b => b.label.toLowerCase().includes(lc)) : MASTER_BLOCKS_TOP_LEVEL;
                        const childMatch = lc ? MSK_CHILD_KEYS.filter(k => MASTER_BLOCK_LIBRARY[k]?.label.toLowerCase().includes(lc)) : [];
                        const showMsk = tl.some(b => b.key === 'msk') || childMatch.length > 0;
                        return (
                            <div className="py-1">
                                {(!lc || 'vitals'.includes(lc) || 'vital signs'.includes(lc)) && (
                                    <div className="px-3 py-2 border-b border-tertiary/10">
                                        <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Vital Signs</p>
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
                                )}
                                {(showMsk && !tl.some(b => b.key === 'msk') ? [...tl, MASTER_BLOCK_LIBRARY['msk']!] : tl).map(block => {
                                    if (!block) return null;
                                    const selected = (templateBlockKeys ?? []).includes(block.key);
                                    return (
                                        <React.Fragment key={block.key}>
                                            <button
                                                type="button"
                                                onClick={() => toggleBlockKey(block.key)}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all active:scale-[0.98] ${
                                                    selected ? 'bg-themegreen/8' : 'hover:bg-tertiary/5'
                                                }`}
                                            >
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                                    selected ? 'bg-themegreen text-white' : 'bg-tertiary/10'
                                                }`}>
                                                    {selected && <Check size={12} strokeWidth={2.5} />}
                                                </span>
                                                <span className="text-xs font-medium text-primary">{block.label}</span>
                                            </button>
                                            {block.key === 'msk' && selected && MSK_CHILD_KEYS
                                                .filter(k => !lc || MASTER_BLOCK_LIBRARY[k]?.label.toLowerCase().includes(lc))
                                                .map(childKey => {
                                                    const child = MASTER_BLOCK_LIBRARY[childKey];
                                                    if (!child) return null;
                                                    const childSel = (templateBlockKeys ?? []).includes(childKey);
                                                    return (
                                                        <button
                                                            key={childKey}
                                                            type="button"
                                                            onClick={() => toggleBlockKey(childKey)}
                                                            className={`w-full flex items-center gap-2.5 pl-8 pr-3 py-2 text-left transition-all active:scale-[0.98] ${
                                                                childSel ? 'bg-themeblue3/8' : 'hover:bg-tertiary/5'
                                                            }`}
                                                        >
                                                            <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                                                childSel ? 'bg-themeblue3 text-white' : 'bg-tertiary/8'
                                                            }`}>
                                                                {childSel && <Check size={10} strokeWidth={2.5} />}
                                                            </span>
                                                            <span className="text-[11px] font-medium text-secondary">{child.label}</span>
                                                        </button>
                                                    );
                                                })}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        );
                    }}
                    actions={[{
                        key: 'reset',
                        label: 'Reset',
                        icon: RotateCcw,
                        onAction: () => {
                            setVitals(() => {
                                const init: Record<string, string> = {};
                                VITAL_SIGNS.forEach(v => { init[v.key] = ''; });
                                return init;
                            });
                            if (onBlockKeysChange) onBlockKeysChange([]);
                            setBlockStates({});
                        },
                        closesOnAction: false,
                        variant: 'danger',
                    }, {
                        key: 'done',
                        label: 'Done',
                        icon: Check,
                        onAction: () => setShowBlockPicker(false),
                    }]}
                />
            )}


            {/* ── Inline add card (focused mode only) ── */}
            {mode === 'focused' && (
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
            )}

            {/* ── Add button ── */}
            {mode === 'template' && flatBlockList.length > 0 ? (
                <div className="flex justify-center pt-1">
                    <button
                        type="button"
                        onClick={openBlockPicker}
                        className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            ) : mode === 'focused' && !showAddCard ? (
                <div className="flex justify-center pt-1">
                    <button
                        type="button"
                        onClick={() => setShowAddCard(true)}
                        className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            ) : null}
        </div>
    );
}
