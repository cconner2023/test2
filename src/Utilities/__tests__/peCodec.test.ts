// Unit tests for peCodec v6 encode/decode roundtrips
// Tests encodePEState / decodePEState / renderPEStateToText directly from PEState.

import { describe, it, expect } from 'vitest';
import { encodePEState, decodePEState, renderPEStateToText } from '../peCodec';
import type { PEState } from '../../Types/PETypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<PEState> = {}): PEState {
    return {
        categoryLetter: 'A',
        laterality: 'right',
        spineRegion: 'lumbar',
        vitals: {},
        items: {},
        additional: '',
        depth: 'focused',
        ...overrides,
    };
}

/** Encode then decode back to PEState. */
function roundtrip(state: PEState): PEState | null {
    const encoded = encodePEState(state);
    return decodePEState(encoded, 'A-1');
}

// ---------------------------------------------------------------------------
// 1. Format detection
// ---------------------------------------------------------------------------

describe('v6 format detection', () => {
    it('encoded string starts with "6:" for any category', () => {
        const encoded = encodePEState(makeState());
        expect(encoded.startsWith('6:')).toBe(true);
    });

    it('decodePEState returns null for non-v6 strings', () => {
        expect(decodePEState('4:A,R,,,,,,,~0~0~~', 'A-1')).toBeNull();
        expect(decodePEState('5:A,R,,,,,,,~0~0~~', 'A-1')).toBeNull();
        expect(decodePEState('some random text', 'A-1')).toBeNull();
        expect(decodePEState('', 'A-1')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 2. Vitals roundtrip
// ---------------------------------------------------------------------------

describe('Vitals roundtrip', () => {
    it('preserves all vital sign fields', () => {
        const state = makeState({
            vitals: { hr: '72', rr: '16', bpSys: '118', bpDia: '76', temp: '98.4', ht: '70', wt: '185' },
        });
        const decoded = roundtrip(state);
        expect(decoded?.vitals.hr).toBe('72');
        expect(decoded?.vitals.rr).toBe('16');
        expect(decoded?.vitals.bpSys).toBe('118');
        expect(decoded?.vitals.bpDia).toBe('76');
        expect(decoded?.vitals.temp).toBe('98.4');
        expect(decoded?.vitals.ht).toBe('70');
        expect(decoded?.vitals.wt).toBe('185');
    });

    it('preserves partial vitals', () => {
        const state = makeState({ vitals: { hr: '88', rr: '20' } });
        const decoded = roundtrip(state);
        expect(decoded?.vitals.hr).toBe('88');
        expect(decoded?.vitals.rr).toBe('20');
        expect(decoded?.vitals.ht || '').toBe('');
        expect(decoded?.vitals.wt || '').toBe('');
    });

    it('handles empty vitals without crashing', () => {
        const state = makeState({ vitals: {} });
        const decoded = roundtrip(state);
        expect(decoded).not.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 3. Category letter and laterality
// ---------------------------------------------------------------------------

describe('Category and laterality roundtrip', () => {
    it('preserves category letter', () => {
        for (const cat of ['A', 'B', 'C', 'D', 'E', 'F'] as const) {
            const state = makeState({ categoryLetter: cat });
            const encoded = encodePEState(state);
            const decoded = decodePEState(encoded, `${cat}-1`);
            expect(decoded?.categoryLetter).toBe(cat);
        }
    });

    it('preserves left laterality', () => {
        const state = makeState({ categoryLetter: 'B', laterality: 'left' });
        const encoded = encodePEState(state);
        const decoded = decodePEState(encoded, 'B-3');
        expect(decoded?.laterality).toBe('left');
    });

    it('preserves right laterality', () => {
        const state = makeState({ categoryLetter: 'B', laterality: 'right' });
        const encoded = encodePEState(state);
        const decoded = decodePEState(encoded, 'B-3');
        expect(decoded?.laterality).toBe('right');
    });

    it('preserves bilateral laterality', () => {
        const state = makeState({ categoryLetter: 'B', laterality: 'bilateral' });
        const encoded = encodePEState(state);
        const decoded = decodePEState(encoded, 'B-9');
        expect(decoded?.laterality).toBe('bilateral');
    });

    it('preserves spine region for back pain', () => {
        const state = makeState({ categoryLetter: 'B', spineRegion: 'cervical' });
        const encoded = encodePEState(state);
        const decoded = decodePEState(encoded, 'B-1');
        expect(decoded?.spineRegion).toBe('cervical');
    });
});

// ---------------------------------------------------------------------------
// 4. Normal item roundtrip
// ---------------------------------------------------------------------------

describe('Normal item status roundtrip', () => {
    it('normal wrapper item with selected normals preserved', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'normal', findings: '', selectedNormals: ['appearsStatedAge', 'wnwd', 'noAcuteDistress'], selectedAbnormals: [] },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.status).toBe('normal');
        expect(decoded?.items.bl_gen?.selectedNormals).toContain('appearsStatedAge');
        expect(decoded?.items.bl_gen?.selectedNormals).toContain('wnwd');
        expect(decoded?.items.bl_gen?.selectedNormals).toContain('noAcuteDistress');
    });

    it('normal item with no normals selected preserved', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'normal', findings: '', selectedNormals: [], selectedAbnormals: [] },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.status).toBe('normal');
        expect(decoded?.items.bl_gen?.selectedNormals).toEqual([]);
    });

    it('not-examined items are omitted from decoded state', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'normal', findings: '', selectedNormals: ['appearsStatedAge'], selectedAbnormals: [] },
            },
        });
        const decoded = roundtrip(state);
        // bl_eyes was not set — should not appear in decoded items
        expect(decoded?.items.bl_eyes).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 5. Abnormal item roundtrip — selectedAbnormals
// ---------------------------------------------------------------------------

describe('Abnormal item roundtrip', () => {
    it('single abnormal key preserved for wrapper item', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'abnormal', findings: '', selectedNormals: [], selectedAbnormals: ['acuteDistress'] },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.status).toBe('abnormal');
        expect(decoded?.items.bl_gen?.selectedAbnormals).toContain('acuteDistress');
    });

    it('multiple abnormal keys preserved', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'abnormal', findings: '', selectedNormals: [], selectedAbnormals: ['acuteDistress', 'mildDistress'] },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.selectedAbnormals).toContain('acuteDistress');
        expect(decoded?.items.bl_gen?.selectedAbnormals).toContain('mildDistress');
    });

    it('PSYCH abnormal keys preserved', () => {
        const state = makeState({
            categoryLetter: 'F',
            items: {
                bl_psych: { status: 'abnormal', findings: '', selectedNormals: [], selectedAbnormals: ['depressedMood', 'anxious'] },
            },
        });
        const encoded = encodePEState(state);
        const decoded = decodePEState(encoded, 'F-1');
        expect(decoded?.items.bl_psych?.selectedAbnormals).toContain('depressedMood');
        expect(decoded?.items.bl_psych?.selectedAbnormals).toContain('anxious');
    });

    it('mixed normals and abnormals preserved', () => {
        const state = makeState({
            items: {
                bl_gen: {
                    status: 'abnormal',
                    findings: '',
                    selectedNormals: ['appearsStatedAge'],
                    selectedAbnormals: ['acuteDistress'],
                },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.selectedNormals).toContain('appearsStatedAge');
        expect(decoded?.items.bl_gen?.selectedAbnormals).toContain('acuteDistress');
    });
});

