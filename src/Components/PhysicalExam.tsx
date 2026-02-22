import { useState, useEffect, useCallback, useMemo } from 'react';
import type { getColorClasses } from '../Utilities/ColorUtilities';
import { PIIWarningBanner } from './PIIWarningBanner';
import { detectPII } from '../lib/piiDetector';
import {
    getCategoryFromSymptomCode,
    getMSKBodyPart,
    getPECategory,
    getGeneralFindings,
    isBackPainCode,
    VITAL_SIGNS,
    WRAPPER_BEFORE_COUNT,
} from '../Data/PhysicalExamData';
import type { CategoryLetter, Laterality, SpineRegion, PECategoryDef, PEItem, AbnormalOption, GeneralFinding } from '../Data/PhysicalExamData';
import type { CustomPEBlock } from '../Data/User';

type SystemStatus = 'not-examined' | 'normal' | 'abnormal';

interface ItemState {
    status: SystemStatus;
    findings: string;
    selectedAbnormals: string[];
}

type PEDepth = 'minimal' | 'expanded' | 'custom';

interface PhysicalExamProps {
    initialText?: string;
    onChange: (text: string) => void;
    colors: ReturnType<typeof getColorClasses>;
    symptomCode: string;
    depth?: PEDepth;
    customBlocks?: CustomPEBlock[];
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


// ── Parse initial text ────────────────────────────────────────

// Mapping from old general finding labels to new wrapper keys (for backward compat)
const OLD_GENERAL_TO_WRAPPER: Record<string, string> = {
    'General Appearance': 'sw_gen',
    'Skin': 'sw_derm',
    'Neuro': 'sw_neuro',
    'Psych': 'sw_psych',
};

function parseItemLine(
    line: string,
    label: string,
    abnormalOptions?: AbnormalOption[],
    normalText?: string,
): ItemState | null {
    // Case-insensitive match (handles both old mixed-case and new uppercase labels)
    if (!line.toUpperCase().startsWith(`${label.toUpperCase()}:`)) return null;
    const rest = line.slice(label.length + 1).trim();
    // Legacy format: "Abnormal - ..." / "Normal - ..."
    if (rest.startsWith('Abnormal')) {
        const abnormalText = rest.replace(/^Abnormal\s*-?\s*/, '').trim();
        const parsed = parseAbnormalText(abnormalText, abnormalOptions);
        return { status: 'abnormal', findings: parsed.freeText, selectedAbnormals: parsed.selectedKeys };
    }
    if (rest.startsWith('Normal')) {
        return normalItemState();
    }
    // New format: normalText directly means normal
    if (normalText && rest === normalText) {
        return normalItemState();
    }
    // Otherwise treat as abnormal findings
    if (rest) {
        const parsed = parseAbnormalText(rest, abnormalOptions);
        return { status: 'abnormal', findings: parsed.freeText, selectedAbnormals: parsed.selectedKeys };
    }
    return null;
}

function parseInitialText(
    text: string,
    categoryDef: PECategoryDef,
    bodyPart: { code: string; label: string } | null,
    generalDefs: GeneralFinding[],
): {
    items: Record<string, ItemState>;
    generals: Record<string, ItemState>;
    laterality: Laterality;
    spineRegion: SpineRegion;
    additional: string;
    vitals: Record<string, string>;
} {
    const items: Record<string, ItemState> = {};
    categoryDef.items.forEach(i => { items[i.key] = defaultItemState(); });
    const generals: Record<string, ItemState> = {};
    generalDefs.forEach(g => { generals[g.key] = defaultItemState(); });
    let laterality: Laterality = 'right';
    let spineRegion: SpineRegion = 'lumbar';
    let additional = '';
    const vitals: Record<string, string> = {};
    VITAL_SIGNS.forEach(v => { vitals[v.key] = ''; });

    if (!text) return { items, generals, laterality, spineRegion, additional, vitals };

    const lines = text.split('\n');
    let inAdditional = false;
    let inVitals = false;
    const unmatchedLines: string[] = [];

    const vitalLabelToKey: Record<string, string> = {};
    VITAL_SIGNS.forEach(v => { vitalLabelToKey[v.shortLabel] = v.key; });

    for (const line of lines) {
        // Additional Findings section
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

        // Vital Signs section header
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
            const vitalMatch = line.match(/^\s*(\w+):\s*(.+)/);
            if (vitalMatch) {
                const key = vitalLabelToKey[vitalMatch[1]];
                if (key) {
                    let val = vitalMatch[2].trim();
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

        // Skip blank lines
        if (!line.trim()) continue;

        // Skip old section headers (backward compat)
        if (line.trim() === 'General:') continue;
        if (line.startsWith('Vitals:')) continue;
        if (line.match(/^(HEENT|Gastrointestinal|Cardiorespiratory|Genitourinary|Neuropsychiatric|Constitutional|Eye|Gynecological|Dermatological|Environmental|Miscellaneous|Misc Return|Musculoskeletal)(\s*[-:]|$)/)) {
            continue;
        }
        // MSK body part line (extract laterality or spine region)
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

        // Try matching against wrapper (general) items by label
        let matched = false;
        for (const g of generalDefs) {
            const state = parseItemLine(line, g.label, g.abnormalOptions, g.normalText);
            if (state) {
                generals[g.key] = state;
                matched = true;
                break;
            }
        }
        if (matched) continue;

        // Try matching against category items
        for (const item of categoryDef.items) {
            const state = parseItemLine(line, item.label, item.abnormalOptions, item.normalText);
            if (state) {
                items[item.key] = state;
                matched = true;
                break;
            }
        }
        if (matched) continue;

        // Backward compat: old general finding labels → new wrapper keys
        for (const [oldLabel, newKey] of Object.entries(OLD_GENERAL_TO_WRAPPER)) {
            if (line.toUpperCase().startsWith(`${oldLabel.toUpperCase()}:`)) {
                const rest = line.slice(oldLabel.length + 1).trim();
                if (rest.startsWith('Abnormal')) {
                    const abnText = rest.replace(/^Abnormal\s*-?\s*/, '').trim();
                    generals[newKey] = { status: 'abnormal', findings: abnText, selectedAbnormals: [] };
                } else if (rest.startsWith('Normal')) {
                    generals[newKey] = normalItemState();
                }
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

    return { items, generals, laterality, spineRegion, additional, vitals };
}

// Parse abnormal text back into selected chip keys + free text remainder
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
            lines.push(`  ${v.shortLabel}: ${val} ${v.unit}`);
        }
    }
    return lines;
}

function generateText(
    categoryDef: PECategoryDef,
    itemStates: Record<string, ItemState>,
    generalDefs: GeneralFinding[],
    generalStates: Record<string, ItemState>,
    bodyPart: { code: string; label: string } | null,
    laterality: Laterality,
    additional: string,
    vitals: Record<string, string>,
    spineRegion?: SpineRegion,
): string {
    const parts: string[] = [...formatVitals(vitals)];

    // Flat exam items: before wrappers → category items → after wrappers
    const beforeWrappers = generalDefs.slice(0, WRAPPER_BEFORE_COUNT);
    const afterWrappers = generalDefs.slice(WRAPPER_BEFORE_COUNT);
    const examLines: string[] = [];

    // Before wrappers (GEN, HEAD)
    for (const g of beforeWrappers) {
        const state = generalStates[g.key];
        if (!state || state.status === 'not-examined') continue;
        examLines.push(formatExamLine(g.label, state, g.normalText, g.abnormalOptions));
    }

    // MSK body part context
    if (categoryDef.category === 'B' && bodyPart) {
        const hasExamined = categoryDef.items.some(i => itemStates[i.key]?.status !== 'not-examined');
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

    // Category-specific items
    for (const item of categoryDef.items) {
        const state = itemStates[item.key];
        if (!state || state.status === 'not-examined') continue;
        examLines.push(formatExamLine(item.label, state, item.normalText, item.abnormalOptions));
    }

    // After wrappers (DERM, NEURO, PSYCH)
    for (const g of afterWrappers) {
        const state = generalStates[g.key];
        if (!state || state.status === 'not-examined') continue;
        examLines.push(formatExamLine(g.label, state, g.normalText, g.abnormalOptions));
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

// ── Generate text for custom blocks mode ─────────────────────

function generateCustomText(
    customBlocks: CustomPEBlock[],
    customStates: Record<string, ItemState>,
    generalDefs: GeneralFinding[],
    generalStates: Record<string, ItemState>,
    additional: string,
    vitals: Record<string, string>,
): string {
    const parts: string[] = [...formatVitals(vitals)];

    const examLines: string[] = [];
    const beforeWrappers = generalDefs.slice(0, WRAPPER_BEFORE_COUNT);
    const afterWrappers = generalDefs.slice(WRAPPER_BEFORE_COUNT);

    for (const g of beforeWrappers) {
        const state = generalStates[g.key];
        if (!state || state.status === 'not-examined') continue;
        examLines.push(formatExamLine(g.label, state, g.normalText, g.abnormalOptions));
    }

    for (const block of customBlocks) {
        const state = customStates[block.id];
        if (!state || state.status === 'not-examined') continue;
        const tagOptions: AbnormalOption[] = block.abnormalTags.map(t => ({ key: t, label: t }));
        examLines.push(formatExamLine(block.name, state, block.normalText, tagOptions));
    }

    for (const g of afterWrappers) {
        const state = generalStates[g.key];
        if (!state || state.status === 'not-examined') continue;
        examLines.push(formatExamLine(g.label, state, g.normalText, g.abnormalOptions));
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

function ExamItemRow({ label, normalText, abnormalOptions, state, onCycleStatus, onToggleAbnormal, onSetFindings }: {
    label: string;
    normalText?: string;
    abnormalOptions?: AbnormalOption[];
    state: ItemState;
    onCycleStatus: () => void;
    onToggleAbnormal: (optKey: string) => void;
    onSetFindings: (findings: string) => void;
}) {
    const findingsWarnings = useMemo(() => detectPII(state.findings), [state.findings]);

    return (
        <div>
            <button
                type="button"
                className="flex items-center justify-between w-full text-left p-2.5 rounded-md transition-colors text-xs border border-themegray1/20 bg-themewhite text-secondary hover:bg-themewhite3"
                onClick={onCycleStatus}
            >
                <span className="font-medium">{label.toUpperCase()}</span>
                <span className={`text-[10px] uppercase tracking-wide font-semibold ${
                    state.status === 'normal'
                        ? 'text-emerald-600'
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
                <div className="text-[10px] text-secondary/60 mt-0.5 ml-2 italic">
                    {normalText}
                </div>
            )}
            {state.status === 'abnormal' && (
                <div className="mt-1 ml-2">
                    {abnormalOptions && abnormalOptions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                            {abnormalOptions.map(opt => (
                                <button
                                    key={opt.key}
                                    onClick={(e) => { e.stopPropagation(); onToggleAbnormal(opt.key); }}
                                    className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                                        state.selectedAbnormals.includes(opt.key)
                                            ? 'bg-themeredred/20 border-themeredred/40 text-primary'
                                            : 'border-themegray1/20 bg-themewhite text-secondary hover:bg-themewhite3'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                    <input
                        type="text"
                        value={state.findings}
                        onChange={(e) => onSetFindings(e.target.value)}
                        placeholder="Describe findings..."
                        className="w-full text-xs px-3 py-1.5 rounded border border-themeredred/20 bg-themewhite text-tertiary outline-none focus:border-themeredred/40"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <PIIWarningBanner warnings={findingsWarnings} />
                </div>
            )}
        </div>
    );
}

// ── Component ─────────────────────────────────────────────────

export function PhysicalExam({ initialText = '', onChange, colors, symptomCode, depth = 'minimal', customBlocks = [] }: PhysicalExamProps) {
    const categoryLetter = getCategoryFromSymptomCode(symptomCode) || 'A';
    const categoryDef = getPECategory(categoryLetter);
    const bodyPart = categoryLetter === 'B' ? getMSKBodyPart(symptomCode) : null;
    const generalDefs = getGeneralFindings(categoryLetter);

    const [parsed] = useState(() => parseInitialText(initialText, categoryDef, bodyPart, generalDefs));

    const [itemStates, setItemStates] = useState<Record<string, ItemState>>(() => parsed.items);

    const [generalStates, setGeneralStates] = useState<Record<string, ItemState>>(() => parsed.generals);

    // Custom block states (keyed by block id)
    const [customStates, setCustomStates] = useState<Record<string, ItemState>>(() => {
        const states: Record<string, ItemState> = {};
        for (const block of customBlocks) {
            states[block.id] = defaultItemState();
        }
        return states;
    });

    const [laterality, setLaterality] = useState<Laterality>(() => parsed.laterality);
    const [spineRegion, setSpineRegion] = useState<SpineRegion>(() => parsed.spineRegion);
    const [additional, setAdditional] = useState(() => parsed.additional);
    const [vitals, setVitals] = useState<Record<string, string>>(() => parsed.vitals);

    const isBack = isBackPainCode(symptomCode);
    const isCustom = depth === 'custom' && customBlocks.length > 0;

    // PII detection on additional findings (debounced)
    const [additionalPiiWarnings, setAdditionalPiiWarnings] = useState<string[]>([]);
    useEffect(() => {
        const id = window.setTimeout(() => setAdditionalPiiWarnings(detectPII(additional)), 400);
        return () => clearTimeout(id);
    }, [additional]);

    // Ensure custom states are in sync when blocks change
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

    const emitChange = useCallback((
        states: Record<string, ItemState>,
        genStates: Record<string, ItemState>,
        lat: Laterality,
        add: string,
        vit: Record<string, string>,
        spine?: SpineRegion,
    ) => {
        onChange(generateText(categoryDef, states, generalDefs, genStates, bodyPart, lat, add, vit, spine));
    }, [onChange, categoryDef, generalDefs, bodyPart]);

    const emitCustomChange = useCallback((
        custStates: Record<string, ItemState>,
        genStates: Record<string, ItemState>,
        add: string,
        vit: Record<string, string>,
    ) => {
        onChange(generateCustomText(customBlocks, custStates, generalDefs, genStates, add, vit));
    }, [onChange, customBlocks, generalDefs]);

    useEffect(() => {
        if (isCustom) {
            emitCustomChange(customStates, generalStates, additional, vitals);
        } else {
            emitChange(itemStates, generalStates, laterality, additional, vitals, spineRegion);
        }
    }, [isCustom, itemStates, customStates, generalStates, laterality, spineRegion, additional, vitals, emitChange, emitCustomChange]);

    const setVitalValue = (key: string, value: string) => {
        setVitals(prev => ({ ...prev, [key]: value }));
    };

    const cycleStatus = (key: string, setter: React.Dispatch<React.SetStateAction<Record<string, ItemState>>>) => {
        setter(prev => {
            const current = prev[key].status;
            let next: SystemStatus;
            if (current === 'not-examined') next = 'normal';
            else if (current === 'normal') next = 'abnormal';
            else next = 'not-examined';
            return {
                ...prev,
                [key]: { ...prev[key], status: next, findings: next === 'not-examined' ? '' : prev[key].findings, selectedAbnormals: next === 'not-examined' ? [] : prev[key].selectedAbnormals },
            };
        });
    };

    const toggleAbnormal = (itemKey: string, optKey: string, setter: React.Dispatch<React.SetStateAction<Record<string, ItemState>>>) => {
        setter(prev => {
            const state = prev[itemKey];
            const selected = state.selectedAbnormals.includes(optKey)
                ? state.selectedAbnormals.filter(k => k !== optKey)
                : [...state.selectedAbnormals, optKey];
            return { ...prev, [itemKey]: { ...state, selectedAbnormals: selected } };
        });
    };

    const setFindings = (key: string, findings: string, setter: React.Dispatch<React.SetStateAction<Record<string, ItemState>>>) => {
        setter(prev => ({
            ...prev,
            [key]: { ...prev[key], findings },
        }));
    };

    const markAllNormal = () => {
        if (isCustom) {
            setCustomStates(prev => {
                const next = { ...prev };
                for (const key of Object.keys(next)) {
                    next[key] = normalItemState();
                }
                return next;
            });
        } else {
            setItemStates(prev => {
                const next = { ...prev };
                for (const key of Object.keys(next)) {
                    next[key] = normalItemState();
                }
                return next;
            });
        }
        setGeneralStates(prev => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
                next[key] = normalItemState();
            }
            return next;
        });
    };

    return (
        <div className="p-3 space-y-4">
            {/* Vital Signs */}
            <div>
                <span className="text-xs text-secondary font-medium block mb-2">Vital Signs</span>
                <div className="grid grid-cols-3 gap-2">
                    {VITAL_SIGNS.map(v => {
                        if (v.key === 'bpDia') return null;
                        if (v.key === 'bpSys') return (
                            <div key="bp" className="flex flex-col">
                                <label className="text-xs text-secondary mb-0.5">BP (mmHg)</label>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="text"
                                        value={vitals['bpSys'] || ''}
                                        onChange={(e) => setVitalValue('bpSys', e.target.value)}
                                        placeholder="120"
                                        className="w-1/2 text-xs px-2 py-1.5 rounded border border-themegray1/20 bg-themewhite text-tertiary outline-none focus:border-themeblue1/30"
                                    />
                                    <span className="text-xs text-secondary">/</span>
                                    <input
                                        type="text"
                                        value={vitals['bpDia'] || ''}
                                        onChange={(e) => setVitalValue('bpDia', e.target.value)}
                                        placeholder="80"
                                        className="w-1/2 text-xs px-2 py-1.5 rounded border border-themegray1/20 bg-themewhite text-tertiary outline-none focus:border-themeblue1/30"
                                    />
                                </div>
                            </div>
                        );
                        return (
                            <div key={v.key} className="flex flex-col">
                                <label className="text-xs text-secondary mb-0.5">{v.shortLabel} ({v.unit})</label>
                                <input
                                    type="text"
                                    value={vitals[v.key] || ''}
                                    onChange={(e) => setVitalValue(v.key, e.target.value)}
                                    placeholder={v.placeholder}
                                    className="text-xs px-2 py-1.5 rounded border border-themegray1/20 bg-themewhite text-tertiary outline-none focus:border-themeblue1/30"
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Minimal mode: skip exam items, show only vitals + additional findings */}
            {depth === 'minimal' && !isCustom ? (
                <div>
                    <label className="text-xs text-secondary font-medium block mb-1">Additional Findings</label>
                    <textarea
                        value={additional}
                        onChange={(e) => setAdditional(e.target.value)}
                        placeholder="Enter additional findings..."
                        className="w-full text-xs px-3 py-2 rounded border border-themegray1/20 bg-themewhite text-tertiary outline-none focus:border-themeblue1/30 resize-none min-h-[3rem]"
                    />
                    <PIIWarningBanner warnings={additionalPiiWarnings} />
                </div>
            ) : (
            <>

            {/* All Normal button */}
            <button
                onClick={markAllNormal}
                className="w-full py-2 text-xs font-medium rounded-md border border-themeblue1/30 text-themeblue1 bg-themeblue1/5 hover:bg-themeblue1/10 transition-colors"
            >
                All Normal
            </button>

            {/* MSK laterality / spine region selector */}
            {!isCustom && categoryLetter === 'B' && bodyPart && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-secondary font-medium">{bodyPart.label}</span>
                    <div className="flex gap-1 ml-auto">
                        {isBack ? (
                            (['cervical', 'thoracic', 'lumbar', 'sacral'] as SpineRegion[]).map(region => (
                                <button
                                    key={region}
                                    onClick={() => setSpineRegion(region)}
                                    className={`px-2.5 py-1 text-[10px] rounded-full transition-colors ${
                                        spineRegion === region
                                            ? colors.symptomClass
                                            : 'bg-themewhite3 text-secondary hover:bg-themewhite'
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
                                    className={`px-2.5 py-1 text-[10px] rounded-full transition-colors ${
                                        laterality === lat
                                            ? colors.symptomClass
                                            : 'bg-themewhite3 text-secondary hover:bg-themewhite'
                                    }`}
                                >
                                    {lat === 'bilateral' ? 'BL' : lat === 'left' ? 'L' : 'R'}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* All exam items: GEN, HEAD, [category or custom blocks], DERM, NEURO, PSYCH */}
            <div className="space-y-2">
                {generalDefs.slice(0, WRAPPER_BEFORE_COUNT).map(g => {
                    const state = generalStates[g.key] || defaultItemState();
                    return (
                        <ExamItemRow
                            key={g.key}
                            label={g.label}
                            normalText={g.normalText}
                            abnormalOptions={g.abnormalOptions}
                            state={state}
                            onCycleStatus={() => cycleStatus(g.key, setGeneralStates)}
                            onToggleAbnormal={(optKey) => toggleAbnormal(g.key, optKey, setGeneralStates)}
                            onSetFindings={(findings) => setFindings(g.key, findings, setGeneralStates)}
                        />
                    );
                })}
                {isCustom ? (
                    customBlocks.map(block => {
                        const state = customStates[block.id] || defaultItemState();
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
                            />
                        );
                    })
                ) : (
                    categoryDef.items.map(item => {
                        const state = itemStates[item.key] || defaultItemState();
                        return (
                            <ExamItemRow
                                key={item.key}
                                label={item.label}
                                normalText={item.normalText}
                                abnormalOptions={item.abnormalOptions}
                                state={state}
                                onCycleStatus={() => cycleStatus(item.key, setItemStates)}
                                onToggleAbnormal={(optKey) => toggleAbnormal(item.key, optKey, setItemStates)}
                                onSetFindings={(findings) => setFindings(item.key, findings, setItemStates)}
                            />
                        );
                    })
                )}
                {generalDefs.slice(WRAPPER_BEFORE_COUNT).map(g => {
                    const state = generalStates[g.key] || defaultItemState();
                    return (
                        <ExamItemRow
                            key={g.key}
                            label={g.label}
                            normalText={g.normalText}
                            abnormalOptions={g.abnormalOptions}
                            state={state}
                            onCycleStatus={() => cycleStatus(g.key, setGeneralStates)}
                            onToggleAbnormal={(optKey) => toggleAbnormal(g.key, optKey, setGeneralStates)}
                            onSetFindings={(findings) => setFindings(g.key, findings, setGeneralStates)}
                        />
                    );
                })}
            </div>

            {/* Additional Findings */}
            <div>
                <label className="text-xs text-secondary font-medium block mb-1">Additional Findings</label>
                <textarea
                    value={additional}
                    onChange={(e) => setAdditional(e.target.value)}
                    placeholder="Enter additional findings..."
                    className="w-full text-xs px-3 py-2 rounded border border-themegray1/20 bg-themewhite text-tertiary outline-none focus:border-themeblue1/30 resize-none min-h-[3rem]"
                />
                <PIIWarningBanner warnings={additionalPiiWarnings} />
            </div>

            </>
            )}
        </div>
    );
}
