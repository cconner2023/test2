import { useState, useEffect, useCallback } from 'react';
import type { getColorClasses } from '../Utilities/ColorUtilities';
import {
    getCategoryFromSymptomCode,
    getMSKBodyPart,
    getPECategory,
    PE_CATEGORIES,
    VITAL_SIGNS,
} from '../Data/PhysicalExamData';
import type { CategoryLetter, Laterality, PECategoryDef } from '../Data/PhysicalExamData';

type SystemStatus = 'not-examined' | 'normal' | 'abnormal';

interface ItemState {
    status: SystemStatus;
    findings: string;
}

type PEDepth = 'focused' | 'standard' | 'comprehensive';

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

// ── Parse initial text ────────────────────────────────────────

function parseInitialText(
    text: string,
    categoryDef: PECategoryDef,
    bodyPart: { code: string; label: string } | null,
): { items: Record<string, ItemState>; laterality: Laterality; additional: string; vitals: Record<string, string> } {
    const items: Record<string, ItemState> = {};
    categoryDef.items.forEach(i => { items[i.key] = { status: 'not-examined', findings: '' }; });
    let laterality: Laterality = 'right';
    let additional = '';
    const vitals: Record<string, string> = {};
    VITAL_SIGNS.forEach(v => { vitals[v.key] = ''; });

    if (!text) return { items, laterality, additional, vitals };

    const lines = text.split('\n');
    let inAdditional = false;
    let inVitals = false;
    const unmatchedLines: string[] = [];

    // Build lookup for vital sign labels
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
                    // Strip the unit suffix for clean value
                    let val = vitalMatch[2].trim();
                    const vitalDef = VITAL_SIGNS.find(v => v.key === key);
                    if (vitalDef && val.endsWith(vitalDef.unit)) {
                        val = val.slice(0, -vitalDef.unit.length).trim();
                    }
                    vitals[key] = val;
                    continue;
                }
            }
            // If we hit a non-vital line, we're out of the vitals section
            if (line.trim()) inVitals = false;
            else continue;
        }

        // Skip blank lines and category headers
        if (!line.trim()) continue;
        if (line.match(/^(HEENT|MSK|Gastrointestinal|Cardiorespiratory|Genitourinary|Neuropsychiatric|Constitutional|Eye|Gynecological|Dermatological|Environmental|Miscellaneous|Misc Return|Musculoskeletal)/)) {
            // Check for laterality in MSK header
            const latMatch = line.match(/\((Left|Right|Bilateral)\)/i);
            if (latMatch) {
                laterality = latMatch[1].toLowerCase() as Laterality;
            }
            continue;
        }

        // Skip old vitals lines
        if (line.startsWith('Vitals:')) continue;

        // Try to match "Label: Normal" or "Label: Abnormal - findings"
        let matched = false;
        for (const item of categoryDef.items) {
            if (line.startsWith(`${item.label}:`)) {
                const rest = line.slice(item.label.length + 1).trim();
                if (rest.startsWith('Abnormal')) {
                    items[item.key] = {
                        status: 'abnormal',
                        findings: rest.replace(/^Abnormal\s*-?\s*/, '').trim(),
                    };
                } else if (rest === 'Normal') {
                    items[item.key] = { status: 'normal', findings: '' };
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
                // Only add non-empty, non-header lines to unmatched
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

    return { items, laterality, additional, vitals };
}

// ── Generate text output ──────────────────────────────────────

function generateText(
    categoryDef: PECategoryDef,
    itemStates: Record<string, ItemState>,
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
            // Combine systolic/diastolic into one BP line
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

    // Has any item been examined?
    const hasExaminedItems = categoryDef.items.some(i => itemStates[i.key]?.status !== 'not-examined');

    if (hasExaminedItems) {
        if (parts.length > 0) parts.push('');
        // Category header
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
                parts.push(`${item.label}: Normal`);
            } else if (state.status === 'abnormal') {
                parts.push(`${item.label}: Abnormal${state.findings ? ' - ' + state.findings : ''}`);
            }
        }
    }

    if (additional.trim()) {
        if (parts.length > 0) parts.push('');
        parts.push(`Additional Findings: ${additional.trim()}`);
    }

    return parts.join('\n');
}