// ---------------------------------------------------------------------------
// 6. Abnormal item roundtrip — free text (findings)
// ---------------------------------------------------------------------------

describe('Abnormal item free text roundtrip', () => {
    it('findings string preserved through encode/decode', () => {
        const state = makeState({
            items: {
                bl_gen: {
                    status: 'abnormal',
                    findings: 'Patient pale and diaphoretic on arrival',
                    selectedNormals: [],
                    selectedAbnormals: ['acuteDistress'],
                },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.findings).toBe('Patient pale and diaphoretic on arrival');
        expect(decoded?.items.bl_gen?.selectedAbnormals).toContain('acuteDistress');
    });

    it('findings with special characters preserved', () => {
        const findings = 'Temp: 101.3°F — "sharp" epigastric pain';
        const state = makeState({
            items: {
                bl_gen: { status: 'abnormal', findings, selectedNormals: [], selectedAbnormals: [] },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.findings).toBe(findings);
    });

    it('findings only (no selections) preserved', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'abnormal', findings: 'Custom free text only', selectedNormals: [], selectedAbnormals: [] },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.findings).toBe('Custom free text only');
        expect(decoded?.items.bl_gen?.selectedNormals).toEqual([]);
        expect(decoded?.items.bl_gen?.selectedAbnormals).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// 7. Additional findings
// ---------------------------------------------------------------------------

describe('Additional findings roundtrip', () => {
    it('additional field preserved', () => {
        const state = makeState({ additional: 'Patient reports dizziness when standing.' });
        const decoded = roundtrip(state);
        expect(decoded?.additional).toBe('Patient reports dizziness when standing.');
    });

    it('empty additional returns empty string', () => {
        const state = makeState({ additional: '' });
        const decoded = roundtrip(state);
        expect(decoded?.additional).toBe('');
    });

    it('additional with special characters preserved', () => {
        const additional = 'Temp spike: 101.3°F — "sharp" pain';
        const state = makeState({ additional });
        const decoded = roundtrip(state);
        expect(decoded?.additional).toBe(additional);
    });
});

// ---------------------------------------------------------------------------
// 8. Mixed normal + abnormal items
// ---------------------------------------------------------------------------

describe('Mixed normal and abnormal items roundtrip', () => {
    it('normal and abnormal wrappers in same state both preserved', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'normal', findings: '', selectedNormals: ['appearsStatedAge'], selectedAbnormals: [] },
                bl_eyes: { status: 'abnormal', findings: '', selectedNormals: [], selectedAbnormals: ['anisocoria'] },
                bl_neuro: { status: 'normal', findings: '', selectedNormals: ['aoX4'], selectedAbnormals: [] },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.status).toBe('normal');
        expect(decoded?.items.bl_eyes?.status).toBe('abnormal');
        expect(decoded?.items.bl_eyes?.selectedAbnormals).toContain('anisocoria');
        expect(decoded?.items.bl_neuro?.status).toBe('normal');
    });
});

// ---------------------------------------------------------------------------
// 9. Empty state
// ---------------------------------------------------------------------------

describe('Empty / minimal state', () => {
    it('fully empty state encodes and decodes without crashing', () => {
        const state = makeState();
        const encoded = encodePEState(state);
        expect(encoded.startsWith('6:')).toBe(true);
        const decoded = decodePEState(encoded, 'A-1');
        expect(decoded).not.toBeNull();
        expect(Object.keys(decoded!.items)).toHaveLength(0);
    });

    it('decoded empty state has empty additional', () => {
        const decoded = roundtrip(makeState());
        expect(decoded?.additional).toBe('');
    });
});

// ---------------------------------------------------------------------------
// 10. renderPEStateToText
// ---------------------------------------------------------------------------

describe('renderPEStateToText', () => {
    it('renders normal wrapper item with label and normal text', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'normal', findings: '', selectedNormals: ['appearsStatedAge', 'wnwd', 'noAcuteDistress'], selectedAbnormals: [] },
            },
        });
        const text = renderPEStateToText(state);
        expect(text).toContain('GEN:');
        expect(text).toContain('Appears stated age');
    });

    it('renders abnormal wrapper item with abnormal labels', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'abnormal', findings: '', selectedNormals: [], selectedAbnormals: ['acuteDistress', 'mildDistress'] },
            },
        });
        const text = renderPEStateToText(state);
        expect(text).toContain('GEN:');
        expect(text).toContain('Acute distress');
        expect(text).toContain('Mild distress');
    });

    it('renders abnormal item with free text', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'abnormal', findings: 'custom note here', selectedNormals: [], selectedAbnormals: [] },
            },
        });
        const text = renderPEStateToText(state);
        expect(text).toContain('custom note here');
    });

    it('renders vitals section', () => {
        const state = makeState({
            vitals: { hr: '72', rr: '16', bpSys: '120', bpDia: '80' },
        });
        const text = renderPEStateToText(state);
        expect(text).toContain('Vital Signs:');
        expect(text).toContain('HR: 72 bpm');
        expect(text).toContain('BP: 120/80 mmHg');
    });

    it('renders additional findings section', () => {
        const state = makeState({ additional: 'Extra note here.' });
        const text = renderPEStateToText(state);
        expect(text).toContain('Additional Findings: Extra note here.');
    });

    it('renders before-wrappers before focused items, after-wrappers after', () => {
        const state = makeState({
            categoryLetter: 'A',
            items: {
                bl_gen: { status: 'normal', findings: '', selectedNormals: ['appearsStatedAge'], selectedAbnormals: [] },   // before
                bl_neuro: { status: 'normal', findings: '', selectedNormals: ['aoX4'], selectedAbnormals: [] }, // after
            },
        });
        const text = renderPEStateToText(state);
        const genIdx = text.indexOf('GEN:');
        const neuroIdx = text.indexOf('NEURO:');
        expect(genIdx).toBeGreaterThanOrEqual(0);
        expect(neuroIdx).toBeGreaterThanOrEqual(0);
        expect(genIdx).toBeLessThan(neuroIdx);
    });

    it('empty state renders empty string', () => {
        const text = renderPEStateToText(makeState());
        expect(text.trim()).toBe('');
    });
});
