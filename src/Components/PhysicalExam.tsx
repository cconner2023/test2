import { useState, useEffect, useCallback } from 'react';
import type { getColorClasses } from '../Utilities/ColorUtilities';
import {
    getCategoryFromSymptomCode,
    getMSKBodyPart,
    getPECategory,
    getGeneralFindings,
    VITAL_SIGNS,
} from '../Data/PhysicalExamData';
import type { CategoryLetter, Laterality, PECategoryDef, PEItem, AbnormalOption, GeneralFinding } from '../Data/PhysicalExamData';

type SystemStatus = 'not-examined' | 'normal' | 'abnormal';

interface ItemState {
    status: SystemStatus;
    findings: string;
    selectedAbnormals: string[];
}

type PEDepth = 'minimal' | 'expanded';

interface PhysicalExamProps {
    initialText?: string;
    onChange: (text: string) => void;
    colors: ReturnType<typeof getColorClasses>;
    symptomCode: string;
    depth?: PEDepth;
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

function parseInitialText(
    text: string,
    categoryDef: PECategoryDef,
    bodyPart: { code: string; label: string } | null,
    generalDefs: GeneralFinding[],
): {
    items: Record<string, ItemState>;
    generals: Record<string, ItemState>;
    laterality: Laterality;
    additional: string;
    vitals: Record<string, string>;
} {
    const items: Record<string, ItemState> = {};
    categoryDef.items.forEach(i => { items[i.key] = defaultItemState(); });
    const generals: Record<string, ItemState> = {};
    generalDefs.forEach(g => { generals[g.key] = defaultItemState(); });
    let laterality: Laterality = 'right';
    let additional = '';
    const vitals: Record<string, string> = {};
    VITAL_SIGNS.forEach(v => { vitals[v.key] = ''; });

    if (!text) return { items, generals, laterality, additional, vitals };

    const lines = text.split('\n');
    let inAdditional = false;
    let inVitals = false;
    let inGeneral = false;
    const unmatchedLines: string[] = [];

    // Build lookup for vital sign labels
    const vitalLabelToKey: Record<string, string> = {};
    VITAL_SIGNS.forEach(v => { vitalLabelToKey[v.shortLabel] = v.key; });

    // Build lookup for general findings by label
    const generalByLabel: Record<string, GeneralFinding> = {};
    generalDefs.forEach(g => { generalByLabel[g.label] = g; });

    for (const line of lines) {
        // Additional Findings section
        if (line.startsWith('Additional Findings:')) {
            inAdditional = true;
            inVitals = false;
            inGeneral = false;
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
            inGeneral = false;
            continue;
        }
        if (inVitals) {
            // Parse combined "BP: 120/80 mmHg" line
            const bpMatch = line.match(/^\s*BP:\s*(.+?)\/(.+?)\s*mmHg/);
            if (bpMatch) {
                const sys = bpMatch[1].trim();
                const dia = bpMatch[2].trim();
                if (sys && sys !== '--') vitals['bpSys'] = sys;
                if (dia && dia !== '--') vitals['bpDia'] = dia;
                continue;
            }
            // Parse "  HR: 80 bpm" style lines
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

        // General section header
        if (line.trim() === 'General:') {
            inGeneral = true;
            inVitals = false;
            continue;
        }

        // Skip blank lines and category headers
        if (!line.trim()) continue;
        if (line.match(/^(HEENT|MSK|Gastrointestinal|Cardiorespiratory|Genitourinary|Neuropsychiatric|Constitutional|Eye|Gynecological|Dermatological|Environmental|Miscellaneous|Misc Return|Musculoskeletal)/)) {
            inGeneral = false;
            const latMatch = line.match(/\((Left|Right|Bilateral)\)/i);
            if (latMatch) {
                laterality = latMatch[1].toLowerCase() as Laterality;
            }
            continue;
        }

        // Skip old vitals lines
        if (line.startsWith('Vitals:')) continue;

        // Try to match general findings if we're in the general section
        if (inGeneral) {
            let matchedGeneral = false;
            for (const g of generalDefs) {
                if (line.startsWith(`${g.label}:`)) {
                    const rest = line.slice(g.label.length + 1).trim();
                    if (rest.startsWith('Abnormal')) {
                        const abnormalText = rest.replace(/^Abnormal\s*-?\s*/, '').trim();
                        const parsed = parseAbnormalText(abnormalText, g.abnormalOptions);
                        generals[g.key] = { status: 'abnormal', findings: parsed.freeText, selectedAbnormals: parsed.selectedKeys };
                    } else if (rest.startsWith('Normal')) {
                        generals[g.key] = normalItemState();
                    }
                    matchedGeneral = true;
                    break;
                }
            }
            if (matchedGeneral) continue;
        }

        // Try to match "Label: Normal - normalText" or "Label: Abnormal - findings"
        let matched = false;
        for (const item of categoryDef.items) {
            if (line.startsWith(`${item.label}:`)) {
                const rest = line.slice(item.label.length + 1).trim();
                if (rest.startsWith('Abnormal')) {
                    const abnormalText = rest.replace(/^Abnormal\s*-?\s*/, '').trim();
                    const parsed = parseAbnormalText(abnormalText, item.abnormalOptions);
                    items[item.key] = { status: 'abnormal', findings: parsed.freeText, selectedAbnormals: parsed.selectedKeys };
                } else if (rest.startsWith('Normal')) {
                    items[item.key] = normalItemState();
                }
                matched = true;
                break;
            }
        }

        // Backward compat: try matching old generic body system names
        if (!matched) {
            let oldMatch = false;
            for (const sys of OLD_BODY_SYSTEMS) {
                if (line.startsWith(`${sys}:`)) {
                    oldMatch = true;
                    break;
                }
            }
            if (oldMatch || !matched) {
                if (line.trim() && !line.match(/^(Vitals:|PE:)/)) {
                    unmatchedLines.push(line);
                }
            }
        }
    }

    // Put unmatched old-format content into Additional Findings
    if (unmatchedLines.length > 0) {
        const extraContent = unmatchedLines.join('\n');
        additional = additional ? `${additional}\n${extraContent}` : extraContent;
    }

    return { items, generals, laterality, additional, vitals };
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

function generateText(
    categoryDef: PECategoryDef,
    itemStates: Record<string, ItemState>,
    generalDefs: GeneralFinding[],
    generalStates: Record<string, ItemState>,
    bodyPart: { code: string; label: string } | null,
    laterality: Laterality,
    additional: string,
    vitals: Record<string, string>,
): string {
    const parts: string[] = [];

    // Vital Signs section
    const hasVitals = VITAL_SIGNS.some(v => vitals[v.key]?.trim());
    if (hasVitals) {
        parts.push('Vital Signs:');
        for (const v of VITAL_SIGNS) {
            if (v.key === 'bpSys') {
                const sys = vitals['bpSys']?.trim();
                const dia = vitals['bpDia']?.trim();
                if (sys || dia) {
                    parts.push(`  BP: ${sys || '--'}/${dia || '--'} mmHg`);
                }
                continue;
            }
            if (v.key === 'bpDia') continue;
            const val = vitals[v.key]?.trim();
            if (val) {
                parts.push(`  ${v.shortLabel}: ${val} ${v.unit}`);
            }
        }
    }

    // General Findings section
    const hasGenerals = generalDefs.some(g => generalStates[g.key]?.status !== 'not-examined');
    if (hasGenerals) {
        if (parts.length > 0) parts.push('');
        parts.push('General:');
        for (const g of generalDefs) {
            const state = generalStates[g.key];
            if (!state || state.status === 'not-examined') continue;
            if (state.status === 'normal') {
                parts.push(`${g.label}: Normal - ${g.normalText}`);
            } else if (state.status === 'abnormal') {
                const abnormalText = buildAbnormalText(state, g.abnormalOptions);
                parts.push(`${g.label}: Abnormal - ${abnormalText}`);
            }
        }
    }

    // Category-specific items
    const hasExaminedItems = categoryDef.items.some(i => itemStates[i.key]?.status !== 'not-examined');
    if (hasExaminedItems) {
        if (parts.length > 0) parts.push('');
        if (categoryDef.category === 'B' && bodyPart) {
            const latLabel = laterality === 'bilateral' ? 'Bilateral' : laterality === 'left' ? 'Left' : 'Right';
            parts.push(`MSK - ${bodyPart.label} (${latLabel}):`);
        } else {
            parts.push(`${categoryDef.label}:`);
        }

        for (const item of categoryDef.items) {
            const state = itemStates[item.key];
            if (!state || state.status === 'not-examined') continue;
            if (state.status === 'normal') {
                if (item.normalText) {
                    parts.push(`${item.label}: Normal - ${item.normalText}`);
                } else {
                    parts.push(`${item.label}: Normal`);
                }
            } else if (state.status === 'abnormal') {
                const abnormalText = buildAbnormalText(state, item.abnormalOptions);
                parts.push(`${item.label}: Abnormal - ${abnormalText}`);
            }
        }
    }

    if (additional.trim()) {
        if (parts.length > 0) parts.push('');
        parts.push(`Additional Findings: ${additional.trim()}`);
    }

    return parts.join('\n');
}

// ── Shared item row renderer ─────────────────────────────────

function ExamItemRow({ itemKey, label, normalText, abnormalOptions, state, onCycleStatus, onToggleAbnormal, onSetFindings, colors }: {
    itemKey: string;
    label: string;
    normalText?: string;
    abnormalOptions?: AbnormalOption[];
    state: ItemState;
    onCycleStatus: () => void;
    onToggleAbnormal: (optKey: string) => void;
    onSetFindings: (findings: string) => void;
    colors: ReturnType<typeof getColorClasses>;
}) {
    return (
        <div>
            <div
                className={`flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-colors text-xs
                    ${state.status === 'normal'
                        ? colors.symptomClass
                        : state.status === 'abnormal'
                            ? 'border border-themeredred/40 bg-themeredred/10 text-primary'
                            : 'border border-themegray1/20 bg-themewhite text-secondary hover:bg-themewhite3'
                    }`}
                onClick={onCycleStatus}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCycleStatus(); } }}
            >
                <span className="font-medium">{label}</span>
                <span className="text-[10px] uppercase tracking-wide opacity-70">
                    {state.status === 'not-examined' ? 'Not Examined'
                        : state.status === 'normal' ? 'Normal'
                        : 'Abnormal'}
                </span>
            </div>
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
                </div>
            )}
        </div>
    );
}