// ── Component ─────────────────────────────────────────────────

export function PhysicalExam({ initialText = '', onChange, colors, symptomCode, depth = 'standard' }: PhysicalExamProps) {
    const categoryLetter = getCategoryFromSymptomCode(symptomCode) || 'A';
    const categoryDef = getPECategory(categoryLetter);
    const bodyPart = categoryLetter === 'B' ? getMSKBodyPart(symptomCode) : null;

    const [parsed] = useState(() => parseInitialText(initialText, categoryDef, bodyPart));
    const [itemStates, setItemStates] = useState<Record<string, ItemState>>(() => {
        // Comprehensive mode: default all items to 'normal' unless already parsed
        if (depth === 'comprehensive' && !initialText) {
            const states: Record<string, ItemState> = {};
            categoryDef.items.forEach(i => {
                states[i.key] = { status: 'normal', findings: '' };
            });
            return states;
        }
        return parsed.items;
    });
    const [laterality, setLaterality] = useState<Laterality>(() => parsed.laterality);
    const [additional, setAdditional] = useState(() => parsed.additional);
    const [vitals, setVitals] = useState<Record<string, string>>(() => parsed.vitals);

    const emitChange = useCallback((states: Record<string, ItemState>, lat: Laterality, add: string, vit: Record<string, string>) => {
        onChange(generateText(categoryDef, states, bodyPart, lat, add, vit));
    }, [onChange, categoryDef, bodyPart]);

    useEffect(() => {
        emitChange(itemStates, laterality, additional, vitals);
    }, [itemStates, laterality, additional, vitals, emitChange]);

    const setVitalValue = (key: string, value: string) => {
        setVitals(prev => ({ ...prev, [key]: value }));
    };

    const cycleStatus = (key: string) => {
        setItemStates(prev => {
            const current = prev[key].status;
            let next: SystemStatus;
            if (current === 'not-examined') next = 'normal';
            else if (current === 'normal') next = 'abnormal';
            else next = 'not-examined';
            return {
                ...prev,
                [key]: { ...prev[key], status: next, findings: next === 'not-examined' ? '' : prev[key].findings },
            };
        });
    };

    const setFindings = (key: string, findings: string) => {
        setItemStates(prev => ({
            ...prev,
            [key]: { ...prev[key], findings },
        }));
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

            {/* Focused mode: skip exam items, show only vitals + additional findings */}
            {depth === 'focused' ? (
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

            {/* Category label (non-MSK) */}
            {categoryLetter !== 'B' && (
                <div className="pb-1">
                    <span className="text-xs text-secondary font-medium">{categoryDef.label}</span>
                </div>
            )}

            {/* Exam items */}
            {categoryDef.items.map(item => {
                const state = itemStates[item.key];
                return (
                    <div key={item.key}>
                        <div
                            className={`flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-colors text-xs
                                ${state.status === 'normal'
                                    ? colors.symptomClass
                                    : state.status === 'abnormal'
                                        ? 'border border-themeredred/40 bg-themeredred/10 text-primary'
                                        : 'border border-themegray1/20 bg-themewhite text-secondary hover:bg-themewhite3'
                                }`}
                            onClick={() => cycleStatus(item.key)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleStatus(item.key); } }}
                        >
                            <span className="font-medium">{item.label}</span>
                            <span className="text-[10px] uppercase tracking-wide opacity-70">
                                {state.status === 'not-examined' ? 'Not Examined'
                                    : state.status === 'normal' ? 'Normal'
                                    : 'Abnormal'}
                            </span>
                        </div>
                        {state.status === 'abnormal' && (
                            <div className="mt-1 ml-2">
                                <input
                                    type="text"
                                    value={state.findings}
                                    onChange={(e) => setFindings(item.key, e.target.value)}
                                    placeholder="Describe findings..."
                                    className="w-full text-xs px-3 py-1.5 rounded border border-themeredred/20 bg-themewhite text-tertiary outline-none focus:border-themeredred/40"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        )}
                    </div>
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