// ── Component ─────────────────────────────────────────────────

export function PhysicalExam({ initialText = '', onChange, colors, symptomCode, depth = 'minimal' }: PhysicalExamProps) {
    const categoryLetter = getCategoryFromSymptomCode(symptomCode) || 'A';
    const categoryDef = getPECategory(categoryLetter);
    const bodyPart = categoryLetter === 'B' ? getMSKBodyPart(symptomCode) : null;
    const generalDefs = getGeneralFindings(categoryLetter);

    const [parsed] = useState(() => parseInitialText(initialText, categoryDef, bodyPart, generalDefs));

    const [itemStates, setItemStates] = useState<Record<string, ItemState>>(() => {
        if (depth === 'expanded' && !initialText) {
            const states: Record<string, ItemState> = {};
            categoryDef.items.forEach(i => { states[i.key] = normalItemState(); });
            return states;
        }
        return parsed.items;
    });

    const [generalStates, setGeneralStates] = useState<Record<string, ItemState>>(() => {
        if (depth === 'expanded' && !initialText) {
            const states: Record<string, ItemState> = {};
            generalDefs.forEach(g => { states[g.key] = normalItemState(); });
            return states;
        }
        return parsed.generals;
    });

    const [laterality, setLaterality] = useState<Laterality>(() => parsed.laterality);
    const [additional, setAdditional] = useState(() => parsed.additional);
    const [vitals, setVitals] = useState<Record<string, string>>(() => parsed.vitals);

    const emitChange = useCallback((
        states: Record<string, ItemState>,
        genStates: Record<string, ItemState>,
        lat: Laterality,
        add: string,
        vit: Record<string, string>,
    ) => {
        onChange(generateText(categoryDef, states, generalDefs, genStates, bodyPart, lat, add, vit));
    }, [onChange, categoryDef, generalDefs, bodyPart]);

    useEffect(() => {
        emitChange(itemStates, generalStates, laterality, additional, vitals);
    }, [itemStates, generalStates, laterality, additional, vitals, emitChange]);

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
        setItemStates(prev => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
                next[key] = normalItemState();
            }
            return next;
        });
        setGeneralStates(prev => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
                next[key] = normalItemState();
            }
            return next;
        });
    };

    return (
        <div className="p-3 space-y-2">
            {/* Vital Signs */}
            <div className="pb-2 border-b border-themegray1/15">
                <span className="text-xs text-secondary font-medium block mb-2">Vital Signs</span>
                <div className="grid grid-cols-3 gap-2">
                    {VITAL_SIGNS.map(v => {
                        if (v.key === 'bpDia') return null;
                        if (v.key === 'bpSys') return (
                            <div key="bp" className="flex flex-col">
                                <label className="text-[10px] text-secondary mb-0.5">BP (mmHg)</label>
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
                                <label className="text-[10px] text-secondary mb-0.5">{v.shortLabel} ({v.unit})</label>
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
            {depth === 'minimal' ? (
                <>
                    <div className="pt-2 border-t border-themegray1/15">
                        <label className="text-xs text-secondary font-medium block mb-1">Additional Findings</label>
                        <textarea
                            value={additional}
                            onChange={(e) => setAdditional(e.target.value)}
                            placeholder="Enter additional findings..."
                            className="w-full text-xs px-3 py-2 rounded border border-themegray1/20 bg-themewhite text-tertiary outline-none focus:border-themeblue1/30 resize-none min-h-[3rem]"
                        />
                    </div>
                </>
            ) : (
            <>

            {/* All Normal button */}
            <div className="pb-2 border-b border-themegray1/15">
                <button
                    onClick={markAllNormal}
                    className="w-full py-2 text-xs font-medium rounded-md border border-themeblue1/30 text-themeblue1 bg-themeblue1/5 hover:bg-themeblue1/10 transition-colors"
                >
                    All Normal
                </button>
            </div>

            {/* MSK laterality selector */}
            {categoryLetter === 'B' && bodyPart && (
                <div className="flex items-center gap-2 pb-2 border-b border-themegray1/15">
                    <span className="text-xs text-secondary font-medium">{bodyPart.label}</span>
                    <div className="flex gap-1 ml-auto">
                        {(['left', 'right', 'bilateral'] as Laterality[]).map(lat => (
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
                        ))}
                    </div>
                </div>
            )}

            {/* General Findings section */}
            {generalDefs.length > 0 && (
                <div className="border-l-2 border-themeblue1/30 pl-2 space-y-2">
                    <span className="text-[10px] text-secondary/70 font-semibold uppercase tracking-wider">General</span>
                    {generalDefs.map(g => {
                        const state = generalStates[g.key] || defaultItemState();
                        return (
                            <ExamItemRow
                                key={g.key}
                                itemKey={g.key}
                                label={g.label}
                                normalText={g.normalText}
                                abnormalOptions={g.abnormalOptions}
                                state={state}
                                onCycleStatus={() => cycleStatus(g.key, setGeneralStates)}
                                onToggleAbnormal={(optKey) => toggleAbnormal(g.key, optKey, setGeneralStates)}
                                onSetFindings={(findings) => setFindings(g.key, findings, setGeneralStates)}
                                colors={colors}
                            />
                        );
                    })}
                </div>
            )}

            {/* Category-specific header */}
            <div className="pt-1">
                <span className="text-[10px] text-secondary/70 font-semibold uppercase tracking-wider">
                    {categoryLetter === 'B' && bodyPart ? `MSK - ${bodyPart.label}` : categoryDef.label}
                </span>
            </div>

            {/* Category exam items */}
            {categoryDef.items.map(item => {
                const state = itemStates[item.key] || defaultItemState();
                return (
                    <ExamItemRow
                        key={item.key}
                        itemKey={item.key}
                        label={item.label}
                        normalText={item.normalText}
                        abnormalOptions={item.abnormalOptions}
                        state={state}
                        onCycleStatus={() => cycleStatus(item.key, setItemStates)}
                        onToggleAbnormal={(optKey) => toggleAbnormal(item.key, optKey, setItemStates)}
                        onSetFindings={(findings) => setFindings(item.key, findings, setItemStates)}
                        colors={colors}
                    />
                );
            })}

            {/* Additional Findings */}
            <div className="pt-2 border-t border-themegray1/15">
                <label className="text-xs text-secondary font-medium block mb-1">Additional Findings</label>
                <textarea
                    value={additional}
                    onChange={(e) => setAdditional(e.target.value)}
                    placeholder="Enter additional findings..."
                    className="w-full text-xs px-3 py-2 rounded border border-themegray1/20 bg-themewhite text-tertiary outline-none focus:border-themeblue1/30 resize-none min-h-[3rem]"
                />
            </div>

            </>
            )}
        </div>
    );
}
